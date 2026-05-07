export type FilterType = 'text' | 'number' | 'date' | 'select';
export type FilterSourceType = 'static' | 'sql';
export type FilterRole = 'admin' | 'user';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterRoleAccess {
  admin: boolean;
  user: boolean;
}

export interface FilterSqlBuilder {
  tableName: string;
  valueColumn: string;
  labelColumn: string;
  distinct: boolean;
}

export interface FilterColumnBinding {
  tableName: string;
  columnName: string;
  mode: 'manual' | 'table-links' | 'base-column';
}

export interface FilterDefinition {
  id: string;
  key: string;
  label: string;
  type: FilterType;
  sourceType: FilterSourceType;
  placeholder: string;
  helpText: string;
  roles: FilterRoleAccess;
  columnBinding: FilterColumnBinding;
  columnBindings: FilterColumnBinding[];
  staticOptions: FilterOption[];
  sqlBuilder: FilterSqlBuilder;
  sqlQuery: string;
}

export interface TemplateFilterProfileEntry {
  filterId: string;
  enabled: boolean;
  adminEnabled: boolean;
  userEnabled: boolean;
  required: boolean;
  locked: boolean;
  order: number;
  defaultValue: unknown;
  allowedValueMode: 'all' | 'subset';
  allowedValues: FilterOption[];
}

export interface RuntimeFilterEntry extends FilterDefinition {
  profile: TemplateFilterProfileEntry;
  options?: FilterOption[];
}

export type FilterValueMap = Record<string, unknown>;
export type QueryParamMap = Record<string, string | number | null>;
