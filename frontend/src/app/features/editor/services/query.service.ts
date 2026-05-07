import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { QueryResponse, UnknownRecord } from '../models/editor-common.model';
import { withOrganizationQueryParams } from './editor-normalizers';

@Injectable({ providedIn: 'root' })
export class QueryService {
  constructor(private api: ApiService) {}

  async runSelect(sql: string, params: UnknownRecord = {}): Promise<UnknownRecord[]> {
    const payload = await firstValueFrom(
      this.api.post<QueryResponse>('query', {
        sql,
        params: withOrganizationQueryParams(params)
      })
    );
    return payload.rows || [];
  }
}
