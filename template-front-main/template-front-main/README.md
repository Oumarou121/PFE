# 🚀 Angular Professional Template

Template Angular moderne avec authentification, CRUD complet, et interface utilisateur professionnelle.

## ⚡ Démarrage rapide

### 1. Installation
```bash
npm install
```

### 2. Démarrage des serveurs
```bash
# Terminal 1 - Serveur Angular (port 4200)
npm start

# Terminal 2 - Serveur JSON (port 3001)
npx json-server --watch db.json --port 3001
```

### 3. Accès à l'application
- **URL** : http://localhost:4200/
- **Login** : admin@test.com
- **Mot de passe** : admin123

## 🎯 Fonctionnalités

- ✅ **Authentification JWT** avec guards de protection
- ✅ **CRUD complet** sur les processus (vue cards/tableau)
- ✅ **Interface responsive** moderne
- ✅ **Recherche et filtres** en temps réel
- ✅ **Gestion des erreurs** centralisée
- ✅ **Loading states** automatiques
- ✅ **Validation des formulaires** réactive
- ✅ **Navigation intuitive** avec lazy loading

## 🏗️ Architecture

- **Angular 17+** avec Standalone Components
- **TypeScript** strict pour le typage fort
- **SCSS** pour les styles avancés
- **RxJS** pour la programmation réactive
- **JSON Server** pour l'API de développement

## 📚 Documentation complète

Consultez le **[Guide de Référence Complet](TEMPLATE_REFERENCE.md)** pour :
- Architecture détaillée
- Règles de codage
- Modèles de données
- Configuration des services
- Bonnes pratiques
- Guide de déploiement

## 🎨 Structure des fichiers

Chaque composant dispose de 3 fichiers séparés :
- `.component.ts` : Logique TypeScript
- `.component.html` : Template HTML  
- `.component.scss` : Styles SCSS

## 🔐 Authentification

Le système d'authentification inclut :
- Page de login moderne avec design glassmorphism
- Guards de protection des routes (authGuard, loginGuard)
- Gestion des sessions avec JWT et localStorage
- Menu utilisateur avec déconnexion
- Redirection automatique selon le statut

## 📊 Module Processus

Interface complète de gestion des processus avec :
- **Double vue** : Cards et Tableau avec toggle
- **Recherche instantanée** par nom ou code
- **Filtres** par type et statut
- **CRUD complet** : Créer, Modifier, Supprimer
- **Indicateurs visuels** (scores, statuts, barres de progression)
- **Modal responsive** pour création/édition

## 🚀 Prêt pour la production

Ce template est **production-ready** avec :
- Architecture scalable et maintenable
- Code respectant les bonnes pratiques Angular
- Interface utilisateur moderne et accessible
- Sécurité de base implémentée
- Documentation complète

---

**Développé avec ❤️ pour la communauté Angular**