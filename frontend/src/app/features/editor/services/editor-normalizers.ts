import {
  BeneficiaryRecord,
  FamilyRecord,
  VariableDefinition,
} from "../models/family.model";
import {
  FilterColumnBinding,
  FilterDefinition,
  FilterOption,
  FilterSqlBuilder,
  FilterValueMap,
  QueryParamMap,
  RuntimeFilterEntry,
  TemplateFilterProfileEntry,
} from "../models/filter.model";
import {
  GraphicCharterConfig,
  GraphicCharterRecord,
} from "../models/graphic-charter.model";
import { OrganizationRecord } from "../models/organization.model";
import { AdminAccountRecord } from "../models/admin-account.model";
import { DatabaseSchema, SchemaColumn } from "../models/schema.model";
import {
  TableViewConfig,
  TableViewFieldSetting,
} from "../models/table-view.model";
import {
  TableFilterOption,
  TableFilterSourceType,
  TableViewFilter,
} from "../../../services/table-filters.service";
import {
  HeaderFooterDistances,
  TemplateRecord,
  TemplateSectionDirections,
} from "../models/template.model";
import { EditorState, UnknownRecord } from "../models/editor-common.model";

export const ORGANIZATION_SCOPE_COLUMN = "etablissement_id";
export const SUPERADMIN_FAMILY_HIDDEN_TABLES = Object.freeze([
  "family",
  "template",
  "graphic_charter",
  "admin_account",
  "charte",
]);

export function cloneData<T>(data: T): T {
  if (data === undefined) return data;
  return JSON.parse(JSON.stringify(data)) as T;
}

