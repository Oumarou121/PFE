# Instructions: Ajout du code pour la gestion des filtres dans SuperAdmin

## 1. Ajouter la propriété databaseSchema (ligne ~115)

**Fichier:** `frontend/src/app/features/editor/pages/super-admin/super-admin.component.ts`

**Chercher cette ligne:**

```typescript
isCreatingTableViewRow = false;
beneficiaryPreviewText =
  'Cliquez sur "Tester la liste" pour voir un bénéficiaire retourné.';
```

**Ajouter avant `beneficiaryPreviewText`:**

```typescript
databaseSchema: any = null;
```

**Résultat:**

```typescript
isCreatingTableViewRow = false;
databaseSchema: any = null;
beneficiaryPreviewText =
  'Cliquez sur "Tester la liste" pour voir un bénéficiaire retourné.';
```

---

## 2. Ajouter la méthode onFiltersChanged (après ligne 5540)

**Fichier:** `frontend/src/app/features/editor/pages/super-admin/super-admin.component.ts`

**Chercher cette méthode:**

```typescript
  updateTableViewSearch(value: string): void {
    this.tableViewSearch = String(value || "");
  }

  updateTableViewSearchFromEvent(event: Event): void {
```

**Ajouter entre les deux méthodes:**

```typescript
  onFiltersChanged(updatedView: TableViewConfig | null): void {
    if (!updatedView) return;
    const index = this.tableViews.findIndex((v) => v.id === updatedView.id);
    if (index >= 0) {
      this.tableViews[index] = { ...updatedView };
      this.cdr.markForCheck();
    }
  }
```

**Résultat:**

```typescript
  updateTableViewSearch(value: string): void {
    this.tableViewSearch = String(value || "");
  }

  onFiltersChanged(updatedView: TableViewConfig | null): void {
    if (!updatedView) return;
    const index = this.tableViews.findIndex((v) => v.id === updatedView.id);
    if (index >= 0) {
      this.tableViews[index] = { ...updatedView };
      this.cdr.markForCheck();
    }
  }

  updateTableViewSearchFromEvent(event: Event): void {
```

---

## 3. Ajouter la section HTML dans super-admin.component.html (ligne ~3800)

**Fichier:** `frontend/src/app/features/editor/pages/super-admin/super-admin.component.html`

**Chercher cette ligne (fin de la section "Champs code / libelle"):**

```html
                </div>
              </div>
            </div>
          </div>
          <div class="card" *ngIf="selectedTableView">
            <div class="card-header">
              <div class="card-title">Page générée</div>
```

**Ajouter avant la section "Page générée":**

```html
<!-- Configuration des filtres -->
<div class="card" *ngIf="selectedTableView as view">
  <app-table-view-filters-config
    [view]="view"
    [schema]="databaseSchema"
    (filterChange)="onFiltersChanged($event)"
  >
  </app-table-view-filters-config>
</div>
```

**Résultat:**

```html
                </div>
              </div>
            </div>
          </div>

          <!-- Configuration des filtres -->
          <div class="card" *ngIf="selectedTableView as view">
            <app-table-view-filters-config
              [view]="view"
              [schema]="databaseSchema"
              (filterChange)="onFiltersChanged($event)">
            </app-table-view-filters-config>
          </div>

          <div class="card" *ngIf="selectedTableView">
            <div class="card-header">
              <div class="card-title">Page générée</div>
```

---

## 4. Charger le schéma de base de données (optionnel mais recommandé)

**Ajouter dans `ngOnInit()` du composant SuperAdmin:**

```typescript
// Charger le schéma quand un organisation est sélectionnée
if (this.selectedSchemaDatabaseName) {
  this.loadDatabaseSchema();
}
```

**Ajouter une nouvelle méthode:**

```typescript
  private loadDatabaseSchema(): void {
    this.api.get('database-schema')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (schema) => {
          this.databaseSchema = schema;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Erreur lors du chargement du schéma:', err);
        }
      });
  }
```

---

## Résumé des modifications

| Fichier                      | Action               | Ligne | Contenu                                  |
| ---------------------------- | -------------------- | ----- | ---------------------------------------- |
| `super-admin.component.ts`   | Ajouter propriété    | ~115  | `databaseSchema: any = null;`            |
| `super-admin.component.ts`   | Ajouter méthode      | ~5540 | `onFiltersChanged()`                     |
| `super-admin.component.html` | Ajouter section HTML | ~3800 | Balise `<app-table-view-filters-config>` |

---

## ✅ Vérification après modification

1. **Vérifier la compilation:**

   ```bash
   cd frontend
   npm run build
   ```

2. **Tester dans SuperAdmin:**
   - Aller dans "Configurations" → "Vues de données"
   - Sélectionner une vue de données
   - Scroll jusqu'à "Configuration des filtres"
   - Tester: Ajouter, éditer, supprimer des filtres

3. **Vérifier que les filtres s'affichent:**
   - Le composant doit afficher "Aucun filtre configuré" au début
   - Cliquer "+ Ajouter un filtre"
   - Vérifier que les colonnes de la table apparaissent dans le dropdown
   - Configurer un filtre statique et un filtre dynamique

---

## 🔍 Débogage

Si le schéma n'est pas chargé:

- Vérifier que l'API `/database-schema` existe
- Vérifier les erreurs dans la console du navigateur
- Adapter l'URL de l'API selon votre implémentation

Si les filtres ne s'affichent pas:

- Vérifier que le composant est bien importé
- Vérifier les erreurs TypeScript lors de la compilation
- Vérifier que la vue sélectionnée a la propriété `filters` initialisée
