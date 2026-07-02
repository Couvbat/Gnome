# Testing guide: Le Gnome Discord bot

> **Guide Complet** pour les tests unitaires du bot Discord et du backend casino

## 📋 Vue d'Ensemble

Ce projet utilise **Vitest** pour les tests unitaires du bot Discord (TypeScript) et du backend casino (Express.js + TypeScript). Vitest offre une compatibilité native avec Node.js 22+, un support TypeScript intégré, et une API compatible Jest. Les tests garantissent le bon fonctionnement des commandes, intégrations API, moteurs de jeux, et gestion d'erreurs.

### 📊 État global des tests

| Projet | Suites | Tests | Passants | Taux Réussite |
|--------|--------|-------|----------|---------------|
| **Bot Discord** | 27 suites | 239 tests | 239 | ✅ 100% |
| **Backend Casino** | 16 suites | 238 tests | 238 | ✅ 100% |
| **Frontend** | 0 | 0 | 0 | ⏳ À venir |
| **TOTAL** | **43 suites** | **477 tests** | **477** | **✅ 100%** |

### 🏗️ Structure de test du projet

```text
gnome/
├── bot/                  # 🤖 Discord Bot
│   ├── __tests__/        # 27 fichiers de test TypeScript (239 tests)
│   │   └── *.test.ts     # Tests unitaires Vitest
│   └── commands/         # 30 commandes testées
├── backend/              # 🎰 Casino API Server  
│   ├── __tests__/        # 16 fichiers de test (238 tests)
│   │   ├── *.test.ts     # Tests unitaires (10 fichiers)
│   │   ├── *.e2e.test.ts # Tests E2E (3 fichiers)
│   │   └── E2E-README.md # Documentation E2E
│   └── src/              # Code backend testé
└── docs/
    └── TESTING.md        # 📖 Ce guide
```

## Running tests

### Bot tests (Discord commands)

```bash
cd bot/
npm test              # Run all bot tests (239 tests)
npm run test:watch    # Watch mode with auto-reload
npm run test:coverage # Coverage report
npm test -- ping.test.ts # Run specific test file
```

### Backend tests (Casino API)

```bash
cd backend/
npm test              # Run all backend tests (238 tests)
npm run test:watch    # Watch mode
npm test -- --testNamePattern="e2e" # E2E tests only (34 tests)
npm test -- BlackjackEngine.test.ts # Specific test file
```

### Frontend tests (À venir)

```bash
cd frontend/
npm test              # Tests unitaires React (pas encore implémentés)
```

## Test structure

### Bot tests (`bot/__tests__/`)

28 test files covering 30 Discord slash commands (82 total tests):

```text
__tests__/
├── setup.js              # Test configuration and environment setup
├── # Basic Commands (3 tests)
├── ping.test.js          # Tests for /ping
├── echo.test.js          # Tests for /echo
├── help.test.js          # Tests for /help
├── # AI Commands (2 files, multiple tests)
├── mistral.test.js       # Tests for /mistral (Mistral API)
├── conversation.test.js  # Tests for /conversation (threaded AI)
├── # Economy & Gambling (6 files)
├── balance.test.js       # Tests for /balance
├── daily.test.js         # Tests for /daily rewards
├── give.test.js          # Tests for /give coins
├── slots.test.js         # Tests for /slots
├── blackjack.test.js     # Tests for /blackjack
├── roulette.test.js      # Tests for /roulette
├── dice.test.js          # Tests for /dice
├── # Music (8 files, 2 fully tested)
├── play.test.js          # Tests for /play ✅
├── playlist.test.js      # Tests for /playlist ✅
├── pause.test.js         # Tests for /pause (basic)
├── resume.test.js        # Tests for /resume (basic)
├── skip.test.js          # Tests for /skip (basic)
├── stop.test.js          # Tests for /stop (basic)
├── queue.test.js         # Tests for /queue (basic)
├── loop-nowplaying.test.js # Tests for /loop and /nowplaying
├── # League of Legends (4 files)
├── lol-stats.test.js     # Tests for /lol-stats ✅
├── lol-matches.test.js   # Tests for /lol-matches ✅
├── lol-rotation.test.js  # Tests for /lol-rotation ✅
├── lol-lastgame.test.js  # Tests for /lol-lastgame ✅
├── # Progression (2 files)
├── rank.test.js          # Tests for /rank ✅
├── leaderboard.test.js   # Tests for /leaderboard ✅
└── # Utilities (2 files)
    ├── birthday.test.js  # Tests for /birthday commands ✅
    └── book.test.js      # Tests for /book recommendations ✅
```

