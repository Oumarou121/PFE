# Système de Filtres TableViewConfig

## Vue d'ensemble

Ce système permet de filtrer les données d'une table en fonction de critères définis dans la configuration TableViewConfig. Les filtres peuvent être:

- **Statiques**: Liste prédéfinie de valeurs (radio, checkbox, select)
- **Dynamiques**: Options générées à partir d'une table SQL

## Architecture

### Backend (C#/.NET)

#### ValueObjects (EditorConfiguration.cs)

- `TableFilterSourceType` (enum): `Static` ou `Table`
- `TableFilterOption`: Paire `value` / `label`
- `TableFilterSqlBuilder`: Configuration SQL (table, colonnes)
- `TableViewFilter`: Définition complète du filtre

#### Entité (TableViewConfig.cs)

```csharp
public List<TableViewFilter> Filters { get; set; } = [];
```

#### Repository Methods

- `GetTableFilterOptionsAsync()`: Récupère les options dynamiques d'un filtre

#### Endpoints API

```
GET  /api/editor/table-view-config/{id}/filters
     → Récupère les filtres d'une TableViewConfig

POST /api/editor/table-view-filters/options
     Body: { filter: TableViewFilter, databaseName?: string }
     → Récupère les options dynamiques d'un filtre basé sur une table SQL
```

### Frontend (Angular)

#### Service (TableFiltersService)

- `getTableViewFilters()`: Charge les filtres d'une TableViewConfig
- `getTableFilterOptions()`: Récupère les options d'un filtre dynamique
- `buildFilterWhereClause()`: Construit une clause WHERE SQL
- `validateFilterConfig()`: Valide la configuration

#### Composant (TableFiltersComponent)

Affiche un formulaire de filtrage avec:

- Support des filtres statiques (checkbox/select)
- Support des filtres dynamiques (chargement asynchrone)
- Gestion des erreurs et état de chargement
- Réinitialisation des filtres

## Exemples d'utilisation

### 1. Filtre Statique

```json
{
  "id": "flt_status",
  "name": "Status",
  "linkColumn": "status",
  "sourceType": "Static",
  "staticOptions": [
    { "value": "active", "label": "Actif" },
    { "value": "inactive", "label": "Inactif" },
    { "value": "pending", "label": "En attente" }
  ],
  "helpText": "Filtrer par statut du document",
  "enabled": true
}
```

### 2. Filtre Dynamique (Table SQL)

```json
{
  "id": "flt_department",
  "name": "Département",
  "linkColumn": "department_id",
  "sourceType": "Table",
  "sqlBuilder": {
    "tableName": "departments",
    "valueColumn": "id",
    "labelColumn": "name",
    "distinct": true
  },
  "helpText": "Sélectionner un ou plusieurs départements",
  "enabled": true
}
```

### 3. Dans un Module Angular

```typescript
import { TableFiltersComponent } from "./components/table-filters/table-filters.component";
import { TableFiltersService } from "./services/table-filters.service";

@NgModule({
  declarations: [TableFiltersComponent],
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  providers: [TableFiltersService],
})
export class YourModule {}
```

### 4. Dans un Composant Parent

```typescript
export class TableViewComponent implements OnInit {
  tableViewConfig: TableViewConfigResponse;
  selectedFilters: { [key: string]: string[] } = {};

  ngOnInit() {
    // Charger la configuration de la table
    this.service.getTableViewConfig(id).subscribe((config) => {
      this.tableViewConfig = config;
    });
  }

  onFilterChange(filters: { [key: string]: string[] }) {
    this.selectedFilters = filters;
    // Recharger les données avec les filtres appliqués
    this.loadTableData();
  }

  loadTableData() {
    // Construire la requête avec les filtres
    // Ex: WHERE status IN ('active') AND department_id IN (1, 2, 3)
    this.service
      .getTableRows(this.tableViewConfig.id, this.selectedFilters)
      .subscribe((rows) => {
        this.tableRows = rows;
      });
  }
}
```

```html
<app-table-filters
  [filters]="tableViewConfig.filters"
  [databaseName]="currentTenant?.database"
  (filterChange)="onFilterChange($event)"
>
</app-table-filters>

<table class="table">
  <tbody>
    <tr *ngFor="let row of tableRows">
      <td *ngFor="let field of tableViewConfig.visibleFields">
        {{ row[field] }}
      </td>
    </tr>
  </tbody>
</table>
```

## Concepts clés

### Liaison de colonne (ColumnBinding)

Chaque filtre est lié à une colonne spécifique via `linkColumn`:

```
Filter: Status
LinkColumn: status_code
Query résultante: WHERE status_code IN (?, ?)
```

### Source de données

**Static**:

- Options définies dans la config
- Idéal pour des listes fixes (statuts, catégories prédéfinis)

**Table**:

- Options générées par requête SQL
- Idéal pour des références dynamiques (départements, utilisateurs)
- Support du `DISTINCT` pour éviter les doublons

### Gestion des erreurs

- Les erreurs de chargement des filtres dynamiques sont affichées
- Un bouton "Recharger" permet de réessayer
- Les filtres statiques continuent de fonctionner même en cas d'erreur

## Intégration dans un TableView complet

```typescript
interface TableViewConfiguration {
  id: string;
  name: string;
  tableName: string;
  visibleFields: string[];
  editableFields: string[];
  filters: TableViewFilter[];  // NOUVEAU
}

// Dans le service
loadTableData(configId: string, filters?: { [key: string]: string[] }) {
  // Construire la requête avec les filtres
  const whereClause = this.buildWhereFromFilters(filters);
  const sql = `SELECT * FROM ${table} ${whereClause}`;
  return this.query(sql);
}
```

## Performance

- Les filtres statiques se chargent instantanément
- Les filtres dynamiques utilisent des requêtes SQL optimisées (support DISTINCT)
- Le caching peut être implémenté côté frontend pour les options fréquemment utilisées

## Sécurité

⚠️ **Important**:

- Les valeurs de filtre doivent toujours être traitées comme des paramètres de requête paramétrée
- Éviter les injections SQL en utilisant des paramètres nommés `@filter_id`
- Valider les noms de colonnes côté serveur

## Prochaines étapes

1. Créer un endpoint pour ajouter/modifier les filtres
2. Implémenté le caching des options dynamiques
3. Ajouter la persistence du dernier filtre utilisé
4. Supporter la sauvegarde des profils de filtre (saved searches)
5. Ajouter des filtres avancés (range, date, etc.)
