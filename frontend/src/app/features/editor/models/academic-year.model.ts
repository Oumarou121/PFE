export interface AcademicYearAffectedTableConfig {
  tableName: string;
  yearColumn: string;
}

export interface AcademicYearConfig {
  organizationId: number;
  affectedTables: AcademicYearAffectedTableConfig[];
  updatedAt?: string | null;
}

export interface AcademicYear {
  code: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  isClosed: boolean;
}

export interface AcademicYearCreateRequest {
  code: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
}
