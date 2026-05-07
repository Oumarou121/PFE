import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
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

type UserMode = "documents" | "data";
type Step = 1 | 2 | 3;

@Component({
  selector: "app-user-page",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./user-page.component.html",
  styleUrls: ["./user-page.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class UserPageComponent implements OnInit {
  loading = true;
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

  confirmModal: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } = {
    open: false,
    title: "",
    message: "",
    confirmLabel: "Supprimer",
    onConfirm: () => {},
  };

  selectedDataViewId: string | null = null;
  dataViewSearch = "";
  dataRowSearch = "";
  dataRows: Record<string, any>[] = [];
  selectedDataRowId: string | null = null;
  selectedDataRecord: Record<string, any> | null = null;
  creatingDataRow = false;
  lookupOptions: Record<string, Array<{ value: string; label: string }>> = {};

  constructor(
    private auth: AuthService,
    private state: EditorStateService,
    private familiesService: FamilyService,
    private templatesService: TemplateService,
    private organizationsService: OrganizationService,
    private filterRuntime: FilterRuntimeService,
    private documentData: DocumentDataService,
    private documentRender: DocumentRenderService,
    private tableViews: TableViewService,
    private notifications: NotificationService,
    private sanitizer: DomSanitizer,
  ) {}

  async ngOnInit(): Promise<void> {
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
    const organization = this.organizationId
      ? this.organizationsService.getOrganization(this.organizationId)
      : null;
    this.organizationName = organization?.nom || organization?.name || "";
    this.loading = false;
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

  get dataViewsList(): TableViewConfig[] {
    const search = this.dataViewSearch.trim().toLowerCase();
    return this.tableViews.getTableViews().filter((view) => {
      return (
        !search ||
        view.label.toLowerCase().includes(search) ||
        view.tableName.toLowerCase().includes(search)
      );
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
      await this.state.ensureResources(["tableViews"]);
      if (this.selectedDataView) await this.renderDataContent();
    }
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
    this.selectedTemplateId = templateId;
    this.selectedBeneficiaryId = null;
    this.beneficiaries = [];
    this.beneficiarySearch = "";
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
  }

  async onFilterChange(filterId: string, value: unknown): Promise<void> {
    this.filterValues = { ...this.filterValues, [filterId]: value || null };
    this.selectedBeneficiaryId = null;
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
  }

  async selectBeneficiary(beneficiaryId: string): Promise<void> {
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
    const person = await this.documentData.getDocumentDataForFamily(
      this.selectedFamilyId,
      this.selectedBeneficiaryId,
      this.organizationId,
      this.filterValues,
    );
    if (!template || !person) return;
    this.previewTemplate = template;
    this.previewPerson = person;
    this.previewPlainHtml = this.documentRender.buildPreviewHtml(
      template,
      person,
    );
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(
      this.previewPlainHtml,
    );
    this.notifications.showSuccess("Document genere.");
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

  printDocument(): void {
    if (!this.previewTemplate || !this.previewPerson) return;
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
    await this.ensureLookupOptions(view);
    await this.reloadDataRows();
  }

  async reloadDataRows(): Promise<void> {
    const view = this.selectedDataView;
    if (!view) return;
    this.dataRows = await this.tableViews.getTableViewRows(view.id, {
      config: view,
      search: this.dataRowSearch,
    });
    if (!this.selectedDataRowId && this.dataRows.length) {
      this.selectDataRow(this.getRowId(this.dataRows[0]));
    }
  }

  async updateDataSearch(): Promise<void> {
    await this.reloadDataRows();
  }

  createDataRow(): void {
    const view = this.selectedDataView;
    if (!view) return;
    this.creatingDataRow = true;
    this.selectedDataRowId = null;
    this.selectedDataRecord = Object.fromEntries(
      view.visibleFields.map((field) => [field, ""]),
    );
  }

  selectDataRow(rowId: string): void {
    this.creatingDataRow = false;
    this.selectedDataRowId = rowId;
    this.selectedDataRecord = {
      ...(this.dataRows.find((row) => this.getRowId(row) === rowId) || {}),
    };
  }

  async saveDataRow(): Promise<void> {
    const view = this.selectedDataView;
    if (!view || !this.selectedDataRecord) return;
    const values = Object.fromEntries(
      view.editableFields.map((field) => [
        field,
        this.selectedDataRecord?.[field] ?? "",
      ]),
    );
    if (this.creatingDataRow) {
      const record = await this.tableViews.createTableViewRecord(
        view.id,
        values,
        view,
      );
      this.selectedDataRecord = record ? { ...record } : null;
      this.selectedDataRowId = record ? this.getRowId(record) : null;
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
  }

  async deleteDataRow(): Promise<void> {
    const view = this.selectedDataView;
    if (!view) return;
    if (this.creatingDataRow) {
      this.creatingDataRow = false;
      this.selectedDataRecord = null;
      return;
    }
    if (!this.selectedDataRowId) return;
    const rowId = this.selectedDataRowId;
    const previewLabel =
      this.buildDataPreviewLabel(view, this.selectedDataRecord) ||
      "cette ligne";
    this.confirmModal = {
      open: true,
      title: "Supprimer la ligne ?",
      message: `La ligne "${previewLabel}" sera supprimée.`,
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        this.closeConfirmModal();
        await this.tableViews.deleteTableViewRecord(view.id, rowId);
        this.selectedDataRowId = null;
        this.selectedDataRecord = null;
        this.notifications.showSuccess("Ligne supprimee.");
        await this.reloadDataRows();
      },
    };
  }

  closeConfirmModal(): void {
    this.confirmModal = { ...this.confirmModal, open: false };
  }

  isFieldEditable(field: string): boolean {
    return !!this.selectedDataView?.editableFields.includes(field);
  }

  getRowId(row: Record<string, any>): string {
    return String(row["id"] ?? row["Id"] ?? Object.values(row)[0] ?? "");
  }

  getDataFieldLabel(view: TableViewConfig, field: string): string {
    return view.fieldLabels[field] || this.humanize(field);
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
}
