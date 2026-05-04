import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TemplateRecord } from './template.service';

export interface RenderedDocumentPage {
  header: SafeHtml;
  body: SafeHtml;
  footer: SafeHtml;
}

@Injectable({ providedIn: 'root' })
export class DocumentRenderService {
  constructor(private readonly sanitizer: DomSanitizer) {}

  render(template: TemplateRecord, data: Record<string, unknown>): RenderedDocumentPage[] {
    const context = this.buildContext(data);
    return [{
      header: this.safe(template.hasHeader ? this.resolve(template.header || '', context, true) : ''),
      body: this.safe(this.resolve(template.body || template.content || template.html || '', context, true)),
      footer: this.safe(template.hasFooter ? this.resolve(template.footer || '', context, true) : '')
    }];
  }

  renderForPrint(template: TemplateRecord, data: Record<string, unknown>): string {
    const context = this.buildContext(data);
    const header = template.hasHeader ? this.resolve(template.header || '', context, false) : '';
    const body = this.resolve(template.body || template.content || template.html || '', context, false);
    const footer = template.hasFooter ? this.resolve(template.footer || '', context, false) : '';
    return `
      <div class="preview-page document-render document-render--print">
        ${header ? `<div class="doc-page-header">${header}</div>` : ''}
        <div class="doc-page-body">${body}</div>
        ${template.hasFooter ? `<div class="doc-page-footer">${footer || '&nbsp;'}</div>` : ''}
      </div>
    `;
  }

