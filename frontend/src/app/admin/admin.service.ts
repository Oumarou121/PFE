import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { DbResourceState, DbService } from '../core/services/db.service';

export interface AdminFamily {
  id: string;
  nom: string;
  classes?: unknown[];
}

export interface AdminTemplate {
  id: string;
  nom: string;
  familyId?: string;
  updatedAt?: string;
}

export interface AdminVm {
  families: AdminFamily[];
  templates: AdminTemplate[];
  states: Record<string, DbResourceState>;
}

@Injectable()
export class AdminService {
  private readonly resources = ['families', 'templates', 'organizations'];

  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService
  ) {}

  async load(): Promise<AdminVm> {
    const authState = await firstValueFrom(this.auth.validateSession());
    const user = authState?.user || this.auth.getCurrentUser();
    await this.db.setContext({
      organizationId: user?.organizationId ?? null,
      role: 'admin'
    });
    await this.db.ensureResources(this.resources);

    const [families, templates, states] = await Promise.all([
      this.db.getFamilies<AdminFamily>(),
      this.db.getTemplates<AdminTemplate>(),
      this.loadStates()
    ]);

    return { families, templates, states };
  }

  private async loadStates(): Promise<Record<string, DbResourceState>> {
    const entries = await Promise.all(
      this.resources.map(async resource => [resource, await this.db.getResourceState(resource)] as const)
    );
    return Object.fromEntries(entries);
  }
}
