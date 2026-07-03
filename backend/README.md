# Le Gnome — casino backend

Express.js + Socket.io + MongoDB server powering the multiplayer casino and RPG character system for "La Taverne Dorée du Gnome". It exposes a REST API for characters, progression, and solo games, plus a WebSocket layer for real-time multiplayer Blackjack and Roulette tables.

The backend shares its MongoDB database with the [bot](../bot/README.md) — economy fields (`coins`) live in the same underlying collection the bot uses, so balances stay in sync across both.

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB (local or connection string)
- A Discord application (for Activity integration)

### Installation

```bash
npm install
cp .env.example .env   # see Configuration below
npm run build
npm start               # production
npm run dev              # development (ts-node-dev, hot reload)
```

### Testing

```bash
npm test                                       # all tests
npm run test:watch
npm test -- --testNamePattern="e2e"            # e2e suites only
npm run test:coverage
npm run lint
```

## Configuration

Create `.env` in `backend/`:

```env
PORT=3001
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/gnome-casino

JWT_SECRET=jwt_secret

DISCORD_CLIENT_ID=discord_client_id
# Also used as the allowed CORS origin (REST and Socket.io)
DISCORD_ACTIVITY_URL=http://localhost:3000

DEFAULT_STARTING_COINS=1000
DAILY_BONUS_BASE=100
MIN_BET_AMOUNT=10
MAX_BET_AMOUNT=10000

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Architecture

```text
backend/
├── src/
│   ├── routes/          # REST endpoints (see API reference below)
│   ├── engines/          # stateless game logic
│   ├── managers/          # stateful multiplayer table coordination
│   ├── services/           # business logic (character, energy, reputation, abilities, quests)
│   ├── models/              # MongoDB schemas (database.ts, schemas.ts)
│   ├── websocket/
│   │   └── socketHandlers.ts   # Socket.io event handlers
│   ├── middleware/
│   │   ├── auth.ts             # JWT verification
│   │   └── validation.ts
│   └── index.ts                # server entry point, mounts routes, GET /health
└── __tests__/                   # unit + e2e (Vitest, supertest)
```

### Layers

- **Engines** (`src/engines/`) — stateless game rules: `CasinoGameEngine` (shared base: player context, luck/XP calculation, class ability triggers, result persistence), `BlackjackEngine`, `RouletteEngine`, `SlotsEngine`, `DiceEngine`.
- **Managers** (`src/managers/`) — stateful multiplayer coordination: `BlackjackTableManager` (2–6 players, turn timers, auto-dealer) and `RouletteTableManager` (30s betting rounds, synchronized spins).
- **Services** (`src/services/`) — `CharacterService`, `EconomyService`, `EnergyService`, `ReputationService`, `AbilityService`, `BardAbilities`, `QuestService`.
- **WebSocket** (`src/websocket/socketHandlers.ts`) — real-time events for table joins, bets, and game actions.

### Technology

| Component | Technology |
|---|---|
| Framework | Express.js |
| Language | TypeScript |
| Real-time | Socket.io |
| Database | MongoDB via Mongoose |
| Auth | JWT (`jsonwebtoken`) |
| Security | `helmet`, `cors`, `compression`, `rate-limiter-flexible` |
| Testing | Vitest, `supertest` (REST), `socket.io-client` (WebSocket) |

## API reference

All routes except `/api/auth/*` and `GET /health` require a JWT bearer token, validated by `authMiddleware`.

### Auth (`/api/auth`)

| Method | Path | Description |
|---|---|---|
| POST | `/dev` | Development-only login (disabled when `NODE_ENV=production`) |
| POST | `/discord` | Discord OAuth code exchange, or (with `discordToken` + `guildId`) verified-token login: the token is checked against Discord's API and guild membership before a JWT is issued |
| POST | `/refresh` | Refresh a JWT |
| GET | `/me` | Current user info; auto-creates the user record on first call |

### Characters (`/api/characters`)

| Method | Path | Description |
|---|---|---|
| GET | `/classes` | List all six character classes |
| GET | `/classes/:className` | Details for one class |
| POST | `/create` | Create a character |
| GET | `/me` | Current user's character |
| DELETE | `/me` | Delete the current character |
| GET | `/:characterId/stats` | Detailed stats for a character |
| GET | `/leaderboard` | Character leaderboard by level/XP |
| GET | `/search` | Search by name or class |

### Casino profile & tables (`/api/casino`)

| Method | Path | Description |
|---|---|---|
| GET | `/profile` | Balance, XP, and casino stats |
| POST | `/daily` | Claim the daily coin bonus and restore energy |
| POST | `/session/start` | Start (or resume) a casino session |
| GET | `/session` | Current session info |
| POST | `/session/end` | End the active session |
| GET | `/leaderboard` | Server ranking by level, coins, or casino winnings |
| GET | `/games/status` | Active tables and machines |
| POST | `/tables/roulette/create` | Create a multiplayer roulette table |
| POST | `/tables/blackjack/create` | Create a multiplayer blackjack table (2–6 players) |
| GET | `/tables/roulette` / `/tables/blackjack` | List active tables |
| GET | `/tables/roulette/:tableId` / `/tables/blackjack/:tableId` | Table state |
| DELETE | `/tables/roulette/:tableId` / `/tables/blackjack/:tableId` | Close a table |

`POST /slots/spin` and `POST /dice/roll` on this router return `410 Gone` — use the RPG-integrated endpoints under `/api/games` instead.

### Solo games (`/api/games`)

| Method | Path | Description |
|---|---|---|
| POST | `/slots/spin` | Play the slot machine (min bet 10) |
| POST | `/dice/roll` | Roll dice with a prediction (min bet 10) |
| GET | `/dice/info` | Prediction types and payouts |
| POST | `/blackjack/play` | Single-player blackjack (min bet 10) |
| GET | `/blackjack/info` | Strategy and bonus info |
| POST | `/roulette/play` | Single-player roulette, multiple bets (min total 10) |
| GET | `/roulette/info` | Bet types and payouts |
| GET | `/stats/user` | Per-game aggregated stats for the current user |
| GET | `/leaderboard` | Coin leaderboard, optionally filtered by period |

### Progression (`/api/progression`)

| Method | Path | Description |
|---|---|---|
| GET | `/energy` | Current energy status |
| GET | `/reputation` | Current reputation tier and points |
| GET | `/reputation/tiers` | All tier definitions |
| GET | `/reputation/bonuses` | Bonuses for the current tier |
| GET | `/abilities` | Status of all class abilities |
| GET | `/abilities/:abilityKey` | Status of a specific ability |
| GET | `/stats` | Combined energy + reputation + abilities |

### Quests (`/api/quests`)

| Method | Path | Description |
|---|---|---|
| GET | `/available` | Quests available to the player |
| GET | `/active` | Player's active quests |
| GET | `/history` | Completed quest history |
| POST | `/:questId/start` | Start a quest |
| POST | `/:questId/abandon` | Abandon a quest |
| POST | `/admin/init-daily` | Seed daily quests for the guild |
| POST | `/admin/init-story` | Seed story quests for the guild |

## WebSocket events

Clients authenticate with a JWT via `socket.handshake.auth.token`.

### Blackjack

| Event | Direction | Payload |
|---|---|---|
| `blackjack:join_table` | client → server | `{ tableId, characterClass? }` |
| `blackjack:place_bet` | client → server | `{ tableId, betAmount }` |
| `blackjack:hit` / `blackjack:stand` | client → server | `{ tableId }` |
| `blackjack:leave_table` | client → server | `{ tableId }` |
| `blackjack:joined`, `blackjack:bet_confirmed`, `blackjack:hit_result`, `blackjack:stand_confirmed` | server → requester | — |
| `blackjack:player_joined`, `blackjack:bet_placed`, `blackjack:game_started`, `blackjack:turn_warning`, `blackjack:player_hit`, `blackjack:player_stand`, `blackjack:turn_changed`, `blackjack:dealer_reveal`, `blackjack:dealer_draw`, `blackjack:game_complete`, `blackjack:new_round`, `blackjack:player_left` | server → table | — |

### Roulette

| Event | Direction | Payload |
|---|---|---|
| `roulette:join_table` | client → server | `{ tableId }` |
| `roulette:place_bet` | client → server | `{ tableId, bet }` |
| `roulette:leave_table` | client → server | `{ tableId }` |
| `roulette:table_state`, `roulette:bet_placed` | server → requester | — |
| `roulette:player_joined`, `roulette:betting_opened`, `roulette:betting_closing`, `roulette:player_bet`, `roulette:betting_closed`, `roulette:spin_started`, `roulette:spin_result`, `table:player_left` | server → table | — |

### Bard abilities (table-wide buffs)

| Event | Direction | Payload |
|---|---|---|
| `bard:trigger_lucky_song` | client → server | `{ tableId, gameType }` |
| `bard:ability_triggered` | server → requester | — |
| `bard:harmony_boost_active`, `bard:buff_applied` | server → table | — |

### General

| Event | Direction | Description |
|---|---|---|
| `casino:player_left` | server → guild room | Broadcast on disconnect |
| `error` | server → client | `{ message }`, used across all handlers |

## RPG character system

Six classes, each with a unique casino bonus and special ability. See [docs/RPG_SYSTEM.md](../docs/RPG_SYSTEM.md) for the full technical reference (energy, reputation, ability cooldowns, per-game bonus tables).

| Class | Playstyle |
|---|---|
| Warrior | High-risk comeback specialist — bonus payout after a loss |
| Mage | Strategic, information-based — sees blackjack card probabilities |
| Rogue | Risk mitigation — chance to lose only half a bet |
| Merchant | Steady profit — flat bonus on all winnings |
| Bard | Social/multiplayer — can buff every player at a table |
| Paladin | Defensive — reduces large losses |

Character data lives in `Character` (class, stats, XP) and `CasinoProfile` (energy, reputation, casino stats) — see [Database schemas](../docs/RPG_SYSTEM.md#database-schemas).

## Deployment

The backend deploys to **o2switch shared hosting** via cPanel's **Setup Node.js App** (CloudLinux Node.js selector + Phusion Passenger), on its own subdomain (e.g. `api.example.com`). MongoDB stays **self-hosted at home** on the same box as the [bot](../bot/README.md#deployment) — the backend reaches it over the internet.

### cPanel application setup

1. In cPanel, create the subdomain (e.g. `api.example.com`) and enable AutoSSL for it (SSL/TLS Status → Run AutoSSL). HTTPS is mandatory for Discord Activities.
2. Over SSH, clone the repo **inside the application root** — the physical folder named after the subdomain:
   ```bash
   git clone <repo-url> ~/api.example.com/gnome
   ```
3. In **Setup Node.js App** (*Créer une application*), create the application:
   - **Node.js version** — the newest available (o2switch offers 24.x; 18 minimum)
   - **Application mode** (*Mode d'application*) — `Production`. This is what sets `NODE_ENV` — don't add it as an env variable.
   - **Application root** (*Racine de l'application*) — the subdomain's folder: `api.example.com`
   - **Application URL** (*URL de l'application*) — the subdomain, path left empty (mounted at `/`)
   - **Application startup file** (*Fichier de démarrage*) — `gnome/backend/dist/index.js`, relative to the application root
4. Copy the "enter to virtual environment" command shown at the top of the app's page, run it over SSH, then install and build from the backend package:
   ```bash
   cd ~/api.example.com/gnome/backend
   npm ci
   npm run build
   ```
5. Add the environment variables in the app's UI (*Ajouter une variable*): `MONGODB_URI`, `JWT_SECRET`, `DISCORD_CLIENT_ID`, and `DISCORD_ACTIVITY_URL` (this is also the allowed CORS origin — set it to the Activity's proxy origin, `https://<discord-app-id>.discordsays.com`). **Do not set `PORT`** — Passenger assigns it and the server already reads `process.env.PORT`.
6. Click **Restart** in the app UI. Verify with `curl https://api.example.com/health`.

### Reaching the home MongoDB

The backend and the bot must share the same database, so `MONGODB_URI` points back to the self-hosted MongoDB. Exposing it requires care — never put an auth-less MongoDB on the internet:

- Enable **authentication** on MongoDB and use a dedicated user in the connection string.
- Forward a **non-default external port** on the router to the MongoDB host.
- Restrict the forwarded port to the **o2switch server's IP** in the router/TrueNAS firewall.
- Expect some added latency per game action (each play does several DB round-trips across the internet); if it becomes noticeable, the alternative is hosting the backend at home next to the bot and keeping only the static frontend on o2switch.

### Socket.io behind Passenger

o2switch fronts Node apps with LiteSpeed + Passenger, which supports WebSocket upgrades. The frontend pins `transports: ['websocket']` — if the upgrade is ever refused by the proxy, remove that option in `frontend/src/services/websocket.ts` so Socket.io can fall back to HTTP long-polling.

### Updating

```bash
cd ~/api.example.com/gnome && git pull
cd backend
npm ci
npm run build
```

Then **Restart** the app from the cPanel UI (or `touch ~/api.example.com/tmp/restart.txt` — Passenger watches `tmp/restart.txt` under the application root).

## Further reading

- [Bot](../bot/README.md)
- [Frontend Discord Activity](../frontend/README.md)
- [Testing guide](../docs/TESTING.md)
- [RPG system](../docs/RPG_SYSTEM.md)
- [RPG lore](../docs/RPG_LORE.md)
