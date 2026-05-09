import { Injectable } from "@angular/core";
import { Editor } from "@tiptap/core";

type ResizeDirection = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type ImageAlign = "left" | "center" | "right" | "inline";

type Binding = {
  editor: Editor;
  host: HTMLElement;
  observer: MutationObserver;
  scanTimer: number | null;
  selectedWrap: HTMLSpanElement | null;
  selectedImg: HTMLImageElement | null;
  selectedMenu: HTMLDivElement | null;
  tableResizeActive: boolean;
  documentMouseDown: (event: MouseEvent) => void;
  documentMouseMove: (event: MouseEvent) => void;
  hostMouseDown: (event: MouseEvent) => void;
  hostMouseMove: (event: MouseEvent) => void;
  hostScroll: () => void;
  windowResize: () => void;
};

@Injectable({ providedIn: "root" })
export class EditorImageResizeService {
  private readonly bindings = new WeakMap<Editor, Binding>();
  private stylesInjected = false;
  private activeBinding: Binding | null = null;

  attach(editor: Editor): void {
    if (this.bindings.has(editor)) return;
    const host = editor.view?.dom as HTMLElement | undefined;
    if (!host) return;

    this.injectStyles();

    const binding: Binding = {
      editor,
      host,
      observer: new MutationObserver(() => this.scheduleScan(binding)),
      scanTimer: null,
      selectedWrap: null,
      selectedImg: null,
      selectedMenu: null,
      tableResizeActive: false,
      documentMouseDown: (event) => this.onDocumentMouseDown(binding, event),
      documentMouseMove: (event) => this.onHostMouseMove(binding, event),
      hostMouseDown: (event) => this.onHostMouseDown(binding, event),
      hostMouseMove: (event) => this.onHostMouseMove(binding, event),
      hostScroll: () => this.repositionMenu(binding),
      windowResize: () => this.repositionMenu(binding),
    };

    host.addEventListener("mousedown", binding.hostMouseDown, true);
    host.addEventListener("mousemove", binding.hostMouseMove);
    document.addEventListener("mousedown", binding.documentMouseDown, true);
    document.addEventListener("mousemove", binding.documentMouseMove);
    document.addEventListener("mouseup", binding.documentMouseMove, true);
    window.addEventListener("scroll", binding.hostScroll, true);
    window.addEventListener("resize", binding.windowResize);
    binding.observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "style", "alt", "title"],
    });

    this.bindings.set(editor, binding);
    this.scheduleScan(binding);
  }

  detach(editor: Editor): void {
    const binding = this.bindings.get(editor);
    if (!binding) return;

    binding.observer.disconnect();
    if (binding.scanTimer !== null) {
      window.clearTimeout(binding.scanTimer);
    }
    binding.host.removeEventListener("mousedown", binding.hostMouseDown, true);
    binding.host.removeEventListener("mousemove", binding.hostMouseMove);
    document.removeEventListener("mousedown", binding.documentMouseDown, true);
    document.removeEventListener("mousemove", binding.documentMouseMove);
    document.removeEventListener("mouseup", binding.documentMouseMove, true);
    window.removeEventListener("scroll", binding.hostScroll, true);
    window.removeEventListener("resize", binding.windowResize);

    this.clearSelection(binding);
    if (this.activeBinding === binding) {
      this.activeBinding = null;
    }
    this.bindings.delete(editor);
  }

  private scheduleScan(binding: Binding): void {
    if (binding.scanTimer !== null) {
      window.clearTimeout(binding.scanTimer);
    }
    binding.scanTimer = window.setTimeout(() => {
      binding.scanTimer = null;
      this.scan(binding);
    }, 0);
  }

  private scan(binding: Binding): void {
    if (!binding.host.isConnected) return;

    const images = Array.from(
      binding.host.querySelectorAll("img:not(.ProseMirror-separator)"),
    ) as HTMLImageElement[];

    images.forEach((img) => {
      const wrap = this.ensureWrappedImage(binding, img);
      if (wrap) {
        this.bindWrap(binding, wrap, img);
      }
    });

    this.repositionMenu(binding);
  }

  private ensureWrappedImage(
    binding: Binding,
    img: HTMLImageElement,
  ): HTMLSpanElement | null {
    const existingWrap = img.closest(
      ".sirh-img-wrap",
    ) as HTMLSpanElement | null;
    if (existingWrap) {
      (img.dataset as any).sirhWrapped = "1";
      return existingWrap;
    }

    const parent = img.parentElement;
    if (!parent || !binding.host.contains(img)) return null;

    const wrap = document.createElement("span");
    wrap.className = "sirh-img-wrap";
    wrap.contentEditable = "false";
    (wrap.dataset as any).sirhLockAspect =
      img.getAttribute("data-keep-ratio") === "false" ? "false" : "true";
    (wrap.dataset as any).sirhAlign = this.inferAlign(img);

    const width = this.getNumericSize(
      img.style.width || img.getAttribute("width"),
    );
    const height = this.getNumericSize(
      img.style.height || img.getAttribute("height"),
    );
    const widthMode = this.getWidthMode(
      img.style.width || img.getAttribute("width"),
    );

    if (widthMode === "percent") {
      (wrap.dataset as any).sirhWidthMode = "percent";
      (wrap.dataset as any).sirhPct = String(
        img.style.width || img.getAttribute("width") || "100%",
      );
      wrap.style.width = (wrap.dataset as any).sirhPct;
      img.style.width = "100%";
      img.style.height = "auto";
      img.classList.remove("sirh-sized");
    } else {
      if (width !== null) {
        (wrap.dataset as any).sirhWidthMode = "fixed";
        (wrap.dataset as any).sirhW = String(width);
        wrap.style.width = `${width}px`;
        img.style.width = `${width}px`;
      }
      if (height !== null) {
        (wrap.dataset as any).sirhH = String(height);
        img.style.height = `${height}px`;
      }
      if (width !== null || height !== null) {
        img.classList.add("sirh-sized");
      }
    }

    this.applyAlign(
      binding,
      wrap,
      img,
      (wrap.dataset as any).sirhAlign as ImageAlign,
    );
    parent.insertBefore(wrap, img);
    wrap.appendChild(img);
    img.contentEditable = "false";
    img.draggable = false;
    (img.dataset as any).sirhWrapped = "1";

    const selFrame = document.createElement("div");
    selFrame.className = "sirh-sel-frame";
    selFrame.contentEditable = "false";
    wrap.appendChild(selFrame);

    const badge = document.createElement("div");
    badge.className = "sirh-size-badge";
    badge.contentEditable = "false";
    wrap.appendChild(badge);

    (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeDirection[]).forEach(
      (dir) => {
        const handle = document.createElement("span");
        handle.className = "sirh-handle";
        (handle.dataset as any).d = dir;
        handle.contentEditable = "false";
        handle.addEventListener("mousedown", (event) => {
          this.startResize(binding, wrap, img, badge, dir, event);
        });
        wrap.appendChild(handle);
      },
    );

    wrap.addEventListener("mousedown", (event) => {
      if (
        (event.target as HTMLElement | null)?.classList.contains("sirh-handle")
      )
        return;
      event.stopPropagation();
      this.select(binding, wrap, img);
    });
    wrap.addEventListener("pointerdown", (event) => {
      if (
        (event.target as HTMLElement | null)?.classList.contains("sirh-handle")
      )
        return;
      event.stopPropagation();
      this.select(binding, wrap, img);
    });
    wrap.addEventListener("click", (event) => {
      event.stopPropagation();
      this.select(binding, wrap, img);
    });
    wrap.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.select(binding, wrap, img);
      this.showContextMenu(binding, wrap, img, event.clientX, event.clientY);
    });

    return wrap;
  }

  private bindWrap(
    binding: Binding,
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
  ): void {
    (wrap.dataset as any).sirhAlign =
      (wrap.dataset as any).sirhAlign || this.inferAlign(img);
    if (
      (wrap.dataset as any).sirhWidthMode === "percent" &&
      (wrap.dataset as any).sirhPct
    ) {
      wrap.style.width = (wrap.dataset as any).sirhPct;
    }
  }

  private select(
    binding: Binding,
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
  ): void {
    if (this.activeBinding && this.activeBinding !== binding) {
      this.clearSelection(this.activeBinding);
    }
    this.activeBinding = binding;
    binding.selectedWrap = wrap;
    binding.selectedImg = img;
    wrap.classList.add("sirh-selected");
    if (wrap === img) {
      wrap.classList.add("sirh-img-selected");
    }
  }

  private clearSelection(binding: Binding): void {
    if (binding.selectedWrap) {
      binding.selectedWrap.classList.remove(
        "sirh-selected",
        "sirh-img-selected",
        "sirh-resizing",
      );
    }
    if (binding.selectedMenu) {
      binding.selectedMenu.remove();
      binding.selectedMenu = null;
    }
    binding.selectedWrap = null;
    binding.selectedImg = null;
  }

  private onDocumentMouseDown(binding: Binding, event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".sirh-ctx-menu")) return;
    if (!binding.host.contains(target) || !target.closest(".sirh-img-wrap")) {
      if (this.activeBinding === binding) {
        this.clearSelection(binding);
        this.activeBinding = null;
      }
    }
  }

  private onHostMouseDown(binding: Binding, event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.classList.contains("column-resize-handle")) {
      binding.tableResizeActive = true;
      document.body.classList.add("sirh-col-resize");
      const stop = () => {
        binding.tableResizeActive = false;
        document.body.classList.remove("sirh-col-resize");
      };
      document.addEventListener("mouseup", stop, { once: true });
      return;
    }

    const wrap = target.closest(".sirh-img-wrap") as HTMLSpanElement | null;
    if (!wrap) return;
    const img = wrap.querySelector("img") as HTMLImageElement | null;
    if (!img) return;
    this.select(binding, wrap, img);
  }

  private onHostMouseMove(binding: Binding, event: MouseEvent): void {
    if (binding.tableResizeActive) return;
    const target = event.target as HTMLElement | null;
    if (target?.classList.contains("column-resize-handle")) {
      document.body.classList.add("sirh-col-resize");
      document.body.classList.remove("sirh-row-resize");
      return;
    }

    const cell = target?.closest("td, th") as HTMLElement | null;
    if (!cell) {
      document.body.classList.remove("sirh-col-resize", "sirh-row-resize");
      return;
    }

    const rect = cell.getBoundingClientRect();
    const threshold = 7;
    const x = event.clientX;
    const y = event.clientY;

    if (
      Math.abs(x - rect.right) <= threshold ||
      Math.abs(x - rect.left) <= threshold
    ) {
      document.body.classList.add("sirh-col-resize");
      document.body.classList.remove("sirh-row-resize");
    } else if (
      Math.abs(y - rect.bottom) <= threshold ||
      Math.abs(y - rect.top) <= threshold
    ) {
      document.body.classList.add("sirh-row-resize");
      document.body.classList.remove("sirh-col-resize");
    } else {
      document.body.classList.remove("sirh-col-resize", "sirh-row-resize");
    }
  }

  private startResize(
    binding: Binding,
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
    badge: HTMLDivElement,
    dir: ResizeDirection,
    event: MouseEvent,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.select(binding, wrap, img);

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = img.offsetWidth || img.naturalWidth || 100;
    const startHeight = img.offsetHeight || img.naturalHeight || 100;
    const ratio = startHeight > 0 ? startWidth / startHeight : 1;

    document.body.classList.add(`sirh-cur-${dir}`);
    wrap.classList.add("sirh-resizing");
    badge.style.display = "block";

    const onMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (dir.includes("e")) nextWidth = Math.max(20, startWidth + deltaX);
      if (dir.includes("w")) nextWidth = Math.max(20, startWidth - deltaX);
      if (dir.includes("s")) nextHeight = Math.max(15, startHeight + deltaY);
      if (dir.includes("n")) nextHeight = Math.max(15, startHeight - deltaY);

      if ((wrap.dataset as any).sirhLockAspect !== "false") {
        const hasH = dir.includes("e") || dir.includes("w");
        const hasV = dir.includes("n") || dir.includes("s");
        if (hasH && hasV) {
          const scale = Math.max(
            nextWidth / startWidth,
            nextHeight / startHeight,
          );
          nextWidth = Math.max(20, Math.round(startWidth * scale));
          nextHeight = Math.max(15, Math.round(startHeight * scale));
        } else if (hasH) {
          nextHeight = Math.max(15, Math.round(nextWidth / ratio));
        } else {
          nextWidth = Math.max(20, Math.round(nextHeight * ratio));
        }
      }

      nextWidth = Math.round(nextWidth);
      nextHeight = Math.round(nextHeight);
      img.style.width = `${nextWidth}px`;
      img.style.height = `${nextHeight}px`;
      img.classList.add("sirh-sized");
      wrap.style.width = `${nextWidth}px`;
      (wrap.dataset as any).sirhWidthMode = "fixed";
      (wrap.dataset as any).sirhW = String(nextWidth);
      (wrap.dataset as any).sirhH = String(nextHeight);
      delete (wrap.dataset as any).sirhPct;
      badge.textContent = `${nextWidth}×${nextHeight} px  (${this.pxToMm(nextWidth).toFixed(1)}×${this.pxToMm(nextHeight).toFixed(1)} mm)`;
    };

    const onUp = () => {
      document.body.classList.remove(
        "sirh-cur-nw",
        "sirh-cur-n",
        "sirh-cur-ne",
        "sirh-cur-e",
        "sirh-cur-se",
        "sirh-cur-s",
        "sirh-cur-sw",
        "sirh-cur-w",
      );
      wrap.classList.remove("sirh-resizing");
      badge.style.display = "none";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      this.persistImageNode(binding, wrap, img);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp, { once: true });
  }

  private showContextMenu(
    binding: Binding,
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
    x: number,
    y: number,
  ): void {
    if (binding.selectedMenu) {
      binding.selectedMenu.remove();
      binding.selectedMenu = null;
    }

    const menu = document.createElement("div");
    menu.className = "sirh-ctx-menu visible";
    menu.innerHTML = `
      <div class="sirh-ctx-menu-title">Alignement</div>
      <div class="sirh-ctx-menu-item${(wrap.dataset as any).sirhAlign === "left" ? " checked" : ""}" data-a="align-left">◧ Gauche</div>
      <div class="sirh-ctx-menu-item${(wrap.dataset as any).sirhAlign === "center" ? " checked" : ""}" data-a="align-center">▣ Centré</div>
      <div class="sirh-ctx-menu-item${(wrap.dataset as any).sirhAlign === "right" ? " checked" : ""}" data-a="align-right">▧ Droite</div>
      <div class="sirh-ctx-menu-sep"></div>
      <div class="sirh-ctx-menu-title">Largeur rapide</div>
      <div class="sirh-ctx-menu-item" data-a="size-25">25% de la page</div>
      <div class="sirh-ctx-menu-item" data-a="size-50">50% de la page</div>
      <div class="sirh-ctx-menu-item" data-a="size-75">75% de la page</div>
      <div class="sirh-ctx-menu-item" data-a="size-100">Pleine largeur</div>
      <div class="sirh-ctx-menu-sep"></div>
      <div class="sirh-ctx-menu-item${(wrap.dataset as any).sirhLockAspect !== "false" ? " checked" : ""}" data-a="toggle-lock">${(wrap.dataset as any).sirhLockAspect !== "false" ? "🔒" : "🔓"} Ratio proportionnel</div>
      <div class="sirh-ctx-menu-sep"></div>
      <div class="sirh-ctx-menu-item danger" data-a="delete">Supprimer l'image</div>
    `;

    menu
      .querySelectorAll<HTMLElement>(".sirh-ctx-menu-item")
      .forEach((item) => {
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          const action = (item.dataset as any).a || "";
          if (action === "align-left")
            this.applyAlign(binding, wrap, img, "left");
          if (action === "align-center")
            this.applyAlign(binding, wrap, img, "center");
          if (action === "align-right")
            this.applyAlign(binding, wrap, img, "right");
          if (action === "size-25")
            this.applyWidthPct(binding, wrap, img, "25%");
          if (action === "size-50")
            this.applyWidthPct(binding, wrap, img, "50%");
          if (action === "size-75")
            this.applyWidthPct(binding, wrap, img, "75%");
          if (action === "size-100")
            this.applyWidthPct(binding, wrap, img, "100%");
          if (action === "toggle-lock") {
            (wrap.dataset as any).sirhLockAspect =
              (wrap.dataset as any).sirhLockAspect === "false"
                ? "true"
                : "false";
            this.persistImageNode(binding, wrap, img);
          }
          if (action === "delete") {
            wrap.remove();
            this.clearSelection(binding);
          }
          menu.remove();
          binding.selectedMenu = null;
        });
      });

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);
    binding.selectedMenu = menu;

    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        menu.style.left = `${Math.max(8, x - rect.width)}px`;
      }
      if (rect.bottom > window.innerHeight - 8) {
        menu.style.top = `${Math.max(8, y - rect.height)}px`;
      }
    });
  }

  private applyAlign(
    binding: Binding,
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
    align: ImageAlign,
  ): void {
    wrap.style.float = "none";
    wrap.style.marginLeft = "";
    wrap.style.marginRight = "";
    wrap.style.marginBottom = "";
    wrap.style.display = "";

    if (align === "left") {
      wrap.style.float = "left";
      wrap.style.marginRight = "10px";
      wrap.style.marginBottom = "6px";
    } else if (align === "right") {
      wrap.style.float = "right";
      wrap.style.marginLeft = "10px";
      wrap.style.marginBottom = "6px";
    } else {
      wrap.style.display = "block";
      wrap.style.marginLeft = "auto";
      wrap.style.marginRight = "auto";
    }

    (wrap.dataset as any).sirhAlign = align;
    this.persistImageNode(binding, wrap, img);
  }

  private applyWidthPct(
    binding: Binding,
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
    pct: string,
  ): void {
    wrap.style.float = "none";
    wrap.style.display = "block";
    wrap.style.marginLeft = "auto";
    wrap.style.marginRight = "auto";
    wrap.style.width = pct;
    img.style.width = "100%";
    img.style.height = "auto";
    img.classList.remove("sirh-sized");
    (wrap.dataset as any).sirhWidthMode = "percent";
    (wrap.dataset as any).sirhPct = pct;
    delete (wrap.dataset as any).sirhW;
    delete (wrap.dataset as any).sirhH;
    this.persistImageNode(binding, wrap, img);
  }

  private persistImageNode(
    binding: Binding | null,
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
  ): void {
    if (!binding) return;

    const pos = binding.editor.view.posAtDOM(img, 0);
    const node = binding.editor.state.doc.nodeAt(pos);
    if (!node || node.type?.name !== "image") return;

    const attrs = {
      ...node.attrs,
      src: img.getAttribute("src") || node.attrs["src"],
      alt: img.getAttribute("alt") || node.attrs["alt"] || "",
      title: img.getAttribute("title") || node.attrs["title"] || "",
      style: this.buildImageStyle(wrap, img),
      "data-keep-ratio":
        (wrap.dataset as any).sirhLockAspect === "false" ? "false" : "true",
    };

    binding.editor.view.dispatch(
      binding.editor.state.tr.setNodeMarkup(pos, undefined, attrs),
    );
  }

  private buildImageStyle(
    wrap: HTMLSpanElement,
    img: HTMLImageElement,
  ): string {
    const parts: string[] = [];
    const align = (wrap.dataset as any).sirhAlign || this.inferAlign(img);
    const pct = (wrap.dataset as any).sirhPct || "";
    const isPercent = (wrap.dataset as any).sirhWidthMode === "percent" && pct;
    const width = this.getNumericSize(
      (wrap.dataset as any).sirhW ||
        img.style.width ||
        img.getAttribute("width"),
    );
    const height = this.getNumericSize(
      (wrap.dataset as any).sirhH ||
        img.style.height ||
        img.getAttribute("height"),
    );

    if (isPercent) {
      parts.push(`width:${pct}`, "height:auto");
    } else {
      if (width !== null) parts.push(`width:${width}px`);
      if (height !== null) parts.push(`height:${height}px`);
    }

    if (align === "left") {
      parts.push(
        "display:block",
        "float:left",
        "margin-right:10px",
        "margin-bottom:6px",
      );
    } else if (align === "right") {
      parts.push(
        "display:block",
        "float:right",
        "margin-left:10px",
        "margin-bottom:6px",
      );
    } else if (align === "inline") {
      parts.push(
        "display:inline-block",
        "float:none",
        "margin:0 8px 0 0",
        "vertical-align:middle",
      );
    } else {
      parts.push(
        "display:block",
        "float:none",
        "margin-left:auto",
        "margin-right:auto",
      );
    }

    return `${parts.join(";")};`;
  }

  private inferAlign(img: HTMLImageElement): ImageAlign {
    const float = img.style.float;
    if (float === "left") return "left";
    if (float === "right") return "right";
    if (img.style.display === "inline-block") return "inline";
    if (img.style.marginLeft === "auto" && img.style.marginRight === "auto")
      return "center";
    return "center";
  }

  private getWidthMode(
    raw: string | null | undefined,
  ): "percent" | "fixed" | null {
    if (!raw) return null;
    return String(raw).trim().endsWith("%") ? "percent" : "fixed";
  }

  private getNumericSize(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const match = String(raw)
      .trim()
      .match(/^([\d.]+)/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  private pxToMm(px: number): number {
    return Math.round(((px * 25.4) / 96) * 10) / 10;
  }

  private repositionMenu(binding: Binding): void {
    if (!binding.selectedMenu || !binding.selectedMenu.isConnected) return;
    const rect = binding.selectedMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      binding.selectedMenu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      binding.selectedMenu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    }
  }

  private injectStyles(): void {
    if (this.stylesInjected || document.getElementById("sirh-cr-angular-css"))
      return;
    const style = document.createElement("style");
    style.id = "sirh-cr-angular-css";
    style.textContent = `
      .sirh-img-wrap{display:inline-block;position:relative;line-height:0;user-select:none;max-width:100%;cursor:grab!important;box-sizing:border-box;overflow:visible}
      .sirh-img-wrap:active{cursor:grabbing!important}
      .sirh-img-selected,.sirh-img-wrap.sirh-selected{outline:2px solid #2563eb;outline-offset:2px}
      .sirh-img-wrap img{display:block;max-width:100%;height:auto;pointer-events:none}
      .sirh-img-wrap img.sirh-sized{max-width:none!important}
      .sirh-sel-frame{position:absolute;inset:-2px;border:2px solid #2563eb;border-radius:1px;pointer-events:none;z-index:5;box-shadow:0 0 0 1px rgba(37,99,235,.18);display:none}
      .sirh-img-wrap:hover .sirh-sel-frame,.sirh-img-wrap.sirh-selected .sirh-sel-frame{display:block}
      .sirh-handle{position:absolute;width:9px;height:9px;background:#fff;border:1.5px solid #2563eb;border-radius:2px;z-index:20;box-shadow:0 0 0 1.5px rgba(37,99,235,.22),0 1px 3px rgba(0,0,0,.16);opacity:0;transition:opacity .1s,transform .1s,background .1s;box-sizing:border-box;pointer-events:auto}
      .sirh-img-wrap:hover .sirh-handle,.sirh-img-wrap.sirh-selected .sirh-handle{opacity:1}
      .sirh-handle:hover{transform:scale(1.4);background:#2563eb}
      .sirh-handle[data-d=nw]{top:-5px;left:-5px;cursor:nw-resize}
      .sirh-handle[data-d=n]{top:-5px;left:calc(50% - 4.5px);cursor:n-resize}
      .sirh-handle[data-d=ne]{top:-5px;right:-5px;cursor:ne-resize}
      .sirh-handle[data-d=e]{top:calc(50% - 4.5px);right:-5px;cursor:e-resize}
      .sirh-handle[data-d=se]{bottom:-5px;right:-5px;cursor:se-resize}
      .sirh-handle[data-d=s]{bottom:-5px;left:calc(50% - 4.5px);cursor:s-resize}
      .sirh-handle[data-d=sw]{bottom:-5px;left:-5px;cursor:sw-resize}
      .sirh-handle[data-d=w]{top:calc(50% - 4.5px);left:-5px;cursor:w-resize}
      .sirh-size-badge{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;font-size:9px;font-family:monospace;padding:3px 9px;border-radius:4px;white-space:nowrap;pointer-events:none;display:none;z-index:30;letter-spacing:.02em}
      .sirh-img-wrap.sirh-resizing .sirh-size-badge{display:block}
      body.sirh-cur-nw *,body.sirh-cur-n *,body.sirh-cur-ne *,body.sirh-cur-e *,body.sirh-cur-se *,body.sirh-cur-s *,body.sirh-cur-sw *,body.sirh-cur-w *{cursor:auto!important}
      body.sirh-cur-nw *{cursor:nw-resize!important} body.sirh-cur-n *{cursor:n-resize!important} body.sirh-cur-ne *{cursor:ne-resize!important} body.sirh-cur-e *{cursor:e-resize!important} body.sirh-cur-se *{cursor:se-resize!important} body.sirh-cur-s *{cursor:s-resize!important} body.sirh-cur-sw *{cursor:sw-resize!important} body.sirh-cur-w *{cursor:w-resize!important}
      body.sirh-dragging *{cursor:grabbing!important}
      .sirh-ctx-menu{position:fixed;background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:9800;min-width:200px;padding:4px 0;display:none;font-family:inherit;font-size:13px}
      .sirh-ctx-menu.visible{display:block}
      .sirh-ctx-menu-sep{height:1px;background:#e5e7eb;margin:4px 0}
      .sirh-ctx-menu-item{padding:7px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;color:#1f2937;transition:background-color .1s;user-select:none}
      .sirh-ctx-menu-item:hover{background:#f3f4f6}
      .sirh-ctx-menu-item.checked{font-weight:600;color:#2563eb}
      .sirh-ctx-menu-item.danger{color:#dc2626}
      .sirh-ctx-menu-item.danger:hover{background:#fef2f2}
      .sirh-ctx-menu-title{padding:4px 16px;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase}
      .column-resize-handle{cursor:col-resize!important}
      .ProseMirror td,.ProseMirror th{cursor:cell!important}
      body.sirh-col-resize *{cursor:col-resize!important}
      body.sirh-row-resize *{cursor:row-resize!important}
    `;
    document.head.appendChild(style);
    this.stylesInjected = true;
  }
}
