# 🤖 Le Gnome Discord Bot

> The core Discord bot for "La Taverne Dorée du Gnome" - Featuring AI conversations, music streaming, League of Legends integration, RPG economy system, and casino games.

## 📋 What this bot does

This bot uses **Discord.js v14** and **TypeScript** in strict mode, providing 30 slash commands across 6 major categories. It integrates with multiple external APIs (Mistral AI, OpenAI Whisper, Riot Games, OpenLibrary) and uses MongoDB for persistent data storage.

**Key stats:**
- **30 slash commands** with full TypeScript typing
- **239 unit tests** with 100% pass rate
- **6 service modules** for background operations
- **MongoDB integration** for XP, economy, and user data
- **Voice support** for music streaming and AI voice conversations

## 🚀 Getting started

### Prerequisites
- **Node.js** v22.17.0 or higher
- **MongoDB** (local or Atlas connection)
- **FFmpeg** (for audio processing)
- **YT-DLP** (for YouTube/SoundCloud streaming)
- **Discord Bot Token** with necessary permissions

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your tokens (see Configuration section)

# Build TypeScript
npm run build

# Deploy slash commands to Discord
npm run deploy

# Start the bot
npm run dev     # Development mode (ts-node with hot reload)
npm start       # Production mode (compiled JavaScript)
```

### Testing

```bash
npm test              # Run all 239 tests
npm run test:watch    # Watch mode with auto-reload
npm run test:coverage # Generate coverage report
```

## ⚙️ Configuration

Create a `.env` file in the `/bot/` directory with the following variables:

```env
# Discord Configuration (Required)
DISCORD_TOKEN=discord_bot_token
DISCORD_CLIENT_ID=discord_client_id
DISCORD_GUILD_ID=guild_id_for_testing

# AI Services (Required for AI commands)
MISTRAL_API_KEY=mistral_api_key        # For /mistral and /conversation
OPENAI_API_KEY=openai_api_key          # For /listen (Whisper STT)

# Gaming APIs (Required for LoL commands)
RIOT_GAMES_API_KEY=riot_api_key        # For /lol-* commands

# Database (Required)
MONGODB_URI=mongodb://localhost:27017/gnome

