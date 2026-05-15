import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { QueryResponse, UnknownRecord } from '../models/editor-common.model';
import { withOrganizationQueryParams } from './editor-normalizers';

@Injectable({ providedIn: 'root' })
export class QueryService {
  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  async runSelect(sql: string, params: UnknownRecord = {}): Promise<UnknownRecord[]> {
    const organizationParams = withOrganizationQueryParams(params);
    const activeAcademicYear = this.auth.getActiveAcademicYear();
    const queryParams = {
      ...organizationParams,
      academicYear: organizationParams['academicYear'] ?? activeAcademicYear
    };
    const payload = await firstValueFrom(
      this.api.post<QueryResponse>('query', {
        sql,
        params: queryParams
      })
    );
    return payload.rows || [];
  }
}
