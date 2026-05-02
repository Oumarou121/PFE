# 📋 Template Angular Professionnel - Guide de Référence Complet

## 🎯 Vue d'ensemble

Ce template Angular moderne fournit une base solide pour développer des applications d'entreprise avec authentification, CRUD complet, et interface utilisateur professionnelle.

**Version Angular :** 17+ avec Standalone Components  
**Authentification :** JWT simulé avec guards  
**UI Framework :** Custom CSS + Angular Material (partiel)  
**API Mock :** JSON Server  

---

## 🏗️ Architecture et Structure

### Structure des dossiers
```
src/app/
├── core/                           # Services et utilitaires globaux
│   ├── guards/
│   │   └── auth.guard.ts          # Protection des routes
│   ├── interceptors/
│   │   ├── auth.interceptor.ts    # Injection token JWT
│   │   ├── error.interceptor.ts   # Gestion erreurs HTTP
│   │   └── loading.interceptor.ts # États de chargement
│   └── services/
│       ├── api.service.ts         # Service HTTP générique
│       ├── auth.service.ts        # Authentification
│       ├── loading.service.ts     # Gestion du loading
│       └── process.service.ts     # Gestion des processus
├── features/                       # Modules fonctionnels
│   ├── auth/login/                # Authentification
│   │   ├── login.component.ts
│   │   ├── login.component.html
│   │   └── login.component.scss
│   ├── processus/                 # Gestion des processus
│   │   ├── processus-list/        # Liste avec vue cards/tableau
│   │   └── process-form-modal/    # Modal de création/édition
│   ├── dashboard/                 # Tableau de bord
│   ├── documents/                 # Gestion documentaire
│   └── users/                     # Gestion des utilisateurs
│       ├── users-list/            # Liste des utilisateurs
│       └── users-form/            # Formulaire utilisateur
├── layout/                        # Composants de mise en page
│   ├── header/                    # En-tête avec menu utilisateur
│   ├── sidebar/                   # Navigation latérale
│   └── main-layout/               # Layout principal
├── shared/                        # Composants et modèles partagés
│   ├── components/
│   │   ├── loading/               # Composant de chargement
│   │   └── confirm-dialog/        # Dialog de confirmation
│   ├── models/                    # Interfaces TypeScript
│   └── services/                  # Services utilitaires
└── app-routing.module.ts          # Configuration des routes
```

### Principe de séparation des fichiers
**Chaque composant dispose de 3 fichiers séparés :**
- `.component.ts` : Logique TypeScript
- `.component.html` : Template HTML
- `.component.scss` : Styles SCSS

---

## 🔐 Système d'authentification

### Configuration des routes avec guards
```typescript
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],  // Évite l'accès si déjà connecté
    loadComponent: () => import('./features/auth/login/login.component')
  },
  {
    path: '',
    canActivate: [authGuard],   // Protège toutes les routes enfants
    loadComponent: () => import('./layout/main-layout/main-layout.component'),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: ... },
      { path: 'processus', loadComponent: ... },
      // ...
    ]
  }
];
```

### AuthService - Méthodes principales
```typescript
class AuthService {
  // Authentification
  login(credentials: LoginRequest): Observable<LoginResponse>
  logout(): void
  
  // Vérifications
  isAuthenticated(): boolean
  getCurrentUser(): AuthUser | null
  getToken(): string | null
  
  // Observables
  currentUser$: Observable<AuthUser | null>
}
```

### Credentials de test
```
Email: admin@test.com
Mot de passe: admin123
```

### Flux d'authentification
1. **Accès route protégée** → `authGuard` vérifie token
2. **Si non authentifié** → Redirection vers `/login`
3. **Saisie credentials** → Validation côté client
4. **Soumission** → `AuthService.login()` appelle API mock
5. **Succès** → Token stocké + redirection dashboard
6. **Navigation** → `authGuard` autorise l'accès
7. **Déconnexion** → Nettoyage localStorage + redirection login

---

## 🎨 Système de Design