# Optional: Backend Casino Integration
CASINO_API_URL=http://localhost:3001        # If using backend casino server
```

Use `.env.example` as a template with all available options.

## 📚 Commands reference

### 🤖 Artificial Intelligence (3 commands)

| Command | Description | Cooldown | Deferred |
|---------|-------------|----------|----------|
| `/mistral <prompt>` | Single-shot question to Mistral AI | 5s | ✅ |
| `/conversation <prompt>` | Start 15-minute thread conversation with AI | 5s | ✅ |
| `/listen start\|stop` | Voice-to-voice AI conversation (Whisper STT + TTS) | 10s | ❌ |

**Features:**
- **Custom personality**: "Le Gnome" - sarcastic gaming assistant
- **Thread history**: Conversation context maintained from Discord thread messages
- **Voice support**: Real-time transcription and TTS responses in voice channels

### 🎵 Music player (8 commands)

| Command | Description | Support |
|---------|-------------|---------|
| `/play <query\|url>` | Play music from search or URL | YouTube, SoundCloud |
| `/playlist <url>` | Load entire playlist | YouTube, SoundCloud |
| `/pause` | Pause current playback | - |
| `/resume` | Resume paused music | - |
| `/skip` | Skip to next song | - |
| `/stop` | Stop music and disconnect | - |
| `/queue [page]` | Show paginated queue (10 songs/page) | - |
| `/nowplaying` | Display current song with thumbnail | - |
| `/loop` | Toggle loop mode for current song | - |

**Implementation:**
- **Service**: `services/musicService.ts` manages queue and playback
- **Audio library**: `play-dl` for YouTube/SoundCloud streaming
- **Voice**: `@discordjs/voice` for Discord voice channel integration
- **YT-DLP**: External dependency for YouTube extraction

### 🎮 League of Legends (4 commands)

| Command | Description | API |
|---------|-------------|-----|
| `/lol-stats <player> <tag>` | Player profile + ranked stats | Riot API (EUW) |
| `/lol-matches <player> <tag> [count]` | Match history (paginated) | Match-v5 |
| `/lol-lastgame <player> <tag>` | Last game with AI analysis | Match-v5 + Mistral |
| `/lol-rotation` | Weekly free champion rotation | Champion-v3 |

**Features:**
- **Regional support**: EUW platform with Europe routing
- **Data Dragon**: Static champion data and images
- **AI analysis**: Mistral-powered performance insights for last game
- **Rich embeds**: Color-coded by rank tier with champion icons

### ⭐ Progression & economy (5 commands)

| Command | Description | Rewards |
|---------|-------------|---------|
| `/rank [user]` | Display level and XP progress | 5-15 XP per message |
| `/balance [user]` | Show coins, XP, and level | Level × 50 coins on level-up |
| `/leaderboard` | Server top 10 by level/XP | - |
| `/daily` | Daily coin reward | 50 + (level × 10) coins |
| `/give <user> <amount>` | Transfer coins to another user | - |

**XP system:**
- **Service**: `services/xpTracking.ts` handles message tracking
- **Rate**: 5-15 XP per message with 60-second cooldown
- **Level formula**: `level = floor(XP / 100)`
- **Level-up bonus**: User receives `level × 50` coins on level-up
- **Database**: MongoDB `users` collection via `database/db.ts`

### 🎰 Casino games (4 commands - Legacy)

| Command | Description | Min Bet | RTP |
|---------|-------------|---------|-----|
| `/slots <bet>` | Slot machine with emoji symbols | 10 coins | ~85% |
| `/blackjack <bet>` | Classic blackjack vs dealer | 10 coins | ~99% |
| `/roulette <bet> <type>` | European roulette | 10 coins | ~97% |
| `/dice <bet>` | Two-dice rolling game | 10 coins | ~90% |

**Note:** These are individual Discord commands. The multiplayer casino with RPG classes is implemented in the `/backend/` and `/frontend/` packages (see [Backend README](../backend/README.md)).

### 🎂 Utilities & social (5 commands)

| Command | Description |
|---------|-------------|
| `/birthday set <day> <month>` | Register birthday (auto-announces) |
| `/birthday check [user]` | View user's birthday |
| `/birthday remove` | Delete your birthday |
| `/birthday list` | Show all upcoming birthdays |
| `/book <theme> [count]` | Get book recommendations from OpenLibrary |
| `/ping` | Check bot latency |
| `/echo <message>` | Repeat a message |
| `/help` | Display all available commands |

**Birthday service:**
- **Cron job**: `services/birthdayChecker.ts` checks daily at midnight
- **Auto-announce**: Posts birthday messages in configured channel
- **Database**: MongoDB `birthdays` collection

## 🏗️ Architecture

### Project structure

```text
bot/
├── commands/              # 30 slash command files
│   ├── mistral.ts         # AI single-shot interaction
│   ├── conversation.ts    # Thread-based AI chat
│   ├── listen.ts          # Voice-to-voice AI
│   ├── play.ts            # Music player entry
│   ├── lol-stats.ts       # League of Legends stats
│   ├── balance.ts         # Economy system
│   └── ...                # 24 more commands
├── services/              # Background services
│   ├── musicService.ts    # Queue + playback manager
│   ├── xpTracking.ts      # Message XP tracking
│   ├── birthdayChecker.ts # Daily birthday cron
│   └── ytdlpService.ts    # YT-DLP wrapper
├── database/              # MongoDB ODM
│   └── db.ts              # Mongoose schemas (User, Birthday)
├── types/                 # TypeScript interfaces
│   └── index.ts           # Command, MusicQueue types
├── __tests__/             # 27 test files (239 tests)
├── __mocks__/             # Test mocks for APIs
├── index.ts               # Bot entry point
├── deploy-commands.ts     # Slash command registration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
└── vitest.config.ts       # Test configuration
```

### Entry points

**Main bot** (`index.ts`):
- Loads all commands from `/commands/` directory
- Registers event handlers for `interactionCreate` and `messageCreate`
- Manages cooldown system with `client.cooldowns` Collection
- Tracks XP for messages via `xpTracking.ts`
- Handles errors with centralized logging

**Command deployment** (`deploy-commands.ts`):
- A standalone script that registers and updates slash commands with the Discord API
- Run after adding/modifying commands: `npm run deploy`
- Uses REST API to push command definitions to Discord

### Command pattern

All commands follow this TypeScript structure:

```typescript
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
  cooldown?: number;  // Optional cooldown in seconds (default: 3)
  defer?: boolean;    // Auto-defer for long operations
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Command description in French'),
  
  async execute(interaction: CommandInteraction): Promise<void> {
    // Command logic with full type safety
    await interaction.reply('Response');
  },
  
  cooldown: 5,
  defer: true  // Triggers automatic deferReply() + "Done!" message
};
```

### Database schemas

**User schema** (`database/db.ts`):
```typescript
{
  userId: string;      // Discord user ID
  username: string;    // Discord username
  xp: number;          // Total experience points
  level: number;       // Calculated level
  coins: number;       // Virtual currency
  lastDaily: Date;     // Last /daily claim timestamp
}
```

**Birthday schema**:
```typescript
{
  userId: string;      // Discord user ID
  day: number;         // Day of month (1-31)
  month: number;       // Month (1-12)
  year?: number;       // Optional year
}
```

## 🧪 Testing

### Test framework

The bot uses **Vitest** for unit testing with the following setup:

- **239 tests** across 27 test files
- **100% pass rate** in latest run
- **Mocked dependencies**: Discord.js interactions, external APIs
- **Coverage**: 83% of critical commands tested

### Running tests

```bash
# Run all tests
npm test

