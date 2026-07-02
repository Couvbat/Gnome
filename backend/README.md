# 🎰 Le Gnome Casino backend

This document covers the Express.js casino backend for "La Taverne Dorée du Gnome" — a production-ready REST API and real-time WebSocket server for the Discord Activity casino, with 6 RPG character classes, multiplayer table management, and complete casino game engines.

**Backend for "La Taverne Dorée du Gnome"**: powering the multiplayer casino Discord Activity with full RPG integration, real-time gaming, and persistent economy system.

## 📊 Implementation status

| Component | Status | Details |
|-----------|--------|---------|
| **REST API** | ✅ 100% | 18 endpoints (auth, casino, characters, games) |
| **WebSocket** | ✅ 100% | 15+ real-time events operational |
| **RPG System** | ✅ 100% | 6 character classes with casino bonuses |
| **Multiplayer Games** | ✅ 100% | Blackjack (2-6 players), Roulette (shared) |
| **Solo Games** | ✅ 100% | Slots, Dice with RNG + progressive jackpots |
| **Tests** | ✅ 99.6% | 238 tests (237 passing, 16 test files) |
| **Frontend Integration** | ✅ 100% | Complete API for Discord Activity |

**Key Stats:**
- 4 game engines fully implemented
- 6 RPG character classes with unique abilities
- 2 table managers for multiplayer coordination
- 7 service modules (Character, Ability, Energy, Quest, etc.)
- Real-time WebSocket synchronization for all multiplayer features

> 📚 **Detailed Documentation**: See [`/docs/RPG_SYSTEM.md`](../docs/RPG_SYSTEM.md) for complete architecture (1370 lines)

## 🚀 Getting started

### Prerequisites
- **Node.js** v22.17.0 or higher
- **MongoDB** (local instance or connection string)
- **Discord Application** configured (for Activity integration)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your configuration (see Configuration section)

# Build TypeScript
npm run build

# Start production server
npm start
```

### Development mode

```bash
# Start with hot reload
npm run dev
```

### Testing

```bash
npm test              # Run all 238 tests
npm run test:watch    # Watch mode with auto-reload
npm test -- --testNamePattern="e2e"  # E2E tests only
```

## ⚙️ Configuration

Create a `.env` file in the `/backend/` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/gnome-casino

# Authentication
JWT_SECRET=jwt_secret

# Discord Integration
DISCORD_CLIENT_ID=discord_client_id
DISCORD_ACTIVITY_URL=http://localhost:3000

# Casino Settings
DEFAULT_STARTING_COINS=1000
DAILY_BONUS_BASE=100
MIN_BET_AMOUNT=10
MAX_BET_AMOUNT=10000

# Rate Limiting (Optional)
RATE_LIMIT_WINDOW_MS=60000        # 1 minute
RATE_LIMIT_MAX_REQUESTS=100       # 100 requests per window

# CORS (Optional)
CORS_ORIGIN=http://localhost:3000
```

Use `.env.example` as a template.

## 🏗️ Architecture

### Project structure

