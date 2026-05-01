// ═══════════════════════════════════════════════════════════════
//  SIRH-Doc  shared.js  v7
//  Nouveauté : type "list-object" + syntaxe {{#tech:table}}
//  → génère un <table> automatique dont les colonnes sont les
//    clés du premier objet et les lignes les valeurs.
//  Toutes les syntaxes antérieures restent inchangées.
// ═══════════════════════════════════════════════════════════════

const STORE_KEY = "sirhdoc_v7";
const API_BASE = (() => {
  if (typeof window === "undefined") return "http://localhost:3000";
  const apiBaseParam = new URLSearchParams(window.location.search || "").get(
    "apiBase",
  );
  if (apiBaseParam) return apiBaseParam.replace(/\/$/, "");
  if (window.SIRHDOC_API_BASE)
    return window.SIRHDOC_API_BASE.replace(/\/$/, "");
  if (window.location?.protocol?.startsWith("http"))
    return window.location.origin;
  return "http://localhost:3000";
})();
const API_ROOT = `${API_BASE}/api`;
const LEGACY_PAGE_BASE = "/assets/editor-legacy";
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";
let currentAuthUser = null;
let busyOverlayState = {
  count: 0,
  text: "Chargement en cours...",
  timer: null,
};

function ensureBusyOverlay() {
  if (typeof document === "undefined") return null;
  let overlay = document.getElementById("globalBusyOverlay");
  if (overlay) return overlay;
  const style = document.createElement("style");
  style.id = "globalBusyOverlayStyle";
  style.textContent = `
    #globalBusyOverlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(2px);
      z-index: 12000;
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease;
    }
    #globalBusyOverlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .global-busy-card {
      min-width: 220px;
      max-width: 320px;
      padding: 18px 20px;
      border-radius: 18px;
      background: rgba(255,255,255,.96);
      border: 1px solid rgba(148,163,184,.25);
      box-shadow: 0 18px 50px rgba(15,23,42,.14);
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .global-busy-spinner {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid rgba(37,99,235,.18);
      border-top-color: #2563eb;
      animation: globalBusySpin .8s linear infinite;
      flex-shrink: 0;
    }
    .global-busy-text {
      font: 600 13px/1.4 Inter, Arial, sans-serif;
      color: #0f172a;
    }
    @keyframes globalBusySpin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  overlay = document.createElement("div");
  overlay.id = "globalBusyOverlay";
  overlay.innerHTML = `
    <div class="global-busy-card" role="status" aria-live="polite">
      <div class="global-busy-spinner"></div>
      <div class="global-busy-text" id="globalBusyOverlayText">Chargement en cours...</div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function setBusyOverlayText(text) {
  if (typeof document === "undefined") return;
  const node = document.getElementById("globalBusyOverlayText");
  if (node) node.textContent = text || "Chargement en cours...";
}

function startBusy(text = "Chargement en cours...") {
  if (typeof window === "undefined") return;
  busyOverlayState.count += 1;
  busyOverlayState.text = text || busyOverlayState.text;
  const overlay = ensureBusyOverlay();
  if (!overlay) return;
  setBusyOverlayText(busyOverlayState.text);
  if (busyOverlayState.timer) clearTimeout(busyOverlayState.timer);
  busyOverlayState.timer = setTimeout(() => {
    if (busyOverlayState.count > 0) overlay.classList.add("open");
  }, 120);
}

function stopBusy() {
  if (typeof window === "undefined") return;
  busyOverlayState.count = Math.max(0, busyOverlayState.count - 1);
  const overlay =
    typeof document !== "undefined"
      ? document.getElementById("globalBusyOverlay")
      : null;
  if (busyOverlayState.count === 0) {
    if (busyOverlayState.timer) clearTimeout(busyOverlayState.timer);
    busyOverlayState.timer = null;
    if (overlay) overlay.classList.remove("open");
  }
}

async function withBusy(text, task) {
  startBusy(text);
  try {
    return await task();
  } finally {
    stopBusy();
  }
}

if (typeof window !== "undefined") {
  window.withBusy = withBusy;
}

async function apiFetch(path, options = {}) {
  startBusy(options?.busyText || "Chargement...");
  try {
    const apiUrl = `${API_ROOT}${path}`;
    const sameOrigin =
      typeof window === "undefined" ||
      new URL(apiUrl, window.location.href).origin === window.location.origin;
    const headers = new Headers(options.headers || {});
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(AUTH_TOKEN_KEY)
        : null;
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(`${API_ROOT}${path}`, {
      credentials: sameOrigin ? "same-origin" : "include",
      ...options,
      headers,
    });
    return res;
  } finally {
    stopBusy();
  }
}

async function fetchJsonOrThrow(path, options = {}) {
  const res = await apiFetch(path, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  return payload;
}

function getCurrentAuthUser() {
  return cloneData(currentAuthUser);
}

async function requireAuth(expectedRole = null) {
  try {
    const payload = await fetchJsonOrThrow("/me");
    currentAuthUser = payload.user || null;
    if (
      expectedRole &&
      payload.redirectTo &&
      !window.location.pathname.endsWith(payload.redirectTo)
    ) {
      navigateLegacy(payload.redirectTo);
      return null;
    }
    return currentAuthUser;
  } catch (_) {
    navigateLegacy("/login.html");
    return null;
  }
}

async function logoutAndRedirect() {
  try {
    await apiFetch("/logout", { method: "POST" });
  } catch (_) {}
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }
  navigateLegacy("/login.html");
}

function getLegacyPageUrl(target = "/login.html") {
  const raw = String(target || "/login.html").trim();
  const file = raw.split("?")[0].split("#")[0].replace(/^\/+/, "");
  const normalizedFile = file.endsWith(".html") ? file : "login.html";
  const params = new URLSearchParams();
  params.set("apiBase", API_BASE);
  return `${LEGACY_PAGE_BASE}/${normalizedFile}?${params.toString()}`;
}

function getAngularRouteUrl(target = "/login.html") {
  const raw = String(target || "/login.html").trim();
  const file = raw.split("?")[0].split("#")[0].replace(/^\/+/, "");

  if (file === "superAdmin.html") return "/super-admin";
  if (file === "admin.html") return "/admin";
  if (file === "user.html") return "/user";
  return "/login";
}

function navigateLegacy(target = "/login.html") {
  const routeUrl = getAngularRouteUrl(target);
  if (window.top && window.top !== window) {
    window.top.location.href = routeUrl;
    return;
  }
  window.location.href = routeUrl;
}

if (typeof window !== "undefined") {
  window.navigateLegacy = navigateLegacy;
}

function cloneData(data) {
  if (data === undefined) return undefined;
  return JSON.parse(JSON.stringify(data));
}

const ORGANIZATION_SCOPE_COLUMN = "etablissement_id";
const SUPERADMIN_FAMILY_HIDDEN_TABLES = Object.freeze([
  "family",
  "template",
  "graphic_charter",
  "admin_account",
  "charte",
]);

function normalizeOrganizationId(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function getScopedOrganizationId(record = {}, fallback = null) {
  return normalizeOrganizationId(record?.organizationId, fallback);
}

function isOrganizationBeneficiaryMode(mode) {
  return String(mode || "").toLowerCase() === "organization";
}

function isScopedOrganizationFamily(family = {}) {
  return isOrganizationBeneficiaryMode(family?.beneficiaryMode);
}

function withOrganizationQueryParams(params = {}) {
  const scopedId = normalizeOrganizationId(params.organizationId, null);
  return {
    ...params,
    organizationId: scopedId,
  };
}

function normalizeFilterParamName(value, fallback = "filtre") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return normalized || fallback;
}

function humanizeTechnicalName(value) {
  return String(value || "")
    .replace(/^org_/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeFilterOption(option, fallbackValue = "") {
  if (option === undefined || option === null) return null;
  if (typeof option !== "object" || Array.isArray(option)) {
    const value = String(option).trim();
    if (!value) return null;
    return { value, label: value };
  }
  const value = String(
    option.value ?? option.id ?? option.code ?? fallbackValue ?? "",
  ).trim();
  if (!value) return null;
  const label = String(
    option.label ?? option.libelle ?? option.nom ?? option.name ?? value,
  ).trim();
  return { value, label: label || value };
}

function normalizeFilterOptions(options) {
  const seen = new Set();
  return (Array.isArray(options) ? options : [])
    .map((option, index) => normalizeFilterOption(option, index + 1))
    .filter((option) => {
      if (!option || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
}

function parseFilterStaticOptions(raw) {
  if (Array.isArray(raw)) return normalizeFilterOptions(raw);
  const text = String(raw || "").trim();
  if (!text) return [];
  return normalizeFilterOptions(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [valuePart, ...labelParts] = line.split("|");
        const value = String(valuePart || "").trim();
        const label = String(labelParts.join("|") || value).trim();
        return value ? { value, label: label || value } : null;
      })
      .filter(Boolean),
  );
}

function normalizeFilterRoleAccess(raw = {}) {
  return {
    admin: raw?.admin !== false,
    user: raw?.user !== false,
  };
}

function normalizeFilterSqlBuilder(builder = {}) {
  if (!builder || typeof builder !== "object") {
    return {
      tableName: "",
      valueColumn: "",
      labelColumn: "",
      distinct: true,
    };
  }
  return {
    tableName: String(builder.tableName || builder.table || "").trim(),
    valueColumn: String(builder.valueColumn || builder.value || "").trim(),
    labelColumn: String(builder.labelColumn || builder.label || "").trim(),
    distinct: builder.distinct !== false,
  };
}

function normalizeFilterColumnBinding(binding = {}) {
  if (!binding || typeof binding !== "object") {
    return {
      tableName: "",
      columnName: "",
      mode: "manual",
    };
  }
  const mode =
    binding.mode === "table-links" || binding.mode === "base-column"
      ? binding.mode
      : "manual";
  return {
    tableName: String(binding.tableName || binding.table || "").trim(),
    columnName: String(binding.columnName || binding.column || "").trim(),
    mode,
  };
}

function normalizeFilterColumnBindings(bindings = [], fallbackBinding = null) {
  const source = Array.isArray(bindings)
    ? bindings
    : bindings && typeof bindings === "object"
      ? Object.values(bindings)
      : [];
  const normalized = source
    .map((binding) => normalizeFilterColumnBinding(binding))
    .filter((binding) => binding.tableName && binding.columnName);
  if (normalized.length) {
    return normalized.filter(
      (binding, index, list) =>
        list.findIndex((item) => item.tableName === binding.tableName) ===
        index,
    );
  }
  const legacy = normalizeFilterColumnBinding(fallbackBinding || {});
  return legacy.tableName && legacy.columnName ? [legacy] : [];
}

function normalizeFilterDefinition(filter = {}, index = 0) {
  const label =
    String(filter.label || filter.name || "").trim() || `Filtre ${index + 1}`;
  const type = ["text", "number", "date", "select"].includes(filter.type)
    ? filter.type
    : "text";
  const sourceType =
    type === "select" && filter.sourceType === "sql" ? "sql" : "static";
  return {
    id: String(filter.id || genId("flt")),
    key: normalizeFilterParamName(
      filter.key || filter.param || filter.paramName || label,
      `filtre_${index + 1}`,
    ),
    label,
    type,
    sourceType,
    placeholder: String(filter.placeholder || "").trim(),
    helpText: String(filter.helpText || filter.help || "").trim(),
    roles: normalizeFilterRoleAccess(filter.roles),
    columnBinding: normalizeFilterColumnBinding(
      filter.columnBinding || filter.binding || {},
    ),
    columnBindings: normalizeFilterColumnBindings(
      filter.columnBindings || filter.bindings || [],
      filter.columnBinding || filter.binding || {},
    ),
    staticOptions:
      type === "select"
        ? parseFilterStaticOptions(
            filter.staticOptionsText || filter.staticOptions || [],
          )
        : [],
    sqlBuilder:
      type === "select"
        ? normalizeFilterSqlBuilder(filter.sqlBuilder || filter.builder || {})
        : normalizeFilterSqlBuilder({}),
    sqlQuery:
      type === "select" && sourceType === "sql"
        ? String(filter.sqlQuery || filter.query || "").trim()
        : "",
  };
}

function normalizeTemplateFilterProfileEntry(entry = {}, index = 0) {
  const filterId = String(entry.filterId || entry.id || "").trim();
  if (!filterId) return null;
  return {
    filterId,
    enabled: entry.enabled !== false,
    adminEnabled: entry.adminEnabled !== false,
    userEnabled: entry.userEnabled !== false,
    required: !!entry.required,
    locked: !!entry.locked,
    order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
    defaultValue:
      entry.defaultValue === undefined || entry.defaultValue === null
        ? null
        : entry.defaultValue,
    allowedValueMode: entry.allowedValueMode === "subset" ? "subset" : "all",
    allowedValues: normalizeFilterOptions(entry.allowedValues || []),
  };
}

function normalizeFilterCatalog(filters) {
  return (Array.isArray(filters) ? filters : [])
    .map((filter, index) => normalizeFilterDefinition(filter, index))
    .filter(Boolean);
}

function normalizeTemplateFilterProfile(profile) {
  return (Array.isArray(profile) ? profile : [])
    .map((entry, index) => normalizeTemplateFilterProfileEntry(entry, index))
    .filter(Boolean);
}

function normalizeFilterInputValue(filter, rawValue) {
  if (rawValue === undefined || rawValue === null) return null;
  const text = String(rawValue).trim();
  if (!text) return null;
  if (filter?.type === "number") {
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  return text;
}

function buildDocumentFilterParams(values = {}, filterDefs = []) {
  const params = {};
  (Array.isArray(filterDefs) ? filterDefs : []).forEach((filter) => {
    if (!filter?.key) return;
    const normalized = normalizeFilterInputValue(filter, values?.[filter.id]);
    params[filter.key] = normalized;
    params[`filter_${filter.key}`] = normalized;
  });
  return params;
}

function getFamilyFilterCatalog(family) {
  return normalizeFilterCatalog(family?.filterCatalog || []);
}

function getTemplateFilterProfile(template) {
  return normalizeTemplateFilterProfile(template?.filterProfile || []);
}

function getTemplateFilterProfileMap(template) {
  return new Map(
    getTemplateFilterProfile(template).map((entry) => [entry.filterId, entry]),
  );
}

function getTemplateFilterBinding(filterDef, template) {
  const rawProfile = getTemplateFilterProfileMap(template).get(filterDef.id);
  const isLegacyDisabledProfile =
    !!rawProfile &&
    rawProfile.enabled === false &&
    rawProfile.adminEnabled !== false &&
    rawProfile.userEnabled !== false &&
    !rawProfile.required &&
    !rawProfile.locked &&
    (rawProfile.defaultValue === null ||
      rawProfile.defaultValue === undefined) &&
    rawProfile.allowedValueMode !== "subset" &&
    !(rawProfile.allowedValues || []).length;
  const profile = (isLegacyDisabledProfile
    ? { ...rawProfile, enabled: true }
    : rawProfile) || {
    filterId: filterDef.id,
    enabled: true,
    adminEnabled: true,
    userEnabled: true,
    required: false,
    locked: false,
    order: 999,
    defaultValue: null,
    allowedValueMode: "all",
    allowedValues: [],
  };
  return {
    ...cloneData(filterDef),
    profile: cloneData(profile),
  };
}

function buildDistinctFilterSqlQuery(builder, schema = null) {
  const normalized = normalizeFilterSqlBuilder(builder);
  if (!normalized.tableName || !normalized.valueColumn) return "";
  const tableColumns = schema
    ? getSchemaColumnsForTable(schema, normalized.tableName)
    : [];
  const hasEtabColumn = tableColumns.some(
    (column) => column.name === ORGANIZATION_SCOPE_COLUMN,
  );
  const labelExpr = normalized.labelColumn
    ? `COALESCE(CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.labelColumn)}), CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.valueColumn)}))`
    : `CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.valueColumn)})`;
  return [
    "SELECT DISTINCT",
    `  CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(normalized.valueColumn)}) AS value,`,
    `  ${labelExpr} AS label`,
    `FROM ${quoteSqlIdentifier(normalized.tableName)}`,
    `WHERE ${quoteSqlIdentifier(normalized.valueColumn)} IS NOT NULL${
      hasEtabColumn
        ? `\n  AND (:organizationId IS NULL OR ${quoteSqlIdentifier(ORGANIZATION_SCOPE_COLUMN)} = :organizationId)`
        : ""
    }`,
    "ORDER BY label ASC",
  ].join("\n");
}

function getEnabledTemplateFilters(family, template, role = "user") {
  return getFamilyFilterCatalog(family)
    .map((filterDef) => getTemplateFilterBinding(filterDef, template))
    .filter((entry) => {
      if (!entry.profile.enabled) return false;
      if (role === "admin" && entry.profile.adminEnabled === false)
        return false;
      if (role === "user" && entry.profile.userEnabled === false) return false;
      return entry.roles?.[role] !== false;
    })
    .sort((a, b) => {
      const orderGap = (a.profile.order || 0) - (b.profile.order || 0);
      if (orderGap !== 0) return orderGap;
      return a.label.localeCompare(b.label, "fr");
    });
}

function normalizeFamilyRecord(record = {}) {
  const next = cloneData(record || {}) || {};
  next.beneficiaryMode = isScopedOrganizationFamily(next)
    ? "organization"
    : "table";
  next.beneficiaryTable =
    next.beneficiaryMode === "table"
      ? String(next.beneficiaryTable || next.beneficiaireTable || "")
      : null;
  next.beneficiaryDisplayColumn1 = String(
    next.beneficiaryDisplayColumn1 ||
      next.beneficiaryDisplayColumn ||
      next.beneficiaryLabelColumn ||
      "",
  ).trim();
  next.beneficiaryLinkColumn = String(
    next.beneficiaryLinkColumn ||
      next.beneficiaryBindingColumn ||
      next.beneficiaryJoinColumn ||
      next.beneficiaryIdColumn ||
      "",
  ).trim();
  next.beneficiaryDisplayColumn2 = String(
    next.beneficiaryDisplayColumn2 ||
      next.beneficiarySecondaryDisplayColumn ||
      next.beneficiarySubtitleColumn ||
      "",
  ).trim();
  next.beneficiarySql = String(
    next.beneficiarySql || next.beneficiarySqlText || "",
  ).trim();
  next.filterCatalog = normalizeFilterCatalog(
    next.filterCatalog || next.filterCatalogJson || [],
  );
  delete next.beneficiaireTable;
  delete next.beneficiarySqlText;
  delete next.filterCatalogJson;
  delete next.beneficiaryDisplayColumn;
  delete next.beneficiaryLabelColumn;
  delete next.beneficiaryBindingColumn;
  delete next.beneficiaryJoinColumn;
  delete next.beneficiaryIdColumn;
  delete next.beneficiarySecondaryDisplayColumn;
  delete next.beneficiarySubtitleColumn;
  return next;
}

function getSuperadminHiddenFamilyTables() {
  return [...SUPERADMIN_FAMILY_HIDDEN_TABLES];
}

function isSuperadminFamilyTableHidden(tableName) {
  return SUPERADMIN_FAMILY_HIDDEN_TABLES.includes(String(tableName || ""));
}

function getVisibleFamilySchemaTables(schema, extraTables = []) {
  const extras = new Set((extraTables || []).filter(Boolean));
  return (schema?.tables || []).filter(
    (table) =>
      !isSuperadminFamilyTableHidden(table.name) || extras.has(table.name),
  );
}

function normalizeState(state) {
  const next = state && typeof state === "object" ? state : {};
  const normalizedOrganizations = Array.isArray(next.organizations)
    ? next.organizations.map((org) =>
        normalizeOrganizationRecord(cloneData(org)),
      )
    : [];
  return {
    organizations: cloneData(normalizedOrganizations),
    admins: Array.isArray(next.admins) ? cloneData(next.admins) : [],
    families: Array.isArray(next.families)
      ? next.families.map((fam) => normalizeFamilyRecord(cloneData(fam)))
      : [],
    templates: Array.isArray(next.templates)
      ? next.templates.map((tpl) => normalizeTemplateRecord(cloneData(tpl)))
      : [],
    tableViews: Array.isArray(next.tableViews)
      ? next.tableViews.map((item) => normalizeTableViewRecord(cloneData(item)))
      : [],
    settings:
      next.settings && typeof next.settings === "object"
        ? cloneData(next.settings)
        : {},
  };
}

function normalizeTableViewRecord(record = {}) {
  const next = cloneData(record || {});
  const normalizeFieldList = (value, max = Infinity) =>
    [
      ...new Set(
        (Array.isArray(value) ? value : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      ),
    ].slice(0, max);
  const normalizeFieldSettings = (value) => {
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.fromEntries(
      Object.entries(source)
        .map(([field, config]) => [
          String(field || "").trim(),
          {
            displayMode:
              String(config?.displayMode || "").trim() === "lookup"
                ? "lookup"
                : "raw",
            lookupTable: String(config?.lookupTable || "").trim(),
            lookupValueColumn: String(config?.lookupValueColumn || "").trim(),
            lookupLabelColumn: String(config?.lookupLabelColumn || "").trim(),
          },
        ])
        .filter(([field]) => field),
    );
  };
  return {
    id: String(next.id || genId("tvw")),
    tableName: String(next.tableName || "").trim(),
    label: String(next.label || "").trim(),
    visibleFields: normalizeFieldList(next.visibleFields),
    editableFields: normalizeFieldList(next.editableFields),
    previewFields: normalizeFieldList(next.previewFields, 3),
    fieldSettings: normalizeFieldSettings(next.fieldSettings),
    createdAt: next.createdAt || null,
    updatedAt: next.updatedAt || null,
  };
}

function notifySyncError(message, error) {
  console.error(message, error);
  if (typeof window !== "undefined" && typeof window.toast === "function") {
    window.toast(message, "error");
  }
}

function quoteSqlIdentifier(name) {
  return `[${String(name || "").replace(/]/g, "]]")}]`;
}

function getSchemaColumnsForTable(schema, tableName) {
  return (schema?.columns || []).filter((column) => column.table === tableName);
}

function getSchemaPrimaryColumn(schema, tableName) {
  return (
    getSchemaColumnsForTable(schema, tableName).find(
      (column) => column.key === "PRI",
    )?.name || "id"
  );
}

function getSchemaColumn(schema, tableName, columnName) {
  return getSchemaColumnsForTable(schema, tableName).find(
    (column) => column.name === columnName,
  );
}

function guessBeneficiaryLabel(row = {}) {
  const directKeys = [
    "nom_prenom",
    "nom_complet",
    "display_name",
    "full_name",
    "libelle",
    "intitule",
    "titre",
    "nom",
  ];
  for (const key of directKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  const fullName = [row.prenom, row.nom]
    .filter(
      (value) => value !== undefined && value !== null && String(value).trim(),
    )
    .join(" ")
    .trim();
  if (fullName) return fullName;

  const fallbackKey = Object.keys(row).find((key) => {
    const value = row[key];
    return (
      !key.startsWith("_") &&
      value !== undefined &&
      value !== null &&
      typeof value !== "object" &&
      String(value).trim()
    );
  });
  return fallbackKey ? String(row[fallbackKey]).trim() : "Bénéficiaire";
}

function guessBeneficiarySubtitle(row = {}, label = "") {
  const candidates = [
    row.sous_libelle,
    row.poste,
    row.fonction,
    row.grade,
    row.departement,
    row.service,
    row.email,
    row.code,
    row.matricule,
  ];
  const subtitle = candidates.find(
    (value) => value !== undefined && value !== null && String(value).trim(),
  );
  if (!subtitle) return "";
  const normalized = String(subtitle).trim();
  return normalized === label ? "" : normalized;
}

function getConfiguredBeneficiaryDisplayColumns(family, schema, tableName) {
  if (!family || !schema || !tableName) return [];
  const columns = getSchemaColumnsForTable(schema, tableName);
  const available = new Set(columns.map((column) => column.name));
  return [
    String(family.beneficiaryDisplayColumn1 || "").trim(),
    String(family.beneficiaryDisplayColumn2 || "").trim(),
  ].filter((columnName, index, list) => {
    if (!columnName || !available.has(columnName)) return false;
    return list.indexOf(columnName) === index;
  });
}

function getConfiguredBeneficiaryLinkColumn(family, schema, tableName) {
  if (!family || !schema || !tableName) return "";
  const configured = String(family.beneficiaryLinkColumn || "").trim();
  const columns = getSchemaColumnsForTable(schema, tableName);
  if (configured && columns.some((column) => column.name === configured)) {
    return configured;
  }
  return getSchemaPrimaryColumn(schema, tableName);
}

function buildBeneficiaryLabelFromColumns(row = {}, columns = []) {
  const parts = (Array.isArray(columns) ? columns : [])
    .map((columnName) => row?.[columnName])
    .filter(
      (value) => value !== undefined && value !== null && String(value).trim(),
    )
    .map((value) => String(value).trim());
  return parts.join(" ").trim();
}

function buildBeneficiaryLabelSqlExpr(columns = [], alias = "src") {
  const validColumns = (Array.isArray(columns) ? columns : []).filter(Boolean);
  if (!validColumns.length) return "";
  const parts = validColumns.map(
    (columnName) =>
      `COALESCE(CONVERT(NVARCHAR(255), ${alias}.${quoteSqlIdentifier(columnName)}), '')`,
  );
  if (parts.length === 1) return parts[0];
  return `LTRIM(RTRIM(${parts.join(` + ' ' + `)}))`;
}

const DB = {
  _cache: normalizeState(),
  _readyPromise: null,
  _schemaPromise: null,
  _saveTimer: null,
  _syncPromise: null,
  _pendingSnapshot: null,

  async init(force = false) {
    if (this._readyPromise && !force) return this._readyPromise;
    this._readyPromise = (async () => {
      try {
        const res = await apiFetch("/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          throw new Error(`Bootstrap failed with status ${res.status}`);
        }
        const payload = await res.json();
        currentAuthUser = payload.user || currentAuthUser;
        this._cache = normalizeState(payload.state);
        return this.get();
      } catch (error) {
        this._cache = normalizeState();
        notifySyncError("Connexion SQL Server indisponible.", error);
        return this.get();
      }
    })();
    return this._readyPromise;
  },

  get() {
    return cloneData(this._cache);
  },

  async getSchema(force = false) {
    if (this._schemaPromise && !force) return this._schemaPromise;
    this._schemaPromise = apiFetch("/schema")
      .then((res) => {
        if (!res.ok) throw new Error(`Schema failed with status ${res.status}`);
        return res.json();
      })
      .then((payload) => payload.schema);
    return this._schemaPromise;
  },

  async runSelect(sql, params = {}) {
    const res = await apiFetch("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql,
        params: withOrganizationQueryParams(params),
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(
        payload.error || `Query failed with status ${res.status}`,
      );
    }
    const payload = await res.json();
    return payload.rows || [];
  },

  async getTableViewRows(configId, options = {}) {
    const res = await apiFetch("/table-view/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        configId,
        config: options.config || null,
        search: String(options.search || "").trim(),
        limit: Number(options.limit) || 200,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.error || `Rows failed with status ${res.status}`);
    }
    return payload.rows || [];
  },

  async getTableViewRecord(configId, rowId) {
    const res = await apiFetch("/table-view/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, rowId }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        payload.error || `Record failed with status ${res.status}`,
      );
    }
    return payload.record || null;
  },

  async saveTableViewRecord(configId, rowId, values = {}) {
    const res = await apiFetch("/table-view/record", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, rowId, values }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.error || `Save failed with status ${res.status}`);
    }
    return payload.record || null;
  },

  async createTableViewRecord(configId, values = {}, config = null) {
    const res = await apiFetch("/table-view/record/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, values, config }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        payload.error || `Create failed with status ${res.status}`,
      );
    }
    return payload.record || null;
  },

  async deleteTableViewRecord(configId, rowId) {
    const res = await apiFetch("/table-view/record", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, rowId }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        payload.error || `Delete failed with status ${res.status}`,
      );
    }
    return payload.ok === true;
  },

  async getTableViewLookupOptions(configId, fieldName, config = null) {
    const res = await apiFetch("/table-view/lookup-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, fieldName, config }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        payload.error || `Lookup failed with status ${res.status}`,
      );
    }
    return payload.options || [];
  },

  async getPersonDataForFamily(
    familyId,
    beneficiaryId,
    filters = {},
    organizationId = null,
  ) {
    return this.getDocumentDataForFamily(
      familyId,
      beneficiaryId,
      organizationId,
      filters,
    );
  },

  async getBeneficiariesForFamily(
    familyId,
    organizationId = null,
    filters = {},
  ) {
    const family = this.getFamily(familyId);
    if (!family) return [];
    const filterDefs = getFamilyFilterCatalog(family);
    const filterParams = buildDocumentFilterParams(filters, filterDefs);

    if (isScopedOrganizationFamily(family)) {
      const etab = organizationId ? this.getOrganization(organizationId) : null;
      if (!etab) return [];
      return [
        {
          ...cloneData(etab),
          id: String(etab.id),
          _displayLabel: etab.nom || "Organization",
          _displaySubtitle: etab.ville || "",
          _sourceTable: "organization",
        },
      ];
    }

    const tableName = family.beneficiaryTable || null;
    if (family.beneficiarySql) {
      try {
        const schema = await this.getSchema();
        const configuredDisplayColumns = getConfiguredBeneficiaryDisplayColumns(
          family,
          schema,
          tableName,
        );
        const rows = await this.runSelect(family.beneficiarySql, {
          organizationId,
          ...filterParams,
        });
        return rows
          .filter(
            (row) =>
              row &&
              row.id !== undefined &&
              row.id !== null &&
              String(row.id).trim(),
          )
          .map((row) => {
            const label =
              buildBeneficiaryLabelFromColumns(row, configuredDisplayColumns) ||
              guessBeneficiaryLabel(row);
            return {
              ...row,
              id: String(row.id),
              _displayLabel: label,
              _displaySubtitle: guessBeneficiarySubtitle(row, label),
              _sourceTable: tableName,
            };
          });
      } catch (error) {
        notifySyncError(
          `Impossible de charger les bénéficiaires via le SELECT de la famille ${family.nom || family.id || ""}.`,
          error,
        );
        return [];
      }
    }
    if (!tableName) return [];

    try {
      const schema = await this.getSchema();
      const columns = getSchemaColumnsForTable(schema, tableName);
      if (!columns.length) return [];
      const pk = getConfiguredBeneficiaryLinkColumn(family, schema, tableName);
      const configuredDisplayColumns = getConfiguredBeneficiaryDisplayColumns(
        family,
        schema,
        tableName,
      );
      const defaultOrderColumn =
        configuredDisplayColumns[0] ||
        columns.find((column) =>
          [
            "nom_prenom",
            "nom_complet",
            "display_name",
            "full_name",
            "nom",
            "libelle",
            "intitule",
          ].includes(column.name),
        )?.name ||
        pk;
      const etabColumn = getSchemaColumn(
        schema,
        tableName,
        ORGANIZATION_SCOPE_COLUMN,
      );
      const labelSqlExpr = buildBeneficiaryLabelSqlExpr(
        configuredDisplayColumns,
        "src",
      );
      const fallbackSql = family.beneficiarySql
        ? family.beneficiarySql
        : `SELECT TOP (500)
             src.${quoteSqlIdentifier(pk)} AS id${
               labelSqlExpr ? `,\n             ${labelSqlExpr} AS libelle` : ""
             }
           FROM ${quoteSqlIdentifier(tableName)} src${
             etabColumn && organizationId
               ? `\n           WHERE src.${quoteSqlIdentifier(etabColumn.name)} = :organizationId`
               : ""
           }
           ORDER BY src.${quoteSqlIdentifier(defaultOrderColumn)} ASC`;
      const rows = await this.runSelect(fallbackSql, {
        organizationId,
        ...filterParams,
      });
      return rows
        .filter(
          (row) =>
            row &&
            (row.id !== undefined && row.id !== null
              ? String(row.id).trim()
              : row[pk] !== undefined && row[pk] !== null
                ? String(row[pk]).trim()
                : ""),
        )
        .map((row) => {
          const label =
            buildBeneficiaryLabelFromColumns(row, configuredDisplayColumns) ||
            guessBeneficiaryLabel(row);
          return {
            ...row,
            id: String(row.id ?? row[pk]),
            _displayLabel: label,
            _displaySubtitle: guessBeneficiarySubtitle(row, label),
            _sourceTable: tableName,
          };
        });
    } catch (error) {
      notifySyncError(
        `Impossible de charger les bénéficiaires depuis la table ${tableName}.`,
        error,
      );
      return [];
    }
  },

  async getDocumentDataForFamily(
    familyId,
    beneficiaryId = null,
    organizationId = null,
    filters = {},
  ) {
    const family = this.getFamily(familyId);
    if (!family) return null;
    if (!isScopedOrganizationFamily(family) && !beneficiaryId) {
      return null;
    }

    let baseRecord = {};
    const tableName = family.beneficiaryTable || null;

    if (isScopedOrganizationFamily(family)) {
      const etab = organizationId ? this.getOrganization(organizationId) : null;
      baseRecord = etab ? cloneData(etab) : {};
    } else if (beneficiaryId && tableName) {
      try {
        const schema = await this.getSchema();
        const columns = getSchemaColumnsForTable(schema, tableName);
        if (columns.length) {
          const pk = getConfiguredBeneficiaryLinkColumn(
            family,
            schema,
            tableName,
          );
          const rows = await this.runSelect(
            `SELECT TOP (1) * FROM ${quoteSqlIdentifier(tableName)} WHERE ${quoteSqlIdentifier(pk)} = :beneficiaryId`,
            { beneficiaryId },
          );
          baseRecord = cloneData(rows?.[0] || {});
        }
      } catch (error) {
        notifySyncError(
          `Impossible de charger le bénéficiaire depuis la table ${tableName}.`,
          error,
        );
      }
    }

    if (!family.sql) {
      return hydrateListObjectVariablesForFamily(
        family,
        baseRecord,
        beneficiaryId,
        organizationId,
        filters,
      );
    }

    try {
      const filterDefs = getFamilyFilterCatalog(family);
      const rows = await this.runSelect(family.sql, {
        id: isScopedOrganizationFamily(family) ? organizationId : beneficiaryId,
        personId: beneficiaryId,
        beneficiaryId,
        organizationId,
        ...buildDocumentFilterParams(filters, filterDefs),
      });
      const row = rows?.[0];
      return hydrateListObjectVariablesForFamily(
        family,
        row ? { ...(baseRecord || {}), ...row } : baseRecord,
        beneficiaryId,
        organizationId,
        filters,
      );
    } catch (error) {
      notifySyncError("La requete SELECT de la famille a echoue.", error);
      return hydrateListObjectVariablesForFamily(
        family,
        baseRecord,
        beneficiaryId,
        organizationId,
        filters,
      );
    }
  },

  save(d, options = {}) {
    this._cache = normalizeState(d);
    this._pendingSnapshot = this.get();
    const runSync = () => {
      const payload = this._pendingSnapshot;
      this._pendingSnapshot = null;
      this._saveTimer = null;
      this._syncPromise = apiFetch("/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: payload }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`State sync failed with status ${res.status}`);
          }
          return res;
        })
        .catch((error) => {
          notifySyncError(
            "Impossible de synchroniser les donnees avec SQL Server.",
            error,
          );
          this.init(true).catch(() => {});
        })
        .finally(() => {
          this._syncPromise = null;
          if (this._pendingSnapshot) {
            this.save(this._pendingSnapshot);
          }
        });
    };
    if (this._saveTimer) clearTimeout(this._saveTimer);
    if (options?.immediate) {
      runSync();
    } else {
      this._saveTimer = setTimeout(runSync, 500);
    }
    return this.get();
  },

  seed() {
    this._cache = normalizeState();
    return this.get();
  },

  // ── Accesseurs ──────────────────────────────────────────────
  getFamilies: () => cloneData(DB._cache?.families || []),
  getFamily: (id) =>
    cloneData((DB._cache?.families || []).find((f) => f.id === id) || null),
  getTemplates: (fId, eId) => {
    let t = DB._cache?.templates || [];
    if (fId) t = t.filter((x) => x.familyId === fId);
    if (eId) t = t.filter((x) => getScopedOrganizationId(x) === eId);
    return cloneData(t);
  },
  getTemplate: (id) =>
    cloneData((DB._cache?.templates || []).find((t) => t.id === id) || null),
  getOrganizations: () => cloneData(DB._cache?.organizations || []),
  getOrganization: (id) =>
    cloneData(
      (DB._cache?.organizations || []).find((e) => e.id === id) || null,
    ),
  getAdmins: () => cloneData(DB._cache?.admins || []),
  getAdmin: (id) =>
    cloneData((DB._cache?.admins || []).find((a) => a.id === id) || null),
  getTemplatesByOrganization: (familyId, organizationId) =>
    DB.getTemplates(familyId, organizationId),
  getTableViews: () => cloneData(DB._cache?.tableViews || []),
  getTableView: (id) =>
    cloneData(
      (DB._cache?.tableViews || []).find((item) => item.id === id) || null,
    ),

  // ── Mutateurs ───────────────────────────────────────────────
  saveFamily(fam) {
    const s = DB.get();
    const normalized = normalizeFamilyRecord(fam);
    const i = s.families.findIndex((f) => f.id === fam.id);
    i >= 0 ? (s.families[i] = normalized) : s.families.push(normalized);
    DB.save(s);
    return normalized;
  },
  deleteFamily(id) {
    const s = DB.get();
    s.families = s.families.filter((f) => f.id !== id);
    s.templates = s.templates.filter((t) => t.familyId !== id);
    DB.save(s, { immediate: true });
  },
  saveTemplate(t) {
    const s = DB.get();
    const normalized = normalizeTemplateRecord(t);
    const i = s.templates.findIndex((x) => x.id === t.id);
    i >= 0 ? (s.templates[i] = normalized) : s.templates.push(normalized);
    DB.save(s);
    return normalized;
  },
  deleteTemplate(id) {
    const s = DB.get();
    s.templates = s.templates.filter((t) => t.id !== id);
    DB.save(s, { immediate: true });
  },
  saveOrganization(org) {
    const s = DB.get();
    const normalized = normalizeOrganizationRecord(org);
    const i = s.organizations.findIndex((x) => x.id === normalized.id);
    i >= 0
      ? (s.organizations[i] = normalized)
      : s.organizations.push(normalized);
    DB.save(s);
    return normalized;
  },
  deleteOrganization(id) {
    const s = DB.get();
    s.organizations = s.organizations.filter((e) => e.id !== id);
    s.admins = s.admins.filter((a) => getScopedOrganizationId(a) !== id);
    DB.save(s, { immediate: true });
  },
  saveAdmin(a) {
    const s = DB.get();
    const normalized = {
      ...a,
      organizationId: getScopedOrganizationId(a),
    };
    const i = s.admins.findIndex((x) => x.id === normalized.id);
    i >= 0 ? (s.admins[i] = normalized) : s.admins.push(normalized);
    DB.save(s);
    return normalized;
  },
  deleteAdmin(id) {
    const s = DB.get();
    s.admins = s.admins.filter((a) => a.id !== id);
    DB.save(s, { immediate: true });
  },
  saveTableView(tableView) {
    const normalized = normalizeTableViewRecord(tableView);
    const i = DB._cache.tableViews.findIndex(
      (item) => item.id === normalized.id,
    );
    i >= 0
      ? (DB._cache.tableViews[i] = cloneData(normalized))
      : DB._cache.tableViews.push(cloneData(normalized));
    apiFetch("/table-view-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableView: normalized }),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            payload.error || `Table view sync failed with status ${res.status}`,
          );
        }
      })
      .catch((error) => {
        notifySyncError(
          "Impossible de synchroniser la vue de donnees avec SQL Server.",
          error,
        );
      });
    return normalized;
  },
  deleteTableView(id) {
    DB._cache.tableViews = DB._cache.tableViews.filter(
      (item) => item.id !== id,
    );
    apiFetch("/table-view-config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            payload.error ||
              `Table view delete failed with status ${res.status}`,
          );
        }
      })
      .catch((error) => {
        notifySyncError(
          "Impossible de supprimer la vue de donnees dans SQL Server.",
          error,
        );
      });
  },
  getSettings() {
    return cloneData(DB._cache?.settings || {});
  },
  saveSettings(partialSettings = {}) {
    const s = DB.get();
    s.settings = {
      ...(s.settings || {}),
      ...(cloneData(partialSettings || {}) || {}),
    };
    DB.save(s);
    return cloneData(s.settings);
  },
  // ── Résolution des colonnes d'une variable list-object ───────
  // Cherche dans toutes les familles les colonnes définies pour tech
  getListObjectColumns(tech) {
    const fams = DB.getFamilies();
    for (const fam of fams) {
      for (const cls of fam.classes || []) {
        for (const v of cls.vars || []) {
          if (v.tech === tech && v.type === "list-object" && v.columns) {
            return v.columns;
          }
        }
      }
    }
    return null;
  },
};

