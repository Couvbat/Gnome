# 🎰 Le Gnome Casino Backend

> Production-ready Express.js server with REST API and real-time WebSocket support for Discord Activity casino. Features 6 RPG character classes, multiplayer table management, and complete casino game engines.

**Backend for "La Taverne Dorée du Gnome": powering the multiplayer casino Discord Activity with full RPG integration, real-time gaming, and persistent economy system.**

## 📊 Implementation status

| Component | Status | Details |
|-----------|--------|---------|
| **REST API** | ✅ 100% | 18 endpoints (auth, casino, characters, games) |
| **WebSocket** | ✅ 100% | 15+ real-time events operational |
| **RPG System** | ✅ 100% | 6 character classes with casino bonuses |
| **Multiplayer Games** | ✅ 100% | Blackjack (2-6 players), Roulette (shared) |
| **Solo Games** | ✅ 100% | Slots, Dice with RNG + progressive jackpots |
| **Tests** | ✅ 99.6% | 238 tests (237 passing, 16 test files) |
| **Frontend Integration** | ✅ 100% | Complete API for Discord Activity |

**Key stats:**
- 4 game engines fully implemented
- 6 RPG character classes with unique abilities
- 2 table managers for multiplayer coordination
- 7 service modules (Character, Ability, Energy, Quest, etc.)
- Real-time WebSocket synchronization for all multiplayer features

> 📚 **Detailed documentation**: See [`/docs/RPG_SYSTEM.md`](../docs/RPG_SYSTEM.md) for complete architecture (1370 lines)

## 🚀 Démarrage

### Prérequis
- **Node.js** 18+
- **MongoDB** (local ou connection string)
- **Discord Bot** configuré (token et client ID)

### Installation Express

```bash
# Installation
npm install

# Configuration
cp .env.example .env
# Éditer .env avec votre configuration

# Build et lancement
npm run build
npm start
```

### Mode développement

```bash
npm run dev  # Hot reload activé
```

## 🔧 Configuration environnement

### Variables .env requises

```env
# Serveur
PORT=3001
NODE_ENV=development

# Base de données  
MONGODB_URI=mongodb://localhost:27017/gnome-casino

# Authentification
JWT_SECRET=jwt_secret

# Discord Integration
DISCORD_CLIENT_ID=discord_client_id
DISCORD_ACTIVITY_URL=http://localhost:3000

# Paramètres Casino
DEFAULT_STARTING_COINS=1000
DAILY_BONUS_BASE=100
MIN_BET_AMOUNT=10
```

### Rate Limiting
- **100 requêtes/minute** par IP par défaut
- Configurable via variables d'environnement

## 🧪 Tests & qualité

### Suite de tests complète

Le backend inclut une suite de tests extensive avec **238 tests** (99.6% pass rate):

```bash
# Exécuter tous les tests
npm test

# Tests en mode watch
npm run test:watch

# Tests E2E seulement
npm test -- --testNamePattern="e2e"
```

**Couverture des tests:**
- ✅ **Game Engines** (4 fichiers, ~80 tests)
  - BlackjackEngine, RouletteEngine, SlotsEngine, DiceEngine
- ✅ **Table Managers** (2 fichiers, ~40 tests)
  - BlackjackTableManager, RouletteTableManager
- ✅ **RPG Services** (5 fichiers, ~80 tests)
  - CharacterService, AbilityService, EnergyService, QuestService, ReputationService
- ✅ **E2E Tests** (3 fichiers, 34 tests)
  - Auth routes (10 tests), Casino routes (15 tests), RPG workflows (9 tests)
- ✅ **Unit Tests** (2 fichiers)
  - Character models, Casino routes

> 📖 **Documentation**: Voir `__tests__/E2E-README.md` pour guide complet des tests E2E

## 📡 API REST endpoints

