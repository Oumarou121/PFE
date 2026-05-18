import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { DocumentListItem } from "../../models/document.model";
import { FamilyRecord } from "../../models/family.model";
import { DocumentService } from "../../services/document.service";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { OrganizationService } from "../../services/organization.service";
import {
  DocumentArchiveGroupingService,
  TableDocumentGroup,
} from "./document-archive-grouping.service";
import { UserMenuComponent } from "../../../../shared/components/user-menu/user-menu.component";
import { ActiveAcademicYearPillComponent } from "../../../../shared/components/active-academic-year-pill/active-academic-year-pill.component";

@Component({
  selector: "app-document-archive-page",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UserMenuComponent,
    ActiveAcademicYearPillComponent,
  ],
  templateUrl: "./document-archive-page.component.html",
  styleUrls: ["./document-archive-page.component.scss"],
})
export class DocumentArchivePageComponent implements OnInit {
  documents: DocumentListItem[] = [];
  tableGroups: TableDocumentGroup[] = [];
  families: FamilyRecord[] = [];
  generatorOptions: Array<{ id: string; label: string }> = [];
  beneficiaryOptions: Array<{ key: string; label: string }> = [];
  organizationName = "";
  loading = false;

  filterForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService,
    private editorState: EditorStateService,
    private familyService: FamilyService,
    private organizationService: OrganizationService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private formBuilder: FormBuilder,
    private grouping: DocumentArchiveGroupingService,
  ) {
    this.filterForm = this.formBuilder.group({
      familyId: [""],
      generatedById: [""],
      beneficiaryKey: [""],
      query: [""],
      dateFrom: [""],
      dateTo: [""],
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await this.editorState.loadBootstrap();
      this.loadOrganization();
      this.loadFamilies();
      this.readQueryParams();
      await this.loadDocuments();
    } catch (error) {
      console.error("Error initializing document archive page", error);
      this.notificationService.showError(
        "Erreur lors du chargement des données",
      );
    } finally {
      this.loading = false;
    }
  }

  async loadDocuments(): Promise<void> {
    this.loading = true;
    try {
      const filters = this.filterForm.value;
      const response = await this.documentService.getDocumentsPaged({
        page: 1,
        familyId: filters.familyId || undefined,
        generatedById:
          this.isAdminArchive && filters.generatedById
            ? filters.generatedById
            : undefined,
        sortBy: "generatedAt",
        sortOrder: "desc",
      });
      this.updateGeneratorOptions(response.data || []);
      this.updateBeneficiaryOptions(response.data || []);
      this.documents = this.applyClientFilters(response.data || []);
      this.tableGroups = this.grouping.buildTableGroups(
        this.documents,
        this.families,
      );
      this.syncQueryParams();
    } catch (error) {
      console.error("Error loading archives", error);
      this.notificationService.showError(
        "Erreur lors du chargement des archives",
      );
    } finally {
      this.loading = false;
    }
  }

  onFilterChange(): void {
    void this.loadDocuments();
  }

  resetFilters(): void {
    this.filterForm.reset({
      familyId: "",
      generatedById: "",
      beneficiaryKey: "",
      query: "",
      dateFrom: "",
      dateTo: "",
    });
    void this.loadDocuments();
  }

  openGroup(group: TableDocumentGroup): void {
    this.router.navigate(["/archives/group", group.key], {
      queryParams: this.getFilterQueryParams(),
    });
  }

  getFamilyName(familyId: string | undefined): string {
    if (!familyId) return "-";
    const family = this.families.find((f) => f.id === familyId);
    return family?.nom || family?.name || "-";
  }

  getFamilyNames(familyIds: string[]): string {
    return familyIds.map((id) => this.getFamilyName(id)).join(", ");
  }

  getGroupSubtitle(group: TableDocumentGroup): string {
    if (group.isOrganization) return "Organisation";
    return group.tableName || "Table bénéficiaire";
  }

  goBack(): void {
    this.router.navigate(["/admin"], {});
  }

  logout(): void {
    this.authService.logout();
  }

  get isAdminArchive(): boolean {
    const role = this.authService.getCurrentUser()?.role;
    return role === "admin" || role === "supAdmin";
  }

  private readQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    this.filterForm.patchValue({
      familyId: params.get("familyId") || "",
      generatedById: params.get("generatedById") || "",
      beneficiaryKey: params.get("beneficiaryKey") || "",
      query: params.get("query") || "",
      dateFrom: params.get("dateFrom") || "",
      dateTo: params.get("dateTo") || "",
    });
  }

  private loadOrganization(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.organizationId) return;
    const organization = this.organizationService.getOrganization(
      user.organizationId,
    );
    this.organizationName = organization?.nom || organization?.name || "";
  }

  private loadFamilies(): void {
    try {
      this.families = this.familyService.getFamilies();
    } catch (error) {
      console.error("Error loading families", error);
    }
  }

  private applyClientFilters(rows: DocumentListItem[]): DocumentListItem[] {
    const { query, dateFrom, dateTo, beneficiaryKey } = this.filterForm.value;
    const search = String(query || "")
      .trim()
      .toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);

    return rows.filter((doc) => {
      const generatedAt = this.getDocumentDate(doc.generatedAt);
      if (from && generatedAt && generatedAt < from) return false;
      if (to && generatedAt && generatedAt > to) return false;
      if (beneficiaryKey && this.getBeneficiaryKey(doc) !== beneficiaryKey) {
        return false;
      }
      if (!search) return true;
      return [
        doc.title,
        doc.familyId,
        doc.beneficiaryId,
        doc.beneficiaryTable,
        doc.beneficiaryTableLabel,
        doc.beneficiaryDisplayValue1,
        doc.beneficiaryDisplayValue2,
        doc.generatedByName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }

  private updateGeneratorOptions(rows: DocumentListItem[]): void {
    const options = new Map<string, string>();
    for (const row of rows) {
      if (!row.generatedById) continue;
      options.set(
        row.generatedById,
        row.generatedByName || row.generatedByEmail || row.generatedById,
      );
    }
    const selected = this.filterForm.value.generatedById;
    if (selected && !options.has(selected)) {
      options.set(selected, selected);
    }
    this.generatorOptions = Array.from(options.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private updateBeneficiaryOptions(rows: DocumentListItem[]): void {
    const options = new Map<string, string>();
    for (const row of rows) {
      const key = this.getBeneficiaryKey(row);
      if (!key) continue;
      options.set(key, this.getBeneficiaryLabel(row));
    }
    const selected = this.filterForm.value.beneficiaryKey;
    if (selected && !options.has(selected)) {
      options.set(selected, selected);
    }
    this.beneficiaryOptions = Array.from(options.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private getBeneficiaryKey(row: DocumentListItem): string {
    return String(row.beneficiaryId || "__without_beneficiary__");
  }

  private getBeneficiaryLabel(row: DocumentListItem): string {
    return (
      [row.beneficiaryDisplayValue1, row.beneficiaryDisplayValue2]
        .filter((value) => !!String(value || "").trim())
        .join(" - ") ||
      row.beneficiaryId ||
      "Beneficiaire non renseigne"
    );
  }

  private getDocumentDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private syncQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.getFilterQueryParams(),
      replaceUrl: true,
    });
  }

  private getFilterQueryParams(): Record<string, string | null> {
    const filters = this.filterForm.value;
    return {
      familyId: filters.familyId || null,
      generatedById:
        this.isAdminArchive && filters.generatedById
          ? filters.generatedById
          : null,
      beneficiaryKey: filters.beneficiaryKey || null,
      query: filters.query || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    };
  }
}
