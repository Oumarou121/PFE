import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { Subject, takeUntil } from "rxjs";
import * as XLSX from "xlsx";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { EditorStateService } from "../../services/editor-state.service";
import { OrganizationService } from "../../services/organization.service";
import { TableViewService } from "../../services/table-view.service";
import { TableFiltersComponent } from "../../components/table-filters/table-filters.component";
import { ModuleRecord } from "../../models/module.model";
import { TableViewConfig } from "../../models/table-view.model";
import { UserMenuComponent } from "../../../../shared/components/user-menu/user-menu.component";
import { ActiveAcademicYearPillComponent } from "../../../../shared/components/active-academic-year-pill/active-academic-year-pill.component";

@Component({
  selector: "app-admin-modules",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    TableFiltersComponent,
    UserMenuComponent,
    ActiveAcademicYearPillComponent,
  ],
  templateUrl: "./admin-modules.component.html",
  styleUrls: ["./admin-modules.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class AdminModulesComponent implements OnInit, OnDestroy {
  loading = true;
  organizationName = "";
  organizationDatabaseName: string | null = null;
  selectedModuleId: string | null = null;
  activeModuleTableViewId: string | null = null;
  dataViewSearch = "";
  dataRowSearch = "";
  dataRows: Record<string, any>[] = [];
  selectedDataRowId: string | null = null;
  selectedDataRecord: Record<string, any> | null = null;
  creatingDataRow = false;
  lookupOptions: Record<string, Array<{ value: string; label: string }>> = {};
  dataViewsLoading = false;
  dataRowsLoading = false;
  lookupLoading = false;
  dataSaving = false;
  dataDeleting = false;
  dataStatusMessage = "";
  selectedFilters: Record<string, string[]> = {};
  exportMode = false;
  selectedExportFields: string[] = [];
  selectedExportRowIds = new Set<string>();
  importMode = false;
  importing = false;
  importFileName = "";
  importHeaders: string[] = [];
  importRows: Record<string, string>[] = [];
  importFieldMappings: Record<string, string> = {};
  importUniqueFields: string[] = [];
  importDuplicateStrategy: "skip" | "update" = "skip";
  importProgress = {
    total: 0,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  @ViewChild("importFileInput") importFileInput?: ElementRef<HTMLInputElement>;
  private dataRowsRequestId = 0;
  private destroy$ = new Subject<void>();

  constructor(
    public router: Router,
    private auth: AuthService,
    private route: ActivatedRoute,
    private state: EditorStateService,
    private tableViews: TableViewService,
    private organizationsService: OrganizationService,
    private notifications: NotificationService,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await this.state.ensureResources([
        "organizations",
        "tableViews",
        "modules",
      ]);
      const user = this.auth.getCurrentUser();
      const organization = user?.organizationId
        ? this.organizationsService.getOrganization(user.organizationId)
        : this.organizationsService.getOrganizations()[0] || null;
      this.organizationName = organization?.nom || organization?.name || "";
      this.organizationDatabaseName = organization?.databaseName || null;

      this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
        const moduleId = params.get("moduleId");
        if (moduleId) {
          this.selectModule(moduleId);
          return;
        }
        if (!this.selectedModuleId && this.modulesList.length > 0) {
          this.selectModule(this.modulesList[0].id);
        }
      });

      if (!this.selectedModuleId && this.modulesList.length > 0) {
        this.selectModule(this.modulesList[0].id);
      }
    } catch {
      this.notifications.showError("Impossible de charger les modules.");
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get modulesList(): ModuleRecord[] {
    const search = this.dataViewSearch.trim().toLowerCase();
    const modules = (this.state.getState().modules || []) as ModuleRecord[];
    return modules.filter(
      (module) =>
        module.isActive &&
        (!search || module.name.toLowerCase().includes(search)),
    );
  }

  get selectedModule(): ModuleRecord | null {
    return this.selectedModuleId
      ? this.state
          .getState()
          .modules.find(
            (module: ModuleRecord) => module.id === this.selectedModuleId,
          ) || null
      : null;
  }

  get selectedDataView(): TableViewConfig | null {
    return this.activeModuleTableViewId
      ? this.tableViews.getTableView(this.activeModuleTableViewId)
      : null;
  }

  goBack(): void {
    this.router.navigate(["/admin"]);
  }

  logout(): void {
    this.auth.logout();
  }

  selectModule(moduleId: string): void {
    this.selectedModuleId = moduleId;
    const module = this.selectedModule;
    if (module && module.tableViews.length > 0) {
      const primary =
        module.tableViews.find((mtv) => mtv.isPrimary) || module.tableViews[0];
      this.selectModuleTableView(primary.tableViewConfigId);
      return;
    }
    this.activeModuleTableViewId = null;
    this.dataRows = [];
    this.selectedDataRowId = null;
    this.selectedDataRecord = null;
  }

  selectModuleTableView(tableViewId: string): void {
    this.activeModuleTableViewId = tableViewId;
    this.selectDataView(tableViewId);
  }

  async selectDataView(viewId: string): Promise<void> {
    if (
      this.dataRowsLoading ||
      this.lookupLoading ||
      this.dataSaving ||
      this.dataDeleting
    ) {
      return;
    }
    this.activeModuleTableViewId = viewId;
    this.selectedDataRowId = null;
    this.selectedDataRecord = null;
    this.creatingDataRow = false;
    this.dataRows = [];
    this.dataRowSearch = "";
    this.selectedFilters = {};
    await this.renderDataContent();
  }

  async renderDataContent(): Promise<void> {
    const view = this.selectedDataView;
    if (!view) return;
    this.lookupLoading = true;
    this.dataStatusMessage = "Chargement des listes de choix...";
    try {
      await this.ensureLookupOptions(view);
      await this.reloadDataRows();
    } catch {
      this.notifications.showError("Impossible de charger cette vue.");
    } finally {
      this.lookupLoading = false;
      this.dataStatusMessage = "";
    }
  }

  async reloadDataRows(): Promise<void> {
    const view = this.selectedDataView;
    if (!view) return;
    const requestId = ++this.dataRowsRequestId;
    this.dataRowsLoading = true;
    this.dataStatusMessage = "Chargement des lignes...";
    try {
      const rows = await this.tableViews.getTableViewRows(view.id, {
        config: view,
        search: this.dataRowSearch,
        selectedFilters: this.selectedFilters,
      });
      if (requestId !== this.dataRowsRequestId) return;
      this.dataRows = rows;
      if (this.exportMode) {
        this.syncExportSelections(view);
      }
      if (
        this.selectedDataRowId &&
        !this.dataRows.some(
          (row) => this.getDataRowId(view, row) === this.selectedDataRowId,
        )
      ) {
        this.selectedDataRowId = null;
        this.selectedDataRecord = null;
      }
      if (!this.selectedDataRowId && this.dataRows.length) {
        const firstRow = this.dataRows[0];
        this.selectedDataRowId = this.getDataRowId(view, firstRow);
        this.selectedDataRecord = { ...firstRow };
        this.creatingDataRow = false;
      }
    } catch {
      if (requestId === this.dataRowsRequestId) {
        this.notifications.showError("Impossible de charger les lignes.");
      }
    } finally {
      if (requestId === this.dataRowsRequestId) {
        this.dataRowsLoading = false;
        this.dataStatusMessage = "";
      }
    }
  }

  async updateDataSearch(): Promise<void> {
    await this.reloadDataRows();
  }

  async onFiltersChanged(filters: Record<string, string[]>): Promise<void> {
    this.selectedFilters = filters || {};
    await this.reloadDataRows();
  }

  toggleExportMode(): void {
    const view = this.selectedDataView;
    if (!view) return;

    this.exportMode = !this.exportMode;
    if (this.exportMode) {
      this.selectedExportFields = [...view.visibleFields];
      this.syncExportSelections(view);
      return;
    }

    this.selectedExportFields = [];
    this.selectedExportRowIds.clear();
  }

  openImportMode(): void {
    const view = this.selectedDataView;
    if (!view) return;

    this.resetImportState();
    this.importMode = true;
    queueMicrotask(() => this.importFileInput?.nativeElement.click());
  }

  cancelImportMode(): void {
    this.resetImportState();
  }

  async handleImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = "";
    if (!file) return;

    const view = this.selectedDataView;
    if (!view) return;

    this.importing = true;
    this.importFileName = file.name;
    try {
      const workbook = await this.readWorkbook(file);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Aucune feuille trouvée dans le fichier.");
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
      });
      if (!rows.length) {
        throw new Error("Le fichier ne contient aucune ligne exploitable.");
      }

      this.importHeaders = Object.keys(rows[0] || {});
      this.importRows = rows.map((row) => {
        const normalizedRow: Record<string, string> = {};
        this.importHeaders.forEach((header) => {
          normalizedRow[header] = String(row[header] ?? "").trim();
        });
        return normalizedRow;
      });

      this.importFieldMappings = this.buildDefaultImportMappings(
        view,
        this.importHeaders,
      );
      this.importUniqueFields =
        view.editableFields.length > 0
          ? [view.editableFields[0]]
          : view.visibleFields.length > 0
            ? [view.visibleFields[0]]
            : [];
      this.importProgress = {
        total: this.importRows.length,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      };
      this.importMode = true;
    } catch (error: any) {
      this.notifications.showError(
        error?.message || "Impossible de lire le fichier Excel.",
      );
      this.resetImportState();
    } finally {
      this.importing = false;
    }
  }

  async runImport(): Promise<void> {
    const view = this.selectedDataView;
    if (!view || !this.importRows.length) return;

    const importableFields = view.editableFields.filter(
      (field) => this.importFieldMappings[field],
    );
    if (!importableFields.length) {
      this.notifications.showError("Mappez au moins un champ éditable.");
      return;
    }

    if (!this.importUniqueFields.length) {
      this.notifications.showError(
        "Sélectionnez au moins un champ pour détecter les doublons.",
      );
      return;
    }

    this.importing = true;
    this.importProgress = {
      total: this.importRows.length,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    try {
      for (const row of this.importRows) {
        try {
          const uniqueValues = this.importUniqueFields.map((field) => {
            const rawValue = row[this.importFieldMappings[field]] || "";
            return this.normalizeImportValue(view, field, rawValue);
          });
          if (!uniqueValues.some((v) => String(v || "").trim())) {
            this.importProgress.failed += 1;
            this.importProgress.processed += 1;
            continue;
          }

          const values: Record<string, any> = {};
          view.editableFields.forEach((field) => {
            const sourceHeader = this.importFieldMappings[field];
            if (!sourceHeader) return;
            const rawValue = row[sourceHeader] ?? "";
            values[field] = this.normalizeImportValue(view, field, rawValue);
          });

          const existingRow = this.findExistingImportRow(
            view,
            this.importUniqueFields,
            uniqueValues,
          );
          if (existingRow) {
            if (this.importDuplicateStrategy === "skip") {
              this.importProgress.skipped += 1;
              this.importProgress.processed += 1;
              continue;
            }

            await this.tableViews.saveTableViewRecord(
              view.id,
              this.getDataRowId(view, existingRow),
              values,
              this.organizationDatabaseName || undefined,
            );
            this.importProgress.updated += 1;
          } else {
            await this.tableViews.createTableViewRecord(
              view.id,
              values,
              view,
              this.organizationDatabaseName || undefined,
            );
            this.importProgress.created += 1;
          }

          this.importProgress.processed += 1;
        } catch (rowError: any) {
          this.importProgress.failed += 1;
          this.importProgress.processed += 1;
          console.error("Import row failed:", rowError, { row });
        }
      }

      await this.reloadDataRows();
      this.notifications.showSuccess(
        `Import terminé: ${this.importProgress.created} créés, ${this.importProgress.updated} mis à jour, ${this.importProgress.skipped} ignorés, ${this.importProgress.failed} échoués.`,
      );
      this.cancelImportMode();
    } catch (error: any) {
      this.notifications.showError(
        error?.message || "Impossible d'importer le fichier.",
      );
    } finally {
      this.importing = false;
    }
  }

  selectAllImportFields(): void {
    const view = this.selectedDataView;
    if (!view) return;
    this.importFieldMappings = this.buildDefaultImportMappings(
      view,
      this.importHeaders,
    );
  }

  clearImportFieldMappings(): void {
    this.importFieldMappings = {};
  }

  setImportFieldMapping(field: string, header: string): void {
    if (!header) {
      delete this.importFieldMappings[field];
      this.importFieldMappings = { ...this.importFieldMappings };
      return;
    }
    this.importFieldMappings = { ...this.importFieldMappings, [field]: header };
  }

  getImportPreviewRows(limit = 5): Record<string, string>[] {
    return this.importRows.slice(0, limit);
  }

  isImportFieldUnique(field: string): boolean {
    return this.importUniqueFields.includes(field);
  }

  toggleImportUniqueField(field: string, checked: boolean): void {
    if (checked) {
      if (!this.importUniqueFields.includes(field)) {
        this.importUniqueFields = [...this.importUniqueFields, field];
      }
    } else {
      this.importUniqueFields = this.importUniqueFields.filter(
        (f) => f !== field,
      );
    }
  }

  selectAllImportUniqueFields(): void {
    const view = this.selectedDataView;
    if (!view) return;
    this.importUniqueFields = [...view.editableFields];
  }

  deselectAllImportUniqueFields(): void {
    this.importUniqueFields = [];
  }

  private resetImportState(): void {
    this.importMode = false;
    this.importing = false;
    this.importFileName = "";
    this.importHeaders = [];
    this.importRows = [];
    this.importFieldMappings = {};
    this.importUniqueFields = [];
    this.importDuplicateStrategy = "skip";
    this.importProgress = {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
  }

  private async readWorkbook(file: File): Promise<XLSX.WorkBook> {
    const data = await file.arrayBuffer();
    return XLSX.read(data, { type: "array" });
  }

  private buildDefaultImportMappings(
    view: TableViewConfig,
    headers: string[],
  ): Record<string, string> {
    const normalizedHeaders = new Map<string, string>();
    headers.forEach((header) => {
      normalizedHeaders.set(this.normalizeKey(header), header);
    });

    const mappings: Record<string, string> = {};
    view.editableFields.forEach((field) => {
      const candidates = [field, view.fieldLabels[field], this.humanize(field)]
        .filter(Boolean)
        .map((value) => this.normalizeKey(String(value)));
      const match = candidates
        .map((candidate) => normalizedHeaders.get(candidate))
        .find(Boolean);
      if (match) {
        mappings[field] = match as string;
      }
    });
    return mappings;
  }

  private normalizeImportValue(
    view: TableViewConfig,
    field: string,
    rawValue: unknown,
  ): string {
    const value = String(rawValue ?? "").trim();
    if (!value) return "";

    const setting = view.fieldSettings[field];
    if (setting?.displayMode !== "lookup") {
      return value;
    }

    const options = this.lookupOptions[`${view.id}::${field}`] || [];
    const match = options.find(
      (option) =>
        this.normalizeKey(option.value) === this.normalizeKey(value) ||
        this.normalizeKey(option.label) === this.normalizeKey(value),
    );
    return match?.value || value;
  }

  private findExistingImportRow(
    view: TableViewConfig,
    fields: string[],
    values: string[],
  ): Record<string, any> | null {
    return (
      this.dataRows.find((row) => {
        return fields.every((field, idx) => {
          const rowValue = this.normalizeImportValue(view, field, row[field]);
          const importValue = values[idx];
          return this.normalizeKey(rowValue) === this.normalizeKey(importValue);
        });
      }) || null
    );
  }

  private normalizeKey(value: string): string {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  cancelExportMode(): void {
    this.exportMode = false;
    this.selectedExportFields = [];
    this.selectedExportRowIds.clear();
  }

  isExportRowSelected(rowId: string): boolean {
    return this.selectedExportRowIds.has(rowId);
  }

  toggleExportRow(rowId: string, checked: boolean): void {
    if (checked) {
      this.selectedExportRowIds.add(rowId);
    } else {
      this.selectedExportRowIds.delete(rowId);
    }
    this.selectedExportRowIds = new Set(this.selectedExportRowIds);
  }

  toggleAllExportRows(checked: boolean): void {
    const view = this.selectedDataView;
    if (!view) return;

    if (checked) {
      this.selectedExportRowIds = new Set(
        this.dataRows
          .map((row) => this.getDataRowId(view, row))
          .filter(Boolean),
      );
      return;
    }

    this.selectedExportRowIds.clear();
    this.selectedExportRowIds = new Set();
  }

  isExportFieldSelected(field: string): boolean {
    return this.selectedExportFields.includes(field);
  }

  getOrderedExportFields(view: TableViewConfig): string[] {
    const orderedSelected = this.selectedExportFields.filter((field) =>
      view.visibleFields.includes(field),
    );
    const remainingFields = view.visibleFields.filter(
      (field) => !orderedSelected.includes(field),
    );
    return [...orderedSelected, ...remainingFields];
  }

  toggleExportField(field: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedExportFields.includes(field)) {
        this.selectedExportFields = [...this.selectedExportFields, field];
      }
      return;
    }

    this.selectedExportFields = this.selectedExportFields.filter(
      (item) => item !== field,
    );
  }

  selectAllExportFields(): void {
    const view = this.selectedDataView;
    if (!view) return;

    this.selectedExportFields = [...view.visibleFields];
  }

  deselectAllExportFields(): void {
    this.selectedExportFields = [];
  }

  moveExportField(field: string, direction: "up" | "down"): void {
    const index = this.selectedExportFields.indexOf(field);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.selectedExportFields.length) {
      return;
    }

    const nextFields = [...this.selectedExportFields];
    [nextFields[index], nextFields[targetIndex]] = [
      nextFields[targetIndex],
      nextFields[index],
    ];
    this.selectedExportFields = nextFields;
  }

  async exportToExcel(): Promise<void> {
    const view = this.selectedDataView;
    if (!view) return;

    const fields = this.selectedExportFields.length
      ? this.selectedExportFields
      : [...view.visibleFields];
    const rows = this.dataRows.filter((row) => {
      const rowId = this.getDataRowId(view, row);
      return this.selectedExportRowIds.size
        ? this.selectedExportRowIds.has(rowId)
        : true;
    });

    if (!fields.length) {
      this.notifications.showError(
        "Sélectionnez au moins un champ à exporter.",
      );
      return;
    }

    if (!rows.length) {
      this.notifications.showError(
        "Sélectionnez au moins une ligne à exporter.",
      );
      return;
    }

    const header = fields.map((field) => this.getDataFieldLabel(view, field));
    const worksheetData = [
      header,
      ...rows.map((row) =>
        fields.map((field) => this.getDisplayValue(view, field, row[field])),
      ),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Export");

    const fileName = `${(view.label || view.tableName || "export")
      .toString()
      .replace(/[^a-z0-9-_]+/gi, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "")}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    this.notifications.showSuccess("Export Excel lancé.");
    this.cancelExportMode();
  }

  isAllExportRowsSelected(): boolean {
    const view = this.selectedDataView;
    if (!view || !this.dataRows.length) return false;
    return this.dataRows.every((row) =>
      this.selectedExportRowIds.has(this.getDataRowId(view, row)),
    );
  }

  private syncExportSelections(view: TableViewConfig): void {
    this.selectedExportRowIds = new Set(
      this.dataRows.map((row) => this.getDataRowId(view, row)).filter(Boolean),
    );
    if (!this.selectedExportFields.length) {
      this.selectedExportFields = [...view.visibleFields];
    }
  }

  createDataRow(): void {
    const view = this.selectedDataView;
    if (!view || this.dataRowsLoading || this.dataSaving || this.dataDeleting) {
      return;
    }
    this.creatingDataRow = true;
    this.selectedDataRowId = null;
    this.selectedDataRecord = Object.fromEntries(
      view.visibleFields.map((field) => [field, ""]),
    );
  }

  selectDataRow(rowId: string): void {
    const view = this.selectedDataView;
    if (!view || this.dataRowsLoading || this.dataSaving || this.dataDeleting) {
      return;
    }
    this.creatingDataRow = false;
    this.selectedDataRowId = rowId;
    this.selectedDataRecord = {
      ...(this.dataRows.find((row) => this.getDataRowId(view, row) === rowId) ||
        {}),
    };
  }

  async saveDataRow(): Promise<void> {
    const view = this.selectedDataView;
    if (
      !view ||
      !this.selectedDataRecord ||
      this.dataSaving ||
      this.dataDeleting
    ) {
      return;
    }
    const values = Object.fromEntries(
      view.editableFields.map((field) => [
        field,
        this.selectedDataRecord?.[field] ?? "",
      ]),
    );
    this.dataSaving = true;
    this.dataStatusMessage = this.creatingDataRow
      ? "Ajout de la ligne..."
      : "Enregistrement...";
    try {
      if (this.creatingDataRow) {
        const record = await this.tableViews.createTableViewRecord(
          view.id,
          values,
          view,
        );
        this.selectedDataRecord = record ? { ...record } : null;
        this.selectedDataRowId = record
          ? this.getDataRowId(view, record)
          : null;
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
    } catch {
      this.notifications.showError("Impossible d'enregistrer la ligne.");
    } finally {
      this.dataSaving = false;
      this.dataStatusMessage = "";
    }
  }

  async deleteDataRow(): Promise<void> {
    const view = this.selectedDataView;
    if (!view || this.dataDeleting || this.dataSaving) return;
    if (this.creatingDataRow) {
      this.creatingDataRow = false;
      this.selectedDataRecord = null;
      return;
    }
    const rowId =
      this.selectedDataRowId ||
      (this.selectedDataRecord
        ? this.getDataRowId(view, this.selectedDataRecord)
        : null);
    if (rowId === null || rowId === undefined) {
      this.notifications.showError("Selectionnez une ligne a supprimer.");
      return;
    }
    this.selectedDataRowId = rowId;
    const previewLabel =
      this.buildDataPreviewLabel(view, this.selectedDataRecord) ||
      "cette ligne";

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Supprimer la ligne ?",
        message: `La ligne "${previewLabel}" sera supprimée.`,
        confirmText: "Supprimer",
        cancelText: "Annuler",
        actionType: "delete",
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        this.dataDeleting = true;
        this.dataStatusMessage = "Suppression de la ligne...";
        try {
          await this.tableViews.deleteTableViewRecord(view.id, rowId);
          this.selectedDataRowId = null;
          this.selectedDataRecord = null;
          this.notifications.showSuccess("Ligne supprimee.");
          await this.reloadDataRows();
        } catch {
          this.notifications.showError("Impossible de supprimer la ligne.");
        } finally {
          this.dataDeleting = false;
          this.dataStatusMessage = "";
        }
      }
    });
  }

  isFieldEditable(field: string): boolean {
    return !!this.selectedDataView?.editableFields.includes(field);
  }

  getRowId(row: Record<string, any>): string {
    return this.getDataRowId(this.selectedDataView, row);
  }

  getDataRowId(view: TableViewConfig | null, row: Record<string, any>): string {
    const keys = Object.keys(row || {});
    const directKey = keys.find((key) => ["id", "Id", "ID"].includes(key));
    if (directKey && row[directKey] !== null && row[directKey] !== undefined) {
      return String(row[directKey]);
    }

    const configuredFields = new Set(
      [
        ...(view?.visibleFields || []),
        ...(view?.editableFields || []),
        ...(view?.previewFields || []),
      ].map((field) => field.toLowerCase()),
    );
    const injectedKey = keys.find(
      (key) => !configuredFields.has(key.toLowerCase()),
    );
    if (
      injectedKey &&
      row[injectedKey] !== null &&
      row[injectedKey] !== undefined
    ) {
      return String(row[injectedKey]);
    }

    const keyLikeId = keys.find((key) => /(^id_|_id$|id$)/i.test(key));
    if (keyLikeId && row[keyLikeId] !== null && row[keyLikeId] !== undefined) {
      return String(row[keyLikeId]);
    }

    const firstKey = keys.find(
      (key) => row[key] !== null && row[key] !== undefined,
    );
    return firstKey ? String(row[firstKey]) : "";
  }

  getDataFieldLabel(view: TableViewConfig, field: string): string {
    return view.fieldLabels[field] || this.humanize(field);
  }

  getTableViewLabelById(id: string): string {
    const tv = this.tableViews.getTableView(id);
    return tv ? tv.label || tv.tableName : id;
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
