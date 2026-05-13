import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
} from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatSortModule, Sort } from "@angular/material/sort";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatNativeDateModule } from "@angular/material/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDialogModule, MatDialog } from "@angular/material/dialog";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { DocumentService } from "../../services/document.service";
import { FamilyService } from "../../services/family.service";
import { OrganizationService } from "../../services/organization.service";
import { DocumentRecord, DocumentListItem } from "../../models/document.model";
import { FamilyRecord } from "../../models/family.model";
import { DocumentViewerDialogComponent } from "../../components/document-viewer-dialog/document-viewer-dialog.component";

@Component({
  selector: "app-document-history-page",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: "./document-history-page.component.html",
  styleUrls: ["./document-history-page.component.scss"],
})
export class DocumentHistoryPageComponent implements OnInit {
  // Data
  documents: DocumentListItem[] = [];
  families: FamilyRecord[] = [];

  // Display control
  displayedColumns: string[] = [
    "title",
    "family",
    "beneficiary",
    "generatedBy",
    "generatedAt",
    "actions",
  ];
  loading = false;
  organizationName = "";

  // Pagination
  pageSize = 10;
  pageIndex = 0;
  totalDocuments = 0;

  // Filters
  filterForm: FormGroup;
  sortBy = "generatedAt";
  sortOrder: "asc" | "desc" = "desc";

  constructor(
    private documentService: DocumentService,
    private familyService: FamilyService,
    private organizationService: OrganizationService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    private formBuilder: FormBuilder,
  ) {
    this.filterForm = this.formBuilder.group({
      familyId: [""],
      beneficiaryTable: [""],
      beneficiaryId: [""],
      dateFrom: [""],
      dateTo: [""],
      generatedById: [""],
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      this.loadOrganization();
      this.loadFamilies();
      await this.loadDocuments();
    } catch (error) {
      console.error("Error initializing document history page", error);
      this.notificationService.showError(
        "Erreur lors du chargement des données",
      );
    } finally {
      this.loading = false;
    }
  }

  private loadOrganization(): void {
    const user = this.authService.getCurrentUser();
    if (user?.organizationId) {
      const organization = this.organizationService.getOrganization(
        user.organizationId,
      );
      this.organizationName = organization?.nom || organization?.name || "";
    }
  }

  private loadFamilies(): void {
    try {
      this.families = this.familyService.getFamilies();
    } catch (error) {
      console.error("Error loading families", error);
    }
  }

  async loadDocuments(): Promise<void> {
    this.loading = true;
    try {
      const filters = this.filterForm.value;
      const params: any = {
        page: this.pageIndex + 1,
        limit: this.pageSize,
        sortBy: this.sortBy,
        sortOrder: this.sortOrder,
      };

      // Add optional filters
      if (filters.familyId) params.familyId = filters.familyId;
      if (filters.beneficiaryTable)
        params.beneficiaryTable = filters.beneficiaryTable;
      if (filters.beneficiaryId) params.beneficiaryId = filters.beneficiaryId;

      const response = await this.documentService.getDocumentsPaged(params);
      this.documents = response.data;
      this.totalDocuments = response.total;
    } catch (error) {
      console.error("Error loading documents", error);
      this.notificationService.showError(
        "Erreur lors du chargement des documents",
      );
    } finally {
      this.loading = false;
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadDocuments();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || "generatedAt";
    this.sortOrder = (sort.direction as "asc" | "desc") || "desc";
    this.pageIndex = 0; // Reset to first page
    this.loadDocuments();
  }

  onFilterChange(): void {
    this.pageIndex = 0; // Reset to first page when filter changes
    this.loadDocuments();
  }

  resetFilters(): void {
    this.filterForm.reset();
    this.pageIndex = 0;
    this.sortBy = "generatedAt";
    this.sortOrder = "desc";
    this.loadDocuments();
  }

  viewDocument(document: DocumentListItem): void {
    // Fetch full document first
    this.documentService.getDocumentById(document.id).then((fullDoc) => {
      if (fullDoc) {
        this.dialog.open(DocumentViewerDialogComponent, {
          width: "90%",
          height: "90%",
          data: { document: fullDoc },
        });
      }
    });
  }

  async deleteDocument(document: DocumentListItem): Promise<void> {
    const confirmed = confirm(
      `Êtes-vous sûr de vouloir supprimer le document "${document.title}" ?`,
    );
    if (!confirmed) return;

    try {
      await this.documentService.deleteDocument(document.id);
      this.notificationService.showSuccess("Document supprimé avec succès");
      this.loadDocuments();
    } catch (error) {
      console.error("Error deleting document", error);
      this.notificationService.showError(
        "Erreur lors de la suppression du document",
      );
    }
  }

  downloadDocument(document: DocumentListItem): void {
    // Fetch full document first to get HTML content
    this.documentService.getDocumentById(document.id).then((fullDoc) => {
      if (fullDoc && fullDoc.fullHtml) {
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
      }
    });
  }

  getFamilyName(familyId: string | undefined): string {
    if (!familyId) return "-";
    const family = this.families.find((f) => f.id === familyId);
    return family?.nom ?? familyId ?? "-";
  }

  getBeneficiaryDisplay(document: DocumentRecord): string {
    const parts = [];
    if (document.beneficiaryDisplayValue1) {
      parts.push(document.beneficiaryDisplayValue1);
    }
    if (document.beneficiaryDisplayValue2) {
      parts.push(document.beneficiaryDisplayValue2);
    }
    return parts.length > 0 ? parts.join(" - ") : document.beneficiaryId || "-";
  }

  goBack(): void {
    window.history.back();
  }

  logout(): void {
    this.authService.logout();
  }
}
