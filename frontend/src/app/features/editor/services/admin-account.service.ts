import { Injectable } from '@angular/core';
import { AdminAccountRecord } from '../models/admin-account.model';
import { getScopedOrganizationId } from './editor-normalizers';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class AdminAccountService {
  constructor(private state: EditorStateService) {}

  getAdmins(): AdminAccountRecord[] {
    return this.state.getState().admins;
  }

  getAdmin(id: string | null | undefined): AdminAccountRecord | null {
    return this.getAdmins().find(admin => admin.id === id) || null;
  }

  async saveAdmin(admin: AdminAccountRecord): Promise<AdminAccountRecord> {
    const normalized = { ...admin, organizationId: getScopedOrganizationId(admin) };
    const state = this.state.getState();
    const index = state.admins.findIndex(item => item.id === normalized.id);
    index >= 0 ? state.admins.splice(index, 1, normalized) : state.admins.push(normalized);
    this.state.replaceState(state);
    await this.state.persistState();
    return normalized;
  }

  async deleteAdmin(id: string): Promise<void> {
    const state = this.state.getState();
    state.admins = state.admins.filter(admin => admin.id !== id);
    this.state.replaceState(state);
    await this.state.persistState();
  }
}
