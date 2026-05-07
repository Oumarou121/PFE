const ESM = "https://esm.sh";
const V = "2.4.0";
document.getElementById("loadSub").textContent =
  "Téléchargement des modules Tiptap...";

const { Extension, Mark } = await import(`${ESM}/@tiptap/core@${V}`);
const [
  { Editor },
  { default: StarterKit },
  { default: TextAlign },
  { default: FontFamily },
  { default: Color },
  { default: TextStyle },
  { default: Highlight },
  { default: Underline },
  { default: Subscript },
  { default: Superscript },
  { default: Link },
  { default: Image },
  { default: Table },
  { default: TableRow },
  { default: TableCell },
  { default: TableHeader },
  { default: Placeholder },
] = await Promise.all([
  import(`${ESM}/@tiptap/core@${V}`),
  import(`${ESM}/@tiptap/starter-kit@${V}`),
  import(`${ESM}/@tiptap/extension-text-align@${V}`),
  import(`${ESM}/@tiptap/extension-font-family@${V}`),
  import(`${ESM}/@tiptap/extension-color@${V}`),
  import(`${ESM}/@tiptap/extension-text-style@${V}`),
  import(`${ESM}/@tiptap/extension-highlight@${V}`),
  import(`${ESM}/@tiptap/extension-underline@${V}`),
  import(`${ESM}/@tiptap/extension-subscript@${V}`),
  import(`${ESM}/@tiptap/extension-superscript@${V}`),
  import(`${ESM}/@tiptap/extension-link@${V}`),
  import(`${ESM}/@tiptap/extension-image@${V}`),
  import(`${ESM}/@tiptap/extension-table@${V}`),
  import(`${ESM}/@tiptap/extension-table-row@${V}`),
  import(`${ESM}/@tiptap/extension-table-cell@${V}`),
  import(`${ESM}/@tiptap/extension-table-header@${V}`),
  import(`${ESM}/@tiptap/extension-placeholder@${V}`),
]);

document.getElementById("loadSub").textContent =
  "Initialisation des éditeurs...";

// -- FontSize extension --
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el) => el.style.fontSize || null,
        renderHTML: (attrs) =>
          attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {},
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize:
        (fs) =>
        ({ chain }) =>
          chain().setMark(this.name, { fontSize: fs }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark(this.name, { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

const WordImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (el) => el.getAttribute("style") || null,
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
      "data-keep-ratio": {
        default: "true",
        parseHTML: (el) => el.getAttribute("data-keep-ratio") || "true",
        renderHTML: (attrs) =>
          attrs["data-keep-ratio"] != null
            ? { "data-keep-ratio": attrs["data-keep-ratio"] }
            : {},
      },
    };
  },
});

// -- TableCell/Header with bg, text color, align --
function _cellStyle(attrs) {
  let s = "";
  if (attrs.backgroundColor && attrs.backgroundColor !== "transparent")
    s += `background-color:${attrs.backgroundColor};`;
  if (attrs.textColor) s += `color:${attrs.textColor};`;
  if (attrs.textAlign) s += `text-align:${attrs.textAlign};`;
  if (attrs.verticalAlign) s += `vertical-align:${attrs.verticalAlign};`;
  return s ? { style: s } : {};
}
const TableCellExt = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => _cellStyle(attrs),
      },
      textColor: {
        default: null,
        parseHTML: (el) => el.style.color || null,
        renderHTML: () => ({}),
      },
      textAlign: {
        default: null,
        parseHTML: (el) => el.style.textAlign || null,
        renderHTML: () => ({}),
      },
      verticalAlign: {
        default: null,
        parseHTML: (el) => el.style.verticalAlign || null,
        renderHTML: () => ({}),
      },
    };
  },
});
const TableHeaderExt = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => _cellStyle(attrs),
      },
      textColor: {
        default: null,
        parseHTML: (el) => el.style.color || null,
        renderHTML: () => ({}),
      },
      textAlign: {
        default: null,
        parseHTML: (el) => el.style.textAlign || null,
        renderHTML: () => ({}),
      },
      verticalAlign: {
        default: null,
        parseHTML: (el) => el.style.verticalAlign || null,
        renderHTML: () => ({}),
      },
    };
  },
});

function _getEditorTableFrameWidth(ed) {
  const root = ed?.view?.dom;
  if (!root) return 0;
  const styles = window.getComputedStyle(root);
  const padX =
    (parseFloat(styles.paddingLeft) || 0) +
    (parseFloat(styles.paddingRight) || 0);
  const width = root.clientWidth || root.getBoundingClientRect().width || 0;
  return Math.max(1, Math.floor(width - padX - 2));
}

function _countTableColumns(tableNode) {
  let maxCols = 0;
  tableNode?.forEach((rowNode) => {
    let cols = 0;
    rowNode.forEach((cellNode) => {
      cols += Math.max(1, cellNode.attrs?.colspan || 1);
    });
    maxCols = Math.max(maxCols, cols);
  });
  return maxCols;
}

function _distributeTableWidths(totalWidth, colCount) {
  const safeCols = Math.max(1, colCount || 1);
  const safeWidth = Math.max(safeCols, Math.floor(totalWidth) || safeCols);
  const base = Math.floor(safeWidth / safeCols);
  let remainder = safeWidth - base * safeCols;
  return Array.from({ length: safeCols }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    return base + extra;
  });
}

function _readTableWidths(tableNode, colCount) {
  const firstRow = tableNode?.firstChild;
  if (!firstRow) return null;
  const widths = [];
  let colIndex = 0;
  firstRow.forEach((cellNode) => {
    const colspan = Math.max(1, cellNode.attrs?.colspan || 1);
    const colwidth = Array.isArray(cellNode.attrs?.colwidth)
      ? cellNode.attrs.colwidth
      : [];
    for (let i = 0; i < colspan && colIndex < colCount; i++, colIndex++) {
      const width = Number(colwidth[i]);
      widths[colIndex] = Number.isFinite(width) && width > 0 ? width : null;
    }
  });
  return widths.some((width) => Number.isFinite(width) && width > 0)
    ? widths
    : null;
}

function _scaleTableWidths(widths, targetWidth) {
  const clean = widths.map((width) =>
    Number.isFinite(width) && width > 0 ? width : 0,
  );
  const total = clean.reduce((sum, width) => sum + width, 0);
  if (!total || targetWidth <= 0) return null;
  const scaled = clean.map((width) =>
    Math.max(1, Math.floor((width * targetWidth) / total)),
  );
  let delta = targetWidth - scaled.reduce((sum, width) => sum + width, 0);
  let index = 0;
  while (delta !== 0 && scaled.length) {
    const step = delta > 0 ? 1 : -1;
    const next = scaled[index] + step;
    if (next >= 1) {
      scaled[index] = next;
      delta -= step;
    }
    index = (index + 1) % scaled.length;
  }
  return scaled;
}

function _sameColwidths(prev, next) {
  if (!Array.isArray(prev) || prev.length !== next.length) return false;
  return prev.every((width, idx) => Number(width) === Number(next[idx]));
}

function _resolveTableWidths(ed, tableNode, tablePos, mode) {
  const colCount = _countTableColumns(tableNode);
  if (!colCount) return null;
  const frameWidth = _getEditorTableFrameWidth(ed);
  if (!frameWidth) return null;
  const equalized = _distributeTableWidths(frameWidth, colCount);
  if (mode === "equalize") return equalized;

  const current = _readTableWidths(tableNode, colCount);
  const hasCompleteCurrent =
    Array.isArray(current) &&
    current.length === colCount &&
    current.every((width) => Number.isFinite(width) && width > 0);
  const currentTotal = hasCompleteCurrent
    ? current.reduce((sum, width) => sum + width, 0)
    : 0;
  let measuredWidth = currentTotal;
  try {
    const tableEl = ed.view.nodeDOM(tablePos);
    if (tableEl?.nodeType === 1) {
      measuredWidth = Math.max(
        measuredWidth,
        Math.ceil(tableEl.scrollWidth || 0),
        Math.ceil(tableEl.getBoundingClientRect().width || 0),
      );
    }
  } catch (_) {}

  if (measuredWidth <= frameWidth + 1) return null;
  if (!hasCompleteCurrent || currentTotal <= 0) return equalized;
  return _scaleTableWidths(current, frameWidth);
}

function _autoFitEditorTables(ed, mode = "clamp", scope = "all") {
  if (!ed?.view) return false;
  const tables = [];
  if (scope === "active") {
    const { $from } = ed.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "table") {
        tables.push({ tableNode: node, tablePos: $from.before(depth) });
        break;
      }
    }
  } else {
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === "table")
        tables.push({ tableNode: node, tablePos: pos });
    });
  }
  if (!tables.length) return false;

  const tr = ed.state.tr;
  let changed = false;
  tables.forEach(({ tableNode, tablePos }) => {
    const widths = _resolveTableWidths(ed, tableNode, tablePos, mode);
    if (!widths?.length) return;
    tableNode.forEach((rowNode, rowOffset) => {
      let colIndex = 0;
      rowNode.forEach((cellNode, cellOffset) => {
        const colspan = Math.max(1, cellNode.attrs?.colspan || 1);
        const colwidth = widths.slice(colIndex, colIndex + colspan);
        while (colwidth.length < colspan) {
          colwidth.push(widths[widths.length - 1] || 1);
        }
        if (!_sameColwidths(cellNode.attrs?.colwidth, colwidth)) {
          tr.setNodeMarkup(
            tablePos + 1 + rowOffset + 1 + cellOffset,
            undefined,
            {
              ...cellNode.attrs,
              colwidth,
            },
          );
          changed = true;
        }
        colIndex += colspan;
      });
    });
  });
  if (!changed) return false;
  ed.view.dispatch(tr);
  return true;
}

function _scheduleTableAutoFit(ed, mode = "clamp", scope = "all") {
  if (!ed) return;
  const nextMode = mode === "equalize" ? "equalize" : "clamp";
  const nextScope = scope === "active" ? "active" : "all";
  ed.__tableAutoFitMode =
    ed.__tableAutoFitMode === "equalize" || nextMode === "equalize"
      ? "equalize"
      : "clamp";
  ed.__tableAutoFitScope =
    ed.__tableAutoFitScope === "all" || nextScope === "all" ? "all" : "active";
  if (ed.__tableAutoFitFrame) return;
  ed.__tableAutoFitFrame = requestAnimationFrame(() => {
    const pendingMode = ed.__tableAutoFitMode || "clamp";
    const pendingScope = ed.__tableAutoFitScope || "all";
    ed.__tableAutoFitFrame = null;
    ed.__tableAutoFitMode = null;
    ed.__tableAutoFitScope = null;
    _autoFitEditorTables(ed, pendingMode, pendingScope);
  });
}

// ═══════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════
const DEFAULT_ORG_ID = "org_1";
function getActiveOrganizationId() {
  const authUser = getCurrentAuthUser();
  const authOrganizationId =
    authUser?.organizationId === undefined || authUser?.organizationId === null
      ? null
      : String(authUser.organizationId);
  if (authOrganizationId && DB.getOrganization(authOrganizationId))
    return authOrganizationId;
  if (DB.getOrganization(DEFAULT_ORG_ID)) return DEFAULT_ORG_ID;
  const firstId = DB.getOrganizations()[0]?.id || null;
  if (firstId) return firstId;
  const created = DB.saveOrganization({
    id: DEFAULT_ORG_ID,
    nom: "Organization principale",
    ville: "",
    adresse: "",
    tel: "",
    graphicCharters: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return created?.id || DEFAULT_ORG_ID;
}
let curFamId = null,
  curTplId = null,
  pendingDelId = null;
let editingGraphicCharterId = null;
let editorHeader = null,
  editorBody = null,
  editorFooter = null;
let gcEditorHeader = null,
  gcEditorFooter = null;
let activeEditor = null;
let zoomLv = 100;
let headerEnabled = false,
  footerEnabled = false;
let currentAdminSection = "body";
let currentSectionDirections = normalizeTemplateSectionDirections({});
let currentVarPanelType = "simple";
let varsPanelVisible = false;
let _activeResizeImg = null,
  _activeResizeImgEl = null;
let pageGuideRaf = 0;
let adminPreviewState = null;
let adminResolvedFilters = [];
let adminFilterValues = {};

window.insertVar = function (tech) {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  ed.chain().focus().insertContent(`{{${tech}}}`).run();
};

window.__getActiveEditor = () => activeEditor || editorBody;

function promptListObjectColumns(varDef) {
  return new Promise((resolve) => {
    const existing = document.getElementById("_sirh_tableColsModal");
    if (existing) existing.remove();
    const cols =
      Array.isArray(varDef?.columns) && varDef.columns.length
        ? varDef.columns
        : [];
    if (!cols.length) {
      resolve([]);
      return;
    }
    let workingCols = cols.map((col) => ({ ...col, checked: true }));
    const ov = document.createElement("div");
    ov.id = "_sirh_tableColsModal";
    ov.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:'IBM Plex Sans','Inter',sans-serif";
    ov.innerHTML = `
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;width:92%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.22)">
              <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px">Colonnes du tableau</div>
              <div style="font-size:12px;color:#64748b;margin-bottom:16px;line-height:1.55">Choisissez les colonnes à afficher et réorganisez leur ordre pour <strong>${escHtml(
                varDef.label || varDef.tech || "ce tableau",
              )}</strong>.</div>
              <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
                <button type="button" id="_sirh_cols_all" class="btn sm">Tout cocher</button>
                <button type="button" id="_sirh_cols_none" class="btn sm">Tout décocher</button>
              </div>
              <div id="_sirh_cols_list" style="display:grid;gap:8px;max-height:280px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fafafa"></div>
              <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
                <button type="button" id="_sirh_cols_cancel" class="btn">Annuler</button>
                <button type="button" id="_sirh_cols_ok" class="btn primary">Insérer</button>
              </div>
            </div>`;
    const list = ov.querySelector("#_sirh_cols_list");
    const renderList = () => {
      list.innerHTML = workingCols
        .map(
          (
            col,
            index,
          ) => `<div style="display:flex;gap:10px;align-items:center;font-size:12px;color:#1f2937;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px">
                  <input type="checkbox" data-col-check="${escAttr(
                    col.key,
                  )}" ${col.checked ? "checked" : ""}>
                  <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">
                    <span>${escHtml(col.label || col.key)}</span>
                    <span style="color:#94a3b8;font-family:monospace">${escHtml(
                      col.key,
                    )}</span>
                  </div>
                  <div style="display:flex;gap:4px">
                    <button type="button" class="col-pill-btn" data-move-up="${escAttr(
                      col.key,
                    )}" ${index === 0 ? "disabled" : ""}>&uarr;</button>
                    <button type="button" class="col-pill-btn" data-move-down="${escAttr(
                      col.key,
                    )}" ${index === workingCols.length - 1 ? "disabled" : ""}>&darr;</button>
                  </div>
                </div>`,
        )
        .join("");
      list.querySelectorAll("input[data-col-check]").forEach((input) => {
        input.onchange = () => {
          workingCols = workingCols.map((col) =>
            col.key === input.dataset.colCheck
              ? { ...col, checked: input.checked }
              : col,
          );
        };
      });
      list.querySelectorAll("button[data-move-up]").forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.moveUp;
          const idx = workingCols.findIndex((col) => col.key === key);
          if (idx <= 0) return;
          [workingCols[idx - 1], workingCols[idx]] = [
            workingCols[idx],
            workingCols[idx - 1],
          ];
          renderList();
        };
      });
      list.querySelectorAll("button[data-move-down]").forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.moveDown;
          const idx = workingCols.findIndex((col) => col.key === key);
          if (idx < 0 || idx >= workingCols.length - 1) return;
          [workingCols[idx], workingCols[idx + 1]] = [
            workingCols[idx + 1],
            workingCols[idx],
          ];
          renderList();
        };
      });
    };
    renderList();
    ov.querySelector("#_sirh_cols_all").onclick = () => {
      workingCols = workingCols.map((col) => ({ ...col, checked: true }));
      renderList();
    };
    ov.querySelector("#_sirh_cols_none").onclick = () => {
      workingCols = workingCols.map((col) => ({
        ...col,
        checked: false,
      }));
      renderList();
    };
    ov.querySelector("#_sirh_cols_cancel").onclick = () => {
      ov.remove();
      resolve(null);
    };
    ov.querySelector("#_sirh_cols_ok").onclick = () => {
      const selected = workingCols
        .filter((col) => col.checked)
        .map((col) => col.key);
      ov.remove();
      resolve(selected);
    };
    document.body.appendChild(ov);
  });
}

