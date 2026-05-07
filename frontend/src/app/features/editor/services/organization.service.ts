import { Injectable } from '@angular/core';
import { OrganizationRecord } from '../models/organization.model';
import { UnknownRecord } from '../models/editor-common.model';
import { getScopedOrganizationId, normalizeOrganizationRecord } from './editor-normalizers';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  constructor(private state: EditorStateService) {}

  getOrganizations(): OrganizationRecord[] {
    return this.state.getState().organizations;
  }

  getOrganization(id: string | null | undefined): OrganizationRecord | null {
    return this.getOrganizations().find(organization => organization.id === id) || null;
  }

  async saveOrganization(organization: OrganizationRecord): Promise<OrganizationRecord> {
    const normalized = normalizeOrganizationRecord(organization);
    const state = this.state.getState();
    const index = state.organizations.findIndex(item => item.id === normalized.id);
    index >= 0 ? state.organizations.splice(index, 1, normalized) : state.organizations.push(normalized);
    this.state.replaceState(state);
    await this.state.persistState();
    return normalized;
  }

  async deleteOrganization(id: string): Promise<void> {
    const state = this.state.getState();
    state.organizations = state.organizations.filter(organization => organization.id !== id);
    state.admins = state.admins.filter(admin => getScopedOrganizationId(admin) !== id);
    this.state.replaceState(state);
    await this.state.persistState();
  }

  getSettings(): UnknownRecord {
    return this.state.getState().settings || {};
  }

  async saveSettings(settings: UnknownRecord): Promise<UnknownRecord> {
    const state = this.state.getState();
    state.settings = { ...(state.settings || {}), ...(settings || {}) };
    this.state.replaceState(state);
    await this.state.persistState();
    return state.settings;
  }
}