### 🔐 Authentification

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/discord` | POST | Authentification via token Discord |
| `/api/auth/refresh` | POST | Rafraîchir token JWT |
| `/api/auth/me` | GET | Infos utilisateur actuel |

### 🧙‍♂️ Gestion des personnages

<details>
<summary><b>Création & Management</b></summary>

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/characters/classes` | GET | Liste des classes disponibles |
| `/api/characters/classes/:className` | GET | Détails d'une classe spécifique |
| `/api/characters/create` | POST | Créer nouveau personnage |
| `/api/characters/me` | GET | Personnage de l'utilisateur actuel |
| `/api/characters/:id/stats` | GET | Stats détaillées d'un personnage |
| `/api/characters/leaderboard` | GET | Classement par niveau |
| `/api/characters/search` | GET | Recherche par nom ou classe |

**Administration/Tests** :
- `PUT /api/characters/level-up` - Level up forcé (admin)
- `DELETE /api/characters/me` - Suppression personnage

</details>

### 💰 Profil casino

<details>
<summary><b>Économie & Progression</b></summary>

| Endpoint | Méthode | Description | Commande Remplacée |
|----------|---------|-------------|-------------------|
| `/api/casino/profile` | GET | Balance, XP, stats casino | `/balance` |
| `/api/casino/daily` | POST | Réclamation bonus quotidien | `/daily` |
| `/api/casino/leaderboard` | GET | Classement serveur | `/leaderboard` |

**Gestion Session** :
- `POST /api/casino/session/start` - Démarrer session casino
- `GET /api/casino/session` - Info session actuelle  
- `POST /api/casino/session/end` - Terminer session

**Status Jeux** :
- `GET /api/casino/games/status` - Jeux et tables disponibles

</details>

### 🎰 Jeux de casino

<details>
<summary><b>Jeux individuels</b></summary>

| Endpoint | Méthode | Description | Commande Remplacée |
|----------|---------|-------------|-------------------|
| `/api/games/slots/spin` | POST | Jouer aux machines à sous | `/slots` |
| `/api/games/dice/roll` | POST | Lancer de dés | `/dice` |

</details>

<details>
<summary><b>Jeux multijoueurs</b></summary>

**Gestion Tables** (✅ Nouveaux Endpoints):
- `POST /api/casino/tables/roulette/create` - Créer table roulette multijoueur
- `POST /api/casino/tables/blackjack/create` - Créer table blackjack (2-6 joueurs)
- `GET /api/casino/tables/:game` - Lister tables actives (roulette/blackjack)
- `GET /api/casino/tables/:game/:tableId` - État table spécifique
- `DELETE /api/casino/tables/:game/:tableId` - Fermer table
- `POST /api/casino/tables/:game/:tableId/start` - Démarrer partie
- `POST /api/casino/tables/cleanup` - Nettoyage auto tables inactives (30min+)

**Roulette** :
- `GET /api/games/roulette/status` - Statut table roulette (legacy)
- `POST /api/games/roulette/bet` - Placer pari roulette (via WebSocket recommandé)

**Blackjack** :
- `GET /api/games/blackjack/tables` - Liste des tables blackjack (legacy)
- `POST /api/games/blackjack/join` - Rejoindre table (via WebSocket recommandé)

> **Note**: Pour expérience multiplayer optimale, utiliser WebSocket events au lieu des endpoints REST pour actions en temps réel

</details>

## 🔌 Événements WebSocket (✅ 15+ events opérationnels)

### 🔗 Connexion & authentification

- Client se connecte avec token JWT via `socket.handshake.auth.token`
- Auto-rejoint la "guild room" pour événements spécifiques au serveur
- ✅ Authentification JWT vérifiée à chaque connexion

### 🃏 Événements Blackjack multiplayer

