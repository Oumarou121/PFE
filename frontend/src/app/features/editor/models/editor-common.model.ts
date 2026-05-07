export type EditorResource =
  | 'families'
  | 'templates'
  | 'organizations'
  | 'admins'
  | 'tableViews'
  | 'settings';

export type UnknownRecord = Record<string, any>;

export interface EditorState {
  organizations: OrganizationRecord[];
  admins: AdminAccountRecord[];
  families: FamilyRecord[];
  templates: TemplateRecord[];
  tableViews: TableViewConfig[];
  settings: UnknownRecord;
  _loaded?: Partial<Record<EditorResource, boolean>>;
}

export interface BootstrapResponse {
  user?: unknown;
  state?: Partial<EditorState>;
}

export interface EditorListResponse<T> {
  items?: T[];
}

export interface QueryResponse {
  rows?: UnknownRecord[];
  error?: string;
}

import type { AdminAccountRecord } from './admin-account.model';
import type { FamilyRecord } from './family.model';
import type { OrganizationRecord } from './organization.model';
import type { TableViewConfig } from './table-view.model';
import type { TemplateRecord } from './template.model';
