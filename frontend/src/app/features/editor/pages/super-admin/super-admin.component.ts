import {
  Component,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
  NgZone,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { Subject, firstValueFrom } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { TableViewFiltersConfigComponent } from "./components/table-view-filters-config/table-view-filters-config.component";

import { AuthService } from "../../../../core/services/auth.service";
import { ApiService } from "../../../../core/services/api.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { OrganizationService } from "../../services/organization.service";
import { AdminAccountService } from "../../services/admin-account.service";
import { TableViewService } from "../../services/table-view.service";
import { ModuleService } from "../../services/module.service";

import { EditorState as AppState } from "../../models/editor-common.model";
import { FamilyRecord as Family } from "../../models/family.model";
import { OrganizationRecord as Organization } from "../../models/organization.model";
import { AdminAccountRecord as AdminAccount } from "../../models/admin-account.model";
import { TableViewConfig } from "../../models/table-view.model";
import { ModuleRecord as Module } from "../../models/module.model";
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
import { ModuleListComponent } from "./components/module-list/module-list.component";
import { ModuleFormComponent } from "./components/module-form/module-form.component";

@Component({
  selector: "app-super-admin",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    ModuleListComponent,
    ModuleFormComponent,
    TableViewFiltersConfigComponent,
  ],
  templateUrl: "./super-admin.component.html",
  styleUrls: ["./super-admin.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class SuperAdminComponent implements OnInit, OnDestroy {
  // --- MODULES STATE ---
  modules: Module[] = [];
  selectedModuleId: string | null = null;
  selectedModule: Module | null = null;
  isCreatingModule = false;
  isEditingModule = false;
  moduleDraft: Module = this.createEmptyModule();

  isLoading = false;
  private destroy$ = new Subject<void>();
  private state: AppState | null = null;
  // Phase 4 Tranche 5: modalClickHandler + modalKeydownHandler nettoyés —
  // plus de DOM legacy modals, uniquement les modales Angular state.
  private modalClickHandler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.classList?.contains("modal-overlay")) return;
    if (target.getAttribute("data-modal-id") === "org") {
      this.isOrganizationModalOpen = false;
      this.cdr.markForCheck();
    } else if (target.getAttribute("data-modal-id") === "admin") {
      this.isAdminModalOpen = false;
      this.cdr.markForCheck();
    }
  };

  private modalKeydownHandler = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (this.isOrganizationModalOpen) {
      this.isOrganizationModalOpen = false;
      this.cdr.markForCheck();
    }
    if (this.isAdminModalOpen) {
      this.isAdminModalOpen = false;
      this.cdr.markForCheck();
    }
  };

  currentSection = "families";
  panelSearch = "";
  selectedFamId: string | null = null;
  selectedTableViewId: string | null = null;
  private editingOrganizationId: string | null = null;
  private editingAdminId: string | null = null;

  // ── Angular modal state — Organization ──
  isOrganizationModalOpen = false;
  organizationModalTitle = "Nouvelle Organization";
  orgDraft: {
    nom: string;
    ville: string;
    adresse: string;
    tel: string;
    email: string;
    extraFields: Array<{ key: string; value: string }>;
  } = { nom: "", ville: "", adresse: "", tel: "", email: "", extraFields: [] };

  // ── Angular modal state — Admin ──
  isAdminModalOpen = false;
  adminModalTitle = "Nouvel administrateur";
  adminDraft: {
    nom: string;
    email: string;
    organizationId: string;
    profile: string;
    password: string;
  } = { nom: "", email: "", organizationId: "", profile: "", password: "" };
  private tableViewSchemaCache: any = null;
  tableViewRowsCache: any[] = [];
  selectedTableViewRowId: string | null = null;
  selectedTableViewRecord: any = null;
  tableViewSearch = "";
  isCreatingTableViewRow = false;
  databaseSchema: any = null;
  beneficiaryPreviewText =
    'Cliquez sur "Tester la liste" pour voir un bénéficiaire retourné.';

  // ── Angular state for the beneficiary block (replaces renderFamilyBeneficiaryTableSelect) ──
  beneficiaryLoadState: "idle" | "loading" | "loaded" | "error" = "idle";
  beneficiaryLoadError = "";
  beneficiaryVisibleTables: Array<{ name: string; comment?: string }> = [];
  beneficiaryTableColumns: Array<{
    name: string;
    key?: string;
    comment?: string;
  }> = [];
  // ── Angular state for the general-info block (replaces DOM reads in saveFamily) ──
  familyDraftNom = "";
  familyDraftDescription = "";
  familyDraftSql = "";
  private tableViewLookupOptionsCache: Record<string, any[]> = {};
  private tableViewDebugLogKeys = new Set<string>();
  private schemaMetaCache: any = null;
  selectedSchemaOrganizationId: string | null = null;
  selectedSchemaDatabaseName: string | null = null;
  private schemaBuilderState: Record<string, any> = {};
  // ── Angular state — schema preview box ──
  schemaPreviewText =
    'Cliquez sur "Tester id=1" pour voir le premier enregistrement retourné.';
  schemaPreviewState: "idle" | "loading" | "error" = "idle";
  /** Draft pour le select "Ajouter table secondaire" — piloté par [(ngModel)] */
  schemaSecondaryTableDraft = "";
  // ── Angular state — Classes & Variables (Phase 4 Tranche 3) ──
  readonly CLASS_COLORS = [
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
  newVarDrafts: Array<{ tech: string; label: string; type: string }> = [];
  tempColsByClass: Array<Array<{ key: string; label: string }>> = [];
  newTempColDrafts: Array<{ key: string; label: string }> = [];
  addColDrafts: Record<
    string,
    { source: string; key: string; label: string; mode: string }
  > = {};
  listObjectSqlPreviews: Record<string, string> = {};
  listObjectSqlLoading: Record<string, boolean> = {};
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
    private router: Router,
    private api: ApiService,
    private editorState: EditorStateService,
    private familyService: FamilyService,
    private organizationService: OrganizationService,
    private adminService: AdminAccountService,
    private tableViewService: TableViewService,
    private moduleService: ModuleService,
    private notifications: NotificationService,
    private dialog: MatDialog,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Phase 4 Tranche 5: bindLegacyWindow() supprimée — 100% Angular
    this.bindModalHandlers();
    this.isLoading = true;

    this.editorState.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.state = state;
        this.modules = state.modules || [];
        this.updateSelectedModule();
        this.cdr.markForCheck();
      });

    void this.initializeState();

    if (this.selectedSchemaDatabaseName) {
      this.loadDatabaseSchema();
    }
  }

  private updateSelectedModule() {
    if (this.selectedModuleId) {
      this.selectedModule =
        this.modules.find((m) => m.id === this.selectedModuleId) || null;
    } else {
      this.selectedModule = null;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Phase 4 Tranche 5: unbindLegacyWindow() supprimée — 100% Angular
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

  get tableViews(): TableViewConfig[] {
    return this.state?.tableViews ?? [];
  }

  get filteredModules(): Module[] {
    const s = (this.panelSearch || "").toLowerCase();
    return this.modules.filter((m) => m.name.toLowerCase().includes(s));
  }

  get panelTitle(): string {
    return this.getSectionMeta(this.currentSection).panelTitle;
  }

  get panelSubtitle(): string {
    return "Structure globale du système";
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

  onFiltersChanged(updatedView: TableViewConfig | null): void {
    if (!updatedView) return;
    const index = this.tableViews.findIndex((v) => v.id === updatedView.id);
    if (index >= 0) {
      this.tableViews[index] = { ...updatedView };
      this.cdr.markForCheck();
    }
  }

  loadDatabaseSchema(): void {
    if (!this.selectedSchemaDatabaseName) return;
    const url = `schema?databaseName=${encodeURIComponent(
      this.selectedSchemaDatabaseName,
    )}`;
    this.api
      .get<any>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (payload) => {
          this.databaseSchema = payload?.schema || payload;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error("Erreur lors du chargement du schéma:", err);
        },
      });
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
    // PHASE 4 TRANCHE 2: opacity now driven by Angular [style.opacity] binding on #app
    // isLoading=false triggers the binding — no DOM manipulation needed
    this.cdr.markForCheck();
  }

  // Phase 4 Tranche 5: bindLegacyWindow + unbindLegacyWindow supprimées.
  // Le composant est 100% Angular state-driven — aucun win.* nécessaire.

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
      modules: {
        panelTitle: "Modules Métier",
        addLabel: "Nouveau module",
        topbar: "Configuration des modules",
      },
    };
    return meta[section] || meta["families"];
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
      if (section === "modules" && !this.modules.length) {
        await this.editorState.ensureResources("modules");
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

  /** Templates belonging to the currently selected family — used by Angular template */
  get selectedFamilyTemplates(): any[] {
    if (!this.selectedFamId) return [];
    return this.templates.filter((t) => t.familyId === this.selectedFamId);
  }

  /** Classes array for the currently selected family — used by Angular template */
  get selectedFamilyClasses(): any[] {
    return this.selectedFamily?.classes || [];
  }

  private initClassDrafts(classes: any[]): void {
    this.newVarDrafts = classes.map(() => ({
      tech: "",
      label: "",
      type: "scalar",
    }));
    this.tempColsByClass = classes.map(() => []);
    this.newTempColDrafts = classes.map(() => ({ key: "", label: "" }));
    this.addColDrafts = {};
    this.listObjectSqlPreviews = {};
    this.listObjectSqlLoading = {};
  }

  ensureClassDrafts(classes: any[]): void {
    while (this.newVarDrafts.length < classes.length)
      this.newVarDrafts.push({ tech: "", label: "", type: "scalar" });
    while (this.tempColsByClass.length < classes.length)
      this.tempColsByClass.push([]);
    while (this.newTempColDrafts.length < classes.length)
      this.newTempColDrafts.push({ key: "", label: "" });
  }

  getAvailableVarSourceColumnsPublic(v: any): any[] {
    return this.getAvailableVarSourceColumns(v);
  }

  getLookupTableOptions(selectedTable: string): any[] {
    if (!this.schemaMetaCache) return [];
    return this.getVisibleFamilySchemaTables(
      this.schemaMetaCache,
      selectedTable ? [selectedTable] : [],
    );
  }

  getLookupColumnOptions(tableName: string): any[] {
    if (!this.schemaMetaCache || !tableName) return [];
    return this.getColumnsForTable(this.schemaMetaCache, tableName);
  }

  getAddColDraft(
    ci: number,
    vi: number,
  ): { source: string; key: string; label: string; mode: string } {
    const k = `${ci}_${vi}`;
    if (!this.addColDrafts[k])
      this.addColDrafts[k] = { source: "", key: "", label: "", mode: "schema" };
    return this.addColDrafts[k];
  }

  getVarPillTech(v: any): string {
    const prefix = v.type === "list-object" || v.type === "list" ? "#" : "";
    const suffix = v.type === "list-object" ? ":table" : "";
    return "{{" + prefix + (v.tech || "") + suffix + "}}";
  }

  getVarSqlPlaceholder(v: any): string {
    return "{{#" + (v.tech || "") + ":table}}";
  }

  getListObjectSqlPreview(ci: number, vi: number, v: any): string {
    const k = `${ci}_${vi}`;
    if (this.listObjectSqlPreviews[k]) return this.listObjectSqlPreviews[k];
    const sqlQuery = String(v?.sqlQuery || "").trim();
    return sqlQuery
      ? 'Cliquez sur "Tester la requête" pour voir les premières lignes.'
      : "Aucune requête SQL dédiée. La variable utilise le mode lié au schéma.";
  }

  getVarDisplayColumns(v: any): any[] {
    return this.getListObjectDisplayColumns(v);
  }

  getSimpleVarBinding(
    v: any,
    ci: number,
    famId: string,
  ): {
    show: boolean;
    mode: string;
    canAuto: boolean;
    relationInfo: string;
    baseColumns: any[];
    sourceColumns: any[];
    canManual: boolean;
  } {
    const empty = {
      show: false,
      mode: "auto",
      canAuto: false,
      relationInfo: "",
      baseColumns: [],
      sourceColumns: [],
      canManual: false,
    };
    if (!this.schemaMetaCache || !v?.sourceTable) return empty;
    const fam = this.getFamily(famId);
    if (!fam) return empty;
    const baseTable =
      this.getBuilderState(famId, fam, this.schemaMetaCache).baseTable ||
      v.baseTable ||
      "";
    if (!baseTable || v.sourceTable === baseTable) return empty;
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
    return {
      show: true,
      mode,
      canAuto,
      relationInfo,
      baseColumns,
      sourceColumns,
      canManual,
    };
  }

  /** Total var count across all classes — used by Angular template */
  get selectedFamilyAllVarsCount(): number {
    return (this.selectedFamily?.classes || []).flatMap(
      (c: any) => c.vars || [],
    ).length;
  }

  /** List-object var count — used by Angular template */
  get selectedFamilyListObjectVarsCount(): number {
    return (this.selectedFamily?.classes || [])
      .flatMap((c: any) => c.vars || [])
      .filter((v: any) => v.type === "list-object").length;
  }

  /** Organization name for a template — used by Angular template */
  getTemplateOrganizationName(organizationId: string): string {
    return this.organizations.find((o) => o.id === organizationId)?.nom || "—";
  }

  /** Format a date for display — used by Angular template */
  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return new Date().toLocaleDateString("fr-FR");
    return new Date(dateStr).toLocaleDateString("fr-FR");
  }

  /** Hidden tables hint string — used by Angular template */
  get hiddenFamilyTablesHint(): string {
    return this.hiddenFamilyTables.join(", ");
  }

  /**
   * Computed data for the schema builder Angular template.
   * Returns null while schema is loading (shows a spinner).
   */
  get schemaBuilderData(): {
    famId: string;
    state: any;
    baseTableOptions: any[];
    secondaryTableOptions: any[];
    visibleTables: any[];
    hiddenTablesHint: string;
  } | null {
    if (!this.selectedFamId || !this.schemaMetaCache) return null;
    const famId = this.selectedFamId;
    const fam = this.getFamily(famId);
    if (!fam) return null;
    const schema = this.schemaMetaCache;
    const state = this.getBuilderState(famId, fam, schema);
    const baseTableOptions = this.getFamilyVisibleTables(schema, fam);
    const allVisibleTableNames = baseTableOptions.map((t: any) => t.name);
    const visibleTables = [
      state.baseTable,
      ...(state.secondaryTables || []),
    ].filter(
      (name: string, idx: number, list: string[]) =>
        name &&
        allVisibleTableNames.includes(name) &&
        list.indexOf(name) === idx,
    );
    const secondaryTableOptions = baseTableOptions.filter(
      (t: any) => t.name !== state.baseTable && !visibleTables.includes(t.name),
    );
    return {
      famId,
      state,
      baseTableOptions,
      secondaryTableOptions,
      visibleTables,
      hiddenTablesHint: this.hiddenFamilyTables.join(", "),
    };
  }

  /** Returns meta for a table from the current schema cache */
  getSchemaTableMeta(tableName: string): any {
    if (!this.schemaMetaCache) return null;
    return this.getTableMeta(this.schemaMetaCache, tableName);
  }

  /** Returns columns for a table from the current schema cache */
  getSchemaTableColumns(tableName: string): any[] {
    if (!this.schemaMetaCache) return [];
    return this.getColumnsForTable(this.schemaMetaCache, tableName);
  }

  /** Returns the join path label for a table relative to the base table */
  getSchemaRelationLabel(state: any, tableName: string): string {
    if (tableName === state.baseTable) return "Base";
    const relPath = this.schemaMetaCache
      ? this.getJoinPlan(this.schemaMetaCache, state.baseTable, tableName)
      : null;
    return relPath?.length ? "Join" : "Reference";
  }

  /** Returns the CSS chip class for the relation label */
  getSchemaRelationTone(state: any, tableName: string): string {
    if (tableName === state.baseTable) return "chip-purple";
    const relPath = this.schemaMetaCache
      ? this.getJoinPlan(this.schemaMetaCache, state.baseTable, tableName)
      : null;
    return relPath?.length ? "chip-teal" : "chip";
  }

  /** Returns human-readable join summary for a table */
  getSchemaRelationSummary(state: any, tableName: string): string {
    if (tableName === state.baseTable) return "Table principale active";
    const relPath = this.schemaMetaCache
      ? this.getJoinPlan(this.schemaMetaCache, state.baseTable, tableName)
      : null;
    if (relPath?.length) {
      return relPath
        .map(
          (step: any) =>
            `${step.relation.table}.${step.relation.column} -> ${step.relation.referencedTable}.${step.relation.referencedColumn}`,
        )
        .join(" | ");
    }
    return "Aucune jointure automatique detectee. Vous pouvez tout de meme ajouter des variables puis definir une correspondance manuelle.";
  }

  /** Returns whether a column is selected in the schema builder */
  isSchemaColumnSelected(
    state: any,
    tableName: string,
    colName: string,
  ): boolean {
    return !!state.selectedColumns[`${tableName}.${colName}`];
  }

  /** Beneficiary table name for selected family — used by Angular template */
  get selectedFamilyBeneficiaryTableName(): string {
    if (!this.selectedFamily || !this.schemaMetaCache) return "";
    return this.getFamilyBeneficiaryTable(this.selectedFamily);
  }

  /** Beneficiary table label placeholder — used by Angular template */
  get selectedFamilyBeneficiaryTablePlaceholder(): string {
    const tableName = this.selectedFamilyBeneficiaryTableName;
    return tableName ? this.humanizeSchemaName(tableName) : "Ex: Étudiant";
  }

  familyBeneficiaryMeta(family: Family): string {
    return family.beneficiaryMode === "organization"
      ? "lie a l'Organization"
      : `beneficiaire: ${family.beneficiaryTable || "non defini"}`;
  }

  async selectFamilyFromPanel(familyId: string): Promise<void> {
    this.selectedFamId = familyId;
    const fam = this.getFamily(familyId);
    try {
      await this.useSchemaForOrganizationIds(fam?.organizationIds);
      await this.ensureSchemaMeta();
    } catch (e) {
      // Continue rendering even if schema fails
    }
    this.populateFamilyDraftFields(familyId);
    this.initClassDrafts(fam?.classes || []);
    await this.loadBeneficiaryState(familyId);
    this.renderLegacyFamilySubSections(familyId);
  }

  /** Populate Angular-bound draft fields from the family state object */
  private populateFamilyDraftFields(famId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    this.familyDraftNom = fam.nom || "";
    this.familyDraftDescription = fam.description || "";
    this.familyDraftSql = fam.sql || "";
    this.cdr.markForCheck();
  }

  /** Load schema data for the beneficiary block into Angular state */
  async loadBeneficiaryState(famId: string): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;

    if (fam.beneficiaryMode === "organization") {
      this.beneficiaryLoadState = "loaded";
      this.beneficiaryVisibleTables = [];
      this.beneficiaryTableColumns = [];
      this.cdr.markForCheck();
      return;
    }

    this.beneficiaryLoadState = "loading";
    this.beneficiaryLoadError = "";
    this.cdr.markForCheck();

    try {
      const schema = await this.ensureSchemaMeta();
      const visibleTables = this.getVisibleFamilySchemaTables(schema, [
        fam.beneficiaryTable,
      ]);
      const configuredTableName = this.getFamilyBeneficiaryTable(fam);
      const tableName = this.resolveSchemaTableName(configuredTableName);
      const tableColumns = this.getColumnsForTable(schema, tableName);
      const configuredLinkColumn = this.resolveSchemaColumnName(
        tableName,
        fam.beneficiaryLinkColumn || "",
      );
      const configuredDisplayColumn1 = this.resolveSchemaColumnName(
        tableName,
        fam.beneficiaryDisplayColumn1 || "",
      );
      const configuredDisplayColumn2 = this.resolveSchemaColumnName(
        tableName,
        fam.beneficiaryDisplayColumn2 || "",
      );
      const tableLinkColumn = this.getFamilyBeneficiaryLinkColumn(
        {
          ...fam,
          beneficiaryTable: tableName,
          beneficiaryLinkColumn: configuredLinkColumn,
        },
        schema,
      );
      const suggestedColumns = this.getSuggestedBeneficiaryDisplayColumns(
        {
          ...fam,
          beneficiaryDisplayColumn1: configuredDisplayColumn1,
          beneficiaryDisplayColumn2: configuredDisplayColumn2,
        },
        schema,
        tableName,
      );

      // Auto-populate defaults (same logic as former renderFamilyBeneficiaryTableSelect)
      let hasAutoPopulatedChanges = false;

      if (tableName && tableName !== configuredTableName) {
        fam.beneficiaryTable = tableName;
        hasAutoPopulatedChanges = true;
      }
      if (tableLinkColumn && tableLinkColumn !== fam.beneficiaryLinkColumn) {
        fam.beneficiaryLinkColumn = tableLinkColumn;
        hasAutoPopulatedChanges = true;
      }
      if (
        configuredDisplayColumn1 &&
        configuredDisplayColumn1 !== fam.beneficiaryDisplayColumn1
      ) {
        fam.beneficiaryDisplayColumn1 = configuredDisplayColumn1;
        hasAutoPopulatedChanges = true;
      }
      if (
        configuredDisplayColumn2 &&
        configuredDisplayColumn2 !== fam.beneficiaryDisplayColumn2
      ) {
        fam.beneficiaryDisplayColumn2 = configuredDisplayColumn2;
        hasAutoPopulatedChanges = true;
      }
      if (!fam.beneficiaryDisplayColumn1 && suggestedColumns[0]) {
        fam.beneficiaryDisplayColumn1 = suggestedColumns[0];
        hasAutoPopulatedChanges = true;
      }
      if (!fam.beneficiaryDisplayColumn2 && suggestedColumns[1]) {
        fam.beneficiaryDisplayColumn2 = suggestedColumns[1];
        hasAutoPopulatedChanges = true;
      }
      if (!fam.beneficiarySql) {
        fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
        hasAutoPopulatedChanges = true;
      }

      // Save if any auto-populate changes were made
      if (hasAutoPopulatedChanges) {
        this.saveFamilyLocal(fam);
      }

      this.beneficiaryVisibleTables = visibleTables;
      this.beneficiaryTableColumns = tableColumns;
      this.beneficiaryLoadState = "loaded";
      this.cdr.markForCheck();
    } catch (error: any) {
      this.beneficiaryLoadState = "error";
      this.beneficiaryLoadError = error?.message || "Erreur de chargement";
      this.cdr.markForCheck();
    }
  }

  /** Render only the sub-sections still driven by legacy renderers (schema builder) */
  private renderLegacyFamilySubSections(famId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    // Phase 4 Tranche 3: renderClassesContainer supprimée — Angular *ngFor pilote le bloc Classes & Variables
    // Phase 4 Tranche 4: renderSchemaAssistant supprimée — schemaBuilderData getter pilote le template
    // Ensure schema is loaded so schemaBuilderData has data
    void this.ensureSchemaMeta().then(() => this.cdr.markForCheck());
    this.refreshGeneratedListObjectQueries(famId, fam);
    // TRANCHE 1: setTimeout supprimé — appel direct synchrone.
    // Le hack async n'est plus nécessaire car loadBeneficiaryState est awaité
    // avant l'appel à renderLegacyFamilySubSections dans selectFamilyFromPanel.
    if (
      fam.beneficiaryMode === "organization" &&
      (!fam.sql || /:beneficiaryId\b/i.test(fam.sql))
    ) {
      this.regenerateFamilySql(famId, true);
    }
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
    this.updateFamilyFilterSqlBuilderField(
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

  hasSelectedFamilyVisibleTable(tableName: string): boolean {
    const normalized = this.normalizeSchemaIdentifier(tableName);
    if (!normalized) return false;
    return this.getSelectedFamilyVisibleTables().some(
      (table: any) =>
        this.normalizeSchemaIdentifier(String(table?.name || "")) ===
        normalized,
    );
  }

  hasSelectedFamilyTableColumn(tableName: string, columnName: string): boolean {
    const normalized = this.normalizeSchemaIdentifier(columnName);
    if (!normalized) return false;
    return this.getSelectedFamilyTableColumns(tableName).some(
      (column: any) =>
        this.normalizeSchemaIdentifier(String(column?.name || "")) ===
        normalized,
    );
  }

  getFilterSqlBuilderField(
    filter: any,
    field: "tableName" | "valueColumn" | "labelColumn",
  ): string {
    const builder = normalizeFilterSqlBuilder(
      filter?.sqlBuilder || filter?.builder || {},
    );
    const tableName = this.resolveSchemaTableName(
      String(builder.tableName || ""),
    );
    if (field === "tableName") return tableName;
    return this.resolveSchemaColumnName(
      tableName,
      String((builder as any)?.[field] || ""),
    );
  }

  getFilterStaticOptionsText(filter: any): string {
    return (filter?.staticOptions || [])
      .map((option: any) => `${option?.value || ""}|${option?.label || ""}`)
      .join("\n");
  }

  getAdminOrganizationName(admin: AdminAccount): string {
    console.log(this.organizations);
    const organization = this.organizations.find(
      (item) => item.id == admin.organizationId,
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
    this.tableViewDebugLogKeys.clear();
    try {
      await this.useSchemaForOrganizationIds(this.selectedTableView?.organizationIds);
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
        // if (!view.fieldSettings[fieldName]) {
        //   view.fieldSettings[fieldName] = {
        //     displayMode: "raw",
        //     lookupTable: "",
        //     lookupValueColumn: "",
        //     lookupLabelColumn: "",
        //     lookupLabelColumn2: "",
        //   };
        //   needsSave = true;
        // }
      }
      if (needsSave) {
        this.saveTableViewLocal(view);
      }
      console.log("[SuperAdmin/Data] selected table view", {
        id: view.id,
        tableName: view.tableName,
        visibleFields: view.visibleFields,
        fieldSettingsKeys: Object.keys(view.fieldSettings || {}),
        fieldSettings: view.fieldSettings,
      });
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

  isTableViewDetailLookupOptionSelected(
    optionValue: unknown,
    recordValue: unknown,
  ): boolean {
    return String(optionValue ?? "") === String(recordValue ?? "");
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

  // TRANCHE 3: renderFamilyEditor supprimée — plus aucun caller actif.
  // Tous les call-sites ont été migrés :
  //   - filtres add/remove/update → cdr.markForCheck()
  //   - création famille → selectFamilyFromPanel()
  //   - upsertGeneratedVar → renderLegacyFamilySubSections() direct

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
    await this.ensureSchemaContext();
    if (!this.tableViewSchemaCache) {
      this.tableViewSchemaCache = await this.ensureSchemaMeta();
    }
    if (!this.schemaMetaCache) this.schemaMetaCache = this.tableViewSchemaCache;
    console.log("[SuperAdmin/Data] schema loaded", {
      tables: (this.tableViewSchemaCache?.tables || []).length,
      columns: (this.tableViewSchemaCache?.columns || []).length,
      sampleTables: (this.tableViewSchemaCache?.tables || [])
        .slice(0, 5)
        .map((table: any) => table.name),
    });
    this.cdr.markForCheck();
  }
  addItem(): void {
    if (this.currentSection === "families") this.newFamily();
    if (this.currentSection === "organizations") this.openOrganizationModal();
    if (this.currentSection === "admins") this.openAdminModal();
    if (this.currentSection === "tableviews") this.newTableView();
    if (this.currentSection === "modules") this.newModule();
  }

  // --- MODULES METHODS ---
  private createEmptyModule(): Module {
    return {
      id: "",
      name: "",
      description: "",
      mainTableViewId: "",
      isActive: true,
      displayOrder: 0,
      organizationIds: [],
      tableViews: [],
    };
  }

  private newModule(): void {
    this.selectedModuleId = null;
    this.selectedModule = null;
    this.isCreatingModule = true;
    this.isEditingModule = false;
    this.moduleDraft = this.createEmptyModule();
    this.cdr.markForCheck();
  }

  selectModuleFromPanel(id: string): void {
    this.selectedModuleId = id;
    this.updateSelectedModule();
    this.isCreatingModule = false;
    this.isEditingModule = false;
    this.cdr.markForCheck();
  }

  editSelectedModule(): void {
    if (!this.selectedModule) return;
    this.moduleDraft = JSON.parse(JSON.stringify(this.selectedModule));
    this.isEditingModule = true;
    this.cdr.markForCheck();
  }

  async saveModule(module: Module): Promise<void> {
    try {
      this.isLoading = true;
      const saved = await this.moduleService.save(module);

      // Update local state via editorState
      await this.editorState.loadResource("modules", true);

      this.isCreatingModule = false;
      this.isEditingModule = false;
      this.selectedModuleId = saved.id;
      this.updateSelectedModule();

      this.toast("Module enregistré avec succès", "success");
    } catch (e: any) {
      this.toast(e.message || "Erreur lors de l'enregistrement", "error");
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  cancelModuleEdit(): void {
    this.isCreatingModule = false;
    this.isEditingModule = false;
    this.cdr.markForCheck();
  }

  async deleteSelectedModule(): Promise<void> {
    if (!this.selectedModuleId) return;

    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: "Supprimer le module",
            message:
              "Êtes-vous sûr de vouloir supprimer ce module ? Les TableViews associés ne seront pas supprimés.",
          },
        })
        .afterClosed(),
    );

    if (confirmed) {
      try {
        this.isLoading = true;
        await this.moduleService.delete(this.selectedModuleId);
        await this.editorState.loadResource("modules", true);
        this.selectedModuleId = null;
        this.selectedModule = null;
        this.toast("Module supprimé", "success");
      } catch (e: any) {
        this.toast(e.message || "Erreur lors de la suppression", "error");
      } finally {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  getTableViewLabelById(id: string): string {
    const tv = this.tableViews.find((t) => t.id === id);
    return tv ? tv.label || tv.tableName : id;
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
      organizationIds: [],
    };
    void this.familyService
      .saveFamily(family)
      .then((saved: Family) => {
        this.syncStateFromStore();
        // TRANCHE 2: renderFamilyEditor remplacé par selectFamilyFromPanel — chemin Angular pur.
        // selectFamilyFromPanel: met à jour selectedFamId, charge le state bénéficiaire,
        // popule les draft fields, et appelle renderLegacyFamilySubSections.
        this.renderLeftPanel();
        void this.selectFamilyFromPanel(saved.id);
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

  goToDocumentHistory(): void {
    this.router.navigate(["/documents"]);
  }

  // Phase 4 Tranche 5: openModal/closeModal simplifiées — fallback DOM supprimé.
  // Seules les modales Organization et Admin existent; elles sont 100% Angular state.
  closeModal(id: string): void {
    if (id === "modalOrganization") {
      this.isOrganizationModalOpen = false;
    } else if (id === "modalAdmin") {
      this.isAdminModalOpen = false;
    }
    this.cdr.markForCheck();
  }

  openModal(id: string): void {
    if (id === "modalOrganization") {
      this.isOrganizationModalOpen = true;
    } else if (id === "modalAdmin") {
      this.isAdminModalOpen = true;
    }
    this.cdr.markForCheck();
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

  // setText() supprimée — PHASE 4 TRANCHE 2 (aucun caller restant)

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

  // Phase 4 Tranche 5: escHtml + escAttr supprimées — plus de string renderers

  private genId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  private getFamily(id: string): any {
    return this.families.find((f: any) => f.id === id) || null;
  }

  isFamilyOrganizationSelected(famId: string, orgId: any): boolean {
    const fam = this.getFamily(famId);
    return (fam?.organizationIds || []).includes(Number(orgId));
  }

  toggleFamilyOrganization(famId: string, orgId: any): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const current = fam.organizationIds || [];
    const id = Number(orgId);
    if (current.includes(id)) {
      fam.organizationIds = current.filter((i: number) => i !== id);
    } else {
      fam.organizationIds = [...current, id];
    }
    this.saveFamilyLocal(fam);
    if (this.selectedFamId === famId) {
      void this.useSchemaForOrganizationIds(fam.organizationIds).then(() => {
        void this.loadBeneficiaryState(famId);
        this.regenerateFamilySql(famId, true, true);
        this.cdr.markForCheck();
      });
    }
  }

  isTableViewOrganizationSelected(viewId: string, orgId: any): boolean {
    const view = this.tableViews.find((v) => v.id === viewId);
    return (view?.organizationIds || []).includes(Number(orgId));
  }

  toggleTableViewOrganization(viewId: string, orgId: any): void {
    const view = this.tableViews.find((v) => v.id === viewId);
    if (!view) return;
    const current = view.organizationIds || [];
    const id = Number(orgId);
    if (current.includes(id)) {
      view.organizationIds = current.filter((i: number) => i !== id);
    } else {
      view.organizationIds = [...current, id];
    }
    this.saveTableViewLocal(view);
    if (this.selectedTableViewId === viewId) {
      void this.useSchemaForOrganizationIds(view.organizationIds).then(() => {
        this.renderTableViewsContent();
        this.cdr.markForCheck();
      });
    }
    if (view.tableName) this.saveTableViewConfig(view.id);
  }

  private async saveFamilyLocal(fam: any): Promise<void> {
    try {
      await this.familyService.saveFamily(fam as Family);
    } catch (err) {
      this.toast("Impossible de synchroniser la famille.", "error");
    }
  }

  private async deleteFamilyLocal(id: string): Promise<void> {
    try {
      await this.familyService.deleteFamily(id);
    } catch (err) {
      this.toast("Impossible de supprimer la famille.", "error");
    }
  }

  updateFamilyDraftField(famId: string, field: string, value: string): void {
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
    const beneficiaryModeValue = fam.beneficiaryMode || "table";
    const beneficiaryTableValue = String(fam.beneficiaryTable || "").trim();
    const beneficiaryLinkColumnValue = String(
      fam.beneficiaryLinkColumn || "",
    ).trim();
    const beneficiaryDisplayColumn1Value = String(
      fam.beneficiaryDisplayColumn1 || "",
    ).trim();
    const beneficiaryDisplayColumn2Value = String(
      fam.beneficiaryDisplayColumn2 || "",
    ).trim();
    // Read SQL from Angular draft state (replaces document.getElementById("fSql"))
    const sqlValue = this.familyDraftSql.trim();
    const beneficiarySqlValue = String(fam.beneficiarySql || "").trim();
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
    // Read nom/description from Angular draft state (replaces document.getElementById fNom/fDesc)
    const nomValue = this.familyDraftNom.trim();
    if (!nomValue) {
      this.toast("Le nom de la famille est requis", "error");
      return;
    }
    fam.nom = nomValue;
    fam.description = this.familyDraftDescription.trim();
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
    // Angular state-driven: selectedFamId = null causes *ngIf to hide all family cards
    this.selectedFamId = null;
    this.beneficiaryLoadState = "idle";
    this.beneficiaryVisibleTables = [];
    this.beneficiaryTableColumns = [];
    this.familyDraftNom = "";
    this.familyDraftDescription = "";
    this.familyDraftSql = "";
    this.cdr.markForCheck();
    this.renderLeftPanel();
    this.toast("Famille supprimée", "success");
  }

  onSchemaOrganizationChange(event: any): void {
    const orgId = event?.target?.value;
    const org = this.organizations.find((o) => String(o.id) === String(orgId));
    this.selectedSchemaOrganizationId = orgId || null;
    this.selectedSchemaDatabaseName = org?.databaseName || null;
    this.schemaMetaCache = null; // Force reload
    this.tableViewSchemaCache = null;
    this.cdr.markForCheck();

    if (this.selectedSchemaDatabaseName) {
      this.loadDatabaseSchema();
    }
  }

  private getFirstAccessibleOrganization(organizationIds: any[] = []): any {
    const ids = (Array.isArray(organizationIds) ? organizationIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    return ids
      .map((id) => this.organizations.find((org) => Number(org.id) === id))
      .find((org) => !!org?.databaseName);
  }

  private async useSchemaForOrganizationIds(
    organizationIds: any[] = [],
  ): Promise<void> {
    const org = this.getFirstAccessibleOrganization(organizationIds);
    const nextOrgId = org ? String(org.id) : null;
    const nextDatabaseName = org?.databaseName || null;
    if (
      this.selectedSchemaOrganizationId === nextOrgId &&
      this.selectedSchemaDatabaseName === nextDatabaseName
    ) {
      return;
    }
    this.selectedSchemaOrganizationId = nextOrgId;
    this.selectedSchemaDatabaseName = nextDatabaseName;
    this.schemaMetaCache = null;
    this.tableViewSchemaCache = null;
    this.databaseSchema = null;
    if (nextDatabaseName) {
      const url = `schema?databaseName=${encodeURIComponent(nextDatabaseName)}`;
      const payload = await firstValueFrom(this.api.get<any>(url));
      this.schemaMetaCache = payload?.schema || payload;
      this.tableViewSchemaCache = this.schemaMetaCache;
      this.databaseSchema = this.schemaMetaCache;
    }
    this.cdr.markForCheck();
  }

  private async ensureSchemaContext(): Promise<void> {
    if (this.currentSection === "families" && this.selectedFamily) {
      await this.useSchemaForOrganizationIds(this.selectedFamily.organizationIds);
      return;
    }
    if (this.currentSection === "tableviews" && this.selectedTableView) {
      await this.useSchemaForOrganizationIds(this.selectedTableView.organizationIds);
      return;
    }
    if (!this.selectedSchemaDatabaseName) await this.useSchemaForOrganizationIds([]);
  }

  private async ensureSchemaMeta(): Promise<any> {
    if (this.schemaMetaCache) return this.schemaMetaCache;
    await this.ensureSchemaContext();
    if (!this.selectedSchemaDatabaseName) {
      return null;
    }
    const url = `schema?databaseName=${encodeURIComponent(
      this.selectedSchemaDatabaseName,
    )}`;
    const payload = await firstValueFrom(this.api.get<any>(url));
    this.schemaMetaCache = payload?.schema || payload;
    this.databaseSchema = this.schemaMetaCache;
    return this.schemaMetaCache;
  }

  private normalizeSchemaIdentifier(value: string): string {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const cleaned = raw
      .replace(/[\[\]"'`]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
    const parts = cleaned.split(".").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : cleaned;
  }

  private resolveSchemaTableName(tableName: string): string {
    const raw = String(tableName || "").trim();
    if (!raw) return "";
    const normalized = this.normalizeSchemaIdentifier(raw);
    const match = (this.schemaMetaCache?.tables || []).find(
      (table: any) =>
        this.normalizeSchemaIdentifier(String(table?.name || "")) ===
        normalized,
    );
    return String(match?.name || raw);
  }

  private resolveSchemaColumnName(
    tableName: string,
    columnName: string,
  ): string {
    const raw = String(columnName || "").trim();
    if (!raw) return "";
    const resolvedTable = this.resolveSchemaTableName(tableName);
    const normalized = this.normalizeSchemaIdentifier(raw);
    const match = this.getColumnsForTable(
      this.schemaMetaCache,
      resolvedTable,
    ).find(
      (column: any) =>
        this.normalizeSchemaIdentifier(String(column?.name || "")) ===
        normalized,
    );
    return String(match?.name || raw);
  }

  private getColumnsForTable(schema: any, tableName: string): any[] {
    const normalizedTable = this.normalizeSchemaIdentifier(tableName);
    return (schema?.columns || []).filter(
      (c: any) =>
        this.normalizeSchemaIdentifier(String(c?.table || "")) ===
        normalizedTable,
    );
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

  /**
   * @removed TRANCHE 1 — replaced by loadBeneficiaryState() which drives the Angular template.
   * Kept as stub to avoid breaking any remaining call-sites during incremental migration.
   */
  // TRANCHE 1: renderFamilyBeneficiaryTableSelect supprimée — était déjà un no-op.
  // Le bloc bénéficiaire est intégralement piloté par Angular state :
  // beneficiaryLoadState / beneficiaryVisibleTables / beneficiaryTableColumns.

  updateFamilyBeneficiaryMode(famId: string, mode: string): void {
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
    this.renderLeftPanel();
    void this.loadBeneficiaryState(famId);
    this.regenerateFamilySql(famId, true);
    this.cdr.markForCheck();
  }

  updateFamilyBeneficiaryTable(famId: string, tableName: string): void {
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
    void this.loadBeneficiaryState(famId);
    this.regenerateFamilySql(famId, true);
    this.cdr.markForCheck();
  }

  updateFamilyBeneficiaryLinkColumn(famId: string, columnName: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.beneficiaryLinkColumn = columnName || "";
    if (!fam.customBeneficiarySql) {
      fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
    }
    this.saveFamilyLocal(fam);
    this.regenerateFamilySql(famId, true);
  }

  updateFamilyBeneficiaryDisplayColumn(
    famId: string,
    slot: number,
    columnName: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    let nextDisplay1 = String(fam.beneficiaryDisplayColumn1 || "").trim();
    let nextDisplay2 = String(fam.beneficiaryDisplayColumn2 || "").trim();

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

  // TRANCHE 3: renderFamilyFilterCatalog supprimée — était un no-op, jamais appelée.
  private addFamilyFilterDefinition(famId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = [
      ...(fam.filterCatalog || []),
      this.createEmptyFamilyFilterDefinition((fam.filterCatalog || []).length),
    ];
    this.saveFamilyLocal(fam);
    // TRANCHE 2: renderFamilyEditor supprimé — Angular *ngFor sur selectedFamilyFilters
    // reflète la mutation immédiatement via le getter. Pas de stale state possible.
    this.cdr.markForCheck();
    this.toast("Filtre ajouté", "success");
  }

  private removeFamilyFilterDefinition(famId: string, filterId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.filterCatalog = (fam.filterCatalog || []).filter(
      (filter: any) => filter.id !== filterId,
    );
    this.saveFamilyLocal(fam);
    // TRANCHE 2: renderFamilyEditor supprimé — la suppression est reflétée immédiatement
    // par le getter selectedFamilyFilters → *ngFor Angular sans stale state.
    this.cdr.markForCheck();
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
    // TRANCHE 2: renderFamilyEditor supprimé — la mutation du filtre est reflétée
    // par le getter selectedFamilyFilters. Les SQL sont régénérés ci-dessus.
    this.cdr.markForCheck();
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
                : bindings[0] || filter.columnBinding?.mode === "table-links"
                  ? normalizeFilterColumnBinding(
                      bindings[0] || filter.columnBinding || {},
                    )
                  : { tableName: "", columnName: "", mode: "table-links" },
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
    // TRANCHE 2: renderFamilyEditor supprimé — Angular reflète la mutation immédiatement.
    this.cdr.markForCheck();
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
        const normalizedTableName = this.resolveSchemaTableName(tableName);
        const bindings = normalizeFilterColumnBindings(
          filter.columnBindings || [],
          filter.columnBinding || {},
        ).filter(
          (binding) =>
            this.normalizeSchemaIdentifier(binding.tableName) !==
            this.normalizeSchemaIdentifier(normalizedTableName),
        );
        if (columnName) {
          bindings.push({
            tableName: normalizedTableName,
            columnName: this.resolveSchemaColumnName(
              normalizedTableName,
              columnName,
            ),
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

  private updateFamilyFilterSqlBuilderField(
    famId: string,
    filterId: string,
    field: string,
    value: string,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = this.schemaMetaCache;
    fam.filterCatalog = (fam.filterCatalog || []).map(
      (filter: any, index: number) => {
        if (filter.id !== filterId) return filter;
        const sqlBuilder = normalizeFilterSqlBuilder(filter.sqlBuilder || {});
        if (field === "tableName") {
          sqlBuilder.tableName = this.resolveSchemaTableName(value || "");
        } else if (field === "valueColumn" || field === "labelColumn") {
          (sqlBuilder as any)[field] = this.resolveSchemaColumnName(
            sqlBuilder.tableName,
            value || "",
          );
        } else {
          (sqlBuilder as any)[field] = value || "";
        }
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
              (schema
                ? this.buildDistinctFilterSqlQuery(sqlBuilder, schema)
                : "") ||
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
    this.cdr.markForCheck();
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
    const normalizedTable = this.normalizeSchemaIdentifier(tableName);
    const bindings = normalizeFilterColumnBindings(
      filter?.columnBindings || [],
      filter?.columnBinding || {},
    );
    return (
      bindings.find(
        (binding) =>
          this.normalizeSchemaIdentifier(binding.tableName) === normalizedTable,
      ) || null
    );
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
    // TRANCHE 3: renderFamilyEditor remplacé par renderLegacyFamilySubSections direct.
    // upsertGeneratedVar modifie fam.classes → le schema builder legacy doit se rafraîchir.
    // loadBeneficiaryState inutile ici (aucune modification de la table bénéficiaire).
    this.renderLegacyFamilySubSections(famId);
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

  // Phase 4 Tranche 4: renderSchemaAssistant + syncSchemaPreviewBox supprimées — Angular template

  async setFamilyBaseTable(famId: string, tableName: string): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    const schema = await this.ensureSchemaMeta();
    const state = this.getBuilderState(famId, fam, schema);
    state.baseTable = tableName;
    state.secondaryTables = (state.secondaryTables || []).filter(
      (name: string) => name && name !== tableName,
    );
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  async addSchemaSecondaryTable(
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
    this.cdr.markForCheck();
  }

  async removeSchemaSecondaryTable(
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
    this.cdr.markForCheck();
  }

  async toggleSchemaColumnSelection(
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
    this.cdr.markForCheck();
  }

  async addSchemaScalar(
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

  async addSchemaList(
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

  async addSchemaTableVar(famId: string, tableName: string): Promise<void> {
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
    nextVar.sqlQuery =
      this.buildDefaultListObjectSqlQuery(famId, nextVar) ||
      this.buildSimpleListObjectSqlQuery(tableName, nextVar);
    nextVar.customSqlQuery = false;
    this.syncListObjectColumnsFromSql(nextVar);
    this.upsertGeneratedVar(famId, tableName, nextVar);
  }

  async testFamilyQuery(famId: string): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam?.sql) return;
    this.schemaPreviewState = "loading";
    this.schemaPreviewText = "Test en cours...";
    this.cdr.markForCheck();
    try {
      const rows = await this.runSelect(fam.sql, {
        id: 1,
        personId: 1,
        beneficiaryId: 1,
        etablissementId: 1,
        etabId: 1,
      });
      this.schemaPreviewState = "idle";
      this.schemaPreviewText = JSON.stringify(rows[0] || {}, null, 2);
    } catch (error: any) {
      this.schemaPreviewState = "error";
      this.schemaPreviewText = error?.message || "Erreur";
    }
    this.cdr.markForCheck();
  }

  // ── Phase 4 Tranche 3: renderClassesContainer et tous les renderers legacy supprimés ──
  // Le bloc Classes & Variables est maintenant 100% Angular state-driven (*ngFor dans le template).

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

  private async runSelect(
    sql: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    const payload = await firstValueFrom(
      this.api.post<any>("query", {
        sql,
        params,
        databaseName: this.selectedSchemaDatabaseName,
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

  private buildSimpleListObjectSqlQuery(tableName: string, varDef: any): string {
    const selectedColumns =
      Array.isArray(varDef?.sourceColumns) && varDef.sourceColumns.length
        ? varDef.sourceColumns
        : Array.isArray(varDef?.columns)
          ? varDef.columns
          : [];
    const selectEntries = selectedColumns
      .map((col: any) => {
        const sourceColumn = String(col?.column || col?.key || "").trim();
        const key = String(col?.key || sourceColumn).trim();
        if (!sourceColumn || !key) return null;
        return `  ${this.sqlId(sourceColumn)} AS ${this.sqlId(key)}`;
      })
      .filter(Boolean);
    if (!tableName || !selectEntries.length) return "";
    return ["SELECT", selectEntries.join(",\n"), `FROM ${this.sqlId(tableName)}`].join(
      "\n",
    );
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

  updateVarLinkField(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  moveVarColumn(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  removeVarColumn(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  updateVarAddColumnMode(
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
    this.cdr.markForCheck();
  }

  addVarColumn(famId: string, ci: number, vi: number): void {
    // Phase 4 Tranche 3: lecture depuis getAddColDraft(ci,vi) au lieu de document.getElementById
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    const draft = this.getAddColDraft(ci, vi);
    const sourceColumn = String(draft.source || "").trim();
    const keyRaw = String(draft.key || "").trim();
    const label = String(draft.label || "").trim();
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
    this.addColDrafts[`${ci}_${vi}`] = {
      source: "",
      key: "",
      label: "",
      mode: draft.mode,
    };
    this.saveFamilyLocal(fam);
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
    this.toast("Colonne ajoutée", "success");
  }

  updateVarColumnLookupField(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  updateVarColumnLookupMode(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  updateListVarLookupField(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  updateListVarLookupMode(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  updateListObjectSqlQuery(
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
      this.cdr.markForCheck();
      return;
    }
    varDef.sqlQuery = sqlQuery;
    varDef.customSqlQuery = !!sqlQuery;
    this.syncListObjectColumnsFromSql(varDef);
    this.saveFamilyLocal(fam);
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  generateListObjectSqlQueryFromSource(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
    this.toast("Requête SQL du tableau générée", "success");
  }

  applySuggestedFiltersToListObjectSql(
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
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
    this.toast("Filtres applicables ajoutés au SQL du tableau", "success");
  }

  clearListObjectSqlQuery(famId: string, ci: number, vi: number): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    varDef.sqlQuery = "";
    varDef.customSqlQuery = false;
    this.saveFamilyLocal(fam);
    this.cdr.markForCheck();
    this.regenerateFamilySql(famId, true);
  }

  private async testListObjectSqlQuery(
    famId: string,
    ci: number,
    vi: number,
  ): Promise<void> {
    // Phase 4 Tranche 3: listObjectSqlPreviews state au lieu de document.getElementById
    const k = `${ci}_${vi}`;
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!varDef || varDef.type !== "list-object") return;
    const sqlQuery = String(varDef.sqlQuery || "").trim();
    if (!sqlQuery) {
      this.listObjectSqlPreviews[k] = "Aucune requête SQL dédiée à tester.";
      this.cdr.markForCheck();
      return;
    }
    if (!/^select\b/i.test(sqlQuery)) {
      this.listObjectSqlPreviews[k] = "La requête doit commencer par SELECT.";
      this.cdr.markForCheck();
      return;
    }
    this.listObjectSqlPreviews[k] = "Test en cours...";
    this.listObjectSqlLoading[k] = true;
    this.cdr.markForCheck();
    try {
      this.syncListObjectColumnsFromSql(varDef);
      this.saveFamilyLocal(fam);
      const rows = await this.runSelect(sqlQuery, {
        id: 1,
        beneficiaryId: 1,
        personId: 1,
        organizationId: 1,
      });
      this.listObjectSqlPreviews[k] = JSON.stringify(
        rows.slice(0, 10),
        null,
        2,
      );
    } catch (error: any) {
      this.listObjectSqlPreviews[k] = error?.message || "Erreur";
    }
    this.listObjectSqlLoading[k] = false;
    this.cdr.markForCheck();
  }

  testListObjectSqlQueryAngular(famId: string, ci: number, vi: number): void {
    void this.testListObjectSqlQuery(famId, ci, vi);
  }

  updateClassProp(famId: string, ci: number, prop: string, val: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    if (!fam.classes[ci]) return;
    fam.classes[ci][prop] = val;
    this.saveFamilyLocal(fam);
    if (prop === "couleur") this.cdr.markForCheck();
  }

  deleteClassBlock(famId: string, ci: number): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    fam.classes.splice(ci, 1);
    this.saveFamilyLocal(fam);
    this.cdr.markForCheck();
  }

  deleteVar(famId: string, ci: number, vi: number): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    if (!fam.classes[ci]) return;
    fam.classes[ci].vars = fam.classes[ci].vars || [];
    fam.classes[ci].vars.splice(vi, 1);
    this.saveFamilyLocal(fam);
    this.cdr.markForCheck();
  }

  updateVarLabel(famId: string, ci: number, vi: number, value: string): void {
    const fam = this.getFamily(famId);
    const varDef = fam?.classes?.[ci]?.vars?.[vi];
    if (!fam || !varDef) return;
    varDef.label = String(value || "").trim() || varDef.tech;
    this.saveFamilyLocal(fam);
    this.cdr.markForCheck();
  }

  addClassBlock(famId: string): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    fam.classes = fam.classes || [];
    fam.classes.push({
      nom: "Nouvelle classe",
      couleur: "#6c63ff",
      vars: [],
    });
    this.saveFamilyLocal(fam);
    this.cdr.markForCheck();
  }

  // Phase 4 Tranche 3: onVarTypeChange supprimée — visibilité gérée par *ngIf newVarDrafts[ci].type
  // Phase 4 Tranche 3: refreshTempColPills supprimée — Angular *ngFor sur tempColsByClass[ci]

  addTempCol(ci: number): void {
    this.ensureClassDrafts(this.selectedFamilyClasses);
    const draft = this.newTempColDrafts[ci] || { key: "", label: "" };
    const key = String(draft.key || "")
      .trim()
      .replace(/\s/g, "_");
    const label = String(draft.label || "").trim();
    if (!key || !label) {
      this.toast("Remplissez clé et libellé", "error");
      return;
    }
    if (!this.tempColsByClass[ci]) this.tempColsByClass[ci] = [];
    this.tempColsByClass[ci].push({ key, label });
    this.newTempColDrafts[ci] = { key: "", label: "" };
    this.cdr.markForCheck();
  }

  removeTempCol(ci: number, index: number): void {
    if (this.tempColsByClass[ci]) this.tempColsByClass[ci].splice(index, 1);
    this.cdr.markForCheck();
  }

  moveTempCol(ci: number, index: number, direction: number): void {
    const cols = this.tempColsByClass[ci];
    if (!Array.isArray(cols)) return;
    const targetIndex = index + Number(direction || 0);
    if (targetIndex < 0 || targetIndex >= cols.length) return;
    const [moved] = cols.splice(index, 1);
    cols.splice(targetIndex, 0, moved);
    this.cdr.markForCheck();
  }

  addVar(famId: string, ci: number): void {
    this.ensureClassDrafts(this.selectedFamilyClasses);
    const fam = this.getFamily(famId);
    if (!fam) return;
    const draft = this.newVarDrafts[ci] || {
      tech: "",
      label: "",
      type: "scalar",
    };
    const tech = String(draft.tech || "")
      .trim()
      .replace(/\s/g, "_");
    const label = String(draft.label || "").trim();
    const type = String(draft.type || "scalar");
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
    this.newVarDrafts[ci] = { tech: "", label: "", type: "scalar" };
    this.cdr.markForCheck();
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

  regenerateFamilySql(famId: string, silent = false, force = false): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    this.refreshGeneratedListObjectQueries(famId, fam);
    if (fam.customMainSql && !force) {
      // Phase 4 Tranche 4: familyDraftSql remplace document.getElementById("fSql")
      this.familyDraftSql = fam.sql || "";
      this.cdr.markForCheck();
      return;
    }
    const generatedSql = this.buildSqlFromFamily(famId);
    if (!generatedSql) return;
    fam.sql = generatedSql;
    fam.customMainSql = false;
    this.saveFamilyLocal(fam);
    // Phase 4 Tranche 4: familyDraftSql remplace document.getElementById("fSql")
    this.familyDraftSql = generatedSql;
    this.cdr.markForCheck();
    if (!silent) this.toast("Requête SELECT régénérée", "success");
  }

  regenerateFamilyBeneficiarySql(
    famId: string,
    silent = false,
    force = false,
  ): void {
    const fam = this.getFamily(famId);
    if (!fam) return;
    if (fam.customBeneficiarySql && !force) {
      return;
    }
    fam.beneficiarySql = this.buildBeneficiarySqlFromFamily(famId);
    fam.customBeneficiarySql = false;
    this.saveFamilyLocal(fam);
    if (!silent) this.toast("SELECT bénéficiaires régénéré", "success");
  }

  async testFamilyBeneficiaryQuery(famId: string): Promise<void> {
    const fam = this.getFamily(famId);
    if (!fam) return;
    if (fam.beneficiaryMode === "organization") {
      this.beneficiaryPreviewText =
        "Mode Organization : aucun SELECT bénéficiaires n'est nécessaire.";
      return;
    }
    const sql = String(fam.beneficiarySql || "").trim();
    if (!sql) {
      this.beneficiaryPreviewText = "Aucun SELECT bénéficiaires défini.";
      return;
    }
    this.beneficiaryPreviewText = "Test en cours...";
    try {
      const rows = await this.runSelect(sql, {
        organizationId: 1,
      });
      this.beneficiaryPreviewText = JSON.stringify(rows[0] || {}, null, 2);
    } catch (error: any) {
      this.beneficiaryPreviewText = error?.message || "Erreur";
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

  // renderOrganizationExtraFields supprimée — PHASE 4 TRANCHE 1
  // Les extra-fields sont maintenant dans orgDraft.extraFields (Angular state-driven)

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
    this.organizationModalTitle = id
      ? "Modifier l'Organization"
      : "Nouvelle Organization";
    const existingRaw =
      org?.["raw"] && typeof org["raw"] === "object" ? org["raw"] : {};
    const extraKeys = this.getOrganizationExtraFieldKeys();
    this.orgDraft = {
      nom: org?.nom || "",
      ville: org?.ville || "",
      adresse: (org as any)?.adresse || "",
      tel: (org as any)?.tel || "",
      email: (org as any)?.email || "",
      extraFields: extraKeys.map((key) => ({
        key,
        value:
          existingRaw[key] === undefined || existingRaw[key] === null
            ? ""
            : String(existingRaw[key]),
      })),
    };
    this.openModal("modalOrganization");
  }

  saveOrganization(): void {
    const nom = String(this.orgDraft.nom || "").trim();
    if (!nom) {
      this.toast("Le nom est requis", "error");
      return;
    }
    const existing = this.editingOrganizationId
      ? this.organizations.find((o) => o.id === this.editingOrganizationId)
      : null;
    const raw = { ...((existing as any)?.raw || {}) };
    this.orgDraft.extraFields.forEach(({ key, value }) => {
      raw[key] = value;
    });
    const payload: any = {
      ...(existing || {}),
      id: this.editingOrganizationId || this.genId("org"),
      nom,
      ville: this.orgDraft.ville || "",
      adresse: this.orgDraft.adresse || "",
      tel: this.orgDraft.tel || "",
      email: this.orgDraft.email || "",
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
    this.adminModalTitle = id
      ? "Modifier l'administrateur"
      : "Nouvel administrateur";
    this.adminDraft = {
      nom: admin?.name || (admin as any)?.nom || "",
      email: admin?.email || "",
      organizationId: admin?.organizationId || "",
      profile: (admin as any)?.profile || "",
      password: "",
    };
    this.openModal("modalAdmin");
  }

  saveAdmin(): void {
    const name = String(this.adminDraft.nom || "").trim();
    const organizationId = String(this.adminDraft.organizationId || "").trim();
    if (!name || !organizationId) {
      this.toast("Nom et Organization requis", "error");
      return;
    }
    const email = String(this.adminDraft.email || "").trim();
    const profile = String(this.adminDraft.profile || "").trim();
    const password = String(this.adminDraft.password || "").trim();
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
    await this.useSchemaForOrganizationIds([]);
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
      organizationIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveTableViewLocal(item);
    this.selectedTableViewId = item.id;
    this.selectedTableViewRowId = null;
    this.selectedTableViewRecord = null;
    this.isCreatingTableViewRow = false;
    this.renderLeftPanel();
    this.renderTableViewsContent();
    this.toast(
      "Vue creee localement. Cochez une organisation puis choisissez la table SQL.",
      "success",
    );
    /*
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
    */
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
    const view = this.selectedTableViewId
      ? this.tableViews.find((v) => v.id === this.selectedTableViewId) || null
      : null;
    if (!view)
      return {
        displayMode: "raw",
        lookupTable: "",
        lookupValueColumn: "",
        lookupLabelColumn: "",
        lookupLabelColumn2: "",
      };
    const setting = this.getTableViewFieldSetting(view, fieldName);
    const debugKey = `setting:${view.id}:${fieldName}`;
    if (
      setting.displayMode === "lookup" &&
      !this.tableViewDebugLogKeys.has(debugKey)
    ) {
      this.tableViewDebugLogKeys.add(debugKey);
      console.log("[SuperAdmin/Data] lookup field setting resolved", {
        viewId: view.id,
        fieldName,
        fieldSettingsKeys: Object.keys(view.fieldSettings || {}),
        rawExact: view.fieldSettings?.[String(fieldName || "").trim()],
        resolved: setting,
      });
    }
    return setting;
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
    // Relire la vue depuis tableViews pour avoir les settings les plus récents
    const view = this.selectedTableViewId
      ? this.tableViews.find((v) => v.id === this.selectedTableViewId) || null
      : null;
    if (!view) return [];
    const setting = this.getTableViewFieldSetting(view, fieldName);
    const lookupTable = String(setting.lookupTable || "").trim();
    if (!lookupTable) {
      const debugKey = `columns-empty-table:${view.id}:${fieldName}`;
      if (
        setting.displayMode === "lookup" &&
        !this.tableViewDebugLogKeys.has(debugKey)
      ) {
        this.tableViewDebugLogKeys.add(debugKey);
        console.log(
          "[SuperAdmin/Data] lookup columns unavailable: no lookupTable",
          {
            viewId: view.id,
            fieldName,
            setting,
          },
        );
      }
      return [];
    }
    const schema = this.tableViewSchemaCache || this.schemaMetaCache || {};
    if (!schema?.columns) {
      const debugKey = `columns-no-schema:${view.id}:${fieldName}`;
      if (!this.tableViewDebugLogKeys.has(debugKey)) {
        this.tableViewDebugLogKeys.add(debugKey);
        console.log(
          "[SuperAdmin/Data] lookup columns unavailable: schema missing",
          {
            viewId: view.id,
            fieldName,
            lookupTable,
            setting,
          },
        );
      }
      return [];
    }
    const columns = this.getTableViewColumns(schema, lookupTable);
    const debugKey = `columns:${view.id}:${fieldName}:${lookupTable}`;
    if (!this.tableViewDebugLogKeys.has(debugKey)) {
      this.tableViewDebugLogKeys.add(debugKey);
      console.log("[SuperAdmin/Data] lookup columns resolved", {
        viewId: view.id,
        fieldName,
        lookupTable,
        selectedValueColumn: setting.lookupValueColumn,
        selectedLabelColumn: setting.lookupLabelColumn,
        columnNames: columns.map((column: any) => column.name),
        valueColumnExists: columns.some(
          (column: any) => column.name === setting.lookupValueColumn,
        ),
        labelColumnExists: columns.some(
          (column: any) => column.name === setting.lookupLabelColumn,
        ),
      });
    }
    return columns;
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
    const key = String(fieldName || "").trim();
    const settings = item?.fieldSettings || {};
    const exact = settings[key];
    const insensitiveKey = Object.keys(settings).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );
    const raw = exact || (insensitiveKey ? settings[insensitiveKey] : null);
    return {
      displayMode: raw?.displayMode === "lookup" ? "lookup" : "raw",
      lookupTable: String(raw?.lookupTable || "").trim(),
      lookupValueColumn: String(raw?.lookupValueColumn || "").trim(),
      lookupLabelColumn: String(raw?.lookupLabelColumn || "").trim(),
      lookupLabelColumn2: String(raw?.lookupLabelColumn2 || "").trim(),
    };
  }

  private getTableViewFieldSettingKey(
    item: TableViewConfig,
    fieldName: string,
  ): string {
    const key = String(fieldName || "").trim();
    const settings = item?.fieldSettings || {};
    return (
      Object.keys(settings).find(
        (candidate) => candidate.toLowerCase() === key.toLowerCase(),
      ) || key
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
    const key = this.getTableViewFieldSettingKey(item, fieldName);
    const settings = {
      ...(item.fieldSettings || {}),
    };
    const defaultSetting = {
      displayMode: "raw",
      lookupTable: "",
      lookupValueColumn: "",
      lookupLabelColumn: "",
      lookupLabelColumn2: "",
    };
    const current = {
      ...defaultSetting,
      ...(item.fieldSettings?.[key] || {}), // ← lire depuis item directement, pas depuis la copie settings
    } as any;
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
    this.cdr.markForCheck();
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
        databaseName: this.selectedSchemaDatabaseName,
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
    // Validate filters before sending to server
    if (item.filters && item.filters.length) {
      for (const f of item.filters) {
        if (!f.name || !f.name.trim()) {
          this.toast(
            `Le filtre '${f.id || "(nouveau)"}' doit avoir un nom`,
            "error",
          );
          return;
        }
        if (!f.linkColumn || !f.linkColumn.trim()) {
          this.toast(
            `Le filtre '${f.name}' doit avoir une colonne cible`,
            "error",
          );
          return;
        }
        if (f.sourceType === "Table") {
          const sb = (f as any).sqlBuilder;
          if (!sb || !sb.tableName || !sb.valueColumn || !sb.labelColumn) {
            this.toast(
              `Le filtre '${f.name}' nécessite une configuration SQL complète (table, colonne valeur, colonne libellé)`,
              "error",
            );
            return;
          }
        }
        if (f.sourceType === "Static") {
          const opts = (f as any).staticOptions || [];
          if (!opts.length || opts.every((o: any) => !o || !o.value)) {
            this.toast(
              `Le filtre '${f.name}' doit contenir au moins une option statique valide`,
              "error",
            );
            return;
          }
        }
      }
    }
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
          // TRANCHE 3: renderLeftPanel() est un no-op Angular. cdr.markForCheck()
          // garantit la synchronisation immédiate du *ngFor filteredTableViews.
          this.renderLeftPanel();
          this.renderTableViewsContent();
          this.cdr.markForCheck();
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
          databaseName: this.selectedSchemaDatabaseName,
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
            databaseName: this.selectedSchemaDatabaseName,
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
            databaseName: this.selectedSchemaDatabaseName,
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
      message: `La ligne "${previewLabel}" sera supprimée de ${item.tableName}.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;

    try {
      await firstValueFrom(
        this.tableViewService.deleteRecord({
          configId: item.id,
          rowId: this.selectedTableViewRowId as string,
          databaseName: this.selectedSchemaDatabaseName,
        }),
      );
      this.selectedTableViewRowId = null;
      this.selectedTableViewRecord = null;
      this.isCreatingTableViewRow = false;
      this.toast("Ligne supprimée", "success");
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

  // Phase 4 Tranche 5: escJs supprimée — plus de string renderers

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
