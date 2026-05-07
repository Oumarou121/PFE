let ORGANIZATION_ID = null;
let selFamId = null,
  selTplId = null,
  selPersonId = null;
let currentBeneficiaries = [];
let userResolvedFilters = [];
let userFilterValues = {};
let openSteps = { 1: true, 2: false, 3: false };
let zoomLv = 100;
let userMode = "documents";
let selectedUserDataViewId = null;
let userDataRows = [];
let userDataSelectedRowId = null;
let userDataSelectedRecord = null;
let userDataSearch = "";
let familySearch = "";
let templateSearch = "";
let beneficiarySearch = "";
let userDataLookupOptionsCache = {};
let isCreatingUserDataRow = false;
let userDataSearchTimer = null;
let userDataNeedsReload = false;

window.addEventListener("DOMContentLoaded", async () => {
  const authUser = await requireAuth("user");
  if (!authUser) return;
  await DB.ensureResources(["organizations", "families", "templates"]);
  ORGANIZATION_ID =
    authUser.organizationId || DB.getOrganizations()[0]?.id || null;
  const etab = DB.getOrganization(ORGANIZATION_ID);
  if (etab) {
    document.getElementById("navOrganization").textContent = etab.nom;
    document.getElementById("heroBadge").textContent = etab.nom;
  }
  buildFamGrid();
  setTimeout(() => {
    document.getElementById("loading").classList.add("done");
    document.getElementById("mainApp").style.opacity = "1";
  }, 500);
});

/* Ã¢â€â‚¬Ã¢â€â‚¬ STEPPER Ã¢â€â‚¬Ã¢â€â‚¬ */
function toggleStep(n) {
  openSteps[n] = !openSteps[n];
  syncStepBodies();
}
function openStep(n) {
  openSteps[n] = true;
  syncStepBodies();
}
function closeStep(n) {
  openSteps[n] = false;
  syncStepBodies();
}
function syncStepBodies() {
  for (let i = 1; i <= 3; i++) {
    document.getElementById("sb" + i)?.classList.toggle("open", !!openSteps[i]);
    const sc = document.getElementById("sc" + i);
    if (sc) sc.style.transform = openSteps[i] ? "rotate(180deg)" : "";
  }
}

function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

async function ensureUserDataViewsLoaded() {
  if (DB._cache?._loaded?.tableViews) return;
  const wrap = document.getElementById("userDataViewList");
  if (wrap) {
    wrap.innerHTML =
      '<div class="data-empty">Chargement des vues de données...</div>';
  }
  await DB.ensureResources(["tableViews"]);
}

async function switchUserMode(mode) {
  userMode = mode === "data" ? "data" : "documents";
  document
    .getElementById("modeDocumentsBtn")
    ?.classList.toggle("active", userMode === "documents");
  document
    .getElementById("modeDataBtn")
    ?.classList.toggle("active", userMode === "data");
  document
    .getElementById("documentsView")
    ?.classList.toggle("active", userMode === "documents");
  document
    .getElementById("dataView")
    ?.classList.toggle("active", userMode === "data");
  document.getElementById("heroIcon").textContent =
    userMode === "data" ? "🗂️" : "📄";
  document.getElementById("heroTitle").textContent =
    userMode === "data" ? "Gestion des données" : "Génération de documents";
  document.getElementById("heroText").textContent =
    userMode === "data"
      ? "Consultez et mettez à jour les données mises à disposition"
      : "Sélectionnez une famille, un modèle et une personne";
  if (userMode === "data") {
    await ensureUserDataViewsLoaded();
    renderUserDataViewsSidebar();
    renderUserDataContent();
  }
}
function setStepState(n, state) {
  const num = document.getElementById("sn" + n),
    lbl = document.getElementById("sl" + n),
    dot = document.getElementById("dot" + n);
  if (!num) return;
  num.className =
    "step-num" + (state === "done" ? " done" : state === "cur" ? " cur" : "");
  num.textContent = state === "done" ? "✓" : String(n);
  if (lbl) lbl.className = "step-lbl" + (state === "cur" ? " cur" : "");
  if (dot)
    dot.className =
      "step-dot" + (state === "done" ? " done" : state === "cur" ? " cur" : "");
}
function updatePbar() {
  const fam = selFamId ? DB.getFamily(selFamId) : null;
  const tpl = selTplId ? DB.getTemplate(selTplId) : null;
  const beneficiary = currentBeneficiaries.find(
    (item) => String(item.id) === String(selPersonId),
  );
  const ps1 = document.getElementById("ps1"),
    ps2 = document.getElementById("ps2"),
    ps3 = document.getElementById("ps3");
  const step3Default =
    fam?.beneficiaryMode === "organization" ? "Organization" : "Bénéficiaire";
  ps1.className = "pb-step" + (selFamId ? " done" : " cur");
  ps1.textContent = fam ? fam.nom.substring(0, 16) : "Famille";
  ps2.className = "pb-step" + (selTplId ? " done" : selFamId ? " cur" : "");
  ps2.textContent = tpl ? tpl.nom.substring(0, 16) : "Template";
  ps3.className = "pb-step" + (selPersonId ? " done" : selTplId ? " cur" : "");
  ps3.textContent = beneficiary
    ? (
        beneficiary._displayLabel ||
        beneficiary.nom_prenom ||
        beneficiary.nom ||
        step3Default
      ).substring(0, 14)
    : step3Default;
}

