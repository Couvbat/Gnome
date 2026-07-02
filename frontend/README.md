# Le Gnome casino frontend

> React + TypeScript + Vite frontend for the Discord Activity "La Taverne Dorée" with complete character creation and multiplayer casino games.

The frontend UI for the multiplayer casino Discord Activity, featuring 6 RPG character classes, 4 casino games, real-time WebSocket integration, and Discord SDK authentication.

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

**Overall completion:** ✅ **85% complete** — fully functional casino with pending tests and 3D enhancements

## Getting started

### Prerequisites
- **Node.js** v22.17.0 or higher
- **Backend server** running on port 3001 (see [Backend README](../backend/README.md))
- **Discord Application** configured for Activities
- **mkcert** (for local HTTPS development)

### Installation

```bash
cd frontend
npm install
```

### HTTPS setup (required for Discord Activity)

Discord Activities require HTTPS. Generate local SSL certificates:

```bash
# Install mkcert
# Windows:
winget install FiloSottile.mkcert
# macOS:
brew install mkcert
# Linux:
sudo apt install mkcert

# Install local Certificate Authority
mkcert -install

# Generate certificates in frontend directory
cd frontend
mkdir -p certs
cd certs
mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1
```

### Environment configuration

Create `.env` in `/frontend/` directory:

```env
# API Endpoints
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001

# Discord Integration
VITE_DISCORD_CLIENT_ID=discord_client_id

# Development Features
VITE_DEV_MODE=true  # Enable character reset for testing
```

### Discord Developer Portal setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to **Activities** section
4. Enable Activities if not already enabled
5. Set **Activity URL Override** to: `https://localhost:3000/`
6. Save changes

### Development

```bash
npm run dev      # Start dev server (https://localhost:3000)
npm run build    # Production build
npm run preview  # Preview production build
npm run test     # Run unit tests (when implemented)
```

### Testing in Discord

1. **Start backend**: `cd backend && npm run dev`
2. **Start frontend**: `cd frontend && npm run dev`
3. Open Discord and join a voice channel
4. Click the **Activities** button (rocket icon)
5. Select your application from the Activity menu
6. The app loads inside Discord with OAuth authentication

## Architecture

### Project structure

```text
frontend/
├── src/
│   ├── components/              # 12 React components
│   │   ├── CharacterCreation.tsx    # 6 RPG class creation UI
│   │   │   └── CharacterCreation.css
│   │   ├── CasinoLobby.tsx          # Main lobby & navigation
│   │   │   └── CasinoLobby.css
│   │   ├── UserProfile.tsx          # Stats & character info
│   │   └── games/                   # 4 casino game UIs
│   │       ├── BlackjackTable.tsx   # Multiplayer blackjack (2-6 players)
│   │       │   └── BlackjackTable.css
│   │       ├── RouletteWheel.tsx    # European roulette wheel
│   │       │   └── RouletteWheel.css
│   │       ├── SlotMachine.tsx      # Progressive jackpot slots
│   │       │   └── SlotMachine.css
│   │       └── DiceGame.tsx         # Two-dice prediction game
│   │           └── DiceGame.css
│   ├── services/
│   │   ├── api.ts               # REST API client (Axios)
│   │   └── websocket.ts         # Socket.io WebSocket client
│   ├── hooks/
│   │   └── useDiscordSdk.ts     # Discord SDK integration hook
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── App.tsx                  # Main application component
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles
├── certs/                       # HTTPS certificates (gitignored)
├── public/                      # Static assets
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts               # Vite + HTTPS configuration
├── vitest.config.ts             # Test framework setup
├── tailwind.config.js           # Tailwind CSS v4 config
└── postcss.config.js            # PostCSS configuration
```

### Technology stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18+ | UI framework with hooks |
| **TypeScript** | 5+ | Type-safe development |
| **Vite** | 5+ | Build tool with HMR |
| **Discord SDK** | 2.4.0 | Activities authentication |
| **Socket.io-client** | 4.7.2 | Real-time WebSocket |
| **Axios** | Latest | REST API client |
| **Tailwind CSS** | 4+ | Utility-first styling |
| **Vitest** | Latest | Unit testing (planned) |
| **React Testing Library** | Latest | Component testing (planned) |

## Features

### RPG character system

Complete character creation interface with 6 playable classes:

