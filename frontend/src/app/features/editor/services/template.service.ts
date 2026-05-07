import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { TemplateRecord } from '../models/template.model';
import { getScopedOrganizationId, normalizeTemplateRecord } from './editor-normalizers';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  constructor(private api: ApiService, private state: EditorStateService) {}

  getTemplates(familyId?: string | null, organizationId?: string | null): TemplateRecord[] {
    let templates = this.state.getState().templates;
    if (familyId) templates = templates.filter(template => template.familyId === familyId);
    if (organizationId) templates = templates.filter(template => getScopedOrganizationId(template) === organizationId);
    return templates;
  }

  getTemplate(id: string | null | undefined): TemplateRecord | null {
    return this.state.getState().templates.find(template => template.id === id) || null;
  }

  async saveTemplate(template: TemplateRecord): Promise<TemplateRecord> {
    const normalized = normalizeTemplateRecord(template);
    const state = this.state.getState();
    const index = state.templates.findIndex(item => item.id === normalized.id);
    index >= 0 ? state.templates.splice(index, 1, normalized) : state.templates.push(normalized);
    this.state.replaceState(state);
    await firstValueFrom(this.api.put(`templates/${encodeURIComponent(normalized.id)}`, normalized));
    return normalized;
  }

  async deleteTemplate(id: string): Promise<void> {
    const state = this.state.getState();
    state.templates = state.templates.filter(template => template.id !== id);
    this.state.replaceState(state);
    await firstValueFrom(this.api.delete(`templates/${encodeURIComponent(id)}`));
  }
}
