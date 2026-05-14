import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

export interface TableFilterOption {
  value: string;
  label: string;
}

export interface TableFilterSqlBuilder {
  tableName: string;
  valueColumn: string;
  labelColumn: string;
  distinct?: boolean;
}

export enum TableFilterSourceType {
  Static = "Static",
  Table = "Table",
}

export interface TableViewFilter {
  id: string;
  name: string;
  linkColumn: string;
  sourceType: TableFilterSourceType;
  staticOptions?: TableFilterOption[];
  sqlBuilder?: TableFilterSqlBuilder;
  helpText?: string;
  enabled: boolean;
}

export interface TableViewFilterConfig {
  filters: TableViewFilter[];
  tableViewConfigId: string;
}

export interface GetFilterOptionsRequest {
  filter: TableViewFilter;
  databaseName?: string;
}

/**
 * Service pour gérer les filtres de TableViewConfig
 * Supporte les filtres statiques et dynamiques basés sur une table SQL
 */
@Injectable({
  providedIn: "root",
})
export class TableFiltersService {
  private apiUrl = "/api/editor";

  constructor(private http: HttpClient) {}

  /**
   * Obtient les filtres d'une TableViewConfig
   */
  getTableViewFilters(tableViewConfigId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/table-view-config/${tableViewConfigId}/filters`,
    );
  }

  /**
   * Obtient les options dynamiques d'un filtre basé sur une table SQL
   */
  getTableFilterOptions(
    filter: TableViewFilter,
    databaseName?: string,
  ): Observable<any> {
    const request: GetFilterOptionsRequest = {
      filter,
      databaseName,
    };
    return this.http.post(`${this.apiUrl}/table-view-filters/options`, request);
  }

  /**
   * Filtre une liste d'options basée sur une requête de recherche
   */
  filterOptions(
    options: TableFilterOption[],
    searchTerm: string,
  ): TableFilterOption[] {
    if (!searchTerm) return options;

    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term),
    );
  }

  /**
   * Construit une clause WHERE SQL pour un filtre
   */
  buildFilterWhereClause(
    filter: TableViewFilter,
    selectedValues: string[],
  ): string {
    if (!selectedValues || selectedValues.length === 0) {
      return "";
    }

    const columnName = filter.linkColumn;
    const placeholders = selectedValues
      .map((_, i) => `@filter_${filter.id}_${i}`)
      .join(",");

    return `${columnName} IN (${placeholders})`;
  }

  /**
   * Valide la configuration d'un filtre
   */
  validateFilterConfig(filter: TableViewFilter): boolean {
    if (!filter.id || !filter.name || !filter.linkColumn) {
      return false;
    }

    if (filter.sourceType === TableFilterSourceType.Static) {
      return !!(filter.staticOptions && filter.staticOptions.length > 0);
    } else if (filter.sourceType === TableFilterSourceType.Table) {
      const sqlBuilder = filter.sqlBuilder;
      return !!(
        sqlBuilder &&
        sqlBuilder.tableName &&
        sqlBuilder.valueColumn &&
        sqlBuilder.labelColumn
      );
    }

    return false;
  }
}
