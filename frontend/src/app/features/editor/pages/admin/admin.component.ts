import { CommonModule } from "@angular/common";
import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { firstValueFrom } from "rxjs";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import FontFamily from "@tiptap/extension-font-family";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { BeneficiaryRecord, FamilyRecord } from "../../models/family.model";
import { TemplateRecord } from "../../models/template.model";
import { OrganizationRecord } from "../../models/organization.model";
import {
  FilterValueMap,
  RuntimeFilterEntry,
  TemplateFilterProfileEntry,
} from "../../models/filter.model";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { TemplateService } from "../../services/template.service";
import { OrganizationService } from "../../services/organization.service";
import { DocumentRenderService } from "../../services/document-render.service";
import { GraphicCharterService } from "../../services/graphic-charter.service";
import { FilterRuntimeService } from "../../services/filter-runtime.service";
import { DocumentDataService } from "../../services/document-data.service";
import {
  getFamilyFilterCatalog,
  normalizeTemplateFilterProfile,
  normalizeTemplateFilterProfileEntry,
  normalizeTemplateRecord,
} from "../../services/editor-normalizers";
import {
  GraphicCharterConfig,
  GraphicCharterRecord,
} from "../../models/graphic-charter.model";

type AdminSection = "header" | "body" | "footer" | "filters";
type PageOrientation = "portrait" | "landscape";
type GraphicCharterEditorSection = "header" | "footer";

interface PageSettingsForm {
  orientation: PageOrientation;
  mt: number;
  mb: number;
  ml: number;
  mr: number;
  headerTop: number;
  footerBottom: number;
}

interface WatermarkForm {
  enabled: boolean;
  text: string;
  color: string;
  opacity: number;
  size: number;
}

