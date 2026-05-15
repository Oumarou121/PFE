import { Injectable } from '@angular/core';
import { UnknownRecord } from '../models/editor-common.model';
import { FilterValueMap } from '../models/filter.model';
import { buildDocumentFilterParams, getConfiguredBeneficiaryLinkColumn, getFamilyFilterCatalog, getFamilyListObjectVars, getSchemaColumnsForTable, isScopedOrganizationFamily, normalizeFilterColumnBindings, normalizeFilterParamName, quoteSqlIdentifier } from './editor-normalizers';
import { FamilyService } from './family.service';
import { OrganizationService } from './organization.service';
import { QueryService } from './query.service';
import { SchemaService } from './schema.service';

@Injectable({ providedIn: 'root' })
export class DocumentDataService {
  constructor(
    private families: FamilyService,
    private organizations: OrganizationService,
    private query: QueryService,
    private schemaService: SchemaService
  ) {}

  async getDocumentDataForFamily(
    familyId: string,
    beneficiaryId: string | null = null,
    organizationId: string | null = null,
    filters: FilterValueMap = {}
  ): Promise<UnknownRecord | null> {
    const family = this.families.getFamily(familyId);
    if (!family) return null;
    if (!isScopedOrganizationFamily(family) && !beneficiaryId) return null;
    let baseRecord: UnknownRecord = {};
    const tableName = family.beneficiaryTable;
    if (isScopedOrganizationFamily(family)) {
      baseRecord = organizationId ? this.organizations.getOrganization(organizationId) || {} : {};
    } else if (beneficiaryId && tableName) {
      const schema = await this.schemaService.getSchema();
      if (getSchemaColumnsForTable(schema, tableName).length) {
        const pk = getConfiguredBeneficiaryLinkColumn(family, schema, tableName);
        const filterClauses = this.buildFilterClausesForTable(family, tableName);
        const rows = await this.query.runSelect(
          `SELECT TOP (1) * FROM ${quoteSqlIdentifier(tableName)} WHERE ${[
            `${quoteSqlIdentifier(pk)} = :beneficiaryId`,
            ...filterClauses,
          ].join(' AND ')}`,
          {
            beneficiaryId,
            ...buildDocumentFilterParams(filters, getFamilyFilterCatalog(family)),
          }
        );
        baseRecord = rows?.[0] || {};
      }
    }
    if (!family.sql) {
      return this.hydrateListObjectVariables(familyId, baseRecord, beneficiaryId, organizationId, filters);
    }
    const rows = await this.query.runSelect(family.sql, {
      id: isScopedOrganizationFamily(family) ? organizationId : beneficiaryId,
      personId: beneficiaryId,
      beneficiaryId,
      organizationId,
      ...buildDocumentFilterParams(filters, getFamilyFilterCatalog(family))
    });
    return this.hydrateListObjectVariables(familyId, rows?.[0] ? { ...baseRecord, ...rows[0] } : baseRecord, beneficiaryId, organizationId, filters);
  }

  async getPersonDataForFamily(familyId: string, beneficiaryId: string, filters: FilterValueMap = {}, organizationId: string | null = null): Promise<UnknownRecord | null> {
    return this.getDocumentDataForFamily(familyId, beneficiaryId, organizationId, filters);
  }

  private async hydrateListObjectVariables(
    familyId: string,
    record: UnknownRecord,
    beneficiaryId: string | null,
    organizationId: string | null,
    filters: FilterValueMap
  ): Promise<UnknownRecord> {
    const family = this.families.getFamily(familyId);
    if (!family) return record;
    const next = { ...(record || {}) };
    const filterDefs = getFamilyFilterCatalog(family);
    for (const varDef of getFamilyListObjectVars(family)) {
      const tech = String(varDef.tech || '').trim();
      const sqlQuery = String(varDef.sqlQuery || '').trim();
      if (!tech || Array.isArray(next[tech])) continue;
      next[tech] = /^select\b/i.test(sqlQuery)
        ? await this.query.runSelect(sqlQuery, {
            id: isScopedOrganizationFamily(family) ? organizationId : beneficiaryId,
            personId: beneficiaryId,
            beneficiaryId,
            organizationId,
            ...buildDocumentFilterParams(filters, filterDefs)
          })
        : [];
    }
    return next;
  }

  private buildFilterClausesForTable(family: any, tableName: string): string[] {
    return getFamilyFilterCatalog(family)
      .flatMap((filter) =>
        normalizeFilterColumnBindings(
          filter.columnBindings || [],
          filter.columnBinding || {}
        ).map((binding) => ({ filter, binding }))
      )
      .filter(({ binding }) => binding.tableName === tableName && binding.columnName)
      .map(({ filter, binding }) => {
        const paramName = normalizeFilterParamName(filter.key || binding.columnName);
        return `(:${paramName} IS NULL OR ${quoteSqlIdentifier(binding.columnName)} = :${paramName})`;
      });
  }
}