| Événement | Direction | Description | Statut |
|-----------|-----------|-------------|--------|
| `blackjack:join_table` | Client → Serveur | Rejoindre table blackjack (2-6 joueurs) | ✅ Opérationnel |
| `blackjack:place_bet` | Client → Serveur | Placer mise (phase betting) | ✅ Opérationnel |
| `blackjack:action` | Client → Serveur | Action joueur (hit/stand/double) | ✅ Opérationnel |
| `table:player_joined` | Serveur → Clients | Joueur rejoint table | ✅ Broadcast |
| `game:card_dealt` | Serveur → Clients | Carte distribuée (joueur ou dealer) | ✅ Broadcast |
| `game:round_complete` | Serveur → Clients | Résultats partie avec payouts classe | ✅ Broadcast |
| `player:left_table` | Serveur → Clients | Joueur quitte table | ✅ Broadcast |
| `table:cleanup` | Serveur → Clients | Table fermée (inactivité 30min) | ✅ Auto |

### 🎡 Événements Roulette multiplayer

| Événement | Direction | Description | Statut |
|-----------|-----------|-------------|--------|
| `roulette:join_table` | Client → Serveur | Rejoindre table roulette partagée | ✅ Opérationnel |
| `roulette:place_bet` | Client → Serveur | Placer pari (straight, split, corner, etc.) | ✅ Opérationnel |
| `table:player_joined` | Serveur → Clients | Nouveau joueur à la table | ✅ Broadcast |
| `betting:timer_update` | Serveur → Clients | Countdown timer 30s | ✅ Broadcast temps réel |
| `spin:result` | Serveur → Clients | Résultat spin + all winners + payouts | ✅ Broadcast |
| `player:left_table` | Serveur → Clients | Joueur quitte | ✅ Broadcast |

### 🎵 Événements Bard abilities (table-wide buffs)

| Événement | Direction | Description | Statut |
|-----------|-----------|-------------|--------|
| `bard:trigger_lucky_song` | Client → Serveur | Activer Lucky Song (+10% luck toute table) | ✅ Opérationnel |
| `buff:applied` | Serveur → Clients | Notification buff actif sur table | ✅ Broadcast |
| `buff:expired` | Serveur → Clients | Buff expiré | ✅ Broadcast |

### 🌐 Événements généraux casino

| Événement | Direction | Description | Statut |
|-----------|-----------|-------------|--------|
| `casino:get_balance` | Client → Serveur | Demande mise à jour balance | ✅ Opérationnel |
| `casino:balance_update` | Serveur → Client | Notification changement balance | ✅ Temps réel |
| `error` | Serveur → Client | Notification erreur (bet invalide, etc.) | ✅ Validation |

> **Total**: 15+ événements WebSocket fonctionnels pour communication temps réel multiplayer

## 📡 Migration des commandes Discord

### 📋 Mappage commande → API

| Commande Discord | Endpoint REST | Description |
|-----------------|---------------|-------------|
| `/balance` | `GET /api/casino/profile` | Pièces, XP, niveau, stats casino |
| `/daily` | `POST /api/casino/daily` | Réclamation bonus quotidien |
| `/leaderboard` | `GET /api/casino/leaderboard` | Classements serveur |
| **🆕 Création personnage** | `POST /api/characters/create` | **Créer personnage RPG avec classe** |
| **🆕 Info personnage** | `GET /api/characters/me` | **Stats et bonus de classe** |
| `/slots <mise>` | `POST /api/games/slots/spin` | Machine à sous |
| `/dice <mise> <prédiction>` | `POST /api/games/dice/roll` | Jeu de dés |
| `/roulette <mise> <type>` | `POST /api/games/roulette/bet` | Paris roulette |
| `/blackjack <mise>` | `POST /api/games/blackjack/join` | Rejoindre table blackjack |

### ✨ Nouvelles fonctionnalités vs commandes

