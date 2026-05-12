import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
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
    const admins = [...state.admins];
    const index = admins.findIndex(item => item.id === normalized.id);
    index >= 0 ? admins.splice(index, 1, normalized) : admins.push(normalized);
    
    await this.state.persistState({ admins });
    return normalized;
  }

  create(admin: AdminAccountRecord): Observable<AdminAccountRecord> {
    return from(this.saveAdmin({ ...admin, id: admin.id || `adm_${Date.now()}` }));
  }

  update(id: string, admin: AdminAccountRecord): Observable<AdminAccountRecord> {
    return from(this.saveAdmin({ ...admin, id }));
  }

  async deleteAdmin(id: string): Promise<void> {
    const state = this.state.getState();
    const admins = state.admins.filter(admin => admin.id !== id);
    await this.state.persistState({ admins });
  }

  delete(id: string): Observable<void> {
    return from(this.deleteAdmin(id));
  }
}
