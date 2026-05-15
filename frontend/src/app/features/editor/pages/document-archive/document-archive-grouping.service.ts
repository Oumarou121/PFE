import { Injectable } from "@angular/core";
import { DocumentListItem } from "../../models/document.model";
import { FamilyRecord } from "../../models/family.model";

export const ORGANIZATION_DOCUMENT_GROUP_KEY = "__organization__";

export interface BeneficiaryDocumentGroup {
  key: string;
  beneficiaryId: string | null;
  title: string;
  subtitle: string;
  documents: DocumentListItem[];
  familyIds: string[];
}

export interface TableDocumentGroup {
  key: string;
  tableName: string | null;
  label: string;
  isOrganization: boolean;
  documents: DocumentListItem[];
  beneficiaries: BeneficiaryDocumentGroup[];
  familyIds: string[];
}

@Injectable({ providedIn: "root" })
export class DocumentArchiveGroupingService {
  buildTableGroups(
    rows: DocumentListItem[],
    families: FamilyRecord[],
  ): TableDocumentGroup[] {
    const map = new Map<string, TableDocumentGroup>();

    for (const document of rows) {
      const hasTable = !!String(document.beneficiaryTable || "").trim();
      const key = hasTable
        ? String(document.beneficiaryTable)
        : ORGANIZATION_DOCUMENT_GROUP_KEY;
      const tableGroup = map.get(key) || {
        key,
        tableName: hasTable ? String(document.beneficiaryTable) : null,
        label: hasTable
          ? this.getBeneficiaryTableLabel(document, families)
          : "Archives liées à l'organisation",
        isOrganization: !hasTable,
        documents: [],
        beneficiaries: [],
        familyIds: [],
      };

      tableGroup.documents.push(document);
      tableGroup.familyIds = this.uniqueValues([
        ...tableGroup.familyIds,
        document.familyId,
      ]);
      map.set(key, tableGroup);
    }

    return [...map.values()]
      .map((group) => ({
        ...group,
        beneficiaries: group.isOrganization
          ? []
          : this.buildBeneficiaryGroups(group.documents),
      }))
      .sort(
        (a, b) =>
          Number(a.isOrganization) - Number(b.isOrganization) ||
          a.label.localeCompare(b.label),
      );
  }

  buildBeneficiaryGroups(rows: DocumentListItem[]): BeneficiaryDocumentGroup[] {
    const map = new Map<string, BeneficiaryDocumentGroup>();

    for (const document of rows) {
      const key = String(document.beneficiaryId || "__without_beneficiary__");
      const group = map.get(key) || {
        key,
        beneficiaryId: document.beneficiaryId || null,
        title: this.getBeneficiaryTitle(document),
        subtitle: document.beneficiaryId
          ? `ID ${document.beneficiaryId}`
          : "Bénéficiaire non renseigné",
        documents: [],
        familyIds: [],
      };

      group.documents.push(document);
      group.familyIds = this.uniqueValues([
        ...group.familyIds,
        document.familyId,
      ]);
      map.set(key, group);
    }

    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  getBeneficiaryTitle(document: DocumentListItem): string {
    const title = [
      document.beneficiaryDisplayValue1,
      document.beneficiaryDisplayValue2,
    ]
      .filter((value) => !!String(value || "").trim())
      .join(" - ");

    return title || document.beneficiaryId || "Bénéficiaire";
  }

  private getBeneficiaryTableLabel(
    document: DocumentListItem,
    families: FamilyRecord[],
  ): string {
    return (
      document.beneficiaryTableLabel ||
      families.find((family) => family.id === document.familyId)
        ?.beneficiaryTableLabel ||
      document.beneficiaryTable ||
      "Table bénéficiaire"
    );
  }

  private uniqueValues(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => !!value))];
  }
}