function getUserDataViews() {
  return DB.getTableViews();
}

function getSelectedUserDataView() {
  return selectedUserDataViewId
    ? DB.getTableView(selectedUserDataViewId)
    : null;
}

function getUserDataLookupCacheKey(viewId, fieldName) {
  return `${viewId}::${fieldName}`;
}

async function ensureUserDataLookupOptions(viewConfig, fieldName) {
  const key = getUserDataLookupCacheKey(viewConfig.id, fieldName);
  if (userDataLookupOptionsCache[key]) {
    return userDataLookupOptionsCache[key];
  }
  const options = await DB.getTableViewLookupOptions(
    viewConfig.id,
    fieldName,
    viewConfig,
  );
  userDataLookupOptionsCache[key] = options;
  return options;
}

function getUserDataFieldSetting(viewConfig, fieldName) {
  return (
    viewConfig?.fieldSettings?.[String(fieldName || "").trim()] || {
      displayMode: "raw",
      lookupTable: "",
      lookupValueColumn: "",
      lookupLabelColumn: "",
      lookupLabelColumn2: "",
    }
  );
}

function getUserDataFieldLabel(viewConfig, fieldName) {
  return getTableViewFieldLabel(viewConfig, fieldName);
}

function resolveUserDataDisplayValue(viewConfig, fieldName, rawValue) {
  const config = getUserDataFieldSetting(viewConfig, fieldName);
  if (config.displayMode !== "lookup") return rawValue ?? "";
  const key = getUserDataLookupCacheKey(viewConfig.id, fieldName);
  const options = userDataLookupOptionsCache[key] || [];
  const match = options.find(
    (option) => String(option.value || "") === String(rawValue ?? ""),
  );
  return match ? match.label : (rawValue ?? "");
}

function buildUserDataPreviewLabel(viewConfig, record = {}) {
  return (viewConfig?.previewFields || [])
    .map((field) =>
      resolveUserDataDisplayValue(viewConfig, field, record?.[field]),
    )
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" - ");
}

function renderUserDataViewsSidebar() {
  const wrap = document.getElementById("userDataViewList");
  if (!wrap) return;
  const search = String(
    document.getElementById("userDataViewSearch")?.value || "",
  )
    .trim()
    .toLowerCase();
  const views = getUserDataViews().filter(
    (item) =>
      !search ||
      item.label.toLowerCase().includes(search) ||
      item.tableName.toLowerCase().includes(search),
  );
  if (!views.length) {
    wrap.innerHTML =
      '<div class="data-empty">Aucune vue de données disponible.</div>';
    return;
  }
  wrap.innerHTML = views
    .map(
      (
        item,
      ) => `<div class="data-view-card ${item.id === selectedUserDataViewId ? "active" : ""}" onclick="selectUserDataView('${escAttr(item.id)}')">
              <div class="data-view-name">${escHtml(item.label || item.tableName)}</div>
            </div>`,
    )
    .join("");
}

async function selectUserDataView(viewId) {
  selectedUserDataViewId = viewId;
  userDataSelectedRowId = null;
  userDataSelectedRecord = null;
  userDataRows = [];
  userDataSearch = "";
  isCreatingUserDataRow = false;
  userDataNeedsReload = true;
  const searchInput = document.getElementById("userDataRowSearch");
  if (searchInput) searchInput.value = "";
  renderUserDataViewsSidebar();
  await renderUserDataContent();
}

async function updateUserDataSearch(value) {
  userDataSearch = String(value || "").trim();
  if (userDataSearchTimer) clearTimeout(userDataSearchTimer);
  userDataSearchTimer = setTimeout(() => {
    userDataNeedsReload = true;
    renderUserDataContent();
  }, 220);
}

async function reloadUserDataRows() {
  const viewConfig = getSelectedUserDataView();
  if (!viewConfig) return;
  userDataRows = await DB.getTableViewRows(viewConfig.id, {
    config: viewConfig,
    search: userDataSearch,
  });
  if (
    userDataSelectedRowId &&
    !userDataRows.some((row) => {
      const rowId = String(row.id ?? row.Id ?? Object.values(row)[0]);
      return rowId === userDataSelectedRowId;
    })
  ) {
    userDataSelectedRowId = userDataRows.length
      ? String(
          userDataRows[0].id ??
            userDataRows[0].Id ??
            Object.values(userDataRows[0])[0],
        )
      : null;
  }
  if (!userDataSelectedRowId && userDataRows.length) {
    userDataSelectedRowId = String(
      userDataRows[0].id ??
        userDataRows[0].Id ??
        Object.values(userDataRows[0])[0],
    );
  }
  userDataSelectedRecord = userDataSelectedRowId
    ? cloneData(
        userDataRows.find((row) => {
          const rowId = String(row.id ?? row.Id ?? Object.values(row)[0] ?? "");
          return rowId === userDataSelectedRowId;
        }) || null,
      )
    : null;
  userDataNeedsReload = false;
}

