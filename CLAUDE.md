# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**"La Taverne Dorée du Gnome"** — a monorepo Discord ecosystem with three packages:

- `bot/` — Discord bot (Discord.js v14 + TypeScript): 30 slash commands, AI, music, LoL stats, economy
- `backend/` — Casino API server (Express.js + Socket.io + MongoDB): multiplayer games, RPG system
- `frontend/` — Discord Activity UI (Vue 3 + TypeScript + Vite): casino game interfaces

Each package has its own `package.json`, `tsconfig.json`, `.env`, and `__tests__/` directory. There is no root-level build or test script — work inside the relevant package directory.

Production hosting: the bot is self-hosted in an Ubuntu LXC container on TrueNAS under pm2, with a self-hosted MongoDB on the same LAN (`bot/README.md#deployment`). The backend deploys to o2switch cPanel via Setup Node.js App/Passenger, and the frontend as static files on an o2switch subdomain, both reaching that same home MongoDB over the internet (`backend/README.md#deployment`, `frontend/README.md#deployment`).

## Commands

### Bot (`cd bot/`)

```bash
npm run dev          # TypeScript hot-reload via ts-node
npm run build        # Compile to dist/
npm run deploy       # Build + register slash commands with Discord API
npm start            # Production (compiled JS)
npm test             # Run all tests (Vitest)
npm run test:watch   # Watch mode
npm run test:coverage
```

### Backend (`cd backend/`)

```bash
npm run dev          # ts-node-dev with hot reload (port 3001)
npm run build
npm start
npm test
npm run test:watch
npm run test:coverage
npm run lint         # ESLint
npm run lint:fix
```

### Frontend (`cd frontend/`)

```bash
npm run dev          # https://localhost:3000 (requires local HTTPS certs via mkcert)
npm run build        # vite bundle (no type check step)
npm run type-check   # vue-tsc type check (.vue + .ts only)
npm run preview
npm run lint
```

Running a single test file: `npm test -- path/to/file.test.ts` (Vitest accepts file patterns).

## Architecture

### Bot Command System

Commands live in `bot/commands/` as a **flat directory** (no nesting). Each file exports a typed object:

```typescript
export const command: Command = {
  data: new SlashCommandBuilder().setName('name').setDescription('Description'),
  async execute(interaction: CommandInteraction): Promise<void> { ... },
  cooldown: 5,  // optional seconds (default 3s)
  defer: true   // optional: auto-defers with "Done!" response
};
```

`bot/index.ts` is the entry point — it loads all commands, manages the `client.cooldowns` Collection (per-command cooldown tracking), handles XP tracking per message (5–15 XP, 30s cooldown), and dispatches interactions. `bot/deploy-commands.ts` is a standalone script that registers slash commands with the Discord API.

For long-running operations (any external API call), defer immediately: `await interaction.deferReply()` then `await interaction.editReply(...)`.

### AI Integration

Two Mistral conversation modes in the bot:
1. **Single-shot** (`commands/mistral.ts`): one prompt → one response
2. **Thread conversation** (`commands/conversation.ts`): 15-minute thread with `MessageCollector`; conversation history is **rebuilt from Discord thread messages** on every API call (not cached in memory)

Both use the "Le Gnome" system prompt: sarcastic gaming assistant focused on gaming/web dev/AI.

Mistral config: model `mistral-small-latest`, `temperature: 0.7`, `max_tokens: 1800–4096`.

Voice pipeline (`commands/listen.ts`): join voice channel with `selfDeaf: false` → `VoiceReceiver` captures Opus audio → OpenAI Whisper transcription → Mistral → TTS response. Temp audio files stored in `temp/` and deleted after transcription.

### Backend Casino Architecture

The backend has four layers:

- **Engines** (`src/engines/`): stateless game logic — `BlackjackEngine`, `RouletteEngine`, `SlotsEngine`, `DiceEngine`
- **Managers** (`src/managers/`): stateful multiplayer coordination — `BlackjackTableManager` (2–6 player turn-based), `RouletteTableManager` (30s betting timer → spin → payouts)
- **Services** (`src/services/`): business logic — `CharacterService`, `AbilityService`, `EnergyService`, `EconomyService`, `ReputationService`, `BardAbilities`, `QuestService`
- **WebSocket** (`src/websocket/socketHandlers.ts`): Socket.io handlers for real-time events (`roulette:join_table`, `blackjack:action`, `bard:trigger_lucky_song`, etc.)

The bot and backend **share the same MongoDB database** — the backend's `SharedEconomy` model (`src/models/database.ts`) points at the same `userlevels` collection the bot's `UserLevel` schema (`bot/database/db.ts`) writes to, keeping coin/XP balances in sync.

### RPG Character Classes

Six classes affect casino gameplay: Warrior (comeback mechanics), Mage (card prediction), Rogue (loss avoidance), Merchant (payout bonus), Bard (table-wide buffs via Lucky Song), Paladin (loss reduction). Class bonuses are applied at payout calculation in the engine layer.

### Frontend Discord Activity

Vue components connect to the backend via:
- `src/services/api.ts` — Axios REST client
- `src/services/websocket.ts` — Socket.io client
- `src/services/discordSdk.ts` — `@discord/embedded-app-sdk` for Discord Activity auth

Frontend requires HTTPS for Discord Activity development — local certs in `frontend/certs/` generated with `mkcert`.

## Key Conventions

- **Language**: TypeScript strict mode everywhere. No `any` — use explicit interfaces.
- **Command descriptions**: written in French; code, logs, and comments in English.
- **Error handling**: log detailed errors to console, send generic messages to users.
- **Docs**: avoid creating new markdown files. Update existing files in `docs/`. Do not create summary or changelog files after completing tasks. Only `README.md` files belong at package root level.
- **Commits**: conventional format — `feat:`, `fix:`, `test:`, etc.

## External APIs

| Service | Used in | Key detail |
|---|---|---|
| Mistral AI | bot | `api.mistral.ai/v1/chat/completions`, model `mistral-small-latest` |
| OpenAI Whisper | bot | `api.openai.com/v1/audio/transcriptions`, model `whisper-1` |
| Riot Games | bot | Platform: `euw1`, match data: `europe` regional endpoint |
| OpenLibrary | bot | `openlibrary.org/search.json` and `/subjects/{subject}.json` |

## Environment Setup

Each package needs its own `.env` from `.env.example`. Key variables:

- **bot**: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `RIOT_GAMES_API_KEY`, `MONGODB_URI`
- **backend**: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_ACTIVITY_URL` (doubles as the CORS origin)
- **frontend**: `VITE_DISCORD_CLIENT_ID`, `VITE_WS_URL` (optional; WebSocket defaults to the page origin)

System prerequisites: Node.js 22.17.0+, MongoDB, FFmpeg (audio), YT-DLP (YouTube streaming), mkcert (frontend HTTPS).

## Testing Patterns

Tests use Vitest and live in `__tests__/`. Mock Discord interactions and external APIs:

```typescript
import { vi } from 'vitest';

const mockInteraction = {
  user: { username: 'TestUser' },
  options: { getString: vi.fn().mockReturnValue('test') },
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined)
};

vi.mock('undici');
(request as any).mockResolvedValue({ body: { json: () => ({...}) } });
```

See `docs/TESTING.md` for the full testing guide.
