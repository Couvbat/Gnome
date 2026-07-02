# Le Gnome

**"La Taverne Dorée du Gnome"** — a Discord ecosystem combining AI conversations, music streaming, League of Legends stats, an XP/coin economy, and a multiplayer casino with an RPG progression system.

The project is a monorepo with three independent packages, each with its own `package.json`, `.env`, and test suite:

```text
gnome/
├── bot/       Discord bot — Discord.js v14 + TypeScript
├── backend/   Casino API server — Express.js + Socket.io + MongoDB
├── frontend/  Discord Activity UI — Vue 3 + TypeScript + Vite
└── docs/      Shared documentation
```

There is no root-level build or test script — work inside the relevant package directory.

## Packages

| Package | What it is | Documentation |
|---|---|---|
| `bot/` | Discord bot with 30 slash commands: AI chat, music, League of Legends stats, XP/coin economy, legacy solo casino games | [bot/README.md](bot/README.md) |
| `backend/` | REST API + WebSocket server powering the multiplayer casino and RPG character system, sharing MongoDB with the bot | [backend/README.md](backend/README.md) |
| `frontend/` | Vue 3 Discord Activity that renders the casino lobby and games inside Discord | [frontend/README.md](frontend/README.md) |

## What it offers

- **AI conversations** via Mistral AI — one-shot prompts, threaded conversations, and full voice-to-voice chat (Whisper transcription + TTS)
- **Music playback** from YouTube and SoundCloud with queue, playlist, and loop support
- **League of Legends integration** — stats, match history, champion rotation, and AI-powered match analysis
- **XP and coin economy** shared between the bot and the casino backend
- **RPG character system** — six classes (Warrior, Mage, Rogue, Merchant, Bard, Paladin), each with casino bonuses, special abilities, an energy system, and reputation progression
- **Multiplayer casino** — real-time Blackjack and Roulette tables over WebSocket, plus solo Slots and Dice
- **Discord Activity UI** — a Vue frontend rendering the casino inside Discord's embedded app surface

## Getting started

Each package is set up independently. See the package READMEs for full instructions:

- [Bot setup](bot/README.md#getting-started)
- [Backend setup](backend/README.md#getting-started)
- [Frontend setup](frontend/README.md#getting-started)

For production hosting (self-hosted TrueNAS LXC container + pm2), see [bot/README.md#deployment](bot/README.md#deployment).

### Prerequisites

- Node.js 22.17.0+
- MongoDB (local or Atlas) — shared between `bot/` and `backend/`
- FFmpeg and yt-dlp (bot audio features)
- mkcert (frontend local HTTPS, required for Discord Activity development)

### Quick install

```bash
git clone <repo-url>
cd gnome

# Bot (Discord commands)
cd bot
npm install
cp .env.example .env   # fill in tokens
npm run build
npm run deploy         # registers slash commands with Discord
npm run dev

# Backend (casino API, optional)
cd ../backend
npm install
cp .env.example .env
npm run dev

# Frontend (Discord Activity, optional)
cd ../frontend
npm install
npm run dev
```

## Documentation

| Document | Content |
|---|---|
| [docs/TESTING.md](docs/TESTING.md) | Testing setup and conventions for the bot and backend |
| [docs/RPG_SYSTEM.md](docs/RPG_SYSTEM.md) | Character classes, abilities, energy, and reputation systems |
| [docs/RPG_LORE.md](docs/RPG_LORE.md) | The Golden Gnome Tavern universe and its characters |
| [docs/ASSETS.md](docs/ASSETS.md) | Sourcing and organizing visual assets for the RPG/casino |
| [docs/FEATURES_IDEAS.md](docs/FEATURES_IDEAS.md) | Backlog of unimplemented feature ideas |

## Conventions

- TypeScript strict mode everywhere; no `any`
- Slash command descriptions are written in French; code, logs, and comments are in English
- Errors are logged in detail server-side and surfaced to users as generic messages
- Commits follow conventional format (`feat:`, `fix:`, `test:`, ...)

## License

ISC