| Class | Icon | Casino bonus | Primary stats |
|-------|------|--------------|---------------|
| **Warrior** | 🗡️ | +15% comeback chance, vitality bonuses | Strength, Vitality |
| **Mage** | 🔮 | +10% prediction accuracy, intelligence bonuses | Intelligence, Luck |
| **Rogue** | 🥷 | +20% high-risk gains, dexterity bonuses | Dexterity, Luck |
| **Merchant** | 💰 | +5% all gains, -10% minimum bets | Charisma, Intelligence |
| **Bard** | 🎵 | +3% per player (max 15%), charisma bonuses | Charisma, Luck |
| **Paladin** | ⚔️ | +8% consistent gains, loss protection | Strength, Charisma, Vitality |

**Character creation features:**
- Visual class selection with icons and descriptions
- Stats preview for each class
- Unique ability explanations
- Casino bonus breakdowns
- Instant character validation

**Dev mode feature:**
When `VITE_DEV_MODE=true`:
- Auto-deletes existing test characters (`dev-user-demo`)
- Resets energy, XP, and casino profile
- Enables rapid iteration for character testing
- **Disabled in production** to preserve user data

### Casino games

#### Blackjack (multiplayer)
- **Players**: 2-6 simultaneous players per table
- **Actions**: Hit, Stand, Double Down
- **UI features**:
  - Dealer section with face-up/face-down cards
  - Individual player hands with bet amounts
  - Real-time card dealing animations
  - Synchronized game state via WebSocket
  - Class bonuses applied to payouts

#### Roulette (European)
- **Wheel**: 37 numbers (0-36) with color coding
- **Bet types**: Red/Black, Even/Odd, Straight, Split, Street, Corner
- **Features**:
  - Interactive betting grid
  - 30-second betting timer with countdown
  - Animated wheel spinning
  - Real-time bet placement from all players
  - Instant payout calculations

#### Slot machine
- **Reels**: 3 reels with 7 unique symbols
- **Jackpot**: Progressive jackpot system
- **Multipliers**:
  - 7️⃣ 7️⃣ 7️⃣: x10
  - 💎 💎 💎: x8
  - Triple match: x5
  - Double match: x2
- **Features**: Animated reel spinning, win celebrations, payout table display

#### Dice game
- **Mechanics**: Two-dice rolling with prediction
- **Multipliers**: x6 to x36 based on probability
- **UI**: Animated dice rolling, prediction interface, multiplier display

### Integration features

#### Discord SDK integration
```typescript
import { DiscordSDK } from '@discord/embedded-app-sdk';

// Initialize Discord SDK
const discordSdk = new DiscordSDK(clientId);
await discordSdk.ready();

// Authenticate user
const { access_token } = await discordSdk.commands.authorize({
  client_id: clientId,
  response_type: 'code',
  state: '',
  prompt: 'none',
  scope: ['identify', 'guilds']
});
```

#### REST API integration
```typescript
import { apiService } from './services/api';

// User authentication
await apiService.login(discordToken);

// Character management
await apiService.createCharacter({ name: 'Hero', class: 'warrior' });
const character = await apiService.getCharacter();

// Casino operations
const profile = await apiService.getCasinoProfile();
const tables = await apiService.getActiveTables('blackjack');
```

#### WebSocket integration
```typescript
import { wsService } from './services/websocket';

// Connect with JWT token
wsService.connect(authToken);

// Join table
wsService.joinTable(tableId);

// Place bet
wsService.placeBet(tableId, { type: 'red', amount: 50 });

// Listen to events
wsService.on('table_updated', (table) => {
  console.log('Table state:', table);
});

wsService.on('spin:result', (result) => {
  console.log('Roulette result:', result);
});
```

## Design system: "La Taverne Dorée"

### Color palette

```css
/* Primary Colors */
--gold-primary: #D4AF37;        /* Tavern gold */
--gold-bright: #FFD700;         /* Bright gold accents */
--oak-wood: #8B4513;            /* Dark oak brown */
--warm-orange: #FF6B35;         /* Accent highlights */
--dark-tavern: #2C1810;         /* Deep brown background */
--dark-navy: #1A1A2E;           /* Alternative dark */

/* Game-specific */
--roulette-red: #E63946;
--roulette-black: #1D3557;
--roulette-green: #2A9D8F;
```

### Typography

