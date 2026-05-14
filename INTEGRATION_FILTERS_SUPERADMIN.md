# 📋 Configuration des Filtres dans SuperAdmin

## Intégration de la configuration des filtres TableViewConfig

La configuration des filtres pour les vues de données (TableViewConfig) doit être intégrée dans la section **"Configuration des vues de données"** du SuperAdmin.

### 📍 Localisation dans SuperAdmin

#### **Panneau de gauche:**

```
Configurations
└── Vues de données  ← Sélectionner ici
    ├── vue_utilisateurs
    ├── vue_documents
    └── ...
```

#### **Panneau de droite:**

```
Vue de données configurable
├── Libellé pour l'utilisateur
├── Table SQL
├── Organisations ayant accès
├── [Visibles / Modifiables / Aperçu] (3 colonnes)
├── Champs code / libelle
└── 🆕 FILTRES DE DONNÉES ← NOUVELLE SECTION
```

---

## 🏗️ Architecture de l'intégration

### **1. Composant SuperAdmin**

- Fichier: `super-admin.component.ts`
- Statut: ✅ Mis à jour avec import du composant

```typescript
import { TableViewFiltersConfigComponent } from "./components/table-view-filters-config/table-view-filters-config.component";

@Component({
  imports: [
    // ...
    TableViewFiltersConfigComponent  // ← Ajouté
  ]
})
```

### **2. Composant de configuration des filtres**

- Fichier: `table-view-filters-config.component.ts`
- Type: Composant standalone
- Responsabilités:
  - ✅ Affichage de la liste des filtres
  - ✅ Ajout/suppression de filtres
  - ✅ Configuration des filtres statiques (options prédéfinies)
  - ✅ Configuration des filtres dynamiques (requêtes SQL)
  - ✅ Validation et préview SQL
  - ✅ Gestion d'activation/désactivation

### **3. Modèle TypeScript**

- Fichier: `table-view.model.ts`
- Statut: ✅ Mis à jour avec propriété `filters?: TableViewFilter[]`

```typescript
export interface TableViewConfig {
  // ... propriétés existantes ...
  filters?: TableViewFilter[]; // ← Ajouté
}
```

---

## 📍 Où ajouter le composant dans le HTML

### **Localisation du code HTML:**

Fichier: `super-admin.component.html`
Position: Après la section "Champs code / libelle" (ligne ~3800)
Avant la section "Page générée" (ligne ~3810)

### **Code à ajouter:**

```html
<!-- NOUVELLE SECTION: CONFIGURATION DES FILTRES -->
<div class="card" *ngIf="selectedTableView as view">
  <app-table-view-filters-config
    [view]="view"
    [schema]="databaseSchema"
    (filterChange)="onFiltersChanged($event)"
  >
  </app-table-view-filters-config>
</div>
```

### **Placement dans super-admin.component.html (après ligne 3800):**

```html
              </div>
            </div>
          </div>
          <!-- FIN DE LA SECTION "Champs code / libelle" -->

          <!-- 🆕 DÉBUT NOUVELLE SECTION: FILTRES -->
          <div class="card" *ngIf="selectedTableView as view">
            <app-table-view-filters-config
              [view]="view"
              [schema]="databaseSchema"
              (filterChange)="onFiltersChanged($event)">
            </app-table-view-filters-config>
          </div>
          <!-- 🆕 FIN NOUVELLE SECTION: FILTRES -->

          <!-- SECTION "Page générée" continue... -->
          <div class="card" *ngIf="selectedTableView">
            <div class="card-header">
              <div class="card-title">Page générée</div>
              <!-- ... reste du code ... -->
```

---

## 🔧 Code à ajouter dans SuperAdminComponent

### **Dans la classe TypeScript:**

```typescript
// Propriété pour stocker le schéma de base de données
databaseSchema: any = null;

// Méthode pour gérer le changement des filtres
onFiltersChanged(updatedView: TableViewConfig | null) {
  if (!updatedView) return;

  // Mettre à jour la vue locale
  const index = this.state?.tableViews?.findIndex(v => v.id === updatedView.id);
  if (index !== undefined && index >= 0 && this.state?.tableViews) {
    this.state.tableViews[index] = updatedView;
  }

  // Marquer pour détection de changements
  this.cdr.markForCheck();
}

// Charger le schéma de base de données (si pas déjà fait)
private async ensureDatabaseSchema() {
  if (!this.databaseSchema) {
    try {
      const response = await firstValueFrom(
        this.api.get('database-schema')  // Adapter selon votre endpoint
      );
      this.databaseSchema = response;
    } catch (err) {
      console.error('Erreur lors du chargement du schéma:', err);
    }
  }
}

// Appeler dans ngOnInit ou quand une organisation est sélectionnée
ngOnInit() {
  // ... code existant ...
  this.ensureDatabaseSchema();
}
```