| Feature | Commandes Discord | API Backend |
|---------|------------------|-------------|
| **Multijoueur** | ❌ Solo uniquement | ✅ Tables partagées temps réel |
| **Interface** | ❌ Messages texte | ✅ UI web riche |
| **Progression** | ❌ Pièces seulement | ✅ Classes RPG + stats |
| **Social** | ❌ Interactions limitées | ✅ Chat, spectateurs, équipes |
| **Analytics** | ❌ Basique | ✅ Stats détaillées par session |

## 🧙‍♂️ Système de classes RPG

Le serveur casino inclut un système de personnages RPG complet avec 6 classes distinctes offrant des bonus casino uniques :

### 🗡️ **Guerrier (Warrior)**
- **Description** : Combattant courageux qui compte sur force et bravoure
- **Bonus Casino** : +5 chance, +20 énergie, mécanisme comeback après pertes
- **Stats de Base** : Force élevée (20), Vitalité élevée (18)
- **Capacité Spéciale** : Rage de Combat - chance de gain plus élevée après défaite

### 🔮 **Mage**
- **Description** : Maître des arts arcaniques utilisant intelligence pour prédire
- **Bonus Casino** : +10 chance, +15 énergie, peut voir prochaine carte blackjack
- **Stats de Base** : Intelligence élevée (22), Chance élevée (15)
- **Capacité Spéciale** : Vision Arcanique - voir prochaine carte blackjack (1x/session)

### 🥷 **Voleur (Rogue)**
- **Description** : Filou rusé utilisant dextérité et esprit pour avantages
- **Bonus Casino** : +15 chance, +10 énergie, chance d'éviter les pertes
- **Stats de Base** : Dextérité élevée (20), Chance élevée (18)
- **Capacité Spéciale** : Tour de Passe-Passe - petite chance de ne pas perdre pièces

### 💰 **Marchand (Merchant)**
- **Description** : Négociant avisé comprenant argent et gestion des risques
- **Bonus Casino** : +8 chance, +25 énergie, gains et bonus quotidien améliorés
- **Stats de Base** : Charisme élevé (20), Intelligence élevée (16)
- **Capacité Spéciale** : Sens de l'Argent - gains bonifiés et meilleurs bonus quotidiens

### 🎵 **Barde (Bard)**
- **Description** : Artiste charismatique apportant chance et joie aux autres
- **Bonus Casino** : +12 chance, +15 énergie, augmente chance autres joueurs
- **Stats de Base** : Charisme élevé (22), Chance élevée (16)
- **Capacité Spéciale** : Chanson de Chance - augmente chance tous joueurs table

### ⚔️ **Paladin**
- **Description** : Guerrier sacré béni par protection divine
- **Bonus Casino** : +10 chance, +30 énergie, protection contre grosses pertes
- **Stats de Base** : Force (18), Charisme (18), Vitalité élevée (20)
- **Capacité Spéciale** : Bénédiction Divine - réduit grosses pertes, bonus charité

## 🏗️ Modèles de base de données

### 📊 Modèles principaux

**User** : Données utilisateur de base (pièces, XP, niveau)  
**Character** : Personnage RPG avec classe et stats  
**CasinoProfile** : Stats spécifiques casino et énergie  
**CasinoSession** : Tracking session de jeu active  

### 🎲 Modèles d'état de jeu

**BlackjackTable** : Tables blackjack multijoueurs  
**RouletteTable** : Paris roulette partagés  
**SlotMachine** : Machines à sous avec jackpots progressifs  
**CasinoGameLog** : Historique individuel des parties  

### 🎮 Modèles système RPG

**Quest** : Quêtes disponibles et récompenses  
**UserQuest** : Progression quête individuelle  
**Guild** : Mécaniques de guilde serveur  
**Item** : Équipements casino et porte-bonheur  

## 🎯 Fonctionnalités clés

### ✅ Avantages API REST

- **Sans état** : Chaque appel API indépendant
- **RESTful** : Méthodes HTTP standard et codes de statut  
- **Authentifié** : Sécurité basée token JWT
- **Validé** : Validation d'entrée et gestion d'erreurs
- **Rate Limited** : Prévention abus et spam