```text
backend/
├── src/
│   ├── routes/              # REST API endpoints
│   │   ├── auth.ts          # Discord authentication & JWT
│   │   ├── casino.ts        # Casino profile, tables, sessions
│   │   ├── characters.ts    # RPG character management
│   │   ├── games.ts         # Individual games (slots, dice)
│   │   ├── progression.ts   # Leveling, quests, achievements
│   │   └── quests.ts        # Quest system endpoints
│   ├── engines/             # Game logic engines
│   │   ├── BlackjackEngine.ts   # Blackjack card game logic
│   │   ├── RouletteEngine.ts    # Roulette wheel mechanics
│   │   ├── SlotsEngine.ts       # Slot machine RNG
│   │   └── DiceEngine.ts        # Dice rolling game
│   ├── managers/            # Multiplayer table coordination
│   │   ├── BlackjackTableManager.ts  # 2-6 player tables
│   │   └── RouletteTableManager.ts   # Shared betting rounds
│   ├── services/            # Business logic services
│   │   ├── CharacterService.ts   # Character CRUD & stats
│   │   ├── AbilityService.ts     # Special ability management
│   │   ├── EnergyService.ts      # Energy system for abilities
│   │   ├── QuestService.ts       # Quest progression tracking
│   │   ├── ReputationService.ts  # Reputation & social features
│   │   ├── BardAbilities.ts      # Bard-specific table buffs
│   │   └── WarriorAbilities.ts   # Warrior-specific abilities
│   ├── models/              # MongoDB schemas
│   │   ├── User.ts          # User accounts & economy
│   │   ├── Character.ts     # RPG characters
│   │   ├── BlackjackTable.ts    # Blackjack table state
│   │   ├── RouletteTable.ts     # Roulette table state
│   │   ├── Quest.ts         # Quest definitions
│   │   └── ...              # 10+ other models
│   ├── websocket/           # Socket.io event handlers
│   │   └── socketHandlers.ts    # 15+ WebSocket events
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts          # JWT verification
│   │   └── validation.ts    # Request validation
│   └── index.ts             # Server entry point
├── __tests__/               # Test suite (16 files, 238 tests)
│   ├── *.test.ts            # Unit tests
│   ├── *.e2e.test.ts        # End-to-end tests
│   ├── __mocks__/           # Test mocks
│   └── setup.ts             # Test configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Technology stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | 22.17.0+ | Server runtime |
| **Framework** | Express.js | Latest | REST API server |
| **Language** | TypeScript | 5.9.3 | Type-safe development |
| **WebSocket** | Socket.io | Latest | Real-time communication |
| **Database** | MongoDB | Latest | Data persistence |
| **ODM** | Mongoose | 8.19.2 | MongoDB object modeling |
| **Testing** | Vitest | 3.2.4 | Unit & E2E tests |
| **Auth** | JWT | Latest | Token-based authentication |

## 📡 API reference

### 🔐 Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/discord` | POST | Authenticate via Discord token |
| `/api/auth/refresh` | POST | Refresh JWT token |
| `/api/auth/me` | GET | Get current user info |

### 🧙‍♂️ Character management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/characters/classes` | GET | List available classes |
| `/api/characters/classes/:className` | GET | Get class details |
| `/api/characters/create` | POST | Create new character |
| `/api/characters/me` | GET | Get current user's character |
| `/api/characters/:id/stats` | GET | Get detailed character stats |
| `/api/characters/leaderboard` | GET | Global character leaderboard |
| `/api/characters/search` | GET | Search by name or class |

### 💰 Casino profile & economy

| Endpoint | Method | Description | Replaces Discord Command |
|----------|--------|-------------|------------------------|
| `/api/casino/profile` | GET | Balance, XP, stats | `/balance` |
| `/api/casino/daily` | POST | Daily coin bonus | `/daily` |
| `/api/casino/leaderboard` | GET | Server rankings | `/leaderboard` |
| `/api/casino/session/start` | POST | Start casino session | - |
| `/api/casino/session` | GET | Current session info | - |
| `/api/casino/session/end` | POST | End casino session | - |
| `/api/casino/games/status` | GET | Available games & tables | - |

### 🎰 Casino games

**Multiplayer table management:**
- `POST /api/casino/tables/roulette/create` - Create roulette table
- `POST /api/casino/tables/blackjack/create` - Create blackjack table (2-6 players)
- `GET /api/casino/tables/:game` - List active tables (roulette/blackjack)
- `GET /api/casino/tables/:game/:tableId` - Get table state
- `DELETE /api/casino/tables/:game/:tableId` - Close table
- `POST /api/casino/tables/:game/:tableId/start` - Start game
- `POST /api/casino/tables/cleanup` - Auto-cleanup inactive tables (30min+)

**Individual games:**
- `POST /api/games/slots/spin` - Spin slot machine (replaces `/slots`)
- `POST /api/games/dice/roll` - Roll dice game (replaces `/dice`)

> **Note**: For optimal multiplayer experience, use WebSocket events instead of REST endpoints for real-time actions.

### 🎮 Progression & quests

- `GET /api/progression/quests` - Available quests
- `GET /api/progression/quests/:id` - Quest details
- `POST /api/progression/quests/:id/start` - Start quest
- `POST /api/progression/quests/:id/complete` - Complete quest
- `GET /api/progression/achievements` - User achievements
- `GET /api/progression/level-up` - Trigger level-up

## 🔌 WebSocket events

### Connection & authentication

Clients connect with JWT token via `socket.handshake.auth.token`. The server verifies authentication on connection, then auto-joins the client to a guild room for server-specific events.

### 🃏 Blackjack multiplayer events

