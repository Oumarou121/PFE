import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../../../core/services/api.service";
import {
  AcademicYear,
  AcademicYearConfig,
  AcademicYearCreateRequest,
} from "../models/academic-year.model";

@Injectable({ providedIn: "root" })
export class AcademicYearService {
  constructor(private api: ApiService) {}

  getConfig(organizationId: string | number): Promise<AcademicYearConfig | null> {
    return firstValueFrom(
      this.api.get<AcademicYearConfig | null>("academic-years/config", {
        organizationId,
      }),
    );
  }

  saveConfig(config: AcademicYearConfig): Promise<AcademicYearConfig> {
    return firstValueFrom(
      this.api.put<AcademicYearConfig>("academic-years/config", config),
    );
  }

  listYears(): Promise<AcademicYear[]> {
    return firstValueFrom(this.api.get<AcademicYear[]>("academic-years"));
  }

  createYear(request: AcademicYearCreateRequest): Promise<AcademicYear> {
    return firstValueFrom(this.api.post<AcademicYear>("academic-years", request));
  }

  closeYear(code: string): Promise<void> {
    return firstValueFrom(
      this.api.post<void>(`academic-years/${encodeURIComponent(code)}/close`, {}),
    );
  }
}
