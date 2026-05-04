import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { DbResourceState, DbService } from '../core/services/db.service';
import { OrganizationService } from '../core/services/organization.service';
import { TemplateService } from '../core/services/template.service';
import { TableViewService } from '../core/services/table-view.service';

interface NamedRecord {
  id: string;
  nom?: string;
  label?: string;
  tableName?: string;
  email?: string;
  organizationId?: string;
  updatedAt?: string;
}

type Section = 'families' | 'organizations' | 'admins' | 'tableViews';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './superadmin.component.html',
  styleUrls: ['./superadmin.component.scss']
})
export class SuperadminComponent implements OnInit {
  loading = true;
  error = '';
  activeSection: Section = 'families';
  families: NamedRecord[] = [];
  organizations: NamedRecord[] = [];
  admins: NamedRecord[] = [];
  tableViews: NamedRecord[] = [];
  states: Partial<Record<string, DbResourceState>> = {};

  private readonly resources = ['families', 'templates', 'organizations', 'tableViews', 'admins', 'settings'];

  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService,
    private readonly organizationsService: OrganizationService,
    private readonly templatesService: TemplateService,
    private readonly tableViewService: TableViewService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const authState = await firstValueFrom(this.auth.validateSession());
      const user = authState?.user || this.auth.getCurrentUser();
      await this.db.setContext({
        organizationId: user?.organizationId ?? null,
        role: 'superadmin'
      });
      await this.db.ensureResources(this.resources);
      await this.refreshData();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Chargement impossible';
    } finally {
      this.loading = false;
    }
  }

  setSection(section: Section): void {
    this.activeSection = section;
  }

  get activeRows(): NamedRecord[] {
    if (this.activeSection === 'organizations') return this.organizations;
    if (this.activeSection === 'admins') return this.admins;
    if (this.activeSection === 'tableViews') return this.tableViews;
    return this.families;
  }

  get activeTitle(): string {
    const titles: Record<Section, string> = {
      families: 'Familles de documents',
      organizations: 'Organizations',
      admins: 'Users / Admins',
      tableViews: 'Explorateur de données'
    };
    return titles[this.activeSection];
  }

  displayName(row: NamedRecord): string {
    return row.nom || row.label || row.tableName || row.email || row.id;
  }

  private async refreshData(): Promise<void> {
    const [families, organizations, admins, tableViews, stateEntries] = await Promise.all([
      this.templatesService.listFamilies() as Promise<NamedRecord[]>,
      this.organizationsService.list() as Promise<NamedRecord[]>,
      this.db.getAdmins<NamedRecord>(),
      this.tableViewService.list() as Promise<NamedRecord[]>,
      Promise.all(this.resources.map(async resource => [resource, await this.db.getResourceState(resource)] as const))
    ]);

    this.families = families;
    this.organizations = organizations;
    this.admins = admins;
    this.tableViews = tableViews;
    this.states = Object.fromEntries(stateEntries);
  }
}