### ⚡ Fonctionnalités WebSocket temps réel

- **Casino en direct** : Gaming multijoueur temps réel
- **Mises à jour instantanées** : Changements de balance, notifications de paris
- **Système de chat** : Communication dans le casino  
- **Présence** : Notifications join/leave des joueurs
- **Sync état de jeu** : États de table synchronisés

### 🎰 Fonctionnalités casino améliorées

- **Tracking de session** : Monitoring sessions avec statistiques
- **Jackpots progressifs** : Jackpots machines à sous partagés
- **Tables multijoueurs** : Vraies tables blackjack et roulette  
- **Intégration personnage** : Bonus classe RPG affectent jeux casino
- **Système d'énergie** : Prévient gambling illimité
- **Analytics détaillées** : Tracking résultats jeu et statistiques

## 🔧 Configuration avancée

### ⚙️ Variables d'environnement complètes

```env
# Configuration Serveur
PORT=3001
NODE_ENV=development

# Base de Données
MONGODB_URI=mongodb://localhost:27017/gnome-casino

# Sécurité
JWT_SECRET=your-secure-jwt-secret-here
CORS_ORIGIN=http://localhost:3000

# Intégration Discord  
DISCORD_CLIENT_ID=discord_client_id
DISCORD_ACTIVITY_URL=http://localhost:3000

# Paramètres Casino
DEFAULT_STARTING_COINS=1000
DAILY_BONUS_BASE=100
MIN_BET_AMOUNT=10
MAX_BET_AMOUNT=10000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 🛡️ Rate Limiting & sécurité

- **100 requêtes/minute** par IP (configurable)
- **JWT Authentication** pour tous endpoints protégés  
- **CORS** configuré pour Discord Activity origine
- **Validation d'entrée** sur tous endpoints

## 🚀 Déploiement production

### 1️⃣ Build & préparation

```bash
# Build TypeScript
npm run build

# Vérifier variables d'environnement
echo $MONGODB_URI
echo $JWT_SECRET
```

### 2️⃣ Configuration base de données

- Assurer MongoDB accessible
- Configurer index pour performances
- Backup strategy en place

### 3️⃣ Configuration SSL & HTTPS

- **HTTPS requis** pour WebSocket sécurisés
- Certificats SSL valides
- Configuration proxy reverse si nécessaire

### 4️⃣ Monitoring & logs

```bash
# Logs structurés
npm run start 2>&1 | tee casino-server.log

# Monitoring santé serveur
curl http://localhost:3001/health
```

## 🔄 Migration depuis commandes Discord

### 📈 Avantages de l'architecture REST

Le serveur expose chaque commande Discord slash comme un endpoint API REST, ce qui facilite la transition des fonctionnalités casino existantes vers le format Discord Activity.

### ✨ Avantages clés vs commandes

| Aspect | Commandes Discord | API REST Backend |
|--------|------------------|------------------|
| **UX** | 🟡 Interface texte simple | ✅ Interface web riche |
| **Gaming** | ❌ Solo uniquement | ✅ Expérience casino multijoueur |
| **Features** | 🟡 Fonctionnalités de base | ✅ Progression RPG, guildes, système quêtes |
| **Scalabilité** | ❌ Limité par rate limits Discord | ✅ Gère plus de joueurs simultanés |
| **Stack** | 🟡 Bot Discord classique | ✅ Technologies web modernes |

### 🎮 Maintien de la compatibilité

- **Données utilisateur préservées** : Même base MongoDB  
- **Économie intégrée** : Pièces/XP partagés entre bot et casino
- **Migration graduelle** : Commandes existantes maintenues pendant développement
- **Fallback** : Version commande comme backup si Activity échoue

**🎰 Ready to transform Discord gaming experience!**  
*De simples commandes texte vers un casino multijoueur immersif*
