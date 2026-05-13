import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { ModuleRecord } from '../models/module.model';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModuleService {
  constructor(private api: ApiService) {}

  async getAll(): Promise<ModuleRecord[]> {
    const res = await lastValueFrom(this.api.get<ModuleRecord[]>('modules'));
    return res || [];
  }

  async getById(id: string): Promise<ModuleRecord | null> {
    return await lastValueFrom(this.api.get<ModuleRecord>(`modules/${id}`));
  }

  async save(module: ModuleRecord): Promise<ModuleRecord> {
    return await lastValueFrom(this.api.post<ModuleRecord>('modules', module));
  }

  async delete(id: string): Promise<void> {
    await lastValueFrom(this.api.delete(`modules/${id}`));
  }
}
