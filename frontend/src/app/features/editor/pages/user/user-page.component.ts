import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { BeneficiaryRecord, FamilyRecord } from "../../models/family.model";
import { FilterValueMap, RuntimeFilterEntry } from "../../models/filter.model";

import { TemplateRecord } from "../../models/template.model";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { FilterRuntimeService } from "../../services/filter-runtime.service";
import { DocumentDataService } from "../../services/document-data.service";
import { DocumentRenderService } from "../../services/document-render.service";
import { OrganizationService } from "../../services/organization.service";

import { TemplateService } from "../../services/template.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";

type UserMode = string;
type Step = 1 | 2 | 3;

@Component({
  selector: "app-user-page",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
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



  constructor(
    private auth: AuthService,
    private state: EditorStateService,
    private familiesService: FamilyService,
    private templatesService: TemplateService,
    private organizationsService: OrganizationService,
    private filterRuntime: FilterRuntimeService,
    private documentData: DocumentDataService,
    private documentRender: DocumentRenderService,
    
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
      this.previewTemplate = template;
      this.previewPerson = person;
      this.previewPlainHtml = this.documentRender.buildPreviewHtml(
        template,
        person,
      );
      // Apply CSS vars to host so SCSS rules using var(--page-*) and var(--doc-*)
      // resolve correctly even before inline styles on .preview-page propagate.
      const themeVars = this.documentRender.getDocumentThemeVars(template);
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

  private humanize(value: string): string {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
