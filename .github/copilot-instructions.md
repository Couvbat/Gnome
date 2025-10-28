# Gnome Discord Bot - AI Agent Instructions

## Project Overview
A Discord.js v14 bot named "Le Gnome" that integrates with Mistral AI for conversational AI features in "La zone" Discord server. Includes voice channel listening capabilities with speech-to-text integration. Written in TypeScript.

## Architecture

### Language & Runtime
- **Language:** TypeScript (migrating from JavaScript)
- **Runtime:** Node.js v22.17.0
- **Package Manager:** npm
- **TypeScript Config:** `tsconfig.json` with strict mode enabled

### Bot Entry Point
- `index.ts` (formerly `index.js`): Main bot initialization with command loading, cooldown system, and interaction handling
- `deploy-commands.ts` (formerly `deploy-commands.js`): Standalone script to register slash commands with Discord API
- **Build output:** `dist/` directory (gitignored)

### Command Structure
Commands live directly in `commands/` folder (flat structure, not nested). Each command exports a typed object:
- `data`: SlashCommandBuilder instance defining command metadata
- `execute`: Async function with typed `CommandInteraction` parameter
- `cooldown` (optional): Number representing seconds (e.g., `5`)
- `defer` (optional): Boolean to trigger deferred replies with automatic "Done!" response

**All commands are now in TypeScript:**
- `commands/ping.ts` - Simple ping/pong test
- `commands/echo.ts` - Echoes user input
- `commands/user.ts` - Displays user information
- `commands/server.ts` - Displays server information
- `commands/mistral.ts` - Single-shot Mistral AI interaction
- `commands/conversation.ts` - Thread-based Mistral AI conversation
- `commands/listen.ts` - Voice channel transcription with OpenAI Whisper
- `commands/template.ts` - TypeScript template for new commands

**TypeScript Example:**
```typescript
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
  cooldown?: number;
  defer?: boolean;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command'),
  
  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('Example response');
  },
  
  cooldown: 5
};
```

### Configuration
Environment variables in `.env` (gitignored):
```env
DISCORD_TOKEN=discord-bot-token
DISCORD_CLIENT_ID=discord-client-id
DISCORD_GUILD_ID=discord-guild-id
MISTRAL_API_KEY=mistral-api-key
OPENAI_API_KEY=openai-api-key
```

Use `.env.example` as template.

## Key Patterns

### Command Template
Use `commands/template` as boilerplate for new commands. All commands must:
1. Import types and `SlashCommandBuilder` from `discord.js`
2. Define proper TypeScript interfaces
3. Export typed object with `data` and `execute` properties
4. Use async/await with typed `CommandInteraction` parameter

### Deferred Replies
For long-running operations (API calls), check `mistral.ts` pattern:
- Call `await interaction.deferReply()` immediately
- Process the operation
- Use `await interaction.editReply()` to send response
- If command has `defer: true` property, main handler adds automatic "Done!" message

### Cooldown System
- Managed centrally in `index.ts` via `client.cooldowns` Collection
- Default 3s cooldown, overrideable per-command via `cooldown` property
- Ephemeral cooldown messages show Discord timestamp format: `<t:${timestamp}:t>`

### Mistral AI Integration
Two conversation modes implemented:
1. **Single-shot** (`mistral.ts`): One prompt/response
2. **Thread conversation** (`conversation.ts`): 15-minute thread with message collector that fetches conversation history before each API call

Both use identical system prompt defining bot personality as "Le Gnome" - a friendly but sarcastic bot focused on gaming, web dev, and generative AI topics.

### Voice Channel Integration
Voice receiving capabilities using `@discordjs/voice`:
- `VoiceReceiver` API for capturing user audio in voice channels
- Must set `selfDeaf: false` when joining voice channels to receive audio
- Audio streams provide Opus packets that can be transcribed or processed
- `SpeakingMap` tracks when users start/stop speaking
- Integration with OpenAI Whisper API for speech-to-text transcription

**Important**: Voice connections maintain a `receiver` property with:
- `receiver.speaking`: Events for 'start' and 'end' of user speech
- `receiver.subscribe(userId)`: Creates audio stream for specific user
- `EndBehaviorType`: Controls when audio streams close (Manual, AfterSilence, AfterInactivity)

## Development Workflow

### Adding Commands
1. Create file in `commands/` following template structure (flat directory, not nested)
2. Write unit tests in `__tests__/<command-name>.test.ts` using Jest
3. Run `npm test` to verify tests pass
4. Run `npm run deploy` to register with Discord (compiles TypeScript and deploys)
5. Restart bot (`npm run dev` for development or `npm start` for production) to load command handler

### Testing
Project uses **Jest** for unit testing. See `TESTING.md` for comprehensive guide.

**Running tests:**
- `npm test` - Run all tests
- `npm run test:watch` - Watch mode with auto-reload
- `npm run test:coverage` - Generate coverage report

**Test structure:**
- Tests in `__tests__/` directory
- Mock Discord interactions and external APIs
- Focus on command behavior, not implementation
- All tests must pass before deployment

**Key patterns:**
```javascript
// Mock interaction
const mockInteraction = {
  user: { username: 'TestUser' },
  options: { getString: jest.fn().mockReturnValue('test') },
  deferReply: jest.fn().mockResolvedValue(undefined),
  editReply: jest.fn().mockResolvedValue(undefined)
};

// Mock external APIs
jest.mock('undici');
request.mockResolvedValue({ body: { json: () => ({...}) } });
```

### Dependencies
- `discord.js` v14.15.2: Discord API wrapper
- `@discordjs/voice`: Voice channel support (sending/receiving)
- `libsodium-wrappers`: Encryption library for voice (pure JS, no compilation)
- `undici` v6.18.1: HTTP client for API calls
- `dotenv`: Environment variable management

## Integration Points

### External APIs
- **Mistral AI**: Chat completions endpoint at `api.mistral.ai/v1/chat/completions`
  - Model: `mistral-small-latest`
  - Standard params: `temperature: 0.7`, `top_p: 1`, `max_tokens: 1800-4096`
- **OpenAI Whisper**: Speech-to-text transcription at `api.openai.com/v1/audio/transcriptions`
  - Model: `whisper-1`
  - Accepts audio in various formats (Opus, WebM, MP3, etc.)
- **n8n**: Mentioned in package.json description but no active integration in codebase

### Discord Features
- Slash commands only (no message commands)
- Thread creation for conversation mode (`autoArchiveDuration: 60` minutes)
- MessageCollector for thread interactions (15-minute timeout)
- Ephemeral replies for cooldown warnings
- Voice channel joining and audio receiving
- Real-time speaking state detection

## Project-Specific Conventions

- Commands described in French but code comments/logs in English
- Error handling logs to console, sends generic error messages to users
- Environment variables via `.env` file (use `process.env.VARIABLE_NAME`)
- Command cooldowns stored as numbers in TypeScript (e.g., `5` not `"5"`)
- Conversation history rebuilt from Discord thread messages on each Mistral call (not cached)
- Voice audio stored temporarily in `temp/` directory, deleted after transcription
- Use TypeScript strict mode for maximum type safety
- Prefer explicit types over `any`
- Use interfaces for complex objects