  private resolve(html: string, context: Record<string, unknown>, preview: boolean): string {
    let output = this.normalizeSpacing(html || '');
    output = this.resolveObjectTables(output, context, preview);
    output = this.resolveCellExpand(output, context, preview);
    output = output.replace(/\{\{#([\w]+):(ul|inline)\}\}/g, (match, key, mode) => {
      const raw = context[key];
      const items = Array.isArray(raw) ? raw.map(item => typeof item === 'object' && item !== null ? Object.values(item).join(' | ') : String(item)) : [];
      if (!items.length) return preview ? '<span style="color:#aaa;font-style:italic">(liste vide)</span>' : '';
      if (mode === 'inline') return this.wrapResolved(items.map(item => this.escape(item)).join(', '), preview);
      return `<ul style="margin:4px 0;padding-left:1.4em">${items.map(item => `<li>${this.wrapResolved(this.escape(item), preview)}</li>`).join('')}</ul>`;
    });

    output = output.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = context[key];
      if (value === undefined || value === null || Array.isArray(value) || typeof value === 'object') {
        return preview ? `<span class="var-missing">${this.escape(match)}</span>` : match;
      }
      return this.wrapResolved(this.escape(String(value)), preview);
    });
    return output;
  }

  private resolveObjectTables(html: string, context: Record<string, unknown>, preview: boolean): string {
    let output = html;
    let guard = 0;
    while (guard++ < 20) {
      const match = /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):table(?::([\w,\-]+))?\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(output);
      if (!match) break;

      const [fullRow, rowAttrs, rowInner, key, colsRaw] = match;
      const items = this.arrayObjects(context[key]);
      if (!items.length) {
        output = output.replace(fullRow, '');
        continue;
      }

      const cells = this.readCells(rowInner);
      const markerIndex = cells.findIndex(cell => /\{\{#[\w]+:table(?:[:][\w,\-]+)?\}\}/.test(cell.content));
      if (!cells.length || markerIndex === -1) {
        output = output.replace(fullRow, '');
        continue;
      }

      const columns = this.resolveColumns(items, colsRaw);
      const rows = items.map(item => {
        const cellHtml = cells.map((cell, index) => {
          const keyForCell = index === markerIndex ? columns[0] : this.firstPlaceholderKey(cell.content, columns);
          const value = keyForCell ? this.wrapResolved(this.escape(String(item[keyForCell] ?? '')), preview) : this.resolve(cell.content, { ...context, ...item }, preview);
          return `<${cell.tag}${cell.attrs}>${value}</${cell.tag}>`;
        }).join('');
        return `<tr${rowAttrs}>${cellHtml}</tr>`;
      }).join('');

      output = output.replace(fullRow, rows);
    }

    return output.replace(/\{\{#([\w]+):table(?::([\w,\-]+))?\}\}/g, (match, key, colsRaw) => {
      const items = this.arrayObjects(context[key]);
      if (!items.length) return preview ? '<span style="color:#aaa;font-style:italic">(liste vide)</span>' : '';
      const columns = this.resolveColumns(items, colsRaw);
      const thead = `<thead><tr>${columns.map(column => `<th style="font-weight:700;color:var(--doc-color-text, #111);background:var(--doc-table-header-bg, transparent);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px;text-align:left">${this.escape(this.humanize(column))}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${items.map((item, index) => `<tr style="${index % 2 ? 'background:var(--doc-table-row-alt-bg, #f8fafc)' : 'background:#fff'}">${columns.map(column => `<td style="color:var(--doc-color-text, #111);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px">${this.wrapResolved(this.escape(String(item[column] ?? '')), preview)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<table style="border-collapse:collapse;width:100%;margin:6px 0">${thead}${tbody}</table>`;
    });
  }

  private resolveCellExpand(html: string, context: Record<string, unknown>, preview: boolean): string {
    let output = html;
    let guard = 0;
    while (guard++ < 20) {
      const match = /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):cell-expand\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(output);
      if (!match) break;

      const [fullRow, rowAttrs, rowInner] = match;
      const cells = this.readCells(rowInner);
      const markers = cells
        .map((cell, index) => ({ cell, index, key: /\{\{#([\w]+):cell-expand\}\}/.exec(cell.content)?.[1] || '' }))
        .filter(item => item.key);
      const rowCount = markers.reduce((max, marker) => Math.max(max, this.arrayValues(context[marker.key]).length), 0);
      if (!rowCount) {
        output = output.replace(fullRow, '');
        continue;
      }

      const rows: string[] = [];
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const cellHtml = cells.map(cell => {
          const marker = /\{\{#([\w]+):cell-expand\}\}/.exec(cell.content);
          if (!marker) return `<${cell.tag}${cell.attrs}>${this.resolve(cell.content, context, preview)}</${cell.tag}>`;
          const item = this.arrayValues(context[marker[1]])[rowIndex] ?? '';
          return `<${cell.tag}${cell.attrs}>${this.wrapResolved(this.escape(String(item)), preview)}</${cell.tag}>`;
        }).join('');
        rows.push(`<tr${rowAttrs}>${cellHtml}</tr>`);
      }
      output = output.replace(fullRow, rows.join(''));
    }
    return output;
  }

  private buildContext(data: Record<string, unknown>): Record<string, unknown> {
    const now = new Date();
    return {
      ...data,
      date_jour: now.toLocaleDateString('fr-FR'),
      annee: String(now.getFullYear()),
      annee_univ: data['annee_univ'] || this.academicYear(now)
    };
  }

  private academicYear(now: Date): string {
    const year = now.getFullYear();
    return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  private normalizeSpacing(html: string): string {
    return html.replace(/<p>\s*<\/p>/g, '<p>&nbsp;</p>');
  }

  private readCells(rowInner: string): Array<{ tag: string; attrs: string; content: string }> {
    const cells: Array<{ tag: string; attrs: string; content: string }> = [];
    const regex = /<(td|th)((?:\s[^>]*)?|)>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rowInner)) !== null) {
      cells.push({ tag: match[1], attrs: match[2] || '', content: match[3] || '' });
    }
    return cells;
  }

  private arrayObjects(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>> : [];
  }

  private arrayValues(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];
    return value.map(item => item && typeof item === 'object' ? Object.values(item).join(' | ') : item);
  }

  private resolveColumns(items: Array<Record<string, unknown>>, rawColumns = ''): string[] {
    const requested = String(rawColumns || '').split(',').map(item => item.trim()).filter(Boolean);
    const available = Object.keys(items[0] || {});
    return requested.length ? requested.filter(column => available.includes(column)) : available;
  }

  private firstPlaceholderKey(content: string, columns: string[]): string | null {
    const matches = Array.from(content.matchAll(/\{\{(\w+)\}\}/g)).map(match => match[1]);
    return matches.find(key => columns.includes(key)) ?? null;
  }

  private humanize(value: string): string {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  private wrapResolved(value: string, preview: boolean): string {
    return preview ? `<span class="var-resolved">${value}</span>` : value;
  }

  private escape(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private safe(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
