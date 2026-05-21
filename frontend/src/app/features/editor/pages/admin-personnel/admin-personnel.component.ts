import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { Router } from "@angular/router";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { ModuleRecord } from "../../models/module.model";
import {
  PersonnelCreateRequest,
  PersonnelUpdateRequest,
  PersonnelUser,
  UserDataAccessRule,
} from "../../models/personnel.model";
import { TableViewConfig } from "../../models/table-view.model";
import { EditorStateService } from "../../services/editor-state.service";
import { OrganizationService } from "../../services/organization.service";
import { PersonnelService } from "../../services/personnel.service";
import { TableViewService } from "../../services/table-view.service";
import { UserMenuComponent } from "../../../../shared/components/user-menu/user-menu.component";
import { ActiveAcademicYearPillComponent } from "../../../../shared/components/active-academic-year-pill/active-academic-year-pill.component";
import { UnknownRecord } from "../../models/editor-common.model";

type PersonnelForm = PersonnelUpdateRequest & {
  id?: number;
  accessYearsText: string;
};

type ModuleChoice = {
  id: string;
  name: string;
  icon?: string;
  isBase?: boolean;
};

const BASE_MODULE_CHOICES: ModuleChoice[] = [
  {
    id: "base.documentGeneration",
    name: "Generation de document",
    icon: "fa fa-file-text",
    isBase: true,
  },
  {
    id: "base.documentArchive",
    name: "Administration des archives",
    icon: "fa fa-archive",
    isBase: true,
  },
  {
    id: "base.templateManagement",
    name: "Gestion des templates",
    icon: "fa fa-pencil-square-o",
    isBase: true,
  },
  {
    id: "base.personnelManagement",
    name: "Gestion du personnel",
    icon: "fa fa-users",
    isBase: true,
  },
];

const MAX_ACCESS_LOOKUP_OPTIONS = 50;

