/**
 * EXEMPLE D'INTÉGRATION COMPLÈTE DES FILTRES TABLEVIEWCONFIG
 *
 * Ce fichier montre comment utiliser le système de filtres dans un composant complet
 */

import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  TableFiltersService,
  TableFilterSourceType,
  TableViewFilter,
} from "../../../services/table-filters.service";

interface TableViewData {
  id: string;
  tableName: string;
  label: string;
  visibleFields: string[];
  editableFields: string[];
  filters: TableViewFilter[];
}

interface TableRow {
  [key: string]: any;
}

/**
 * Composant exemple montrant l'utilisation des filtres
 */
@Component({
  selector: "app-table-view-example",
  template: `
    <div class="container-fluid mt-4">
      <h2>{{ tableViewConfig?.label }}</h2>

      <!-- Section des filtres -->
      <app-table-filters
        *ngIf="tableViewConfig?.filters && tableViewConfig.filters.length > 0"
        [filters]="tableViewConfig.filters"
        [databaseName]="currentDatabase"
        (filterChange)="onFiltersChanged($event)"
      >
      </app-table-filters>

      <!-- Section des données -->
      <div class="data-section">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4>Données</h4>
          <button
            class="btn btn-primary btn-sm"
            (click)="refreshData()"
            [disabled]="isLoading"
          >
            <span
              *ngIf="isLoading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Actualiser
          </button>
        </div>

        <!-- Table de données -->
        <div class="table-responsive">
          <table
            class="table table-striped table-hover"
            *ngIf="tableRows.length > 0"
          >
            <thead>
              <tr>
                <th *ngFor="let field of tableViewConfig?.visibleFields">
                  {{ getFieldLabel(field) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of tableRows">
                <td *ngFor="let field of tableViewConfig?.visibleFields">
                  {{ getFormattedValue(row, field) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="tableRows.length === 0" class="alert alert-info">
            Aucune donnée ne correspond aux critères actuels
          </div>
        </div>

        <!-- Pagination (optionnel) -->
        <nav aria-label="Page navigation" *ngIf="totalPages > 1">
          <ul class="pagination justify-content-center">
            <li class="page-item" [class.disabled]="currentPage === 1">
              <a class="page-link" href="#" (click)="previousPage()"
                >Précédent</a
              >
            </li>
            <li class="page-item active">
              <span class="page-link">
                Page {{ currentPage }} sur {{ totalPages }}
              </span>
            </li>
            <li class="page-item" [class.disabled]="currentPage === totalPages">
              <a class="page-link" href="#" (click)="nextPage()">Suivant</a>
            </li>
          </ul>
        </nav>
      </div>

      <!-- Messages d'erreur -->
      <div
        *ngIf="error"
        class="alert alert-danger alert-dismissible fade show mt-3"
      >
        {{ error }}
        <button type="button" class="btn-close" (click)="error = null"></button>
      </div>
    </div>
  `,
  styles: [
    `
      .container-fluid {
        max-width: 1200px;
      }

      .data-section {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 0.375rem;
        padding: 1.5rem;
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
      }

      .table-responsive {
        max-height: 600px;
        overflow-y: auto;
      }

      h2 {
        margin-bottom: 2rem;
        border-bottom: 3px solid #0d6efd;
        padding-bottom: 0.5rem;
      }

      h4 {
        color: #495057;
      }
    `,
  ],
})
export class TableViewExampleComponent implements OnInit {
  tableViewConfig?: TableViewData;
  tableRows: TableRow[] = [];
  currentDatabase?: string;
  isLoading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  // Filtres actuels
  activeFilters: { [key: string]: string[] } = {};

  constructor(
    private route: ActivatedRoute,
    private filterService: TableFiltersService,
    // private apiService: YourApiService  // Service pour charger les données
  ) {}

  ngOnInit(): void {
    this.loadTableViewConfig();
  }