---

## 🎯 Fonctionnalités de la configuration des filtres

### **Interface utilisateur:**

#### **1. Ajouter un filtre**

- Cliquer sur "+ Ajouter un filtre"
- Configurez: Nom, Colonne à filtrer, Type de source (Statique/Table)
- ✅ Sauvegarde automatique

#### **2. Filtres statiques (Listes prédéfinies)**

- Exemple: Statut (Actif, Inactif, Suspendu)
- Configurez: Valeur et Libellé pour chaque option
- ✅ Ajout/suppression d'options

#### **3. Filtres dynamiques (Requête SQL)**

- Exemple: Département (données depuis la table `departments`)
- Configurez: Table source, Colonne des valeurs, Colonne des libellés
- ✅ Prévisualisation de la requête SQL générée

#### **4. Gestion du filtre**

- ✅ Activation/Désactivation
- ✅ Description (helpText)
- ✅ Suppression

---

## 📊 Exemple de configuration complète

### **Vue de données: Gestion des utilisateurs**

```
Filtres de données:
│
├─ Statut (STATIQUE)
│  ├─ Valeur: active → Libellé: Actif ✓
│  ├─ Valeur: inactive → Libellé: Inactif ✓
│  └─ Valeur: pending → Libellé: En attente ✓
│
├─ Département (TABLE SQL)
│  ├─ Table source: departments
│  ├─ Colonne des valeurs: id
│  ├─ Colonne des libellés: name
│  └─ Distinct: OUI ✓
│
└─ Rôle (TABLE SQL)
   ├─ Table source: roles
   ├─ Colonne des valeurs: id
   ├─ Colonne des libellés: label
   └─ Distinct: OUI ✓
```

---

## 🔄 Flux de données

```
SuperAdmin Component (super-admin.component.ts)
    ↓
    ├── Charge TableViewConfig sélectionné
    ├── Charge le schéma de base de données
    └── Passe à TableViewFiltersConfigComponent
        ↓
        ├── Affiche les filtres existants
        ├── Permet l'édition/ajout/suppression
        └── Émet les changements via filterChange output
    ↓
onFiltersChanged()
    ├── Reçoit la TableViewConfig mise à jour
    ├── Sauvegarde en mémoire (state)
    └── Marque pour détection de changements
```

---

## ✅ Checklist d'intégration

- [x] Créer `table-view-filters-config.component.ts`
- [x] Mettre à jour `table-view.model.ts` avec propriété `filters`
- [x] Ajouter import dans `super-admin.component.ts`
- [x] Ajouter `TableViewFiltersConfigComponent` à imports[]
- [ ] **Ajouter HTML dans `super-admin.component.html`** ← À faire manuellement
- [ ] Ajouter méthode `onFiltersChanged()` dans `super-admin.component.ts`
- [ ] Ajouter propriété `databaseSchema` dans `super-admin.component.ts`
- [ ] Charger le schéma au démarrage de SuperAdmin
- [ ] Tester l'ajout/suppression de filtres
- [ ] Tester la sauvegarde des configurations
- [ ] Tester les filtres statiques et dynamiques

---

## 🚀 Prochaines étapes après intégration

1. **Vérifier la compilation** du frontend
2. **Tester SuperAdmin:**
   - Charger une vue de données
   - Ajouter un filtre statique
   - Ajouter un filtre dynamique
   - Vérifier que les changements sont persistés
3. **Tester l'utilisation des filtres** dans la page utilisateur:
   - Récupérer les filtres: `GET /api/editor/table-view-config/{id}/filters`
   - Afficher le composant `<app-table-filters>`
   - Récupérer les options dynamiques: `POST /api/editor/table-view-filters/options`
4. **Mettre en place la persistance** des filtres en base de données
5. **Tester l'intégration complète** du système de filtres

---

## 📝 Notes importantes

- Le composant `TableViewFiltersConfigComponent` est **standalone** - pas besoin de déclarer dans un NgModule
- Les filtres sont stockés dans **`filters_json`** côté base de données
- Le schéma de base de données doit être chargé pour remplir les dropdowns
- Les changements sont émis via `filterChange` output (à capter dans SuperAdmin)
- La sauvegarde de la configuration doit être faite via `saveTableViewConfig()` existant