| Event | Direction | Description |
|-------|-----------|-------------|
| `blackjack:join_table` | Client → Server | Join blackjack table (2-6 players) |
| `blackjack:place_bet` | Client → Server | Place bet (betting phase) |
| `blackjack:action` | Client → Server | Player action (hit/stand/double) |
| `table:player_joined` | Server → Clients | Player joined table |
| `game:card_dealt` | Server → Clients | Card dealt to player/dealer |
| `game:round_complete` | Server → Clients | Round results with class bonuses |
| `player:left_table` | Server → Clients | Player left table |
| `table:cleanup` | Server → Clients | Table closed (30min inactivity) |

### 🎡 Roulette multiplayer events

| Event | Direction | Description |
|-------|-----------|-------------|
| `roulette:join_table` | Client → Server | Join shared roulette table |
| `roulette:place_bet` | Client → Server | Place bet (straight, split, corner, etc.) |
| `table:player_joined` | Server → Clients | New player at table |
| `betting:timer_update` | Server → Clients | 30-second countdown timer |
| `spin:result` | Server → Clients | Spin result + winners + payouts |
| `player:left_table` | Server → Clients | Player left |

### 🎵 Bard abilities (table-wide buffs)

| Event | Direction | Description |
|-------|-----------|-------------|
| `bard:trigger_lucky_song` | Client → Server | Activate Lucky Song (+10% luck entire table) |
| `buff:applied` | Server → Clients | Buff active on table |
| `buff:expired` | Server → Clients | Buff expired |

### 🌐 General casino events

| Event | Direction | Description |
|-------|-----------|-------------|
| `casino:get_balance` | Client → Server | Request balance update |
| `casino:balance_update` | Server → Client | Balance changed notification |
| `error` | Server → Client | Error notification (invalid bet, etc.) |

**Total**: 15+ operational WebSocket events for real-time multiplayer communication.

## 🧙‍♂️ RPG character system

The casino backend includes a comprehensive RPG system with 6 character classes providing unique casino bonuses:

### Character classes

| Class | Icon | Casino Bonus | Special Ability | Base Stats |
|-------|------|--------------|-----------------|------------|
| **Warrior** | 🗡️ | +5 luck, +20 energy, comeback mechanics | Battle Rage - Higher win chance after loss | STR: 20, VIT: 18 |
| **Mage** | 🔮 | +10 luck, +15 energy, card prediction | Arcane Insight - See next blackjack card | INT: 22, LUCK: 15 |
| **Rogue** | 🥷 | +15 luck, +10 energy, loss avoidance | Sleight of Hand - Cancel small losses | DEX: 20, LUCK: 18 |
| **Merchant** | 💰 | +8 luck, +25 energy, improved gains | Coin Sense - +25% gains and daily bonus | CHA: 20, INT: 16 |
| **Bard** | 🎵 | +12 luck, +15 energy, party buffs | Lucky Song - +10% luck entire table | CHA: 22, LUCK: 16 |
| **Paladin** | ⚔️ | +10 luck, +30 energy, loss protection | Divine Blessing - Reduce large losses | STR: 18, CHA: 18, VIT: 20 |

### Class implementation

Each class is fully implemented with:
- **Base stats** affecting casino performance
- **Energy system** limiting ability usage
- **Unique abilities** triggered via API or WebSocket
- **Casino bonuses** applied automatically to game payouts
- **Progression system** with unlocks and upgrades

### Example: Bard Lucky Song

```typescript
// Client triggers via WebSocket
socket.emit('bard:trigger_lucky_song', { 
  tableId: 'roulette_123',
  userId: 'user_456'
});

// Server broadcasts to all players at table
socket.to(tableId).emit('buff:applied', {
  type: 'lucky_song',
  effect: '+10% luck',
  duration: 180000, // 3 minutes
  caster: 'BardPlayerName'
});
```

## 🧪 Testing

### Test suite coverage

The backend includes comprehensive testing with **238 tests** (99.6% pass rate):

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# E2E tests only
npm test -- --testNamePattern="e2e"

