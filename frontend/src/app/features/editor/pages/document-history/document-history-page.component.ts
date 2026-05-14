import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatNativeDateModule } from "@angular/material/core";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { DocumentService } from "../../services/document.service";
import { FamilyService } from "../../services/family.service";
import { OrganizationService } from "../../services/organization.service";
import { DocumentListItem } from "../../models/document.model";
import { FamilyRecord } from "../../models/family.model";
import { DocumentViewerDialogComponent } from "../../components/document-viewer-dialog/document-viewer-dialog.component";

interface BeneficiaryDocumentGroup {
  key: string;
  beneficiaryId: string | null;
  title: string;
  subtitle: string;
  documents: DocumentListItem[];
  familyIds: string[];
}

interface TableDocumentGroup {
  key: string;
  tableName: string | null;
  label: string;
  isOrganization: boolean;
  documents: DocumentListItem[];
  beneficiaries: BeneficiaryDocumentGroup[];
  familyIds: string[];
}

@Component({
  selector: "app-document-history-page",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: "./document-history-page.component.html",
  styleUrls: ["./document-history-page.component.scss"],
})
export class DocumentHistoryPageComponent implements OnInit {
  documents: DocumentListItem[] = [];
  tableGroups: TableDocumentGroup[] = [];
  families: FamilyRecord[] = [];
  organizationName = "";
  loading = false;
  totalDocuments = 0;
  expandedTableKey: string | null = null;
  selectedBeneficiaryKey: string | null = null;
  selectedTableGroup: TableDocumentGroup | null = null;
  selectedBeneficiaryGroup: BeneficiaryDocumentGroup | null = null;

