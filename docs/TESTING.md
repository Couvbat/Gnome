# Testing guide

All three packages use **Vitest**. Tests mock Discord interactions, external APIs, and MongoDB — no real network calls or database connections are made.

## Overview

| Package | Test files | Framework |
|---|---|---|
| `bot/` | 28, in `bot/__tests__/` | Vitest |
| `backend/` | 21 (15 unit + 6 e2e), in `backend/__tests__/` | Vitest + `supertest` |
| `frontend/` | 4, in `frontend/src/__tests__/` | Vitest + `@vue/test-utils` |

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
└── quests-routes.e2e.test.ts
```

### Frontend (`frontend/src/__tests__/`)

`api.test.ts`, `cardUtils.test.ts`, `discordSdk.test.ts`, `websocket.test.ts`.

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

## Continuous integration

```yaml
- name: Bot tests
  working-directory: ./bot
  run: npm test

- name: Backend tests
  working-directory: ./backend
  run: |
    npm test
    npm test -- --testNamePattern="e2e"

- name: Frontend tests
  working-directory: ./frontend
  run: npm test
```

## Further reading

- [Vitest documentation](https://vitest.dev/)
- [Discord.js testing guide](https://discordjs.guide/additional-info/testing.html)
- [Vitest mocking guide](https://vitest.dev/guide/mocking.html)
