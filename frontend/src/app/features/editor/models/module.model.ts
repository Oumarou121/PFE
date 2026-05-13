export interface ModuleRecord {
  id: string;
  organizationIds: number[];
  name: string;
  description?: string;
  icon?: string;
  mainTableViewId: string;
  isActive: boolean;
  displayOrder: number;
  tableViews: ModuleTableView[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ModuleTableView {
  id: string;
  moduleId: string;
  tableViewConfigId: string;
  isPrimary: boolean;
  isManagementTable: boolean;
  orderIndex: number;
}