function getFamilyListObjectVars(family = {}) {
  return (family.classes || [])
    .flatMap((cls) => cls.vars || [])
    .filter((varDef) => varDef?.type === "list-object");
}

async function hydrateListObjectVariablesForFamily(
  family,
  record = {},
  beneficiaryId = null,
  organizationId = null,
  filters = {},
) {
  const next = cloneData(record || {}) || {};
  const filterDefs = getFamilyFilterCatalog(family);
  for (const varDef of getFamilyListObjectVars(family)) {
    const tech = String(varDef.tech || "").trim();
    if (!tech || Array.isArray(next[tech])) continue;
    const sqlQuery = String(varDef.sqlQuery || "").trim();
    if (!sqlQuery || !/^select\b/i.test(sqlQuery)) {
      next[tech] = [];
      continue;
    }
    try {
      next[tech] = await DB.runSelect(sqlQuery, {
        id: isScopedOrganizationFamily(family) ? organizationId : beneficiaryId,
        personId: beneficiaryId,
        beneficiaryId,
        organizationId,
        ...buildDocumentFilterParams(filters, filterDefs),
      });
    } catch (error) {
      notifySyncError(
        `La requete SQL du tableau ${varDef.label || tech} a echoue.`,
        error,
      );
      next[tech] = [];
    }
  }
  return next;
}

