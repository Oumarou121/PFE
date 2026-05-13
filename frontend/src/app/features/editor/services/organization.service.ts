import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { OrganizationRecord } from '../models/organization.model';
import { UnknownRecord } from '../models/editor-common.model';
import { getScopedOrganizationId, normalizeOrganizationId, normalizeOrganizationRecord } from './editor-normalizers';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  constructor(private state: EditorStateService) {}

  getOrganizations(): OrganizationRecord[] {
    return this.state.getState().organizations;
  }

  getOrganization(id: unknown): OrganizationRecord | null {
    const targetId = normalizeOrganizationId(id);
    return this.getOrganizations().find(organization => organization.id === targetId) || null;
  }

  async saveOrganization(organization: OrganizationRecord): Promise<OrganizationRecord> {
    const normalized = normalizeOrganizationRecord(organization);
    const state = this.state.getState();
    const organizations = [...state.organizations];
    const index = organizations.findIndex(item => item.id === normalized.id);
    index >= 0 ? organizations.splice(index, 1, normalized) : organizations.push(normalized);
    
    await this.state.persistState({ organizations });
    return normalized;
  }

  save(organization: OrganizationRecord): Observable<OrganizationRecord> {
    return from(this.saveOrganization(organization));
  }

  async deleteOrganization(id: string): Promise<void> {
    const state = this.state.getState();
    const organizations = state.organizations.filter(organization => organization.id !== id);
    const admins = state.admins.filter(admin => getScopedOrganizationId(admin) !== id);
    
    await this.state.persistState({ organizations, admins });
  }

  delete(id: string): Observable<void> {
    return from(this.deleteOrganization(id));
  }

  getSettings(): UnknownRecord {
    return this.state.getState().settings || {};
  }

  async saveSettings(settings: UnknownRecord): Promise<UnknownRecord> {
    const state = this.state.getState();
    const nextSettings = { ...(state.settings || {}), ...(settings || {}) };
    
    const nextState = await this.state.persistState({ settings: nextSettings });
    return nextState.settings || {};
  }
}
