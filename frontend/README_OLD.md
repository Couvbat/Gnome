# Le Gnome casino frontend

> **✅ 85% complete** — React + Vite + TypeScript frontend for the Discord Activity casino interface "La Taverne Dorée" with full character creation and multiplayer games.

## Implementation status

| Feature | Status | Details |
|---------|--------|---------|
| **React framework** | ✅ 100% | React 18 + TypeScript + Vite |
| **Component library** | ✅ 100% | 12 functional components |
| **Character system** | ✅ 100% | 6 RPG classes with creation UI |
| **Game interfaces** | ✅ 100% | Blackjack, Roulette, Slots, Dice |
| **Discord SDK** | ✅ 100% | Activities authentication integrated |
| **WebSocket** | ✅ 100% | Socket.io real-time connection |
| **Styling** | ✅ 100% | Tailwind CSS v4 design system |
| **Tests** | ⏳ 0% | Vitest + RTL setup pending |
| **3D graphics** | ⏳ 0% | Three.js tavern environment planned |

## Features

### RPG character system
- **6 Playable classes**: Warrior 🗡️, Mage 🔮, Rogue 🥷, Merchant 💰, Bard 🎵, Paladin ⚔️
- Character creation with class selection and stats display
- Unique casino bonuses per class affecting game outcomes
- User profile interface with progression tracking

**Class bonuses:**
- **Warrior** 🗡️: +15% comeback chance, vitality bonuses
- **Mage** 🔮: +10% prediction accuracy, intelligence bonuses
- **Rogue** 🥷: +20% high-risk gains, dexterity bonuses
- **Merchant** 💰: +5% all gains, -10% minimum bets
- **Bard** 🎵: +3% per player (max 15%), charisma bonuses
- **Paladin** ⚔️: +8% consistent gains, loss protection

### Multiplayer casino games
- **Blackjack** 🃏 — Multiplayer tables (2-6 players)
  - Complete UI with dealer section
  - Actions: Hit, Stand, Double Down
  - Real-time card dealing and synchronized game state
- **Roulette** 🎡 — European roulette with multiple bet types
  - Interactive wheel with physics animation
  - Bet types: Red/Black, Even/Odd, Numbers, Ranges
  - 30-second betting timer
- **Slots** 🎰 — Progressive jackpot slot machine
  - Animated reel spinning with 7 symbols
  - Progressive jackpot integration
  - Multipliers: x10 (7️⃣7️⃣7️⃣), x8 (💎💎💎), x5 (triple), x2 (double)
- **Dice** 🎲 — Two-dice prediction game
  - Animated dice rolling
  - Variable multipliers (x6 to x36 based on probability)

### Discord integration
- **Discord Activities SDK** v2.4.0
- Automatic authentication via Discord OAuth
- Voice channel participant detection
- Activity lifecycle event handling

### Real-time communication
- **WebSocket with Socket.io** client v4.7.2
- Synchronized game events between players
- Instant table state updates
- Real-time win/loss notifications

## Technology stack

| Technology | Version | Usage |
|------------|---------|-------|
| **React** | 18+ | Main UI framework |
| **TypeScript** | 5+ | Strict typing |
| **Vite** | 5+ | Build tool with HMR |
| **Discord SDK** | 2.4.0 | Activities integration |
| **Socket.io-client** | 4.7.2 | Real-time WebSocket |
| **Axios** | — | REST API client |
| **Tailwind CSS** | 4+ | Utility-first styling |

## Setup

### Prerequisites
- Node.js v22.17.0+
- Backend server running on port 3001
- Discord Application configured for Activities

### Installation

```bash
cd frontend
npm install
```

### HTTPS setup (required for Discord Activity)

Discord Activities require HTTPS. Generate local SSL certificates:

```bash
# Install mkcert (if not installed)
winget install FiloSottile.mkcert  # Windows
# or: brew install mkcert          # macOS

# Install local CA
mkcert -install

# Generate certificates
cd frontend
mkdir certs
cd certs
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1
```

### Environment variables

```env
# .env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
VITE_DISCORD_CLIENT_ID=discord_client_id
VITE_DEV_MODE=true  # Enable dev mode features
```

