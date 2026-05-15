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

@Component({
  selector: "app-document-archive-page",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UserMenuComponent],
  templateUrl: "./document-archive-page.component.html",
  styleUrls: ["./document-archive-page.component.scss"],
})
export class DocumentArchivePageComponent implements OnInit {
  documents: DocumentListItem[] = [];
  tableGroups: TableDocumentGroup[] = [];
  families: FamilyRecord[] = [];
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
        limit: 1000,
        familyId: filters.familyId || undefined,
        sortBy: "generatedAt",
        sortOrder: "desc",
      });
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
    return family?.nom || family?.name || familyId || "-";
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

  private readQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    this.filterForm.patchValue({
      familyId: params.get("familyId") || "",
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
    const { query, dateFrom, dateTo } = this.filterForm.value;
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
      query: filters.query || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    };
  }
}
