# Testing guide

All three packages use **Vitest**. Tests mock Discord interactions, external APIs, and MongoDB — no real network calls or database connections are made.

## Overview

| Package | Test files | Framework |
|---|---|---|
| `bot/` | 30, in `bot/__tests__/` | Vitest |
| `backend/` | 23 (16 unit + 7 e2e), in `backend/__tests__/` | Vitest + `supertest` + `socket.io-client` |
| `frontend/` | 13, in `frontend/src/__tests__/` | Vitest + `@vue/test-utils` |

## Running tests

### Bot

```bash
cd bot/
npm test                    # run all tests
npm run test:watch
npm run test:coverage
npm test -- ping.test.ts    # single file
```

### Backend

```bash
cd backend/
npm test
npm run test:watch
npm test -- --testNamePattern="e2e"   # e2e suites only
npm test -- BlackjackEngine.test.ts
npm run test:coverage
```

### Frontend

```bash
cd frontend/
npm test
npm run test:watch
npm run test:coverage
```

## Test structure

### Bot (`bot/__tests__/`)

One test file per command or service, e.g. `mistral.test.ts`, `blackjack.test.ts`, `lol-stats.test.ts`, `musicService.test.ts`, `ytdlp-service.test.ts`. `setup.ts` holds shared test configuration.

### Backend (`backend/__tests__/`)

```text
__tests__/
├── setup.ts
├── __mocks__/mockFactories.ts
├── BlackjackEngine.test.ts        # game engines
├── RouletteEngine.test.ts
├── SlotsEngine.test.ts
├── DiceEngine.test.ts
├── CasinoGameEngine.test.ts
├── BlackjackTableManager.test.ts  # table managers
├── RouletteTableManager.test.ts
├── CharacterService.test.ts       # RPG services
├── AbilityService.test.ts
├── EnergyService.test.ts
├── EconomyService.test.ts
├── ReputationService.test.ts
├── QuestService.test.ts
├── BardAbilities.test.ts
├── character.test.ts              # model tests
├── casino-routes.test.ts
├── auth-routes.e2e.test.ts        # e2e (supertest)
├── casino-routes.e2e.test.ts
├── casino-rpg-workflow.e2e.test.ts
├── games-routes.e2e.test.ts
├── progression-routes.e2e.test.ts
├── quests-routes.e2e.test.ts
└── socketHandlers.e2e.test.ts     # e2e (live Socket.IO server + socket.io-client)
```

### Frontend (`frontend/src/__tests__/`)

```text
src/__tests__/
├── setup.ts                     # registers the PrimeVue plugin globally for @vue/test-utils' mount()
├── api.test.ts                  # service layer
├── cardUtils.test.ts
├── discordSdk.test.ts
├── websocket.test.ts
├── useEnergy.test.ts             # composables (mount a minimal host component; rely on onMounted/onUnmounted)
├── useDiscordSdk.test.ts
└── components/
    ├── App.test.ts                # top-level auth/routing flow
    ├── CharacterCreation.test.ts   # validation + creation flow
    ├── CasinoLobby.test.ts         # view routing, table join/create logic (shallowMount)
    ├── SlotMachine.test.ts         # spin animation + backend call
    ├── DiceGame.test.ts            # prediction selection + roll
    ├── BlackjackTable.test.ts      # WebSocket-driven multiplayer state
    └── RouletteWheel.test.ts       # WebSocket-driven multiplayer state
```

Component tests that talk to `wsService` mock the whole `services/websocket` module with a lightweight listener registry (`on`/`off`/`__trigger`) so tests can simulate server-pushed events without a real socket connection — see `BlackjackTable.test.ts` for the pattern.

