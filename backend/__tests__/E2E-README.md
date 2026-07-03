# End-to-end test suite

This document covers the E2E tests for the Gnome Casino backend API. The tests validate complete user workflows and API interactions using real HTTP requests via supertest.

## What these tests cover

This directory contains comprehensive end-to-end (E2E) tests for the Gnome Casino backend API. These tests validate complete user workflows and API interactions using real HTTP requests via supertest.

## Test structure

### Test files

1. **`auth-routes.e2e.test.ts`** - Authentication API tests
   - Development authentication (`/api/auth/dev`)
   - Discord OAuth authentication (`/api/auth/discord`)
   - JWT token generation and validation
   - Token expiration handling
   - User creation flow via `/api/auth/me`

2. **`casino-routes.e2e.test.ts`** - Casino API tests
   - User profile retrieval (`/api/casino/profile`)
   - Daily reward system (`/api/casino/daily`)
   - Level-based reward scaling
   - Energy restoration mechanics
   - Authentication enforcement

3. **`casino-rpg-workflow.e2e.test.ts`** - Complete workflow tests
   - New player onboarding flow
   - Character creation and progression
   - Casino gameplay sessions
   - Daily reward routines
   - Error recovery scenarios

4. **`games-routes.e2e.test.ts`** - Casino games API tests
   - Slots game spin (`/api/games/slots/spin`)
   - Dice game roll (`/api/games/dice/roll`)
   - Dice game info (`/api/games/dice/info`)
   - Blackjack play (`/api/games/blackjack/play`)
   - Blackjack info (`/api/games/blackjack/info`)
   - Roulette play with multiple bets (`/api/games/roulette/play`)
   - Roulette info (`/api/games/roulette/info`)
   - Win/loss scenarios and special abilities
   - Minimum bet validation
   - Authentication enforcement across all endpoints

5. **`progression-routes.e2e.test.ts`** - Progression system API tests
   - Energy status (`/api/progression/energy`)
   - Confirms `/api/progression/energy/restore` was removed (404) - it let any
     authenticated user restore their own energy for free
   - Reputation status (`/api/progression/reputation`)
   - Reputation tiers (`/api/progression/reputation/tiers`)
   - Reputation bonuses (`/api/progression/reputation/bonuses`)
   - Abilities status (`/api/progression/abilities`)
   - Specific ability check (`/api/progression/abilities/:abilityKey`)
   - Combined stats (`/api/progression/stats`)
   - Cooldown and usage tracking
   - Full progression flow workflows

6. **`quests-routes.e2e.test.ts`** - Quest system API tests
   - Available quests listing (`/api/quests/available`)
   - Active quests (`/api/quests/active`)
   - Quest history (`/api/quests/history`)
   - Start quest (`/api/quests/:questId/start`)
   - Abandon quest (`/api/quests/:questId/abandon`)
   - Confirms `/api/quests/progress` was removed (404) - it let any authenticated
     user complete quests instantly by POSTing arbitrary progress
   - Admin: Initialize daily quests (`/api/quests/admin/init-daily`)
   - Admin: Initialize story quests (`/api/quests/admin/init-story`)
   - Complete quest workflow (browse → start → progress → complete)
   - Quest abandonment workflow

7. **`socketHandlers.e2e.test.ts`** - Real-time multiplayer transport tests
   - Runs a live Socket.IO server + client pair (via `socket.io-client`) against `setupSocketHandlers`
   - Auth handshake: missing token, invalid token, valid token
   - Roulette: join table, table-state broadcast, betting-round auto-start, bet placement success/failure
   - Blackjack: join table, hit/stand results, error propagation
   - Bard `bard:trigger_lucky_song`: table-wide `bard:harmony_boost_active` broadcast, cooldown error path
   - Disconnect: `casino:player_left` broadcast to the rest of the guild room
   - `RouletteTableManager`, `BlackjackTableManager`, and `BardAbilities` are mocked — this suite tests the transport/routing layer, not game logic (which has its own unit tests)

## Running tests

### Run all E2E tests
```bash
cd backend
npm test -- --testNamePattern="e2e"
```

### Run specific test suite
```bash
# Auth tests only
npm test -- auth-routes.e2e.test.ts

# Casino routes only
npm test -- casino-routes.e2e.test.ts

# Workflow tests only
npm test -- casino-rpg-workflow.e2e.test.ts
```

### Run with coverage
```bash
npm test -- --coverage --testNamePattern="e2e"
```

## Test architecture

### Technology stack
- **Testing Framework**: Vitest 3.x
- **HTTP Client**: supertest 6.3+
- **Authentication**: jsonwebtoken (JWT)
- **Mocking**: vi.mock() for database models

