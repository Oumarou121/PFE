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
      this.api.post<DocumentRecord>("archives", payload),
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
      this.api.get<DocumentRecord[]>("archives", params),
    );
  }

  async getDocumentsPaged(
    params: {
      page?: number;
      familyId?: string;
      beneficiaryTable?: string;
      beneficiaryId?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ): Promise<DocumentListResponse> {
    return await firstValueFrom(
      this.api.get<DocumentListResponse>("archives/paged", params),
    );
  }

  async getDocumentById(id: string): Promise<DocumentRecord | null> {
    try {
      return await firstValueFrom(
        this.api.get<DocumentRecord>(`archives/${encodeURIComponent(id)}`),
      );
    } catch {
      return null;
    }
  }

  async deleteDocument(id: string): Promise<void> {
    await firstValueFrom(this.api.delete(`archives/${encodeURIComponent(id)}`));
  }
}
