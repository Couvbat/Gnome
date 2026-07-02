# Frontend quickstart guide

This guide covers running the frontend locally, connecting it to Discord as an Activity, and verifying the full setup end-to-end.

## Getting started

The frontend is ready with all components and dependencies installed.

### Start development server

```bash
cd frontend
npm run dev
```

Server will start at: **https://localhost:3000** (HTTPS required for Discord)

### Discord Activity setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your app → **Activities** section
3. Enable "Activity URL Override"
4. Set URL to: `https://localhost:3000/`
5. Launch from Discord voice channel Activities menu

### What you can do now

1. **Create a character** — Choose from 6 RPG classes
2. **Explore the casino lobby** — View all 4 games
3. **Play games:**
   - 🃏 Blackjack — Card game with dealer
   - 🎡 Roulette — European roulette betting
   - 🎰 Slots — Progressive jackpot machine
   - 🎲 Dice — Prediction-based dice rolling

### Demo mode

The app works in **demo mode** without Discord when accessed directly in browser.

For full Discord Activity functionality:
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Configure Discord Developer Portal with HTTPS URL
4. Launch Activity from Discord voice channel

### Backend requirements

Make sure backend `.env` has these Discord settings:

```env
DISCORD_CLIENT_ID=client_id
DISCORD_CLIENT_SECRET=client_secret
```

### Project status

✅ **Completed components:**
- Character Creation UI with 6 classes
- Casino Lobby with game selection
- All 4 casino games (Blackjack, Roulette, Slots, Dice)
- WebSocket service for real-time updates
- REST API service for backend communication
- Full TypeScript type definitions

### File structure

```text
frontend/src/
├── App.tsx                    # Main app with routing logic
├── components/
│   ├── CharacterCreation.tsx  # Character creation interface
│   ├── CasinoLobby.tsx       # Main casino hub
│   └── games/                 # Individual game components
│       ├── BlackjackTable.tsx
│       ├── RouletteWheel.tsx
│       ├── SlotMachine.tsx
│       └── DiceGame.tsx
├── services/
│   ├── api.ts                 # REST API client
│   └── websocket.ts           # Socket.io integration
└── types/
    └── index.ts               # TypeScript definitions
```

### Next steps

To continue development:

1. **Backend integration** — Connect to real casino backend API
2. **Authentication** — Add Discord SDK integration
3. **Multiplayer** — Test real-time table synchronization
4. **Polish** — Add animations, sounds, 3D effects

### Troubleshooting

**Port already in use**
```bash
# Change port in vite.config.ts, line 8:
server: { port: 3002 }
```

**Dependencies issues**
```bash
npm install --legacy-peer-deps
```

**TypeScript errors**
These are expected before running `npm install`. They're resolved now!

### Build for production

```bash
npm run build    # Creates dist/ folder
npm run preview  # Test production build
```
