import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../../../core/services/api.service";
import {
  DocumentCreatePayload,
  DocumentRecord,
  DocumentListResponse,
  DocumentListItem,
} from "../models/document.model";

@Injectable({ providedIn: "root" })
export class DocumentService {
  constructor(private api: ApiService) {}

  async createDocument(
    payload: DocumentCreatePayload,
  ): Promise<DocumentRecord> {
    return await firstValueFrom(
      this.api.post<DocumentRecord>("documents", payload),
    );
  }

  async getDocuments(
    params: {
      organizationId?: number;
      familyId?: string;
      beneficiaryTable?: string;
      beneficiaryId?: string;
    } = {},
  ): Promise<DocumentRecord[]> {
    return await firstValueFrom(
      this.api.get<DocumentRecord[]>("documents", params),
    );
  }

  async getDocumentsPaged(
    params: {
      page?: number;
      limit?: number;
      familyId?: string;
      beneficiaryTable?: string;
      beneficiaryId?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ): Promise<DocumentListResponse> {
    return await firstValueFrom(
      this.api.get<DocumentListResponse>("documents/paged", params),
    );
  }

  async getDocumentById(id: string): Promise<DocumentRecord | null> {
    try {
      return await firstValueFrom(
        this.api.get<DocumentRecord>(`documents/${encodeURIComponent(id)}`),
      );
    } catch {
      return null;
    }
  }

  async deleteDocument(id: string): Promise<void> {
    await firstValueFrom(
      this.api.delete(`documents/${encodeURIComponent(id)}`),
    );
  }
}