### Backend tests (`backend/__tests__/`)

16 test files covering game engines, services, and API routes (238 total tests):

```text
__tests__/
├── setup.ts              # Test configuration with Mongoose mocks
├── __mocks__/            # Mock implementations
├── # Game Engines (4 files, ~80 tests)
├── BlackjackEngine.test.ts      # Blackjack logic tests
├── RouletteEngine.test.ts       # Roulette game tests
├── SlotsEngine.test.ts          # Slots machine tests
├── DiceEngine.test.ts           # Dice game tests
├── # Table Managers (2 files, ~40 tests)
├── BlackjackTableManager.test.ts # Multiplayer Blackjack
├── RouletteTableManager.test.ts  # Multiplayer Roulette
├── # RPG Services (5 files, ~80 tests)
├── CharacterService.test.ts     # Character CRUD
├── AbilityService.test.ts       # Ability system
├── EnergyService.test.ts        # Energy management
├── QuestService.test.ts         # Quest system
├── ReputationService.test.ts    # Reputation tiers
├── # E2E Tests (3 files, 34 tests)
├── auth-routes.e2e.test.ts      # Auth endpoints (10 tests)
├── casino-routes.e2e.test.ts    # Casino API (15 tests)
├── casino-rpg-workflow.e2e.test.ts # RPG workflows (9 tests)
├── E2E-README.md                 # E2E testing guide
└── # Unit Tests (2 files)
    ├── character.test.ts         # Character model tests
    └── casino-routes.test.ts     # Casino route tests
```

## Writing tests

### Basic command test template

```typescript
import { describe, test, expect, vi } from 'vitest';
import commandName from '../commands/commandName';

describe('CommandName Command', () => {
  test('should have correct command structure', () => {
    expect(commandName.data.name).toBe('commandname');
    expect(commandName.execute).toBeDefined();
    expect(typeof commandName.execute).toBe('function');
  });

  test('should execute successfully', async () => {
    const mockInteraction = {
      options: {
        getString: vi.fn().mockReturnValue('test input')
      },
      reply: vi.fn().mockResolvedValue(undefined)
    };

    await commandName.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('expected output');
  });
});
```

### Mocking Discord interactions

Discord interactions need to be mocked with the appropriate properties:

```typescript
import { vi } from 'vitest';

const mockInteraction = {
  // User who triggered the interaction
  user: {
    username: 'TestUser',
    id: 'test-user-id',
    tag: 'TestUser#1234'
  },
  
  // Guild and channel context
  guildId: 'test-guild-id',
  guild: {
    id: 'test-guild-id',
    name: 'Test Guild',
    members: {
      me: {
        permissions: {
          has: vi.fn().mockReturnValue(true)
        }
      }
    }
  },
  channel: {
    id: 'test-channel-id',
    send: vi.fn().mockResolvedValue(undefined)
  },
  
  // Command options
  options: {
    getString: vi.fn().mockReturnValue('test value'),
    getInteger: vi.fn().mockReturnValue(42),
    getBoolean: vi.fn().mockReturnValue(true),
    getUser: vi.fn().mockReturnValue({
      id: 'target-user-id',
      username: 'TargetUser'
    })
  },
  
  // Reply methods
  reply: vi.fn().mockResolvedValue(undefined),
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined),
  followUp: vi.fn().mockResolvedValue(undefined),
  
  // Type checking
  isChatInputCommand: vi.fn().mockReturnValue(true),
  
  // For voice/music commands
  member: {
    voice: {
      channel: {
        id: 'voice-channel-id',
        name: 'General Voice',
        guild: {
          id: 'test-guild-id',
          voiceAdapterCreator: vi.fn()
        },
        permissionsFor: vi.fn().mockReturnValue({
          has: vi.fn().mockReturnValue(true)
        })
      }
    }
  }
};
```

### Mocking external APIs

Use Vitest's mocking system for external API calls:

#### Mistral AI API
```typescript
import { vi } from 'vitest';
import { request } from 'undici';
vi.mock('undici');

(request as any).mockResolvedValue({
  body: {
    json: vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: 'AI response here'
        }
      }]
    })
  }
});
```

