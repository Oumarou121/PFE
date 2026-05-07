import type { UnknownRecord } from './editor-common.model';
import type { GraphicCharterRecord } from './graphic-charter.model';

export interface OrganizationRecord extends UnknownRecord {
  id: string;
  organizationId?: string | null;
  nom?: string;
  name?: string;
  ville?: string;
  city?: string;
  graphicCharters: GraphicCharterRecord[];
}