function makeFilterOptionLabel(row = {}, fallback = "") {
  const label =
    row.label ??
    row.libelle ??
    row.nom ??
    row.name ??
    row.intitule ??
    row.titre ??
    row.value ??
    row.id ??
    fallback;
  return String(label ?? fallback ?? "").trim();
}

function mapRowsToFilterOptions(rows = []) {
  return normalizeFilterOptions(
    (Array.isArray(rows) ? rows : []).map((row, index) => {
      if (row === null || row === undefined) return null;
      if (typeof row !== "object" || Array.isArray(row)) {
        return normalizeFilterOption(row, index + 1);
      }
      const value = String(
        row.value ?? row.id ?? row.code ?? row.key ?? index + 1,
      ).trim();
      if (!value) return null;
      return {
        value,
        label: makeFilterOptionLabel(row, value),
      };
    }),
  );
}

function getAllowedFilterOptions(filterEntry, options = []) {
  const normalizedOptions = normalizeFilterOptions(options);
  if (
    !filterEntry?.profile ||
    filterEntry.profile.allowedValueMode !== "subset" ||
    !filterEntry.profile.allowedValues?.length
  ) {
    return normalizedOptions;
  }

  const allowedMap = new Map(
    normalizeFilterOptions(filterEntry.profile.allowedValues).map((option) => [
      option.value,
      option,
    ]),
  );
  const subset = normalizedOptions.filter((option) =>
    allowedMap.has(option.value),
  );
  if (subset.length) return subset;
  return [...allowedMap.values()];
}

function getDefaultFilterValues(family, template, role = "user") {
  return Object.fromEntries(
    getEnabledTemplateFilters(family, template, role).map((entry) => [
      entry.id,
      normalizeFilterInputValue(entry, entry.profile.defaultValue),
    ]),
  );
}

function applyFilterValueDefaults(entries = [], values = {}) {
  const next = {};
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const rawValue =
      values?.[entry.id] !== undefined
        ? values[entry.id]
        : (entry.profile?.defaultValue ?? null);
    next[entry.id] = normalizeFilterInputValue(entry, rawValue);
  });
  return next;
}

function validateRuntimeFilterValues(entries = [], values = {}) {
  const next = applyFilterValueDefaults(entries, values);
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (entry.type !== "select") return;
    const allowed = getAllowedFilterOptions(entry, entry.options || []);
    if (!allowed.length) return;
    const currentValue = next[entry.id];
    if (
      currentValue === null ||
      currentValue === undefined ||
      currentValue === ""
    )
      return;
    if (!allowed.some((option) => option.value === String(currentValue))) {
      next[entry.id] = normalizeFilterInputValue(
        entry,
        entry.profile?.defaultValue ?? null,
      );
    }
  });
  return next;
}

async function resolveFilterOptionsForEntry(
  filterEntry,
  etablissementId = null,
  values = {},
  extraParams = {},
  filterDefs = [],
) {
  if (!filterEntry || filterEntry.type !== "select") return [];
  let options =
    filterEntry.sourceType === "sql" && filterEntry.sqlQuery
      ? []
      : normalizeFilterOptions(filterEntry.staticOptions);

  if (filterEntry.type === "select" && filterEntry.sourceType === "sql") {
    if (!String(filterEntry.sqlQuery || "").trim()) {
      return getAllowedFilterOptions(filterEntry, []);
    }
    try {
      const rows = await DB.runSelect(filterEntry.sqlQuery, {
        organizationId: etablissementId,
        ...buildDocumentFilterParams(
          values,
          filterDefs.length ? filterDefs : [filterEntry],
        ),
        ...extraParams,
      });
      options = mapRowsToFilterOptions(rows);
    } catch (error) {
      notifySyncError(
        `Impossible de charger les valeurs possibles du filtre ${filterEntry.label}.`,
        error,
      );
      options = [];
    }
  }

  return getAllowedFilterOptions(filterEntry, options);
}

async function resolveTemplateFiltersForRole(
  familyId,
  templateId,
  role = "user",
  etablissementId = null,
  values = {},
  extraParams = {},
) {
  const family = DB.getFamily(familyId);
  const template = DB.getTemplate(templateId);
  if (!family || !template) return [];
  const entries = getEnabledTemplateFilters(family, template, role);
  const filterDefs = getFamilyFilterCatalog(family);
  const resolved = [];
  for (const entry of entries) {
    resolved.push({
      ...entry,
      options: await resolveFilterOptionsForEntry(
        entry,
        etablissementId,
        values,
        extraParams,
        filterDefs,
      ),
    });
  }
  return resolved;
}

const DEFAULT_GRAPHIC_CHARTER = Object.freeze({
  identity: {
    officialName: "",
    directorName: "",
    slogan: "",
    logoText: "",
  },
  colors: {
    primary: "#1d4ed8",
    secondary: "#475569",
    text: "#111111",
    heading: "#0f172a",
    border: "#c8cdd8",
    tableHeaderBg: "transparent",
    tableAltRowBg: "#f8fafc",
  },
  typography: {
    bodyFont: '"Times New Roman", Times, serif',
    headingFont: '"Times New Roman", Times, serif',
  },
  layout: {
    orientation: "portrait",
    pageMargins: { mt: 20, mb: 20, ml: 25, mr: 25 },
    headerFooterDistances: { headerTop: 5, footerBottom: 5 },
    pageBackground: {
      enabled: false,
      image: "",
      size: "cover",
      position: "center center",
      repeat: "no-repeat",
    },
  },
  header: {
    enabledByDefault: true,
    displayMode: "all",
    html: '<p style="text-align:center"><strong>{{nom_etab}}</strong></p><p style="text-align:center;font-size:10pt;color:var(--doc-color-secondary)">{{adresse_etab}} — Tél : {{tel_etab}}</p>',
  },
  footer: {
    enabledByDefault: true,
    displayMode: "all",
    html: '<p style="text-align:center;font-size:9pt;color:var(--doc-color-secondary)">Document officiel — {{nom_etab}} — Année {{annee_univ}}</p>',
  },
  watermark: {
    enabled: false,
    text: "",
    color: "#94a3b8",
    opacity: 0.08,
  },
});

function normalizeLegacyGraphicCharter(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.graphicCharters)) return raw.graphicCharters;
  if (Array.isArray(raw?.charters)) return raw.charters;
  if (
    isPlainObject(raw) &&
    ["identity", "colors", "typography", "layout", "header", "footer"].some(
      (key) => key in raw,
    )
  ) {
    return [
      {
        id: "charter_legacy",
        name: "Charte importee",
        description: "Charte reprise depuis l'ancien format",
        config: raw,
        isDefault: true,
      },
    ];
  }
  return [];
}

function normalizeGraphicCharterEntry(entry = {}, index = 0) {
  const configSource =
    entry && typeof entry === "object" && "config" in entry
      ? entry.config
      : entry;
  return {
    id: String(entry?.id || genId("charter")),
    name:
      String(entry?.name || entry?.nom || "").trim() || `Charte ${index + 1}`,
    description: String(entry?.description || "").trim(),
    isDefault: !!entry?.isDefault,
    createdAt: entry?.createdAt || null,
    updatedAt: entry?.updatedAt || null,
    config: normalizeGraphicCharterConfig(configSource || {}),
  };
}

function normalizeGraphicCharterCollection(raw) {
  const list = normalizeLegacyGraphicCharter(raw).map((entry, index) =>
    normalizeGraphicCharterEntry(entry, index),
  );
  if (!list.length) return [];
  const preferred =
    list.find((entry) => entry.isDefault)?.id || list[0]?.id || null;
  list.forEach((entry) => {
    entry.isDefault = entry.id === preferred;
  });
  return list;
}

function normalizeOrganizationRecord(record = {}) {
  const next = cloneData(record || {}) || {};
  next.organizationId = normalizeOrganizationId(next.organizationId, next.id);
  next.graphicCharters = normalizeGraphicCharterCollection(
    next.graphicCharters ?? next.graphicCharter,
  );
  delete next.graphicCharter;
  return next;
}

function normalizeTemplateRecord(record = {}) {
  const next = cloneData(record || {}) || {};
  next.organizationId = getScopedOrganizationId(next);
  next.graphicCharterId = next.graphicCharterId
    ? String(next.graphicCharterId)
    : null;
  next.headerFooterDistances = normalizeHeaderFooterDistances(
    next.headerFooterDistances || next.pageHeaderFooterDistances,
  );
  next.filterProfile = normalizeTemplateFilterProfile(
    next.filterProfile || next.filterProfileJson || [],
  );
  next.headerDisplay = normalizeTemplateSectionDisplay(
    next.headerDisplay || next.headerVisibility || next.headerMode,
  );
  next.footerDisplay = normalizeTemplateSectionDisplay(
    next.footerDisplay || next.footerVisibility || next.footerMode,
  );
  next.sectionDirections = normalizeTemplateSectionDirections(
    next.sectionDirections || next.directions || next.sectionDir,
  );
  delete next.filterProfileJson;
  delete next.pageHeaderFooterDistances;
  return next;
}

function normalizeTemplateDirection(value, fallback = "ltr") {
  const dir = String(value || fallback).toLowerCase();
  return dir === "rtl" ? "rtl" : "ltr";
}

function normalizeTemplateSectionDirections(value = {}) {
  const src =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    header: normalizeTemplateDirection(src.header, "ltr"),
    body: normalizeTemplateDirection(src.body, "ltr"),
    footer: normalizeTemplateDirection(src.footer, "ltr"),
  };
}

function getTemplateSectionDirection(tpl, section = "body") {
  return (
    normalizeTemplateSectionDirections(tpl?.sectionDirections)[section] || "ltr"
  );
}

function wrapHtmlWithDirection(html, dir = "ltr") {
  const safeDir = normalizeTemplateDirection(dir, "ltr");
  const align = safeDir === "rtl" ? "right" : "left";
  return `<div dir="${safeDir}" style="direction:${safeDir};text-align:${align}">${String(html || "")}</div>`;
}

function getSectionDirectionAttrs(tpl, section = "body") {
  const safeDir = getTemplateSectionDirection(tpl, section);
  const align = safeDir === "rtl" ? "right" : "left";
  return {
    dir: safeDir,
    style: `direction:${safeDir};text-align:${align};`,
  };
}

function normalizeTemplateSectionDisplay(value) {
  const mode = String(value || "all").toLowerCase();
  if (mode === "first") return "first";
  if (mode === "even") return "even";
  if (mode === "odd") return "odd";
  return "all";
}

function shouldRenderTemplateSection(display, pageNumber) {
  const mode = normalizeTemplateSectionDisplay(display);
  if (mode === "first") return pageNumber === 1;
  if (mode === "even") return pageNumber % 2 === 0;
  if (mode === "odd") return pageNumber % 2 === 1;
  return true;
}

function applyTemplateHeaderFooterDisplay(pages = [], tpl = {}) {
  return (Array.isArray(pages) ? pages : []).map((page, index) => {
    const pageNumber = index + 1;
    const showHeader =
      !!tpl.hasHeader &&
      !!page?.header &&
      shouldRenderTemplateSection(tpl.headerDisplay, pageNumber);
    const showFooterContent =
      !!tpl.hasFooter &&
      shouldRenderTemplateSection(tpl.footerDisplay, pageNumber);
    return {
      ...page,
      header: showHeader ? page.header : "",
      footer: showFooterContent ? page.footer || "" : "",
      hasHeader: showHeader,
      hasFooter: true,
    };
  });
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, extra) {
  if (!isPlainObject(base)) return cloneData(extra);
  const out = cloneData(base);
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
      return;
    }
    out[key] = cloneData(value);
  });
  return out;
}

function normalizeMargins(src, fallback) {
  const base = fallback || DEFAULT_GRAPHIC_CHARTER.layout.pageMargins;
  const toNum = (value, def) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : def;
  };
  return {
    mt: toNum(src?.mt, base.mt),
    mb: toNum(src?.mb, base.mb),
    ml: toNum(src?.ml, base.ml),
    mr: toNum(src?.mr, base.mr),
  };
}

function normalizeHeaderFooterDistances(src, fallback) {
  const base = fallback || DEFAULT_GRAPHIC_CHARTER.layout.headerFooterDistances;
  const toNum = (value, def) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : def;
  };
  return {
    headerTop: toNum(src?.headerTop, base.headerTop),
    footerBottom: toNum(src?.footerBottom, base.footerBottom),
  };
}

function normalizePageBackground(src) {
  const enabled = !!src?.enabled && !!String(src?.image || "").trim();
  const size = String(src?.size || "cover").toLowerCase();
  const position = String(src?.position || "center center").toLowerCase();
  const repeat = String(src?.repeat || "no-repeat").toLowerCase();
  return {
    enabled,
    image: enabled ? String(src?.image || "").trim() : "",
    size: ["cover", "contain", "100% 100%"].includes(size) ? size : "cover",
    position: [
      "center center",
      "top center",
      "bottom center",
      "center left",
      "center right",
    ].includes(position)
      ? position
      : "center center",
    repeat: ["no-repeat", "repeat", "repeat-x", "repeat-y"].includes(repeat)
      ? repeat
      : "no-repeat",
  };
}