# Coverage report
npm run test:coverage
```

### Test coverage

| Category | Files | Tests | Status |
|----------|-------|-------|--------|
| **Game Engines** | 4 | ~80 | ✅ 100% pass |
| **Table Managers** | 2 | ~40 | ✅ 100% pass |
| **RPG Services** | 5 | ~80 | ✅ 100% pass |
| **E2E Tests** | 3 | 34 | ✅ 100% pass |
| **Unit Tests** | 2 | ~4 | ✅ 100% pass |
| **Total** | **16** | **238** | **✅ 99.6%** |

**Test Files:**
- `BlackjackEngine.test.ts` - Card game logic validation
- `RouletteEngine.test.ts` - Roulette wheel mechanics
- `SlotsEngine.test.ts` - RNG and payout calculations
- `DiceEngine.test.ts` - Dice rolling probabilities
- `BlackjackTableManager.test.ts` - Multiplayer coordination
- `RouletteTableManager.test.ts` - Timer and betting rounds
- `CharacterService.test.ts` - RPG character CRUD
- `AbilityService.test.ts` - Special ability system
- `EnergyService.test.ts` - Energy management
- `QuestService.test.ts` - Quest progression
- `ReputationService.test.ts` - Reputation tracking
- `auth-routes.e2e.test.ts` - Authentication flow
- `casino-routes.e2e.test.ts` - Casino API endpoints
- `casino-rpg-workflow.e2e.test.ts` - Full RPG integration
- Plus 2 additional test files

> 📖 **E2E Testing Guide**: See `__tests__/E2E-README.md` for detailed documentation

## 🚀 Deployment

### Production build

```bash
# Build TypeScript
npm run build

# Set environment variables
export NODE_ENV=production
export MONGODB_URI=production_mongodb_uri
export JWT_SECRET=production_jwt_secret

# Start server
npm start
```

### Database setup

1. **MongoDB Connection**: Ensure MongoDB is accessible
2. **Indexes**: Create indexes for performance:
   ```js
   db.users.createIndex({ userId: 1 }, { unique: true });
   db.characters.createIndex({ userId: 1 }, { unique: true });
   db.blackjack_tables.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7200 });
   ```
3. **Backup Strategy**: Regular automated backups recommended

### Security considerations

- **HTTPS Required**: For WebSocket security and Discord Activity
- **JWT Secret**: Use strong, randomly generated secret
- **Rate Limiting**: 100 requests/minute per IP (configurable)
- **CORS**: Configure allowed origins for Discord Activity
- **Input Validation**: All endpoints validate and sanitize input
- **MongoDB Injection**: Mongoose schemas protect against injection

### Monitoring & logs

```bash
# Production logs with timestamps
npm start 2>&1 | tee -a logs/casino-server.log

# Health check endpoint
curl http://localhost:3001/health

# Monitor WebSocket connections
# Check server logs for socket.io connection events
```

## 📊 Migration from Discord commands

### Command to API mapping

| Discord Command | REST API Endpoint | Description |
|----------------|-------------------|-------------|
| `/balance` | `GET /api/casino/profile` | Coins, XP, level, casino stats |
| `/daily` | `POST /api/casino/daily` | Daily coin bonus |
| `/leaderboard` | `GET /api/casino/leaderboard` | Server rankings |
| `/slots <bet>` | `POST /api/games/slots/spin` | Slot machine game |
| `/dice <bet>` | `POST /api/games/dice/roll` | Dice rolling game |
| `/roulette <bet>` | `POST /api/games/roulette/bet` | Roulette bets |
| `/blackjack <bet>` | `POST /api/games/blackjack/join` | Join blackjack table |
| *(New)* | `POST /api/characters/create` | Create RPG character |
| *(New)* | `GET /api/characters/me` | View character stats |

### Advantages over Discord commands

| Aspect | Discord Commands | Backend API |
|--------|-----------------|-------------|
| **UX** | 🟡 Text-based | ✅ Rich web interface |
| **Gaming** | ❌ Solo only | ✅ Multiplayer casino experience |
| **Features** | 🟡 Basic functionality | ✅ RPG progression, guilds, quests |
| **Scalability** | ❌ Limited by Discord rate limits | ✅ Handles more concurrent players |
| **Platform** | 🟡 Discord-only | ✅ Modern web technologies |

### Compatibility approach

- **Shared Database**: Same MongoDB collections for economy
- **Integrated Economy**: Coins/XP shared between bot and casino
- **Gradual Migration**: Existing commands maintained during development
- **Fallback**: Command version remains as backup

## 🔗 Related documentation

- **[Bot Discord](../bot/README.md)** - Discord.js bot with 30 commands
- **[Frontend Activity](../frontend/README.md)** - React UI for casino interface
- **[Testing Guide](../docs/TESTING.md)** - Comprehensive testing documentation
- **[RPG System](../docs/RPG_SYSTEM.md)** - Complete character class architecture (1370 lines)
- **[RPG Lore](../docs/RPG_LORE.md)** - Casino universe and character backgrounds
- **[Main README](../README.md)** - Project overview and features

## 📄 License

ISC License - See root repository LICENSE file

**🎰 Ready to transform Discord gaming experience!**  
*From text commands to an immersive multiplayer casino*
