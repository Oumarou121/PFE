import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from "@angular/forms";
import {
  TableFiltersService,
  TableViewFilter,
  TableFilterOption,
  TableFilterSourceType,
} from "../../../../services/table-filters.service";

/**
 * Composant pour afficher et gérer les filtres d'une TableViewConfig
 */
@Component({
  selector: "app-table-filters",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./table-filters.component.html",
  styleUrls: ["./table-filters.component.scss"],
})
export class TableFiltersComponent implements OnInit {
  @Input() filters: TableViewFilter[] = [];
  @Input() databaseName?: string;
  @Output() filterChange = new EventEmitter<{ [key: string]: string[] }>();

  filterForm: FormGroup;
  filterOptions: Map<string, TableFilterOption[]> = new Map();
  loadingFilters: Set<string> = new Set();
  errorMessages: Map<string, string> = new Map();

  // Enums pour le template
  TableFilterSourceType = TableFilterSourceType;

  constructor(
    private fb: FormBuilder,
    private filterService: TableFiltersService,
  ) {
    this.filterForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.initializeFilterForm();
    this.loadDynamicFilterOptions();
  }

  /**
   * Initialise le formulaire avec les filtres
   */
  private initializeFilterForm(): void {
    const enabledFilters = (this.filters || []).filter((f) => f.enabled);

    enabledFilters.forEach((filter) => {
      this.filterForm.addControl(filter.id, new FormControl([]));

      // Si le filtre est statique, charger les options directement
      if (
        filter.sourceType === TableFilterSourceType.Static &&
        filter.staticOptions
      ) {
        this.filterOptions.set(filter.id, filter.staticOptions);
      }
    });

    // Émettre les changements de filtre
    this.filterForm.valueChanges.subscribe((values) => {
      const filterParams: { [key: string]: string[] } = {};
      Object.keys(values).forEach((key) => {
        const val = values[key];
        if (Array.isArray(val) && val.length > 0) {
          filterParams[key] = val;
        } else if (val && !Array.isArray(val) && String(val).trim() !== "") {
           filterParams[key] = [String(val)];
        }
      });
      this.filterChange.emit(filterParams);
    });
  }

  /**
   * Charge les options des filtres dynamiques (basés sur une table SQL)
   */
  private loadDynamicFilterOptions(): void {
    const dynamicFilters = (this.filters || []).filter(
      (f) => f.enabled && f.sourceType === TableFilterSourceType.Table,
    );

    dynamicFilters.forEach((filter) => {
      this.reloadFilterOptions(filter.id);
    });
  }

  /**
   * Obtient les options d'un filtre
   */
  getFilterOptions(filterId: string): TableFilterOption[] {
    return this.filterOptions.get(filterId) || [];
  }

  /**
   * Obtient le filtre par son ID
   */
  getFilter(filterId: string): TableViewFilter | undefined {
    return (this.filters || []).find((f) => f.id === filterId);
  }

  /**
   * Réinitialise tous les filtres
   */
  resetFilters(): void {
    this.filterForm.reset();
  }

  /**
   * Vérifie si un filtre est en cours de chargement
   */
  isLoading(filterId: string): boolean {
    return this.loadingFilters.has(filterId);
  }

  /**
   * Obtient le message d'erreur d'un filtre
   */
  getErrorMessage(filterId: string): string | undefined {
    return this.errorMessages.get(filterId);
  }

  /**
   * Obtient le contrôle de formulaire pour un filtre
   */
  getControl(filterId: string): FormControl {
    return (this.filterForm.get(filterId) as FormControl) || new FormControl([]);
  }

  /**
   * Recharge les options d'un filtre dynamique
   */
  reloadFilterOptions(filterId: string): void {
    const filter = this.getFilter(filterId);
    if (!filter || filter.sourceType !== TableFilterSourceType.Table) {
      return;
    }

    this.loadingFilters.add(filterId);
    this.errorMessages.delete(filterId);

    this.filterService
      .getTableFilterOptions(filter, this.databaseName)
      .subscribe({
        next: (response: any) => {
          if (response.ok && response.options) {
            this.filterOptions.set(filterId, response.options);
          } else {
            this.errorMessages.set(filterId, response.error || "Erreur lors du rechargement");
          }
          this.loadingFilters.delete(filterId);
        },
        error: (err: any) => {
          this.errorMessages.set(filterId, err.message);
          this.loadingFilters.delete(filterId);
        },
      });
  }
}