function selectUserDataRow(rowId) {
  isCreatingUserDataRow = false;
  userDataSelectedRowId = rowId;
  userDataSelectedRecord = cloneData(
    userDataRows.find((row) => {
      const currentRowId = String(
        row.id ?? row.Id ?? Object.values(row)[0] ?? "",
      );
      return currentRowId === rowId;
    }) || null,
  );
  renderUserDataContent();
}

async function createUserDataRow() {
  const viewConfig = getSelectedUserDataView();
  if (!viewConfig) return;
  isCreatingUserDataRow = true;
  userDataSelectedRowId = null;
  userDataSelectedRecord = Object.fromEntries(
    (viewConfig.visibleFields || []).map((field) => [field, ""]),
  );
  await renderUserDataContent();
}

async function saveUserDataRow() {
  const viewConfig = getSelectedUserDataView();
  if (!viewConfig) return;
  const values = {};
  (viewConfig.editableFields || []).forEach((field) => {
    const input = document.getElementById(`user_data_field_${field}`);
    if (input) values[field] = input.value;
  });
  if (isCreatingUserDataRow) {
    const record = await DB.createTableViewRecord(
      viewConfig.id,
      values,
      viewConfig,
    );
    userDataSelectedRecord = record;
    userDataSelectedRowId = String(
      record?.id ?? record?.Id ?? Object.values(record || {})[0] ?? "",
    );
    isCreatingUserDataRow = false;
    toast("Ligne ajoutée", "success");
  } else if (userDataSelectedRowId) {
    userDataSelectedRecord = await DB.saveTableViewRecord(
      viewConfig.id,
      userDataSelectedRowId,
      values,
    );
    toast("Ligne enregistrée", "success");
  }
  userDataNeedsReload = true;
  await renderUserDataContent();
}

function deleteUserDataRow() {
  const viewConfig = getSelectedUserDataView();
  if (!viewConfig) return;
  if (isCreatingUserDataRow) {
    isCreatingUserDataRow = false;
    userDataSelectedRecord = null;
    renderUserDataContent();
    return;
  }
  if (!userDataSelectedRowId) return;
  const sourceRow =
    userDataSelectedRecord ||
    userDataRows.find((row) => {
      const rowId = String(row.id ?? row.Id ?? Object.values(row)[0]);
      return rowId === userDataSelectedRowId;
    }) ||
    {};
  const label =
    buildUserDataPreviewLabel(viewConfig, sourceRow) || userDataSelectedRowId;
  document.getElementById("confirmTitle").textContent = "Supprimer la ligne ?";
  document.getElementById("confirmMsg").textContent =
    `La ligne "${label}" sera supprimée.`;
  document.getElementById("confirmBtn").onclick = () => {
    withBusy("Suppression en cours...", async () => {
      await DB.deleteTableViewRecord(viewConfig.id, userDataSelectedRowId);
      userDataSelectedRowId = null;
      userDataSelectedRecord = null;
      userDataNeedsReload = true;
      closeModal("modalConfirm");
      toast("Ligne supprimée", "success");
      await renderUserDataContent();
    }).catch((error) => {
      closeModal("modalConfirm");
      toast(error.message || "Suppression impossible", "error");
    });
  };
  openModal("modalConfirm");
}

