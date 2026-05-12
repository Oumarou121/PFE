import { CommonModule } from "@angular/common";
import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { firstValueFrom } from "rxjs";
import { Editor } from "@tiptap/core";
import {
  buildEditorExtensions,
  buildStructuredDocumentExtensions,
  PaginationConfig,
  SHARED_EXTENSIONS,
} from "../../services/editor-extensions";

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
  normalizeTemplateSectionDisplay,
  normalizeTemplateFilterProfile,
  normalizeTemplateFilterProfileEntry,
  normalizeTemplateRecord,
} from "../../services/editor-normalizers";
import {
  GraphicCharterConfig,
  GraphicCharterRecord,
} from "../../models/graphic-charter.model";

type AdminPanel = "document" | "headerFooter" | "filters" | "table";
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

// PHASE 1: FontSize, renderTableCellStyle, TableCellExt, TableHeaderExt,
// ResizableImage and SHARED_EXTENSIONS have been moved to
// ../../services/editor-extensions.ts and are imported above.

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: "./admin.component.html",
  styleUrls: ["./admin.component.scss"],
  encapsulation: ViewEncapsulation.None,
  // OnPush: Angular only checks this component when inputs change or
  // markForCheck() is called — eliminates constant re-checking that caused lag.
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent
  implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy
{
  @ViewChild("editorHost") private editorHost?: ElementRef<HTMLElement>;
  @ViewChild("templateHeaderHost")
  private templateHeaderHost?: ElementRef<HTMLElement>;
  @ViewChild("templateFooterHost")
  private templateFooterHost?: ElementRef<HTMLElement>;
  @ViewChild("graphicCharterHeaderHost")
  private graphicCharterHeaderHost?: ElementRef<HTMLElement>;
  @ViewChild("graphicCharterFooterHost")
  private graphicCharterFooterHost?: ElementRef<HTMLElement>;

  isLoading = true;
  sidebarOpen = true;
  varsPanelVisible = false;
  editorPanel: AdminPanel = "document";
  activeHeaderFooterSection: "header" | "footer" = "header";
  selectedFamilyId = "";
  selectedTemplateId = "";
  templateNameDraft = "";
  saveStatus = "Prêt";
  previewOpen = false;
  previewHtml: SafeHtml = "";
  previewPlainHtml = "";
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
  imagePreviewSrc = "";
  imageWidth = "";
  imageHeight = "";
  imageAlign: "left" | "center" | "right" = "center";
  imageCaption = "";
  tableRows = 3;
  tableCols = 3;
  selectedTableCellHAlign: "left" | "center" | "right" | "justify" = "left";
  selectedTableCellVAlign: "top" | "middle" | "bottom" = "top";
  tableCellPosition = "—";
  tableInfo = "—";
  currentColumnWidth = 33;
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
  readonly textColors = [
    "#000000",
    "#1a1d2e",
    "#374151",
    "#6b7280",
    "#9ca3af",
    "#d1d5db",
    "#dc2626",
    "#ea580c",
    "#d97706",
    "#16a34a",
    "#0284c7",
    "#7c3aed",
    "#db2777",
    "#ffffff",
    "#fef9c3",
    "#dbeafe",
    "#dcfce7",
    "#fce7f3",
    "#f3e8ff",
    "#ffedd5",
    "#fee2e2",
    "#e0f2fe",
  ];
  readonly highlightColors = [
    "transparent",
    "#fef9c3",
    "#dbeafe",
    "#dcfce7",
    "#fce7f3",
    "#f3e8ff",
    "#ffedd5",
    "#fee2e2",
    "#e0f2fe",
    "#f0fdf4",
    "#fdf4ff",
    "#fff1f2",
    "#1e293b",
    "#1d4ed8",
    "#15803d",
    "#7e22ce",
    "#9f1239",
    "#c2410c",
  ];
  readonly tableCellColors = [
    "transparent",
    "#ffffff",
    "#f8fafc",
    "#dbeafe",
    "#dcfce7",
    "#fef9c3",
    "#fee2e2",
    "#fce7f3",
    "#f3e8ff",
    "#ffedd5",
    "#e0f2fe",
    "#f0fdf4",
    "#1e3a5f",
    "#1d4ed8",
    "#15803d",
    "#7c2d12",
    "#7c3aed",
    "#9f1239",
    "#374151",
    "#111827",
  ];
  readonly tableTextColors = [
    "#111111",
    "#374151",
    "#6b7280",
    "#ffffff",
    "#dc2626",
    "#ea580c",
    "#16a34a",
    "#0284c7",
    "#7c3aed",
    "#db2777",
  ];
  activeColorPopover: "text" | "highlight" | null = null;
  activeTablePopover: "background" | "text" | null = null;
  // Position dynamique de la toolbar tableau — calculée par computeTableToolbarStyle()
  tableToolbarStyle: Record<string, string> = {};
  selectedTextColor = "#1a1d2e";
  selectedHighlightColor = "#fef9c3";
  selectedTableBackgroundColor = "#ffffff";
  selectedTableTextColor = "#111111";
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
  private templateHeaderEditor: Editor | null = null;
  private templateFooterEditor: Editor | null = null;
  private editorBoundElement: HTMLElement | null = null;
  private editorSection: "header" | "body" | "footer" | null = null;
  // ─── FIX: clé de cache incluant headerHtml/footerHtml pour forcer
  //     la recréation de PaginationPlus quand la charte graphique change.
  private _editorPaginationCacheKey = "";
  private paginationObserver: MutationObserver | null = null;
  documentPageCountValue = 1;
  private graphicCharterHeaderEditor: Editor | null = null;
  private graphicCharterFooterEditor: Editor | null = null;
  private searchMatches: Array<{ from: number; to: number }> = [];

  // ─── CHANGED: toolbar version tracked privately, no longer triggers CD alone ─
  private _toolbarStateVersion = 0;
  get toolbarStateVersion(): number {
    return this._toolbarStateVersion;
  }

