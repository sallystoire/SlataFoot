# Déploiement Railway

## Architecture
Deux services à déployer séparément sur Railway :
- **discord-bot** — le bot Discord
- **api-server** — le serveur d'images (cartes de match, profil, ticket)

## Étapes

### 1. Créer un projet Railway
Aller sur [railway.app](https://railway.app) → New Project → Deploy from GitHub repo

### 2. Ajouter une base de données PostgreSQL
Dans ton projet Railway → **Add Service** → **Database** → **PostgreSQL**  
Railway génère automatiquement la variable `DATABASE_URL`.

### 3. Déployer le Bot Discord

Créer un premier service → pointer sur ce repo → dans **Settings > Build** :
- **Root Directory** : `artifacts/discord-bot` (ou root avec railway.toml)
- **Start Command** : `pnpm exec tsx src/migrate.ts && pnpm start`

**Variables d'environnement** à ajouter dans Railway :
```
DISCORD_BOT_TOKEN=ton_token_ici
DATABASE_URL=${{Postgres.DATABASE_URL}}   ← injecté automatiquement par Railway
```

### 4. Déployer l'API Server

Créer un deuxième service → même repo → dans **Settings > Build** :
- **Root Directory** : `artifacts/api-server`
- **Start Command** : `pnpm start`

**Variables d'environnement** :
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=8080
```
Une fois déployé, Railway te donne un domaine public ex: `https://api-server-xxx.railway.app`

### 5. Connecter le Bot à l'API Server

Dans le service Bot, ajouter :
```
API_BASE_URL=https://api-server-xxx.railway.app
```

### 6. Enregistrer les Slash Commands

En local, avec les bonnes variables d'environnement :
```bash
DISCORD_BOT_TOKEN=xxx pnpm --filter @workspace/discord-bot exec tsx src/deploy-commands.ts
```

## Variables complètes

| Service    | Variable          | Valeur                              |
|------------|-------------------|-------------------------------------|
| Bot        | DISCORD_BOT_TOKEN | Token de ton bot Discord            |
| Bot        | DATABASE_URL      | URL PostgreSQL Railway              |
| Bot        | API_BASE_URL      | URL publique du service api-server  |
| API Server | DATABASE_URL      | URL PostgreSQL Railway              |
| API Server | PORT              | 8080 (ou laisse Railway le gérer)  |
