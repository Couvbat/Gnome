# Le Gnome — casino frontend

Vue 3 + TypeScript + Vite frontend for the Discord Activity casino "La Taverne Dorée". Renders character creation and the multiplayer casino games inside Discord's embedded app surface.

## Getting started

### Prerequisites

- Node.js 22.17.0+
- The [backend](../backend/README.md) running on port 3001
- A Discord application configured for Activities
- mkcert (local HTTPS)

### Installation

```bash
npm install
```

### HTTPS setup (required for Discord Activity)

```bash
# install mkcert, e.g.
winget install FiloSottile.mkcert   # Windows
brew install mkcert                 # macOS

mkcert -install

mkdir certs && cd certs
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1
```

`vite.config.ts` picks up `certs/localhost.pem` and `certs/localhost-key.pem` automatically if present; otherwise it falls back to plain HTTP.

### Environment configuration

Create `.env` in `frontend/`:

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
VITE_DISCORD_CLIENT_ID=discord_client_id
```

### Discord Developer Portal setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and select your application.
2. Enable **Activities**.
3. Set the **Activity URL Override** to `https://localhost:3000/`.

### Development

```bash
npm run dev          # dev server on https://localhost:3000
npm run build         # production build (no type check)
npm run type-check    # vue-tsc, checks .vue and .ts files
npm run preview
npm run lint
npm test               # Vitest
npm run test:watch
npm run test:coverage
```

To test inside Discord: start the backend, start the frontend, join a voice channel, then launch the Activity from the Activities menu — the app loads with Discord OAuth handling authentication.

Opening `https://localhost:3000` directly in a browser (outside Discord) falls back to a mock Discord SDK plus `apiService.devLogin`, so the character-creation and casino flows can be exercised without going through Discord.

## Architecture

### Stack

| Technology | Purpose |
|---|---|
| Vue 3 (Composition API, `<script setup>`) | UI framework |
| TypeScript | Type-safe development |
| Vite | Build tool and dev server |
| PrimeVue 4 (Aura theme) | Component library |
| Tailwind CSS 4 | Utility styling |
| `@discord/embedded-app-sdk` | Discord Activity authentication and voice-participant info |
| Socket.io-client | Real-time WebSocket connection to the backend |
| Axios | REST client |
| Vitest + `@vue/test-utils` | Testing |

There is no router (view switching is a local `ref` in `App.vue`) and no global state library (Pinia/Vuex) — shared reactive state lives in composables (`useDiscordSdk`, `useEnergy`).

### Project structure

```text
frontend/
├── src/
│   ├── App.vue                 # root component; Discord SDK init, auth, view routing
│   ├── main.ts                  # createApp + PrimeVue registration
│   ├── components/
│   │   ├── CharacterCreation.vue   # class picker + character creation
│   │   ├── CasinoLobby.vue          # game selection hub
│   │   ├── CharacterProfile.vue
│   │   ├── UserProfileModal.vue
│   │   ├── VoiceParticipants.vue
│   │   ├── games/
│   │   │   ├── BlackjackTable.vue
│   │   │   ├── RouletteWheel.vue
│   │   │   ├── SlotMachine.vue
│   │   │   ├── DiceGame.vue
│   │   │   └── blackjack/          # BettingControls, DealerSection, GameControls, PlayerSeat
│   │   ├── atoms/                    # Badge, Button, Card, Icon, Input, Modal, ProgressBar, Spinner, ...
│   │   ├── molecules/                 # BetControls, GameCard, LoadingScreen, RouletteBetButtons, ...
│   │   └── organisms/                  # AppHeader, CharacterInfoCard, EnergyDisplay, GamesGrid, ...
│   ├── composables/
│   │   ├── useDiscordSdk.ts
│   │   └── useEnergy.ts
│   ├── services/
│   │   ├── api.ts              # Axios REST client
│   │   ├── websocket.ts        # Socket.io-client wrapper
│   │   └── discordSdk.ts       # Discord embedded-app-sdk wrapper (falls back to a mock outside Discord)
│   ├── utils/
│   │   └── cardUtils.ts         # playing-card helpers
│   ├── constants/index.ts       # CHARACTER_CLASSES, GAME_CONFIG, ROULETTE_CONFIG, ...
│   ├── types/index.ts
│   ├── assets/kenney_playing-cards-pack/   # card artwork
│   └── __tests__/               # api, cardUtils, discordSdk, websocket tests
├── certs/                       # local HTTPS certs (gitignored)
├── vite.config.ts               # HTTPS, /api and /socket.io proxy to :3001, Discord CSP headers
├── vitest.config.ts
└── tailwind.config.js
```

### Services

- **`api.ts`** — Axios client (base URL `/api`) with a bearer-token interceptor. Exposes `login`, `devLogin`, `getCurrentUser`, character CRUD, table creation, `spinSlots`, `rollDice`, `getEnergy`, and game history.
- **`websocket.ts`** — Socket.io-client wrapper exposing `connect`/`disconnect`/`on`/`off`/`emit` plus typed helpers for joining tables, betting, hitting/standing, and triggering the Bard's Lucky Song ability.
- **`discordSdk.ts`** — wraps `@discord/embedded-app-sdk`: initialization, current user/channel/guild, voice participants, activity state. Falls back to a mock SDK when not running inside Discord, for local development.

## Features

### Character creation

Six RPG classes (Warrior, Mage, Rogue, Merchant, Bard, Paladin), defined in `src/constants/index.ts`. Selecting a class shows its casino bonus and special ability before confirming creation via `apiService.createCharacter`.

### Casino games

- **Blackjack** — multiplayer table (2–6 players), dealer section, hit/stand/double controls, synchronized via WebSocket
- **Roulette** — European wheel (0–36), interactive betting grid, synchronized betting timer
- **Slots** — themed reels with progressive jackpot
- **Dice** — two-dice roll with prediction-based multipliers

All four games connect to the backend's REST API for solo actions and Socket.io for multiplayer table state.

## Testing

Four Vitest test files under `src/__tests__/`, using `@vue/test-utils` and jsdom: `api.test.ts`, `cardUtils.test.ts`, `discordSdk.test.ts`, `websocket.test.ts`.

## Troubleshooting

**Discord Activity won't load** — check the HTTPS certs are valid, the backend is running on port 3001, and the Activity URL in the Discord Developer Portal matches.

**WebSocket connection fails** — verify `VITE_WS_URL` matches the backend and check the browser console for connection errors.

**Character creation errors** — check the backend `/api/characters/create` endpoint and MongoDB connectivity.

## Further reading

- [Backend casino API](../backend/README.md)
- [Bot](../bot/README.md)
- [Testing guide](../docs/TESTING.md)
- [RPG system](../docs/RPG_SYSTEM.md)

## License

ISC