Presentational atoms/molecules/organisms (`Button.vue`, `Card.vue`, `GamesGrid.vue`, the blackjack subcomponents, etc.) have no dedicated tests — see [Testing gaps](#testing-gaps).

## Writing tests

### Command test template (bot)

```typescript
import { describe, test, expect, vi } from 'vitest';
import { command } from '../commands/commandname';

describe('CommandName', () => {
  test('has correct structure', () => {
    expect(command.data.name).toBe('commandname');
    expect(typeof command.execute).toBe('function');
  });

  test('executes successfully', async () => {
    const mockInteraction = {
      options: { getString: vi.fn().mockReturnValue('test input') },
      reply: vi.fn().mockResolvedValue(undefined)
    };

    await command.execute(mockInteraction as any);

    expect(mockInteraction.reply).toHaveBeenCalled();
  });
});
```

### Mocking Discord interactions

```typescript
const mockInteraction = {
  user: { username: 'TestUser', id: 'test-user-id' },
  guildId: 'test-guild-id',
  options: {
    getString: vi.fn().mockReturnValue('test value'),
    getInteger: vi.fn().mockReturnValue(42),
    getUser: vi.fn().mockReturnValue({ id: 'target-user-id', username: 'TargetUser' })
  },
  reply: vi.fn().mockResolvedValue(undefined),
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined),
  isChatInputCommand: vi.fn().mockReturnValue(true)
};
```

### Mocking external APIs

```typescript
import { vi } from 'vitest';
import { request } from 'undici';
vi.mock('undici');

(request as any).mockResolvedValue({
  body: { json: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'AI response' } }] }) }
});
```

Apply the same pattern for the Riot Games API and OpenAI Whisper — mock the response shape each endpoint returns.

### Mocking MongoDB

```typescript
vi.mock('../database/db', () => ({
  userLevelsDb: {
    getUser: vi.fn().mockResolvedValue({ userId: 'test-user-id', level: 5, xp: 250, coins: 1000 })
  }
}));
```

### Backend e2e tests

E2E suites use `supertest` against the Express app and mock Mongoose models with `vi.mock()`, exercising full request/response cycles across multiple API calls (e.g. a full RPG onboarding-to-gameplay workflow in `casino-rpg-workflow.e2e.test.ts`).

## Best practices

- **Isolate tests** — reset mocks in `beforeEach(() => vi.clearAllMocks())`.
- **Test behavior, not implementation** — assert on `mockInteraction.reply` calls, not internal variables.
- **Mock every external dependency** — Discord.js, `undici`, `@discordjs/voice`, Mongoose models. Never make a real network call in a test.
- **Cover error paths** — API failures, missing arguments, invalid permissions.

## Adding tests for a new command or route

1. Create the test file (`bot/__tests__/<command>.test.ts` or `backend/__tests__/<name>.test.ts`), using a similar existing test as a template.
2. Cover: structure validation, successful execution, error handling, edge cases.
3. Run `npm test` and `npm run test:coverage` before committing.

## Testing gaps

Known coverage gaps:

- **Frontend presentational components** — the atoms/molecules/organisms (`Button.vue`, `Card.vue`, `Badge.vue`, `GamesGrid.vue`, the blackjack subcomponents `PlayerSeat`/`DealerSection`/`BettingControls`/`GameControls`, etc.) have no dedicated tests. These are largely prop-to-template rendering with little branching logic; they're exercised indirectly through the game-component tests (e.g. `BlackjackTable.test.ts` asserts on `PlayerSeat`/`DealerSection` props) rather than tested in isolation. Deliberately out of scope — low defect-catching value relative to the effort of testing ~20 more trivial files.
- **Dead backend schemas** — `Guild`, `GuildMember`, `Item`, `UserInventory`, `CasinoEvent`, `CasinoAnalytics`, `NPCState` in `backend/src/models/schemas.ts` have no route or service consuming them yet, so there's nothing to test until they're wired up.

### Not covered by design

- MongoDB is always mocked — no test exercises a real database, so index behavior, real query performance, and Mongo-specific edge cases aren't verified.
- Bot voice/audio streaming (`@discordjs/voice`) is mocked at the boundary; no test plays real audio.
- Concurrent/race-condition behavior of atomic operations (`spendCoins`, `claimDaily`, table-manager locking) is asserted at the single-call level, not under real concurrent load.

## Continuous integration

GitHub Actions runs each package's suite on pull requests that touch it, and again before every deploy — a red run blocks the deploy:

| Workflow | Package | Steps |
|---|---|---|
| `.github/workflows/bot-build.yml` | `bot/` | `npm test`, `npm run build` (Node 22); also runs on every push to `main`, which is the run the NAS waits for before deploying |
| `.github/workflows/backend-build.yml` | `backend/` | lint, `npm test` (unit + e2e), `npm run build` (Node 24) |
| `.github/workflows/frontend-build.yml` | `frontend/` | lint, `npm run type-check`, `npm test`, `npm run build` (Node 24) |

Every external service is mocked, so none of them needs a secret or a database. See the deployment sections of the package READMEs for what happens after the build.

## Further reading

- [Vitest documentation](https://vitest.dev/)
- [Discord.js testing guide](https://discordjs.guide/additional-info/testing.html)
- [Vitest mocking guide](https://vitest.dev/guide/mocking.html)
