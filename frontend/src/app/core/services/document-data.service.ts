import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { OrganizationRecord } from './organization.service';
import { FamilyRecord } from './template.service';

interface SchemaColumn {
  table: string;
  name: string;
  key?: string;
}

interface SchemaResponse {
  schema?: {
    columns?: SchemaColumn[];
  };
}

interface QueryResponse {
  rows?: Record<string, unknown>[];
}

export interface BeneficiaryRecord extends Record<string, unknown> {
  id: string;
  _displayLabel: string;
  _displaySubtitle?: string;
  _sourceTable?: string | null;
}

export interface DynamicFilterOption {
  value: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentDataService {
  private schemaCache: SchemaResponse['schema'] | null = null;

  constructor(private readonly api: ApiService) {}

  async getBeneficiaries(
    family: FamilyRecord,
    organization: OrganizationRecord | null,
    filters: Record<string, unknown> = {}
  ): Promise<BeneficiaryRecord[]> {
    if (this.isOrganizationFamily(family)) {
      return organization
        ? [{
            ...organization,
            id: String(organization.id),
            _displayLabel: organization.nom || 'Organization',
            _displaySubtitle: organization.ville || '',
            _sourceTable: 'organization'
          }]
        : [];
    }

    const tableName = family.beneficiaryTable || null;
    if (family.beneficiarySql) {
      const rows = await this.query(family.beneficiarySql, {
        organizationId: organization?.id ?? null,
        ...filters
      });
      return this.normalizeBeneficiaries(rows, family, tableName);
    }

    if (!tableName) return [];

    const schema = await this.getSchema();
    const columns = this.columnsForTable(schema, tableName);
    if (!columns.length) return [];

    const pk = this.linkColumn(family, columns);
    const displayColumns = this.displayColumns(family, columns);
    const orderColumn = displayColumns[0] || this.defaultLabelColumn(columns) || pk;
    const organizationColumn = columns.find(column => column.name === 'etablissement_id');
    const labelExpr = this.labelSqlExpression(displayColumns);
    const sql = `SELECT TOP (500)
      src.${this.quote(pk)} AS id${labelExpr ? `, ${labelExpr} AS libelle` : ''}
      FROM ${this.quote(tableName)} src${organizationColumn && organization?.id ? ` WHERE src.${this.quote(organizationColumn.name)} = :organizationId` : ''}
      ORDER BY src.${this.quote(orderColumn)} ASC`;

    const rows = await this.query(sql, {
      organizationId: organization?.id ?? null,
      ...filters
    });
    return this.normalizeBeneficiaries(rows, family, tableName, pk);
  }

  async getDocumentData(
    family: FamilyRecord,
    beneficiary: BeneficiaryRecord | null,
    organization: OrganizationRecord | null,
    filters: Record<string, unknown> = {}
  ): Promise<Record<string, unknown> | null> {
    if (this.isOrganizationFamily(family)) return organization ? { ...organization } as Record<string, unknown> : null;
    if (!beneficiary) return null;

    const tableName = family.beneficiaryTable || null;
    let baseRecord: Record<string, unknown> = { ...beneficiary };
    if (tableName) {
      const schema = await this.getSchema();
      const columns = this.columnsForTable(schema, tableName);
      const pk = this.linkColumn(family, columns);
      const rows = await this.query(`SELECT TOP (1) * FROM ${this.quote(tableName)} WHERE ${this.quote(pk)} = :beneficiaryId`, {
        beneficiaryId: beneficiary.id
      });
      baseRecord = rows[0] ? { ...rows[0] } : baseRecord;
    }

    if (!family.sql) return baseRecord;

    const rows = await this.query(family.sql, {
      id: beneficiary.id,
      personId: beneficiary.id,
      beneficiaryId: beneficiary.id,
      organizationId: organization?.id ?? null,
      ...filters
    });
    return rows[0] ? { ...baseRecord, ...rows[0] } : baseRecord;
  }

  async getFilterOptions(filter: {
    sourceType?: string;
    sqlQuery?: string;
    sqlBuilder?: {
      tableName?: string;
      table?: string;
      valueColumn?: string;
      value?: string;
      labelColumn?: string;
      label?: string;
      distinct?: boolean;
    };
  }, organizationId: string | number | null): Promise<DynamicFilterOption[]> {
    const sql = this.buildFilterSql(filter);
    if (!sql) return [];
    const rows = await this.query(sql, { organizationId });
    return rows
      .map((row, index) => {
        const value = row['value'] ?? row['id'] ?? row['code'] ?? Object.values(row)[0] ?? index + 1;
        const label = row['label'] ?? row['libelle'] ?? row['nom'] ?? row['name'] ?? Object.values(row)[1] ?? value;
        return {
          value: String(value ?? '').trim(),
          label: String(label ?? value ?? '').trim()
        };
      })
      .filter(option => option.value);
  }

  private async getSchema(): Promise<SchemaResponse['schema']> {
    if (this.schemaCache) return this.schemaCache;
    const payload = await firstValueFrom(this.api.get<SchemaResponse>('schema'));
    this.schemaCache = payload.schema ?? { columns: [] };
    return this.schemaCache;
  }

  private async query(sql: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const payload = await firstValueFrom(this.api.post<QueryResponse>('query', { sql, params }));
    return Array.isArray(payload.rows) ? payload.rows : [];
  }

  private buildFilterSql(filter: {
    sourceType?: string;
    sqlQuery?: string;
    sqlBuilder?: {
      tableName?: string;
      table?: string;
      valueColumn?: string;
      value?: string;
      labelColumn?: string;
      label?: string;
      distinct?: boolean;
    };
  }): string {
    if (String(filter.sourceType || '').toLowerCase() === 'sql' && filter.sqlQuery) {
      return filter.sqlQuery;
    }

    const builder = filter.sqlBuilder;
    if (!builder) return '';
    const tableName = String(builder.tableName || builder.table || '').trim();
    const valueColumn = String(builder.valueColumn || builder.value || '').trim();
    const labelColumn = String(builder.labelColumn || builder.label || valueColumn).trim();
    if (!tableName || !valueColumn) return '';
    const distinct = builder.distinct !== false ? 'DISTINCT ' : '';
    return `SELECT ${distinct}${this.quote(valueColumn)} AS value, ${this.quote(labelColumn)} AS label FROM ${this.quote(tableName)} ORDER BY ${this.quote(labelColumn)} ASC`;
  }

  private isOrganizationFamily(family: FamilyRecord): boolean {
    return String(family.beneficiaryMode || '').toLowerCase() === 'organization';
  }

  private columnsForTable(schema: SchemaResponse['schema'], tableName: string): SchemaColumn[] {
    return (schema?.columns || []).filter(column => column.table === tableName);
  }

  private linkColumn(family: FamilyRecord, columns: SchemaColumn[]): string {
    const configured = String(family.beneficiaryLinkColumn || '').trim();
    if (configured && columns.some(column => column.name === configured)) return configured;
    return columns.find(column => column.key === 'PRI')?.name || 'id';
  }

  private displayColumns(family: FamilyRecord, columns: SchemaColumn[]): string[] {
    const available = new Set(columns.map(column => column.name));
    return [family.beneficiaryDisplayColumn1, family.beneficiaryDisplayColumn2]
      .map(value => String(value || '').trim())
      .filter((value, index, list) => value && available.has(value) && list.indexOf(value) === index);
  }

  private defaultLabelColumn(columns: SchemaColumn[]): string | null {
    const names = ['nom_prenom', 'nom_complet', 'display_name', 'full_name', 'nom', 'libelle', 'intitule'];
    return columns.find(column => names.includes(column.name))?.name ?? null;
  }

  private labelSqlExpression(columns: string[]): string {
    if (!columns.length) return '';
    const parts = columns.map(column => `COALESCE(CONVERT(NVARCHAR(255), src.${this.quote(column)}), '')`);
    return parts.length === 1 ? parts[0] : `LTRIM(RTRIM(${parts.join(` + ' ' + `)}))`;
  }

  private normalizeBeneficiaries(
    rows: Record<string, unknown>[],
    family: FamilyRecord,
    tableName: string | null,
    fallbackIdColumn = 'id'
  ): BeneficiaryRecord[] {
    const displayColumns = [family.beneficiaryDisplayColumn1, family.beneficiaryDisplayColumn2]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    return rows
      .filter(row => row && String(row['id'] ?? row[fallbackIdColumn] ?? '').trim())
      .map(row => {
        const label = this.labelFromColumns(row, displayColumns) || this.guessLabel(row);
        return {
          ...row,
          id: String(row['id'] ?? row[fallbackIdColumn]),
          _displayLabel: label,
          _displaySubtitle: this.guessSubtitle(row, label),
          _sourceTable: tableName
        };
      });
  }

  private labelFromColumns(row: Record<string, unknown>, columns: string[]): string {
    return columns
      .map(column => row[column])
      .filter(value => value !== undefined && value !== null && String(value).trim())
      .map(value => String(value).trim())
      .join(' ')
      .trim();
  }

  private guessLabel(row: Record<string, unknown>): string {
    for (const key of ['nom_prenom', 'nom_complet', 'display_name', 'full_name', 'libelle', 'intitule', 'titre', 'nom']) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    const fullName = [row['prenom'], row['nom']].filter(value => value !== undefined && value !== null && String(value).trim()).join(' ').trim();
    if (fullName) return fullName;
    const fallbackKey = Object.keys(row).find(key => !key.startsWith('_') && row[key] !== undefined && row[key] !== null && typeof row[key] !== 'object' && String(row[key]).trim());
    return fallbackKey ? String(row[fallbackKey]).trim() : 'Beneficiaire';
  }

  private guessSubtitle(row: Record<string, unknown>, label: string): string {
    const value = ['sous_libelle', 'poste', 'fonction', 'grade', 'departement', 'service', 'email', 'code', 'matricule']
      .map(key => row[key])
      .find(item => item !== undefined && item !== null && String(item).trim());
    const subtitle = value ? String(value).trim() : '';
    return subtitle === label ? '' : subtitle;
  }

  private quote(name: string): string {
    return `[${String(name || '').replace(/]/g, ']]')}]`;
  }
}