# Watch mode (auto-reload on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- mistral.test.ts
```

### Test structure

Tests are located in `__tests__/` with naming pattern `<command>.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { command as mistralCommand } from '../commands/mistral';

describe('Mistral Command', () => {
  it('should reply with AI response', async () => {
    const mockInteraction = createMockInteraction({
      options: { getString: vi.fn().mockReturnValue('test prompt') }
    });
    
    await mistralCommand.execute(mockInteraction);
    
    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('response')
    );
  });
});
```

### Mocking external APIs

Mocks are defined in `__mocks__/` and `__tests__/setup.ts`:

```typescript
// Mock Mistral API
vi.mock('undici', () => ({
  request: vi.fn().mockResolvedValue({
    body: {
      json: () => ({
        choices: [{ message: { content: 'Mocked AI response' } }]
      })
    }
  })
}));

// Mock Discord voice
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: vi.fn(),
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn()
}));
```

### Coverage by category

| Category | Commands | Tested | Coverage |
|----------|----------|--------|----------|
| AI | 3 | 3 | ✅ 100% |
| Music | 8 | 3 | 🟡 37% |
| League of Legends | 4 | 4 | ✅ 100% |
| Economy | 5 | 5 | ✅ 100% |
| Casino | 4 | 4 | ✅ 100% |
| Utilities | 6 | 3 | 🟡 50% |
| **Total** | **30** | **22** | **73%** |

## 🔌 External integrations

### Mistral AI
- **Endpoint**: `https://api.mistral.ai/v1/chat/completions`
- **Model**: `mistral-small-latest`
- **Usage**: `/mistral`, `/conversation`, `/lol-lastgame`
- **System prompt**: "Le Gnome" personality defined in command files

### OpenAI Whisper
- **Endpoint**: `https://api.openai.com/v1/audio/transcriptions`
- **Model**: `whisper-1`
- **Usage**: `/listen` for voice-to-text transcription
- **Formats**: Opus, WebM, MP3, WAV

### Riot Games API
- **Platform**: EUW1 (Europe West)
- **Routing**: Europe region for match data
- **Endpoints**:
  - Account-v1: Riot ID → PUUID
  - Summoner-v4: Summoner data
  - League-v4: Ranked stats
  - Match-v5: Match history
  - Champion-v3: Free rotation
- **Data Dragon**: Static champion images and data

### OpenLibrary API
- **Endpoint**: `https://openlibrary.org/search.json`
- **Usage**: `/book` command for recommendations
- **Data**: Book metadata, authors, covers

### MongoDB
- **Driver**: Mongoose ODM v8.19.2
- **Collections**: `users`, `birthdays`
- **Connection**: Via `MONGODB_URI` environment variable

## 🛠️ Development guide

### Adding a new command

1. **Create command file** in `commands/`:

```typescript
// commands/mycommand.ts
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export const command = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('My command description')
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Input description')
        .setRequired(true)
    ),
  
  async execute(interaction: CommandInteraction) {
    const input = interaction.options.getString('input');
    await interaction.reply(`You said: ${input}`);
  },
  
  cooldown: 5
};
```

2. **Create test file** in `__tests__/`:

