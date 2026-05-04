import { Injectable } from '@angular/core';
import { DbService } from './db.service';

export interface FamilyRecord {
  id: string;
  nom: string;
  classes?: unknown[];
  sql?: string;
  beneficiaryMode?: 'organization' | 'table' | string;
  beneficiaryTable?: string | null;
  beneficiaryTableLabel?: string | null;
  beneficiaryLinkColumn?: string | null;
  beneficiaryDisplayColumn1?: string | null;
  beneficiaryDisplayColumn2?: string | null;
  beneficiarySql?: string | null;
  filterCatalog?: FilterDefinition[];
}

export interface TemplateRecord {
  id: string;
  nom: string;
  familyId?: string;
  organizationId?: string;
  content?: string;
  html?: string;
  body?: string;
  header?: string;
  footer?: string;
  hasHeader?: boolean;
  hasFooter?: boolean;
  filterProfile?: FilterProfileEntry[];
  updatedAt?: string;
}

export interface FilterDefinition {
  id: string;
  key?: string;
  label?: string;
  type?: 'text' | 'number' | 'date' | 'select' | string;
  placeholder?: string;
  roles?: { user?: boolean; admin?: boolean };
  staticOptions?: Array<{ value: string; label: string }> | string[];
  sourceType?: 'static' | 'sql' | string;
  sqlQuery?: string;
  sqlBuilder?: {
    tableName?: string;
    table?: string;
    valueColumn?: string;
    value?: string;
    labelColumn?: string;
    label?: string;
    distinct?: boolean;
  };
}

export interface FilterProfileEntry {
  filterId: string;
  enabled?: boolean;
  userEnabled?: boolean;
  required?: boolean;
  locked?: boolean;
  defaultValue?: unknown;
  order?: number;
}

@Injectable({ providedIn: 'root' })
export class TemplateService {
  constructor(private readonly db: DbService) {}

  async ensureLoaded(): Promise<void> {
    await this.db.ensureResources(['families', 'templates']);
  }

  async listFamilies(): Promise<FamilyRecord[]> {
    await this.ensureLoaded();
    return this.db.getFamilies<FamilyRecord>();
  }

  async listTemplates(familyId?: string | number | null, organizationId?: string | number | null): Promise<TemplateRecord[]> {
    await this.ensureLoaded();
    return this.db.getTemplates<TemplateRecord>(familyId, organizationId);
  }
}
