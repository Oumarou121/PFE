import type { UnknownRecord } from './editor-common.model';

export interface AdminAccountRecord extends UnknownRecord {
  id: string;
  email?: string;
  name?: string;
  nom?: string;
  organizationId?: string | null;
  role?: string;
}
