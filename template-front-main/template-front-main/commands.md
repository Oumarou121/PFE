# 🚀 Commandes utiles pour le développement

## Démarrage
```bash
# Serveur Angular (port 4200)
npm start
# ou
ng serve

# Serveur JSON (port 3001)
npx json-server --watch db.json --port 3001

# Les deux simultanément (si configuré)
npm run dev
```

## Génération de code
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

## Build et tests
```bash
# Build de développement
ng build

# Build de production
ng build --configuration production

# Tests unitaires
ng test

# Tests e2e
ng e2e
```

## Utilitaires
```bash
# Analyser le bundle
ng build --stats-json
npx webpack-bundle-analyzer dist/stats.json

# Linter
ng lint

# Formater le code
npx prettier --write "src/**/*.{ts,html,scss}"
```

## Nettoyage
```bash
# Nettoyer node_modules
rm -rf node_modules package-lock.json
npm install

# Nettoyer le cache Angular
ng cache clean

# Nettoyer localStorage (pour tests auth)
# Dans la console du navigateur :
localStorage.clear()
```

## Accès à l'application
- **Application Angular** : http://localhost:4200
- **API Mock (JSON Server)** : http://localhost:3001

## Compte de test
- **Email** : admin@test.com
- **Mot de passe** : admin123

## Endpoints API disponibles
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