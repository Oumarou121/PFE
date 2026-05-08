import {
  Component,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
  NgZone,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { Subject, firstValueFrom } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { AuthService } from "../../../../core/services/auth.service";
import { ApiService } from "../../../../core/services/api.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { OrganizationService } from "../../services/organization.service";
import { AdminAccountService } from "../../services/admin-account.service";
import { TableViewService } from "../../services/table-view.service";

import { EditorState as AppState } from "../../models/editor-common.model";
import { FamilyRecord as Family } from "../../models/family.model";
import { OrganizationRecord as Organization } from "../../models/organization.model";
import { AdminAccountRecord as AdminAccount } from "../../models/admin-account.model";
import { TableViewConfig } from "../../models/table-view.model";
import {
  normalizeFilterDefinition,
  normalizeFilterColumnBinding,
  normalizeFilterColumnBindings,
  normalizeFilterParamName,
  normalizeFilterSqlBuilder,
  normalizeTableViewRecord,
  normalizeState,
  parseFilterStaticOptions,
  normalizeFamilyRecord,
} from "../../services/editor-normalizers";

@Component({
  selector: "app-super-admin",
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: "./super-admin.component.html",
  styleUrls: ["./super-admin.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class SuperAdminComponent implements OnInit, OnDestroy {
  isLoading = false;
  private destroy$ = new Subject<void>();
  private state: AppState | null = null;
  private modalClickHandler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (target?.classList?.contains("modal-overlay")) {
      target.classList.remove("open");
    }
  };
  private modalKeydownHandler = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    document
      .querySelectorAll(".modal-overlay.open")
      .forEach((node) => node.classList.remove("open"));
  };

  currentSection = "families";
  panelSearch = "";
  selectedFamId: string | null = null;
  selectedTableViewId: string | null = null;
  private editingOrganizationId: string | null = null;
  private editingAdminId: string | null = null;
  private tableViewSchemaCache: any = null;
  tableViewRowsCache: any[] = [];
  selectedTableViewRowId: string | null = null;
  selectedTableViewRecord: any = null;
  tableViewSearch = "";
  isCreatingTableViewRow = false;
  private tableViewLookupOptionsCache: Record<string, any[]> = {};
  private schemaMetaCache: any = null;
  private schemaBuilderState: Record<string, any> = {};
  private tempColsByClass: Record<
    number,
    Array<{ key: string; label: string }>
  > = {};
  private readonly legacyOrganizationTable = "Organization";
  private readonly legacyOrganizationIdColumn = "etablissement_id";
  private readonly organizationRawExcludedKeys = new Set([
    "Id",
    "ID",
    "id",
    "OrganizationId",
    "IdOrganization",
    "Name",
    "NameFr",
    "NameAr",
    "Nom",
    "City",
    "Ville",
    "Address",
    "Adresse",
    "Phone",
    "Telephone",
    "Tel",
    "Email",
    "Mail",
  ]);
  private readonly hiddenFamilyTables = [
    "family",
    "template",
    "graphic_charter",
    "admin_account",
    "charte",
  ];

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private editorState: EditorStateService,
    private familyService: FamilyService,
    private organizationService: OrganizationService,
    private adminService: AdminAccountService,
    private tableViewService: TableViewService,
    private notifications: NotificationService,
    private dialog: MatDialog,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.bindLegacyWindow();
    this.bindModalHandlers();
    this.isLoading = true;
    void this.initializeState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.unbindLegacyWindow();
    this.unbindModalHandlers();
  }

  private get families(): Family[] {
    return this.state?.families ?? [];
  }

  get organizations(): Organization[] {
    return this.state?.organizations ?? [];
  }

  get admins(): AdminAccount[] {
    return this.state?.admins ?? [];
  }

  private get templates() {
    return this.state?.templates ?? [];
  }

  private get tableViews(): TableViewConfig[] {
    return this.state?.tableViews ?? [];
  }

  get panelTitle(): string {
    return this.getSectionMeta(this.currentSection).panelTitle;
  }

  get panelSubtitle(): string {
    return "Structure globale du systÃ¨me";
  }

  get topbarTitle(): string {
    return this.getSectionMeta(this.currentSection).topbar;
  }

  get addButtonLabel(): string | null {
    return this.getSectionMeta(this.currentSection).addLabel;
  }

  get filteredFamilies(): Family[] {
    const search = this.panelSearch.trim().toLowerCase();
    return this.families.filter((family) =>
      String(family.nom || family.name || "")
        .toLowerCase()
        .includes(search),
    );
  }

  get filteredOrganizations(): Organization[] {
    const search = this.panelSearch.trim().toLowerCase();
    return this.organizations.filter((organization) =>
      `${organization.nom || organization.name || ""} ${organization.ville || organization.city || ""}`
        .toLowerCase()
        .includes(search),
    );
  }

  get filteredAdmins(): AdminAccount[] {
    const search = this.panelSearch.trim().toLowerCase();
    return this.admins.filter((admin) =>
      this.getAdminDisplayName(admin).toLowerCase().includes(search),
    );
  }

  get filteredTableViews(): TableViewConfig[] {
    const search = this.panelSearch.trim().toLowerCase();
    return this.tableViews.filter((view) =>
      `${view.label || ""} ${view.tableName || ""}`
        .toLowerCase()
        .includes(search),
    );
  }

  get selectedTableView(): TableViewConfig | null {
    return this.selectedTableViewId
      ? this.tableViews.find((view) => view.id === this.selectedTableViewId) ||
          null
      : null;
  }

  get selectedFamily(): Family | null {
    return this.selectedFamId
      ? this.families.find((family) => family.id === this.selectedFamId) || null
      : null;
  }

  private async initializeState(): Promise<void> {
    try {
      this.state = await this.editorState.loadBootstrap();
      this.isLoading = false;
      this.showApp();
      await this.showSection("families");
    } catch {
      this.state = this.editorState.getState();
      this.isLoading = false;
      this.showApp();
    }
  }

  private syncStateFromStore(): void {
    this.state = this.editorState.getState();
  }

  private replaceState(state: Partial<AppState>): void {
    this.state = this.editorState.replaceState(state);
  }

  private showApp(): void {
    const app = document.getElementById("app");
    if (app) app.style.opacity = "1";
  }

  private bindLegacyWindow(): void {
    const win = window as any;
    win.closeModal = (id: string) => this.closeModal(id);
    win.openModal = (id: string) => this.openModal(id);
    win.toast = (msg: string, type?: string) => this.toast(msg, type);
    win.updateFamilyDraftField = (
      famId: string,
      field: string,
      value: string,
    ) => this.updateFamilyDraftField(famId, field, value);
    win.saveFamily = (famId: string) => this.saveFamily(famId);
    win.deleteFamilyConfirm = (famId: string) =>
      this.deleteFamilyConfirm(famId);
    win.updateFamilyBeneficiaryMode = (famId: string, mode: string) =>
      this.updateFamilyBeneficiaryMode(famId, mode);
    win.updateFamilyBeneficiaryTable = (famId: string, tableName: string) =>
      this.updateFamilyBeneficiaryTable(famId, tableName);
    win.updateFamilyBeneficiaryLinkColumn = (
      famId: string,
      columnName: string,
    ) => this.updateFamilyBeneficiaryLinkColumn(famId, columnName);
    win.updateFamilyBeneficiaryDisplayColumn = (
      famId: string,
      slot: number,
      columnName: string,
    ) => this.updateFamilyBeneficiaryDisplayColumn(famId, slot, columnName);
    win.regenerateFamilyBeneficiarySql = (
      famId: string,
      silent?: boolean,
      force?: boolean,
    ) => this.regenerateFamilyBeneficiarySql(famId, silent, force);
    win.testFamilyBeneficiaryQuery = (famId: string) =>
      this.testFamilyBeneficiaryQuery(famId);
    win.regenerateFamilySql = (
      famId: string,
      silent?: boolean,
      force?: boolean,
    ) => this.regenerateFamilySql(famId, silent, force);
    win.setFamilyBaseTable = (famId: string, tableName: string) =>
      this.setFamilyBaseTable(famId, tableName);
    win.addSchemaSecondaryTable = (famId: string, tableName: string) =>
      this.addSchemaSecondaryTable(famId, tableName);
    win.removeSchemaSecondaryTable = (famId: string, tableName: string) =>
      this.removeSchemaSecondaryTable(famId, tableName);
    win.toggleSchemaColumnSelection = (
      famId: string,
      tableName: string,
      columnName: string,
    ) => this.toggleSchemaColumnSelection(famId, tableName, columnName);
    win.addSchemaScalar = (
      famId: string,
      tableName: string,
      columnName: string,
    ) => this.addSchemaScalar(famId, tableName, columnName);
    win.addSchemaList = (
      famId: string,
      tableName: string,
      columnName: string,
    ) => this.addSchemaList(famId, tableName, columnName);
    win.addSchemaTableVar = (famId: string, tableName: string) =>
      this.addSchemaTableVar(famId, tableName);
    win.testFamilyQuery = (famId: string) => this.testFamilyQuery(famId);
    win.moveVarColumn = (
      famId: string,
      ci: number,
      vi: number,
      colIndex: number,
      direction: number,
    ) => this.moveVarColumn(famId, ci, vi, colIndex, direction);
    win.removeVarColumn = (
      famId: string,
      ci: number,
      vi: number,
      colIndex: number,
    ) => this.removeVarColumn(famId, ci, vi, colIndex);
    win.updateVarAddColumnMode = (
      famId: string,
      ci: number,
      vi: number,
      mode: string,
    ) => this.updateVarAddColumnMode(famId, ci, vi, mode);
    win.addVarColumn = (famId: string, ci: number, vi: number) =>
      this.addVarColumn(famId, ci, vi);
    win.updateVarColumnLookupField = (
      famId: string,
      ci: number,
      vi: number,
      colIndex: number,
      field: string,
      value: string,
    ) => this.updateVarColumnLookupField(famId, ci, vi, colIndex, field, value);
    win.updateVarColumnLookupMode = (
      famId: string,
      ci: number,
      vi: number,
      colIndex: number,
      mode: string,
    ) => this.updateVarColumnLookupMode(famId, ci, vi, colIndex, mode);
    win.updateListVarLookupField = (
      famId: string,
      ci: number,
      vi: number,
      field: string,
      value: string,
    ) => this.updateListVarLookupField(famId, ci, vi, field, value);
    win.updateListVarLookupMode = (
      famId: string,
      ci: number,
      vi: number,
      mode: string,
    ) => this.updateListVarLookupMode(famId, ci, vi, mode);
    win.updateListObjectSqlQuery = (
      famId: string,
      ci: number,
      vi: number,
      value: string,
    ) => this.updateListObjectSqlQuery(famId, ci, vi, value);
    win.generateListObjectSqlQueryFromSource = (
      famId: string,
      ci: number,
      vi: number,
    ) => this.generateListObjectSqlQueryFromSource(famId, ci, vi);
    win.applySuggestedFiltersToListObjectSql = (
      famId: string,
      ci: number,
      vi: number,
    ) => this.applySuggestedFiltersToListObjectSql(famId, ci, vi);
    win.clearListObjectSqlQuery = (famId: string, ci: number, vi: number) =>
      this.clearListObjectSqlQuery(famId, ci, vi);
    win.testListObjectSqlQuery = (famId: string, ci: number, vi: number) =>
      this.testListObjectSqlQuery(famId, ci, vi);
    win.updateVarLinkField = (
      famId: string,
      ci: number,
      vi: number,
      field: string,
      value: string,
    ) => this.updateVarLinkField(famId, ci, vi, field, value);
    win.updateClassProp = (
      famId: string,
      ci: number,
      prop: string,
      val: string,
    ) => this.updateClassProp(famId, ci, prop, val);
    win.deleteClassBlock = (famId: string, ci: number) =>
      this.deleteClassBlock(famId, ci);
    win.deleteVar = (famId: string, ci: number, vi: number) =>
      this.deleteVar(famId, ci, vi);
    win.updateVarLabel = (
      famId: string,
      ci: number,
      vi: number,
      value: string,
    ) => this.updateVarLabel(famId, ci, vi, value);
    win.addClassBlock = (famId: string) => this.addClassBlock(famId);
    win.onVarTypeChange = (ci: number) => this.onVarTypeChange(ci);
    win.addTempCol = (ci: number) => this.addTempCol(ci);
    win._removeTempCol = (ci: number, i: number) => this.removeTempCol(ci, i);
    win._moveTempCol = (ci: number, i: number, direction: number) =>
      this.moveTempCol(ci, i, direction);
    win.addVar = (famId: string, ci: number) => this.addVar(famId, ci);
    win.saveOrganizationVariableSelection = () =>
      this.saveOrganizationVariableSelection();
  }

  private unbindLegacyWindow(): void {
    const win = window as any;
    delete win.closeModal;
    delete win.openModal;
    delete win.toast;
    delete win.updateFamilyDraftField;
    delete win.saveFamily;
    delete win.deleteFamilyConfirm;
    delete win.updateFamilyBeneficiaryMode;
    delete win.updateFamilyBeneficiaryTable;
    delete win.updateFamilyBeneficiaryLinkColumn;
    delete win.updateFamilyBeneficiaryDisplayColumn;
    delete win.regenerateFamilyBeneficiarySql;
    delete win.testFamilyBeneficiaryQuery;
    delete win.regenerateFamilySql;
    delete win.setFamilyBaseTable;
    delete win.addSchemaSecondaryTable;
    delete win.removeSchemaSecondaryTable;
    delete win.toggleSchemaColumnSelection;
    delete win.addSchemaScalar;
    delete win.addSchemaList;
    delete win.addSchemaTableVar;
    delete win.testFamilyQuery;
    delete win.moveVarColumn;
    delete win.removeVarColumn;
    delete win.updateVarAddColumnMode;
    delete win.addVarColumn;
    delete win.updateVarColumnLookupField;
    delete win.updateVarColumnLookupMode;
    delete win.updateListVarLookupField;
    delete win.updateListVarLookupMode;
    delete win.updateListObjectSqlQuery;
    delete win.generateListObjectSqlQueryFromSource;
    delete win.applySuggestedFiltersToListObjectSql;
    delete win.clearListObjectSqlQuery;
    delete win.testListObjectSqlQuery;
    delete win.updateVarLinkField;
    delete win.updateClassProp;
    delete win.deleteClassBlock;
    delete win.deleteVar;
    delete win.updateVarLabel;
    delete win.addClassBlock;
    delete win.onVarTypeChange;
    delete win.addTempCol;
    delete win._removeTempCol;
    delete win._moveTempCol;
    delete win.addVar;
    delete win.saveOrganizationVariableSelection;
  }

  async showSection(section: string, btn?: HTMLElement): Promise<void> {
    this.currentSection = section;
    this.panelSearch = "";

    await this.ensureSectionData(section);
    this.renderLeftPanel();
    this.renderSectionContent();
  }

  private getSectionMeta(section: string) {
    const meta: Record<
      string,
      { panelTitle: string; addLabel: string | null; topbar: string }
    > = {
      families: {
        panelTitle: "Familles de documents",
        addLabel: "Nouvelle famille",
        topbar: "Gestion des familles",
      },
      organizations: {
        panelTitle: "Organizations",
        addLabel: "Nouvelle Organization",
        topbar: "Gestion des Organizations",
      },
      admins: {
        panelTitle: "Users / Admins",
        addLabel: "Nouvel administrateur",
        topbar: "Gestion des users",
      },
      tableviews: {
        panelTitle: "Explorateur de données",
        addLabel: "Nouvelle vue",
        topbar: "Configuration des vues de données",
      },
    };
    return meta[section] ?? meta["families"];
  }

  private async ensureSectionData(section: string): Promise<void> {
    try {
      if (section === "organizations" && !this.organizations.length) {
        await this.editorState.ensureResources("organizations");
        this.syncStateFromStore();
      }
      if (section === "admins" && !this.admins.length) {
        await this.editorState.ensureResources("admins");
        this.syncStateFromStore();
      }
      if (section === "tableviews" && !this.tableViews.length) {
        await this.editorState.ensureResources("tableViews");
        this.syncStateFromStore();
      }
    } catch {
      this.syncStateFromStore();
      this.toast(
        "API indisponible. Demarrez le backend puis reessayez.",
        "error",
      );
    }
  }

  renderLeftPanel(): void {
    // The left panel is rendered by Angular template bindings now.
  }

  updatePanelSearch(event: Event): void {
    this.panelSearch = String(
      (event.target as HTMLInputElement | null)?.value || "",
    );
  }

  familyTemplateCount(familyId: string): number {
    return this.templates.filter((template) => template.familyId === familyId)
      .length;
  }

  familyBeneficiaryMeta(family: Family): string {
    return family.beneficiaryMode === "organization"
      ? "lie a l'Organization"
      : `beneficiaire: ${family.beneficiaryTable || "non defini"}`;
  }

  async selectFamilyFromPanel(familyId: string): Promise<void> {
    this.selectedFamId = familyId;
    try {
      await this.ensureSchemaMeta();
    } catch (e) {
      // Continue rendering even if schema fails
    }
    this.renderFamilyEditor(familyId);
  }

  getSelectedFamilyCreatedAtLabel(): string {
    const fam = this.selectedFamily;
    const createdAtValue = String((fam as any)?.["createdAt"] || "").trim();
    const createdAt = createdAtValue ? new Date(createdAtValue) : new Date();
    return createdAt.toLocaleDateString("fr-FR");
  }

  saveSelectedFamily(): void {
    if (!this.selectedFamId) return;
    this.saveFamily(this.selectedFamId);
  }

  async deleteSelectedFamily(): Promise<void> {
    if (!this.selectedFamId) return;
    await this.deleteFamilyConfirm(this.selectedFamId);
  }

  get selectedFamilyFilters(): any[] {
    return this.selectedFamily?.filterCatalog || [];
  }

  addSelectedFamilyFilter(): void {
    if (!this.selectedFamId) return;
    this.addFamilyFilterDefinition(this.selectedFamId);
  }

  removeSelectedFamilyFilter(filterId: string): void {
    if (!this.selectedFamId) return;
    this.removeFamilyFilterDefinition(this.selectedFamId, filterId);
  }

  updateSelectedFamilyFilterField(
    filterId: string,
    field: string,
    value: string,
  ): void {
    if (!this.selectedFamId) return;
    this.updateFamilyFilterField(this.selectedFamId, filterId, field, value);
  }

  updateSelectedFamilyFilterBindingMode(filterId: string, mode: string): void {
    if (!this.selectedFamId) return;
    this.updateFamilyFilterBindingMode(this.selectedFamId, filterId, mode);
  }

  updateSelectedFamilyFilterBoundColumnForTable(
    filterId: string,
    tableName: string,
    columnName: string,
  ): void {
    if (!this.selectedFamId) return;
    this.updateFamilyFilterBoundColumnForTable(
      this.selectedFamId,
      filterId,
      tableName,
      columnName,
    );
  }

  updateSelectedFamilyFilterRole(
    filterId: string,
    role: string,
    checked: boolean,
  ): void {
    if (!this.selectedFamId) return;
    this.toggleFamilyFilterRole(this.selectedFamId, filterId, role, checked);
  }

  updateSelectedFamilyFilterStaticOptions(filterId: string, raw: string): void {
    if (!this.selectedFamId) return;
    this.updateFamilyFilterStaticOptions(this.selectedFamId, filterId, raw);
  }

  updateSelectedFamilyFilterSqlBuilderField(
    filterId: string,
    field: string,
    value: string,
  ): void {
    if (!this.selectedFamId) return;
    void this.updateFamilyFilterSqlBuilderField(
      this.selectedFamId,
      filterId,
      field,
      value,
    );
  }

  regenerateSelectedFamilyFilterSql(filterId: string): void {
    if (!this.selectedFamId) return;
    void this.regenerateFamilyFilterSqlQuery(this.selectedFamId, filterId);
  }

  getSelectedFamilyBindableTables(): string[] {
    if (!this.selectedFamId || !this.selectedFamily || !this.schemaMetaCache)
      return [];
    return this.getFamilyFilterBindableTables(
      this.selectedFamId,
      this.selectedFamily,
      this.schemaMetaCache,
    );
  }

  getSelectedFamilyVisibleTables(): any[] {
    return this.schemaMetaCache
      ? this.getVisibleFamilySchemaTables(this.schemaMetaCache)
      : [];
  }

  getSelectedFamilyTableColumns(tableName: string): any[] {
    if (!this.schemaMetaCache || !tableName) return [];
    return this.getColumnsForTable(this.schemaMetaCache, tableName);
  }

  getFilterBindingColumnName(filter: any, tableName: string): string {
    return this.getFilterBindingForTable(filter, tableName)?.columnName || "";
  }

  getFilterStaticOptionsText(filter: any): string {
    return (filter?.staticOptions || [])
      .map((option: any) => `${option?.value || ""}|${option?.label || ""}`)
      .join("\n");
  }

  getAdminOrganizationName(admin: AdminAccount): string {
    const organization = this.organizations.find(
      (item) => item.id === admin.organizationId,
    );
    return organization?.nom || organization?.name || "-";
  }

  getOrganizationAdmin(organizationId: string): AdminAccount | null {
    return (
      this.admins.find((admin) => admin.organizationId === organizationId) ||
      null
    );
  }

  getAdminProfile(admin: AdminAccount): string {
    return String(admin["profile"] || admin["raw"]?.Profil || "-");
  }

  async selectTableViewFromPanel(viewId: string): Promise<void> {
    this.selectedTableViewId = viewId;
    this.selectedTableViewRowId = null;
    this.selectedTableViewRecord = null;
    this.isCreatingTableViewRow = false;
    try {
      await this.ensureTableViewSchema();
    } catch (e) {
      // Continue rendering even if schema fails
    }
    // Ensure fieldLabels and fieldSettings are initialized for visible fields
    const view = this.selectedTableView;
    if (view) {
      view.fieldLabels = view.fieldLabels || {};
      view.fieldSettings = view.fieldSettings || {};
      const visibleFieldsSet = new Set(view.visibleFields || []);
      let needsSave = false;
      for (const fieldName of visibleFieldsSet) {
        if (!view.fieldLabels[fieldName]) {
          view.fieldLabels[fieldName] = this.humanizeSchemaName(fieldName);
          needsSave = true;
        }
        if (!view.fieldSettings[fieldName]) {
          view.fieldSettings[fieldName] = {
            displayMode: "raw",
            lookupTable: "",
            lookupValueColumn: "",
            lookupLabelColumn: "",
            lookupLabelColumn2: "",
          };
          needsSave = true;
        }
      }
      if (needsSave) {
        this.saveTableViewLocal(view);
      }
    }
    this.renderTableViewsContent();
    await this.reloadTableViewRows();
  }

  getTableViewRowId(row: any): string {
    return String(
      row?.id ?? row?.Id ?? row?.ID ?? Object.values(row || {})[0] ?? "",
    );
  }

  getTableViewLookupOptionsForField(
    view: TableViewConfig,
    fieldName: string,
  ): any[] {
    return (
      this.tableViewLookupOptionsCache[
        this.getTableViewLookupCacheKey(view, fieldName)
      ] || []
    );
  }

  updateSelectedTableViewField(fieldName: string, value: string): void {
    if (!this.selectedTableViewRecord) return;
    this.selectedTableViewRecord = {
      ...this.selectedTableViewRecord,
      [fieldName]: value,
    };
  }

  private renderSectionContent(): void {
    if (this.currentSection === "organizations")
      this.renderOrganizationContent();
    if (this.currentSection === "admins") this.renderAdminContent();
    if (this.currentSection === "tableviews") this.renderTableViewsContent();
  }

  private renderFamilyEditor(_famId: string): void {
    const fam = this.getFamily(_famId);
    if (!fam) return;
    const wrap = document.getElementById("familyEditorWrap");
    if (!wrap) return;
    const isOrganizationMode = fam.beneficiaryMode === "organization";
    const templates = this.templates.filter((t) => t.familyId === fam.id);
    const allVars = (fam.classes || []).flatMap((c: any) => c.vars || []);
    const createdAt = fam.createdAt ? new Date(fam.createdAt) : new Date();

    wrap.innerHTML = `
<div class="card">
  <div class="card-header">
    <div class="card-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      Assistant schéma SQL Server
    </div>
    <span class="chip chip-teal">Variables pilotées par la base</span>
  </div>
  <div class="card-body">
    <div class="text-muted" style="margin-bottom:12px">
      Choisissez une table source, récupérez ses descriptions et générez automatiquement les variables ainsi que la requête <strong>SELECT</strong>.
    </div>
    <div id="schemaBuilderWrap"></div>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Informations générales
    </div>
    <span class="chip chip-purple">Famille</span>
  </div>
  <div class="card-body">
    <div class="form-grid c3">
      <div class="form-row" style="margin:0"><label class="form-label">Nom <span class="req">*</span></label><input class="form-input" id="fNom" value="${this.escAttr(
        fam.nom || "",
      )}" placeholder="Ex: Attestation de travail" oninput="updateFamilyDraftField('${this.escAttr(
        fam.id || "",
      )}', 'nom', this.value)"></div>
      <div class="form-row" style="margin:0"><label class="form-label">Description</label><input class="form-input" id="fDesc" value="${this.escAttr(
        fam.description || "",
      )}" placeholder="Description courte" oninput="updateFamilyDraftField('${this.escAttr(
        fam.id || "",
      )}', 'description', this.value)"></div>
    </div>
    <div class="form-grid c3" style="margin-top:14px">
      <div class="form-row" style="margin:0">
        <label class="form-label">Cible du document</label>
        <select class="form-input" id="fBeneficiaryMode" onchange="updateFamilyBeneficiaryMode('${this.escAttr(
          fam.id || "",
        )}', this.value)">
          <option value="table" ${!isOrganizationMode ? "selected" : ""}>Bénéficiaire d'une table</option>
          <option value="organization" ${isOrganizationMode ? "selected" : ""}>Lié à l'Organization</option>
        </select>
      </div>
      <div class="form-row" style="margin:0" id="familyBeneficiaryTableWrap">
        <label class="form-label">Table bénéficiaire</label>
        <div class="text-muted" style="padding-top:9px">Chargement...</div>
      </div>
      <div class="form-row" style="margin:0">
        <label class="form-label">Tables masquées</label>
        <div class="text-muted" id="familyHiddenTablesHint" style="padding-top:9px"></div>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18"/><path d="M6 12h12"/><path d="M10 17h4"/></svg>
      Requête SQL bénéficiaires
    </div>
    <div class="flex gap-8">
      <span class="chip chip-teal">Liste pour aperçu / impression</span>
      ${fam.customBeneficiarySql ? '<span class="chip" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d">SQL personnalisé</span>' : ""}
    </div>
  </div>
  <div class="card-body">
    <p class="text-muted" style="margin-bottom:10px">Quand la cible du document est une table, ce SELECT sert à afficher les bénéficiaires disponibles avant l'aperçu et l'impression.</p>
    <div class="flex gap-8" style="margin-bottom:10px">
      <button class="btn sm" onclick="regenerateFamilyBeneficiarySql('${this.escAttr(
        fam.id || "",
      )}', false, true)">Régénérer SELECT bénéficiaires</button>
      <button class="btn sm" onclick="testFamilyBeneficiaryQuery('${this.escAttr(
        fam.id || "",
      )}')">Tester la liste</button>
    </div>
    <div class="sql-wrap">
      <textarea class="sql-input" id="fBeneficiarySql" rows="7" ${isOrganizationMode ? "disabled" : ""} onchange="updateFamilyDraftField('${this.escAttr(
        fam.id || "",
      )}', 'beneficiarySql', this.value)">${this.escHtml(
        fam.beneficiarySql || "",
      )}</textarea>
      <div class="sql-badge">BENEF</div>
    </div>
    <pre id="beneficiaryPreviewBox" style="margin-top:10px;white-space:pre-wrap;font-size:11px;color:var(--text2);background:#fbfcfe;border:1px solid var(--line);border-radius:12px;padding:12px">Cliquez sur "Tester la liste" pour voir un bénéficiaire retourné.</pre>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
      Classes &amp; Variables
    </div>
    <div class="text-muted">${allVars.length} variables (${allVars.filter((v: any) => v.type === "list-object").length} tableaux-objet)</div>
  </div>
  <div class="card-body">
    <div id="classesContainer"></div>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
      Requête SQL principale
    </div>
    <div class="flex gap-8">
      <span class="chip chip-teal">SELECT automatique à la génération</span>
      ${fam.customMainSql ? '<span class="chip" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d">SQL personnalisé</span>' : ""}
    </div>
  </div>
  <div class="card-body">
    <p class="text-muted" style="margin-bottom:10px">Les paramètres :nom_param seront substitués automatiquement lors de la génération.</p>
    <div class="sql-wrap">
      <textarea class="sql-input" id="fSql" rows="9" onchange="updateFamilyDraftField('${this.escAttr(
        fam.id || "",
      )}', 'sql', this.value)">${this.escHtml(fam.sql || "")}</textarea>
      <div class="sql-badge">SQL</div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Templates associés
    </div>
    <span class="chip chip-green">${templates.length} template(s)</span>
  </div>
  <div class="card-body" style="padding:0">
    ${
      templates.length === 0
        ? '<div class="text-muted" style="padding:16px;text-align:center">Aucun template — créez-en depuis l\'interface Admin Organization</div>'
        : `<table class="data-table"><thead><tr><th>Nom</th><th>Organization</th><th>Mis à jour</th><th>Statut</th></tr></thead><tbody>${templates
            .map((t: any) => {
              const org = this.organizations.find(
                (o) => o.id === t.organizationId,
              );
              const updatedAt = t.updatedAt
                ? new Date(t.updatedAt)
                : new Date();
              return `<tr><td><strong>${this.escHtml(t.nom || "")}</strong></td><td>${this.escHtml(org?.nom || "—")}</td><td>${updatedAt.toLocaleDateString("fr-FR")}</td><td><span class="chip chip-green">Publié</span></td></tr>`;
            })
            .join("")}</tbody></table>`
    }
  </div>
</div>`;

    const afterFiltersWrap = document.getElementById(
      "familyEditorAfterFilters",
    );
    if (afterFiltersWrap) {
      afterFiltersWrap.innerHTML = "";
      Array.from(wrap.children)
        .slice(3)
        .forEach((node) => afterFiltersWrap.appendChild(node));
    }

    this.renderClassesContainer(fam.id);
    this.renderFamilyFilterCatalog(fam.id);
    this.renderFamilyBeneficiaryTableSelect(fam.id);
    this.renderSchemaAssistant(fam.id);
    this.refreshGeneratedListObjectQueries(fam.id, fam);
    if (
      fam.beneficiaryMode === "organization" &&
      (!fam.sql || /:beneficiaryId\b/i.test(fam.sql))
    ) {
      setTimeout(() => this.regenerateFamilySql(fam.id, true), 0);
    }
  }

  private renderOrganizationContent(): void {
    // Organizations are rendered by Angular template bindings now.
  }

  private renderAdminContent(): void {
    // Admin accounts are rendered by Angular template bindings now.
  }

  private renderTableViewsContent(): void {
    void this.ensureTableViewSchema();
  }

  private async ensureTableViewSchema(): Promise<void> {
    if (!this.tableViewSchemaCache) {
      this.tableViewSchemaCache = await this.ensureSchemaMeta();
    }
    if (!this.schemaMetaCache) this.schemaMetaCache = this.tableViewSchemaCache;
  }
  addItem(): void {
    if (this.currentSection === "families") this.newFamily();
    if (this.currentSection === "organizations") this.openOrganizationModal();
    if (this.currentSection === "admins") this.openAdminModal();
    if (this.currentSection === "tableviews") this.newTableView();
  }

  private newFamily(): void {
    const id = this.genId("fam");
    const family: Family = {
      id,
      nom: "Nouvelle famille",
      beneficiaryMode: "organization",
      beneficiaryTable: null,
      beneficiaryTableLabel: "",
      beneficiaryDisplayColumn1: "",
      beneficiaryDisplayColumn2: "",
      beneficiaryLinkColumn: "",
      beneficiarySql: "",
      filterCatalog: [],
      classes: [],
    };
    void this.familyService
      .saveFamily(family)
      .then((saved: Family) => {
        this.syncStateFromStore();
        this.selectedFamId = saved.id;
        this.renderLeftPanel();
        this.renderFamilyEditor(saved.id);
        this.toast("Famille créée", "success");
      })
      .catch(() => {
        this.toast("Creation impossible", "error");
      });
  }

  private newTableView(): void {
    this.newTableViewConfig();
  }

  logoutAndRedirect(): void {
    this.zone.run(() => this.auth.logout());
  }

  closeModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("open");
  }

  openModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("open");
  }

  private bindModalHandlers(): void {
    document.addEventListener("click", this.modalClickHandler);
    document.addEventListener("keydown", this.modalKeydownHandler);
  }

  private unbindModalHandlers(): void {
    document.removeEventListener("click", this.modalClickHandler);
    document.removeEventListener("keydown", this.modalKeydownHandler);
  }

  private toast(message: string, type: string = ""): void {
    if (type === "success") this.notifications.showSuccess(message);
    else if (type === "error") this.notifications.showError(message);
    else if (type === "warning") this.notifications.showWarning(message);
    else this.notifications.showInfo(message);
  }

  private async confirmAction(data: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    actionType?: "delete" | "warning" | "success" | "info" | "error";
  }): Promise<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        cancelText: "Annuler",
        confirmText: "Confirmer",
        actionType: "warning",
        ...data,
      },
    });
    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }

  private setText(id: string, text: string): void {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  getInitials(value: string): string {
    return String(value || "")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  getAdminDisplayName(admin: AdminAccount | null | undefined): string {
    return String(
      admin?.name || (admin as any)?.nom || admin?.email || "",
    ).trim();
  }

  private escHtml(value: string): string {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private escAttr(value: string): string {
    return this.escHtml(value).replace(/"/g, "&quot;");
  }

  private genId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  private getFamily(id: string): any {
    return this.families.find((f: any) => f.id === id) || null;
  }

  private saveFamilyLocal(fam: any): void {
    const normalized = normalizeFamilyRecord(fam as any);
    const state = this.editorState.getState();
    const index = state.families.findIndex((item) => item.id === normalized.id);
    index >= 0
      ? state.families.splice(index, 1, normalized)
      : state.families.push(normalized);
    this.replaceState(state);
    this.api
      .put(`families/${encodeURIComponent(normalized.id)}`, normalized)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () =>
          this.toast("Impossible de synchroniser la famille.", "error"),
      });
  }

  private deleteFamilyLocal(id: string): void {
    const state = this.editorState.getState();
    state.families = state.families.filter((family) => family.id !== id);
    state.templates = state.templates.filter(
      (template) => template.familyId !== id,
    );
    this.replaceState(state);
    this.api
      .delete(`families/${encodeURIComponent(id)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => this.toast("Impossible de supprimer la famille.", "error"),
      });
  }

  private updateFamilyDraftField(
    famId: string,
    field: string,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam[field] = value;
    if (field === "sql") fam.customMainSql = true;
    if (field === "beneficiarySql") fam.customBeneficiarySql = true;
    this.saveFamilyLocal(fam);
  }

  private saveFamily(famId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const beneficiaryModeValue =
      (document.getElementById("fBeneficiaryMode") as HTMLSelectElement | null)
        ?.value || "table";
    const beneficiaryTableValue =
      (
        document.getElementById("fBeneficiaryTable") as HTMLSelectElement | null
      )?.value?.trim() || "";
    const beneficiaryLinkColumnValue =
      (
        document.getElementById(
          "fBeneficiaryLinkColumn",
        ) as HTMLSelectElement | null
      )?.value?.trim() || "";
    const beneficiaryDisplayColumn1Value =
      (
        document.getElementById(
          "fBeneficiaryDisplayColumn1",
        ) as HTMLSelectElement | null
      )?.value?.trim() || "";
    const beneficiaryDisplayColumn2Value =
      (
        document.getElementById(
          "fBeneficiaryDisplayColumn2",
        ) as HTMLSelectElement | null
      )?.value?.trim() || "";
    const sqlValue =
      (
        document.getElementById("fSql") as HTMLTextAreaElement | null
      )?.value?.trim() || "";
    const beneficiarySqlValue =
      (
        document.getElementById("fBeneficiarySql") as HTMLTextAreaElement | null
      )?.value?.trim() || "";
    if (sqlValue && !/^select\b/i.test(sqlValue)) {
      this.toast(
        "La requête principale doit rester une requête SELECT",
        "error",
      );
      return;
    }
    if (
      fam.beneficiaryMode !== "organization" &&
      beneficiarySqlValue &&
      !/^select\b/i.test(beneficiarySqlValue)
    ) {
      this.toast(
        "La requête de liste des bénéficiaires doit rester une requête SELECT",
        "error",
      );
      return;
    }
    fam.nom =
      (document.getElementById("fNom") as HTMLInputElement | null)?.value ||
      fam.nom;
    fam.description =
      (document.getElementById("fDesc") as HTMLInputElement | null)?.value ||
      "";
    fam.beneficiaryMode =
      beneficiaryModeValue === "organization" ? "organization" : "table";
    fam.beneficiaryTable =
      fam.beneficiaryMode === "organization"
        ? null
        : beneficiaryTableValue || fam.beneficiaryTable || "";
    fam.beneficiaryLinkColumn =
      fam.beneficiaryMode === "organization"
        ? ""
        : beneficiaryLinkColumnValue || fam.beneficiaryLinkColumn || "";
    fam.beneficiaryDisplayColumn1 =
      fam.beneficiaryMode === "organization"
        ? ""
        : beneficiaryDisplayColumn1Value || "";
    fam.beneficiaryDisplayColumn2 =
      fam.beneficiaryMode === "organization"
        ? ""
        : beneficiaryDisplayColumn2Value || "";
    fam.beneficiarySql =
      fam.beneficiaryMode === "organization" ? "" : beneficiarySqlValue;
    fam.sql = sqlValue;
    this.saveFamilyLocal(fam);
    this.renderLeftPanel();
    this.toast("Famille enregistrée", "success");
  }

  private async deleteFamilyConfirm(famId: string): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const confirmed = await this.confirmAction({
      title: "Supprimer la famille ?",
      message: `La famille "${fam.nom || fam.name || fam.id}" et tous ses templates (${this.templates.filter((t) => t.familyId === famId).length}) seront supprimés. Cette action est irréversible.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;
    this.deleteFamilyLocal(famId);
    this.selectedFamId = null;
    this.renderLeftPanel();
    const wrap = document.getElementById("familyEditorWrap");
    if (wrap)
      wrap.innerHTML = '<div class="empty"><h3>Famille supprimée</h3></div>';
    this.toast("Famille supprimée", "success");
  }

  private async ensureSchemaMeta(): Promise<any> {
    if (this.schemaMetaCache) return this.schemaMetaCache;
    const payload = await firstValueFrom(this.api.get<any>("schema"));
    this.schemaMetaCache = payload?.schema || payload;
    return this.schemaMetaCache;
  }

  private getColumnsForTable(schema: any, tableName: string): any[] {
    return (schema?.columns || []).filter((c: any) => c.table === tableName);
  }

  private getPrimaryColumn(schema: any, tableName: string): string {
    return (
      this.getColumnsForTable(schema, tableName).find(
        (c: any) => c.key === "PRI",
      )?.name || "id"
    );
  }

  private getFamilyBeneficiaryTable(fam: any): string {
    return fam?.beneficiaryTable || "";
  }

  private getFamilyBeneficiaryLinkColumn(fam: any, schema: any): string {
    const tableName = this.getFamilyBeneficiaryTable(fam);
    if (!schema || !tableName) {
      return String(fam?.beneficiaryLinkColumn || "").trim();
    }
    const configured = String(fam?.beneficiaryLinkColumn || "").trim();
    const columns = this.getColumnsForTable(schema, tableName);
    if (configured && columns.some((c) => c.name === configured))
      return configured;
    return this.getPrimaryColumn(schema, tableName);
  }

  private getSuggestedBeneficiaryDisplayColumns(
    fam: any,
    schema: any,
    tableName: string,
  ): string[] {
    const configured = this.getConfiguredBeneficiaryDisplayColumns(
      fam,
      schema,
      tableName,
    );
    if (configured.length) return configured;
    const columns = this.getColumnsForTable(schema, tableName);
    const fullNameColumn = columns.find((column: any) =>
      ["nom_prenom", "nom_complet", "display_name", "full_name"].includes(
        column.name,
      ),
    )?.name;
    if (fullNameColumn) return [fullNameColumn];
    const nomColumn = columns.find(
      (column: any) => column.name === "nom",
    )?.name;
    const prenomColumn = columns.find(
      (column: any) => column.name === "prenom",
    )?.name;
    if (nomColumn && prenomColumn) return [nomColumn, prenomColumn];
    const firstLabelColumn = columns.find((column: any) =>
      ["libelle", "intitule", "nom", "prenom", "code"].includes(column.name),
    )?.name;
    return firstLabelColumn ? [firstLabelColumn] : [];
  }

  private getConfiguredBeneficiaryDisplayColumns(
    fam: any,
    schema: any,
    tableName: string,
  ): string[] {
    if (!fam || !schema || !tableName) return [];
    const availableColumns = new Set(
      this.getColumnsForTable(schema, tableName).map(
        (column: any) => column.name,
      ),
    );
    return [
      String(fam.beneficiaryDisplayColumn1 || "").trim(),
      String(fam.beneficiaryDisplayColumn2 || "").trim(),
    ].filter((columnName, index, list) => {
      if (!columnName || !availableColumns.has(columnName)) return false;
      return list.indexOf(columnName) === index;
    });
  }

  private getVisibleFamilySchemaTables(
    schema: any,
    extraTables: string[] = [],
  ): any[] {
    const extras = new Set((extraTables || []).filter(Boolean));
    return (schema?.tables || []).filter(
      (table: any) =>
        !this.hiddenFamilyTables.includes(table.name) || extras.has(table.name),
    );
  }

  private async renderFamilyBeneficiaryTableSelect(
    famId: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    const wrap = document.getElementById("familyBeneficiaryTableWrap");
    const hiddenHint = document.getElementById("familyHiddenTablesHint");
    if (hiddenHint) hiddenHint.textContent = this.hiddenFamilyTables.join(", ");
    if (!fam || !wrap) return;

    if (fam.beneficiaryMode === "organization") {
      wrap.innerHTML = `
        <label class="form-label">Table bénéficiaire</label>
        <div class="text-muted" style="padding-top:9px">Aucune table requise : ce document sera généré à partir du contexte de l'Organization.</div>`;
      return;
    }

    wrap.innerHTML = `
      <label class="form-label">Table bénéficiaire</label>
      <div class="text-muted" style="padding-top:9px">Chargement du schéma...</div>`;

    try {
      const schema = await this.ensureSchemaMeta();
      const visibleTables = this.getVisibleFamilySchemaTables(schema, [
        fam.beneficiaryTable,
      ]);
      const tableName = this.getFamilyBeneficiaryTable(fam);
      const tableColumns = this.getColumnsForTable(schema, tableName);
      const tableLinkColumn = this.getFamilyBeneficiaryLinkColumn(fam, schema);
      const suggestedColumns = this.getSuggestedBeneficiaryDisplayColumns(
        fam,
        schema,
        tableName,
      );
      if (tableLinkColumn && tableLinkColumn !== fam.beneficiaryLinkColumn) {
        fam.beneficiaryLinkColumn = tableLinkColumn;
      }
      if (!fam.beneficiaryDisplayColumn1 && suggestedColumns[0]) {
        fam.beneficiaryDisplayColumn1 = suggestedColumns[0];
      }
      if (!fam.beneficiaryDisplayColumn2 && suggestedColumns[1]) {
        fam.beneficiaryDisplayColumn2 = suggestedColumns[1];
      }
      if (!fam.beneficiarySql) {
        fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
        this.saveFamilyLocal(fam);
        const sqlInput = document.getElementById(
          "fBeneficiarySql",
        ) as HTMLTextAreaElement | null;
        if (sqlInput) sqlInput.value = fam.beneficiarySql || "";
      }
      wrap.innerHTML = `
        <label class="form-label">Table bénéficiaire</label>
        <select class="form-input" id="fBeneficiaryTable" onchange="updateFamilyBeneficiaryTable('${this.escAttr(
          famId,
        )}', this.value)">
          ${visibleTables
            .map(
              (table: any) =>
                `<option value="${this.escAttr(table.name)}" ${table.name === tableName ? "selected" : ""}>${this.escHtml(table.name)}${table.comment ? ` - ${this.escHtml(table.comment)}` : ""}</option>`,
            )
            .join("")}
        </select>
        <div style="margin-top:10px">
          <label class="form-label" style="font-size:11px">Libellé affiché à l'admin et au user</label>
          <input class="form-input" id="fBeneficiaryTableLabel" value="${this.escAttr(
            fam.beneficiaryTableLabel || "",
          )}" placeholder="${this.escAttr(tableName ? this.humanizeSchemaName(tableName) : "Ex: Étudiant")}" oninput="updateFamilyDraftField('${this.escAttr(
            famId,
          )}', 'beneficiaryTableLabel', this.value)">
        </div>
        <div style="margin-top:10px">
          <label class="form-label" style="font-size:11px">Colonne de liaison</label>
          <select class="form-input" id="fBeneficiaryLinkColumn" onchange="updateFamilyBeneficiaryLinkColumn('${this.escAttr(
            famId,
          )}', this.value)">
            <option value="">Choisir une colonne</option>
            ${tableColumns
              .map(
                (column: any) =>
                  `<option value="${this.escAttr(column.name)}" ${column.name === (fam.beneficiaryLinkColumn || "") ? "selected" : ""}>${this.escHtml(column.name)}${column.key === "PRI" ? " - clé primaire" : column.comment ? ` - ${this.escHtml(column.comment)}` : ""}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
          <div>
            <label class="form-label" style="font-size:11px">Colonne affichage 1</label>
            <select class="form-input" id="fBeneficiaryDisplayColumn1" onchange="updateFamilyBeneficiaryDisplayColumn('${this.escAttr(
              famId,
            )}', 1, this.value)">
              <option value="">Choisir une colonne</option>
              ${tableColumns
                .map(
                  (column: any) =>
                    `<option value="${this.escAttr(column.name)}" ${column.name === (fam.beneficiaryDisplayColumn1 || "") ? "selected" : ""}>${this.escHtml(column.name)}${column.comment ? ` - ${this.escHtml(column.comment)}` : ""}</option>`,
                )
                .join("")}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:11px">Colonne affichage 2</label>
            <select class="form-input" id="fBeneficiaryDisplayColumn2" onchange="updateFamilyBeneficiaryDisplayColumn('${this.escAttr(
              famId,
            )}', 2, this.value)">
              <option value="">Aucune</option>
              ${tableColumns
                .map(
                  (column: any) =>
                    `<option value="${this.escAttr(column.name)}" ${column.name === (fam.beneficiaryDisplayColumn2 || "") ? "selected" : ""}>${this.escHtml(column.name)}${column.comment ? ` - ${this.escHtml(column.comment)}` : ""}</option>`,
                )
                .join("")}
            </select>
          </div>
        </div>
        <div class="text-muted" style="margin-top:8px">Ces colonnes seront affichées dans les listes de bénéficiaires côté admin et user. Exemple : <strong>Nom</strong> + <strong>Prenom</strong>.</div>`;
      this.saveFamilyLocal(fam);
    } catch (error: any) {
      wrap.innerHTML = `
        <label class="form-label">Table bénéficiaire</label>
        <div class="text-danger" style="padding-top:9px">${this.escHtml(error?.message || "Erreur de chargement")}</div>`;
    }
  }

  private updateFamilyBeneficiaryMode(famId: string, mode: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.beneficiaryMode = mode === "organization" ? "organization" : "table";
    if (fam.beneficiaryMode === "table") {
      fam.beneficiaryTable = fam.beneficiaryTable || "";
      fam.customBeneficiarySql = false;
      fam.beneficiarySql =
        fam.beneficiarySql || this.buildBeneficiarySqlFromFamily(famId);
    } else {
      fam.beneficiaryTable = null;
      fam.beneficiarySql = "";
      fam.customBeneficiarySql = false;
    }
    this.saveFamilyLocal(fam);
    const modeSelect = document.getElementById(
      "fBeneficiaryMode",
    ) as HTMLSelectElement | null;
    if (modeSelect) modeSelect.value = fam.beneficiaryMode;
    this.renderLeftPanel();
    this.renderFamilyBeneficiaryTableSelect(famId);
    this.renderFamilyEditor(famId);
    this.regenerateFamilySql(famId, true);
  }

  private updateFamilyBeneficiaryTable(famId: string, tableName: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.beneficiaryMode = "table";
    fam.beneficiaryTable = tableName || "";
    if (!fam.beneficiaryTableLabel && tableName) {
      fam.beneficiaryTableLabel = this.humanizeSchemaName(tableName);
    }
    fam.beneficiaryLinkColumn = "";
    fam.beneficiaryDisplayColumn1 = "";
    fam.beneficiaryDisplayColumn2 = "";
    fam.customBeneficiarySql = false;
    fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
    this.saveFamilyLocal(fam);
    if (this.schemaMetaCache) {
      const state = this.getBuilderState(famId, fam, this.schemaMetaCache);
      if (state && !state.baseTable) state.baseTable = fam.beneficiaryTable;
    }
    this.renderLeftPanel();
    this.renderFamilyEditor(famId);
    this.regenerateFamilySql(famId, true);
  }

  private updateFamilyBeneficiaryLinkColumn(
    famId: string,
    columnName: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.beneficiaryLinkColumn = columnName || "";
    if (!fam.customBeneficiarySql) {
      fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
    }
    this.saveFamilyLocal(fam);
    const sqlInput = document.getElementById(
      "fBeneficiarySql",
    ) as HTMLTextAreaElement | null;
    if (sqlInput) sqlInput.value = fam.beneficiarySql || "";
    this.regenerateFamilySql(famId, true);
  }

  private updateFamilyBeneficiaryDisplayColumn(
    famId: string,
    slot: number,
    columnName: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const display1Select = document.getElementById(
      "fBeneficiaryDisplayColumn1",
    ) as HTMLSelectElement | null;
    const display2Select = document.getElementById(
      "fBeneficiaryDisplayColumn2",
    ) as HTMLSelectElement | null;
    let nextDisplay1 = String(
      display1Select?.value ?? fam.beneficiaryDisplayColumn1 ?? "",
    ).trim();
    let nextDisplay2 = String(
      display2Select?.value ?? fam.beneficiaryDisplayColumn2 ?? "",
    ).trim();

    if (Number(slot) === 1) {
      nextDisplay1 = String(columnName || "").trim();
    } else {
      nextDisplay2 = String(columnName || "").trim();
    }

    if (nextDisplay1 && nextDisplay2 && nextDisplay1 === nextDisplay2) {
      if (Number(slot) === 1) nextDisplay2 = "";
      else nextDisplay2 = "";
    }

    fam.beneficiaryDisplayColumn1 = nextDisplay1;
    fam.beneficiaryDisplayColumn2 = nextDisplay2;
    if (!fam.customBeneficiarySql) {
      fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
    }
    this.saveFamilyLocal(fam);
    const sqlInput = document.getElementById(
      "fBeneficiarySql",
    ) as HTMLTextAreaElement | null;
    if (sqlInput) sqlInput.value = fam.beneficiarySql || "";
    if (display1Select)
      display1Select.value = fam.beneficiaryDisplayColumn1 || "";
    if (display2Select)
      display2Select.value = fam.beneficiaryDisplayColumn2 || "";
  }

  private createEmptyFamilyFilterDefinition(index = 0): any {
    return normalizeFilterDefinition(
      {
        id: this.genId("flt"),
        key: `filtre_${index + 1}`,
        label: `Filtre ${index + 1}`,
        type: "text",
        sourceType: "static",
        placeholder: "",
        helpText: "",
        roles: { admin: true, user: true },
        staticOptions: [],
        sqlBuilder: {},
        sqlQuery: "",
      },
      index,
    );
  }

  private getFamilyFilterById(fam: any, filterId: string): any {
    return (fam?.filterCatalog || []).find(
      (filter: any) => filter.id === filterId,
    );
  }

  private async renderFamilyFilterCatalog(_famId: string): Promise<void> {
    return;
  }
  private addFamilyFilterDefinition(famId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = [
      ...(fam.filterCatalog || []),
      this.createEmptyFamilyFilterDefinition((fam.filterCatalog || []).length),
    ];
    this.saveFamilyLocal(fam);
    this.renderFamilyEditor(famId);
    this.toast("Filtre ajouté", "success");
  }

  private removeFamilyFilterDefinition(famId: string, filterId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = (fam.filterCatalog || []).filter(
      (filter: any) => filter.id !== filterId,
    );
    this.saveFamilyLocal(fam);
    this.renderFamilyEditor(famId);
    this.toast("Filtre supprimé", "success");
  }

  private updateFamilyFilterField(
    famId: string,
    filterId: string,
    field: string,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) => {
        if (filter.id !== filterId) return filter;
        const next = {
          ...filter,
          [field]:
            field === "key"
              ? normalizeFilterParamName(value, `filtre_${index + 1}`)
              : value,
        };
        if (field === "type" && value !== "select") {
          next.sourceType = "static";
          next.staticOptions = [];
          next.sqlQuery = "";
        }
        if (field === "sourceType" && value !== "sql") {
          next.sqlQuery = "";
        }
        return normalizeFilterDefinition(next, index);
      },
    );
    this.saveFamilyLocal(fam);
    this.regenerateFamilyBeneficiarySql(famId, true);
    this.regenerateFamilySql(famId, true);
    this.renderFamilyEditor(famId);
  }

  private updateFamilyFilterBindingMode(
    famId: string,
    filterId: string,
    mode: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) => {
        if (filter.id !== filterId) return filter;
        const bindings = normalizeFilterColumnBindings(
          filter.columnBindings || [],
          filter.columnBinding || {},
        );
        const normalizedMode =
          mode === "table-links" || mode === "base-column"
            ? "table-links"
            : "manual";
        return normalizeFilterDefinition(
          {
            ...filter,
            columnBinding:
              normalizedMode === "manual"
                ? normalizeFilterColumnBinding({})
                : normalizeFilterColumnBinding(
                    bindings[0] || filter.columnBinding || {},
                  ),
            columnBindings:
              normalizedMode === "manual"
                ? []
                : bindings.map((binding) => ({
                    ...binding,
                    mode: "table-links",
                  })),
          },
          index,
        );
      },
    );
    this.saveFamilyLocal(fam);
    this.regenerateFamilyBeneficiarySql(famId, true);
    this.regenerateFamilySql(famId, true);
    this.renderFamilyEditor(famId);
  }

  private updateFamilyFilterBoundColumnForTable(
    famId: string,
    filterId: string,
    tableName: string,
    columnName: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) => {
        if (filter.id !== filterId) return filter;
        const bindings = normalizeFilterColumnBindings(
          filter.columnBindings || [],
          filter.columnBinding || {},
        ).filter((binding) => binding.tableName !== tableName);
        if (columnName) {
          bindings.push({
            tableName,
            columnName,
            mode: "table-links",
          });
        }
        const primaryBinding = bindings[0] || {
          tableName: "",
          columnName: "",
          mode: "manual",
        };
        return normalizeFilterDefinition(
          {
            ...filter,
            key:
              !filter.key && columnName
                ? normalizeFilterParamName(columnName, `filtre_${index + 1}`)
                : filter.key,
            columnBinding: primaryBinding,
            columnBindings: bindings,
          },
          index,
        );
      },
    );
    this.saveFamilyLocal(fam);
    this.regenerateFamilyBeneficiarySql(famId, true);
    this.regenerateFamilySql(famId, true);
  }

  private async updateFamilyFilterSqlBuilderField(
    famId: string,
    filterId: string,
    field: string,
    value: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = await this.ensureSchemaMeta();
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) => {
        if (filter.id !== filterId) return filter;
        const sqlBuilder = normalizeFilterSqlBuilder(filter.sqlBuilder || {});
        (sqlBuilder as any)[field] = value || "";
        if (field === "tableName") {
          sqlBuilder.valueColumn = "";
          sqlBuilder.labelColumn = "";
        }
        const next = normalizeFilterDefinition(
          {
            ...filter,
            type: "select",
            sourceType: "sql",
            sqlBuilder,
            sqlQuery:
              this.buildDistinctFilterSqlQuery(sqlBuilder, schema) ||
              filter.sqlQuery ||
              "",
          },
          index,
        );
        return next;
      },
    );
    this.saveFamilyLocal(fam);
    this.regenerateFamilyBeneficiarySql(famId, true);
    this.regenerateFamilySql(famId, true);
  }

  private async regenerateFamilyFilterSqlQuery(
    famId: string,
    filterId: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = await this.ensureSchemaMeta();
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) => {
        if (filter.id !== filterId) return filter;
        const sqlBuilder = normalizeFilterSqlBuilder(filter.sqlBuilder || {});
        return normalizeFilterDefinition(
          {
            ...filter,
            type: "select",
            sourceType: "sql",
            sqlBuilder,
            sqlQuery: this.buildDistinctFilterSqlQuery(sqlBuilder, schema),
          },
          index,
        );
      },
    );
    this.saveFamilyLocal(fam);
    this.toast("Requête de filtre générée", "success");
    this.regenerateFamilyBeneficiarySql(famId, true);
    this.regenerateFamilySql(famId, true);
  }

  private updateFamilyFilterStaticOptions(
    famId: string,
    filterId: string,
    raw: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) =>
        filter.id === filterId
          ? normalizeFilterDefinition(
              {
                ...filter,
                staticOptionsText: raw,
              },
              index,
            )
          : filter,
    );
    this.saveFamilyLocal(fam);
    this.regenerateFamilyBeneficiarySql(famId, true);
    this.regenerateFamilySql(famId, true);
  }

  private toggleFamilyFilterRole(
    famId: string,
    filterId: string,
    role: string,
    checked: boolean,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) =>
        filter.id === filterId
          ? normalizeFilterDefinition(
              {
                ...filter,
                roles: {
                  ...(filter.roles || {}),
                  [role]: checked,
                },
              },
              index,
            )
          : filter,
    );
    this.saveFamilyLocal(fam);
  }

  private getFamilyFilterBindableTables(
    famId: string,
    fam: any,
    schema: any,
  ): string[] {
    const state = this.getBuilderState(famId, fam, schema);
    return [state.baseTable, ...(state.secondaryTables || [])].filter(
      (tableName: string, index: number, list: string[]) =>
        tableName && list.indexOf(tableName) === index,
    );
  }

  private getFilterBindingForTable(filter: any, tableName: string): any {
    const bindings = normalizeFilterColumnBindings(
      filter?.columnBindings || [],
      filter?.columnBinding || {},
    );
    return bindings.find((binding) => binding.tableName === tableName) || null;
  }

  private getBuilderState(famId: string, fam: any, schema: any): any {
    const visibleTables = this.getFamilyVisibleTables(schema, fam);
    if (!this.schemaBuilderState[famId]) {
      this.schemaBuilderState[famId] = {
        baseTable: this.inferBaseTable(fam, schema),
        selectedColumns: {},
        secondaryTables: [],
      };
    }
    const state = this.schemaBuilderState[famId];
    if (
      visibleTables.length &&
      !visibleTables.some((table: any) => table.name === state.baseTable)
    ) {
      state.baseTable = visibleTables[0].name;
    }
    const allowedTables = new Set(
      visibleTables.map((table: any) => table.name),
    );
    const existingSecondaryTables = (fam.classes || [])
      .flatMap((cls: any) => cls.vars || [])
      .map((item: any) => item?.sourceTable)
      .filter(
        (tableName: string) =>
          tableName &&
          tableName !== state.baseTable &&
          allowedTables.has(tableName),
      );
    state.secondaryTables = [
      ...new Set([
        ...(Array.isArray(state.secondaryTables) ? state.secondaryTables : []),
        ...existingSecondaryTables,
      ]),
    ].filter(
      (tableName: string) =>
        tableName &&
        tableName !== state.baseTable &&
        allowedTables.has(tableName),
    );
    return state;
  }

  private slugTech(value: string): string {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_");
  }

  private getSchemaColor(tableName: string): string {
    const palette = [
      "#6c63ff",
      "#48bb78",
      "#9f7aea",
      "#f6ad55",
      "#fc5c5c",
      "#63b3ed",
      "#4fd1c5",
      "#ed8936",
      "#f97316",
    ];
    const hash = String(tableName || "")
      .split("")
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[hash % palette.length];
  }

  private uniqueTech(fam: any, tech: string): string {
    const existing = new Set(
      (fam?.classes || [])
        .flatMap((c: any) => c?.vars || [])
        .map((v: any) => String(v?.tech || "").toLowerCase()),
    );
    if (!existing.has(String(tech).toLowerCase())) return tech;
    let i = 2;
    while (existing.has(`${tech}_${i}`.toLowerCase())) i += 1;
    return `${tech}_${i}`;
  }

  private getTableMeta(schema: any, tableName: string): any {
    return (
      schema?.tables?.find((table: any) => table?.name === tableName) || null
    );
  }

  private getRelationPath(
    schema: any,
    fromTable: string,
    toTable: string,
  ): any[] | null {
    if (!fromTable || !toTable) return null;
    if (fromTable === toTable) return [];
    const queue: string[] = [fromTable];
    const seen = new Set([fromTable]);
    const parent = new Map<string, any>();

    while (queue.length) {
      const current = queue.shift() as string;
      for (const rel of schema?.relations || []) {
        let next: string | null = null;
        if (rel.table === current) next = rel.referencedTable;
        else if (rel.referencedTable === current) next = rel.table;
        if (!next || seen.has(next)) continue;
        seen.add(next);
        parent.set(next, { prev: current, relation: rel });
        if (next === toTable) {
          const path: any[] = [];
          let cursor: string = toTable;
          while (cursor !== fromTable) {
            const step = parent.get(cursor);
            if (!step) return null;
            path.unshift({
              fromTable: step.prev,
              toTable: cursor,
              relation: step.relation,
            });
            cursor = step.prev;
          }
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  private buildRelationCondition(
    step: any,
    fromAlias: string,
    toAlias: string,
  ): string {
    const rel = step.relation;
    if (rel.table === step.fromTable && rel.referencedTable === step.toTable) {
      return `${fromAlias}.${this.sqlId(rel.column)} = ${toAlias}.${this.sqlId(rel.referencedColumn)}`;
    }
    if (rel.table === step.toTable && rel.referencedTable === step.fromTable) {
      return `${toAlias}.${this.sqlId(rel.column)} = ${fromAlias}.${this.sqlId(rel.referencedColumn)}`;
    }
    return "1=0";
  }

  private getConnectedTables(schema: any, anchorTable: string): string[] {
    if (!anchorTable) return [];
    const queue = [anchorTable];
    const seen = new Set([anchorTable]);
    while (queue.length) {
      const current = queue.shift() as string;
      for (const rel of schema?.relations || []) {
        const next =
          rel.table === current
            ? rel.referencedTable
            : rel.referencedTable === current
              ? rel.table
              : null;
        if (!next || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return [...seen];
  }

  private getJoinPlan(
    schema: any,
    baseTable: string,
    targetTable: string,
  ): any[] {
    if (targetTable === baseTable) return [];
    return this.getRelationPath(schema, baseTable, targetTable) || [];
  }

  private getFamilyVisibleTables(schema: any, fam: any): any[] {
    return this.getVisibleFamilySchemaTables(schema, [fam?.beneficiaryTable]);
  }

  private hasManualVarLink(
    schema: any,
    baseTable: string,
    varDef: any,
  ): boolean {
    if (!schema || !baseTable || !varDef?.sourceTable) return false;
    if (varDef.sourceTable === baseTable) return false;
    const baseColumns = this.getColumnsForTable(schema, baseTable);
    const sourceColumns = this.getColumnsForTable(schema, varDef.sourceTable);
    return (
      baseColumns.some(
        (column: any) => column.name === varDef.matchBaseColumn,
      ) &&
      sourceColumns.some(
        (column: any) => column.name === varDef.matchSourceColumn,
      )
    );
  }

  private getSuggestedVarLinkConfig(
    schema: any,
    baseTable: string,
    sourceTable: string,
  ): any {
    if (!schema || !baseTable || !sourceTable || baseTable === sourceTable)
      return {};
    if (this.getJoinPlan(schema, baseTable, sourceTable)?.length) {
      return { linkMode: "auto", matchBaseColumn: "", matchSourceColumn: "" };
    }
    const baseColumns = this.getColumnsForTable(schema, baseTable);
    const sourcePk = this.getPrimaryColumn(schema, sourceTable);
    const sourceName = String(sourceTable || "").toLowerCase();
    const guessedBaseColumn =
      baseColumns.find(
        (column: any) => String(column.name || "").toLowerCase() === sourceName,
      )?.name ||
      baseColumns.find(
        (column: any) =>
          String(column.name || "").toLowerCase() === `code${sourceName}`,
      )?.name ||
      baseColumns.find(
        (column: any) =>
          String(column.name || "").toLowerCase() === `${sourceName}code`,
      )?.name ||
      "";
    return {
      linkMode: "manual",
      matchBaseColumn: guessedBaseColumn,
      matchSourceColumn: sourcePk || "",
    };
  }

  private resolveVarSourceAccess(
    schema: any,
    baseTable: string,
    baseAlias: string,
    varDef: any,
  ): any {
    if (!schema || !baseTable || !varDef?.sourceTable) return null;
    if (varDef.sourceTable === baseTable) {
      return {
        alias: baseAlias,
        joins: [],
        tableAliases: { [baseTable]: baseAlias },
      };
    }
    const relPath = this.getJoinPlan(schema, baseTable, varDef.sourceTable);
    const canUseManual = this.hasManualVarLink(schema, baseTable, varDef);
    if (varDef.linkMode === "manual" && canUseManual) {
      const alias = "j1";
      return {
        alias,
        joins: [
          `LEFT JOIN ${this.sqlId(varDef.sourceTable)} ${alias} ON CONVERT(NVARCHAR(MAX), ${alias}.${this.sqlId(varDef.matchSourceColumn)}) = CONVERT(NVARCHAR(MAX), ${baseAlias}.${this.sqlId(varDef.matchBaseColumn)})`,
        ],
        tableAliases: {
          [baseTable]: baseAlias,
          [varDef.sourceTable]: alias,
        },
      };
    }
    if (relPath?.length) {
      const joins: string[] = [];
      let alias = baseAlias;
      let currentTable = baseTable;
      const tableAliases: Record<string, string> = { [baseTable]: baseAlias };
      relPath.forEach((step: any, index: number) => {
        const nextAlias = `j${index + 1}`;
        joins.push(
          `LEFT JOIN ${this.sqlId(step.toTable)} ${nextAlias} ON ${this.buildRelationCondition(
            {
              fromTable: currentTable,
              toTable: step.toTable,
              relation: step.relation,
            },
            alias,
            nextAlias,
          )}`,
        );
        alias = nextAlias;
        currentTable = step.toTable;
        tableAliases[currentTable] = alias;
      });
      return { alias, joins, tableAliases };
    }
    if (canUseManual) {
      const alias = "j1";
      return {
        alias,
        joins: [
          `LEFT JOIN ${this.sqlId(varDef.sourceTable)} ${alias} ON CONVERT(NVARCHAR(MAX), ${alias}.${this.sqlId(varDef.matchSourceColumn)}) = CONVERT(NVARCHAR(MAX), ${baseAlias}.${this.sqlId(varDef.matchBaseColumn)})`,
        ],
        tableAliases: {
          [baseTable]: baseAlias,
          [varDef.sourceTable]: alias,
        },
      };
    }
    return null;
  }

  private upsertGeneratedVar(
    famId: string,
    tableName: string,
    nextVar: any,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    this.ensureClassForTable(fam, this.schemaMetaCache, tableName);
    const cls = this.ensureClassForTable(fam, this.schemaMetaCache, tableName);
    const existingIndex = cls.vars.findIndex(
      (v: any) => v?.tech === nextVar.tech,
    );
    if (existingIndex >= 0) cls.vars[existingIndex] = nextVar;
    else cls.vars.push(nextVar);
    this.saveFamilyLocal(fam);
    this.renderFamilyEditor(famId);
    this.regenerateFamilySql(famId, true);
  }

  private ensureClassForTable(fam: any, schema: any, tableName: string): any {
    const tableMeta = this.getTableMeta(schema, tableName);
    const className = tableMeta?.comment || this.humanizeSchemaName(tableName);
    let cls = (fam.classes || []).find(
      (item: any) => item.sourceTable === tableName || item.nom === className,
    );
    if (!cls) {
      cls = {
        nom: className,
        couleur: this.getSchemaColor(tableName),
        vars: [],
        sourceTable: tableName,
      };
      fam.classes.push(cls);
    }
    cls.sourceTable = tableName;
    return cls;
  }

  private async renderSchemaAssistant(famId: string): Promise<void> {
    const wrap = document.getElementById("schemaBuilderWrap");
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="text-muted" style="padding:8px 0">Chargement du schéma SQL Server...</div>';
    try {
      const schema = await this.ensureSchemaMeta();
      const fam = this.getFamily(famId);
      if (!fam) return;
      const state = this.getBuilderState(famId, fam, schema);
      const baseTableOptions = this.getFamilyVisibleTables(schema, fam);
      const allVisibleTableNames = baseTableOptions.map(
        (table: any) => table.name,
      );
      const visibleTables = [
        state.baseTable,
        ...(state.secondaryTables || []),
      ].filter(
        (tableName: string, index: number, list: string[]) =>
          tableName &&
          allVisibleTableNames.includes(tableName) &&
          list.indexOf(tableName) === index,
      );
      const secondaryTableOptions = baseTableOptions.filter(
        (table: any) =>
          table.name !== state.baseTable && !visibleTables.includes(table.name),
      );
      const hiddenTables = this.hiddenFamilyTables;
      wrap.innerHTML = `
<div class="form-grid c3" style="margin-bottom:14px">
  <div class="form-row" style="margin:0">
    <label class="form-label">Table principale</label>
    <select class="form-input" onchange="setFamilyBaseTable('${this.escAttr(
      famId,
    )}', this.value)">
      ${baseTableOptions
        .map(
          (t: any) =>
            `<option value="${this.escAttr(t.name)}" ${t.name === state.baseTable ? "selected" : ""}>${this.escHtml(t.name)}${t.comment ? ` - ${this.escHtml(t.comment)}` : ""}</option>`,
        )
        .join("")}
    </select>
  </div>
  <div class="form-row" style="margin:0">
    <label class="form-label">Tables secondaires</label>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select class="form-input" id="schemaSecondaryTableSelect_${this.escAttr(
        famId,
      )}" style="min-width:220px;flex:1">
        <option value="">Ajouter une table secondaire</option>
        ${secondaryTableOptions
          .map(
            (table: any) =>
              `<option value="${this.escAttr(table.name)}">${this.escHtml(table.name)}${table.comment ? ` - ${this.escHtml(table.comment)}` : ""}</option>`,
          )
          .join("")}
      </select>
      <button class="btn sm" onclick="addSchemaSecondaryTable('${this.escAttr(
        famId,
      )}', document.getElementById('schemaSecondaryTableSelect_${this.escAttr(
        famId,
      )}').value)">Ajouter</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${
        (state.secondaryTables || []).length
          ? state.secondaryTables
              .map(
                (tableName: string) =>
                  `<span class="chip chip-teal">${this.escHtml(
                    tableName,
                  )} <button type="button" onclick="removeSchemaSecondaryTable('${this.escAttr(
                    famId,
                  )}','${this.escJs(tableName)}')" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 0 0 6px">×</button></span>`,
              )
              .join("")
          : `<span class="text-muted">Aucune table secondaire affichée</span>`
      }
    </div>
  </div>
  <div class="form-row" style="margin:0">
    <label class="form-label">Aide</label>
    <div class="text-muted" style="padding-top:9px">La table principale reste celle choisie ici. Les autres tables peuvent servir de sources secondaires, meme sans jointure automatique, via une correspondance manuelle. Tables masquees au superadmin : ${hiddenTables
      .map((name) => this.escHtml(name))
      .join(", ")}.</div>
  </div>
  <div class="form-row" style="margin:0">
    <label class="form-label">Actions</label>
    <div class="flex gap-8" style="padding-top:2px">
      <button class="btn sm" onclick="regenerateFamilySql('${this.escAttr(
        famId,
      )}', false, true)">Régénérer SELECT</button>
      <button class="btn sm" onclick="testFamilyQuery('${this.escAttr(
        famId,
      )}')">Tester id=1</button>
    </div>
  </div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px">
  ${visibleTables
    .map((tableName: string) => {
      const table = this.getTableMeta(schema, tableName);
      const relationPath = this.getJoinPlan(schema, state.baseTable, tableName);
      const columns = this.getColumnsForTable(schema, tableName);
      const relationLabel =
        tableName === state.baseTable
          ? "Base"
          : relationPath?.length
            ? "Join"
            : "Reference";
      const relationTone =
        tableName === state.baseTable
          ? "chip-purple"
          : relationPath?.length
            ? "chip-teal"
            : "chip";
      const relationSummary =
        tableName === state.baseTable
          ? "Table principale active"
          : relationPath?.length
            ? relationPath
                .map(
                  (step: any) =>
                    `${step.relation.table}.${step.relation.column} -> ${step.relation.referencedTable}.${step.relation.referencedColumn}`,
                )
                .join(" | ")
            : "Aucune jointure automatique detectee. Vous pouvez tout de meme ajouter des variables puis definir une correspondance manuelle.";
      return `<div style="border:1px solid var(--line);border-radius:16px;padding:14px;background:#fff">
        <div class="flex gap-8" style="align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;color:var(--text)">${this.escHtml(
              tableName,
            )}</div>
            <div class="text-muted">${this.escHtml(
              table?.comment || this.humanizeSchemaName(tableName),
            )}</div>
          </div>
          <span class="chip ${relationTone}">${relationLabel}</span>
        </div>
        <div class="text-muted" style="font-size:11px;margin-bottom:10px">${this.escHtml(
          relationSummary,
        )}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${columns
            .map((col: any) => {
              const key = `${tableName}.${col.name}`;
              return `<div style="border:1px solid #edf0f4;border-radius:12px;padding:10px 12px">
                <div class="flex gap-8" style="align-items:flex-start">
                  <div style="flex:1">
                    <div style="font-weight:600;color:var(--text)">${this.escHtml(
                      col.name,
                    )}</div>
                    <div class="text-muted">${this.escHtml(
                      col.comment || this.humanizeSchemaName(col.name),
                    )} · ${this.escHtml(col.type || "")}</div>
                  </div>
                  <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)">
                    <input type="checkbox" ${state.selectedColumns[key] ? "checked" : ""} onchange="toggleSchemaColumnSelection('${this.escAttr(
                      famId,
                    )}','${this.escJs(tableName)}','${this.escJs(col.name)}')">
                    Tableau
                  </label>
                </div>
                <div class="flex gap-8" style="margin-top:8px">
                  <button class="btn sm" onclick="addSchemaScalar('${this.escAttr(
                    famId,
                  )}','${this.escJs(tableName)}','${this.escJs(
                    col.name,
                  )}')">Simple</button>
                  <button class="btn sm" onclick="addSchemaList('${this.escAttr(
                    famId,
                  )}','${this.escJs(tableName)}','${this.escJs(
                    col.name,
                  )}')">Liste</button>
                </div>
              </div>`;
            })
            .join("")}
        </div>
        <div style="margin-top:10px">
          <button class="btn sm primary" onclick="addSchemaTableVar('${this.escAttr(
            famId,
          )}','${this.escJs(tableName)}')">Créer un tableau d'objets depuis les colonnes cochées</button>
        </div>
      </div>`;
    })
    .join("")}