- **Headings**: "Cinzel" (elegant serif for tavern atmosphere)
- **Body**: "Open Sans" (clean, readable sans-serif)
- **Monospace**: "JetBrains Mono" (numbers, stats, data)

### Component patterns

All game components follow consistent patterns:
- **Header**: Game title + current balance
- **Main area**: Interactive game interface
- **Actions**: Bet controls and game actions
- **Footer**: Help text and status messages

## Testing (planned)

### Test framework setup

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Planned test coverage

- **Component tests**: All 12 components with RTL
- **Integration tests**: API service layer
- **WebSocket tests**: Socket.io event handling
- **E2E tests**: Full user workflows with Playwright

## Platform support

| Platform | Status | Notes |
|----------|--------|-------|
| **Discord Desktop** | ✅ Full | Complete experience |
| **Discord Web** | ✅ Full | Optimal performance |
| **Discord Mobile (iOS)** | ✅ Full | Touch-optimized UI |
| **Discord Mobile (Android)** | ✅ Full | Platform adaptations |
| **Tablets** | ✅ Full | Responsive layout |

### Responsive breakpoints

```css
/* Tailwind CSS breakpoints */
sm: 640px    /* Small devices */
md: 768px    /* Tablets */
lg: 1024px   /* Desktop */
xl: 1280px   /* Large desktop */
```

## Deployment

### Production build

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview

# Analyze bundle size
npm run build && npm run analyze
```

### Discord Activity deployment

1. **Build**: `npm run build`
2. **Upload**: Deploy `dist/` to CDN (Vercel, Netlify, etc.)
3. **Configure Discord**:
   - Go to Discord Developer Portal
   - Update **Activity URL** to your production URL
   - Test with Discord desktop and mobile clients
4. **SSL**: Ensure HTTPS is properly configured

### Performance optimizations

- **Code splitting**: Lazy loading for game components
- **Asset optimization**: WebP images with fallbacks
- **Bundle size**: Tree shaking and minification
- **Caching**: Browser cache headers for static assets
- **React optimization**: `React.memo` for expensive renders

## Roadmap

### Phase 1: Core foundation (complete)
- Base React app with TypeScript
- Discord SDK authentication
- WebSocket real-time integration
- Casino lobby interface
- 6 RPG character classes
- 4 casino game interfaces

### Phase 2: Enhancements (in progress)
- Advanced card animations (Blackjack)
- Particle effects for wins
- Sound effects and music
- Integrated tavern chat system
- Real-time notifications

### Phase 3: Advanced features (planned)
- **3D tavern environment**: Three.js immersive lobby
- **Quest UI**: Interactive quest tracking
- **Character profiles**: Detailed stats and achievements
- **Spectator mode**: Watch games without playing
- **Tournaments**: Scheduled competitive events
- **Mobile optimizations**: Touch gestures and haptics

### Phase 4: Social and community (future)
- Guild system integration
- Friend leaderboards
- Achievement badges
- Trading and gifting
- Social feed

## Troubleshooting

### Common issues

**Discord Activity won't load:**
- Verify HTTPS certificates are valid (check browser console)
- Ensure backend is running on port 3001
- Check Discord Developer Portal Activity URL matches
- Verify `VITE_DISCORD_CLIENT_ID` is correct in `.env`

**WebSocket connection fails:**
- Check backend WebSocket server is running
- Verify `VITE_WS_URL` in `.env` matches backend
- Inspect browser console for connection errors
- Ensure JWT token is valid

**Character creation errors:**
- Check backend `/api/characters/create` endpoint
- Verify MongoDB is running
- Review backend logs for validation errors
- Ensure character name is unique

**Games not loading:**
- Verify all game components are properly imported
- Check browser console for JavaScript errors
- Ensure WebSocket connection is established
- Test API endpoints with curl/Postman

## Further reading

- **[Backend Casino API](../backend/README.md)** — Express.js server documentation
- **[Bot Discord](../bot/README.md)** — Discord.js bot with economy integration
- **[Testing guide](../docs/TESTING.md)** — Comprehensive testing documentation
- **[RPG system](../docs/RPG_SYSTEM.md)** — Character class architecture
- **[Main README](../README.md)** — Complete project overview

## License

ISC License — See root repository LICENSE file

**The future of Discord casino is here.**
*From text commands to an immersive multiplayer experience in "La Taverne Dorée"*