// -- insertListVar --
async function insertListVar(editor, varDef) {
  if (!editor || !varDef) return;
  const inCell = editor.isActive("tableCell") || editor.isActive("tableHeader");

  if (varDef.type === "list-object") {
    const selectedColumns = await promptListObjectColumns(varDef);
    if (selectedColumns === null) return;
    const columnSuffix =
      selectedColumns && selectedColumns.length
        ? `:${selectedColumns.join(",")}`
        : "";
    const tableMarker = `{{#${varDef.tech}:table${columnSuffix}}}`;
    if (inCell) {
      editor.chain().focus().insertContent(tableMarker).run();
      toast(
        "Marqueur :table inséré  - la ligne sera répétée par objet",
        "success",
      );
      return;
    }
    const cols =
      varDef.columns && varDef.columns.length
        ? varDef.columns
        : [
            { key: "col1", label: "Colonne 1" },
            { key: "col2", label: "Colonne 2" },
          ];
    const filteredCols =
      selectedColumns && selectedColumns.length
        ? cols.filter((col) => selectedColumns.includes(col.key))
        : cols;
    const thCells = filteredCols
      .map(
        (c) =>
          `<th style="font-weight:700;color:#111;background:#f2f2f2"><p><strong>${escHtml(c.label)}</strong></p></th>`,
      )
      .join("");
    const tdCells = filteredCols
      .map((c, i) => {
        const marker =
          i === 0
            ? `<span style="color:#f97316;background:#fff7ed;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:10px">${escHtml(
                tableMarker,
              )}</span>`
            : `<span style="color:#f97316;opacity:.55;font-family:monospace;font-size:9px">{{${c.key}}}</span>`;
        return `<td><p>${marker}</p></td>`;
      })
      .join("");
    const tableHTML = `<table style="border-collapse:collapse;width:100%"><thead><tr>${thCells}</tr></thead><tbody><tr>${tdCells}</tr></tbody></table><p></p>`;
    editor.chain().focus().insertContent(tableHTML).run();
    toast(
      `Tableau éditable inséré pour  - ${varDef.label}  -  - personnalisez le style !`,
      "success",
    );
    return;
  }

  if (inCell) {
    editor
      .chain()
      .focus()
      .insertContent(`{{#${varDef.tech}:cell-expand}}`)
      .run();
    toast("Liste insérée  - 1 ligne par élément dans le tableau", "success");
  } else {
    const mode = await _promptListMode(varDef.tech, varDef.label);
    if (!mode) return;
    editor.chain().focus().insertContent(`{{#${varDef.tech}:${mode}}}`).run();
    toast(`Liste insérée en mode ${mode}`, "success");
  }
}

// -- buildVarsPanel --
let lastOrganizationVarsRefreshAt = 0;

async function refreshOrganizationVarsSettings(force = false) {
  const now = Date.now();
  if (!force && now - lastOrganizationVarsRefreshAt < 2000) return;
  lastOrganizationVarsRefreshAt = now;
  await DB.init(true);
  buildVarsPanel(curFamId);
}

function getVarBucket(type) {
  if (type === "list-object") return "table";
  if (type === "list") return "list";
  return "simple";
}

function renderVariableChip(chips, cls, v) {
  const chip = document.createElement("span");
  const isObj = v.type === "list-object";
  const isList = v.type === "list";
  chip.className =
    "vchip" + (isObj ? " is-table" : "") + (isList ? " is-list" : "");
  chip.style.cssText = [
    `background:${cls.couleur || "#555"}12`,
    `color:${cls.couleur || "#555"}`,
    `border-color:${cls.couleur || "#555"}33`,
  ].join(";");
  if (isObj) {
    const colsPreview =
      v.columns && v.columns.length
        ? v.columns.map((c) => c.label).join("  - ")
        : "colonnes auto-détectées";
    chip.innerHTML = `<span class="vchip-badge tbl">TABLE</span>${v.label}`;
    chip.title = `Insère un tableau éditable Tiptap\nColonnes : ${colsPreview}`;
    chip.onclick = () => {
      const ed = activeEditor || editorBody;
      if (!ed) {
        toast("Ouvrez un template d'abord", "error");
        return;
      }
      insertListVar(ed, v);
    };
    return chips.appendChild(chip);
  }
  if (isList) {
    chip.innerHTML = `<span class="vchip-badge">LIST</span>${v.label}`;
    chip.title = `{{#${v.tech}:ul}}  - :inline  - :cell-expand`;
    chip.onclick = () => {
      const ed = activeEditor || editorBody;
      if (!ed) {
        toast("Ouvrez un template d'abord", "error");
        return;
      }
      insertListVar(ed, v);
    };
    return chips.appendChild(chip);
  }
  chip.textContent = v.label;
  chip.title = `{{${v.tech}}}  - ${v.label}`;
  chip.onclick = () => window.insertVar(v.tech);
  chips.appendChild(chip);
}

window.switchVarPanelType = function (type) {
  currentVarPanelType = type;
  buildVarsPanel(curFamId);
};

function updateVarsPanelVisibility() {
  const panel = document.getElementById("varsSidepanel");
  const dockBtn = document.getElementById("varsToggleBtn");
  const topBtn = document.getElementById("varsTopToggleBtn");
  if (panel) panel.classList.toggle("hidden", !varsPanelVisible);
  if (dockBtn) {
    dockBtn.innerHTML = varsPanelVisible
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="15" y1="4" x2="15" y2="20"></line>
              </svg>
              Masquer`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="9" y1="4" x2="9" y2="20"></line>
              </svg>
              Afficher`;
    dockBtn.title = varsPanelVisible
      ? "Masquer le panneau de variables"
      : "Afficher le panneau de variables";
  }
  if (topBtn) {
    topBtn.innerHTML = varsPanelVisible
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="15" y1="4" x2="15" y2="20"></line>
              </svg>
              Variables ON`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="15" y1="4" x2="15" y2="20"></line>
              </svg>
              Variables`;
    topBtn.title = varsPanelVisible
      ? "Masquer le panneau de variables"
      : "Afficher le panneau de variables";
  }
}

window.toggleVarsPanel = function () {
  varsPanelVisible = !varsPanelVisible;
  updateVarsPanelVisibility();
  if (varsPanelVisible) {
    refreshOrganizationVarsSettings(true).catch(() => {});
  }
};

function buildVarsPanel(famId) {
  const panel = document.getElementById("varsPanelEl");
  const tabs = document.getElementById("varsTypeTabs");
  if (!panel || !tabs) return;

  panel.innerHTML = "";
  tabs.innerHTML = "";

  const panelTypes = [
    { id: "simple", label: "Simple" },
    { id: "list", label: "Liste" },
    { id: "table", label: "Table" },
  ];

  if (!famId) {
    panel.innerHTML =
      '<div class="vars-panel-empty">Choisissez une famille pour afficher les variables.</div>';
    return;
  }

  const fam = DB.getFamily(famId);
  if (!fam) {
    panel.innerHTML =
      '<div class="vars-panel-empty">Impossible de charger les variables de cette famille.</div>';
    return;
  }

  const counts = { simple: 0, list: 0, table: 0 };
  fam.classes.forEach((cls) => {
    (cls.vars || []).forEach((v) => {
      counts[getVarBucket(v.type)] += 1;
    });
  });
  const etab = DB.getOrganization(getActiveOrganizationId());
  const orgVars = Object.entries(
    buildVisibleOrganizationTemplateVars(etab),
  ).filter(([key]) => !key.startsWith("org_"));
  const hasSimpleContent = counts.simple > 0 || orgVars.length > 0;

  if (!panelTypes.some((item) => item.id === currentVarPanelType)) {
    currentVarPanelType = "simple";
  }
  if (
    (currentVarPanelType === "simple" && !hasSimpleContent) ||
    (currentVarPanelType !== "simple" && !counts[currentVarPanelType])
  ) {
    currentVarPanelType =
      panelTypes.find((item) =>
        item.id === "simple" ? hasSimpleContent : counts[item.id] > 0,
      )?.id || "simple";
  }

  panelTypes.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "vars-panel-tab" + (currentVarPanelType === item.id ? " on" : "");
    btn.textContent = `${item.label} (${counts[item.id] || 0})`;
    btn.onclick = () => window.switchVarPanelType(item.id);
    tabs.appendChild(btn);
  });

  let rendered = 0;
  if (currentVarPanelType === "simple") {
    if (orgVars.length) {
      const sec = document.createElement("section");
      sec.className = "vars-panel-group";
      sec.innerHTML =
        '<div class="vars-panel-group-title">Variables Organization</div>';
      const chips = document.createElement("div");
      chips.className = "vchips";
      orgVars.forEach(([key]) => {
        const chip = document.createElement("span");
        chip.className = "vchip";
        chip.style.cssText =
          "background:#0f766e12;color:#0f766e;border-color:#0f766e33";
        const displayLabel = getOrganizationVariableDisplayLabel(key, key);
        chip.textContent = displayLabel;
        chip.title = `{{${key}}} — ${displayLabel}`;
        chip.onclick = () => window.insertVar(key);
        chips.appendChild(chip);
      });
      sec.appendChild(chips);
      panel.appendChild(sec);
      rendered += orgVars.length;
    }
  }
  fam.classes.forEach((cls) => {
    const vars = (cls.vars || []).filter(
      (v) => getVarBucket(v.type) === currentVarPanelType,
    );
    if (!vars.length) return;

    const card = document.createElement("section");
    card.className = "var-group-card";

    const top = document.createElement("div");
    top.className = "var-group-topline";

    const hdr = document.createElement("div");
    hdr.className = "vc-hdr";
    hdr.style.color = cls.couleur || "#555";
    hdr.textContent = cls.nom;

    const count = document.createElement("div");
    count.className = "var-group-count";
    count.textContent = `${vars.length} variable${vars.length > 1 ? "s" : ""}`;

    top.appendChild(hdr);
    top.appendChild(count);
    card.appendChild(top);

    const chips = document.createElement("div");
    chips.className = "vchips";
    vars.forEach((v) => renderVariableChip(chips, cls, v));
    card.appendChild(chips);

    panel.appendChild(card);
    rendered += vars.length;
  });

  if (!rendered) {
    const labels = {
      simple: "simples",
      list: "de liste",
      table: "de tableau",
    };
    panel.innerHTML = `<div class="vars-panel-empty">Aucune variable ${labels[currentVarPanelType]} dans cette famille.</div>`;
  }
}

// -- Color palettes --
const TEXT_COLORS = [
  "#000000",
  "#1a1d2e",
  "#374151",
  "#6b7280",
  "#9ca3af",
  "#d1d5db",
  "#dc2626",
  "#ea580c",
  "#d97706",
  "#16a34a",
  "#0284c7",
  "#7c3aed",
  "#db2777",
  "#ffffff",
  "#fef9c3",
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#f3e8ff",
  "#ffedd5",
  "#fee2e2",
  "#e0f2fe",
];
const BG_COLORS = [
  "transparent",
  "#fef9c3",
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#f3e8ff",
  "#ffedd5",
  "#fee2e2",
  "#e0f2fe",
  "#f0fdf4",
  "#fdf4ff",
  "#fff1f2",
  "#1e293b",
  "#1d4ed8",
  "#15803d",
  "#7e22ce",
  "#9f1239",
  "#c2410c",
];
const CELL_COLORS = [
  "transparent",
  "#ffffff",
  "#f8fafc",
  "#dbeafe",
  "#dcfce7",
  "#fef9c3",
  "#fee2e2",
  "#fce7f3",
  "#f3e8ff",
  "#ffedd5",
  "#e0f2fe",
  "#f0fdf4",
  "#1e3a5f",
  "#1d4ed8",
  "#15803d",
  "#7c2d12",
  "#7c3aed",
  "#9f1239",
  "#374151",
  "#111827",
  "#0c4a6e",
  "#064e3b",
];
const CELL_TXT = [
  "#111111",
  "#ffffff",
  "#1d4ed8",
  "#15803d",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#374151",
  "#6b7280",
  "#e11d48",
  "#0369a1",
  "#166534",
  "#92400e",
  "#6d28d9",
  "#be123c",
  "#047857",
  "#1e3a5f",
];

// -- TIPTAP FACTORY --
function buildGcMiniToolbar(tbId, getEd) {
  const tb = document.getElementById(tbId);
  if (!tb) return;
  tb.innerHTML = "";

  function mkBtn(tip, html, cmd) {
    const b = document.createElement("button");
    b.className = "tb-btn";
    b.dataset.tip = tip;
    b.innerHTML = html;
    b.type = "button";
    b.onclick = (e) => {
      e.preventDefault();
      const ed = getEd();
      if (ed) ed.chain().focus()[cmd]().run();
    };
    return b;
  }

  const grp0 = document.createElement("div");
  grp0.className = "tb-grp";
  const fontSel = document.createElement("select");
  fontSel.className = "tb-sel";
  fontSel.style.minWidth = "100px";
  [
    ["", "— Police —"],
    ["Arial,Helvetica,sans-serif", "Arial"],
    ["'Times New Roman',Times,serif", "Times New Roman"],
    ["Georgia,serif", "Georgia"],
    ["Amiri,serif", "Amiri"],
    ["Cairo,sans-serif", "Cairo"],
  ].forEach(([v, l]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    fontSel.appendChild(o);
  });
  fontSel.onchange = () => {
    const ed = getEd();
    if (ed && fontSel.value)
      ed.chain().focus().setFontFamily(fontSel.value).run();
  };
  grp0.appendChild(fontSel);

  const szSel = document.createElement("select");
  szSel.className = "tb-sel";
  szSel.style.minWidth = "54px";
  [
    ["", "pt"],
    ["8pt", "8"],
    ["9pt", "9"],
    ["10pt", "10"],
    ["11pt", "11"],
    ["12pt", "12"],
    ["14pt", "14"],
    ["16pt", "16"],
    ["18pt", "18"],
    ["20pt", "20"],
    ["24pt", "24"],
  ].forEach(([v, l]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    szSel.appendChild(o);
  });
  szSel.onchange = () => {
    const ed = getEd();
    if (ed && szSel.value) {
      try {
        ed.chain().focus().setFontSize(szSel.value).run();
      } catch (_) {}
    }
  };
  grp0.appendChild(szSel);
  tb.appendChild(grp0);

  const grp1 = document.createElement("div");
  grp1.className = "tb-grp";
  grp1.appendChild(
    mkBtn(
      "Gras",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 010 8H6z"/><path d="M6 12h9a4 4 0 010 8H6z"/></svg>',
      "toggleBold",
    ),
  );
  grp1.appendChild(
    mkBtn(
      "Italique",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
      "toggleItalic",
    ),
  );
  grp1.appendChild(
    mkBtn(
      "Souligné",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v7a6 6 0 0012 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
      "toggleUnderline",
    ),
  );
  tb.appendChild(grp1);

  const grp2 = document.createElement("div");
  grp2.className = "tb-grp";
  [
    [
      "Gauche",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>',
      "left",
    ],
    [
      "Centre",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
      "center",
    ],
    [
      "Droite",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>',
      "right",
    ],
  ].forEach(([tip, svg, dir]) => {
    const b = document.createElement("button");
    b.className = "tb-btn";
    b.dataset.tip = tip;
    b.innerHTML = svg;
    b.type = "button";
    b.onclick = (e) => {
      e.preventDefault();
      const ed = getEd();
      if (ed) ed.chain().focus().setTextAlign(dir).run();
    };
    grp2.appendChild(b);
  });
  tb.appendChild(grp2);

  const grp3 = document.createElement("div");
  grp3.className = "tb-grp";
  const clrInp = document.createElement("input");
  clrInp.type = "color";
  clrInp.value = "#000000";
  clrInp.title = "Couleur du texte";
  clrInp.style.cssText =
    "width:26px;height:26px;border:1px solid var(--border);border-radius:3px;cursor:pointer;padding:1px;background:transparent";
  clrInp.onchange = () => {
    const ed = getEd();
    if (ed) ed.chain().focus().setColor(clrInp.value).run();
  };
  grp3.appendChild(clrInp);

  const imgBtn = document.createElement("button");
  imgBtn.className = "tb-btn";
  imgBtn.title = "Image";
  imgBtn.type = "button";
  imgBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  imgBtn.onclick = (e) => {
    e.preventDefault();
    const fi = document.createElement("input");
    fi.type = "file";
    fi.accept = "image/*";
    fi.onchange = () => {
      const f = fi.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        const ed = getEd();
        if (ed) ed.chain().focus().setImage({ src: ev.target.result }).run();
      };
      r.readAsDataURL(f);
    };
    fi.click();
  };
  grp3.appendChild(imgBtn);

  const varBtn = document.createElement("button");
  varBtn.className = "tb-btn";
  varBtn.title = "Insérer une variable";
  varBtn.type = "button";
  varBtn.innerHTML =
    '<span style="font-size:10px;font-weight:700">{{x}}</span>';
  varBtn.onclick = (e) => {
    e.preventDefault();
    showGcVarPicker(getEd, varBtn);
  };
  grp3.appendChild(varBtn);

  tb.appendChild(grp3);
}