</div>
<div style="margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fbfcfe">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Aperçu du test de requête</div>
  <pre id="schemaPreviewBox" style="margin:0;white-space:pre-wrap;font-size:11px;color:var(--text2)">Cliquez sur "Tester id=1" pour voir le premier enregistrement retourné.</pre>
</div>`;
    } catch (error: any) {
      wrap.innerHTML = `<div class="text-danger">${this.escHtml(error?.message || "Erreur")}</div>`;
    }
  }

  private async setFamilyBaseTable(
    famId: string,
    tableName: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = await this.ensureSchemaMeta();
    const state = this.getBuilderState(famId, fam, schema);
    state.baseTable = tableName;
    state.secondaryTables = (state.secondaryTables || []).filter(
      (name: string) => name && name !== tableName,
    );
    await this.renderSchemaAssistant(famId);
    this.regenerateFamilySql(famId, true);
  }

  private async addSchemaSecondaryTable(
    famId: string,
    tableName: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam || !tableName) return;
    const schema = await this.ensureSchemaMeta();
    const state = this.getBuilderState(famId, fam, schema);
    state.secondaryTables = [
      ...new Set([...(state.secondaryTables || []), tableName]),
    ].filter((name: string) => name && name !== state.baseTable);
    await this.renderSchemaAssistant(famId);
  }

  private async removeSchemaSecondaryTable(
    famId: string,
    tableName: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = await this.ensureSchemaMeta();
    const state = this.getBuilderState(famId, fam, schema);
    state.secondaryTables = (state.secondaryTables || []).filter(
      (name: string) => name && name !== tableName,
    );
    await this.renderSchemaAssistant(famId);
  }

  private async toggleSchemaColumnSelection(
    famId: string,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = await this.ensureSchemaMeta();
    const state = this.getBuilderState(famId, fam, schema);
    const key = `${tableName}.${columnName}`;
    state.selectedColumns[key] = !state.selectedColumns[key];
    await this.renderSchemaAssistant(famId);
  }

  private async addSchemaScalar(
    famId: string,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    const schema = await this.ensureSchemaMeta();
    const column = this.getColumnsForTable(schema, tableName).find(
      (item: any) => item.name === columnName,
    );
    if (!fam || !column) return;
    const baseTable = this.getBuilderState(famId, fam, schema).baseTable;
    const tech = this.uniqueTech(
      fam,
      this.slugTech(
        tableName === baseTable ? column.name : `${tableName}_${column.name}`,
      ),
    );
    this.upsertGeneratedVar(famId, tableName, {
      tech,
      label: column.comment || this.humanizeSchemaName(column.name),
      type: "scalar",
      sourceTable: tableName,
      sourceColumn: column.name,
      baseTable,
      ...this.getSuggestedVarLinkConfig(schema, baseTable, tableName),
    });
  }

  private async addSchemaList(
    famId: string,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    const schema = await this.ensureSchemaMeta();
    const column = this.getColumnsForTable(schema, tableName).find(
      (item: any) => item.name === columnName,
    );
    if (!fam || !column) return;
    const baseTable = this.getBuilderState(famId, fam, schema).baseTable;
    const tech = this.uniqueTech(
      fam,
      this.slugTech(`${tableName}_${column.name}_liste`),
    );
    this.upsertGeneratedVar(famId, tableName, {
      tech,
      label: `${column.comment || this.humanizeSchemaName(column.name)} (liste)`,
      type: "list",
      sourceTable: tableName,
      sourceColumn: column.name,
      baseTable,
      ...this.getSuggestedVarLinkConfig(schema, baseTable, tableName),
    });
  }

  private async addSchemaTableVar(
    famId: string,
    tableName: string,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = await this.ensureSchemaMeta();
    const state = this.getBuilderState(famId, fam, schema);
    const selected = Object.entries(state.selectedColumns)
      .filter(
        ([key, checked]: [string, any]) =>
          checked && key.startsWith(`${tableName}.`),
      )
      .map(([key]) => key.split(".")[1]);
    if (!selected.length) {
      this.toast("Cochez au moins une colonne pour créer le tableau", "error");
      return;
    }
    const cols = this.getColumnsForTable(schema, tableName).filter((col: any) =>
      selected.includes(col.name),
    );
    const tech = this.uniqueTech(fam, this.slugTech(`${tableName}_table`));
    const nextVar: any = {
      tech,
      label: `${this.getTableMeta(schema, tableName)?.comment || this.humanizeSchemaName(tableName)} (tableau)`,
      type: "list-object",
      sourceTable: tableName,
      baseTable: state.baseTable,
      sourceColumns: cols.map((col: any) => ({
        column: col.name,
        key: this.slugTech(col.name),
        label: col.comment || this.humanizeSchemaName(col.name),
      })),
      columns: cols.map((col: any) => ({
        key: this.slugTech(col.name),
        label: col.comment || this.humanizeSchemaName(col.name),
      })),
    };
    if (state.baseTable && tableName !== state.baseTable) {
      nextVar.sqlQuery = this.buildDefaultListObjectSqlQuery(famId, nextVar);
      nextVar.customSqlQuery = false;
    }
    this.upsertGeneratedVar(famId, tableName, nextVar);
  }

  private async testFamilyQuery(famId: string): Promise<void> {
    const fam = this.getFamily(famId);
    const box = document.getElementById("schemaPreviewBox");
    if (!fam?.sql || !box) return;
    box.textContent = "Test en cours...";
    try {
      const rows = await this.runSelect(fam.sql, {
        id: 1,
        personId: 1,
        beneficiaryId: 1,
        etablissementId: 1,
        etabId: 1,
      });
      box.textContent = JSON.stringify(rows[0] || {}, null, 2);
    } catch (error: any) {
      box.textContent = error?.message || "Erreur";
    }
  }

  private renderClassesContainer(famId: string): void {
    const fam = this.getFamily(famId);
    const container = document.getElementById("classesContainer");
    if (!container || !fam) return;
    container.innerHTML = "";
    (fam.classes || []).forEach((cls: any, ci: number) => {
      const block = document.createElement("div");
      block.className = "class-block";
      block.innerHTML = `