interface AdminVariableGroup {
  id: "simple" | "list" | "table";
  nom: string;
  name: string;
  count: number;
}

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) =>
          attributes["fontSize"]
            ? { style: `font-size: ${attributes["fontSize"]}` }
            : {},
      },
    };
  },
});

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: "./admin.component.html",
  styleUrls: ["./admin.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class AdminComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild("editorHost") private editorHost?: ElementRef<HTMLElement>;
  @ViewChild("graphicCharterHeaderHost")
  private graphicCharterHeaderHost?: ElementRef<HTMLElement>;
  @ViewChild("graphicCharterFooterHost")
  private graphicCharterFooterHost?: ElementRef<HTMLElement>;

  isLoading = true;
  sidebarOpen = true;
  varsPanelVisible = false;
  activeSection: AdminSection = "body";
  selectedFamilyId = "";
  selectedTemplateId = "";
  templateNameDraft = "";
  saveStatus = "Prêt";
  previewOpen = false;
  previewHtml: SafeHtml = "";
  previewBeneficiaries: BeneficiaryRecord[] = [];
  previewBeneficiarySearch = "";
  selectedPreviewBeneficiaryId = "";
  previewLoading = false;
  previewRuntimeFilters: RuntimeFilterEntry[] = [];
  previewFilterValues: FilterValueMap = {};
  zoomLevel = 100;
  searchPanelOpen = false;
  searchFind = "";
  searchReplace = "";
  searchCaseSensitive = false;
  searchMatchCount = 0;
  searchMatchIndex = 0;
  selectedDateVariable = "{{date_du_jour}}";
  selectedGraphicCharterId = "";
  hasHeader = false;
  hasFooter = false;
  linkModalOpen = false;
  imageModalOpen = false;
  tableModalOpen = false;
  dateVariableModalOpen = false;
  linkUrl = "";
  imageUrl = "";
  imageAlt = "";
  tableRows = 3;
  tableCols = 3;
  pageSettingsModalOpen = false;
  watermarkModalOpen = false;
  pageSettingsForm: PageSettingsForm = {
    orientation: "portrait",
    mt: 20,
    mb: 20,
    ml: 25,
    mr: 25,
    headerTop: 5,
    footerBottom: 5,
  };
  watermarkForm: WatermarkForm = {
    enabled: false,
    text: "CONFIDENTIEL",
    color: "#000000",
    opacity: 0.07,
    size: 80,
  };
  sectionDirections: Record<"header" | "body" | "footer", "ltr" | "rtl"> = {
    header: "ltr",
    body: "ltr",
    footer: "ltr",
  };
  readonly dateVariableOptions = [
    { label: "Date du jour", value: "{{date_du_jour}}" },
    { label: "Date longue", value: "{{date_du_jour_longue}}" },
    { label: "Date courte", value: "{{date_du_jour_courte}}" },
    { label: "Date ISO", value: "{{date_du_jour_iso}}" },
  ];
  activeVariableGroupId = "simple";
  templateFilterProfile: TemplateFilterProfileEntry[] = [];
  runtimeAdminFilters: RuntimeFilterEntry[] = [];
  graphicCharterModalOpen = false;
  editingGraphicCharterId: string | null = null;
  graphicCharterForm = {
    name: "",
    description: "",
    isDefault: false,
    orientation: "portrait",
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 25,
    marginRight: 25,
    headerTop: 5,
    footerBottom: 5,
    primary: "#1d4ed8",
    secondary: "#475569",
    text: "#111111",
    heading: "#0f172a",
    border: "#c8cdd8",
    tableHeaderBg: "#ffffff",
    tableAltRowBg: "#f8fafc",
    bodyFont: '"Times New Roman", Times, serif',
    headingFont: '"Times New Roman", Times, serif',
    backgroundEnabled: false,
    backgroundImage: "",
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
    headerEnabled: true,
    headerDisplay: "all",
    headerHtml: "",
    footerEnabled: true,
    footerDisplay: "all",
    footerHtml: "",
    watermarkEnabled: false,
    watermarkText: "",
    watermarkColor: "#94a3b8",
    watermarkOpacity: 0.08,
  };
  private editor: Editor | null = null;
  private editorBoundElement: HTMLElement | null = null;
  private editorSection: "header" | "body" | "footer" | null = null;
  private graphicCharterHeaderEditor: Editor | null = null;
  private graphicCharterFooterEditor: Editor | null = null;
  private searchMatches: Array<{ from: number; to: number }> = [];
  toolbarStateVersion = 0;

  families: FamilyRecord[] = [];
  templates: TemplateRecord[] = [];
  organizations: OrganizationRecord[] = [];

  editorContent: Record<"header" | "body" | "footer", string> = {
    header: "",
    body: "",
    footer: "",
  };

  constructor(
    private auth: AuthService,
    private editorState: EditorStateService,
    private familiesService: FamilyService,
    private templatesService: TemplateService,
    private organizationsService: OrganizationService,
    private documentRender: DocumentRenderService,
    private graphicCharters: GraphicCharterService,
    private filterRuntime: FilterRuntimeService,
    private documentData: DocumentDataService,
    private notifications: NotificationService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadState();
  }

  ngAfterViewChecked(): void {
    this.ensureEditorInstance();
    this.ensureGraphicCharterEditors();
  }

  ngOnDestroy(): void {
    this.destroyEditor();
    this.destroyGraphicCharterEditors();
  }

  @HostListener("document:keydown", ["$event"])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      void this.saveTemplate();
    } else if (key === "f" && this.selectedTemplate) {
      event.preventDefault();
      this.searchPanelOpen = true;
      this.doSearch();
    }
  }

  get currentUserOrganizationId(): string | null {
    return this.auth.getCurrentUser()?.organizationId || null;
  }

  get organizationLabel(): string {
    const org = this.currentOrganization;
    return org ? org.nom || org.name || org.id : "";
  }

  get currentOrganization(): OrganizationRecord | null {
    const orgId = this.currentUserOrganizationId;
    return orgId ? this.organizationsService.getOrganization(orgId) : null;
  }

  get selectedFamily(): FamilyRecord | null {
    return this.selectedFamilyId
      ? this.families.find((family) => family.id === this.selectedFamilyId) ||
          null
      : null;
  }

  get selectedTemplate(): TemplateRecord | null {
    return this.selectedTemplateId
      ? this.templates.find(
          (template) => template.id === this.selectedTemplateId,
        ) || null
      : null;
  }

  get visibleTemplates(): TemplateRecord[] {
    if (!this.selectedFamilyId) return [];
    return this.templatesService.getTemplates(
      this.selectedFamilyId,
      this.currentUserOrganizationId,
    );
  }

  get variableClasses(): any[] {
    return (this.selectedFamily?.classes || []) as any[];
  }

  get variableGroups(): AdminVariableGroup[] {
    const counts = {
      simple: this.organizationVariableGroup.vars.length,
      list: 0,
      table: 0,
    };
    this.variableClasses.forEach((cls) => {
      (cls.vars || []).forEach((variable: any) => {
        counts[this.getVariableBucket(variable?.type)] += 1;
      });
    });
    return [
      {
        id: "simple",
        nom: `Simple (${counts.simple})`,
        name: `Simple (${counts.simple})`,
        count: counts.simple,
      },
      {
        id: "list",
        nom: `Liste (${counts.list})`,
        name: `Liste (${counts.list})`,
        count: counts.list,
      },
      {
        id: "table",
        nom: `Table (${counts.table})`,
        name: `Table (${counts.table})`,
        count: counts.table,
      },
    ];
  }

  get visibleVariableClasses(): any[] {
    const bucket = this.normalizeVariablePanelType(this.activeVariableGroupId);
    const groups = this.variableClasses
      .map((cls) => ({
        ...cls,
        vars: (cls.vars || []).filter(
          (variable: any) => this.getVariableBucket(variable?.type) === bucket,
        ),
      }))
      .filter((cls) => (cls.vars || []).length);
    return bucket === "simple" && this.organizationVariableGroup.vars.length
      ? [this.organizationVariableGroup, ...groups]
      : groups;
  }

  get organizationVariableGroup(): any {
    const settings = this.getOrganizationVariableSettings();
    const vars = this.buildVisibleOrganizationVariables(settings).map(
      ({ key, label }) => ({
        tech: key,
        key,
        label,
      }),
    );
    return {
      id: "organization",
      key: "organization",
      nom: "Variables Organization",
      name: "Variables Organization",
      couleur: "#0f766e",
      vars,
    };
  }

  get filteredPreviewBeneficiaries(): BeneficiaryRecord[] {
    const search = this.previewBeneficiarySearch.trim().toLowerCase();
    return this.previewBeneficiaries.filter((beneficiary) => {
      const label = this.getBeneficiaryLabel(beneficiary);
      const subtitle = this.getBeneficiarySubtitle(beneficiary);
      return !search || `${label} ${subtitle}`.toLowerCase().includes(search);
    });
  }

  get organizationGraphicCharters(): GraphicCharterRecord[] {
    return this.graphicCharters.getOrganizationGraphicCharters(
      this.currentUserOrganizationId,
    );
  }

  get selectedGraphicCharter(): GraphicCharterRecord | null {
    return (
      this.organizationGraphicCharters.find(
        (charter) => charter.id === this.selectedGraphicCharterId,
      ) || null
    );
  }

  get selectedGraphicCharterConfig(): GraphicCharterConfig {
    return this.selectedGraphicCharter?.config
      ? this.graphicCharters.normalizeGraphicCharterConfig(
          this.selectedGraphicCharter.config,
        )
      : this.graphicCharters.normalizeGraphicCharterConfig({});
  }

  get liveDocumentThemeStyles(): Record<string, string> {
    const config = this.selectedGraphicCharterConfig;
    const background = config.layout.pageBackground;
    const image =
      background.enabled && background.image
        ? `url("${String(background.image).replace(/"/g, '\\"')}")`
        : "none";
    return {
      "--doc-font-body": config.typography.bodyFont,
      "--doc-font-heading": config.typography.headingFont,
      "--doc-color-primary": config.colors["primary"],
      "--doc-color-secondary": config.colors["secondary"],
      "--doc-color-text": config.colors["text"],
      "--doc-color-heading": config.colors["heading"],
      "--doc-color-border": config.colors["border"],
      "--doc-table-header-bg": config.colors["tableHeaderBg"],
      "--doc-table-alt-row-bg": config.colors["tableAltRowBg"],
      "--doc-page-bg-image": image,
      "--doc-page-bg-size": background.size || "cover",
      "--doc-page-bg-position": background.position || "center center",
      "--doc-page-bg-repeat": background.repeat || "no-repeat",
    };
  }

  get activeEditorSection(): "header" | "body" | "footer" {
    return this.activeSection === "header" || this.activeSection === "footer"
      ? this.activeSection
      : "body";
  }

  get activeSectionDirection(): "ltr" | "rtl" {
    return this.sectionDirections[this.activeEditorSection] || "ltr";
  }

  private async loadState(): Promise<void> {
    this.isLoading = true;
    await this.editorState.loadBootstrap();
    this.refreshCollections();
    this.isLoading = false;
  }

  private refreshCollections(): void {
    this.families = this.familiesService.getFamilies();
    this.templates = this.editorState.getState().templates;
    this.organizations = this.organizationsService.getOrganizations();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleVarsPanel(): void {
    this.varsPanelVisible = !this.varsPanelVisible;
  }

  selectVariableGroup(groupId: string): void {
    this.activeVariableGroupId = groupId || "all";
  }

  logoutAndRedirect(): void {
    this.auth.logout();
  }

  selectFamily(familyId: string): void {
    this.selectedFamilyId = familyId;
    this.selectedTemplateId = "";
    this.clearEditor();
  }

  openTemplate(templateId: string): void {
    const template = this.templatesService.getTemplate(templateId);
    if (!template) return;
    this.persistEditorContent();
    this.destroyEditor();
    this.selectedTemplateId = template.id;
    this.templateNameDraft = String(template["nom"] || template["name"] || "");
    this.selectedGraphicCharterId = this.resolveTemplateGraphicCharterId(
      template,
    );
    this.hasHeader = template.hasHeader === true;
    this.hasFooter = template.hasFooter === true;
    this.pageSettingsForm = this.getPageSettingsFromTemplate(template);
    this.watermarkForm = this.getWatermarkFromTemplate(template);
    this.sectionDirections = this.getSectionDirectionsFromTemplate(template);
    this.editorContent = {
      header: template.header || "",
      body: template.body || "",
      footer: template.footer || "",
    };
    this.templateFilterProfile = normalizeTemplateFilterProfile(
      template.filterProfile || [],
    );
    this.previewOpen = false;
    this.previewHtml = "";
    this.previewBeneficiaries = [];
    this.previewBeneficiarySearch = "";
    this.selectedPreviewBeneficiaryId = "";
    this.previewRuntimeFilters = [];
    this.previewFilterValues = {};
    void this.refreshTemplateFilters();
    this.activeSection = "body";
    this.saveStatus = "Prêt";
    this.rebindEditorSoon();
  }

  async newTemplate(): Promise<void> {
    if (!this.selectedFamilyId) {
      this.notifications.showWarning("Sélectionnez une famille d'abord");
      return;
    }
    const template = normalizeTemplateRecord({
      id: this.genId("tpl"),
      familyId: this.selectedFamilyId,
      organizationId: this.currentUserOrganizationId,
      nom: "Nouveau template",
      name: "Nouveau template",
      header: "",
      body: "<p></p>",
      footer: "",
      hasHeader: false,
      hasFooter: false,
      graphicCharterId: this.resolveDefaultGraphicCharterId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await this.templatesService.saveTemplate(template);
    this.refreshCollections();
    this.openTemplate(template.id);
    this.notifications.showSuccess("Template créé");
  }

  async duplicateTemplate(templateId: string): Promise<void> {
    const source = this.templatesService.getTemplate(templateId);
    if (!source) return;
    const clone = normalizeTemplateRecord({
      ...source,
      id: this.genId("tpl"),
      nom: `${source["nom"] || source["name"] || "Template"} - copie`,
      name: `${source["name"] || source["nom"] || "Template"} - copie`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await this.templatesService.saveTemplate(clone);
    this.refreshCollections();
    this.openTemplate(clone.id);
    this.notifications.showSuccess("Template dupliqué");
  }

  async saveTemplate(): Promise<void> {
    this.persistEditorContent();
    const current = this.selectedTemplate;
    if (!current) {
      this.notifications.showWarning("Aucun template ouvert");
      return;
    }
    const next = normalizeTemplateRecord({
      ...current,
      nom: this.templateNameDraft || current["nom"] || current["name"],
      name: this.templateNameDraft || current["name"] || current["nom"],
      graphicCharterId: this.selectedGraphicCharterId || null,
      header: this.editorContent.header,
      body: this.editorContent.body,
      footer: this.editorContent.footer,
      hasHeader: this.hasHeader,
      hasFooter: this.hasFooter,
      orientation: this.pageSettingsForm.orientation,
      pageMargins: {
        mt: this.pageSettingsForm.mt,
        mb: this.pageSettingsForm.mb,
        ml: this.pageSettingsForm.ml,
        mr: this.pageSettingsForm.mr,
      },
      headerFooterDistances: {
        headerTop: this.pageSettingsForm.headerTop,
        footerBottom: this.pageSettingsForm.footerBottom,
      },
      watermark: this.watermarkForm,
      sectionDirections: this.sectionDirections,
      filterProfile: this.templateFilterProfile,
      updatedAt: new Date().toISOString(),
    });
    this.saveStatus = "Enregistrement...";
    await this.templatesService.saveTemplate(next);
    this.refreshCollections();
    this.selectedTemplateId = next.id;
    this.saveStatus = "Enregistré";
    this.notifications.showSuccess("Template enregistré");
  }

  async confirmDeleteTemplate(templateId: string): Promise<void> {
    const template = this.templatesService.getTemplate(templateId);
    if (!template) return;
    const confirmed = await this.confirmAction({
      title: "Supprimer le template ?",
      message: `Le template "${template["nom"] || template["name"] || template.id}" sera supprimé.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;
    await this.templatesService.deleteTemplate(templateId);
    this.refreshCollections();
    if (this.selectedTemplateId === templateId) this.clearEditor();
    this.notifications.showSuccess("Template supprimé");
  }

  onGraphicCharterChange(charterId: string): void {
    this.selectedGraphicCharterId = charterId;
    this.applyGraphicCharterToCurrentState(false);
    this.saveStatus = "Modifié";
  }

  async applySelectedGraphicCharterToTemplate(): Promise<void> {
    if (!this.selectedTemplate) {
      this.notifications.showWarning("Ouvrez d'abord un template");
      return;
    }
    if (!this.selectedGraphicCharterId) {
      this.notifications.showWarning("Choisissez une charte graphique");
      return;
    }
    this.applyGraphicCharterToCurrentState(true);
    await this.saveTemplate();
    this.notifications.showSuccess("Charte appliquée au document");
  }

  loadActiveSectionFromGraphicCharter(): void {
    const charter = this.selectedGraphicCharter;
    if (!charter) {
      this.notifications.showWarning("Choisissez une charte graphique");
      return;
    }
    if (this.activeSection === "header") {
      this.setActiveEditorHtml(charter.config.header.html || "");
    } else if (this.activeSection === "footer") {
      this.setActiveEditorHtml(charter.config.footer.html || "");
    } else {
      this.notifications.showInfo(
        "La charte ne remplace pas le corps du document.",
      );
      return;
    }
    this.saveStatus = "Modifié";
  }

  async saveActiveSectionToGraphicCharter(): Promise<void> {
    const orgId = this.currentUserOrganizationId;
    const charter = this.selectedGraphicCharter;
    if (!orgId || !charter) {
      this.notifications.showWarning("Choisissez une charte graphique");
      return;
    }
    this.persistEditorContent();
    const config = this.graphicCharters.normalizeGraphicCharterConfig(
      charter.config,
    );
    if (this.activeSection === "header") {
      config.header.html = this.editorContent.header;
    } else if (this.activeSection === "footer") {
      config.footer.html = this.editorContent.footer;
    } else {
      this.notifications.showInfo(
        "Seuls l'en-tête et le pied de page sont synchronisés avec la charte.",
      );
      return;
    }
    const saved = await this.graphicCharters.saveOrganizationGraphicCharter(
      orgId,
      { ...charter, config },
    );
    this.refreshCollections();
    this.selectedGraphicCharterId = saved?.id || charter.id;
    this.notifications.showSuccess("Section enregistrée dans la charte");
  }

  openGraphicCharterModal(charterId: string | null = null): void {
    const charter = charterId
      ? this.organizationGraphicCharters.find((item) => item.id === charterId)
      : null;
    const config = this.graphicCharters.normalizeGraphicCharterConfig(
      charter?.config || {},
    );
    this.editingGraphicCharterId = charter?.id || null;
    this.graphicCharterForm = {
      name: charter?.name || "",
      description: charter?.description || "",
      isDefault: charter?.isDefault || !this.organizationGraphicCharters.length,
      orientation: config.layout.orientation,
      marginTop: config.layout.pageMargins.mt,
      marginBottom: config.layout.pageMargins.mb,
      marginLeft: config.layout.pageMargins.ml,
      marginRight: config.layout.pageMargins.mr,
      headerTop: config.layout.headerFooterDistances.headerTop,
      footerBottom: config.layout.headerFooterDistances.footerBottom,
      primary: config.colors["primary"] || "#1d4ed8",
      secondary: config.colors["secondary"] || "#475569",
      text: config.colors["text"] || "#111111",
      heading: config.colors["heading"] || "#0f172a",
      border: config.colors["border"] || "#c8cdd8",
      tableHeaderBg: config.colors["tableHeaderBg"] || "#ffffff",
      tableAltRowBg: config.colors["tableAltRowBg"] || "#f8fafc",
      bodyFont: config.typography.bodyFont,
      headingFont: config.typography.headingFont,
      backgroundEnabled: config.layout.pageBackground.enabled,
      backgroundImage: config.layout.pageBackground.image,
      backgroundSize: config.layout.pageBackground.size,
      backgroundPosition: config.layout.pageBackground.position,
      backgroundRepeat: config.layout.pageBackground.repeat,
      headerEnabled: config.header.enabledByDefault,
      headerDisplay: config.header.displayMode,
      headerHtml: config.header.html,
      footerEnabled: config.footer.enabledByDefault,
      footerDisplay: config.footer.displayMode,
      footerHtml: config.footer.html,
      watermarkEnabled: config.watermark.enabled,
      watermarkText: config.watermark.text,
      watermarkColor: config.watermark.color,
      watermarkOpacity: config.watermark.opacity,
    };
    this.graphicCharterModalOpen = true;
  }

  editCurrentGraphicCharter(): void {
    if (!this.selectedGraphicCharterId) {
      this.notifications.showWarning("Choisissez une charte graphique");
      return;
    }
    this.openGraphicCharterModal(this.selectedGraphicCharterId);
  }

  async saveGraphicCharterModal(): Promise<void> {
    this.persistGraphicCharterEditors();
    const orgId = this.currentUserOrganizationId;
    if (!orgId) {
      this.notifications.showWarning("Aucune organization active");
      return;
    }
    const existing = this.editingGraphicCharterId
      ? this.organizationGraphicCharters.find(
          (item) => item.id === this.editingGraphicCharterId,
        )
      : null;
    const baseConfig = existing?.config
      ? this.graphicCharters.normalizeGraphicCharterConfig(existing.config)
      : this.graphicCharters.normalizeGraphicCharterConfig({});
    const config = this.graphicCharters.normalizeGraphicCharterConfig({
      ...baseConfig,
      colors: {
        ...baseConfig.colors,
        primary: this.graphicCharterForm.primary,
        secondary: this.graphicCharterForm.secondary,
        text: this.graphicCharterForm.text,
        heading: this.graphicCharterForm.heading,
        border: this.graphicCharterForm.border,
        tableHeaderBg: this.graphicCharterForm.tableHeaderBg,
        tableAltRowBg: this.graphicCharterForm.tableAltRowBg,
      },
      typography: {
        bodyFont: this.graphicCharterForm.bodyFont,
        headingFont: this.graphicCharterForm.headingFont,
      },
      layout: {
        ...baseConfig.layout,
        orientation:
          this.graphicCharterForm.orientation === "landscape"
            ? "landscape"
            : "portrait",
        pageMargins: {
          mt: this.clampNumber(this.graphicCharterForm.marginTop, 5, 60, 20),
          mb: this.clampNumber(this.graphicCharterForm.marginBottom, 5, 60, 20),
          ml: this.clampNumber(this.graphicCharterForm.marginLeft, 5, 60, 25),
          mr: this.clampNumber(this.graphicCharterForm.marginRight, 5, 60, 25),
        },
        headerFooterDistances: {
          headerTop: this.clampNumber(this.graphicCharterForm.headerTop, 0, 30, 5),
          footerBottom: this.clampNumber(
            this.graphicCharterForm.footerBottom,
            0,
            30,
            5,
          ),
        },
        pageBackground: {
          enabled: this.graphicCharterForm.backgroundEnabled,
          image: this.graphicCharterForm.backgroundImage,
          size: this.graphicCharterForm.backgroundSize,
          position: this.graphicCharterForm.backgroundPosition,
          repeat: this.graphicCharterForm.backgroundRepeat,
        },
      },
      header: {
        enabledByDefault: this.graphicCharterForm.headerEnabled,
        displayMode: this.graphicCharterForm.headerDisplay,
        html: this.graphicCharterForm.headerHtml,
      },
      footer: {
        enabledByDefault: this.graphicCharterForm.footerEnabled,
        displayMode: this.graphicCharterForm.footerDisplay,
        html: this.graphicCharterForm.footerHtml,
      },
      watermark: {
        enabled: this.graphicCharterForm.watermarkEnabled,
        text: this.graphicCharterForm.watermarkText,
        color: this.graphicCharterForm.watermarkColor,
        opacity: this.clampNumber(
          this.graphicCharterForm.watermarkOpacity,
          0.01,
          0.8,
          0.08,
        ),
      },
    });
    const saved = await this.graphicCharters.saveOrganizationGraphicCharter(
      orgId,
      {
        ...existing,
        id: existing?.id || this.genId("charter"),
        name: this.graphicCharterForm.name.trim() || "Nouvelle charte",
        description: this.graphicCharterForm.description.trim(),
        isDefault: this.graphicCharterForm.isDefault,
        config,
      },
    );
    this.refreshCollections();
    this.selectedGraphicCharterId = saved?.id || "";
    this.graphicCharterModalOpen = false;
    this.destroyGraphicCharterEditors();
    this.applyGraphicCharterToCurrentState(false);
    this.notifications.showSuccess("Charte graphique enregistrée");
  }

  async deleteCurrentGraphicCharter(): Promise<void> {
    const org = this.currentOrganization;
    const charter = this.selectedGraphicCharter;
    if (!org || !charter) {
      this.notifications.showWarning("Choisissez une charte graphique");
      return;
    }
    const confirmed = await this.confirmAction({
      title: "Supprimer la charte ?",
      message: `La charte "${charter.name}" sera supprimée. Les templates liés devront choisir une autre charte.`,
      confirmText: "Supprimer",
      actionType: "delete",
    });
    if (!confirmed) return;
    const nextCharters = (org.graphicCharters || []).filter(
      (item) => item.id !== charter.id,
    );
    await this.organizationsService.saveOrganization({
      ...org,
      graphicCharters: nextCharters,
      updatedAt: new Date().toISOString(),
    } as OrganizationRecord);
    this.refreshCollections();
    this.selectedGraphicCharterId = this.resolveDefaultGraphicCharterId();
    this.applyGraphicCharterToCurrentState(false);
    this.saveStatus = "Modifié";
    this.notifications.showSuccess("Charte graphique supprimée");
  }

  closeGraphicCharterModal(): void {
    this.graphicCharterModalOpen = false;
    this.destroyGraphicCharterEditors();
  }

  switchSection(section: AdminSection): void {
    if (section === "header" && !this.hasHeader) return;
    if (section === "footer" && !this.hasFooter) return;
    this.persistEditorContent();
    this.activeSection = section;
    if (section === "filters") {
      void this.refreshTemplateFilters();
    }
    this.rebindEditorSoon();
  }

  toggleTemplateSection(section: "header" | "footer"): void {
    this.persistEditorContent();
    if (section === "header") {
      this.hasHeader = !this.hasHeader;
      if (!this.hasHeader && this.activeSection === "header") {
        this.activeSection = "body";
      }
    } else {
      this.hasFooter = !this.hasFooter;
      if (!this.hasFooter && this.activeSection === "footer") {
        this.activeSection = "body";
      }
    }
    this.saveStatus = "Modifié";
    this.rebindEditorSoon();
  }

  updateSectionContent(value: string): void {
    if (this.activeSection === "filters") return;
    this.editorContent[this.activeSection] = value;
    this.saveStatus = "Modifié";
  }

  async refreshTemplateFilters(): Promise<void> {
    const family = this.selectedFamily;
    const template = this.selectedTemplate;
    if (!family || !template) {
      this.runtimeAdminFilters = [];
      return;
    }
    this.runtimeAdminFilters = getFamilyFilterCatalog(family)
      .map((filterDef, index) => ({
        ...filterDef,
        profile:
          this.getTemplateFilterProfileEntry(filterDef.id) ||
          normalizeTemplateFilterProfileEntry(
            { filterId: filterDef.id },
            index,
          )!,
      }))
      .sort((a, b) => (a.profile.order || 0) - (b.profile.order || 0));
    try {
      const resolved = await this.filterRuntime.resolveTemplateFiltersForRole(
        family.id,
        template.id,
        "admin",
        this.currentUserOrganizationId,
        {},
      );
      const optionsById = new Map(
        resolved.map((entry) => [entry.id, entry.options || []]),
      );
      this.runtimeAdminFilters = this.runtimeAdminFilters.map((entry) => ({
        ...entry,
        options: optionsById.get(entry.id) || entry.staticOptions || [],
      }));
    } catch {
      // Keep normalized local entries if SQL option resolution fails.
    }
  }

  getTemplateFilterProfileEntry(
    filterId: string,
  ): TemplateFilterProfileEntry | null {
    return (
      this.templateFilterProfile.find((entry) => entry.filterId === filterId) ||
      null
    );
  }

  updateTemplateFilterProfile(
    filterId: string,
    updater: (entry: TemplateFilterProfileEntry) => TemplateFilterProfileEntry,
  ): void {
    const current =
      this.getTemplateFilterProfileEntry(filterId) ||
      normalizeTemplateFilterProfileEntry(
        { filterId },
        this.templateFilterProfile.length,
      );
    if (!current) return;
    const next = updater({ ...current });
    this.templateFilterProfile = [
      ...this.templateFilterProfile.filter(
        (entry) => entry.filterId !== filterId,
      ),
      next,
    ].sort((a, b) => (a.order || 0) - (b.order || 0));
    this.saveStatus = "Modifié";
    void this.refreshTemplateFilters();
  }

  toggleTemplateFilter(filterId: string, checked: boolean): void {
    this.updateTemplateFilterProfile(filterId, (entry) => ({
      ...entry,
      enabled: checked,
      adminEnabled: checked,
    }));
  }

  updateTemplateFilterBool(
    filterId: string,
    field: "required" | "locked" | "userEnabled",
    checked: boolean,
  ): void {
    this.updateTemplateFilterProfile(filterId, (entry) => ({
      ...entry,
      [field]: checked,
    }));
  }

  updateTemplateFilterDefault(filterId: string, value: string): void {
    this.updateTemplateFilterProfile(filterId, (entry) => ({
      ...entry,
      defaultValue: value || null,
    }));
  }

  updateTemplateFilterAllowedMode(filterId: string, value: string): void {
    this.updateTemplateFilterProfile(filterId, (entry) => ({
      ...entry,
      allowedValueMode: value === "subset" ? "subset" : "all",
      allowedValues: value === "subset" ? entry.allowedValues || [] : [],
    }));
  }

  toggleTemplateFilterAllowedValue(
    filterId: string,
    option: { value: string; label: string },
    checked: boolean,
  ): void {
    this.updateTemplateFilterProfile(filterId, (entry) => {
      const current = entry.allowedValues || [];
      const exists = current.some((item) => item.value === option.value);
      return {
        ...entry,
        allowedValueMode: "subset",
        allowedValues: checked
          ? exists
            ? current
            : [...current, option]
          : current.filter((item) => item.value !== option.value),
      };
    });
  }

  isAllowedFilterValueSelected(
    profile: TemplateFilterProfileEntry,
    value: string,
  ): boolean {
    return (profile.allowedValues || []).some(
      (option) => option.value === value,
    );
  }

  insertVariable(tech: string): void {
    if (this.activeSection === "filters") return;
    if (this.editor) {
      this.editor.chain().focus().insertContent(`{{${tech}}}`).run();
    } else {
      this.editorContent[this.activeSection] += `{{${tech}}}`;
    }
    this.saveStatus = "Modifié";
  }

  isEditorActive(name: string, attrs?: Record<string, unknown>): boolean {
    void this.toolbarStateVersion;
    try {
      return !!this.editor?.isActive(name, attrs);
    } catch {
      return false;
    }
  }

  isEditorAlignActive(align: "left" | "center" | "right" | "justify"): boolean {
    void this.toolbarStateVersion;
    try {
      return !!this.editor?.isActive({ textAlign: align });
    } catch {
      return false;
    }
  }

  isGraphicCharterEditorActive(
    section: GraphicCharterEditorSection,
    name: string,
    attrs?: Record<string, unknown>,
  ): boolean {
    const editor = this.getGraphicCharterEditor(section);
    try {
      return !!editor?.isActive(name, attrs);
    } catch {
      return false;
    }
  }

  runGraphicCharterCommand(
    section: GraphicCharterEditorSection,
    command: string,
  ): void {
    const editor = this.getGraphicCharterEditor(section);
    if (!editor) return;
    const chain = editor.chain().focus();
    if (command === "bold") chain.toggleBold().run();
    if (command === "italic") chain.toggleItalic().run();
    if (command === "underline") chain.toggleUnderline().run();
    if (command === "strike") chain.toggleStrike().run();
    if (command === "bulletList") chain.toggleBulletList().run();
    if (command === "orderedList") chain.toggleOrderedList().run();
    if (command === "clear") chain.unsetAllMarks().clearNodes().run();
    if (command === "undo") chain.undo().run();
    if (command === "redo") chain.redo().run();
    this.persistGraphicCharterEditors();
  }

  applyGraphicCharterAlign(
    section: GraphicCharterEditorSection,
    align: "left" | "center" | "right",
  ): void {
    const editor = this.getGraphicCharterEditor(section);
    editor?.chain().focus().setTextAlign(align).run();
    this.persistGraphicCharterEditors();
  }

  applyGraphicCharterFontSize(
    section: GraphicCharterEditorSection,
    value: string,
  ): void {
    const editor = this.getGraphicCharterEditor(section);
    if (!editor) return;
    const chain = editor.chain().focus() as any;
    if (value) chain.setMark("textStyle", { fontSize: value }).run();
    else chain.setMark("textStyle", { fontSize: null }).run();
    this.persistGraphicCharterEditors();
  }

  onGraphicCharterBackgroundFileChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.graphicCharterForm.backgroundImage = String(reader.result || "");
      this.graphicCharterForm.backgroundEnabled = true;
    };
    reader.readAsDataURL(file);
  }

  insertGraphicCharterVariable(
    section: GraphicCharterEditorSection,
    tech: string,
  ): void {
    const editor = this.getGraphicCharterEditor(section);
    editor?.chain().focus().insertContent(`{{${tech}}}`).run();
    this.persistGraphicCharterEditors();
  }

  runEditorCommand(command: string): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (command === "undo") chain.undo().run();
    if (command === "redo") chain.redo().run();
    if (command === "bold") chain.toggleBold().run();
    if (command === "italic") chain.toggleItalic().run();
    if (command === "underline") chain.toggleUnderline().run();
    if (command === "strike") chain.toggleStrike().run();
    if (command === "clear") chain.unsetAllMarks().clearNodes().run();
    if (command === "bulletList") chain.toggleBulletList().run();
    if (command === "orderedList") chain.toggleOrderedList().run();
    if (command === "blockquote") chain.toggleBlockquote().run();
    if (command === "liftListItem") chain.liftListItem("listItem").run();
    if (command === "sinkListItem") chain.sinkListItem("listItem").run();
    this.toolbarStateVersion += 1;
    this.saveStatus = "Modifié";
  }

  applyDirection(direction: "ltr" | "rtl"): void {
    if (this.activeSection === "filters") return;
    this.sectionDirections = {
      ...this.sectionDirections,
      [this.activeEditorSection]: direction,
    };
    this.applyDirectionToCurrentEditor();
    this.saveStatus = "Modifié";
    this.notifications.showInfo(
      direction === "rtl" ? "Mode RTL activé" : "Mode LTR activé",
    );
  }

  applyAlign(align: "left" | "center" | "right" | "justify"): void {
    this.editor?.chain().focus().setTextAlign(align).run();
    this.toolbarStateVersion += 1;
    this.saveStatus = "Modifié";
  }

  applyHeading(value: string): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (value === "h1") chain.toggleHeading({ level: 1 }).run();
    else if (value === "h2") chain.toggleHeading({ level: 2 }).run();
    else if (value === "h3") chain.toggleHeading({ level: 3 }).run();
    else if (value === "h4") chain.toggleHeading({ level: 4 }).run();
    else chain.setParagraph().run();
  }

  applyFontFamily(value: string): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (value) chain.setFontFamily(value).run();
    else chain.unsetFontFamily().run();
  }

  applyFontSize(value: string): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus() as any;
    if (value) chain.setMark("textStyle", { fontSize: value }).run();
    else chain.setMark("textStyle", { fontSize: null }).run();
  }

  applyTextColor(color: string): void {
    if (!this.editor) return;
    if (color) this.editor.chain().focus().setColor(color).run();
  }

  applyHighlightColor(color: string): void {
    if (!this.editor) return;
    if (color) this.editor.chain().focus().setHighlight({ color }).run();
    else this.editor.chain().focus().unsetHighlight().run();
  }

  insertHorizontalRule(): void {
    if (!this.editor) return;
    this.editor.chain().focus().setHorizontalRule().run();
    this.saveStatus = "Modifié";
  }

  insertSignatureBlock(): void {
    if (!this.editor) return;
    this.editor
      .chain()
      .focus()
      .insertContent(
        `<table style="width:100%;border-collapse:collapse;border:none"><tr><td style="border:none;width:50%;padding:8px 0;vertical-align:top"><p><strong>L'intéressé(e)</strong></p><p style="margin-top:40px;border-top:1px solid #c8cdd8;padding-top:4px;font-size:10px;color:#666">Signature</p></td><td style="border:none;width:50%;padding:8px 0;vertical-align:top;text-align:right"><p><strong>Le Directeur de l'Organization</strong></p><p style="margin-top:4px;font-size:10px;color:#444">{{directeur}}</p><p style="margin-top:32px;border-top:1px solid #c8cdd8;padding-top:4px;font-size:10px;color:#666">Signature et cachet</p></td></tr></table>`,
      )
      .run();
    this.saveStatus = "Modifié";
    this.notifications.showSuccess("Bloc signature inséré");
  }

  setZoom(delta: number): void {
    this.zoomLevel =
      delta === 0 ? 100 : Math.max(40, Math.min(220, this.zoomLevel + delta));
  }

  toggleSearchPanel(): void {
    this.searchPanelOpen = !this.searchPanelOpen;
    if (this.searchPanelOpen) this.doSearch();
  }

  closeSearchPanel(): void {
    this.searchPanelOpen = false;
  }

  doSearch(): void {
    this.searchMatches = this.collectSearchMatches();
    if (!this.searchFind) {
      this.searchMatchCount = 0;
      this.searchMatchIndex = 0;
      return;
    }
    this.searchMatchCount = this.searchMatches.length;
    this.searchMatchIndex = this.searchMatches.length
      ? Math.min(this.searchMatchIndex || 1, this.searchMatches.length)
      : 0;
    this.selectCurrentSearchMatch();
  }

  searchNavigate(delta: number): void {
    if (!this.searchMatchCount) {
      this.doSearch();
      return;
    }
    this.searchMatchIndex =
      ((this.searchMatchIndex - 1 + delta + this.searchMatchCount) %
        this.searchMatchCount) +
      1;
    this.selectCurrentSearchMatch();
  }

  replaceOne(): void {
    if (!this.editor || !this.searchFind) return;
    if (!this.searchMatches.length) this.doSearch();
    const match = this.searchMatches[this.searchMatchIndex - 1];
    if (!match) return;
    this.editor
      .chain()
      .focus()
      .insertContentAt({ from: match.from, to: match.to }, this.searchReplace)
      .run();
    this.saveStatus = "Modifié";
    this.searchMatchIndex = 0;
    this.doSearch();
    this.notifications.showSuccess("Remplacement effectué");
  }

  replaceAll(): void {
    if (!this.editor || !this.searchFind) return;
    const flags = this.searchCaseSensitive ? "g" : "gi";
    const re = new RegExp(this.escapeRegex(this.searchFind), flags);
    const html = this.editor.getHTML();
    const count = (html.match(re) || []).length;
    this.setActiveEditorHtml(html.replace(re, this.searchReplace));
    this.saveStatus = "Modifié";
    this.doSearch();
    this.notifications.showSuccess(`${count} occurrence(s) remplacée(s)`);
  }

  openDateVariableModal(): void {
    if (!this.editor) return;
    this.selectedDateVariable = "{{date_du_jour}}";
    this.dateVariableModalOpen = true;
  }

  closeDateVariableModal(): void {
    this.dateVariableModalOpen = false;
  }

  selectDateVariable(value: string): void {
    this.selectedDateVariable = value || "{{date_du_jour}}";
  }

  insertSelectedDateVariable(): void {
    if (!this.editor) return;
    this.editor.chain().focus().insertContent(this.selectedDateVariable).run();
    this.dateVariableModalOpen = false;
    this.saveStatus = "Modifié";
  }

  openLinkModal(): void {
    this.linkUrl = "";
    this.linkModalOpen = true;
  }

  insertLink(): void {
    const url = this.linkUrl.trim();
    if (!this.editor || !url) return;
    this.editor.chain().focus().setLink({ href: url }).run();
    this.linkModalOpen = false;
    this.linkUrl = "";
    this.saveStatus = "Modifié";
  }

  openImageModal(): void {
    this.imageUrl = "";
    this.imageAlt = "";
    this.imageModalOpen = true;
  }

  insertImage(): void {
    const src = this.imageUrl.trim();
    if (!this.editor || !src) return;
    this.editor
      .chain()
      .focus()
      .setImage({ src, alt: this.imageAlt || "" })
      .run();
    this.imageModalOpen = false;
    this.imageUrl = "";
    this.imageAlt = "";
    this.saveStatus = "Modifié";
  }

  openTableModal(): void {
    this.tableRows = 3;
    this.tableCols = 3;
    this.tableModalOpen = true;
  }

  insertTable(): void {
    if (!this.editor) return;
    this.editor
      .chain()
      .focus()
      .insertTable({
        rows: Math.max(1, Number(this.tableRows) || 3),
        cols: Math.max(1, Number(this.tableCols) || 3),
        withHeaderRow: true,
      })
      .run();
    this.tableModalOpen = false;
    this.saveStatus = "Modifié";
  }

  closeEditorModal(): void {
    this.linkModalOpen = false;
    this.imageModalOpen = false;
    this.tableModalOpen = false;
    this.dateVariableModalOpen = false;
  }

  openPageSettings(): void {
    if (!this.selectedTemplate) {
      this.notifications.showWarning("Ouvrez d'abord un template");
      return;
    }
    this.pageSettingsForm = this.getPageSettingsFromTemplate(
      this.selectedTemplate,
    );
    this.pageSettingsModalOpen = true;
  }

  closePageSettingsModal(): void {
    this.pageSettingsModalOpen = false;
  }

  updatePageSetting(
    field: keyof PageSettingsForm,
    value: string | number,
  ): void {
    if (field === "orientation") {
      this.pageSettingsForm = {
        ...this.pageSettingsForm,
        orientation: value === "landscape" ? "landscape" : "portrait",
      };
      this.saveStatus = "Modifié";
      return;
    }
    this.pageSettingsForm = {
      ...this.pageSettingsForm,
      [field]: this.coerceNumber(value, this.pageSettingsForm[field] as number),
    };
    this.saveStatus = "Modifié";
  }

  runTableCommand(command: string): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus() as any;
    const commands: Record<string, () => void> = {
      addRowBefore: () => chain.addRowBefore().run(),
      addRowAfter: () => chain.addRowAfter().run(),
      deleteRow: () => chain.deleteRow().run(),
      addColumnBefore: () => chain.addColumnBefore().run(),
      addColumnAfter: () => chain.addColumnAfter().run(),
      deleteColumn: () => chain.deleteColumn().run(),
      mergeCells: () => chain.mergeCells().run(),
      splitCell: () => chain.splitCell().run(),
      toggleHeaderRow: () => chain.toggleHeaderRow().run(),
      deleteTable: () => chain.deleteTable().run(),
    };
    const action = commands[command];
    if (!action) return;
    action();
    this.saveStatus = "Modifié";
  }

  resetPageMargins(): void {
    const charterConfig = this.selectedGraphicCharter?.config
      ? this.graphicCharters.normalizeGraphicCharterConfig(
          this.selectedGraphicCharter.config,
        )
      : this.graphicCharters.normalizeGraphicCharterConfig({});
    this.pageSettingsForm = {
      orientation: charterConfig.layout.orientation,
      mt: charterConfig.layout.pageMargins.mt,
      mb: charterConfig.layout.pageMargins.mb,
      ml: charterConfig.layout.pageMargins.ml,
      mr: charterConfig.layout.pageMargins.mr,
      headerTop: charterConfig.layout.headerFooterDistances.headerTop,
      footerBottom: charterConfig.layout.headerFooterDistances.footerBottom,
    };
    this.saveStatus = "Modifié";
  }

  applyPageMargins(): void {
    if (!this.selectedTemplate) return;
    this.pageSettingsForm = {
      orientation: this.pageSettingsForm.orientation,
      mt: this.clampNumber(this.pageSettingsForm.mt, 5, 60, 20),
      mb: this.clampNumber(this.pageSettingsForm.mb, 5, 60, 20),
      ml: this.clampNumber(this.pageSettingsForm.ml, 5, 60, 25),
      mr: this.clampNumber(this.pageSettingsForm.mr, 5, 60, 25),
      headerTop: this.clampNumber(this.pageSettingsForm.headerTop, 0, 30, 5),
      footerBottom: this.clampNumber(
        this.pageSettingsForm.footerBottom,
        0,
        30,
        5,
      ),
    };
    this.pageSettingsModalOpen = false;
    this.saveStatus = "Modifié";
    this.notifications.showSuccess(
      `Marges : haut ${this.pageSettingsForm.mt}mm - bas ${this.pageSettingsForm.mb}mm - gauche ${this.pageSettingsForm.ml}mm - droite ${this.pageSettingsForm.mr}mm - orientation ${this.pageSettingsForm.orientation}`,
    );
  }

  openWatermarkModal(): void {
    if (!this.selectedTemplate) {
      this.notifications.showWarning("Ouvrez d'abord un template");
      return;
    }
    this.watermarkForm = this.getWatermarkFromTemplate(this.selectedTemplate);
    this.watermarkModalOpen = true;
  }

  closeWatermarkModal(): void {
    this.watermarkModalOpen = false;
  }

  updateWatermark(
    field: keyof WatermarkForm,
    value: string | number | boolean,
  ): void {
    if (field === "enabled") {
      this.watermarkForm = { ...this.watermarkForm, enabled: !!value };
      this.saveStatus = "Modifié";
      return;
    }
    if (field === "opacity") {
      this.watermarkForm = {
        ...this.watermarkForm,
        opacity: this.clampNumber(Number(value) / 100, 0.01, 0.8, 0.07),
      };
      this.saveStatus = "Modifié";
      return;
    }
    if (field === "size") {
      this.watermarkForm = {
        ...this.watermarkForm,
        size: this.clampNumber(value, 20, 250, 80),
      };
      this.saveStatus = "Modifié";
      return;
    }
    this.watermarkForm = { ...this.watermarkForm, [field]: String(value) };
    this.saveStatus = "Modifié";
  }

  applyWatermark(): void {
    this.watermarkForm = {
      ...this.watermarkForm,
      enabled: true,
      text: this.watermarkForm.text.trim() || "CONFIDENTIEL",
      opacity: this.clampNumber(this.watermarkForm.opacity, 0.01, 0.8, 0.07),
      size: this.clampNumber(this.watermarkForm.size, 20, 250, 80),
    };
    this.watermarkModalOpen = false;
    this.saveStatus = "Modifié";
    this.notifications.showSuccess("Filigrane appliqué");
  }

  removeWatermark(): void {
    this.watermarkForm = {
      ...this.watermarkForm,
      enabled: false,
    };
    this.watermarkModalOpen = false;
    this.saveStatus = "Modifié";
    this.notifications.showSuccess("Filigrane supprimé");
  }

  async openPreviewModal(): Promise<void> {
    this.persistEditorContent();
    const template = this.selectedTemplate;
    if (!template) {
      this.notifications.showWarning("Ouvrez un template d'abord");
      return;
    }
    this.previewOpen = true;
    this.previewLoading = true;
    await this.refreshPreviewFilters(false);
    await this.loadPreviewBeneficiaries();
    await this.refreshPreviewHtml();
    this.previewLoading = false;
  }

  async onPreviewBeneficiaryChange(beneficiaryId: string): Promise<void> {
    this.selectedPreviewBeneficiaryId = beneficiaryId;
    await this.refreshPreviewHtml();
  }

  async onPreviewFilterChange(filterId: string, value: unknown): Promise<void> {
    this.previewFilterValues = {
      ...this.previewFilterValues,
      [filterId]: value || null,
    };
    this.selectedPreviewBeneficiaryId = "";
    this.previewLoading = true;
    await this.refreshPreviewFilters(true);
    await this.loadPreviewBeneficiaries();
    await this.refreshPreviewHtml();
    this.previewLoading = false;
  }

  async refreshPreviewHtml(): Promise<void> {
    const template = this.selectedTemplate;
    if (!template) return;
    const previewTemplate = {
      ...template,
      header: this.editorContent.header,
      body: this.editorContent.body,
      footer: this.editorContent.footer,
      hasHeader: this.hasHeader,
      hasFooter: this.hasFooter,
      graphicCharterId: this.selectedGraphicCharterId || null,
      orientation: this.pageSettingsForm.orientation,
      pageMargins: {
        mt: this.pageSettingsForm.mt,
        mb: this.pageSettingsForm.mb,
        ml: this.pageSettingsForm.ml,
        mr: this.pageSettingsForm.mr,
      },
      headerFooterDistances: {
        headerTop: this.pageSettingsForm.headerTop,
        footerBottom: this.pageSettingsForm.footerBottom,
      },
      watermark: this.watermarkForm,
      sectionDirections: this.sectionDirections,
    } as TemplateRecord;
    const family = this.selectedFamily;
    const person =
      family && (this.selectedPreviewBeneficiaryId || family.beneficiaryMode === "organization")
        ? await this.documentData.getDocumentDataForFamily(
            family.id,
            this.selectedPreviewBeneficiaryId || null,
            this.currentUserOrganizationId,
            this.previewFilterValues,
          )
        : this.currentOrganization || {};
    const html = this.documentRender.buildPreviewHtml(
      previewTemplate,
      person || this.currentOrganization || {},
    );
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  closePreviewModal(): void {
    this.previewOpen = false;
  }

  async printPreview(): Promise<void> {
    const template = this.selectedTemplate;
    if (!template) return;
    const family = this.selectedFamily;
    const person =
      family && (this.selectedPreviewBeneficiaryId || family.beneficiaryMode === "organization")
        ? await this.documentData.getDocumentDataForFamily(
            family.id,
            this.selectedPreviewBeneficiaryId || null,
            this.currentUserOrganizationId,
            this.previewFilterValues,
          )
        : this.currentOrganization || {};
    this.documentRender.printDocPaginated(
      {
        ...template,
        header: this.editorContent.header,
        body: this.editorContent.body,
        footer: this.editorContent.footer,
        hasHeader: this.hasHeader,
        hasFooter: this.hasFooter,
        graphicCharterId: this.selectedGraphicCharterId || null,
        orientation: this.pageSettingsForm.orientation,
        pageMargins: {
          mt: this.pageSettingsForm.mt,
          mb: this.pageSettingsForm.mb,
          ml: this.pageSettingsForm.ml,
          mr: this.pageSettingsForm.mr,
        },
        headerFooterDistances: {
          headerTop: this.pageSettingsForm.headerTop,
          footerBottom: this.pageSettingsForm.footerBottom,
        },
        watermark: this.watermarkForm,
        sectionDirections: this.sectionDirections,
      } as TemplateRecord,
      person || this.currentOrganization || {},
    );
  }

  getTemplateTitle(template: TemplateRecord): string {
    return String(template["nom"] || template["name"] || template.id || "");
  }

  formatDate(value: unknown): string {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("fr-FR")
      : "-";
  }

  getBeneficiaryLabel(beneficiary: BeneficiaryRecord | null | undefined): string {
    return String(
      beneficiary?._displayLabel ||
        beneficiary?.["nom_prenom"] ||
        beneficiary?.["nom"] ||
        beneficiary?.["name"] ||
        beneficiary?.id ||
        "Beneficiaire",
    );
  }

  getBeneficiarySubtitle(
    beneficiary: BeneficiaryRecord | null | undefined,
  ): string {
    return String(
      beneficiary?._displaySubtitle ||
        beneficiary?.["grade"] ||
        beneficiary?.["fonction"] ||
        beneficiary?.["_sourceTable"] ||
        "",
    );
  }

  isPreviewFilterRequiredMissing(entry: RuntimeFilterEntry): boolean {
    if (!entry.profile.required) return false;
    const value = this.previewFilterValues[entry.id];
    return value === undefined || value === null || String(value).trim() === "";
  }

  private async refreshPreviewFilters(preserveValues: boolean): Promise<void> {
    const family = this.selectedFamily;
    const template = this.selectedTemplate;
    if (!family || !template) {
      this.previewRuntimeFilters = [];
      this.previewFilterValues = {};
      return;
    }
    const baseValues = preserveValues
      ? this.previewFilterValues
      : this.filterRuntime.getDefaultFilterValues(
          family.id,
          template.id,
          "admin",
        );
    this.previewRuntimeFilters =
      await this.filterRuntime.resolveTemplateFiltersForRole(
        family.id,
        template.id,
        "admin",
        this.currentUserOrganizationId,
        baseValues,
      );
    this.previewFilterValues = this.filterRuntime.validateRuntimeFilterValues(
      this.previewRuntimeFilters,
      baseValues,
    );
  }

  private async loadPreviewBeneficiaries(): Promise<void> {
    const family = this.selectedFamily;
    if (!family) {
      this.previewBeneficiaries = [];
      this.selectedPreviewBeneficiaryId = "";
      return;
    }
    this.previewBeneficiaries = await this.familiesService.getBeneficiariesForFamily(
      family.id,
      this.currentUserOrganizationId,
      this.previewFilterValues,
    );
    const exists = this.previewBeneficiaries.some(
      (beneficiary) => beneficiary.id === this.selectedPreviewBeneficiaryId,
    );
    if (!exists) {
      this.selectedPreviewBeneficiaryId = this.previewBeneficiaries[0]?.id || "";
    }
  }

  private clearEditor(): void {
    this.destroyEditor();
    this.selectedTemplateId = "";
    this.templateNameDraft = "";
    this.editorContent = { header: "", body: "", footer: "" };
    this.activeSection = "body";
    this.saveStatus = "Prêt";
    this.selectedGraphicCharterId = "";
    this.hasHeader = false;
    this.hasFooter = false;
    this.pageSettingsForm = this.getDefaultPageSettings();
    this.watermarkForm = this.getDefaultWatermark();
    this.sectionDirections = this.getDefaultSectionDirections();
  }

  private setActiveEditorHtml(html: string): void {
    if (this.activeSection === "filters") return;
    this.editorContent[this.activeSection] = html;
    if (this.editor) {
      this.editor.commands.setContent(html || "<p></p>", false);
    }
  }

  private ensureEditorInstance(): void {
    if (this.activeSection === "filters" || !this.selectedTemplate) {
      this.destroyEditor();
      return;
    }
    const element = this.editorHost?.nativeElement || null;
    if (!element) return;
    const section = this.activeSection as "header" | "body" | "footer";
    if (
      this.editor &&
      this.editorBoundElement === element &&
      this.editorSection === section
    ) {
      return;
    }
    this.persistEditorContent();
    this.destroyEditor();
    this.editorBoundElement = element;
    this.editorSection = section;
    this.editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
        TextStyle,
        FontSize,
        Color,
        FontFamily,
        Underline,
        Highlight.configure({ multicolor: true }),
        Link.configure({ openOnClick: false, autolink: true }),
        Image.configure({ inline: true, allowBase64: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
      ],
      content: this.editorContent[section] || "<p></p>",
      onUpdate: ({ editor }) => {
        if (!this.editorSection) return;
        this.editorContent[this.editorSection] = editor.getHTML();
        this.toolbarStateVersion += 1;
        this.saveStatus = "Modifié";
      },
      onSelectionUpdate: () => {
        this.toolbarStateVersion += 1;
      },
    });
    this.applyDirectionToCurrentEditor();
  }

  private persistEditorContent(): void {
    if (!this.editor || !this.editorSection) return;
    this.editorContent[this.editorSection] = this.editor.getHTML();
  }

  private destroyEditor(): void {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    this.editorBoundElement = null;
    this.editorSection = null;
  }

  private ensureGraphicCharterEditors(): void {
    if (!this.graphicCharterModalOpen) {
      this.destroyGraphicCharterEditors();
      return;
    }
    if (!this.graphicCharterHeaderEditor && this.graphicCharterHeaderHost) {
      this.graphicCharterHeaderEditor = this.createGraphicCharterEditor(
        this.graphicCharterHeaderHost.nativeElement,
        this.graphicCharterForm.headerHtml,
        "headerHtml",
      );
    }
    if (!this.graphicCharterFooterEditor && this.graphicCharterFooterHost) {
      this.graphicCharterFooterEditor = this.createGraphicCharterEditor(
        this.graphicCharterFooterHost.nativeElement,
        this.graphicCharterForm.footerHtml,
        "footerHtml",
      );
    }
  }

  private createGraphicCharterEditor(
    element: HTMLElement,
    content: string,
    field: "headerHtml" | "footerHtml",
  ): Editor {
    return new Editor({
      element,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
        TextStyle,
        FontSize,
        Color,
        FontFamily,
        Underline,
        Highlight.configure({ multicolor: true }),
        Link.configure({ openOnClick: false, autolink: true }),
        Image.configure({ inline: true, allowBase64: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
      ],
      content: content || "<p></p>",
      onUpdate: ({ editor }) => {
        this.graphicCharterForm[field] = editor.getHTML();
      },
      onSelectionUpdate: () => {
        this.toolbarStateVersion += 1;
      },
    });
  }

  private getGraphicCharterEditor(
    section: GraphicCharterEditorSection,
  ): Editor | null {
    return section === "header"
      ? this.graphicCharterHeaderEditor
      : this.graphicCharterFooterEditor;
  }

  private persistGraphicCharterEditors(): void {
    if (this.graphicCharterHeaderEditor) {
      this.graphicCharterForm.headerHtml =
        this.graphicCharterHeaderEditor.getHTML();
    }
    if (this.graphicCharterFooterEditor) {
      this.graphicCharterForm.footerHtml =
        this.graphicCharterFooterEditor.getHTML();
    }
  }

  private destroyGraphicCharterEditors(): void {
    if (this.graphicCharterHeaderEditor) {
      this.graphicCharterHeaderEditor.destroy();
      this.graphicCharterHeaderEditor = null;
    }
    if (this.graphicCharterFooterEditor) {
      this.graphicCharterFooterEditor.destroy();
      this.graphicCharterFooterEditor = null;
    }
  }

  private rebindEditorSoon(): void {
    queueMicrotask(() => this.ensureEditorInstance());
  }

  private resolveTemplateGraphicCharterId(template: TemplateRecord): string {
    const currentId = String(template.graphicCharterId || "");
    if (
      currentId &&
      this.organizationGraphicCharters.some((charter) => charter.id === currentId)
    ) {
      return currentId;
    }
    return this.resolveDefaultGraphicCharterId();
  }

  private resolveDefaultGraphicCharterId(): string {
    const defaultCharter =
      this.organizationGraphicCharters.find((charter) => charter.isDefault) ||
      this.organizationGraphicCharters[0] ||
      null;
    return defaultCharter?.id || "";
  }

  private applyGraphicCharterToCurrentState(includeSections: boolean): void {
    const charter = this.selectedGraphicCharter;
    if (!charter) return;
    const config = this.graphicCharters.normalizeGraphicCharterConfig(
      charter.config,
    );
    this.pageSettingsForm = {
      orientation: config.layout.orientation,
      mt: config.layout.pageMargins.mt,
      mb: config.layout.pageMargins.mb,
      ml: config.layout.pageMargins.ml,
      mr: config.layout.pageMargins.mr,
      headerTop: config.layout.headerFooterDistances.headerTop,
      footerBottom: config.layout.headerFooterDistances.footerBottom,
    };
    this.watermarkForm = {
      enabled: config.watermark.enabled,
      text: config.watermark.text || "CONFIDENTIEL",
      color: config.watermark.color || "#000000",
      opacity: config.watermark.opacity || 0.07,
      size: 80,
    };
    if (!includeSections) return;
    this.hasHeader = config.header.enabledByDefault;
    this.hasFooter = config.footer.enabledByDefault;
    this.editorContent = {
      ...this.editorContent,
      header: config.header.html || "",
      footer: config.footer.html || "",
    };
    if (this.activeSection === "header" || this.activeSection === "footer") {
      this.setActiveEditorHtml(this.editorContent[this.activeSection]);
    }
    if (this.activeSection === "header" && !this.hasHeader) {
      this.activeSection = "body";
    }
    if (this.activeSection === "footer" && !this.hasFooter) {
      this.activeSection = "body";
    }
    this.rebindEditorSoon();
  }

  private getVariableBucket(type: unknown): "simple" | "list" | "table" {
    if (type === "list-object") return "table";
    if (type === "list") return "list";
    return "simple";
  }

  private normalizeVariablePanelType(value: string): "simple" | "list" | "table" {
    return value === "list" || value === "table" ? value : "simple";
  }

  private getOrganizationVariableSettings(): {
    visibleKeys: string[];
    configured: boolean;
    labels: Record<string, string>;
  } {
    const settings = (this.editorState.getState().settings || {}) as any;
    const configured = Array.isArray(settings.organizationVisibleVarKeys);
    const visibleKeys = configured
      ? (settings.organizationVisibleVarKeys || [])
          .map((value: unknown) => this.normalizeVariableKey(value))
          .filter(Boolean)
      : [];
    const rawLabels =
      settings.organizationVariableLabels &&
      typeof settings.organizationVariableLabels === "object"
        ? settings.organizationVariableLabels
        : {};
    const labels = Object.fromEntries(
      Object.entries(rawLabels)
        .map(([key, label]) => [
          this.normalizeVariableKey(String(key || "").replace(/^org_/, "")),
          String(label || "").trim(),
        ])
        .filter(([key]) => key),
    );
    return { visibleKeys, configured, labels };
  }

  private buildVisibleOrganizationVariables(settings: {
    visibleKeys: string[];
    configured: boolean;
    labels: Record<string, string>;
  }): Array<{ key: string; label: string }> {
    const org = (this.currentOrganization || {}) as Record<string, unknown>;
    const raw =
      org?.["raw"] && typeof org["raw"] === "object"
        ? (org["raw"] as Record<string, unknown>)
        : {};
    const candidates: Record<string, unknown> = {
      nom_etab: org["nom"] || org["name"],
      adresse_etab: org["adresse"],
      tel_etab: org["tel"],
      ville_etab: org["ville"],
      email_etab: org["email"],
      directeur: this.selectedGraphicCharterConfig.identity.directorName,
      slogan_etab: this.selectedGraphicCharterConfig.identity.slogan,
      logo_etab: this.selectedGraphicCharterConfig.identity.logoText,
      annee_univ: "",
    };
    Object.entries(raw).forEach(([key, value]) => {
      const normalized = this.normalizeVariableKey(key);
      if (normalized) candidates[normalized] = value;
    });
    const visible = new Set(settings.visibleKeys);
    return Object.keys(candidates)
      .filter((key) => !settings.configured || visible.has(key))
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        key,
        label: settings.labels[key] || this.humanizeVariableKey(key),
      }));
  }

  private normalizeVariableKey(value: unknown): string {
    return String(value || "")
      .trim()
      .replace(/^org_/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  private humanizeVariableKey(key: string): string {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private genId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private getDefaultPageSettings(): PageSettingsForm {
    return {
      orientation: "portrait",
      mt: 20,
      mb: 20,
      ml: 25,
      mr: 25,
      headerTop: 5,
      footerBottom: 5,
    };
  }

  private getPageSettingsFromTemplate(
    template: TemplateRecord,
  ): PageSettingsForm {
    const charterConfig = this.selectedGraphicCharterConfig;
    const defaults = {
      orientation: charterConfig.layout.orientation,
      mt: charterConfig.layout.pageMargins.mt,
      mb: charterConfig.layout.pageMargins.mb,
      ml: charterConfig.layout.pageMargins.ml,
      mr: charterConfig.layout.pageMargins.mr,
      headerTop: charterConfig.layout.headerFooterDistances.headerTop,
      footerBottom: charterConfig.layout.headerFooterDistances.footerBottom,
    };
    const margins = (template["pageMargins"] || {}) as Record<string, unknown>;
    const distances = (template.headerFooterDistances ||
      template["pageHeaderFooterDistances"] ||
      {}) as unknown as Record<string, unknown>;
    const orientation = String(
      template["orientation"] || template["pageOrientation"] || "portrait",
    ).toLowerCase();
    return {
      orientation: orientation === "landscape" ? "landscape" : "portrait",
      mt: this.coerceNumber(margins["mt"], defaults.mt),
      mb: this.coerceNumber(margins["mb"], defaults.mb),
      ml: this.coerceNumber(margins["ml"], defaults.ml),
      mr: this.coerceNumber(margins["mr"], defaults.mr),
      headerTop: this.coerceNumber(distances["headerTop"], defaults.headerTop),
      footerBottom: this.coerceNumber(
        distances["footerBottom"],
        defaults.footerBottom,
      ),
    };
  }

  private getDefaultWatermark(): WatermarkForm {
    return {
      enabled: false,
      text: "CONFIDENTIEL",
      color: "#000000",
      opacity: 0.07,
      size: 80,
    };
  }

  private getWatermarkFromTemplate(template: TemplateRecord): WatermarkForm {
    const charterConfig = this.selectedGraphicCharterConfig;
    const defaults: WatermarkForm = {
      enabled: charterConfig.watermark.enabled,
      text: charterConfig.watermark.text || "CONFIDENTIEL",
      color: charterConfig.watermark.color || "#000000",
      opacity: charterConfig.watermark.opacity || 0.07,
      size: 80,
    };
    const raw = (template["watermark"] || {}) as Record<string, unknown>;
    return {
      enabled: raw["enabled"] === true,
      text: String(raw["text"] || defaults.text),
      color: String(raw["color"] || defaults.color),
      opacity: this.coerceNumber(raw["opacity"], defaults.opacity),
      size: this.coerceNumber(raw["size"], defaults.size),
    };
  }

  private getDefaultSectionDirections(): Record<
    "header" | "body" | "footer",
    "ltr" | "rtl"
  > {
    return {
      header: "ltr",
      body: "ltr",
      footer: "ltr",
    };
  }

  private getSectionDirectionsFromTemplate(
    template: TemplateRecord,
  ): Record<"header" | "body" | "footer", "ltr" | "rtl"> {
    const defaults = this.getDefaultSectionDirections();
    const raw = (template.sectionDirections || {}) as unknown as Record<
      string,
      unknown
    >;
    return {
      header: raw["header"] === "rtl" ? "rtl" : defaults.header,
      body: raw["body"] === "rtl" ? "rtl" : defaults.body,
      footer: raw["footer"] === "rtl" ? "rtl" : defaults.footer,
    };
  }

  private applyDirectionToCurrentEditor(): void {
    const element = this.editor?.view?.dom as HTMLElement | undefined;
    if (!element) return;
    const direction = this.activeSectionDirection;
    element.style.direction = direction;
    element.style.textAlign = direction === "rtl" ? "right" : "left";
    element.setAttribute("dir", direction);
  }

  private collectSearchMatches(): Array<{ from: number; to: number }> {
    if (!this.editor || !this.searchFind) return [];
    const needle = this.searchCaseSensitive
      ? this.searchFind
      : this.searchFind.toLowerCase();
    const matches: Array<{ from: number; to: number }> = [];
    this.editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const haystack = this.searchCaseSensitive
        ? node.text
        : node.text.toLowerCase();
      let index = haystack.indexOf(needle);
      while (index !== -1) {
        matches.push({
          from: pos + index,
          to: pos + index + this.searchFind.length,
        });
        index = haystack.indexOf(needle, index + needle.length);
      }
    });
    return matches;
  }

  private selectCurrentSearchMatch(): void {
    if (!this.editor || !this.searchMatchIndex) return;
    const match = this.searchMatches[this.searchMatchIndex - 1];
    if (!match) return;
    this.editor
      .chain()
      .focus()
      .setTextSelection({ from: match.from, to: match.to })
      .run();
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private coerceNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private clampNumber(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ): number {
    const numeric = this.coerceNumber(value, fallback);
    return Math.min(max, Math.max(min, numeric));
  }

  private async confirmAction(data: {
    title: string;
    message: string;
    confirmText?: string;
    actionType?: "delete" | "warning" | "success" | "info" | "error";
  }): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        cancelText: "Annuler",
        ...data,
      },
    });
    return firstValueFrom(ref.afterClosed());
  }
}


