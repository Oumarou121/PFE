import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { DbResourceState, DbService } from '../core/services/db.service';
import { TemplateService } from '../core/services/template.service';
import { OrganizationService } from '../core/services/organization.service';

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
    private readonly db: DbService,
    private readonly templatesService: TemplateService,
    private readonly organizationService: OrganizationService
  ) {}

  async load(): Promise<AdminVm> {
    const authState = await firstValueFrom(this.auth.validateSession());
    const user = authState?.user || this.auth.getCurrentUser();
    await this.db.setContext({
      organizationId: user?.organizationId ?? null,
      role: 'admin'
    });
    await this.db.ensureResources(this.resources);

    const [families, templates, , states] = await Promise.all([
      this.templatesService.listFamilies(),
      this.templatesService.listTemplates(),
      this.organizationService.list(),
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