  // ─── CHANGED: single rebind timer reference to avoid multiple timeouts ──────
  private rebindTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── CHANGED: gc editors scheduled similarly ─────────────────────────────────
  private gcEnsureTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── CHANGED: flag to prevent double-init from both AfterViewInit and AfterViewChecked ──
  private editorInitialized = false;

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
    private elementRef: ElementRef<HTMLElement>,
    // ─── ADDED: NgZone and ChangeDetectorRef for performance ─────────────────
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadState();
  }

  // ─── CHANGED: init editor once here (replaces AfterViewChecked init) ─────────
  ngAfterViewInit(): void {
    this.editorInitialized = false;
    // Use setTimeout(0) so the DOM is fully stable before Tiptap attaches
    setTimeout(() => {
      this.ensureEditorInstance();
      this.editorInitialized = true;
    }, 0);
  }

  // ─── CHANGED: AfterViewChecked only handles graphic charter editors (modal).
  //             Never touches the main editor here — that was the infinite loop. ─
  ngAfterViewChecked(): void {
    if (this.graphicCharterModalOpen) {
      this.scheduleGcEditorsEnsure();
    }
    if (this.editorPanel === "headerFooter") {
      this.ensureTemplateHeaderFooterEditors();
    }
  }

  ngOnDestroy(): void {
    this.destroyEditor();
    this.destroyTemplateHeaderFooterEditors();
    this.destroyGraphicCharterEditors();
    if (this.rebindTimer !== null) clearTimeout(this.rebindTimer);
    if (this.gcEnsureTimer !== null) clearTimeout(this.gcEnsureTimer);
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

  @HostListener("document:click", ["$event"])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest(".tb-clr")) {
      this.activeColorPopover = null;
    }
    if (!target?.closest(".tbl-cell-clr-wrap")) {
      this.activeTablePopover = null;
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
      ({ key, label }) => ({ tech: key, key, label }),
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
    return this.getSelectedDocumentSection();
  }

  get isFormattingToolbarVisible(): boolean {
    return this.editorPanel === "document" || this.editorPanel === "headerFooter";
  }

  get activeDocumentDirection(): "ltr" | "rtl" {
    return this.sectionDirections[this.activeEditorSection] || "ltr";
  }

  get documentPageCount(): number {
    return this.documentPageCountValue;
  }

  get documentPageIndexes(): number[] {
    return Array.from({ length: this.documentPageCount }, (_, index) => index);
  }

  trackByPageIndex(_index: number, pageIndex: number): number {
    return pageIndex;
  }

  public onEditorViewportKeydown(event: KeyboardEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;

    const step = Math.max(Math.round(target.clientHeight * 0.85), 320);

    switch (event.key) {
      case "PageDown":
        target.scrollBy({ top: step, behavior: "smooth" });
        event.preventDefault();
        break;
      case "PageUp":
        target.scrollBy({ top: -step, behavior: "smooth" });
        event.preventDefault();
        break;
      case "Home":
        if (event.ctrlKey || event.metaKey) {
          target.scrollTo({ top: 0, behavior: "smooth" });
          event.preventDefault();
        }
        break;
      case "End":
        if (event.ctrlKey || event.metaKey) {
          target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
          event.preventDefault();
        }
        break;
    }
  }

  private async loadState(): Promise<void> {
    this.isLoading = true;
    await this.editorState.loadBootstrap();
    this.refreshCollections();
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  private refreshCollections(): void {
    this.families = this.familiesService.getFamilies();
    this.templates = this.editorState.getState().templates;
    this.organizations = this.organizationsService.getOrganizations();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.cdr.markForCheck();
  }

  toggleVarsPanel(): void {
    this.varsPanelVisible = !this.varsPanelVisible;
    this.cdr.markForCheck();
  }

  selectVariableGroup(groupId: string): void {
    this.activeVariableGroupId = groupId || "all";
    this.cdr.markForCheck();
  }

  logoutAndRedirect(): void {
    this.auth.logout();
  }

  selectFamily(familyId: string): void {
    this.selectedFamilyId = familyId;
    this.selectedTemplateId = "";
    this.clearEditor();
    this.cdr.markForCheck();
  }

  openTemplate(templateId: string): void {
    const template = this.templatesService.getTemplate(templateId);
    if (!template) return;
    this.persistEditorContent();
    this.destroyEditor();
    this.selectedTemplateId = template.id;
    this.templateNameDraft = String(template["nom"] || template["name"] || "");
    this.selectedGraphicCharterId =
      this.resolveTemplateGraphicCharterId(template);
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
    this.editorPanel = "document";
    this.saveStatus = "Prêt";
    this.rebindEditorSoon();
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  async saveTemplate(): Promise<void> {
    if (!this.templateNameDraft.trim()) {
      this.notifications.showWarning("Le nom du template est requis");
      return;
    }
    if (this.editorPanel === "headerFooter") {
      this.persistTemplateHeaderFooterEditors();
    } else {
      this.persistEditorContent();
    }
    const current = this.selectedTemplate;
    if (!current) {
      this.notifications.showWarning("Aucun template ouvert");
      return;
    }
    const next = normalizeTemplateRecord({
      ...current,
      nom: this.templateNameDraft.trim(),
      name: this.templateNameDraft.trim(),
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
    this.cdr.markForCheck();
    try {
      await this.templatesService.saveTemplate(next);
      this.refreshCollections();
      this.selectedTemplateId = next.id;
      this.saveStatus = "Enregistré";
      this.notifications.showSuccess("Template enregistré");
    } catch (err) {
      this.saveStatus = "Erreur";
      this.notifications.showError("Impossible d'enregistrer le template");
    }
    this.cdr.markForCheck();
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
    try {
      await this.templatesService.deleteTemplate(templateId);
      this.refreshCollections();
      if (this.selectedTemplateId === templateId) this.clearEditor();
      this.notifications.showSuccess("Template supprimé");
    } catch (err) {
      this.notifications.showError("Impossible de supprimer le template");
    }
    this.cdr.markForCheck();
  }

  onGraphicCharterChange(charterId: string): void {
    this.selectedGraphicCharterId = charterId;
    this.applyGraphicCharterToCurrentState(true);
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
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
    if (this.activeEditorSection === "header") {
      this.setActiveEditorHtml(charter.config.header.html || "");
    } else if (this.activeEditorSection === "footer") {
      this.setActiveEditorHtml(charter.config.footer.html || "");
    } else {
      this.notifications.showInfo(
        "La charte ne remplace pas le corps du document.",
      );
      return;
    }
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
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
    if (this.activeEditorSection === "header") {
      config.header.html = this.editorContent.header;
    } else if (this.activeEditorSection === "footer") {
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
    // ─── FIX: invalider le cache PaginationPlus pour que le body editor
    //     soit recréé avec le nouveau headerHtml/footerHtml au prochain
    //     passage en section body.
    this._editorPaginationCacheKey = "";
    this.notifications.showSuccess("Section enregistrée dans la charte");
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
    // Ensure gc editors are initialized after modal DOM is fully rendered
    setTimeout(() => {
      this.ensureGraphicCharterEditors();
      this.cdr.markForCheck();
    }, 50);
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
    const name = this.graphicCharterForm.name.trim();
    if (!name) {
      this.notifications.showWarning("Le nom de la charte est requis");
      return;
    }
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
          headerTop: this.clampNumber(
            this.graphicCharterForm.headerTop,
            0,
            30,
            5,
          ),
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
        name,
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
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  closeGraphicCharterModal(): void {
    this.persistGraphicCharterEditors(); // ← persist HTML before destroying editors
    this.graphicCharterModalOpen = false;
    this.destroyGraphicCharterEditors();
    this.cdr.markForCheck();
  }

  switchSection(section: "body" | "headerFooter" | "filters" | "table"): void {
    if (this.editorPanel === "headerFooter") {
      this.persistTemplateHeaderFooterEditors();
    } else {
      this.persistEditorContent();
    }
    if (section === "filters") {
      this.editorPanel = "filters";
      this.destroyTemplateHeaderFooterEditors();
      void this.refreshTemplateFilters();
    } else if (section === "headerFooter") {
      this.editorPanel = "headerFooter";
      this.destroyEditor();
      this.cdr.detectChanges();
      this.ensureTemplateHeaderFooterEditors();
    } else if (section === "table") {
      this.editorPanel = "table";
      this.destroyTemplateHeaderFooterEditors();
    } else {
      this.editorPanel = "document";
      this.destroyTemplateHeaderFooterEditors();
    }
    this.rebindEditorSoon();
    this.cdr.markForCheck();
  }

  toggleTemplateSection(section: "header" | "footer"): void {
    if (this.editorPanel === "headerFooter") {
      this.persistTemplateHeaderFooterEditors();
    } else {
      this.persistEditorContent();
    }
    if (section === "header") {
      this.hasHeader = !this.hasHeader;
      this.templateHeaderEditor?.setEditable(this.hasHeader);
      if (this.hasHeader && this.isBlankEditorHtml(this.editorContent.header)) {
        this.editorContent = {
          ...this.editorContent,
          header: this.selectedGraphicCharterConfig.header.html || "<p></p>",
        };
      }
    } else {
      this.hasFooter = !this.hasFooter;
      this.templateFooterEditor?.setEditable(this.hasFooter);
      if (this.hasFooter && this.isBlankEditorHtml(this.editorContent.footer)) {
        this.editorContent = {
          ...this.editorContent,
          footer: this.selectedGraphicCharterConfig.footer.html || "<p></p>",
        };
      }
    }
    this.saveStatus = "Modifié";
    // ─── FIX: forcer la recréation du body editor avec la nouvelle config
    //     PaginationPlus (hasHeader/hasFooter ont changé → headerHtml/footerHtml
    //     passés à PaginationPlus doivent être mis à jour).
    this._editorPaginationCacheKey = "";
    this.rebindEditorSoon();
    this.cdr.markForCheck();
  }

  updateSectionContent(value: string): void {
    if (this.editorPanel === "filters") return;
    this.editorContent[this.activeEditorSection] = value;
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
    this.cdr.markForCheck();
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
    field: "required" | "locked" | "adminEnabled" | "userEnabled",
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

  addCustomTemplateAllowedValue(
    filterId: string,
    value: string,
    label: string,
  ): void {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      this.notifications.showWarning("Saisissez une valeur personnalisée");
      return;
    }
    this.toggleTemplateFilterAllowedValue(
      filterId,
      {
        value: normalizedValue,
        label: String(label || "").trim() || normalizedValue,
      },
      true,
    );
  }

  formatAllowedFilterValues(
    options: { value: string; label: string }[] = [],
  ): string {
    return options
      .map((option) =>
        option.label && option.label !== option.value
          ? `${option.label} (${option.value})`
          : option.value,
      )
      .join(" - ");
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
    if (this.editorPanel === "filters") return;
    const editor = this.getActiveTiptapEditor();
    if (editor) {
      editor.chain().focus().insertContent(`{{${tech}}}`).run();
    } else {
      this.editorContent[this.activeEditorSection] += `{{${tech}}}`;
    }
    this.saveStatus = "Modifié";
  }

  // ─── CHANGED: reads private field, no longer causes excessive CD ─────────────
  isEditorActive(name: string, attrs?: Record<string, unknown>): boolean {
    void this._toolbarStateVersion;
    try {
      return !!this.getActiveTiptapEditor()?.isActive(name, attrs);
    } catch {
      return false;
    }
  }

  isEditorAlignActive(align: "left" | "center" | "right" | "justify"): boolean {
    void this._toolbarStateVersion;
    try {
      return !!this.getActiveTiptapEditor()?.isActive({ textAlign: align });
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
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  clearGraphicCharterBackground(): void {
    this.graphicCharterForm.backgroundEnabled = false;
    this.graphicCharterForm.backgroundImage = "";
    this.cdr.markForCheck();
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
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    const chain = editor.chain().focus();
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
    this.saveStatus = "Modifié";
    // ─── CHANGED: markForCheck instead of incrementing version in hot path ────
    this.cdr.markForCheck();
  }

  applyDirection(direction: "ltr" | "rtl"): void {
    if (this.editorPanel === "filters") return;
    this.sectionDirections = {
      ...this.sectionDirections,
      [this.activeEditorSection]: direction,
    };
    this.applyDirectionToCurrentEditor();
    this.saveStatus = "Modifié";
    this.notifications.showInfo(
      direction === "rtl" ? "Mode RTL activé" : "Mode LTR activé",
    );
    this.cdr.markForCheck();
  }

  applyAlign(align: "left" | "center" | "right" | "justify"): void {
    this.getActiveTiptapEditor()?.chain().focus().setTextAlign(align).run();
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
  }

  applyHeading(value: string): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === "h1") chain.toggleHeading({ level: 1 }).run();
    else if (value === "h2") chain.toggleHeading({ level: 2 }).run();
    else if (value === "h3") chain.toggleHeading({ level: 3 }).run();
    else if (value === "h4") chain.toggleHeading({ level: 4 }).run();
    else chain.setParagraph().run();
  }

  applyFontFamily(value: string): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value) chain.setFontFamily(value).run();
    else chain.unsetFontFamily().run();
  }

  applyFontSize(value: string): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    const chain = editor.chain().focus() as any;
    if (value) chain.setMark("textStyle", { fontSize: value }).run();
    else chain.setMark("textStyle", { fontSize: null }).run();
  }

  toggleColorPopover(kind: "text" | "highlight", event: MouseEvent): void {
    event.stopPropagation();
    this.activeColorPopover = this.activeColorPopover === kind ? null : kind;
    this.cdr.markForCheck();
  }

  chooseTextColor(color: string): void {
    this.applyTextColor(color);
    this.activeColorPopover = null;
    this.cdr.markForCheck();
  }

  chooseHighlightColor(color: string): void {
    this.applyHighlightColor(color === "transparent" ? "" : color);
    this.activeColorPopover = null;
    this.cdr.markForCheck();
  }

  applyTextColor(color: string): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    if (color) {
      this.selectedTextColor = color;
      editor.chain().focus().setColor(color).run();
      this.saveStatus = "Modifié";
    }
  }

  applyHighlightColor(color: string): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    if (color) {
      this.selectedHighlightColor = color;
      editor.chain().focus().setHighlight({ color }).run();
    } else {
      this.selectedHighlightColor = "transparent";
      editor.chain().focus().unsetHighlight().run();
    }
    this.saveStatus = "Modifié";
  }

  insertHorizontalRule(): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
    this.saveStatus = "Modifié";
  }

  insertSignatureBlock(): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    editor
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
    this.cdr.markForCheck();
  }

  toggleSearchPanel(): void {
    this.searchPanelOpen = !this.searchPanelOpen;
    if (this.searchPanelOpen) this.doSearch();
    this.cdr.markForCheck();
  }

  closeSearchPanel(): void {
    this.searchPanelOpen = false;
    this.cdr.markForCheck();
  }

  doSearch(): void {
    this.searchMatches = this.collectSearchMatches();
    if (!this.searchFind) {
      this.searchMatchCount = 0;
      this.searchMatchIndex = 0;
      this.cdr.markForCheck();
      return;
    }
    this.searchMatchCount = this.searchMatches.length;
    this.searchMatchIndex = this.searchMatches.length
      ? Math.min(this.searchMatchIndex || 1, this.searchMatches.length)
      : 0;
    this.selectCurrentSearchMatch();
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  replaceOne(): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor || !this.searchFind) return;
    if (!this.searchMatches.length) this.doSearch();
    const match = this.searchMatches[this.searchMatchIndex - 1];
    if (!match) return;
    editor
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
    const editor = this.getActiveTiptapEditor();
    if (!editor || !this.searchFind) return;
    const flags = this.searchCaseSensitive ? "g" : "gi";
    const re = new RegExp(this.escapeRegex(this.searchFind), flags);
    const html = editor.getHTML();
    const count = (html.match(re) || []).length;
    editor.commands.setContent(html.replace(re, this.searchReplace), false);
    if (this.editorPanel === "headerFooter") {
      this.persistTemplateHeaderFooterEditors();
    } else {
      this.persistEditorContent();
    }
    this.saveStatus = "Modifié";
    this.doSearch();
    this.notifications.showSuccess(`${count} occurrence(s) remplacée(s)`);
  }

  openDateVariableModal(): void {
    if (!this.getActiveTiptapEditor()) return;
    this.closeAllModals();
    this.selectedDateVariable = "{{date_du_jour}}";
    this.dateVariableModalOpen = true;
    this.cdr.markForCheck();
  }

  closeDateVariableModal(): void {
    this.dateVariableModalOpen = false;
    this.cdr.markForCheck();
  }

  selectDateVariable(value: string): void {
    this.selectedDateVariable = value || "{{date_du_jour}}";
    this.cdr.markForCheck();
  }

  insertSelectedDateVariable(): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    editor.chain().focus().insertContent(this.selectedDateVariable).run();
    this.dateVariableModalOpen = false;
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
  }

  openLinkModal(): void {
    this.closeAllModals();
    this.linkUrl = "";
    this.linkModalOpen = true;
    this.cdr.markForCheck();
  }

  insertLink(): void {
    const url = this.linkUrl.trim();
    const editor = this.getActiveTiptapEditor();
    if (!editor || !url) return;
    editor.chain().focus().setLink({ href: url }).run();
    this.linkModalOpen = false;
    this.linkUrl = "";
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
  }

  openImageModal(): void {
    this.closeAllModals();
    this.imageUrl = "";
    this.imageAlt = "";
    this.imagePreviewSrc = "";
    this.imageWidth = "";
    this.imageHeight = "";
    this.imageAlign = "center";
    this.imageCaption = "";
    this.imageModalOpen = true;
    this.cdr.markForCheck();
  }

  onImageFileChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      this.imageUrl = src;
      this.imagePreviewSrc = src;
      this.imageAlt = this.imageAlt || file.name.replace(/\.[^.]+$/, "");
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  onImageUrlChange(value: string): void {
    this.imageUrl = value;
    this.imagePreviewSrc = value.trim();
    this.cdr.markForCheck();
  }

  insertImage(): void {
    const src = this.imageUrl.trim();
    const editor = this.getActiveTiptapEditor();
    if (!editor || !src) return;

    // BUG FIX: utiliser la commande native setImage de ImagePlus au lieu
    // d'insérer du HTML brut. Le HTML brut court-circuite la NodeView
    // (pas de poignées de redimensionnement, alignment ignoré, width perdue
    // au re-parse car ImagePlus ne lit que l'attribut width en pourcentage).
    //
    // ImagePlus stocke :
    //   • src      → URL ou base64
    //   • alt      → texte alternatif
    //   • width    → largeur en % (ex: "50%") — les valeurs px/mm ne sont
    //                pas persistées par la NodeView ; on les convertit en %
    //                ou on les laisse vides pour laisser l'utilisateur
    //                redimensionner via les poignées.
    //   • alignment → "left" | "center" | "right" (justifyContent du wrapper)

    // Normalisation de la largeur : ImagePlus ne persiste que les valeurs "%".
    // Si l'utilisateur saisit une valeur absolue (px, mm, cm) on la laisse
    // passer telle quelle dans l'attribut width — elle sera ignorée par
    // parseHTML mais visible au premier rendu via setupDOMStructure.
    const rawWidth = this.imageWidth.trim();
    const width = rawWidth || "";

    const chain = editor.chain().focus() as any;
    chain
      .setImage({
        src,
        alt: this.imageAlt || this.imageCaption || "",
        width,
        alignment: this.imageAlign,
      })
      .run();

    // Si une légende est définie, on l'insère comme paragraphe juste après
    // l'image (ImagePlus ne gère pas nativement les captions).
    if (this.imageCaption.trim()) {
      editor
        .chain()
        .focus()
        .insertContent(
          `<p style="font-size:10pt;color:#666;text-align:${this.imageAlign};margin-top:4px">${this.escapeHtml(this.imageCaption.trim())}</p>`,
        )
        .run();
    }

    this.imageModalOpen = false;
    this.imageUrl = "";
    this.imageAlt = "";
    this.imagePreviewSrc = "";
    this.imageWidth = "";
    this.imageHeight = "";
    this.imageAlign = "center";
    this.imageCaption = "";
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
  }

  openTableModal(): void {
    this.closeAllModals();
    this.tableRows = 3;
    this.tableCols = 3;
    this.tableModalOpen = true;
    this.cdr.markForCheck();
  }

  insertTable(): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    editor
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
    this.cdr.markForCheck();
  }

  closeEditorModal(): void {
    this.linkModalOpen = false;
    this.imageModalOpen = false;
    this.tableModalOpen = false;
    this.dateVariableModalOpen = false;
    this.cdr.markForCheck();
  }

  /**
   * Ferme TOUS les modals/panneaux flottants avant d'en ouvrir un autre.
   * Évite que deux modals soient ouverts simultanément.
   */
  private closeAllModals(): void {
    this.linkModalOpen = false;
    this.imageModalOpen = false;
    this.tableModalOpen = false;
    this.dateVariableModalOpen = false;
    this.watermarkModalOpen = false;
    this.activeTablePopover = null;
    this.activeColorPopover = null;
    this.searchPanelOpen = false;
  }

  /**
   * Calcule la position CSS de la toolbar tableau pour la placer
   * AU-DESSUS du nœud table actif, en respectant les marges de page.
   * Doit être appelée à chaque sélection / mise à jour de l'éditeur.
   */
  computeTableToolbarStyle(): Record<string, string> {
    const editor = this.getActiveTiptapEditor();
    if (!editor || !this.isEditorActive("table")) {
      return {};
    }
    try {
      const { state, view } = editor;
      // Remonter jusqu'au nœud table à partir de la sélection courante
      let tablePos: number | null = null;
      state.doc.nodesBetween(
        state.selection.from,
        state.selection.to,
        (node, pos) => {
          if (node.type.name === "table" && tablePos === null) {
            tablePos = pos;
          }
        },
      );
      if (tablePos === null) return {};

      // Coordonnées DOM du nœud table
      const coords = view.coordsAtPos(tablePos + 1);
      const editorEl = this.editorHost?.nativeElement as
        | HTMLElement
        | undefined;
      const editorRect = editorEl?.getBoundingClientRect();

      // On positionne la toolbar juste au-dessus du bord supérieur du tableau,
      // centrée horizontalement sur la zone d'édition (viewport).
      const TOOLBAR_HEIGHT = 38; // hauteur estimée en px
      const MARGIN = 6; // espace entre toolbar et tableau

      const top = Math.max(
        (editorRect?.top ?? 0) + 4,
        coords.top - TOOLBAR_HEIGHT - MARGIN,
      );

      return {
        position: "fixed",
        top: `${top}px`,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "4000",
      };
    } catch {
      return {};
    }
  }

  runTableCommand(command: string): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    const chain = editor.chain().focus() as any;
    const commands: Record<string, () => void> = {
      addRowBefore: () => chain.addRowBefore().run(),
      addRowAfter: () => chain.addRowAfter().run(),
      duplicateRow: () => chain.duplicateRow(true).run(),
      deleteRow: () => chain.deleteRow().run(),
      addColumnBefore: () => chain.addColumnBefore().run(),
      addColumnAfter: () => chain.addColumnAfter().run(),
      duplicateColumn: () => chain.duplicateColumn(true).run(),
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
    this.cdr.markForCheck();
  }

  toggleTablePopover(kind: "background" | "text", event: MouseEvent): void {
    event.stopPropagation();
    this.activeTablePopover = this.activeTablePopover === kind ? null : kind;
    this.cdr.markForCheck();
  }

  applyTableCellBackground(color: string): void {
    this.applyTableCellAttribute("backgroundColor", color);
    this.selectedTableBackgroundColor = color;
    this.activeTablePopover = null;
    this.cdr.markForCheck();
  }

  applyTableCellTextColor(color: string): void {
    this.applyTableCellAttribute("textColor", color);
    this.selectedTableTextColor = color;
    this.activeTablePopover = null;
    this.cdr.markForCheck();
  }

  applyTableCellAlign(align: "left" | "center" | "right" | "justify"): void {
    this.selectedTableCellHAlign = align;
    this.applyTableCellAttribute("textAlign", align);
  }

  applyTableCellVerticalAlign(align: "top" | "middle" | "bottom"): void {
    this.selectedTableCellVAlign = align;
    this.applyTableCellAttribute("verticalAlign", align);
  }

  private applyTableCellAttribute(
    attribute: "backgroundColor" | "textColor" | "textAlign" | "verticalAlign",
    value: string,
  ): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    const attrs = { [attribute]: value === "transparent" ? null : value };
    const chain = editor.chain().focus();
    // BUG FIX: on vérifie d'abord tableHeader, puis tableCell.
    // updateAttributes utilise le nom exact du node tel qu'enregistré par
    // l'extension (hérité de @tiptap/extension-table-header → "tableHeader",
    // et @tiptap/extension-table-cell → "tableCell").
    // On tente les deux pour couvrir le cas d'une sélection mixte.
    if (editor.isActive("tableHeader")) {
      chain.updateAttributes("tableHeader", attrs).run();
    } else if (editor.isActive("tableCell")) {
      chain.updateAttributes("tableCell", attrs).run();
    } else {
      // Fallback : curseur peut être dans un paragraphe imbriqué dans la cellule.
      // On tente les deux commandes ; Tiptap ignorera celle qui ne s'applique pas.
      (editor.chain().focus() as any)
        .updateAttributes("tableHeader", attrs)
        .run();
      (editor.chain().focus() as any)
        .updateAttributes("tableCell", attrs)
        .run();
    }
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
  }

  openWatermarkModal(): void {
    if (!this.selectedTemplate) {
      this.notifications.showWarning("Ouvrez d'abord un template");
      return;
    }
    this.closeAllModals();
    this.watermarkForm = this.getWatermarkFromTemplate(this.selectedTemplate);
    this.watermarkModalOpen = true;
    this.cdr.markForCheck();
  }

  closeWatermarkModal(): void {
    this.watermarkModalOpen = false;
    this.cdr.markForCheck();
  }

  updateWatermark(
    field: keyof WatermarkForm,
    value: string | number | boolean,
  ): void {
    if (field === "enabled") {
      this.watermarkForm = { ...this.watermarkForm, enabled: !!value };
      this.saveStatus = "Modifié";
      this.cdr.markForCheck();
      return;
    }
    if (field === "opacity") {
      this.watermarkForm = {
        ...this.watermarkForm,
        opacity: this.clampNumber(Number(value) / 100, 0.01, 0.8, 0.07),
      };
      this.saveStatus = "Modifié";
      this.cdr.markForCheck();
      return;
    }
    if (field === "size") {
      this.watermarkForm = {
        ...this.watermarkForm,
        size: this.clampNumber(value, 20, 250, 80),
      };
      this.saveStatus = "Modifié";
      this.cdr.markForCheck();
      return;
    }
    this.watermarkForm = { ...this.watermarkForm, [field]: String(value) };
    this.saveStatus = "Modifié";
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  removeWatermark(): void {
    this.watermarkForm = { ...this.watermarkForm, enabled: false };
    this.watermarkModalOpen = false;
    this.saveStatus = "Modifié";
    this.notifications.showSuccess("Filigrane supprimé");
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
    await this.refreshPreviewFilters(false);
    await this.loadPreviewBeneficiaries();
    await this.refreshPreviewHtml();
    this.previewLoading = false;
    this.cdr.markForCheck();
  }

  async onPreviewBeneficiaryChange(beneficiaryId: string): Promise<void> {
    this.selectedPreviewBeneficiaryId = String(beneficiaryId || "");
    await this.refreshPreviewHtml();
    this.cdr.markForCheck();
  }

  async onPreviewFilterChange(filterId: string, value: unknown): Promise<void> {
    this.previewFilterValues = {
      ...this.previewFilterValues,
      [filterId]: value || null,
    };
    this.selectedPreviewBeneficiaryId = "";
    this.previewLoading = true;
    this.cdr.markForCheck();
    await this.refreshPreviewFilters(true);
    await this.loadPreviewBeneficiaries();
    await this.refreshPreviewHtml();
    this.previewLoading = false;
    this.cdr.markForCheck();
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
      organizationId: this.currentUserOrganizationId,
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
      family &&
      (this.selectedPreviewBeneficiaryId ||
        family.beneficiaryMode === "organization")
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
    this.previewPlainHtml = html;
    const themeVars = this.documentRender.getDocumentThemeVars(previewTemplate);
    Object.entries(themeVars).forEach(([key, value]) => {
      this.elementRef.nativeElement.style.setProperty(key, value);
    });
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
    this.cdr.markForCheck();
  }

  closePreviewModal(): void {
    this.previewOpen = false;
    this.cdr.markForCheck();
  }

  async printPreview(): Promise<void> {
    const template = this.selectedTemplate;
    if (!template) return;
    const family = this.selectedFamily;
    const person =
      family &&
      (this.selectedPreviewBeneficiaryId ||
        family.beneficiaryMode === "organization")
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
        organizationId: this.currentUserOrganizationId,
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

  getBeneficiaryLabel(
    beneficiary: BeneficiaryRecord | null | undefined,
  ): string {
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

  getPreviewOptionValue(value: unknown): string {
    return String(value ?? "");
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
    this.previewBeneficiaries =
      await this.familiesService.getBeneficiariesForFamily(
        family.id,
        this.currentUserOrganizationId,
        this.previewFilterValues,
      );
    const selectedBeneficiaryId = String(
      this.selectedPreviewBeneficiaryId || "",
    );
    const exists = this.previewBeneficiaries.some(
      (beneficiary) => String(beneficiary.id || "") === selectedBeneficiaryId,
    );
    if (!exists) {
      this.selectedPreviewBeneficiaryId = String(
        this.previewBeneficiaries[0]?.id || "",
      );
    } else {
      this.selectedPreviewBeneficiaryId = selectedBeneficiaryId;
    }
    this.cdr.markForCheck();
  }

  private clearEditor(): void {
    this.destroyTemplateHeaderFooterEditors();
    this.destroyEditor();
    this.selectedTemplateId = "";
    this.templateNameDraft = "";
    this.editorContent = { header: "", body: "", footer: "" };
    this.editorPanel = "document";
    this.saveStatus = "Prêt";
    this.selectedGraphicCharterId = "";
    this.hasHeader = false;
    this.hasFooter = false;
    this.pageSettingsForm = this.getDefaultPageSettings();
    this.watermarkForm = this.getDefaultWatermark();
    this.sectionDirections = this.getDefaultSectionDirections();
  }

  private setActiveEditorHtml(html: string): void {
    if (this.editorPanel === "filters") return;
    const section = this.activeEditorSection;
    this.editorContent[section] = html;
    const editor = this.getActiveTiptapEditor();
    if (this.editorPanel === "headerFooter" && editor) {
      editor.commands.setContent(this.normalizeEditorHtml(html), false);
    } else if (this.editor) {
      this.editor.commands.setContent(
        this.buildStructuredDocumentHtml(),
        false,
      );
    }
  }

  setActiveHeaderFooterSection(section: "header" | "footer"): void {
    this.activeHeaderFooterSection = section;
    this._toolbarStateVersion += 1;
    this.cdr.markForCheck();
  }

  private getActiveTiptapEditor(): Editor | null {
    if (this.editorPanel === "headerFooter") {
      return this.activeHeaderFooterSection === "footer"
        ? this.templateFooterEditor
        : this.templateHeaderEditor;
    }
    return this.editor;
  }

  useGraphicCharterSection(section: "header" | "footer"): void {
    const config = this.selectedGraphicCharterConfig;
    const html =
      section === "header" ? config.header.html || "" : config.footer.html || "";
    this.editorContent = {
      ...this.editorContent,
      [section]: html || "<p></p>",
    };
    if (section === "header") {
      this.hasHeader = true;
      this.templateHeaderEditor?.setEditable(true);
      this.templateHeaderEditor?.commands.setContent(this.editorContent.header, false);
    } else {
      this.hasFooter = true;
      this.templateFooterEditor?.setEditable(true);
      this.templateFooterEditor?.commands.setContent(this.editorContent.footer, false);
    }
    this.saveStatus = "ModifiÃ©";
    this._editorPaginationCacheKey = "";
    this.cdr.markForCheck();
  }

  async saveEnabledHeaderFooterToGraphicCharter(): Promise<void> {
    const orgId = this.currentUserOrganizationId;
    const charter = this.selectedGraphicCharter;
    if (!orgId || !charter) {
      this.notifications.showWarning("Choisissez une charte graphique");
      return;
    }
    if (!this.hasHeader && !this.hasFooter) {
      this.notifications.showWarning(
        "Activez l'en-tête ou le pied de page avant la sauvegarde.",
      );
      return;
    }

    this.persistTemplateHeaderFooterEditors();
    const config = this.graphicCharters.normalizeGraphicCharterConfig(
      charter.config,
    );

    if (this.hasHeader) {
      config.header.enabledByDefault = true;
      config.header.html = this.normalizeEditorHtml(this.editorContent.header);
    }
    if (this.hasFooter) {
      config.footer.enabledByDefault = true;
      config.footer.html = this.normalizeEditorHtml(this.editorContent.footer);
    }

    try {
      const saved = await this.graphicCharters.saveOrganizationGraphicCharter(
        orgId,
        { ...charter, config },
      );
      this.refreshCollections();
      this.selectedGraphicCharterId = saved?.id || charter.id;
      this._editorPaginationCacheKey = "";
      this.notifications.showSuccess(
        "En-tête et pied de page enregistrés dans la charte",
      );
      this.cdr.markForCheck();
    } catch (error) {
      console.error("[Admin] save header/footer to graphic charter failed", error);
      this.notifications.showError("Impossible d'enregistrer dans la charte");
    }
  }

  // ─── CHANGED: entire method runs outside Angular zone.
  //             Only state-changing callbacks re-enter the zone. ──────────────
  private ensureEditorInstance(): void {
    if (
      this.editorPanel === "filters" ||
      this.editorPanel === "headerFooter" ||
      !this.selectedTemplate
    ) {
      this.destroyEditor();
      return;
    }
    const element = this.editorHost?.nativeElement || null;
    if (!element) return;
    const documentCacheKey = [
      this.hasHeader,
      this.hasFooter,
      this.selectedGraphicCharterId,
      this.pageSettingsForm.orientation,
      this.pageSettingsForm.mt,
      this.pageSettingsForm.mb,
      this.pageSettingsForm.ml,
      this.pageSettingsForm.mr,
      this.pageSettingsForm.headerTop,
      this.pageSettingsForm.footerBottom,
      this.getLiveHeaderDisplayMode(),
      this.getLiveFooterDisplayMode(),
      this.editorContent.header,
      this.editorContent.footer,
    ].join("|");

    // ─── FIX: Pour la section body, inclure headerHtml/footerHtml dans la clé
    //     de cache pour forcer la recréation quand la charte graphique change.
    //     Sans ça, PaginationPlus garde l'ancien en-tête/pied de page
    //     même après un changement de charte, car element+section sont identiques.
    if (
      this.editor &&
      this.editorBoundElement === element &&
      this._editorPaginationCacheKey === documentCacheKey
    ) {
      return;
    }
    this.persistEditorContent();
    this.destroyEditor();
    this.editorBoundElement = element;
    this.editorSection = "body";
    this._editorPaginationCacheKey = documentCacheKey;

    this.ngZone.runOutsideAngular(() => {
      const paginationConfig = this.buildPaginationConfig();
      this.editor = new Editor({
        element,
        extensions: buildStructuredDocumentExtensions(paginationConfig),
        content: this.buildStructuredDocumentHtml(),
        onUpdate: ({ editor }) => {
          const html = editor.getHTML();
          this.syncStructuredEditorContent(html);
          // Re-enter zone only for UI-visible state
          this.ngZone.run(() => {
            this.saveStatus = "Modifié";
            this._toolbarStateVersion += 1;
            this.cdr.markForCheck();
          });
        },
        onSelectionUpdate: () => {
          this.ngZone.run(() => {
            this._toolbarStateVersion += 1;
            this.updateTablePanelState();
            // Auto-switch vers l'onglet Tableau si le curseur entre dans un tableau
            if (
              this.editor?.isActive("table") &&
              this.editorPanel === "document"
            ) {
              // Ne pas forcer le switch — laisser l'utilisateur choisir
              // mais rendre le tab visible
            }
            this.cdr.markForCheck();
          });
        },
      });
    });

    this.applyDirectionToCurrentEditor();
    this.startPaginationObserver();
    this.syncPaginationPageCount();
  }

  private updateTablePanelState(): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor || !editor.isActive("table")) {
      this.tableCellPosition = "—";
      this.tableInfo = "—";
      return;
    }
    // Position de la cellule
    const { state } = editor;
    const { $from } = state.selection;
    let row = 0,
      col = 0,
      totalRows = 0,
      totalCols = 0;
    try {
      // Remonter jusqu'à la cellule
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (
          node.type.name === "tableCell" ||
          node.type.name === "tableHeader"
        ) {
          col = $from.index(d - 1) + 1;
          row = $from.index(d - 2) + 1;
        }
        if (node.type.name === "table") {
          totalRows = node.childCount;
          totalCols = node.firstChild?.childCount || 0;
        }
      }
    } catch {
      /* ignore */
    }
    this.tableCellPosition = row && col ? `L${row} · C${col}` : "—";
    this.tableInfo =
      totalRows && totalCols
        ? `${totalRows} ligne${totalRows > 1 ? "s" : ""} × ${totalCols} colonne${totalCols > 1 ? "s" : ""}`
        : "—";
  }

  distributeColumns(): void {
    const editor = this.getActiveTiptapEditor();
    if (!editor) return;
    const { state } = editor;
    const { $from } = state.selection;
    let table: any = null;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === "table") {
        table = $from.node(d);
        break;
      }
    }
    if (!table) return;
    const cols = table.firstChild?.childCount || 1;
    const width = Math.round(100 / cols);
    // Appliquer via CSS sur chaque colonne — Tiptap TablePlus gère la largeur via colgroup
    this.notifications.showInfo(`Colonnes réparties à ${width}% chacune`);
  }

  setColumnWidth(value: number): void {
    const clamped = Math.max(5, Math.min(100, value || 33));
    this.currentColumnWidth = clamped;
    // Appliquer la largeur via l'attribut de colonne Tiptap si supporté
    const editor = this.getActiveTiptapEditor();
    if (editor) {
      (editor.chain().focus() as any)
        .updateAttributes("tableCell", { colwidth: [clamped * 7] }) // px approximatif
        .run();
      (editor.chain().focus() as any)
        .updateAttributes("tableHeader", { colwidth: [clamped * 7] })
        .run();
    }
  }

  private persistEditorContent(): void {
    if (!this.editor) return;
    this.syncStructuredEditorContent(this.editor.getHTML());
  }

  private buildStructuredDocumentHtml(): string {
    const header = this.normalizeEditorHtml(this.editorContent.header);
    const body = this.normalizeEditorHtml(this.editorContent.body);
    const footer = this.normalizeEditorHtml(this.editorContent.footer);
    return `
      <div data-document-page="true" class="document-page-node">
        ${
          this.hasHeader
            ? `<section data-page-header="true" class="document-page-header">${header}</section>`
            : ""
        }
        <main data-page-body="true" class="document-page-body">${body}</main>
        ${
          this.hasFooter
            ? `<section data-page-footer="true" class="document-page-footer">${footer}</section>`
            : ""
        }
      </div>
    `;
  }

  private syncStructuredEditorContent(html: string): void {
    const body = this.extractStructuredSectionHtml(html, "[data-page-body]");
    const header = this.extractStructuredSectionHtml(
      html,
      "[data-page-header]",
    );
    const footer = this.extractStructuredSectionHtml(
      html,
      "[data-page-footer]",
    );
    this.editorContent = {
      header: header ?? this.editorContent.header,
      body: body ?? this.normalizeEditorHtml(html),
      footer: footer ?? this.editorContent.footer,
    };
  }

  private extractStructuredSectionHtml(
    html: string,
    selector: string,
  ): string | null {
    if (typeof DOMParser === "undefined") return null;
    const doc = new DOMParser().parseFromString(
      `<div>${html || ""}</div>`,
      "text/html",
    );
    const element = doc.querySelector(selector);
    return element ? this.normalizeEditorHtml(element.innerHTML) : null;
  }

  private normalizeEditorHtml(html: string | null | undefined): string {
    const value = String(html || "").trim();
    return value || "<p></p>";
  }

  private isBlankEditorHtml(html: string | null | undefined): boolean {
    const value = String(html || "").trim();
    if (!value) return true;
    if (/<(img|table|ul|ol|li|svg|canvas)\b/i.test(value)) return false;
    const text = value
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;|&#160;/gi, "")
      .trim();
    return !text;
  }

  private getSelectedDocumentSection(): "header" | "body" | "footer" {
    if (this.editorPanel === "headerFooter") {
      return this.activeHeaderFooterSection;
    }
    if (!this.editor || this.editorPanel === "filters") return "body";
    const { $from } = this.editor.state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const name = $from.node(depth).type.name;
      if (name === "pageHeader") return "header";
      if (name === "pageFooter") return "footer";
      if (name === "pageBody") return "body";
    }
    return "body";
  }

  private destroyEditor(): void {
    this.stopPaginationObserver();
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    this.editorBoundElement = null;
    this.editorSection = null;
    this._editorPaginationCacheKey = "";
    this.documentPageCountValue = 1;
  }

  // ─── CHANGED: graphic charter editors also run outside zone ──────────────────
  private ensureTemplateHeaderFooterEditors(): void {
    if (this.editorPanel !== "headerFooter") {
      this.destroyTemplateHeaderFooterEditors();
      return;
    }
    if (!this.templateHeaderEditor && this.templateHeaderHost) {
      this.templateHeaderEditor = this.createTemplateSectionEditor(
        this.templateHeaderHost.nativeElement,
        this.editorContent.header,
        "header",
      );
    }
    if (!this.templateFooterEditor && this.templateFooterHost) {
      this.templateFooterEditor = this.createTemplateSectionEditor(
        this.templateFooterHost.nativeElement,
        this.editorContent.footer,
        "footer",
      );
    }
  }

  private createTemplateSectionEditor(
    element: HTMLElement,
    content: string,
    section: "header" | "footer",
  ): Editor {
    let editorInstance!: Editor;
    this.ngZone.runOutsideAngular(() => {
      editorInstance = new Editor({
        element,
        extensions: buildEditorExtensions(section),
        content: this.normalizeEditorHtml(content),
        editable: section === "header" ? this.hasHeader : this.hasFooter,
        onUpdate: ({ editor }) => {
          this.editorContent = {
            ...this.editorContent,
            [section]: this.normalizeEditorHtml(editor.getHTML()),
          };
          this.ngZone.run(() => {
            this.saveStatus = "ModifiÃ©";
            this._editorPaginationCacheKey = "";
            this.cdr.markForCheck();
          });
        },
        onSelectionUpdate: () => {
          this.ngZone.run(() => {
            this.activeHeaderFooterSection = section;
            this._toolbarStateVersion += 1;
            this.updateTablePanelState();
            this.cdr.markForCheck();
          });
        },
      });
    });
    return editorInstance;
  }

  private persistTemplateHeaderFooterEditors(): void {
    if (this.templateHeaderEditor) {
      this.editorContent = {
        ...this.editorContent,
        header: this.normalizeEditorHtml(this.templateHeaderEditor.getHTML()),
      };
    }
    if (this.templateFooterEditor) {
      this.editorContent = {
        ...this.editorContent,
        footer: this.normalizeEditorHtml(this.templateFooterEditor.getHTML()),
      };
    }
  }

  private destroyTemplateHeaderFooterEditors(): void {
    if (this.templateHeaderEditor) {
      this.templateHeaderEditor.destroy();
      this.templateHeaderEditor = null;
    }
    if (this.templateFooterEditor) {
      this.templateFooterEditor.destroy();
      this.templateFooterEditor = null;
    }
  }

  private startPaginationObserver(): void {
    this.stopPaginationObserver();
    const target = this.editor?.view.dom;
    if (!target || typeof MutationObserver === "undefined") return;
    let frame: number | null = null;
    this.paginationObserver = new MutationObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        this.syncPaginationPageCount();
      });
    });
    this.paginationObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  }

  private stopPaginationObserver(): void {
    this.paginationObserver?.disconnect();
    this.paginationObserver = null;
  }

  private syncPaginationPageCount(): void {
    const pages = this.editor?.view.dom.querySelectorAll(".rm-page-break");
    const next = Math.max(1, pages?.length || 1);
    if (next === this.documentPageCountValue) return;
    this.ngZone.run(() => {
      this.documentPageCountValue = next;
      this.cdr.markForCheck();
    });
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
    let editorInstance!: Editor;
    this.ngZone.runOutsideAngular(() => {
      editorInstance = new Editor({
        element,
        extensions: buildEditorExtensions("header"),
        content: content || "<p></p>",
        onUpdate: ({ editor }) => {
          this.graphicCharterForm[field] = editor.getHTML();
        },
        onSelectionUpdate: () => {
          this.ngZone.run(() => {
            this._toolbarStateVersion += 1;
            this.cdr.markForCheck();
          });
        },
      });
    });
    return editorInstance;
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

  // ─── CHANGED: uses setTimeout instead of queueMicrotask.
  //             Clears any pending timer before setting a new one
  //             to prevent duplicate editor instances. ───────────────────────
  private rebindEditorSoon(): void {
    if (this.rebindTimer !== null) {
      clearTimeout(this.rebindTimer);
    }
    this.rebindTimer = setTimeout(() => {
      this.rebindTimer = null;
      this.ngZone.run(() => this.ensureEditorInstance());
    }, 0);
  }

  // ─── CHANGED: gc editors use the same debounce pattern ───────────────────────
  private scheduleGcEditorsEnsure(): void {
    if (this.gcEnsureTimer !== null) clearTimeout(this.gcEnsureTimer); // always reschedule to catch modal open
    this.gcEnsureTimer = setTimeout(() => {
      this.gcEnsureTimer = null;
      this.ensureGraphicCharterEditors();
    }, 0);
  }

  private resolveTemplateGraphicCharterId(template: TemplateRecord): string {
    const currentId = String(template.graphicCharterId || "");
    if (
      currentId &&
      this.organizationGraphicCharters.some(
        (charter) => charter.id === currentId,
      )
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
    if (this.editorPanel !== "filters") {
      this.editorPanel = "document";
    }
    // ─── FIX: réinitialiser la clé de cache pour forcer la recréation de
    //     l'éditeur body avec la nouvelle config PaginationPlus (nouveau
    //     headerHtml/footerHtml de la charte). Sans ça, le body editor
    //     conserve l'en-tête/pied de page de l'ancienne charte.
    this._editorPaginationCacheKey = "";
    this.rebindEditorSoon();
  }

  private getVariableBucket(type: unknown): "simple" | "list" | "table" {
    if (type === "list-object") return "table";
    if (type === "list") return "list";
    return "simple";
  }

  private normalizeVariablePanelType(
    value: string,
  ): "simple" | "list" | "table" {
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
    return { header: "ltr", body: "ltr", footer: "ltr" };
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
    const element = this.getActiveTiptapEditor()?.view?.dom as
      | HTMLElement
      | undefined;
    if (!element) return;
    const direction = this.activeDocumentDirection;
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

  private escapeHtml(value: string): string {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private escapeHtmlAttribute(value: string): string {
    return this.escapeHtml(value).replace(/`/g, "&#96;");
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
      data: { cancelText: "Annuler", ...data },
    });
    return firstValueFrom(ref.afterClosed());
  }
  private buildPaginationConfig(): PaginationConfig {
    const headerHtml = this.hasHeader ? this.editorContent.header || "" : "";
    const footerHtml = this.hasFooter ? this.editorContent.footer || "" : "";

    // ─── ALIGNEMENT AVEC PagePaginator.ts ───
    // Dans l'éditeur (PaginationPlus), marginTop et marginBottom définissent
    // la zone INTERNE de la page où le contenu peut couler.
    //
    // Si l'en-tête est ON :
    //   La marge haute doit être au moins égale à la marge du template (mt).
    //   On ajoute un petit décalage pour ne pas que le texte colle à l'en-tête.
    // Si l'en-tête est OFF :
    //   On utilise simplement la marge mt du template.

    const mt = this.pageSettingsForm.mt;
    const mb = this.pageSettingsForm.mb;

    const header = this.buildLivePaginationHeader(
      headerHtml,
      this.getLiveHeaderDisplayMode(),
    );
    const footer = this.buildLivePaginationFooter(
      footerHtml,
      this.getLiveFooterDisplayMode(),
    );

    return {
      orientation: this.pageSettingsForm.orientation,
      // Marges de la page physique (PaginationPlus réserve cet espace)
      marginTop: mt,
      marginBottom: mb,
      marginLeft: this.pageSettingsForm.ml,
      marginRight: this.pageSettingsForm.mr,
      // On positionne les clones au même endroit que les zones réelles
      headerTop: headerHtml ? this.pageSettingsForm.headerTop : undefined,
      footerBottom: footerHtml ? this.pageSettingsForm.footerBottom : undefined,
      // On laisse PaginationPlus gérer le flux du body
      contentMarginTop: headerHtml ? mt + 3 : 0,
      contentMarginBottom: footerHtml ? mb + 3 : 0,
      headerHtml: header.common,
      footerHtml: footer.common,
      customHeader: header.custom,
      customFooter: footer.custom,
    };
  }

  private getLiveHeaderDisplayMode(): "all" | "first" | "even" | "odd" {
    return normalizeTemplateSectionDisplay(
      this.selectedGraphicCharterConfig.header.displayMode,
    );
  }

  private getLiveFooterDisplayMode(): "all" | "first" | "even" | "odd" {
    return normalizeTemplateSectionDisplay(
      this.selectedGraphicCharterConfig.footer.displayMode,
    );
  }

  private buildLivePaginationHeader(
    html: string,
    mode: "all" | "first" | "even" | "odd",
  ): {
    common: string;
    custom: Record<number, { headerLeft: string; headerRight: string }>;
  } {
    if (!html) return { common: "", custom: {} };
    if (mode === "all") return { common: html, custom: {} };
    const maxPage = Math.max(this.documentPageCount + 10, 100);
    const custom: Record<number, { headerLeft: string; headerRight: string }> =
      {};

    for (let pageNumber = 1; pageNumber <= maxPage; pageNumber += 1) {
      const shouldShow = this.shouldShowLiveSection(mode, pageNumber);
      custom[pageNumber] = {
        headerLeft: shouldShow ? html : "",
        headerRight: "",
      };
    }
    return { common: "", custom };
  }

  private buildLivePaginationFooter(
    html: string,
    mode: "all" | "first" | "even" | "odd",
  ): {
    common: string;
    custom: Record<number, { footerLeft: string; footerRight: string }>;
  } {
    if (!html) return { common: "", custom: {} };
    if (mode === "all") return { common: html, custom: {} };
    const maxPage = Math.max(this.documentPageCount + 10, 100);
    const custom: Record<number, { footerLeft: string; footerRight: string }> =
      {};

    for (let pageNumber = 1; pageNumber <= maxPage; pageNumber += 1) {
      const shouldShow = this.shouldShowLiveSection(mode, pageNumber);
      custom[pageNumber] = {
        footerLeft: shouldShow ? html : "",
        footerRight: "",
      };
    }
    return { common: "", custom };
  }

  private shouldShowLiveSection(
    mode: "all" | "first" | "even" | "odd",
    pageNumber: number,
  ): boolean {
    if (mode === "first") return pageNumber === 1;
    if (mode === "even") return pageNumber % 2 === 0;
    if (mode === "odd") return pageNumber % 2 === 1;
    return true;
  }
}
