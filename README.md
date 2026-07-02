# Le Gnome Discord Bot

This document is the root-level overview of the Le Gnome monorepo: a Discord ecosystem combining AI conversations, a multiplayer casino with RPG classes, music streaming, and gaming integrations. It is aimed at developers setting up, extending, or contributing to the project.

> 🎭 **"La Taverne Dorée du Gnome"**: a comprehensive Discord ecosystem combining AI conversations, multiplayer casino with RPG classes, music streaming, and gaming integrations.

A complete Discord platform built with **TypeScript**, featuring **Artificial Intelligence**, **RPG character system**, **multiplayer casino economy**, and **multi-platform gaming integrations**.

## 🏗️ Monorepo architecture

```text
🏰 Le Gnome (Monorepo)
├─ 🤖 bot/              # Discord Bot (Discord.js v14 + TypeScript)
│                       # 30 slash commands, 239 tests (100% pass)
├─ 🎰 backend/          # Casino API Server (Express.js + Socket.io)
│                       # REST API + WebSocket, 238 tests (99.6% pass)
├─ 🎮 frontend/         # Discord Activity UI (Vue 3 + TypeScript)
│                       # 12 components, 85% complete
└─ 📚 docs/             # Complete documentation (5300+ lines)
```

## Package documentation links

- **[Bot documentation](bot/README.md)** - Discord bot setup, commands, testing
- **[Backend documentation](backend/README.md)** - Casino API, WebSocket events, RPG system
- **[Frontend documentation](frontend/README.md)** - Vue 3 UI, Discord Activity setup
- **[Testing guide](docs/TESTING.md)** - Comprehensive testing documentation
- **[RPG system](docs/RPG_SYSTEM.md)** - Character classes and casino bonuses

## ✨ What Le Gnome offers

**Le Gnome** transforms your Discord server into an interactive tavern where members can:
- Converse with **personalized AI** (Mistral AI)
- Develop **RPG characters** with classes and skills
- Play **multiplayer casino** games with class bonuses
- Listen to **music** from YouTube/SoundCloud
- Track their **League of Legends stats**
- Participate in an **economy system** with XP and levels

## ✨ Fonctionnalités principales

### 🤖 Intelligence artificielle
- **Chat IA Avancé** : Mistral AI avec personnalité "Le Gnome"
- **Conversations Thread** : Discussions longues avec historique
- **Voice-to-Voice** : Transcription Whisper + réponse vocale TTS
- **Analyse Gaming** : Insights IA sur performances League of Legends

### 🎰 Casino RPG (Discord Activity)
- **Classes de Personnage** : 6 classes avec bonus casino uniques
- **Jeux Multijoueurs** : Blackjack, Roulette, Slots progressifs
- **Système de Quêtes** : Missions quotidiennes et événements
- **NPCs Interactifs** : Croupiers avec personnalités distinctes

### 🎵 Système audio complet
- **Lecteur Musical** : YouTube et SoundCloud avec playlists
- **IA Conversationnelle Vocale** : Écoute + réponse parlée
- **Contrôles Avancés** : Queue, loop, skip avec embeds riches

### 🎮 Intégrations gaming
- **League of Legends** : Stats complètes + analyse IA des performances
- **Système XP/Niveaux** : Progression basée sur activité
- **Anniversaires** : Tracking et annonces automatiques

## 🚀 Getting started