<div class="class-block-header">
  <div class="class-color-dot" style="background:${cls.couleur}"></div>
  <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px">
    <label class="form-label" style="font-size:10px;margin:0">Libellé de classe affiché à l'admin</label>
    <input class="class-name-input" value="${this.escAttr(cls.nom)}" placeholder="Libellé affiché" onchange="updateClassProp('${this.escAttr(
      famId,
    )}',${ci},'nom',this.value)">
    ${cls.sourceTable ? `<div class="text-muted" style="font-size:10px">Table SQL: ${this.escHtml(cls.sourceTable)}</div>` : ""}
  </div>
  <select class="color-select" onchange="updateClassProp('${this.escAttr(
    famId,
  )}',${ci},'couleur',this.value)">
    ${[
      "#6c63ff",
      "#48bb78",
      "#9f7aea",
      "#f6ad55",
      "#fc5c5c",
      "#63b3ed",
      "#4fd1c5",
      "#ed8936",
      "#f97316",
    ]
      .map(
        (c) =>
          `<option value="${c}" ${cls.couleur === c ? "selected" : ""}>${c}</option>`,
      )
      .join("")}
  </select>
  <button class="del-cls-btn" onclick="deleteClassBlock('${this.escAttr(
    famId,
  )}',${ci})">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
  </button>