async function renderUserDataContent() {
  const content = document.getElementById("userDataContent");
  const title = document.getElementById("userDataMainTitle");
  const sub = document.getElementById("userDataMainSub");
  const actions = document.getElementById("userDataMainActions");
  const viewConfig = getSelectedUserDataView();
  if (!content || !title || !sub || !actions) return;
  if (!viewConfig) {
    title.textContent = "Aucune vue sélectionnée";
    sub.textContent =
      "Les vues disponibles sont configurées par l’administrateur.";
    actions.style.display = "none";
    content.className = "data-empty";
    content.innerHTML = "Sélectionnez une vue de données pour commencer.";
    return;
  }
  title.textContent = viewConfig.label || viewConfig.tableName;
  sub.textContent = "Consultez les données disponibles.";
  actions.style.display = "flex";
  const searchInput = document.getElementById("userDataRowSearch");
  if (searchInput && searchInput.value !== userDataSearch) {
    searchInput.value = userDataSearch;
  }
  const lookupFields = Object.entries(viewConfig.fieldSettings || {})
    .filter(([, config]) => config?.displayMode === "lookup")
    .map(([field]) => field);
  for (const fieldName of lookupFields) {
    try {
      await ensureUserDataLookupOptions(viewConfig, fieldName);
    } catch (_) {}
  }
  if (!isCreatingUserDataRow && (userDataNeedsReload || !userDataRows.length)) {
    await withBusy("Chargement des données...", async () => {
      await reloadUserDataRows();
    });
  }

  const listHtml = !userDataRows.length
    ? '<div class="data-empty">Aucune ligne disponible.</div>'
    : `<table class="data-table"><thead><tr>${(viewConfig.previewFields || [])
        .map(
          (field) =>
            `<th>${escHtml(getUserDataFieldLabel(viewConfig, field))}</th>`,
        )
        .join("")}</tr></thead><tbody>${userDataRows
        .map((row) => {
          const rowId = String(row.id ?? row.Id ?? Object.values(row)[0]);
          return `<tr class="${rowId === userDataSelectedRowId ? "active" : ""}" onclick="selectUserDataRow('${escAttr(rowId)}')">${(
            viewConfig.previewFields || []
          )
            .map(
              (field) =>
                `<td>${escHtml(resolveUserDataDisplayValue(viewConfig, field, row[field]))}</td>`,
            )
            .join("")}</tr>`;
        })
        .join("")}</tbody></table>`;

  const detailRecord = userDataSelectedRecord;
  const detailHtml = !detailRecord
    ? '<div class="data-empty">Sélectionnez une ligne pour afficher le détail.</div>'
    : `<div class="data-detail-form">${(viewConfig.visibleFields || [])
        .map((field) => {
          const editable = (viewConfig.editableFields || []).includes(field);
          const value = detailRecord[field] ?? "";
          const fieldConfig = getUserDataFieldSetting(viewConfig, field);
          const lookupOptions =
            userDataLookupOptionsCache[
              getUserDataLookupCacheKey(viewConfig.id, field)
            ] || [];
          return `<label class="data-field">
                  <span class="data-field-label">${escHtml(getUserDataFieldLabel(viewConfig, field))}</span>
                  ${
                    editable
                      ? fieldConfig.displayMode === "lookup"
                        ? `<select class="data-field-input" id="user_data_field_${escAttr(field)}">
                            <option value="">Choisir...</option>
                            ${lookupOptions
                              .map(
                                (option) =>
                                  `<option value="${escAttr(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escHtml(option.label)}</option>`,
                              )
                              .join("")}
                          </select>`
                        : `<input class="data-field-input" id="user_data_field_${escAttr(field)}" value="${escAttr(value)}">`
                      : `<div class="data-field-readonly">${escHtml(resolveUserDataDisplayValue(viewConfig, field, value))}</div>`
                  }
                </label>`;
        })
        .join("")}
            <div class="data-detail-actions">
              <button class="nav-link" type="button" onclick="deleteUserDataRow()">Supprimer</button>
              <button class="nav-link" type="button" onclick="saveUserDataRow()" ${!(viewConfig.editableFields || []).length ? "disabled" : ""}>Enregistrer</button>
            </div></div>`;

  content.className = "";
  content.innerHTML = `
          <div class="data-grid">
            <div class="data-card">
              <div class="data-card-hdr">
                <div class="data-card-title">Liste</div>
                <div class="data-main-sub">${userDataRows.length} ligne(s)</div>
              </div>
              <div class="data-card-body data-card-body--table">${listHtml}</div>
            </div>
            <div class="data-card">
              <div class="data-card-hdr">
                <div class="data-card-title">${isCreatingUserDataRow ? "Nouvelle ligne" : "Détail"}</div>
                <div class="data-main-sub">${escHtml(isCreatingUserDataRow ? "Saisie" : buildUserDataPreviewLabel(viewConfig, detailRecord) || "Sélection")}</div>
              </div>
              <div class="data-card-body">${detailHtml}</div>
            </div>
          </div>`;
}

/* ETAPE 1 */
function refreshBeneficiaryLabels() {
  const fam = selFamId ? DB.getFamily(selFamId) : null;
  const sl3 = document.getElementById("sl3");
  const ps3 = document.getElementById("ps3");
  if (!sl3 || !ps3) return;
  const hasFilters = !!(selTplId && userResolvedFilters.length);
  if (fam?.beneficiaryMode === "organization") {
    sl3.textContent = hasFilters
      ? "Filtres du document"
      : "Organization bénéficiaire";
    if (!selPersonId) ps3.textContent = "Organization";
    return;
  }
  const beneficiaryLabel = getFamilyBeneficiaryLabel(fam);
  sl3.textContent = hasFilters
    ? `Filtres & bénéficiaire (${beneficiaryLabel})`
    : beneficiaryLabel;
  if (!selPersonId) ps3.textContent = "Bénéficiaire";
}

function escAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderUserFilterPanel() {
  const panel = document.getElementById("filterPanel");
  if (!panel) return;
  if (!userResolvedFilters.length) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = `
          <div style="border:1px solid var(--line);border-radius:16px;background:#fbfcfe;padding:12px;box-shadow:var(--shsm)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
              <div style="font-size:12px;font-weight:700;color:var(--text)">Filtres du document</div>
              <span style="font-size:10px;color:var(--text3);background:#fff;padding:2px 8px;border-radius:999px;border:1px solid var(--line)">${userResolvedFilters.length} actif(s)</span>
            </div>
            <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">
              ${userResolvedFilters
                .map((entry) => {
                  const value = userFilterValues?.[entry.id] ?? "";
                  const help = entry.helpText
                    ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">${escHtml(entry.helpText)}</div>`
                    : "";
                  if (entry.type === "select") {
                    return `
                      <label style="font-size:11px;color:var(--text2);font-weight:600;min-width:180px;flex:1">
                        ${escHtml(entry.label)}${entry.profile.required ? " *" : ""}
                        <select onchange="onUserFilterChange('${entry.id}', this.value)" ${
                          entry.profile.locked ? "disabled" : ""
                        } style="display:block;width:100%;margin-top:6px;font-size:12px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:#fff;color:var(--text)">
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
                    <label style="font-size:11px;color:var(--text2);font-weight:600;min-width:180px;flex:1">
                      ${escHtml(entry.label)}${entry.profile.required ? " *" : ""}
                      <input type="${
                        entry.type === "number"
                          ? "number"
                          : entry.type === "date"
                            ? "date"
                            : "text"
                      }" value="${escAttr(value)}" placeholder="${escAttr(entry.placeholder || "")}" onchange="onUserFilterChange('${entry.id}', this.value)" ${
                        entry.profile.locked ? "readonly" : ""
                      } style="display:block;width:100%;margin-top:6px;font-size:12px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:#fff;color:var(--text)">
                      ${help}
                    </label>`;
                })
                .join("")}
            </div>
          </div>`;
}

function hasMissingRequiredUserFilters() {
  return userResolvedFilters.some((entry) => {
    if (!entry.profile.required) return false;
    const value = userFilterValues?.[entry.id];
    return value === undefined || value === null || String(value).trim() === "";
  });
}

function buildUserFilterFieldsMarkup() {
  return `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;width:100%;margin-bottom:6px">
            ${userResolvedFilters
              .map((entry) => {
                const value = userFilterValues?.[entry.id] ?? "";
                const help = entry.helpText
                  ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">${escHtml(entry.helpText)}</div>`
                  : "";
                if (entry.type === "select") {
                  return `
                    <label style="font-size:11px;color:var(--text2);font-weight:600">
                      ${escHtml(entry.label)}${entry.profile.required ? " *" : ""}
                      <select onchange="onUserFilterChange('${entry.id}', this.value)" ${
                        entry.profile.locked ? "disabled" : ""
                      } style="display:block;width:100%;margin-top:6px;font-size:12px;border:1px solid var(--border);border-radius:var(--r);padding:6px 10px;background:var(--surface2);color:var(--text)">
                        <option value="">-- Toutes / vide --</option>
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
                    }" value="${escAttr(value)}" placeholder="${escAttr(entry.placeholder || "")}" onchange="onUserFilterChange('${entry.id}', this.value)" ${
                      entry.profile.locked ? "readonly" : ""
                    } style="display:block;width:100%;margin-top:6px;font-size:12px;border:1px solid var(--border);border-radius:var(--r);padding:6px 10px;background:var(--surface2);color:var(--text)">
                    ${help}
                  </label>`;
              })
              .join("")}
          </div>`;
}

function renderUserFilterPanel() {
  const panel = document.getElementById("filterPanel");
  const previewWrap = document.getElementById("userPreviewFiltersWrap");
  if (!panel && !previewWrap) return;
  if (!userResolvedFilters.length) {
    if (panel) panel.innerHTML = "";
    if (previewWrap) previewWrap.innerHTML = "";
    return;
  }
  const fieldsMarkup = buildUserFilterFieldsMarkup();
  const etab = DB.getOrganization(ORGANIZATION_ID);
  if (panel) panel.innerHTML = fieldsMarkup;
  if (previewWrap) {
    previewWrap.innerHTML = `
            <div style="width:100%">
              <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Filtres du document</div>
              ${fieldsMarkup}
              <div style="font-size:11px;color:var(--text2);margin-top:2px">
                Organization :
                <strong>${escHtml(etab?.nom || "Organization principale")}</strong>
              </div>
            </div>`;
  }
}

async function refreshUserResolvedFilters(preserveValues = true) {
  const fam = selFamId ? DB.getFamily(selFamId) : null;
  const tpl = selTplId ? DB.getTemplate(selTplId) : null;
  if (!fam || !tpl) {
    userResolvedFilters = [];
    userFilterValues = {};
    renderUserFilterPanel();
    return [];
  }
  const baseValues = preserveValues
    ? userFilterValues
    : getDefaultFilterValues(fam, tpl, "user");
  userResolvedFilters = await resolveTemplateFiltersForRole(
    selFamId,
    selTplId,
    "user",
    ORGANIZATION_ID,
    baseValues,
  );
  userFilterValues = validateRuntimeFilterValues(
    userResolvedFilters,
    baseValues,
  );
  userResolvedFilters.forEach((entry) => {
    if (entry.profile.locked) {
      userFilterValues[entry.id] = normalizeFilterInputValue(
        entry,
        entry.profile.defaultValue,
      );
    }
  });
  renderUserFilterPanel();
  refreshBeneficiaryLabels();
  return userResolvedFilters;
}

window.onUserFilterChange = async function (filterId, value) {
  userFilterValues = {
    ...userFilterValues,
    [filterId]: value || null,
  };
  selPersonId = null;
  await refreshUserResolvedFilters(true);
  await buildPersonList();
  updatePbar();
};

window.onUserFilterChange = async function (filterId, value) {
  userFilterValues = {
    ...userFilterValues,
    [filterId]: value || null,
  };
  selPersonId = null;
  await refreshUserResolvedFilters(true);
  await buildPersonList();
  const fam = selFamId ? DB.getFamily(selFamId) : null;
  if (hasMissingRequiredUserFilters()) {
    showWait("Renseignez les filtres pour continuer");
    updatePbar();
    return;
  }
  if (
    fam?.beneficiaryMode === "organization" &&
    currentBeneficiaries.length === 1
  ) {
    await selectPerson(currentBeneficiaries[0].id);
    return;
  }
  showWait(
    currentBeneficiaries.length
      ? "Selectionnez le beneficiaire concerne"
      : "Aucun beneficiaire disponible pour ces filtres",
  );
  updatePbar();
};

function buildFamGrid() {
  const grid = document.getElementById("famGrid");
  grid.innerHTML = "";
  const search = familySearch.toLowerCase();
  DB.getFamilies()
    .filter(
      (fam) =>
        !search ||
        String(fam.nom || "")
          .toLowerCase()
          .includes(search),
    )
    .forEach((fam) => {
      const tplCount = DB.getTemplates(fam.id, ORGANIZATION_ID).length;
      const card = document.createElement("div");
      card.className = "fam-card" + (selFamId === fam.id ? " sel" : "");
      if (!tplCount) {
        card.style.opacity = ".4";
        card.style.pointerEvents = "none";
      }
      card.innerHTML = `<div class="fam-name">${fam.nom}</div><div class="fam-meta">${tplCount} modèle(s)</div>`;
      card.onclick = () => selectFamily(fam.id);
      grid.appendChild(card);
    });
}
function updateFamilySearch(value) {
  familySearch = String(value || "").trim();
  buildFamGrid();
}
function updateTemplateSearch(value) {
  templateSearch = String(value || "").trim();
  buildTplList(selFamId);
}
function updateBeneficiarySearch(value) {
  beneficiarySearch = String(value || "").trim();
  renderCurrentBeneficiaries();
}
function selectFamily(famId) {
  selFamId = famId;
  selTplId = null;
  selPersonId = null;
  currentBeneficiaries = [];
  templateSearch = "";
  beneficiarySearch = "";
  const templateSearchInput = document.getElementById("templateSearch");
  const beneficiarySearchInput = document.getElementById("beneficiarySearch");
  if (templateSearchInput) templateSearchInput.value = "";
  if (beneficiarySearchInput) beneficiarySearchInput.value = "";
  userResolvedFilters = [];
  userFilterValues = {};
  buildFamGrid();
  renderUserFilterPanel();
  refreshBeneficiaryLabels();
  const fam = DB.getFamily(famId);
  const sv1 = document.getElementById("sv1");
  sv1.textContent = fam.nom;
  sv1.className = "step-val ok";
  setStepState(1, "done");
  setStepState(2, "cur");
  setStepState(3, "idle");
  buildTplList(famId);
  openStep(2);
  closeStep(1);
  updatePbar();
  showWait("Sélectionnez un modèle de document");
}

/* ETAPE 2 */
function buildTplList(famId) {
  const c = document.getElementById("tplList");
  c.innerHTML = "";
  const search = templateSearch.toLowerCase();
  const tpls = DB.getTemplates(famId, ORGANIZATION_ID).filter(
    (tpl) =>
      !search ||
      String(tpl.nom || "")
        .toLowerCase()
        .includes(search),
  );
  if (!tpls.length) {
    c.innerHTML =
      '<div style="font-size:11px;color:#aaa;text-align:center;padding:14px">Aucun modèle</div>';
    return;
  }
  tpls.forEach((tpl) => {
    const card = document.createElement("div");
    card.className = "tpl-card" + (selTplId === tpl.id ? " sel" : "");
    card.innerHTML = `<span style="font-size:16px">📄</span><div style="flex:1"><div class="tpl-name">${tpl.nom}</div><div class="tpl-meta">${new Date(tpl.updatedAt).toLocaleDateString("fr-FR")}${tpl.hasHeader ? " · 📋" : ""}${tpl.hasFooter ? " · 📑" : ""}</div></div><div class="tpl-chk">${selTplId === tpl.id ? "✓" : ""}</div>`;
    card.onclick = () => selectTemplate(tpl.id);
    c.appendChild(card);
  });
}
async function selectTemplate(tplId) {
  selTplId = tplId;
  selPersonId = null;
  currentBeneficiaries = [];
  beneficiarySearch = "";
  const beneficiarySearchInput = document.getElementById("beneficiarySearch");
  if (beneficiarySearchInput) beneficiarySearchInput.value = "";
  await refreshUserResolvedFilters(false);
  buildTplList(selFamId);
  const tpl = DB.getTemplate(tplId);
  const fam = DB.getFamily(selFamId);
  refreshBeneficiaryLabels();
  const sv2 = document.getElementById("sv2");
  sv2.textContent = tpl.nom;
  sv2.className = "step-val ok";
  setStepState(2, "done");
  setStepState(3, "cur");
  await buildPersonList();
  openStep(3);
  closeStep(2);
  updatePbar();
  showWait("Sélectionnez la personne concernée");
}

async function selectTemplate(tplId) {
  selTplId = tplId;
  selPersonId = null;
  currentBeneficiaries = [];
  beneficiarySearch = "";
  const beneficiarySearchInput = document.getElementById("beneficiarySearch");
  if (beneficiarySearchInput) beneficiarySearchInput.value = "";
  await refreshUserResolvedFilters(false);
  buildTplList(selFamId);
  const tpl = DB.getTemplate(tplId);
  const fam = DB.getFamily(selFamId);
  refreshBeneficiaryLabels();
  const sv2 = document.getElementById("sv2");
  sv2.textContent = tpl.nom;
  sv2.className = "step-val ok";
  setStepState(2, "done");
  setStepState(3, "cur");
  await buildPersonList();
  openStep(3);
  closeStep(2);
  updatePbar();
  if (
    fam?.beneficiaryMode === "organization" &&
    currentBeneficiaries.length === 1
  ) {
    await selectPerson(currentBeneficiaries[0].id);
    return;
  }
  showWait(
    hasMissingRequiredUserFilters()
      ? "Renseignez les filtres pour continuer"
      : fam?.beneficiaryMode === "organization"
        ? "Document lié à l'Organization"
        : "Sélectionnez le bénéficiaire concerné",
  );
}

async function buildPersonList() {
  const c = document.getElementById("personList");
  c.innerHTML = "";
  if (hasMissingRequiredUserFilters()) {
    c.innerHTML =
      '<div style="font-size:11px;color:#9a3412;text-align:center;padding:14px">Renseignez les filtres obligatoires pour afficher les bénéficiaires.</div>';
    return;
  }
  currentBeneficiaries = await DB.getBeneficiariesForFamily(
    selFamId,
    ORGANIZATION_ID,
    userFilterValues,
  );
  renderCurrentBeneficiaries();
}

function renderCurrentBeneficiaries() {
  const c = document.getElementById("personList");
  if (!c) return;
  c.innerHTML = "";
  if (!currentBeneficiaries.length) {
    c.innerHTML =
      '<div style="font-size:11px;color:#aaa;text-align:center;padding:14px">Aucun bénéficiaire disponible</div>';
    return;
  }
  const search = beneficiarySearch.toLowerCase();
  const filteredBeneficiaries = currentBeneficiaries.filter((p) => {
    const label = p._displayLabel || p.nom_prenom || p.nom || "Bénéficiaire";
    const subtitle =
      p._displaySubtitle ||
      (p._sourceTable === "organization"
        ? "Document Organization"
        : getFamilyBeneficiaryLabel(DB.getFamily(selFamId), ""));
    return !search || `${label} ${subtitle}`.toLowerCase().includes(search);
  });
  if (!filteredBeneficiaries.length) {
    c.innerHTML =
      '<div style="font-size:11px;color:#aaa;text-align:center;padding:14px">Aucun bénéficiaire trouvé</div>';
    return;
  }
  filteredBeneficiaries.forEach((p) => {
    const label = p._displayLabel || p.nom_prenom || p.nom || "Bénéficiaire";
    const subtitle =
      p._displaySubtitle ||
      (p._sourceTable === "organization"
        ? "Document Organization"
        : getFamilyBeneficiaryLabel(DB.getFamily(selFamId), ""));
    const initials = label
      .split(" ")
      .map((n) => n[0] || "")
      .join("")
      .substring(0, 2)
      .toUpperCase();
    const item = document.createElement("div");
    item.className =
      "person-item" + (String(selPersonId) === String(p.id) ? " sel" : "");
    item.innerHTML = `<div class="p-av">${initials}</div><div><div class="p-name">${label}</div><div class="p-meta">${subtitle}</div></div>`;
    item.onclick = () => selectPerson(p.id);
    c.appendChild(item);
  });
}

async function selectPerson(personId) {
  selPersonId = personId;
  await buildPersonList();
  const beneficiary = currentBeneficiaries.find(
    (item) => String(item.id) === String(personId),
  );
  const sv3 = document.getElementById("sv3");
  sv3.textContent =
    beneficiary?._displayLabel ||
    beneficiary?.nom_prenom ||
    beneficiary?.nom ||
    "Bénéficiaire";
  sv3.className = "step-val ok";
  setStepState(3, "done");
  closeStep(3);
  updatePbar();
  await generateDocument();
}

async function generateDocument() {
  const tpl = DB.getTemplate(selTplId);
  if (hasMissingRequiredUserFilters()) {
    toast("Complétez les filtres obligatoires", "error");
    return;
  }
  const person = await DB.getDocumentDataForFamily(
    selFamId,
    selPersonId,
    ORGANIZATION_ID,
    userFilterValues,
  );
  if (!tpl || !person) return;

  buildA4Canvas(tpl, person);

  document.getElementById("zoomBar").style.display = "flex";
  const actions = document.getElementById("docActions");
  actions.innerHTML = "";
  const mkBtn = (label, cls, fn) => {
    const b = document.createElement("button");
    b.className = "btn " + cls;
    b.textContent = label;
    b.onclick = fn;
    actions.appendChild(b);
  };
  mkBtn("Imprimer", "primary", () => printDocPaginated(tpl, person));
  mkBtn("Nouveau", "ghost", resetAll);

  toast("Document généré !", "success");
}

function buildA4Canvas(tpl, person) {
  const wait = document.getElementById("docWait");
  const canvas = document.getElementById("a4Canvas");
  const scaler = document.getElementById("zoomScaler");
  applyDocumentThemeToRoot(tpl);
  const margins = getTemplatePageMargins(tpl);
  const distances = getTemplateHeaderFooterDistances(tpl);
  wait.style.display = "none";
  canvas.style.display = "flex";
  scaler.innerHTML = "";
  document.documentElement.style.setProperty("--page-mt", margins.mt + "mm");
  document.documentElement.style.setProperty("--page-mb", margins.mb + "mm");
  document.documentElement.style.setProperty("--page-ml", margins.ml + "mm");
  document.documentElement.style.setProperty("--page-mr", margins.mr + "mm");
  document.documentElement.style.setProperty(
    "--page-header-top",
    distances.headerTop + "mm",
  );
  document.documentElement.style.setProperty(
    "--page-footer-bottom",
    distances.footerBottom + "mm",
  );

  const pages = renderDocumentPages(tpl, person, { mode: "preview" });
  if (!pages.length) {
    toast("Aucun contenu à afficher", "error");
    return [];
  }

  const allPages = document.createElement("div");
  allPages.className = "preview-pages";
  allPages.innerHTML = buildDocumentPagesHtml(tpl, pages, "preview-page", {
    mode: "preview",
  });

  scaler.appendChild(allPages);
  return pages;
}

/* ZOOM */
function setZoom(delta) {
  if (delta === 0) zoomLv = 100;
  else zoomLv = Math.max(40, Math.min(200, zoomLv + delta));
  const sc = document.getElementById("zoomScaler");
  sc.style.transform = `scale(${zoomLv / 100})`;
  sc.style.marginBottom =
    zoomLv < 100 ? ((100 - zoomLv) / 100) * -500 + "px" : "0";
  document.getElementById("zoomLbl").textContent = zoomLv + "%";
}

/* HELPERS */
function showWait(msg) {
  document.getElementById("docWait").innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h3>${msg}</h3>`;
  document.getElementById("docWait").style.display = "flex";
  document.getElementById("a4Canvas").style.display = "none";
  document.getElementById("zoomBar").style.display = "none";
  document.getElementById("docActions").innerHTML = "";
}
function resetAll() {
  selFamId = null;
  selTplId = null;
  selPersonId = null;
  currentBeneficiaries = [];
  userResolvedFilters = [];
  userFilterValues = {};
  openSteps = { 1: true, 2: false, 3: false };
  buildFamGrid();
  document.getElementById("tplList").innerHTML = "";
  document.getElementById("personList").innerHTML = "";
  renderUserFilterPanel();
  ["sv1", "sv2", "sv3"].forEach((id, i) => {
    const el = document.getElementById(id);
    el.textContent = ["Non sélectionné", "En attente", "En attente"][i];
    el.className = "step-val";
  });
  setStepState(1, "cur");
  setStepState(2, "idle");
  setStepState(3, "idle");
  showWait("Complétez les 3 étapes pour générer votre document");
  updatePbar();
  syncStepBodies();
}
