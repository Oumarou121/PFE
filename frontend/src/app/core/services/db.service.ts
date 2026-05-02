import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type DbResourceStatus = 'idle' | 'loading' | 'success' | 'error' | 'revalidating';

export interface DbResourceState {
  status: DbResourceStatus;
  lastFetchedAt: number | null;
  count: number;
  hydrated?: boolean;
  error?: string;
}

export interface DbContext {
  organizationId: string | number | null;
  role: 'admin' | 'superadmin' | 'user' | string | null;
}

interface LegacyDb {
  ensureResources(resources: string[], options?: Record<string, unknown>): Promise<unknown>;
  getResourceState(name: string): DbResourceState;
  getStableResource<T = unknown>(name: string): T | null;
  getResourceFingerprint(name: string): string;
  isResourceHydrated(name: string): boolean;
  setContext(context: Partial<DbContext>): DbContext;
  getFamilies(): unknown[];
  getTemplates(familyId?: string | number | null, organizationId?: string | number | null): unknown[];
  getOrganizations(): unknown[];
  getAdmins(): unknown[];
  getTableViews(): unknown[];
}

@Injectable({ providedIn: 'root' })
export class DbService {
  private loadPromise: Promise<LegacyDb> | null = null;

  async ensureResources(resources: string[], options: Record<string, unknown> = {}): Promise<void> {
    const db = await this.getDb();
    await db.ensureResources(resources, options);
  }

  async getResourceState(name: string): Promise<DbResourceState> {
    return (await this.getDb()).getResourceState(name);
  }

  async getStableResource<T = unknown>(name: string): Promise<T | null> {
    return (await this.getDb()).getStableResource<T>(name);
  }

  async getResourceFingerprint(name: string): Promise<string> {
    return (await this.getDb()).getResourceFingerprint(name);
  }

  async isResourceHydrated(name: string): Promise<boolean> {
    return (await this.getDb()).isResourceHydrated(name);
  }

  async setContext(context: Partial<DbContext>): Promise<DbContext> {
    return (await this.getDb()).setContext(context);
  }

  async getFamilies<T = unknown>(): Promise<T[]> {
    return (await this.getDb()).getFamilies() as T[];
  }

  async getTemplates<T = unknown>(familyId?: string | number | null, organizationId?: string | number | null): Promise<T[]> {
    return (await this.getDb()).getTemplates(familyId, organizationId) as T[];
  }

  async getOrganizations<T = unknown>(): Promise<T[]> {
    return (await this.getDb()).getOrganizations() as T[];
  }

  async getAdmins<T = unknown>(): Promise<T[]> {
    return (await this.getDb()).getAdmins() as T[];
  }

  async getTableViews<T = unknown>(): Promise<T[]> {
    return (await this.getDb()).getTableViews() as T[];
  }

  private async getDb(): Promise<LegacyDb> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadLegacyDb();
    }
    return this.loadPromise;
  }

  private async loadLegacyDb(): Promise<LegacyDb> {
    window.SIRHDOC_API_BASE = environment.apiUrl.replace(/\/api\/?$/, '');
    await this.loadScript('/assets/editor-legacy/shared.js');
    return this.readGlobal<LegacyDb>('DB');
  }

  private loadScript(src: string): Promise<void> {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.body.appendChild(script);
    });
  }

  private readGlobal<T>(name: string): T {
    return (0, eval)(name) as T;
  }
}

declare global {
  interface Window {
    SIRHDOC_API_BASE?: string;
  }
}
