import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { DocumentViewerDialogComponent } from "../../components/document-viewer-dialog/document-viewer-dialog.component";
import { DocumentListItem } from "../../models/document.model";
import { FamilyRecord } from "../../models/family.model";
import { DocumentService } from "../../services/document.service";
import { EditorStateService } from "../../services/editor-state.service";
import { FamilyService } from "../../services/family.service";
import { OrganizationService } from "../../services/organization.service";
import {
  BeneficiaryDocumentGroup,
  DocumentHistoryGroupingService,
  ORGANIZATION_DOCUMENT_GROUP_KEY,
  TableDocumentGroup,
} from "./document-history-grouping.service";

@Component({
  selector: "app-document-history-detail-page",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: "./document-history-detail-page.component.html",
  styleUrls: ["./document-history-detail-page.component.scss"],
})
export class DocumentHistoryDetailPageComponent implements OnInit {
  documents: DocumentListItem[] = [];
  families: FamilyRecord[] = [];
  activeGroup: TableDocumentGroup | null = null;
  beneficiaryGroups: BeneficiaryDocumentGroup[] = [];
  selectedBeneficiaryKey: string | null = null;
  organizationName = "";
  groupKey = ORGANIZATION_DOCUMENT_GROUP_KEY;
  loading = false;
  page = 1;
  pageSize = 10;

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
    private dialog: MatDialog,
    private formBuilder: FormBuilder,
    private grouping: DocumentHistoryGroupingService,
  ) {
    this.filterForm = this.formBuilder.group({
      familyId: [""],
      query: [""],
      dateFrom: [""],
      dateTo: [""],
      pageSize: [10],
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await this.editorState.loadBootstrap();
      this.loadOrganization();
      this.loadFamilies();
      this.readRouteState();
      await this.loadDocuments();
    } catch (error) {
      console.error("Error initializing document history detail page", error);
      this.notificationService.showError(
        "Erreur lors du chargement des documents",
      );
    } finally {
      this.loading = false;
    }
  }

  get isOrganizationGroup(): boolean {
    return this.groupKey === ORGANIZATION_DOCUMENT_GROUP_KEY;
  }

  get selectedBeneficiaryGroup(): BeneficiaryDocumentGroup | null {
    if (!this.selectedBeneficiaryKey) return null;
    return (
      this.beneficiaryGroups.find(
        (item) => item.key === this.selectedBeneficiaryKey,
      ) || null
    );
  }

  get visibleDocuments(): DocumentListItem[] {
    const source = this.isOrganizationGroup
      ? this.activeGroup?.documents || []
      : this.selectedBeneficiaryGroup?.documents || [];
    return source;
  }

  get pagedDocuments(): DocumentListItem[] {
    const start = (this.page - 1) * this.pageSize;
    return this.visibleDocuments.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.visibleDocuments.length / this.pageSize));
  }

  get groupTitle(): string {
    if (this.activeGroup?.label) return this.activeGroup.label;
    return this.isOrganizationGroup
      ? "Documents liés à l'organisation"
      : this.groupKey;
  }

  async loadDocuments(): Promise<void> {
    this.loading = true;
    try {
      const filters = this.filterForm.value;
      const response = await this.documentService.getDocumentsPaged({
        page: 1,
        limit: 1000,
        familyId: filters.familyId || undefined,
        beneficiaryTable: this.isOrganizationGroup ? undefined : this.groupKey,
        sortBy: "generatedAt",
        sortOrder: "desc",
      });
      this.documents = this.applyClientFilters(
        this.applyGroupScope(response.data || []),
      );
      this.rebuildActiveGroup();
      this.page = 1;
      this.syncQueryParams();
    } catch (error) {
      console.error("Error loading documents", error);
      this.notificationService.showError(
        "Erreur lors du chargement des documents",
      );
    } finally {
      this.loading = false;
    }
  }

  onFilterChange(): void {
    this.pageSize = Number(this.filterForm.value.pageSize) || 10;
    void this.loadDocuments();
  }

  resetFilters(): void {
    this.filterForm.reset({
      familyId: "",
      query: "",
      dateFrom: "",
      dateTo: "",
      pageSize: 10,
    });
    this.pageSize = 10;
    void this.loadDocuments();
  }

  selectBeneficiary(beneficiary: BeneficiaryDocumentGroup): void {
    this.selectedBeneficiaryKey = beneficiary.key;
    this.page = 1;
    this.syncQueryParams();
  }

  goToPreviousPage(): void {
    if (this.page <= 1) return;
    this.page -= 1;
  }

  goToNextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page += 1;
  }

  viewDocument(document: DocumentListItem): void {
    this.documentService.getDocumentById(document.id).then((fullDoc) => {
      if (!fullDoc) return;
      this.dialog.open(DocumentViewerDialogComponent, {
        width: "90%",
        height: "90%",
        data: { document: fullDoc },
      });
    });
  }

  async deleteDocument(document: DocumentListItem): Promise<void> {
    const confirmed = confirm(`Supprimer le document "${document.title}" ?`);
    if (!confirmed) return;
    try {
      await this.documentService.deleteDocument(document.id);
      this.notificationService.showSuccess("Document supprimé avec succès");
      await this.loadDocuments();
    } catch (error) {
      console.error("Error deleting document", error);
      this.notificationService.showError(
        "Erreur lors de la suppression du document",
      );
    }
  }

  downloadDocument(document: DocumentListItem): void {
    this.documentService.getDocumentById(document.id).then((fullDoc) => {
      if (!fullDoc?.fullHtml) return;
      const blob = new Blob([fullDoc.fullHtml], {
        type: "text/html;charset=utf-8;",
      });
      const link = globalThis.document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${document.title}.html`);
      link.style.visibility = "hidden";
      globalThis.document.body.appendChild(link);
      link.click();
      globalThis.document.body.removeChild(link);
      URL.revokeObjectURL(url);
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

  getDocumentDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  goBackToModules(): void {
    this.router.navigate(["/documents"], {
      queryParams: this.getFilterQueryParams(),
    });
  }

  logout(): void {
    this.authService.logout();
  }

  private readRouteState(): void {
    this.groupKey =
      this.route.snapshot.paramMap.get("groupKey") ||
      ORGANIZATION_DOCUMENT_GROUP_KEY;
    const params = this.route.snapshot.queryParamMap;
    this.filterForm.patchValue({
      familyId: params.get("familyId") || "",
      query: params.get("query") || "",
      dateFrom: params.get("dateFrom") || "",
      dateTo: params.get("dateTo") || "",
      pageSize: Number(params.get("pageSize")) || 10,
    });
    this.pageSize = Number(this.filterForm.value.pageSize) || 10;
    this.selectedBeneficiaryKey = params.get("beneficiary") || null;
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

  private applyGroupScope(rows: DocumentListItem[]): DocumentListItem[] {
    return rows.filter((document) => {
      const table = String(document.beneficiaryTable || "").trim();
      return this.isOrganizationGroup ? !table : table === this.groupKey;
    });
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

  private rebuildActiveGroup(): void {
    const groups = this.grouping.buildTableGroups(this.documents, this.families);
    this.activeGroup =
      groups.find((group) => group.key === this.groupKey) || null;
    this.beneficiaryGroups = this.activeGroup?.beneficiaries || [];

    if (this.isOrganizationGroup) {
      this.selectedBeneficiaryKey = null;
      return;
    }

    const selectedStillExists = this.beneficiaryGroups.some(
      (item) => item.key === this.selectedBeneficiaryKey,
    );
    if (!selectedStillExists) {
      this.selectedBeneficiaryKey = this.beneficiaryGroups[0]?.key || null;
    }
  }

  private syncQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.getFilterQueryParams(),
        beneficiary: this.selectedBeneficiaryKey || null,
      },
      queryParamsHandling: "",
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
      pageSize: String(filters.pageSize || 10),
    };
  }
}
