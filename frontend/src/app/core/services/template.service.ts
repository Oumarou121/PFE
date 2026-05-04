import { Injectable } from '@angular/core';
import { DbService } from './db.service';

export interface FamilyRecord {
  id: string;
  nom: string;
  classes?: unknown[];
}

export interface TemplateRecord {
  id: string;
  nom: string;
  familyId?: string;
  organizationId?: string;
  updatedAt?: string;
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