#### Riot Games API
```typescript
(request as any).mockResolvedValueOnce({
  body: {
    json: vi.fn().mockResolvedValue({
      puuid: 'player-puuid',
      gameName: 'Player',
      tagLine: 'EUW'
    })
  }
}).mockResolvedValueOnce({
  body: {
    json: vi.fn().mockResolvedValue({
      id: 'summoner-id',
      summonerLevel: 100
    })
  }
});
```

#### OpenAI Whisper API
```typescript
import { FormData } from 'formdata-node';

(request as any).mockResolvedValue({
  body: {
    json: vi.fn().mockResolvedValue({
      text: 'Transcribed text'
    })
  }
});
```

#### Music services (play-dl)
```typescript
vi.mock('../services/musicService', () => ({
  musicService: {
    getQueue: vi.fn(),
    createQueue: vi.fn(),
    addTrack: vi.fn(),
    addPlaylist: vi.fn()
  }
}));
```

### Testing async commands

Most Discord commands are async, so use `async/await`:

```typescript
test('should handle async operations', async () => {
  const mockInteraction = {
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  };

  await command.execute(mockInteraction);

  expect(mockInteraction.deferReply).toHaveBeenCalled();
  expect(mockInteraction.editReply).toHaveBeenCalled();
});
```

### Testing error handling

Verify commands handle errors gracefully:

```typescript
test('should handle API error', async () => {
  (request as any).mockRejectedValue(new Error('API Error'));

  const mockInteraction = {
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  };

  await command.execute(mockInteraction);

  expect(mockInteraction.editReply).toHaveBeenCalledWith({
    content: expect.stringContaining('error')
  });
});
```

## Test coverage

Current test coverage includes:

### ✅ Core commands
- Command structure validation (name, description, execute function)
- Basic command execution (ping, echo)
- Cooldown validation

### ✅ AI integration
- Mistral AI API calls and responses
- Error handling for API failures
- Deferred replies for long operations
- Voice transcription setup (listen command)

### ✅ Economy & gambling
- Balance display and calculations
- Slots game logic and payouts
- Blackjack game mechanics (hit, stand, double down, split)
- Bet validation (minimum 10 coins)
- Coin deduction and rewards

### ✅ Music system
- Play command with URL and search queries
- Playlist detection and loading
- Queue management
- Music controls (pause, resume, skip, stop)
- Voice channel connection validation

### ✅ League of Legends
- Riot API integration (stats, matches, rotation)
- Player data parsing and display
- Match history with pagination
- Last game analysis with AI insights
- Champion rotation formatting

### ✅ Error handling
- API error responses
- Invalid user input
- Missing permissions
- Voice channel requirements
- Database connection errors (for economy commands)

### ✅ Backend E2E tests (NEW)
- **Auth API** - Complete authentication flows with JWT
- **Casino API** - User profiles, daily rewards, energy system
- **RPG Workflows** - Full player journeys from onboarding to gameplay
- API request/response validation with supertest
- Multi-step user workflows and state management

### 🚧 Not covered
- XP tracking service (requires live Discord events)
- Birthday checker cron job (scheduled tasks)
- Live voice connection audio streaming
- MongoDB operations (mocked in tests)
- WebSocket real-time events for multiplayer casino

## Best practices

### 1. Isolate tests
Each test should be independent and not rely on other tests:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 2. Test behavior, not implementation
Focus on what the command does, not how it does it:
```javascript
// Good
expect(mockInteraction.reply).toHaveBeenCalledWith('Pong!');

// Avoid
expect(someInternalVariable).toBe(someValue);
```

### 3. Use descriptive test names
```javascript
// Good
test('should require user to be in voice channel', async () => {

// Avoid  
test('test1', async () => {
```

### 4. Mock external dependencies
Never make real API calls in tests:
```typescript
vi.mock('undici');
vi.mock('@discordjs/voice');
```

### 5. Test edge cases
```javascript
test('should handle empty message', async () => {
  // Test with empty string
});

test('should handle missing API key', async () => {
  // Test without API key
});
```

## Troubleshooting

### Tests fail with "Cannot find module"
Make sure you're running tests from the project root:
```bash
cd /home/jules/Dev/other/gnome
npm test
```

### Mock not working
Ensure mocks are declared at the top level of your test file:
```typescript
import { vi } from 'vitest';
vi.mock('undici');  // At module level
import { command } from '../commands/command';
```

