# Le Gnome — Discord bot

The core Discord bot for "La Taverne Dorée du Gnome": AI conversations, music streaming, League of Legends integration, an XP/coin economy, and legacy solo casino commands.

Built with **Discord.js v14** and **TypeScript** in strict mode. Slash command descriptions are written in French; code, logs, and comments are in English.

## Getting started

### Prerequisites

- Node.js 22.17.0+
- MongoDB (local or Atlas)
- FFmpeg
- yt-dlp (YouTube/SoundCloud streaming)
- A Discord application with a bot token

### Installation

```bash
npm install
cp .env.example .env   # fill in tokens, see Configuration below
npm run build
npm run deploy          # registers slash commands with Discord (single guild)
npm run dev              # development (ts-node, hot reload)
npm start                # production (compiled JS)
```

### Testing

```bash
npm test               # run all tests (Vitest)
npm run test:watch
npm run test:coverage
```

## Configuration

Create `.env` in `bot/`:

```env
# Discord
DISCORD_TOKEN=discord_bot_token
DISCORD_CLIENT_ID=discord_client_id
DISCORD_GUILD_ID=guild_id          # commands are deployed to this guild only

# AI services
MISTRAL_API_KEY=mistral_api_key    # /mistral, /conversation, /lol-lastgame
OPENAI_API_KEY=openai_api_key      # /listen (Whisper transcription)

# Gaming
RIOT_GAMES_API_KEY=riot_api_key    # /lol-* commands

# Database
MONGODB_URI=mongodb://localhost:27017/gnome
```

Use `.env.example` as the full reference template.

## Commands reference

30 slash commands across six categories, all defined as flat files in `commands/`.

### AI

| Command | Description | Cooldown |
|---|---|---|
| `/mistral <prompt>` | One-shot question to Mistral AI | 5s |
| `/conversation <prompt>` | Starts a 15-minute threaded conversation with history | 5s |
| `/listen <start\|stop>` | Voice conversation: Whisper transcription → Mistral → TTS | 10s |

### Music

| Command | Description |
|---|---|
| `/play <query>` | Play music from a search query or URL (YouTube) |
| `/playlist <url>` | Add a YouTube or SoundCloud playlist to the queue |
| `/pause` | Pause playback |
| `/resume` | Resume playback |
| `/skip` | Skip to the next track |
| `/stop` | Stop music and clear the queue |
| `/queue` | Show the music queue |
| `/nowplaying` | Show the currently playing track |
| `/loop` | Toggle looping for the current track |

### League of Legends

| Command | Description |
|---|---|
| `/lol-stats <player> <tag>` | Player profile and ranked stats (Riot API, EUW) |
| `/lol-matches <player> <tag>` | Match history |
| `/lol-lastgame <player> <tag>` | Last match with AI-generated analysis |
| `/lol-rotation` | This week's free champion rotation |

### Progression & economy

| Command | Description |
|---|---|
| `/rank [user]` | Level and XP progress |
| `/balance [user]` | Coins, XP, and level |
| `/leaderboard` | Server ranking by level/XP |
| `/daily` | Claim the daily coin bonus |
| `/give <user> <amount>` | Transfer coins to another user |

### Casino (legacy, solo)

| Command | Description |
|---|---|
| `/slots <bet>` | Slot machine |
| `/blackjack <bet>` | Blackjack against the dealer |
| `/roulette <bet> <type>` | European roulette |
| `/dice <bet>` | Two-dice betting game |

The multiplayer casino with RPG character bonuses lives in the [`backend/`](../backend/README.md) and [`frontend/`](../frontend/README.md) packages and shares the same coin balance.

### Utilities & social

| Command | Description |
|---|---|
| `/birthday <set\|check\|remove\|list>` | Manage server members' birthdays |
| `/book <theme> [count]` | Book recommendations from OpenLibrary |
| `/ping` | Bot latency |
| `/echo <message>` | Repeats the message |
| `/help` | Lists available commands |

## Architecture

### Project structure

