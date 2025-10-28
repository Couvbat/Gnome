# Gnome Discord Bot - AI Agent Instructions

## Project Overview
A Discord.js v14 bot named "Le Gnome" that integrates with Mistral AI for conversational AI features in "La zone" Discord server. Now includes voice channel listening capabilities with speech-to-text integration.

## Architecture

### Bot Entry Point
- `index.js`: Main bot initialization with command loading, cooldown system, and interaction handling
- `deploy-commands.js`: Standalone script to register slash commands with Discord API

### Command Structure
Commands live in `commands/` organized by category folders (e.g., `utility/`). Each command exports:
- `data`: SlashCommandBuilder instance defining command metadata
- `execute`: Async function handling command logic
- `cooldown` (optional): String representing seconds (e.g., `"5"`)
- `defer` (optional): Boolean to trigger deferred replies with automatic "Done!" response

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
Use `commands/utility/template` as boilerplate for new commands. All commands must:
1. Import `SlashCommandBuilder` from `discord.js`
2. Export object with `data` and `execute` properties
3. Use async/await for `execute` function

### Deferred Replies
For long-running operations (API calls), check `mistral.js` pattern:
- Call `await interaction.deferReply()` immediately
- Process the operation
- Use `await interaction.editReply()` to send response
- If command has `defer: true` property, main handler adds automatic "Done!" message

### Cooldown System
- Managed centrally in `index.js` via `client.cooldowns` Collection
- Default 3s cooldown, overrideable per-command via `cooldown` property
- Ephemeral cooldown messages show Discord timestamp format: `<t:${timestamp}:t>`

### Mistral AI Integration
Two conversation modes implemented:
1. **Single-shot** (`mistral.js`): One prompt/response
2. **Thread conversation** (`conversation.js`): 15-minute thread with message collector that fetches conversation history before each API call

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
1. Create file in `commands/<category>/` following template structure
2. Run `node deploy-commands.js` to register with Discord
3. Restart bot (`node index.js`) to load command handler

### Testing
No test suite configured. Manual testing via Discord client interaction.

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
- Command cooldowns stored as string seconds, not numbers
- Conversation history rebuilt from Discord thread messages on each Mistral call (not cached)
- Voice audio stored temporarily in `temp/` directory, deleted after transcription