> **📚 For detailed setup instructions, see the individual package READMEs:**
> - [Bot setup guide](bot/README.md#quick-start)
> - [Backend setup guide](backend/README.md#quick-start)
> - [Frontend setup guide](frontend/README.md#quick-start)

### Prerequisites
- **Node.js** 22.17.0+ 
- **MongoDB** (local or Atlas)
- **FFmpeg** (for audio features)
- **YT-DLP** (for YouTube streaming)

### Basic installation

```bash
# Clone repository
git clone repo_url
cd gnome

# Install bot (Discord commands)
cd bot
npm install
cp .env.example .env
# Edit .env with your tokens
npm run build
npm run deploy
npm run dev

# Install backend (Casino API - optional)
cd ../backend
npm install
cp .env.example .env
npm run build
npm start

# Install frontend (Discord Activity - optional)
cd ../frontend
npm install
npm run dev
```

### 📋 Variables d'environnement

Créez `.env` dans `/bot/` et `/backend/` :

```env
# Discord
DISCORD_TOKEN=bot_token
DISCORD_CLIENT_ID=client_id  
DISCORD_GUILD_ID=guild_id

# IA APIs
MISTRAL_API_KEY=mistral_api_key      # /mistral, /conversation
OPENAI_API_KEY=openai_api_key        # /listen (Whisper)

# Gaming APIs  
RIOT_GAMES_API_KEY=riot_api_key      # /lol-* commands

# Base de données
MONGODB_URI=mongodb://localhost:27017/gnome
```

> 💡 **Conseil** : Utilisez `.env.example` comme template complet

## 🎮 Commandes & fonctionnalités

<details>
<summary><b>🤖 Intelligence artificielle</b></summary>

| Commande | Description | Cooldown |
|----------|-------------|----------|
| `/mistral <prompt>` | Question unique à Mistral AI | 5s |
| `/conversation <prompt>` | Thread interactif 15min avec historique | 5s |
| `/listen start/stop` | Conversation voice-to-voice complète | 10s |

**Spécificités :**
- **Personnalité "Le Gnome"** : Assistant sarcastique passionné de gaming
- **Whisper STT** : Transcription audio temps réel (français optimisé)
- **TTS Response** : Réponses vocales automatiques dans le salon vocal

</details>

<details>
<summary><b>🎵 Lecteur musical</b></summary>

| Commande | Description | Support |
|----------|-------------|---------|
| `/play <query>` | Jouer musique ou URL | YouTube, SoundCloud |
| `/playlist <url>` | Charger playlist complète | YouTube, SoundCloud |
| `/queue` | File d'attente paginée | Embeds riches |
| `/pause` / `/resume` | Contrôle lecture | - |
| `/skip` / `/stop` | Navigation | Auto-disconnect |
| `/nowplaying` | Chanson actuelle | Miniature + infos |
| `/loop` | Répétition on/off | - |

</details>

<details>
<summary><b>🎮 League of Legends</b></summary>

| Commande | Description | Données |
|----------|-------------|---------|
| `/lol-stats <joueur> <tag>` | Profil + classement | Riot API EUW |
| `/lol-matches <joueur> <tag>` | 5 derniers matchs paginés | Historique détaillé |
| `/lol-lastgame <joueur> <tag>` | **Analyse IA** du dernier match | Insights Mistral |
| `/lol-rotation` | Champions gratuits semaine | Data Dragon |

</details>

<details>
<summary><b>⭐ Progression & économie</b></summary>

| Commande | Description | Gain |
|----------|-------------|------|
| `/rank [user]` | Niveau et progression XP | 5-15 XP/message |
| `/balance [user]` | Pièces, XP, niveau | niveau×50 au level-up |
| `/leaderboard` | Classement serveur | Top 10 niveaux |
| `/daily` | Récompense quotidienne | 50 + niveau×10 pièces |
| `/give <user> <amount>` | Transfer de pièces | - |

</details>

<details>
<summary><b>🎰 Casino (commandes legacy)</b></summary>

| Jeu | Commande | Mise Min | RTP |
|-----|----------|----------|-----|
| **Slots** | `/slots <mise>` | 10 pièces | ~85% |
| **Blackjack** | `/blackjack <mise>` | 10 pièces | ~99% |
| **Roulette** | `/roulette <mise> <pari>` | 10 pièces | ~97% |
| **Dés** | `/dice <mise>` | 10 pièces | ~90% |

> ⚠️ **Note** : Migration vers Discord Activity prévue

</details>

<details>
<summary><b>🎂 Utilitaires & social</b></summary>

| Commande | Description |
|----------|-------------|
| `/birthday set <jour> <mois>` | Enregistrer anniversaire |
| `/birthday check [user]` | Vérifier date d'anniversaire |
| `/book <thème> [count]` | Recommandations livres (OpenLibrary) |
| `/ping` | Latence bot |
| `/echo <message>` | Répéter message |

</details>

## 🛠️ Architecture technique

### 📁 Monorepo structure

```text
gnome/
├── bot/                  # 🤖 Discord Bot (TypeScript)
│   ├── commands/         # 30 commandes slash
│   │   ├── mistral.ts    # IA conversationnelle  
│   │   ├── listen.ts     # Voice-to-voice IA
│   │   ├── play.ts       # Lecteur musical
│   │   ├── lol-*.ts      # Intégration League of Legends (4 commandes)
│   │   ├── slots.ts      # Casino legacy (4 jeux)
│   │   └── ...           # + 18 autres commandes
│   ├── services/         # Services backend
│   │   ├── musicService.ts     # Queue musique
│   │   ├── xpTracking.ts       # Système XP
│   │   └── birthdayChecker.ts  # Anniversaires (cron)
│   ├── database/         # MongoDB ODM
│   ├── __tests__/        # 28 fichiers de test (82 tests)
│   └── types/            # Interfaces TypeScript
├── backend/              # 🎰 Casino API Server (Express.js)
│   ├── src/
│   │   ├── routes/       # 18 endpoints REST (casino, auth, characters)
│   │   ├── engines/      # 4 moteurs de jeux (Blackjack, Roulette, Slots, Dice)
│   │   ├── managers/     # Gestionnaires de tables multijoueurs
│   │   ├── models/       # Schémas MongoDB (User, Character, GameTable)
│   │   ├── services/     # 7 services métier (Character, Ability, Energy, Quest, etc.)
│   │   └── websocket/    # Socket.io handlers (15+ événements)
│   └── __tests__/        # 16 fichiers de test (238 tests)
├── frontend/             # 🎮 Discord Activity (React + TypeScript)
│   ├── src/
│   │   ├── components/   # 12 composants React
│   │   │   ├── CharacterCreation.tsx  # Création personnage 6 classes
│   │   │   ├── CasinoLobby.tsx        # Lobby principal
│   │   │   └── games/                 # 4 jeux implémentés
│   │   │       ├── BlackjackTable.tsx # Blackjack multijoueur
│   │   │       ├── RouletteWheel.tsx  # Roulette européenne
│   │   │       ├── SlotMachine.tsx    # Slots progressifs
│   │   │       └── DiceGame.tsx       # Jeu de dés
│   │   ├── services/     # API REST + WebSocket clients
│   │   ├── hooks/        # React hooks (useDiscordSdk)
│   │   └── types/        # TypeScript interfaces
│   └── (tests à venir)
└── docs/                 # 📚 Documentation (5342 lignes)
    ├── TESTING.md        # Guide tests complet (588 lignes)
    ├── FEATURES_IDEAS.md # Roadmap fonctionnalités (1673 lignes)
    ├── RPG_SYSTEM.md     # Architecture RPG complète (1370 lignes)
    ├── RPG_LORE.md       # Univers casino RPG (310 lignes)
    └── ASSETS.md         # Gestion assets visuels (424 lignes)
```

### 🔧 Technology stack

| Composant | Technologie | Version | Usage |
|-----------|-------------|---------|--------|
| **Langage** | TypeScript | 5.9.3 | Strict mode, typage complet |
| **Runtime** | Node.js | 22.17.0+ | Performance optimisée |
| **Bot Framework** | discord.js | 14.15.2 | API Discord complète |
| **Database** | MongoDB | 8.19.2 | Mongoose ODM |
| **HTTP Client** | undici | 6.18.1 | APIs externes modernes |
| **Tests** | Vitest | 3.2.4 | Suite complète (240+ tests) |
| **Audio** | @discordjs/voice | 0.19.0 | Streaming + transcription |
| **Web Server** | Express.js | - | API REST backend |

### 🎯 Development patterns

**TypeScript commands**:
```typescript
export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('exemple')
    .setDescription('Description'),
  
  async execute(interaction: CommandInteraction): Promise<void> {
    // Logic with full type safety
  },
  
  cooldown: 5,  // Optional cooldown in seconds
  defer: true   // Auto-defer for long operations
};
```

**Gestion d'erreurs centralisée**:
- Logs détaillés pour debugging
- Messages utilisateur génériques
- Recovery automatique pour crashes

**Tests unitaires**:
- Mocks Discord API et services externes
- Coverage 83% des commandes critiques  
- CI/CD ready avec Vitest

## 🎰 Casino RPG multijoueur

> ✅ **Backend complet** : API REST + WebSocket temps réel avec système RPG à 6 classes

### 🏰 La Taverne Dorée du Gnome

Système casino multijoueur avec **6 classes RPG** influençant directement les performances de jeu. Backend production-ready avec gestion de tables temps réel, bonus de personnages et communication WebSocket.

### 🧙‍♂️ Character classes & casino

| Classe | Bonus Casino | Capacité Spéciale | Statut |
|--------|-------------|-------------------|--------|
| **🗡️ Warrior** | +5 luck, comeback après pertes | Battle Rage (chance +15% post-défaite) | ✅ Implémenté |
| **🔮 Mage** | +10 luck, vision cartes | Arcane Insight (voir prochaine carte blackjack) | ✅ Implémenté |
| **🥷 Rogue** | +15 luck, évite certaines pertes | Sleight of Hand (annule petites pertes) | ✅ Implémenté |
| **💰 Merchant** | +8 luck, payouts améliorés | Coin Sense (+25% gains et daily) | ✅ Implémenté |
| **🎵 Bard** | +12 luck, bonus groupe | Lucky Song (chance +10% table entière) | ✅ Implémenté |
| **⚔️ Paladin** | +10 luck, protection divine | Divine Blessing (réduit grosses pertes) | ✅ Implémenté |

### 🎲 Multiplayer features implemented

**🃏 Tables de Blackjack** (2-6 joueurs) :
- ✅ Gestion tables multijoueurs avec verrouillage d'état
- ✅ Dealer automatique avec logique optimisée
- ✅ Actions synchronisées (hit, stand, double down)
- ✅ Bonus classe appliqués au payout final
- ✅ Nettoyage automatique après 30min inactivité

**🎡 Roulette partagée** :
- ✅ Timer 30s pour mises collectives avec broadcast temps réel
- ✅ Exécution spin avec calcul payouts simultanés
- ✅ Historique 50 derniers résultats par table
- ✅ Support paris multiples par joueur (straight, split, street, etc.)
- ✅ Buff Bard "Lucky Song" applicable table entière

**🎰 Slots** (implémentation individuelle) :
- ✅ RNG sécurisé avec symboles pondérés
- ✅ Jackpot progressif par classe de personnage
- ✅ Bonus multiplicateurs selon stats personnage

### 🔌 Backend API & WebSocket

**REST API** (`/backend/src/routes/casino.ts`) :
```bash
# Gestion Tables
POST   /api/casino/tables/roulette/create    # Créer table roulette
POST   /api/casino/tables/blackjack/create   # Créer table blackjack
GET    /api/casino/tables/:game              # Lister tables actives
GET    /api/casino/tables/:game/:tableId     # État table spécifique
DELETE /api/casino/tables/:game/:tableId     # Fermer table
POST   /api/casino/tables/:game/:tableId/start # Démarrer partie
POST   /api/casino/tables/cleanup            # Nettoyage auto

# Jeux Individuels (legacy)
POST   /api/casino/spin-slots                # Slot machine solo
POST   /api/casino/roll-dice                 # Dice game
```

**WebSocket Events** (`/backend/src/websocket/socketHandlers.ts`) :
```typescript
// Roulette Events
socket.emit('roulette:join_table', { tableId, userId })
socket.on('table:player_joined', { table, player })
socket.emit('roulette:place_bet', { tableId, bet })
socket.on('betting:timer_update', { tableId, timeRemaining })
socket.on('spin:result', { tableId, result, winners })

// Blackjack Events  
socket.emit('blackjack:join_table', { tableId, userId })
socket.emit('blackjack:action', { tableId, action, userId }) // hit/stand/double
socket.on('game:card_dealt', { tableId, card, recipientId })
socket.on('game:round_complete', { results, payouts })

// Bard Special Abilities
socket.emit('bard:trigger_lucky_song', { tableId, userId })
socket.on('buff:applied', { type, targets, duration })
```

### 📊 Backend architecture

**Table Managers** (`/backend/src/managers/`) :
- `RouletteTableManager.ts` : Gestion cycle complet roulette (30s timer → spin → payouts)
- `BlackjackTableManager.ts` : Tour par tour avec dealer automatique

**Game Engines** (`/backend/src/engines/`) :
- `RouletteEngine.executeMultiplayerSpin()` : Calcul payouts simultanés avec bonus classe
- `BlackjackEngine.dealInitialCards()` : Distribution 6-deck shoe pour tables
- `BlackjackEngine.playDealerTurnMultiplayer()` : Dealer joue selon règles standard + calcul payouts

**Services métier** (`/backend/src/services/`) :
- `CharacterService.ts` : CRUD personnages RPG avec progression
- `AbilityService.ts` : Déblocage et exécution compétences spéciales
- `BardAbilities.ts` : Buffs table-wide "Lucky Song" et "Harmony Boost"
- `EnergyService.ts` : Système énergie pour utilisation capacités

### 🗓️ Implementation status

| Composant | État | Détails |
|-----------|------|---------|
| **Backend API** | ✅ **100%** | 10 endpoints REST pour gestion tables + 8 endpoints RPG |
| **WebSocket** | ✅ **100%** | 15+ événements temps réel implémentés |
| **Système RPG** | ✅ **100%** | 6 classes avec bonus multijoueurs fonctionnels |
| **Roulette Multiplayer** | ✅ **100%** | Tables partagées avec timer + broadcast |
| **Blackjack Multiplayer** | ✅ **100%** | 2-6 joueurs, dealer automatique, payouts classe |
| **Bard Buffs** | ✅ **100%** | Lucky Song applicable tables entières |
| **Frontend Discord Activity** | ✅ **85%** | Interface React/TypeScript avec 12 composants |

**Frontend implémenté:**
- ✅ Création de personnage avec 6 classes RPG
- ✅ Lobby casino avec sélection de tables
- ✅ Table de Blackjack multijoueur (2-6 joueurs)
- ✅ Roulette européenne avec types de paris
- ✅ Machine à sous avec jackpots progressifs
- ✅ Jeu de dés avec paris prédictifs
- ✅ Intégration Discord SDK pour Activities
- ✅ WebSocket temps réel avec Socket.io
- ⏳ Animations 3D taverne (en cours)
- ⏳ Tests unitaires frontend (à venir)

> 📚 **Documentation technique** : Voir `docs/RPG_SYSTEM.md` pour détails complets (1370 lignes)

> 📁 **Code** : Backend et Frontend complets — ready pour déploiement Discord Activity

## 🧪 Développement & tests

### 🛠️ Development scripts

```bash
# Bot Discord
cd bot/
npm run dev          # Mode développement (hot reload)  
npm run build        # Compile TypeScript
npm run deploy       # Enregistre commandes Discord
npm test             # Exécute tests Vitest
npm run test:watch   # Tests en mode watch
npm run test:coverage # Rapport de couverture

# Casino Backend  
cd backend/
npm run dev          # Serveur Express + hot reload
npm run build        # Build production
npm test             # Tests API REST
```

### ✅ Test status

| Composant | Tests | Statut | Détails |
|-----------|-------|--------|---------|
| **Bot Discord** | 82 tests | ✅ 100% pass | 28 fichiers de test, 27 suites |
| **Backend Casino** | 238 tests | ✅ 99.6% pass | 16 fichiers, 237 passants |
| **Frontend** | 0 tests | ⏳ À venir | Interface implémentée, tests en attente |
| **Total** | **320 tests** | **✅ 99.7%** | **319 tests passants** |

**Couverture par catégorie (Bot):**
- ✅ **IA** : 2/2 commandes testées (100%)
- ✅ **Casino** : 6/6 commandes testées (100%)
- ✅ **LoL** : 4/4 commandes testées (100%)
- ✅ **XP/Économie** : 3/3 commandes testées (100%)
- 🟡 **Musique** : 2/8 commandes testées (25%)
- ✅ **Utilitaires** : 3/3 commandes testées (100%)

> 📚 **Guide complet** : Voir `docs/TESTING.md` pour détails

### 🏗️ Creating a new command

```bash
# 1. Template de base
cp bot/commands/ping.ts bot/commands/macommande.ts

# 2. Éditer avec logique TypeScript

# 3. Écrire tests
# Créer bot/__tests__/macommande.test.js

# 4. Vérifier et déployer
npm test
npm run deploy
npm run dev  # Redémarrer bot
```

### 📝 Project conventions

- **Langage** : TypeScript strict mode
- **Commandes** : Descriptions FR, code/logs EN
- **Types** : Interfaces explicites, éviter `any`
- **Tests** : Coverage minimum 80% pour nouvelles features
- **Commits** : Messages descriptifs (`feat:`, `fix:`, `test:`)

> 💡 **Guide IA** : `.github/copilot-instructions.md` pour agents de code

## 📊 Project status & roadmap

### 📈 Current metrics

| Métrique | Valeur | Statut |
|----------|--------|--------|
| **Version** | 1.0.0 | ✅ Stable |
| **Commandes** | 30 commandes slash | ✅ Opérationnel |
| **Tests** | 320 tests (319 passants) | ✅ 99.7% |
| **Backend API** | 18 endpoints REST | ✅ Production ready |
| **Frontend** | 12 composants React | ✅ 85% complet |
| **Code Quality** | TypeScript strict | ✅ Excellent |
| **Hébergement** | Compatible cPanel | ✅ Production ready |

### 🎯 Upcoming priorities

<details>
<summary><b>🔥 Haute priorité (Q1 2025)</b></summary>

1. **🎰 Casino Discord Activity** 
   - Migration des commandes vers interface web interactive
   - Système multijoueur temps réel (WebSocket)
   - Classes RPG avec bonus de jeu

2. **🧙‍♂️ Système de personnages**
   - 6 classes avec compétences uniques
   - Progression et déblocages
   - Intégration casino + autres features

3. **🎤 Voice-to-Voice IA améliorée**
   - TTS plus naturel et rapide  
   - Support multi-langues étendu
   - Conversations contextuelles longues

</details>

<details>
<summary><b>🔮 Moyenne priorité (Q2 2025)</b></summary>

- **🎮 Multi-gaming Stats** : Support Valorant, TFT, etc.
- **🏆 Système de tournois** : Brackets automatiques
- **🎵 IA DJ Mode** : Recommandations musicales intelligentes
- **📱 Interface mobile** : Optimisations Discord mobile

</details>

### 📚 Complete documentation

This monorepo contains comprehensive documentation for each package and system:

#### Package documentation
| Package | Documentation | Description |
|---------|--------------|-------------|
| **Bot** | [bot/README.md](bot/README.md) | Discord bot — 30 commands, AI integration, music player, LoL stats |
| **Backend** | [backend/README.md](backend/README.md) | Casino API server — REST endpoints, WebSocket events, game engines |
| **Frontend** | [frontend/README.md](frontend/README.md) | React Discord Activity — UI components, game interfaces |

#### System documentation
| Document | Location | Content |
|----------|----------|---------|
| **Testing guide** | [docs/TESTING.md](docs/TESTING.md) | Complete testing guide for bot and backend (652 lines) |
| **RPG system** | [docs/RPG_SYSTEM.md](docs/RPG_SYSTEM.md) | Character classes, abilities, casino bonuses (1370 lines) |
| **RPG lore** | [docs/RPG_LORE.md](docs/RPG_LORE.md) | Universe, characters, tavern story (310 lines) |
| **Features & roadmap** | [docs/FEATURES_IDEAS.md](docs/FEATURES_IDEAS.md) | Planned features and development roadmap (1673 lines) |
| **Assets guide** | [docs/ASSETS.md](docs/ASSETS.md) | Visual assets management (424 lines) |

#### Reference
- **Commands**: See [bot/README.md#commands-reference](bot/README.md#commands-reference)
- **API endpoints**: See [backend/README.md#api-reference](backend/README.md#api-reference)
- **WebSocket events**: See [backend/README.md#websocket-events](backend/README.md#websocket-events)
- **Components**: See [frontend/README.md#architecture](frontend/README.md#architecture)

## 🤝 Contribution

Pour contribuer au projet :

```bash
# 1. Fork & clone
git clone your-fork-url
cd gnome

# 2. Branche feature  
git checkout -b feature/ma-fonctionnalite

# 3. Développement avec tests
npm test  # Vérifier tests passants
# Développer votre feature...
npm test  # Re-vérifier

# 4. Commit & PR
git commit -m "feat: Ma nouvelle fonctionnalité"
git push origin feature/ma-fonctionnalite
# Ouvrir Pull Request
```

**Guidelines** :
- Tests obligatoires pour nouvelles features
- TypeScript strict, pas de `any`
- Descriptions de commandes en français
- Documentation à jour

## 📄 Licence & support

**Licence** : ISC License

**Support** :
- 🐛 **Issues** : [GitHub Issues](link-to-repo)  
- 📖 **Docs** : `README.md`, `TESTING.md`, `FEATURES_IDEAS.md`
- 🤖 **Dev Guide** : `.github/copilot-instructions.md`

**Développé avec ❤️ par Couvbat**  
*"Votre taverne Discord où IA, gaming et plaisir se rencontrent !"*