</div>

<div class="vars-area" id="vars_${ci}">
  ${(cls.vars || [])
    .map((v: any, vi: number) =>
      this.renderVarPill(v, vi, ci, famId, cls.couleur),
    )
    .join("")}
</div>

<div class="var-add-row">
  <input class="var-input-sm" id="vt_${ci}" placeholder="tech_variable">
  <input class="var-input-sm label" id="vl_${ci}" placeholder="Libellé">
  <select class="type-select" id="vtype_${ci}" onchange="onVarTypeChange(${ci})">
    <option value="scalar">Simple</option>
    <option value="list">Liste</option>
    <option value="list-object">Tableau</option>
  </select>
  <button class="btn sm" type="button" onclick="addVar('${this.escAttr(
    famId,
  )}',${ci})">Ajouter</button>
</div>
<div class="cols-area" id="cols_area_${ci}">
  <div class="cols-area-label">Colonnes du tableau</div>
  <div id="cols_pills_${ci}"></div>
</div>
<div class="col-add-row" id="col_add_${ci}">
  <input class="var-input-sm" id="ck_${ci}" placeholder="cle_technique">
  <input class="var-input-sm label" id="cl_${ci}" placeholder="Libellé">
  <button class="btn sm" type="button" onclick="addTempCol(${ci})">Ajouter colonne</button>
</div>

<div style="margin-top:10px;padding:10px 12px;border:1px dashed var(--line);border-radius:12px;background:#fafbfd;font-size:11px;color:var(--text2)">
  Variables pilotées par le schéma SQL Server. Utilisez l'assistant ci-dessus pour ajouter des champs, listes et tableaux d'objets.
</div>

