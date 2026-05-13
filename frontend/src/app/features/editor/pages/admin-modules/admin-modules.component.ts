import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { Subject, takeUntil } from "rxjs";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { EditorStateService } from "../../services/editor-state.service";
import { OrganizationService } from "../../services/organization.service";
import { TableViewService } from "../../services/table-view.service";
import { ModuleRecord } from "../../models/module.model";
import { TableViewConfig } from "../../models/table-view.model";

@Component({
  selector: "app-admin-modules",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: "./admin-modules.component.html",
  styleUrls: ["./admin-modules.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class AdminModulesComponent implements OnInit, OnDestroy {
  loading = true;
  organizationName = "";
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
      });
      if (requestId !== this.dataRowsRequestId) return;
      this.dataRows = rows;
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
