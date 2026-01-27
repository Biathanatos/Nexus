# Nexus

Application web Node.js (Express + EJS) avec authentification JWT, base SQLite (node:sqlite) et gestion de services. L’app propose une petite plateforme pour créer, lister et consulter des “services” (scripts JS côté client), avec une interface d’édition intégrée.

## Démarrage

```bash
npm run dev
```

## Ce que l’app permet actuellement de faire

### Authentification & comptes
- Créer un compte utilisateur (inscription).
- Se connecter (JWT stocké en cookie httpOnly).
- Se déconnecter (suppression du cookie).
- Accéder à un profil utilisateur (données + apparence).
- Charger une liste de tons de peau de référence pour le profil.

### Services (gestion et consultation)
- Afficher la liste des services existants.
- Ouvrir une page de détail d’un service.
- Charger les tags associés à un service.
- Générer/servir le script client d’un service via une route dédiée.

### Création de services (éditeur intégré)
- Ouvrir la page de création d’un service (IA ou non‑IA).
- Pré‑remplir l’éditeur avec un template par défaut.
- Modifier le script dans un éditeur ACE intégré.
- Prévisualiser le script dans une iframe.
- Enregistrer le service en base + écrire le fichier JS sur disque.
- Ajouter des tags lors de la création.

### Données locales (SQLite)
- Stockage local SQLite (fichier unique dans src/data/).
- Tables pour utilisateurs, apparence, services, tags et liens service/tags.
- Tables additionnelles pour assistants/conversations (présentes mais non exposées par les routes actuelles).

## Routes principales

### Nexus
- GET / : page d’accueil (liste des services).

### Utilisateur
- GET /user/login : page de connexion.
- POST /user/login : connexion (création du JWT).
- GET /user/register : page d’inscription.
- POST /user/register : inscription.
- GET /user/profile : profil + apparence.
- GET /user/logout : déconnexion.

### Services
- GET /services/ : liste des services.
- GET /services/create/:is_ai : page de création (IA ou non).
- POST /services/create : création (fichier + DB).
- GET /services/:id/:is_ai : page détail d’un service.
- GET /services/:id/client.js : script client du service.

## Structure principale

- src/server.js : point d’entrée Express.
- src/routes/ : routes HTTP (nexus, user, services).
- src/db/ : accès base SQLite et helpers.
- src/middelware/ : middlewares d’authentification.
- src/public/ : assets statiques (JS/CSS).
- src/views/ : templates EJS.

## Notes de commentaires

- Les commentaires décrivent les paramètres, l’utilité et l’objectif des fonctions/routes.
- Des liens entre fichiers sont indiqués dans les commentaires.
- Le dossier src/services/ n’a pas été modifié (consigne respectée).

## Total lignes de code

- Total: 1925 lignes
- Périmètre: fichiers .js, .ejs et .css
- Exclus: node_modules/ et src/services/

## Scripts utiles

- npm run dev : démarre le serveur en mode développement