```typescript
// __tests__/mycommand.test.ts
import { describe, it, expect, vi } from 'vitest';
import { command } from '../commands/mycommand';

describe('MyCommand', () => {
  it('should echo user input', async () => {
    const mockInteraction = {
      options: { getString: vi.fn().mockReturnValue('test') },
      reply: vi.fn()
    };
    
    await command.execute(mockInteraction);
    
    expect(mockInteraction.reply).toHaveBeenCalledWith('You said: test');
  });
});
```

3. **Test and deploy**:

```bash
npm test                    # Verify tests pass
npm run build              # Compile TypeScript
npm run deploy             # Register with Discord
npm run dev                # Restart bot
```

### Cooldown system

Cooldowns are managed automatically by `index.ts`:

- Default: 3 seconds
- Custom: Set `cooldown` property in command export
- Storage: `client.cooldowns` Collection (in-memory)
- Display: Discord timestamp format in ephemeral messages

### Deferred replies

For long-running operations (API calls), use the `defer` pattern:

```typescript
export const command = {
  // ... command definition
  
  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();  // Shows "Bot is thinking..."
    
    // Long operation (API call, processing, etc.)
    const result = await fetchExternalAPI();
    
    await interaction.editReply(result);
  },
  
  defer: true  // Optional: auto-adds "Done!" message
};
```

### Voice channel integration

For voice features (music, `/listen`):

```typescript
import { joinVoiceChannel, createAudioPlayer } from '@discordjs/voice';

// Join voice channel
const connection = joinVoiceChannel({
  channelId: channel.id,
  guildId: guild.id,
  adapterCreator: guild.voiceAdapterCreator,
  selfDeaf: false  // Required for receiving audio
});

// Receive audio (for /listen)
const receiver = connection.receiver;
receiver.speaking.on('start', (userId) => {
  const audioStream = receiver.subscribe(userId);
  // Process audio stream
});
```

## 🐛 Troubleshooting

### Common issues

**Bot doesn't respond to commands:**
- Verify bot has `applications.commands` scope
- Check Discord token is valid in `.env`
- Run `npm run deploy` to register commands
- Restart bot with `npm run dev`

**MongoDB connection errors:**
- Verify MongoDB is running: `mongod --version`
- Check `MONGODB_URI` format in `.env`
- Ensure MongoDB service is started

**Voice commands not working:**
- Install FFmpeg: `sudo apt install ffmpeg`
- Install YT-DLP: `pip install yt-dlp`
- Verify bot has `CONNECT` and `SPEAK` permissions
- Check voice channel is not full

**API integration failures:**
- Verify API keys in `.env`
- Check API rate limits (especially Riot Games)
- Review logs for specific error messages

### Logging

The bot logs to console with different levels:

```typescript
console.log('[INFO]', 'Normal operation');
console.error('[ERROR]', 'Critical error');
console.warn('[WARN]', 'Warning message');
```

For production, consider using a logging library like `winston`.

## 📦 Dependencies

### Core dependencies

```json
{
  "discord.js": "^14.15.2",           // Discord API wrapper
  "@discordjs/voice": "^0.19.0",      // Voice channel support
  "mongoose": "^8.19.2",              // MongoDB ODM
  "play-dl": "^1.9.7",                // YouTube/SoundCloud streaming
  "libsodium-wrappers": "^0.7.15",    // Voice encryption (pure JS)
  "node-cron": "^4.2.1",              // Scheduled tasks
  "undici": "^6.18.1",                // HTTP client
  "dotenv": "^16.4.7"                 // Environment variables
}
```

### Development dependencies

```json
{
  "typescript": "^5.9.3",             // TypeScript compiler
  "vitest": "^3.2.4",                 // Test framework
  "ts-node": "^10.9.2",               // TypeScript execution
  "@types/node": "^22.12.7"           // Node.js type definitions
}
```

## 📄 License

ISC License - See root repository LICENSE file

## 🔗 Further reading

- **[Backend Casino API](../backend/README.md)** - Express.js server for multiplayer casino
- **[Frontend Discord Activity](../frontend/README.md)** - React UI for casino interface
- **[Testing Guide](../docs/TESTING.md)** - Comprehensive testing documentation
- **[RPG System](../docs/RPG_SYSTEM.md)** - Character classes and casino bonuses
- **[Main README](../README.md)** - Complete project overview

**Developed with ❤️ for "La Taverne Dorée du Gnome"**
