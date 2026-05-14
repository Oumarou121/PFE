export interface DocumentCreatePayload {
  id?: string;
  organizationId?: number | null;
  familyId: string;
  templateId: string;
  graphicCharterId?: string | null;
  beneficiaryId?: string | null;
  beneficiaryMode: "table" | "organization" | string;
  beneficiaryTable?: string | null;
  beneficiaryTableLabel?: string | null;
  beneficiaryLinkColumn?: string | null;
  beneficiaryDisplayColumn1?: string | null;
  beneficiaryDisplayColumn2?: string | null;
  beneficiaryDisplayValue1?: string | null;
  beneficiaryDisplayValue2?: string | null;
  title: string;
  headerHtml?: string;
  bodyHtml?: string;
  footerHtml?: string;
  fullHtml: string;
  mimeType?: string;
  status?: string;
  generatedAt?: string;
}

export interface DocumentRecord extends DocumentCreatePayload {
  id: string;
  generatedById: string;
  generatedByName: string;
  generatedByEmail?: string | null;
  generatedByRole?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  deletedById?: string | null;
  deletedByName?: string | null;
}

export interface DocumentListItem {
  id: string;
  title: string;
  familyId: string;
  beneficiaryId?: string | null;
  beneficiaryTable?: string | null;
  beneficiaryTableLabel?: string | null;
  beneficiaryDisplayValue1?: string | null;
  beneficiaryDisplayValue2?: string | null;
  generatedById: string;
  generatedByName: string;
  generatedByEmail?: string | null;
  generatedByRole?: string | null;
  generatedAt: string;
}

export interface DocumentListResponse {
  data: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
