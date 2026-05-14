# 🎯 SYSTÈME DE FILTRES TABLEVIEWCONFIG - GUIDE D'INTÉGRATION COMPLET

**Date:** 14 mai 2026  
**Status:** ✅ Système prêt pour intégration

---

## 📚 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture complète](#architecture-complète)
3. [Fichiers créés](#fichiers-créés)
4. [Fichiers modifiés](#fichiers-modifiés)
5. [Instructions d'intégration](#instructions-dintégration)
6. [Flux complet utilisateur](#flux-complet-utilisateur)
7. [Checklist](#checklist)

---

## Vue d'ensemble

Le système de filtres TableViewConfig permet aux **superadminisateurs** de configurer des critères de filtrage pour les vues de données, et aux **utilisateurs** de filtrer les données en utilisant ces critères.

### Deux approches de filtres:

| Type          | Description                      | Exemple                                        |
| ------------- | -------------------------------- | ---------------------------------------------- |
| **Statique**  | Liste prédéfinie de valeurs      | Statut: [Actif, Inactif, Suspendu]             |
| **Dynamique** | Données générées via requête SQL | Département: [Requête SELECT FROM departments] |

---

## Architecture complète

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPERADMIN PANEL                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Configuration des vues de données                   │  │
│  │                                                     │  │
│  │ ├─ Choisir table SQL                               │  │
│  │ ├─ Champs visibles / modifiables / aperçu          │  │
│  │ ├─ Lookups (code/libellé)                          │  │
│  │ └─ 🆕 CONFIGURATION DES FILTRES                    │  │
│  │    ├─ + Ajouter filtre                             │  │
│  │    ├─ Filtre statique: Options prédéfinies        │  │
│  │    └─ Filtre dynamique: Requête SQL                │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓ SAVE
┌─────────────────────────────────────────────────────────────┐
│              SQL SERVER (ConfigDB)                          │
│  table: table_view_config                                  │
│  colonne: filters_json                                     │
│  Format: [{ id, name, linkColumn, sourceType, ... }]      │
└─────────────────────────────────────────────────────────────┘
                           ↓ API CALL
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION UTILISATEUR                   │
│                                                             │
│  GET /api/editor/table-view-config/{id}/filters            │
│  ↓                                                          │
│  Affichage du composant <app-table-filters>                │
│  ├─ Filtres statiques (checkboxes)                         │
│  └─ Filtres dynamiques (select avec chargement async)      │
│                                                             │
│  POST /api/editor/table-view-filters/options               │
│  Body: { filter: TableViewFilter }                         │
│  ↓                                                          │
│  Récupère les options: [{ value, label }, ...]             │
│  └─ Affiche les options dans le select                     │
│                                                             │
│  User selects: { filterId: [value1, value2] }              │
│  ↓                                                          │
│  Application construit WHERE clause:                       │
│  WHERE columnName IN (@filter_0, @filter_1)                │
│  ↓                                                          │
│  Requête données avec filtres appliqués                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Fichiers créés

### Backend (.NET/C#)

**Note:** Les fichiers backend ont déjà été créés et compilés avec succès.

| Fichier                                       | Type | Status  |
| --------------------------------------------- | ---- | ------- |
| ValueObjects (TableFilterOption, etc.)        | C#   | ✅ Créé |
| EditorRepository.GetTableFilterOptionsAsync() | C#   | ✅ Créé |
| EditorController [GET/POST filters]           | C#   | ✅ Créé |
| EditorSchema.sql (colonne filters_json)       | SQL  | ✅ Créé |
| EditorDtos (GetFilterOptionsRequest, etc.)    | C#   | ✅ Créé |

### Frontend (Angular)

| Fichier                                    | Type       | Status  |
| ------------------------------------------ | ---------- | ------- |
| **table-filters.service.ts**               | TypeScript | ✅ Créé |
| **table-filters.component.ts**             | TypeScript | ✅ Créé |
| **table-filters.component.html**           | HTML       | ✅ Créé |
| **table-filters.component.scss**           | SCSS       | ✅ Créé |
| **table-view-filters-config.component.ts** | TypeScript | ✅ Créé |
| **table-view-example.component.ts**        | TypeScript | ✅ Créé |

### SuperAdmin Integration

| Fichier                        | Type       | Status                                    |
| ------------------------------ | ---------- | ----------------------------------------- |
| **super-admin.component.ts**   | TypeScript | ⚠️ Import ajouté, reste du code à ajouter |
| **super-admin.component.html** | HTML       | ⏳ À ajouter                              |
| **table-view.model.ts**        | TypeScript | ✅ Mis à jour                             |

---

## Fichiers modifiés

### Backend

- ✅ `Domain/ValueObjects/EditorConfiguration.cs` - 4 classes ajoutées
- ✅ `Domain/Entities/TableViewConfig.cs` - Propriété Filters ajoutée
- ✅ `DTOs/EditorDtos.cs` - Filter DTOs ajoutés
- ✅ `Database/EditorSchema.sql` - Migration filters_json
- ✅ `Repositories/EditorRepository.cs` - GetTableFilterOptionsAsync()
- ✅ `Services/EditorService.cs` - Délégation des méthodes
- ✅ `Controllers/EditorController.cs` - 2 nouveaux endpoints

### Frontend

- ✅ `models/table-view.model.ts` - Propriété filters?: TableViewFilter[]
- ⚠️ `super-admin.component.ts` - Import ajouté, reste à faire
- ⏳ `super-admin.component.html` - À ajouter

---

## Instructions d'intégration

### Étape 1: Ajouter le code TypeScript au SuperAdmin

**Fichier:** `frontend/src/app/features/editor/pages/super-admin/super-admin.component.ts`

1. **Ajouter la propriété (ligne ~115):**

```typescript
databaseSchema: any = null;
```

2. **Ajouter la méthode (après updateTableViewSearch, ligne ~5540):**

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

👉 **Voir:** `MANUAL_CODE_ADDITIONS.md` pour les détails exacts

### Étape 2: Ajouter le composant au template HTML

**Fichier:** `frontend/src/app/features/editor/pages/super-admin/super-admin.component.html`

Avant la section "Page générée" (ligne ~3810), ajouter:

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

### Étape 3: (Optionnel) Charger le schéma de base de données

Pour que les dropdowns des colonnes fonctionnent, le schéma doit être chargé. Adapter selon votre API:

```typescript
private loadDatabaseSchema(): void {
  this.api.get('database-schema')
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (schema) => {
        this.databaseSchema = schema;
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Erreur schéma:', err)
    });
}
```

---

## Flux complet utilisateur

### 👨‍💼 Superadmin - Configuration des filtres

```
1. SUPERADMIN PANEL
   ↓
2. Naviguer vers Configurations → Vues de données
   ↓
3. Sélectionner une vue (ex: "Gestion des utilisateurs")
   ↓
4. Scroll jusqu'à "Configuration des filtres"
   ↓
5. Cliquer "+ Ajouter un filtre"
   ├─ Nom: "Statut"
   ├─ Colonne: "status"
   ├─ Type: "Statique"
   ├─ Options:
   │  ├─ Valeur: "active" → Libellé: "Actif"
   │  ├─ Valeur: "inactive" → Libellé: "Inactif"
   │  └─ Valeur: "pending" → Libellé: "En attente"
   ├─ Description: "Filtrer par statut"
   └─ Cliquer "Enregistrer vue"
   ↓
6. Configuration sauvegardée en BD (colonne filters_json)
```

### 👨‍💻 Utilisateur - Utilisation des filtres

```
1. APPLICATION UTILISATEUR
   ↓
2. Accéder à la page "Gestion des utilisateurs"
   ↓
3. COMPOSANT <app-table-filters> S'AFFICHE
   ├─ Charge les filtres: GET /api/editor/table-view-config/{id}/filters
   ├─ Affiche:
   │  └─ Filtre "Statut":
   │     ☐ Actif
   │     ☐ Inactif
   │     ☐ En attente
   ↓
4. User sélectionne: "Actif" et "En attente"
   ↓
5. Événement filterChange émet: { status: ["active", "pending"] }
   ↓
6. Application construit WHERE clause:
   WHERE status IN ('active', 'pending')
   ↓
7. Requête données: GET /table-view-rows?configId=...&filters={...}
   ↓
8. Tableau mis à jour avec données filtrées
```

---

## Points clés d'intégration

### 1. **SuperAdmin Configuration**

- Interface complète pour gérer les filtres
- Support des filtres statiques et dynamiques
- Validation en temps réel
- Préview des requêtes SQL

### 2. **API Endpoints**

```
GET  /api/editor/table-view-config/{id}/filters
     → Récupère les filtres d'une config
     ← Retourne: TableViewFilter[]

POST /api/editor/table-view-filters/options
     → Récupère les options dynamiques
     → Body: { filter: TableViewFilter, databaseName?: string }
     ← Retourne: { value, label }[]
```

### 3. **Frontend Components**

#### `<app-table-filters>` (Utilisateur)

- Affiche les filtres avec UI adaptée
- Chargement asynchrone des options dynamiques
- Gestion des erreurs
- Événement `filterChange` pour le parent

#### `<app-table-view-filters-config>` (SuperAdmin)

- Interface complète de configuration
- Ajout/suppression/édition de filtres
- Support des deux types de sources
- Validation des configurations

### 4. **Service TypeScript**

- `getTableViewFilters()` - Charge les filtres
- `getTableFilterOptions()` - Récupère les options dynamiques
- `buildFilterWhereClause()` - Construit la clause SQL
- `validateFilterConfig()` - Valide la configuration

---

## Checklist d'implémentation

### ✅ Travail déjà fait

Backend:

- [x] Créer ValueObjects pour filtres
- [x] Ajouter propriété Filters à TableViewConfig
- [x] Créer DTOs pour API
- [x] Migration SQL (colonne filters_json)
- [x] Implémenter Repository method
- [x] Créer endpoints API
- [x] Compiler et valider (0 erreurs)

Frontend - Composants de filtrage utilisateur:

- [x] table-filters.service.ts
- [x] table-filters.component.ts/html/scss
- [x] Exemple complet d'intégration

Frontend - Configuration SuperAdmin:

- [x] table-view-filters-config.component.ts
- [x] Mettre à jour table-view.model.ts
- [x] Importer composant dans super-admin.ts

### ⏳ À faire manuellement

Frontend - Configuration SuperAdmin:

- [ ] Ajouter propriété `databaseSchema` dans super-admin.ts (2 lignes)
- [ ] Ajouter méthode `onFiltersChanged()` dans super-admin.ts (6 lignes)
- [ ] Ajouter balise `<app-table-view-filters-config>` dans super-admin.html (5 lignes)
- [ ] Tester la compilation: `npm run build`
- [ ] Tester SuperAdmin: Ajouter/éditer des filtres

### 🚀 Après intégration

- [ ] Migration BD: Exécuter EditorSchema.sql
- [ ] Déployer backend
- [ ] Déployer frontend
- [ ] Tester bout-en-bout:
  - [ ] SuperAdmin: Créer filtres statiques et dynamiques
  - [ ] Utilisateur: Affichage et fonctionnement des filtres
  - [ ] API: Retours corrects des options dynamiques

---

## Fichiers de documentation

1. **IMPLEMENTATION_SUMMARY_FILTERS.md** - Résumé technique complet
2. **INTEGRATION_FILTERS_SUPERADMIN.md** - Guide d'intégration SuperAdmin
3. **MANUAL_CODE_ADDITIONS.md** - Instructions ligne par ligne
4. **Ce fichier** - Vue d'ensemble complète

---

## Support et dépannage

### Erreurs courantes

**Erreur: "Cannot find module 'table-view-filters-config.component'"**

- Solution: Vérifier le chemin d'import dans super-admin.ts

**Erreur: "Property 'filters' does not exist on TableViewConfig"**

- Solution: Vérifier que table-view.model.ts a la propriété `filters?: TableViewFilter[]`

**Les filtres ne s'affichent pas dans SuperAdmin**

- Solution: Vérifier que le composant est bien dans les imports[]
- Vérifier la console du navigateur pour les erreurs TypeScript

**Les options dynamiques ne se chargent pas**

- Solution: Vérifier que l'API `/api/editor/table-view-filters/options` fonctionne
- Vérifier les logs de l'API côté serveur

---

## Prochaines améliorations

- [ ] Caching des options dynamiques
- [ ] Sauvegarde des profils de filtre (saved searches)
- [ ] Filtres avancés (range, date, regex)
- [ ] Export des données filtrées
- [ ] Partage des profils entre utilisateurs
- [ ] Audit des filtres appliqués
- [ ] Performance optimization pour grandes tables

---

## Version

**Créé:** 14 mai 2026  
**Dernière mise à jour:** 14 mai 2026  
**Status:** Prêt pour intégration  
**Compilé:** ✅ Backend 0 erreurs, 0 avertissements
