# SIRH-Doc Editor Frontend

Frontend Angular 17 migre depuis le projet `Editor` et base sur l'architecture de `template-front-main`.

Important: les ecrans `Editor` sont conserves tels quels dans `src/assets/editor-legacy`
et exposes par le router Angular via un composant hote. Cela permet de garder le DOM,
le CSS et la logique d'origine pendant la migration vers le backend .NET 8.

## Fonctionnalites migrees

- `login.html` original
- `superAdmin.html` original
- `admin.html` original
- `user.html` original
- `shared.js` original adapte au backend .NET 8
- `cursorResize.js` original

## Routes Angular

- `/login`
- `/super-admin`
- `/admin`
- `/user`

## Demarrage

```bash
npm install
npm start
```

Par defaut, le frontend appelle:

```text
https://localhost:5001/api
```

Modifier `src/environments/environment.ts` si le backend .NET ecoute sur un autre port.

Compte de test herite de `Editor`:

```text
super.admin@gmail.com / azerty
```