### Discord Developer Portal setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Enable **Activities** in the app settings
4. Set the **Activity URL Override** to: `https://localhost:3000/`
5. Add `DISCORD_CLIENT_SECRET` to your backend `.env`

#### Development mode

When `VITE_DEV_MODE=true`:
- **Auto character reset**: Existing characters for test user (`dev-user-demo`) are automatically deleted on creation page
- **Full reset**: Energy, XP, and casino profile reset on each creation
- **Iterative testing**: Test character creation and progression from scratch

**Note**: Disabled in production to preserve user data.

### Development

```bash
npm run dev      # Start dev server (https://localhost:3000)
npm run build    # Production build
npm run preview  # Preview production build
npm run test     # Run unit tests
```

### Discord Activity development

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Open Discord and join a voice channel
4. Launch the Activity from the Activities menu
5. The app loads inside Discord with OAuth authentication

## Project structure

```text
frontend/
├── src/
│   ├── components/              # React components
│   │   ├── CharacterCreation.tsx/css
│   │   ├── CasinoLobby.tsx/css
│   │   └── games/
│   │       ├── BlackjackTable.tsx/css
│   │       ├── RouletteWheel.tsx/css
│   │       ├── SlotMachine.tsx/css
│   │       └── DiceGame.tsx/css
│   ├── services/
│   │   ├── api.ts              # REST API client
│   │   └── websocket.ts        # Socket.io integration
│   ├── types/index.ts          # TypeScript definitions
│   ├── App.tsx                 # Main application
│   └── main.tsx                # Entry point
├── vite.config.ts              # Vite configuration
└── package.json
```

## Components

### CasinoLobby
Main hub for game selection and character stats display.

### BlackjackTable
Multiplayer blackjack with dealer interface, betting controls, and synchronized gameplay.

### RouletteWheel
European roulette with 37-number grid, color-coded cells, and animated spinning wheel.

### SlotMachine
Progressive jackpot slots with 3 reels, 7 symbols, and payout table display.

### DiceGame
Two-dice prediction game with probability-based multipliers.

## API integration

### REST API
```typescript
import { apiService } from './services/api';

await apiService.login(discordToken);
await apiService.createCharacter({ name, class });
await apiService.getActiveTables('blackjack');
```

### WebSocket
```typescript
import { wsService } from './services/websocket';

wsService.connect(authToken);
wsService.on('table_updated', (table) => { ... });
wsService.joinTable(tableId);
wsService.placeBet(tableId, { type: 'red', amount: 50 });
```

## Theme: "La Taverne Dorée"

**Color palette:**
- **Primary**: `#D4AF37` (Gold) / `#ffd700`
- **Secondary**: `#8B4513` (Oak wood)
- **Accent**: `#FF6B35` (Warm orange)
- **Dark**: `#2C1810` / `#1a1a2e` (Dark brown/navy)

**Typography:**
- **Headings**: "Cinzel" (elegant serif)
- **Body**: "Open Sans" (readable)
- **Monospace**: "JetBrains Mono" (numeric data)

## Security and performance

- **Discord SDK**: Native Activities authentication
- **JWT validation**: Backend token verification
- **Code splitting**: Lazy loading per route/game
- **Asset optimization**: WebP compression + browser cache
- **React.memo**: Prevent unnecessary re-renders

## Platform support

| Platform | Status | Notes |
|----------|--------|-------|
| **Discord Desktop** | ✅ Full | Complete experience |
| **Discord Web** | ✅ Full | Optimal performance |
| **Discord Mobile** | 🟡 Partial | Touch-adapted UI |
| **Discord iOS/Android** | ✅ Full | Platform optimizations |

## Deployment

```bash
npm run build     # Production build
npm run analyze   # Bundle analysis
npm run preview   # Local preview
```

**Discord Activity deployment:**
1. Build: `npm run build`
2. Upload assets to CDN (Vercel/Netlify)
3. Configure Activity URL in Discord Developer Portal
4. Test on Discord desktop/mobile clients

## Roadmap

**Phase 1 (current):** ✅ Base React + Discord SDK, WebSocket, lobby, games
**Phase 2:** Advanced card animations, integrated tavern chat, notifications
**Phase 3:** Themed slot machines, quest UI, detailed character profiles, spectator mode

**The future of Discord casino starts here.**
*From text commands to immersive experience*
