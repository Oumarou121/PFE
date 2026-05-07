import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DatabaseSchema, SchemaColumn, SchemaResponse } from '../models/schema.model';
import { getSchemaColumn, getSchemaColumnsForTable, getSchemaPrimaryColumn } from './editor-normalizers';

@Injectable({ providedIn: 'root' })
export class SchemaService {
  private schemaPromise: Promise<DatabaseSchema> | null = null;

  constructor(private api: ApiService) {}

  async getSchema(force = false): Promise<DatabaseSchema> {
    if (this.schemaPromise && !force) return this.schemaPromise;
    this.schemaPromise = firstValueFrom(this.api.get<SchemaResponse>('schema')).then(payload => payload.schema || {});
    return this.schemaPromise;
  }

  getColumnsForTable(schema: DatabaseSchema, tableName: string): SchemaColumn[] {
    return getSchemaColumnsForTable(schema, tableName);
  }

  getPrimaryColumn(schema: DatabaseSchema, tableName: string): string {
    return getSchemaPrimaryColumn(schema, tableName);
  }

  getColumn(schema: DatabaseSchema, tableName: string, columnName: string): SchemaColumn | undefined {
    return getSchemaColumn(schema, tableName, columnName);
  }
}
