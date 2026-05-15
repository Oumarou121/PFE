export interface AcademicYearAffectedTableConfig {
  tableName: string;
  yearColumn: string;
}

export interface AcademicYearConfig {
  organizationId: number;
  academicYearTable: string;
  codeColumn: string;
  startDateColumn?: string | null;
  endDateColumn?: string | null;
  statusColumn?: string | null;
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