function normalizeGraphicCharterConfig(config = {}) {
  const merged = deepMerge(DEFAULT_GRAPHIC_CHARTER, config || {});
  merged.identity = {
    officialName: String(merged.identity?.officialName || "").trim(),
    directorName: String(merged.identity?.directorName || "").trim(),
    slogan: String(merged.identity?.slogan || "").trim(),
    logoText: String(merged.identity?.logoText || "").trim(),
  };
  merged.colors = {
    primary: merged.colors?.primary || DEFAULT_GRAPHIC_CHARTER.colors.primary,
    secondary:
      merged.colors?.secondary || DEFAULT_GRAPHIC_CHARTER.colors.secondary,
    text: merged.colors?.text || DEFAULT_GRAPHIC_CHARTER.colors.text,
    heading: merged.colors?.heading || DEFAULT_GRAPHIC_CHARTER.colors.heading,
    border: merged.colors?.border || DEFAULT_GRAPHIC_CHARTER.colors.border,
    tableHeaderBg:
      merged.colors?.tableHeaderBg ||
      DEFAULT_GRAPHIC_CHARTER.colors.tableHeaderBg,
    tableAltRowBg:
      merged.colors?.tableAltRowBg ||
      DEFAULT_GRAPHIC_CHARTER.colors.tableAltRowBg,
  };
  merged.typography = {
    bodyFont:
      merged.typography?.bodyFont ||
      DEFAULT_GRAPHIC_CHARTER.typography.bodyFont,
    headingFont:
      merged.typography?.headingFont ||
      DEFAULT_GRAPHIC_CHARTER.typography.headingFont,
  };
  merged.layout = {
    orientation:
      String(merged.layout?.orientation || "portrait").toLowerCase() ===
      "landscape"
        ? "landscape"
        : "portrait",
    pageMargins: normalizeMargins(merged.layout?.pageMargins),
    headerFooterDistances: normalizeHeaderFooterDistances(
      merged.layout?.headerFooterDistances,
    ),
    pageBackground: normalizePageBackground(merged.layout?.pageBackground),
  };
  merged.header = {
    enabledByDefault:
      merged.header?.enabledByDefault !== false &&
      DEFAULT_GRAPHIC_CHARTER.header.enabledByDefault,
    displayMode: normalizeTemplateSectionDisplay(merged.header?.displayMode),
    html: String(merged.header?.html || DEFAULT_GRAPHIC_CHARTER.header.html),
  };
  merged.footer = {
    enabledByDefault:
      merged.footer?.enabledByDefault !== false &&
      DEFAULT_GRAPHIC_CHARTER.footer.enabledByDefault,
    displayMode: normalizeTemplateSectionDisplay(merged.footer?.displayMode),
    html: String(merged.footer?.html || DEFAULT_GRAPHIC_CHARTER.footer.html),
  };
  merged.watermark = {
    enabled: !!merged.watermark?.enabled,
    text: String(merged.watermark?.text || ""),
    color: merged.watermark?.color || DEFAULT_GRAPHIC_CHARTER.watermark.color,
    opacity: Number.isFinite(Number(merged.watermark?.opacity))
      ? Number(merged.watermark.opacity)
      : DEFAULT_GRAPHIC_CHARTER.watermark.opacity,
  };
  return merged;
}

function getOrganizationGraphicCharters(organizationId) {
  const org = organizationId ? DB.getOrganization(organizationId) : null;
  return normalizeGraphicCharterCollection(org?.graphicCharters || []);
}

function getOrganizationGraphicCharter(organizationId, charterId = null) {
  const charters = getOrganizationGraphicCharters(organizationId);
  if (!charters.length) return null;
  if (charterId) {
    const match = charters.find((item) => item.id === String(charterId));
    if (match) return match;
  }
  return charters.find((item) => item.isDefault) || charters[0] || null;
}

function getDefaultOrganizationGraphicCharterId(organizationId) {
  return getOrganizationGraphicCharter(organizationId)?.id || null;
}

function ensureOrganizationGraphicCharters(organizationId) {
  const org = organizationId ? DB.getOrganization(organizationId) : null;
  if (!org) return [];
  const current = getOrganizationGraphicCharters(organizationId);
  if (current.length) return current;
  const created = [
    normalizeGraphicCharterEntry(
      {
        id: genId("charter"),
        name: "Charte standard",
        description: "Charte par defaut de l'Organization",
        isDefault: true,
        config: {},
      },
      0,
    ),
  ];
  DB.saveOrganization({
    ...org,
    graphicCharters: created,
    updatedAt: new Date().toISOString(),
  });
  return created;
}

function saveOrganizationGraphicCharter(organizationId, charter) {
  const org = organizationId ? DB.getOrganization(organizationId) : null;
  if (!org) return null;
  const current = getOrganizationGraphicCharters(organizationId);
  const normalized = normalizeGraphicCharterEntry(
    {
      ...charter,
      id: charter?.id || genId("charter"),
      updatedAt: new Date().toISOString(),
      createdAt: charter?.createdAt || new Date().toISOString(),
    },
    current.length,
  );
  let next = current.filter((item) => item.id !== normalized.id);
  next.push(normalized);
  if (normalized.isDefault || !next.some((item) => item.isDefault)) {
    next = next.map((item) => ({
      ...item,
      isDefault: item.id === normalized.id,
    }));
  }
  DB.saveOrganization({
    ...org,
    graphicCharters: next,
    updatedAt: new Date().toISOString(),
  });
  return normalized;
}

function deleteOrganizationGraphicCharter(organizationId, charterId) {
  const org = organizationId ? DB.getOrganization(organizationId) : null;
  if (!org) return null;
  const current = getOrganizationGraphicCharters(organizationId);
  const removed = current.find((item) => item.id === String(charterId));
  if (!removed) return null;
  let next = current.filter((item) => item.id !== String(charterId));
  if (next.length && !next.some((item) => item.isDefault)) {
    next = next.map((item, index) => ({
      ...item,
      isDefault: index === 0,
    }));
  }
  const fallbackId =
    next.find((item) => item.isDefault)?.id || next[0]?.id || null;
  const state = DB.get();
  state.organizations = state.organizations.map((item) =>
    item.id === organizationId
      ? {
          ...item,
          graphicCharters: next,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  state.templates = state.templates.map((tpl) =>
    getScopedOrganizationId(tpl) === organizationId &&
    tpl.graphicCharterId === String(charterId)
      ? { ...tpl, graphicCharterId: fallbackId }
      : tpl,
  );
  DB.save(state);
  return removed;
}

function setDefaultOrganizationGraphicCharter(organizationId, charterId) {
  const org = organizationId ? DB.getOrganization(organizationId) : null;
  if (!org) return null;
  const current = getOrganizationGraphicCharters(organizationId);
  if (!current.some((item) => item.id === String(charterId))) return null;
  const next = current.map((item) => ({
    ...item,
    isDefault: item.id === String(charterId),
    updatedAt:
      item.id === String(charterId) ? new Date().toISOString() : item.updatedAt,
  }));
  DB.saveOrganization({
    ...org,
    graphicCharters: next,
    updatedAt: new Date().toISOString(),
  });
  return getOrganizationGraphicCharter(organizationId, charterId);
}

function getOrganizationGraphicCharterConfig(organizationId, charterId = null) {
  return getOrganizationGraphicCharter(organizationId, charterId)?.config
    ? normalizeGraphicCharterConfig(
        getOrganizationGraphicCharter(organizationId, charterId).config,
      )
    : normalizeGraphicCharterConfig({});
}

function getTemplateGraphicCharterRecord(tpl) {
  const organizationId = getScopedOrganizationId(tpl);
  if (!organizationId) return null;
  const resolvedId =
    tpl.graphicCharterId ||
    getDefaultOrganizationGraphicCharterId(organizationId);
  return getOrganizationGraphicCharter(organizationId, resolvedId);
}

function getTemplateGraphicCharter(tpl) {
  const record = getTemplateGraphicCharterRecord(tpl);
  return record?.config
    ? normalizeGraphicCharterConfig(record.config)
    : normalizeGraphicCharterConfig({});
}

function getAcademicYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function buildTodayTemplateVars(date = new Date(), locale = "fr-FR") {
  const safeDate =
    date instanceof Date && !Number.isNaN(date) ? date : new Date();
  const day = padDatePart(safeDate.getDate());
  const month = padDatePart(safeDate.getMonth() + 1);
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

function buildOrganizationTemplateVars(etab) {
  const raw = etab?.raw && typeof etab.raw === "object" ? etab.raw : {};
  const out = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "object") return;
    const normalizedKey = normalizeFilterParamName(key, "");
    if (!normalizedKey) return;
    out[normalizedKey] = value;
    out[`org_${normalizedKey}`] = value;
  });
  return out;
}

function getOrganizationVariableSettings() {
  const settings = DB._cache?.settings;
  const configured = Array.isArray(settings?.organizationVisibleVarKeys);
  const visibleKeys = configured
    ? settings.organizationVisibleVarKeys
        .map((value) => normalizeFilterParamName(value, ""))
        .filter(Boolean)
    : [];
  const labels =
    settings?.organizationVariableLabels &&
    typeof settings.organizationVariableLabels === "object"
      ? cloneData(settings.organizationVariableLabels)
      : {};
  return { visibleKeys, configured, labels };
}

function getOrganizationVariableDisplayLabel(key, fallback = "") {
  const normalizedKey = normalizeFilterParamName(key, "");
  const settings = getOrganizationVariableSettings();
  const configuredLabel = String(settings.labels?.[normalizedKey] || "").trim();
  return configuredLabel || fallback || humanizeTechnicalName(normalizedKey);
}

function buildVisibleOrganizationTemplateVars(etab) {
  const allVars = buildOrganizationTemplateVars(etab);
  const { visibleKeys, configured } = getOrganizationVariableSettings();
  if (!configured) return allVars;
  const allowed = new Set(visibleKeys);
  return Object.fromEntries(
    Object.entries(allVars).filter(([key]) =>
      key.startsWith("org_") ? allowed.has(key.slice(4)) : allowed.has(key),
    ),
  );
}

function buildDocumentContext(tpl, person) {
  const base = person ? cloneData(person) : {};
  const organizationId = getScopedOrganizationId(tpl);
  const etab = organizationId ? DB.getOrganization(organizationId) : null;
  const charter = getTemplateGraphicCharter(tpl);
  const officialName =
    charter.identity.officialName || etab?.nom || base.nom_etab || "";

  return {
    ...base,
    ...buildOrganizationTemplateVars(etab),
    ...buildTodayTemplateVars(new Date(), "fr-FR"),
    nom_etab: officialName,
    adresse_etab: etab?.adresse || base.adresse_etab || "",
    tel_etab: etab?.tel || base.tel_etab || "",
    ville_etab: etab?.ville || base.ville_etab || "",
    directeur: charter.identity.directorName || base.directeur || "",
    slogan_etab: charter.identity.slogan || base.slogan_etab || "",
    logo_etab: charter.identity.logoText || base.logo_etab || "",
    annee_univ: base.annee_univ || getAcademicYearLabel(),
  };
}

