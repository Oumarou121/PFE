import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { BootstrapResponse, EditorListResponse, EditorResource, EditorState, UnknownRecord } from '../models/editor-common.model';
import { normalizeFamilyRecord, normalizeOrganizationRecord, normalizeState, normalizeTableViewRecord, normalizeTemplateRecord } from './editor-normalizers';

@Injectable({ providedIn: 'root' })
export class EditorStateService {
  private state: EditorState = normalizeState();
  private readyPromise: Promise<EditorState> | null = null;
  private resourcePromises: Partial<Record<EditorResource, Promise<EditorState> | null>> = {};

  constructor(private api: ApiService) {}

  async loadBootstrap(force = false): Promise<EditorState> {
    if (this.readyPromise && !force) return this.readyPromise;
    this.readyPromise = firstValueFrom(this.api.post<BootstrapResponse>('bootstrap', {}))
      .then(payload => {
        this.state = normalizeState(payload.state);
        this.state._loaded = {
          families: true,
          templates: true,
          organizations: true,
          admins: true,
          tableViews: true,
          settings: true
        };
        return this.getState();
      })
      .catch(() => {
        this.state = normalizeState();
        return this.getState();
      });
    return this.readyPromise;
  }

  getState(): EditorState {
    return normalizeState(this.state);
  }

  replaceState(state: Partial<EditorState>): EditorState {
    const loaded = this.state._loaded || {};
    this.state = normalizeState(state);
    this.state._loaded = { ...loaded };
    return this.getState();
  }

  patchState(patch: Partial<EditorState>): EditorState {
    this.state = normalizeState({ ...this.state, ...patch });
    return this.getState();
  }

  async persistState(statePatch: Partial<EditorState> = {}): Promise<EditorState> {
    // On calcule le prochain etat potentiel
    const nextState = normalizeState({ ...this.state, ...statePatch });
    
    // On tente la persistance cote serveur
    await firstValueFrom(this.api.put('state', { state: nextState }));
    
    // Si ca reussit, on met a jour l'etat local
    const loaded = this.state._loaded || {};
    this.state = nextState;
    this.state._loaded = { ...loaded };
    
    return this.getState();
  }

  async ensureResources(resources: EditorResource[] | EditorResource, options: { force?: boolean } = {}): Promise<EditorState> {
    const requested = [...new Set((Array.isArray(resources) ? resources : [resources]).filter(Boolean))];
    const missing = requested.filter(name => options.force || !this.state._loaded?.[name]);
    if (!missing.length) return this.getState();
    await Promise.all(missing.map(name => this.loadResource(name, options.force)));
    return this.getState();
  }

  setResourceLoaded(resource: EditorResource, loaded = true): void {
    this.state._loaded = { ...(this.state._loaded || {}), [resource]: loaded };
  }

  private async loadResource(resource: EditorResource, force = false): Promise<EditorState> {
    if (this.resourcePromises[resource] && !force) return this.resourcePromises[resource]!;
    const endpoint = this.getResourceEndpoint(resource);
    if (!endpoint) return this.getState();
    this.resourcePromises[resource] = firstValueFrom(this.api.get<EditorListResponse<UnknownRecord> | UnknownRecord[]>(endpoint))
      .then(payload => {
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
        if (resource === 'families') this.state.families = rows.map(normalizeFamilyRecord);
        if (resource === 'templates') this.state.templates = rows.map(normalizeTemplateRecord);
        if (resource === 'organizations') this.state.organizations = rows.map(normalizeOrganizationRecord);
        if (resource === 'admins') this.state.admins = rows as any[];
        if (resource === 'tableViews') this.state.tableViews = rows.map(normalizeTableViewRecord);
        this.setResourceLoaded(resource, true);
        return this.getState();
      })
      .finally(() => {
        this.resourcePromises[resource] = null;
      });
    return this.resourcePromises[resource]!;
  }

  private getResourceEndpoint(resource: EditorResource): string | null {
    const endpoints: Partial<Record<EditorResource, string>> = {
      families: 'families',
      templates: 'templates',
      organizations: 'organizations',
      admins: 'admins',
      tableViews: 'table-view-configs'
    };
    return endpoints[resource] || null;
  }
}
