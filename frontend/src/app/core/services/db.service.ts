import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export type DbResourceStatus = 'idle' | 'loading' | 'success' | 'error' | 'revalidating';

export interface DbResourceState {
  status: DbResourceStatus;
  lastFetchedAt: number | null;
  count: number;
  hydrated: boolean;
  error?: string;
}

export interface DbContext {
  organizationId: string | number | null;
  role: 'admin' | 'superadmin' | 'user' | string | null;
}

type ResourceName = 'families' | 'templates' | 'organizations' | 'admins' | 'tableViews' | 'settings';

interface BootstrapResponse {
  state?: Partial<Record<ResourceName, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class DbService {
  private readonly strictResources = new Set<ResourceName>([
    'families',
    'templates',
    'organizations',
    'tableViews'
  ]);
  private readonly ttlMs = 5 * 60 * 1000;
  private readonly cache = new Map<ResourceName, unknown>();
  private readonly stable = new Map<ResourceName, unknown>();
  private readonly states = new Map<ResourceName, DbResourceState>();
  private readonly inflight = new Map<ResourceName, Promise<void>>();
  private context: DbContext = { organizationId: null, role: null };

  constructor(private readonly api: ApiService) {}

  async ensureResources(resources: string[], options: { force?: boolean; ttlMs?: number } = {}): Promise<void> {
    const names = [...new Set(resources as ResourceName[])];
    await Promise.all(
      names.map(name => {
        const state = this.getState(name);
        const ttl = options.ttlMs ?? this.ttlMs;
        const isFresh = state.status === 'success' && Date.now() - (state.lastFetchedAt ?? 0) < ttl;
        if (!options.force && state.hydrated && isFresh) return Promise.resolve();
        return this.loadResource(name, options.force === true);
      })
    );
  }

  getResourceState(name: string): DbResourceState {
    return { ...this.getState(name as ResourceName) };
  }

  getStableResource<T = unknown>(name: string): T | null {
    const value = this.stable.get(name as ResourceName);
    return value === undefined ? null : this.clone(value) as T;
  }

  getResourceFingerprint(name: string): string {
    const value = this.stable.get(name as ResourceName) ?? this.cache.get(name as ResourceName);
    return this.fingerprint(name as ResourceName, value);
  }

  isResourceHydrated(name: string): boolean {
    const resource = name as ResourceName;
    const state = this.getState(resource);
    return state.status === 'success' && state.hydrated && !this.inflight.has(resource);
  }

  setContext(context: Partial<DbContext>): DbContext {
    const previous = JSON.stringify(this.context);
    this.context = {
      organizationId: context.organizationId ?? this.context.organizationId,
      role: context.role ?? this.context.role
    };
    if (previous !== JSON.stringify(this.context)) {
      this.stable.clear();
      for (const [name, state] of this.states.entries()) {
        this.states.set(name, { ...state, hydrated: false });
      }
    }
    return { ...this.context };
  }

  async getFamilies<T = unknown>(): Promise<T[]> {
    return this.getArray<T>('families');
  }

  async getTemplates<T = unknown>(familyId?: string | number | null, organizationId?: string | number | null): Promise<T[]> {
    let rows = this.getArray<T & { familyId?: string | number; organizationId?: string | number }>('templates');
    if (familyId) rows = rows.filter(item => String(item.familyId) === String(familyId));
    if (organizationId) rows = rows.filter(item => String(item.organizationId) === String(organizationId));
    return rows as T[];
  }

  async getOrganizations<T = unknown>(): Promise<T[]> {
    return this.getArray<T>('organizations');
  }

  async getAdmins<T = unknown>(): Promise<T[]> {
    return this.getArray<T>('admins');
  }

  async getTableViews<T = unknown>(): Promise<T[]> {
    return this.getArray<T>('tableViews');
  }

  private async loadResource(name: ResourceName, force: boolean): Promise<void> {
    if (this.inflight.has(name) && !force) return this.inflight.get(name);
    const request = this.fetchResource(name);
    this.inflight.set(name, request);
    await request.finally(() => this.inflight.delete(name));
  }

  private async fetchResource(name: ResourceName): Promise<void> {
    const hasStable = this.stable.has(name);
    this.setState(name, hasStable ? 'revalidating' : 'loading');
    try {
      const data = await this.requestResource(name);
      this.cache.set(name, data);
      const valid = this.isPayloadValid(name, data);
      if (valid) {
        this.stable.set(name, this.clone(data));
        this.setState(name, 'success');
        return;
      }
      this.setState(name, 'error', `Invalid or empty ${name}`);
    } catch (error) {
      this.setState(name, 'error', error instanceof Error ? error.message : String(error));
    }
  }

  private async requestResource(name: ResourceName): Promise<unknown> {
    if (name === 'families') return firstValueFrom(this.api.get<unknown[]>('families'));
    if (name === 'templates') return firstValueFrom(this.api.get<unknown[]>('templates'));
    if (name === 'organizations') return firstValueFrom(this.api.get<unknown[]>('organizations'));
    if (name === 'admins') return firstValueFrom(this.api.get<unknown[]>('admins'));
    if (name === 'tableViews') return firstValueFrom(this.api.get<unknown[]>('table-view-configs'));

    const bootstrap = await firstValueFrom(this.api.get<BootstrapResponse>('state'));
    return bootstrap.state?.settings ?? {};
  }

  private getArray<T>(name: ResourceName): T[] {
    const state = this.getState(name);
    const value = state.status === 'loading' || state.status === 'revalidating'
      ? this.stable.get(name) ?? this.cache.get(name)
      : this.stable.get(name) ?? this.cache.get(name);
    return Array.isArray(value) ? this.clone(value) as T[] : [];
  }

  private setState(name: ResourceName, status: DbResourceStatus, error?: string): void {
    const value = this.cache.get(name);
    const count = Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0;
    this.states.set(name, {
      status,
      lastFetchedAt: status === 'success' || status === 'error' ? Date.now() : this.getState(name).lastFetchedAt,
      count,
      hydrated: status === 'success' && this.isPayloadValid(name, value),
      ...(error ? { error } : {})
    });
  }

  private getState(name: ResourceName): DbResourceState {
    return this.states.get(name) ?? {
      status: 'idle',
      lastFetchedAt: null,
      count: 0,
      hydrated: false
    };
  }

  private isPayloadValid(name: ResourceName, value: unknown): boolean {
    if (name === 'settings') return value !== null && typeof value === 'object';
    if (!Array.isArray(value)) return false;
    return !this.strictResources.has(name) || value.length > 0;
  }

  private fingerprint(name: ResourceName, value: unknown): string {
    const rows = Array.isArray(value) ? value : [];
    const maxUpdated = rows.reduce((max, item: any) => {
      const time = Date.parse(item?.updatedAt || item?.updated_at || item?.createdAt || '');
      return Number.isFinite(time) ? Math.max(max, time) : max;
    }, 0);
    return JSON.stringify({
      name,
      context: this.context,
      count: rows.length,
      maxUpdated
    });
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }
}