```text
bot/
├── commands/          # 30 slash command files (flat, no subfolders)
├── services/
│   ├── musicService.ts     # queue and playback manager
│   ├── ytdlpService.ts     # yt-dlp wrapper for streaming
│   ├── xpTracking.ts       # per-message XP tracking
│   └── birthdayChecker.ts  # daily cron for birthday announcements
├── database/
│   └── db.ts           # Mongoose schema + data-access helpers
├── types/
│   └── command.ts       # Command interface
├── __tests__/           # Vitest test suite
├── index.ts              # entry point
├── deploy-commands.ts     # slash command registration script
└── vitest.config.ts
```

### Entry point (`index.ts`)

- Loads every command from `commands/`, populating the `client.commands` Collection
- Tracks per-command cooldowns in `client.cooldowns` (default 3s, overridable per command)
- Tracks XP per message via `xpTracking.ts`
- Registers `interactionCreate` (chat input + autocomplete) and `messageCreate` handlers
- Runs a small HTTP server on `process.env.PORT` (default 3000) exposing `/` and `/health`, used for cPanel/Passenger process health checks
- Handles graceful shutdown on `SIGTERM`/`SIGINT` and logs uncaught exceptions

### Command pattern

```typescript
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Description en français'),

  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('Response');
  },

  cooldown: 5,   // optional, seconds (default 3)
  defer: true    // optional, auto-defers with a placeholder response
};
```

For long-running operations (any external API call), defer immediately with `await interaction.deferReply()` then `await interaction.editReply(...)`.

### Database

A single Mongoose collection, `UserLevel`, holds both economy/XP data and birthdays per `{ userId, guildId }`:

```typescript
{
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  totalMessages: number;
  totalVoiceMinutes: number;
  coins: number;
  coinsAllTimeHigh: number;
  lastDailyTimestamp: number;
  birthMonth?: number;
  birthDay?: number;
  birthYear?: number;
}
```

`database/db.ts` exposes `userLevelsDb` with atomic helpers (`addXp`, `addCoins`, `spendCoins`, `claimDaily`, `setBirthday`, `getLeaderboard`, `getTodayBirthdays`, ...) built on `findOneAndUpdate` to avoid race conditions.

### Command deployment

`deploy-commands.ts` is a standalone script that registers all commands to a single guild (`DISCORD_GUILD_ID`) via the Discord REST API. Run it after adding or editing a command, then restart the bot.

## Testing

Tests live in `__tests__/` (one file per command/service, Vitest). Discord interactions and external APIs (Mistral, Riot, OpenAI, undici) are mocked — no real network calls are made.

```typescript
import { vi } from 'vitest';

const mockInteraction = {
  user: { username: 'TestUser' },
  options: { getString: vi.fn().mockReturnValue('test') },
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined)
};

vi.mock('undici');
(request as any).mockResolvedValue({ body: { json: () => ({ /* ... */ }) } });
```

See [docs/TESTING.md](../docs/TESTING.md) for the full guide.

## External integrations

| Service | Used for | Endpoint |
|---|---|---|
| Mistral AI | `/mistral`, `/conversation`, `/lol-lastgame` | `api.mistral.ai/v1/chat/completions`, model `mistral-small-latest` |
| OpenAI Whisper | `/listen` transcription | `api.openai.com/v1/audio/transcriptions`, model `whisper-1` |
| Riot Games | `/lol-*` commands | Platform `euw1`, match data via the `europe` regional endpoint |
| OpenLibrary | `/book` | `openlibrary.org/search.json` |

## Troubleshooting

**Bot doesn't respond to commands** — verify the bot has the `applications.commands` scope, the token is valid, and `npm run deploy` has been run for the target guild.

**MongoDB connection errors** — check `MONGODB_URI` and that MongoDB is reachable.

**Voice commands not working** — verify FFmpeg and yt-dlp are installed and the bot has `CONNECT`/`SPEAK` permissions in the voice channel.

## Further reading

- [Backend casino API](../backend/README.md)
- [Frontend Discord Activity](../frontend/README.md)
- [Testing guide](../docs/TESTING.md)
- [RPG system](../docs/RPG_SYSTEM.md)
