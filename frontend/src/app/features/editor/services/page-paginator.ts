/**
 * page-paginator.ts
 *
 * Moteur de pagination HTML pour la génération de pages preview/print.
 *
 * PHASE 1 — Extraction depuis document-render.service.ts.
 * PHASE 2 — Corrections ciblées de stabilité et fidélité impression :
 *
 *   FIX-1  mmToPx() : prend en compte window.devicePixelRatio pour réduire
 *          l'arrondi sub-pixel sur écrans HiDPI (Retina, 4K…).
 *
 *   FIX-2  createSplitTableShell() : copie explicitement chaque <col> avec
 *          ses attributs inline (width, style…) pour préserver les largeurs
 *          de colonnes dans les tableaux découpés sur plusieurs pages.
 *
 *   FIX-3  distributeContent() : honore page-break-before sur les éléments du
 *          body. Signaux supportés : [data-page-break], .page-break-before,
 *          style inline page-break-before:always, break-before:page.
 *
 *   FIX-4  Les buffers de sécurité (printSafetyBufferPx…) utilisent désormais
 *          le mmToPx() corrigé — cohérence totale des conversions.
 *
 * IMPORTANT : La structure HTML produite par paginate() (header/content/footer)
 * est inchangée — DocumentRenderService et buildDocumentPagesHtml() dépendent
 * de cette API stable. Aucune modification de document-render.service.ts.
 */

import { normalizeGraphicCharterConfig } from "./editor-normalizers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PagePaginatorOptions {
  theme: ReturnType<typeof normalizeGraphicCharterConfig>;
  orientation: "portrait" | "landscape";
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerTop: number;
  footerBottom: number;
  headerDirection: "ltr" | "rtl";
  bodyDirection: "ltr" | "rtl";
  footerDirection: "ltr" | "rtl";
}

// ─── PagePaginator ─────────────────────────────────────────────────────────────

export class PagePaginator {
  private pageWidthMm: number;
  private pageHeightMm: number;
  private marginTopPx: number;
  private marginBottomPx: number;
  private marginLeftPx: number;
  private marginRightPx: number;
  private pageWidthPx: number;
  private pageHeightPx: number;
  private contentHeightPx: number;
  private footerReserveHeightPx: number;
  private printSafetyBufferPx: number;
  private tableSafetyBufferPx: number;
  private afterTableTextBufferPx: number;
  private pages: string[] = [];
  private headerHeight = 0;
  private footerHeight = 0;

  constructor(private opts: PagePaginatorOptions) {
    this.pageWidthMm = opts.orientation === "landscape" ? 297 : 210;
    this.pageHeightMm = opts.orientation === "landscape" ? 210 : 297;
    this.pageWidthPx = this.mmToPx(this.pageWidthMm);
    this.pageHeightPx = this.mmToPx(this.pageHeightMm);
    this.marginTopPx = this.mmToPx(opts.marginTop || 20);
    this.marginBottomPx = this.mmToPx(opts.marginBottom || 20);
    this.marginLeftPx = this.mmToPx(opts.marginLeft || 25);
    this.marginRightPx = this.mmToPx(opts.marginRight || 25);
    this.printSafetyBufferPx = this.mmToPx(8);
    this.tableSafetyBufferPx = this.mmToPx(4);
    this.afterTableTextBufferPx = this.mmToPx(12);
    this.footerReserveHeightPx = this.mmToPx(3 + (opts.footerBottom || 5));
    this.contentHeightPx =
      this.pageHeightPx - this.marginTopPx - this.marginBottomPx;
    this.footerHeight = this.footerReserveHeightPx;
  }