### Test app setup
Each test suite creates a minimal Express app with required routes:

```typescript
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/casino', authMiddleware, casinoRoutes);
```

### Authentication
Tests use JWT tokens for authenticated requests:

```typescript
const authToken = jwt.sign(
  { userId, guildId, username },
  jwtSecret,
  { expiresIn: '24h' }
);

await request(app)
  .get('/api/casino/profile')
  .set('Authorization', `Bearer ${authToken}`);
```

## Writing new E2E tests

### Template structure

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/database';

// Mock database models
vi.mock('../src/models/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/route', yourRoute);

describe('Your Feature E2E Tests', () => {
  let authToken: string;
  
  beforeAll(() => {
    // Setup authentication
    authToken = jwt.sign(
      { userId: test_user_id, guildId: test_guild_id },
      process.env.JWT_SECRET || 'gnome-casino-secret',
      { expiresIn: '24h' }
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete feature workflow', async () => {
    // Setup mocks
    vi.mocked(User.findOne).mockResolvedValue({
      userId: test_user_id,
      username: 'TestUser', // IMPORTANT: Include username
      coins: 1000
    } as any);

    // Make request
    const response = await request(app)
      .get('/api/route/endpoint')
      .set('Authorization', `Bearer ${authToken}`);

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });
});
```

### Common patterns

#### 1. Mock user with required fields
```typescript
const mockUser = {
  userId: test_user_id,
  guildId: test_guild_id,
  username: 'TestUser',  // ⚠️ Required for casino routes
  coins: 1000,
  xp: 0,
  level: 1,
  save: vi.fn().mockResolvedValue(true)
};
```

#### 2. Test authentication failures
```typescript
it('should require authentication', async () => {
  const response = await request(app)
    .get('/api/protected/endpoint');

  expect(response.status).toBe(401);
});
```

#### 3. Test complete workflows
```typescript
it('should complete multi-step workflow', async () => {
  // Step 1: Initial state
  const response1 = await request(app)
    .get('/api/state')
    .set('Authorization', `Bearer ${authToken}`);

  expect(response1.body.value).toBe(0);

  // Step 2: Perform action
  const response2 = await request(app)
    .post('/api/action')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ amount: 100 });

  expect(response2.status).toBe(200);

  // Step 3: Verify state change
  const response3 = await request(app)
    .get('/api/state')
    .set('Authorization', `Bearer ${authToken}`);

  expect(response3.body.value).toBe(100);
});
```

## Known limitations

1. **Database mocking** — tests mock database models rather than hitting a real test database. Fast and isolated, but doesn't exercise actual database interactions (consider `mongodb-memory-server` for true integration tests).
2. **`username` field** — a common source of test failures is a mocked `User` missing the `username` field; always include it.
3. **Concurrent request testing** — race conditions are hard to test against mocks; a real database is needed for that.

`socketHandlers.e2e.test.ts` covers the WebSocket transport/routing layer with a live Socket.IO server, but the table managers it calls into are mocked — so it doesn't exercise real multiplayer game-state transitions end-to-end (that's covered separately by `BlackjackTableManager.test.ts` / `RouletteTableManager.test.ts`, also against mocked persistence).

## Debugging failed tests

### Check mock setup
```typescript
beforeEach(() => {
  // Always include username field
  vi.mocked(User.findOne).mockResolvedValue({
    userId: testUserId,
    guildId: testGuildId,
    username: 'TestUser', // ← Add this!
    coins: 1000
  } as any);
});
```

### View request/response
```typescript
const response = await request(app).get('/api/endpoint');
console.log('Status:', response.status);
console.log('Body:', JSON.stringify(response.body, null, 2));
console.log('Headers:', response.headers);
```

### Check JWT token
```typescript
const decoded = jwt.decode(authToken);
console.log('Token payload:', decoded);
```

## Integration with CI/CD

### GitHub Actions example
```yaml
- name: Run E2E Tests
  run: |
    cd backend
    npm install
    npm test -- --testNamePattern="e2e" --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./backend/coverage/lcov.info
```

## Best practices

**Do** — mock all database operations; use descriptive test names describing the workflow; test both success and error scenarios; clear mocks between tests with `vi.clearAllMocks()`; include all required fields in mocks (especially `username`); test authentication on protected routes.

**Don't** — make real calls to external services; depend on test execution order; skip error-case testing; hardcode tokens or secrets; leave `console.log` statements in committed code.

## Further reading

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Express Testing Guide](https://expressjs.com/en/guide/testing.html)
- [JWT.io](https://jwt.io/) - JWT debugger

## Maintenance

These tests should be updated when:
- New API endpoints are added
- API request/response schemas change
- Authentication flow changes
- Database models are modified
