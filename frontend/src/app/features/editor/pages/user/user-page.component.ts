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
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { BeneficiaryRecord, FamilyRecord } from "../../models/family.model";
import { FilterValueMap, RuntimeFilterEntry } from "../../models/filter.model";
import { TemplateRecord } from "../../models/template.model";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { FilterRuntimeService } from "../../services/filter-runtime.service";
import { DocumentDataService } from "../../services/document-data.service";
import {
  DocumentPrintJob,
  DocumentRenderService,
} from "../../services/document-render.service";
import { OrganizationService } from "../../services/organization.service";
import { TemplateService } from "../../services/template.service";
import { DocumentService } from "../../services/document.service";
import { UserMenuComponent } from "../../../../shared/components/user-menu/user-menu.component";
import { ActiveAcademicYearPillComponent } from "../../../../shared/components/active-academic-year-pill/active-academic-year-pill.component";

type Step = 1 | 2 | 3;

@Component({
  selector: "app-user-page",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UserMenuComponent,
    ActiveAcademicYearPillComponent,
  ],
  templateUrl: "./user-page.component.html",
  styleUrls: ["./user-page.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class UserPageComponent implements OnInit {
  loading = true;
  appLoadingMessage = "Chargement...";
  organizationId: string | null = null;
  organizationName = "";

  selectedFamilyId: string | null = null;
  selectedTemplateId: string | null = null;
  selectedBeneficiaryId: string | null = null;
  selectedBeneficiaryIds = new Set<string>();
  beneficiaries: BeneficiaryRecord[] = [];
  beneficiaryPage = 1;
  readonly beneficiaryPageSize = 50;
  runtimeFilters: RuntimeFilterEntry[] = [];
  filterValues: FilterValueMap = {};
  currentStep: number = 1;

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
  bulkGenerationProgress = "";

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
    private notifications: NotificationService,
    private sanitizer: DomSanitizer,
    private elementRef: ElementRef,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.appLoadingMessage = "Chargement de votre espace...";
      await this.state.ensureResources([
        "organizations",
        "families",
        "templates",
        "modules",
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

  get pagedBeneficiaries(): BeneficiaryRecord[] {
    const start = (this.beneficiaryPage - 1) * this.beneficiaryPageSize;
    return this.filteredBeneficiaries.slice(
      start,
      start + this.beneficiaryPageSize,
    );
  }

  get beneficiaryTotalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.filteredBeneficiaries.length / this.beneficiaryPageSize),
    );
  }

  onBeneficiarySearchChange(): void {
    this.beneficiaryPage = 1;
  }

  goToArchive(): void {
    this.router.navigate(["/archives"]);
  }

  goHome(): void {
    this.router.navigate(["/user"]);
  }

  goToStep(step: number): void {
    if (step === 2 && !this.selectedFamilyId) return;
    if (step === 3 && !this.selectedTemplateId) return;
    if (step === 4 && !this.selectedBeneficiaryId && !this.selectedBulkCount)
      return;
    this.currentStep = step;
  }

  templateCountForFamily(familyId: string): number {
    return this.templatesService.getTemplates(familyId, this.organizationId)
      .length;
  }

  selectFamily(familyId: string): void {
    this.selectedFamilyId = familyId;
    this.selectedTemplateId = null;
    this.selectedBeneficiaryId = null;
    this.selectedBeneficiaryIds.clear();
    this.beneficiaries = [];
    this.beneficiaryPage = 1;
    this.runtimeFilters = [];
    this.filterValues = {};
    this.templateSearch = "";
    this.beneficiarySearch = "";
    this.currentStep = 2;
    this.showWait("Selectionnez un modele de document");
  }

  async selectTemplate(templateId: string): Promise<void> {
    if (this.documentBusy) return;
    this.selectedTemplateId = templateId;
    this.selectedBeneficiaryId = null;
    this.selectedBeneficiaryIds.clear();
    this.beneficiaries = [];
    this.beneficiaryPage = 1;
    this.beneficiarySearch = "";
    this.documentBusy = true;
    this.beneficiariesLoading = true;
    this.documentBusyMessage = "Preparation des filtres et beneficiaires...";
    try {
      await this.refreshRuntimeFilters(false);
      await this.buildBeneficiaryList();
      this.currentStep = 3;
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
    this.selectedBeneficiaryIds.clear();
    this.beneficiaryPage = 1;
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
    this.currentStep = 4;
    await this.generateDocument();
  }

  isBeneficiarySelected(beneficiaryId: string | null | undefined): boolean {
    return (
      !!beneficiaryId && this.selectedBeneficiaryIds.has(String(beneficiaryId))
    );
  }

  toggleBeneficiarySelection(
    event: Event,
    beneficiaryId: string | null | undefined,
  ): void {
    event.stopPropagation();
    if (this.documentBusy || !beneficiaryId) return;
    const id = String(beneficiaryId);
    if (this.selectedBeneficiaryIds.has(id)) {
      this.selectedBeneficiaryIds.delete(id);
    } else {
      this.selectedBeneficiaryIds.add(id);
    }
  }

  toggleCurrentPageSelection(): void {
    if (this.documentBusy || !this.pagedBeneficiaries.length) return;
    const pageIds = this.pagedBeneficiaries
      .map((beneficiary) => String(beneficiary.id || ""))
      .filter(Boolean);
    const allSelected = pageIds.every((id) =>
      this.selectedBeneficiaryIds.has(id),
    );
    pageIds.forEach((id) => {
      if (allSelected) {
        this.selectedBeneficiaryIds.delete(id);
      } else {
        this.selectedBeneficiaryIds.add(id);
      }
    });
  }

  clearBulkSelection(): void {
    if (this.documentBusy) return;
    this.selectedBeneficiaryIds.clear();
  }

  get selectedBulkBeneficiaries(): BeneficiaryRecord[] {
    return this.beneficiaries.filter((beneficiary) =>
      this.selectedBeneficiaryIds.has(String(beneficiary.id)),
    );
  }

  get selectedBulkCount(): number {
    return this.selectedBeneficiaryIds.size;
  }

  get allPagedBeneficiariesSelected(): boolean {
    return (
      this.pagedBeneficiaries.length > 0 &&
      this.pagedBeneficiaries.every((beneficiary) =>
        this.selectedBeneficiaryIds.has(String(beneficiary.id)),
      )
    );
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
      const themeVars =
        this.documentRender.getDocumentThemeVars(renderTemplate);
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
    this.selectedBeneficiaryIds.clear();
    this.beneficiaries = [];
    this.runtimeFilters = [];
    this.filterValues = {};
    this.currentStep = 1;
    this.previewHtml = null;
    this.previewPlainHtml = "";
    this.previewTemplate = null;
    this.previewPerson = null;
    this.showWait("Completez les 3 etapes pour generer votre document");
  }

  async generateFinalDocument(): Promise<void> {
    if (!this.previewTemplate || !this.previewPerson) return;

    await this.persistGeneratedDocument();
    await this.documentRender.printDocPaginatedAsync(
      this.previewTemplate,
      this.previewPerson,
    );
  }

  async generateBulkDocuments(): Promise<void> {
    if (
      !this.selectedFamilyId ||
      !this.selectedTemplateId ||
      this.hasMissingRequiredFilters()
    ) {
      this.notifications.showError("Completez les filtres obligatoires.");
      return;
    }
    const template = this.selectedTemplate;
    const family = this.selectedFamily;
    const beneficiaries = this.selectedBulkBeneficiaries;
    if (!template || !family || !beneficiaries.length) {
      this.notifications.showError("Selectionnez au moins un beneficiaire.");
      return;
    }

    const renderTemplate = this.withActiveOrganization(template);
    const printJobs: DocumentPrintJob[] = [];
    let successCount = 0;
    let failedCount = 0;

    this.documentBusy = true;
    this.bulkGenerationProgress = "";
    try {
      for (const [index, beneficiary] of beneficiaries.entries()) {
        this.documentBusyMessage = `Generation ${index + 1}/${beneficiaries.length}...`;
        this.bulkGenerationProgress = this.documentBusyMessage;
        try {
          const person = await this.documentData.getDocumentDataForFamily(
            this.selectedFamilyId,
            beneficiary.id,
            this.organizationId,
            this.filterValues,
          );
          if (!person) {
            failedCount += 1;
            continue;
          }
          await this.persistGeneratedDocumentFor(
            renderTemplate,
            person,
            beneficiary,
            String(beneficiary.id || ""),
          );
          printJobs.push({ template: renderTemplate, person });
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (!successCount) {
        this.notifications.showError("Aucun document n'a pu etre genere.");
        return;
      }

      await this.documentRender.printDocsPaginatedAsync(printJobs);
      this.notifications.showSuccess(
        `${successCount} document(s) genere(s) et archive(s).`,
      );
      if (failedCount) {
        this.notifications.showWarning(
          `${failedCount} document(s) n'ont pas pu etre generes.`,
        );
      }
    } finally {
      this.documentBusy = false;
      this.documentBusyMessage = "";
      this.bulkGenerationProgress = "";
    }
  }

  setZoom(delta: number): void {
    this.zoom =
      delta === 0 ? 100 : Math.max(40, Math.min(200, this.zoom + delta));
  }

  goToPreviousBeneficiaryPage(): void {
    if (this.beneficiaryPage <= 1) return;
    this.beneficiaryPage -= 1;
  }

  goToNextBeneficiaryPage(): void {
    if (this.beneficiaryPage >= this.beneficiaryTotalPages) return;
    this.beneficiaryPage += 1;
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
    const validIds = new Set(
      this.beneficiaries.map((beneficiary) => String(beneficiary.id || "")),
    );
    Array.from(this.selectedBeneficiaryIds).forEach((id) => {
      if (!validIds.has(id)) this.selectedBeneficiaryIds.delete(id);
    });
    this.beneficiaryPage = 1;
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

    try {
      await this.persistGeneratedDocumentFor(
        this.withActiveOrganization(this.previewTemplate),
        this.previewPerson,
        selectedBeneficiary,
        this.selectedBeneficiaryId,
      );
    } catch {
      this.notifications.showWarning(
        "Impression lancee mais la sauvegarde du document a echoue.",
      );
    }
  }

  private async persistGeneratedDocumentFor(
    template: TemplateRecord,
    person: Record<string, any>,
    beneficiary: BeneficiaryRecord | null,
    beneficiaryId: string | null,
  ): Promise<void> {
    if (!this.selectedFamilyId || !this.selectedTemplateId) return;
    const family = this.selectedFamily;
    if (!family) return;

    const printPages = this.documentRender.renderDocumentPages(
      template,
      person,
      {
        mode: "print",
      },
    );
    const printableHtml = await this.documentRender.buildStandaloneDocumentHtml(
      template,
      printPages,
      "document-page",
      { mode: "print" },
    );

    const templateTitle = this.getTemplateName(template) || "Document";
    const beneficiaryLabel = this.getBeneficiaryLabel(beneficiary);
    const title = `${templateTitle} - ${beneficiaryLabel}`;

    await this.documentsService.createDocument({
      familyId: this.selectedFamilyId,
      templateId: this.selectedTemplateId,
      graphicCharterId: template.graphicCharterId || null,
      beneficiaryId,
      beneficiaryMode: family.beneficiaryMode,
      beneficiaryTable: family.beneficiaryTable,
      beneficiaryTableLabel:
        family.beneficiaryTableLabel || family.beneficiaryTable || null,
      beneficiaryLinkColumn: family.beneficiaryLinkColumn,
      beneficiaryDisplayColumn1: family.beneficiaryDisplayColumn1,
      beneficiaryDisplayColumn2: family.beneficiaryDisplayColumn2,
      beneficiaryDisplayValue1: beneficiaryLabel,
      beneficiaryDisplayValue2: this.getBeneficiarySubtitle(beneficiary),
      title,
      fullHtml: printableHtml,
      mimeType: "text/html",
      status: "generated",
    });
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
        template.organizationId ||
        this.organizationId ||
        template.organizationId,
    };
  }
}