@Component({
  selector: "app-admin-personnel",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    UserMenuComponent,
    ActiveAcademicYearPillComponent,
  ],
  templateUrl: "./admin-personnel.component.html",
  styleUrls: ["./admin-personnel.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class AdminPersonnelComponent implements OnInit {
  loading = true;
  saving = false;
  deleting = false;
  organizationName = "";
  search = "";
  personnel: PersonnelUser[] = [];
  selectedUserId: number | null = null;
  creating = false;
  form: PersonnelForm = this.createEmptyForm();
  moduleSearch = "";
  expandedAccessModuleIds = new Set<string>();
  expandedAccessTableIds = new Set<string>();
  accessLookupOptions: Record<string, Array<{ value: string; label: string }>> =
    {};
  accessLookupLoading: Record<string, boolean> = {};

  constructor(
    public router: Router,
    private auth: AuthService,
    private state: EditorStateService,
    private organizationsService: OrganizationService,
    private personnelService: PersonnelService,
    private tableViewsService: TableViewService,
    private notifications: NotificationService,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await this.state.ensureResources([
        "organizations",
        "modules",
        "tableViews",
      ]);
      const user = this.auth.getCurrentUser();
      const organization = user?.organizationId
        ? this.organizationsService.getOrganization(user.organizationId)
        : this.organizationsService.getOrganizations()[0] || null;
      this.organizationName = organization?.nom || organization?.name || "";
      await this.reload();
    } catch {
      this.notifications.showError("Impossible de charger le personnel.");
    } finally {
      this.loading = false;
    }
  }

  get filteredPersonnel(): PersonnelUser[] {
    const query = this.search.trim().toLowerCase();
    if (!query) return this.personnel;
    return this.personnel.filter((user) =>
      [user.name, user.email, user.role, user.profile, user.profileDetail]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  get modules(): ModuleRecord[] {
    const modules = (this.state.getState().modules || []) as ModuleRecord[];
    return modules
      .filter((module) => this.isModuleActive(module))
      .slice()
      .sort((a, b) => this.getModuleOrder(a) - this.getModuleOrder(b));
  }

  get moduleChoices(): ModuleChoice[] {
    return [
      ...BASE_MODULE_CHOICES,
      ...this.modules
        .map((module) => ({
          id: this.getModuleId(module),
          name: this.getModuleName(module),
          icon: this.getModuleIcon(module),
        }))
        .filter((module) => !!module.id),
    ];
  }

  get filteredModuleChoices(): ModuleChoice[] {
    const query = this.moduleSearch.trim().toLowerCase();
    if (!query) return this.moduleChoices;
    return this.moduleChoices.filter((module) =>
      [module.id, module.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  goBack(): void {
    this.router.navigate(["/admin"]);
  }

  logout(): void {
    this.auth.logout();
  }

  async reload(): Promise<void> {
    this.personnel = await this.personnelService.getAll();
    if (
      this.selectedUserId &&
      !this.personnel.some((user) => user.id === this.selectedUserId)
    ) {
      this.resetSelection();
    }
  }

  createUser(): void {
    this.creating = true;
    this.selectedUserId = null;
    this.form = this.createEmptyForm();
  }

  selectUser(user: PersonnelUser): void {
    if (this.saving || this.deleting) return;
    this.creating = false;
    this.selectedUserId = user.id;
    this.form = {
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role || "user",
      organizationId: user.organizationId ?? null,
      profile: user.profile || "",
      profileDetail: user.profileDetail || "",
      accessAllYears: user.accessAllYears,
      accessYearList: user.accessYearList || "[]",
      accessYearsText: this.formatAccessYears(user.accessYearList),
      moduleIds: [...(user.moduleIds || [])],
      dataAccessRules: this.cloneDataAccessRules(user.dataAccessRules),
      isActive: user.isActive,
    };
    this.syncExpandedAccessPanels();
  }

  async saveUser(): Promise<void> {
    if (!this.form.name.trim() || !this.form.email.trim()) {
      this.notifications.showError("Nom et email sont obligatoires.");
      return;
    }
    if (this.creating && !this.form.password?.trim()) {
      this.notifications.showError("Le mot de passe est obligatoire.");
      return;
    }
    const accessYearList = this.buildAccessYearList();
    if (!this.form.accessAllYears && accessYearList === null) {
      this.notifications.showError("Saisissez au moins une annee autorisee.");
      return;
    }

    this.saving = true;
    try {
      if (this.creating) {
        const payload: PersonnelCreateRequest = {
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          password: this.form.password || "",
          role: "user",
          organizationId: this.form.organizationId ?? null,
          profile: this.form.profile || null,
          profileDetail: this.form.profileDetail || null,
          accessAllYears: this.form.accessAllYears,
          accessYearList: accessYearList || "[]",
          moduleIds: this.form.moduleIds || [],
          dataAccessRules: this.cleanedDataAccessRules(),
        };
        const created = await this.personnelService.create(payload);
        this.notifications.showSuccess("Personnel ajoute.");
        await this.reload();
        this.selectUser(created);
      } else if (this.form.id) {
        const payload: PersonnelUpdateRequest = {
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          password: this.form.password?.trim() || undefined,
          role: "user",
          organizationId: this.form.organizationId ?? null,
          profile: this.form.profile || null,
          profileDetail: this.form.profileDetail || null,
          accessAllYears: this.form.accessAllYears,
          accessYearList: accessYearList || "[]",
          moduleIds: this.form.moduleIds || [],
          dataAccessRules: this.cleanedDataAccessRules(),
          isActive: this.form.isActive,
        };
        const updated = await this.personnelService.update(
          this.form.id,
          payload,
        );
        this.notifications.showSuccess("Personnel enregistre.");
        await this.reload();
        this.selectUser(updated);
      }
    } catch (error: any) {
      this.notifications.showError(
        error?.error?.message || "Impossible d'enregistrer le personnel.",
      );
    } finally {
      this.saving = false;
    }
  }

  deleteUser(): void {
    if (this.creating) {
      this.resetSelection();
      return;
    }
    if (!this.form.id) {
      this.notifications.showError("Selectionnez un personnel a supprimer.");
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Supprimer le personnel ?",
        message: `Le compte "${this.form.name}" sera supprime.`,
        confirmText: "Supprimer",
        cancelText: "Annuler",
        actionType: "delete",
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed || !this.form.id) return;
      this.deleting = true;
      try {
        await this.personnelService.delete(this.form.id);
        this.notifications.showSuccess("Personnel supprime.");
        await this.reload();
        this.resetSelection();
      } catch (error: any) {
        this.notifications.showError(
          error?.error?.message || "Impossible de supprimer le personnel.",
        );
      } finally {
        this.deleting = false;
      }
    });
  }

  isModuleSelected(moduleId: string): boolean {
    return this.form.moduleIds.includes(moduleId);
  }

  toggleModule(moduleId: string, checked: boolean): void {
    if (checked && !this.form.moduleIds.includes(moduleId)) {
      this.form.moduleIds = [...this.form.moduleIds, moduleId];
      this.expandedAccessModuleIds.add(moduleId);
      return;
    }
    if (!checked) {
      this.form.moduleIds = this.form.moduleIds.filter((id) => id !== moduleId);
      this.form.dataAccessRules = this.form.dataAccessRules.filter(
        (rule) => rule.moduleId !== moduleId,
      );
      this.expandedAccessModuleIds.delete(moduleId);
    }
  }

  get selectedBusinessModules(): ModuleRecord[] {
    const selected = new Set(this.form.moduleIds || []);
    return this.modules.filter((module) =>
      selected.has(this.getModuleId(module)),
    );
  }

  getModuleKey(module: ModuleRecord | ModuleChoice): string {
    const raw = module as ModuleChoice & ModuleRecord & UnknownRecord;
    return String(raw["id"] ?? raw["Id"] ?? "").trim();
  }

  isAccessModuleExpanded(moduleId: string): boolean {
    return this.expandedAccessModuleIds.has(moduleId);
  }

  toggleAccessModule(moduleId: string): void {
    if (this.expandedAccessModuleIds.has(moduleId)) {
      this.expandedAccessModuleIds.delete(moduleId);
      return;
    }
    this.expandedAccessModuleIds.add(moduleId);
  }

  isAccessTableExpanded(viewId: string): boolean {
    return this.expandedAccessTableIds.has(viewId);
  }

  toggleAccessTable(viewId: string): void {
    if (this.expandedAccessTableIds.has(viewId)) {
      this.expandedAccessTableIds.delete(viewId);
      return;
    }
    this.expandedAccessTableIds.add(viewId);
  }

  getModuleRestrictionCount(module: ModuleRecord): number {
    const moduleId = this.getModuleId(module);
    return this.form.dataAccessRules
      .filter((rule) => rule.moduleId === moduleId)
      .reduce((total, rule) => total + rule.values.length, 0);
  }

  getTableRestrictionCount(
    module: ModuleRecord,
    view: TableViewConfig,
  ): number {
    const moduleId = this.getModuleId(module);
    return this.form.dataAccessRules
      .filter(
        (rule) => rule.moduleId === moduleId && rule.tableViewId === view.id,
      )
      .reduce((total, rule) => total + rule.values.length, 0);
  }

  getModuleTableViews(module: ModuleRecord): TableViewConfig[] {
    const linkedIds = this.getModuleTableViewLinks(module)
      .slice()
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      .map((link) => this.getModuleTableViewConfigId(link))
      .filter(Boolean);
    const mainTableViewId = this.getModuleMainTableViewId(module);
    const ids = linkedIds.length
      ? linkedIds
      : mainTableViewId
        ? [mainTableViewId]
        : [];
    return ids
      .map((id) => this.tableViewsService.getTableView(id))
      .filter((view): view is TableViewConfig => !!view);
  }

  getRestrictableFields(view: TableViewConfig): string[] {
    const fields = new Set([
      ...(view.visibleFields || []),
      ...(view.editableFields || []),
      ...(view.previewFields || []),
    ]);
    return Array.from(fields).filter((field) => {
      const setting = view.fieldSettings?.[field];
      return (
        setting?.displayMode === "lookup" &&
        !!setting.lookupTable &&
        !!setting.lookupValueColumn &&
        !!setting.lookupLabelColumn
      );
    });
  }

  getFieldLabel(view: TableViewConfig, field: string): string {
    return view.fieldLabels?.[field] || field;
  }

  lookupKey(viewId: string, field: string): string {
    return `${viewId}::${field}`;
  }

  getLookupOptions(
    viewId: string,
    field: string,
  ): Array<{ value: string; label: string }> {
    return this.accessLookupOptions[this.lookupKey(viewId, field)] || [];
  }

  shouldDisplayLookupOptions(viewId: string, field: string): boolean {
    const options = this.getLookupOptions(viewId, field);
    return options.length > 0 && options.length <= MAX_ACCESS_LOOKUP_OPTIONS;
  }

  isLookupTooLarge(viewId: string, field: string): boolean {
    return (
      this.getLookupOptions(viewId, field).length > MAX_ACCESS_LOOKUP_OPTIONS
    );
  }

  isLookupLoading(viewId: string, field: string): boolean {
    return !!this.accessLookupLoading[this.lookupKey(viewId, field)];
  }

  async ensureLookupOptions(
    view: TableViewConfig,
    field: string,
  ): Promise<void> {
    const key = this.lookupKey(view.id, field);
    if (this.accessLookupOptions[key] || this.accessLookupLoading[key]) return;
    this.accessLookupLoading[key] = true;
    try {
      this.accessLookupOptions[key] =
        await this.tableViewsService.getTableViewLookupOptions(
          view.id,
          field,
          view,
        );
    } catch {
      this.accessLookupOptions[key] = [];
      this.notifications.showError(
        `Impossible de charger les valeurs de ${this.getFieldLabel(view, field)}.`,
      );
    } finally {
      this.accessLookupLoading[key] = false;
    }
  }

  getRuleValues(moduleId: string, viewId: string, field: string): string[] {
    return (
      this.form.dataAccessRules.find(
        (rule) =>
          rule.moduleId === moduleId &&
          rule.tableViewId === viewId &&
          rule.field === field,
      )?.values || []
    );
  }

  updateAccessRuleValues(
    moduleId: string,
    view: TableViewConfig,
    field: string,
    values: string[],
  ): void {
    const normalized = Array.from(
      new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    );
    this.form.dataAccessRules = this.form.dataAccessRules.filter(
      (rule) =>
        !(
          rule.moduleId === moduleId &&
          rule.tableViewId === view.id &&
          rule.field === field
        ),
    );
    if (!normalized.length) return;
    this.form.dataAccessRules = [
      ...this.form.dataAccessRules,
      {
        moduleId,
        tableViewId: view.id,
        tableName: view.tableName,
        field,
        values: normalized,
      },
    ];
  }

  isRuleValueSelected(
    moduleId: string,
    viewId: string,
    field: string,
    value: string,
  ): boolean {
    return this.getRuleValues(moduleId, viewId, field).includes(value);
  }

  toggleAccessRuleValue(
    moduleId: string,
    view: TableViewConfig,
    field: string,
    value: string,
    checked: boolean,
  ): void {
    const current = new Set(this.getRuleValues(moduleId, view.id, field));
    checked ? current.add(value) : current.delete(value);
    this.updateAccessRuleValues(moduleId, view, field, Array.from(current));
  }

  getModuleChoiceInputId(moduleId: string): string {
    return `personnel-module-${moduleId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  }

  getModuleNames(user: PersonnelUser): string {
    const names = (user.moduleIds || [])
      .map(
        (id) =>
          this.moduleChoices.find((module) => module.id === id)?.name || id,
      )
      .filter(Boolean);
    return names.length ? names.join(", ") : "Aucun module";
  }

  getAccessYearsLabel(user: PersonnelUser): string {
    if (user.accessAllYears) return "Toutes";
    const years = this.parseAccessYears(user.accessYearList);
    return years.length ? years.join(", ") : "Aucune";
  }

  setAccessAllYears(value: boolean): void {
    this.form.accessAllYears = value;
    if (value) {
      this.form.accessYearsText = "";
      this.form.accessYearList = "[]";
    }
  }

  private resetSelection(): void {
    this.creating = false;
    this.selectedUserId = null;
    this.form = this.createEmptyForm();
    this.moduleSearch = "";
    this.expandedAccessModuleIds.clear();
    this.expandedAccessTableIds.clear();
  }

  private createEmptyForm(): PersonnelForm {
    const organizationId = this.auth.getCurrentUser()?.organizationId;
    return {
      name: "",
      email: "",
      password: "",
      role: "user",
      organizationId: organizationId ? Number(organizationId) : null,
      profile: "",
      profileDetail: "",
      accessAllYears: true,
      accessYearList: "[]",
      accessYearsText: "",
      moduleIds: [],
      dataAccessRules: [],
      isActive: true,
    };
  }

  private cleanedDataAccessRules(): UserDataAccessRule[] {
    const selectedModules = new Set(this.form.moduleIds || []);
    return this.cloneDataAccessRules(this.form.dataAccessRules).filter(
      (rule) => selectedModules.has(rule.moduleId) && rule.values.length,
    );
  }

  private cloneDataAccessRules(
    rules: UserDataAccessRule[] = [],
  ): UserDataAccessRule[] {
    return (rules || [])
      .map((rule) => ({
        moduleId: String(rule.moduleId || "").trim(),
        tableViewId: String(rule.tableViewId || "").trim(),
        tableName: rule.tableName ? String(rule.tableName).trim() : null,
        field: String(rule.field || "").trim(),
        values: Array.from(
          new Set(
            (rule.values || [])
              .map((value) => String(value || "").trim())
              .filter(Boolean),
          ),
        ),
      }))
      .filter(
        (rule) =>
          rule.moduleId && rule.tableViewId && rule.field && rule.values.length,
      );
  }

  private syncExpandedAccessPanels(): void {
    this.expandedAccessModuleIds = new Set(
      (this.form.dataAccessRules || []).map((rule) => rule.moduleId),
    );
    this.expandedAccessTableIds = new Set(
      (this.form.dataAccessRules || []).map((rule) => rule.tableViewId),
    );
  }

  private buildAccessYearList(): string | null {
    if (this.form.accessAllYears) return "[]";
    const years = this.form.accessYearsText
      .split(/[,;\s]+/)
      .map((year) => year.trim())
      .filter(Boolean);

    const uniqueYears = Array.from(new Set(years));
    if (!uniqueYears.length) return null;
    return JSON.stringify(uniqueYears);
  }

  private formatAccessYears(accessYearList?: string | null): string {
    return this.parseAccessYears(accessYearList).join(", ");
  }

  private parseAccessYears(accessYearList?: string | null): string[] {
    if (!accessYearList?.trim()) return [];
    try {
      const value = JSON.parse(accessYearList);
      return Array.isArray(value) ? value.map((item) => String(item)) : [];
    } catch {
      return accessYearList
        .split(/[,;\s]+/)
        .map((year) => year.trim())
        .filter(Boolean);
    }
  }

  private getModuleId(module: ModuleRecord): string {
    const raw = module as ModuleRecord & UnknownRecord;
    return String(raw["id"] ?? raw["Id"] ?? "").trim();
  }

  private getModuleName(module: ModuleRecord): string {
    const raw = module as ModuleRecord & UnknownRecord;
    return String(
      raw["name"] ?? raw["Name"] ?? this.getModuleId(module),
    ).trim();
  }

  private getModuleIcon(module: ModuleRecord): string | undefined {
    const raw = module as ModuleRecord & UnknownRecord;
    const icon = String(raw["icon"] ?? raw["Icon"] ?? "").trim();
    return icon || undefined;
  }

  private getModuleOrder(module: ModuleRecord): number {
    const raw = module as ModuleRecord & UnknownRecord;
    const value = Number(raw["displayOrder"] ?? raw["DisplayOrder"] ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  private isModuleActive(module: ModuleRecord): boolean {
    const raw = module as ModuleRecord & UnknownRecord;
    const value = raw["isActive"] ?? raw["IsActive"];
    return value === undefined || value === null ? true : value !== false;
  }

  private getModuleMainTableViewId(module: ModuleRecord): string {
    const raw = module as ModuleRecord & UnknownRecord;
    return String(
      raw["mainTableViewId"] ?? raw["MainTableViewId"] ?? "",
    ).trim();
  }

  private getModuleTableViewLinks(
    module: ModuleRecord,
  ): Array<UnknownRecord & { orderIndex?: number }> {
    const raw = module as ModuleRecord & UnknownRecord;
    const links = raw["tableViews"] ?? raw["TableViews"] ?? [];
    return Array.isArray(links)
      ? (links as Array<UnknownRecord & { orderIndex?: number }>)
      : [];
  }

  private getModuleTableViewConfigId(link: UnknownRecord): string {
    return String(
      link["tableViewConfigId"] ?? link["TableViewConfigId"] ?? "",
    ).trim();
  }

  trackModule(index: number, module: any): string {
    return module.id || module.Id;
  }

  trackView(index: number, view: TableViewConfig): string {
    return view.id;
  }

  trackField(index: number, field: string): string {
    return field;
  }

  trackOption(index: number, option: { value: string; label: string }): string {
    return option.value;
  }
}