function getDocumentThemeVars(tpl) {
  const charterRecord = getTemplateGraphicCharterRecord(tpl);
  const charter = charterRecord?.config
    ? normalizeGraphicCharterConfig(charterRecord.config)
    : normalizeGraphicCharterConfig({});
  const pageBackground = normalizePageBackground(
    charterRecord?.config?.layout?.pageBackground,
  );
  const margins = getTemplatePageMargins(tpl);
  const distances = getTemplateHeaderFooterDistances(tpl);
  const orientation = getTemplateOrientation(tpl);
  return {
    "--doc-font-body": charter.typography.bodyFont,
    "--doc-font-heading": charter.typography.headingFont,
    "--doc-color-primary": charter.colors.primary,
    "--doc-color-secondary": charter.colors.secondary,
    "--doc-color-text": charter.colors.text,
    "--doc-color-heading": charter.colors.heading,
    "--doc-color-border": charter.colors.border,
    "--doc-table-header-bg": charter.colors.tableHeaderBg,
    "--doc-table-row-alt-bg": charter.colors.tableAltRowBg,
    "--doc-watermark-color": charter.watermark.color,
    "--doc-watermark-opacity": String(charter.watermark.opacity),
    "--doc-page-bg-image":
      pageBackground.enabled && pageBackground.image
        ? toCssUrlValue(
            pageBackground.image,
            charterRecord?.updatedAt || tpl?.updatedAt || "",
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

function applyDocumentThemeToRoot(tpl, target = document.documentElement) {
  const vars = getDocumentThemeVars(tpl);
  Object.entries(vars).forEach(([key, value]) => {
    target.style.setProperty(key, value);
  });
  return vars;
}

function getDocumentThemeStyleAttr(tpl) {
  return Object.entries(getDocumentThemeVars(tpl))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function createTemplateFromGraphicCharter(
  organizationId,
  familyId,
  name,
  graphicCharterId = null,
) {
  const family = familyId ? DB.getFamily(familyId) : null;
  const charterRecord = getOrganizationGraphicCharter(
    organizationId,
    graphicCharterId,
  );
  const charter = charterRecord?.config
    ? normalizeGraphicCharterConfig(charterRecord.config)
    : normalizeGraphicCharterConfig({});
  return {
    id: genId("tpl"),
    familyId,
    organizationId,
    graphicCharterId: charterRecord?.id || null,
    filterProfile: getFamilyFilterCatalog(family).map((filter, index) =>
      normalizeTemplateFilterProfileEntry(
        {
          filterId: filter.id,
          enabled: true,
          adminEnabled: filter.roles?.admin !== false,
          userEnabled: filter.roles?.user !== false,
          required: false,
          locked: false,
          order: index,
          defaultValue: null,
          allowedValueMode: "all",
          allowedValues: [],
        },
        index,
      ),
    ),
    nom: name || "Nouveau template",
    updatedAt: new Date().toISOString(),
    hasHeader: false,
    hasFooter: false,
    headerDisplay: normalizeTemplateSectionDisplay(charter.header.displayMode),
    footerDisplay: normalizeTemplateSectionDisplay(charter.footer.displayMode),
    orientation: charter.layout.orientation,
    pageMargins: normalizeMargins(charter.layout.pageMargins),
    headerFooterDistances: normalizeHeaderFooterDistances(
      charter.layout.headerFooterDistances,
    ),
    sectionDirections: normalizeTemplateSectionDirections({}),
    header: "",
    body: "<p>Rédigez le contenu du document ici.</p>",
    footer: "",
  };
}

// ═══════════════════════════════════════════════════════════════
//  MOTEUR DE RÉSOLUTION DES VARIABLES
//
//  Syntaxes supportées :
//    {{tech}}              → scalaire
//    {{#tech:ul}}          → list (string[]) → <ul><li>…</li></ul>
//    {{#tech:inline}}      → list (string[]) → "el1, el2, el3"
//    {{#tech:table}}       → list-object     → <table> automatique
//    {{#tech:cell-expand}} → list (string[]) dans tableau :
//                            une <tr> par élément
// ═══════════════════════════════════════════════════════════════

// ── Helper : construire un <table> HTML depuis un list-object ──
// columns  = [{key, label, align?, width?, bold?}] ou null → auto
// thStyle  = styles inline appliqués aux <th> (peut venir du template Tiptap)
// preview  = true → on colore les valeurs résolues
function _buildObjectTable(
  items,
  columns,
  tech,
  preview,
  customThStyle,
  customTdStyle,
) {
  // Colonnes : schéma DB > auto-détection depuis le premier objet
  const cols =
    columns && columns.length
      ? columns
      : items && items[0]
        ? Object.keys(items[0]).map((k) => ({ key: k, label: k }))
        : [];

  if (!cols.length) {
    return preview
      ? `<span style="color:#aaa;font-style:italic">(liste vide)</span>`
      : "";
  }

  // ── Styles par défaut : texte NOIR GRAS pour les en-têtes ────
  const defaultThStyle = `font-weight:700;color:var(--doc-color-text, #111);background:var(--doc-table-header-bg, transparent);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px;text-align:left`;
  const defaultTdStyle = `color:var(--doc-color-text, #111);border:1px solid var(--doc-color-border, #c8cdd8);padding:6px 10px`;

  const thBase = customThStyle || defaultThStyle;
  const tdBase = customTdStyle || defaultTdStyle;

  const thead = `<thead><tr>${cols
    .map((c) => {
      // Alignement optionnel par colonne
      const alignExtra = c.align ? `;text-align:${c.align}` : "";
      const widthExtra = c.width ? `;width:${c.width}` : "";
      const boldExtra = c.bold === false ? `;font-weight:400` : "";
      return `<th style="${thBase}${alignExtra}${widthExtra}${boldExtra}">${_esc(c.label)}</th>`;
    })
    .join("")}</tr></thead>`;

  const rows = (Array.isArray(items) ? items : []).map((obj, ri) => {
    // Légère alternance de fond pour la lisibilité
    const rowBg =
      ri % 2 === 1
        ? `background:var(--doc-table-row-alt-bg, #f8fafc)`
        : `background:#fff`;
    const cells = cols.map((c) => {
      const raw = obj[c.key] !== undefined ? String(obj[c.key]) : "";
      const alignExtra = c.align ? `;text-align:${c.align}` : "";
      const cell = preview
        ? `<span class="var-resolved">${_esc(raw)}</span>`
        : _esc(raw);
      return `<td style="${tdBase}${alignExtra}">${cell}</td>`;
    });
    return `<tr style="${rowBg}">${cells.join("")}</tr>`;
  });

  const tableStyle = `border-collapse:collapse;width:100%;margin:6px 0`;
  return `<table style="${tableStyle}">${thead}<tbody>${rows.join("")}</tbody></table>`;
}

function _parseObjectTableMarker(matchTech, matchColsRaw = "") {
  const selectedKeys = String(matchColsRaw || "")
    .split(",")
    .map((key) => String(key || "").trim())
    .filter(Boolean);
  return {
    tech: String(matchTech || "").trim(),
    selectedKeys,
  };
}

function _filterObjectColumns(columns, items, selectedKeys = []) {
  const baseColumns =
    columns && columns.length
      ? columns
      : items && items[0]
        ? Object.keys(items[0]).map((k) => ({ key: k, label: k }))
        : [];
  if (!selectedKeys.length) return baseColumns;
  const byKey = new Map(baseColumns.map((col) => [String(col.key || ""), col]));
  return selectedKeys
    .map((key) => byKey.get(String(key || "")))
    .filter(Boolean);
}

function getPageSectionPaddings(margins, distances) {
  const headerTop = Number(distances?.headerTop) || 5;
  const footerBottom = Number(distances?.footerBottom) || 5;
  return {
    header: `${headerTop}mm ${margins.mr}mm 3mm ${margins.ml}mm`,
    body: `${margins.mt}mm ${margins.mr}mm ${margins.mb}mm ${margins.ml}mm`,
    bodyNoHeaderFooter: `${margins.mt}mm ${margins.mr}mm ${margins.mb}mm ${margins.ml}mm`,
    footer: `3mm ${margins.mr}mm ${footerBottom}mm ${margins.ml}mm`,
  };
}

// ── 0. list-object :table ─────────────────────────────────────
//
//  Deux cas :
//  A) Marqueur texte brut  {{#tech:table}}
//     → on génère le tableau complet avec les styles par défaut
//
//  B) Marqueur dans un vrai tableau Tiptap  <table>…<td>{{#tech:table}}</td>…</table>
//     → on REMPLACE la ligne modèle par autant de <tr> que d'objets,
//       en héritant des styles de la ligne modèle (couleur, gras, alignement…)
//       Les autres cellules de la ligne deviennent les libellés de colonnes
//       (en-têtes) ou restent vides.
//
//  Marqueur spécial :  {{#tech:table:header}}  dans une cellule <th>/<td>
//  signale que cette ligne EST la ligne d'en-tête Tiptap à conserver telle quelle.
//  Le marqueur  {{#tech:table:data}}  dans une <td> signale la cellule à répéter.
//
//  Syntaxe simplifiée maintenue :
//    {{#tech:table}}  hors tableau → tableau autonome (comportement précédent)
//    {{#tech:table}}  dans une cellule Tiptap → cell-expand objet (1 ligne / objet)
// ─────────────────────────────────────────────────────────────

function _resolveObjectTables(html, person, preview) {
  if (!html) return html;

  // ── Cas B : marqueur dans un <td> d'un vrai tableau Tiptap ───
  // Cherche les <tr> qui contiennent {{#tech:table}} dans une cellule.
  // On les remplace par une ligne par objet, en distribuant les valeurs
  // de l'objet dans chaque cellule selon l'ordre des colonnes définies.
  let guard = 0;
  while (guard++ < 20) {
    const m =
      /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):table(?::([\w,\-]+))?\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(
        html,
      );
    if (!m) break;

    const [fullTr, trAttrs, trInner, tech, colsRaw] = m;
    const markerConfig = _parseObjectTableMarker(tech, colsRaw);

    // Aperçu sans personne → placeholder coloré dans la cellule
    if (!person) {
      if (preview) {
        const ph = `<span style="color:#7c3aed;font-style:italic;background:#f3e8ff;padding:1px 5px;border-radius:3px;font-size:11px">▣ TABLE ${markerConfig.tech}</span>`;
        html = html.replace(
          fullTr,
          fullTr.replace(
            new RegExp(
              `\\{\\{#${markerConfig.tech}:table(?:[:][\\w,\\-]+)?\\}\\}`,
            ),
            ph,
          ),
        );
      }
      break;
    }

    // Extraire les cellules de la ligne modèle
    const cellRe = /<(td|th)((?:\s[^>]*)?|)>([\s\S]*?)<\/\1>/gi;
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(trInner)) !== null)
      cells.push({ tag: cm[1], attrs: cm[2], content: cm[3] });

    if (!cells.length) {
      html = html.replace(fullTr, "");
      break;
    }

    const markerIdx = cells.findIndex((c) =>
      /\{\{#[\w]+:table(?:[:][\w,\-]+)?\}\}/.test(c.content),
    );
    if (markerIdx === -1) {
      html = html.replace(fullTr, "");
      break;
    }

    const items = Array.isArray(person[markerConfig.tech])
      ? person[markerConfig.tech]
      : [];
    const columns = _filterObjectColumns(
      DB.getListObjectColumns(markerConfig.tech),
      items,
      markerConfig.selectedKeys,
    );

    if (!items.length) {
      html = html.replace(fullTr, "");
      continue;
    }

    // Une ligne par objet — on privilégie les placeholders déjà présents
    // dans chaque cellule (ex: {{code}}, {{libelle}}) pour préserver la
    // structure si l'utilisateur ajoute une colonne manuellement.
    // Les colonnes supplémentaires sans placeholder restent vides.
    const columnKeySet = new Set(
      (columns || []).map((col) => String(col?.key || "")).filter(Boolean),
    );
    items.forEach((obj) => {
      Object.keys(obj || {}).forEach((key) => {
        if (key) columnKeySet.add(String(key));
      });
    });
    const cellColumnKeys = cells.map((cell, idx) => {
      if (idx === markerIdx) return columns[0]?.key || null;
      const scalarMatches = Array.from(
        String(cell.content || "").matchAll(/\{\{(\w+)\}\}/g),
      );
      const matched = scalarMatches
        .map((match) => String(match[1] || ""))
        .find((key) => columnKeySet.has(key));
      return matched || null;
    });

    let rows = "";
    items.forEach((obj) => {
      rows += `<tr${trAttrs}>`;
      cells.forEach((c, i) => {
        let content;
        const mappedKey = cellColumnKeys[i];
        if (mappedKey) {
          const raw =
            obj && obj[mappedKey] !== undefined ? String(obj[mappedKey]) : "";
          content = preview
            ? `<span class="var-resolved">${_esc(raw)}</span>`
            : _esc(raw);
        } else {
          content = _resolveScalars(c.content, person, preview);
        }
        rows += `<${c.tag}${c.attrs}>${content}</${c.tag}>`;
      });
      rows += "</tr>";
    });

    html = html.replace(fullTr, rows);
  }

  // ── Cas A : marqueur texte brut (hors tableau Tiptap) ────────
  html = html.replace(
    /\{\{#([\w]+):table(?::([\w,\-]+))?\}\}/g,
    (match, tech, colsRaw) => {
      const markerConfig = _parseObjectTableMarker(tech, colsRaw);
      if (!person) {
        if (!preview) return match;
        // Placeholder éditeur : tableau avec th NOIR GRAS
        const cols = _filterObjectColumns(
          DB.getListObjectColumns(markerConfig.tech),
          [],
          markerConfig.selectedKeys,
        );
        const headers = cols.length
          ? cols
              .map(
                (c) =>
                  `<th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">${_esc(c.label)}</th>`,
              )
              .join("")
          : `<th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">Colonne 1</th>
           <th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">Colonne 2</th>
           <th style="font-weight:700;color:#111;background:#f2f2f2;border:1px solid #c8cdd8;padding:6px 10px">…</th>`;
        const dataCells = cols.length
          ? cols
              .map(
                (c, i) =>
                  `<td style="border:1px solid #c8cdd8;padding:6px 10px;color:#7c3aed;font-style:italic">${i === 0 ? match : ""}</td>`,
              )
              .join("")
          : `<td style="border:1px solid #c8cdd8;padding:6px 10px;color:#7c3aed;font-style:italic">${match}</td>
           <td style="border:1px solid #c8cdd8;padding:6px 10px"></td>
           <td style="border:1px solid #c8cdd8;padding:6px 10px"></td>`;
        return `<table style="border-collapse:collapse;width:100%;margin:6px 0;opacity:.6">
        <thead><tr>${headers}</tr></thead>
        <tbody><tr>${dataCells}</tr></tbody></table>`;
      }

      const items = Array.isArray(person[markerConfig.tech])
        ? person[markerConfig.tech]
        : [];
      const columns = _filterObjectColumns(
        DB.getListObjectColumns(markerConfig.tech),
        items,
        markerConfig.selectedKeys,
      );
      return _buildObjectTable(items, columns, markerConfig.tech, preview);
    },
  );

  return html;
}

// ── 1. cell-expand ────────────────────────────────────────────
function _resolveCellExpand(html, person, preview) {
  if (!html) return html;
  let guard = 0;
  while (guard++ < 20) {
    const m =
      /<tr([^>]*)>((?:(?!<\/tr>)[\s\S])*?\{\{#([\w]+):cell-expand\}\}(?:(?!<\/tr>)[\s\S])*?)<\/tr>/i.exec(
        html,
      );
    if (!m) break;
    const [fullTr, trAttrs, trInner, tech] = m;
    if (!person) {
      if (preview) {
        const ph = `<span style="color:#7c3aed;font-style:italic;background:#f3e8ff;padding:1px 5px;border-radius:3px;font-size:11px">▣ ${tech}</span>`;
        html = html.replace(
          fullTr,
          fullTr.replace(/\{\{#[\w]+:cell-expand\}\}/, ph),
        );
      }
      break;
    }
    const cellRe = /<(td|th)((?:\s[^>]*)?|)>([\s\S]*?)<\/\1>/gi;
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(trInner)) !== null)
      cells.push({ tag: cm[1], attrs: cm[2], content: cm[3] });
    if (!cells.length) {
      html = html.replace(fullTr, "");
      break;
    }
    const markerCells = cells
      .map((cell, idx) => {
        const match = /\{\{#([\w]+):cell-expand\}\}/.exec(cell.content);
        return match ? { idx, tech: match[1], cell } : null;
      })
      .filter(Boolean);
    if (!markerCells.length) {
      html = html.replace(fullTr, "");
      break;
    }
    const resolvedMarkerItems = markerCells.map(({ idx, tech }) => {
      const raw = person[tech];
      const items = Array.isArray(raw)
        ? raw.map((item) => {
            if (typeof item === "object" && item !== null)
              return Object.values(item).join(" | ");
            return String(item);
          })
        : [];
      return { idx, tech, items };
    });
    const rowCount = resolvedMarkerItems.reduce(
      (max, entry) => Math.max(max, entry.items.length),
      0,
    );
    if (!rowCount) {
      let row = `<tr${trAttrs}>`;
      cells.forEach((c, i) => {
        const marker = resolvedMarkerItems.find((entry) => entry.idx === i);
        const content = marker
          ? `<em style="color:#aaa">—</em>`
          : _resolveScalars(c.content, person, preview);
        row += `<${c.tag}${c.attrs}>${content}</${c.tag}>`;
      });
      row += "</tr>";
      html = html.replace(fullTr, row);
      continue;
    }
    let rows = "";
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      rows += `<tr${trAttrs}>`;
      cells.forEach((c, i) => {
        const marker = resolvedMarkerItems.find((entry) => entry.idx === i);
        if (marker) {
          const item = marker.items[rowIndex] ?? "";
          const val = preview
            ? `<span class="var-resolved">${_esc(item)}</span>`
            : _esc(item);
          rows += `<${c.tag}${c.attrs}>${val}</${c.tag}>`;
        } else {
          rows += `<${c.tag}${c.attrs}>${_resolveScalars(c.content, person, preview)}</${c.tag}>`;
        }
      });
      rows += "</tr>";
    }
    html = html.replace(fullTr, rows);
  }
  return html;
}

// ── 2. ul / inline (string[]) ────────────────────────────────
function _resolveListTags(html, person, preview) {
  if (!html) return html;
  return html.replace(/\{\{#([\w]+):(ul|inline)\}\}/g, (match, tech, mode) => {
    if (!person) {
      if (!preview) return match;
      if (mode === "inline")
        return `<span style="color:#7c3aed;font-style:italic;background:#f3e8ff;padding:0 3px;border-radius:3px">[${tech}]</span>`;
      return `<ul style="opacity:.5;color:#7c3aed;margin:4px 0;padding-left:1.4em"><li style="font-style:italic">${tech} — élément 1</li><li style="font-style:italic">${tech} — élément 2</li></ul>`;
    }
    const raw = person[tech];
    const items = Array.isArray(raw)
      ? raw.map((item) => {
          if (typeof item === "object" && item !== null)
            return Object.values(item).join(" | ");
          return String(item);
        })
      : [];
    if (!items.length)
      return preview
        ? `<span style="color:#aaa;font-style:italic">(liste vide)</span>`
        : "";
    if (mode === "inline") {
      const joined = items.map(_esc).join(", ");
      return preview ? `<span class="var-resolved">${joined}</span>` : joined;
    }
    const lis = items
      .map((item) => {
        const val = _esc(item);
        return `<li>${preview ? `<span class="var-resolved">${val}</span>` : val}</li>`;
      })
      .join("");
    return `<ul style="margin:4px 0;padding-left:1.4em">${lis}</ul>`;
  });
}

// ── 3. Scalaires ──────────────────────────────────────────────
function _resolveScalars(html, person, preview) {
  if (!html) return html;
  return html.replace(/\{\{(\w+)\}\}/g, (match, k) => {
    if (!person)
      return preview
        ? `<span style="color:#2563eb;background:#eff6ff;padding:0 3px;border-radius:3px;font-style:italic">{{${k}}}</span>`
        : match;
    const val = person[k];
    if (val !== undefined && !Array.isArray(val))
      return preview
        ? `<span class="var-resolved">${_esc(String(val))}</span>`
        : _esc(String(val));
    return preview ? `<span class="var-missing">{{${k}}}</span>` : match;
  });
}

function _normalizeEditorSpacingHtml(html) {
  if (!html) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  root.querySelectorAll("p").forEach((p) => {
    const probe = p.cloneNode(true);
    probe
      .querySelectorAll("br.ProseMirror-trailingBreak")
      .forEach((br) => br.remove());

    const hasVisualContent =
      !!probe.textContent.replace(/\u00a0/g, " ").trim() ||
      !!probe.querySelector("img, table, hr, ul, ol, iframe, svg");

    if (!hasVisualContent) {
      p.innerHTML = "&nbsp;";
    }
  });

  return root.innerHTML;
}

function _stripVariableMarkerStylesHtml(html) {
  if (!html || typeof DOMParser === "undefined") return html || "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  root.querySelectorAll("[style]").forEach((node) => {
    const text = String(node.textContent || "").trim();
    const styleText = String(node.getAttribute("style") || "");
    const hasVariableMarker = /\{\{[#/]?[\w:,\-\s]+\}\}/.test(text);
    const isOnlyVariableMarker = /^\{\{[#/]?[\w:,\-\s]+\}\}$/.test(text);
    const hasAutoVariableColor =
      /color\s*:\s*#?(2563eb|1d4ed8|7c3aed|f97316)/i.test(styleText) ||
      /color\s*:\s*var\(--(accent|purple|orange)/i.test(styleText) ||
      /background(?:-color)?\s*:\s*#?(eff6ff|f3e8ff|fff7ed)/i.test(styleText);
    if (!hasVariableMarker || !hasAutoVariableColor) return;

    node.style.color = "";
    node.style.background = "";
    node.style.backgroundColor = "";
    node.style.fontStyle = "";
    node.style.fontWeight = "";
    node.style.padding = "";
    node.style.borderRadius = "";
    node.style.opacity = "";
    if (!String(node.getAttribute("style") || "").trim()) {
      node.removeAttribute("style");
    }
  });

  return root.innerHTML;
}

function _readResolvedTableWidths(table) {
  if (!table) return [];

  const directCols = Array.from(
    table.querySelectorAll(":scope > colgroup > col"),
  );
  const colgroupWidths = directCols
    .map((col) => {
      const styleWidth = String(col.style.width || "").trim();
      const attrWidth = String(col.getAttribute("width") || "").trim();
      return styleWidth || attrWidth || "";
    })
    .filter(Boolean);
  if (colgroupWidths.length) return colgroupWidths;

  const firstRow = table.querySelector("tr");
  if (!firstRow) return [];

  const widths = [];
  Array.from(firstRow.children).forEach((cell) => {
    const colspan = Math.max(1, Number(cell.getAttribute("colspan")) || 1);
    const styleWidth = String(cell.style.width || "").trim();
    const rawColwidth = String(cell.getAttribute("colwidth") || "").trim();
    const colwidthValues = rawColwidth
      .split(",")
      .map((value) => `${Math.max(1, Number(value) || 0)}px`)
      .filter((value) => value !== "1px" || rawColwidth.includes("1"));
    const baseWidth = styleWidth || colwidthValues[0] || "";

    for (let i = 0; i < colspan; i += 1) {
      widths.push(colwidthValues[i] || baseWidth || "");
    }
  });

  return widths.filter(Boolean).length ? widths : [];
}

function _normalizeResolvedTableWidthsHtml(html) {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  root.querySelectorAll("table").forEach((table) => {
    const widths = _readResolvedTableWidths(table);
    if (!widths.length) return;

    let colgroup = table.querySelector(":scope > colgroup");
    if (!colgroup) {
      colgroup = doc.createElement("colgroup");
      const firstChild = table.firstChild;
      if (firstChild) table.insertBefore(colgroup, firstChild);
      else table.appendChild(colgroup);
    } else {
      colgroup.innerHTML = "";
    }

    widths.forEach((width) => {
      const col = doc.createElement("col");
      col.style.width = width;
      colgroup.appendChild(col);
    });
  });

  return root.innerHTML;
}

// ── Résolution principale (ordre : table → cell-expand → ul/inline → scalaires) ──
function _resolveAll(html, person, preview) {
  if (!html) return "";
  html = _normalizeEditorSpacingHtml(html);
  if (!preview) html = _stripVariableMarkerStylesHtml(html);
  html = _resolveObjectTables(html, person, preview); // 0 - NOUVEAU
  html = _resolveCellExpand(html, person, preview); // 1
  html = _resolveListTags(html, person, preview); // 2
  html = _resolveScalars(html, person, preview); // 3
  html = _normalizeResolvedTableWidthsHtml(html);
  return html;
}

/** Aperçu (variables colorées) */
function resolveVars(html, person) {
  return _resolveAll(html, person, true);
}
/** Export / impression (texte pur) */
function resolveVarsRaw(html, person) {
  return _resolveAll(html, person, false);
}

function getTemplatePageMargins(tpl) {
  const charter = getTemplateGraphicCharter(tpl);
  return normalizeMargins(tpl?.pageMargins, charter.layout.pageMargins);
}

function getTemplateHeaderFooterDistances(tpl) {
  const charter = getTemplateGraphicCharter(tpl);
  return normalizeHeaderFooterDistances(
    tpl?.headerFooterDistances || tpl?.pageHeaderFooterDistances,
    charter.layout.headerFooterDistances,
  );
}

function getTemplateOrientation(tpl) {
  const charter = getTemplateGraphicCharter(tpl);
  const o = (
    tpl?.orientation ||
    tpl?.pageOrientation ||
    charter.layout.orientation ||
    "portrait"
  )
    .toString()
    .toLowerCase();
  return o === "landscape" ? "landscape" : "portrait";
}

function getTemplatePageBackground(tpl) {
  const record = getTemplateGraphicCharterRecord(tpl);
  return normalizePageBackground(record?.config?.layout?.pageBackground);
}

function toCssUrlValue(value, cacheKey = "") {
  const raw = String(value || "").trim();
  if (!raw) return "none";
  let finalValue = raw;
  if (cacheKey && !/^data:/i.test(raw) && !/^blob:/i.test(raw)) {
    const sep = raw.includes("?") ? "&" : "?";
    finalValue = `${raw}${sep}v=${encodeURIComponent(String(cacheKey))}`;
  }
  return `url("${finalValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function mmToPx(mm) {
  const n = Number(mm);
  return ((Number.isFinite(n) ? n : 0) * 96) / 25.4;
}

function getPageHeightPxForOrientation(orientation) {
  return mmToPx(orientation === "landscape" ? 210 : 297);
}

function computeEditorPageUsableHeightPx(opts = {}) {
  const orientation =
    opts.orientation === "landscape" ? "landscape" : "portrait";
  const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  return Math.max(
    1,
    getPageHeightPxForOrientation(orientation) -
      toNum(opts.paddingTopPx) -
      toNum(opts.paddingBottomPx) -
      toNum(opts.headerHeightPx) -
      toNum(opts.footerHeightPx),
  );
}

function applyPageOrientationToUI(orientation) {
  const o = orientation === "landscape" ? "landscape" : "portrait";
  const pageW = o === "landscape" ? "297mm" : "210mm";
  const pageH = o === "landscape" ? "210mm" : "297mm";

  document.documentElement.style.setProperty("--page-orientation", o);
  document.documentElement.style.setProperty("--page-w", pageW);
  document.documentElement.style.setProperty("--page-h", pageH);

  const badge = document.getElementById("sbOrientation");
  if (badge) {
    badge.textContent = o === "landscape" ? "Paysage" : "Portrait";
  }

  document.querySelectorAll(".preview-page").forEach((el) => {
    el.style.width = pageW;
    el.style.minHeight = pageH;
  });
  document.querySelectorAll(".sirh-print-page").forEach((el) => {
    el.style.width = pageW;
    el.style.height = pageH;
  });
}

// ═══════════════════════════════════════════════════════════════
//  INSERTION INTELLIGENTE dans Tiptap (admin.html)
//  Gère scalar, list, list-object
// ═══════════════════════════════════════════════════════════════
async function insertListVar(editor, varDef) {
  if (!editor || !varDef) return;

  // ── list-object → toujours :table (ou :cell-expand si dans tableau) ──
  if (varDef.type === "list-object") {
    const inCell =
      editor.isActive("tableCell") || editor.isActive("tableHeader");
    if (inCell) {
      editor
        .chain()
        .focus()
        .insertContent(`{{#${varDef.tech}:cell-expand}}`)
        .run();
      toast("Tableau objet inséré — cell-expand dans le tableau", "success");
    } else {
      editor.chain().focus().insertContent(`{{#${varDef.tech}:table}}`).run();
      toast(
        `Tableau généré automatiquement pour « ${varDef.label} »`,
        "success",
      );
    }
    return;
  }

  // ── list (string[]) → comportement d'origine ──────────────────
  const inCell = editor.isActive("tableCell") || editor.isActive("tableHeader");
  if (inCell) {
    editor
      .chain()
      .focus()
      .insertContent(`{{#${varDef.tech}:cell-expand}}`)
      .run();
    toast("Liste insérée — 1 ligne par élément dans le tableau", "success");
  } else {
    const mode = await _promptListMode(varDef.tech, varDef.label);
    if (!mode) return;
    editor.chain().focus().insertContent(`{{#${varDef.tech}:${mode}}}`).run();
    toast(`Liste insérée en mode « ${mode} »`, "success");
  }
}

function _promptListMode(tech, label) {
  return new Promise((resolve) => {
    const old = document.getElementById("_sirh_listModal");
    if (old) old.remove();
    const ov = document.createElement("div");
    ov.id = "_sirh_listModal";
    ov.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:'IBM Plex Sans','Inter',sans-serif";
    ov.innerHTML = `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:26px;width:90%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.22)">
        <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px">Rendu de la liste</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:20px;line-height:1.55">
          <strong style="color:#7c3aed;font-family:monospace">{{#${tech}}}</strong> est hors tableau.<br>
          Comment afficher les éléments de <em>${label}</em> ?
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <button data-mode="ul" style="border:2px solid #bbf7d0;border-radius:10px;padding:16px 12px;cursor:pointer;background:#f0fdf4;display:flex;flex-direction:column;align-items:center;gap:8px;color:#15803d;font-family:inherit;font-size:12px;transition:all .14s">
            <span style="font-size:22px">≡</span><strong>Liste à puces</strong>
            <span style="font-size:10px;color:#64748b;text-align:center;line-height:1.4">• élément 1<br>• élément 2</span>
          </button>
          <button data-mode="inline" style="border:2px solid #fde68a;border-radius:10px;padding:16px 12px;cursor:pointer;background:#fffbeb;display:flex;flex-direction:column;align-items:center;gap:8px;color:#92400e;font-family:inherit;font-size:12px;transition:all .14s">
            <span style="font-size:22px">…</span><strong>Inline (virgules)</strong>
            <span style="font-size:10px;color:#64748b;text-align:center;line-height:1.4">él1, él2, él3</span>
          </button>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 13px;font-size:11px;color:#1d4ed8;margin-bottom:16px;line-height:1.5">
          💡 Pour <strong>une ligne par élément dans un tableau</strong>, placez d'abord le curseur dans une cellule, puis insérez la variable.
        </div>
        <button id="_sirh_cancel" style="width:100%;padding:9px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;cursor:pointer;font-size:12px;color:#64748b;font-family:inherit">Annuler</button>
      </div>`;
    ov.querySelectorAll("button[data-mode]").forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        btn.style.transform = "translateY(-2px)";
        btn.style.boxShadow = "0 4px 14px rgba(0,0,0,.12)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
        btn.style.boxShadow = "";
      });
      btn.onclick = () => {
        ov.remove();
        resolve(btn.dataset.mode);
      };
    });
    ov.querySelector("#_sirh_cancel").onclick = () => {
      ov.remove();
      resolve(null);
    };
    document.body.appendChild(ov);
  });
}

// ═══════════════════════════════════════════════════════════════
//  CSS IMPRESSION A4
// ═══════════════════════════════════════════════════════════════
const PRINT_PAGE_CSS = `
@page { size: A4 portrait; margin: 0; }
body  { margin: 0; background: #fff; }
.a4-page {
  width: 210mm; min-height: 297mm;
  background-color: #fff;
  background-image: var(--doc-page-bg-image, none);
  background-size: var(--doc-page-bg-size, cover);
  background-position: var(--doc-page-bg-position, center center);
  background-repeat: var(--doc-page-bg-repeat, no-repeat);
  margin: 0 auto;
  display: flex; flex-direction: column;
  page-break-after: always; break-after: page;
}
.a4-page:last-child { page-break-after: auto; break-after: auto; }
.a4-header {
  flex-shrink: 0;
  padding: var(--page-header-top, 5mm) var(--page-mr, 25mm) 3mm var(--page-ml, 25mm);
}
.a4-footer {
  flex-shrink: 0; margin-top: auto;
  padding: 3mm var(--page-mr, 25mm) var(--page-footer-bottom, 5mm) var(--page-ml, 25mm);
}
.a4-body {
  flex: 1;
  padding: var(--page-mt, 20mm) var(--page-mr, 25mm) var(--page-mb, 20mm) var(--page-ml, 25mm);
  font-family: 'Times New Roman', Times, serif;
  font-size: 12pt; line-height: 1.6; color: #111;
}
.a4-body p,
.doc-page-body p {
  min-height: 1.6em;
}
.a4-body u,
.a4-header u,
.a4-footer u,
.preview-page u,
.doc-page-header u,
.doc-page-body u,
.doc-page-footer u,
.a4-body a,
.a4-header a,
.a4-footer a,
.preview-page a,
.doc-page-header a,
.doc-page-body a,
.doc-page-footer a {
  text-decoration-thickness: 1px;
  text-underline-offset: 0.14em;
  text-decoration-skip-ink: none;
}
.a4-body.no-header { padding-top: var(--page-mt, 20mm); }
.a4-body.no-footer  { padding-bottom: var(--page-mb, 20mm); }
.a4-body.no-header.no-footer { padding: var(--page-mt, 20mm) var(--page-mr, 25mm) var(--page-mb, 20mm) var(--page-ml, 25mm); }
table { border-collapse: collapse; width: 100%; max-width: 100%; table-layout: fixed; box-sizing: border-box; }
td, th {
  border: 1px solid #c8cdd8; padding: 6px 10px;
  box-sizing: border-box; min-width: 0;
  word-break: normal; overflow-wrap: anywhere; white-space: normal;
  print-color-adjust: exact; -webkit-print-color-adjust: exact;
}
td p, th p { color: inherit; margin: 0; }
th:not([style]) { background: #f2f2f2; color: #111; font-weight: 700; text-align: left; }
th { font-weight: 700; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr, img { break-inside: avoid; page-break-inside: avoid; }
ul, ol { padding-left: 2em !important; list-style: revert !important; }
li { display: list-item !important; }
.var-resolved { color: #111 !important; font-weight: inherit !important; background: none !important; padding: 0 !important; }
.var-missing  { color: #dc2626 !important; }
.a4-hf-label, .a4-page-num, .a4-watermark { display: none !important; }
`;

// ═══════════════════════════════════════════════════════════════
//  UTILITAIRES COMMUNS
// ═══════════════════════════════════════════════════════════════
function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function genId(prefix) {
  return (
    prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)
  );
}

function toast(msg, type = "") {
  let stack = document.getElementById("toastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.innerHTML = `<span>${{ success: "✓", error: "✕", info: "ℹ" }[type] || "●"}</span> ${msg}`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

// ═══════════════════════════════════════════════════════════════
//  PAGINATION PROFESSIONNEL — Moteur complet Word-like
//  Gestion des pages A4, aperçu avec navigation, impression
// ═══════════════════════════════════════════════════════════════

/**
 * Classe PagePaginator
 * Divise le contenu HTML intelligemment en pages A4
 * Tient compte de la hauteur des headers/footers et du contenu
 */
class PagePaginator {
  constructor(opts = {}) {
    this.theme = normalizeGraphicCharterConfig(opts.theme || {});

    // Orientation A4
    this.orientation =
      opts.orientation === "landscape" ? "landscape" : "portrait";
    this.pageWidthMm = this.orientation === "landscape" ? 297 : 210;
    this.pageHeightMm = this.orientation === "landscape" ? 210 : 297;
    this.marginTopMm = opts.marginTop || 20;
    this.marginBottomMm = opts.marginBottom || 20;
    this.marginLeftMm = opts.marginLeft || 25;
    this.marginRightMm = opts.marginRight || 25;
    this.headerTopMm = opts.headerTop || 5;
    this.footerBottomMm = opts.footerBottom || 5;
    this.headerDirection = normalizeTemplateDirection(
      opts.headerDirection,
      "ltr",
    );
    this.bodyDirection = normalizeTemplateDirection(opts.bodyDirection, "ltr");
    this.footerDirection = normalizeTemplateDirection(
      opts.footerDirection,
      "ltr",
    );

    // Conversion mm → px (96 DPI standard)
    this.mmToPx = (mm) => (mm * 96) / 25.4;

    this.pageWidthPx = this.mmToPx(this.pageWidthMm);
    this.pageHeightPx = this.mmToPx(this.pageHeightMm);
    this.marginTopPx = this.mmToPx(this.marginTopMm);
    this.marginBottomPx = this.mmToPx(this.marginBottomMm);
    this.marginLeftPx = this.mmToPx(this.marginLeftMm);
    this.marginRightPx = this.mmToPx(this.marginRightMm);
    this.printSafetyBufferPx = this.mmToPx(8);
    this.tableSafetyBufferPx = this.mmToPx(4);
    this.afterTableTextBufferPx = this.mmToPx(12);
    this.footerTopPaddingMm = 3;
    this.footerReserveHeightPx = this.mmToPx(
      this.footerTopPaddingMm + this.footerBottomMm,
    );

    // Hauteur disponible pour le contenu (sans headers/footers)
    this.contentHeightPx =
      this.pageHeightPx - this.marginTopPx - this.marginBottomPx;

    this.pages = [];
    this.headerHeight = 0;
    this.footerHeight = this.footerReserveHeightPx;
  }

  _applyDirectionStyles(el, dir = "ltr") {
    if (!el) return;
    const safeDir = normalizeTemplateDirection(dir, "ltr");
    el.style.direction = safeDir;
    el.style.textAlign = safeDir === "rtl" ? "right" : "left";
    el.setAttribute("dir", safeDir);
  }

  _applyMeasureStyles(el) {
    if (!el) return;
    el.style.fontFamily = this.theme.typography.bodyFont;
    el.style.fontSize = "12pt";
    el.style.lineHeight = "1.6";
    el.style.color = this.theme.colors.text;
  }

  _applyMeasureContentStyles(root) {
    if (!root) return;
    root.style.boxSizing = "border-box";
    root.style.maxWidth = "100%";
    root.style.overflowWrap = "anywhere";
    root.style.wordBreak = "normal";
    root.style.whiteSpace = "normal";

    root.querySelectorAll("p").forEach((p) => {
      p.style.margin = "0 0 0.4em";
      p.style.maxWidth = "100%";
      p.style.overflowWrap = "anywhere";
      p.style.wordBreak = "normal";
      p.style.whiteSpace = "normal";
      if (
        !p.textContent.trim() &&
        !p.querySelector("img, table, hr, ul, ol, iframe, svg")
      ) {
        p.style.minHeight = "1.6em";
      }
    });

    const lastParagraph = root.querySelector("p:last-child");
    if (lastParagraph) lastParagraph.style.marginBottom = "0";

    root.querySelectorAll("h1").forEach((el) => {
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
      el.style.fontSize = "22pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.8em 0 0.4em";
    });
    root.querySelectorAll("h2").forEach((el) => {
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
      el.style.fontSize = "18pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.7em 0 0.3em";
    });
    root.querySelectorAll("h3").forEach((el) => {
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
      el.style.fontSize = "14pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.6em 0 0.3em";
    });
    root.querySelectorAll("h4").forEach((el) => {
      el.style.fontFamily = this.theme.typography.headingFont;
      el.style.color = this.theme.colors.heading;
      el.style.fontSize = "12pt";
      el.style.fontWeight = "700";
      el.style.margin = "0.5em 0 0.2em";
    });

    root.querySelectorAll("ul").forEach((el) => {
      el.style.paddingLeft = "2em";
      el.style.margin = "0.4em 0";
      el.style.listStyleType = "disc";
    });
    root.querySelectorAll("ol").forEach((el) => {
      el.style.paddingLeft = "2em";
      el.style.margin = "0.4em 0";
      el.style.listStyleType = "decimal";
    });
    root.querySelectorAll("li").forEach((el) => {
      el.style.display = "list-item";
    });

    root.querySelectorAll("table").forEach((el) => {
      el.style.borderCollapse = "collapse";
      el.style.width = "100%";
      el.style.maxWidth = "100%";
      el.style.tableLayout = "fixed";
      el.style.margin = "6px 0";
      el.style.boxSizing = "border-box";
    });
    root.querySelectorAll("td, th").forEach((el) => {
      el.style.border = `1px solid ${this.theme.colors.border}`;
      el.style.padding = "6px 10px";
      el.style.boxSizing = "border-box";
      el.style.minWidth = "0";
      el.style.wordBreak = "normal";
      el.style.overflowWrap = "anywhere";
      el.style.whiteSpace = "normal";
    });
    root.querySelectorAll("td p, th p").forEach((el) => {
      el.style.margin = "0";
    });
    root.querySelectorAll("th:not([style])").forEach((el) => {
      el.style.background = this.theme.colors.tableHeaderBg;
      el.style.color = this.theme.colors.text;
      el.style.fontWeight = "700";
      el.style.textAlign = "left";
    });

    root.querySelectorAll("hr").forEach((el) => {
      el.style.border = "none";
      el.style.borderTop = `1.5px solid ${this.theme.colors.border}`;
      el.style.margin = "10px 0";
    });
    root.querySelectorAll("img").forEach((el) => {
      el.style.maxWidth = "100%";
      el.style.height = "auto";
      el.style.display = "block";
    });
  }

  /**
   * Pagine le contenu HTML en divisant intelligemment
   * @param {string} contentHtml - HTML du contenu principal
   * @param {string} headerHtml - HTML du header (optionnel)
   * @param {string} footerHtml - HTML du footer (optionnel)
   * @returns {Array} Array d'objects {header, content, footer}
   */
  paginate(contentHtml, headerHtml = "", footerHtml = "") {
    this.pages = [];

    // Créer un conteneur invisible pour mesurer les hauteurs
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.visibility = "hidden";
    tempContainer.style.width = this.pageWidthPx + "px";
    tempContainer.style.left = "-99999px";
    tempContainer.style.top = "0";
    this._applyMeasureStyles(tempContainer);
    document.body.appendChild(tempContainer);

    // Mesurer hauteur du header
    if (headerHtml) {
      const hdrEl = document.createElement("div");
      hdrEl.innerHTML = headerHtml;
      hdrEl.style.padding = `${this.headerTopMm}mm ${this.marginRightMm}mm 3mm ${this.marginLeftMm}mm`;
      this._applyDirectionStyles(hdrEl, this.headerDirection);
      this._applyMeasureContentStyles(hdrEl);
      tempContainer.appendChild(hdrEl);
      this.headerHeight = hdrEl.offsetHeight;
      tempContainer.removeChild(hdrEl);
    }

    // Mesurer hauteur du footer
    const ftrEl = document.createElement("div");
    ftrEl.innerHTML = footerHtml || "&nbsp;";
    ftrEl.style.padding = `${this.footerTopPaddingMm}mm ${this.marginRightMm}mm ${this.footerBottomMm}mm ${this.marginLeftMm}mm`;
    ftrEl.style.minHeight = this.footerReserveHeightPx + "px";
    this._applyDirectionStyles(ftrEl, this.footerDirection);
    this._applyMeasureContentStyles(ftrEl);
    tempContainer.appendChild(ftrEl);
    this.footerHeight = Math.max(
      this.footerReserveHeightPx,
      ftrEl.offsetHeight,
      ftrEl.scrollHeight,
      Math.ceil(ftrEl.getBoundingClientRect().height),
    );
    tempContainer.removeChild(ftrEl);

    if (tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }

    // Hauteur disponible pour le contenu = hauteur page - headers/footers
    // Reserve a small safety buffer because the real print engine can render
    // tables/text a few pixels taller than the screen measurement.
    const availableHeightPx = Math.max(
      0,
      this.contentHeightPx -
        this.headerHeight -
        this.footerHeight -
        this.printSafetyBufferPx,
    );

    // Parser le contenu en éléments
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div>${contentHtml}</div>`,
      "text/html",
    );
    const content = doc.body.firstChild;

    // Diviser les éléments enfants entre les pages
    this._distributeContent(content.children, availableHeightPx);

    // Construire les pages finales
    this.pages = this.pages
      .filter((pageContent) => this._hasMeaningfulPageContent(pageContent))
      .map((pageContent) => ({
        header: headerHtml,
        content: pageContent,
        footer: footerHtml,
      }));

    return this.pages;
  }

  /**
   * Distribue les éléments enfants entre les pages
   * @private
   */
  _distributeContent(elements, availableHeight) {
    let currentPageHTML = "";
    let currentPageHeight = 0;
    let lastAddedWasTable = false;

    const tempMeasure = document.createElement("div");
    tempMeasure.style.position = "absolute";
    tempMeasure.style.visibility = "hidden";
    tempMeasure.style.left = "-99999px";
    tempMeasure.style.top = "0";
    tempMeasure.style.width =
      this.pageWidthPx - this.marginLeftPx - this.marginRightPx + "px";
    this._applyMeasureStyles(tempMeasure);
    document.body.appendChild(tempMeasure);

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el) continue;
      if (
        this._isSkippableLeadingElement(el) &&
        currentPageHTML.trim() === ""
      ) {
        continue;
      }

      if (el.tagName === "TABLE") {
        const remainingHeight =
          currentPageHTML.trim() === ""
            ? availableHeight
            : Math.max(1, availableHeight - currentPageHeight);
        const tableParts = this._splitTableElement(
          el,
          remainingHeight,
          availableHeight,
          tempMeasure,
        );
        for (const part of tableParts) {
          const partHeight =
            this._measureElementHeight(part, tempMeasure) +
            this.tableSafetyBufferPx;
          if (
            currentPageHeight + partHeight > availableHeight &&
            currentPageHTML.trim() !== ""
          ) {
            this.pages.push(currentPageHTML);
            currentPageHTML = "";
            currentPageHeight = 0;
            lastAddedWasTable = false;
          }
          currentPageHTML += part.outerHTML;
          currentPageHeight += partHeight;
          lastAddedWasTable = true;
        }
        continue;
      }

      // Cloner l'élément pour mesurer
      const elHeight =
        this._measureElementHeight(el, tempMeasure) +
        (el.tagName === "TABLE" ? this.tableSafetyBufferPx : 0);

      if (elHeight > availableHeight && this._canSplitTextElement(el)) {
        if (currentPageHTML.trim() !== "") {
          this.pages.push(currentPageHTML);
          currentPageHTML = "";
          currentPageHeight = 0;
          lastAddedWasTable = false;
        }
        const parts = this._splitTextElement(el, availableHeight, tempMeasure);
        for (const part of parts) {
          const partHeight = this._measureElementHeight(part, tempMeasure);
          if (
            currentPageHeight + partHeight > availableHeight &&
            currentPageHTML.trim() !== ""
          ) {
            this.pages.push(currentPageHTML);
            currentPageHTML = "";
            currentPageHeight = 0;
            lastAddedWasTable = false;
          }
          currentPageHTML += part.outerHTML;
          currentPageHeight += partHeight;
          lastAddedWasTable = false;
        }
        continue;
      }

      if (
        lastAddedWasTable &&
        currentPageHTML.trim() !== "" &&
        currentPageHeight + elHeight >
          availableHeight - this.afterTableTextBufferPx
      ) {
        this.pages.push(currentPageHTML);
        currentPageHTML = "";
        currentPageHeight = 0;
        lastAddedWasTable = false;
      }

      // Si ça déborde ET la page n'est pas vide, créer une nouvelle page
      if (
        currentPageHeight + elHeight > availableHeight &&
        currentPageHTML.trim() !== ""
      ) {
        this.pages.push(currentPageHTML);
        currentPageHTML = "";
        currentPageHeight = 0;
        lastAddedWasTable = false;
      }

      // Ajouter l'élément à la page actuelle
      currentPageHTML += el.outerHTML;
      currentPageHeight += elHeight;
      lastAddedWasTable = false;
    }

    // Ajouter la dernière page s'il y a du contenu
    if (currentPageHTML.trim() !== "") {
      this.pages.push(currentPageHTML);
    }

    document.body.removeChild(tempMeasure);
  }

  _canSplitTextElement(el) {
    if (!el || !(el instanceof Element)) return false;
    if (!["P", "DIV", "LI"].includes(el.tagName)) return false;
    if (el.querySelector("table, img, hr, ul, ol, iframe, svg")) return false;
    const text = String(el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 80;
  }

  _splitTextElement(el, availableHeight, tempMeasure) {
    const text = String(el.textContent || "");
    const words = Array.from(text.matchAll(/\S+/g)).map((match) => ({
      start: match.index || 0,
      end: (match.index || 0) + match[0].length,
    }));
    if (!words.length) return [el.cloneNode(true)];
    const parts = [];
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
        const candidate = this._cloneTextRangeElement(
          el,
          words[start].start,
          words[mid - 1].end,
        );
        const height = this._measureElementHeight(candidate, tempMeasure);
        if (height <= targetHeight || mid === start + 1) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      parts.push(
        this._cloneTextRangeElement(
          el,
          words[start].start,
          words[best - 1].end,
        ),
      );
      start = Math.max(best, start + 1);
    }

    return parts;
  }

  _cloneTextRangeElement(el, startOffset, endOffset) {
    const shell = el.cloneNode(false);
    const start = this._findTextPosition(el, startOffset);
    const end = this._findTextPosition(el, endOffset);
    if (!start || !end) {
      shell.textContent = String(el.textContent || "").slice(
        startOffset,
        endOffset,
      );
      return shell;
    }
    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      shell.appendChild(range.cloneContents());
      range.detach?.();
      return shell;
    } catch (_) {
      shell.textContent = String(el.textContent || "").slice(
        startOffset,
        endOffset,
      );
      return shell;
    }
  }

  _findTextPosition(root, charOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    let seen = 0;
    let last = null;
    while (current) {
      const length = current.nodeValue?.length || 0;
      if (charOffset <= seen + length) {
        return { node: current, offset: Math.max(0, charOffset - seen) };
      }
      seen += length;
      last = current;
      current = walker.nextNode();
    }
    return last ? { node: last, offset: last.nodeValue?.length || 0 } : null;
  }

  _isSkippableLeadingElement(el) {
    if (!el || !(el instanceof Element)) return false;
    if (!["P", "DIV"].includes(el.tagName)) return false;
    if (el.querySelector("img, table, hr, ul, ol, iframe, svg")) return false;
    const html = String(el.innerHTML || "")
      .replace(/<br\s*\/?>/gi, "")
      .replace(/\s+/g, "")
      .trim();
    const text = String(el.textContent || "").trim();
    return !html && !text;
  }

  _hasMeaningfulPageContent(pageHtml) {
    if (!pageHtml) return false;
    const probe = document.createElement("div");
    probe.innerHTML = pageHtml;
    const hasRichContent = !!probe.querySelector(
      "img, table, hr, ul, ol, iframe, svg",
    );
    const text = String(probe.textContent || "")
      .replace(/\u00a0/g, "")
      .trim();
    return hasRichContent || !!text;
  }

  _measureElementHeight(el, tempMeasure) {
    const clone = el.cloneNode(true);
    tempMeasure.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.style.display = "flow-root";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.maxWidth = "100%";
    wrapper.style.overflowWrap = "anywhere";
    this._applyDirectionStyles(wrapper, this.bodyDirection);
    wrapper.appendChild(clone);
    this._applyMeasureContentStyles(wrapper);
    tempMeasure.appendChild(wrapper);
    const measuredTarget = wrapper.firstElementChild || clone;
    const computed = window.getComputedStyle(measuredTarget);
    const marginTop = parseFloat(computed.marginTop) || 0;
    const marginBottom = parseFloat(computed.marginBottom) || 0;
    const visualHeight = Math.max(
      wrapper.offsetHeight,
      wrapper.scrollHeight,
      clone.offsetHeight,
      clone.scrollHeight,
      Math.ceil(wrapper.getBoundingClientRect().height),
      Math.ceil(clone.getBoundingClientRect().height),
    );
    return Math.max(
      visualHeight + marginTop + marginBottom,
      Math.ceil(measuredTarget.getBoundingClientRect().height) +
        marginTop +
        marginBottom,
    );
  }

  _splitTableElement(
    tableEl,
    firstPageAvailableHeight,
    nextPageAvailableHeight,
    tempMeasure,
  ) {
    const thead = tableEl.querySelector("thead");
    const tbody = tableEl.querySelector("tbody");
    const rows = Array.from(
      tbody?.querySelectorAll(":scope > tr") ||
        tableEl.querySelectorAll(":scope > tr"),
    );
    if (!rows.length) return [tableEl.cloneNode(true)];

    const parts = [];
    let currentTable = this._createSplitTableShell(tableEl, thead);
    let currentBody = currentTable.querySelector("tbody");
    let activeAvailableHeight = Math.max(1, firstPageAvailableHeight || 1);

    rows.forEach((row) => {
      const testTable = currentTable.cloneNode(true);
      testTable.querySelector("tbody").appendChild(row.cloneNode(true));
      const testHeight =
        this._measureElementHeight(testTable, tempMeasure) +
        this.tableSafetyBufferPx;

      if (
        currentBody.children.length > 0 &&
        testHeight > activeAvailableHeight
      ) {
        parts.push(currentTable);
        currentTable = this._createSplitTableShell(tableEl, thead);
        currentBody = currentTable.querySelector("tbody");
        activeAvailableHeight = Math.max(1, nextPageAvailableHeight || 1);
      }

      currentBody.appendChild(row.cloneNode(true));
    });

    if (currentBody.children.length > 0) {
      parts.push(currentTable);
    }

    return parts.length ? parts : [tableEl.cloneNode(true)];
  }

  _createSplitTableShell(sourceTable, thead) {
    const table = sourceTable.cloneNode(false);
    if (sourceTable.hasAttribute("style")) {
      table.setAttribute("style", sourceTable.getAttribute("style"));
    }
    const colgroup = sourceTable.querySelector(":scope > colgroup");
    if (colgroup) table.appendChild(colgroup.cloneNode(true));
    if (thead) table.appendChild(thead.cloneNode(true));
    table.appendChild(document.createElement("tbody"));
    return table;
  }
}

// ═══════════════════════════════════════════════════════════════
//  paginateWithVariablesBlue(tpl, person)
//  Compatibilité rétroactive : délègue au renderer final commun.
//  Retourne: { pages: [...], hasHeader, hasFooter }
// ═══════════════════════════════════════════════════════════════
function paginateWithVariablesBlue(tpl, person) {
  const pages = renderDocumentPages(tpl, person, { mode: "preview" });
  return {
    pages,
    hasHeader: !!tpl?.hasHeader,
    hasFooter: !!tpl?.hasFooter,
  };
}

// ═══════════════════════════════════════════════════════════════
//  renderDocumentPages(tpl, person, options)
//  Source de vérité pour la pagination preview + print
// ═══════════════════════════════════════════════════════════════
function getDocumentRenderMode(options = {}) {
  const rawMode = String(
    options.mode || options.resolve || "print",
  ).toLowerCase();
  return rawMode === "preview" ? "preview" : "print";
}

function sanitizeFinalRenderHtml(html) {
  if (!html || typeof DOMParser === "undefined") return html || "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  root.querySelectorAll(".var-resolved").forEach((node) => {
    node.replaceWith(doc.createTextNode(node.textContent || ""));
  });
  root.querySelectorAll(".var-missing").forEach((node) => {
    node.replaceWith(doc.createTextNode(node.textContent || ""));
  });
  root.querySelectorAll("span[style]").forEach((node) => {
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

function sanitizeFinalRenderPages(pages) {
  return (Array.isArray(pages) ? pages : []).map((page) => ({
    ...page,
    header: sanitizeFinalRenderHtml(page.header),
    content: sanitizeFinalRenderHtml(page.content),
    footer: sanitizeFinalRenderHtml(page.footer),
  }));
}

function renderDocumentPages(tpl, person, options = {}) {
  if (!tpl || !person) return [];
  const mode = getDocumentRenderMode(options);
  const margins = getTemplatePageMargins(tpl);
  const distances = getTemplateHeaderFooterDistances(tpl);
  const charter = getTemplateGraphicCharter(tpl);
  const context = buildDocumentContext(tpl, person);
  const orientation = getTemplateOrientation(tpl);
  const resolve = mode === "preview" ? resolveVars : resolveVarsRaw;
  const hdrHtml = tpl.hasHeader ? resolve(tpl.header || "", context) : "";
  const bHtml = resolve(tpl.body || "", context);
  const ftrHtml = tpl.hasFooter ? resolve(tpl.footer || "", context) : "";

  const paginator = new PagePaginator({
    marginTop: margins.mt,
    marginBottom: margins.mb,
    marginLeft: margins.ml,
    marginRight: margins.mr,
    headerTop: distances.headerTop,
    footerBottom: distances.footerBottom,
    headerDirection: getTemplateSectionDirection(tpl, "header"),
    bodyDirection: getTemplateSectionDirection(tpl, "body"),
    footerDirection: getTemplateSectionDirection(tpl, "footer"),
    orientation,
    theme: charter,
  });

  const pages = applyTemplateHeaderFooterDisplay(
    paginator.paginate(bHtml, hdrHtml, ftrHtml),
    tpl,
  ).map((page, index) => ({
    index,
    mode,
    header: String(page.header || "").trim(),
    content: String(page.content || ""),
    footer: String(page.footer || "").trim(),
  }));

  return mode === "print" ? sanitizeFinalRenderPages(pages) : pages;
}

// ═══════════════════════════════════════════════════════════════
//  buildDocumentPagesHtml(tpl, pages, className)
//  Source de vérité pour le DOM document preview + print
// ═══════════════════════════════════════════════════════════════
function buildDocumentPagesHtml(
  tpl,
  pages,
  className = "preview-page",
  options = {},
) {
  const headerDir = getSectionDirectionAttrs(tpl, "header");
  const bodyDir = getSectionDirectionAttrs(tpl, "body");
  const footerDir = getSectionDirectionAttrs(tpl, "footer");
  const themeStyle = getDocumentThemeStyleAttr(tpl);
  const mode = getDocumentRenderMode(options);
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
        : ";border-top-color:transparent;color:transparent";
      const noHeaderClass = headerHtml ? "" : " no-header";
      const noFooterClass = hasFooterSlot ? "" : " no-footer";
      return `
        <div class="${className} ${renderClass}" data-render-mode="${mode}" style="${themeStyle}">
          ${headerHtml ? `<div class="doc-page-header" dir="${headerDir.dir}" style="${themeStyle};${headerDir.style}">${headerHtml}</div>` : ""}
          <div class="doc-page-body${noHeaderClass}${noFooterClass}" dir="${bodyDir.dir}" style="${themeStyle};${bodyDir.style}">${page.content || ""}</div>
          ${hasFooterSlot ? `<div class="doc-page-footer${footerHtml ? "" : " is-empty"}" aria-hidden="${footerHtml ? "false" : "true"}" dir="${footerDir.dir}" style="${themeStyle};${footerDir.style}${emptyFooterStyle}">${footerHtml || "&nbsp;"}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

// ═══════════════════════════════════════════════════════════════
//  previewDocument(tpl, person)
//  Affiche un aperçu multi-pages complet avec navigation
// ═══════════════════════════════════════════════════════════════
function previewDocument(tpl, person) {
  if (!tpl || !person) {
    toast("Template ou personne manquant", "error");
    return;
  }
  const margins = getTemplatePageMargins(tpl);
  const distances = getTemplateHeaderFooterDistances(tpl);
  const orientation = getTemplateOrientation(tpl);
  const pageWidth = orientation === "landscape" ? "297mm" : "210mm";
  const pageHeight = orientation === "landscape" ? "210mm" : "297mm";
  const paddings = getPageSectionPaddings(margins, distances);
  const pages = renderDocumentPages(tpl, person, { mode: "preview" });

  if (!pages.length) {
    toast("Aucun contenu à afficher", "error");
    return;
  }

  // Créer le modal d'aperçu
  const modal = document.createElement("div");
  modal.className = "preview-modal";
  modal.id = "pagePreviewModal";
  modal.style.cssText = getDocumentThemeStyleAttr(tpl);

  // CSS du modal
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .preview-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }

    .preview-modal.hidden {
      display: none;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      padding: 12px 20px;
      border-radius: 8px 8px 0 0;
    }

    .preview-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .preview-pageinfo {
      font-size: 12px;
      color: #666;
    }

    .preview-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .preview-btn {
      padding: 6px 12px;
      border: 1px solid #ddd;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
      text-decoration: none;
      color: #333;
    }

    .preview-btn:hover {
      background: #e8e8e8;
      border-color: #bbb;
    }

    .preview-btn.primary {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }

    .preview-btn.primary:hover {
      background: #1d4ed8;
    }

    .preview-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .preview-container {
      flex: 1;
      background: #e8e8e8;
      border-radius: 0 0 8px 8px;
      overflow: auto;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 20px;
    }

    .preview-page {
      width: ${pageWidth};
      height: ${pageHeight};
      background-color: #fff;
      background-image: var(--doc-page-bg-image, none);
      background-size: var(--doc-page-bg-size, cover);
      background-position: var(--doc-page-bg-position, center center);
      background-repeat: var(--doc-page-bg-repeat, no-repeat);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      overflow: hidden;
      flex-shrink: 0;
      box-sizing: border-box;
    }

    .doc-page-header {
      grid-row: 1;
      flex-shrink: 0;
      padding: ${paddings.header};
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
      box-sizing: border-box;
    }

    .doc-page-body {
      grid-row: 2;
      flex: 1;
      padding: ${margins.mt}mm ${margins.mr}mm ${margins.mb}mm ${margins.ml}mm;
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
      box-sizing: border-box;
      min-height: 0;
    }

    .doc-page-body.no-header {
      padding-top: ${margins.mt}mm;
    }

    .doc-page-body.no-footer {
      padding-bottom: ${margins.mb}mm;
    }

    .doc-page-body.no-header.no-footer {
      padding: ${paddings.bodyNoHeaderFooter};
    }

    .doc-page-footer {
      grid-row: 3;
      flex-shrink: 0;
      padding: ${paddings.footer};
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
      box-sizing: border-box;
    }

    .preview-page p {
      margin: 0 0 0.4em 0;
      white-space: inherit;
    }

    .preview-page u,
    .preview-page a,
    .doc-page-header u,
    .doc-page-header a,
    .doc-page-footer u,
    .doc-page-footer a {
      text-decoration-thickness: 1px;
      text-underline-offset: 0.14em;
      text-decoration-skip-ink: none;
    }

    .preview-page ul, .preview-page ol {
      padding-left: 2em;
      list-style: revert;
    }

    .preview-page table {
      border-collapse: collapse;
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
      margin: 6px 0;
      box-sizing: border-box;
    }

    .preview-page td, .preview-page th {
      border: 1px solid var(--doc-color-border, #c8cdd8);
      padding: 6px 10px;
      box-sizing: border-box;
      min-width: 0;
      word-break: normal;
      overflow-wrap: anywhere;
      white-space: normal;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .preview-page td p, .preview-page th p {
      color: inherit;
      margin: 0;
      white-space: inherit;
    }

    .preview-page th:not([style]) {
      background: var(--doc-table-header-bg, transparent);
      color: var(--doc-color-text, #111);
      font-weight: 700;
      text-align: left;
    }

    .preview-page th {
      font-weight: 700;
    }

    .preview-page thead {
      display: table-header-group;
    }

    .preview-page tfoot {
      display: table-footer-group;
    }

    .preview-page tr,
    .preview-page img {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .document-render--preview .var-resolved {
      color: #2563eb !important;
      font-weight: 500 !important;
      background: #eff6ff !important;
      padding: 0 3px !important;
      border-radius: 2px !important;
    }

    .document-render--preview .var-missing {
      color: #dc2626;
      background: #fef2f2;
      padding: 0 3px;
      border-radius: 2px;
      font-size: 0.9em;
      font-style: italic;
    }

    .preview-close {
      font-size: 20px;
      background: none;
      border: none;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .preview-close:hover {
      background: #f0f0f0;
      color: #333;
    }
  `;
  document.head.appendChild(styleEl);

  let currentPage = 0;

  const render = () => {
    const page = pages[currentPage];

    modal.innerHTML = `
      <div class="preview-header">
        <div class="preview-title">Aperçu du document</div>
        <div class="preview-pageinfo">
          Page <strong>${currentPage + 1}</strong> sur <strong>${pages.length}</strong>
        </div>
        <div class="preview-controls">
          <button class="preview-btn" id="prevPageBtn" ${currentPage === 0 ? "disabled" : ""}>← Précédent</button>
          <button class="preview-btn" id="nextPageBtn" ${currentPage === pages.length - 1 ? "disabled" : ""}>Suivant →</button>
          <button class="preview-btn primary" id="printAllBtn">🖨 Imprimer</button>
          <button class="preview-close" id="closePreviewBtn">✕</button>
        </div>
      </div>
      <div class="preview-container">
        ${buildDocumentPagesHtml(tpl, [page], "preview-page", { mode: "preview" })}
      </div>
    `;

    // Attacher les événements
    document.getElementById("prevPageBtn")?.addEventListener("click", () => {
      if (currentPage > 0) {
        currentPage--;
        render();
      }
    });

    document.getElementById("nextPageBtn")?.addEventListener("click", () => {
      if (currentPage < pages.length - 1) {
        currentPage++;
        render();
      }
    });

    document.getElementById("printAllBtn")?.addEventListener("click", () => {
      printDocPaginated(tpl, person);
    });

    document
      .getElementById("closePreviewBtn")
      ?.addEventListener("click", () => {
        modal.remove();
        styleEl.remove();
      });
  };

  document.body.appendChild(modal);
  render();
}

// ═══════════════════════════════════════════════════════════════
//  printDocPaginated(tpl, person, pages)
//  Impression avec pagination complète
// ═══════════════════════════════════════════════════════════════
function printDocPaginated(tpl, person, pages = null) {
  if (!tpl || !person) {
    toast("Template ou personne manquant", "error");
    return;
  }
  const margins = getTemplatePageMargins(tpl);
  const distances = getTemplateHeaderFooterDistances(tpl);
  const orientation = getTemplateOrientation(tpl);
  const pageWidth = orientation === "landscape" ? "297mm" : "210mm";
  const pageHeight = orientation === "landscape" ? "210mm" : "297mm";
  const paddings = getPageSectionPaddings(margins, distances);
  const pagesToPrint = renderDocumentPages(tpl, person, { mode: "print" });

  const printCSS = `
    @page { size: A4 ${orientation}; margin: 0; }
    html, body {
      width: auto !important;
      height: auto !important;
      min-height: auto !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    #sirh-print-area { display: block; }

    .document-render--print,
    .preview-page,
    .sirh-print-page {
      width: ${pageWidth};
      height: ${pageHeight};
      background-color: #fff;
      background-image: var(--doc-page-bg-image, none);
      background-size: var(--doc-page-bg-size, cover);
      background-position: var(--doc-page-bg-position, center center);
      background-repeat: var(--doc-page-bg-repeat, no-repeat);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }

    .document-render--print:last-child,
    .preview-page:last-child,
    .sirh-print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .doc-page-header {
      grid-row: 1;
      box-sizing: border-box;
      padding: ${paddings.header};
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      background: #fff;
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .doc-page-body {
      grid-row: 2;
      min-height: 0;
      box-sizing: border-box;
      padding: ${paddings.body};
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .doc-page-body.no-header {
      padding-top: ${margins.mt}mm;
    }

    .doc-page-body.no-footer {
      padding-bottom: ${margins.mb}mm;
    }

    .doc-page-body.no-header.no-footer {
      padding: ${paddings.bodyNoHeaderFooter};
    }

    .doc-page-footer {
      grid-row: 3;
      box-sizing: border-box;
      padding: ${paddings.footer};
      font-family: var(--doc-font-body, "Times New Roman", Times, serif);
      font-size: 12pt;
      line-height: 1.6;
      color: var(--doc-color-text, #111);
      background: #fff;
      position: relative;
      z-index: 1;
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .document-render--print,
    .preview-page {
      box-shadow: none;
      border-radius: 0;
      flex-shrink: 0;
    }

    .doc-page-header p,
    .doc-page-body p,
    .doc-page-footer p {
      margin: 0 0 0.4em;
      white-space: inherit;
    }

    .doc-page-header u,
    .doc-page-body u,
    .doc-page-footer u,
    .doc-page-header a,
    .doc-page-body a,
    .doc-page-footer a {
      text-decoration-thickness: 1px;
      text-underline-offset: 0.14em;
      text-decoration-skip-ink: none;
    }

    .preview-page ul,
    .preview-page ol,
    .doc-page-header ul,
    .doc-page-body ul,
    .doc-page-footer ul,
    .doc-page-header ol,
    .doc-page-body ol,
    .doc-page-footer ol {
      padding-left: 2em;
      list-style: revert;
    }

    li { display: list-item; }

    .preview-page table,
    .sirh-print-page table,
    table {
      border-collapse: collapse;
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
      margin: 6px 0;
      box-sizing: border-box;
      overflow-wrap: anywhere;
    }

    .preview-page td,
    .preview-page th,
    td, th {
      border: 1px solid var(--doc-color-border, #c8cdd8);
      padding: 6px 10px;
      min-width: 0;
      position: relative;
      box-sizing: border-box;
      word-break: normal;
      overflow-wrap: anywhere;
      white-space: normal;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .preview-page td p,
    .preview-page th p,
    td p, th p { color: inherit; margin: 0; white-space: inherit; }

    .preview-page th:not([style]),
    th:not([style]) {
      background: var(--doc-table-header-bg, transparent);
      color: var(--doc-color-text, #111);
      font-weight: 700;
      text-align: left;
    }

    th { font-weight: 700; }

    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr, img {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .document-render--print .var-resolved,
    #sirh-print-area .var-resolved {
      color: #111 !important;
      font-weight: inherit !important;
      background: none !important;
      padding: 0 !important;
      border-radius: 0 !important;
    }

    .document-render--print .var-missing,
    #sirh-print-area .var-missing { color: #dc2626 !important; }
  `;

  document.getElementById("sirh-print-area")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "sirh-print-area";
  wrap.style.display = "none";
  wrap.style.cssText += ";" + getDocumentThemeStyleAttr(tpl);

  wrap.innerHTML = buildDocumentPagesHtml(
    tpl,
    pagesToPrint,
    "sirh-print-page",
    { mode: "print" },
  );

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

  document.body.appendChild(style);
  document.body.appendChild(hideStyle);
  document.body.appendChild(wrap);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.getElementById("sirh-print-area")?.remove();
      document.getElementById("sirh-print-css")?.remove();
      document.getElementById("sirh-hide-css")?.remove();
    }, 500);
  }, 80);
}

// ═══════════════════════════════════════════════════════════════
//  printDoc(tpl, person) — Compatibilité rétroactive
//  Utilise la nouvelle logique de pagination
// ═══════════════════════════════════════════════════════════════
function printDoc(tpl, person) {
  printDocPaginated(tpl, person);
}

// ═══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DE PAGES MULTIPLES POUR L'ÉDITEUR (admin.html)
//  Gère la création automatique de pages quand le contenu dépasse A4
// ═══════════════════════════════════════════════════════════════

class EditorPageManager {
  constructor(opts = {}) {
    // Orientation A4
    this.orientation =
      opts.orientation === "landscape" ? "landscape" : "portrait";
    this.pageWidthMm = this.orientation === "landscape" ? 297 : 210;
    this.pageHeightMm = this.orientation === "landscape" ? 210 : 297;
    this.marginTopMm = opts.marginTop || 20;
    this.marginBottomMm = opts.marginBottom || 20;
    this.marginLeftMm = opts.marginLeft || 25;
    this.marginRightMm = opts.marginRight || 25;

    // Conversion mm → px (96 DPI)
    this.mmToPx = (mm) => (mm * 96) / 25.4;

    this.pageHeightPx = this.mmToPx(this.pageHeightMm);
    this.pageWidthPx = this.mmToPx(this.pageWidthMm);
    this.marginTopPx = this.mmToPx(this.marginTopMm);
    this.marginBottomPx = this.mmToPx(this.marginBottomMm);
    this.marginLeftPx = this.mmToPx(this.marginLeftMm);
    this.marginRightPx = this.mmToPx(this.marginRightMm);

    this.pages = [];
    this.containerWidth = 0;
    this.headerHeightPx = 0;
    this.footerHeightPx = 0;
  }

  /**
   * Initialiser les pages multiples dans le conteneur
   * @param {string} containerId - ID du div contenant le canvas
   * @param {boolean} hasHeader - Si header affiché
   * @param {boolean} hasFooter - Si footer affiché
   */
  init(containerId, hasHeader = false, hasFooter = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.containerId = containerId;
    const scaler = container.querySelector("#zoomScaler");
    const mainPage = container.querySelector("#mainPage");
    const secHeader = container.querySelector("#sec-header");
    const secBody = container.querySelector("#sec-body");
    const secFooter = container.querySelector("#sec-footer");

    if (!scaler || !mainPage) return;

    // Mesurer les hauteurs
    if (hasHeader && secHeader) {
      secHeader.style.display = "block";
      this.headerHeightPx = secHeader.offsetHeight;
    }

    if (hasFooter && secFooter) {
      secFooter.style.display = "block";
      this.footerHeightPx = secFooter.offsetHeight;
    }

    // Hauteur disponible pour le contenu sur une page
    this.contentHeightPx =
      this.pageHeightPx -
      this.marginTopPx -
      this.marginBottomPx -
      this.headerHeightPx -
      this.footerHeightPx;

    // Initialiser avec la première page
    this.pages = [{ id: "page_1", element: mainPage, editors: {} }];

    // Surveiller les changements de contenu
    this._watchPageOverflow();
  }

  /**
   * Surveiller le débordement de contenu et créer des pages
   * @private
   */
  _watchPageOverflow() {
    if (!this.containerId) return;

    // Surveillance tous les 500ms
    this.watchInterval = setInterval(() => {
      const scaler = document
        .getElementById(this.containerId)
        ?.querySelector("#zoomScaler");
      if (!scaler) return;

      const currentPages = scaler.querySelectorAll(".a4-page");
      let needsNewPage = false;

      // Vérifier chaque page existante
      currentPages.forEach((page, idx) => {
        const secBody = page.querySelector("#sec-body");
        if (!secBody) return;

        const contentHeight = secBody.scrollHeight;

        // Si contenu dépasse la hauteur disponible, créer nouvelle page
        if (
          contentHeight > this.contentHeightPx * 1.1 &&
          idx === currentPages.length - 1
        ) {
          needsNewPage = true;
        }
      });

      if (needsNewPage) {
        this._createNewPage();
      }
    }, 500);
  }

  /**
   * Créer une nouvelle page éditable
   * @private
   */
  _createNewPage() {
    const scaler = document
      .getElementById(this.containerId)
      ?.querySelector("#zoomScaler");
    const firstPage = scaler?.querySelector("#mainPage");
    if (!scaler || !firstPage) return;

    const pageNum = scaler.querySelectorAll(".a4-page").length + 1;
    const newPageId = `page_${pageNum}`;

    // Cloner la structure de la première page
    const newPage = firstPage.cloneNode(true);
    newPage.id = newPageId;

    // Réinitialiser les éditeurs Tiptap
    const editorElements = newPage.querySelectorAll(".tiptap-wrapper");
    editorElements.forEach((el, idx) => {
      el.innerHTML = "";
      el.id = el.id
        ? el.id.replace("ck-", `ck-page${pageNum}-`)
        : `ed-page${pageNum}-${idx}`;
    });

    // Ajouter une bordure visuelle pour délimiter les pages
    newPage.style.borderTop = "2px dashed #d0d0ca";
    newPage.style.marginTop = "10px";
    newPage.style.opacity = "0.95";

    // Ajouter au conteneur
    scaler.appendChild(newPage);

    // Stocker la page
    this.pages.push({ id: newPageId, element: newPage, editors: {} });

    // Afficher un toast
    toast(`Nouvelle page ${pageNum} créée`, "success");

    return newPageId;
  }

  /**
   * Obtenir le nombre de pages visibles
   */
  getPageCount() {
    if (!this.containerId) return 0;
    const scaler = document
      .getElementById(this.containerId)
      ?.querySelector("#zoomScaler");
    return scaler?.querySelectorAll(".a4-page").length || 0;
  }

  /**
   * Détruire l'intervalle de surveillance
   */
  destroy() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
  }
}

// Exporter globalement
window.EditorPageManager = EditorPageManager;

// ═══════════════════════════════════════════════════════════════
//  EditorPageVisualizer
//  Affiche de vrais blocs de pages dans #sec-body pour matérialiser
//  les pages A4 en temps réel pendant l'édition.
//  Compatible avec admin.html : new EditorPageVisualizer({...})
// ═══════════════════════════════════════════════════════════════

class EditorPageVisualizer {
  /**
   * @param {object} opts
   * @param {number} opts.marginTop    marges en mm (défaut 20)
   * @param {number} opts.marginBottom
   * @param {number} opts.marginLeft
   * @param {number} opts.marginRight
   */
  constructor(opts = {}) {
    const toNum = (v, d) => {
      const n = Number(v);
      return isFinite(n) ? n : d;
    };
    this._mt = toNum(opts.marginTop, 20);
    this._mb = toNum(opts.marginBottom, 20);
    this._ml = toNum(opts.marginLeft, 25);
    this._mr = toNum(opts.marginRight, 25);
    this._orientation =
      opts.orientation === "landscape" ? "landscape" : "portrait";

    // Conversion mm → px (96 DPI)
    this._mmPx = (mm) => (mm * 96) / 25.4;

    this._pageH = this._mmPx(this._orientation === "landscape" ? 210 : 297);
    this._secBody = null;
    this._guides = null;
    this._raf = 0;
    this._ro = null; // ResizeObserver
    this._bound = this._refresh.bind(this);
  }

  /**
   * Initialiser le visualizer sur un sélecteur CSS ou élément DOM.
   * @param {string|HTMLElement} selector  ex: "#sec-body"
   * @param {number} headerHeightPx        hauteur du header rendu (0 si absent)
   * @param {number} footerHeightPx        hauteur du footer rendu (0 si absent)
   */
  init(selector, headerHeightPx = 0, footerHeightPx = 0) {
    this._headerH = headerHeightPx || 0;
    this._footerH = footerHeightPx || 0;

    const el =
      typeof selector === "string"
        ? document.querySelector(selector)
        : selector;

    if (!el) return;
    this._secBody = el;

    // Créer (ou récupérer) le conteneur visuel des pages
    let guides = el.querySelector(".epv-guides");
    if (!guides) {
      guides = document.createElement("div");
      guides.className = "epv-guides";
      guides.style.cssText = [
        "position:absolute",
        "inset:0",
        "pointer-events:none",
        "z-index:0",
      ].join(";");
      el.appendChild(guides);
    }
    this._guides = guides;

    // Injecter le CSS des pages (une seule fois)
    this._injectCSS();

    // Observer les changements de taille du contenu
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this._scheduleRefresh());
      this._ro.observe(el);
      const pm = el.querySelector(".ProseMirror");
      if (pm) this._ro.observe(pm);
    }

    el.addEventListener("scroll", this._bound, { passive: true });
    window.addEventListener("resize", this._bound, { passive: true });

    this._scheduleRefresh();
  }

  /** Détruire proprement */
  destroy() {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    if (this._secBody) {
      this._secBody.removeEventListener("scroll", this._bound);
    }
    window.removeEventListener("resize", this._bound);
    if (this._guides) {
      this._guides.innerHTML = "";
    }
    cancelAnimationFrame(this._raf);
    this._secBody = null;
    this._guides = null;
  }

  // ── Privé ──────────────────────────────────────────────────

  _scheduleRefresh() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._refresh());
  }

  _refresh() {
    const secBody = this._secBody;
    const guides = this._guides;
    if (!secBody || !guides) return;

    const style = getComputedStyle(secBody);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;

    // Hauteur utile disponible par page (en px)
    const pageUsable = computeEditorPageUsableHeightPx({
      orientation: this._orientation,
      paddingTopPx: padTop,
      paddingBottomPx: padBottom,
      headerHeightPx: this._headerH,
      footerHeightPx: this._footerH,
    });

    // Hauteur réelle du contenu
    const pm = secBody.querySelector(".ProseMirror");
    const contentH = pm ? Math.max(pm.scrollHeight, pm.offsetHeight) : 0;
    const totalH = Math.max(contentH, pageUsable);

    const totalPages = Math.max(1, Math.ceil(totalH / pageUsable));

    // Reconstruire les blocs de page
    guides.innerHTML = "";
    guides.style.height = totalH + padTop + padBottom + "px";

    const currentPage = Math.max(
      1,
      Math.min(totalPages, Math.floor(secBody.scrollTop / pageUsable) + 1),
    );

    for (let p = 1; p <= totalPages; p++) {
      const top = (p - 1) * pageUsable;
      const page = document.createElement("div");
      page.className = `epv-page${p === currentPage ? " active" : ""}`;
      page.style.top = top + padTop + "px";
      page.style.height = pageUsable + "px";
      page.dataset.page = `Page ${p}`;
      guides.appendChild(page);
    }

    // Mettre à jour le badge "Page X / Y" si présent
    this._updateBadge(secBody, pageUsable, padTop, totalPages);
  }

  _updateBadge(secBody, pageUsable, padTop, totalPages) {
    const badge = document.getElementById("pageLiveBadge");
    if (!badge) return;

    // Calcul de la page courante depuis la position du curseur
    let scrollY = secBody.scrollTop;
    const curPage = Math.max(
      1,
      Math.min(totalPages, Math.floor(scrollY / pageUsable) + 1),
    );
    badge.textContent = `Page ${curPage} / ${totalPages}`;
  }

  _injectCSS() {
    if (document.getElementById("epv-css")) return;
    const s = document.createElement("style");
    s.id = "epv-css";
    s.textContent = `
      .epv-guides {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
      }
      .epv-page {
        position: absolute;
        left: 0;
        right: 0;
        background: rgba(255,255,255,.96);
        border-radius: 8px;
        box-shadow:
          0 0 0 1px rgba(15, 23, 42, 0.08),
          0 10px 24px rgba(15, 23, 42, 0.08);
        transition:
          box-shadow .16s ease,
          border-color .16s ease,
          background .16s ease;
      }
      .epv-page::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 8px;
        border: 1px solid rgba(148,153,176,.18);
      }
      .epv-page::after {
        content: attr(data-page);
        position: absolute;
        right: 12px;
        bottom: 10px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .03em;
        color: #667085;
        background: rgba(255,255,255,.94);
        border: 1px solid rgba(148,153,176,.22);
        font-family: 'IBM Plex Sans', sans-serif;
        white-space: nowrap;
      }
      .epv-page.active {
        box-shadow:
          0 0 0 1px rgba(37,99,235,.18),
          0 14px 30px rgba(37,99,235,.08);
      }
      .epv-page.active::before {
        border-color: rgba(37,99,235,.28);
      }
      .epv-page.active::after {
        color: #1d4ed8;
        border-color: rgba(37,99,235,.2);
        background: rgba(239,246,255,.96);
      }
    `;
    document.head.appendChild(s);
  }
}

// Exposer globalement
window.EditorPageVisualizer = EditorPageVisualizer;
window.computeEditorPageUsableHeightPx = computeEditorPageUsableHeightPx;