  filterForm: FormGroup;

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
      query: [""],
      dateFrom: [""],
      dateTo: [""],
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
      this.notificationService.showError("Erreur lors du chargement des donnees");
    } finally {
      this.loading = false;
    }
  }

  private loadOrganization(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.organizationId) return;
    const organization = this.organizationService.getOrganization(user.organizationId);
    this.organizationName = organization?.nom || organization?.name || "";
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
      const response = await this.documentService.getDocumentsPaged({
        page: 1,
        limit: 500,
        familyId: filters.familyId || undefined,
        sortBy: "generatedAt",
        sortOrder: "desc",
      });
      this.documents = this.applyClientFilters(response.data || []);
      this.totalDocuments = this.documents.length;
      this.tableGroups = this.buildTableGroups(this.documents);
      this.syncSelection();
    } catch (error) {
      console.error("Error loading documents", error);
      this.notificationService.showError("Erreur lors du chargement des documents");
    } finally {
      this.loading = false;
    }
  }

  onFilterChange(): void {
    void this.loadDocuments();
  }

  resetFilters(): void {
    this.filterForm.reset({ familyId: "", query: "", dateFrom: "", dateTo: "" });
    void this.loadDocuments();
  }

  toggleTableGroup(group: TableDocumentGroup): void {
    this.expandedTableKey = this.expandedTableKey === group.key ? null : group.key;
    this.selectedTableGroup = this.expandedTableKey ? group : null;
    if (group.isOrganization) {
      this.selectedBeneficiaryKey = null;
      this.selectedBeneficiaryGroup = null;
      return;
    }
    const first = group.beneficiaries[0] || null;
    this.selectedBeneficiaryKey = first?.key || null;
    this.selectedBeneficiaryGroup = first;
  }

  selectBeneficiary(group: TableDocumentGroup, beneficiary: BeneficiaryDocumentGroup): void {
    this.expandedTableKey = group.key;
    this.selectedTableGroup = group;
    this.selectedBeneficiaryKey = beneficiary.key;
    this.selectedBeneficiaryGroup = beneficiary;
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
      this.notificationService.showSuccess("Document supprime avec succes");
      await this.loadDocuments();
    } catch (error) {
      console.error("Error deleting document", error);
      this.notificationService.showError("Erreur lors de la suppression du document");
    }
  }

  downloadDocument(document: DocumentListItem): void {
    this.documentService.getDocumentById(document.id).then((fullDoc) => {
      if (!fullDoc?.fullHtml) return;
      const blob = new Blob([fullDoc.fullHtml], { type: "text/html;charset=utf-8;" });
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

  goBack(): void {
    window.history.back();
  }

  logout(): void {
    this.authService.logout();
  }

  private applyClientFilters(rows: DocumentListItem[]): DocumentListItem[] {
    const { query, dateFrom, dateTo } = this.filterForm.value;
    const search = String(query || "").trim().toLowerCase();
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

  private buildTableGroups(rows: DocumentListItem[]): TableDocumentGroup[] {
    const map = new Map<string, TableDocumentGroup>();
    for (const document of rows) {
      const hasTable = !!String(document.beneficiaryTable || "").trim();
      const key = hasTable ? String(document.beneficiaryTable) : "__organization__";
      const tableGroup =
        map.get(key) ||
        {
          key,
          tableName: hasTable ? String(document.beneficiaryTable) : null,
          label: hasTable
            ? this.getBeneficiaryTableLabel(document)
            : "Documents lies a l'organisation",
          isOrganization: !hasTable,
          documents: [],
          beneficiaries: [],
          familyIds: [],
        };
      tableGroup.documents.push(document);
      tableGroup.familyIds = this.uniqueValues([...tableGroup.familyIds, document.familyId]);
      map.set(key, tableGroup);
    }

    const groups = [...map.values()].map((group) => ({
      ...group,
      beneficiaries: group.isOrganization ? [] : this.buildBeneficiaryGroups(group.documents),
    }));
    return groups.sort((a, b) => Number(a.isOrganization) - Number(b.isOrganization) || a.label.localeCompare(b.label));
  }

  private buildBeneficiaryGroups(rows: DocumentListItem[]): BeneficiaryDocumentGroup[] {
    const map = new Map<string, BeneficiaryDocumentGroup>();
    for (const document of rows) {
      const key = String(document.beneficiaryId || "__without_beneficiary__");
      const group =
        map.get(key) ||
        {
          key,
          beneficiaryId: document.beneficiaryId || null,
          title: this.getBeneficiaryTitle(document),
          subtitle: document.beneficiaryId ? `ID ${document.beneficiaryId}` : "Beneficiaire non renseigne",
          documents: [],
          familyIds: [],
        };
      group.documents.push(document);
      group.familyIds = this.uniqueValues([...group.familyIds, document.familyId]);
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  private syncSelection(): void {
    if (!this.tableGroups.length) {
      this.expandedTableKey = null;
      this.selectedTableGroup = null;
      this.selectedBeneficiaryKey = null;
      this.selectedBeneficiaryGroup = null;
      return;
    }
    const table =
      this.tableGroups.find((group) => group.key === this.expandedTableKey) ||
      this.tableGroups[0];
    this.expandedTableKey = table.key;
    this.selectedTableGroup = table;
    if (table.isOrganization) {
      this.selectedBeneficiaryKey = null;
      this.selectedBeneficiaryGroup = null;
      return;
    }
    const beneficiary =
      table.beneficiaries.find((item) => item.key === this.selectedBeneficiaryKey) ||
      table.beneficiaries[0] ||
      null;
    this.selectedBeneficiaryKey = beneficiary?.key || null;
    this.selectedBeneficiaryGroup = beneficiary;
  }

  private getBeneficiaryTableLabel(document: DocumentListItem): string {
    return (
      document.beneficiaryTableLabel ||
      this.families.find((family) => family.id === document.familyId)?.beneficiaryTableLabel ||
      document.beneficiaryTable ||
      "Table beneficiaire"
    );
  }

  private getBeneficiaryTitle(document: DocumentListItem): string {
    const title = [document.beneficiaryDisplayValue1, document.beneficiaryDisplayValue2]
      .filter((value) => !!String(value || "").trim())
      .join(" - ");
    return title || document.beneficiaryId || "Beneficiaire";
  }

  private uniqueValues(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => !!value))];
  }
}
