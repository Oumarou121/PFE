import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { UnknownRecord } from '../models/editor-common.model';
import { TableViewConfig, TableViewLookupResponse, TableViewRecordResponse, TableViewRowsOptions, TableViewRowsResponse } from '../models/table-view.model';
import { normalizeTableViewRecord } from './editor-normalizers';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class TableViewService {
  constructor(private api: ApiService, private state: EditorStateService) {}

  getTableViews(): TableViewConfig[] {
    return this.state.getState().tableViews;
  }

  getTableView(id: string | null | undefined): TableViewConfig | null {
    return this.getTableViews().find(view => view.id === id) || null;
  }

  async saveTableView(view: TableViewConfig): Promise<TableViewConfig> {
    const normalized = normalizeTableViewRecord(view);
    const state = this.state.getState();
    const index = state.tableViews.findIndex(item => item.id === normalized.id);
    index >= 0 ? state.tableViews.splice(index, 1, normalized) : state.tableViews.push(normalized);
    this.state.replaceState(state);
    await firstValueFrom(this.api.post('table-view-config', { tableView: normalized }));
    return normalized;
  }

  async deleteTableView(id: string): Promise<void> {
    const state = this.state.getState();
    state.tableViews = state.tableViews.filter(view => view.id !== id);
    this.state.replaceState(state);
    await firstValueFrom(this.api.deleteWithBody('table-view-config', { id }));
  }

  async getTableViewRows(configId: string, options: TableViewRowsOptions = {}): Promise<UnknownRecord[]> {
    const payload = await firstValueFrom(
      this.api.post<TableViewRowsResponse>('table-view/rows', {
        configId,
        config: options.config || null,
        search: String(options.search || '').trim(),
        limit: Number(options.limit) || 200
      })
    );
    return payload.rows || [];
  }

  async getTableViewRecord(configId: string, rowId: string): Promise<UnknownRecord | null> {
    const payload = await firstValueFrom(this.api.post<TableViewRecordResponse>('table-view/record', { configId, rowId }));
    return payload.record || null;
  }

  async saveTableViewRecord(configId: string, rowId: string, values: UnknownRecord = {}): Promise<UnknownRecord | null> {
    const payload = await firstValueFrom(this.api.put<TableViewRecordResponse>('table-view/record', { configId, rowId, values }));
    return payload.record || null;
  }

  async createTableViewRecord(configId: string, values: UnknownRecord = {}, config: TableViewConfig | null = null): Promise<UnknownRecord | null> {
    const payload = await firstValueFrom(this.api.post<TableViewRecordResponse>('table-view/record/create', { configId, values, config }));
    return payload.record || null;
  }

  async deleteTableViewRecord(configId: string, rowId: string): Promise<boolean> {
    const payload = await firstValueFrom(this.api.deleteWithBody<TableViewRecordResponse>('table-view/record', { configId, rowId }));
    return payload.ok === true;
  }

  async getTableViewLookupOptions(configId: string, fieldName: string, config: TableViewConfig | null = null): Promise<Array<{ value: string; label: string }>> {
    const payload = await firstValueFrom(this.api.post<TableViewLookupResponse>('table-view/lookup-options', { configId, fieldName, config }));
    return payload.options || [];
  }
}
