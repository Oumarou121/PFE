import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { BeneficiaryRecord, DocumentDataService } from '../../../core/services/document-data.service';
import { DocumentRenderService, RenderedDocumentPage } from '../../../core/services/document-render.service';
import { DbService } from '../../../core/services/db.service';
import { OrganizationRecord, OrganizationService } from '../../../core/services/organization.service';
import { TableViewRecord, TableViewService } from '../../../core/services/table-view.service';
import { FamilyRecord, FilterDefinition, FilterProfileEntry, TemplateRecord, TemplateService } from '../../../core/services/template.service';

type UserMode = 'documents' | 'data';
type StepKey = 1 | 2 | 3;

interface RuntimeFilter {
  id: string;
  key: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
  locked: boolean;
  defaultValue: unknown;
  options: Array<{ value: string; label: string }>;
}

@Component({
  selector: 'app-user-angular-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-angular-page.component.html',
  styleUrls: ['../user-page/user-page.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class UserAngularPageComponent implements OnInit {
  loading = true;
  error = '';
  mode: UserMode = 'documents';

  organizationName = '';
  organization: OrganizationRecord | null = null;
  families: FamilyRecord[] = [];
  templates: TemplateRecord[] = [];
  tableViews: TableViewRecord[] = [];
  beneficiaries: BeneficiaryRecord[] = [];
  selectedBeneficiaryId: string | null = null;
  beneficiarySearch = '';
  filterValues: Record<string, unknown> = {};
  runtimeFilters: RuntimeFilter[] = [];
  beneficiaryLoading = false;
  documentData: Record<string, unknown> | null = null;
  renderedPages: RenderedDocumentPage[] = [];
  zoom = 100;

  selectedFamilyId: string | null = null;
  selectedTemplateId: string | null = null;
  selectedTableViewId: string | null = null;
  selectedRowId: string | null = null;

  familySearch = '';
  templateSearch = '';
  tableViewSearch = '';
  rowSearch = '';
  dataRows: Record<string, unknown>[] = [];
  rowsLoading = false;
  openSteps: Record<StepKey, boolean> = { 1: true, 2: false, 3: false };

  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService,
    private readonly documents: DocumentDataService,
    private readonly renderer: DocumentRenderService,
    private readonly organizations: OrganizationService,
    private readonly templatesService: TemplateService,
    private readonly tableViewsService: TableViewService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const authState = await firstValueFrom(this.auth.validateSession());
      const user = authState.user ?? this.auth.getCurrentUser();
      if (!user) {
        await this.router.navigateByUrl('/login');
        return;
      }

      this.db.setContext({
        organizationId: user.organizationId ?? null,
        role: 'user'
      });

      await this.db.ensureResources(['organizations', 'families', 'templates', 'tableViews']);
      const [organizations, families, templates, tableViews] = await Promise.all([
        this.organizations.list(),
        this.templatesService.listFamilies(),
        this.templatesService.listTemplates(null, user.organizationId ?? null),
        this.tableViewsService.list()
      ]);

      this.families = families;
      this.templates = templates;
      this.tableViews = tableViews;
      this.organization = this.resolveOrganization(organizations, user.organizationId);
      this.organizationName = this.organization?.nom ?? '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
  }

  setMode(mode: UserMode): void {
    this.mode = mode;
  }

  toggleStep(step: StepKey): void {
    this.openSteps = { ...this.openSteps, [step]: !this.openSteps[step] };
  }

  selectFamily(family: FamilyRecord): void {
    this.selectedFamilyId = family.id;
    this.selectedTemplateId = null;
    this.selectedBeneficiaryId = null;
    this.beneficiaries = [];
    this.documentData = null;
    this.renderedPages = [];
    this.runtimeFilters = [];
    this.filterValues = {};
    this.openSteps = { 1: false, 2: true, 3: false };
  }

  async selectTemplate(template: TemplateRecord): Promise<void> {
    this.selectedTemplateId = template.id;
    this.selectedBeneficiaryId = null;
    this.documentData = null;
    this.renderedPages = [];
    await this.prepareRuntimeFilters();
    this.openSteps = { 1: false, 2: false, 3: true };
    await this.loadBeneficiaries();
  }

  async selectTableView(view: TableViewRecord): Promise<void> {
    this.selectedTableViewId = view.id;
    this.selectedRowId = null;
    await this.loadRows();
  }

  logout(): void {
    this.auth.logout();
  }

  updateFamilySearch(event: Event): void {
    this.familySearch = this.inputValue(event);
  }

  updateTemplateSearch(event: Event): void {
    this.templateSearch = this.inputValue(event);
  }

  updateTableViewSearch(event: Event): void {
    this.tableViewSearch = this.inputValue(event);
  }

  updateBeneficiarySearch(event: Event): void {
    this.beneficiarySearch = this.inputValue(event);
  }

  async selectBeneficiary(beneficiary: BeneficiaryRecord): Promise<void> {
    this.selectedBeneficiaryId = beneficiary.id;
    const family = this.selectedFamily;
    const template = this.selectedTemplate;
    if (!family || !template) return;
    this.documentData = await this.documents.getDocumentData(family, beneficiary, this.organization, this.documentFilterParams());
    this.renderedPages = this.documentData ? this.renderer.render(template, this.documentData) : [];
    this.openSteps = { 1: false, 2: false, 3: false };
  }

  async updateFilter(filter: RuntimeFilter, event: Event): Promise<void> {
    this.filterValues = {
      ...this.filterValues,
      [filter.id]: this.normalizeFilterValue(filter, this.inputValue(event))
    };
    this.selectedBeneficiaryId = null;
    this.documentData = null;
    this.renderedPages = [];
    await this.loadBeneficiaries();
  }

  async updateRowSearch(event: Event): Promise<void> {
    this.rowSearch = this.inputValue(event);
    await this.loadRows();
  }

  selectRow(row: Record<string, unknown>): void {
    this.selectedRowId = this.rowId(row);
  }

  get filteredFamilies(): FamilyRecord[] {
    const search = this.familySearch.trim().toLowerCase();
    return this.families.filter(family => !search || String(family.nom || '').toLowerCase().includes(search));
  }

  get filteredTemplates(): TemplateRecord[] {
    const search = this.templateSearch.trim().toLowerCase();
    return this.templates.filter(template => {
      const familyMatch = !this.selectedFamilyId || String(template.familyId) === String(this.selectedFamilyId);
      const searchMatch = !search || String(template.nom || '').toLowerCase().includes(search);
      return familyMatch && searchMatch;
    });
  }

  get filteredTableViews(): TableViewRecord[] {
    const search = this.tableViewSearch.trim().toLowerCase();
    return this.tableViews.filter(view => {
      const label = `${view.label || ''} ${view.tableName || ''}`.toLowerCase();
      return !search || label.includes(search);
    });
  }

  get filteredBeneficiaries(): BeneficiaryRecord[] {
    const search = this.beneficiarySearch.trim().toLowerCase();
    return this.beneficiaries.filter(beneficiary => {
      const label = `${beneficiary._displayLabel || ''} ${beneficiary._displaySubtitle || ''}`.toLowerCase();
      return !search || label.includes(search);
    });
  }

  get selectedFamily(): FamilyRecord | null {
    return this.families.find(family => String(family.id) === String(this.selectedFamilyId)) ?? null;
  }

  get selectedTemplate(): TemplateRecord | null {
    return this.templates.find(template => String(template.id) === String(this.selectedTemplateId)) ?? null;
  }

  get selectedTableView(): TableViewRecord | null {
    return this.tableViews.find(view => String(view.id) === String(this.selectedTableViewId)) ?? null;
  }

  get selectedBeneficiary(): BeneficiaryRecord | null {
    return this.beneficiaries.find(beneficiary => String(beneficiary.id) === String(this.selectedBeneficiaryId)) ?? null;
  }

  get selectedRow(): Record<string, unknown> | null {
    return this.dataRows.find(row => this.rowId(row) === this.selectedRowId) ?? null;
  }

  get previewFields(): string[] {
    const view = this.selectedTableView;
    if (!view) return [];
    if (Array.isArray(view.previewFields) && view.previewFields.length) return view.previewFields;
    if (Array.isArray(view.visibleFields) && view.visibleFields.length) return view.visibleFields.slice(0, 3);
    return this.dataRows[0] ? Object.keys(this.dataRows[0]).slice(0, 3) : [];
  }

  get visibleFields(): string[] {
    const view = this.selectedTableView;
    if (!view) return [];
    if (Array.isArray(view.visibleFields) && view.visibleFields.length) return view.visibleFields;
    return this.selectedRow ? Object.keys(this.selectedRow) : this.previewFields;
  }

  countTemplatesForFamily(familyId: string): number {
    return this.templates.filter(template => String(template.familyId) === String(familyId)).length;
  }

  fieldLabel(field: string): string {
    return this.selectedTableView?.fieldLabels?.[field] ?? field;
  }

  cellValue(row: Record<string, unknown>, field: string): string {
    const value = row[field];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  rowId(row: Record<string, unknown>): string {
    const first = Object.values(row)[0];
    return String(row['id'] ?? row['Id'] ?? first ?? '');
  }

  beneficiaryInitials(beneficiary: BeneficiaryRecord): string {
    return String(beneficiary._displayLabel || 'Beneficiaire')
      .split(' ')
      .map(part => part[0] || '')
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  documentPreviewFields(): Array<{ key: string; value: string }> {
    return Object.entries(this.documentData || {})
      .filter(([key, value]) => !key.startsWith('_') && value !== null && value !== undefined && typeof value !== 'object')
      .slice(0, 12)
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  hasMissingRequiredFilters(): boolean {
    return this.runtimeFilters.some(filter => filter.required && !this.filterValues[filter.id]);
  }

  setZoom(delta: number): void {
    this.zoom = delta === 0 ? 100 : Math.max(40, Math.min(200, this.zoom + delta));
  }

  resetDocumentFlow(): void {
    this.selectedFamilyId = null;
    this.selectedTemplateId = null;
    this.selectedBeneficiaryId = null;
    this.beneficiaries = [];
    this.documentData = null;
    this.renderedPages = [];
    this.zoom = 100;
    this.openSteps = { 1: true, 2: false, 3: false };
  }

  printDocument(): void {
    const template = this.selectedTemplate;
    if (!template || !this.documentData) return;
    const html = this.renderer.renderForPrint(template, this.documentData);
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${template.nom}</title>
          <style>
            body { margin: 0; background: #f3f4f6; font-family: Arial, sans-serif; }
            .preview-page { width: 210mm; min-height: 297mm; margin: 12mm auto; background: #fff; padding: 18mm; box-sizing: border-box; }
            .doc-page-header { margin-bottom: 10mm; }
            .doc-page-footer { margin-top: 10mm; }
            table { border-collapse: collapse; width: 100%; }
            @media print { body { background: #fff; } .preview-page { margin: 0; } }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  private async loadBeneficiaries(): Promise<void> {
    const family = this.selectedFamily;
    if (!family) {
      this.beneficiaries = [];
      return;
    }

    this.beneficiaryLoading = true;
    try {
      if (this.hasMissingRequiredFilters()) {
        this.beneficiaries = [];
        return;
      }
      this.beneficiaries = await this.documents.getBeneficiaries(family, this.organization, this.documentFilterParams());
      if (this.beneficiaries.length === 1 && String(family.beneficiaryMode || '').toLowerCase() === 'organization') {
        await this.selectBeneficiary(this.beneficiaries[0]);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.beneficiaries = [];
    } finally {
      this.beneficiaryLoading = false;
    }
  }

  private async prepareRuntimeFilters(): Promise<void> {
    const family = this.selectedFamily;
    const template = this.selectedTemplate;
    if (!family || !template) {
      this.runtimeFilters = [];
      this.filterValues = {};
      return;
    }

    const profile = new Map((template.filterProfile || []).map(entry => [entry.filterId, entry]));
    this.runtimeFilters = (family.filterCatalog || [])
      .filter(filter => filter.roles?.user !== false)
      .map((filter, index) => this.toRuntimeFilter(filter, profile.get(filter.id), index))
      .filter(filter => this.isFilterEnabled(filter, profile.get(filter.id)))
      .sort((left, right) => this.profileOrder(profile.get(left.id)) - this.profileOrder(profile.get(right.id)));

    await Promise.all(
      this.runtimeFilters.map(async runtimeFilter => {
        const source = (family.filterCatalog || []).find(filter => filter.id === runtimeFilter.id);
        if (!source || runtimeFilter.type !== 'select' || String(source.sourceType || '').toLowerCase() !== 'sql') return;
        runtimeFilter.options = await this.documents.getFilterOptions(source, this.organization?.id ?? null);
      })
    );

    this.filterValues = Object.fromEntries(
      this.runtimeFilters.map(filter => [filter.id, this.normalizeFilterValue(filter, filter.defaultValue)])
    );
  }

  private toRuntimeFilter(filter: FilterDefinition, profile: FilterProfileEntry | undefined, index: number): RuntimeFilter {
    const label = String(filter.label || filter.key || `Filtre ${index + 1}`).trim();
    return {
      id: String(filter.id),
      key: this.normalizeFilterKey(filter.key || label, `filtre_${index + 1}`),
      label,
      type: ['text', 'number', 'date', 'select'].includes(String(filter.type)) ? String(filter.type) : 'text',
      placeholder: String(filter.placeholder || '').trim(),
      required: !!profile?.required,
      locked: !!profile?.locked,
      defaultValue: profile?.defaultValue ?? null,
      options: this.normalizeFilterOptions(filter.staticOptions || [])
    };
  }

  private isFilterEnabled(filter: RuntimeFilter, profile?: FilterProfileEntry): boolean {
    return filter.id ? profile?.enabled !== false && profile?.userEnabled !== false : false;
  }

  private profileOrder(profile?: FilterProfileEntry): number {
    const order = Number(profile?.order);
    return Number.isFinite(order) ? order : 9999;
  }

  private documentFilterParams(): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    this.runtimeFilters.forEach(filter => {
      const value = this.normalizeFilterValue(filter, this.filterValues[filter.id]);
      params[filter.key] = value;
      params[`filter_${filter.key}`] = value;
    });
    return params;
  }

  private normalizeFilterValue(filter: RuntimeFilter, rawValue: unknown): unknown {
    if (rawValue === undefined || rawValue === null) return null;
    const text = String(rawValue).trim();
    if (!text) return null;
    if (filter.type === 'number') {
      const numberValue = Number(text);
      return Number.isFinite(numberValue) ? numberValue : null;
    }
    return text;
  }

  private normalizeFilterKey(value: string, fallback: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_') || fallback;
  }

  private normalizeFilterOptions(options: Array<{ value: string; label: string }> | string[]): Array<{ value: string; label: string }> {
    return (Array.isArray(options) ? options : [])
      .map(option => {
        if (typeof option === 'string') return { value: option, label: option };
        return { value: String(option.value || '').trim(), label: String(option.label || option.value || '').trim() };
      })
      .filter(option => option.value);
  }

  private async loadRows(): Promise<void> {
    const view = this.selectedTableView;
    if (!view) {
      this.dataRows = [];
      return;
    }

    this.rowsLoading = true;
    try {
      this.dataRows = await this.tableViewsService.rows(view, this.rowSearch);
      this.selectedRowId = this.dataRows.length ? this.rowId(this.dataRows[0]) : null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.dataRows = [];
    } finally {
      this.rowsLoading = false;
    }
  }

  formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
  }

  private resolveOrganization(organizations: OrganizationRecord[], organizationId?: string | null): OrganizationRecord | null {
    return organizations.find(item => String(item.id) === String(organizationId)) ?? organizations[0] ?? null;
  }

  private inputValue(event: Event): string {
    return (event.target as HTMLInputElement | null)?.value ?? '';
  }
}
