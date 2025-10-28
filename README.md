# Gnome Discord Bot

Un bot Discord avec intégration Mistral AI et fonctionnalités vocales, écrit en TypeScript.

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone <repo-url>
   cd gnome
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration**
   
   Copier `.env.example` vers `.env` et remplir avec vos clés:
   ```bash
   cp .env.example .env
   ```
   
   Éditer `.env`:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_client_id
   DISCORD_GUILD_ID=your_guild_id
   MISTRAL_API_KEY=your_mistral_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Compiler le projet**
   ```bash
   npm run build
   ```

5. **Déployer les commandes**
   ```bash
   npm run deploy
   ```

6. **Lancer le bot**
   
   **Mode développement** (avec rechargement automatique):
   ```bash
   npm run dev
   ```
   
   **Mode production**:
   ```bash
   npm start
   ```

## Commandes

- `/ping` - Test de latence du bot
- `/echo <message>` - Répète un message
- `/user` - Affiche les informations sur l'utilisateur
- `/server` - Affiche les informations sur le serveur
- `/mistral <prompt>` - Pose une question à Mistral AI
- `/conversation <prompt>` - Démarre une conversation multi-tours avec Mistral AI dans un thread dédié (15 minutes)
- `/listen <action>` - Écoute un salon vocal et transcrit la parole en temps réel
  - `start` - Démarre l'écoute dans votre salon vocal actuel
  - `stop` - Arrête l'écoute et quitte le salon vocal

## Fonctionnalités

### IA Conversationnelle
- **Mistral AI** pour réponses intelligentes et conversations naturelles
- **Mode single-shot** (`/mistral`) : Question/réponse simple avec système de cooldown
- **Mode conversation** (`/conversation`) : Thread interactif de 15 minutes avec historique de conversation
- **Personnalité** : "Le Gnome" - un assistant amical mais sarcastique, passionné de gaming, développement web et IA générative

### Fonctionnalités Vocales
- **Rejoindre les salons vocaux** : Le bot peut se connecter à n'importe quel salon vocal où vous êtes présent
- **Transcription en temps réel** : Utilise l'API Whisper d'OpenAI pour convertir la parole en texte
- **Détection automatique** : Détecte automatiquement quand un utilisateur commence et arrête de parler
- **Support multilingue** : Configuré pour le français par défaut
- **Gestion de la latence** : Timeout de 300ms de silence avant de finaliser la transcription

### Système de Cooldown
- Cooldown par défaut de 3 secondes sur toutes les commandes
- Cooldowns personnalisés par commande (ex: `/listen` = 10s)
- Messages de cooldown éphémères pour éviter le spam

## Structure du Projet

```
gnome/
├── commands/              # Commandes slash (TypeScript)
│   ├── conversation.ts    # Conversation multi-tours avec Mistral
│   ├── echo.ts           # Commande de test echo
│   ├── listen.ts         # Écoute vocale avec transcription
│   ├── mistral.ts        # Question simple à Mistral
│   ├── ping.ts           # Test de latence
│   ├── server.ts         # Infos serveur
│   ├── template.ts       # Template pour nouvelles commandes
│   └── user.ts           # Infos utilisateur
├── types/                # Définitions de types TypeScript
│   └── command.ts        # Interface Command partagée
├── dist/                 # Fichiers JavaScript compilés (gitignored)
├── temp/                 # Fichiers audio temporaires (créé automatiquement)
├── __tests__/            # Tests unitaires
├── .github/
│   └── copilot-instructions.md  # Guide pour les agents IA
├── .env                  # Configuration (gitignored)
├── .env.example          # Template de configuration
├── .gitignore            # Fichiers à ignorer par Git
├── index.ts              # Point d'entrée du bot (TypeScript)
├── deploy-commands.ts    # Script de déploiement des commandes (TypeScript)
├── tsconfig.json         # Configuration TypeScript
├── package.json          # Dépendances et métadonnées
└── README.md             # Ce fichier
```

## Configuration Requise

### Variables d'Environnement
Créez un fichier `.env` à la racine avec les valeurs suivantes :

```env
# Discord Configuration
DISCORD_TOKEN=votre_token_discord_bot
DISCORD_CLIENT_ID=votre_client_id
DISCORD_GUILD_ID=votre_guild_id

# AI APIs
MISTRAL_API_KEY=votre_cle_mistral_api
OPENAI_API_KEY=votre_cle_openai_api  # Requis uniquement pour /listen
```

### Permissions Discord
Le bot nécessite les permissions suivantes :
- **Applications Commands** : Pour les commandes slash
- **Send Messages** : Pour envoyer des messages
- **Create Public Threads** : Pour le mode conversation
- **Connect** : Pour rejoindre les salons vocaux
- **Speak** : Permission vocale (même si le bot n'émet pas de son)
- **Use Voice Activity** : Pour détecter la parole des utilisateurs

### Intents Discord
Configurés automatiquement dans `index.js` :
- `Guilds` : Accès aux informations du serveur
- `GuildVoiceStates` : Accès aux états des salons vocaux (requis pour `/listen`)

## Utilisation des Commandes Vocales

### Démarrer l'écoute
1. Rejoignez un salon vocal
2. Exécutez `/listen action:start`
3. Le bot rejoindra votre salon et commencera à écouter
4. Parlez dans le salon - vos paroles seront transcrites et envoyées dans le canal textuel

### Arrêter l'écoute
- Exécutez `/listen action:stop` pour arrêter l'écoute et faire quitter le bot du salon vocal

### Limitations
- Un seul salon vocal actif par serveur à la fois
- La transcription nécessite une connexion internet stable
- Les fichiers audio temporaires sont automatiquement supprimés après transcription
- Cooldown de 10 secondes sur la commande `/listen`

## Dépendances Clés

### Production
- `discord.js@14.15.2` : Wrapper de l'API Discord
- `@discordjs/voice@0.17.0` : Support des fonctionnalités vocales
- `libsodium-wrappers@0.7.15` : Chiffrement pour l'audio (pur JavaScript, pas de compilation native)
- `undici@6.18.1` : Client HTTP moderne pour les appels API
- `dotenv@16.4.7` : Gestion des variables d'environnement

### Développement
- `jest@30.2.0` : Framework de test
- `@types/node@24.9.1` : Types TypeScript pour Node.js (pour de meilleurs suggestions dans l'éditeur)

## Développement

### TypeScript

Le projet utilise TypeScript pour une meilleure sécurité des types et une expérience de développement améliorée.

**Créer une nouvelle commande:**
```bash
cp commands/template.ts commands/macommande.ts
# Éditez le fichier, puis:
npm run deploy
```

Voir `commands/template.ts` pour la structure de base d'une commande.

### Conventions et Patterns
Voir `.github/copilot-instructions.md` pour les conventions et patterns du projet.

### Testing

Le projet utilise **Jest** pour les tests unitaires des commandes Discord.

#### Lancer les tests
```bash
npm test                  # Lancer tous les tests
npm run test:watch        # Mode watch (relance automatique)
npm run test:coverage     # Rapport de couverture de code
```

#### Documentation des tests
Voir `TESTING.md` pour:
- Guide complet de création de tests
- Templates et exemples
- Mocking des interactions Discord
- Mocking des APIs externes
- Bonnes pratiques

#### Structure des tests
```
__tests__/
├── setup.js           # Configuration globale
├── ping.test.js       # Tests pour /ping
├── echo.test.js       # Tests pour /echo
├── mistral.test.js    # Tests pour /mistral
└── listen.test.js     # Tests pour /listen
```

Tous les tests passent avec succès ✅