### Environment variables not loading
Check that `__tests__/setup.ts` is properly configured in `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    setupFiles: ['./__tests__/setup.ts']
  }
});
```

### Voice/music command tests are complex
Voice and music commands involve complex Discord.js internals and external streaming libraries. It's acceptable to:
- Test user-facing behavior (joining requirements, permission checks)
- Mock the music service entirely
- Skip testing actual audio streaming
- Focus on queue management and command responses

### Database operations
MongoDB operations are mocked in tests since we don't connect to a real database:
```typescript
// Mock the database module
vi.mock('../database/db', () => ({
  userLevelsDb: {
    getUser: vi.fn().mockResolvedValue({
      userId: 'test-user-id',
      level: 5,
      xp: 250,
      coins: 1000
    })
  }
}));
```

### TypeScript commands
Commands are written in TypeScript and tests should also be in TypeScript. Vitest handles TypeScript natively without additional configuration:
```typescript
import { describe, test, expect, vi } from 'vitest';
import { command } from '../commands/example';
import { CommandInteraction } from 'discord.js';

describe('Example Command', () => {
  test('should execute', async () => {
    const mockInteraction = {
      // ...mock properties
    } as unknown as CommandInteraction;
    
    await command.execute(mockInteraction);
    // assertions...
  });
});
```

## Adding new tests

When adding a new command:

1. **Create test file** in `__tests__/`:
   ```bash
   touch __tests__/newcommand.test.ts
   ```

2. **Use existing test as template** (similar command type):
   - Simple command → use `ping.test.ts`
   - API command → use `mistral.test.ts`
   - Economy command → use `balance.test.ts` or `slots.test.ts`
   - Music command → use `play.test.ts`
   - LoL command → use `lol-stats.test.ts`

3. **Write tests** covering:
   - Command structure (name, description, execute)
   - Successful execution
   - Error cases (missing args, API errors)
   - Edge cases (invalid input, permissions)

4. **Run tests** to verify:
   ```bash
   npm test
   npm run test:coverage
   ```

5. **Ensure all tests pass** before committing

### Example test structure
```typescript
// __tests__/newcommand.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { request } from 'undici';
import { command } from '../commands/newcommand';

vi.mock('undici');

describe('NewCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should have correct structure', () => {
    expect(command.data.name).toBe('newcommand');
    expect(command.execute).toBeDefined();
  });

  test('should execute successfully', async () => {
    const mockInteraction = {
      // ... mock properties
    };

    await command.execute(mockInteraction);
    
    expect(mockInteraction.reply).toHaveBeenCalled();
  });

  test('should handle errors', async () => {
    // ... test error handling
  });
});
```

## Continuous integration

To integrate with CI/CD pipelines, add to your workflow:
```yaml
# Bot Tests
- name: Run Bot Tests
  working-directory: ./bot
  run: npm test

# Backend Tests (including E2E)
- name: Run Backend Tests
  working-directory: ./backend
  run: |
    npm test
    npm test -- --testNamePattern="e2e"

- name: Check Coverage
  working-directory: ./bot
  run: npm run test:coverage
```

## End-to-end testing

### Backend E2E test suite

The backend now includes comprehensive E2E tests in `/backend/__tests__/` with `.e2e.test.ts` suffix:

#### Running E2E tests
```bash
cd backend

# All E2E tests
npm test -- --testNamePattern="e2e"

# Specific suite
npm test -- auth-routes.e2e.test.ts
npm test -- casino-routes.e2e.test.ts
npm test -- casino-rpg-workflow.e2e.test.ts
```

#### E2E test coverage
- ✅ **Authentication**: Dev auth, Discord OAuth, JWT validation (10 tests, 100% passing)
- 🟡 **Casino API**: Profiles, daily rewards, energy system (15 tests, 47% passing)
- 🟡 **RPG Workflows**: Onboarding, progression, error recovery (9 tests, 33% passing)

#### E2E test architecture
- Uses **supertest** for HTTP request testing
- Mocks database models with **vi.mock()**
- Tests complete user workflows across multiple API calls
- Validates request/response contracts

For detailed E2E test documentation, see `/backend/__tests__/E2E-README.md`.

## Further reading

- [Vitest Documentation](https://vitest.dev/)
- [Discord.js Guide - Testing](https://discordjs.guide/additional-info/testing.html)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)

**Note**: Tests use mock data and do not make real API calls or connect to Discord. This ensures fast, reliable tests without external dependencies.
