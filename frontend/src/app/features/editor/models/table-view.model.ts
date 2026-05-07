import type { UnknownRecord } from './editor-common.model';

export interface TableViewFieldSetting {
  displayMode: 'raw' | 'lookup';
  lookupTable: string;
  lookupValueColumn: string;
  lookupLabelColumn: string;
  lookupLabelColumn2: string;
}

export interface TableViewConfig extends UnknownRecord {
  id: string;
  tableName: string;
  label: string;
  visibleFields: string[];
  editableFields: string[];
  previewFields: string[];
  fieldLabels: Record<string, string>;
  fieldSettings: Record<string, TableViewFieldSetting>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TableViewRowsOptions {
  config?: TableViewConfig | null;
  search?: string;
  limit?: number;
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