  /**
   * Charge la configuration de la table
   */
  private loadTableViewConfig(): void {
    const tableViewId = this.route.snapshot.paramMap.get("id");
    if (!tableViewId) {
      this.error = "ID de la table non spécifié";
      return;
    }

    // TODO: Remplacer par votre service d'API réel
    // this.apiService.getTableViewConfig(tableViewId).subscribe({
    //   next: (config) => {
    //     this.tableViewConfig = config;
    //     this.loadTableData();
    //   },
    //   error: (err) => {
    //     this.error = 'Erreur lors du chargement de la configuration: ' + err.message;
    //   }
    // });
  }

  /**
   * Gère le changement des filtres
   */
  onFiltersChanged(filters: { [key: string]: string[] }): void {
    this.activeFilters = filters;
    this.currentPage = 1; // Réinitialiser à la première page
    this.loadTableData();
  }

  /**
   * Charge les données de la table avec les filtres actuels
   */
  private loadTableData(): void {
    this.isLoading = true;
    this.error = null;

    // Construire la requête avec les filtres
    const filterClauses = this.buildFilterClauses();

    // TODO: Remplacer par votre service d'API réel
    // this.apiService.getTableData(
    //   this.tableViewConfig!.id,
    //   filterClauses,
    //   this.currentPage,
    //   this.pageSize
    // ).subscribe({
    //   next: (response) => {
    //     this.tableRows = response.rows;
    //     this.totalPages = response.totalPages;
    //     this.isLoading = false;
    //   },
    //   error: (err) => {
    //     this.error = 'Erreur lors du chargement des données: ' + err.message;
    //     this.isLoading = false;
    //   }
    // });
  }

  /**
   * Construit les clauses WHERE SQL basées sur les filtres actifs
   */
  private buildFilterClauses(): { [key: string]: string[] } {
    const clauses: { [key: string]: string[] } = {};

    Object.entries(this.activeFilters).forEach(([filterId, values]) => {
      const filter = this.tableViewConfig?.filters.find(
        (f) => f.id === filterId,
      );
      if (filter && values.length > 0) {
        clauses[filter.linkColumn] = values;
      }
    });

    return clauses;
  }

  /**
   * Récupère le libellé d'un champ
   */
  getFieldLabel(field: string): string {
    return this.tableViewConfig?.editableFields.includes(field)
      ? `${field} (éditable)`
      : field;
  }

  /**
   * Formate une valeur pour l'affichage
   */
  getFormattedValue(row: TableRow, field: string): any {
    const value = row[field];

    if (value === null || value === undefined) {
      return "—";
    }

    if (typeof value === "boolean") {
      return value ? "✓ Oui" : "✗ Non";
    }

    if (typeof value === "number") {
      return value.toLocaleString();
    }

    if (value instanceof Date) {
      return value.toLocaleDateString("fr-FR");
    }

    return value;
  }

  /**
   * Recharge les données
   */
  refreshData(): void {
    this.loadTableData();
  }

  /**
   * Navigation pagination
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadTableData();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadTableData();
    }
  }
}

/**
 * Exemple de réponse API pour les données
 */
interface TableDataResponse {
  rows: TableRow[];
  totalRows: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Exemple de structure de filtre complet
 */
export const EXAMPLE_FILTERS: TableViewFilter[] = [
  {
    id: "flt_status",
    name: "Statut",
    linkColumn: "status",
    sourceType: TableFilterSourceType.Static,
    staticOptions: [
      { value: "draft", label: "Brouillon" },
      { value: "published", label: "Publié" },
      { value: "archived", label: "Archivé" },
    ],
    helpText: "Filtrer les documents par statut",
    enabled: true,
  },
  {
    id: "flt_author",
    name: "Auteur",
    linkColumn: "author_id",
    sourceType: TableFilterSourceType.Table,
    sqlBuilder: {
      tableName: "users",
      valueColumn: "id",
      labelColumn: "full_name",
      distinct: true,
    },
    helpText: "Sélectionner un ou plusieurs auteurs",
    enabled: true,
  },
  {
    id: "flt_category",
    name: "Catégorie",
    linkColumn: "category_id",
    sourceType: TableFilterSourceType.Table,
    sqlBuilder: {
      tableName: "categories",
      valueColumn: "id",
      labelColumn: "name",
      distinct: true,
    },
    enabled: true,
  },
];