function createEditor(elementId, placeholder, onUpdate, onFocus) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  el.innerHTML = "";
  const div = document.createElement("div");
  el.appendChild(div);
  const editor = new Editor({
    element: div,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      FontSize,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Underline,
      Subscript,
      Superscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      WordImage.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCellExt,
      TableHeaderExt,
      Placeholder.configure({
        placeholder: placeholder || "Rédigez ici...",
      }),
    ],
    content: "",
    onCreate: ({ editor }) => {
      _scheduleTableAutoFit(editor, "clamp", "all");
    },
    onUpdate: () => {
      if (onUpdate) onUpdate();
      setTimeout(() => activateImageResizers(editor), 60);
      _scheduleTableAutoFit(editor, "clamp", "all");
      scheduleEditorPaginationRefresh();
    },
    onFocus: () => {
      if (onFocus) onFocus(editor);
      scheduleEditorPaginationRefresh();
    },
    onSelectionUpdate: () => {
      if (activeEditor === editor) {
        syncToolbar();
        positionTblToolbar();
      }
      scheduleEditorPaginationRefresh();
    },
  });
  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showCtxMenu(e);
  });
  return editor;
}

function getEditorHTML(ed) {
  const html = ed ? ed.getHTML() : "";
  return typeof _stripVariableMarkerStylesHtml === "function"
    ? _stripVariableMarkerStylesHtml(html)
    : html;
}
function setEditorHTML(ed, html) {
  if (ed && html) ed.commands.setContent(html, false);
}

function getCurrentSectionKey() {
  return currentAdminSection === "header" || currentAdminSection === "footer"
    ? currentAdminSection
    : "body";
}

function applyDirectionToEditor(editor, dir) {
  if (!editor?.view?.dom) return;
  const safeDir = normalizeTemplateDirection(dir, "ltr");
  const align = safeDir === "rtl" ? "right" : "left";
  editor.view.dom.style.direction = safeDir;
  editor.view.dom.style.textAlign = align;
  editor.view.dom.setAttribute("dir", safeDir);
}

function applyCurrentSectionDirectionUI(section = getCurrentSectionKey()) {
  const safeSection =
    section === "header" || section === "footer" ? section : "body";
  const dir = currentSectionDirections?.[safeSection] || "ltr";
  document.getElementById("tb-ltr")?.classList.toggle("on", dir === "ltr");
  document.getElementById("tb-rtl")?.classList.toggle("on", dir === "rtl");
  const sbDir = document.getElementById("sbDir");
  if (sbDir) sbDir.textContent = dir.toUpperCase();
}

function syncEditorsDirectionFromTemplate(tpl) {
  currentSectionDirections = normalizeTemplateSectionDirections(
    tpl?.sectionDirections || {},
  );
  applyDirectionToEditor(editorHeader, currentSectionDirections.header);
  applyDirectionToEditor(editorBody, currentSectionDirections.body);
  applyDirectionToEditor(editorFooter, currentSectionDirections.footer);
  applyCurrentSectionDirectionUI(getCurrentSectionKey());
}

function persistCurrentSectionDirections() {
  if (!curTplId) return;
  const tpl = DB.getTemplate(curTplId);
  if (!tpl) return;
  tpl.sectionDirections = normalizeTemplateSectionDirections(
    currentSectionDirections,
  );
  tpl.updatedAt = new Date().toISOString();
  DB.saveTemplate(tpl);
  renderTplList(curFamId);
}

function normalizePageMargins(pageMargins) {
  const src = pageMargins || {};
  const toNum = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    mt: toNum(src.mt, 20),
    mb: toNum(src.mb, 20),
    ml: toNum(src.ml, 25),
    mr: toNum(src.mr, 25),
  };
}

function normalizeHeaderFooterDistances(distances) {
  const src = distances || {};
  const toNum = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    headerTop: toNum(src.headerTop, 5),
    footerBottom: toNum(src.footerBottom, 5),
  };
}

function applyPageMarginsToUI(pageMargins) {
  const margins = normalizePageMargins(pageMargins);
  const distances = normalizeHeaderFooterDistances(
    curTplId ? DB.getTemplate(curTplId)?.headerFooterDistances : null,
  );
  document.documentElement.style.setProperty("--page-mt", `${margins.mt}mm`);
  document.documentElement.style.setProperty("--page-mb", `${margins.mb}mm`);
  document.documentElement.style.setProperty("--page-ml", `${margins.ml}mm`);
  document.documentElement.style.setProperty("--page-mr", `${margins.mr}mm`);
  document.documentElement.style.setProperty(
    "--page-header-top",
    `${distances.headerTop}mm`,
  );
  document.documentElement.style.setProperty(
    "--page-footer-bottom",
    `${distances.footerBottom}mm`,
  );
  document.getElementById("pg-mt").value = margins.mt;
  document.getElementById("pg-mb").value = margins.mb;
  document.getElementById("pg-ml").value = margins.ml;
  document.getElementById("pg-mr").value = margins.mr;
  return margins;
}

function applyHeaderFooterDistancesToUI(distances) {
  const normalized = normalizeHeaderFooterDistances(distances);
  document.documentElement.style.setProperty(
    "--page-header-top",
    `${normalized.headerTop}mm`,
  );
  document.documentElement.style.setProperty(
    "--page-footer-bottom",
    `${normalized.footerBottom}mm`,
  );
  const headerInput = document.getElementById("pg-header-top");
  const footerInput = document.getElementById("pg-footer-bottom");
  if (headerInput) headerInput.value = normalized.headerTop;
  if (footerInput) footerInput.value = normalized.footerBottom;
  return normalized;
}

function getCurrentPageMargins() {
  return normalizePageMargins({
    mt: document.getElementById("pg-mt")?.value,
    mb: document.getElementById("pg-mb")?.value,
    ml: document.getElementById("pg-ml")?.value,
    mr: document.getElementById("pg-mr")?.value,
  });
}

function getCurrentHeaderFooterDistances() {
  return normalizeHeaderFooterDistances({
    headerTop: document.getElementById("pg-header-top")?.value,
    footerBottom: document.getElementById("pg-footer-bottom")?.value,
  });
}

function getGraphicCharterHeaderFooterDisplay() {
  return {
    headerDisplay: normalizeTemplateSectionDisplay(
      document.getElementById("gc-header-display")?.value || "all",
    ),
    footerDisplay: normalizeTemplateSectionDisplay(
      document.getElementById("gc-footer-display")?.value || "all",
    ),
  };
}

function applyGraphicCharterHeaderFooterDisplayToUI(source) {
  const headerSelect = document.getElementById("gc-header-display");
  const footerSelect = document.getElementById("gc-footer-display");
  if (headerSelect) {
    headerSelect.value = normalizeTemplateSectionDisplay(
      source?.headerDisplay || source?.header?.displayMode,
    );
  }
  if (footerSelect) {
    footerSelect.value = normalizeTemplateSectionDisplay(
      source?.footerDisplay || source?.footer?.displayMode,
    );
  }
}

window.getGraphicCharterBackgroundSource = function () {
  return (
    document.getElementById("gc-bg-data")?.value?.trim() ||
    document.getElementById("gc-bg-url")?.value?.trim() ||
    ""
  );
};

window.applyGraphicCharterBackgroundToUI = function (pageBackground) {
  const bg = normalizePageBackground(pageBackground);
  const isDataUrl = bg.image.startsWith("data:");
  const enabled = document.getElementById("gc-bg-enabled");
  const url = document.getElementById("gc-bg-url");
  const data = document.getElementById("gc-bg-data");
  const size = document.getElementById("gc-bg-size");
  const position = document.getElementById("gc-bg-position");
  const fileInput = document.getElementById("gc-bg-file");
  if (!enabled || !url || !data || !size || !position) return bg;

  enabled.checked = !!bg.enabled && !!bg.image;
  url.value = isDataUrl ? "" : bg.image;
  data.value = isDataUrl ? bg.image : "";
  size.value = bg.size;
  position.value = bg.position;
  if (fileInput) fileInput.value = "";
  updateGraphicCharterBackgroundPreview();
  return bg;
};

window.getGraphicCharterBackgroundFromForm = function () {
  return normalizePageBackground({
    enabled: !!document.getElementById("gc-bg-enabled")?.checked,
    image: getGraphicCharterBackgroundSource(),
    size: document.getElementById("gc-bg-size")?.value || "cover",
    position:
      document.getElementById("gc-bg-position")?.value || "center center",
    repeat: "no-repeat",
  });
};

window.updateGraphicCharterBackgroundPreview = function () {
  const preview = document.getElementById("gc-bg-preview");
  const status = document.getElementById("gc-bg-status");
  const enabled = !!document.getElementById("gc-bg-enabled")?.checked;
  const image = getGraphicCharterBackgroundSource();
  const bg = getGraphicCharterBackgroundFromForm();
  if (!preview || !status) return;

  preview.style.backgroundColor = "#fff";
  preview.style.backgroundImage =
    enabled && image ? toCssUrlValue(image) : "none";
  preview.style.backgroundSize = bg.size;
  preview.style.backgroundPosition = bg.position;
  preview.style.backgroundRepeat = bg.repeat;

  if (enabled && image) {
    status.textContent = `${
      image.startsWith("data:")
        ? "Fichier local chargé"
        : "Image distante prête"
    }  - ${bg.size}  - ${bg.position}`;
    return;
  }

  status.textContent = image
    ? "Image chargée mais désactivée."
    : "Aucune image de fond sélectionnée.";
};

window.handleGraphicCharterBackgroundUrlInput = function () {
  const urlInput = document.getElementById("gc-bg-url");
  const dataInput = document.getElementById("gc-bg-data");
  if (dataInput) dataInput.value = "";
  if (urlInput?.value?.trim()) {
    document.getElementById("gc-bg-enabled").checked = true;
  }
  updateGraphicCharterBackgroundPreview();
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Chargement de l'image impossible"));
    img.src = src;
  });
}

async function buildOptimizedBackgroundDataUrl(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const isRaster = /^image\/(png|jpe?g|webp)$/i.test(file.type || "");
  if (!isRaster) return originalDataUrl;

  const img = await loadImageElement(originalDataUrl);
  const maxWidth = 1800;
  const maxHeight = 2500;
  const ratio = Math.min(
    1,
    maxWidth / Math.max(1, img.naturalWidth || img.width || 1),
    maxHeight / Math.max(1, img.naturalHeight || img.height || 1),
  );
  const width = Math.max(
    1,
    Math.round((img.naturalWidth || img.width || 1) * ratio),
  );
  const height = Math.max(
    1,
    Math.round((img.naturalHeight || img.height || 1) * ratio),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return originalDataUrl;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const preferredType =
    String(file.type || "").toLowerCase() === "image/png"
      ? "image/webp"
      : "image/jpeg";
  const optimized = canvas.toDataURL(preferredType, 0.9);

  if (
    optimized &&
    optimized.length < originalDataUrl.length &&
    optimized.startsWith("data:image/")
  ) {
    return optimized;
  }
  return originalDataUrl;
}

window.handleGraphicCharterBackgroundFileChange = async function (event) {
  const file = event?.target?.files?.[0];
  if (!file) {
    updateGraphicCharterBackgroundPreview();
    return;
  }
  try {
    const optimizedDataUrl = await buildOptimizedBackgroundDataUrl(file);
    document.getElementById("gc-bg-data").value = String(
      optimizedDataUrl || "",
    );
    document.getElementById("gc-bg-url").value = "";
    document.getElementById("gc-bg-enabled").checked = true;
    updateGraphicCharterBackgroundPreview();
  } catch (error) {
    toast(error?.message || "Impossible de charger l'image de fond", "error");
  }
};

window.clearGraphicCharterBackground = function () {
  document.getElementById("gc-bg-enabled").checked = false;
  document.getElementById("gc-bg-url").value = "";
  document.getElementById("gc-bg-data").value = "";
  const fileInput = document.getElementById("gc-bg-file");
  if (fileInput) fileInput.value = "";
  updateGraphicCharterBackgroundPreview();
};

function getEditorBodyMetrics() {
  const secBody = document.getElementById("sec-body");
  if (!secBody) return null;
  const styles = getComputedStyle(secBody);
  const padTop = parseFloat(styles.paddingTop) || 0;
  const padBottom = parseFloat(styles.paddingBottom) || 0;
  const secHeader = document.getElementById("sec-header");
  const secFooter = document.getElementById("sec-footer");
  const headerHeight = headerEnabled && secHeader ? secHeader.offsetHeight : 0;
  const footerHeight = footerEnabled && secFooter ? secFooter.offsetHeight : 0;
  const pageHeight =
    typeof window.computeEditorPageUsableHeightPx === "function"
      ? window.computeEditorPageUsableHeightPx({
          orientation: getCurrentPageOrientation(),
          paddingTopPx: padTop,
          paddingBottomPx: padBottom,
          headerHeightPx: headerHeight,
          footerHeightPx: footerHeight,
        })
      : Math.max(1, secBody.clientHeight - padTop - padBottom);
  return { secBody, padTop, padBottom, pageHeight };
}

function rebuildEditorPageVisualizer() {
  const secBody = document.getElementById("sec-body");
  if (!secBody || typeof EditorPageVisualizer !== "function") return;
  const margins = getCurrentPageMargins();
  const secHeader = document.getElementById("sec-header");
  const secFooter = document.getElementById("sec-footer");
  const headerHeight = headerEnabled && secHeader ? secHeader.offsetHeight : 0;
  const footerHeight = footerEnabled && secFooter ? secFooter.offsetHeight : 0;

  if (window.pageVisualizer) {
    try {
      window.pageVisualizer.destroy();
    } catch (_) {}
  }

  window.pageVisualizer = new EditorPageVisualizer({
    marginTop: margins.mt,
    marginBottom: margins.mb,
    marginLeft: margins.ml,
    marginRight: margins.mr,
    orientation: getCurrentPageOrientation(),
  });
  window.pageVisualizer.init("#sec-body", headerHeight, footerHeight);
}

function ensureEditorPageGuides() {
  const secBody = document.getElementById("sec-body");
  if (!secBody) return null;
  let guides = document.getElementById("editorPageGuides");
  if (!guides) {
    guides = document.createElement("div");
    guides.id = "editorPageGuides";
    guides.className = "editor-page-guides";
    secBody.appendChild(guides);
  }
  return guides;
}

function getBodyContentHeight() {
  const bodyPm = document.querySelector("#ck-body .ProseMirror");
  if (!bodyPm) return 0;
  return Math.max(bodyPm.scrollHeight, bodyPm.offsetHeight, 1);
}

function getCurrentBodyPage(totalPages = 1) {
  const metrics = getEditorBodyMetrics();
  if (!metrics) return 1;

  const { secBody, padTop, pageHeight } = metrics;

  if (activeEditor && activeEditor !== editorBody) {
    return 1;
  }

  let y = secBody.scrollTop;
  try {
    if (editorBody) {
      const pos = editorBody.state.selection.from;
      const coords = editorBody.view.coordsAtPos(pos);
      const rect = secBody.getBoundingClientRect();
      y = secBody.scrollTop + (coords.top - rect.top) - padTop;
    }
  } catch (_) {}

  return Math.max(
    1,
    Math.min(totalPages, Math.floor(Math.max(0, y) / pageHeight) + 1),
  );
}

function updatePageLiveBadge(currentPage, totalPages) {
  const badge = document.getElementById("pageLiveBadge");
  if (!badge) return;

  if (activeEditor === editorHeader) {
    badge.textContent = "En-tête - Page 1";
    return;
  }
  if (activeEditor === editorFooter) {
    badge.textContent = "Pied de page  - Page 1";
    return;
  }

  badge.textContent = `Page ${currentPage} / ${totalPages}`;
}

function refreshEditorPaginationVisuals() {
  pageGuideRaf = 0;

  const metrics = getEditorBodyMetrics();
  const guides = ensureEditorPageGuides();
  if (!metrics || !guides) return;

  const { secBody, pageHeight } = metrics;
  const contentHeight = Math.max(getBodyContentHeight(), pageHeight);
  const totalPages = Math.max(1, Math.ceil(contentHeight / pageHeight));
  const currentPage = getCurrentBodyPage(totalPages);

  guides.innerHTML = "";
  guides.style.height = "0px";

  secBody.dataset.pageCount = String(totalPages);
  updatePageLiveBadge(currentPage, totalPages);
}

function scheduleEditorPaginationRefresh() {
  if (pageGuideRaf) cancelAnimationFrame(pageGuideRaf);
  pageGuideRaf = requestAnimationFrame(refreshEditorPaginationVisuals);
}

function bindEditorPaginationVisuals() {
  const secBody = document.getElementById("sec-body");
  if (!secBody || secBody.dataset.pageGuideBound === "1") return;

  secBody.addEventListener("scroll", () => {
    scheduleEditorPaginationRefresh();
  });
  secBody.dataset.pageGuideBound = "1";
}

function syncToolbar() {
  const ed = activeEditor;
  if (!ed) return;
  const toggles = {
    "tb-bold": ed.isActive("bold"),
    "tb-italic": ed.isActive("italic"),
    "tb-underline": ed.isActive("underline"),
    "tb-strike": ed.isActive("strike"),
    "tb-superscript": ed.isActive("superscript"),
    "tb-subscript": ed.isActive("subscript"),
    "tb-bul": ed.isActive("bulletList"),
    "tb-ord": ed.isActive("orderedList"),
    "tb-al": ed.isActive({ textAlign: "left" }),
    "tb-ac": ed.isActive({ textAlign: "center" }),
    "tb-ar": ed.isActive({ textAlign: "right" }),
    "tb-aj": ed.isActive({ textAlign: "justify" }),
  };
  Object.entries(toggles).forEach(([id, on]) =>
    document.getElementById(id)?.classList.toggle("on", on),
  );
  const hSel = document.getElementById("tb-heading");
  if (hSel) {
    if (ed.isActive("heading", { level: 1 })) hSel.value = "h1";
    else if (ed.isActive("heading", { level: 2 })) hSel.value = "h2";
    else if (ed.isActive("heading", { level: 3 })) hSel.value = "h3";
    else if (ed.isActive("heading", { level: 4 })) hSel.value = "h4";
    else hSel.value = "paragraph";
  }
  try {
    const attrs = ed.getAttributes("textStyle");
    const fSel = document.getElementById("tb-font");
    if (fSel && attrs?.fontFamily) {
      for (const opt of fSel.options) {
        if (
          opt.value &&
          attrs.fontFamily
            .toLowerCase()
            .includes(
              opt.value.split(",")[0].replace(/'/g, "").trim().toLowerCase(),
            )
        ) {
          fSel.value = opt.value;
          break;
        }
      }
    }
    const sSel = document.getElementById("tb-size");
    if (sSel) sSel.value = attrs?.fontSize || "12pt";
  } catch (_) {}
}

window.edCmd = function (cmd, opts) {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  try {
    ed.chain().focus()[cmd](opts).run();
  } catch (_) {}
};
window.applyHeading = function (val) {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  if (val === "paragraph") ed.chain().focus().setParagraph().run();
  else
    ed.chain()
      .focus()
      .toggleHeading({ level: parseInt(val.replace("h", "")) })
      .run();
};
window.applyFontFamily = function (val) {
  if (!val) return;
  const ed = activeEditor || editorBody;
  if (ed) ed.chain().focus().setFontFamily(val).run();
  document.getElementById("tb-font").value = val;
};
window.applyFontSize = function (val) {
  if (!val) return;
  const ed = activeEditor || editorBody;
  if (!ed) return;
  try {
    ed.chain().focus().setFontSize(val).run();
  } catch (_) {
    ed.chain().focus().setMark("textStyle", { fontSize: val }).run();
  }
  document.getElementById("tb-size").value = val;
};
window.applyTextColor = function (color) {
  const ed = activeEditor || editorBody;
  if (ed) ed.chain().focus().setColor(color).run();
  document.getElementById("bar-text").style.background = color;
  closeAllCpops();
};
window.applyHighlight = function (color) {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  if (color === "transparent" || !color)
    ed.chain().focus().unsetHighlight().run();
  else ed.chain().focus().setHighlight({ color }).run();
  document.getElementById("bar-bg").style.background = color || "transparent";
  closeAllCpops();
};
window.applyAlign = function (dir) {
  const ed = activeEditor || editorBody;
  if (ed) ed.chain().focus().setTextAlign(dir).run();
};
window.applyDir = function (dir) {
  const safeDir = normalizeTemplateDirection(dir, "ltr");
  const section = getCurrentSectionKey();
  currentSectionDirections = {
    ...normalizeTemplateSectionDirections(currentSectionDirections),
    [section]: safeDir,
  };
  applyCurrentSectionDirectionUI(section);
  const ed = activeEditor || editorBody;
  applyDirectionToEditor(ed, safeDir);
  persistCurrentSectionDirections();
  onEditorChange();
  toast(safeDir === "rtl" ? "Mode RTL activé" : "Mode LTR activé", "info");
};

window.doInsertTable = function () {
  const rows = parseInt(document.getElementById("ti-rows").value) || 3,
    cols = parseInt(document.getElementById("ti-cols").value) || 3;
  const ed = activeEditor || editorBody;
  if (ed) {
    ed.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    _scheduleTableAutoFit(ed, "equalize", "active");
  }
  closeModal("modalTable");
  toast(`Tableau ${rows}×${cols} inséré`);
};
window.tblCmd = function (cmd) {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  try {
    ed.chain().focus()[cmd]().run();
  } catch (e) {
    console.warn("tblCmd", cmd, e);
  }
  const fitMode = /addColumn|deleteColumn|mergeCells|splitCell/.test(cmd)
    ? "equalize"
    : "clamp";
  const fitScope = cmd === "deleteTable" ? "all" : "active";
  _scheduleTableAutoFit(ed, fitMode, fitScope);
  positionTblToolbar();
};

function positionTblToolbar() {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const tb = document.getElementById("tblToolbar");
  const inTable =
    ed.isActive("table") ||
    ed.isActive("tableCell") ||
    ed.isActive("tableHeader");
  if (!inTable) {
    tb.classList.remove("on");
    return;
  }
  let tableEl = null;
  try {
    const { from } = ed.state.selection;
    if (from > 0) {
      const node = ed.view.domAtPos(from);
      let el = node.node;
      if (el.nodeType === 3) el = el.parentElement;
      tableEl = el.closest("table");
    }
  } catch (_) {}
  if (!tableEl) tableEl = ed.view.dom.querySelector("table");
  if (!tableEl) {
    tb.classList.remove("on");
    return;
  }
  const rect = tableEl.getBoundingClientRect();
  tb.style.top = rect.top - 44 + "px";
  tb.style.left = Math.max(8, rect.left) + "px";
  tb.classList.add("on");
}

function applyTblAttr(attrKey, color) {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const val = color === "transparent" ? null : color;
  const { state, dispatch } = ed.view;
  const { doc, selection } = state;
  const tr = state.tr;
  let changed = false;
  const domSelected = ed.view.dom.querySelectorAll(".selectedCell");
  const processNode = (node, pos) => {
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      const tryDOM = () => {
        try {
          return ed.view.nodeDOM(pos);
        } catch (_) {
          return null;
        }
      };
      const dn = tryDOM();
      const isSelected =
        domSelected.length > 0
          ? dn && dn.classList?.contains("selectedCell")
          : selection.from >= pos && selection.from < pos + node.nodeSize;
      if (isSelected) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          [attrKey]: val,
        });
        changed = true;
      }
    }
  };
  doc.descendants(processNode);
  if (changed) dispatch(tr);
}

