import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { BeneficiaryRecord, FamilyRecord } from "../../models/family.model";
import { FilterValueMap, RuntimeFilterEntry } from "../../models/filter.model";
import { TableViewConfig } from "../../models/table-view.model";
import { TemplateRecord } from "../../models/template.model";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { FilterRuntimeService } from "../../services/filter-runtime.service";
import { DocumentDataService } from "../../services/document-data.service";
import { DocumentRenderService } from "../../services/document-render.service";
import { OrganizationService } from "../../services/organization.service";
import { TableViewService } from "../../services/table-view.service";
import { TemplateService } from "../../services/template.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { DocumentService } from "../../services/document.service";
import { TableFiltersComponent } from "../../components/table-filters/table-filters.component";

type UserMode = "documents" | "data";
type Step = 1 | 2 | 3;

@Component({
  selector: "app-user-page",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TableFiltersComponent],
  templateUrl: "./user-page.component.html",
  styleUrls: ["./user-page.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class UserPageComponent implements OnInit {
  loading = true;
  appLoadingMessage = "Chargement...";
  mode: UserMode = "documents";
  organizationId: string | null = null;
  organizationName = "";

  selectedFamilyId: string | null = null;
  selectedTemplateId: string | null = null;
  selectedBeneficiaryId: string | null = null;
  beneficiaries: BeneficiaryRecord[] = [];
  runtimeFilters: RuntimeFilterEntry[] = [];
  filterValues: FilterValueMap = {};
  openSteps: Record<Step, boolean> = { 1: true, 2: false, 3: false };

  familySearch = "";
  templateSearch = "";
  beneficiarySearch = "";
  zoom = 100;
  previewHtml: SafeHtml | null = null;
  previewPlainHtml = "";
  previewTemplate: TemplateRecord | null = null;
  previewPerson: Record<string, any> | null = null;
  waitMessage = "Completez les 3 etapes pour generer votre document";
  documentBusy = false;
  documentBusyMessage = "";
  beneficiariesLoading = false;

  selectedDataViewId: string | null = null;
  selectedModuleId: string | null = null;
  activeModuleTableViewId: string | null = null;
  dataViewSearch = "";
  dataRowSearch = "";
  dataRows: Record<string, any>[] = [];
  selectedDataRowId: string | null = null;
  editingDataRowId: string | null = null;
  selectedDataRecord: Record<string, any> | null = null;
  creatingDataRow = false;
  lookupOptions: Record<string, Array<{ value: string; label: string }>> = {};
  dataViewsLoading = false;
  dataRowsLoading = false;
  lookupLoading = false;
  dataSaving = false;
  dataDeleting = false;
  dataStatusMessage = "";
  private dataRowsRequestId = 0;

  constructor(
    private auth: AuthService,
    private router: Router,
    private state: EditorStateService,
    private familiesService: FamilyService,
    private templatesService: TemplateService,
    private organizationsService: OrganizationService,
    private filterRuntime: FilterRuntimeService,
    private documentData: DocumentDataService,
    private documentRender: DocumentRenderService,
    private documentsService: DocumentService,
    private tableViews: TableViewService,
    private notifications: NotificationService,
    private sanitizer: DomSanitizer,
    private elementRef: ElementRef,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.appLoadingMessage = "Chargement de votre espace...";
      await this.state.ensureResources([
        "organizations",
        "families",
        "templates",
      ]);
      const user = this.auth.getCurrentUser();
      this.organizationId =
        user?.organizationId ||
        this.organizationsService.getOrganizations()[0]?.id ||
        null;

      this.auth.setActiveOrganizationId(this.organizationId);

      const organization = this.organizationId
        ? this.organizationsService.getOrganization(this.organizationId)
        : null;
      this.organizationName = organization?.nom || organization?.name || "";
    } catch {
      this.notifications.showError("Impossible de charger votre espace.");
    } finally {
      this.loading = false;
    }
  }

  get families(): FamilyRecord[] {
    const search = this.familySearch.trim().toLowerCase();
    return this.familiesService.getFamilies().filter((family) => {
      const name = String(family.nom || family.name || "");
      return !search || name.toLowerCase().includes(search);
    });
  }

  get selectedFamily(): FamilyRecord | null {
    return this.selectedFamilyId
      ? this.familiesService.getFamily(this.selectedFamilyId)
      : null;
  }

  get selectedTemplate(): TemplateRecord | null {
    return this.selectedTemplateId
      ? this.templatesService.getTemplate(this.selectedTemplateId)
      : null;
  }

  get templates(): TemplateRecord[] {
    if (!this.selectedFamilyId) return [];
    const search = this.templateSearch.trim().toLowerCase();
    return this.templatesService
      .getTemplates(this.selectedFamilyId, this.organizationId)
      .filter((template) => {
        const name = String(template["nom"] || template["name"] || "");
        return !search || name.toLowerCase().includes(search);
      });
  }

  get filteredBeneficiaries(): BeneficiaryRecord[] {
    const search = this.beneficiarySearch.trim().toLowerCase();
    return this.beneficiaries.filter((beneficiary) => {
      const label = this.getBeneficiaryLabel(beneficiary);
      const subtitle = this.getBeneficiarySubtitle(beneficiary);
      return !search || `${label} ${subtitle}`.toLowerCase().includes(search);
    });
  }

  get selectedDataView(): TableViewConfig | null {
    return this.selectedDataViewId
      ? this.tableViews.getTableView(this.selectedDataViewId)
      : null;
  }

  async switchMode(mode: UserMode): Promise<void> {
    this.mode = mode;
    if (mode === "data") {
      this.dataViewsLoading = true;
      this.dataStatusMessage = "Chargement des modules...";
      try {
        await this.state.ensureResources(["tableViews", "modules"]);

        // Auto-select first module if available and none selected
        if (!this.selectedModuleId && this.modulesList.length > 0) {
          this.selectModule(this.modulesList[0].id);
        } else if (this.selectedDataView) {
          await this.renderDataContent();
        }
      } catch {
        this.notifications.showError("Impossible de charger les donnees.");
      } finally {
        this.dataViewsLoading = false;
        this.dataStatusMessage = "";
      }
    }
  }

  goToHistory(): void {
    this.router.navigate(["/documents"]);
  }

  get modulesList(): any[] {
    const search = this.dataViewSearch.trim().toLowerCase();
    const modules = this.state.getState().modules || [];
    const user = this.auth.getCurrentUser();
    const orgId = user?.organizationId;

    return modules.filter(
      (m) =>
        m.isActive &&
        (!orgId ||
          !m.organizationIds?.length ||
          m.organizationIds.includes(Number(orgId))) &&
        (!search || m.name.toLowerCase().includes(search)),
    );
  }

  get selectedModule(): any | null {
    return this.selectedModuleId
      ? this.state
          .getState()
          .modules.find((m: any) => m.id === this.selectedModuleId)
      : null;
  }

  selectModule(moduleId: string): void {
    this.selectedModuleId = moduleId;
    const module = this.selectedModule;
    if (module && module.tableViews.length > 0) {
      const primary =
        module.tableViews.find((mtv: any) => mtv.isPrimary) ||
        module.tableViews[0];
      this.selectModuleTableView(primary.tableViewConfigId);
    }
  }

  selectModuleTableView(tableViewId: string): void {
    this.activeModuleTableViewId = tableViewId;
    this.selectDataView(tableViewId);
  }

  toggleStep(step: Step): void {
    this.openSteps[step] = !this.openSteps[step];
  }

  templateCountForFamily(familyId: string): number {
    return this.templatesService.getTemplates(familyId, this.organizationId)
      .length;
  }

  selectFamily(familyId: string): void {
    this.selectedFamilyId = familyId;
    this.selectedTemplateId = null;
    this.selectedBeneficiaryId = null;
    this.beneficiaries = [];
    this.runtimeFilters = [];
    this.filterValues = {};
    this.templateSearch = "";
    this.beneficiarySearch = "";
    this.openSteps = { 1: false, 2: true, 3: false };
    this.showWait("Selectionnez un modele de document");
  }

  async selectTemplate(templateId: string): Promise<void> {
    if (this.documentBusy) return;
    this.selectedTemplateId = templateId;
    this.selectedBeneficiaryId = null;
    this.beneficiaries = [];
    this.beneficiarySearch = "";
    this.documentBusy = true;
    this.beneficiariesLoading = true;
    this.documentBusyMessage = "Preparation des filtres et beneficiaires...";
    try {
      await this.refreshRuntimeFilters(false);
      await this.buildBeneficiaryList();
      this.openSteps = { 1: false, 2: false, 3: true };
      const family = this.selectedFamily;
      if (
        family?.beneficiaryMode === "organization" &&
        this.beneficiaries.length === 1 &&
        !this.hasMissingRequiredFilters()
      ) {
        await this.selectBeneficiary(this.beneficiaries[0].id);
        return;
      }
      this.showWait(
        this.hasMissingRequiredFilters()
          ? "Renseignez les filtres pour continuer"
          : "Selectionnez le beneficiaire concerne",
      );
    } catch {
      this.notifications.showError("Impossible de preparer ce modele.");
      this.showWait("Reessayez ou choisissez un autre modele");
    } finally {
      this.beneficiariesLoading = false;
      this.documentBusy = false;
      this.documentBusyMessage = "";
    }
  }

  async onFilterChange(filterId: string, value: unknown): Promise<void> {
    if (this.documentBusy) return;
    this.filterValues = { ...this.filterValues, [filterId]: value || null };
    this.selectedBeneficiaryId = null;
    this.documentBusy = true;
    this.beneficiariesLoading = true;
    this.documentBusyMessage = "Mise a jour des beneficiaires...";
    try {
      await this.refreshRuntimeFilters(true);
      await this.buildBeneficiaryList();
      if (this.hasMissingRequiredFilters()) {
        this.showWait("Renseignez les filtres pour continuer");
        return;
      }
      const family = this.selectedFamily;
      if (
        family?.beneficiaryMode === "organization" &&
        this.beneficiaries.length === 1
      ) {
        await this.selectBeneficiary(this.beneficiaries[0].id);
        return;
      }
      this.showWait(
        this.beneficiaries.length
          ? "Selectionnez le beneficiaire concerne"
          : "Aucun beneficiaire disponible pour ces filtres",
      );
    } catch {
      this.notifications.showError("Impossible de mettre a jour les filtres.");
    } finally {
      this.beneficiariesLoading = false;
      this.documentBusy = false;
      this.documentBusyMessage = "";
    }
  }

  async selectBeneficiary(beneficiaryId: string): Promise<void> {
    if (this.documentBusy && !this.beneficiariesLoading) return;
    this.selectedBeneficiaryId = beneficiaryId;
    this.openSteps[3] = false;
    await this.generateDocument();
  }

  async generateDocument(): Promise<void> {
    if (
      !this.selectedFamilyId ||
      !this.selectedTemplateId ||
      this.hasMissingRequiredFilters()
    ) {
      this.notifications.showError("Completez les filtres obligatoires.");
      return;
    }
    const template = this.selectedTemplate;
    this.documentBusy = true;
    this.documentBusyMessage = "Generation du document...";
    try {
      const person = await this.documentData.getDocumentDataForFamily(
        this.selectedFamilyId,
        this.selectedBeneficiaryId,
        this.organizationId,
        this.filterValues,
      );
      if (!template || !person) return;
      const renderTemplate = this.withActiveOrganization(template);
      this.previewTemplate = renderTemplate;
      this.previewPerson = person;
      this.previewPlainHtml = this.documentRender.buildPreviewHtml(
        renderTemplate,
        person,
      );
      // Apply CSS vars to host so SCSS rules using var(--page-*) and var(--doc-*)
      // resolve correctly even before inline styles on .preview-page propagate.
      const themeVars = this.documentRender.getDocumentThemeVars(renderTemplate);
      Object.entries(themeVars).forEach(([key, value]) => {
        this.elementRef.nativeElement.style.setProperty(key, value as string);
      });
      this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(
        this.previewPlainHtml,
      );
      this.notifications.showSuccess("Document genere.");
    } catch {
      this.notifications.showError("Impossible de generer le document.");
      this.showWait("La generation a echoue. Reessayez.");
    } finally {
      this.documentBusy = false;
      this.documentBusyMessage = "";
    }
  }

  resetDocumentFlow(): void {
    this.selectedFamilyId = null;
    this.selectedTemplateId = null;
    this.selectedBeneficiaryId = null;
    this.beneficiaries = [];
    this.runtimeFilters = [];
    this.filterValues = {};
    this.openSteps = { 1: true, 2: false, 3: false };
    this.previewHtml = null;
    this.previewPlainHtml = "";
    this.previewTemplate = null;
    this.previewPerson = null;
    this.showWait("Completez les 3 etapes pour generer votre document");
  }

  async generateFinalDocument(): Promise<void> {
    if (!this.previewTemplate || !this.previewPerson) return;

    await this.persistGeneratedDocument();
    this.documentRender.printDocPaginated(
      this.previewTemplate,
      this.previewPerson,
    );
  }

  setZoom(delta: number): void {
    this.zoom =
      delta === 0 ? 100 : Math.max(40, Math.min(200, this.zoom + delta));
  }

  async selectDataView(viewId: string): Promise<void> {
    if (
      this.dataRowsLoading ||
      this.lookupLoading ||
      this.dataSaving ||
      this.dataDeleting
    ) {
      return;
    }
    this.selectedDataViewId = viewId;
    this.selectedDataRowId = null;
    this.selectedDataRecord = null;
    this.creatingDataRow = false;
    this.dataRows = [];
    this.dataRowSearch = "";
    await this.renderDataContent();
  }

  async renderDataContent(): Promise<void> {
    const view = this.selectedDataView;
    if (!view) return;
    this.lookupLoading = true;
    this.dataStatusMessage = "Chargement des listes de choix...";
    try {
      await this.ensureLookupOptions(view);
      await this.reloadDataRows();
    } catch {
      this.notifications.showError("Impossible de charger cette vue.");
    } finally {
      this.lookupLoading = false;
      this.dataStatusMessage = "";
    }
  }

  selectedFilters: { [key: string]: string[] } = {};

  async reloadDataRows(): Promise<void> {
    const view = this.selectedDataView;
    if (!view) return;
    const requestId = ++this.dataRowsRequestId;
    this.dataRowsLoading = true;
    this.dataStatusMessage = "Chargement des lignes...";
    try {
      const rows = await this.tableViews.getTableViewRows(view.id, {
        config: view,
        search: this.dataRowSearch,
        selectedFilters: this.selectedFilters,
      });
      if (requestId !== this.dataRowsRequestId) return;
      this.dataRows = rows;
      if (
        this.selectedDataRowId &&
        !this.dataRows.some(
          (row) => this.getDataRowId(view, row) === this.selectedDataRowId,
        )
      ) {
        this.selectedDataRowId = null;
        this.selectedDataRecord = null;
      }
      if (!this.selectedDataRowId && this.dataRows.length) {
        const firstRow = this.dataRows[0];
        this.selectedDataRowId = this.getDataRowId(view, firstRow);
        this.selectedDataRecord = { ...firstRow };
        this.creatingDataRow = false;
      }
    } catch {
      if (requestId === this.dataRowsRequestId) {
        this.notifications.showError("Impossible de charger les lignes.");
      }
    } finally {
      if (requestId === this.dataRowsRequestId) {
        this.dataRowsLoading = false;
        this.dataStatusMessage = "";
      }
    }
  }

  onFilterParamsChange(filters: { [key: string]: string[] }): void {
    this.selectedFilters = filters;
    void this.reloadDataRows();
  }

  async updateDataSearch(): Promise<void> {
    await this.reloadDataRows();
  }

  createDataRow(): void {
    const view = this.selectedDataView;
    if (!view || this.dataRowsLoading || this.dataSaving || this.dataDeleting)
      return;
    this.creatingDataRow = true;
    this.selectedDataRowId = null;
    this.selectedDataRecord = Object.fromEntries(
      view.visibleFields.map((field) => [field, ""]),
    );
  }

  selectDataRow(rowId: string): void {
    const view = this.selectedDataView;
    if (!view || this.dataRowsLoading || this.dataSaving || this.dataDeleting)
      return;
    this.creatingDataRow = false;
    this.selectedDataRowId = rowId;
    this.selectedDataRecord = {
      ...(this.dataRows.find((row) => this.getDataRowId(view, row) === rowId) ||
        {}),
    };
  }

  async saveDataRow(): Promise<void> {
    const view = this.selectedDataView;
    if (
      !view ||
      !this.selectedDataRecord ||
      this.dataSaving ||
      this.dataDeleting
    )
      return;
    const values = Object.fromEntries(
      view.editableFields.map((field) => [
        field,
        this.selectedDataRecord?.[field] ?? "",
      ]),
    );
    this.dataSaving = true;
    this.dataStatusMessage = this.creatingDataRow
      ? "Ajout de la ligne..."
      : "Enregistrement...";
    try {
      if (this.creatingDataRow) {
        const record = await this.tableViews.createTableViewRecord(
          view.id,
          values,
          view,
        );
        this.selectedDataRecord = record ? { ...record } : null;
        this.selectedDataRowId = record
          ? this.getDataRowId(view, record)
          : null;
        this.creatingDataRow = false;
        this.notifications.showSuccess("Ligne ajoutee.");
      } else if (this.selectedDataRowId) {
        const record = await this.tableViews.saveTableViewRecord(
          view.id,
          this.selectedDataRowId,
          values,
        );
        this.selectedDataRecord = record
          ? { ...record }
          : this.selectedDataRecord;
        this.notifications.showSuccess("Ligne enregistree.");
      }
      await this.reloadDataRows();
    } catch {
      this.notifications.showError("Impossible d'enregistrer la ligne.");
    } finally {
      this.dataSaving = false;
      this.dataStatusMessage = "";
    }
  }

  async deleteDataRow(): Promise<void> {
    const view = this.selectedDataView;
    if (!view || this.dataDeleting || this.dataSaving) return;
    if (this.creatingDataRow) {
      this.creatingDataRow = false;
      this.selectedDataRecord = null;
      return;
    }
    const rowId =
      this.selectedDataRowId ||
      (this.selectedDataRecord
        ? this.getDataRowId(view, this.selectedDataRecord)
        : null);
    if (rowId === null || rowId === undefined) {
      this.notifications.showError("Selectionnez une ligne a supprimer.");
      return;
    }
    this.selectedDataRowId = rowId;
    const previewLabel =
      this.buildDataPreviewLabel(view, this.selectedDataRecord) ||
      "cette ligne";

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Supprimer la ligne ?",
        message: `La ligne "${previewLabel}" sera supprimée.`,
        confirmText: "Supprimer",
        cancelText: "Annuler",
        actionType: "delete",
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        this.dataDeleting = true;
        this.dataStatusMessage = "Suppression de la ligne...";
        try {
          await this.tableViews.deleteTableViewRecord(view.id, rowId);
          this.selectedDataRowId = null;
          this.selectedDataRecord = null;
          this.notifications.showSuccess("Ligne supprimee.");
          await this.reloadDataRows();
        } catch {
          this.notifications.showError("Impossible de supprimer la ligne.");
        } finally {
          this.dataDeleting = false;
          this.dataStatusMessage = "";
        }
      }
    });
  }

  isFieldEditable(field: string): boolean {
    return !!this.selectedDataView?.editableFields.includes(field);
  }

  getRowId(row: Record<string, any>): string {
    return this.getDataRowId(this.selectedDataView, row);
  }

  getDataRowId(view: TableViewConfig | null, row: Record<string, any>): string {
    const keys = Object.keys(row || {});
    const directKey = keys.find((key) => ["id", "Id", "ID"].includes(key));
    if (directKey && row[directKey] !== null && row[directKey] !== undefined) {
      return String(row[directKey]);
    }

    const configuredFields = new Set(
      [
        ...(view?.visibleFields || []),
        ...(view?.editableFields || []),
        ...(view?.previewFields || []),
      ].map((field) => field.toLowerCase()),
    );
    const injectedKey = keys.find(
      (key) => !configuredFields.has(key.toLowerCase()),
    );
    if (
      injectedKey &&
      row[injectedKey] !== null &&
      row[injectedKey] !== undefined
    ) {
      return String(row[injectedKey]);
    }

    const keyLikeId = keys.find((key) => /(^id_|_id$|id$)/i.test(key));
    if (keyLikeId && row[keyLikeId] !== null && row[keyLikeId] !== undefined) {
      return String(row[keyLikeId]);
    }

    const firstKey = keys.find(
      (key) => row[key] !== null && row[key] !== undefined,
    );
    return firstKey ? String(row[firstKey]) : "";
  }

  getDataFieldLabel(view: TableViewConfig, field: string): string {
    return view.fieldLabels[field] || this.humanize(field);
  }

  getTableViewLabelById(id: string): string {
    const tv = this.tableViews.getTableView(id);
    return tv ? tv.label || tv.tableName : id;
  }

  getDisplayValue(
    view: TableViewConfig,
    field: string,
    rawValue: unknown,
  ): string {
    const setting = view.fieldSettings[field];
    if (setting?.displayMode !== "lookup") return String(rawValue ?? "");
    const match = this.lookupOptions[`${view.id}::${field}`]?.find(
      (option) => String(option.value) === String(rawValue ?? ""),
    );
    return match?.label || String(rawValue ?? "");
  }

  buildDataPreviewLabel(
    view: TableViewConfig,
    record: Record<string, any> | null,
  ): string {
    if (!record) return "";
    return view.previewFields
      .map((field) => this.getDisplayValue(view, field, record[field]))
      .filter(Boolean)
      .join(" - ");
  }

  getFamilyName(family: FamilyRecord | null = this.selectedFamily): string {
    return String(family?.nom || family?.name || "");
  }

  getTemplateName(
    template: TemplateRecord | null = this.selectedTemplate,
  ): string {
    return String(template?.["nom"] || template?.["name"] || "");
  }

  getTemplateUpdatedAt(template: TemplateRecord): string | null {
    return (template["updatedAt"] as string | null | undefined) || null;
  }

  logout(): void {
    this.auth.logout();
  }

  getSelectedBeneficiary(): BeneficiaryRecord | null {
    return (
      this.beneficiaries.find(
        (b) => String(b.id) === String(this.selectedBeneficiaryId),
      ) || null
    );
  }

  getBeneficiaryLabel(
    beneficiary: BeneficiaryRecord | null | undefined,
  ): string {
    return String(
      beneficiary?._displayLabel ||
        beneficiary?.["nom_prenom"] ||
        beneficiary?.["nom"] ||
        "Beneficiaire",
    );
  }

  getBeneficiarySubtitle(
    beneficiary: BeneficiaryRecord | null | undefined,
  ): string {
    return String(
      beneficiary?._displaySubtitle ||
        (beneficiary?._sourceTable === "organization"
          ? "Document Organization"
          : this.getBeneficiaryTypeLabel()),
    );
  }

  getBeneficiaryTypeLabel(): string {
    const family = this.selectedFamily;
    if (!family) return "Beneficiaire";
    if (family.beneficiaryMode === "organization") return "Organization";
    return String(
      family.beneficiaryTableLabel || family.beneficiaryTable || "Beneficiaire",
    );
  }

  getInitials(label: string): string {
    return label
      .split(" ")
      .map((part) => part[0] || "")
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  private async refreshRuntimeFilters(preserveValues: boolean): Promise<void> {
    if (!this.selectedFamilyId || !this.selectedTemplateId) {
      this.runtimeFilters = [];
      this.filterValues = {};
      return;
    }
    const baseValues = preserveValues
      ? this.filterValues
      : this.filterRuntime.getDefaultFilterValues(
          this.selectedFamilyId,
          this.selectedTemplateId,
          "user",
        );
    this.runtimeFilters =
      await this.filterRuntime.resolveTemplateFiltersForRole(
        this.selectedFamilyId,
        this.selectedTemplateId,
        "user",
        this.organizationId,
        baseValues,
      );
    this.filterValues = this.filterRuntime.validateRuntimeFilterValues(
      this.runtimeFilters,
      baseValues,
    );
  }

  private async buildBeneficiaryList(): Promise<void> {
    if (!this.selectedFamilyId || this.hasMissingRequiredFilters()) {
      this.beneficiaries = [];
      return;
    }
    this.beneficiaries = await this.familiesService.getBeneficiariesForFamily(
      this.selectedFamilyId,
      this.organizationId,
      this.filterValues,
    );
  }

  private hasMissingRequiredFilters(): boolean {
    return this.runtimeFilters.some((entry) => {
      if (!entry.profile.required) return false;
      const value = this.filterValues[entry.id];
      return (
        value === undefined || value === null || String(value).trim() === ""
      );
    });
  }

  private showWait(message: string): void {
    this.waitMessage = message;
    this.previewHtml = null;
    this.previewPlainHtml = "";
    this.previewTemplate = null;
    this.previewPerson = null;
  }

  private async persistGeneratedDocument(): Promise<void> {
    if (
      !this.previewTemplate ||
      !this.previewPerson ||
      !this.selectedFamilyId ||
      !this.selectedTemplateId
    ) {
      return;
    }

    const selectedBeneficiary = this.getSelectedBeneficiary();
    const family = this.selectedFamily;
    if (!family) return;

    const printPages = this.documentRender.renderDocumentPages(
      this.withActiveOrganization(this.previewTemplate),
      this.previewPerson,
      { mode: "print" },
    );
    const printableHtml = await this.documentRender.buildStandaloneDocumentHtml(
      this.withActiveOrganization(this.previewTemplate),
      printPages,
      "document-page",
      { mode: "print" },
    );

    const templateTitle =
      this.getTemplateName(this.previewTemplate) || "Document";
    const beneficiaryLabel = this.getBeneficiaryLabel(selectedBeneficiary);
    const title = `${templateTitle} - ${beneficiaryLabel}`;

    try {
      await this.documentsService.createDocument({
        familyId: this.selectedFamilyId,
        templateId: this.selectedTemplateId,
        graphicCharterId: this.previewTemplate.graphicCharterId || null,
        beneficiaryId: this.selectedBeneficiaryId,
        beneficiaryMode: family.beneficiaryMode,
        beneficiaryTable: family.beneficiaryTable,
        beneficiaryTableLabel:
          family.beneficiaryTableLabel || family.beneficiaryTable || null,
        beneficiaryLinkColumn: family.beneficiaryLinkColumn,
        beneficiaryDisplayColumn1: family.beneficiaryDisplayColumn1,
        beneficiaryDisplayColumn2: family.beneficiaryDisplayColumn2,
        beneficiaryDisplayValue1: beneficiaryLabel,
        beneficiaryDisplayValue2:
          this.getBeneficiarySubtitle(selectedBeneficiary),
        title,
        fullHtml: printableHtml,
        mimeType: "text/html",
        status: "generated",
      });
    } catch {
      this.notifications.showWarning(
        "Impression lancee mais la sauvegarde du document a echoue.",
      );
    }
  }

  private async ensureLookupOptions(view: TableViewConfig): Promise<void> {
    const lookupFields = Object.entries(view.fieldSettings || {})
      .filter(([, config]) => config?.displayMode === "lookup")
      .map(([field]) => field);
    for (const field of lookupFields) {
      const key = `${view.id}::${field}`;
      if (!this.lookupOptions[key]) {
        this.lookupOptions[key] =
          await this.tableViews.getTableViewLookupOptions(view.id, field, view);
      }
    }
  }

  private humanize(value: string): string {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private withActiveOrganization(template: TemplateRecord): TemplateRecord {
    return {
      ...template,
      organizationId:
        template.organizationId || this.organizationId || template.organizationId,
    };
  }
}
