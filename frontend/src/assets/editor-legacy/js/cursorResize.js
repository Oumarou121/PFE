// ═══════════════════════════════════════════════════════════════
//  SIRH-Doc  cursorResize.js  v3
//  Gestionnaire d'images style Microsoft Word — version unifiée
//  • 8 poignées de redimensionnement (position:absolute dans le wrap)
//  • Toolbar flottante avec inputs W/H en mm + alignement + %
//  • Taille à l'import (px / mm / cm / %)
//  • Ratio lock · badge taille · menu contextuel style Word
//  • Curseurs de tableau
//  NOTE : wordImageManager.js ne doit PAS être chargé simultanément
// ═══════════════════════════════════════════════════════════════

(function (global) {
  "use strict";

  /* ──────────────────────────────────────────────────────────
     CONSTANTES
  ────────────────────────────────────────────────────────── */
  const MM_TO_PX = 96 / 25.4;
  const PX_TO_MM = 25.4 / 96;
  const MIN_W = 20;
  const MIN_H = 15;

  /* ──────────────────────────────────────────────────────────
     CSS GLOBAL
  ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById("sirh-cr-css")) return;
    const s = document.createElement("style");
    s.id = "sirh-cr-css";
    s.textContent = [
      ".ProseMirror{cursor:text!important}",
      ".ProseMirror img.ProseMirror-selectednode{outline:none!important}",
      ".sirh-img-wrap{display:inline-block;position:relative;line-height:0;user-select:none;max-width:100%;cursor:grab!important;box-sizing:border-box;overflow:visible}",
      ".sirh-img-wrap:active{cursor:grabbing!important}",
      ".sirh-img-selected{outline:2px solid #2563eb;outline-offset:2px}",
      ".sirh-img-wrap img{display:block;max-width:100%;height:auto;pointer-events:none}",
      ".sirh-img-wrap img.sirh-sized{max-width:none!important}",
      /* Cadre sélection */
      ".sirh-sel-frame{position:absolute;inset:-2px;border:2px solid #2563eb;border-radius:1px;pointer-events:none;z-index:5;box-shadow:0 0 0 1px rgba(37,99,235,.18);display:none}",
      ".sirh-img-wrap.sirh-selected .sirh-sel-frame{display:block}",
      /* Poignées */
      ".sirh-handle{position:absolute;width:9px;height:9px;background:#fff;border:1.5px solid #2563eb;border-radius:2px;z-index:20;box-shadow:0 0 0 1.5px rgba(37,99,235,.22),0 1px 3px rgba(0,0,0,.16);opacity:0;transition:opacity .1s,transform .1s,background .1s;box-sizing:border-box;pointer-events:auto}",
      ".sirh-img-wrap:hover .sirh-sel-frame,.sirh-img-wrap.sirh-selected .sirh-sel-frame{display:block}",
      ".sirh-img-wrap:hover .sirh-handle,.sirh-img-wrap.sirh-selected .sirh-handle{opacity:1}",
      ".sirh-handle:hover{transform:scale(1.4);background:#2563eb}",
      ".sirh-handle[data-d=nw]{top:-5px;left:-5px;cursor:nw-resize}",
      ".sirh-handle[data-d=n]{top:-5px;left:calc(50% - 4.5px);cursor:n-resize}",
      ".sirh-handle[data-d=ne]{top:-5px;right:-5px;cursor:ne-resize}",
      ".sirh-handle[data-d=e]{top:calc(50% - 4.5px);right:-5px;cursor:e-resize}",
      ".sirh-handle[data-d=se]{bottom:-5px;right:-5px;cursor:se-resize}",
      ".sirh-handle[data-d=s]{bottom:-5px;left:calc(50% - 4.5px);cursor:s-resize}",
      ".sirh-handle[data-d=sw]{bottom:-5px;left:-5px;cursor:sw-resize}",
      ".sirh-handle[data-d=w]{top:calc(50% - 4.5px);left:-5px;cursor:w-resize}",
      ".sirh-overlay{position:fixed;inset:0;pointer-events:none;z-index:9700;display:none}",
      ".sirh-overlay.visible{display:block}",
      ".sirh-overlay-frame{position:fixed;border:2px solid #2563eb;box-shadow:0 0 0 1px rgba(37,99,235,.18);pointer-events:none;box-sizing:border-box}",
      ".sirh-overlay-handle{position:fixed;width:10px;height:10px;background:#fff;border:1.5px solid #2563eb;border-radius:2px;box-shadow:0 0 0 1.5px rgba(37,99,235,.22),0 1px 3px rgba(0,0,0,.16);pointer-events:auto;box-sizing:border-box}",
      ".sirh-overlay-handle[data-d=nw]{cursor:nw-resize}",
      ".sirh-overlay-handle[data-d=n]{cursor:n-resize}",
      ".sirh-overlay-handle[data-d=ne]{cursor:ne-resize}",
      ".sirh-overlay-handle[data-d=e]{cursor:e-resize}",
      ".sirh-overlay-handle[data-d=se]{cursor:se-resize}",
      ".sirh-overlay-handle[data-d=s]{cursor:s-resize}",
      ".sirh-overlay-handle[data-d=sw]{cursor:sw-resize}",
      ".sirh-overlay-handle[data-d=w]{cursor:w-resize}",
      /* Badge taille */
      ".sirh-size-badge{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;font-size:9px;font-family:'IBM Plex Mono',monospace;padding:3px 9px;border-radius:4px;white-space:nowrap;pointer-events:none;display:none;z-index:30;letter-spacing:.02em}",
      ".sirh-img-wrap.sirh-resizing .sirh-size-badge{display:block}",
      /* Curseurs resize body */
      "body.sirh-cur-nw *{cursor:nw-resize!important}",
      "body.sirh-cur-n *{cursor:n-resize!important}",
      "body.sirh-cur-ne *{cursor:ne-resize!important}",
      "body.sirh-cur-e *{cursor:e-resize!important}",
      "body.sirh-cur-se *{cursor:se-resize!important}",
      "body.sirh-cur-s *{cursor:s-resize!important}",
      "body.sirh-cur-sw *{cursor:sw-resize!important}",
      "body.sirh-cur-w *{cursor:w-resize!important}",
      "body.sirh-dragging *{cursor:grabbing!important}",
      /* Menu contextuel */
      ".sirh-ctx-menu{position:fixed;background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:9800;min-width:200px;padding:4px 0;display:none;font-family:'IBM Plex Sans',sans-serif;font-size:13px}",
      ".sirh-ctx-menu.visible{display:block}",
      ".sirh-ctx-menu-sep{height:1px;background:#e5e7eb;margin:4px 0}",
      ".sirh-ctx-menu-item{padding:7px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;color:#1f2937;transition:background-color .1s;user-select:none}",
      ".sirh-ctx-menu-item:hover{background:#f3f4f6}",
      ".sirh-ctx-menu-item.checked{font-weight:600;color:#2563eb}",
      ".sirh-ctx-menu-item.danger{color:#dc2626}",
      ".sirh-ctx-menu-item.danger:hover{background:#fef2f2}",
      ".sirh-ctx-menu-title{padding:4px 16px;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase}",
      /* Curseurs tableau */
      ".column-resize-handle{cursor:col-resize!important}",
      ".ProseMirror td,.ProseMirror th{cursor:cell!important}",
      "body.sirh-col-resize *{cursor:col-resize!important}",
      "body.sirh-row-resize *{cursor:row-resize!important}",
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ──────────────────────────────────────────────────────────
     UTILITAIRES
  ────────────────────────────────────────────────────────── */
  function parseSizeToPixels(raw, containerPx) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    if (!s || s === "auto") return null;
    let m;
    if ((m = s.match(/^([\d.]+)\s*px$/))) return parseFloat(m[1]);
    if ((m = s.match(/^([\d.]+)\s*mm$/))) return parseFloat(m[1]) * MM_TO_PX;
    if ((m = s.match(/^([\d.]+)\s*cm$/)))
      return parseFloat(m[1]) * 10 * MM_TO_PX;
    if ((m = s.match(/^([\d.]+)\s*%$/))) {
      const container =
        typeof containerPx === "number" && containerPx > 0
          ? containerPx
          : document?.documentElement?.clientWidth || window.innerWidth || 595;
      return (parseFloat(m[1]) / 100) * container;
    }
    if ((m = s.match(/^([\d.]+)$/))) return parseFloat(m[1]);
    return null;
  }

  function pxToMm(px) {
    return Math.round(px * PX_TO_MM * 10) / 10;
  }

  function _findImageNodePos(editor, img) {
    if (!editor?.view || !img) return null;
    try {
      const pos = editor.view.posAtDOM(img, 0);
      const node = editor.state.doc.nodeAt(pos);
      return node?.type?.name === "image" ? pos : null;
    } catch (_) {
      return null;
    }
  }

  function _buildImageStyle(wrap, img) {
    const parts = [];
    const align = wrap?.dataset?.sirhAlign || "center";
    const pct = wrap?.dataset?.sirhPct || "";
    const isPct = wrap?.dataset?.sirhWidthMode === "percent" && pct;
    const wPx = parseInt(wrap?.dataset?.sirhW || img?.style?.width || "", 10);
    const hPx = parseInt(wrap?.dataset?.sirhH || img?.style?.height || "", 10);

    if (isPct) {
      parts.push(`width:${pct}`, "height:auto");
    } else {
      if (Number.isFinite(wPx) && wPx > 0) parts.push(`width:${wPx}px`);
      if (Number.isFinite(hPx) && hPx > 0) parts.push(`height:${hPx}px`);
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

    return parts.join(";") + ";";
  }

  function _persistImageNode(wrap, img, extraAttrs) {
    const editor =
      wrap?._editor ||
      img?._editor ||
      global.__getActiveEditor?.() ||
      global.activeEditor ||
      null;
    if (!editor || !img) return;
    const pos = _findImageNodePos(editor, img);
    if (pos == null) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    const nextAttrs = {
      ...node.attrs,
      src: img.getAttribute("src") || node.attrs.src,
      alt: img.getAttribute("alt") || "",
      title: img.getAttribute("title") || "",
      style: _buildImageStyle(wrap, img),
      "data-keep-ratio": wrap?._lockAspect === false ? "false" : "true",
      ...(extraAttrs || {}),
    };

    const sameAttrs =
      Object.keys(nextAttrs).length === Object.keys(node.attrs || {}).length &&
      Object.entries(nextAttrs).every(
        ([key, value]) => node.attrs?.[key] === value,
      );
    if (sameAttrs) return;

    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, nextAttrs),
    );
  }

  /* ──────────────────────────────────────────────────────────
     ICONS SVG
  ────────────────────────────────────────────────────────── */
  function _svgAlign(dir) {
    const L = {
      left: [
        '<line x1="3" y1="6" x2="21" y2="6"/>',
        '<line x1="3" y1="12" x2="15" y2="12"/>',
        '<line x1="3" y1="18" x2="18" y2="18"/>',
      ],
      center: [
        '<line x1="3" y1="6" x2="21" y2="6"/>',
        '<line x1="6" y1="12" x2="18" y2="12"/>',
        '<line x1="4" y1="18" x2="20" y2="18"/>',
      ],
      right: [
        '<line x1="3" y1="6" x2="21" y2="6"/>',
        '<line x1="9" y1="12" x2="21" y2="12"/>',
        '<line x1="6" y1="18" x2="21" y2="18"/>',
      ],
    };
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${(L[dir] || L.left).join("")}</svg>`;
  }
  function _svgLock(locked) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("width", "12");
    el.setAttribute("height", "12");
    el.setAttribute("viewBox", "0 0 14 14");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "1.8");
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", "3");
    r.setAttribute("y", "6");
    r.setAttribute("width", "8");
    r.setAttribute("height", "7");
    r.setAttribute("rx", "1");
    el.appendChild(r);
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute(
      "d",
      locked ? "M5 6V4.5a2 2 0 014 0V6" : "M5 6V4.5a2 2 0 014 0",
    );
    if (!locked) p.setAttribute("stroke-dasharray", "2 1.5");
    el.appendChild(p);
    return el;
  }
  function _svgTrash() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
  }
  /* ──────────────────────────────────────────────────────────
     MODULE PRINCIPAL : SirhImgResize
  ────────────────────────────────────────────────────────── */
  const SirhImgResize = (function () {
    let _activeWrap = null;
    let _activeImg = null;
    let _activeEditor = null;
    let _ctxMenu = null;
    let _overlay = null;
    let _draggingImg = null;
    let _draggingEditor = null;

    function _getOverlay() {
      if (_overlay && document.body.contains(_overlay)) return _overlay;
      const ov = document.createElement("div");
      ov.className = "sirh-overlay";
      const frame = document.createElement("div");
      frame.className = "sirh-overlay-frame";
      ov.appendChild(frame);
      ov._frame = frame;
      ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((dir) => {
        const h = document.createElement("div");
        h.className = "sirh-overlay-handle";
        h.dataset.d = dir;
        h.addEventListener("mousedown", (e) => {
          if (!_activeImg || !_activeWrap) return;
          e.stopPropagation();
          _startResize(e, _activeWrap, _activeImg, null, dir, _activeEditor);
        });
        ov.appendChild(h);
      });
      document.body.appendChild(ov);
      _overlay = ov;
      return ov;
    }

    function _getTargetRect() {
      const box =
        _activeWrap &&
        _activeWrap !== _activeImg &&
        _activeWrap.classList?.contains("sirh-img-wrap")
          ? _activeWrap
          : _activeImg;
      return box ? box.getBoundingClientRect() : null;
    }

    function _inferAlign(el) {
      if (!el) return "center";
      if (el.style.float === "left") return "left";
      if (el.style.float === "right") return "right";
      if (el.style.display === "inline-block") return "inline";
      if (el.style.marginLeft === "auto" && el.style.marginRight === "auto")
        return "center";
      return "center";
    }

    /* ── Appliquer taille px ── */
    function _setImgSize(wrap, img, wPx, hPx) {
      wPx = Math.max(MIN_W, Math.round(wPx));
      hPx = Math.max(MIN_H, Math.round(hPx));
      img.style.width = wPx + "px";
      img.style.height = hPx + "px";
      img.classList.add("sirh-sized");
      wrap.style.width = wPx + "px";
      wrap.dataset.sirhW = wPx;
      wrap.dataset.sirhH = hPx;
      wrap.dataset.sirhWidthMode = "fixed";
      delete wrap.dataset.sirhPct;
    }

    /* ── Alignement ── */
    function _applyAlign(wrap, align) {
      wrap.style.float = "none";
      wrap.style.marginLeft =
        wrap.style.marginRight =
        wrap.style.marginBottom =
          "";
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
        wrap.style.marginLeft = wrap.style.marginRight = "auto";
      }
      wrap.dataset.sirhAlign = align;
      const img = wrap.querySelector("img");
      if (img) _persistImageNode(wrap, img);
    }

    /* ── Largeur % ── */
    function _applyWidthPct(wrap, img, pct) {
      wrap.style.float = "none";
      wrap.style.display = "block";
      wrap.style.marginLeft = wrap.style.marginRight = "auto";
      wrap.style.width = pct;
      img.style.width = "100%";
      img.style.height = "auto";
      img.classList.remove("sirh-sized");
      wrap.dataset.sirhWidthMode = "percent";
      wrap.dataset.sirhPct = pct;
      delete wrap.dataset.sirhW;
      delete wrap.dataset.sirhH;
      _persistImageNode(wrap, img);
    }

    function _bindPlainImage(img, editor) {
      if (!img) return;
      img._editor = editor;
      img.dataset.sirhAlign = img.dataset.sirhAlign || _inferAlign(img);
      img.contentEditable = "false";
      img.draggable = true;
      _bindEditorDnD(editor);
      const onSelect = (e) => {
        e.stopPropagation();
        _select(img, img, editor);
      };
      if (img.dataset.sirhBound !== "1") {
        img.dataset.sirhBound = "1";
        img.addEventListener("mousedown", onSelect);
        img.addEventListener("click", onSelect);
        img.addEventListener("dragstart", (e) => {
          _draggingImg = img;
          _draggingEditor = editor;
          _select(img, img, editor);
          try {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", "sirh-image");
          } catch (_) {}
        });
        img.addEventListener("dragend", () => {
          _draggingImg = null;
          _draggingEditor = null;
        });
        img.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          _select(img, img, editor);
          _showCtxMenu(e.clientX, e.clientY, img, img);
        });
      }
      const parent = img.parentElement;
      const inTextParagraph =
        parent &&
        parent.tagName === "P" &&
        parent.textContent.replace(/\s+/g, "").length > 0;
      if (inTextParagraph) {
        img.dataset.sirhAlign = "inline";
        img.style.display = "inline-block";
        img.style.float = "none";
        img.style.margin = "0 8px 0 0";
        img.style.verticalAlign = "middle";
        _persistImageNode(img, img);
      }
    }

    function _bindEditorDnD(editor) {
      const host = editor?.view?.dom;
      if (!host || host.dataset.sirhDropBound === "1") return;
      host.dataset.sirhDropBound = "1";
      host.addEventListener("dragover", (e) => {
        if (!_draggingImg) return;
        e.preventDefault();
      });
      host.addEventListener("drop", (e) => {
        if (!_draggingImg || !_draggingEditor || _draggingEditor !== editor)
          return;
        e.preventDefault();
        try {
          const draggedSrc = _draggingImg.getAttribute("src") || "";
          const draggedWidth =
            parseInt(_draggingImg.style.width, 10) || _draggingImg.offsetWidth;
          const draggedHeight =
            parseInt(_draggingImg.style.height, 10) ||
            _draggingImg.offsetHeight;
          const srcPos = _findImageNodePos(editor, _draggingImg);
          const node = srcPos != null ? editor.state.doc.nodeAt(srcPos) : null;
          const coords = editor.view.posAtCoords({
            left: e.clientX,
            top: e.clientY,
          });
          if (srcPos == null || !node || !coords?.pos) return;
          let insertPos = coords.pos;
          if (insertPos > srcPos) insertPos -= node.nodeSize;
          const nextAttrs = {
            ...node.attrs,
            style: _buildImageStyle(
              {
                dataset: {
                  sirhAlign: "inline",
                  sirhW: draggedWidth,
                  sirhH: draggedHeight,
                  sirhWidthMode: "fixed",
                },
              },
              _draggingImg,
            ),
            "data-keep-ratio":
              _draggingImg.getAttribute("data-keep-ratio") || "true",
          };
          const movedNode = node.type.create(nextAttrs, null, node.marks);
          _deselect();
          let tr = editor.state.tr.delete(srcPos, srcPos + node.nodeSize);
          tr = tr.insert(insertPos, movedNode);
          editor.view.dispatch(tr);
          setTimeout(() => {
            try {
              const posAfter = Math.min(
                insertPos + movedNode.nodeSize,
                editor.state.doc.content.size,
              );
              editor.commands?.setTextSelection?.(posAfter);
            } catch (_) {}
            global.activateImageResizers?.(editor);
            const imgs = Array.from(
              host.querySelectorAll("img:not(.ProseMirror-separator)"),
            );
            imgs.forEach((img) =>
              img.classList.remove("ProseMirror-selectednode"),
            );
            let target = null;
            const hit = document.elementFromPoint(e.clientX, e.clientY);
            if (
              hit?.tagName === "IMG" &&
              !hit.classList.contains("ProseMirror-separator")
            ) {
              target = hit;
            }
            if (!target) {
              target = imgs.find(
                (img) => (img.getAttribute("src") || "") === draggedSrc,
              );
            }
            if (!target) {
              target = imgs.find(
                (img) =>
                  (parseInt(img.style.width, 10) || img.offsetWidth) ===
                    draggedWidth &&
                  (parseInt(img.style.height, 10) || img.offsetHeight) ===
                    draggedHeight,
              );
            }
            if (target) _select(target, target, editor);
          }, 60);
        } finally {
          _draggingImg = null;
          _draggingEditor = null;
        }
      });
    }

    function _syncToolbarState() {}
    function _reposition() {
      const ov = _overlay;
      if (!ov || !_activeImg || !_activeWrap) return;
      if (!_activeImg.isConnected || !_activeWrap.isConnected) {
        _deselect();
        return;
      }
      const rect = _getTargetRect();
      if (!rect) return;
      ov.classList.add("visible");
      ov._frame.style.left = rect.left - 2 + "px";
      ov._frame.style.top = rect.top - 2 + "px";
      ov._frame.style.width = rect.width + 4 + "px";
      ov._frame.style.height = rect.height + 4 + "px";
      const pos = {
        nw: [rect.left - 5, rect.top - 5],
        n: [rect.left + rect.width / 2 - 5, rect.top - 5],
        ne: [rect.right - 5, rect.top - 5],
        e: [rect.right - 5, rect.top + rect.height / 2 - 5],
        se: [rect.right - 5, rect.bottom - 5],
        s: [rect.left + rect.width / 2 - 5, rect.bottom - 5],
        sw: [rect.left - 5, rect.bottom - 5],
        w: [rect.left - 5, rect.top + rect.height / 2 - 5],
      };
      ov.querySelectorAll(".sirh-overlay-handle").forEach((h) => {
        const [left, top] = pos[h.dataset.d];
        h.style.left = left + "px";
        h.style.top = top + "px";
      });
    }

    /* ── Sélection ── */
    function _select(wrap, img, editor) {
      if (_activeWrap && _activeWrap !== wrap) {
        _activeWrap.classList.remove("sirh-selected", "sirh-img-selected");
      }
      _activeWrap = wrap;
      _activeImg = img;
      _activeEditor = editor || wrap?._editor || img?._editor || null;
      global._activeResizeImg = wrap;
      global._activeResizeImgEl = img;
      wrap.classList.add("sirh-selected");
      if (wrap === img) wrap.classList.add("sirh-img-selected");
      if (wrap._lockAspect === undefined) wrap._lockAspect = true;
      _getOverlay();
      requestAnimationFrame(_reposition);
    }

    function _deselect() {
      if (_activeWrap)
        _activeWrap.classList.remove("sirh-selected", "sirh-img-selected");
      if (_overlay) _overlay.classList.remove("visible");
      _activeWrap = _activeImg = _activeEditor = null;
      global._activeResizeImg = global._activeResizeImgEl = null;
    }

    function _removeActive() {
      if (!_activeWrap) return;
      const wrap = _activeWrap;
      const img = _activeImg || wrap.querySelector("img");
      const editor =
        wrap?._editor || img?._editor || global.__getActiveEditor?.() || null;
      const pos = editor && img ? _findImageNodePos(editor, img) : null;
      if (editor && pos != null) {
        const node = editor.state.doc.nodeAt(pos);
        if (node) {
          editor.view.dispatch(
            editor.state.tr.delete(pos, pos + node.nodeSize),
          );
        }
      } else {
        wrap.remove();
      }
      _deselect();
    }

    /* ── Redimensionnement — logique correcte ── */
    function _startResize(e, wrap, img, badge, dir, editor) {
      e.preventDefault();
      e.stopPropagation();
      _select(wrap, img);

      const sx = e.clientX,
        sy = e.clientY;
      /* IMPORTANT: lire offsetWidth/Height qui reflète le CSS déjà appliqué */
      const sw = img.offsetWidth || img.naturalWidth || 100;
      const sh = img.offsetHeight || img.naturalHeight || 100;
      const asp = sh > 0 ? sw / sh : 1;

      document.body.classList.add("sirh-cur-" + dir);
      wrap.classList.add("sirh-resizing");
      if (badge) badge.style.display = "block";

      function onMove(ev) {
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        let nw = sw,
          nh = sh;

        /* Calcul des nouvelles dimensions selon la poignée active */
        if (dir.includes("e")) nw = Math.max(MIN_W, sw + dx);
        if (dir.includes("w")) nw = Math.max(MIN_W, sw - dx);
        if (dir.includes("s")) nh = Math.max(MIN_H, sh + dy);
        if (dir.includes("n")) nh = Math.max(MIN_H, sh - dy);

        /* Ratio lock — logique unifiée (pas de double switch) */
        if (wrap._lockAspect !== false) {
          const hasH = dir.includes("e") || dir.includes("w");
          const hasV = dir.includes("n") || dir.includes("s");
          if (hasH && hasV) {
            /* Coin diagonal : prendre le plus grand facteur d'échelle */
            const sc = Math.max(nw / sw, nh / sh);
            nw = Math.max(MIN_W, Math.round(sw * sc));
            nh = Math.max(MIN_H, Math.round(sh * sc));
          } else if (hasH) {
            /* Poignée latérale : hauteur calculée depuis la largeur */
            nh = Math.max(MIN_H, Math.round(nw / asp));
          } else {
            /* Poignée verticale : largeur calculée depuis la hauteur */
            nw = Math.max(MIN_W, Math.round(nh * asp));
          }
        }

        nw = Math.round(nw);
        nh = Math.round(nh);
        img.style.width = nw + "px";
        img.style.height = nh + "px";
        img.classList.add("sirh-sized");
        if (wrap !== img) wrap.style.width = nw + "px";
        _reposition();

        if (badge)
          badge.textContent = `${nw}×${nh} px  (${pxToMm(nw).toFixed(1)}×${pxToMm(nh).toFixed(1)} mm)`;
      }

      function onUp() {
        [
          "sirh-cur-nw",
          "sirh-cur-n",
          "sirh-cur-ne",
          "sirh-cur-e",
          "sirh-cur-se",
          "sirh-cur-s",
          "sirh-cur-sw",
          "sirh-cur-w",
        ].forEach((c) => document.body.classList.remove(c));
        wrap.classList.remove("sirh-resizing");
        if (badge) badge.style.display = "none";
        /* Sauvegarder dimensions finales */
        wrap.dataset.sirhW = parseInt(img.style.width) || img.offsetWidth;
        wrap.dataset.sirhH = parseInt(img.style.height) || img.offsetHeight;
        wrap.dataset.sirhWidthMode = "fixed";
        delete wrap.dataset.sirhPct;
        _persistImageNode(wrap, img);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        _reposition();
        try {
          editor?.commands.focus();
        } catch (_) {}
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    /* ── Menu contextuel ── */
    function _getCtxMenu() {
      if (_ctxMenu && document.body.contains(_ctxMenu)) return _ctxMenu;
      _ctxMenu = document.createElement("div");
      _ctxMenu.className = "sirh-ctx-menu";
      _ctxMenu.id = "sirhImgCtxMenu";
      document.body.appendChild(_ctxMenu);
      document.addEventListener("mousedown", (e) => {
        if (!e.target.closest("#sirhImgCtxMenu"))
          _ctxMenu.classList.remove("visible");
      });
      return _ctxMenu;
    }

    function _showCtxMenu(x, y, wrap, img) {
      const menu = _getCtxMenu();
      const align = wrap.dataset.sirhAlign || "left";
      const locked = wrap._lockAspect !== false;
      menu.innerHTML = `
        <div class="sirh-ctx-menu-title">Alignement</div>
        <div class="sirh-ctx-menu-item${align === "left" ? " checked" : ""}" data-a="align-left">◧ Gauche</div>
        <div class="sirh-ctx-menu-item${align === "center" ? " checked" : ""}" data-a="align-center">▣ Centré</div>
        <div class="sirh-ctx-menu-item${align === "right" ? " checked" : ""}" data-a="align-right">▧ Droite</div>
        <div class="sirh-ctx-menu-sep"></div>
        <div class="sirh-ctx-menu-title">Largeur rapide</div>
        <div class="sirh-ctx-menu-item" data-a="size-25">25% de la page</div>
        <div class="sirh-ctx-menu-item" data-a="size-50">50% de la page</div>
        <div class="sirh-ctx-menu-item" data-a="size-75">75% de la page</div>
        <div class="sirh-ctx-menu-item" data-a="size-100">Pleine largeur</div>
        <div class="sirh-ctx-menu-sep"></div>
        <div class="sirh-ctx-menu-item${locked ? " checked" : ""}" data-a="toggle-lock">${locked ? "🔒" : "🔓"} Ratio proportionnel</div>
        <div class="sirh-ctx-menu-sep"></div>
        <div class="sirh-ctx-menu-item danger" data-a="delete">Supprimer l'image</div>
      `;
      menu.querySelectorAll(".sirh-ctx-menu-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const a = item.dataset.a;
          if (a === "align-left") {
            _applyAlign(wrap, "left");
            _syncToolbarState();
          }
          if (a === "align-center") {
            _applyAlign(wrap, "center");
            _syncToolbarState();
          }
          if (a === "align-right") {
            _applyAlign(wrap, "right");
            _syncToolbarState();
          }
          if (a === "size-25") _applyWidthPct(wrap, img, "25%");
          if (a === "size-50") _applyWidthPct(wrap, img, "50%");
          if (a === "size-75") _applyWidthPct(wrap, img, "75%");
          if (a === "size-100") _applyWidthPct(wrap, img, "100%");
          if (a === "toggle-lock") {
            wrap._lockAspect = !wrap._lockAspect;
            _persistImageNode(wrap, img);
            _syncToolbarState();
          }
          if (a === "delete") {
            wrap.remove();
            _deselect();
          }
          menu.classList.remove("visible");
          _reposition();
        });
      });
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      menu.classList.add("visible");
      requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect();
        if (r.right > window.innerWidth - 8)
          menu.style.left = x - r.width + "px";
        if (r.bottom > window.innerHeight - 8)
          menu.style.top = y - r.height + "px";
      });
    }

    /* ── Wrapping ── */
    function wrapImage(img, editor) {
      if (img.closest(".sirh-img-wrap")) {
        img.dataset.sirhWrapped = "1";
        return img.closest(".sirh-img-wrap");
      }
      img.dataset.sirhWrapped = "1";

      const wrap = document.createElement("span");
      wrap.className = "sirh-img-wrap";
      wrap._lockAspect = true;
      wrap._editor = editor;
      wrap.contentEditable = "false";
      img._editor = editor;
      img.draggable = false;

      /* Conserver la taille existante */
      const exW = img.style.width || img.getAttribute("width");
      const exH = img.style.height || img.getAttribute("height");
      if (exW) wrap.style.width = typeof exW === "number" ? exW + "px" : exW;

      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
      img.style.display = "block";
      if (!exW) img.style.maxWidth = "100%";

      const keepRatio = img.getAttribute("data-keep-ratio");
      if (keepRatio === "false") wrap._lockAspect = false;

      if (typeof exW === "string" && exW.trim().endsWith("%")) {
        wrap.dataset.sirhWidthMode = "percent";
        wrap.dataset.sirhPct = exW.trim();
        wrap.style.width = exW.trim();
        img.style.width = "100%";
        img.style.height = "auto";
        img.classList.remove("sirh-sized");
      } else {
        const pxW = parseInt(exW || img.style.width || "", 10);
        const pxH = parseInt(exH || img.style.height || "", 10);
        if (Number.isFinite(pxW) && pxW > 0) {
          wrap.dataset.sirhWidthMode = "fixed";
          wrap.dataset.sirhW = pxW;
          wrap.style.width = pxW + "px";
          img.style.width = pxW + "px";
        }
        if (Number.isFinite(pxH) && pxH > 0) {
          wrap.dataset.sirhH = pxH;
          img.style.height = pxH + "px";
        }
        if (
          (Number.isFinite(pxW) && pxW > 0) ||
          (Number.isFinite(pxH) && pxH > 0)
        ) {
          img.classList.add("sirh-sized");
        }
      }

      const imgFloat = img.style.float;
      const isCentered =
        img.style.marginLeft === "auto" && img.style.marginRight === "auto";
      if (imgFloat === "left") _applyAlign(wrap, "left");
      else if (imgFloat === "right") _applyAlign(wrap, "right");
      else if (isCentered) _applyAlign(wrap, "center");
      else _applyAlign(wrap, "center");

      /* Cadre de sélection */
      const selFrame = document.createElement("div");
      selFrame.className = "sirh-sel-frame";
      selFrame.contentEditable = "false";
      wrap.appendChild(selFrame);

      /* Badge taille */
      const badge = document.createElement("div");
      badge.className = "sirh-size-badge";
      badge.contentEditable = "false";
      wrap.appendChild(badge);

      /* 8 poignées */
      ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((dir) => {
        const h = document.createElement("span");
        h.className = "sirh-handle";
        h.dataset.d = dir;
        h.contentEditable = "false";
        h.addEventListener("mousedown", (e) =>
          _startResize(e, wrap, img, badge, dir, editor),
        );
        wrap.appendChild(h);
      });

      /* Clic → sélectionner */
      wrap.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("sirh-handle")) return;
        e.stopPropagation();
        _select(wrap, img);
      });
      wrap.addEventListener("pointerdown", (e) => {
        if (e.target.classList.contains("sirh-handle")) return;
        e.stopPropagation();
        _select(wrap, img);
      });
      wrap.addEventListener("click", (e) => {
        e.stopPropagation();
        _select(wrap, img);
      });

      /* Clic droit → menu contextuel */
      wrap.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _select(wrap, img);
        _showCtxMenu(e.clientX, e.clientY, wrap, img);
      });

      return wrap;
    }

    return {
      wrap: wrapImage,
      bind: _bindPlainImage,
      select: _select,
      deselect: _deselect,
      reposition: _reposition,
      setSize: _setImgSize,
      applyAlign: _applyAlign,
      applyWidthPct: _applyWidthPct,
      removeActive: _removeActive,
      get activeWrap() {
        return _activeWrap;
      },
      get activeImg() {
        return _activeImg;
      },
    };
  })();

  /* ──────────────────────────────────────────────────────────
     TABLE RESIZE CURSORS
  ────────────────────────────────────────────────────────── */
  const SirhTableResize = (function () {
    const COL_T = 7,
      ROW_T = 7;
    let _resizing = false;
    function onMove(e) {
      if (_resizing) return;
      if (e.target?.classList?.contains("column-resize-handle")) {
        document.body.classList.add("sirh-col-resize");
        return;
      }
      const td = e.target?.closest?.("td, th");
      if (!td) {
        document.body.classList.remove("sirh-col-resize", "sirh-row-resize");
        return;
      }
      const r = td.getBoundingClientRect();
      const x = e.clientX,
        y = e.clientY;
      if (Math.abs(x - r.right) <= COL_T || Math.abs(x - r.left) <= COL_T) {
        document.body.classList.add("sirh-col-resize");
        document.body.classList.remove("sirh-row-resize");
      } else if (
        Math.abs(y - r.bottom) <= ROW_T ||
        Math.abs(y - r.top) <= ROW_T
      ) {
        document.body.classList.add("sirh-row-resize");
        document.body.classList.remove("sirh-col-resize");
      } else {
        document.body.classList.remove("sirh-col-resize", "sirh-row-resize");
      }
    }
    function onDown(e) {
      if (e.target?.classList?.contains("column-resize-handle")) {
        _resizing = true;
        document.body.classList.add("sirh-col-resize");
        document.addEventListener(
          "mouseup",
          () => {
            _resizing = false;
            document.body.classList.remove("sirh-col-resize");
          },
          { once: true },
        );
      }
    }
    return {
      init() {
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mousedown", onDown);
      },
    };
  })();

  /* ──────────────────────────────────────────────────────────
     PATCH FONCTIONS GLOBALES admin.html
  ────────────────────────────────────────────────────────── */
  function _patchAdminFunctions() {
    global.activateImageResizers = function (ed) {
      if (!ed) return;
      ed.view.dom
        .querySelectorAll("img:not(.ProseMirror-separator)")
        .forEach((img) => {
          SirhImgResize.bind(img, ed);
        });
    };

    global.wrapImgResize = function (img, ed) {
      SirhImgResize.bind(img, ed);
    };
    global.positionImgToolbar = function () {
      SirhImgResize.reposition();
    };
    global.selectImg = function (wrap, img) {
      if (wrap && img) SirhImgResize.select(wrap, img);
    };

    global.setImgAlign = function (btn, align) {
      const wrap = SirhImgResize.activeWrap;
      if (wrap) SirhImgResize.applyAlign(wrap, align);
    };

    global.setImgWidthFixed = function (btn, pct) {
      const wrap = SirhImgResize.activeWrap;
      const img = SirhImgResize.activeImg;
      if (wrap && img) SirhImgResize.applyWidthPct(wrap, img, pct);
    };

    global.removeImgFixed = function () {
      SirhImgResize.removeActive();
    };

    /* _getImgAlign — simple assignation (pas d'Object.defineProperty non-writable) */
    global._getImgAlign = function () {
      const checked = document.querySelector(
        'input[name="img-align-r"]:checked',
      );
      if (checked) return checked.value;
      return document.getElementById("img-align")?.value || "center";
    };

    /* ══════════════════════════════════════════════
       doInsertImage — insertion complète avec taille
       Gère : px, mm, cm, %, pas de taille (natif)
    ══════════════════════════════════════════════ */
    global.doInsertImage = function () {
      const ed = global.__getActiveEditor
        ? global.__getActiveEditor()
        : global.activeEditor || null;
      if (!ed) {
        if (typeof toast === "function") toast("Aucun éditeur actif", "error");
        return;
      }

      const fileInput = document.getElementById("img-file");
      const urlInput = document.getElementById("img-url");
      const wInput = document.getElementById("img-w");
      const hInput = document.getElementById("img-h");
      const capInput = document.getElementById("img-caption");

      const rawW = (wInput?.value || "").trim();
      const rawH = (hInput?.value || "").trim();
      const align =
        typeof global._getImgAlign === "function"
          ? global._getImgAlign()
          : "center";
      const cap = (capInput?.value || "").trim();

      function _resetModal() {
        document.getElementById("modalImage")?.classList.remove("open");
        if (fileInput) fileInput.value = "";
        if (urlInput) urlInput.value = "";
        if (wInput) wInput.value = "";
        if (hInput) hInput.value = "";
        const pa = document.getElementById("img-preview-area");
        if (pa) pa.style.display = "none";
      }

      function _applyDimensions(wrap, img) {
        const containerW = ed.view.dom ? ed.view.dom.offsetWidth : 595;
        const wPx = parseSizeToPixels(rawW, containerW);
        const hPx = parseSizeToPixels(rawH, containerW);
        const widthAsPercent =
          rawW && /^\s*[\d.]+\s*%\s*$/i.test(rawW) && (!rawH || rawH === "");

        function _doSize() {
          const natW = img.naturalWidth || img.offsetWidth || 200;
          const natH = img.naturalHeight || img.offsetHeight || 150;
          const asp = natH > 0 ? natW / natH : 1;
          let fW, fH;

          if (widthAsPercent) {
            SirhImgResize.applyWidthPct(wrap, img, rawW.replace(/\s+/g, ""));
            SirhImgResize.applyAlign(wrap, align);
            SirhImgResize.select(wrap, img);
            return;
          } else if (wPx !== null && hPx !== null) {
            fW = wPx;
            fH = hPx;
          } else if (wPx !== null) {
            fW = wPx;
            fH = wPx / asp;
          } else if (hPx !== null) {
            fH = hPx;
            fW = hPx * asp;
          } else {
            /* Pas de taille : limiter à la largeur du conteneur si l'image est trop grande */
            if (natW > containerW) {
              fW = containerW;
              fH = containerW / asp;
            } else {
              fW = natW;
              fH = natH;
            }
          }

          SirhImgResize.setSize(wrap, img, fW, fH);
          _persistImageNode(wrap, img);
          SirhImgResize.select(wrap, img);
        }

        if (img.complete && img.naturalWidth > 0) {
          _doSize();
        } else {
          img.addEventListener("load", _doSize, { once: true });
          let att = 0;
          const iv = setInterval(() => {
            if (img.naturalWidth > 0 || img.offsetWidth > 0) {
              clearInterval(iv);
              _doSize();
            } else if (++att >= 20) {
              clearInterval(iv);
              _doSize();
            }
          }, 80);
        }

        SirhImgResize.applyAlign(wrap, align);
      }

      function _insertSrc(src) {
        const uid =
          "sirh-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);

        ed.chain()
          .focus()
          .setImage({ src, alt: uid, title: cap || "" })
          .run();

        function _findAndWrap(attempt) {
          const allImgs = ed.view.dom.querySelectorAll(
            "img:not(.ProseMirror-separator)",
          );
          let target = null;

          // 1) D'abord l'image nouvellement insérée via UID (unique)
          for (const img of allImgs) {
            if (img.alt === uid) {
              target = img;
              break;
            }
          }

          // 2) Ensuite, la même source si UID non trouvé
          if (!target) {
            for (const img of allImgs) {
              if (img.src === src || img.getAttribute("src") === src) {
                target = img;
                break;
              }
            }
          }

          // 3) Dernier recours : dernier élément non wrappé
          if (!target && allImgs.length > 0)
            target = allImgs[allImgs.length - 1];

          if (target) {
            SirhImgResize.bind(target, ed);
            const wrap = target;
            if (wrap) _applyDimensions(wrap, target);
            if (cap) target.alt = cap;
            else if (target.alt === uid) target.alt = "";
            if (wrap) _persistImageNode(wrap, target);
          } else if (attempt < 12) {
            setTimeout(() => _findAndWrap(attempt + 1), 80);
          }
        }

        setTimeout(() => _findAndWrap(0), 60);
        _resetModal();
        if (typeof toast === "function") toast("Image insérée", "success");
      }

      if (fileInput?.files[0]) {
        const r = new FileReader();
        r.onload = (ev) => _insertSrc(ev.target.result);
        r.readAsDataURL(fileInput.files[0]);
      } else if (urlInput?.value?.trim()) {
        _insertSrc(urlInput.value.trim());
      } else {
        if (typeof toast === "function")
          toast("Sélectionnez un fichier ou entrez une URL", "error");
      }
    };
    global.__sirhDoInsertImage = global.doInsertImage;
  }

  /* ──────────────────────────────────────────────────────────
     LISTENER GLOBAL
  ────────────────────────────────────────────────────────── */
  function _bindGlobalDeselect() {
    document.addEventListener("mousedown", (e) => {
      if (
        !e.target.closest(".sirh-img-wrap") &&
        !e.target.closest("#sirhImgToolbar") &&
        !e.target.closest("#sirhImgCtxMenu")
      ) {
        SirhImgResize.deselect();
      }
    });
    document.addEventListener("scroll", () => SirhImgResize.reposition(), {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", () => SirhImgResize.reposition());
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  function _init() {
    injectCSS();
    SirhTableResize.init();
    _patchAdminFunctions();
    _bindGlobalDeselect();
    global.SirhImgResize = SirhImgResize;
    global.parseSizeToPixels = parseSizeToPixels;
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", _init);
  else _init();
})(window);
