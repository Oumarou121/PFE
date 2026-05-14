# 📍 Localisation de la Configuration des Filtres dans SuperAdmin

## Où trouver la configuration des filtres ?

### **Chemin dans l'interface:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SUPERADMIN PAGE                                │
├──────────────────────────┬───────────────────────────────────────────────┤
│                          │                                               │
│   PANNEAU GAUCHE         │          PANNEAU DROIT (Contenu)             │
│   ──────────────         │          ────────────────────────             │
│                          │                                               │
│   📋 Configurations      │   👆 Cliquer sur "Vues de données"           │
│      ├── Familles        │                                               │
│      ├── Organisations   │   ┌────────────────────────────────────────┐ │
│      ├── Administrateurs │   │  VUE: Gestion des utilisateurs        │ │
│      └──🔶 Vues données ◄─────│                                        │ │
│           ├─ tvw_users   │   │ Libellé: Gestion des utilisateurs     │ │
│           ├─ tvw_docs    │   │ Table: users                           │ │
│           └─ tvw_products│   │ Organisations: [✓] Org1, [✓] Org2    │ │
│                          │   │                                        │ │
│                          │   │ ┌─ Champs visibles                    │ │
│                          │   │ ├─ Champs modifiables                 │ │
│                          │   │ └─ Champs d'aperçu                    │ │
│                          │   │                                        │ │
│                          │   │ ┌─ Lookups (Code/Libellé)             │ │
│                          │   │                                        │ │
│                          │   │ ▼ SCROLL DOWN...                      │ │
│                          │   │                                        │ │
│                          │   │ ┌── 🆕 FILTRES DE DONNÉES ────────┐  │ │
│                          │   │ │                                 │  │ │
│                          │   │ │ + Ajouter un filtre             │  │ │
│                          │   │ │                                 │  │ │
│                          │   │ │ Filtres existants:              │  │ │
│                          │   │ │ ├─ Statut (Statique)           │  │ │
│                          │   │ │ │  └─ [Actif] [Inactif] [...]   │  │ │
│                          │   │ │ │                                │  │ │
│                          │   │ │ └─ Département (Table SQL)      │  │ │
│                          │   │ │    └─ SELECT id, name FROM      │  │ │
│                          │   │ │       departments               │  │ │
│                          │   │ └─────────────────────────────────┘  │ │
│                          │   │                                        │ │
│                          │   │ ┌─ Page générée                       │ │
│                          │   │ │ (Aperçu de la table)               │ │
│                          │   │                                        │ │
│                          │   └────────────────────────────────────────┘ │
│                          │                                               │
└──────────────────────────┴───────────────────────────────────────────────┘
```

---

## Étapes pour configurer les filtres

### 1️⃣ **Accéder à la section Vues de données**

```
Configurations → Vues de données → Sélectionner une vue
```

### 2️⃣ **Scroll jusqu'à "Configuration des filtres"**

La section se trouve après:

- ✅ Table SQL
- ✅ Organisations ayant accès
- ✅ Visibles / Modifiables / Aperçu
- ✅ Champs code / libellé

Et avant:

- ⬇️ Page générée

### 3️⃣ **Ajouter un filtre**

```
┌─ Configuration des filtres ─────────────────────┐
│                                                 │
│  + Ajouter un filtre                            │
│                                                 │
│  ┌─ Filtre #1 ───────────────────────────────┐ │
│  │ Nom du filtre: Statut                     │ │
│  │ Colonne à filtrer: status                 │ │
│  │ Type de source: ◉ Statique  ◯ Table SQL   │ │
│  │                                           │ │
│  │ Options statiques:                        │ │
│  │ ┌─────────┬─────────────────┬──────────┐ │ │
│  │ │ Valeur  │ Libellé         │ Actions  │ │ │
│  │ ├─────────┼─────────────────┼──────────┤ │ │
│  │ │ active  │ Actif           │   ✕      │ │ │
│  │ │ inactive│ Inactif         │   ✕      │ │ │
│  │ │ pending │ En attente      │   ✕      │ │ │
│  │ └─────────┴─────────────────┴──────────┘ │ │
│  │                                           │ │
│  │ + Ajouter une option                      │ │
│  │                                           │ │
│  │ [ ✓ Actif ] [ Supprimer ] [ ✕ Modifier ]│ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Configuration d'un filtre STATIQUE