export function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function normalizeOrganizationId(
  value: unknown,
  fallback: string | null = null,
): string | null {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

export function getScopedOrganizationId(
  record: UnknownRecord | null | undefined,
  fallback: string | null = null,
): string | null {
  return normalizeOrganizationId(record?.["organizationId"], fallback);
}

export function isScopedOrganizationFamily(
  family: Partial<FamilyRecord> | null | undefined,
): boolean {
  return String(family?.beneficiaryMode || "").toLowerCase() === "organization";
}

export function withOrganizationQueryParams(
  params: UnknownRecord = {},
): UnknownRecord {
  return {
    ...params,
    organizationId: normalizeOrganizationId(params["organizationId"], null),
  };
}

export function normalizeFilterParamName(
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

export function normalizeFilterOption(
  option: unknown,
  fallbackValue = "",
): FilterOption | null {
  if (option === undefined || option === null) return null;
  if (typeof option !== "object" || Array.isArray(option)) {
    const value = String(option).trim();
    return value ? { value, label: value } : null;
  }
  const raw = option as UnknownRecord;
  const value = String(
    raw["value"] ?? raw["id"] ?? raw["code"] ?? fallbackValue ?? "",
  ).trim();
  if (!value) return null;
  const label = String(
    raw["label"] ?? raw["libelle"] ?? raw["nom"] ?? raw["name"] ?? value,
  ).trim();
  return { value, label: label || value };
}

export function normalizeFilterOptions(options: unknown): FilterOption[] {
  const seen = new Set<string>();
  return (Array.isArray(options) ? options : [])
    .map((option, index) => normalizeFilterOption(option, String(index + 1)))
    .filter((option): option is FilterOption => {
      if (!option || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
}

export function parseFilterStaticOptions(raw: unknown): FilterOption[] {
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

export function normalizeFilterSqlBuilder(
  builder: unknown = {},
): FilterSqlBuilder {
  const raw =
    builder && typeof builder === "object" && !Array.isArray(builder)
      ? (builder as UnknownRecord)
      : {};
  return {
    tableName: String(raw["tableName"] || raw["table"] || "").trim(),
    valueColumn: String(raw["valueColumn"] || raw["value"] || "").trim(),
    labelColumn: String(raw["labelColumn"] || raw["label"] || "").trim(),
    distinct: raw["distinct"] !== false,
  };
}

export function normalizeFilterColumnBinding(
  binding: unknown = {},
): FilterColumnBinding {
  const raw =
    binding && typeof binding === "object" && !Array.isArray(binding)
      ? (binding as UnknownRecord)
      : {};
  const rawMode = raw["mode"];
  const mode =
    rawMode === "table-links" || rawMode === "base-column" ? rawMode : "manual";
  return {
    tableName: String(raw["tableName"] || raw["table"] || "").trim(),
    columnName: String(raw["columnName"] || raw["column"] || "").trim(),
    mode,
  };
}

export function normalizeFilterColumnBindings(
  bindings: unknown,
  fallbackBinding: unknown = null,
): FilterColumnBinding[] {
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

export function normalizeFilterDefinition(
  filter: unknown = {},
  index = 0,
): FilterDefinition {
  const raw =
    filter && typeof filter === "object" ? (filter as UnknownRecord) : {};
  const label =
    String(raw["label"] || raw["name"] || "").trim() || `Filtre ${index + 1}`;
  const normalizedSqlBuilder = normalizeFilterSqlBuilder(
    raw["sqlBuilder"] || raw["builder"] || {},
  );
  const hasSqlBuilderData = !!(
    normalizedSqlBuilder.tableName ||
    normalizedSqlBuilder.valueColumn ||
    normalizedSqlBuilder.labelColumn
  );
  const hasSqlQuery =
    String(raw["sqlQuery"] || raw["query"] || "").trim().length > 0;
  const rawType = String(raw["type"] || "")
    .trim()
    .toLowerCase();
  const type = ["text", "number", "date", "select"].includes(rawType)
    ? (rawType as FilterDefinition["type"])
    : hasSqlBuilderData ||
        hasSqlQuery ||
        raw["sourceType"] === "sql" ||
        raw["staticOptions"] ||
        raw["staticOptionsText"]
      ? "select"
      : "text";
  const sourceType =
    type === "select" &&
    (raw["sourceType"] === "sql" || hasSqlBuilderData || hasSqlQuery)
      ? "sql"
      : "static";
  return {
    id: String(raw["id"] || genId("flt")),
    key: normalizeFilterParamName(
      raw["key"] || raw["param"] || raw["paramName"] || label,
      `filtre_${index + 1}`,
    ),
    label,
    type,
    sourceType,
    placeholder: String(raw["placeholder"] || "").trim(),
    helpText: String(raw["helpText"] || raw["help"] || "").trim(),
    roles: {
      admin: (raw["roles"] as UnknownRecord | undefined)?.["admin"] !== false,
      user: (raw["roles"] as UnknownRecord | undefined)?.["user"] !== false,
    },
    columnBinding: normalizeFilterColumnBinding(
      raw["columnBinding"] || raw["binding"] || {},
    ),
    columnBindings: normalizeFilterColumnBindings(
      raw["columnBindings"] || raw["bindings"] || [],
      raw["columnBinding"] || raw["binding"] || {},
    ),
    staticOptions:
      type === "select"
        ? parseFilterStaticOptions(
            raw["staticOptionsText"] || raw["staticOptions"] || [],
          )
        : [],
    sqlBuilder:
      type === "select" ? normalizedSqlBuilder : normalizeFilterSqlBuilder({}),
    sqlQuery:
      type === "select" && sourceType === "sql"
        ? String(raw["sqlQuery"] || raw["query"] || "").trim()
        : "",
  };
}

export function normalizeFilterCatalog(filters: unknown): FilterDefinition[] {
  return (Array.isArray(filters) ? filters : []).map((filter, index) =>
    normalizeFilterDefinition(filter, index),
  );
}

export function normalizeTemplateFilterProfileEntry(
  entry: unknown = {},
  index = 0,
): TemplateFilterProfileEntry | null {
  const raw =
    entry && typeof entry === "object" ? (entry as UnknownRecord) : {};
  const filterId = String(raw["filterId"] || raw["id"] || "").trim();
  if (!filterId) return null;
  return {
    filterId,
    enabled: raw["enabled"] !== false,
    adminEnabled: raw["adminEnabled"] !== false,
    userEnabled: raw["userEnabled"] !== false,
    required: !!raw["required"],
    locked: !!raw["locked"],
    order: Number.isFinite(Number(raw["order"])) ? Number(raw["order"]) : index,
    defaultValue:
      raw["defaultValue"] === undefined || raw["defaultValue"] === null
        ? null
        : raw["defaultValue"],
    allowedValueMode: raw["allowedValueMode"] === "subset" ? "subset" : "all",
    allowedValues: normalizeFilterOptions(raw["allowedValues"] || []),
  };
}

export function normalizeTemplateFilterProfile(
  profile: unknown,
): TemplateFilterProfileEntry[] {
  return (Array.isArray(profile) ? profile : [])
    .map((entry, index) => normalizeTemplateFilterProfileEntry(entry, index))
    .filter((entry): entry is TemplateFilterProfileEntry => !!entry);
}

export function normalizeFilterInputValue(
  filter: Pick<FilterDefinition, "type"> | null | undefined,
  rawValue: unknown,
): string | number | null {
  if (rawValue === undefined || rawValue === null) return null;
  const text = String(rawValue).trim();
  if (!text) return null;
  if (filter?.type === "number") {
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  return text;
}

export function buildDocumentFilterParams(
  values: FilterValueMap = {},
  filterDefs: FilterDefinition[] = [],
): QueryParamMap {
  const params: QueryParamMap = {};
  filterDefs.forEach((filter) => {
    if (!filter.key) return;
    const normalized = normalizeFilterInputValue(filter, values[filter.id]);
    params[filter.key] = normalized;
    params[`filter_${filter.key}`] = normalized;
  });
  return params;
}

export function getFamilyFilterCatalog(
  family: Partial<FamilyRecord> | null | undefined,
): FilterDefinition[] {
  return normalizeFilterCatalog(family?.filterCatalog || []);
}

export function getTemplateFilterProfile(
  template: Partial<TemplateRecord> | null | undefined,
): TemplateFilterProfileEntry[] {
  return normalizeTemplateFilterProfile(template?.filterProfile || []);
}

export function getEnabledTemplateFilters(
  family: FamilyRecord,
  template: TemplateRecord,
  role: "admin" | "user" = "user",
): RuntimeFilterEntry[] {
  const profileMap = new Map(
    getTemplateFilterProfile(template).map((entry) => [entry.filterId, entry]),
  );
  return getFamilyFilterCatalog(family)
    .map((filterDef) => {
      const rawProfile = profileMap.get(filterDef.id);
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
        !rawProfile.allowedValues.length;
      const profile = isLegacyDisabledProfile
        ? { ...rawProfile, enabled: true }
        : rawProfile || {
            filterId: filterDef.id,
            enabled: true,
            adminEnabled: true,
            userEnabled: true,
            required: false,
            locked: false,
            order: 999,
            defaultValue: null,
            allowedValueMode: "all" as const,
            allowedValues: [],
          };
      return { ...cloneData(filterDef), profile: cloneData(profile) };
    })
    .filter(
      (entry) =>
        entry.profile.enabled &&
        (role === "admin"
          ? entry.profile.adminEnabled !== false
          : entry.profile.userEnabled !== false) &&
        entry.roles?.[role] !== false,
    )
    .sort((a, b) => {
      const orderGap = (a.profile.order || 0) - (b.profile.order || 0);
      return orderGap || a.label.localeCompare(b.label, "fr");
    });
}

export function normalizeFamilyRecord(record: unknown = {}): FamilyRecord {
  const next = cloneData((record || {}) as UnknownRecord) || {};
  next["beneficiaryMode"] = isScopedOrganizationFamily(next)
    ? "organization"
    : "table";
  next["beneficiaryTable"] =
    next["beneficiaryMode"] === "table"
      ? String(next["beneficiaryTable"] || next["beneficiaireTable"] || "")
      : null;
  next["beneficiaryTableLabel"] = String(
    next["beneficiaryTableLabel"] ||
      next["beneficiaryLabel"] ||
      next["beneficiaryDisplayName"] ||
      "",
  ).trim();
  next["beneficiaryDisplayColumn1"] = String(
    next["beneficiaryDisplayColumn1"] ||
      next["beneficiaryDisplayColumn"] ||
      next["beneficiaryLabelColumn"] ||
      "",
  ).trim();
  next["beneficiaryLinkColumn"] = String(
    next["beneficiaryLinkColumn"] ||
      next["beneficiaryBindingColumn"] ||
      next["beneficiaryJoinColumn"] ||
      next["beneficiaryIdColumn"] ||
      "",
  ).trim();
  next["beneficiaryDisplayColumn2"] = String(
    next["beneficiaryDisplayColumn2"] ||
      next["beneficiarySecondaryDisplayColumn"] ||
      next["beneficiarySubtitleColumn"] ||
      "",
  ).trim();
  next["beneficiarySql"] = String(
    next["beneficiarySql"] || next["beneficiarySqlText"] || "",
  ).trim();
  const rawOrgIds = next["organizationIds"] || next["OrganizationIds"] || [];
  next["organizationIds"] = Array.isArray(rawOrgIds)
    ? rawOrgIds.map((id: any) => Number(id))
    : [];
  next["filterCatalog"] = normalizeFilterCatalog(
    next["filterCatalog"] || next["filterCatalogJson"] || [],
  );
  return next as FamilyRecord;
}

export function normalizeTemplateDirection(
  value: unknown,
  fallback: "ltr" | "rtl" = "ltr",
): "ltr" | "rtl" {
  return String(value || fallback).toLowerCase() === "rtl" ? "rtl" : "ltr";
}

export function normalizeTemplateSectionDirections(
  value: unknown = {},
): TemplateSectionDirections {
  const src =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as UnknownRecord)
      : {};
  return {
    header: normalizeTemplateDirection(src["header"], "ltr"),
    body: normalizeTemplateDirection(src["body"], "ltr"),
    footer: normalizeTemplateDirection(src["footer"], "ltr"),
  };
}

export function normalizeTemplateSectionDisplay(
  value: unknown,
): "all" | "first" | "even" | "odd" {
  const mode = String(value || "all").toLowerCase();
  return mode === "first" || mode === "even" || mode === "odd" ? mode : "all";
}

export function normalizeHeaderFooterDistances(
  src: unknown,
  fallback?: HeaderFooterDistances,
): HeaderFooterDistances {
  const raw = src && typeof src === "object" ? (src as UnknownRecord) : {};
  const base = fallback || { headerTop: 5, footerBottom: 5 };
  const toNum = (value: unknown, def: number) =>
    Number.isFinite(Number(value)) ? Number(value) : def;
  return {
    headerTop: toNum(raw["headerTop"], base.headerTop),
    footerBottom: toNum(raw["footerBottom"], base.footerBottom),
  };
}

export function normalizeTemplateRecord(record: unknown = {}): TemplateRecord {
  const next = cloneData((record || {}) as UnknownRecord) || {};
  next["id"] = String(next["id"] || genId("tpl"));
  next["organizationId"] = getScopedOrganizationId(next);
  next["graphicCharterId"] = next["graphicCharterId"]
    ? String(next["graphicCharterId"])
    : null;
  next["headerFooterDistances"] = normalizeHeaderFooterDistances(
    next["headerFooterDistances"] || next["pageHeaderFooterDistances"],
  );
  next["filterProfile"] = normalizeTemplateFilterProfile(
    next["filterProfile"] || next["filterProfileJson"] || [],
  );
  next["headerDisplay"] = normalizeTemplateSectionDisplay(
    next["headerDisplay"] || next["headerVisibility"] || next["headerMode"],
  );
  next["footerDisplay"] = normalizeTemplateSectionDisplay(
    next["footerDisplay"] || next["footerVisibility"] || next["footerMode"],
  );
  next["sectionDirections"] = normalizeTemplateSectionDirections(
    next["sectionDirections"] || next["directions"] || next["sectionDir"],
  );
  return next as TemplateRecord;
}

export const DEFAULT_GRAPHIC_CHARTER: GraphicCharterConfig = {
  identity: { officialName: "", directorName: "", slogan: "", logoText: "" },
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
    html: '<p style="text-align:center"><strong>{{nom_etab}}</strong></p><p style="text-align:center;font-size:10pt;color:var(--doc-color-secondary)">{{adresse_etab}} - Tel : {{tel_etab}}</p>',
  },
  footer: {
    enabledByDefault: true,
    displayMode: "all",
    html: '<p style="text-align:center;font-size:9pt;color:var(--doc-color-secondary)">Document officiel - {{nom_etab}} - Annee {{annee_univ}}</p>',
  },
  watermark: { enabled: false, text: "", color: "#94a3b8", opacity: 0.08 },
};

function isPlainObject(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T>(base: T, extra: unknown): T {
  if (!isPlainObject(base)) return cloneData(extra as T);
  const out = cloneData(base) as UnknownRecord;
  Object.entries((extra || {}) as UnknownRecord).forEach(([key, value]) => {
    out[key] =
      isPlainObject(value) && isPlainObject(out[key])
        ? deepMerge(out[key], value)
        : cloneData(value);
  });
  return out as T;
}

export function normalizeGraphicCharterConfig(
  config: unknown = {},
): GraphicCharterConfig {
  const merged = deepMerge(
    DEFAULT_GRAPHIC_CHARTER,
    config,
  ) as GraphicCharterConfig;
  const size = String(
    merged.layout?.pageBackground?.size || "cover",
  ).toLowerCase();
  const repeat = String(
    merged.layout?.pageBackground?.repeat || "no-repeat",
  ).toLowerCase();
  return {
    ...merged,
    layout: {
      ...merged.layout,
      orientation:
        String(merged.layout?.orientation || "portrait").toLowerCase() ===
        "landscape"
          ? "landscape"
          : "portrait",
      pageMargins: {
        mt: Number(merged.layout?.pageMargins?.mt) || 20,
        mb: Number(merged.layout?.pageMargins?.mb) || 20,
        ml: Number(merged.layout?.pageMargins?.ml) || 25,
        mr: Number(merged.layout?.pageMargins?.mr) || 25,
      },
      headerFooterDistances: normalizeHeaderFooterDistances(
        merged.layout?.headerFooterDistances,
      ),
      pageBackground: {
        enabled:
          !!merged.layout?.pageBackground?.enabled &&
          !!String(merged.layout?.pageBackground?.image || "").trim(),
        image: String(merged.layout?.pageBackground?.image || "").trim(),
        size: size === "contain" || size === "100% 100%" ? size : "cover",
        position: String(
          merged.layout?.pageBackground?.position || "center center",
        ).toLowerCase(),
        repeat:
          repeat === "repeat" || repeat === "repeat-x" || repeat === "repeat-y"
            ? repeat
            : "no-repeat",
      },
    },
    header: {
      ...merged.header,
      displayMode: normalizeTemplateSectionDisplay(merged.header?.displayMode),
    },
    footer: {
      ...merged.footer,
      displayMode: normalizeTemplateSectionDisplay(merged.footer?.displayMode),
    },
    watermark: {
      enabled: !!merged.watermark?.enabled,
      text: String(merged.watermark?.text || ""),
      color: merged.watermark?.color || DEFAULT_GRAPHIC_CHARTER.watermark.color,
      opacity: Number.isFinite(Number(merged.watermark?.opacity))
        ? Number(merged.watermark.opacity)
        : DEFAULT_GRAPHIC_CHARTER.watermark.opacity,
    },
  };
}

function normalizeLegacyGraphicCharter(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const value = raw as UnknownRecord;
  if (Array.isArray(value["graphicCharters"])) return value["graphicCharters"];
  if (Array.isArray(value["charters"])) return value["charters"];
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

export function normalizeGraphicCharterEntry(
  entry: unknown = {},
  index = 0,
): GraphicCharterRecord {
  const raw =
    entry && typeof entry === "object" ? (entry as UnknownRecord) : {};
  const configSource = "config" in raw ? raw["config"] : raw;
  return {
    id: String(raw["id"] || genId("charter")),
    organizationId: normalizeOrganizationId(
      raw["organizationId"] ?? raw["etablissement_id"],
    ),
    name:
      String(raw["name"] || raw["nom"] || "").trim() || `Charte ${index + 1}`,
    description: String(raw["description"] || "").trim(),
    isDefault: !!raw["isDefault"],
    createdAt: (raw["createdAt"] as string) || null,
    updatedAt: (raw["updatedAt"] as string) || null,
    config: normalizeGraphicCharterConfig(configSource || {}),
  };
}

export function normalizeGraphicCharterCollection(
  raw: unknown,
): GraphicCharterRecord[] {
  const list = normalizeLegacyGraphicCharter(raw).map((entry, index) =>
    normalizeGraphicCharterEntry(entry, index),
  );
  if (!list.length) return [];
  const preferred =
    list.find((entry) => entry.isDefault)?.id || list[0]?.id || null;
  return list.map((entry) => ({ ...entry, isDefault: entry.id === preferred }));
}

export function normalizeOrganizationRecord(
  record: unknown = {},
): OrganizationRecord {
  const next = cloneData((record || {}) as UnknownRecord) || {};
  next["id"] = String(next["id"] || next["organizationId"] || genId("org"));
  next["organizationId"] = normalizeOrganizationId(
    next["organizationId"],
    next["id"],
  );
  next["databaseName"] =
    String(
      next["databaseName"] ||
        next["DatabaseName"] ||
        next["organizationSystemPrefix"] ||
        next["OrganizationSystemPrefix"] ||
        "",
    ).trim() || null;
  next["graphicCharters"] = normalizeGraphicCharterCollection(
    next["graphicCharters"] ?? next["graphicCharter"],
  );
  delete next["graphicCharter"];
  return next as OrganizationRecord;
}

export function normalizeTableViewRecord(
  record: unknown = {},
): TableViewConfig {
  const next = cloneData((record || {}) as UnknownRecord) || {};
  const normalizeFieldList = (value: unknown, max = Infinity) =>
    [
      ...new Set(
        (Array.isArray(value) ? value : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      ),
    ].slice(0, max);
  const normalizeFieldLabels = (value: unknown): Record<string, string> => {
    const source =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as UnknownRecord)
        : {};
    return Object.fromEntries(
      Object.entries(source)
        .map(([field, label]) => [
          String(field || "").trim(),
          String(label || "").trim(),
        ])
        .filter(([field]) => field),
    );
  };
  const normalizeFieldSettings = (
    value: unknown,
  ): Record<string, TableViewFieldSetting> => {
    const source =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as UnknownRecord)
        : {};
    return Object.fromEntries(
      Object.entries(source)
        .map(([field, config]) => {
          const raw =
            config && typeof config === "object"
              ? (config as UnknownRecord)
              : {};
          return [
            String(field || "").trim(),
            {
              displayMode:
                String(
                  raw["displayMode"] || raw["display_mode"] || "",
                ).trim() === "lookup"
                  ? "lookup"
                  : "raw",
              lookupTable: String(
                raw["lookupTable"] ||
                  raw["lookup_table"] ||
                  raw["lookupTableName"] ||
                  "",
              ).trim(),
              lookupValueColumn: String(
                raw["lookupValueColumn"] ||
                  raw["lookup_value_column"] ||
                  raw["valueColumn"] ||
                  "",
              ).trim(),
              lookupLabelColumn: String(
                raw["lookupLabelColumn"] ||
                  raw["lookup_label_column"] ||
                  raw["labelColumn"] ||
                  "",
              ).trim(),
              lookupLabelColumn2: String(
                raw["lookupLabelColumn2"] ||
                  raw["lookup_label_column2"] ||
                  raw["labelColumn2"] ||
                  "",
              ).trim(),
            },
          ];
        })
        .filter(([field]) => field),
    );
  };
  const normalizeTableViewOptions = (value: unknown): TableFilterOption[] => {
    const source = Array.isArray(value) ? value : [];
    return source
      .map((option) => {
        const raw =
          option && typeof option === "object" ? (option as UnknownRecord) : {};
        const valueText = String(raw["value"] || "").trim();
        const labelText = String(raw["label"] || valueText || "").trim();
        return valueText
          ? { value: valueText, label: labelText || valueText }
          : null;
      })
      .filter(Boolean) as TableFilterOption[];
  };
  const normalizeTableViewFilters = (value: unknown): TableViewFilter[] => {
    const source = Array.isArray(value) ? value : [];
    return source
      .map((filter, index) => {
        const raw =
          filter && typeof filter === "object" ? (filter as UnknownRecord) : {};
        const sourceType =
          String(raw["sourceType"] || "Static").trim() === "Table"
            ? TableFilterSourceType.Table
            : TableFilterSourceType.Static;
        return {
          id: String(raw["id"] || genId("tvf")),
          name: String(raw["name"] || `Filtre ${index + 1}`).trim(),
          linkColumn: String(raw["linkColumn"] || "").trim(),
          sourceType,
          staticOptions:
            sourceType === TableFilterSourceType.Static
              ? normalizeTableViewOptions(raw["staticOptions"])
              : undefined,
          sqlBuilder:
            sourceType === TableFilterSourceType.Table && raw["sqlBuilder"]
              ? normalizeFilterSqlBuilder(raw["sqlBuilder"])
              : undefined,
          helpText: String(raw["helpText"] || "").trim(),
          enabled: raw["enabled"] !== false,
        } satisfies TableViewFilter;
      })
      .filter((filter) => filter.name && filter.linkColumn);
  };
  return {
    ...next,
    id: String(next["id"] || genId("tvw")),
    tableName: String(next["tableName"] || "").trim(),
    label: String(next["label"] || "").trim(),
    visibleFields: normalizeFieldList(next["visibleFields"]),
    editableFields: normalizeFieldList(next["editableFields"]),
    previewFields: normalizeFieldList(next["previewFields"], 3),
    fieldLabels: normalizeFieldLabels(next["fieldLabels"]),
    fieldSettings: normalizeFieldSettings(next["fieldSettings"]),
    filters: normalizeTableViewFilters(next["filters"]),
    organizationIds: Array.isArray(
      next["organizationIds"] || next["OrganizationIds"],
    )
      ? (next["organizationIds"] || next["OrganizationIds"]).map((id: any) =>
          Number(id),
        )
      : [],
    createdAt: next["createdAt"] || null,
    updatedAt: next["updatedAt"] || null,
  };
}

export function normalizeAdminRecord(record: unknown = {}): AdminAccountRecord {
  const next = cloneData((record || {}) as UnknownRecord) || {};
  next["id"] = String(next["id"] || genId("adm"));
  next["organizationId"] = normalizeOrganizationId(
    next["organizationId"] ?? next["IdOrganization"],
  );
  next["nom"] = String(next["nom"] || next["name"] || next["username"] || "");
  next["email"] = String(next["email"] || next["mail"] || "");
  next["role"] = String(next["role"] || "admin");
  return next as AdminAccountRecord;
}

export function normalizeState(state: unknown = {}): EditorState {
  const next =
    state && typeof state === "object" ? (state as Partial<EditorState>) : {};
  return {
    organizations: Array.isArray(next.organizations)
      ? next.organizations.map(normalizeOrganizationRecord)
      : [],
    admins: Array.isArray(next.admins)
      ? next.admins.map(normalizeAdminRecord)
      : [],
    families: Array.isArray(next.families)
      ? next.families.map(normalizeFamilyRecord)
      : [],
    templates: Array.isArray(next.templates)
      ? next.templates.map(normalizeTemplateRecord)
      : [],
    tableViews: Array.isArray(next.tableViews)
      ? next.tableViews.map(normalizeTableViewRecord)
      : [],
    modules: Array.isArray(next.modules) ? cloneData(next.modules) : [],
    settings:
      next.settings && typeof state === "object"
        ? cloneData(next.settings)
        : {},
    _loaded: next._loaded || {},
  };
}

export function quoteSqlIdentifier(name: unknown): string {
  return `[${String(name || "").replace(/]/g, "]]")}]`;
}

export function getSchemaColumnsForTable(
  schema: DatabaseSchema | null | undefined,
  tableName: string | null | undefined,
): SchemaColumn[] {
  return (schema?.columns || []).filter((column) => column.table === tableName);
}

export function getSchemaPrimaryColumn(
  schema: DatabaseSchema | null | undefined,
  tableName: string,
): string {
  return (
    getSchemaColumnsForTable(schema, tableName).find(
      (column) => column.key === "PRI",
    )?.name || "id"
  );
}

export function getSchemaColumn(
  schema: DatabaseSchema | null | undefined,
  tableName: string,
  columnName: string,
): SchemaColumn | undefined {
  return getSchemaColumnsForTable(schema, tableName).find(
    (column) => column.name === columnName,
  );
}

export function getConfiguredBeneficiaryDisplayColumns(
  family: FamilyRecord,
  schema: DatabaseSchema,
  tableName: string | null | undefined,
): string[] {
  if (!schema || !tableName) return [];
  const available = new Set(
    getSchemaColumnsForTable(schema, tableName).map((column) => column.name),
  );
  return [
    family.beneficiaryDisplayColumn1,
    family.beneficiaryDisplayColumn2,
  ].filter(
    (columnName, index, list) =>
      !!columnName &&
      available.has(columnName) &&
      list.indexOf(columnName) === index,
  );
}

export function getConfiguredBeneficiaryLinkColumn(
  family: FamilyRecord,
  schema: DatabaseSchema,
  tableName: string,
): string {
  const configured = String(family.beneficiaryLinkColumn || "").trim();
  const columns = getSchemaColumnsForTable(schema, tableName);
  return configured && columns.some((column) => column.name === configured)
    ? configured
    : getSchemaPrimaryColumn(schema, tableName);
}

export function buildBeneficiaryLabelFromColumns(
  row: UnknownRecord = {},
  columns: string[] = [],
): string {
  return columns
    .map((columnName) => row[columnName])
    .filter(
      (value) => value !== undefined && value !== null && String(value).trim(),
    )
    .map((value) => String(value).trim())
    .join(" ")
    .trim();
}

export function guessBeneficiaryLabel(row: UnknownRecord = {}): string {
  for (const key of [
    "nom_prenom",
    "nom_complet",
    "display_name",
    "full_name",
    "libelle",
    "intitule",
    "titre",
    "nom",
  ]) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim())
      return String(value).trim();
  }
  const fullName = [row["prenom"], row["nom"]]
    .filter(
      (value) => value !== undefined && value !== null && String(value).trim(),
    )
    .join(" ")
    .trim();
  if (fullName) return fullName;
  const fallbackKey = Object.keys(row).find(
    (key) =>
      !key.startsWith("_") &&
      row[key] !== undefined &&
      row[key] !== null &&
      typeof row[key] !== "object" &&
      String(row[key]).trim(),
  );
  return fallbackKey ? String(row[fallbackKey]).trim() : "Beneficiaire";
}

export function guessBeneficiarySubtitle(
  row: UnknownRecord = {},
  label = "",
): string {
  const subtitle = [
    row["sous_libelle"],
    row["poste"],
    row["fonction"],
    row["grade"],
    row["departement"],
    row["service"],
    row["email"],
    row["code"],
    row["matricule"],
  ].find(
    (value) => value !== undefined && value !== null && String(value).trim(),
  );
  if (!subtitle) return "";
  const normalized = String(subtitle).trim();
  return normalized === label ? "" : normalized;
}

export function buildBeneficiaryLabelSqlExpr(
  columns: string[] = [],
  alias = "src",
): string {
  const validColumns = columns.filter(Boolean);
  if (!validColumns.length) return "";
  const parts = validColumns.map(
    (columnName) =>
      `COALESCE(CONVERT(NVARCHAR(255), ${alias}.${quoteSqlIdentifier(columnName)}), '')`,
  );
  return parts.length === 1
    ? parts[0]
    : `LTRIM(RTRIM(${parts.join(` + ' ' + `)}))`;
}

export function buildDistinctFilterSqlQuery(
  builder: FilterSqlBuilder,
  schema: DatabaseSchema | null = null,
): string {
  if (!builder.tableName || !builder.valueColumn) return "";
  const tableColumns = schema
    ? getSchemaColumnsForTable(schema, builder.tableName)
    : [];
  const hasOrganizationColumn = tableColumns.some(
    (column) => column.name === ORGANIZATION_SCOPE_COLUMN,
  );
  const labelExpr = builder.labelColumn
    ? `COALESCE(CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(builder.labelColumn)}), CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(builder.valueColumn)}))`
    : `CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(builder.valueColumn)})`;
  return [
    "SELECT DISTINCT",
    `  CONVERT(NVARCHAR(255), ${quoteSqlIdentifier(builder.valueColumn)}) AS value,`,
    `  ${labelExpr} AS label`,
    `FROM ${quoteSqlIdentifier(builder.tableName)}`,
    `WHERE ${quoteSqlIdentifier(builder.valueColumn)} IS NOT NULL${hasOrganizationColumn ? `\n  AND (:organizationId IS NULL OR ${quoteSqlIdentifier(ORGANIZATION_SCOPE_COLUMN)} = :organizationId)` : ""}`,
    "ORDER BY label ASC",
  ].join("\n");
}

export function getFamilyListObjectVars(
  family: FamilyRecord,
): VariableDefinition[] {
  return (family.classes || [])
    .flatMap((cls) => cls.vars || [])
    .filter((varDef) => varDef?.type === "list-object");
}

export function toBeneficiaryRecord(
  row: UnknownRecord,
  labelColumns: string[] = [],
  sourceTable: string | null = null,
  fallbackIdKey = "id",
): BeneficiaryRecord {
  const label =
    buildBeneficiaryLabelFromColumns(row, labelColumns) ||
    guessBeneficiaryLabel(row);
  return {
    ...row,
    id: String(row["id"] ?? row[fallbackIdKey]),
    _displayLabel: label,
    _displaySubtitle: guessBeneficiarySubtitle(row, label),
    _sourceTable: sourceTable,
  };
}
