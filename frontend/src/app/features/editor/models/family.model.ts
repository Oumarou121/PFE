import type { FilterDefinition } from './filter.model';
import type { UnknownRecord } from './editor-common.model';

export interface VariableColumn {
  key?: string;
  label?: string;
  tech?: string;
  [key: string]: any;
}

export interface VariableDefinition {
  id?: string;
  label?: string;
  tech?: string;
  type?: string;
  sqlQuery?: string;
  columns?: VariableColumn[];
  [key: string]: any;
}

export interface FamilyClass {
  id?: string;
  nom?: string;
  name?: string;
  vars?: VariableDefinition[];
  [key: string]: any;
}

export interface FamilyRecord extends UnknownRecord {
  id: string;
  nom?: string;
  name?: string;
  beneficiaryMode: 'organization' | 'table';
  beneficiaryTable: string | null;
  beneficiaryTableLabel: string;
  beneficiaryDisplayColumn1: string;
  beneficiaryDisplayColumn2: string;
  beneficiaryLinkColumn: string;
  beneficiarySql: string;
  filterCatalog: FilterDefinition[];
  classes?: FamilyClass[];
  sql?: string;
}

export interface BeneficiaryRecord extends UnknownRecord {
  id: string;
  _displayLabel: string;
  _displaySubtitle: string;
  _sourceTable?: string | null;
}