### Exemple: Filtre "Statut"

```
┌─────────────────────────────────────────────────┐
│ Nom du filtre: Statut                           │
├─────────────────────────────────────────────────┤
│                                                 │
│ Colonne à filtrer:                              │
│ ├─ [Sélectionner une colonne]                   │
│ │  └─ status_code ◄─ CHOISIR CELLE-CI           │
│ │  └─ status                                    │
│ └─ (autres colonnes)                            │
│                                                 │
│ Description (optionnel):                        │
│ └─ Filtrer les utilisateurs par statut          │
│                                                 │
│ Type de source:                                 │
│ ◉ Listes prédéfinies (Statique)                 │
│ ◯ Requête SQL (Table)                           │
│                                                 │
├─────────────────────────────────────────────────┤
│ OPTIONS STATIQUES                               │
│                                                 │
│ Valeur          Libellé             Actions     │
│ ┌───────────┬──────────────────┬─────────────┐ │
│ │ active    │ Actif            │   ✕         │ │
│ │ inactive  │ Inactif          │   ✕         │ │
│ │ pending   │ En attente       │   ✕         │ │
│ │ archived  │ Archivé          │   ✕         │ │
│ └───────────┴──────────────────┴─────────────┘ │
│                                                 │
│ [ + Ajouter une option ]                        │
│                                                 │
│ [ ✓ Actif ] [ Enregistrer ]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Configuration d'un filtre DYNAMIQUE (TABLE SQL)

### Exemple: Filtre "Département"

```
┌──────────────────────────────────────────────────┐
│ Nom du filtre: Département                       │
├──────────────────────────────────────────────────┤
│                                                  │
│ Colonne à filtrer:                               │
│ ├─ [Sélectionner une colonne]                    │
│ │  └─ department_id ◄─ CHOISIR CELLE-CI          │
│ │  └─ dept_id                                    │
│ └─ (autres colonnes)                             │
│                                                  │
│ Description (optionnel):                         │
│ └─ Sélectionner un ou plusieurs départements    │
│                                                  │
│ Type de source:                                  │
│ ◯ Listes prédéfinies (Statique)                  │
│ ◉ Requête SQL (Table) ◄─ CHOISIR CELUI-CI       │
│                                                  │
├──────────────────────────────────────────────────┤
│ SOURCE SQL                                       │
│                                                  │
│ Table source:                                    │
│ ├─ [Sélectionner une table]                      │
│ │  └─ departments ◄─ CHOISIR CELLE-CI            │
│ │  └─ divisions                                  │
│ └─ (autres tables)                               │
│                                                  │
│ Colonne des valeurs:                             │
│ ├─ [Sélectionner une colonne]                    │
│ │  └─ id ◄─ CHOISIR (PK)                         │
│ │  └─ department_id                              │
│ └─ (autres colonnes)                             │
│                                                  │
│ Colonne des libellés:                            │
│ ├─ [Sélectionner une colonne]                    │
│ │  └─ name ◄─ CHOISIR                            │
│ │  └─ label                                      │
│ │  └─ department_name                            │
│ └─ (autres colonnes)                             │
│                                                  │
│ ☑ Éliminer les doublons (DISTINCT)               │
│                                                  │
│ Aperçu SQL:                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ SELECT DISTINCT id AS value,                 │ │
│ │   name AS label                              │ │
│ │ FROM departments                             │ │
│ │ ORDER BY label ASC                           │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [ ✓ Actif ] [ Enregistrer ]                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Résumé des champs configurables

