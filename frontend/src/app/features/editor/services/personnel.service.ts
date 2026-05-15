import { Injectable } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { ApiService } from "../../../core/services/api.service";
import {
  PersonnelCreateRequest,
  PersonnelUpdateRequest,
  PersonnelUser,
} from "../models/personnel.model";

@Injectable({
  providedIn: "root",
})
export class PersonnelService {
  constructor(private api: ApiService) {}

  async getAll(): Promise<PersonnelUser[]> {
    return (await lastValueFrom(this.api.get<PersonnelUser[]>("admin/users"))) || [];
  }

  async create(payload: PersonnelCreateRequest): Promise<PersonnelUser> {
    return await lastValueFrom(this.api.post<PersonnelUser>("admin/users", payload));
  }

  async update(id: number, payload: PersonnelUpdateRequest): Promise<PersonnelUser> {
    return await lastValueFrom(this.api.put<PersonnelUser>(`admin/users/${id}`, payload));
  }

  async delete(id: number): Promise<void> {
    await lastValueFrom(this.api.delete<void>(`admin/users/${id}`));
  }
}
