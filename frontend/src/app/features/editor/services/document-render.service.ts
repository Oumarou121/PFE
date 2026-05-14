import { Injectable } from "@angular/core";
import { UnknownRecord } from "../models/editor-common.model";
import { TemplateRecord } from "../models/template.model";
import {
  cloneData,
  getScopedOrganizationId,
  normalizeGraphicCharterConfig,
  normalizeHeaderFooterDistances,
  normalizeTemplateSectionDisplay,
} from "./editor-normalizers";
import { GraphicCharterService } from "./graphic-charter.service";
import { OrganizationService } from "./organization.service";
import { EditorStateService } from "./editor-state.service";
// PHASE 1: PagePaginator extracted to its own file.
// Import is a drop-in replacement — no behaviour change.
import { PagePaginator } from "./page-paginator";

export interface RenderedDocumentPage {
  index: number;
  mode: "preview" | "print";
  header: string;
  content: string;
  footer: string;
  hasHeader?: boolean;
  hasFooter?: boolean;
}

type RenderMode = "preview" | "print";
type ObjectColumn = {
  key: string;
  label: string;
  align?: string;
  width?: string;
  bold?: boolean;
};

@Injectable({ providedIn: "root" })
export class DocumentRenderService {
  constructor(
    private state: EditorStateService,
    private organizations: OrganizationService,
    private graphicCharters: GraphicCharterService,
  ) {}

  buildPreviewHtml(template: TemplateRecord, person: UnknownRecord): string {
    const pages = this.renderDocumentPages(template, person, {
      mode: "preview",
    });
    const themeStyle = this.getDocumentThemeStyleAttr(template);
    return `<div class="preview-pages" style="${themeStyle}">${this.buildDocumentPagesHtml(template, pages, "preview-page", { mode: "preview" })}</div>`;
  }

  renderDocumentPages(
    template: TemplateRecord,
    person: UnknownRecord,
    options: { mode?: RenderMode } = {},
  ): RenderedDocumentPage[] {
    if (!template || !person) return [];
    const mode = this.getDocumentRenderMode(options);
    const context = this.buildDocumentContext(template, person);
    const resolve =
      mode === "preview"
        ? (html: string) => this.resolveVars(html, context)
        : (html: string) => this.resolveVarsRaw(html, context);
    const margins = this.getTemplatePageMargins(template);
    const distances = this.getTemplateHeaderFooterDistances(template);
    const charter = this.getTemplateGraphicCharter(template);
    const orientation = this.getTemplateOrientation(template);
    const header = template.hasHeader ? resolve(template.header || "") : "";
    const body = resolve(template.body || "");
    const footer = template.hasFooter ? resolve(template.footer || "") : "";
    const paginator = new PagePaginator({
      marginTop: margins.mt,
      marginBottom: margins.mb,
      marginLeft: margins.ml,
      marginRight: margins.mr,
      headerTop: distances.headerTop,
      footerBottom: distances.footerBottom,
      headerDirection: this.getTemplateSectionDirection(template, "header"),
      bodyDirection: this.getTemplateSectionDirection(template, "body"),
      footerDirection: this.getTemplateSectionDirection(template, "footer"),
      orientation,
      theme: charter,
    });
    const paginated = paginator.paginate(body, header, footer);
    const pages = paginated.map((page, index) => ({
      index,
      mode,
      header: String(page.header || "").trim(),
      content: String(page.content || ""),
      footer: String(page.footer || "").trim(),
      hasHeader: !!template.hasHeader,
      hasFooter: !!template.hasFooter,
    }));
    const displayed = this.applyTemplateHeaderFooterDisplay(
      pages.length
        ? pages
        : [
            {
              index: 0,
              mode,
              header,
              content: "",
              footer,
              hasHeader: !!template.hasHeader,
              hasFooter: !!template.hasFooter,
            },
          ],
      template,
    );
    return mode === "print"
      ? this.sanitizeFinalRenderPages(displayed)
      : displayed;
  }

  buildDocumentPagesHtml(
    template: TemplateRecord,
    pages: RenderedDocumentPage[],
    className = "preview-page",
    options: { mode?: RenderMode; themeStyle?: string } = {},
  ): string {
    const headerDir = this.getSectionDirectionAttrs(template, "header");
    const bodyDir = this.getSectionDirectionAttrs(template, "body");
    const footerDir = this.getSectionDirectionAttrs(template, "footer");
    const themeStyle = options.themeStyle || this.getDocumentThemeStyleAttr(template);
    const watermark = this.getTemplateWatermark(template);
    const watermarkHtml = watermark.enabled
      ? `<div class="doc-page-watermark" aria-hidden="true" style="color:${this.escapeHtml(watermark.color)};opacity:${watermark.opacity};font-size:${watermark.size}px">${this.escapeHtml(watermark.text)}</div>`
      : "";
    const mode = this.getDocumentRenderMode(options);
    const renderClass =
      mode === "preview"
        ? "document-render document-render--preview"
        : "document-render document-render--print";
    return (Array.isArray(pages) ? pages : [])
      .map((page) => {
        const headerHtml = String(page.header || "").trim();
        const footerHtml = String(page.footer || "").trim();
        const hasFooterSlot = page.hasFooter !== false;
        const emptyFooterStyle = footerHtml
          ? ""
          : ";border-top-color:transparent!important;color:transparent!important;background:transparent!important";
        const noHeaderClass =
          headerHtml && page.hasHeader !== false ? "" : " no-header";
        const noFooterClass = hasFooterSlot ? "" : " no-footer";
        return `
        <div class="${className} ${renderClass}" data-render-mode="${mode}" style="${themeStyle}">
          ${watermarkHtml}
          ${headerHtml ? `<div class="doc-page-header" dir="${headerDir.dir}" style="${themeStyle};${headerDir.style}">${headerHtml}</div>` : ""}
          <div class="doc-page-body${noHeaderClass}${noFooterClass}" dir="${bodyDir.dir}" style="${themeStyle};${bodyDir.style}">${page.content || ""}</div>
          ${hasFooterSlot ? `<div class="doc-page-footer${footerHtml ? "" : " is-empty"}" aria-hidden="${footerHtml ? "false" : "true"}" dir="${footerDir.dir}" style="${themeStyle};${footerDir.style}${emptyFooterStyle}">${footerHtml || "&nbsp;"}</div>` : ""}
        </div>
      `;
      })
      .join("");
  }

