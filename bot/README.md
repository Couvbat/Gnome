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
- Runs a small HTTP server on `process.env.PORT` (default 3000) exposing `/` and `/health`, usable as an uptime/health check by the host
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

## Deployment

The bot runs self-hosted in an **Ubuntu 24.04 (Noble) LXC container on TrueNAS**, managed by **pm2**, alongside a **self-hosted MongoDB** on the same network. Only the bot runs in this container; the casino [backend](../backend/README.md#deployment) and [frontend](../frontend/README.md#deployment) deploy to o2switch from GitHub Actions.

### Container provisioning

Create an Ubuntu Noble container from the TrueNAS Instances UI, then inside it:

```bash
# Node.js 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git ffmpeg

# yt-dlp (YouTube/SoundCloud streaming)
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp

# pm2 process manager
npm install -g pm2
```

### First deployment

```bash
git clone <repo-url> /opt/gnome
cd /opt/gnome/bot
npm ci
cp .env.example .env    # fill in tokens; point MONGODB_URI at the MongoDB host
npm run build
npm run deploy           # register slash commands with Discord

pm2 start dist/index.js --name gnome-bot --max-memory-restart 512M
pm2 save                 # persist the process list
pm2 startup              # generate the boot script, run the command it prints
```

Notes:

- **`MONGODB_URI`** points at the self-hosted MongoDB over the LAN, e.g. `mongodb://192.168.x.x:27017/gnome`. Keep MongoDB bound to the local network only, and enable authentication if it's reachable by other machines.
- **Timezone** — the birthday announcer cron fires at 9:00 AM *container-local* time. Set the container timezone (`timedatectl set-timezone Europe/Paris`) or export `TZ` in the pm2 environment so it doesn't fire on UTC.
- **Health check** — the bot serves `GET /health` on `PORT` (default 3000), usable from TrueNAS or an uptime monitor to watch the process.

### Automated deployment

GitHub can't reach the NAS, so the container polls GitHub instead: a systemd timer runs [`deploy/gnome-bot-deploy.sh`](deploy/gnome-bot-deploy.sh) every 5 minutes. No inbound port and no GitHub secret is needed — the repo is public.

1. It fetches `main`. If nothing the bot runs on changed since the last deployed commit (changes under `bot/` other than `__tests__/`, `deploy/` and this README), it only fast-forwards `/opt/gnome` and stops.
2. Otherwise it asks the GitHub API for the latest push run of the **Build Bot** workflow ([`.github/workflows/bot-build.yml`](../.github/workflows/bot-build.yml): `npm test` + `npm run build`) on `main`. It waits while the run is in progress and keeps the current version if the run failed.
3. Once the run is green, it fast-forwards to the commit that run tested, runs `npm ci` only if `package-lock.json` changed, runs `npm run deploy` (build + slash command registration) only if `commands/` or `deploy-commands.ts` changed and `npm run build` otherwise, then `pm2 restart gnome-bot`, and waits up to a minute for `GET /health` to report `"bot":"connected"`.

A commit that fails to deploy (build error, bot never connects) is recorded and not retried; the next pushed commit is tried normally, or rerun it with `--force`. There is no automatic rollback: the bot stays on whatever was last restarted.

The first run has no record of what is running, so it always does a full deploy (`npm ci`, build, slash commands, restart). That way a checkout that was pulled but never rebuilt can't pass for a deployed one.

#### Setup

Do this once the workflow and script are on `main`: before that the GitHub API has no Build Bot run to check, and the script exits with an error.

```bash
cd /opt/gnome && git pull                                # brings bot/deploy/ onto the box
bash /opt/gnome/bot/deploy/gnome-bot-deploy.sh --dry-run # shows what the first run would do, changes nothing

cp /opt/gnome/bot/deploy/gnome-bot-deploy.service /opt/gnome/bot/deploy/gnome-bot-deploy.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now gnome-bot-deploy.timer             # the first tick (within 5 min) does the full deploy
```

The service runs as `root`, the user that owns `/opt/gnome` and the pm2 process list in the steps above; change `User=` in the unit if yours differ. The script only needs `git`, `curl` and `node`, all already installed.

Optional overrides go in `/etc/default/gnome-bot-deploy` (read by the service; `chmod 600` it if it holds a token), for example:

```bash
HEALTH_URL=http://127.0.0.1:3000/health   # match PORT in bot/.env; empty disables the check
PM2_APP=gnome-bot
GITHUB_TOKEN=github_pat_...               # read-only, public repos; only if the 60 req/h anonymous API limit is hit
```

The other settings (`REPO_DIR`, `BRANCH`, `GITHUB_REPO`, `CI_WORKFLOW`, `STATE_DIR`) are listed at the top of the script.

#### Operating it

```bash
systemctl list-timers gnome-bot-deploy.timer     # next/last run
journalctl -u gnome-bot-deploy -n 50             # what each run decided
systemctl start gnome-bot-deploy.service         # run a check now instead of waiting
bash /opt/gnome/bot/deploy/gnome-bot-deploy.sh --force   # retry a commit that failed to deploy
systemctl disable --now gnome-bot-deploy.timer   # pause automatic deploys
```

State lives in `/var/lib/gnome-bot-deploy/`: `deployed` holds the running commit, `failed` the last commit that failed. Deleting `deployed` makes the next run a full deploy again. When the `.service` or `.timer` files change in the repo, copy them again and run `systemctl daemon-reload`; the script itself is picked up automatically.

### Updating by hand

With the timer paused, or to recover from a failed deploy:

```bash
cd /opt/gnome
git pull
cd bot
npm ci
npm run build
npm run deploy           # only needed when commands were added/changed
pm2 restart gnome-bot
```

If the timer is still enabled, its next run sees the new commit and repeats the build and restart — harmless, but pause it first to avoid the extra restart.

`pm2 logs gnome-bot` tails the bot's console output; `pm2 monit` shows memory/CPU (useful since the process is capped at 512 MB via `--max-memory-restart`).

## Troubleshooting

**Bot doesn't respond to commands** — verify the bot has the `applications.commands` scope, the token is valid, and `npm run deploy` has been run for the target guild.

**MongoDB connection errors** — check `MONGODB_URI` and that MongoDB is reachable.

**Voice commands not working** — verify FFmpeg and yt-dlp are installed and the bot has `CONNECT`/`SPEAK` permissions in the voice channel.

## Further reading

- [Backend casino API](../backend/README.md)
- [Frontend Discord Activity](../frontend/README.md)
- [Testing guide](../docs/TESTING.md)
- [RPG system](../docs/RPG_SYSTEM.md)
