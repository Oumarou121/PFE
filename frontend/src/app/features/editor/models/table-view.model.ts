import type { UnknownRecord } from "./editor-common.model";
import type { TableViewFilter } from "../../../services/table-filters.service";

export interface TableViewFieldSetting {
  displayMode: "raw" | "lookup";
  lookupTable: string;
  lookupValueColumn: string;
  lookupLabelColumn: string;
  lookupLabelColumn2: string;
}

export interface TableViewConfig extends UnknownRecord {
  id: string;
  tableName: string;
  label: string;
  organizationIds?: number[];
  visibleFields: string[];
  editableFields: string[];
  previewFields: string[];
  fieldLabels: Record<string, string>;
  fieldSettings: Record<string, TableViewFieldSetting>;
  createdAt: string | null;
  updatedAt: string | null;
  filters?: TableViewFilter[];
}

export interface TableViewRowsOptions {
  config?: TableViewConfig | null;
  search?: string;
  limit?: number;
  selectedFilters?: { [key: string]: string[] } | null;
}

export interface TableViewRowsResponse {
  rows?: UnknownRecord[];
  error?: string;
}

export interface TableViewRecordResponse {
  record?: UnknownRecord | null;
  ok?: boolean;
  error?: string;
}

export interface TableViewLookupResponse {
  options?: Array<{ value: string; label: string }>;
  error?: string;
}