</div>`;
      container.appendChild(block);
      this.onVarTypeChange(ci);
    });
  }

  private renderVarPill(
    v: any,
    vi: number,
    ci: number,
    famId: string,
    couleur: string,
  ): string {
    const isObj = v.type === "list-object";
    const isList = v.type === "list";
    const typeTag = isObj
      ? '<span class="var-pill-type obj">TABLE</span>'
      : isList
        ? '<span class="var-pill-type">LIST</span>'
        : "";
    const sqlTag =
      isObj && String(v.sqlQuery || "").trim()
        ? '<span class="var-pill-type" style="background:#dbeafe;color:#1d4ed8">SQL</span>'
        : "";
    const customSqlTag =
      isObj && v.customSqlQuery
        ? '<span class="var-pill-type" style="background:#fef3c7;color:#92400e">SQL personnalisé</span>'
        : "";
    const cols =
      isObj && v.columns && v.columns.length
        ? `<span style="font-size:9px;color:${couleur};opacity:.7;margin-left:3px">[${v.columns
            .map((c: any) => c.key)
            .join(",")}]</span>`
        : "";
    const pillMarkup = `<div class="var-pill" style="background:${couleur}15;border-color:${couleur}40;color:${couleur}">
          <span class="var-pill-tech">{{${isObj ? "#" : isList ? "#" : ""}${this.escHtml(
            v.tech,
          )}${isObj ? ":table" : ""}}}</span>
          <span class="var-pill-label">→ ${this.escHtml(v.label || v.tech || "")}</span>
          ${typeTag}${sqlTag}${customSqlTag}${cols}
          <button class="var-pill-del" onclick="deleteVar('${this.escAttr(
            famId,
          )}',${ci},${vi})">×</button>
        </div>`;
    const labelEditor = `<label class="form-label" style="font-size:10px;color:var(--text2);margin:0">
          Nom affiché
          <input class="form-input" value="${this.escAttr(
            v.label || v.tech || "",
          )}" onchange="updateVarLabel('${this.escAttr(
            famId,
          )}',${ci},${vi},this.value)" style="display:block;width:100%;margin-top:4px" placeholder="Nom affiché">
        </label>`;
    if (!isObj) {
      const bindingEditor = this.renderSimpleVarBindingEditor(
        v,
        vi,
        ci,
        famId,
        couleur,
      );
      const listLookupEditor = this.renderListVarLookupEditor(
        v,
        vi,
        ci,
        famId,
        couleur,
      );
      return bindingEditor || listLookupEditor
        ? `<div style="display:flex;flex-direction:column;gap:6px;max-width:100%">${pillMarkup}${labelEditor}${bindingEditor}${listLookupEditor}</div>`
        : `<div style="display:flex;flex-direction:column;gap:6px;max-width:100%">${pillMarkup}${labelEditor}</div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:6px;max-width:100%;padding:8px 10px;border:1px dashed ${couleur}35;border-radius:12px;background:${couleur}08">
          ${pillMarkup}
          ${labelEditor}
          ${this.renderListObjectSqlEditor(v, vi, ci, famId, couleur)}
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${couleur};opacity:.9">Colonnes et affichage</div>
          ${this.renderVarColumnEditor(v, vi, ci, famId, couleur)}
        </div>`;
  }

  private getListObjectDisplayColumns(varDef: any): any[] {
    if (Array.isArray(varDef?.columns) && varDef.columns.length) {
      return varDef.columns;
    }
    if (Array.isArray(varDef?.sourceColumns)) {
      return varDef.sourceColumns.map((col: any) => ({
        key: col.key || this.slugTech(col.column),
        label: col.label || this.humanizeSchemaName(col.column),
      }));
    }
    return [];
  }

  private buildLookupTableOptions(selectedTable: string): string {
    const activeSchema = this.schemaMetaCache;
    if (!activeSchema) return "";
    return this.getVisibleFamilySchemaTables(
      activeSchema,
      selectedTable ? [selectedTable] : [],
    )
      .map(
        (table: any) =>
          `<option value="${this.escAttr(table.name)}" ${
            table.name === selectedTable ? "selected" : ""
          }>${this.escHtml(
            table.comment || this.humanizeSchemaName(table.name),
          )}</option>`,
      )
      .join("");
  }

  private buildLookupColumnOptions(
    tableName: string,
    selectedColumn: string,
  ): string {
    const activeSchema = this.schemaMetaCache;
    if (!activeSchema || !tableName) return "";
    return this.getColumnsForTable(activeSchema, tableName)
      .map(
        (column: any) =>
          `<option value="${this.escAttr(column.name)}" ${
            column.name === selectedColumn ? "selected" : ""
          }>${this.escHtml(
            column.comment || this.humanizeSchemaName(column.name),
          )}</option>`,
      )
      .join("");
  }

  private getAvailableVarSourceColumns(varDef: any): any[] {
    if (!this.schemaMetaCache || !varDef?.sourceTable) return [];
    const selected = new Set(
      (Array.isArray(varDef.sourceColumns) ? varDef.sourceColumns : [])
        .map((col: any) => String(col?.column || "").trim())
        .filter(Boolean),
    );
    return this.getColumnsForTable(
      this.schemaMetaCache,
      varDef.sourceTable,
    ).filter((column: any) => !selected.has(column.name));
  }

  private getLookupEditorMode(config: any = {}): string {
    return String(config?.lookupEditorMode || "").trim() === "manual"
      ? "manual"
      : "schema";
  }

  private renderLookupSourceModeSwitch(
    mode: string,
    onChangeHandler: string,
    args: any[] = [],
    disabled = false,
  ): string {
    const serializedArgs = args
      .map((arg) => {
        if (typeof arg === "number") return String(arg);
        return `'${this.escJs(String(arg ?? ""))}'`;
      })
      .join(",");
    return `<label class="form-label" style="font-size:10px;color:var(--text2)">
          Source des noms
          <select class="form-input" ${disabled ? "disabled" : ""} onchange="${onChangeHandler}(${serializedArgs},this.value)" style="display:block;width:100%;margin-top:4px">
            <option value="schema" ${mode !== "manual" ? "selected" : ""}>Schéma détecté</option>
            <option value="manual" ${mode === "manual" ? "selected" : ""}>Saisie manuelle</option>
          </select>
        </label>`;
  }

  private renderLookupTableField(
    mode: string,
    value: string,
    onChangeHandler: string,
    args: any[] = [],
  ): string {
    const serializedArgs = args
      .map((arg) => {
        if (typeof arg === "number") return String(arg);
        return `'${this.escJs(String(arg ?? ""))}'`;
      })
      .join(",");
    if (mode === "manual") {
      return `<label class="form-label" style="font-size:10px;color:var(--text2)">
            Table libellé
            <input class="form-input" value="${this.escAttr(
              value || "",
            )}" onchange="${onChangeHandler}(${serializedArgs},this.value)" style="display:block;width:100%;margin-top:4px" placeholder="Ex: Grade">
          </label>`;
    }
    return `<label class="form-label" style="font-size:10px;color:var(--text2)">
          Table libellé
          <select class="form-input" onchange="${onChangeHandler}(${serializedArgs},this.value)" style="display:block;width:100%;margin-top:4px">
            <option value="">Choisir une table</option>
            ${this.buildLookupTableOptions(value)}
          </select>
        </label>`;
  }

  private renderLookupColumnField(
    label: string,
    mode: string,
    tableName: string,
    value: string,
    onChangeHandler: string,
    args: any[] = [],
  ): string {
    const serializedArgs = args
      .map((arg) => {
        if (typeof arg === "number") return String(arg);
        return `'${this.escJs(String(arg ?? ""))}'`;
      })
      .join(",");
    if (mode === "manual") {
      return `<label class="form-label" style="font-size:10px;color:var(--text2)">
            ${this.escHtml(label)}
            <input class="form-input" value="${this.escAttr(
              value || "",
            )}" onchange="${onChangeHandler}(${serializedArgs},this.value)" style="display:block;width:100%;margin-top:4px" placeholder="Ex: CodeUnivad">
          </label>`;
    }
    return `<label class="form-label" style="font-size:10px;color:var(--text2)">
          ${this.escHtml(label)}
          <select class="form-input" onchange="${onChangeHandler}(${serializedArgs},this.value)" style="display:block;width:100%;margin-top:4px">
            <option value="">Choisir une colonne</option>
            ${this.buildLookupColumnOptions(tableName, value)}
          </select>
        </label>`;
  }

  private renderVarColumnEditor(
    v: any,
    vi: number,
    ci: number,
    famId: string,
    couleur: string,
  ): string {
    const orderedCols = this.getListObjectDisplayColumns(v);
    const addEditor = this.renderAddVarColumnEditor(v, vi, ci, famId, couleur);
    if (!orderedCols.length) {
      return `<div style="display:flex;flex-direction:column;gap:8px">
            <div style="font-size:10px;color:${couleur};opacity:.8">Aucune colonne définie</div>
            ${addEditor}
          </div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px">
            ${orderedCols
              .map((col: any, colIndex: number) => {
                const sourceMeta = Array.isArray(v.sourceColumns)
                  ? v.sourceColumns[colIndex] || null
                  : null;
                const displayMode =
                  sourceMeta?.displayMode === "lookup" ? "lookup" : "raw";
                const lookupTable = sourceMeta?.lookupTable || "";
                const lookupValueColumn = sourceMeta?.lookupValueColumn || "";
                const lookupLabelColumn = sourceMeta?.lookupLabelColumn || "";
                const lookupEditorMode = this.getLookupEditorMode(sourceMeta);
                const hasSqlSource = !!sourceMeta?.column;
                const sourceLabel = hasSqlSource
                  ? `Source SQL : ${sourceMeta.column}`
                  : "Colonne libre sans source SQL liée";
                return `
                <div style="display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid ${couleur}35;border-radius:10px;background:#fff">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
                    <div>
                      <div style="font-size:12px;font-weight:700;color:var(--text)">${this.escHtml(
                        col.label || col.key,
                      )}</div>
                      <div style="font-size:10px;color:var(--text3)">${this.escHtml(
                        col.key || "",
                      )}</div>
                      <div style="font-size:10px;color:${couleur};margin-top:2px">${this.escHtml(
                        sourceLabel,
                      )}</div>
                    </div>
                    <div style="display:flex;gap:4px">
                      <button class="col-pill-btn" type="button" title="Monter" onclick="moveVarColumn('${this.escAttr(
                        famId,
                      )}',${ci},${vi},${colIndex},-1)" ${
                        colIndex === 0 ? "disabled" : ""
                      }>&uarr;</button>
                      <button class="col-pill-btn" type="button" title="Descendre" onclick="moveVarColumn('${this.escAttr(
                        famId,
                      )}',${ci},${vi},${colIndex},1)" ${
                        colIndex === orderedCols.length - 1 ? "disabled" : ""
                      }>&darr;</button>
                      <button class="col-pill-del" type="button" title="Supprimer" onclick="removeVarColumn('${this.escAttr(
                        famId,
                      )}',${ci},${vi},${colIndex})">×</button>
                    </div>
                  </div>
                  ${
                    hasSqlSource
                      ? `<label class="form-label" style="font-size:10px;color:var(--text2)">
                          Affichage
                          <select class="form-input" onchange="updateVarColumnLookupField('${this.escAttr(
                            famId,
                          )}',${ci},${vi},${colIndex},'displayMode',this.value)" style="display:block;width:100%;margin-top:4px">
                            <option value="raw" ${
                              displayMode !== "lookup" ? "selected" : ""
                            }>Valeur source</option>
                            <option value="lookup" ${
                              displayMode === "lookup" ? "selected" : ""
                            }>Libellé depuis une table</option>
                          </select>
                        </label>
                        ${
                          displayMode === "lookup"
                            ? `${this.renderLookupSourceModeSwitch(lookupEditorMode, "updateVarColumnLookupMode", [famId, ci, vi, colIndex])}
                              ${this.renderLookupTableField(lookupEditorMode, lookupTable, "updateVarColumnLookupField", [famId, ci, vi, colIndex, "lookupTable"])}
                              ${this.renderLookupColumnField("Colonne code", lookupEditorMode, lookupTable, lookupValueColumn, "updateVarColumnLookupField", [famId, ci, vi, colIndex, "lookupValueColumn"])}
                              ${this.renderLookupColumnField("Colonne libellé", lookupEditorMode, lookupTable, lookupLabelColumn, "updateVarColumnLookupField", [famId, ci, vi, colIndex, "lookupLabelColumn"])}
                              <div style="font-size:10px;color:var(--text3)">Vous pouvez choisir dans le schéma ou saisir manuellement les noms SQL.</div>`
                            : ""
                        }`
                      : ""
                  }
                </div>`;
              })
              .join("")}
          </div>
          ${addEditor}
        </div>`;
  }

  private renderAddVarColumnEditor(
    v: any,
    vi: number,
    ci: number,
    famId: string,
    couleur: string,
  ): string {
    if (v?.type !== "list-object") return "";
    const addMode =
      String(v?.addColumnMode || "").trim() === "manual" ? "manual" : "schema";
    const availableColumns = this.getAvailableVarSourceColumns(v);
    const sourceId = `var_col_source_${ci}_${vi}`;
    const keyId = `var_col_key_${ci}_${vi}`;
    const labelId = `var_col_label_${ci}_${vi}`;
    return `<div style="padding:10px;border:1px dashed ${couleur}35;border-radius:12px;background:#fff">
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${couleur};opacity:.9;margin-bottom:8px">Ajouter une colonne</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">
            <label class="form-label" style="font-size:10px;color:var(--text2)">
              Source
              <select class="form-input" onchange="updateVarAddColumnMode('${this.escAttr(
                famId,
              )}',${ci},${vi},this.value)" style="display:block;width:100%;margin-top:4px">
                <option value="schema" ${addMode !== "manual" ? "selected" : ""}>Colonne du schéma</option>
                <option value="manual" ${addMode === "manual" ? "selected" : ""}>Saisie manuelle</option>
              </select>
            </label>
            ${
              addMode === "manual"
                ? `<label class="form-label" style="font-size:10px;color:var(--text2)">
                    Colonne source
                    <input id="${sourceId}" class="form-input" style="display:block;width:100%;margin-top:4px" placeholder="Ex: Grade">
                  </label>`
                : `<label class="form-label" style="font-size:10px;color:var(--text2)">
                    Colonne source
                    <select id="${sourceId}" class="form-input" style="display:block;width:100%;margin-top:4px">
                      <option value="">Choisir une colonne</option>
                      ${availableColumns
                        .map(
                          (column: any) =>
                            `<option value="${this.escAttr(column.name)}">${this.escHtml(
                              column.comment ||
                                this.humanizeSchemaName(column.name),
                            )}</option>`,
                        )
                        .join("")}
                    </select>
                  </label>`
            }
            <label class="form-label" style="font-size:10px;color:var(--text2)">
              Clé technique
              <input id="${keyId}" class="form-input" style="display:block;width:100%;margin-top:4px" placeholder="Ex: grade">
            </label>
            <label class="form-label" style="font-size:10px;color:var(--text2)">
              Libellé
              <input id="${labelId}" class="form-input" style="display:block;width:100%;margin-top:4px" placeholder="Ex: Grade">
            </label>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">
            <div style="font-size:10px;color:var(--text3)">
              ${
                addMode === "manual"
                  ? "Ajoutez une colonne même si elle n'a pas été détectée dans le schéma."
                  : availableColumns.length
                    ? "Ajoutez de nouvelles colonnes sans recréer le tableau."
                    : "Toutes les colonnes détectées sont déjà utilisées. Passez en saisie manuelle si besoin."
              }
            </div>
            <button class="btn sm" type="button" onclick="addVarColumn('${this.escAttr(
              famId,
            )}',${ci},${vi})">Ajouter la colonne</button>
          </div>
        </div>`;
  }

  private renderListObjectSqlEditor(
    v: any,
    vi: number,
    ci: number,
    famId: string,
    couleur: string,
  ): string {
    if (v?.type !== "list-object") return "";
    const sqlQuery = String(v.sqlQuery || "").trim();
    return `<div style="margin-top:6px;padding:10px;border:1px dashed ${couleur}35;border-radius:12px;background:${couleur}08">
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${couleur};opacity:.9;margin-bottom:8px">Requête SQL tableau</div>
          <div style="font-size:10px;color:var(--text2);margin-bottom:8px">Utilisez une requête <strong>SELECT</strong> qui retourne plusieurs lignes, par exemple avec <strong>GROUP BY</strong>, <strong>SUM</strong>, <strong>COUNT</strong> ou <strong>HAVING</strong>. Le résultat sera injecté comme tableau JSON dans <code>{{#${this.escHtml(
            v.tech,
          )}:table}}</code>.</div>
          <textarea class="sql-input" rows="8" style="min-height:150px" onchange="updateListObjectSqlQuery('${this.escAttr(
            famId,
          )}',${ci},${vi},this.value)" placeholder="SELECT idEnseignant, idModule, Groupe, COUNT(*) AS nb, SUM(NbSemainesPeriode) AS total_volume FROM ChargeDetailleeModule GROUP BY idEnseignant, idModule, Groupe HAVING COUNT(*) &gt; 1">${this.escHtml(
            sqlQuery,
          )}</textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <button class="btn sm" type="button" onclick="generateListObjectSqlQueryFromSource('${this.escAttr(
              famId,
            )}',${ci},${vi})">Générer depuis la liaison</button>
            <button class="btn sm" type="button" onclick="applySuggestedFiltersToListObjectSql('${this.escAttr(
              famId,
            )}',${ci},${vi})">Ajouter les filtres applicables</button>
            <button class="btn sm" type="button" onclick="testListObjectSqlQuery('${this.escAttr(
              famId,
            )}',${ci},${vi})">Tester la requête</button>
            <button class="btn sm" type="button" onclick="clearListObjectSqlQuery('${this.escAttr(
              famId,
            )}',${ci},${vi})">Revenir au mode colonnes liées</button>
          </div>
          <pre id="listObjectSqlPreview_${ci}_${vi}" style="margin:10px 0 0;white-space:pre-wrap;font-size:11px;color:var(--text2)">${
            sqlQuery
              ? 'Cliquez sur "Tester la requête" pour voir les premières lignes.'
              : "Aucune requête SQL dédiée. La variable utilise le mode lié au schéma."
          }</pre>
        </div>`;
  }

  private renderListVarLookupEditor(
    v: any,
    vi: number,
    ci: number,
    famId: string,
    couleur: string,
  ): string {
    if (v?.type !== "list" || !v?.sourceColumn) return "";
    const displayMode = v.displayMode === "lookup" ? "lookup" : "raw";
    const lookupTable = v.lookupTable || "";
    const lookupValueColumn = v.lookupValueColumn || "";
    const lookupLabelColumn = v.lookupLabelColumn || "";
    const lookupEditorMode = this.getLookupEditorMode(v);
    return `<div style="margin-top:6px;padding:10px;border:1px dashed ${couleur}35;border-radius:12px;background:${couleur}08">
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${couleur};opacity:.9;margin-bottom:8px">Affichage de la liste</div>
          <div style="font-size:10px;color:${couleur};margin-bottom:8px">${this.escHtml(
            `Source SQL : ${v.sourceColumn}`,
          )}</div>
          <label class="form-label" style="font-size:10px;color:var(--text2)">
            Affichage
            <select class="form-input" onchange="updateListVarLookupField('${this.escAttr(
              famId,
            )}',${ci},${vi},'displayMode',this.value)" style="display:block;width:100%;margin-top:4px">
              <option value="raw" ${displayMode !== "lookup" ? "selected" : ""}>Valeur source</option>
              <option value="lookup" ${displayMode === "lookup" ? "selected" : ""}>Libellé depuis une table</option>
            </select>
          </label>
          ${
            displayMode === "lookup"
              ? `${this.renderLookupSourceModeSwitch(lookupEditorMode, "updateListVarLookupMode", [famId, ci, vi])}
                ${this.renderLookupTableField(lookupEditorMode, lookupTable, "updateListVarLookupField", [famId, ci, vi, "lookupTable"])}
                ${this.renderLookupColumnField("Colonne code", lookupEditorMode, lookupTable, lookupValueColumn, "updateListVarLookupField", [famId, ci, vi, "lookupValueColumn"])}
                ${this.renderLookupColumnField("Colonne libellé", lookupEditorMode, lookupTable, lookupLabelColumn, "updateListVarLookupField", [famId, ci, vi, "lookupLabelColumn"])}
                <div style="font-size:10px;color:var(--text3)">Vous pouvez choisir dans le schéma ou saisir manuellement les noms SQL.</div>`
              : ""
          }
        </div>`;
  }

  private renderSimpleVarBindingEditor(
    v: any,
    vi: number,
    ci: number,
    famId: string,
    couleur: string,
  ): string {
    if (!this.schemaMetaCache || !v?.sourceTable) return "";
    const fam = this.getFamily(famId);
    if (!fam) return "";
    const baseTable =
      this.getBuilderState(famId, fam, this.schemaMetaCache).baseTable ||
      v.baseTable ||
      "";
    if (!baseTable || v.sourceTable === baseTable) return "";
    const relPath = this.getJoinPlan(
      this.schemaMetaCache,
      baseTable,
      v.sourceTable,
    );
    const baseColumns = this.getColumnsForTable(
      this.schemaMetaCache,
      baseTable,
    );
    const sourceColumns = this.getColumnsForTable(
      this.schemaMetaCache,
      v.sourceTable,
    );
    const canAuto = !!relPath?.length;
    const canManual = this.hasManualVarLink(this.schemaMetaCache, baseTable, v);
    const mode =
      v.linkMode === "manual" ||
      (!canAuto && (v.matchBaseColumn || v.matchSourceColumn))
        ? "manual"
        : "auto";
    const relationInfo = canAuto
      ? relPath
          .map(
            (step: any) =>
              `${step.relation.table}.${step.relation.column} -> ${step.relation.referencedTable}.${step.relation.referencedColumn}`,
          )
          .join(" | ")
      : "Aucune jointure detectee dans le schema";
    return `<div style="margin-top:6px;padding:10px;border:1px dashed ${couleur}35;border-radius:12px;background:${couleur}08">
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${couleur};opacity:.9;margin-bottom:8px">Liaison de la variable</div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:8px">${this.escHtml(
            relationInfo,
          )}</div>
          <label class="form-label" style="font-size:10px;color:var(--text2)">
            Mode
            <select class="form-input" onchange="updateVarLinkField('${this.escAttr(
              famId,
            )}',${ci},${vi},'linkMode',this.value)" style="display:block;width:100%;margin-top:4px">
              <option value="auto" ${mode !== "manual" ? "selected" : ""}>Jointure automatique</option>
              <option value="manual" ${mode === "manual" ? "selected" : ""}>Correspondance manuelle</option>
            </select>
          </label>
          ${
            mode === "manual"
              ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
                  <label class="form-label" style="font-size:10px;color:var(--text2)">
                    Colonne table principale
                    <select class="form-input" onchange="updateVarLinkField('${this.escAttr(
                      famId,
                    )}',${ci},${vi},'matchBaseColumn',this.value)" style="display:block;width:100%;margin-top:4px">
                      <option value="">Choisir une colonne</option>
                      ${baseColumns
                        .map(
                          (column: any) =>
                            `<option value="${this.escAttr(column.name)}" ${
                              column.name === (v.matchBaseColumn || "")
                                ? "selected"
                                : ""
                            }>${this.escHtml(
                              column.comment ||
                                this.humanizeSchemaName(column.name),
                            )}</option>`,
                        )
                        .join("")}
                    </select>
                  </label>
                  <label class="form-label" style="font-size:10px;color:var(--text2)">
                    Colonne table secondaire
                    <select class="form-input" onchange="updateVarLinkField('${this.escAttr(
                      famId,
                    )}',${ci},${vi},'matchSourceColumn',this.value)" style="display:block;width:100%;margin-top:4px">
                      <option value="">Choisir une colonne</option>
                      ${sourceColumns
                        .map(
                          (column: any) =>
                            `<option value="${this.escAttr(column.name)}" ${
                              column.name === (v.matchSourceColumn || "")
                                ? "selected"
                                : ""
                            }>${this.escHtml(
                              column.comment ||
                                this.humanizeSchemaName(column.name),
                            )}</option>`,
                        )
                        .join("")}
                    </select>
                  </label>
                </div>
                <div style="font-size:10px;color:var(--text3);margin-top:8px">${
                  canManual
                    ? "Correspondance valide"
                    : "Choisissez la colonne code de la table principale et la colonne code de la table secondaire"
                }</div>`
              : `<div style="font-size:10px;color:var(--text3);margin-top:8px">${
                  canAuto
                    ? "La jointure automatique sera utilisee pour cette variable."
                    : "Aucune jointure detectee. Passez en correspondance manuelle."
                }</div>`
          }
        </div>`;
  }

  private async runSelect(
    sql: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    const payload = await firstValueFrom(
      this.api.post<any>("query", {
        sql,
        params,
      }),
    );
    return payload?.rows || [];
  }

  private buildDefaultListObjectSqlQuery(famId: string, varDef: any): string {
    const fam = this.getFamily(famId);
    if (
      !fam ||
      !this.schemaMetaCache ||
      !varDef?.sourceTable ||
      varDef.type !== "list-object"
    ) {
      return "";
    }
    if (fam.beneficiaryMode === "organization") return "";

    const builder = this.getBuilderState(famId, fam, this.schemaMetaCache);
    const baseTable =
      builder.baseTable ||
      varDef.baseTable ||
      this.inferBaseTable(fam, this.schemaMetaCache);
    if (!baseTable) return "";

    const baseAlias = "b";
    const suggestedLink =
      baseTable && varDef?.sourceTable
        ? this.getSuggestedVarLinkConfig(
            this.schemaMetaCache,
            baseTable,
            varDef.sourceTable,
          )
        : {};
    const effectiveVarDef = {
      ...varDef,
      linkMode: String(varDef?.linkMode || "").trim()
        ? varDef.linkMode
        : suggestedLink.linkMode || "",
      matchBaseColumn: String(varDef?.matchBaseColumn || "").trim()
        ? varDef.matchBaseColumn
        : suggestedLink.matchBaseColumn || "",
      matchSourceColumn: String(varDef?.matchSourceColumn || "").trim()
        ? varDef.matchSourceColumn
        : suggestedLink.matchSourceColumn || "",
    };
    const sourceAccess = this.resolveVarSourceAccess(
      this.schemaMetaCache,
      baseTable,
      baseAlias,
      effectiveVarDef,
    );
    const sourceTableColumns = this.getColumnsForTable(
      this.schemaMetaCache,
      effectiveVarDef.sourceTable,
    );
    const sourceColumnBySlug = new Map(
      sourceTableColumns.map((tableCol: any) => [
        this.slugTech(tableCol.name),
        tableCol,
      ]),
    );
    const effectiveColumns = (
      Array.isArray(varDef.sourceColumns) && varDef.sourceColumns.length
        ? varDef.sourceColumns
        : Array.isArray(varDef.columns)
          ? varDef.columns.map((col: any) => ({
              column:
                sourceTableColumns.find(
                  (tableCol: any) =>
                    tableCol.name === col.key ||
                    this.slugTech(tableCol.name) === this.slugTech(col.key),
                )?.name || col.key,
              key: col.key,
              label: col.label,
            }))
          : []
    )
      .map((col: any) => {
        const sourceColumn = String(col?.column || "").trim();
        const key = String(col?.key || sourceColumn).trim();
        return sourceColumn && key
          ? { ...col, column: sourceColumn, key }
          : null;
      })
      .filter(Boolean);
    const validColumns = effectiveColumns.filter((col: any) =>
      sourceTableColumns.some((tableCol: any) => tableCol.name === col.column),
    );
    if (!validColumns.length) {
      const fallbackColumns = (
        Array.isArray(varDef.columns) ? varDef.columns : []
      )
        .map((col: any) => {
          const key = String(col?.key || "").trim();
          if (!key) return null;
          const matched = sourceColumnBySlug.get(this.slugTech(key));
          if (!matched) return null;
          return {
            column: matched.name,
            key,
            label:
              col.label ||
              matched.comment ||
              this.humanizeSchemaName(matched.name),
          };
        })
        .filter(Boolean);
      if (!fallbackColumns.length) return "";
      fallbackColumns.forEach((col: any) => validColumns.push(col));
    }

    const alias = sourceAccess?.alias || "j1";
    const joins = sourceAccess?.joins || [];
    const filterAccess = this.buildFilterAccess(
      this.schemaMetaCache,
      fam,
      baseTable,
      baseAlias,
      sourceAccess?.tableAliases || {},
    );

    const selectEntries = validColumns
      .map((col: any) => {
        const sourceColumn = String(col?.column || "").trim();
        const key = String(col?.key || sourceColumn).trim();
        if (!sourceColumn || !key) return null;
        return `  ${alias}.${this.sqlId(sourceColumn)} AS ${this.sqlId(key)}`;
      })
      .filter(Boolean);

    if (!selectEntries.length) return "";

    const whereClause = [
      this.getFamilyFilterClause(
        fam,
        this.schemaMetaCache,
        baseTable,
        baseAlias,
      ),
      ...filterAccess.clauses,
    ]
      .filter(Boolean)
      .join("\n  AND ");

    if (!sourceAccess) {
      return [
        "-- Liaison automatique introuvable. Completez la jointure manuellement.",
        "SELECT",
        selectEntries.join(",\n"),
        `FROM ${this.sqlId(baseTable)} ${baseAlias}`,
        `LEFT JOIN ${this.sqlId(effectiveVarDef.sourceTable)} ${alias} ON 1 = 0`,
        `-- Remplacez ON 1 = 0 par votre jointure manuelle, par exemple :`,
        `-- ON ${alias}.${this.sqlId("votre_colonne_source")} = ${baseAlias}.${this.sqlId("votre_colonne_base")}`,
        whereClause ? `WHERE ${whereClause}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      "SELECT",
      selectEntries.join(",\n"),
      `FROM ${this.sqlId(baseTable)} ${baseAlias}`,
      ...joins,
      ...filterAccess.joins,
      whereClause ? `WHERE ${whereClause}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private refreshGeneratedListObjectQueries(
    famId: string,
    fam: any = null,
  ): any {
    const targetFam = fam || this.getFamily(famId);
    if (!targetFam || !this.schemaMetaCache) return targetFam;
    let changed = false;
    (targetFam.classes || []).forEach((cls: any) => {
      (cls.vars || []).forEach((varDef: any) => {
        if (
          !varDef ||
          varDef.type !== "list-object" ||
          !varDef.sourceTable ||
          varDef.customSqlQuery
        ) {
          return;
        }
        const generatedSql = this.buildDefaultListObjectSqlQuery(famId, varDef);
        const normalizedCurrent = String(varDef.sqlQuery || "").trim();
        const normalizedNext = String(generatedSql || "").trim();
        if (normalizedCurrent !== normalizedNext) {
          varDef.sqlQuery = generatedSql;
          changed = true;
        }
      });
    });
    return changed ? targetFam : targetFam;
  }

  private detectSqlTableAlias(querySql: string, tableName: string): string {
    const sqlText = String(querySql || "");
    const escapedTable = String(tableName || "").replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const patterns = [
      new RegExp(
        `\\bFROM\\s+(?:\\[${escapedTable}\\]|${escapedTable})\\s+(?:AS\\s+)?([A-Za-z_][A-Za-z0-9_]*)`,
        "i",
      ),
      new RegExp(
        `\\bJOIN\\s+(?:\\[${escapedTable}\\]|${escapedTable})\\s+(?:AS\\s+)?([A-Za-z_][A-Za-z0-9_]*)`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(sqlText);
      if (match?.[1]) return match[1];
    }
    const directRef = new RegExp(
      `(?:\\[${escapedTable}\\]|${escapedTable})\\s*\\.`,
      "i",
    );
    if (directRef.test(sqlText)) {
      return tableName;
    }
    return "";
  }

  private getFamilyFilterBindings(
    fam: any,
  ): Array<{ filter: any; binding: any }> {
    return (fam?.filterCatalog || [])
      .flatMap((filter: any) =>
        normalizeFilterColumnBindings(
          filter?.columnBindings || [],
          filter?.columnBinding || {},
        ).map((binding: any) => ({
          filter,
          binding,
        })),
      )
      .filter(
        ({ binding }: { binding: any }) =>
          binding &&
          (binding.mode === "table-links" || binding.mode === "base-column") &&
          binding.tableName &&
          binding.columnName,
      );
  }

  private buildListObjectApplicableFilterClauses(
    fam: any,
    varDef: any,
    querySql: string,
  ): string[] {
    if (!fam || !varDef?.sourceTable) return [];
    const alias =
      this.detectSqlTableAlias(querySql, varDef.sourceTable) ||
      varDef.sourceTable;
    return this.getFamilyFilterBindings(fam)
      .filter(({ binding }) => binding.tableName === varDef.sourceTable)
      .map(({ filter, binding }) => {
        const paramName = normalizeFilterParamName(
          filter.key || binding.columnName,
        );
        return `(:${paramName} IS NULL OR ${alias}.${this.sqlId(
          binding.columnName,
        )} = :${paramName})`;
      });
  }

  private injectClausesIntoSelectSql(
    querySql: string,
    clauses: string[] = [],
  ): string {
    const sqlText = String(querySql || "")
      .trim()
      .replace(/;+\s*$/, "");
    const normalizedClauses = (Array.isArray(clauses) ? clauses : [])
      .map((clause) => String(clause || "").trim())
      .filter(Boolean);
    if (!sqlText || !normalizedClauses.length) return sqlText;
    const missingClauses = normalizedClauses.filter(
      (clause) => !sqlText.toLowerCase().includes(clause.toLowerCase()),
    );
    if (!missingClauses.length) return sqlText;

    const malformedTrailingWhere = /\bGROUP\s+BY\b[\s\S]*\bWHERE\b/i.test(
      sqlText,
    );
    if (malformedTrailingWhere) return sqlText;

    const findKeywordIndex = (pattern: RegExp) => {
      const match = pattern.exec(sqlText);
      return match ? match.index : -1;
    };
    const whereIndex = findKeywordIndex(/\bWHERE\b/i);
    const groupIndex = findKeywordIndex(/\bGROUP\s+BY\b/i);
    const havingIndex = findKeywordIndex(/\bHAVING\b/i);
    const orderIndex = findKeywordIndex(/\bORDER\s+BY\b/i);
    const cutCandidates = [groupIndex, havingIndex, orderIndex].filter(
      (idx) => idx >= 0,
    );
    const insertIndex = cutCandidates.length
      ? Math.min(...cutCandidates)
      : sqlText.length;

    if (whereIndex >= 0) {
      const beforeTail = sqlText.slice(0, insertIndex).trimEnd();
      const tail = sqlText.slice(insertIndex);
      return `${beforeTail}\n  AND ${missingClauses.join("\n  AND ")}${tail ? `\n${tail.trimStart()}` : ""}`;
    }

    const head = sqlText.slice(0, insertIndex).trimEnd();
    const tail = sqlText.slice(insertIndex);
    return `${head}\nWHERE ${missingClauses.join("\n  AND ")}${tail ? `\n${tail.trimStart()}` : ""}`;
  }

  private buildAutoFilterClausesForAliases(
    fam: any,
    tableAliases: Record<string, string> = {},
  ): string[] {
    return this.getFamilyFilterBindings(fam)
      .map(({ filter, binding }) => {
        const alias = tableAliases?.[binding.tableName];
        if (!alias) return null;
        const paramName = normalizeFilterParamName(
          filter.key || binding.columnName,
        );
        return `(:${paramName} IS NULL OR ${alias}.${this.sqlId(
          binding.columnName,
        )} = :${paramName})`;
      })
      .filter(Boolean) as string[];
  }

  private buildRelationAccess(
    schema: any,
    baseTable: string,
    baseAlias: string,
    targetTable: string,
    aliasPrefix = "f",
    startIndex = 1,
  ): any {
    if (!schema || !baseTable || !baseAlias || !targetTable) return null;
    if (targetTable === baseTable) {
      return {
        alias: baseAlias,
        joins: [],
        tableAliases: { [baseTable]: baseAlias },
        nextIndex: startIndex,
      };
    }
    const relPath = this.getJoinPlan(schema, baseTable, targetTable);
    if (!relPath?.length) return null;
    const joins: string[] = [];
    const tableAliases: Record<string, string> = { [baseTable]: baseAlias };
    let currentAlias = baseAlias;
    let currentTable = baseTable;
    let aliasIndex = startIndex;
    relPath.forEach((step: any) => {
      const nextAlias = `${aliasPrefix}${aliasIndex}`;
      aliasIndex += 1;
      joins.push(
        `LEFT JOIN ${this.sqlId(step.toTable)} ${nextAlias} ON ${this.buildRelationCondition(
          {
            fromTable: currentTable,
            toTable: step.toTable,
            relation: step.relation,
          },
          currentAlias,
          nextAlias,
        )}`,
      );
      currentAlias = nextAlias;
      currentTable = step.toTable;
      tableAliases[currentTable] = currentAlias;
    });
    return {
      alias: currentAlias,
      joins,
      tableAliases,
      nextIndex: aliasIndex,
    };
  }

  private buildFilterAccess(
    schema: any,
    fam: any,
    baseTable: string,
    baseAlias: string,
    existingAliases: Record<string, string> = {},
  ): any {
    const tableAliases: Record<string, string> = {
      [baseTable]: baseAlias,
      ...(existingAliases || {}),
    };
    const joins: string[] = [];
    const clauses: string[] = [];
    let aliasIndex = 1;

    this.getFamilyFilterBindings(fam).forEach(({ filter, binding }) => {
      if (!tableAliases[binding.tableName]) {
        const relationAccess = this.buildRelationAccess(
          schema,
          baseTable,
          baseAlias,
          binding.tableName,
          "f",
          aliasIndex,
        );
        if (!relationAccess) return;
        aliasIndex = relationAccess.nextIndex;
        relationAccess.joins.forEach((joinSql: string) => {
          if (!joins.includes(joinSql)) joins.push(joinSql);
        });
        Object.assign(tableAliases, relationAccess.tableAliases || {});
      }
      const alias = tableAliases[binding.tableName];
      if (!alias) return;
      const paramName = normalizeFilterParamName(
        filter.key || binding.columnName,
      );
      clauses.push(
        `(:${paramName} IS NULL OR ${alias}.${this.sqlId(
          binding.columnName,
        )} = :${paramName})`,
      );
    });

    return {
      joins,
      clauses,
      tableAliases,
    };
  }

  private sqlId(name: string): string {
    return `[${String(name || "").replace(/]/g, "]]")}]`;
  }

  private indentSql(text: string, spaces = 2): string {
    const pad = " ".repeat(spaces);
    return String(text || "")
      .split("\n")
      .map((line) => (line ? pad + line : line))
      .join("\n");
  }

  private buildScalarArraySubquery(
    valueExpr: string,
    fromLines: string[],
  ): string {
    return `(\n${this.indentSql(
      [
        "SELECT COALESCE(",
        "  (",
        "    SELECT '[' + STRING_AGG('\"' + STRING_ESCAPE(src.value_json, 'json') + '\"', ',') + ']'",
        "    FROM (",
        "      SELECT CONVERT(NVARCHAR(MAX), value_item) AS value_json",
        "      FROM (",
        `        SELECT ${valueExpr} AS value_item`,
        ...fromLines.map((line) => `        ${line}`),
        "      ) value_rows",
        "    ) src",
        "  ),",
        "  '[]'",
        ")",
      ].join("\n"),
    )}\n)`;
  }

  private buildLookupDisplayExpr(
    rawExpr: string,
    lookupTable: string,
    lookupValueColumn: string,
    lookupLabelColumn: string,
  ): string {
    if (
      !this.schemaMetaCache ||
      !lookupTable ||
      !lookupValueColumn ||
      !lookupLabelColumn
    ) {
      return `CONVERT(NVARCHAR(MAX), ${rawExpr})`;
    }
    const lookupColumns = this.getColumnsForTable(
      this.schemaMetaCache,
      lookupTable,
    );
    const isLookupValid =
      lookupColumns.some((column: any) => column.name === lookupValueColumn) &&
      lookupColumns.some((column: any) => column.name === lookupLabelColumn);
    if (!isLookupValid) {
      return `CONVERT(NVARCHAR(MAX), ${rawExpr})`;
    }
    return [
      "COALESCE(",
      `  (SELECT TOP 1 CONVERT(NVARCHAR(MAX), lk.${this.sqlId(
        lookupLabelColumn,
      )})`,
      `   FROM ${this.sqlId(lookupTable)} lk`,
      `   WHERE CONVERT(NVARCHAR(MAX), lk.${this.sqlId(
        lookupValueColumn,
      )}) = CONVERT(NVARCHAR(MAX), ${rawExpr})),`,
      `  CONVERT(NVARCHAR(MAX), ${rawExpr})`,
      ")",
    ].join("\n");
  }

  private buildObjectArraySubquery(
    selectEntries: string[],
    fromLines: string[],
  ): string {
    return `(\n${this.indentSql(
      [
        "SELECT",
        `  ${selectEntries.join(",\n  ")}`,
        ...fromLines,
        "FOR JSON PATH, INCLUDE_NULL_VALUES",
      ].join("\n"),
    )}\n)`;
  }

  private buildAggregateSubquery(
    fnName: string,
    valueExpr: string,
    fromLines: string[],
  ): string {
    return `(\n${this.indentSql(
      [`SELECT ${fnName}(${valueExpr})`, ...fromLines].join("\n"),
    )}\n)`;
  }

  private buildListObjectColumnSelectExpr(
    sourceCol: any,
    valueAlias: string,
  ): string | null {
    const sourceColumn = String(sourceCol?.column || "").trim();
    const key = String(sourceCol?.key || sourceColumn).trim();
    if (!sourceColumn || !key) return null;
    const rawExpr = `${valueAlias}.${this.sqlId(sourceColumn)}`;
    if (String(sourceCol?.displayMode || "raw") !== "lookup") {
      return `${rawExpr} AS ${this.sqlId(key)}`;
    }
    return `${this.buildLookupDisplayExpr(
      rawExpr,
      String(sourceCol?.lookupTable || "").trim(),
      String(sourceCol?.lookupValueColumn || "").trim(),
      String(sourceCol?.lookupLabelColumn || "").trim(),
    )} AS ${this.sqlId(key)}`;
  }

  private sanitizeUnsafeManualJoinSql(querySql: string): string {
    const raw = String(querySql || "");
    if (!/\bbase_column\b|\bsource_column\b/i.test(raw)) return raw;
    return raw
      .replace(
        /LEFT\s+JOIN([\s\S]*?)ON\s+CONVERT\s*\(NVARCHAR\(MAX\),[\s\S]*?\[source_column\][\s\S]*?\[base_column\]\)\s*/i,
        (match, joinTarget) =>
          `-- Jointure manuelle à compléter\nLEFT JOIN${joinTarget}ON 1 = 0\n-- Remplacez ON 1 = 0 par votre vraie condition de jointure\n`,
      )
      .replace(
        /\[base_column\]|\[source_column\]|\bbase_column\b|\bsource_column\b/gi,
        "id",
      );
  }

  private splitTopLevelSqlSelect(selectSql: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inBracket = false;
    for (let i = 0; i < selectSql.length; i += 1) {
      const ch = selectSql[i];
      const next = selectSql[i + 1];
      if (!inDouble && !inBracket && ch === "'" && next === "'") {
        current += "''";
        i += 1;
        continue;
      }
      if (!inSingle && !inBracket && ch === '"') {
        inDouble = !inDouble;
        current += ch;
        continue;
      }
      if (!inDouble && !inBracket && ch === "'") {
        inSingle = !inSingle;
        current += ch;
        continue;
      }
      if (!inSingle && !inDouble && ch === "[") {
        inBracket = true;
        current += ch;
        continue;
      }
      if (inBracket && ch === "]") {
        inBracket = false;
        current += ch;
        continue;
      }
      if (!inSingle && !inDouble && !inBracket) {
        if (ch === "(") depth += 1;
        if (ch === ")" && depth > 0) depth -= 1;
        if (ch === "," && depth === 0) {
          if (current.trim()) parts.push(current.trim());
          current = "";
          continue;
        }
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  private extractTopLevelSelectClause(querySql: string): string {
    const sql = String(querySql || "")
      .trim()
      .replace(/;+\s*$/, "");
    if (!/^select\b/i.test(sql)) return "";
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inBracket = false;
    for (let i = 6; i < sql.length; i += 1) {
      const ch = sql[i];
      const next = sql[i + 1];
      if (!inDouble && !inBracket && ch === "'" && next === "'") {
        i += 1;
        continue;
      }
      if (!inSingle && !inBracket && ch === '"') {
        inDouble = !inDouble;
        continue;
      }
      if (!inDouble && !inBracket && ch === "'") {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && !inDouble && ch === "[") {
        inBracket = true;
        continue;
      }
      if (inBracket && ch === "]") {
        inBracket = false;
        continue;
      }
      if (!inSingle && !inDouble && !inBracket) {
        if (ch === "(") depth += 1;
        else if (ch === ")" && depth > 0) depth -= 1;
        else if (
          depth === 0 &&
          /\bfrom\b/i.test(sql.slice(i, i + 5)) &&
          !/[a-z0-9_]/i.test(sql[i - 1] || "") &&
          !/[a-z0-9_]/i.test(sql[i + 4] || "")
        ) {
          return sql.slice(6, i).trim();
        }
      }
    }
    return "";
  }

  private parseListObjectColumnsFromSql(querySql: string): any[] {
    const selectClause = this.extractTopLevelSelectClause(querySql);
    if (!selectClause) return [];
    return this.splitTopLevelSqlSelect(selectClause)
      .map((entry) => {
        const part = String(entry || "")
          .trim()
          .replace(/^TOP\s*\([^)]+\)\s*/i, "");
        if (!part) return null;
        let alias = "";
        const asMatch =
          /(?:^|[\s])AS\s+(\[[^\]]+\]|"[^"]+"|[A-Za-z_][\w]*)\s*$/i.exec(part);
        if (asMatch) {
          alias = asMatch[1];
        } else {
          const simpleMatch = /(\[[^\]]+\]|"[^"]+"|[A-Za-z_][\w]*)\s*$/.exec(
            part,
          );
          alias = simpleMatch ? simpleMatch[1] : "";
        }
        const normalizedAlias = String(alias || "")
          .trim()
          .replace(/^\[|\]$/g, "")
          .replace(/^"|"$/g, "");
        if (!normalizedAlias) return null;
        return {
          key: normalizedAlias,
          label: this.humanizeSchemaName(normalizedAlias),
          column: normalizedAlias,
        };
      })
      .filter((col, index, list) => {
        if (!col) return false;
        return (
          list.findIndex((item) => {
            if (!item) return false;
            return (
              String(item.key || "").toLowerCase() ===
              String(col.key || "").toLowerCase()
            );
          }) === index
        );
      });
  }

  private syncListObjectColumnsFromSql(varDef: any): boolean {
    if (!varDef || varDef.type !== "list-object") return false;
    const parsedColumns = this.parseListObjectColumnsFromSql(
      varDef.sqlQuery || "",
    );
    if (!parsedColumns.length) return false;
    const currentSourceByKey = new Map(
      (Array.isArray(varDef.sourceColumns) ? varDef.sourceColumns : []).map(
        (col: any) => [
          String(col.key || col.column || "")
            .trim()
            .toLowerCase(),
          col,
        ],
      ),
    );
    varDef.sourceColumns = parsedColumns.map((col: any) => {
      const existing = currentSourceByKey.get(
        String(col.key || "").toLowerCase(),
      );
      return existing
        ? {
            ...existing,
            key: col.key,
            label: col.label,
            column: col.column,
          }
        : {
            column: col.column,
            key: col.key,
            label: col.label,
          };
    });
    varDef.columns = parsedColumns.map((col: any) => {
      const existing = (
        Array.isArray(varDef.columns) ? varDef.columns : []
      ).find(
        (item: any) =>
          String(item?.key || "")
            .trim()
            .toLowerCase() === String(col.key || "").toLowerCase(),
      );
      return existing
        ? { ...existing, key: col.key, label: col.label }
        : { key: col.key, label: col.label };
    });
    return true;
  }

  private buildCustomObjectArraySubquery(querySql: string): string | null {
    const cleaned = this.sanitizeUnsafeManualJoinSql(querySql)
      .trim()
      .replace(/;+\s*$/, "");
    if (!cleaned || !/^select\b/i.test(cleaned)) return null;
    return `(\n${this.indentSql(
      `${cleaned}\nFOR JSON PATH, INCLUDE_NULL_VALUES`,
    )}\n)`;
  }

  private buildVarSelectExpr(
    varDef: any,
    valueAlias: string,
    fromLines: string[],
    tableColumns: any[],
  ): string | null {
    if (varDef.type === "list-object") {
      const customSql = String(varDef?.sqlQuery || "").trim();
      if (customSql) {
        return this.buildCustomObjectArraySubquery(customSql);
      }
      const sourceCols = varDef.sourceColumns || [];
      if (
        !sourceCols.length ||
        sourceCols.some(
          (col: any) =>
            !tableColumns.some((tableCol: any) => tableCol.name === col.column),
        )
      ) {
        return null;
      }
      return this.buildObjectArraySubquery(
        sourceCols
          .map((col: any) =>
            this.buildListObjectColumnSelectExpr(col, valueAlias),
          )
          .filter(Boolean),
        fromLines,
      );
    }

    if (
      !tableColumns.some((column: any) => column.name === varDef.sourceColumn)
    ) {
      return null;
    }

    const valueExpr = `${valueAlias}.${this.sqlId(varDef.sourceColumn)}`;
    if (varDef.type === "list") {
      const listExpr =
        String(varDef?.displayMode || "raw") === "lookup"
          ? this.buildLookupDisplayExpr(
              valueExpr,
              String(varDef?.lookupTable || "").trim(),
              String(varDef?.lookupValueColumn || "").trim(),
              String(varDef?.lookupLabelColumn || "").trim(),
            )
          : valueExpr;
      return this.buildScalarArraySubquery(listExpr, fromLines);
    }
    return this.buildAggregateSubquery("MAX", valueExpr, fromLines);
  }

  private updateVarLinkField(
    famId: string,
    ci: number,
    vi: number,
    field: string,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef) return;
    varDef[field] = value || "";
    if (field === "linkMode" && value !== "manual") {
      varDef.linkMode = "auto";
    }
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private moveVarColumn(
    famId: string,
    ci: number,
    vi: number,
    colIndex: number,
    direction: number,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    const fromIndex = Number(colIndex);
    const targetIndex = fromIndex + Number(direction || 0);
    const displayCols = Array.isArray(varDef.columns)
      ? [...varDef.columns]
      : [];
    if (
      !displayCols.length ||
      fromIndex < 0 ||
      targetIndex < 0 ||
      fromIndex >= displayCols.length ||
      targetIndex >= displayCols.length
    ) {
      return;
    }
    const [movedDisplayCol] = displayCols.splice(fromIndex, 1);
    displayCols.splice(targetIndex, 0, movedDisplayCol);
    varDef.columns = displayCols;
    if (Array.isArray(varDef.sourceColumns) && varDef.sourceColumns.length) {
      const sourceCols = [...varDef.sourceColumns];
      if (sourceCols.length === displayCols.length) {
        const [movedSourceCol] = sourceCols.splice(fromIndex, 1);
        sourceCols.splice(targetIndex, 0, movedSourceCol);
        varDef.sourceColumns = sourceCols;
      } else {
        const sourceByKey = new Map(
          sourceCols.map((col: any) => [
            String(col.key || this.slugTech(col.column)),
            col,
          ]),
        );
        const reordered: any[] = [];
        displayCols.forEach((col: any) => {
          const key = String(col.key || "");
          const match = sourceByKey.get(key);
          if (!match) return;
          reordered.push(match);
          sourceByKey.delete(key);
        });
        varDef.sourceColumns = [...reordered, ...sourceByKey.values()];
      }
    }
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private removeVarColumn(
    famId: string,
    ci: number,
    vi: number,
    colIndex: number,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    const index = Number(colIndex);
    if (
      Array.isArray(varDef.columns) &&
      index >= 0 &&
      index < varDef.columns.length
    ) {
      varDef.columns.splice(index, 1);
    }
    if (
      Array.isArray(varDef.sourceColumns) &&
      index >= 0 &&
      index < varDef.sourceColumns.length
    ) {
      varDef.sourceColumns.splice(index, 1);
    }
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private updateVarAddColumnMode(
    famId: string,
    ci: number,
    vi: number,
    mode: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    varDef.addColumnMode = mode === "manual" ? "manual" : "schema";
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
  }

  private addVarColumn(famId: string, ci: number, vi: number): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    const sourceInput = document.getElementById(
      `var_col_source_${ci}_${vi}`,
    ) as HTMLInputElement | null;
    const keyInput = document.getElementById(
      `var_col_key_${ci}_${vi}`,
    ) as HTMLInputElement | null;
    const labelInput = document.getElementById(
      `var_col_label_${ci}_${vi}`,
    ) as HTMLInputElement | null;
    const sourceColumn = String(sourceInput?.value || "").trim();
    const keyRaw = String(keyInput?.value || "").trim();
    const label = String(labelInput?.value || "").trim();
    const key = this.slugTech(keyRaw || sourceColumn);
    if (!sourceColumn) {
      this.toast("Choisissez ou saisissez une colonne source", "error");
      return;
    }
    if (!key || !label) {
      this.toast("Renseignez la clé technique et le libellé", "error");
      return;
    }
    const exists = (
      Array.isArray(varDef.sourceColumns) ? varDef.sourceColumns : []
    ).some(
      (col: any) =>
        String(col?.column || "")
          .trim()
          .toLowerCase() === sourceColumn.toLowerCase(),
    );
    if (exists) {
      this.toast("Cette colonne est déjà présente dans le tableau", "error");
      return;
    }
    varDef.sourceColumns = [
      ...(Array.isArray(varDef.sourceColumns) ? varDef.sourceColumns : []),
      { column: sourceColumn, key, label },
    ];
    varDef.columns = [
      ...(Array.isArray(varDef.columns) ? varDef.columns : []),
      { key, label },
    ];
    if (sourceInput) sourceInput.value = "";
    if (keyInput) keyInput.value = "";
    if (labelInput) labelInput.value = "";
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
    this.toast("Colonne ajoutée", "success");
  }

  private updateVarColumnLookupField(
    famId: string,
    ci: number,
    vi: number,
    colIndex: number,
    field: string,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (
      !varDef ||
      varDef.type !== "list-object" ||
      !Array.isArray(varDef.sourceColumns) ||
      !varDef.sourceColumns[colIndex]
    ) {
      return;
    }
    const sourceCol = { ...varDef.sourceColumns[colIndex] };
    sourceCol[field] = value || "";
    if (field === "displayMode" && value !== "lookup") {
      sourceCol.displayMode = "raw";
    }
    if (field === "lookupTable") {
      sourceCol.lookupValueColumn = "";
      sourceCol.lookupLabelColumn = "";
    }
    varDef.sourceColumns[colIndex] = sourceCol;
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private updateVarColumnLookupMode(
    famId: string,
    ci: number,
    vi: number,
    colIndex: number,
    mode: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (
      !varDef ||
      varDef.type !== "list-object" ||
      !Array.isArray(varDef.sourceColumns) ||
      !varDef.sourceColumns[colIndex]
    ) {
      return;
    }
    const sourceCol = {
      ...varDef.sourceColumns[colIndex],
      lookupEditorMode: mode === "manual" ? "manual" : "schema",
    };
    varDef.sourceColumns[colIndex] = sourceCol;
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private updateListVarLookupField(
    famId: string,
    ci: number,
    vi: number,
    field: string,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list") return;
    varDef[field] = value || "";
    if (field === "displayMode" && value !== "lookup") {
      varDef.displayMode = "raw";
    }
    if (field === "lookupTable") {
      varDef.lookupValueColumn = "";
      varDef.lookupLabelColumn = "";
    }
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private updateListVarLookupMode(
    famId: string,
    ci: number,
    vi: number,
    mode: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list") return;
    varDef.lookupEditorMode = mode === "manual" ? "manual" : "schema";
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private updateListObjectSqlQuery(
    famId: string,
    ci: number,
    vi: number,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    const sqlQuery = String(value || "").trim();
    if (sqlQuery && !/^select\b/i.test(sqlQuery)) {
      this.toast("La requête du tableau doit être un SELECT", "error");
      this.renderClassesContainer(famId);
      return;
    }
    varDef.sqlQuery = sqlQuery;
    varDef.customSqlQuery = !!sqlQuery;
    this.syncListObjectColumnsFromSql(varDef);
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private generateListObjectSqlQueryFromSource(
    famId: string,
    ci: number,
    vi: number,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    const generatedSql = this.buildDefaultListObjectSqlQuery(famId, varDef);
    if (!generatedSql) {
      this.toast(
        "Impossible de générer la requête SQL. Vérifiez la table principale, la table source et la liaison.",
        "error",
      );
      return;
    }
    varDef.sqlQuery = generatedSql;
    varDef.customSqlQuery = false;
    this.syncListObjectColumnsFromSql(varDef);
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
    this.toast("Requête SQL du tableau générée", "success");
  }

  private applySuggestedFiltersToListObjectSql(
    famId: string,
    ci: number,
    vi: number,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!fam || !varDef || varDef.type !== "list-object") return;
    const sqlQuery = String(varDef.sqlQuery || "").trim();
    if (!sqlQuery) {
      this.toast("Commencez par saisir ou générer une requête SQL", "error");
      return;
    }
    const clauses = this.buildListObjectApplicableFilterClauses(
      fam,
      varDef,
      sqlQuery,
    );
    if (!clauses.length) {
      this.toast(
        "Aucun filtre de famille n'est lié à la table source de ce tableau",
        "error",
      );
      return;
    }
    const nextSql = this.injectClausesIntoSelectSql(sqlQuery, clauses);
    if (nextSql === sqlQuery) {
      this.toast("Les filtres applicables sont déjà présents", "success");
      return;
    }
    varDef.sqlQuery = nextSql;
    varDef.customSqlQuery = true;
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
    this.toast("Filtres applicables ajoutés au SQL du tableau", "success");
  }

  private clearListObjectSqlQuery(famId: string, ci: number, vi: number): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    varDef.sqlQuery = "";
    varDef.customSqlQuery = false;
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    this.regenerateFamilySql(famId, true);
  }

  private async testListObjectSqlQuery(
    famId: string,
    ci: number,
    vi: number,
  ): Promise<void> {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    const box = document.getElementById(`listObjectSqlPreview_${ci}_${vi}`);
    if (!box || !varDef || varDef.type !== "list-object") return;
    const sqlQuery = String(varDef.sqlQuery || "").trim();
    if (!sqlQuery) {
      box.textContent = "Aucune requête SQL dédiée à tester.";
      return;
    }
    if (!/^select\b/i.test(sqlQuery)) {
      box.textContent = "La requête doit commencer par SELECT.";
      return;
    }
    box.textContent = "Test en cours...";
    try {
      this.syncListObjectColumnsFromSql(varDef);
      this.saveFamilyLocal(fam);
      const rows = await this.runSelect(sqlQuery, {
        id: 1,
        beneficiaryId: 1,
        personId: 1,
        organizationId: 1,
      });
      box.textContent = JSON.stringify(rows.slice(0, 10), null, 2);
    } catch (error: any) {
      box.textContent = error?.message || "Erreur";
    }
  }

  private updateClassProp(
    famId: string,
    ci: number,
    prop: string,
    val: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    if (!fam.classes[ci]) return;
    fam.classes[ci][prop] = val;
    this.saveFamilyLocal(fam);
    if (prop === "couleur") this.renderClassesContainer(famId);
  }

  private deleteClassBlock(famId: string, ci: number): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    fam.classes.splice(ci, 1);
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
  }

  private deleteVar(famId: string, ci: number, vi: number): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    if (!fam.classes[ci]) return;
    fam.classes[ci].vars = fam.classes[ci].vars || [];
    fam.classes[ci].vars.splice(vi, 1);
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
  }

  private updateVarLabel(
    famId: string,
    ci: number,
    vi: number,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!fam || !varDef) return;
    varDef.label = String(value || "").trim() || varDef.tech;
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
  }

  private addClassBlock(famId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    fam.classes.push({
      nom: "Nouvelle classe",
      couleur: "#6c63ff",
      vars: [],
    });
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
  }

  private onVarTypeChange(ci: number): void {
    const type = (
      document.getElementById(`vtype_${ci}`) as HTMLSelectElement | null
    )?.value;
    const isObj = type === "list-object";
    const colsArea = document.getElementById(`cols_area_${ci}`);
    const colAdd = document.getElementById(`col_add_${ci}`);
    if (colsArea) colsArea.classList.toggle("visible", isObj);
    if (colAdd) colAdd.classList.toggle("visible", isObj);
    if (isObj && !this.tempColsByClass[ci]) this.tempColsByClass[ci] = [];
    this.refreshTempColPills(ci);
  }

  private addTempCol(ci: number): void {
    const keyInput = document.getElementById(
      `ck_${ci}`,
    ) as HTMLInputElement | null;
    const labelInput = document.getElementById(
      `cl_${ci}`,
    ) as HTMLInputElement | null;
    const key = String(keyInput?.value || "")
      .trim()
      .replace(/\s/g, "_");
    const label = String(labelInput?.value || "").trim();
    if (!key || !label) {
      this.toast("Remplissez clé et libellé", "error");
      return;
    }
    if (!this.tempColsByClass[ci]) this.tempColsByClass[ci] = [];
    this.tempColsByClass[ci].push({ key, label });
    if (keyInput) keyInput.value = "";
    if (labelInput) labelInput.value = "";
    this.refreshTempColPills(ci);
  }

  private refreshTempColPills(ci: number): void {
    const area = document.getElementById(`cols_pills_${ci}`);
    if (!area) return;
    const cols = this.tempColsByClass[ci] || [];
    area.innerHTML = cols
      .map(
        (c, i) => `
          <span class="col-pill">
            ${this.escHtml(c.key)} → ${this.escHtml(c.label)}
            <button class="col-pill-btn" type="button" title="Monter" onclick="_moveTempCol(${ci},${i},-1)" ${
              i === 0 ? "disabled" : ""
            }>&uarr;</button>
            <button class="col-pill-btn" type="button" title="Descendre" onclick="_moveTempCol(${ci},${i},1)" ${
              i === cols.length - 1 ? "disabled" : ""
            }>&darr;</button>
            <button class="col-pill-del" onclick="_removeTempCol(${ci},${i})">×</button>
          </span>`,
      )
      .join("");
  }

  private removeTempCol(ci: number, index: number): void {
    if (this.tempColsByClass[ci]) this.tempColsByClass[ci].splice(index, 1);
    this.refreshTempColPills(ci);
  }

  private moveTempCol(ci: number, index: number, direction: number): void {
    const cols = this.tempColsByClass[ci];
    if (!Array.isArray(cols)) return;
    const targetIndex = index + Number(direction || 0);
    if (targetIndex < 0 || targetIndex >= cols.length) return;
    const [moved] = cols.splice(index, 1);
    cols.splice(targetIndex, 0, moved);
    this.refreshTempColPills(ci);
  }

  private addVar(famId: string, ci: number): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const techInput = document.getElementById(
      `vt_${ci}`,
    ) as HTMLInputElement | null;
    const labelInput = document.getElementById(
      `vl_${ci}`,
    ) as HTMLInputElement | null;
    const typeInput = document.getElementById(
      `vtype_${ci}`,
    ) as HTMLSelectElement | null;
    const tech = String(techInput?.value || "")
      .trim()
      .replace(/\s/g, "_");
    const label = String(labelInput?.value || "").trim();
    const type = String(typeInput?.value || "scalar");
    if (!tech || !label) {
      this.toast("Remplissez les deux champs", "error");
      return;
    }
    const newVar: any = { tech, label, type };
    if (type === "list-object") {
      const cols = this.tempColsByClass[ci] || [];
      if (!cols.length) {
        this.toast("Ajoutez au moins une colonne pour le tableau", "error");
        return;
      }
      newVar.columns = [...cols];
      this.tempColsByClass[ci] = [];
    }
    fam.classes = fam.classes || [];
    if (!fam.classes[ci]) return;
    fam.classes[ci].vars = fam.classes[ci].vars || [];
    fam.classes[ci].vars.push(newVar);
    this.saveFamilyLocal(fam);
    this.renderClassesContainer(famId);
    if (techInput) techInput.value = "";
    if (labelInput) labelInput.value = "";
    this.toast("Variable ajoutée", "success");
  }

  private buildBeneficiarySqlFromFamily(famId: string): string {
    const fam = this.getFamily(famId);
    if (
      !fam ||
      !this.schemaMetaCache ||
      fam.beneficiaryMode === "organization"
    ) {
      return "";
    }
    const tableName = this.getFamilyBeneficiaryTable(fam);
    const columns = this.getColumnsForTable(this.schemaMetaCache, tableName);
    if (!columns.length) return "";
    const pk = this.getFamilyBeneficiaryLinkColumn(fam, this.schemaMetaCache);
    const displayColumns = this.getSuggestedBeneficiaryDisplayColumns(
      fam,
      this.schemaMetaCache,
      tableName,
    );
    const labelColumn =
      displayColumns[0] ||
      columns.find((column: any) =>
        [
          "nom_prenom",
          "nom_complet",
          "display_name",
          "full_name",
          "nom",
          "libelle",
          "intitule",
        ].includes(column.name),
      )?.name ||
      pk;
    const sourceAlias = "src";
    const configuredDisplayExpr = this.getBeneficiaryLabelAndSubtitleExpr(
      displayColumns,
      sourceAlias,
    );
    const labelSqlExpr =
      configuredDisplayExpr.labelExpr ||
      `${sourceAlias}.${this.sqlId(labelColumn)}`;
    const subtitleSqlExpr =
      configuredDisplayExpr.subtitleExpr ||
      (displayColumns.length
        ? ""
        : (() => {
            const subtitleColumn = columns.find((column: any) =>
              [
                "poste",
                "fonction",
                "grade",
                "departement",
                "service",
                "email",
                "code",
                "matricule",
              ].includes(column.name),
            )?.name;
            return subtitleColumn
              ? `${sourceAlias}.${this.sqlId(subtitleColumn)}`
              : "";
          })());
    const pathToEtab = this.getRelationPath(
      this.schemaMetaCache,
      tableName,
      this.legacyOrganizationTable,
    );
    const joinParts: string[] = [];
    let currentAlias = sourceAlias;
    let etabAlias = sourceAlias;
    const filterAccess = this.buildFilterAccess(
      this.schemaMetaCache,
      fam,
      tableName,
      sourceAlias,
    );
    const extraFilterClauses = filterAccess.clauses || [];

    (pathToEtab || []).forEach((step: any, index: number) => {
      const nextAlias = `r${index + 1}`;
      joinParts.push(
        `LEFT JOIN ${this.sqlId(step.toTable)} ${nextAlias} ON ${this.buildRelationCondition(
          step,
          currentAlias,
          nextAlias,
        )}`,
      );
      currentAlias = nextAlias;
      etabAlias = nextAlias;
    });

    const etabFilter =
      tableName === this.legacyOrganizationTable
        ? `${sourceAlias}.${this.sqlId(
            this.getPrimaryColumn(this.schemaMetaCache, tableName),
          )} = :organizationId`
        : pathToEtab?.length
          ? `${etabAlias}.${this.sqlId(
              this.getPrimaryColumn(
                this.schemaMetaCache,
                this.legacyOrganizationTable,
              ),
            )} = :organizationId`
          : columns.some(
                (column: any) =>
                  column.name === this.legacyOrganizationIdColumn,
              )
            ? `${sourceAlias}.${this.sqlId(
                this.legacyOrganizationIdColumn,
              )} = :organizationId`
            : "";
    const whereClauses = [etabFilter, ...extraFilterClauses].filter(Boolean);
    return [
      "SELECT",
      `  TOP (500) ${sourceAlias}.${this.sqlId(pk)} AS id,`,
      `  ${labelSqlExpr} AS libelle${subtitleSqlExpr ? "," : ""}`,
      subtitleSqlExpr ? `  ${subtitleSqlExpr} AS sous_libelle` : "",
      `FROM ${this.sqlId(tableName)} ${sourceAlias}`,
      ...joinParts,
      ...(filterAccess.joins || []),
      whereClauses.length ? `WHERE ${whereClauses.join("\n  AND ")}` : "",
      `ORDER BY ${sourceAlias}.${this.sqlId(labelColumn)} ASC`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildBeneficiaryDisplaySqlExpr(
    columns: string[] = [],
    alias = "src",
  ): string {
    const validColumns = (Array.isArray(columns) ? columns : []).filter(
      Boolean,
    );
    if (!validColumns.length) return "";
    const parts = validColumns.map(
      (columnName) =>
        `COALESCE(CONVERT(NVARCHAR(255), ${alias}.${this.sqlId(columnName)}), '')`,
    );
    if (parts.length === 1) return parts[0];
    return `LTRIM(RTRIM(${parts.join(" + ' ' + ")}))`;
  }

  private getBeneficiaryLabelAndSubtitleExpr(
    columns: string[] = [],
    alias = "src",
  ): { labelExpr: string; subtitleExpr: string } {
    const validColumns = (Array.isArray(columns) ? columns : []).filter(
      Boolean,
    );
    if (!validColumns.length) {
      return { labelExpr: "", subtitleExpr: "" };
    }
    if (validColumns.length === 1) {
      return {
        labelExpr: `COALESCE(CONVERT(NVARCHAR(255), ${alias}.${this.sqlId(
          validColumns[0],
        )}), '')`,
        subtitleExpr: "",
      };
    }
    return {
      labelExpr: this.buildBeneficiaryDisplaySqlExpr(validColumns, alias),
      subtitleExpr: "",
    };
  }

  private buildPathExistsClause(
    schema: any,
    sourceTable: string,
    sourceAlias: string,
    targetTable: string,
    paramName: string,
    rootAlias = "bf",
    targetMatchColumn: string | null = null,
  ): string | null {
    const path = this.getRelationPath(schema, targetTable, sourceTable);
    if (!path?.length) return null;

    let currentAlias = rootAlias;
    const joins: string[] = [];
    path.forEach((step: any, index: number) => {
      const nextAlias = `${rootAlias}${index + 1}`;
      joins.push(
        `LEFT JOIN ${this.sqlId(step.toTable)} ${nextAlias} ON ${this.buildRelationCondition(
          step,
          currentAlias,
          nextAlias,
        )}`,
      );
      currentAlias = nextAlias;
    });

    return [
      "EXISTS (",
      `  SELECT 1 FROM ${this.sqlId(targetTable)} ${rootAlias}`,
      ...joins.map((joinSql) => `  ${joinSql}`),
      `  WHERE ${rootAlias}.${this.sqlId(
        targetMatchColumn || this.getPrimaryColumn(schema, targetTable),
      )} = :${paramName}`,
      `    AND ${currentAlias}.${this.sqlId(
        this.getPrimaryColumn(schema, sourceTable),
      )} = ${sourceAlias}.${this.sqlId(
        this.getPrimaryColumn(schema, sourceTable),
      )}`,
      ")",
    ].join("\n");
  }

  private getFamilyFilterClause(
    fam: any,
    schema: any,
    baseTable: string,
    baseAlias: string,
  ): string {
    const basePk = this.getPrimaryColumn(schema, baseTable);

    if (fam?.beneficiaryMode === "organization") {
      if (baseTable === this.legacyOrganizationTable) {
        return `${baseAlias}.${this.sqlId(basePk)} = :organizationId`;
      }
      if (
        this.getColumnsForTable(schema, baseTable).some(
          (c: any) => c.name === this.legacyOrganizationIdColumn,
        )
      ) {
        return `${baseAlias}.${this.sqlId(
          this.legacyOrganizationIdColumn,
        )} = :organizationId`;
      }
      const etabPathClause = this.buildPathExistsClause(
        schema,
        baseTable,
        baseAlias,
        this.legacyOrganizationTable,
        "organizationId",
        "etf",
      );
      if (etabPathClause) return etabPathClause;
      return `${baseAlias}.${this.sqlId(basePk)} = :organizationId`;
    }

    const beneficiaryTable = this.getFamilyBeneficiaryTable(fam);
    const beneficiaryLinkColumn = this.getFamilyBeneficiaryLinkColumn(
      fam,
      schema,
    );
    if (baseTable === beneficiaryTable) {
      return `${baseAlias}.${this.sqlId(
        beneficiaryLinkColumn || basePk,
      )} = :beneficiaryId`;
    }

    const beneficiaryPathClause = this.buildPathExistsClause(
      schema,
      baseTable,
      baseAlias,
      beneficiaryTable,
      "beneficiaryId",
      "bf",
      beneficiaryLinkColumn || this.getPrimaryColumn(schema, beneficiaryTable),
    );
    if (beneficiaryPathClause) return beneficiaryPathClause;

    return `${baseAlias}.${this.sqlId(basePk)} = :beneficiaryId`;
  }

  private inferBaseTable(fam: any, schema: any): string {
    const generatedVar = (fam.classes || [])
      .flatMap((c: any) => c.vars || [])
      .find((v: any) => v.sourceTable);
    const visibleTables = this.getVisibleFamilySchemaTables(schema, [
      fam?.beneficiaryTable,
    ]);
    if (fam?.beneficiaryMode !== "organization" && fam?.beneficiaryTable) {
      return fam.beneficiaryTable;
    }
    if (generatedVar?.baseTable) {
      return generatedVar.baseTable;
    }
    const fromMatch =
      /\bfrom\s+(?:\[([^\]]+)\]|`([^`]+)`|([a-zA-Z0-9_]+))/i.exec(
        fam.sql || "",
      );
    if (fromMatch) return fromMatch[1] || fromMatch[2] || fromMatch[3];
    return (
      generatedVar?.sourceTable ||
      visibleTables[0]?.name ||
      schema.tables[0]?.name ||
      ""
    );
  }

  private buildOrganizationScopedVarExpr(
    schema: any,
    varDef: any,
  ): string | null {
    const sourceTable = varDef?.sourceTable;
    if (!sourceTable) return null;
    const fam = this.selectedFamId ? this.getFamily(this.selectedFamId) : null;
    const sourceColumns = this.getColumnsForTable(schema, sourceTable);
    if (!sourceColumns.length) return null;

    const sourceAlias = "src";
    const joins: string[] = [];
    let etabMatcher = "";
    const filterAccess = this.buildFilterAccess(
      schema,
      fam,
      sourceTable,
      sourceAlias,
    );

    if (sourceTable === this.legacyOrganizationTable) {
      etabMatcher = `${sourceAlias}.${this.sqlId(
        this.getPrimaryColumn(schema, this.legacyOrganizationTable),
      )} = :organizationId`;
    } else if (
      sourceColumns.some(
        (column: any) => column.name === this.legacyOrganizationIdColumn,
      )
    ) {
      etabMatcher = `${sourceAlias}.${this.sqlId(
        this.legacyOrganizationIdColumn,
      )} = :organizationId`;
    } else {
      const pathToEtab = this.getRelationPath(
        schema,
        sourceTable,
        this.legacyOrganizationTable,
      );
      if (!pathToEtab?.length) {
        etabMatcher = "1=1";
      } else {
        let currentAlias = sourceAlias;
        let etabAlias = sourceAlias;
        pathToEtab.forEach((step: any, index: number) => {
          const nextAlias = `etj${index + 1}`;
          joins.push(
            `LEFT JOIN ${this.sqlId(step.toTable)} ${nextAlias} ON ${this.buildRelationCondition(
              step,
              currentAlias,
              nextAlias,
            )}`,
          );
          currentAlias = nextAlias;
          etabAlias = nextAlias;
        });
        etabMatcher = `${etabAlias}.${this.sqlId(
          this.getPrimaryColumn(schema, this.legacyOrganizationTable),
        )} = :organizationId`;
      }
    }

    const fromLines = [
      `FROM ${this.sqlId(sourceTable)} ${sourceAlias}`,
      ...joins,
      ...(filterAccess.joins || []),
      `WHERE ${[etabMatcher, ...(filterAccess.clauses || [])]
        .filter(Boolean)
        .join("\n  AND ")}`,
    ];
    return this.buildVarSelectExpr(
      varDef,
      sourceAlias,
      fromLines,
      sourceColumns,
    );
  }

  private buildOrganizationFamilySql(fam: any): string {
    const vars = (fam.classes || [])
      .flatMap((c: any) => c.vars || [])
      .filter((v: any) => v.sourceTable || String(v?.sqlQuery || "").trim());
    const exprs = vars
      .map((v: any) => {
        if (v.type === "list-object" && String(v?.sqlQuery || "").trim()) {
          const expr = this.buildCustomObjectArraySubquery(v.sqlQuery);
          return expr ? `  ${expr} AS ${this.sqlId(v.tech)}` : null;
        }
        const expr = this.buildOrganizationScopedVarExpr(
          this.schemaMetaCache,
          v,
        );
        return expr ? `  ${expr} AS ${this.sqlId(v.tech)}` : null;
      })
      .filter(Boolean);
    if (!exprs.length) return fam.sql || "";
    return ["SELECT", exprs.join(",\n")].join("\n");
  }

  private getValidGeneratedVars(
    schema: any,
    baseTable: string,
    vars: any[],
  ): any[] {
    return (vars || []).filter((v: any) => {
      if (v?.type === "list-object" && String(v?.sqlQuery || "").trim()) {
        return true;
      }
      if (!v?.sourceTable) return false;
      const tableColumns = this.getColumnsForTable(schema, v.sourceTable);
      if (!tableColumns.length) return false;
      if (
        v.sourceTable !== baseTable &&
        !this.getJoinPlan(schema, baseTable, v.sourceTable)?.length &&
        !this.hasManualVarLink(schema, baseTable, v)
      ) {
        return false;
      }
      if (v.type === "list-object") {
        return (v.sourceColumns || []).every((col: any) =>
          tableColumns.some((tableCol: any) => tableCol.name === col.column),
        );
      }
      return tableColumns.some(
        (tableCol: any) => tableCol.name === v.sourceColumn,
      );
    });
  }

  private buildSqlFromFamily(famId: string): string {
    const fam = this.getFamily(famId);
    if (!fam || !this.schemaMetaCache) return fam?.sql || "";
    if (fam.beneficiaryMode === "organization") {
      return this.buildOrganizationFamilySql(fam);
    }

    const builder = this.getBuilderState(famId, fam, this.schemaMetaCache);
    const allGeneratedVars = (fam.classes || [])
      .flatMap((c: any) => c.vars || [])
      .filter((v: any) => v.sourceTable || String(v?.sqlQuery || "").trim());
    const generatedVars = this.getValidGeneratedVars(
      this.schemaMetaCache,
      builder.baseTable,
      allGeneratedVars,
    );
    const hasStandaloneSqlVars = generatedVars.some(
      (v: any) => v.type === "list-object" && String(v?.sqlQuery || "").trim(),
    );
    if (!generatedVars.length) return fam.sql || "";
    if (!builder.baseTable && !hasStandaloneSqlVars) return fam.sql || "";

    const baseTable = builder.baseTable;
    const baseAlias = "b";
    const selects = generatedVars.map((v: any) => {
      if (v.type === "list-object" && String(v?.sqlQuery || "").trim()) {
        const expr = this.buildCustomObjectArraySubquery(v.sqlQuery);
        return expr ? `  ${expr} AS ${this.sqlId(v.tech)}` : null;
      }
      const sourceAccess = this.resolveVarSourceAccess(
        this.schemaMetaCache,
        baseTable,
        baseAlias,
        v,
      );
      if (!sourceAccess) return null;
      const joins = sourceAccess.joins || [];
      const alias = sourceAccess.alias || baseAlias;
      const filterAccess = this.buildFilterAccess(
        this.schemaMetaCache,
        fam,
        baseTable,
        baseAlias,
        sourceAccess.tableAliases || {},
      );
      const tableColumns = this.getColumnsForTable(
        this.schemaMetaCache,
        v.sourceTable,
      );
      const fromLines = [
        `FROM ${this.sqlId(baseTable)} ${baseAlias}`,
        ...joins,
        ...filterAccess.joins,
        `WHERE ${[
          this.getFamilyFilterClause(
            fam,
            this.schemaMetaCache,
            baseTable,
            baseAlias,
          ),
          ...filterAccess.clauses,
        ]
          .filter(Boolean)
          .join("\n  AND ")}`,
      ];
      const expr = this.buildVarSelectExpr(v, alias, fromLines, tableColumns);
      return expr ? `  ${expr} AS ${this.sqlId(v.tech)}` : null;
    });

    const filteredSelects = selects.filter(Boolean);
    if (!filteredSelects.length) return fam.sql || "";
    return ["SELECT", filteredSelects.join(",\n")].join("\n");
  }

  private regenerateFamilySql(
    famId: string,
    silent = false,
    force = false,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    this.refreshGeneratedListObjectQueries(famId, fam);
    if (fam.customMainSql && !force) {
      const sqlInput = document.getElementById(
        "fSql",
      ) as HTMLTextAreaElement | null;
      if (sqlInput) sqlInput.value = fam.sql || "";
      return;
    }
    const generatedSql = this.buildSqlFromFamily(famId);
    if (!generatedSql) return;
    fam.sql = generatedSql;
    fam.customMainSql = false;
    this.saveFamilyLocal(fam);
    const sqlInput = document.getElementById(
      "fSql",
    ) as HTMLTextAreaElement | null;
    if (sqlInput) sqlInput.value = generatedSql;
    if (!silent) this.toast("Requête SELECT régénérée", "success");
  }

  private regenerateFamilyBeneficiarySql(
    famId: string,
    silent = false,
    force = false,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const sqlInput = document.getElementById(
      "fBeneficiarySql",
    ) as HTMLTextAreaElement | null;
    if (fam.customBeneficiarySql && !force) {
      if (sqlInput) sqlInput.value = fam.beneficiarySql || "";
      return;
    }
    fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
    fam.customBeneficiarySql = false;
    this.saveFamilyLocal(fam);
    if (sqlInput) sqlInput.value = fam.beneficiarySql || "";
    if (!silent) this.toast("SELECT bénéficiaires régénéré", "success");
  }

  private async testFamilyBeneficiaryQuery(famId: string): Promise<void> {
    const fam = this.getFamily(famId);
    const box = document.getElementById("beneficiaryPreviewBox");
    if (!box || !fam) return;
    if (fam.beneficiaryMode === "organization") {
      box.textContent =
        "Mode Organization : aucun SELECT bénéficiaires n'est nécessaire.";
      return;
    }
    const sql =
      (
        document.getElementById("fBeneficiarySql") as HTMLTextAreaElement | null
      )?.value?.trim() ||
      fam.beneficiarySql ||
      "";
    if (!sql) {
      box.textContent = "Aucun SELECT bénéficiaires défini.";
      return;
    }
    box.textContent = "Test en cours...";
    try {
      const rows = await this.runSelect(sql, {
        organizationId: 1,
      });
      box.textContent = JSON.stringify(rows[0] || {}, null, 2);
    } catch (error: any) {
      box.textContent = error?.message || "Erreur";
    }
  }

  private getOrganizationExtraFieldKeys(): string[] {
    const keys = new Set<string>();
    this.organizations.forEach((org) => {
      const raw = (org as any)?.raw;
      if (!raw || typeof raw !== "object") return;
      Object.keys(raw).forEach((key) => {
        if (!this.organizationRawExcludedKeys.has(key)) keys.add(key);
      });
    });
    return [...keys].sort((a, b) => a.localeCompare(b));
  }

  private renderOrganizationExtraFields(org: any = null): void {
    const host = document.getElementById("organizationExtraFields");
    if (!host) return;
    const keys = this.getOrganizationExtraFieldKeys();
    host.innerHTML = keys
      .map((key) => {
        const value =
          org?.raw?.[key] === undefined || org?.raw?.[key] === null
            ? ""
            : String(org.raw[key]);
        return `<div class="form-row" style="margin:0">
              <label class="form-label">${this.escHtml(key)}</label>
              <input class="form-input" data-org-raw-field="${this.escAttr(
                key,
              )}" value="${this.escAttr(value)}" placeholder="${this.escAttr(
                key,
              )}" />
            </div>`;
      })
      .join("");
  }

  private buildOrganizationTemplateVars(org: any): Record<string, any> {
    const raw = org?.raw && typeof org.raw === "object" ? org.raw : {};
    const out: Record<string, any> = {};
    Object.entries(raw).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (typeof value === "object") return;
      const normalizedKey = normalizeFilterParamName(key, "");
      if (!normalizedKey) return;
      out[normalizedKey] = value;
      out[`org_${normalizedKey}`] = value;
    });
    return out;
  }

  private getOrganizationVariableSettings(): {
    visibleKeys: string[];
    configured: boolean;
    labels: Record<string, string>;
  } {
    const settings = this.state?.settings ?? {};
    const configured = Array.isArray(
      (settings as any).organizationVisibleVarKeys,
    );
    const visibleKeys = configured
      ? ((settings as any).organizationVisibleVarKeys || [])
          .map((value: any) => normalizeFilterParamName(value, ""))
          .filter(Boolean)
      : [];
    const labelsSource =
      (settings as any).organizationVariableLabels &&
      typeof (settings as any).organizationVariableLabels === "object"
        ? (settings as any).organizationVariableLabels
        : {};
    const normalizedLabels = Object.fromEntries(
      Object.entries(labelsSource)
        .map(([key, label]) => [
          normalizeFilterParamName(String(key || "").replace(/^org_/, ""), ""),
          String(label || "").trim(),
        ])
        .filter(([key]) => key),
    );
    return { visibleKeys, configured, labels: normalizedLabels };
  }

  private getOrganizationVariableCandidates(): Array<{
    key: string;
    label: string;
    checked: boolean;
  }> {
    const labelSettings = this.getOrganizationVariableSettings().labels || {};
    const configured = this.getOrganizationVariableSettings().configured;
    const visible = new Set(
      this.getOrganizationVariableSettings().visibleKeys.map((key) =>
        normalizeFilterParamName(key, ""),
      ),
    );
    const allVars = Object.keys(
      this.organizations.reduce((acc: any, org) => {
        Object.entries(this.buildOrganizationTemplateVars(org)).forEach(
          ([key, value]) => {
            if (!key.startsWith("org_")) acc[key] = value;
          },
        );
        return acc;
      }, {}),
    );
    return allVars
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        key,
        label:
          String(labelSettings[key] || "").trim() ||
          this.humanizeSchemaName(key),
        checked: configured ? visible.has(key) : true,
      }));
  }

  private async saveOrganizationVariableSelection(): Promise<void> {
    const checked = Array.from(
      document.querySelectorAll("[data-org-visible-var]:checked"),
    ).map((input) =>
      normalizeFilterParamName((input as HTMLInputElement).value, ""),
    );
    const labels = Object.fromEntries(
      Array.from(document.querySelectorAll("[data-org-visible-var-label]"))
        .map((input) => {
          const element = input as HTMLInputElement;
          return [
            normalizeFilterParamName(
              element.dataset["orgVisibleVarLabel"] || "",
              "",
            ),
            String(element.value || "").trim(),
          ];
        })
        .filter(([key]) => key),
    );
    try {
      const nextState = this.editorState.getState();
      nextState.settings = {
        ...(nextState.settings || {}),
        organizationVisibleVarKeys: checked,
        organizationVariableLabels: labels,
      };
      await firstValueFrom(
        this.api.put("state", {
          state: nextState,
        }),
      );
      this.state = await this.editorState.loadBootstrap(true);
      this.toast("Variables Organization mises à jour", "success");
    } catch (error: any) {
      this.toast(
        error?.message || "Impossible d'enregistrer les variables Organization",
        "error",
      );
    }
    this.renderOrganizationContent();
  }

  openOrganizationModal(id: string | null = null): void {
    this.editingOrganizationId = id;
    const org = id ? this.organizations.find((o) => o.id === id) : null;
    const title = document.getElementById("organizationModalTitle");
    if (title) {
      title.textContent = id
        ? "Modifier l'Organization"
        : "Nouvelle Organization";
    }
    const nameInput = document.getElementById(
      "organizationName",
    ) as HTMLInputElement | null;
    const cityInput = document.getElementById(
      "organizationCity",
    ) as HTMLInputElement | null;
    const addressInput = document.getElementById(
      "organizationAddress",
    ) as HTMLInputElement | null;
    const phoneInput = document.getElementById(
      "organizationPhone",
    ) as HTMLInputElement | null;
    const emailInput = document.getElementById(
      "organizationEmail",
    ) as HTMLInputElement | null;
    if (nameInput) nameInput.value = org?.nom || "";
    if (cityInput) cityInput.value = org?.ville || "";
    if (addressInput) addressInput.value = org?.["adresse"] || "";
    if (phoneInput) phoneInput.value = org?.["tel"] || "";
    if (emailInput) emailInput.value = org?.["email"] || "";
    this.renderOrganizationExtraFields(org);
    this.openModal("modalOrganization");
  }

  saveOrganization(): void {
    const nameInput = document.getElementById(
      "organizationName",
    ) as HTMLInputElement | null;
    const cityInput = document.getElementById(
      "organizationCity",
    ) as HTMLInputElement | null;
    const addressInput = document.getElementById(
      "organizationAddress",
    ) as HTMLInputElement | null;
    const phoneInput = document.getElementById(
      "organizationPhone",
    ) as HTMLInputElement | null;
    const emailInput = document.getElementById(
      "organizationEmail",
    ) as HTMLInputElement | null;
    const nom = String(nameInput?.value || "").trim();
    if (!nom) {
      this.toast("Le nom est requis", "error");
      return;
    }
    const existing = this.editingOrganizationId
      ? this.organizations.find((o) => o.id === this.editingOrganizationId)
      : null;
    const raw = { ...((existing as any)?.raw || {}) };
    document.querySelectorAll("[data-org-raw-field]").forEach((input) => {
      const field = (input as HTMLInputElement).dataset["orgRawField"] || "";
      raw[field] = (input as HTMLInputElement).value;
    });
    const payload: any = {
      ...(existing || {}),
      id: this.editingOrganizationId || this.genId("org"),
      nom,
      ville: cityInput?.value || "",
      adresse: addressInput?.value || "",
      tel: phoneInput?.value || "",
      email: emailInput?.value || "",
      raw,
      graphicCharters: (existing as any)?.graphicCharters || [],
      createdAt: (existing as any)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizationService
      .save(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeModal("modalOrganization");
          this.renderOrganizationContent();
          this.renderLeftPanel();
          this.toast(
            `Organization ${this.editingOrganizationId ? "mise à jour" : "créée"}`,
            "success",
          );
          this.editingOrganizationId = null;
        },
        error: () => this.toast("Enregistrement impossible", "error"),
      });
  }

  async deleteOrganizationConfirm(id: string): Promise<void> {
    const org = this.organizations.find((o) => o.id === id);
    const confirmed = await this.confirmAction({
      title: "Supprimer l'Organization ?",
      message: `"${org?.nom || org?.name || id}" et son administrateur associé seront supprimés.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;
    this.organizationService
      .delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.renderOrganizationContent();
          this.renderLeftPanel();
          this.toast("Organization supprimée", "success");
        },
        error: () =>
          this.toast("Impossible de supprimer l'Organization", "error"),
      });
  }

  openAdminModal(id: string | null = null): void {
    this.editingAdminId = id;
    const admin = id ? this.admins.find((a) => a.id === id) : null;
    const title = document.getElementById("adminModalTitle");
    if (title) {
      title.textContent = id
        ? "Modifier l'administrateur"
        : "Nouvel administrateur";
    }
    const nameInput = document.getElementById(
      "adminNom",
    ) as HTMLInputElement | null;
    const emailInput = document.getElementById(
      "adminEmail",
    ) as HTMLInputElement | null;
    const profileInput = document.getElementById(
      "adminProfile",
    ) as HTMLInputElement | null;
    const passwordInput = document.getElementById(
      "adminPassword",
    ) as HTMLInputElement | null;
    if (nameInput) nameInput.value = admin?.name || (admin as any)?.nom || "";
    if (emailInput) emailInput.value = admin?.email || "";
    if (profileInput) profileInput.value = (admin as any)?.profile || "";
    if (passwordInput) passwordInput.value = "";
    const sel = document.getElementById(
      "adminOrganization",
    ) as HTMLSelectElement | null;
    if (sel) {
      sel.innerHTML = '<option value="">— Choisir —</option>';
      this.organizations.forEach((org) => {
        const opt = document.createElement("option");
        opt.value = org.id;
        opt.textContent = org.nom || org.id;
        if (admin?.organizationId === org.id) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    this.openModal("modalAdmin");
  }

  saveAdmin(): void {
    const nameInput = document.getElementById(
      "adminNom",
    ) as HTMLInputElement | null;
    const emailInput = document.getElementById(
      "adminEmail",
    ) as HTMLInputElement | null;
    const orgSelect = document.getElementById(
      "adminOrganization",
    ) as HTMLSelectElement | null;
    const profileInput = document.getElementById(
      "adminProfile",
    ) as HTMLInputElement | null;
    const passwordInput = document.getElementById(
      "adminPassword",
    ) as HTMLInputElement | null;
    const name = String(nameInput?.value || "").trim();
    const organizationId = String(orgSelect?.value || "").trim();
    if (!name || !organizationId) {
      this.toast("Nom et Organization requis", "error");
      return;
    }
    const email = String(emailInput?.value || "").trim();
    const profile = String(profileInput?.value || "").trim();
    const password = String(passwordInput?.value || "").trim();
    const existing = this.editingAdminId
      ? this.admins.find((a) => a.id === this.editingAdminId)
      : null;
    const payload: any = {
      ...(existing || {}),
      id: this.editingAdminId || (existing as any)?.id,
      name,
      nom: name,
      email,
      organizationId,
      role: "admin",
      profile,
      raw: {
        ...((existing as any)?.raw || {}),
        Name: name,
        Email: email,
        Role: "admin",
        Profil: profile,
        IdOrganization: organizationId,
        ...(password ? { PassWord: password } : {}),
      },
    };
    if (password) payload.password = password;
    const request$ = this.editingAdminId
      ? this.adminService.update(this.editingAdminId, payload)
      : this.adminService.create(payload);
    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeModal("modalAdmin");
        this.renderAdminContent();
        this.renderLeftPanel();
        this.toast(
          `Administrateur ${this.editingAdminId ? "mis à jour" : "créé"}`,
          "success",
        );
        this.editingAdminId = null;
      },
      error: () => this.toast("Enregistrement impossible", "error"),
    });
  }

  async deleteAdminConfirm(id: string): Promise<void> {
    const admin = this.admins.find((a) => a.id === id);
    const confirmed = await this.confirmAction({
      title: "Supprimer l'administrateur ?",
      message: `"${this.getAdminDisplayName(admin) || id}" sera supprimé.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;
    this.adminService
      .delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.renderAdminContent();
          this.renderLeftPanel();
          this.toast("Admin supprimé", "success");
        },
        error: () =>
          this.toast("Impossible de supprimer l'administrateur", "error"),
      });
  }

  private async newTableViewConfig(): Promise<void> {
    const schema = this.tableViewSchemaCache || (await this.ensureSchemaMeta());
    this.tableViewSchemaCache = schema;
    if (!this.schemaMetaCache) this.schemaMetaCache = schema;
    const defaultTable = this.getAllowedTableViewTables(schema)[0]?.name || "";
    const columns = this.getTableViewColumns(schema, defaultTable);
    const item: TableViewConfig = {
      id: this.genId("tvw"),
      tableName: defaultTable,
      label: defaultTable
        ? this.humanizeSchemaName(defaultTable)
        : "Nouvelle vue",
      visibleFields: columns.slice(0, 5).map((column: any) => column.name),
      editableFields: columns
        .map((column: any) => column.name)
        .filter((field: string) => !/^id$/i.test(field))
        .slice(0, 5),
      previewFields: columns.slice(0, 2).map((column: any) => column.name),
      fieldLabels: {},
      fieldSettings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tableViewService
      .saveConfig(item)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.saveTableViewLocal(saved);
          this.selectedTableViewId = saved.id;
          this.selectedTableViewRowId = null;
          this.selectedTableViewRecord = null;
          this.isCreatingTableViewRow = false;
          this.renderLeftPanel();
          this.renderTableViewsContent();
          this.toast("Vue de données créée", "success");
        },
        error: () => this.toast("Création impossible", "error"),
      });
  }

  private getAllowedTableViewTables(schema: any): any[] {
    return this.getVisibleFamilySchemaTables(
      schema || this.schemaMetaCache,
      [],
    );
  }

  private getTableViewColumns(schema: any, tableName: string): any[] {
    return (schema?.columns || []).filter(
      (column: any) => column.table === tableName,
    );
  }

  tableViewSchemaTables(): any[] {
    return this.getAllowedTableViewTables(
      this.tableViewSchemaCache || this.schemaMetaCache || {},
    );
  }

  tableViewColumnsForSelected(): any[] {
    const view = this.selectedTableView;
    if (!view) return [];
    return this.getTableViewColumns(
      this.tableViewSchemaCache || this.schemaMetaCache || {},
      view.tableName,
    );
  }

  setSelectedTableViewLabel(value: string): void {
    const view = this.selectedTableView;
    if (!view) return;
    view.label = String(value || "");
    view.updatedAt = new Date().toISOString();
    this.saveTableViewLocal(view);
    this.renderLeftPanel();
  }

  setSelectedTableViewTable(tableName: string): void {
    const view = this.selectedTableView;
    if (!view) return;
    this.updateTableViewTable(view.id, tableName);
  }

  toggleSelectedTableViewField(
    fieldKey: "visibleFields" | "editableFields" | "previewFields",
    fieldName: string,
    checked: boolean,
  ): void {
    const view = this.selectedTableView;
    if (!view) return;
    this.toggleTableViewField(view.id, fieldKey, fieldName, checked);
  }

  setSelectedTableViewFieldLabel(fieldName: string, value: string): void {
    const view = this.selectedTableView;
    if (!view) return;
    this.updateTableViewFieldLabel(view.id, fieldName, value);
  }

  isSelectedTableViewFieldChecked(
    fieldKey: "visibleFields" | "editableFields" | "previewFields",
    fieldName: string,
  ): boolean {
    const view = this.selectedTableView;
    if (!view) return false;
    return ((view as any)[fieldKey] || []).includes(fieldName);
  }

  isSelectedTableViewFieldDisabled(
    fieldKey: "visibleFields" | "editableFields" | "previewFields",
    fieldName: string,
  ): boolean {
    const view = this.selectedTableView;
    if (!view) return true;
    if (fieldKey !== "previewFields") return false;
    const selected = new Set(view.previewFields || []);
    return !selected.has(fieldName) && selected.size >= 3;
  }

  getSelectedTableViewFieldSetting(fieldName: string): any {
    const view = this.selectedTableView;
    if (!view) return this.getTableViewFieldSetting({} as any, fieldName);
    return this.getTableViewFieldSetting(view, fieldName);
  }

  setSelectedTableViewFieldSetting(
    fieldName: string,
    prop: string,
    value: string,
  ): void {
    const view = this.selectedTableView;
    if (!view) return;
    this.updateTableViewFieldSetting(view.id, fieldName, prop, value);
  }

  selectedTableViewLookupColumns(fieldName: string): any[] {
    const setting = this.getSelectedTableViewFieldSetting(fieldName);
    if (!setting?.lookupTable) return [];
    const schema = this.tableViewSchemaCache || this.schemaMetaCache || {};
    if (!schema || !schema.columns) return [];
    return this.getTableViewColumns(schema, setting.lookupTable);
  }

  getTableViewFieldLabel(item: TableViewConfig, fieldName: string): string {
    const key = String(fieldName || "").trim();
    return (
      String(item?.fieldLabels?.[key] || "").trim() ||
      this.humanizeSchemaName(key)
    );
  }
  private updateTableViewFieldLabel(
    id: string,
    fieldName: string,
    value: string,
  ): void {
    const item = this.tableViews.find((tv) => tv.id === id);
    if (!item) return;
    const key = String(fieldName || "").trim();
    item.fieldLabels = {
      ...(item.fieldLabels || {}),
      [key]: String(value || "").trim(),
    };
    item.updatedAt = new Date().toISOString();
    this.saveTableViewLocal(item);
    // Force template update by triggering change detection
    this.cdr.markForCheck();
  }

  private getTableViewFieldSetting(item: TableViewConfig, fieldName: string) {
    return (
      item?.fieldSettings?.[String(fieldName || "").trim()] || {
        displayMode: "raw",
        lookupTable: "",
        lookupValueColumn: "",
        lookupLabelColumn: "",
        lookupLabelColumn2: "",
      }
    );
  }
  private updateTableViewFieldSetting(
    id: string,
    fieldName: string,
    prop: string,
    value: string,
  ): void {
    const item = this.tableViews.find((tv) => tv.id === id);
    if (!item) return;
    const key = String(fieldName || "").trim();
    const settings = {
      ...(item.fieldSettings || {}),
    };
    const current = {
      ...(settings[key] || {}),
    } as any;
    current.displayMode = current.displayMode || "raw";
    current.lookupTable = current.lookupTable || "";
    current.lookupValueColumn = current.lookupValueColumn || "";
    current.lookupLabelColumn = current.lookupLabelColumn || "";
    current.lookupLabelColumn2 = current.lookupLabelColumn2 || "";
    (current as any)[prop] = value || "";
    if (prop === "displayMode" && value !== "lookup") {
      current.displayMode = "raw";
    }
    if (prop === "lookupTable") {
      current.lookupValueColumn = "";
      current.lookupLabelColumn = "";
      current.lookupLabelColumn2 = "";
      // Clear cache for this field to force reload
      const cacheKey = `${id}::${fieldName}`;
      delete this.tableViewLookupOptionsCache[cacheKey];
    }
    settings[key] = current;
    item.fieldSettings = settings;
    item.updatedAt = new Date().toISOString();
    this.saveTableViewLocal(item);
    this.tableViewLookupOptionsCache = {};
    void this.renderTableViewPreview();
  }

  private getTableViewLookupCacheKey(
    item: TableViewConfig,
    fieldName: string,
  ): string {
    return `${item.id}::${fieldName}`;
  }

  private async ensureTableViewLookupOptions(
    item: TableViewConfig,
    fieldName: string,
  ): Promise<any[]> {
    const key = this.getTableViewLookupCacheKey(item, fieldName);
    if (this.tableViewLookupOptionsCache[key])
      return this.tableViewLookupOptionsCache[key];
    const config = this.getTableViewFieldSetting(item, fieldName);
    if (
      !config.lookupTable ||
      !config.lookupValueColumn ||
      !config.lookupLabelColumn
    ) {
      this.tableViewLookupOptionsCache[key] = [];
      return [];
    }
    const options = await firstValueFrom(
      this.tableViewService.getLookupOptions({
        configId: item.id,
        fieldName,
        config: item,
      }),
    );
    this.tableViewLookupOptionsCache[key] = options || [];
    return this.tableViewLookupOptionsCache[key];
  }

  resolveTableViewDisplayValue(
    item: TableViewConfig,
    fieldName: string,
    rawValue: any,
  ): string {
    const config = this.getTableViewFieldSetting(item, fieldName);
    if (config.displayMode !== "lookup") return String(rawValue ?? "");
    const options =
      this.tableViewLookupOptionsCache[
        this.getTableViewLookupCacheKey(item, fieldName)
      ] || [];
    const match = options.find(
      (option: any) => String(option.value || "") === String(rawValue ?? ""),
    );
    return match ? String(match.label || "") : String(rawValue ?? "");
  }

  private buildTableViewPreviewLabel(
    item: TableViewConfig,
    record: any = {},
  ): string {
    const parts = (item?.previewFields || [])
      .map((field) =>
        this.resolveTableViewDisplayValue(item, field, record?.[field]),
      )
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    return parts.join(" - ").trim();
  }

  private updateTableViewDraft(id: string, field: string, value: string): void {
    const item = this.tableViews.find((tv) => tv.id === id);
    if (!item) return;
    (item as any)[field] = value;
    item.updatedAt = new Date().toISOString();
    this.saveTableViewLocal(item);
    this.renderLeftPanel();
  }

  private updateTableViewTable(id: string, tableName: string): void {
    const item = this.tableViews.find((tv) => tv.id === id);
    if (!item) return;
    const columns = this.getTableViewColumns(
      this.tableViewSchemaCache,
      tableName,
    );
    item.tableName = tableName;
    if (!String(item.label || "").trim()) {
      item.label = this.humanizeSchemaName(tableName);
    }
    item.visibleFields = columns.slice(0, 5).map((column: any) => column.name);
    item.previewFields = columns.slice(0, 3).map((column: any) => column.name);
    item.editableFields = columns
      .map((column: any) => column.name)
      .filter((fieldName: string) => !/^id$/i.test(fieldName))
      .slice(0, 5);

    // Initialize fieldSettings and fieldLabels for new columns
    item.fieldSettings = item.fieldSettings || {};
    item.fieldLabels = item.fieldLabels || {};
    const visibleFieldsSet = new Set(item.visibleFields);
    for (const fieldName of visibleFieldsSet) {
      if (!item.fieldSettings[fieldName]) {
        item.fieldSettings[fieldName] = {
          displayMode: "raw",
          lookupTable: "",
          lookupValueColumn: "",
          lookupLabelColumn: "",
          lookupLabelColumn2: "",
        };
      }
      if (!item.fieldLabels[fieldName]) {
        item.fieldLabels[fieldName] = this.humanizeSchemaName(fieldName);
      }
    }

    item.updatedAt = new Date().toISOString();
    this.saveTableViewLocal(item);
    this.selectedTableViewRowId = null;
    this.selectedTableViewRecord = null;
    this.tableViewLookupOptionsCache = {};
    this.renderLeftPanel();
    this.renderTableViewsContent();
    void this.reloadTableViewRows();
  }

  private toggleTableViewField(
    id: string,
    fieldKey: string,
    fieldName: string,
    checked: boolean,
  ): void {
    const item = this.tableViews.find((tv) => tv.id === id);
    if (!item) return;
    const values = new Set((item as any)[fieldKey] || []);
    if (checked) values.add(fieldName);
    else values.delete(fieldName);
    (item as any)[fieldKey] = [...values];
    item.previewFields = (item.previewFields || [])
      .filter((field) => (item.visibleFields || []).includes(field))
      .slice(0, 3);
    item.editableFields = (item.editableFields || []).filter((field) =>
      (item.visibleFields || []).includes(field),
    );
    item.updatedAt = new Date().toISOString();
    this.saveTableViewLocal(item);
    this.renderLeftPanel();
    this.renderTableViewsContent();
  }

  private saveTableViewLocal(item: TableViewConfig): void {
    const normalized = normalizeTableViewRecord(item);
    const state = this.editorState.getState();
    const index = state.tableViews.findIndex(
      (view) => view.id === normalized.id,
    );
    index >= 0
      ? state.tableViews.splice(index, 1, normalized)
      : state.tableViews.push(normalized);
    this.replaceState(state);
  }

  saveTableViewConfig(id: string): void {
    const item = this.tableViews.find((tv) => tv.id === id);
    if (!item) return;
    if (!item.tableName) {
      this.toast("Choisissez une table source", "error");
      return;
    }
    if (!(item.visibleFields || []).length) {
      this.toast("Choisissez au moins un champ visible", "error");
      return;
    }
    if (!(item.previewFields || []).length || item.previewFields.length > 3) {
      this.toast("Choisissez entre 1 et 3 champs d'aperçu", "error");
      return;
    }
    item.updatedAt = new Date().toISOString();
    this.tableViewService
      .saveConfig(item)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.toast("Vue enregistrée", "success"),
        error: () => this.toast("Enregistrement impossible", "error"),
      });
  }

  async deleteTableViewConfig(id: string): Promise<void> {
    const item = this.tableViews.find((tv) => tv.id === id);
    if (!item) return;
    const confirmed = await this.confirmAction({
      title: "Supprimer la vue ?",
      message: `La vue "${item.label || item.tableName}" sera supprimée.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;
    this.tableViewService
      .deleteConfig(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.syncStateFromStore();
          this.selectedTableViewId = null;
          this.selectedTableViewRowId = null;
          this.selectedTableViewRecord = null;
          this.isCreatingTableViewRow = false;
          this.renderLeftPanel();
          this.renderTableViewsContent();
          this.toast("Vue supprimée", "success");
        },
        error: () => this.toast("Suppression impossible", "error"),
      });
  }

  updateTableViewSearch(value: string): void {
    this.tableViewSearch = String(value || "");
  }

  updateTableViewSearchFromEvent(event: Event): void {
    this.updateTableViewSearch(
      (event.target as HTMLInputElement | null)?.value || "",
    );
  }

  private async renderTableViewPreview(): Promise<void> {
    const item = this.selectedTableViewId
      ? this.tableViews.find((tv) => tv.id === this.selectedTableViewId)
      : null;
    if (!item) return;
    const lookupFields = Object.entries(item.fieldSettings || {})
      .filter(([, config]) => (config as any)?.displayMode === "lookup")
      .map(([field]) => field);
    for (const fieldName of lookupFields) {
      try {
        await this.ensureTableViewLookupOptions(item, fieldName);
      } catch (_) {}
    }
    if (this.selectedTableViewRowId && !this.isCreatingTableViewRow) {
      this.selectedTableViewRecord = this.cloneData(
        this.tableViewRowsCache.find(
          (row) => this.getTableViewRowId(row) === this.selectedTableViewRowId,
        ) || null,
      );
    }
  }
  async reloadTableViewRows(): Promise<void> {
    const item = this.selectedTableViewId
      ? this.tableViews.find((tv) => tv.id === this.selectedTableViewId)
      : null;
    if (!item) return;
    try {
      const response = await firstValueFrom(
        this.tableViewService.getRows({
          configId: item.id,
          config: item,
          search: String(this.tableViewSearch || "").trim(),
          limit: 200,
        }),
      );
      this.tableViewRowsCache = response?.rows || [];
      if (!this.selectedTableViewRowId && this.tableViewRowsCache.length) {
        this.selectedTableViewRowId = String(
          (this.tableViewRowsCache[0] as any).id ??
            (this.tableViewRowsCache[0] as any).Id ??
            Object.values(this.tableViewRowsCache[0] as any)[0],
        );
      }
      if (
        this.selectedTableViewRowId &&
        !this.isCreatingTableViewRow &&
        !this.tableViewRowsCache.some((row) => {
          const rowId = String(
            (row as any).id ?? (row as any).Id ?? Object.values(row as any)[0],
          );
          return rowId === this.selectedTableViewRowId;
        })
      ) {
        this.selectedTableViewRowId = this.tableViewRowsCache.length
          ? String(
              (this.tableViewRowsCache[0] as any).id ??
                (this.tableViewRowsCache[0] as any).Id ??
                Object.values(this.tableViewRowsCache[0] as any)[0],
            )
          : null;
      }
      this.selectedTableViewRecord =
        this.selectedTableViewRowId && !this.isCreatingTableViewRow
          ? this.cloneData(
              this.tableViewRowsCache.find((row) => {
                const rowId = String(
                  (row as any).id ??
                    (row as any).Id ??
                    Object.values(row as any)[0] ??
                    "",
                );
                return rowId === this.selectedTableViewRowId;
              }) || null,
            )
          : null;
      await this.renderTableViewPreview();
    } catch (error: any) {
      this.toast(
        error?.message || "Impossible de charger les lignes.",
        "error",
      );
    }
  }

  selectTableViewRow(rowId: string): void {
    this.isCreatingTableViewRow = false;
    this.selectedTableViewRowId = rowId;
    this.selectedTableViewRecord = this.cloneData(
      this.tableViewRowsCache.find((row) => {
        const currentRowId = String(
          (row as any).id ??
            (row as any).Id ??
            Object.values(row as any)[0] ??
            "",
        );
        return currentRowId === rowId;
      }) || null,
    );
    void this.renderTableViewPreview();
  }

  async saveSelectedTableViewRow(): Promise<void> {
    const item = this.selectedTableViewId
      ? this.tableViews.find((tv) => tv.id === this.selectedTableViewId)
      : null;
    if (!item || (!this.selectedTableViewRowId && !this.isCreatingTableViewRow))
      return;
    const rowId = this.selectedTableViewRowId;
    if (!this.isCreatingTableViewRow && !rowId) return;
    const updateRowId = rowId as string;
    const values = Object.fromEntries(
      (item.editableFields || []).map((field) => [
        field,
        this.selectedTableViewRecord?.[field] ?? "",
      ]),
    );
    try {
      if (this.isCreatingTableViewRow) {
        const created = await firstValueFrom(
          this.tableViewService.createRecord({
            configId: item.id,
            values,
            config: item,
          }),
        );
        this.selectedTableViewRecord = created as any;
        this.selectedTableViewRowId = String(
          (created as any)?.id ??
            (created as any)?.Id ??
            Object.values(created as any)[0] ??
            "",
        );
        this.isCreatingTableViewRow = false;
        this.toast("Ligne ajoutée", "success");
      } else {
        const updated = await firstValueFrom(
          this.tableViewService.updateRecord({
            configId: item.id,
            rowId: updateRowId,
            values,
          }),
        );
        this.selectedTableViewRecord = updated as any;
        this.toast("Ligne enregistrée", "success");
      }
      await this.reloadTableViewRows();
    } catch (error: any) {
      this.toast(error?.message || "Enregistrement impossible", "error");
    }
  }

  async createTableViewRow(): Promise<void> {
    const item = this.selectedTableViewId
      ? this.tableViews.find((tv) => tv.id === this.selectedTableViewId)
      : null;
    if (!item) return;
    this.isCreatingTableViewRow = true;
    this.selectedTableViewRowId = null;
    this.selectedTableViewRecord = {};
    (item.visibleFields || []).forEach((field) => {
      (this.selectedTableViewRecord as any)[field] = "";
    });
    await this.renderTableViewPreview();
  }

  async deleteSelectedTableViewRow(): Promise<void> {
    const item = this.selectedTableViewId
      ? this.tableViews.find((tv) => tv.id === this.selectedTableViewId)
      : null;
    if (!item || (!this.selectedTableViewRowId && !this.isCreatingTableViewRow))
      return;

    if (this.isCreatingTableViewRow) {
      const confirmed = await this.confirmAction({
        title: "Annuler la nouvelle ligne ?",
        message: "Les valeurs saisies seront perdues.",
        confirmText: "Annuler la saisie",
        actionType: "warning",
      });
      if (!confirmed) return;
      this.isCreatingTableViewRow = false;
      this.selectedTableViewRowId = this.tableViewRowsCache.length
        ? this.getTableViewRowId(this.tableViewRowsCache[0])
        : null;
      this.selectedTableViewRecord = null;
      await this.renderTableViewPreview();
      return;
    }

    const selectedRow =
      this.selectedTableViewRecord ||
      this.tableViewRowsCache.find(
        (row) => this.getTableViewRowId(row) === this.selectedTableViewRowId,
      ) ||
      {};
    const previewLabel =
      this.buildTableViewPreviewLabel(item, selectedRow) ||
      this.selectedTableViewRowId ||
      "";
    const confirmed = await this.confirmAction({
      title: "Supprimer la ligne ?",
      message: `La ligne "${previewLabel}" sera supprim�e de ${item.tableName}.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;

    try {
      await firstValueFrom(
        this.tableViewService.deleteRecord({
          configId: item.id,
          rowId: this.selectedTableViewRowId as string,
        }),
      );
      this.selectedTableViewRowId = null;
      this.selectedTableViewRecord = null;
      this.isCreatingTableViewRow = false;
      this.toast("Ligne supprim�e", "success");
      await this.reloadTableViewRows();
    } catch (error: any) {
      this.toast(error?.message || "Suppression impossible", "error");
    }
  }

  private cloneData<T>(value: T): T {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  private humanizeSchemaName(value: string): string {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private escJs(value: string): string {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/<\/script/gi, "<\\/script");
  }

  private buildDistinctFilterSqlQuery(builder: any, schema: any): string {
    const normalized = normalizeFilterSqlBuilder(builder);
    if (!normalized.tableName || !normalized.valueColumn) return "";
    const tableColumns = this.getColumnsForTable(schema, normalized.tableName);
    const hasOrgColumn = tableColumns.some(
      (column: any) => column.name === "etablissement_id",
    );
    const labelExpr = normalized.labelColumn
      ? `COALESCE(CONVERT(NVARCHAR(255), [${normalized.labelColumn.replace(/]/g, "]]")}]), CONVERT(NVARCHAR(255), [${normalized.valueColumn.replace(/]/g, "]]")}]))`
      : `CONVERT(NVARCHAR(255), [${normalized.valueColumn.replace(/]/g, "]]")}])`;
    return [
      "SELECT DISTINCT",
      `  CONVERT(NVARCHAR(255), [${normalized.valueColumn.replace(/]/g, "]]")}]) AS value,`,
      `  ${labelExpr} AS label`,
      `FROM [${normalized.tableName.replace(/]/g, "]]")}]`,
      `WHERE [${normalized.valueColumn.replace(/]/g, "]]")}] IS NOT NULL${
        hasOrgColumn
          ? `\n  AND (:organizationId IS NULL OR [etablissement_id] = :organizationId)`
          : ""
      }`,
      "ORDER BY label ASC",
    ].join("\n");
  }
}