  printDocPaginated(template: TemplateRecord, person: UnknownRecord): void {
    if (!template || !person) return;
    const orientation = this.getTemplateOrientation(template);
    const pages = this.renderDocumentPages(template, person, { mode: "print" });
    const printCSS = `
      @page { size: A4 ${orientation}; margin: 0; }
      html, body {
        width: auto !important; height: auto !important; min-height: auto !important;
        overflow: visible !important; margin: 0 !important; padding: 0 !important; background: #fff !important;
      }
      #sirh-print-area { display: block; }
      ${this.getDocumentPrintCss()}
    `;
    document.getElementById("sirh-print-area")?.remove();
    document.getElementById("sirh-print-css")?.remove();
    document.getElementById("sirh-hide-css")?.remove();
    const style = document.createElement("style");
    style.id = "sirh-print-css";
    style.media = "print";
    style.textContent = printCSS;
    const hideStyle = document.createElement("style");
    hideStyle.id = "sirh-hide-css";
    hideStyle.media = "print";
    hideStyle.textContent = `
      body > *:not(#sirh-print-area):not(#sirh-print-css):not(#sirh-hide-css) { display: none !important; }
      #sirh-print-area { display: block !important; }
    `;
    const area = document.createElement("div");
    area.id = "sirh-print-area";
    area.style.display = "none";
    area.style.cssText += `;${this.getDocumentThemeStyleAttr(template)}`;
    area.innerHTML = this.buildDocumentPagesHtml(
      template,
      pages,
      "sirh-print-page",
      { mode: "print" },
    );
    document.body.appendChild(style);
    document.body.appendChild(hideStyle);
    document.body.appendChild(area);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.getElementById("sirh-print-area")?.remove();
        document.getElementById("sirh-print-css")?.remove();
        document.getElementById("sirh-hide-css")?.remove();
      }, 500);
    }, 80);
  }

  getDocumentThemeStyleAttr(template: TemplateRecord): string {
    return Object.entries(this.getDocumentThemeVars(template))
      .map(([key, value]) => `${key}:${value}`)
      .join(";");
  }

  async buildStandaloneDocumentHtml(
    template: TemplateRecord,
    pages: RenderedDocumentPage[],
    className = "document-page",
    options: { mode?: RenderMode } = {},
  ): Promise<string> {
    const themeVars = this.getDocumentThemeVars(template);
    themeVars["--doc-page-bg-image"] = await this.inlineCssUrlValue(
      themeVars["--doc-page-bg-image"],
    );
    const themeStyle = Object.entries(themeVars)
      .map(([key, value]) => `${key}:${value}`)
      .join(";");
    const pagesHtml = this.buildDocumentPagesHtml(template, pages, className, {
      ...options,
      themeStyle,
    });
    const inlinedPagesHtml = await this.inlineHtmlAssetUrls(pagesHtml);
    return `<div class="document-snapshot" data-sirh-document-snapshot="true"><style data-sirh-document-snapshot-style="true">${this.getDocumentPrintCss()}</style><div class="document-pages" style="${themeStyle}">${inlinedPagesHtml}</div></div>`;
  }

  getDocumentPrintCss(options: { preview?: boolean } = {}): string {
    const previewCss = options.preview
      ? `
      .document-pages {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding-bottom: 20px;
      }
      .document-render--print, .document-page, .preview-page, .sirh-print-page {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      }
    `
      : "";
    return `
      .document-render--print, .document-page, .preview-page, .sirh-print-page {
        width: var(--page-w, 210mm); height: var(--page-h, 297mm); background-color: #fff;
        background-image: var(--doc-page-bg-image, none); background-size: var(--doc-page-bg-size, cover);
        background-position: var(--doc-page-bg-position, center center); background-repeat: var(--doc-page-bg-repeat, no-repeat);
        print-color-adjust: exact; -webkit-print-color-adjust: exact; display: block;
        position: relative; box-sizing: border-box;
        overflow: hidden; page-break-after: always; break-after: page;
      }
      .document-render--print:last-child, .document-page:last-child, .preview-page:last-child, .sirh-print-page:last-child { page-break-after: auto; break-after: auto; }
      .document-render--print, .preview-page { box-shadow: none; border-radius: 0; flex-shrink: 0; }
      .doc-page-header {
        position: absolute; inset: 0 0 auto 0; z-index: 1;
        box-sizing: border-box; padding: var(--page-header-top, 5mm) var(--page-mr, 25mm) 3mm var(--page-ml, 25mm);
        font-family: var(--doc-font-body, "Times New Roman", Times, serif); font-size: 12pt; line-height: 1.6;
        color: var(--doc-color-text, #111); background: transparent;
        overflow: hidden; white-space: normal; overflow-wrap: anywhere;
      }
      .doc-page-watermark {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        transform: rotate(-32deg); font-weight: 800; letter-spacing: 0.08em; pointer-events: none;
        z-index: 0; user-select: none; text-align: center; white-space: nowrap;
      }
      .doc-page-body {
        width: 100%; height: 100%; min-height: 0; box-sizing: border-box;
        padding: var(--page-mt, 20mm) var(--page-mr, 25mm) var(--page-mb, 20mm) var(--page-ml, 25mm);
        font-family: var(--doc-font-body, "Times New Roman", Times, serif); font-size: 12pt; line-height: 1.6;
        color: var(--doc-color-text, #111); overflow: hidden; white-space: normal; overflow-wrap: anywhere;
      }
      .doc-page-body.no-header { padding-top: var(--page-mt, 20mm); }
      .doc-page-body.no-footer { padding-bottom: var(--page-mb, 20mm); }
      .doc-page-body.no-header.no-footer { padding: var(--page-mt, 20mm) var(--page-mr, 25mm) var(--page-mb, 20mm) var(--page-ml, 25mm); }
      .doc-page-footer {
        position: absolute; inset: auto 0 0 0; z-index: 1;
        box-sizing: border-box; padding: 3mm var(--page-mr, 25mm) var(--page-footer-bottom, 5mm) var(--page-ml, 25mm);
        font-family: var(--doc-font-body, "Times New Roman", Times, serif); font-size: 12pt; line-height: 1.6;
        color: var(--doc-color-text, #111); background: transparent;
        overflow: hidden; white-space: normal; overflow-wrap: anywhere;
      }
      .doc-page-header p, .doc-page-body p, .doc-page-footer p { margin: 0 0 0.4em; white-space: inherit; }
      .doc-page-header u, .doc-page-body u, .doc-page-footer u,
      .doc-page-header a, .doc-page-body a, .doc-page-footer a {
        text-decoration-thickness: 1px; text-underline-offset: 0.14em; text-decoration-skip-ink: none;
      }
      .preview-page ul, .document-page ul, .doc-page-header ul, .doc-page-body ul, .doc-page-footer ul,
      .preview-page ol, .document-page ol, .doc-page-header ol, .doc-page-body ol, .doc-page-footer ol {
        padding-left: 2em; list-style: revert;
      }
      li { display: list-item; }
      .preview-page table, .document-page table, .sirh-print-page table, table {
        border-collapse: collapse; width: 100%; max-width: 100%;
        table-layout: fixed; margin: 6px 0; box-sizing: border-box; overflow-wrap: anywhere;
      }
      .preview-page td, .preview-page th, .document-page td, .document-page th, td, th {
        border: 1px solid var(--doc-color-border, #c8cdd8); padding: 6px 10px; min-width: 0;
        position: relative; box-sizing: border-box; word-break: normal; overflow-wrap: anywhere;
        white-space: normal; print-color-adjust: exact; -webkit-print-color-adjust: exact;
      }
      .preview-page td p, .preview-page th p, .document-page td p, .document-page th p, td p, th p { color: inherit; margin: 0; white-space: inherit; }
      .preview-page th:not([style]), .document-page th:not([style]), th:not([style]) {
        background: var(--doc-table-header-bg, transparent); color: var(--doc-color-text, #111);
        font-weight: 700; text-align: left;
      }
      th { font-weight: 700; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr, img { break-inside: avoid; page-break-inside: avoid; }
      img { max-width: 100%; height: auto; display: block; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .document-render--print .var-resolved, #sirh-print-area .var-resolved {
        color: #111 !important; font-weight: inherit !important;
        background: none !important; padding: 0 !important; border-radius: 0 !important;
      }
      .document-render--print .var-missing, #sirh-print-area .var-missing { color: #dc2626 !important; }
      ${previewCss}
    `;
  }

  private buildDocumentContext(
    template: TemplateRecord,
    person: UnknownRecord,
  ): UnknownRecord {
    const base = person ? cloneData(person) : {};
    const organizationId = getScopedOrganizationId(template);
    const organization = organizationId
      ? this.organizations.getOrganization(organizationId)
      : null;
    const charter = this.getTemplateGraphicCharter(template);
    const officialName =
      charter.identity.officialName ||
      organization?.["nom"] ||
      base["nom_etab"] ||
      "";
    return {
      ...base,
      ...this.buildOrganizationTemplateVars(organization || {}),
      ...this.buildTodayTemplateVars(new Date()),
      nom_etab: officialName,
      adresse_etab: organization?.["adresse"] || base["adresse_etab"] || "",
      tel_etab: organization?.["tel"] || base["tel_etab"] || "",
      ville_etab: organization?.["ville"] || base["ville_etab"] || "",
      directeur: charter.identity.directorName || base["directeur"] || "",
      slogan_etab: charter.identity.slogan || base["slogan_etab"] || "",
      logo_etab: charter.identity.logoText || base["logo_etab"] || "",
      annee_univ: base["annee_univ"] || this.getAcademicYearLabel(),
    };
  }

  private resolveVars(html: string, person: UnknownRecord): string {
    return this.resolveAll(html, person, true);
  }

  private resolveVarsRaw(html: string, person: UnknownRecord): string {
    return this.resolveAll(html, person, false);
  }

  private resolveAll(
    html: string,
    person: UnknownRecord,
    preview: boolean,
  ): string {
    let out = this.normalizeEditorSpacingHtml(String(html || ""));
    if (!preview) out = this.stripVariableMarkerStylesHtml(out);
    out = this.resolveObjectTables(out, person, preview);
    out = this.resolveCellExpand(out, person, preview);
    out = this.resolveListTags(out, person, preview);
    out = this.resolveScalars(out, person, preview);
    out = this.normalizeResolvedTableWidthsHtml(out);
    return out;
  }

  private resolveObjectTables(
    html: string,
    person: UnknownRecord,
    preview: boolean,
  ): string {
    let out = html;
    let guard = 0;
    while (guard++ < 20) {
      const match =
        /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):table(?::([\w,\-]+))?\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(
          out,
        );
      if (!match) break;
      const [fullTr, trAttrs, trInner, tech, rawCols] = match;
      const items = this.getObjectItems(person, tech);
      if (!items.length) {
        out = out.replace(fullTr, "");
        continue;
      }
      const cells = this.extractTableCells(trInner);
      const markerIdx = cells.findIndex((cell) =>
        /\{\{#[\w]+:table(?:[:][\w,\-]+)?\}\}/.test(cell.content),
      );
      const columns = this.filterObjectColumns(
        this.getListObjectColumns(tech),
        items,
        this.parseSelectedKeys(rawCols),
      );
      const keySet = new Set(columns.map((col) => col.key).filter(Boolean));
      items.forEach((item) =>
        Object.keys(item).forEach((key) => keySet.add(key)),
      );
      const cellKeys = cells.map((cell, index) => {
        if (index === markerIdx) return columns[0]?.key || null;
        const scalarMatches = Array.from(
          String(cell.content || "").matchAll(/\{\{(\w+)\}\}/g),
        );
        return (
          scalarMatches.map((item) => item[1]).find((key) => keySet.has(key)) ||
          null
        );
      });
      const rows = items
        .map(
          (item) =>
            `<tr${trAttrs}>${cells
              .map((cell, index) => {
                const key = cellKeys[index];
                const content = key
                  ? this.wrapResolved(this.escapeHtml(item[key] ?? ""), preview)
                  : this.resolveScalars(cell.content, person, preview);
                return `<${cell.tag}${cell.attrs}>${content}</${cell.tag}>`;
              })
              .join("")}</tr>`,
        )
        .join("");
      out = out.replace(fullTr, rows);
    }
    return out.replace(
      /\{\{#([\w]+):table(?::([\w,\-]+))?\}\}/g,
      (_match, tech, rawCols) => {
        const items = this.getObjectItems(person, tech);
        const columns = this.filterObjectColumns(
          this.getListObjectColumns(tech),
          items,
          this.parseSelectedKeys(rawCols),
        );
        return this.buildObjectTable(items, columns, preview);
      },
    );
  }

  private resolveCellExpand(
    html: string,
    person: UnknownRecord,
    preview: boolean,
  ): string {
    let out = html;
    let guard = 0;
    while (guard++ < 20) {
      const match =
        /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):cell-expand\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(
          out,
        );
      if (!match) break;
      const [fullTr, trAttrs, trInner] = match;
      const cells = this.extractTableCells(trInner);
      const markers = cells
        .map((cell, idx) => {
          const marker = /\{\{#([\w]+):cell-expand\}\}/.exec(cell.content);
          return marker ? { idx, tech: marker[1] } : null;
        })
        .filter((item): item is { idx: number; tech: string } => !!item);
      const markerItems = markers.map((marker) => ({
        ...marker,
        items: this.toLegacyListItems(this.getPathValue(person, marker.tech)),
      }));
      const rowCount = markerItems.reduce(
        (max, item) => Math.max(max, item.items.length),
        0,
      );
      if (!rowCount) {
        out = out.replace(
          fullTr,
          `<tr${trAttrs}>${cells
            .map((cell, idx) => {
              const marker = markerItems.find((item) => item.idx === idx);
              return `<${cell.tag}${cell.attrs}>${marker ? '<em style="color:#aaa">-</em>' : this.resolveScalars(cell.content, person, preview)}</${cell.tag}>`;
            })
            .join("")}</tr>`,
        );
        continue;
      }
      let rows = "";
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        rows += `<tr${trAttrs}>${cells
          .map((cell, idx) => {
            const marker = markerItems.find((item) => item.idx === idx);
            const content = marker
              ? this.wrapResolved(
                  this.escapeHtml(marker.items[rowIndex] ?? ""),
                  preview,
                )
              : this.resolveScalars(cell.content, person, preview);
            return `<${cell.tag}${cell.attrs}>${content}</${cell.tag}>`;
          })
          .join("")}</tr>`;
      }
      out = out.replace(fullTr, rows);
    }
    return out;
  }

  private resolveListTags(
    html: string,
    person: UnknownRecord,
    preview: boolean,
  ): string {
    return html.replace(
      /\{\{#([\w]+):(ul|inline)\}\}/g,
      (_match, tech, mode) => {
        const items = this.toLegacyListItems(this.getPathValue(person, tech));
        if (!items.length)
          return preview
            ? '<span style="color:#aaa;font-style:italic">(liste vide)</span>'
            : "";
        if (mode === "inline") {
          const joined = items.map((item) => this.escapeHtml(item)).join(", ");
          return this.wrapResolved(joined, preview);
        }
        return `<ul style="margin:4px 0;padding-left:1.4em">${items.map((item) => `<li>${this.wrapResolved(this.escapeHtml(item), preview)}</li>`).join("")}</ul>`;
      },
    );
  }

  private resolveScalars(
    html: string,
    person: UnknownRecord,
    preview: boolean,
  ): string {
    return String(html || "").replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = person[key];
      if (
        value !== undefined &&
        value !== null &&
        !Array.isArray(value) &&
        typeof value !== "object"
      ) {
        return this.wrapResolved(this.escapeHtml(String(value)), preview);
      }
      return preview
        ? `<span class="var-missing">{{${this.escapeHtml(key)}}}</span>`
        : match;
    });
  }

  getDocumentThemeVars(template: TemplateRecord): Record<string, string> {
    const charter = this.getTemplateGraphicCharter(template);
    const margins = this.getTemplatePageMargins(template);
    const distances = this.getTemplateHeaderFooterDistances(template);
    const orientation = this.getTemplateOrientation(template);
    const pageBackground = charter.layout.pageBackground;
    return {
      "--doc-font-body": charter.typography.bodyFont,
      "--doc-font-heading": charter.typography.headingFont,
      "--doc-color-primary": charter.colors["primary"],
      "--doc-color-secondary": charter.colors["secondary"],
      "--doc-color-text": charter.colors["text"],
      "--doc-color-heading": charter.colors["heading"],
      "--doc-color-border": charter.colors["border"],
      "--doc-table-header-bg": charter.colors["tableHeaderBg"],
      "--doc-table-row-alt-bg": charter.colors["tableAltRowBg"],
      "--doc-watermark-color": this.getTemplateWatermark(template).color,
      "--doc-watermark-opacity": String(
        this.getTemplateWatermark(template).opacity,
      ),
      "--doc-page-bg-image":
        pageBackground.enabled && pageBackground.image
          ? this.toCssUrlValue(
              pageBackground.image,
              (template["updatedAt"] as string) || "",
            )
          : "none",
      "--doc-page-bg-size": pageBackground.size,
      "--doc-page-bg-position": pageBackground.position,
      "--doc-page-bg-repeat": pageBackground.repeat,
      "--page-mt": `${margins.mt}mm`,
      "--page-mb": `${margins.mb}mm`,
      "--page-ml": `${margins.ml}mm`,
      "--page-mr": `${margins.mr}mm`,
      "--page-header-top": `${distances.headerTop}mm`,
      "--page-footer-bottom": `${distances.footerBottom}mm`,
      "--page-orientation": orientation,
      "--page-w": orientation === "landscape" ? "297mm" : "210mm",
      "--page-h": orientation === "landscape" ? "210mm" : "297mm",
    };
  }

  private getTemplateGraphicCharter(template: TemplateRecord) {
    const organizationId = getScopedOrganizationId(template);
    if (organizationId) {
      const record = this.graphicCharters.getOrganizationGraphicCharter(
        organizationId,
        template?.graphicCharterId || null,
      );
      if (record?.config) return normalizeGraphicCharterConfig(record.config);
    }
    return template?.id
      ? this.graphicCharters.getTemplateGraphicCharter(template.id)
      : normalizeGraphicCharterConfig({});
  }

  private getTemplatePageMargins(template: TemplateRecord): {
    mt: number;
    mb: number;
    ml: number;
    mr: number;
  } {
    const fallback =
      this.getTemplateGraphicCharter(template).layout.pageMargins;
    const src = (template["pageMargins"] || fallback) as UnknownRecord;
    const toNum = (value: unknown, def: number) =>
      Number.isFinite(Number(value)) ? Number(value) : def;
    return {
      mt: toNum(src?.["mt"], fallback.mt),
      mb: toNum(src?.["mb"], fallback.mb),
      ml: toNum(src?.["ml"], fallback.ml),
      mr: toNum(src?.["mr"], fallback.mr),
    };
  }

  private getTemplateHeaderFooterDistances(template: TemplateRecord) {
    return normalizeHeaderFooterDistances(
      template.headerFooterDistances || template["pageHeaderFooterDistances"],
      this.getTemplateGraphicCharter(template).layout.headerFooterDistances,
    );
  }

  private getTemplateOrientation(
    template: TemplateRecord,
  ): "portrait" | "landscape" {
    const fallback =
      this.getTemplateGraphicCharter(template).layout.orientation;
    const raw = String(
      template["orientation"] ||
        template["pageOrientation"] ||
        fallback ||
        "portrait",
    ).toLowerCase();
    return raw === "landscape" ? "landscape" : "portrait";
  }

  private getTemplateWatermark(template: TemplateRecord): {
    enabled: boolean;
    text: string;
    color: string;
    opacity: number;
    size: number;
  } {
    const charter = this.getTemplateGraphicCharter(template);
    const raw = (template["watermark"] || {}) as UnknownRecord;
    const toNum = (value: unknown, fallback: number) =>
      Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      enabled: raw["enabled"] === true,
      text: String(raw["text"] || charter.watermark.text || "CONFIDENTIEL"),
      color: String(raw["color"] || charter.watermark.color || "#000000"),
      opacity: toNum(raw["opacity"], charter.watermark.opacity || 0.07),
      size: toNum(raw["size"], 80),
    };
  }

  private getPageSectionPaddings(template: TemplateRecord): {
    header: string;
    body: string;
    bodyNoHeaderFooter: string;
    footer: string;
  } {
    const margins = this.getTemplatePageMargins(template);
    const distances = this.getTemplateHeaderFooterDistances(template);
    return {
      header: `${distances.headerTop}mm ${margins.mr}mm 3mm ${margins.ml}mm`,
      body: `${margins.mt}mm ${margins.mr}mm ${margins.mb}mm ${margins.ml}mm`,
      bodyNoHeaderFooter: `${margins.mt}mm ${margins.mr}mm ${margins.mb}mm ${margins.ml}mm`,
      footer: `3mm ${margins.mr}mm ${distances.footerBottom}mm ${margins.ml}mm`,
    };
  }

  private applyTemplateHeaderFooterDisplay(
    pages: RenderedDocumentPage[],
    template: TemplateRecord,
  ): RenderedDocumentPage[] {
    const headerMode = normalizeTemplateSectionDisplay(template.headerDisplay);
    const footerMode = normalizeTemplateSectionDisplay(template.footerDisplay);
    return pages.map((page, index) => {
      const showHeader =
        !!template.hasHeader &&
        !!page.header &&
        this.shouldShowSection(headerMode, index);
      const showFooterContent =
        !!template.hasFooter && this.shouldShowSection(footerMode, index);
      return {
        ...page,
        header: showHeader ? page.header : "",
        footer: showFooterContent ? page.footer || "" : "",
        hasHeader: showHeader,
        hasFooter: !!template.hasFooter,
      };
    });
  }

  private shouldShowSection(
    mode: "all" | "first" | "even" | "odd",
    index: number,
  ): boolean {
    const pageNumber = index + 1;
    if (mode === "first") return index === 0;
    if (mode === "even") return pageNumber % 2 === 0;
    if (mode === "odd") return pageNumber % 2 === 1;
    return true;
  }

  private getSectionDirectionAttrs(
    template: TemplateRecord,
    section: "header" | "body" | "footer",
  ): { dir: "ltr" | "rtl"; style: string } {
    const dir = this.getTemplateSectionDirection(template, section);
    return {
      dir,
      style: `direction:${dir};text-align:${dir === "rtl" ? "right" : "left"};`,
    };
  }

  private getTemplateSectionDirection(
    template: TemplateRecord,
    section: "header" | "body" | "footer",
  ): "ltr" | "rtl" {
    return template.sectionDirections?.[section] === "rtl" ? "rtl" : "ltr";
  }

  private sanitizeFinalRenderPages(
    pages: RenderedDocumentPage[],
  ): RenderedDocumentPage[] {
    return pages.map((page) => ({
      ...page,
      header: this.sanitizeFinalRenderHtml(page.header),
      content: this.sanitizeFinalRenderHtml(page.content),
      footer: this.sanitizeFinalRenderHtml(page.footer),
    }));
  }

  private sanitizeFinalRenderHtml(html: string): string {
    if (!html || typeof DOMParser === "undefined") return html || "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return html;
    root
      .querySelectorAll(".var-resolved")
      .forEach((node) =>
        node.replaceWith(doc.createTextNode(node.textContent || "")),
      );
    root
      .querySelectorAll(".var-missing")
      .forEach((node) =>
        node.replaceWith(doc.createTextNode(node.textContent || "")),
      );
    root.querySelectorAll<HTMLElement>("span[style]").forEach((node) => {
      const text = String(node.textContent || "").trim();
      const styleText = String(node.getAttribute("style") || "");
      const looksLikeVariablePlaceholder =
        /^\{\{[#/]?[\w:,\-]+\}\}$/.test(text) || /^\[[\w:,\-]+\]$/.test(text);
      const looksLikePreviewStyle =
        /color\s*:\s*#?(2563eb|1d4ed8|7c3aed|f97316)/i.test(styleText) ||
        /color\s*:\s*var\(--(accent|purple|orange)/i.test(styleText) ||
        /background(?:-color)?\s*:\s*#?(eff6ff|f3e8ff|fff7ed)/i.test(styleText);
      if (looksLikeVariablePlaceholder && looksLikePreviewStyle) {
        node.replaceWith(doc.createTextNode(text));
      }
    });
    return root.innerHTML;
  }

  private splitManualPages(html: string): string[] {
    const parts = String(html || "").split(
      /<!--\s*page-break\s*-->|<hr[^>]*(?:data-page-break|class=["'][^"']*page-break[^"']*["'])[^>]*>/i,
    );
    return parts.length
      ? parts.map((part) => part.trim()).filter(Boolean)
      : [""];
  }

  private buildObjectTable(
    items: UnknownRecord[],
    columns: ObjectColumn[],
    preview: boolean,
  ): string {
    const cols: ObjectColumn[] = columns.length
      ? columns
      : items[0]
        ? Object.keys(items[0])
            .filter((key) => !key.startsWith("_"))
            .map((key) => ({ key, label: key }))
        : [];
    if (!cols.length)
      return preview
        ? '<span style="color:#aaa;font-style:italic">(liste vide)</span>'
        : "";
    const defaultThStyle =
      "font-weight:700;color:var(--doc-color-text, #111);background:var(--doc-table-header-bg, transparent);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px;text-align:left";
    const defaultTdStyle =
      "color:var(--doc-color-text, #111);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px";
    const thead = `<thead><tr>${cols
      .map((col) => {
        const align = col.align ? `;text-align:${col.align}` : "";
        const width = col.width ? `;width:${col.width}` : "";
        const bold = col.bold === false ? ";font-weight:400" : "";
        return `<th style="${defaultThStyle}${align}${width}${bold}">${this.escapeHtml(col.label)}</th>`;
      })
      .join("")}</tr></thead>`;
    const rows = items
      .map((row, index) => {
        const rowBg =
          index % 2 === 1
            ? "background:var(--doc-table-row-alt-bg, #f8fafc)"
            : "background:#fff";
        return `<tr style="${rowBg}">${cols
          .map((col) => {
            const raw = row[col.key] !== undefined ? String(row[col.key]) : "";
            const align = col.align ? `;text-align:${col.align}` : "";
            return `<td style="${defaultTdStyle}${align}">${this.wrapResolved(this.escapeHtml(raw), preview)}</td>`;
          })
          .join("")}</tr>`;
      })
      .join("");
    return `<table style="border-collapse:collapse;width:100%;margin:6px 0">${thead}<tbody>${rows}</tbody></table>`;
  }

  private getObjectItems(person: UnknownRecord, tech: string): UnknownRecord[] {
    const raw = person[tech];
    return Array.isArray(raw)
      ? raw.filter(
          (item): item is UnknownRecord =>
            !!item && typeof item === "object" && !Array.isArray(item),
        )
      : [];
  }

  private getListObjectColumns(tech: string): ObjectColumn[] {
    const families = this.state.getState().families || [];
    for (const family of families) {
      for (const cls of family.classes || []) {
        const variable = (cls.vars || []).find((item) => item.tech === tech);
        if (variable?.columns?.length) {
          return variable.columns
            .map((col) => ({
              key: String(col.key || col.tech || "").trim(),
              label: String(col.label || col.key || col.tech || "").trim(),
              align: col["align"] ? String(col["align"]) : undefined,
              width: col["width"] ? String(col["width"]) : undefined,
              bold: col["bold"] === false ? false : undefined,
            }))
            .filter((col) => col.key);
        }
      }
    }
    return [];
  }

  private parseSelectedKeys(value: unknown): string[] {
    return String(value || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
  }

  private filterObjectColumns(
    columns: Array<{
      key: string;
      label: string;
      align?: string;
      width?: string;
      bold?: boolean;
    }>,
    items: UnknownRecord[],
    selectedKeys: string[] = [],
  ): ObjectColumn[] {
    const base: ObjectColumn[] = columns.length
      ? columns
      : items[0]
        ? Object.keys(items[0])
            .filter((key) => !key.startsWith("_"))
            .map((key) => ({ key, label: key }))
        : [];
    if (!selectedKeys.length) return base;
    const byKey = new Map(base.map((col) => [col.key, col]));
    return selectedKeys
      .map((key) => byKey.get(key))
      .filter((item): item is { key: string; label: string } => !!item);
  }

  private extractTableCells(
    rowHtml: string,
  ): Array<{ tag: string; attrs: string; content: string }> {
    const cells: Array<{ tag: string; attrs: string; content: string }> = [];
    const re = /<(td|th)((?:\s[^>]*)?|)>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(rowHtml)) !== null)
      cells.push({ tag: match[1], attrs: match[2], content: match[3] });
    return cells;
  }

  private toLegacyListItems(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      if (item && typeof item === "object")
        return Object.values(item as UnknownRecord).join(" | ");
      return String(item);
    });
  }

  private normalizeEditorSpacingHtml(html: string): string {
    if (!html || typeof DOMParser === "undefined") return html || "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return html;
    root.querySelectorAll("p").forEach((p) => {
      const probe = p.cloneNode(true) as HTMLElement;
      probe
        .querySelectorAll("br.ProseMirror-trailingBreak")
        .forEach((br) => br.remove());
      const hasVisualContent =
        !!probe.textContent?.replace(/\u00a0/g, " ").trim() ||
        !!probe.querySelector("img, table, hr, ul, ol, iframe, svg");
      if (!hasVisualContent) p.innerHTML = "&nbsp;";
    });
    return root.innerHTML;
  }

  private stripVariableMarkerStylesHtml(html: string): string {
    if (!html || typeof DOMParser === "undefined") return html || "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return html;
    root.querySelectorAll<HTMLElement>("[style]").forEach((node) => {
      const text = String(node.textContent || "").trim();
      const styleText = String(node.getAttribute("style") || "");
      const hasVariableMarker = /\{\{[#/]?[\w:,\-\s]+\}\}/.test(text);
      const hasAutoVariableColor =
        /color\s*:\s*#?(2563eb|1d4ed8|7c3aed|f97316)/i.test(styleText) ||
        /background(?:-color)?\s*:\s*#?(eff6ff|f3e8ff|fff7ed)/i.test(styleText);
      if (!hasVariableMarker || !hasAutoVariableColor) return;
      [
        "color",
        "background",
        "backgroundColor",
        "fontStyle",
        "fontWeight",
        "padding",
        "borderRadius",
        "opacity",
      ].forEach((prop) => node.style.removeProperty(prop));
      if (!String(node.getAttribute("style") || "").trim())
        node.removeAttribute("style");
    });
    return root.innerHTML;
  }

  private normalizeResolvedTableWidthsHtml(html: string): string {
    if (!html || typeof DOMParser === "undefined") return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return html;
    root.querySelectorAll("table").forEach((table) => {
      const firstRow = table.querySelector("tr");
      if (!firstRow) return;
      const widths: string[] = [];
      Array.from(firstRow.children).forEach((cell) => {
        const el = cell as HTMLElement;
        const width = String(
          el.style.width || el.getAttribute("width") || "",
        ).trim();
        if (width) widths.push(width);
      });
      if (!widths.length) return;
      let colgroup = table.querySelector(":scope > colgroup");
      if (!colgroup) {
        colgroup = doc.createElement("colgroup");
        table.insertBefore(colgroup, table.firstChild);
      } else {
        colgroup.innerHTML = "";
      }
      widths.forEach((width) => {
        const col = doc.createElement("col");
        col.style.width = width;
        colgroup?.appendChild(col);
      });
    });
    return root.innerHTML;
  }

  private buildOrganizationTemplateVars(org: UnknownRecord): UnknownRecord {
    const raw =
      org?.["raw"] && typeof org["raw"] === "object"
        ? (org["raw"] as UnknownRecord)
        : {};
    const out: UnknownRecord = {};
    Object.entries(raw).forEach(([key, value]) => {
      if (value === undefined || value === null || typeof value === "object")
        return;
      const normalizedKey = this.normalizeFilterParamName(key, "");
      if (!normalizedKey) return;
      out[normalizedKey] = value;
      out[`org_${normalizedKey}`] = value;
    });
    return out;
  }

  private buildTodayTemplateVars(
    date = new Date(),
    locale = "fr-FR",
  ): UnknownRecord {
    const safeDate =
      date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const day = String(safeDate.getDate()).padStart(2, "0");
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const year = safeDate.getFullYear();
    const longFormatter = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const fullFormatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const shortFormatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return {
      date_du_jour: fullFormatter.format(safeDate),
      date_du_jour_longue: longFormatter.format(safeDate),
      date_du_jour_complete: longFormatter.format(safeDate),
      date_du_jour_courte: shortFormatter.format(safeDate),
      date_du_jour_compacte: `${day}/${month}/${year}`,
      date_du_jour_iso: `${year}-${month}-${day}`,
      jour_actuel: day,
      mois_actuel: month,
      annee_actuelle: String(year),
    };
  }

  private getAcademicYearLabel(): string {
    const now = new Date();
    const start =
      now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}-${start + 1}`;
  }

  private getDocumentRenderMode(options: { mode?: RenderMode }): RenderMode {
    return options.mode === "print" ? "print" : "preview";
  }

  private getPathValue(data: UnknownRecord, path: string): unknown {
    return String(path || "")
      .split(".")
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === "object"
            ? (acc as UnknownRecord)[key]
            : undefined,
        data,
      );
  }

  private normalizeFilterParamName(
    value: unknown,
    fallback = "filtre",
  ): string {
    const normalized = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_");
    return normalized || fallback;
  }

  private toArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return String(value)
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private wrapResolved(value: string, preview: boolean): string {
    return preview ? `<span class="var-resolved">${value}</span>` : value;
  }

  private toCssUrlValue(value: unknown, cacheKey = ""): string {
    const raw = String(value || "").trim();
    if (!raw) return "none";
    const finalValue =
      cacheKey && !/^data:/i.test(raw) && !/^blob:/i.test(raw)
        ? `${raw}${raw.includes("?") ? "&" : "?"}v=${encodeURIComponent(cacheKey)}`
        : raw;
    return `url("${finalValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
  }

  private async inlineCssUrlValue(value: unknown): Promise<string> {
    const raw = String(value || "").trim();
    const match = /^url\((["']?)(.*?)\1\)$/i.exec(raw);
    if (!match) return raw || "none";
    const inlined = await this.inlineAssetUrl(match[2]);
    return `url("${inlined.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
  }

  private async inlineHtmlAssetUrls(html: string): Promise<string> {
    if (!html || typeof DOMParser === "undefined") return html || "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return html;
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img[src]"));
    await Promise.all(
      images.map(async (image) => {
        const src = image.getAttribute("src");
        if (!src) return;
        image.setAttribute("src", await this.inlineAssetUrl(src));
      }),
    );
    return root.innerHTML;
  }

  private async inlineAssetUrl(url: string): Promise<string> {
    const raw = String(url || "").trim();
    if (!raw || /^data:/i.test(raw) || /^blob:/i.test(raw)) return raw;
    try {
      const response = await fetch(raw, { credentials: "include" });
      if (!response.ok) return raw;
      const blob = await response.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || raw));
        reader.onerror = () => resolve(raw);
        reader.readAsDataURL(blob);
      });
    } catch {
      return raw;
    }
  }

  private humanize(value: string): string {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

// PagePaginatorOptions and PagePaginator have been extracted to
// ./page-paginator.ts in Phase 1. The import at the top of this file
// provides the same class with identical behaviour.
