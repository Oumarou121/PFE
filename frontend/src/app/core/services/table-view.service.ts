import { Injectable } from '@angular/core';
import { DbService } from './db.service';

export interface TableViewRecord {
  id: string;
  label?: string;
  tableName?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class TableViewService {
  constructor(private readonly db: DbService) {}

  async ensureLoaded(): Promise<void> {
    await this.db.ensureResources(['tableViews']);
  }

  async list(): Promise<TableViewRecord[]> {
    await this.ensureLoaded();
    return this.db.getTableViews<TableViewRecord>();
  }
}