window.applyTblCellBg = function (color) {
  applyTblAttr("backgroundColor", color);
  document.getElementById("tblClrPreview").style.background =
    color || "transparent";
  closeTblPops();
  toast("Fond appliqué", "success");
};
window.applyTblCellTxt = function (color) {
  applyTblAttr("textColor", color);
  document.getElementById("tblTxtPreview").style.background = color;
  closeTblPops();
  toast("Couleur texte appliquée", "success");
};
window.toggleTblClrPop = function (e) {
  e.stopPropagation();
  const p = document.getElementById("tblClrPop");
  const was = p.classList.contains("on");
  closeTblPops();
  if (!was) p.classList.add("on");
};
window.toggleTblTxtPop = function (e) {
  e.stopPropagation();
  const p = document.getElementById("tblTxtPop");
  const was = p.classList.contains("on");
  closeTblPops();
  if (!was) p.classList.add("on");
};
function closeTblPops() {
  ["tblClrPop", "tblTxtPop", "tblAlignPop"].forEach((id) =>
    document.getElementById(id).classList.remove("on"),
  );
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".tbl-cell-clr-wrap")) closeTblPops();
});

let _tblAlignScope = "cell";
window.setTblAlignScope = function (scope) {
  _tblAlignScope = scope;
  ["cell", "row", "col", "all"].forEach((s) =>
    document.getElementById("scope-" + s).classList.toggle("on", s === scope),
  );
};
window.toggleTblAlignPop = function (e) {
  e.stopPropagation();
  const p = document.getElementById("tblAlignPop");
  const was = p.classList.contains("on");
  closeTblPops();
  if (!was) p.classList.add("on");
};

function _getActiveCellInfo(ed) {
  try {
    const { selection } = ed.state;
    const { $from } = selection;
    let depth = $from.depth;
    while (depth > 0) {
      const node = $from.node(depth);
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
        return { pos: $from.before(depth), node, depth, $from };
      }
      depth--;
    }
  } catch (_) {}
  return null;
}
function _getCellIndices(ed, cellPos) {
  const { doc } = ed.state;
  let tableNode = null,
    tablePos = 0;
  doc.descendants((node, pos) => {
    if (
      node.type.name === "table" &&
      pos <= cellPos &&
      pos + node.nodeSize > cellPos
    ) {
      tableNode = node;
      tablePos = pos;
      return false;
    }
  });
  if (!tableNode) return { rowIdx: -1, colIdx: -1 };
  let rowIdx = 0,
    colIdx = 0,
    found = false;
  tableNode.forEach((rowNode, rowOff) => {
    if (found) return;
    let ci = 0;
    rowNode.forEach((cellNode, cellOff) => {
      if (found) return;
      const absPos = tablePos + 1 + rowOff + 1 + cellOff;
      if (Math.abs(absPos - cellPos) < 3) {
        colIdx = ci;
        found = true;
      }
      ci++;
    });
    if (!found) rowIdx++;
  });
  return { rowIdx, colIdx, tableNode, tablePos };
}
function applyTblAttrScoped(attrKey, val, scope) {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const { state, dispatch } = ed.view;
  const { doc, selection } = state;
  const tr = state.tr;
  let changed = false;
  const cellInfo = _getActiveCellInfo(ed);
  const { rowIdx, colIdx, tableNode, tablePos } = cellInfo
    ? _getCellIndices(ed, cellInfo.pos)
    : { rowIdx: -1, colIdx: -1, tableNode: null, tablePos: 0 };
  const domSelected = ed.view.dom.querySelectorAll(".selectedCell");
  const hasMultiSelect = domSelected.length > 1;
  doc.descendants((node, pos) => {
    if (node.type.name !== "tableCell" && node.type.name !== "tableHeader")
      return;
    let apply = false;
    if (hasMultiSelect && scope === "cell") {
      try {
        const dn = ed.view.nodeDOM(pos);
        apply = dn && dn.classList?.contains("selectedCell");
      } catch (_) {}
    } else if (scope === "cell") {
      apply = cellInfo && Math.abs(pos - cellInfo.pos) < 3;
    } else if (scope === "row" && tableNode) {
      const { rowIdx: r } = _getCellIndices(ed, pos);
      apply = r === rowIdx;
    } else if (scope === "col" && tableNode) {
      const { colIdx: c } = _getCellIndices(ed, pos);
      apply = c === colIdx;
    } else if (scope === "all") {
      apply = true;
    }
    if (apply) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        [attrKey]: val || null,
      });
      changed = true;
    }
  });
  if (changed) dispatch(tr);
}
window.applyTblAlign = function (align) {
  applyTblAttrScoped("textAlign", align, _tblAlignScope);
  document.getElementById("tblAlignIndicator").textContent =
    { left: "?", center: "?", right: "?", justify: "=" }[align] || "?";
  document
    .querySelectorAll(".tbl-align-dir-btn")
    .forEach((b) => b.classList.remove("on"));
  event?.currentTarget?.classList.add("on");
  const scopeLabel = {
    cell: "cellule",
    row: "ligne",
    col: "colonne",
    all: "tableau",
  }[_tblAlignScope];
  toast(`Alignement ${align} appliqué à la ${scopeLabel}`, "success");
  closeTblPops();
};
window.applyTblValign = function (valign) {
  applyTblAttrScoped("verticalAlign", valign, _tblAlignScope);
  const scopeLabel = {
    cell: "cellule",
    row: "ligne",
    col: "colonne",
    all: "tableau",
  }[_tblAlignScope];
  toast(`Alignement vertical ${valign} appliqué à la ${scopeLabel}`, "success");
  closeTblPops();
};

// -- Images --
window.previewImgFile = function (input) {
  const f = input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (e) => {
    document.getElementById("img-preview").src = e.target.result;
    document.getElementById("img-preview-area").style.display = "flex";
  };
  r.readAsDataURL(f);
};
window.previewImgUrl = function (url) {
  if (!url) return;
  document.getElementById("img-preview").src = url;
  document.getElementById("img-preview-area").style.display = "flex";
};
window.doInsertImage = function () {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const fi = document.getElementById("img-file"),
    url = document.getElementById("img-url").value,
    cap = document.getElementById("img-caption").value;
  function ins(src) {
    ed.chain()
      .focus()
      .setImage({ src, alt: cap || "image", title: cap || "" })
      .run();
    closeModal("modalImage");
    toast("Image insérée");
    fi.value = "";
    document.getElementById("img-url").value = "";
    document.getElementById("img-preview-area").style.display = "none";
    setTimeout(() => activateImageResizers(ed), 80);
  }
  if (fi.files[0]) {
    const r = new FileReader();
    r.onload = (e) => ins(e.target.result);
    r.readAsDataURL(fi.files[0]);
  } else if (url) ins(url);
  else toast("Sélectionnez un fichier ou entrez une URL", "error");
};