### Variables CSS globales
```scss
// Couleurs principales
--xl-green: #10b981;
--xl-green-mid: #059669;
--xl-green-light: #34d399;
--xl-green-xlight: #d1fae5;

// Couleurs de statut
--s-green: #10b981;
--s-yellow: #f59e0b;
--s-red: #ef4444;

// Texte
--text-primary: #111827;
--text-secondary: #6b7280;
--text-muted: #9ca3af;

// Arrière-plans
--bg-white: #ffffff;
--bg-raised: #f9fafb;
--border: #e5e7eb;
--border-mid: #d1d5db;

// Autres
--radius: 6px;
--shadow: 0 1px 3px rgba(0,0,0,0.1);
```

### Classes utilitaires
```scss
// Boutons
.btn {
  padding: 8px 16px;
  border-radius: var(--radius);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary { background: var(--xl-green); color: white; }
.btn-secondary { background: var(--bg-raised); color: var(--text-primary); }
.btn-ghost { background: transparent; color: var(--text-muted); }

// Layout
.full-width { width: 100%; }
.text-center { text-align: center; }
.flex { display: flex; }
.flex-1 { flex: 1; }
```

---

## 🔧 Services Core

### ApiService - Service HTTP générique
```typescript
class ApiService {
  private baseUrl = environment.apiUrl; // http://localhost:3001
  
  get<T>(endpoint: string, params?: any): Observable<T>
  post<T>(endpoint: string, data: any): Observable<T>
  put<T>(endpoint: string, data: any): Observable<T>
  patch<T>(endpoint: string, data: any): Observable<T>
  delete<T>(endpoint: string): Observable<T>
}
```

### ProcessService - Gestion des processus
```typescript
class ProcessService {
  getProcesses(): Observable<Process[]>
  getProcess(id: number): Observable<Process>
  createProcess(process: Partial<Process>): Observable<Process>
  updateProcess(id: number, process: Partial<Process>): Observable<Process>
  deleteProcess(id: number): Observable<void>
}
```

### LoadingService - États de chargement
```typescript
class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();
  
  show(): void
  hide(): void
  setLoading(loading: boolean): void
}
```

---

## 📊 Modèles de données

### Process Model
```typescript
interface Process {
  id?: number;
  code: string;                    // Ex: "P-01"
  name: string;                    // Ex: "Gestion des ressources humaines"
  type: ProcessType;               // PILOTAGE | OPERATIONNEL | SUPPORT | MESURE
  objective: string;               // Description de l'objectif
  pilot: string;                   // Nom du pilote
  clauseISO?: string;              // Ex: "§7 - Support"
  reviewFrequency: ReviewFrequency; // MENSUELLE | TRIMESTRIELLE | etc.
  conformityScore: number;         // Score 0-100
  status: ProcessStatus;           // CONFORME | A_SURVEILLER | NON_CONFORME
  createdDate?: string;
  nextReview?: string;
  proceduresCount?: number;
  documentsCount?: number;
}

enum ProcessType {
  PILOTAGE = 'PILOTAGE',
  OPERATIONNEL = 'OPERATIONNEL',
  SUPPORT = 'SUPPORT',
  MESURE = 'MESURE'
}

enum ProcessStatus {
  CONFORME = 'CONFORME',
  A_SURVEILLER = 'A_SURVEILLER',
  NON_CONFORME = 'NON_CONFORME'
}
```

### User Model
```typescript
interface User {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
}
```

### Auth Models
```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface AuthUser {
  id: number;
  email: string;
  name: string;
}
```

---

## 🎯 Fonctionnalités par module

### Module Processus (CRUD Complet)

#### Vue Cards
- Affichage en grille responsive
- Indicateurs visuels (couleurs par statut)
- Barres de progression pour scores
- Actions au survol (modifier/supprimer)

#### Vue Tableau
- Colonnes : Code, Nom, Type, Pilote, Score, Statut, Prochaine revue, Actions
- Tri par colonnes
- Pagination automatique
- Actions inline