| Propriété                   | Type     | Description                                           | Exemple                                |
| --------------------------- | -------- | ----------------------------------------------------- | -------------------------------------- |
| **Nom du filtre**           | Text     | Libellé du filtre affiché à l'utilisateur             | "Statut", "Département"                |
| **Colonne à filtrer**       | Select   | Colonne de la table sur laquelle le filtre s'applique | "status", "department_id"              |
| **Description**             | Text     | Texte d'aide optionnel pour l'utilisateur             | "Filtrer par statut du document"       |
| **Type de source**          | Radio    | Statique ou Table SQL                                 | Statique / Table                       |
| **Options** (Statique)      | Array    | Liste de {valeur, libellé}                            | [{active, Actif}, {inactive, Inactif}] |
| **Table source** (Table)    | Select   | Table SQL à requêter                                  | "departments", "users"                 |
| **Colonne valeur** (Table)  | Select   | Colonne contenant les IDs                             | "id", "dept_id"                        |
| **Colonne libellé** (Table) | Select   | Colonne contenant les noms affichés                   | "name", "label"                        |
| **DISTINCT**                | Checkbox | Éliminer les doublons dans la requête                 | true / false                           |
| **Actif**                   | Checkbox | Activer/désactiver le filtre sans le supprimer        | true / false                           |

---

## Navigation du SuperAdmin - Vue d'ensemble

```
┌────────────────────────────────────────────────────────────┐
│                   SUPERADMIN INTERFACE                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  PANNEAU GAUCHE                    PANNEAU DROIT          │
│  ────────────────                  ──────────────         │
│                                                            │
│  📋 CONFIGURATIONS                                         │
│     ├─ 👨 Familles (de documents)  │ Contenu actif:      │
│     │  ├─ fam_contrats             │ ┌──────────────────┐│
│     │  ├─ fam_demandes             │ │ Vue sélectionnée ││
│     │  └─ fam_rapports             │ │                  ││
│     │                              │ │ Configuration    ││
│     ├─ 🏢 Organisations            │ │ ├─ Label         ││
│     │  ├─ Org 1                    │ │ ├─ Table         │ │
│     │  └─ Org 2                    │ │ ├─ Visibles      │ │
│     │                              │ │ ├─ Lookups       │ │
│     ├─ 👨‍💼 Administrateurs          │ │ └─ 🆕 FILTRES    ││
│     │  ├─ Admin 1                  │ │                  ││
│     │  └─ Admin 2                  │ │ Données:         ││
│     │                              │ │ └─ Aperçu table  ││
│     └──🔶 Vues de données          │ │                  ││
│        ├─📊 tvw_users  ←───────────│─┤ Filtre #1        ││
│        ├─📊 tvw_docs               │ │ Filtre #2        ││
│        ├─📊 tvw_products           │ │ Filtre #3        ││
│        └─📊 tvw_reports            │ │                  ││
│                                    │ │ [✓ Actif]        ││
│                                    │ │ [Enregistrer]    ││
│                                    │ └──────────────────┘│
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Points importants à retenir

✅ **La configuration des filtres se trouve dans le SuperAdmin**

- Chemin: Configurations → Vues de données → [Vue] → Configuration des filtres

✅ **Deux types de filtres:**

- Statique: Liste prédéfinie
- Dynamique: Requête SQL

✅ **Configuration requise:**

- Nom du filtre
- Colonne à filtrer
- Options (statiques) ou Requête SQL (dynamiques)

✅ **Sauvegarde automatique:**

- Cliquer "Enregistrer vue"
- Les filtres sont persistés en BD

✅ **Disponibles pour l'utilisateur:**

- Les filtres configurés s'affichent dans l'application
- Composant `<app-table-filters>` les affiche

---

## Prochaine étape pour l'utilisateur

👉 Voir **MANUAL_CODE_ADDITIONS.md** pour ajouter les 13 lignes de code manquantes à SuperAdmin