function activateImageResizers(ed) {
  if (!ed) return;
  ed.view.dom.querySelectorAll("img:not([data-rw])").forEach((img) => {
    if (!img.closest(".img-resize-wrap")) wrapImgResize(img, ed);
  });
}
function wrapImgResize(img, ed) {
  if (img.dataset.rw) return;
  const wrap = document.createElement("span");
  wrap.className = "img-resize-wrap";
  wrap.contentEditable = "false";
  if (img.style.width) wrap.style.width = img.style.width;
  img.parentNode.insertBefore(wrap, img);
  wrap.appendChild(img);
  img.dataset.rw = "1";
  const tb = document.createElement("div");
  tb.style.cssText =
    "position:fixed;z-index:3000;background:#1a1d2e;border-radius:7px;display:none;align-items:center;gap:1px;padding:3px 5px;box-shadow:0 4px 18px rgba(0,0,0,.28);white-space:nowrap;pointer-events:auto";
  tb.innerHTML = `<button onclick="setImgAlign(this,'left')" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:transparent;border-radius:4px;cursor:pointer;color:rgba(255,255,255,.8);font-size:13px">?</button><button onclick="setImgAlign(this,'center')" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:transparent;border-radius:4px;cursor:pointer;color:rgba(255,255,255,.8);font-size:13px">?</button><button onclick="setImgAlign(this,'right')" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:transparent;border-radius:4px;cursor:pointer;color:rgba(255,255,255,.8);font-size:13px">?</button><div style="width:1px;height:16px;background:rgba(255,255,255,.2);margin:0 3px"></div><button onclick="setImgWidthFixed(this,'25%')" style="height:26px;padding:0 6px;border:none;background:transparent;color:rgba(255,255,255,.75);cursor:pointer;border-radius:4px;font-size:10px;font-weight:600">25%</button><button onclick="setImgWidthFixed(this,'50%')" style="height:26px;padding:0 6px;border:none;background:transparent;color:rgba(255,255,255,.75);cursor:pointer;border-radius:4px;font-size:10px;font-weight:600">50%</button><button onclick="setImgWidthFixed(this,'75%')" style="height:26px;padding:0 6px;border:none;background:transparent;color:rgba(255,255,255,.75);cursor:pointer;border-radius:4px;font-size:10px;font-weight:600">75%</button><button onclick="setImgWidthFixed(this,'100%')" style="height:26px;padding:0 6px;border:none;background:transparent;color:rgba(255,255,255,.75);cursor:pointer;border-radius:4px;font-size:10px;font-weight:600">100%</button><div style="width:1px;height:16px;background:rgba(255,255,255,.2);margin:0 3px"></div><button onclick="removeImgFixed()" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:transparent;border-radius:4px;cursor:pointer;color:#f87171;font-size:14px;font-weight:700">?</button>`;
  document.body.appendChild(tb);
  img._floatTb = tb;
  const badge = document.createElement("div");
  badge.className = "img-size-badge";
  wrap.appendChild(badge);
  ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((d) => {
    const h = document.createElement("span");
    h.className = "img-handle " + d;
    h.dataset.dir = d;
    wrap.appendChild(h);
    h.addEventListener("mousedown", (e) =>
      startImgResize(e, wrap, img, badge, d),
    );
  });
  wrap.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    selectImg(wrap, img);
  });
  img.addEventListener("click", (e) => {
    e.stopPropagation();
    selectImg(wrap, img);
  });
}
function positionImgToolbar(wrap, img) {
  const tb = img?._floatTb;
  if (!tb) return;
  const rect = wrap.getBoundingClientRect();
  tb.style.left =
    Math.max(8, rect.left + rect.width / 2 - tb.offsetWidth / 2) + "px";
  tb.style.top = Math.max(4, rect.top - 42) + "px";
  tb.style.display = "flex";
}
function selectImg(wrap, img) {
  if (_activeResizeImg && _activeResizeImg !== wrap) {
    _activeResizeImg.classList.remove("selected");
    if (_activeResizeImgEl?._floatTb)
      _activeResizeImgEl._floatTb.style.display = "none";
  }
  _activeResizeImg = wrap;
  _activeResizeImgEl = img || wrap.querySelector("img");
  wrap.classList.add("selected");
  if (_activeResizeImgEl?._floatTb)
    positionImgToolbar(wrap, _activeResizeImgEl);
}
window.setImgAlign = function (btn, align) {
  if (!_activeResizeImg) return;
  const wrap = _activeResizeImg;
  wrap.style.float = "none";
  wrap.style.marginLeft = "";
  wrap.style.marginRight = "";
  if (align === "left") {
    wrap.style.float = "left";
    wrap.style.marginRight = "12px";
  } else if (align === "right") {
    wrap.style.float = "right";
    wrap.style.marginLeft = "12px";
  } else {
    wrap.style.display = "block";
    wrap.style.marginLeft = "auto";
    wrap.style.marginRight = "auto";
  }
  btn.parentElement
    ?.querySelectorAll("button")
    .forEach((b) => (b.style.background = ""));
  btn.style.background = "rgba(37,99,235,.5)";
  if (_activeResizeImgEl)
    setTimeout(() => positionImgToolbar(wrap, _activeResizeImgEl), 30);
};
window.setImgWidthFixed = function (btn, pct) {
  if (!_activeResizeImg) return;
  const wrap = _activeResizeImg,
    img = _activeResizeImgEl || wrap.querySelector("img");
  wrap.style.width = pct;
  if (img) {
    img.style.width = "100%";
    img.style.height = "auto";
  }
  btn.parentElement?.querySelectorAll("button").forEach((b) => {
    b.style.color = "rgba(255,255,255,.75)";
    b.style.fontWeight = "";
  });
  btn.style.color = "#fff";
  btn.style.fontWeight = "700";
  if (img) setTimeout(() => positionImgToolbar(wrap, img), 30);
};
window.removeImgFixed = function () {
  if (!_activeResizeImg) return;
  if (_activeResizeImgEl?._floatTb) _activeResizeImgEl._floatTb.remove();
  _activeResizeImg.remove();
  _activeResizeImg = null;
  _activeResizeImgEl = null;
};
function startImgResize(e, wrap, img, badge, dir) {
  e.preventDefault();
  e.stopPropagation();
  selectImg(wrap, img);
  wrap.classList.add("resizing");
  const sx = e.clientX,
    sy = e.clientY,
    sw = img.offsetWidth,
    sh = img.offsetHeight,
    aspect = sh > 0 ? sw / sh : 1;
  function onMove(ev) {
    let dx = ev.clientX - sx,
      dy = ev.clientY - sy,
      nw = sw,
      nh = sh;
    if (dir.includes("e")) nw = Math.max(40, sw + dx);
    if (dir.includes("w")) nw = Math.max(40, sw - dx);
    if (dir.includes("s")) nh = Math.max(30, sh + dy);
    if (dir.includes("n")) nh = Math.max(30, sh - dy);
    if (dir.length === 2) {
      if (dir.includes("e") || dir.includes("w")) nh = Math.round(nw / aspect);
      else nw = Math.round(nh * aspect);
    }
    img.style.width = nw + "px";
    img.style.height = nh + "px";
    wrap.style.width = nw + "px";
    badge.textContent = nw + "×" + nh + " px";
  }
  function onUp() {
    wrap.classList.remove("resizing");
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    try {
      (activeEditor || editorBody)?.commands.focus();
    } catch (_) {}
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}
document.addEventListener("mousedown", (e) => {
  if (
    _activeResizeImg &&
    !e.target.closest(".img-resize-wrap") &&
    !e.target.closest(".img-toolbar-float")
  ) {
    _activeResizeImg.classList.remove("selected");
    if (_activeResizeImgEl?._floatTb)
      _activeResizeImgEl._floatTb.style.display = "none";
    _activeResizeImg = null;
    _activeResizeImgEl = null;
  }
});

// -- Links --
window.previewImgFile = function (input) {
  const f = input.files[0];
  const area = document.getElementById("img-preview-area");
  if (!f) {
    area.style.display = "none";
    return;
  }
  const r = new FileReader();
  r.onload = (e) => {
    document.getElementById("img-preview").src = e.target.result;
    area.style.display = "flex";
  };
  r.readAsDataURL(f);
};
window.previewImgUrl = function (url) {
  const area = document.getElementById("img-preview-area");
  if (!url) {
    area.style.display = "none";
    return;
  }
  document.getElementById("img-preview").src = url;
  area.style.display = "flex";
};
window.doInsertImage = function () {
  if (typeof window.__sirhDoInsertImage === "function") {
    window.__sirhDoInsertImage();
    return;
  }
  toast("Le gestionnaire d'image unifi - n'est pas disponible", "error");
};
activateImageResizers = function (ed) {
  if (!ed || !window.SirhImgResize) return;
  ed.view.dom
    .querySelectorAll("img:not(.ProseMirror-separator)")
    .forEach((img) => {
      window.SirhImgResize.bind(img, ed);
    });
};
wrapImgResize = function (img, ed) {
  if (!window.SirhImgResize) return null;
  return window.SirhImgResize.bind(img, ed);
};
positionImgToolbar = function () {
  window.SirhImgResize?.reposition();
};
selectImg = function (wrap, img) {
  if (window.SirhImgResize && wrap && img)
    window.SirhImgResize.select(wrap, img);
};
window.setImgAlign = function (btn, align) {
  const wrap = window.SirhImgResize?.activeWrap;
  if (wrap) window.SirhImgResize.applyAlign(wrap, align);
};
window.setImgWidthFixed = function (btn, pct) {
  const wrap = window.SirhImgResize?.activeWrap;
  const img = window.SirhImgResize?.activeImg;
  if (wrap && img) window.SirhImgResize.applyWidthPct(wrap, img, pct);
};
window.removeImgFixed = function () {
  window.SirhImgResize?.removeActive();
};

window.doInsertLink = function () {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const text = document.getElementById("link-text").value,
    url = document.getElementById("link-url").value;
  if (!url) {
    toast("L'URL est requise", "error");
    return;
  }
  if (text)
    ed.chain().focus().insertContent(`<a href="${url}">${text}</a>`).run();
  else ed.chain().focus().setLink({ href: url }).run();
  closeModal("modalLink");
  document.getElementById("link-text").value = "";
  document.getElementById("link-url").value = "";
  toast("Lien inséré");
};

// -- Misc inserts --
window.insHR = () => {
  const ed = activeEditor || editorBody;
  if (ed) ed.chain().focus().setHorizontalRule().run();
};
window.insDate = () => {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  window.__pendingDateEditor = ed;
  window.selectDateVariableOption("{{date_du_jour}}");
  openModal("modalDateVar");
};
window.selectDateVariableOption = (value) => {
  const selectedVar = value || "{{date_du_jour}}";
  const input = document.getElementById("date-var-value");
  if (input) input.value = selectedVar;
  document
    .querySelectorAll("#dateVarChoices [data-date-var]")
    .forEach((btn) => {
      const isActive = btn.dataset.dateVar === selectedVar;
      btn.classList.toggle("primary", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
};
window.doInsertDateVariable = () => {
  const ed = window.__pendingDateEditor || activeEditor || editorBody;
  if (!ed) return;
  const selectedVar =
    document.getElementById("date-var-value")?.value || "{{date_du_jour}}";
  ed.chain().focus().insertContent(selectedVar).run();
  closeModal("modalDateVar");
};
window.insSignature = () => {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  ed.chain()
    .focus()
    .insertContent(
      `<table style="width:100%;border-collapse:collapse;border:none"><tr><td style="border:none;width:50%;padding:8px 0;vertical-align:top"><p><strong>L'intéressé(e)</strong></p><p style="margin-top:40px;border-top:1px solid #c8cdd8;padding-top:4px;font-size:10px;color:#666">Signature</p></td><td style="border:none;width:50%;padding:8px 0;vertical-align:top;text-align:right"><p><strong>Le Directeur de l'Organization</strong></p><p style="margin-top:4px;font-size:10px;color:#444">{{directeur}}</p><p style="margin-top:32px;border-top:1px solid #c8cdd8;padding-top:4px;font-size:10px;color:#666">Signature et cachet</p></td></tr></table>`,
    )
    .run();
  toast("Bloc signature inséré");
};

// -- Word count --
function updateWordCount() {
  if (!editorBody) return;
  try {
    const txt = editorBody.getText();
    const w = txt.trim() ? txt.trim().split(/\s+/).length : 0;
    document.getElementById("sbWords").textContent = w + " mots";
    document.getElementById("sbChars").textContent = txt.length + " car.";
  } catch (_) {}
}

// -- Save state --
function setSaveState(msg, modified) {
  document.getElementById("saveSt").textContent = msg;
  document.getElementById("saveSt").className =
    "save-st" + (modified ? " mod" : "");
  document.getElementById("sbDot").className =
    "sb-dot" + (modified ? " mod" : " ok");
  document.getElementById("sbText").textContent = msg;
}
function onEditorChange() {
  setSaveState("Modifié *", true);
  updateWordCount();
}

// -- Family & template list --
function getSelectedGraphicCharterId() {
  const select = document.getElementById("graphicCharterSelect");
  return select?.value || null;
}

function setGraphicCharterMeta(charter) {
  const meta = document.getElementById("graphicCharterMeta");
  if (!meta) return;
  if (!charter) {
    meta.textContent = "Aucune charte selectionnee";
    return;
  }
  meta.textContent = charter.isDefault
    ? `${charter.name} - charte par defaut`
    : charter.description || charter.name;
}

function getGraphicCharterEditableSection() {
  return currentAdminSection === "header" || currentAdminSection === "footer"
    ? currentAdminSection
    : null;
}

function updateGraphicCharterSectionActions() {
  const loadBtn = document.getElementById("charterLoadSectionBtn");
  const saveBtn = document.getElementById("charterSaveSectionBtn");
  const meta = document.getElementById("graphicCharterSectionMeta");
  const section = getGraphicCharterEditableSection();
  const charterId = getSelectedGraphicCharterId();
  const hasTpl = !!curTplId;
  const disabled = !section || !charterId || !hasTpl;
  const labels = {
    header: "En-tête",
    footer: "Pied de page",
  };
  if (loadBtn) loadBtn.disabled = disabled;
  if (saveBtn) saveBtn.disabled = disabled;
  if (!meta) return;
  if (!hasTpl) {
    meta.textContent = "Ouvrez un template pour synchroniser la charte.";
    return;
  }
  if (!section) {
    meta.textContent =
      "Passez sur En-tête ou Pied de page pour gerer la charte depuis l'editeur.";
    return;
  }
  meta.textContent = `${labels[section]} actif - synchronisation directe avec la charte.`;
}

function populateGraphicCharterSelect(selectedId = null) {
  const select = document.getElementById("graphicCharterSelect");
  if (!select) return [];
  const charters = getOrganizationGraphicCharters(getActiveOrganizationId());
  select.innerHTML = "";
  charters.forEach((charter) => {
    const option = document.createElement("option");
    option.value = charter.id;
    option.textContent = charter.isDefault
      ? `${charter.name} (par defaut)`
      : charter.name;
    select.appendChild(option);
  });
  const resolvedId =
    selectedId ||
    getDefaultOrganizationGraphicCharterId(getActiveOrganizationId()) ||
    charters[0]?.id ||
    "";
  select.value = resolvedId;
  setGraphicCharterMeta(
    getOrganizationGraphicCharter(getActiveOrganizationId(), resolvedId),
  );
  return charters;
}

function syncTemplateLayoutFromCharter(tpl, charter) {
  if (!tpl || !charter?.config?.layout) return tpl;
  const config = normalizeGraphicCharterConfig(charter.config);
  const layout = config.layout;
  tpl.graphicCharterId = charter.id;
  tpl.pageMargins = normalizeMargins(layout.pageMargins);
  tpl.orientation = layout.orientation;
  tpl.headerDisplay = normalizeTemplateSectionDisplay(
    config.header.displayMode,
  );
  tpl.footerDisplay = normalizeTemplateSectionDisplay(
    config.footer.displayMode,
  );
  const orientationSelect = document.getElementById("pg-orientation");
  if (orientationSelect) {
    orientationSelect.value = tpl.orientation;
  }
  applyDocumentThemeToRoot(tpl);
  applyPageMarginsToUI(tpl.pageMargins);
  applyHeaderFooterDistancesToUI(getTemplateHeaderFooterDistances(tpl));
  applyPageOrientationToUI(tpl.orientation);
  setTimeout(() => {
    rebuildEditorPageVisualizer();
    scheduleEditorPaginationRefresh();
  }, 50);
  return tpl;
}

function readGraphicCharterForm() {
  const existing = normalizeGraphicCharterConfig(
    getOrganizationGraphicCharter(
      getActiveOrganizationId(),
      editingGraphicCharterId,
    )?.config || {},
  );
  return {
    name: document.getElementById("gc-name").value.trim(),
    description: document.getElementById("gc-description").value.trim(),
    isDefault: document.getElementById("gc-is-default").checked,
    config: normalizeGraphicCharterConfig({
      identity: existing.identity,
      colors: existing.colors,
      typography: existing.typography,
      layout: {
        orientation: document.getElementById("gc-orientation").value,
        pageMargins: {
          mt: document.getElementById("gc-margin-top").value,
          mb: document.getElementById("gc-margin-bottom").value,
          ml: document.getElementById("gc-margin-left").value,
          mr: document.getElementById("gc-margin-right").value,
        },
        headerFooterDistances: {
          headerTop: document.getElementById("gc-header-distance-top")?.value,
          footerBottom: document.getElementById("gc-footer-distance-bottom")
            ?.value,
        },
        pageBackground: getGraphicCharterBackgroundFromForm(),
      },
      header: {
        enabledByDefault: document.getElementById("gc-header-enabled").checked,
        displayMode: getGraphicCharterHeaderFooterDisplay().headerDisplay,
        html: document.getElementById("gc-header-html").value,
      },
      footer: {
        enabledByDefault: document.getElementById("gc-footer-enabled").checked,
        displayMode: getGraphicCharterHeaderFooterDisplay().footerDisplay,
        html: document.getElementById("gc-footer-html").value,
      },
    }),
  };
}

function fillGraphicCharterForm(charter = null) {
  const entry =
    charter ||
    normalizeGraphicCharterEntry(
      {
        name: "Nouvelle charte",
        isDefault: !getOrganizationGraphicCharters(getActiveOrganizationId())
          .length,
        config: {},
      },
      0,
    );
  const config = normalizeGraphicCharterConfig(entry.config || {});
  document.getElementById("gc-name").value = entry.name || "";
  document.getElementById("gc-description").value = entry.description || "";
  document.getElementById("gc-orientation").value = config.layout.orientation;
  document.getElementById("gc-margin-top").value = config.layout.pageMargins.mt;
  document.getElementById("gc-margin-bottom").value =
    config.layout.pageMargins.mb;
  document.getElementById("gc-margin-left").value =
    config.layout.pageMargins.ml;
  document.getElementById("gc-margin-right").value =
    config.layout.pageMargins.mr;
  document.getElementById("gc-header-distance-top").value =
    config.layout.headerFooterDistances.headerTop;
  document.getElementById("gc-footer-distance-bottom").value =
    config.layout.headerFooterDistances.footerBottom;
  applyGraphicCharterBackgroundToUI(config.layout.pageBackground);
  document.getElementById("gc-header-html").value = config.header.html;
  document.getElementById("gc-footer-html").value = config.footer.html;
  document.getElementById("gc-header-enabled").checked =
    !!config.header.enabledByDefault;
  document.getElementById("gc-footer-enabled").checked =
    !!config.footer.enabledByDefault;
  applyGraphicCharterHeaderFooterDisplayToUI(config);
  document.getElementById("gc-is-default").checked = !!entry.isDefault;
}

window.openGraphicCharterModal = function (charterId = null) {
  editingGraphicCharterId = charterId;
  const charter = charterId
    ? getOrganizationGraphicCharter(getActiveOrganizationId(), charterId)
    : null;
  document.getElementById("graphicCharterModalTitle").textContent = charter
    ? "Modifier la charte graphique"
    : "Nouvelle charte graphique";
  fillGraphicCharterForm(charter);

  try {
    gcEditorHeader?.destroy();
  } catch (_) {}
  try {
    gcEditorFooter?.destroy();
  } catch (_) {}

  gcEditorHeader = createEditor(
    "gc-ck-header",
    "En-tête de la charte",
    () => {
      document.getElementById("gc-header-html").value =
        gcEditorHeader?.getHTML() || "";
    },
    () => {},
  );
  gcEditorFooter = createEditor(
    "gc-ck-footer",
    "Pied de page de la charte",
    () => {
      document.getElementById("gc-footer-html").value =
        gcEditorFooter?.getHTML() || "";
    },
    () => {},
  );

  const config = normalizeGraphicCharterConfig(charter?.config || {});
  if (gcEditorHeader && config.header.html)
    gcEditorHeader.commands.setContent(config.header.html, false);
  if (gcEditorFooter && config.footer.html)
    gcEditorFooter.commands.setContent(config.footer.html, false);

  // Historiser aussi caché pour sauvegarde immédiate
  document.getElementById("gc-header-html").value = config.header.html || "";
  document.getElementById("gc-footer-html").value = config.footer.html || "";

  buildGcMiniToolbar("gc-header-tb", () => gcEditorHeader);
  buildGcMiniToolbar("gc-footer-tb", () => gcEditorFooter);

  openModal("modalGraphicCharter");
};

window.editCurrentGraphicCharter = function () {
  const charterId = getSelectedGraphicCharterId();
  if (!charterId) {
    toast("Aucune charte disponible", "error");
    return;
  }
  window.openGraphicCharterModal(charterId);
};

window.saveGraphicCharterModal = function () {
  const payload = readGraphicCharterForm();
  if (!payload.name) {
    toast("Le nom de la charte est requis", "error");
    return;
  }
  const current = editingGraphicCharterId
    ? getOrganizationGraphicCharter(
        getActiveOrganizationId(),
        editingGraphicCharterId,
      )
    : null;
  const saved = saveOrganizationGraphicCharter(getActiveOrganizationId(), {
    id: editingGraphicCharterId || undefined,
    createdAt: current?.createdAt || new Date().toISOString(),
    ...payload,
  });
  if (!saved) {
    toast("Impossible d'enregistrer la charte", "error");
    return;
  }
  if (curTplId) {
    const tpl = DB.getTemplate(curTplId);
    syncTemplateLayoutFromCharter(tpl, saved);
    DB.saveTemplate(tpl);
  }
  populateGraphicCharterSelect(saved.id);
  renderTplList(curFamId);
  closeModal("modalGraphicCharter");
  setSaveState("Modifie", true);
  toast("Charte graphique enregistree", "success");
};

window.onGraphicCharterChange = function () {
  const charterId = getSelectedGraphicCharterId();
  const tpl = curTplId ? DB.getTemplate(curTplId) : null;
  const charter = getOrganizationGraphicCharter(
    getActiveOrganizationId(),
    charterId,
  );
  setGraphicCharterMeta(charter);
  updateGraphicCharterSectionActions();
  if (!tpl || !charterId || !charter) return;
  syncTemplateLayoutFromCharter(tpl, charter);
  DB.saveTemplate(tpl);
  renderTplList(curFamId);
  setSaveState("Modifie", true);
};

window.loadActiveSectionFromGraphicCharter = function () {
  const section = getGraphicCharterEditableSection();
  const charterId =
    getSelectedGraphicCharterId() ||
    getDefaultOrganizationGraphicCharterId(getActiveOrganizationId());
  const charter = getOrganizationGraphicCharter(
    getActiveOrganizationId(),
    charterId,
  );
  if (!curTplId || !section) {
    toast("Ouvrez l'en-tête ou le pied pour charger depuis la charte", "error");
    return;
  }
  if (!charter) {
    toast("Aucune charte disponible", "error");
    return;
  }
  const config = normalizeGraphicCharterConfig(charter.config || {});
  if (section === "header") {
    headerEnabled = true;
    updateSectionVisibility();
    if (editorHeader) setEditorHTML(editorHeader, config.header.html || "");
  } else {
    footerEnabled = true;
    updateSectionVisibility();
    if (editorFooter) setEditorHTML(editorFooter, config.footer.html || "");
  }
  switchSection(section);
  onEditorChange();
  toast(
    section === "header"
      ? "En-tête chargé depuis la charte"
      : "Pied de page chargé depuis la charte",
    "success",
  );
};

window.saveActiveSectionToGraphicCharter = function () {
  const section = getGraphicCharterEditableSection();
  const charterId =
    getSelectedGraphicCharterId() ||
    getDefaultOrganizationGraphicCharterId(getActiveOrganizationId());
  const current = getOrganizationGraphicCharter(
    getActiveOrganizationId(),
    charterId,
  );
  if (!curTplId || !section) {
    toast(
      "Passez sur l'en-tête ou le pied de page pour enregistrer dans la charte",
      "error",
    );
    return;
  }
  if (!current) {
    toast("Aucune charte disponible", "error");
    return;
  }
  const cfg = normalizeGraphicCharterConfig(current.config || {});
  if (section === "header") {
    cfg.header.html = editorHeader ? getEditorHTML(editorHeader) : "";
    cfg.header.enabledByDefault = !!headerEnabled;
  } else {
    cfg.footer.html = editorFooter ? getEditorHTML(editorFooter) : "";
    cfg.footer.enabledByDefault = !!footerEnabled;
  }
  const display = getGraphicCharterHeaderFooterDisplay();
  cfg.header.displayMode = display.headerDisplay;
  cfg.footer.displayMode = display.footerDisplay;
  const saved = saveOrganizationGraphicCharter(getActiveOrganizationId(), {
    ...current,
    config: cfg,
  });
  if (!saved) {
    toast("Impossible d'enregistrer la charte", "error");
    return;
  }
  populateGraphicCharterSelect(saved.id);
  updateGraphicCharterSectionActions();
  setSaveState("Modifie", true);
  toast(
    section === "header"
      ? "En-tête enregistré dans la charte"
      : "Pied de page enregistré dans la charte",
    "success",
  );
};

window.applySelectedGraphicCharterToTemplate = function () {
  if (!curTplId || !editorBody) {
    toast("Ouvrez d'abord un template", "error");
    return;
  }
  const tpl = DB.getTemplate(curTplId);
  const charterId =
    getSelectedGraphicCharterId() ||
    getDefaultOrganizationGraphicCharterId(getActiveOrganizationId());
  const charter = getOrganizationGraphicCharter(
    getActiveOrganizationId(),
    charterId,
  );
  if (!charter) {
    toast("Aucune charte disponible", "error");
    return;
  }
  syncTemplateLayoutFromCharter(tpl, charter);
  tpl.hasHeader = !!charter.config.header.enabledByDefault;
  tpl.hasFooter = !!charter.config.footer.enabledByDefault;
  tpl.headerDisplay = normalizeTemplateSectionDisplay(
    charter.config.header.displayMode,
  );
  tpl.footerDisplay = normalizeTemplateSectionDisplay(
    charter.config.footer.displayMode,
  );
  DB.saveTemplate(tpl);
  if (editorHeader) setEditorHTML(editorHeader, charter.config.header.html);
  if (editorFooter) setEditorHTML(editorFooter, charter.config.footer.html);
  headerEnabled = tpl.hasHeader;
  footerEnabled = tpl.hasFooter;
  updateSectionVisibility();
  switchSection("body");
  setSaveState("Modifie", true);
  toast("La charte a ete appliquee au document", "success");
};

window.deleteCurrentGraphicCharter = function () {
  const charterId = getSelectedGraphicCharterId();
  if (!charterId) {
    toast("Aucune charte a supprimer", "error");
    return;
  }
  const charter = getOrganizationGraphicCharter(
    getActiveOrganizationId(),
    charterId,
  );
  document.getElementById("delTplTitle").textContent =
    "Supprimer la charte graphique ?";
  document.getElementById("delTplMsg").textContent =
    `Supprimer la charte "${charter?.name || "Sans nom"}" ? Les templates lies basculeront sur la charte par defaut.`;
  document.getElementById("delTplBtn").onclick = () => {
    deleteOrganizationGraphicCharter(getActiveOrganizationId(), charterId);
    closeModal("modalDelTpl");
    populateGraphicCharterSelect(
      getDefaultOrganizationGraphicCharterId(getActiveOrganizationId()),
    );
    if (curTplId) buildEditorUI(DB.getTemplate(curTplId));
    renderTplList(curFamId);
    toast("Charte supprimée", "success");
  };
  openModal("modalDelTpl");
};

function populateFamilySelect() {
  const sel = document.getElementById("famSelAdmin");
  const previousFamId = curFamId;
  sel.innerHTML = "";
  DB.getFamilies().forEach((f) => {
    const o = document.createElement("option");
    o.value = f.id;
    o.textContent = (f.icon || "") + " " + f.nom;
    sel.appendChild(o);
  });
  if (previousFamId && DB.getFamily(previousFamId)) {
    sel.value = previousFamId;
  }
  curFamId = sel.value || null;
  const etab = DB.getOrganization(getActiveOrganizationId());
  if (etab) document.getElementById("organizationLabel").textContent = etab.nom;
  populateGraphicCharterSelect();
  if (curFamId) {
    buildVarsPanel(curFamId);
    renderTplList(curFamId);
  }
}
window.onFamChange = function () {
  curFamId = document.getElementById("famSelAdmin").value;
  curTplId = null;
  adminResolvedFilters = [];
  adminFilterValues = {};
  buildVarsPanel(curFamId);
  renderTplList(curFamId);
  clearEditor();
};

function renderTplList(famId) {
  const scroll = document.getElementById("tplScroll");
  scroll.innerHTML = "";
  if (!famId) {
    scroll.innerHTML =
      '<div style="padding:18px;font-size:11px;color:var(--text3);text-align:center;line-height:1.6">Sélectionnez une famille</div>';
    return;
  }
  // L'API renvoie deja les templates scopes a l'organization de l'admin.
  // Eviter un second filtrage ici, sinon les templates legacy/mal scopes
  // presents en base mais charges dans l'etat peuvent disparaitre de la liste.
  const tpls = DB.getTemplates(famId);
  if (!tpls?.length) {
    scroll.innerHTML =
      '<div style="padding:16px;font-size:11px;color:var(--text3);text-align:center;line-height:1.6">Aucun template.<br>Créez le premier !</div>';
    return;
  }
  tpls.forEach((tpl) => {
    const item = document.createElement("div");
    item.className = "tpl-item" + (curTplId === tpl.id ? " on" : "");
    item.innerHTML = `<span style="font-size:16px;flex-shrink:0;margin-top:1px">•</span><div class="tpl-body"><div class="tpl-name">${escHtml(tpl.nom)}</div><div class="tpl-meta">${new Date(tpl.updatedAt).toLocaleDateString("fr-FR")}<span style="background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:2px;font-size:8px;font-weight:700">Publié</span>${tpl.hasHeader ? "<span title='Avec en-tête'>•</span>" : ""}${tpl.hasFooter ? "<span title='Avec pied'>•</span>" : ""}</div></div><div style="display:flex;align-items:center;gap:6px"><button class="tpl-del" title="Dupliquer" onclick="event.stopPropagation();duplicateTemplate('${tpl.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="tpl-del" title="Supprimer" onclick="event.stopPropagation();confirmDelTpl('${tpl.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div>`;
    item.onclick = () => openTemplate(tpl.id);
    scroll.appendChild(item);
  });
}

function clearEditor() {
  document.getElementById("emptyState").style.display = "flex";
  document.getElementById("editorInner").style.display = "none";
  const filterPanel = document.getElementById("templateFilterProfilePanel");
  if (filterPanel) filterPanel.innerHTML = "";
  currentAdminSection = "body";
  const toolbar = document.getElementById("edToolbar");
  if (toolbar) toolbar.classList.remove("is-muted");
  const canvas = document.getElementById("editorCanvasSection");
  const filters = document.getElementById("templateFilterProfilePanelWrap");
  if (canvas) canvas.classList.add("on");
  if (filters) filters.classList.remove("on");
  updateVarsPanelVisibility();
  updateGraphicCharterSectionActions();
  destroyEditors();
}
function destroyEditors() {
  [editorHeader, editorBody, editorFooter].forEach((ed) => {
    try {
      ed?.destroy();
    } catch (_) {}
  });
  editorHeader = editorBody = editorFooter = null;

  // Détruire aussi le visualizer de pages
  if (window.pageVisualizer) {
    try {
      window.pageVisualizer.destroy();
    } catch (_) {}
  }
}
function openTemplate(tplId, options = {}) {
  const tpl = DB.getTemplate(tplId);
  if (!tpl) return;
  curTplId = tplId;
  renderTplList(curFamId);
  buildEditorUI(tpl, options);
}

function scheduleTemplateAuxPanelsRender(tplId) {
  const panel = document.getElementById("templateFilterProfilePanel");
  if (panel) {
    panel.innerHTML =
      '<div class="vars-panel-empty">Chargement du template...</div>';
  }

  setTimeout(async () => {
    if (!curTplId || curTplId !== tplId) return;
    try {
      await renderTemplateFilterProfilePanel();
      if (curTplId !== tplId) return;
      await refreshAdminFilterRuntime(false);
    } catch (error) {
      console.error(
        "Erreur pendant le chargement des panneaux du template",
        error,
      );
    }
  }, 80);
}

function buildEditorUI(tpl, options = {}) {
  const lightweight = !!options.lightweight;
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("editorInner").style.display = "flex";
  updateVarsPanelVisibility();
  document.getElementById("tnameInput").value = tpl.nom;
  populateGraphicCharterSelect(
    tpl.graphicCharterId ||
      getDefaultOrganizationGraphicCharterId(getActiveOrganizationId()),
  );
  applyDocumentThemeToRoot(tpl);
  setSaveState("Prêt", false);
  destroyEditors();
  editorBody = createEditor(
    "ck-body",
    "Rédigez le corps du document ici...",
    onEditorChange,
    (ed) => {
      activeEditor = ed;
    },
  );
  editorHeader = createEditor(
    "ck-header",
    "En-tête du document",
    onEditorChange,
    (ed) => {
      activeEditor = ed;
    },
  );
  editorFooter = createEditor(
    "ck-footer",
    "Pied de page",
    onEditorChange,
    (ed) => {
      activeEditor = ed;
    },
  );
  if (editorBody && tpl.body) setEditorHTML(editorBody, tpl.body);
  if (editorHeader && tpl.header) setEditorHTML(editorHeader, tpl.header);
  if (editorFooter && tpl.footer) setEditorHTML(editorFooter, tpl.footer);
  syncEditorsDirectionFromTemplate(tpl);
  const resolvedMargins = getTemplatePageMargins(tpl);
  applyPageMarginsToUI(resolvedMargins);
  applyHeaderFooterDistancesToUI(getTemplateHeaderFooterDistances(tpl));
  const orientation = getTemplateOrientation(tpl);
  const selOrientation = document.getElementById("pg-orientation");
  if (selOrientation) selOrientation.value = orientation;
  applyPageOrientationToUI(orientation);
  activeEditor = editorBody;
  headerEnabled = !!tpl.hasHeader;
  footerEnabled = !!tpl.hasFooter;
  updateSectionVisibility();
  switchSection("body");
  updateGraphicCharterSectionActions();
  updateWordCount();
  if (!lightweight) bindEditorPaginationVisuals();

  if (lightweight) {
    const panel = document.getElementById("templateFilterProfilePanel");
    if (panel) {
      panel.innerHTML =
        '<div class="vars-panel-empty">Template créé. Les panneaux avancés se chargeront à la prochaine ouverture.</div>';
    }
    return;
  }

  // Initialiser après 100ms
  setTimeout(() => {
    rebuildEditorPageVisualizer();
    scheduleEditorPaginationRefresh();
    [editorBody, editorHeader, editorFooter].forEach((ed) => {
      if (ed) activateImageResizers(ed);
    });
  }, 300);
  scheduleTemplateAuxPanelsRender(tpl.id);
}

function escAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getDefaultTemplateFilterProfileEntry(filterId, order = 0) {
  return normalizeTemplateFilterProfileEntry({
    filterId,
    enabled: true,
    adminEnabled: true,
    userEnabled: true,
    required: false,
    locked: false,
    order,
    defaultValue: null,
    allowedValueMode: "all",
    allowedValues: [],
  });
}

function getTemplateProfileEntry(tpl, filterId, order = 0) {
  return (
    getTemplateFilterProfile(tpl).find(
      (entry) => entry.filterId === filterId,
    ) || getDefaultTemplateFilterProfileEntry(filterId, order)
  );
}

function saveTemplateProfileEntry(filterId, updater) {
  const tpl = curTplId ? DB.getTemplate(curTplId) : null;
  const fam = curFamId ? DB.getFamily(curFamId) : null;
  if (!tpl || !fam) return null;
  const catalog = getFamilyFilterCatalog(fam);
  const existingMap = getTemplateFilterProfileMap(tpl);
  const order =
    catalog.findIndex((filter) => filter.id === filterId) >= 0
      ? catalog.findIndex((filter) => filter.id === filterId)
      : existingMap.size;
  const current = getTemplateProfileEntry(tpl, filterId, order);
  const updated = normalizeTemplateFilterProfileEntry(
    updater(cloneData(current)),
    order,
  );
  if (updated) existingMap.set(filterId, updated);
  tpl.filterProfile = catalog
    .map(
      (filter, index) =>
        existingMap.get(filter.id) ||
        getDefaultTemplateFilterProfileEntry(filter.id, index),
    )
    .filter(Boolean);
  tpl.updatedAt = new Date().toISOString();
  DB.saveTemplate(tpl);
  setSaveState("Modifie", true);
  return tpl;
}

function formatAllowedFilterOption(option) {
  return option.label === option.value
    ? escHtml(option.value)
    : `${escHtml(option.label)} <span style="color:var(--text3)">(${escHtml(option.value)})</span>`;
}

async function renderTemplateFilterProfilePanel() {
  const wrap = document.getElementById("templateFilterProfilePanel");
  const fam = curFamId ? DB.getFamily(curFamId) : null;
  const tpl = curTplId ? DB.getTemplate(curTplId) : null;
  if (!wrap) return;
  if (!fam || !tpl) {
    wrap.innerHTML = "";
    return;
  }
  const catalog = getFamilyFilterCatalog(fam);
  if (!catalog.length) {
    wrap.innerHTML =
      '<div class="vars-panel-empty">Aucun filtre de famille défini. Configurez-les côté Super Admin pour activer le filtrage dynamique.</div>';
    return;
  }

  const previewDefaults = getDefaultFilterValues(fam, tpl, "admin");
  const optionSets = await Promise.all(
    catalog.map(async (filter, index) => ({
      filter,
      profile: getTemplateProfileEntry(tpl, filter.id, index),
      options:
        filter.type === "select"
          ? await resolveFilterOptionsForEntry(
              {
                ...filter,
                profile: {
                  allowedValueMode: "all",
                  allowedValues: [],
                },
              },
              getActiveOrganizationId(),
              previewDefaults,
              {},
              catalog,
            )
          : [],
    })),
  );

  wrap.innerHTML = `${optionSets
    .map(({ filter, profile, options }, index) => {
      const selectOptions = options
        .map(
          (option) =>
            `<option value="${escAttr(option.value)}" ${
              String(profile.defaultValue || "") === String(option.value)
                ? "selected"
                : ""
            }>${escHtml(option.label)}</option>`,
        )
        .join("");
      return `
                <div style="border:1px solid var(--border);border-radius:14px;padding:12px;background:#fff;margin-bottom:10px">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--text)">
                      <input type="checkbox" ${profile.enabled ? "checked" : ""} onchange="toggleTemplateFilterEnabled('${filter.id}', this.checked)">
                      ${escHtml(filter.label)}
                    </label>
                    <span style="font-size:10px;color:var(--text3);background:var(--surface2);padding:2px 6px;border-radius:999px;border:1px solid var(--border)">:${escHtml(filter.key)}</span>
                    <span style="font-size:10px;color:var(--text3)">${escHtml(filter.type)}</span>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
                    <label style="font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:center"><input type="checkbox" ${profile.adminEnabled ? "checked" : ""} onchange="updateTemplateFilterBool('${filter.id}','adminEnabled',this.checked)"> Utilisable dans l'admin</label>
                    <label style="font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:center"><input type="checkbox" ${profile.userEnabled ? "checked" : ""} onchange="updateTemplateFilterBool('${filter.id}','userEnabled',this.checked)"> Utilisable côté user</label>
                    <label style="font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:center"><input type="checkbox" ${profile.required ? "checked" : ""} onchange="updateTemplateFilterBool('${filter.id}','required',this.checked)"> Obligatoire</label>
                    <label style="font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:center"><input type="checkbox" ${profile.locked ? "checked" : ""} onchange="updateTemplateFilterBool('${filter.id}','locked',this.checked)"> Verrouillé</label>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:10px">
                    <div>
                      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Valeur par défaut</div>
                      ${
                        filter.type === "select"
                          ? `<select class="charter-bar-select" style="width:100%" onchange="updateTemplateFilterDefault('${filter.id}', this.value)">
                              <option value="">— Aucune —</option>
                              ${selectOptions}
                            </select>`
                          : `<input class="tname-input" style="width:100%;height:34px" value="${escAttr(profile.defaultValue || "")}" onchange="updateTemplateFilterDefault('${filter.id}', this.value)" placeholder="${escAttr(filter.placeholder || "Valeur par défaut")}">`
                      }
                    </div>
                    ${
                      filter.type === "select"
                        ? `<div>
                            <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Valeurs autorisées</div>
                            <select class="charter-bar-select" style="width:100%" onchange="updateTemplateFilterAllowedMode('${filter.id}', this.value)">
                              <option value="all" ${profile.allowedValueMode !== "subset" ? "selected" : ""}>Toutes les valeurs possibles</option>
                              <option value="subset" ${profile.allowedValueMode === "subset" ? "selected" : ""}>Sous-ensemble choisi</option>
                            </select>
                          </div>`
                        : `<div style="font-size:11px;color:var(--text3);display:flex;align-items:flex-end">${escHtml(filter.helpText || "Filtre libre sans liste prédéfinie.")}</div>`
                    }
                  </div>
                  ${
                    filter.type === "select" &&
                    profile.allowedValueMode === "subset"
                      ? `<div style="margin-top:10px;padding:10px;border:1px dashed var(--border);border-radius:12px;background:#fbfcfe">
                          <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Choisissez les valeurs autorisées pour ce template.</div>
                          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                            ${
                              options.length
                                ? options
                                    .map(
                                      (option) =>
                                        `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);padding:4px 8px;border:1px solid var(--border);border-radius:999px;background:#fff">
                                        <input type="checkbox" ${
                                          (profile.allowedValues || []).some(
                                            (entry) =>
                                              entry.value === option.value,
                                          )
                                            ? "checked"
                                            : ""
                                        } onchange="toggleTemplateFilterAllowedValue('${filter.id}','${escAttr(option.value)}','${escAttr(option.label)}',this.checked)">
                                        ${option.label === option.value ? escHtml(option.label) : `${escHtml(option.label)} (${escHtml(option.value)})`}
                                      </label>`,
                                    )
                                    .join("")
                                : '<span style="font-size:11px;color:var(--text3)">Aucune valeur détectée pour le moment.</span>'
                            }
                          </div>
                          <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <input id="customAllowedValue_${index}" class="tname-input" style="height:34px;flex:1;min-width:180px" placeholder="Valeur personnalisée">
                            <input id="customAllowedLabel_${index}" class="tname-input" style="height:34px;flex:1;min-width:180px" placeholder="Libell - (optionnel)">
                            <button class="btn ghost sm" onclick="addCustomTemplateAllowedValue('${filter.id}', ${index})">Ajouter</button>
                          </div>
                          ${
                            (profile.allowedValues || []).length
                              ? `<div style="margin-top:8px;font-size:11px;color:var(--text2)">Sélection actuelle : ${(
                                  profile.allowedValues || []
                                )
                                  .map((option) =>
                                    formatAllowedFilterOption(option),
                                  )
                                  .join("  - ")}</div>`
                              : ""
                          }
                        </div>`
                      : ""
                  }
                </div>`;
    })
    .join("")}
        `;
}

async function refreshAdminFilterRuntime(preserveValues = true) {
  const fam = curFamId ? DB.getFamily(curFamId) : null;
  const tpl = curTplId ? DB.getTemplate(curTplId) : null;
  if (!fam || !tpl) {
    adminResolvedFilters = [];
    adminFilterValues = {};
    return [];
  }
  const seedValues = preserveValues
    ? adminFilterValues
    : getDefaultFilterValues(fam, tpl, "admin");
  adminResolvedFilters = await resolveTemplateFiltersForRole(
    curFamId,
    curTplId,
    "admin",
    getActiveOrganizationId(),
    seedValues,
  );
  adminFilterValues = validateRuntimeFilterValues(
    adminResolvedFilters,
    seedValues,
  );
  adminResolvedFilters.forEach((entry) => {
    if (entry.profile.locked) {
      adminFilterValues[entry.id] = normalizeFilterInputValue(
        entry,
        entry.profile.defaultValue,
      );
    }
  });
  renderAdminPreviewFilters();
  return adminResolvedFilters;
}

function renderAdminPreviewFilters() {
  const wrap = document.getElementById("prevFiltersWrap");
  if (!wrap) return;
  if (!adminResolvedFilters.length) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;width:100%;margin-bottom:6px">
            ${adminResolvedFilters
              .map((entry) => {
                const value = adminFilterValues?.[entry.id] || "";
                const help = entry.helpText
                  ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">${escHtml(entry.helpText)}</div>`
                  : "";
                if (entry.type === "select") {
                  return `
                    <label style="font-size:11px;color:var(--text2);font-weight:600">
                      ${escHtml(entry.label)}${entry.profile.required ? " *" : ""}
                      <select onchange="onAdminPreviewFilterChange('${entry.id}', this.value)" ${
                        entry.profile.locked ? "disabled" : ""
                      } style="display:block;width:100%;margin-top:6px;font-size:12px;border:1px solid var(--border);border-radius:var(--r);padding:6px 10px;background:var(--surface2);color:var(--text)">
                        <option value="">— Toutes / vide —</option>
                        ${(entry.options || [])
                          .map(
                            (option) =>
                              `<option value="${escAttr(option.value)}" ${
                                String(value) === String(option.value)
                                  ? "selected"
                                  : ""
                              }>${escHtml(option.label)}</option>`,
                          )
                          .join("")}
                      </select>
                      ${help}
                    </label>`;
                }
                return `
                  <label style="font-size:11px;color:var(--text2);font-weight:600">
                    ${escHtml(entry.label)}${entry.profile.required ? " *" : ""}
                    <input type="${
                      entry.type === "number"
                        ? "number"
                        : entry.type === "date"
                          ? "date"
                          : "text"
                    }" value="${escAttr(value)}" placeholder="${escAttr(entry.placeholder || "")}" onchange="onAdminPreviewFilterChange('${entry.id}', this.value)" ${
                      entry.profile.locked ? "readonly" : ""
                    } style="display:block;width:100%;margin-top:6px;font-size:12px;border:1px solid var(--border);border-radius:var(--r);padding:6px 10px;background:var(--surface2);color:var(--text)">
                    ${help}
                  </label>`;
              })
              .join("")}
          </div>`;
}

window.toggleTemplateFilterEnabled = async function (filterId, checked) {
  saveTemplateProfileEntry(filterId, (entry) => ({
    ...entry,
    enabled: checked,
  }));
  await renderTemplateFilterProfilePanel();
  await refreshAdminFilterRuntime(false);
};

window.updateTemplateFilterBool = async function (filterId, field, checked) {
  saveTemplateProfileEntry(filterId, (entry) => ({
    ...entry,
    [field]: checked,
  }));
  await renderTemplateFilterProfilePanel();
  await refreshAdminFilterRuntime(true);
};

window.updateTemplateFilterDefault = async function (filterId, value) {
  saveTemplateProfileEntry(filterId, (entry) => ({
    ...entry,
    defaultValue: value || null,
  }));
  await renderTemplateFilterProfilePanel();
  await refreshAdminFilterRuntime(false);
};

window.updateTemplateFilterAllowedMode = async function (filterId, value) {
  saveTemplateProfileEntry(filterId, (entry) => ({
    ...entry,
    allowedValueMode: value === "subset" ? "subset" : "all",
    allowedValues: value === "subset" ? entry.allowedValues || [] : [],
  }));
  await renderTemplateFilterProfilePanel();
  await refreshAdminFilterRuntime(false);
};

window.toggleTemplateFilterAllowedValue = async function (
  filterId,
  value,
  label,
  checked,
) {
  saveTemplateProfileEntry(filterId, (entry) => {
    const current = normalizeFilterOptions(entry.allowedValues || []);
    const map = new Map(current.map((option) => [option.value, option]));
    if (checked) map.set(value, { value, label });
    else map.delete(value);
    return {
      ...entry,
      allowedValues: [...map.values()],
    };
  });
  await renderTemplateFilterProfilePanel();
  await refreshAdminFilterRuntime(false);
};

window.addCustomTemplateAllowedValue = async function (filterId, index) {
  const valueInput = document.getElementById(`customAllowedValue_${index}`);
  const labelInput = document.getElementById(`customAllowedLabel_${index}`);
  const value = valueInput?.value?.trim();
  const label = labelInput?.value?.trim() || value;
  if (!value) {
    toast("Saisissez une valeur personnalisée", "error");
    return;
  }
  saveTemplateProfileEntry(filterId, (entry) => {
    const current = normalizeFilterOptions(entry.allowedValues || []);
    const map = new Map(current.map((option) => [option.value, option]));
    map.set(value, { value, label });
    return {
      ...entry,
      allowedValueMode: "subset",
      allowedValues: [...map.values()],
    };
  });
  if (valueInput) valueInput.value = "";
  if (labelInput) labelInput.value = "";
  await renderTemplateFilterProfilePanel();
  await refreshAdminFilterRuntime(false);
};

window.onAdminPreviewFilterChange = async function (filterId, value) {
  adminFilterValues = {
    ...adminFilterValues,
    [filterId]: value || null,
  };
  await refreshAdminFilterRuntime(true);
  await populatePreviewBeneficiaries();
  await window.refreshPrev();
};

window.newTemplate = function () {
  if (!curFamId) {
    toast("Sélectionnez d'abord une famille", "error");
    return;
  }
  const fam = DB.getFamily(curFamId);
  const tpl = createTemplateFromGraphicCharter(
    getActiveOrganizationId(),
    curFamId,
    "Nouveau template - " + fam.nom,
    getSelectedGraphicCharterId() ||
      getDefaultOrganizationGraphicCharterId(getActiveOrganizationId()),
  );
  tpl.nom = "Nouveau template - " + fam.nom;
  DB.saveTemplate(tpl);
  /*
          nom: "Nouveau template  - " + fam.nom,
            '<p style="text-align:center"><strong>{{nom_etab}}</strong></p><p style="text-align:center;font-size:10pt;color:#666">{{adresse_etab}}  - Tél : {{tel_etab}}</p>',
          body: "<p>Rédigez le contenu du document ici.</p>",
          footer:
            '<p style="text-align:center;font-size:9pt;color:#999">Document officiel  - {{nom_etab}}  - Année {{annee_univ}}</p>',
        */
  curTplId = tpl.id;
  renderTplList(curFamId);
  openTemplate(tpl.id, { lightweight: true });
  toast("Nouveau template créé", "success");
};

window.duplicateTemplate = function (tplId) {
  const source = DB.getTemplate(tplId);
  if (!source) {
    toast("Template introuvable", "error");
    return;
  }
  const copy = cloneData(source);
  copy.id = genId("tpl");
  copy.nom = `${source.nom || "Template"} (copie)`;
  copy.updatedAt = new Date().toISOString();
  DB.saveTemplate(copy);
  curTplId = copy.id;
  renderTplList(curFamId);
  openTemplate(copy.id, { lightweight: true });
  toast("Template dupliqué", "success");
};

window.saveTemplate = function () {
  if (!curTplId || !editorBody) return;
  const tpl = DB.getTemplate(curTplId);
  tpl.nom = document.getElementById("tnameInput").value || tpl.nom;
  tpl.header = editorHeader ? getEditorHTML(editorHeader) : "";
  tpl.body = getEditorHTML(editorBody);
  tpl.footer = editorFooter ? getEditorHTML(editorFooter) : "";
  tpl.hasHeader = headerEnabled;
  tpl.hasFooter = footerEnabled;
  tpl.graphicCharterId =
    getSelectedGraphicCharterId() ||
    getDefaultOrganizationGraphicCharterId(getActiveOrganizationId());
  tpl.pageMargins = getCurrentPageMargins();
  tpl.headerFooterDistances = getCurrentHeaderFooterDistances();
  tpl.orientation = getCurrentPageOrientation();
  tpl.sectionDirections = normalizeTemplateSectionDirections(
    currentSectionDirections,
  );
  tpl.updatedAt = new Date().toISOString();
  DB.saveTemplate(tpl);
  renderTplList(curFamId);
  setSaveState("Enregistré", false);
  toast("Template enregistr - avec succès", "success");
};

window.switchSection = function (sec) {
  if (sec === "header" && !headerEnabled) return;
  if (sec === "footer" && !footerEnabled) return;
  currentAdminSection = sec;

  ["header", "body", "footer", "filters"].forEach((s) => {
    const tabEl = document.getElementById("tab-" + s);
    if (tabEl) tabEl.classList.toggle("on", s === sec);
  });

  const canvas = document.getElementById("editorCanvasSection");
  const filters = document.getElementById("templateFilterProfilePanelWrap");
  const toolbar = document.getElementById("edToolbar");
  const showFilters = sec === "filters";
  if (canvas) canvas.classList.toggle("on", !showFilters);
  if (filters) filters.classList.toggle("on", showFilters);
  if (toolbar) toolbar.classList.toggle("is-muted", showFilters);
  if (showFilters) return;

  const edMap = {
    header: editorHeader,
    body: editorBody,
    footer: editorFooter,
  };
  const ed = edMap[sec];
  if (ed) {
    try {
      ed.commands.focus();
    } catch (_) {}
    activeEditor = ed;
    applyDirectionToEditor(ed, currentSectionDirections?.[sec] || "ltr");
  }
  applyCurrentSectionDirectionUI(sec);
  updateGraphicCharterSectionActions();
};

window.toggleSection = function (sec) {
  if (sec === "header") headerEnabled = !headerEnabled;
  else footerEnabled = !footerEnabled;
  updateSectionVisibility();
  switchSection(
    sec === "header"
      ? headerEnabled
        ? "header"
        : "body"
      : footerEnabled
        ? "footer"
        : "body",
  );
  toast(
    sec === "header"
      ? headerEnabled
        ? "En-tête activé"
        : "En-tête désactivé"
      : footerEnabled
        ? "Pied activé"
        : "Pied désactivé",
  );
  onEditorChange();
};

function updateSectionVisibility() {
  document.getElementById("sec-header").style.display = headerEnabled
    ? "block"
    : "none";
  document.getElementById("sec-footer").style.display = footerEnabled
    ? "block"
    : "none";
  const tH = document.getElementById("toggleHeader");
  tH.classList.toggle("on", headerEnabled);
  tH.textContent = headerEnabled ? "• En-tête ON" : "• En-tête OFF";
  const tF = document.getElementById("toggleFooter");
  tF.classList.toggle("on", footerEnabled);
  tF.textContent = footerEnabled ? "• Pied ON" : "• Pied OFF";
  document
    .getElementById("tab-header")
    .classList.toggle("disabled", !headerEnabled);
  document
    .getElementById("tab-footer")
    .classList.toggle("disabled", !footerEnabled);
  const body = document.getElementById("sec-body");
  body.classList.toggle("no-header", !headerEnabled);
  body.classList.toggle("no-footer", !footerEnabled);
  scheduleEditorPaginationRefresh();

  // Recalculer les délimiteurs des pages
  setTimeout(() => {
    rebuildEditorPageVisualizer();
    scheduleEditorPaginationRefresh();
  }, 50);
}

window.confirmDelTpl = function (id) {
  pendingDelId = id;
  document.getElementById("delTplTitle").textContent =
    "Supprimer le template ?";
  document.getElementById("delTplMsg").textContent =
    "Ce template sera définitivement supprimé.";
  document.getElementById("delTplBtn").onclick = () => {
    DB.deleteTemplate(pendingDelId);
    if (curTplId === pendingDelId) {
      curTplId = null;
      clearEditor();
    }
    renderTplList(curFamId);
    closeModal("modalDelTpl");
    toast("Template supprimé");
  };
  openModal("modalDelTpl");
};

window.openWatermarkModal = function () {
  if (!curTplId) {
    toast("Ouvrez d'abord un template", "error");
    return;
  }
  openModal("modalWatermark");
};
window.applyWatermark = function () {
  const text = document.getElementById("wm-text").value || "CONFIDENTIEL",
    color = document.getElementById("wm-color").value || "#000000",
    opacity =
      (parseInt(document.getElementById("wm-opacity").value) || 7) / 100,
    size = parseInt(document.getElementById("wm-size").value) || 80;
  const wm = document.getElementById("docWatermark"),
    sp = document.getElementById("wmText");
  wm.style.display = "flex";
  sp.textContent = text;
  sp.style.fontSize = size + "px";
  sp.style.color = color;
  sp.style.opacity = opacity;
  closeModal("modalWatermark");
  toast("Filigrane appliqué");
};
window.removeWatermark = function () {
  document.getElementById("docWatermark").style.display = "none";
  closeModal("modalWatermark");
  toast("Filigrane supprimé");
};

function getCurrentPageOrientation() {
  const sel = document.getElementById("pg-orientation");
  if (!sel) return "portrait";
  return sel.value === "landscape" ? "landscape" : "portrait";
}

window.openPageSettings = function () {
  if (!curTplId) {
    toast("Ouvrez d'abord un template", "error");
    return;
  }
  const orientation = getCurrentPageOrientation();
  const sel = document.getElementById("pg-orientation");
  if (sel) sel.value = orientation;
  applyPageMarginsToUI(getCurrentPageMargins());
  applyHeaderFooterDistancesToUI(getCurrentHeaderFooterDistances());
  applyPageOrientationToUI(orientation);
  openModal("modalPageSettings");
};
window.applyPageMargins = function () {
  const margins = applyPageMarginsToUI(getCurrentPageMargins());
  const distances = applyHeaderFooterDistancesToUI(
    getCurrentHeaderFooterDistances(),
  );
  const tpl = curTplId ? DB.getTemplate(curTplId) : null;
  if (tpl) {
    tpl.headerFooterDistances = distances;
    DB.saveTemplate(tpl);
  }
  const orientation = getCurrentPageOrientation();
  applyPageOrientationToUI(orientation);
  closeModal("modalPageSettings");
  setTimeout(() => {
    rebuildEditorPageVisualizer();
    scheduleEditorPaginationRefresh();
  }, 50);
  toast(
    `Marges : haut ${margins.mt}mm  - bas ${margins.mb}mm  - gauche ${margins.ml}mm  - droite ${margins.mr}mm  - en-tête ${distances.headerTop}mm  - pied ${distances.footerBottom}mm  - orientation ${orientation}`,
  );
};
window.resetPageMargins = function () {
  const charter = curTplId
    ? getTemplateGraphicCharter(DB.getTemplate(curTplId))
    : normalizeGraphicCharterConfig({});
  applyPageMarginsToUI(normalizeMargins(charter.layout.pageMargins));
  applyHeaderFooterDistancesToUI(charter.layout.headerFooterDistances);
  window.applyPageMargins();
};

function buildLivePreviewTemplate() {
  const tpl = curTplId ? DB.getTemplate(curTplId) : null;
  if (!tpl || !editorBody) return null;
  return {
    ...tpl,
    graphicCharterId:
      getSelectedGraphicCharterId() || tpl.graphicCharterId || null,
    header: headerEnabled && editorHeader ? getEditorHTML(editorHeader) : "",
    body: getEditorHTML(editorBody),
    footer: footerEnabled && editorFooter ? getEditorHTML(editorFooter) : "",
    hasHeader: headerEnabled,
    hasFooter: footerEnabled,
    orientation: getCurrentPageOrientation(),
    pageMargins: getCurrentPageMargins(),
    headerFooterDistances: getCurrentHeaderFooterDistances(),
    sectionDirections: normalizeTemplateSectionDirections(
      currentSectionDirections,
    ),
  };
}
async function populatePreviewBeneficiaries() {
  const fam = curFamId ? DB.getFamily(curFamId) : null;
  const sel = document.getElementById("prevPerson");
  const label = document.getElementById("prevTargetLabel");
  if (!sel || !fam) return [];
  const previousValue = sel.value;
  const beneficiaries = await DB.getBeneficiariesForFamily(
    curFamId,
    getActiveOrganizationId(),
    adminFilterValues,
  );
  sel.innerHTML = "";
  beneficiaries.forEach((item) => {
    const o = document.createElement("option");
    o.value = item.id;
    o.textContent = item._displaySubtitle
      ? `${item._displayLabel}  - ${item._displaySubtitle}`
      : item._displayLabel;
    sel.appendChild(o);
  });
  if (beneficiaries.length) {
    const preserved = beneficiaries.find(
      (item) => String(item.id) === String(previousValue),
    );
    sel.value = preserved ? preserved.id : beneficiaries[0].id;
  }
  if (label) {
    label.textContent =
      fam.beneficiaryMode === "organization"
        ? "Organization :"
        : `${getFamilyBeneficiaryLabel(fam)} :`;
  }
  return beneficiaries;
}

window.filterPreviewBeneficiaries = function () {
  const sel = document.getElementById("prevPerson");
  const search = String(
    document.getElementById("prevPersonSearch")?.value || "",
  )
    .trim()
    .toLowerCase();
  if (!sel) return;
  let firstVisible = null;
  [...sel.options].forEach((option) => {
    const visible =
      !search || option.textContent.toLowerCase().includes(search);
    option.hidden = !visible;
    if (visible && !firstVisible) firstVisible = option;
  });
  if (sel.selectedOptions[0]?.hidden && firstVisible) {
    sel.value = firstVisible.value;
    window.refreshPrev();
  }
};

window.openPreviewModal = async function () {
  if (!curTplId || !editorBody) {
    toast("Ouvrez d'abord un template", "error");
    return;
  }
  await refreshAdminFilterRuntime(true);
  await populatePreviewBeneficiaries();
  const search = document.getElementById("prevPersonSearch");
  if (search) search.value = "";
  await window.refreshPrev();
  openModal("modalPreview");
};

window.refreshPrev = async function () {
  const beneficiaryId = document.getElementById("prevPerson")?.value || null;
  const person = await DB.getDocumentDataForFamily(
    curFamId,
    beneficiaryId,
    getActiveOrganizationId(),
    adminFilterValues,
  );
  const liveTpl = buildLivePreviewTemplate();
  const prevPage = document.getElementById("prevContent");
  if (!liveTpl || !prevPage) return;
  if (!person) {
    prevPage.innerHTML =
      '<div style="font-size:12px;color:var(--text3);text-align:center;padding:30px 20px">Aucune donnée  - afficher avec les filtres actuels.</div>';
    adminPreviewState = null;
    return;
  }
  prevPage.innerHTML = "";
  prevPage.className = "preview-pages";

  const pages = renderDocumentPages(liveTpl, person, { mode: "preview" });
  adminPreviewState = null;
  if (!pages.length) {
    prevPage.innerHTML =
      '<div style="font-size:12px;color:var(--text3);text-align:center;padding:30px 20px">Aucun contenu  - afficher</div>';
    return;
  }

  adminPreviewState = {
    tplId: curTplId,
    beneficiaryId,
    pages,
  };

  prevPage.innerHTML = buildDocumentPagesHtml(liveTpl, pages, "preview-page", {
    mode: "preview",
  });
};

window.doPrintFromPreview = async function () {
  const beneficiaryId = document.getElementById("prevPerson")?.value || null;
  const person = await DB.getDocumentDataForFamily(
    curFamId,
    beneficiaryId,
    getActiveOrganizationId(),
    adminFilterValues,
  );
  const liveTpl = buildLivePreviewTemplate();
  if (!liveTpl) {
    toast("Aucun template actif", "error");
    return;
  }
  if (!person) {
    toast(
      "Sélectionnez un bénéficiaire ou l'Organization pour imprimer",
      "error",
    );
    return;
  }
  printDocPaginated(liveTpl, person);
};

// -- Zoom --
window.setZoom = function (delta) {
  if (delta === 0) zoomLv = 100;
  else zoomLv = Math.max(40, Math.min(220, zoomLv + delta));
  const sc = document.getElementById("zoomScaler");
  sc.style.transform = `scale(${zoomLv / 100})`;
  sc.style.marginBottom =
    zoomLv < 100 ? ((100 - zoomLv) / 100) * -500 + "px" : "0";
  document.getElementById("zoomLbl").textContent = zoomLv + "%";
  document.getElementById("sbZoom").textContent = zoomLv + "%";
  scheduleEditorPaginationRefresh();
};

// -- Search & replace --
let srchMatches = [],
  srchIdx = 0;
window.openSearchPanel = function () {
  document.getElementById("searchPanel").classList.toggle("on");
  if (document.getElementById("searchPanel").classList.contains("on"))
    setTimeout(() => document.getElementById("srch-find").focus(), 60);
};
window.closeSearchPanel = function () {
  document.getElementById("searchPanel").classList.remove("on");
};
function escRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
window.doSearch = function () {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const term = document.getElementById("srch-find").value;
  if (!term) {
    document.getElementById("srch-count").textContent = "0/0";
    srchMatches = [];
    return;
  }
  const cs = document.getElementById("srch-case").checked,
    txt = ed.getText();
  srchMatches = [];
  srchIdx = 0;
  const re = new RegExp(escRegex(term), cs ? "g" : "gi");
  let m;
  while ((m = re.exec(txt)) !== null) srchMatches.push(m.index);
  document.getElementById("srch-count").textContent = srchMatches.length
    ? `1/${srchMatches.length}`
    : "0/0";
};
window.srchNav = function (dir) {
  if (!srchMatches.length) {
    window.doSearch();
    return;
  }
  srchIdx = (srchIdx + dir + srchMatches.length) % srchMatches.length;
  document.getElementById("srch-count").textContent =
    `${srchIdx + 1}/${srchMatches.length}`;
};
window.doReplaceOne = function () {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const t = document.getElementById("srch-find").value,
    r = document.getElementById("srch-replace").value;
  if (!t) return;
  const cs = document.getElementById("srch-case").checked;
  setEditorHTML(
    ed,
    getEditorHTML(ed).replace(new RegExp(escRegex(t), cs ? "" : "i"), r),
  );
  window.doSearch();
  toast("Remplacement effectué");
};
window.doReplaceAll = function () {
  const ed = activeEditor || editorBody;
  if (!ed) return;
  const t = document.getElementById("srch-find").value,
    r = document.getElementById("srch-replace").value;
  if (!t) return;
  const cs = document.getElementById("srch-case").checked;
  const re = new RegExp(escRegex(t), cs ? "g" : "gi");
  const h = getEditorHTML(ed);
  const n = (h.match(re) || []).length;
  setEditorHTML(ed, h.replace(re, r));
  toast(`${n} occurrence(s) remplacée(s)`, "success");
  window.doSearch();
};

// -- UI helpers --
window.toggleSidebar = function () {
  document.getElementById("sidebarEl").classList.toggle("closed");
};
window.toggleCpop = function (id, e) {
  e.stopPropagation();
  const p = document.getElementById(id);
  const was = p.classList.contains("on");
  closeAllCpops();
  if (!was) p.classList.add("on");
};
function closeAllCpops() {
  document
    .querySelectorAll(".cpop.on")
    .forEach((p) => p.classList.remove("on"));
}
window.showCtxMenu = function (e) {
  const m = document.getElementById("ctxMenu");
  m.style.left = Math.min(e.clientX, window.innerWidth - 180) + "px";
  m.style.top = Math.min(e.clientY, window.innerHeight - 210) + "px";
  m.classList.add("on");
};
window.closeCtx = function () {
  document.getElementById("ctxMenu").classList.remove("on");
};
window.openImgModal = function () {
  openModal("modalImage");
};
window.openTableModal = function () {
  openModal("modalTable");
};
window.openLinkModal = function () {
  openModal("modalLink");
};

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSwatches(id, colors, cb) {
  const g = document.getElementById(id);
  if (!g) return;
  g.innerHTML = "";
  colors.forEach((c) => {
    const sw = document.createElement("div");
    sw.className = "cswatch";
    sw.style.background =
      c === "transparent"
        ? "linear-gradient(135deg,#fff 45%,#f00 45%,#f00 55%,#fff 55%)"
        : c;
    sw.title = c;
    sw.onclick = () => cb(c);
    g.appendChild(sw);
  });
}
function buildTblColorSwatches() {
  [
    ["tblClrSwatches", CELL_COLORS, window.applyTblCellBg],
    ["tblTxtSwatches", CELL_TXT, window.applyTblCellTxt],
  ].forEach(([id, cols, fn]) => {
    const g = document.getElementById(id);
    if (!g) return;
    g.innerHTML = "";
    cols.forEach((c) => {
      const sw = document.createElement("div");
      sw.className = "tbl-clr-sw";
      sw.style.background = c;
      sw.title = c;
      sw.onclick = () => fn(c);
      g.appendChild(sw);
    });
  });
}
function buildTableGrid() {
  const g = document.getElementById("tgCells");
  if (!g) return;
  g.innerHTML = "";
  for (let r = 1; r <= 8; r++)
    for (let c = 1; c <= 10; c++) {
      const cell = document.createElement("div");
      cell.className = "tgcell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener("mouseenter", () => {
        document
          .querySelectorAll(".tgcell")
          .forEach((el) =>
            el.classList.toggle("hi", +el.dataset.r <= r && +el.dataset.c <= c),
          );
        document.getElementById("tgSize").textContent = `Tableau ${r}  - ${c}`;
        document.getElementById("ti-rows").value = r;
        document.getElementById("ti-cols").value = c;
      });
      cell.addEventListener("click", () => {
        window.doInsertTable();
        closeModal("modalTable");
      });
      g.appendChild(cell);
    }
  g.addEventListener("mouseleave", () =>
    document
      .querySelectorAll(".tgcell")
      .forEach((el) => el.classList.remove("hi")),
  );
}

// -- Keyboard shortcuts --
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    window.saveTemplate();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    window.openSearchPanel();
  }
  if (e.key === "Escape") {
    window.closeCtx();
    closeAllCpops();
    window.closeSearchPanel();
    closeTblPops();
    document
      .querySelectorAll(".modal-overlay.open")
      .forEach((m) => m.classList.remove("open"));
  }
});
document.addEventListener("click", (e) => {
  window.closeCtx();
  if (!e.target.closest(".tb-clr")) closeAllCpops();
  if (e.target.classList.contains("modal-overlay"))
    e.target.classList.remove("open");
  if (!e.target.closest(".tiptap-wrapper") && !e.target.closest(".tbl-toolbar"))
    document.getElementById("tblToolbar").classList.remove("on");
});
window.addEventListener("resize", () => {
  [editorHeader, editorBody, editorFooter]
    .filter(Boolean)
    .forEach((ed) => _scheduleTableAutoFit(ed, "clamp", "all"));
  scheduleEditorPaginationRefresh();
});

// -- BOOT --
buildSwatches("sw-text", TEXT_COLORS, (c) => window.applyTextColor(c));
buildSwatches("sw-bg", BG_COLORS, (c) => window.applyHighlight(c));
buildTableGrid();
buildTblColorSwatches();
(async () => {
  const authUser = await requireAuth("admin");
  if (!authUser) return;
  await DB.init();
  populateFamilySelect();
  document.getElementById("loading").classList.add("done");
  document.getElementById("app").style.opacity = "1";
})();