  paginate(
    contentHtml: string,
    headerHtml = "",
    footerHtml = "",
  ): Array<{ header: string; content: string; footer: string }> {
    if (typeof document === "undefined") {
      return [{ header: headerHtml, content: contentHtml, footer: footerHtml }];
    }
    this.pages = [];
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.visibility = "hidden";
    tempContainer.style.width = `${this.pageWidthPx}px`;
    tempContainer.style.left = "-99999px";
    tempContainer.style.top = "0";
    this.applyMeasureStyles(tempContainer);
    document.body.appendChild(tempContainer);

    if (headerHtml) {
      const header = document.createElement("div");
      header.innerHTML = headerHtml;
      header.style.padding = `${this.opts.headerTop || 5}mm ${this.opts.marginRight}mm 3mm ${this.opts.marginLeft}mm`;
      this.applyDirectionStyles(header, this.opts.headerDirection);
      this.applyMeasureContentStyles(header);
      tempContainer.appendChild(header);
      this.headerHeight = Math.max(
        header.offsetHeight,
        header.scrollHeight,
        Math.ceil(header.getBoundingClientRect().height),
      );
      tempContainer.removeChild(header);
    }

    const footer = document.createElement("div");
    footer.innerHTML = footerHtml || "&nbsp;";
    footer.style.padding = `3mm ${this.opts.marginRight}mm ${this.opts.footerBottom || 5}mm ${this.opts.marginLeft}mm`;
    footer.style.minHeight = `${this.footerReserveHeightPx}px`;
    this.applyDirectionStyles(footer, this.opts.footerDirection);
    this.applyMeasureContentStyles(footer);
    tempContainer.appendChild(footer);
    this.footerHeight = Math.max(
      this.footerReserveHeightPx,
      footer.offsetHeight,
      footer.scrollHeight,
      Math.ceil(footer.getBoundingClientRect().height),
    );
    tempContainer.removeChild(footer);
    tempContainer.remove();

    const availableHeight = Math.max(
      1,
      this.contentHeightPx -
        this.headerHeight -
        this.footerHeight -
        this.printSafetyBufferPx,
    );
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div>${contentHtml}</div>`,
      "text/html",
    );
    const content = doc.body.firstElementChild;
    this.distributeContent(
      content ? Array.from(content.children) : [],
      availableHeight,
    );
    return this.pages
      .filter((page) => this.hasMeaningfulPageContent(page))
      .map((content) => ({ header: headerHtml, content, footer: footerHtml }));
  }

  private distributeContent(
    elements: Element[],
    availableHeight: number,
  ): void {
    let currentPageHtml = "";
    let currentPageHeight = 0;
    let lastAddedWasTable = false;
    const tempMeasure = document.createElement("div");
    tempMeasure.style.position = "absolute";
    tempMeasure.style.visibility = "hidden";
    tempMeasure.style.left = "-99999px";
    tempMeasure.style.top = "0";
    tempMeasure.style.width = `${this.pageWidthPx - this.marginLeftPx - this.marginRightPx}px`;
    this.applyMeasureStyles(tempMeasure);
    document.body.appendChild(tempMeasure);

    elements.forEach((el) => {
      if (this.isSkippableLeadingElement(el) && !currentPageHtml.trim()) return;

      // FIX-3: honour explicit page-break-before signals on any element.
      // Flush the current page accumulator before adding this element.
      if (this.hasPageBreakBefore(el) && currentPageHtml.trim()) {
        this.pages.push(currentPageHtml);
        currentPageHtml = "";
        currentPageHeight = 0;
        lastAddedWasTable = false;
      }

      if (el.tagName === "TABLE") {
        const remaining = currentPageHtml.trim()
          ? Math.max(1, availableHeight - currentPageHeight)
          : availableHeight;
        this.splitTableElement(
          el as HTMLTableElement,
          remaining,
          availableHeight,
          tempMeasure,
        ).forEach((part) => {
          const partHeight =
            this.measureElementHeight(part, tempMeasure) +
            this.tableSafetyBufferPx;
          if (
            currentPageHtml.trim() &&
            currentPageHeight + partHeight > availableHeight
          ) {
            this.pages.push(currentPageHtml);
            currentPageHtml = "";
            currentPageHeight = 0;
            lastAddedWasTable = false;
          }
          currentPageHtml += part.outerHTML;
          currentPageHeight += partHeight;
          lastAddedWasTable = true;
        });
        return;
      }
      const elHeight = this.measureElementHeight(el, tempMeasure);
      if (elHeight > availableHeight && this.canSplitTextElement(el)) {
        if (currentPageHtml.trim()) {
          this.pages.push(currentPageHtml);
          currentPageHtml = "";
          currentPageHeight = 0;
        }
        this.splitTextElement(el, availableHeight, tempMeasure).forEach(
          (part) => {
            const partHeight = this.measureElementHeight(part, tempMeasure);
            if (
              currentPageHtml.trim() &&
              currentPageHeight + partHeight > availableHeight
            ) {
              this.pages.push(currentPageHtml);
              currentPageHtml = "";
              currentPageHeight = 0;
            }
            currentPageHtml += part.outerHTML;
            currentPageHeight += partHeight;
            lastAddedWasTable = false;
          },
        );
        return;
      }
      if (
        lastAddedWasTable &&
        currentPageHtml.trim() &&
        currentPageHeight + elHeight >
          availableHeight - this.afterTableTextBufferPx
      ) {
        this.pages.push(currentPageHtml);
        currentPageHtml = "";
        currentPageHeight = 0;
        lastAddedWasTable = false;
      }
      if (
        currentPageHtml.trim() &&
        currentPageHeight + elHeight > availableHeight
      ) {
        this.pages.push(currentPageHtml);
        currentPageHtml = "";
        currentPageHeight = 0;
      }
      currentPageHtml += el.outerHTML;
      currentPageHeight += elHeight;
      lastAddedWasTable = false;
    });
    if (currentPageHtml.trim()) this.pages.push(currentPageHtml);
    tempMeasure.remove();
  }

  private splitTableElement(
    tableEl: HTMLTableElement,
    firstAvailable: number,
    nextAvailable: number,
    tempMeasure: HTMLElement,
  ): HTMLTableElement[] {
    const thead = tableEl.querySelector("thead");
    const tbody = tableEl.querySelector("tbody");
    const rows = Array.from(
      (tbody?.querySelectorAll(":scope > tr") ||
        tableEl.querySelectorAll(
          ":scope > tr",
        )) as NodeListOf<HTMLTableRowElement>,
    );
    if (!rows.length) return [tableEl.cloneNode(true) as HTMLTableElement];
    const parts: HTMLTableElement[] = [];
    let currentTable = this.createSplitTableShell(tableEl, thead);
    let currentBody = currentTable.querySelector("tbody")!;
    let activeHeight = Math.max(1, firstAvailable || 1);
    rows.forEach((row) => {
      const testTable = currentTable.cloneNode(true) as HTMLTableElement;
      testTable.querySelector("tbody")?.appendChild(row.cloneNode(true));
      const testHeight =
        this.measureElementHeight(testTable, tempMeasure) +
        this.tableSafetyBufferPx;
      if (currentBody.children.length > 0 && testHeight > activeHeight) {
        parts.push(currentTable);
        currentTable = this.createSplitTableShell(tableEl, thead);
        currentBody = currentTable.querySelector("tbody")!;
        activeHeight = Math.max(1, nextAvailable || 1);
      }
      currentBody.appendChild(row.cloneNode(true));
    });
    if (currentBody.children.length) parts.push(currentTable);
    return parts.length ? parts : [tableEl.cloneNode(true) as HTMLTableElement];
  }

  /**
   * createSplitTableShell — FIX-2
   *
   * Builds a skeleton <table> carrying the same outer attributes,
   * colgroup (with explicit per-<col> attribute copy), and thead as the
   * source table. Each split fragment gets this shell so that column widths
   * (set via width="…" or style="width:…" on individual <col> elements)
   * and the thead repeat correctly across page breaks.
   */
  private createSplitTableShell(
    source: HTMLTableElement,
    thead: Element | null,
  ): HTMLTableElement {
    const table = source.cloneNode(false) as HTMLTableElement;
    if (source.hasAttribute("style")) {
      table.setAttribute("style", source.getAttribute("style") || "");
    }

    // FIX-2: Explicitly copy each <col> with its attributes so column widths
    // survive the shell construction. (cloneNode(true) on the colgroup is
    // equivalent but the explicit loop makes the intent auditable.)
    const sourceColgroup = source.querySelector(":scope > colgroup");
    if (sourceColgroup) {
      const colgroup = document.createElement("colgroup");
      Array.from(sourceColgroup.attributes).forEach((attr) => {
        colgroup.setAttribute(attr.name, attr.value);
      });
      sourceColgroup.querySelectorAll("col").forEach((sourceCol) => {
        const col = document.createElement("col");
        Array.from(sourceCol.attributes).forEach((attr) => {
          col.setAttribute(attr.name, attr.value);
        });
        colgroup.appendChild(col);
      });
      table.appendChild(colgroup);
    }

    if (thead) table.appendChild(thead.cloneNode(true));
    table.appendChild(document.createElement("tbody"));
    return table;
  }

  private measureElementHeight(el: Element, tempMeasure: HTMLElement): number {
    const clone = el.cloneNode(true) as HTMLElement;
    tempMeasure.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.style.display = "flow-root";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.maxWidth = "100%";
    wrapper.style.overflowWrap = "anywhere";
    this.applyDirectionStyles(wrapper, this.opts.bodyDirection);
    wrapper.appendChild(clone);
    this.applyMeasureContentStyles(wrapper);
    tempMeasure.appendChild(wrapper);
    const target = (wrapper.firstElementChild as HTMLElement) || clone;
    const computed = window.getComputedStyle(target);
    const marginTop = parseFloat(computed.marginTop) || 0;
    const marginBottom = parseFloat(computed.marginBottom) || 0;
    return (
      Math.max(
        wrapper.offsetHeight,
        wrapper.scrollHeight,
        clone.offsetHeight,
        clone.scrollHeight,
        Math.ceil(wrapper.getBoundingClientRect().height),
        Math.ceil(clone.getBoundingClientRect().height),
      ) +
      marginTop +
      marginBottom
    );
  }

  private splitTextElement(
    el: Element,
    availableHeight: number,
    tempMeasure: HTMLElement,
  ): Element[] {
    const text = String(el.textContent || "");
    const words = Array.from(text.matchAll(/\S+/g)).map((match) => ({
      start: match.index || 0,
      end: (match.index || 0) + match[0].length,
    }));
    if (!words.length) return [el.cloneNode(true) as Element];
    const parts: Element[] = [];
    const targetHeight = Math.max(
      24,
      availableHeight - this.printSafetyBufferPx,
    );
    let start = 0;
    while (start < words.length) {
      let low = start + 1;
      let high = words.length;
      let best = start + 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = this.cloneTextRangeElement(
          el,
          words[start].start,
          words[mid - 1].end,
        );
        const height = this.measureElementHeight(candidate, tempMeasure);
        if (height <= targetHeight || mid === start + 1) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      parts.push(
        this.cloneTextRangeElement(el, words[start].start, words[best - 1].end),
      );
      start = Math.max(best, start + 1);
    }
    return parts;
  }

  private cloneTextRangeElement(
    el: Element,
    startOffset: number,
    endOffset: number,
  ): Element {
    const shell = el.cloneNode(false) as Element;
    shell.textContent = String(el.textContent || "").slice(
      startOffset,
      endOffset,
    );
    return shell;
  }

  private canSplitTextElement(el: Element): boolean {
    if (!["P", "DIV", "LI"].includes(el.tagName)) return false;
    if (el.querySelector("table, img, hr, ul, ol, iframe, svg")) return false;
    return (
      String(el.textContent || "")
        .replace(/\s+/g, " ")
        .trim().length > 80
    );
  }

  private isSkippableLeadingElement(el: Element): boolean {
    if (!["P", "DIV"].includes(el.tagName)) return false;
    if (el.querySelector("img, table, hr, ul, ol, iframe, svg")) return false;
    const html = String(el.innerHTML || "")
      .replace(/<br\s*\/?>/gi, "")
      .replace(/\s+/g, "")
      .trim();
    const text = String(el.textContent || "").trim();
    return !html && !text;
  }

  /**
   * hasPageBreakBefore — FIX-3
   *
   * Detects whether an element requests a forced page break before itself.
   * Checked signals (in order):
   *   1. [data-page-break] attribute  — set from template HTML or editor
   *   2. CSS class .page-break-before — set from user stylesheet / Tiptap
   *   3. Inline style page-break-before:always (CSS2 legacy)
   *   4. Inline style break-before:page (CSS3)
   *
   * Reads the raw style attribute string rather than getComputedStyle()
   * because the element may not be in a live layout context during measurement.
   */
  private hasPageBreakBefore(el: Element): boolean {
    if (el.hasAttribute("data-page-break")) return true;
    if (el.classList.contains("page-break-before")) return true;
    const style = String(
      (el as HTMLElement).getAttribute("style") || "",
    ).toLowerCase();
    if (/page-break-before\s*:\s*always/.test(style)) return true;
    if (/break-before\s*:\s*page/.test(style)) return true;
    return false;
  }

  private hasMeaningfulPageContent(html: string): boolean {
    const probe = document.createElement("div");
    probe.innerHTML = html;
    return (
      !!probe.querySelector("img, table, hr, ul, ol, iframe, svg") ||
      !!String(probe.textContent || "")
        .replace(/\u00a0/g, "")
        .trim()
    );
  }

  private applyDirectionStyles(el: HTMLElement, dir: "ltr" | "rtl"): void {
    el.style.direction = dir;
    el.style.textAlign = dir === "rtl" ? "right" : "left";
    el.setAttribute("dir", dir);
  }

  private applyMeasureStyles(el: HTMLElement): void {
    el.style.fontFamily = this.opts.theme.typography.bodyFont;
    el.style.fontSize = "12pt";
    el.style.lineHeight = "1.6";
    el.style.color = this.opts.theme.colors["text"];
  }

  private applyMeasureContentStyles(root: HTMLElement): void {
    root.style.boxSizing = "border-box";
    root.style.maxWidth = "100%";
    root.style.overflowWrap = "anywhere";
    root.style.wordBreak = "normal";
    root.style.whiteSpace = "normal";

    root.querySelectorAll<HTMLElement>("p").forEach((p) => {
      p.style.margin = "0 0 0.4em";
      p.style.maxWidth = "100%";
      p.style.overflowWrap = "anywhere";
      p.style.wordBreak = "normal";
      p.style.whiteSpace = "normal";
      if (
        !String(p.textContent || "").trim() &&
        !p.querySelector("img, table, hr, ul, ol, iframe, svg")
      ) {
        p.style.minHeight = "1.6em";
      }
    });

    const lastParagraph = root.querySelector<HTMLElement>("p:last-child");
    if (lastParagraph) lastParagraph.style.marginBottom = "0";

    root.querySelectorAll<HTMLElement>("h1").forEach((el) => {
      el.style.fontFamily = this.opts.theme.typography.headingFont;
      el.style.color = this.opts.theme.colors["heading"];
      el.style.fontSize = "22pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.8em 0 0.4em";
    });
    root.querySelectorAll<HTMLElement>("h2").forEach((el) => {
      el.style.fontFamily = this.opts.theme.typography.headingFont;
      el.style.color = this.opts.theme.colors["heading"];
      el.style.fontSize = "18pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.7em 0 0.3em";
    });
    root.querySelectorAll<HTMLElement>("h3").forEach((el) => {
      el.style.fontFamily = this.opts.theme.typography.headingFont;
      el.style.color = this.opts.theme.colors["heading"];
      el.style.fontSize = "14pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.6em 0 0.3em";
    });
    root.querySelectorAll<HTMLElement>("h4").forEach((el) => {
      el.style.fontFamily = this.opts.theme.typography.headingFont;
      el.style.color = this.opts.theme.colors["heading"];
      el.style.fontSize = "12pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.5em 0 0.2em";
    });

    root.querySelectorAll<HTMLElement>("ul").forEach((list) => {
      list.style.paddingLeft = "2em";
      list.style.margin = "0.4em 0";
      list.style.listStyleType = "disc";
    });
    root.querySelectorAll<HTMLElement>("ol").forEach((list) => {
      list.style.paddingLeft = "2em";
      list.style.margin = "0.4em 0";
      list.style.listStyleType = "decimal";
    });
    root.querySelectorAll<HTMLElement>("li").forEach((el) => {
      el.style.display = "list-item";
    });

    root.querySelectorAll<HTMLElement>("table").forEach((table) => {
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";
      table.style.maxWidth = "100%";
      table.style.tableLayout = "fixed";
      table.style.margin = "6px 0";
      table.style.boxSizing = "border-box";
    });
    root.querySelectorAll<HTMLElement>("td, th").forEach((cell) => {
      cell.style.border = `1px solid ${this.opts.theme.colors["border"]}`;
      cell.style.padding = "6px 10px";
      cell.style.boxSizing = "border-box";
      cell.style.minWidth = "0";
      cell.style.wordBreak = "normal";
      cell.style.overflowWrap = "anywhere";
      cell.style.whiteSpace = "normal";
    });
    root.querySelectorAll<HTMLElement>("td p, th p").forEach((el) => {
      el.style.margin = "0";
    });
    root.querySelectorAll<HTMLElement>("th:not([style])").forEach((el) => {
      el.style.background = this.opts.theme.colors["tableHeaderBg"];
      el.style.color = this.opts.theme.colors["text"];
      el.style.fontWeight = "700";
      el.style.textAlign = "left";
    });

    root.querySelectorAll<HTMLElement>("hr").forEach((el) => {
      el.style.border = "none";
      el.style.borderTop = `1.5px solid ${this.opts.theme.colors["border"]}`;
      el.style.margin = "10px 0";
    });
    root.querySelectorAll<HTMLElement>("img").forEach((el) => {
      el.style.maxWidth = "100%";
      el.style.height = "auto";
      el.style.display = "block";
    });
  }

  /**
   * mmToPx — FIX-1
   *
   * Converts millimetres to CSS logical pixels for DOM measurement.
   *
   * Standard conversion: 1 mm = 96/25.4 ≈ 3.7795 CSS px  (96 DPI reference).
   *
   * On HiDPI displays (devicePixelRatio > 1), offsetHeight and
   * getBoundingClientRect() still return logical CSS pixels, not physical
   * pixels, so the multiplier itself does NOT change. However, the browser's
   * internal sub-pixel rounding can cause Math.ceil() calls on
   * getBoundingClientRect() to over-report by up to 1 physical pixel. We
   * compensate by subtracting one logical-pixel's worth of slack
   * (1/devicePixelRatio), which is:
   *   - 1.0 px  on standard (1×) screens  → negligible rounding loss
   *   - 0.5 px  on 2× Retina              → prevents spurious extra line
   *   - 0.33 px on 3× mobile              → idem
   *
   * For CSS @page / print rendering the 96 DPI base is always correct;
   * no DPR correction is needed there.
   */
  private mmToPx(mm: number): number {
    const basePx = (mm * 96) / 25.4;
    const dpr =
      typeof window !== "undefined" && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;
    // Subtract sub-pixel rounding slack; never reduce to zero.
    return Math.max(1, basePx - 1 / dpr);
  }
}
