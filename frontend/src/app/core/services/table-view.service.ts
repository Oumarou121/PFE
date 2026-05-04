import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { DbService } from './db.service';

export interface TableViewRecord {
  id: string;
  label?: string;
  tableName?: string;
  visibleFields?: string[];
  editableFields?: string[];
  previewFields?: string[];
  fieldLabels?: Record<string, string>;
  fieldSettings?: Record<string, unknown>;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class TableViewService {
  constructor(
    private readonly db: DbService,
    private readonly api: ApiService
  ) {}

  async ensureLoaded(): Promise<void> {
    await this.db.ensureResources(['tableViews']);
  }

  async list(): Promise<TableViewRecord[]> {
    await this.ensureLoaded();
    return this.db.getTableViews<TableViewRecord>();
  }

  async rows(config: TableViewRecord, search = '', limit = 200): Promise<Record<string, unknown>[]> {
    const payload = await firstValueFrom(this.api.post<{ rows?: Record<string, unknown>[] }>('table-view/rows', {
      configId: config.id,
      config,
      search: search.trim(),
      limit
    }));
    return Array.isArray(payload.rows) ? payload.rows : [];
  }
}
