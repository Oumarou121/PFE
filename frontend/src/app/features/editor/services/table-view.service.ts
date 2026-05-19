import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../../../core/services/api.service";
import { UnknownRecord } from "../models/editor-common.model";
import {
  TableViewConfig,
  TableViewLookupResponse,
  TableViewRecordResponse,
  TableViewRowsOptions,
  TableViewRowsResponse,
} from "../models/table-view.model";
import { normalizeTableViewRecord } from "./editor-normalizers";
import { EditorStateService } from "./editor-state.service";

@Injectable({ providedIn: "root" })
export class TableViewService {
  constructor(
    private api: ApiService,
    private state: EditorStateService,
  ) {}

  getTableViews(): TableViewConfig[] {
    return this.state.getState().tableViews;
  }

  getTableView(id: string | null | undefined): TableViewConfig | null {
    return this.getTableViews().find((view) => view.id === id) || null;
  }

  async saveTableView(view: TableViewConfig): Promise<TableViewConfig> {
    const normalized = normalizeTableViewRecord(view);
    const payload = {
      tableView: JSON.parse(JSON.stringify(normalized)),
    };
    await firstValueFrom(this.api.post("table-view-config", payload));

    const state = this.state.getState();
    const index = state.tableViews.findIndex(
      (item) => item.id === normalized.id,
    );
    index >= 0
      ? state.tableViews.splice(index, 1, normalized)
      : state.tableViews.push(normalized);
    this.state.replaceState(state);

    return normalized;
  }

  saveConfig(view: TableViewConfig): Observable<TableViewConfig> {
    return from(this.saveTableView(view));
  }

  async deleteTableView(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteWithBody("table-view-config", { id }));

    const state = this.state.getState();
    state.tableViews = state.tableViews.filter((view) => view.id !== id);
    this.state.replaceState(state);
  }

  deleteConfig(id: string): Observable<void> {
    return from(this.deleteTableView(id));
  }

  async getTableViewRows(
    configId: string,
    options: TableViewRowsOptions = {},
    databaseName?: string | null,
  ): Promise<UnknownRecord[]> {
    const config = this.getRowsRequestConfig(options.config || null);
    const payload = await firstValueFrom(
      this.api.post<TableViewRowsResponse>("table-view/rows", {
        configId,
        config,
        search: String(options.search || "").trim(),
        databaseName,
        selectedFilters: options.selectedFilters || null,
        page: options.page || 1,
        pageSize: options.pageSize || 50,
      }),
    );
    return payload.rows || [];
  }

  getRows(
    options: TableViewRowsOptions & {
      configId: string;
      databaseName?: string | null;
    },
  ): Observable<TableViewRowsResponse> {
    return from(
      this.getTableViewRows(
        options.configId,
        options,
        options.databaseName,
      ).then((rows) => ({ rows })),
    );
  }

  async getTableViewRecord(
    configId: string,
    rowId: string,
    databaseName?: string | null,
  ): Promise<UnknownRecord | null> {
    const payload = await firstValueFrom(
      this.api.post<TableViewRecordResponse>("table-view/record", {
        configId,
        rowId,
        databaseName,
      }),
    );
    return payload.record || null;
  }

  async saveTableViewRecord(
    configId: string,
    rowId: string,
    values: UnknownRecord = {},
    databaseName?: string | null,
  ): Promise<UnknownRecord | null> {
    const payload = await firstValueFrom(
      this.api.put<TableViewRecordResponse>("table-view/record", {
        configId,
        rowId,
        values,
        databaseName,
      }),
    );
    return payload.record || null;
  }

  updateRecord(options: {
    configId: string;
    rowId: string;
    values?: UnknownRecord;
    databaseName?: string | null;
  }): Observable<UnknownRecord | null> {
    return from(
      this.saveTableViewRecord(
        options.configId,
        options.rowId,
        options.values || {},
        options.databaseName,
      ),
    );
  }

  async createTableViewRecord(
    configId: string,
    values: UnknownRecord = {},
    config: TableViewConfig | null = null,
    databaseName?: string | null,
  ): Promise<UnknownRecord | null> {
    const payload = await firstValueFrom(
      this.api.post<TableViewRecordResponse>("table-view/record/create", {
        configId,
        values,
        config,
        databaseName,
      }),
    );
    return payload.record || null;
  }

  createRecord(options: {
    configId: string;
    values?: UnknownRecord;
    config?: TableViewConfig | null;
    databaseName?: string | null;
  }): Observable<UnknownRecord | null> {
    return from(
      this.createTableViewRecord(
        options.configId,
        options.values || {},
        options.config || null,
        options.databaseName,
      ),
    );
  }

  async deleteTableViewRecord(
    configId: string,
    rowId: string,
    databaseName?: string | null,
  ): Promise<boolean> {
    const payload = await firstValueFrom(
      this.api.deleteWithBody<TableViewRecordResponse>("table-view/record", {
        configId,
        rowId,
        databaseName,
      }),
    );
    return payload.ok === true;
  }

  deleteRecord(options: {
    configId: string;
    rowId: string;
    databaseName?: string | null;
  }): Observable<boolean> {
    return from(
      this.deleteTableViewRecord(
        options.configId,
        options.rowId,
        options.databaseName,
      ),
    );
  }

  async getTableViewLookupOptions(
    configId: string,
    fieldName: string,
    config: TableViewConfig | null = null,
    databaseName?: string | null,
  ): Promise<Array<{ value: string; label: string }>> {
    const payload = await firstValueFrom(
      this.api.post<TableViewLookupResponse>("table-view/lookup-options", {
        configId,
        fieldName,
        config,
        databaseName,
      }),
    );
    return payload.options || [];
  }

  getLookupOptions(options: {
    configId: string;
    fieldName: string;
    config?: TableViewConfig | null;
    databaseName?: string | null;
  }): Observable<Array<{ value: string; label: string }>> {
    return from(
      this.getTableViewLookupOptions(
        options.configId,
        options.fieldName,
        options.config || null,
        options.databaseName,
      ),
    );
  }

  private getRowsRequestConfig(
    config: TableViewConfig | null,
  ): TableViewConfig | null {
    if (!config?.tableName?.trim() || !config?.label?.trim()) return null;
    return {
      ...config,
      filters: (config.filters || []).filter(
        (filter: any) =>
          !!String(filter?.id || "").trim() &&
          !!String(filter?.name || "").trim() &&
          !!String(filter?.linkColumn || "").trim() &&
          (String(filter?.sourceType || "").toLowerCase() !== "table" ||
            (!!String(filter?.sqlBuilder?.tableName || "").trim() &&
              !!String(filter?.sqlBuilder?.valueColumn || "").trim() &&
              !!String(filter?.sqlBuilder?.labelColumn || "").trim())),
      ),
    };
  }
}
