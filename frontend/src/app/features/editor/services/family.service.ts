import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../../../core/services/api.service";
import { BeneficiaryRecord, FamilyRecord } from "../models/family.model";
import { FilterValueMap } from "../models/filter.model";
import {
  buildBeneficiaryLabelSqlExpr,
  buildDocumentFilterParams,
  getConfiguredBeneficiaryDisplayColumns,
  getConfiguredBeneficiaryLinkColumn,
  getFamilyFilterCatalog,
  getScopedOrganizationId,
  getSchemaColumn,
  getSchemaColumnsForTable,
  isScopedOrganizationFamily,
  normalizeFilterColumnBindings,
  normalizeFilterParamName,
  normalizeFamilyRecord,
  quoteSqlIdentifier,
  toBeneficiaryRecord,
  ORGANIZATION_SCOPE_COLUMN,
} from "./editor-normalizers";
import { EditorStateService } from "./editor-state.service";
import { QueryService } from "./query.service";
import { SchemaService } from "./schema.service";

@Injectable({ providedIn: "root" })
export class FamilyService {
  constructor(
    private api: ApiService,
    private state: EditorStateService,
    private query: QueryService,
    private schemaService: SchemaService,
  ) {}

  getFamilies(): FamilyRecord[] {
    return this.state.getState().families;
  }

  getFamily(id: string | null | undefined): FamilyRecord | null {
    return this.getFamilies().find((family) => family.id === id) || null;
  }

  async saveFamily(family: FamilyRecord): Promise<FamilyRecord> {
    const normalized = normalizeFamilyRecord(family);
    await firstValueFrom(
      this.api.put(`families/${encodeURIComponent(normalized.id)}`, normalized),
    );

    const state = this.state.getState();
    const index = state.families.findIndex((item) => item.id === normalized.id);
    index >= 0
      ? state.families.splice(index, 1, normalized)
      : state.families.push(normalized);
    this.state.replaceState(state);

    return normalized;
  }

  save(family: FamilyRecord): Observable<FamilyRecord> {
    return from(this.saveFamily(family));
  }

  async deleteFamily(id: string): Promise<void> {
    await firstValueFrom(this.api.delete(`families/${encodeURIComponent(id)}`));

    const state = this.state.getState();
    state.families = state.families.filter((family) => family.id !== id);
    state.templates = state.templates.filter(
      (template) => template.familyId !== id,
    );
    this.state.replaceState(state);
  }

  delete(id: string): Observable<void> {
    return from(this.deleteFamily(id));
  }

  async getBeneficiariesForFamily(
    familyId: string,
    organizationId: string | null = null,
    filters: FilterValueMap = {},
  ): Promise<BeneficiaryRecord[]> {
    const family = this.getFamily(familyId);
    if (!family) return [];
    const filterParams = buildDocumentFilterParams(
      filters,
      getFamilyFilterCatalog(family),
    );
    if (isScopedOrganizationFamily(family)) {
      const organization = organizationId
        ? this.state
            .getState()
            .organizations.find((item) => item.id === organizationId)
        : null;
      return organization
        ? [
            {
              ...organization,
              id: String(organization.id),
              _displayLabel:
                organization.nom || organization.name || "Organization",
              _displaySubtitle: organization.ville || organization.city || "",
              _sourceTable: "organization",
            },
          ]
        : [];
    }
    const tableName = family.beneficiaryTable;
    if (!tableName && !family.beneficiarySql) return [];
    const schema = await this.schemaService.getSchema();
    const displayColumns = getConfiguredBeneficiaryDisplayColumns(
      family,
      schema,
      tableName,
    );
    if (family.beneficiarySql) {
      console.log("Using custom beneficiary SQL for family", family.sql);
      console.log("Beneficiary SQL:", family.beneficiarySql, "Params:", {
        organizationId,
        ...filterParams,
      });
      const rows = await this.query.runSelect(family.beneficiarySql, {
        organizationId,
        ...filterParams,
      });
      return rows
        .filter(
          (row) =>
            row?.["id"] !== undefined &&
            row?.["id"] !== null &&
            String(row["id"]).trim(),
        )
        .map((row) => toBeneficiaryRecord(row, displayColumns, tableName));
    }
    const columns = getSchemaColumnsForTable(schema, tableName!);
    if (!columns.length) return [];
    const pk = getConfiguredBeneficiaryLinkColumn(family, schema, tableName!);
    const defaultOrderColumn =
      displayColumns[0] ||
      columns.find((column) =>
        [
          "nom_prenom",
          "nom_complet",
          "display_name",
          "full_name",
          "nom",
          "libelle",
          "intitule",
        ].includes(column.name),
      )?.name ||
      pk;
    const organizationColumn = getSchemaColumn(
      schema,
      tableName!,
      ORGANIZATION_SCOPE_COLUMN,
    );
    const filterClauses = this.buildFilterClausesForTable(family, tableName!);
    const labelSqlExpr = buildBeneficiaryLabelSqlExpr(displayColumns, "src");
    const whereClauses = [
      organizationColumn && organizationId
        ? `src.${quoteSqlIdentifier(organizationColumn.name)} = :organizationId`
        : "",
      ...filterClauses,
    ].filter(Boolean);
    const sql = `SELECT
             src.${quoteSqlIdentifier(pk)} AS id${labelSqlExpr ? `,\n             ${labelSqlExpr} AS libelle` : ""}
           FROM ${quoteSqlIdentifier(tableName)} src${whereClauses.length ? `\n           WHERE ${whereClauses.join("\n             AND ")}` : ""}
           ORDER BY src.${quoteSqlIdentifier(defaultOrderColumn)} ASC`;
    console.log("Beneficiary SQL:", sql, "Params:", {
      organizationId,
      ...filterParams,
    });
    const rows = await this.query.runSelect(sql, {
      organizationId,
      ...filterParams,
    });
    return rows
      .filter((row) => row?.["id"] !== undefined || row?.[pk] !== undefined)
      .map((row) => toBeneficiaryRecord(row, displayColumns, tableName, pk));
  }

  private buildFilterClausesForTable(
    family: FamilyRecord,
    tableName: string,
  ): string[] {
    return getFamilyFilterCatalog(family)
      .flatMap((filter) =>
        normalizeFilterColumnBindings(
          filter.columnBindings || [],
          filter.columnBinding || {},
        ).map((binding) => ({ filter, binding })),
      )
      .filter(
        ({ binding }) => binding.tableName === tableName && binding.columnName,
      )
      .map(({ filter, binding }) => {
        const paramName = normalizeFilterParamName(
          filter.key || binding.columnName,
        );
        return `(:${paramName} IS NULL OR src.${quoteSqlIdentifier(binding.columnName)} = :${paramName})`;
      });
  }

  getTemplatesByOrganization(
    familyId: string,
    organizationId: string,
  ): unknown[] {
    return this.state
      .getState()
      .templates.filter(
        (template) =>
          template.familyId === familyId &&
          getScopedOrganizationId(template) === organizationId,
      );
  }
}