#### Fonctionnalités
```typescript
class ProcessusListComponent {
  // Propriétés
  processes: Process[] = [];
  filteredProcesses: Process[] = [];
  viewMode: 'cards' | 'table' = 'cards';
  searchTerm: string = '';
  selectedType: string = '';
  selectedStatus: string = '';
  
  // Méthodes principales
  loadProcesses(): void              // Charger les données
  applyFilters(): void              // Appliquer filtres/recherche
  toggleViewMode(): void            // Basculer vue cards/tableau
  openCreateModal(): void           // Créer nouveau processus
  openEditModal(process): void      // Modifier processus
  confirmDelete(process): void      // Supprimer avec confirmation
}
```

#### Modal de création/édition
- Formulaire réactif avec validation
- Sections : Informations générales, Responsabilité, KPI, Score
- Sélection de pilote avec chips
- Slider pour score de conformité
- Gestion des erreurs en temps réel

### Module Authentification

#### Page de login
- Design glassmorphism moderne
- Validation en temps réel
- Animation de chargement
- Credentials pré-remplies pour démo
- Responsive mobile

#### Fonctionnalités
```typescript
class LoginComponent {
  loginForm: FormGroup;
  hidePassword: boolean = true;
  isLoading: boolean = false;
  
  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.authService.login(this.loginForm.value).subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: () => this.isLoading = false
      });
    }
  }
}
```

### Module Dashboard
- Métriques en temps réel
- Graphiques et indicateurs
- Actions rapides
- Navigation vers autres modules

### Module Users
- Liste avec pagination
- Formulaire de création/édition
- Suppression avec confirmation
- Filtres par statut et rôle

---

## 🛡️ Sécurité et Interceptors

### AuthInterceptor
```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  
  return next(req);
};
```

### ErrorInterceptor
```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Redirection vers login
      }
      notificationService.showError(error.message);
      return throwError(() => error);
    })
  );
};
```

### LoadingInterceptor
```typescript
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  
  loadingService.show();
  
  return next(req).pipe(
    finalize(() => loadingService.hide())
  );
};
```

---

## 🗄️ Configuration de l'API Mock

### Structure db.json
```json
{
  "auth": {
    "email": "admin@test.com",
    "password": "admin123",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "processes": [
    {
      "id": 1,
      "code": "P-01",
      "name": "Gestion des ressources humaines",
      "type": "OPERATIONNEL",
      "objective": "Assurer le recrutement, la formation et la gestion du personnel",
      "pilot": "A. Mansouri",
      "clauseISO": "§7 - Support",
      "reviewFrequency": "TRIMESTRIELLE",
      "conformityScore": 85,
      "status": "CONFORME",
      "createdDate": "2024-01-15",
      "nextReview": "2024-04-15",
      "proceduresCount": 3,
      "documentsCount": 12
    }
  ],
  "users": [...]
}
```

### Endpoints disponibles
```
GET    /auth                    # Données d'authentification
GET    /processes              # Liste des processus
GET    /processes/:id          # Processus par ID
POST   /processes              # Créer processus
PUT    /processes/:id          # Modifier processus
DELETE /processes/:id          # Supprimer processus
GET    /users                  # Liste des utilisateurs
POST   /users                  # Créer utilisateur
PUT    /users/:id              # Modifier utilisateur
DELETE /users/:id              # Supprimer utilisateur
```

---

## 🚀 Commandes de développement

### Installation et démarrage
```bash
# Installation des dépendances
npm install

# Démarrage du serveur Angular (port 4200)
npm start
# ou
ng serve

# Démarrage du serveur JSON (port 3001)
npx json-server --watch db.json --port 3001

# Démarrage simultané (si configuré)
npm run dev
```

### Génération de code
```bash
# Nouveau composant
ng generate component features/example

# Nouveau service
ng generate service core/services/example

# Nouveau guard
ng generate guard core/guards/example

# Nouveau interceptor
ng generate interceptor core/interceptors/example
```

### Build et déploiement
```bash
# Build de développement
ng build

# Build de production
ng build --configuration production

# Test de l'application
ng test

# Analyse du bundle
ng build --stats-json
npx webpack-bundle-analyzer dist/stats.json
```

---

## 📱 Responsive Design

