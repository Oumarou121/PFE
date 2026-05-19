import {
  Component,
  OnInit,
  OnChanges,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
} from "@angular/forms";
import { debounceTime } from "rxjs/operators";
import {
  TableFiltersService,
  TableViewFilter,
  TableFilterOption,
  TableFilterSourceType,
} from "../../../../services/table-filters.service";

@Component({
  selector: "app-table-filters",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./table-filters.component.html",
  styleUrls: ["./table-filters.component.scss"],
})
export class TableFiltersComponent implements OnInit, OnChanges {
  @Input() filters: TableViewFilter[] | null | undefined = [];
  @Input() databaseName?: string;
  @Input() optionRestrictions: Record<string, string[]> | null = null;
  @Output() filterChange = new EventEmitter<{ [key: string]: string[] }>();

  filterForm: FormGroup;
  filterOptions: Map<string, TableFilterOption[]> = new Map();
  loadingFilters: Set<string> = new Set();
  errorMessages: Map<string, string> = new Map();
  private lastFiltersSignature = "";
  private lastRestrictionSignature = "";

  // Enums pour le template
  TableFilterSourceType = TableFilterSourceType;

  constructor(
    private fb: FormBuilder,
    private filterService: TableFiltersService,
  ) {
    this.filterForm = this.fb.group({});
  }

  trackByOptionValue(_index: number, option: TableFilterOption): string {
    return option.value;
  }

  ngOnInit(): void {
    this.initializeFilterForm();
    this.loadDynamicFilterOptions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["filters"] && !changes["filters"].firstChange) {
      const signature = this.getFiltersSignature();
      if (signature === this.lastFiltersSignature) return;
      this.lastFiltersSignature = signature;
      this.initializeFilterForm();
      this.loadDynamicFilterOptions();
      return;
    }

    if (
      changes["optionRestrictions"] &&
      !changes["optionRestrictions"].firstChange
    ) {
      const signature = this.getRestrictionSignature();
      if (signature === this.lastRestrictionSignature) return;
      this.lastRestrictionSignature = signature;
      this.applyRestrictionsToLoadedOptions();
    }
  }

  /**
   * Initialise le formulaire avec les filtres
   */
  private initializeFilterForm(): void {
    this.filterForm = this.fb.group({});
    this.filterOptions.clear();
    this.loadingFilters.clear();
    this.errorMessages.clear();
    this.lastFiltersSignature = this.getFiltersSignature();
    this.lastRestrictionSignature = this.getRestrictionSignature();

    const enabledFilters = (this.filters || []).filter((f) => f.enabled);

    enabledFilters.forEach((filter) => {
      this.filterForm.addControl(filter.id, new FormControl(""));

      // Si le filtre est statique, charger les options directement
      if (
        filter.sourceType === TableFilterSourceType.Static &&
        filter.staticOptions
      ) {
        this.filterOptions.set(
          filter.id,
          this.applyOptionRestriction(filter, filter.staticOptions),
        );
      }
    });

    // Émettre les changements de filtre (avec debounce pour éviter
    // le rechargement immédiat qui ré-render le parent et ferme
    // les listes déroulantes)
    this.filterForm.valueChanges.pipe(debounceTime(250)).subscribe((values) => {
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

  trackByFilterId(_index: number, filter: TableViewFilter): string {
    return filter.id;
  }

  /**
   * Réinitialise tous les filtres
   */
  resetFilters(): void {
    this.filterForm.reset(
      Object.fromEntries(
        Object.keys(this.filterForm.controls).map((key) => [key, ""]),
      ),
    );
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
    return (
      (this.filterForm.get(filterId) as FormControl) || new FormControl("")
    );
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
          const options =
            response?.options ||
            response?.data ||
            response?.Options ||
            response?.Data;

          if (response?.ok && Array.isArray(options)) {
            this.filterOptions.set(
              filterId,
              this.applyOptionRestriction(filter, options),
            );
            this.errorMessages.delete(filterId);
          } else {
            this.errorMessages.set(
              filterId,
              response?.error || "Erreur lors du rechargement",
            );
          }
          this.loadingFilters.delete(filterId);
        },
        error: (err: any) => {
          this.errorMessages.set(filterId, err.message);
          this.loadingFilters.delete(filterId);
        },
      });
  }

  private applyRestrictionsToLoadedOptions(): void {
    (this.filters || []).forEach((filter) => {
      const currentOptions = this.filterOptions.get(filter.id);
      if (!currentOptions) return;
      this.filterOptions.set(
        filter.id,
        this.applyOptionRestriction(filter, currentOptions),
      );
    });
  }

  private applyOptionRestriction(
    filter: TableViewFilter,
    options: TableFilterOption[] = [],
  ): TableFilterOption[] {
    const allowedValues =
      this.optionRestrictions?.[filter.id] ||
      this.optionRestrictions?.[filter.linkColumn] ||
      [];
    if (!allowedValues.length) return options;

    const allowed = new Set(allowedValues.map((value) => String(value)));
    return options.filter((option) => allowed.has(String(option.value)));
  }

  private getRestrictionSignature(): string {
    const restrictions = this.optionRestrictions || {};
    return Object.keys(restrictions)
      .sort()
      .map((key) => `${key}:${(restrictions[key] || []).join(",")}`)
      .join("|");
  }

  private getFiltersSignature(): string {
    return (this.filters || [])
      .map((filter) =>
        [
          filter.id || "",
          filter.linkColumn || "",
          filter.sourceType || "",
          filter.enabled ? "1" : "0",
        ].join(":"),
      )
      .join("|");
  }
}
