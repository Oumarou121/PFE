import { Injectable } from '@angular/core';
import { DbService } from './db.service';

export interface OrganizationRecord {
  id: string;
  nom?: string;
  ville?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  constructor(private readonly db: DbService) {}

  async ensureLoaded(): Promise<void> {
    await this.db.ensureResources(['organizations']);
  }

  async list(): Promise<OrganizationRecord[]> {
    await this.ensureLoaded();
    return this.db.getOrganizations<OrganizationRecord>();
  }
}