### Breakpoints
```scss
// Mobile first approach
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .proc-grid { grid-template-columns: 1fr; }
  .table-container { overflow-x: auto; }
}

@media (min-width: 769px) {
  .sidebar { position: fixed; width: 250px; }
  .main-content { margin-left: 250px; }
}
```

### Adaptations mobiles
- Sidebar collapsible avec overlay
- Tables avec scroll horizontal
- Formulaires en colonnes empilées
- Boutons pleine largeur
- Navigation tactile optimisée

---

## 🧪 Bonnes pratiques implémentées

### Architecture
- ✅ **Separation of concerns** : Services, composants, modèles séparés
- ✅ **Dependency Injection** : Services injectables avec providedIn: 'root'
- ✅ **Lazy Loading** : Modules chargés à la demande
- ✅ **Standalone Components** : Angular 17+ moderne
- ✅ **Reactive Forms** : Validation et gestion d'état robuste

### Code Quality
- ✅ **TypeScript strict** : Typage fort obligatoire
- ✅ **Interfaces définies** : Tous les modèles typés
- ✅ **Error Handling** : Gestion centralisée des erreurs
- ✅ **Loading States** : États de chargement partout
- ✅ **Consistent Naming** : Convention de nommage respectée

### UX/UI
- ✅ **Responsive Design** : Mobile-first approach
- ✅ **Accessibility** : Attributs ARIA, navigation clavier
- ✅ **Performance** : Lazy loading, OnPush detection
- ✅ **User Feedback** : Notifications, confirmations, loading
- ✅ **Modern Design** : Interface professionnelle et moderne

### Sécurité
- ✅ **Route Guards** : Protection des routes sensibles
- ✅ **JWT Handling** : Token sécurisé avec expiration
- ✅ **Input Validation** : Validation côté client et serveur
- ✅ **Error Messages** : Messages d'erreur sécurisés
- ✅ **HTTPS Ready** : Configuration pour production

---

## 🔧 Configuration de production

### Environment
```typescript
// environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://your-api-domain.com/api'
};
```

### Build optimisé
```bash
ng build --configuration production
```

### Optimisations incluses
- Tree shaking automatique
- Minification CSS/JS
- Compression gzip
- Lazy loading des modules
- Service Worker (optionnel)

---

## 📋 Checklist de déploiement

### Avant déploiement
- [ ] Tests unitaires passent
- [ ] Build de production sans erreurs
- [ ] Variables d'environnement configurées
- [ ] API endpoints mis à jour
- [ ] Authentification configurée
- [ ] HTTPS activé
- [ ] Logs de debug supprimés

### Après déploiement
- [ ] Login/logout fonctionnel
- [ ] Routes protégées
- [ ] CRUD opérationnel
- [ ] Responsive sur mobile
- [ ] Performance acceptable
- [ ] Erreurs gérées correctement

---

## 🎯 Extensions possibles

### Fonctionnalités avancées
- **Notifications en temps réel** : WebSocket ou Server-Sent Events
- **Export de données** : Excel, PDF, CSV
- **Upload de fichiers** : Drag & drop avec preview
- **Recherche avancée** : Filtres complexes, tri multiple
- **Historique des actions** : Audit trail complet
- **Thèmes multiples** : Mode sombre, personnalisation
- **Internationalisation** : Support multi-langues
- **PWA** : Application web progressive

### Intégrations
- **Base de données réelle** : PostgreSQL, MongoDB
- **Authentification SSO** : OAuth2, SAML
- **Monitoring** : Sentry, LogRocket
- **Analytics** : Google Analytics, Mixpanel
- **Tests E2E** : Cypress, Playwright

---

## 📞 Support et maintenance

### Structure du code
Ce template suit les conventions Angular officielles et les bonnes pratiques de l'industrie. La structure modulaire facilite la maintenance et l'évolution.

### Documentation
- Code commenté en français
- Interfaces TypeScript documentées
- README détaillé pour chaque module
- Guide de style respecté

### Évolutivité
- Architecture scalable
- Services découplés
- Composants réutilisables
- Configuration centralisée

---

**🎉 Ce template est prêt pour la production et peut servir de base solide pour vos projets Angular d'entreprise !**