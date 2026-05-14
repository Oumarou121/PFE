import { Component, Input, Output, EventEmitter, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableViewConfig } from "../../../../models/table-view.model";
import {
  TableViewFilter,
  TableFilterOption,
  TableFilterSourceType,
  TableFilterSqlBuilder,
} from "../../../../../../services/table-filters.service";

interface TableSchema {
  tables: Array<{ name: string; comment?: string }>;
  columns: Array<{
    table: string;
    name: string;
    type: string;
    comment?: string;
  }>;
}

@Component({
  selector: "app-table-view-filters-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filters-config-container">
      <div class="card" *ngIf="!view">
        <div class="card-body text-muted">
          Sélectionnez une vue de données pour configurer les filtres
        </div>
      </div>

      <div class="card" *ngIf="view">
        <div class="card-header">
          <div class="card-title">Filtres de données</div>
          <div class="card-subtitle">
            Configurez les critères de filtrage disponibles aux utilisateurs
          </div>
        </div>

        <div class="card-body">
          <div class="filters-toolbar">
            <div class="text-muted">
              Créez un filtre statique ou basé sur une table SQL.
            </div>
            <button class="btn primary" type="button" (click)="addFilter()">
              + Ajouter un filtre
            </button>
          </div>

          <!-- Liste des filtres -->
          <div class="filters-list">
            <div
              class="filter-item"
              *ngFor="let filter of view.filters; let i = index"
              [class.disabled]="!filter.enabled"
            >
              <div class="filter-header">
                <div class="filter-info">
                  <div style="font-weight: 600">{{ filter.name }}</div>
                  <div class="text-muted" style="font-size: 12px">
                    {{ filter.linkColumn }} •
                    {{
                      filter.sourceType === "Static" ? "Statique" : "Table SQL"
                    }}
                  </div>
                </div>
                <div class="filter-actions">
                  <label style="display: flex; align-items: center; gap: 6px">
                    <input
                      type="checkbox"
                      [checked]="filter.enabled"
                      (change)="toggleFilter(i, $any($event.target).checked)"
                    />
                    <span style="font-size: 12px">Actif</span>
                  </label>
                  <button
                    class="btn small danger"
                    type="button"
                    (click)="removeFilter(i)"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              <!-- Configuration du filtre -->
              <div class="filter-config">
                <div class="form-grid c2">
                  <div class="form-row">
                    <label class="form-label">Nom du filtre</label>
                    <input
                      class="form-input"
                      [(ngModel)]="filter.name"
                      placeholder="Ex: Statut"
                    />
                  </div>

                  <div class="form-row">
                    <label class="form-label">Colonne à filtrer</label>
                    <select class="form-input" [(ngModel)]="filter.linkColumn">
                      <option value="">Choisir une colonne</option>
                      <option
                        *ngFor="let col of getTableColumnsForView()"
                        [value]="col.name"
                      >
                        {{ col.comment || col.name }}
                      </option>
                    </select>
                  </div>

                  <div class="form-row" style="grid-column: span 2">
                    <label class="form-label">Description (optionnel)</label>
                    <input
                      class="form-input"
                      [(ngModel)]="filter.helpText"
                      placeholder="Ex: Filtrer les documents par statut"
                    />
                  </div>

                  <div class="form-row" style="grid-column: span 2">
                    <label class="form-label">Type de source</label>
                    <div style="display: flex; gap: 12px; margin-top: 8px">
                      <label
                        style="display: flex; align-items: center; gap: 6px"
                      >
                        <input
                          type="radio"
                          [value]="'Static'"
                          [ngModel]="filter.sourceType"
                          (change)="setFilterSourceType(i, 'Static')"
                        />
                        <span>Listes prédéfinies (Statique)</span>
                      </label>
                      <label
                        style="display: flex; align-items: center; gap: 6px"
                      >
                        <input
                          type="radio"
                          [value]="'Table'"
                          [ngModel]="filter.sourceType"
                          (change)="setFilterSourceType(i, 'Table')"
                        />
                        <span>Requête SQL (Table)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Configuration pour filtres STATIQUES -->
                <div
                  class="filter-section"
                  *ngIf="filter.sourceType === 'Static'"
                >
                  <div class="section-title">Options statiques</div>
                  <div class="options-editor">
                    <div
                      class="option-item"
                      *ngFor="let option of filter.staticOptions; let j = index"
                    >
                      <div class="form-grid c2" style="gap: 8px">
                        <input
                          class="form-input"
                          placeholder="Valeur"
                          [(ngModel)]="option.value"
                          style="font-size: 12px; padding: 6px"
                        />
                        <div style="display: flex; gap: 4px">
                          <input
                            class="form-input"
                            placeholder="Libellé"
                            [(ngModel)]="option.label"
                            style="flex: 1; font-size: 12px; padding: 6px"
                          />
                          <button
                            class="btn small danger"
                            type="button"
                            (click)="removeStaticOption(i, j)"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      class="btn small"
                      type="button"
                      (click)="addStaticOption(i)"
                    >
                      + Ajouter une option
                    </button>
                  </div>
                </div>

                <!-- Configuration pour filtres TABLE SQL -->
                <div
                  class="filter-section"
                  *ngIf="filter.sourceType === 'Table'"
                >
                  <div class="section-title">Source SQL</div>
                  <div class="form-grid c3">
                    <div class="form-row">
                      <label class="form-label">Table source</label>
                      <select
                        class="form-input"
                        [(ngModel)]="filter.sqlBuilder!.tableName"
                        (change)="ensureSqlBuilder(i)"
                      >
                        <option value="">Choisir une table</option>
                        <option
                          *ngFor="let table of getTablesForSchema()"
                          [value]="table.name"
                        >
                          {{ table.comment || table.name }}
                        </option>
                      </select>
                    </div>

                    <div class="form-row">
                      <label class="form-label">Colonne des valeurs</label>
                      <select
                        class="form-input"
                        [(ngModel)]="filter.sqlBuilder!.valueColumn"
                        (change)="ensureSqlBuilder(i)"
                      >
                        <option value="">Choisir une colonne</option>
                        <option
                          *ngFor="let col of getSqlBuilderColumns(i)"
                          [value]="col.name"
                        >
                          {{ col.comment || col.name }}
                        </option>
                      </select>
                    </div>

                    <div class="form-row">
                      <label class="form-label">Colonne des libellés</label>
                      <select
                        class="form-input"
                        [(ngModel)]="filter.sqlBuilder!.labelColumn"
                        (change)="ensureSqlBuilder(i)"
                      >
                        <option value="">Choisir une colonne</option>
                        <option
                          *ngFor="let col of getSqlBuilderColumns(i)"
                          [value]="col.name"
                        >
                          {{ col.comment || col.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div style="margin-top: 12px">
                    <label style="display: flex; align-items: center; gap: 6px">
                      <input
                        type="checkbox"
                        [(ngModel)]="filter.sqlBuilder!.distinct"
                      />
                      <span>Éliminer les doublons (DISTINCT)</span>
                    </label>
                  </div>

                  <!-- Preview de la requête SQL -->
                  <div class="sql-preview" *ngIf="filter.sqlBuilder?.tableName">
                    <div class="sql-preview-label">Aperçu SQL:</div>
                    <code
                      >SELECT DISTINCT {{ filter.sqlBuilder!.valueColumn }} AS
                      value, {{ filter.sqlBuilder!.labelColumn }} AS label FROM
                      {{ filter.sqlBuilder!.tableName }} ORDER BY label
                      ASC</code
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Message si aucun filtre -->
            <div
              class="text-muted"
              style="padding: 16px; text-align: center"
              *ngIf="!view.filters || view.filters.length === 0"
            >
              Aucun filtre configuré. Cliquez sur "Ajouter un filtre" pour en
              créer.
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .filters-config-container {
        width: 100%;
      }

      .filters-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .filters-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding: 12px 14px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 8px;
      }

      .filter-item {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        background: var(--surface);
        transition: opacity 0.2s;

        &.disabled {
          opacity: 0.6;
        }
      }

      .filter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
      }

      .filter-info {
        flex: 1;
      }

      .filter-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .filter-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .filter-section {
        padding: 12px;
        background: var(--surface2);
        border-radius: 6px;
        border-left: 3px solid var(--accent);
      }

      .section-title {
        font-weight: 600;
        margin-bottom: 12px;
        font-size: 14px;
        color: var(--text);
      }

      .options-editor {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .option-item {
        padding: 8px;
        background: white;
        border-radius: 4px;
        border: 1px solid var(--border);
      }

      .form-grid {
        display: grid;
        gap: 12px;

        &.c2 {
          grid-template-columns: repeat(2, 1fr);
        }

        &.c3 {
          grid-template-columns: repeat(3, 1fr);
        }

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }
      }

      .form-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
      }

      .form-input,
      select {
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 4px;
        font-size: 13px;
        background: white;
        font-family: inherit;

        &:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.1);
        }
      }

      .btn {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--surface2);
        color: var(--text2);

        &.primary {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);

          &:hover {
            background: var(--accent2);
            border-color: var(--accent2);
          }
        }

        &.small {
          padding: 4px 8px;
          font-size: 11px;
        }

        &.danger {
          background: var(--red-bg);
          color: var(--red);
          border-color: var(--red);

          &:hover {
            background: var(--red);
            color: #fff;
          }
        }
      }

      .sql-preview {
        margin-top: 12px;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 4px;
        border-left: 3px solid var(--info);

        .sql-preview-label {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--text2);
        }

        code {
          display: block;
          padding: 8px;
          background: white;
          border-radius: 3px;
          font-size: 11px;
          font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
          color: #d63384;
          word-break: break-all;
          border: 1px solid var(--border);
        }
      }

      .text-muted {
        color: var(--text2);
        font-size: 13px;
      }

      .card {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: white;
        margin-bottom: 16px;

        .card-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);

          .card-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
          }

          .card-subtitle {
            font-size: 12px;
            color: var(--text2);
            margin-top: 4px;
          }
        }

        .card-body {
          padding: 16px;
        }
      }
    `,
  ],
})
export class TableViewFiltersConfigComponent implements OnInit {
  @Input() view: TableViewConfig | null = null;
  @Input() schema: TableSchema | null = null;
  @Output() filterChange = new EventEmitter<TableViewConfig | null>();

  selectedFilterIndex: number = -1;

  ngOnInit() {
    // Initialiser les filtres si nécessaire
    if (this.view && !this.view.filters) {
      this.view.filters = [];
    }
    // S'assurer que tous les filtres ont les propriétés requises
    if (this.view?.filters) {
      this.view.filters.forEach((filter) => {
        if (!filter.staticOptions) {
          filter.staticOptions = [];
        }
        if (!filter.sqlBuilder) {
          filter.sqlBuilder = {
            tableName: "",
            valueColumn: "",
            labelColumn: "",
            distinct: true,
          };
        }
      });
    }
  }

  addFilter() {
    if (!this.view) return;
    if (!this.view.filters) {
      this.view.filters = [];
    }

    const newFilter: TableViewFilter = {
      id: `flt_${Date.now()}`,
      name: "Nouveau filtre",
      linkColumn: "",
      sourceType: TableFilterSourceType.Static,
      staticOptions: [{ value: "", label: "" }],
      sqlBuilder: {
        tableName: "",
        valueColumn: "",
        labelColumn: "",
        distinct: true,
      },
      enabled: true,
      helpText: "",
    };

    this.view.filters.push(newFilter);
    this.emitChange();
  }

  removeFilter(index: number) {
    if (!this.view || !this.view.filters) return;
    this.view.filters.splice(index, 1);
    this.emitChange();
  }

  toggleFilter(index: number, enabled: boolean) {
    if (!this.view?.filters?.[index]) return;
    this.view.filters[index].enabled = enabled;
    this.emitChange();
  }

  setFilterSourceType(index: number, sourceType: string) {
    if (!this.view?.filters?.[index]) return;
    const filter = this.view.filters[index];
    filter.sourceType = sourceType as TableFilterSourceType;

    if (sourceType === "Static" && !filter.staticOptions) {
      filter.staticOptions = [{ value: "", label: "" }];
    } else if (sourceType === "Table" && !filter.sqlBuilder) {
      filter.sqlBuilder = {
        tableName: "",
        valueColumn: "",
        labelColumn: "",
        distinct: true,
      };
    }
    this.emitChange();
  }

  ensureSqlBuilder(index: number) {
    if (!this.view?.filters?.[index]) return;
    const filter = this.view.filters[index];
    if (!filter.sqlBuilder) {
      filter.sqlBuilder = {
        tableName: "",
        valueColumn: "",
        labelColumn: "",
        distinct: true,
      };
    }
    this.emitChange();
  }

  addStaticOption(filterIndex: number) {
    if (!this.view?.filters?.[filterIndex]) return;
    const filter = this.view.filters[filterIndex];
    if (!filter.staticOptions) {
      filter.staticOptions = [];
    }
    filter.staticOptions.push({ value: "", label: "" });
    this.emitChange();
  }

  removeStaticOption(filterIndex: number, optionIndex: number) {
    if (!this.view?.filters?.[filterIndex]?.staticOptions) return;
    this.view.filters[filterIndex].staticOptions!.splice(optionIndex, 1);
    this.emitChange();
  }

  getTableColumnsForView(): any[] {
    if (!this.view || !this.schema) return [];
    return (
      this.schema.columns.filter((col) => col.table === this.view!.tableName) ||
      []
    );
  }

  getTablesForSchema(): any[] {
    return this.schema?.tables || [];
  }

  getSqlBuilderColumns(filterIndex: number): any[] {
    if (!this.view?.filters || !this.schema) return [];
    const selectedFilter = this.view.filters[filterIndex];
    if (!selectedFilter?.sqlBuilder) return [];
    return (
      this.schema.columns.filter(
        (col) => col.table === selectedFilter.sqlBuilder?.tableName,
      ) || []
    );
  }

  private emitChange() {
    this.filterChange.emit(this.view);
  }
}
