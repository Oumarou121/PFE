export interface PersonnelUser {
  id: number;
  name: string;
  email: string;
  role: string;
  organizationId?: number | null;
  profile?: string | null;
  profileDetail?: string | null;
  accessAllYears: boolean;
  accessYearList?: string | null;
  moduleIds: string[];
  createdAt: string;
  isActive: boolean;
}

export interface PersonnelCreateRequest {
  name: string;
  email: string;
  password: string;
  role: string;
  organizationId?: number | null;
  profile?: string | null;
  profileDetail?: string | null;
  accessAllYears: boolean;
  accessYearList?: string | null;
  moduleIds: string[];
}

export interface PersonnelUpdateRequest extends Omit<PersonnelCreateRequest, "password"> {
  password?: string;
  isActive: boolean;
}
