# Feature ideas for Le Gnome Discord bot

## ✅ Currently implemented features

### Core bot infrastructure
- **Command System**: TypeScript-based slash commands with proper error handling and cooldowns
- **Database**: MongoDB integration with user levels, coins, birthday tracking, and connection pooling
- **AI Integration**: Mistral API for conversational AI with single-shot and thread-based modes
- **Voice Features**: OpenAI Whisper API for speech-to-text transcription
- **Music System**: Multi-platform player (YouTube + SoundCloud) with playlist support
- **Gaming Integration**: Comprehensive League of Legends stats via Riot Games API
- **Testing**: Vitest with extensive command coverage
- **Hosting**: cPanel/Passenger compatible with crash recovery and memory optimization

### Economy & gambling system ✅
- **Virtual Currency**: Coin system integrated with leveling and stored in MongoDB
- **Gambling Games**: 
  - Slots machine with 3-reel mechanics
  - Blackjack with hit/stand/double/split actions
  - European Roulette with multiple bet types (rouge/noir, pair/impair, ranges, numbers)
  - Dice rolling game
  - All games: min 10 coins, no maximum bet
- **Daily Rewards**: `/daily` command with level-based bonuses (50 + level × 10 coins)
- **Balance Tracking**: `/balance` command showing coins/XP/level for any user

### Level/XP system ✅
- **XP Earning**: 
  - 15-25 XP per message (1 minute cooldown)
  - XP for voice channel activity (time-based)
  - Tracked via xpTracking service
- **Leveling Formula**: Quadratic progression (level² × 100 XP required)
- **Coin Rewards**: Level × 50 coins per level up
- **Leaderboards**: `/leaderboard` command for server rankings (paginated)
- **Rank Display**: `/rank` command with visual progress bars
- **Persistent Storage**: MongoDB with automatic updates

### Birthday system ✅
- **Birthday Storage**: Set birthdays with `/birthday set <day> <month>`
- **Auto-Announcements**: Daily cron job at 9:00 AM via node-cron
- **Channel Priority**: Posts to #anniversaires, #general, or first text channel
- **Birthday Management**: 
  - `/birthday set` - Add/update birthday
  - `/birthday check` - View your or another user's birthday
  - `/birthday remove` - Delete birthday
  - `/birthday list` - View all server birthdays
- **MongoDB Storage**: Per-guild birthday tracking

### AI chat features ✅
- **Single Prompts**: `/mistral` for one-off AI interactions (5s cooldown)
- **Conversations**: `/conversation` creates 15-minute threaded AI chat sessions
- **Voice Transcription**: `/listen start/stop` for real-time speech-to-text
- **AI Game Analysis**: Mistral-powered insights on League of Legends performance
- **Personality**: "Le Gnome" character with consistent sarcastic but helpful tone

### League of Legends integration ✅
- **Player Stats**: `/lol-stats <player> <tag>` 
  - Summoner info, rank (Solo/Duo, Flex)
  - Top 3 champions by mastery
  - Recent match win/loss record
- **Match History**: `/lol-matches <player> <tag>`
  - Last 5 matches with pagination
  - KDA, champion played, game duration
  - Win/loss indicators
- **Champion Rotation**: `/lol-rotation`
  - Free champions this week
  - Champion images from Data Dragon
- **AI Game Analysis**: `/lol-lastgame <player> <tag>`
  - Detailed stats (KDA, CS, damage, vision)
  - Mistral AI performance analysis
  - Recommendations for improvement
- **Multi-region Support**: Works with all Riot servers via Riot ID

## 🎵 Music & audio features

### Music bot ✅

Multi-platform music player with advanced queue management via `play-dl` library

**Implemented Commands:**
- ✅ `/play <query>` - Play from YouTube/SoundCloud URL or search query
- ✅ `/playlist <url>` - Add entire playlists (YouTube/SoundCloud)
- ✅ `/pause` - Pause playback
- ✅ `/resume` - Resume playback
- ✅ `/skip` - Skip to next track
- ✅ `/stop` - Stop music and leave voice channel
- ✅ `/queue` - Display queue with pagination (10 tracks per page)
- ✅ `/nowplaying` - Show current track with embed
- ✅ `/loop` - Toggle repeat mode

**Features:**
- ✅ **YouTube Support**: Direct URLs and search queries
- ✅ **SoundCloud Support**: Track URLs and streaming  
- ✅ **Playlist Support**: Auto-detection and loading for both platforms
- ✅ **Rich Embeds**: Track info with thumbnails, duration, requester
- ✅ **Queue Management**: Persistent per-guild queues via musicService
- ✅ **Auto-play**: Automatically plays next track in queue
- ✅ **Permission Checks**: Validates voice channel access
- 🚧 **Volume Control**: *(Discord.js API limitation - not yet supported)*

**Architecture:**
- `musicService.ts` - Centralized music queue and player management
- `@discordjs/voice` - Voice connection and audio player
- `play-dl` - YouTube and SoundCloud streaming

## 🎰 Casino Discord Activity - implementation status

> **✅ 85% IMPLEMENTED** - Backend and frontend core features complete, final polish in progress

### What's implemented ✅

#### Backend (100% complete)
- **Express.js API Server** with 18 REST endpoints
- **WebSocket Real-time** with Socket.io (15+ events)
- **RPG System Integration**:
  - 6 character classes (Warrior, Mage, Rogue, Merchant, Bard, Paladin)
  - Character creation, stats, and progression
  - Energy system with class-specific regeneration
  - Reputation tiers (7 levels) with perks
  - 12 character abilities with cooldown tracking
- **Game Engines**:
  - BlackjackEngine with multiplayer support (2-6 players)
  - RouletteEngine with 30s betting rounds
  - SlotsEngine with progressive jackpots
  - DiceEngine with prediction betting
- **Table Management**:
  - RouletteTableManager for shared betting rounds
  - BlackjackTableManager for turn-based multiplayer
  - Automatic cleanup after 30min inactivity
- **Testing**: 238 tests (99.6% pass rate)

#### Frontend (85% complete)
- **React 18 + TypeScript** with Vite build system
- **Discord SDK Integration** for Activities authentication
- **12 Implemented Components**:
  - `CharacterCreation.tsx` - 6 class selection with stats
  - `CharacterProfile.tsx` - User profile display
  - `CasinoLobby.tsx` - Main lobby with table selection
  - `VoiceParticipants.tsx` - Discord voice participants
  - `games/BlackjackTable.tsx` - Multiplayer blackjack interface
  - `games/RouletteWheel.tsx` - European roulette UI
  - `games/SlotMachine.tsx` - Slot machine with animations
  - `games/DiceGame.tsx` - Dice rolling game
  - `games/blackjack/GameControls.tsx` - Hit/Stand/Double actions
  - `games/blackjack/BettingControls.tsx` - Betting interface
  - `games/blackjack/DealerSection.tsx` - Dealer cards display
  - `games/blackjack/PlayerSeat.tsx` - Player position component
- **Services**:
  - `api.ts` - REST API client with Axios
  - `websocket.ts` - Socket.io real-time connection
  - `discordSdk.ts` - Discord Activity SDK wrapper
- **Hooks**: `useDiscordSdk.ts` for Activity authentication
- **Utilities**: `cardUtils.ts` for card display logic
- **Styling**: Tailwind CSS v4 with PostCSS

### What's left (15%) ⏳

1. **3D Tavern Environment** 
   - Three.js integration for immersive lobby
   - Animated character models walking to tables
   - Interactive table selection with zoom effects
   
2. **Advanced Animations**
   - Card dealing animations for Blackjack
   - Roulette wheel spinning physics
   - Slot machine reel spinning effects
   - Coin rain for big wins

3. **Testing Suite**
   - Vitest + React Testing Library setup
   - Component unit tests
   - Integration tests for game flows
   - E2E tests with Playwright

4. **Performance Optimizations**
   - Code splitting for game components
   - Image optimization and lazy loading
   - WebSocket connection pooling
   - Memory leak prevention

5. **Mobile Responsiveness**
   - Tablet-optimized layouts
   - Touch gesture support
   - Reduced animations for performance

### Soundboard 🔮
Custom sound effects triggered by commands
- Upload custom sounds (`.mp3`, `.wav`, `.ogg`)
- Categorize sounds (memes, effects, quotes)
- `/soundboard play <name>` command
- Random sound command
- Per-user favorites list
- **Tech**: Store audio files locally or cloud storage, use `@discordjs/voice`

### Voice Effects 🔮
Real-time voice modulation
- Pitch shift, echo, robot voice, reverb
- Apply effects to user's live voice
- Custom effect presets
- Toggle effects on/off mid-conversation
- **Challenge**: Requires audio DSP processing (complex)

### Ambient Sound Generator 🔮
Background sounds for study/work sessions
- Looping tracks: rain, cafe, nature, white noise
- Mix multiple ambient tracks
- Volume control per track
- Timed sessions (auto-stop after X minutes)
- **Tech**: Pre-recorded audio loops, overlay multiple streams

## 🎮 Gaming enhancements

### Multi-game stats 🔥 MEDIUM PRIORITY
Extend beyond LoL using Riot Games API (Valorant, TFT) and other APIs
- **Valorant Stats**: Rank, agents played, recent matches via Riot API
- **TFT Stats**: LP, traits, comps via Riot API
- **Steam Integration**: CS2, Dota 2 stats via Steam Web API
- Unified `/gaming-profile <user>` command
- Cross-game leaderboards for server
- Game-specific embeds with icons
- **Effort**: MEDIUM - reuse existing Riot API patterns

### Tournament organizer 🔥 MEDIUM PRIORITY
Bracket generation, team randomizer, match scheduling
- `/tournament create <name> <size>` - Create tournament
- Single/double elimination brackets
- `/tournament teams` - Random team generation
- `/tournament match <id> <winner>` - Record results
- Bracket visualization (ASCII or image)
- Tournament leaderboards
- Prize tracking (coins integration)
- **Effort**: MEDIUM - mostly bot logic, no external APIs

### Gaming sessions tracker 🔮
Automatic playtime tracking via Discord presence
- Auto-detect when users are gaming (via Rich Presence)
- Track hours per game per user
- `/gaming-stats` - Personal gaming stats
- Weekly/monthly server reports
- "Most played game" badge
- Server-wide gaming trends graphs
- **Tech**: Discord presence detection + MongoDB storage
- **Effort**: MEDIUM

### Game night scheduler 🔮
Organize gaming sessions with polls
- `/gamenight create <game> <date> <time>` 
- Availability polls with reactions
- Auto-create Discord scheduled events
- Reminders (1 hour before, 15 min before)
- Participant list management
- Recurring game nights
- **Effort**: LOW - uses Discord events API

### Steam integration 🔮
Link Steam accounts for richer profiles
- `/steam link <steam-id>` - Connect account
- Display Steam level, badges, owned games
- Recently played games
- Achievement tracking
- Game library comparison with friends
- **Tech**: Steam Web API
- **Effort**: MEDIUM

## 🤖 AI/Mistral upgrades

### Voice conversation mode 🔥 HIGH PRIORITY
Combine existing `listen.ts` + `conversation.ts` for voice-to-voice AI chat
- **Input**: Whisper speech-to-text (already implemented)
- **Processing**: Mistral AI response generation (already implemented)
- **Output**: Text-to-speech via OpenAI TTS API or ElevenLabs
- Natural conversation flow without typing
- Support for multiple concurrent voice conversations
- **Implementation**: Extend listen.ts to auto-send to Mistral and speak response
- **Effort**: MEDIUM - leverages existing infrastructure

### Image generation 🔮
Integrate Stable Diffusion, DALL-E, or Flux
- `/imagine <prompt>` command
- Generate images from text prompts
- Style presets (anime, realistic, artistic, pixel art)
- Image variations and refinements
- Upscaling/enhancement
- **Tech**: OpenAI DALL-E API, Replicate API, or self-hosted Stable Diffusion
- **Effort**: MEDIUM

### Code helper 🔮
Mistral-powered code review and debugging
- `/code-review` - Analyze code snippets in messages
- Thread-based debugging sessions
- Bug detection and explanations
- Optimization suggestions
- Documentation generation
- Language detection (Python, JS, Java, etc.)
- **Effort**: LOW - uses existing Mistral integration

### Personalized AI profiles 🔮
Persistent conversation memory per user
- MongoDB storage of user conversation history
- Remember user preferences (coding language, interests, etc.)
- Context awareness across conversations
- `/ai-profile set <preference>` command
- Custom AI personality per user (tone, formality)
- Privacy controls (opt-in/opt-out)
- **Effort**: MEDIUM - requires database schema + prompt engineering

### AI meme generator 🔮
Generate memes with AI
- `/meme <top-text> <bottom-text>` - Classic meme format
- `/ai-meme <description>` - AI generates meme from description
- Popular meme templates library
- Custom template support
- Auto-post to designated meme channel
- React with 🔥 to save to favorites
- **Tech**: Image manipulation + AI (Mistral for captions, canvas for rendering)
- **Effort**: MEDIUM

### AI moderation assistant 🔮
Mistral-powered content moderation
- Auto-detect toxic messages
- Sentiment analysis
- Spam detection with context understanding
- Warn/timeout recommendations
- Configurable sensitivity levels
- Moderation logs with AI reasoning
- **Effort**: HIGH - requires fine-tuning and careful implementation

## 🔗 Automation & integration ideas

### Twitch/YouTube alerts 🔮
Notify when streamers go live
- Monitor specific Twitch/YouTube channels
- Custom notification messages with embeds
- Role mentions for stream notifications
- Stream preview with viewer count
- Auto-delete when stream ends
- **Tech**: Twitch API, YouTube Data API, or n8n webhooks
- **Effort**: MEDIUM

### RSS feed bot 🔮
Auto-post news from gaming/tech sites
- Multiple RSS feed sources (Reddit, tech blogs, patch notes)
- Filter by keywords
- Scheduled posting (hourly/daily)
- Category-based channels
- `/rss add <url> <channel>` management
- **Tech**: RSS parser, cron jobs
- **Effort**: LOW

### Server backup 🔮
Daily dumps of important messages/data
- Automated MongoDB backups
- Message archiving (export to JSON)
- Configuration backup (roles, channels)
- Restore functionality
- Scheduled exports to cloud storage
- **Effort**: MEDIUM

### Cross-platform bridge 🔮
Sync messages with Telegram/Slack
- Two-way message sync
- User mapping between platforms
- Attachment forwarding
- Status indicators (online/offline)
- Channel-to-channel mapping
- **Tech**: Telegram Bot API, Slack API
- **Effort**: HIGH - requires maintaining multiple connections

### Webhook system 🔮
Custom webhooks for external integrations
- `/webhook create <name> <url>` - Register webhook
- Trigger webhooks from commands
- Receive webhook data in channels
- Event subscriptions (message sent, user joined, etc.)
- Webhook logs and analytics
- **Tech**: HTTP requests, webhook management
- **Effort**: LOW

### GitHub integration 🔮
Connect GitHub repos to Discord
- Commit notifications
- PR status updates
- Issue creation from Discord
- Code review discussions in threads
- Deploy notifications
- **Tech**: GitHub API, webhooks
- **Effort**: MEDIUM

### Discord Activity integration 🔥 HIGH PRIORITY
**Migrate casino to Discord activity as part of the RPG world system**

> 🎯 **BACKEND STATUS: ✅ COMPLETE** - API REST + WebSocket fully implemented and production-ready

**Current Casino System:**
- ✅ **Backend**: Express.js + Socket.io multiplayer casino server (COMPLETE)
- ✅ **RPG System**: 6 character classes with casino bonuses (COMPLETE)
- ✅ **Game Engines**: Multiplayer blackjack, roulette, slots (COMPLETE)
- ✅ **WebSocket**: 15+ real-time events for table management (COMPLETE)
- ⏳ **Frontend**: Discord Activity UI (PLANNED)
- ⏳ **Bot Integration**: `/casino` command to launch Activity (PLANNED)

**What's Complete:**

**Backend Infrastructure** (`/backend/src/`) :
- ✅ Express.js REST API with 10 casino endpoints
- ✅ Socket.io WebSocket handlers (15+ events)
- ✅ JWT authentication middleware
- ✅ MongoDB integration with Mongoose schemas
- ✅ RouletteTableManager with 30s betting timer system
- ✅ BlackjackTableManager for 2-6 player tables
- ✅ Character bonus integration in all game engines
- ✅ Bard table-wide "Lucky Song" buff system

**Game Implementations:**
- ✅ `RouletteEngine.executeMultiplayerSpin()` - Simultaneous payout calculation for all players
- ✅ `BlackjackEngine.dealInitialCards()` - 6-deck shoe for multiplayer tables
- ✅ `BlackjackEngine.playDealerTurnMultiplayer()` - Automated dealer with class-based payouts
- ✅ `SlotsEngine.spinSlots()` - RNG with progressive jackpots per character class
- ✅ `DiceEngine.rollDice()` - Dice game with character luck bonuses

**WebSocket Events** (Real-time Communication):
```javascript
// ✅ IMPLEMENTED - Roulette
'roulette:join_table'         // Join multiplayer table
'roulette:place_bet'          // Place bet during 30s timer
'betting:timer_update'        // Countdown broadcast
'spin:result'                 // Spin result with all winners
'player:left_table'           // Player disconnect handling

// ✅ IMPLEMENTED - Blackjack  
'blackjack:join_table'        // Join 2-6 player table
'blackjack:action'            // Hit/Stand/Double actions
'game:card_dealt'             // Real-time card distribution
'game:round_complete'         // All payouts with class bonuses
'table:cleanup'               // Auto-cleanup after 30min

// ✅ IMPLEMENTED - Bard Abilities
'bard:trigger_lucky_song'     // Table-wide luck boost
'buff:applied'                // Buff notification to all players
```

**REST API Endpoints** (`/api/casino/`) :
```bash
# ✅ IMPLEMENTED - Table Management
POST   /tables/roulette/create      # Create multiplayer roulette table
POST   /tables/blackjack/create     # Create blackjack table (2-6 players)
GET    /tables/:game                # List active tables
GET    /tables/:game/:tableId       # Get table state
DELETE /tables/:game/:tableId       # Close table
POST   /tables/:game/:tableId/start # Start game round
POST   /tables/cleanup              # Auto-cleanup inactive tables

# ✅ IMPLEMENTED - Legacy Solo Games
POST   /spin-slots                  # Solo slot machine
POST   /roll-dice                   # Dice game
```

**Target: RPG-Integrated Multiplayer Casino Activity**

**🏰 RPG Casino Lore Integration:**
The casino becomes "**The Golden Gnome Tavern**" - a central hub in the RPG world where adventurers gather to gamble, socialize, and take on special casino-related quests. NPCs run the games, and your character's RPG stats directly affect gambling performance.

**What's Remaining (Frontend Phase):**


**What's Remaining (Frontend Phase):**

**Architecture Overview (Frontend to be built):**
```
frontend/                 # React + Discord SDK (TO BE BUILT)
├── src/components/
│   ├── CasinoLobby.tsx   # Main lobby with table selection
│   ├── BlackjackTable.tsx # 2-6 player tables vs dealer
│   ├── RouletteWheel.tsx  # Shared wheel, all players bet on same spin
│   ├── SlotZone.tsx       # Individual machines + progressive jackpots
│   └── SpectatorMode.tsx  # Watch others play
├── services/
│   ├── websocket.ts       # Socket.io client (connect to existing backend)
│   └── discordAuth.ts     # Discord SDK integration
└── utils/gameLogic.ts     # Client-side validation

✅ BACKEND READY (already implemented in /backend/src/):
├── routes/casino.ts       # 10 REST endpoints operational
├── engines/               # All game logic complete
│   ├── BlackjackEngine.ts  # Multiplayer methods implemented
│   ├── RouletteEngine.ts   # executeMultiplayerSpin() ready
│   └── SlotsEngine.ts      # RNG + jackpot system working
├── managers/              # Table lifecycle management
│   ├── RouletteTableManager.ts  # 30s timer system operational
│   └── BlackjackTableManager.ts # 2-6 player logic ready
├── models/                # Database schemas defined
│   ├── GameTable.ts       # Table state interfaces
│   └── PlayerSession.ts   # User session tracking
└── websocket/socketHandlers.ts  # 15+ events implemented
```

**🎭 Character Class Casino Benefits (✅ All Implemented):**

1. **🗡️ Warrior** (+5 luck, comeback mechanics)
   - **Casino Perks**: ✅ Battle Rage (+15% chance after loss)
   - **Multiplayer**: ✅ Bonus applied to all table games
   
2. **🔮 Mage** (+10 luck, vision abilities)  
   - **Casino Perks**: ✅ Arcane Insight (reduced house edge)
   - **Multiplayer**: ✅ Works in blackjack and roulette

3. **🥷 Rogue** (+15 luck, risk/reward)
   - **Casino Perks**: ✅ Sleight of Hand (loss mitigation)
   - **Multiplayer**: ✅ Highest luck bonus in all games

4. **💰 Merchant** (+8 luck, profit optimization)
   - **Casino Perks**: ✅ Coin Sense (+25% payouts)
   - **Multiplayer**: ✅ Best for consistent small wins

5. **🎵 Bard** (+12 luck, group buffs)
   - **Casino Perks**: ✅ Lucky Song (table-wide +10% luck boost)
   - **Multiplayer**: ✅ Can buff ALL players at roulette/blackjack tables
   - **Special**: ✅ Most valuable in multiplayer settings

6. **⚔️ Paladin** (+10 luck, protection)
   - **Casino Perks**: ✅ Divine Blessing (loss reduction)
   - **Multiplayer**: ✅ Steady performance across all games

> 📚 **Full RPG Documentation**: See `docs/RPG_SYSTEM.md` for complete class mechanics

**🎲 RPG Casino Features (Backend Implementation Status):**

**1. 🃏 Blackjack Tavern Tables** - ✅ Backend Complete
- ✅ **Table Manager**: RouletteTableManager handles 2-6 player tables
- ✅ **Dealer Logic**: Automated dealer with standard rules (hit until 17)
- ✅ **Actions**: Hit, Stand, Double Down all implemented
- ✅ **Payouts**: Class bonuses applied to final winnings
- ⏳ **UI**: Character avatars, tavern atmosphere (frontend pending)

**2. 🎰 Enchanted Slot Machines** - ✅ Backend Complete
- ✅ **RNG System**: Secure weighted random symbol selection
- ✅ **Jackpots**: Progressive jackpots tracked per character class
- ✅ **Luck Integration**: Character luck stat affects outcomes
- ⏳ **UI**: Magical arcane device animations (frontend pending)

**3. 🎲 Roulette of Fate** - ✅ Backend Complete
- ✅ **Table Manager**: 30-second betting timer with broadcast
- ✅ **Multiplayer Spin**: All players bet on same wheel outcome
- ✅ **Bet Types**: Straight, split, street, corner, line, dozens, columns
- ✅ **Bard Buff**: Lucky Song can boost entire table
- ⏳ **UI**: Fortune Teller NPC, dramatic spin animation (frontend pending)

**4. 🎪 Tournament Arena** - ⏳ Future Feature
- ⏳ Scheduled poker tournaments with entry fees
- ⏳ Class-specific championships
- ⏳ Guild vs Guild casino competitions

**👥 Planned Social Features (Frontend):**
- ⏳ Live chat during games
- ⏳ Emote reactions to big wins/losses  
- ⏳ Player avatars and Discord profiles
- ⏳ Recent wins feed in lobby
- ⏳ Tip other players with coins
- ⏳ "Big Win" celebrations visible to everyone
- ⏳ Slot tournaments: "Most won in 5 minutes"
- ⏳ Spectator mode with cheering

**Economy Integration (✅ Backend Ready):**
- ✅ Reuses existing MongoDB `User` schema for coins
- ✅ Real-time balance updates with transaction locking
- ✅ Minimum bet validation server-side
- ⏳ Big win notifications to Discord chat (bot integration pending)
- ⏳ Daily/weekly casino leaderboards (frontend pending)

**Technical Implementation (✅ Backend Complete):**

```typescript
// ✅ IMPLEMENTED - Backend State Management
interface CasinoState {
  rouletteTables: Map<string, RouletteTable>;      // ✅ Managed by RouletteTableManager
  blackjackTables: Map<string, BlackjackTable>;    // ✅ Managed by BlackjackTableManager
  activeSessions: Map<string, CasinoSession>;      // ✅ In MongoDB
}

// ✅ IMPLEMENTED - WebSocket Events (15+ handlers active)
socket.on('table:player_joined', (data) => {...})        // ✅ Operational
socket.on('betting:timer_update', (countdown) => {...})  // ✅ 30s countdown
socket.on('spin:result', (result) => {...})              // ✅ Roulette outcomes
socket.on('game:card_dealt', (card) => {...})            // ✅ Blackjack cards
socket.on('buff:applied', (buff) => {...})               // ✅ Bard buffs

// ✅ IMPLEMENTED - Economy Service
class EconomyService {
  async validateBet(userId, amount): Promise<boolean>    // ✅ Working
  async processPayout(userId, winAmount): Promise<void>  // ✅ Working
  async updateUserBalance(userId, delta): Promise<void>  // ✅ With locking
}
```

**New Bot Command (To Be Implemented):**
```typescript
// ⏳ PLANNED - commands/casino.ts (replaces individual casino commands)
export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('🎰 Accéder au Casino Multijoueur Le Gnome'),
    
  async execute(interaction: CommandInteraction) {
    // Launch Discord Activity connected to existing backend
  }
};
```

**Development Status Update:**

**✅ COMPLETED PHASES:**

**Phase 1: Infrastructure** - ✅ COMPLETE
- ✅ Express.js server with Socket.io fully operational
- ✅ MongoDB connection established and tested
- ✅ JWT authentication middleware implemented
- ✅ 10 REST API endpoints functional

**Phase 2: RPG System** - ✅ COMPLETE
- ✅ 6 character classes with complete stat systems
- ✅ Energy/reputation/ability services operational
- ✅ Character bonus integration in all game engines
- ✅ Bard table-wide buff system working

**Phase 3: Roulette Multiplayer** - ✅ COMPLETE
- ✅ RouletteTableManager with 30s betting timer
- ✅ Shared betting rounds with real-time broadcasts
- ✅ executeMultiplayerSpin() with simultaneous payouts
- ✅ Bet history tracking (50 results per table)

**Phase 4: Blackjack Multiplayer** - ✅ COMPLETE
- ✅ BlackjackTableManager for 2-6 player tables
- ✅ Turn-based game logic with action queue
- ✅ Automated dealer with standard rules
- ✅ Class-based payout calculations
- ✅ Spectator support in table state

**⏳ REMAINING PHASES:**

**Phase 5: Frontend Discord Activity** - ⏳ NOT STARTED
- ⏳ React app with Discord SDK integration
- ⏳ Socket.io client connecting to existing backend
- ⏳ 3D tavern lobby interface
- ⏳ Game table UI components (blackjack, roulette, slots)
- ⏳ Mobile Discord client optimization

**Phase 6: Bot Integration** - ⏳ NOT STARTED
- ⏳ `/casino` command to launch Activity
- ⏳ Big win announcements in Discord chat
- ⏳ Casino leaderboards via bot commands
- ⏳ Migrate `/slots`, `/blackjack`, `/roulette` to Activity

**Benefits vs Current System (Backend Proven):**
**Benefits vs Current System (Backend Proven):**
- ✅ **Technical Foundation**: Robust WebSocket + REST API infrastructure ready
- ✅ **Multiplayer Logic**: Proven table management and game synchronization
- ✅ **RPG Integration**: Character bonuses fully functional in multiplayer context
- ⏳ **Social**: Will transform solo gambling into multiplayer experience (UI pending)
- ⏳ **Engagement**: Real-time interaction will keep players longer (UI pending)
- ⏳ **Immersive**: Rich graphics vs plain text responses (UI pending)
- ✅ **Scalable**: Architecture supports new games easily
- ⏳ **Community**: Shared experiences will build server bonds (UI pending)

**Technical Challenges (Backend Resolved):**
- ✅ Real-time synchronization across players - **SOLVED** (WebSocket handlers operational)
- ✅ Server-side validation preventing cheating - **SOLVED** (All logic server-side)
- ✅ Disconnection handling - **SOLVED** (Auto-cleanup after 30min, session resumption)
- ⏳ Mobile Discord client compatibility - **TESTING NEEDED** (Frontend phase)
- ⏳ WebSocket connection scaling - **MONITORING NEEDED** (Production deployment)

**Success Metrics (Once Frontend Complete):**
- 3x increase in daily casino usage
- Average session length 10+ minutes (vs 30 seconds for commands)
- 50%+ of server members try the activity within first month
- Positive feedback on social gaming aspects

**Next Steps for Frontend Development:**
1. Set up Discord Activity project with Vite + React
2. Integrate Discord SDK for authentication
3. Connect Socket.io client to existing backend
4. Build CasinoLobby component showing active tables
5. Implement RouletteWheel component with 30s timer
6. Build BlackjackTable component for multiplayer games
7. Add character class display and buff indicators
8. Test on mobile Discord clients
9. Deploy Activity and register with Discord Developer Portal
10. Implement `/casino` bot command to launch Activity

> 📁 **Backend Code**: All multiplayer logic in `/backend/src/` - Ready for frontend integration

**Integration with existing systems (Partially Complete):**
- ✅ Seamless coin balance sync with bot commands (MongoDB shared)
- ⏳ Big wins announced in Discord chat (bot integration pending)
- ⏳ Leaderboards accessible via `/leaderboard casino` (pending)
- ⏳ Activity statistics integrated with `/balance` command (pending)
- **Tech**: Discord Activities API, embedded web applications, real-time multiplayer
- **Effort**: MEDIUM (3-4 weeks frontend) - Backend complete, UI development remaining

## 🛠️ Utility features

### Poll system 🔮
Advanced polls with visualization
- `/poll create <question> [options...]` command
- Multiple choice polls (up to 10 options)
- Timed polls with auto-close
- Anonymous voting option
- Results visualization (bar chart in embed)
- Export results to CSV
- **Effort**: LOW

### Reminder/timer bot 🔮
Set reminders and countdowns
- `/remind <time> <message>` - Personal reminders
- `/timer <duration>` - Countdown with live updates
- Recurring reminders (daily, weekly)
- Snooze functionality
- DM or channel notifications
- List active reminders
- **Tech**: setTimeout/setInterval + MongoDB persistence
- **Effort**: LOW

### Welcome system 🔮
Custom welcome messages and auto-role
- Welcome messages with custom embeds
- Auto-assign roles to new members
- Rules acceptance workflow (react to accept)
- Member count milestones announcements
- Welcome DM option
- Configurable via `/welcome setup`
- **Effort**: LOW - uses Discord events

### Starboard 🔮
Pin highly-reacted messages automatically
- Configurable reaction threshold (e.g., 5+ ⭐)
- Dedicated #starboard channel
- Leaderboard of most starred messages
- Emoji-based filtering (⭐, ❤️, 🔥)
- Remove if reactions drop below threshold
- **Effort**: LOW

### Server stats dashboard 🔮
Analytics and visualizations
- Message frequency graphs (daily/weekly)
- Active users tracking (leaderboard)
- Channel activity heatmaps
- Growth statistics (new members over time)
- Voice channel usage stats
- Export data to charts/images
- **Tech**: MongoDB aggregation + chart library (Chart.js, quickchart.io)
- **Effort**: MEDIUM

### Auto-moderation 🔮
Automated server moderation
- Spam detection (duplicate messages, caps)
- Link filtering (whitelist/blacklist)
- Bad word filter with custom list
- Raid protection (mass join detection)
- Auto-timeout escalation system
- Moderation logs channel
- **Effort**: MEDIUM

### Role management 🔮
Advanced role assignment
- `/role request <role>` - Self-assignable roles
- Reaction roles (react to get role)
- Temporary roles with expiration
- Role shop (buy with coins)
- Role color customization
- Role activity requirements
- **Effort**: LOW-MEDIUM

## 🎮 RPG system & cross-user interactions

### Overview 🔥 HIGH PRIORITY
Transform the bot into a full-featured RPG with stats, classes, quests, PvP, guilds, and trading

### Character system 🔥
**Core RPG mechanics integrated with existing level/coin system**

**Character Stats:**
- **Level**: Already implemented (quadratic XP formula)
- **HP (Health Points)**: Base 100 + (VIT × 10), used in PvP/PvE
- **MP (Mana Points)**: Base 50 + (INT × 5), used for spells/abilities
- **Energy**: 100 max, regenerates 10/hour, used for actions (quests, battles, gathering)
- **Stat Points**: Gain 3 points per level to allocate
- **Skill Points**: Gain 1 per level to unlock abilities

**Character Classes** (choose at level 5):
1. **Warrior** - Tank/Damage dealer
   - +20% HP, +15% physical damage
   - Skills: Shield Bash, Berserker Rage, Battle Cry
   - Best for: PvP, tanking, guild wars
   
2. **Mage** - Spellcaster
   - +30% MP, -20% AI feature costs
   - Skills: Fireball, Mana Shield, Arcane Blast
   - Best for: AoE damage, AI interactions, puzzle quests
   
3. **Rogue** - DPS/Luck specialist
   - +25% LCK, +20% critical hit chance
   - Skills: Backstab, Stealth, Lockpicking
   - Best for: Gambling, treasure hunting, stealing
   
4. **Merchant** - Economy specialist
   - +20% coin income, -15% shop prices
   - Skills: Appraise, Trade Master, Gold Rush
   - Best for: Trading, economy, wealth accumulation
   
5. **Bard** - Support/Buffer
   - +15% party XP/coins, music perks
   - Skills: Inspiration, Song of Valor, Charm
   - Best for: Group play, music bot features, social
   
6. **Paladin** - Healer/Tank
   - +15% HP, healing abilities
   - Skills: Holy Light, Divine Shield, Resurrect
   - Best for: Support, protection, healing allies

**Commands:**
- `/character` - View full character sheet with stats, class, level
- `/stats allocate <stat> <points>` - Distribute stat points
- `/class choose <class>` - Select class (level 5+ required)
- `/class respec` - Change class for 10,000 coins
- `/skills` - View and unlock class abilities

**Database Schema:**
```typescript
interface Character {
  userId: string;
  guildId: string;
  class: 'warrior' | 'mage' | 'rogue' | 'merchant' | 'bard' | 'paladin' | null;
  stats: {
    strength: number;
    intelligence: number;
    luck: number;
    charisma: number;
    vitality: number;
    dexterity: number;
  };
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  energy: number;
  maxEnergy: number;
  skills: string[]; // unlocked skill IDs
  equipment: {
    weapon?: string;
    armor?: string;
    accessory?: string;
  };
  inventory: Item[];
}
```

### Quest system 🔥
**Daily quests, story missions, and dynamic challenges**

**Quest Types:**
1. **Daily Quests** (reset every 24h):
   - "Send 10 messages" - Reward: 100 coins, 50 XP
   - "Win 3 gambling games" - Reward: 200 coins, 80 XP
   - "Play music for 30 min" - Reward: 150 coins, 60 XP
   - "Help a guild member" - Reward: 250 coins, 100 XP
   - Generates 3 random daily quests per user
   
2. **Story Quests** (one-time, progressive):
   - Chapter-based narrative quests
   - Unlock new features/areas as story progresses
   - Boss fights at end of chapters
   - Rare rewards (legendary items, titles, pets)
   
3. **Repeatable Quests**:
   - "Defeat 10 monsters" - Reward: 300 coins, random loot
   - "Collect 5 rare herbs" - Reward: crafting materials
   - "Complete 3 voice sessions" - Reward: 200 coins
   
4. **Guild Quests** (collaborative):
   - "Collect 1000 guild coins" - Reward: guild level up
   - "Win 20 PvP battles" - Reward: guild buff
   - Requires multiple members to contribute
   
5. **Event Quests** (limited time):
   - Holiday/seasonal special quests
   - Server anniversary quests
   - High-value rewards

**Quest Mechanics:**
- Auto-tracking via existing message/activity systems
- Quest journal shows progress
- Turn in completed quests for rewards
- Quest chains unlock new quests
- Difficulty scales with level
- Bonus rewards for streak completions

**Commands:**
- `/quest list` - Show available quests
- `/quest active` - View quest progress
- `/quest complete <id>` - Turn in completed quest
- `/quest abandon <id>` - Drop a quest

### PvP (player vs player) battle system 🔥
**Turn-based combat between users**

**Battle Mechanics:**
- **Challenge**: `/duel @user` - Send battle request (costs 10 energy)
- **Turn-Based**: Players take turns choosing actions
- **Actions**: Attack, Defend, Use Skill, Use Item, Flee
- **Damage Formula**: `(ATK × random(0.8-1.2)) - (DEF × 0.5) = damage`
- **Critical Hits**: DEX stat increases crit chance (1.5x damage)
- **Status Effects**: Stun, Burn, Poison, Shield, Regen
- **Victory**: Winner gets coins (10% of loser's current balance, max 1000)
- **Ranking**: ELO-based PvP ranking system

**Battle Actions:**
- **Attack**: Basic damage based on STR
- **Defend**: Reduce incoming damage by 50%, gain shield
- **Skills**: Class-specific abilities (costs MP)
  - Warrior: Shield Bash (stun), Berserker (damage boost)
  - Mage: Fireball (high damage), Mana Shield (barrier)
  - Rogue: Backstab (crit guaranteed), Poison Dagger (DoT)
  - Merchant: Coin Toss (gamble for big damage)
  - Bard: Debuff Song (reduce enemy stats)
  - Paladin: Heal (restore HP), Smite (holy damage)
- **Items**: Potions, scrolls, bombs from inventory
- **Flee**: 50% chance to escape, lose no coins/HP

**PvP Rewards:**
- Winner: 10% of loser's coins (max 1000), +50 PvP rating
- Loser: -50 PvP rating, keep XP from battle
- Both: Gain battle XP based on damage dealt
- Streak bonuses for consecutive wins

**Commands:**
- `/duel @user [wager]` - Challenge to battle (optional coin wager)
- `/duel accept` - Accept pending challenge
- `/duel decline` - Decline challenge
- `/duel rankings` - PvP leaderboard
- `/duel history [@user]` - Battle record

**Anti-Abuse:**
- 10-minute cooldown between duels with same player
- Can't duel users 10+ levels below you for coins
- Maximum wager: 5000 coins
- Energy cost prevents spam

### PvE (player vs environment) system 🔥
**Fight monsters, bosses, and complete dungeons**

**Monster Types:**
- **Common**: Low HP, easy fights, basic loot (10 energy)
- **Rare**: Medium HP, some strategy needed (20 energy)
- **Elite**: High HP, special abilities (30 energy)
- **Boss**: Very high HP, multiple phases (50 energy)
- **Raid Boss**: Guild-wide boss fight (100 energy, requires party)

**Dungeon System:**
- **Dungeons**: 5-10 monster encounters + boss
- **Difficulty Tiers**: Easy, Medium, Hard, Nightmare
- **Loot Tables**: Equipment, coins, crafting materials, cards
- **Daily Dungeon**: Bonus rewards for first clear each day
- **Death Penalty**: Lose 50% HP, can retry with half rewards

**Monster Abilities:**
- Dragons breathe fire (AoE damage)
- Slimes split into smaller slimes
- Undead resurrect once
- Golems have high defense
- Elementals weak to certain damage types

**Commands:**
- `/hunt [monster-type]` - Fight a random monster
- `/dungeon enter <difficulty>` - Start dungeon run
- `/dungeon party create` - Create party for group dungeon
- `/dungeon party invite @user` - Invite to party
- `/boss fight <boss-name>` - Challenge specific boss
- `/bestiary` - View defeated monsters and loot drops

**Loot System:**
- Random item drops based on monster rarity
- Better loot from higher difficulty
- Luck stat improves drop rates
- Rare crafting materials from bosses
- Achievement for defeating all monster types

### Equipment & items 🔥
**Gear system with stats and rarity**

**Equipment Slots:**
- **Weapon**: Increases ATK, some give special abilities
- **Armor**: Increases DEF and HP
- **Accessory**: Various stat bonuses and effects

**Rarity Tiers:**
- **Common** (gray): +5-10 stats
- **Uncommon** (green): +11-20 stats
- **Rare** (blue): +21-35 stats, 1 bonus effect
- **Epic** (purple): +36-50 stats, 2 bonus effects
- **Legendary** (orange): +51-75 stats, 3 bonus effects, unique ability

**Item Types:**
- **Weapons**: Swords, Staves, Daggers, Hammers, Bows, Wands
- **Armor**: Light, Medium, Heavy (class restrictions)
- **Accessories**: Rings, Amulets, Cloaks, Belts
- **Consumables**: Health Potions, Mana Potions, Buff Scrolls, Bombs
- **Materials**: Crafting ingredients, upgrade stones
- **Quest Items**: Special items for quests
- **Collectibles**: Cards, trophies, cosmetics

**Obtaining Items:**
- Drop from monsters/dungeons
- Purchase from shop (1000-50000 coins)
- Craft from materials
- Trade with other players
- Quest rewards
- Event rewards
- Loot boxes

**Item Enhancement:**
- Upgrade items with coins + materials
- Each upgrade level: +5% stats, max +10 levels
- Chance of failure increases with level
- Failed upgrades lose materials but keep item
- Legendary items can't fail but cost more

**Commands:**
- `/inventory` - View all items and equipment
- `/equip <item>` - Equip an item
- `/unequip <slot>` - Remove equipped item
- `/use <item>` - Use consumable item
- `/upgrade <item>` - Enhance item stats
- `/dismantle <item>` - Break down for materials

### Guild system 🔥
**Create or join guilds with members, shared goals, and buffs**

**Guild Features:**
- **Creation**: 5000 coins, requires level 10
- **Max Members**: 20 players (upgradeable to 50)
- **Guild Level**: Shared XP pool, unlocks perks
- **Guild Bank**: Shared coin storage for upgrades
- **Guild Hall**: Virtual space with upgrades (shop, training area, vault)
- **Guild Buffs**: +XP, +coins, +luck for all members
- **Guild Quests**: Collaborative objectives
- **Guild Wars**: Weekly PvP events between guilds

**Guild Ranks:**
- **Master**: Full control, can disband
- **Officer**: Invite/kick, manage bank (up to 3)
- **Elite**: Veteran members with privileges
- **Member**: Standard member
- **Recruit**: New members (7-day trial)

**Guild Activities:**
- **Guild Raids**: Team up to fight massive bosses
- **Territory Control**: Capture and hold areas for bonuses
- **Guild vs Guild**: Scheduled PvP tournaments
- **Guild Shop**: Exclusive items for guild members
- **Guild Achievements**: Unlock rewards as a team

**Guild Upgrades** (using guild bank coins):
- **Guild Hall Level**: Unlock more features (5k, 10k, 25k, 50k)
- **Member Capacity**: +10 slots (10k per upgrade)
- **Bank Size**: Increase coin storage (5k per tier)
- **Guild Buffs**: +5% XP/coins for all (15k per buff level)
- **Training Grounds**: Faster skill cooldowns (20k)
- **Vault**: Extra storage for items (12k)

**Commands:**
- `/guild create <name>` - Create guild (5000 coins)
- `/guild invite @user` - Invite player
- `/guild join <guild>` - Join guild (if invited)
- `/guild leave` - Leave current guild
- `/guild info [@guild]` - View guild details
- `/guild members` - List all members
- `/guild bank deposit <amount>` - Add coins to guild bank
- `/guild bank withdraw <amount>` - Take coins (officers only)
- `/guild upgrade <feature>` - Upgrade guild
- `/guild quests` - View guild quests
- `/guild leaderboard` - Top guilds by level/members

**Guild Wars:**
- Weekly tournaments between guilds
- Points for PvP wins, quest completions, boss kills
- Top 3 guilds get massive rewards
- Guild vs Guild direct battles (5v5)
- Leaderboard with seasonal rewards

### Trading & economy 🔥
**Player-to-player marketplace and trading**

**Direct Trading:**
- `/trade @user` - Initiate trade window
- Both players add items/coins
- Must both confirm to complete
- Trade history logged in database
- Anti-scam protections (confirm twice)

**Auction House:**
- `/auction create <item> <starting-bid> <duration>` - List item
- `/auction list [category]` - Browse active auctions
- `/auction bid <id> <amount>` - Place bid
- `/auction buyout <id>` - Instant purchase (if buyout set)
- `/auction history` - Your auction history
- Auction fees: 5% of final sale
- Duration: 6h, 12h, 24h, 3d, 7d

**Player Shops:**
- `/shop set <item> <price>` - List item in your shop
- `/shop browse @user` - View user's shop
- `/shop buy @user <item>` - Purchase from player
- Passive income while offline
- Max 10 listings per player (upgradeable)

**Economy Features:**
- Price history and trends
- Most traded items leaderboard
- Merchant class gets bonuses
- Trade reputation system
- Recommended prices based on rarity
- Global market trends

### Crafting system 🔮
**Create items from materials**

**Crafting Professions:**
- **Blacksmith**: Craft weapons and armor
- **Alchemist**: Create potions and elixirs
- **Enchanter**: Add magical effects to items
- **Jeweler**: Craft accessories and gems
- **Cook**: Make food buffs

**Crafting Mechanics:**
- Learn recipes from quests, drops, or purchase
- Gather materials from dungeons, gathering, dismantling
- Success chance based on INT stat
- Higher quality materials = better results
- Can craft for profit (sell on auction house)

**Gathering:**
- `/gather herbs` - Collect alchemy materials (15 energy)
- `/gather ore` - Mine for blacksmithing (15 energy)
- `/gather wood` - Lumber for crafting (15 energy)
- Random rare materials with LCK stat

### Party system 🔮
**Team up with friends for group content**

**Party Features:**
- `/party create` - Form a party (max 5 players)
- `/party invite @user` - Invite to party
- `/party kick @user` - Remove member (leader only)
- `/party leave` - Leave party
- Shared XP (split evenly)
- Shared loot (round-robin or leader decides)
- Party chat (separate from guild)
- Party buffs stack with individual buffs

**Party Bonuses:**
- +10% XP per party member
- +15% coin drops in dungeons
- Bard class gives extra party buffs
- Unlock party-only dungeons
- Combo attacks (coordinated abilities)

**Raid Parties:**
- Expanded to 10-20 players
- Required for raid bosses
- Complex mechanics requiring coordination
- Best loot in game
- Weekly lockouts on raids

### World events & dynamic content 🔮
**Server-wide events and limited-time challenges**

**Event Types:**
- **World Boss**: Massive boss spawns, everyone can attack
  - HP scales with participants
  - Loot for all contributors
  - Spawns every 6 hours
  
- **Treasure Hunt**: Hidden treasures spawn in channels
  - First to find gets reward
  - Clues posted every hour
  
- **Double XP Weekends**: 2x XP for all activities
  
- **Guild Wars Season**: Month-long competition
  
- **Invasion**: Monster waves attack server
  - Defend for rewards
  - Difficulty increases each wave
  
- **Seasonal Events**: Halloween, Christmas, Summer themed

**Dynamic Difficulty:**
- Content scales with average server level
- Difficulty adjusts based on participation
- Better rewards for higher difficulty

### Achievements & titles 🔮
**Expanded achievement system with prestigious titles**

**Achievement Categories:**
- **Combat**: "Defeat 1000 monsters", "Win 100 PvP battles"
- **Social**: "Join a guild", "Trade with 50 players"
- **Economy**: "Earn 1,000,000 coins", "Own 10 legendary items"
- **Quests**: "Complete 100 quests", "Finish story mode"
- **Collection**: "Collect all card types", "Own every pet"
- **Gambling**: "Win 10 blackjack hands in a row"
- **Music**: "Play 100 songs", "Create 10 playlists"

**Titles (earned from achievements):**
- "The Wealthy" - Own 100,000 coins
- "Dragon Slayer" - Defeat legendary dragon boss
- "Grand Champion" - Top PvP rating
- "Master Craftsman" - Max crafting profession
- "Guild Master" - Lead a level 10 guild
- Titles shown in `/character` and before name

**Title Benefits:**
- Some titles give stat bonuses
- Cosmetic prestige
- Unlock exclusive quests
- Rare titles tradeable for huge coins

### Mobile-friendly features 🔮
**Idle/clicker mechanics for passive play**

**Idle Systems:**
- Auto-battle: Set party to auto-farm while offline (premium)
- Passive gathering: Collect materials over time
- Offline XP: Gain reduced XP while inactive
- Daily login rewards: Increasing rewards for consecutive days
- Quick actions: Buttons for common commands

**Energy System:**
- Prevents spam while allowing regular play
- Regenerates over time
- Can purchase energy refills with coins
- Premium players get faster regen

## 🎲 Fun & social

### Mini-games 🔮
Interactive games in threads
- **Trivia**: `/trivia [category]` with multiple categories (gaming, history, science)
- **Hangman**: `/hangman` - Classic word guessing
- **Word Chain**: Users continue word chain in thread
- **Reaction Games**: First to react wins
- **Higher or Lower**: Guess if next number is higher/lower
- Leaderboards for each game
- Coin rewards for winners
- **Effort**: LOW-MEDIUM per game

### Virtual shop 🔥 HIGH PRIORITY
Complete the economy system (coins already implemented)
- `/shop` - Browse items
- `/buy <item>` - Purchase with coins
- **Shop Items**:
  - Custom roles (color, name)
  - Temporary role perks (XP boost, double coins)
  - Cosmetic name tags
  - Profile customization
- **Admin Commands**: `/shop add`, `/shop remove`, `/shop edit`
- **Effort**: LOW - extends existing economy system

## 💰 Coin value & spending ideas

### AI image generation (pay-per-use) 🔥 HIGH PRIORITY
Give coins real utility through AI-powered services
- **Command**: `/imagine <prompt>` - Generate AI images for coins
- **Pricing Tiers**:
  - Standard quality: 100 coins
  - HD quality: 250 coins
  - Ultra HD with upscaling: 500 coins
  - Bulk pack (5 images): 400 coins (20% discount)
- **Features**:
  - Style presets (anime, realistic, fantasy, pixel art, cyberpunk)
  - Negative prompts for refinement
  - Aspect ratio selection (square, portrait, landscape)
  - Seed saving for reproducible results
  - Image variations (remix previous generation for 50 coins)
- **API Options**: 
  - OpenAI DALL-E 3 (high quality, easy integration)
  - Stability AI (Stable Diffusion, cost-effective)
  - Replicate (multiple models, flexible pricing)
  - Flux (newest, high quality)
- **Monetization**: Set coin prices to cover API costs + create coin sink
- **Storage**: Save generated images to Discord channel or cloud storage
- **Effort**: MEDIUM - API integration + payment validation

### Collectible card system (NFT-style) 🔥 HIGH PRIORITY
Digital collectibles with rarity tiers and trading
- **Card Types**:
  - **Character Cards**: Gaming characters, memes, community members
  - **Achievement Cards**: Rare cards for accomplishments
  - **Event Cards**: Limited edition seasonal/event cards
  - **Legendary Cards**: Ultra-rare with special effects/perks
- **Rarity System**:
  - Common (70%): 50 coins per pack
  - Rare (20%): Found in packs or 200 coins direct buy
  - Epic (8%): Found in packs or 800 coins direct buy
  - Legendary (2%): Found in premium packs or special events
- **Commands**:
  - `/cards buy <pack-type>` - Buy card packs (standard: 100 coins, premium: 500 coins)
  - `/cards collection [@user]` - View owned cards with gallery
  - `/cards trade <user> <your-card> <their-card>` - Trading system
  - `/cards sell <card>` - Sell duplicates back for 50% value
  - `/cards info <card>` - View card stats, rarity, edition number
  - `/cards leaderboard` - Top collectors by rarity/total cards
- **Special Features**:
  - Limited edition cards (only 100 minted)
  - Animated cards (GIFs) for legendary tier
  - Card fusion (combine 3 rares → 1 epic)
  - Profile showcase (display favorite cards on `/rank`)
  - Collection milestones (rewards for completing sets)
- **Database**: MongoDB storage with card ownership tracking
- **Effort**: MEDIUM - requires card database, image assets, trading logic

### Profile customization shop 🔮
Personalize user profiles with premium features
- **Purchasable Items**:
  - **Custom Rank Card Backgrounds**: 500-2000 coins (themes: gaming, anime, nature, abstract)
  - **Animated Backgrounds**: 3000 coins (GIFs/videos behind rank card)
  - **Custom Progress Bar Colors**: 200 coins (RGB color picker)
  - **Profile Badges**: 300-1500 coins (icons displayed on rank card)
  - **Name Effects**: 1000 coins (gradient text, glow effects, shadows)
  - **Profile Frames**: 800 coins (decorative borders around rank card)
  - **Custom Bio**: 500 coins (add personal description to profile)
- **Command**: `/customize <item>` - Browse and purchase customizations
- **Preview System**: See changes before buying
- **Effort**: MEDIUM - requires image generation/manipulation

### Server perks & boosts 🔮
Temporary power-ups and conveniences
- **XP Boosters**:
  - 2x XP for 1 hour: 500 coins
  - 2x XP for 24 hours: 3000 coins
  - 3x XP for 1 hour: 1000 coins (rare boost)
- **Coin Boosters**:
  - 2x daily reward for 1 week: 2000 coins
  - +50 coins per message for 1 hour: 1500 coins
- **Gambling Perks**:
  - Blackjack insurance (house edge reduction): 300 coins/game
  - Slots lucky spin (better odds): 400 coins/spin
  - Roulette hot streak (consecutive win bonus): 600 coins
- **Music Perks**:
  - Queue priority: 200 coins (next song plays immediately)
  - Skip cooldown bypass: 100 coins
  - Playlist auto-DJ for 1 hour: 800 coins
- **Voice Perks**:
  - Priority speaker (reduce others' volume): 500 coins/hour
  - Custom soundboard sounds: 1000 coins (upload your own)
  - AI voice clone (TTS in your voice): 5000 coins
- **Social Perks**:
  - Broadcast message to all users: 2000 coins
  - Pin message privilege (bypass limit): 500 coins/pin
  - Slowmode immunity for 24 hours: 1500 coins
- **Effort**: LOW-HIGH depending on perk complexity

### Premium AI features 🔮
Advanced AI capabilities for coin users
- **Extended AI Conversations**:
  - Standard: 15 minutes free
  - Extended: 1 hour for 200 coins
  - All-day: 24 hours for 1000 coins
- **AI Voice Chat**:
  - 5 minutes: 300 coins
  - 30 minutes: 1200 coins
  - Unlimited daily: 5000 coins
- **AI Code Review**:
  - Single file review: 150 coins
  - Full project review: 1000 coins
  - Optimization suggestions: 500 coins
- **AI Content Creation**:
  - Story generation (500 words): 200 coins
  - Poetry/lyrics: 150 coins
  - Social media captions: 100 coins
  - Email/message drafting: 120 coins
- **Custom AI Personality**:
  - Save personalized AI behavior: 800 coins one-time
  - Multiple personalities: 2000 coins
- **Effort**: LOW - extends existing Mistral integration

### Virtual pets/companions 🔮
Tamagotchi-style pets that need care
- **Adoption**: 1000 coins to adopt a virtual pet
- **Pet Types**: Dog, cat, dragon, robot, slime, phoenix (each with unique traits)
- **Care System**:
  - Feed pet: 50 coins (required every 24 hours or pet gets sad)
  - Play with pet: 30 coins (increases happiness)
  - Train pet: 100 coins (unlock abilities)
  - Groom pet: 80 coins (cosmetic)
- **Pet Leveling**: Pets gain XP and level up with care
- **Pet Abilities**:
  - Daily coin bonus (level 5+): +20 coins/day
  - XP bonus (level 10+): +5% message XP
  - Gambling luck (level 15+): Slight odds improvement
- **Pet Customization**:
  - Accessories: 200-800 coins (hats, collars, wings)
  - Color changes: 500 coins
  - Name changes: 300 coins
- **Trading**: Trade pets with other users
- **Commands**: `/pet adopt`, `/pet feed`, `/pet play`, `/pet status`, `/pet customize`
- **Effort**: HIGH - complex state management

### Loot boxes & mystery items 🔮
Gacha-style random rewards
- **Box Types**:
  - Common Box: 200 coins (guaranteed common items + small chance at rare)
  - Rare Box: 800 coins (guaranteed rare items + chance at epic)
  - Legendary Box: 3000 coins (guaranteed epic + chance at legendary)
  - Event Box: 1500 coins (seasonal/limited items)
- **Possible Contents**:
  - Coins (50-5000 bonus coins)
  - Collectible cards
  - Profile customizations
  - Temporary boosts
  - Exclusive roles (rare)
  - Achievement unlocks
  - Pet accessories
- **Pity System**: Guaranteed legendary every 50 boxes
- **Box Opening Animation**: Suspenseful reveal in Discord
- **Commands**: `/lootbox buy <type>`, `/lootbox open`, `/lootbox inventory`
- **Effort**: MEDIUM

### Server feature unlocks 🔮
Community goals funded by coins
- **Channel Creation**: Pool 10,000 coins to create custom channel
- **Custom Emojis**: 5,000 coins to add server emoji (voted by users)
- **Server Events**: Fund tournaments (prize pools) or game nights
- **Bot Upgrades**: Crowdfund new bot features (e.g., 50k coins = new game integration)
- **Charity Donations**: Convert coins to real charity donations (admin-managed)
- **Leaderboard Statues**: Top donor gets permanent recognition
- **Command**: `/community-fund <goal>` - View and contribute to goals
- **Effort**: MEDIUM

### Access passes & memberships 🔮
Recurring premium subscriptions
- **VIP Pass** (5000 coins/month):
  - All boosts at 50% off
  - Exclusive VIP role and color
  - Private VIP voice channel access
  - Priority support from bot
  - Free daily loot box
  - Ad-free experience (if ads implemented)
- **Premium Pass** (10,000 coins/month):
  - Everything in VIP
  - Unlimited AI conversations
  - Free image generations (5/day)
  - Custom command aliases
  - Personal music queue
  - Beta feature access
- **Auto-renewal**: Optional recurring purchase
- **Commands**: `/membership buy <tier>`, `/membership status`, `/membership cancel`
- **Effort**: MEDIUM

### Skill unlocks & progression 🔥 HIGH PRIORITY
**EXPANDED**: Full RPG system with classes, stats, and player interactions
- **Character Classes**: Choose a class at level 5 (permanently or respec for 10k coins)
  - **Warrior**: +HP, better PvP damage, guild leader bonuses
  - **Mage**: +MP, AI feature discounts, spell crafting
  - **Rogue**: +Luck, better gambling/loot, stealth missions
  - **Merchant**: +Coin income, trading bonuses, shop discounts
  - **Bard**: +Charisma, music perks, party buffs
  - **Paladin**: +Defense, healing abilities, protection buffs
- **Core Stats** (distribute points on level-up):
  - **Strength (STR)**: PvP damage, quest rewards
  - **Intelligence (INT)**: AI feature effectiveness, puzzle solving
  - **Luck (LCK)**: Gambling odds, loot quality, critical hits
  - **Charisma (CHA)**: Coin bonuses from interactions, trading rates
  - **Vitality (VIT)**: Max HP for PvP/PvE, daily energy
  - **Dexterity (DEX)**: Critical hit chance, skill cooldown reduction
- **Skill Trees**: 3-5 tiers per skill path
  - **Merchant Path**: Better gambling odds, coin finding, trading bonuses (500/1000/2000/4000/8000 coins per tier)
  - **Scholar Path**: Faster XP gain, reduced cooldowns, AI discounts (800/1500/3000/6000/12000 coins)
  - **Socialite Path**: Bonus coins from interactions, friend buffs (600/1200/2500/5000/10000 coins)
  - **Gambler Path**: Better casino luck, higher bet limits, jackpot chance (1000/2000/4000/8000/15000 coins)
  - **Collector Path**: Better card pack drops, trade bonuses, item find (700/1400/3000/6000/12000 coins)
  - **Warrior Path**: PvP damage, defense, battle rewards (1000/2000/4000/8000/16000 coins)
  - **Mage Path**: Spell damage, mana efficiency, magic items (1200/2400/5000/10000/20000 coins)
- **Respect**: Reset skills for 5000 coins (keeps class and level)
- **Stat Reset**: Redistribute stat points for 3000 coins
- **Commands**: `/class choose <class>`, `/stats view [@user]`, `/stats allocate <stat> <points>`, `/skills view`, `/skills unlock <skill>`, `/skills reset`
- **Effort**: HIGH - requires complex progression system with database schema
- **See**: "🎮 RPG System & Cross-User Interactions" section for full implementation

### Custom commands/macros 🔮
Create personal bot commands
- **Purchase**: 2000 coins to create custom command
- **Limit**: 3 custom commands per user (more for premium)
- **Features**:
  - Custom trigger word (e.g., `/mycmd`)
  - Custom response (text, embed, image)
  - Templating (insert user name, random picks)
  - Cooldowns and permissions
- **Sharing**: Share custom commands with server (voted to approve)
- **Commands**: `/custom create <name>`, `/custom edit <name>`, `/custom delete <name>`
- **Effort**: MEDIUM

### Name change & cosmetics 🔮
Vanity purchases
- **Nickname Changes**: 300 coins per change (cooldown: 1 week)
- **Nickname Color**: 500 coins (custom color for 1 month)
- **Display Name Effects**: 1000 coins (sparkles, emojis, formatting)
- **Avatar Frame**: 800 coins (decorative border around Discord avatar in bot commands)
- **Title/Prefix**: 1500 coins (e.g., "🏆 Champion" before name)
- **Effort**: LOW-MEDIUM

### Coin conversion services 🔮
Real-world value connections
- **Nitro Giveaways**: Pool coins for Discord Nitro raffles (100 coins = 1 entry)
- **Steam Key Raffles**: Server admin adds game keys, users enter with coins
- **Server Merch**: Coins contribute to buying custom server merchandise
- **IRL Rewards**: High-value prizes (headsets, keyboards) for mega-savers
- **Note**: Requires admin management and trust system
- **Effort**: LOW (bot side) - primarily admin work

### Seasonal & event items 🔮
Limited-time purchases
- **Holiday Themes**: Christmas, Halloween, New Year profile themes (500-2000 coins)
- **Event Badges**: Participation badges for server events (1000 coins)
- **Anniversary Items**: Server birthday exclusives
- **Collab Items**: Special items from partnered servers
- **Time-Limited Boosts**: 3x XP during events (1500 coins)
- **FOMO Factor**: Items unavailable after event ends (increases value)
- **Effort**: MEDIUM - requires event scheduling system

### Role rewards at milestones 🔥 MEDIUM PRIORITY
Auto-assign roles when reaching levels
- Configurable level milestones (5, 10, 25, 50, 100)
- Exclusive roles for high-level users
- `/milestone-roles setup` command
- Role progression visualization
- Announcement when user unlocks new role
- **Effort**: LOW - extends existing level system

### Coin trading 🔮
P2P coin transfers
- `/give <user> <amount>` - Send coins to user
- Transaction history
- Daily transfer limits (prevent abuse)
- Transaction fees (small %)
- **Effort**: LOW

### Quote database 🔮
Save and retrieve memorable messages
- `/quote save` - Save message via reply
- `/quote random` - Random server quote
- `/quote <user>` - Random quote from specific user
- `/quote search <text>` - Search quotes
- Quote of the day (automated)
- React with 💬 to quick-save
- **Effort**: LOW

### Birthday role 🔮
Temporary role on user's birthday
- Auto-assign special birthday role at midnight
- Auto-remove after 24 hours
- Custom birthday role color/name
- `/birthday-role setup` configuration
- **Effort**: LOW - extends birthday system

### Achievement system 🔮
Unlock achievements for activities
- **Achievements**: First message, 100 messages, win 10 blackjack games, etc.
- `/achievements` - View your achievements
- Achievement notifications
- Rare/epic/legendary tiers
- Coin rewards for achievements
- Achievement showcase in profile
- **Effort**: MEDIUM

## 🔥 Top priority recommendations

The following features offer the best return on development effort given the current state of the bot.

### 1. 🎮 Full RPG system (highest priority) ⭐⭐⭐
Transform bot into engaging multiplayer RPG (see "🎮 RPG System & Cross-User Interactions" section)
- **Current State**: Level/XP/coins exist but no real progression beyond numbers
- **Game-Changing Addition**: Classes, stats, PvP, PvE, quests, guilds, trading, equipment
- **Why Priority #1**: 
  - Massively increases user engagement and retention
  - Creates social interactions (guilds, trading, PvP)
  - Natural coin sink for ALL features (equipment, skills, respecs, guild fees)
  - Builds on existing infrastructure (levels, coins, XP already work)
  - Turns passive bot into active game within Discord
- **Phased Implementation**:
  - **Phase 1** (MEDIUM effort): Character stats, classes, basic PvP
    - Add stat allocation on level-up
    - Implement 6 classes with unique bonuses
    - Create turn-based PvP duel system
    - Commands: `/class choose`, `/stats allocate`, `/duel @user`
  - **Phase 2** (MEDIUM effort): PvE and quests
    - Monster database with loot tables
    - Daily quest system (auto-tracking existing activities)
    - Basic dungeon runs
    - Commands: `/hunt`, `/quest list`, `/dungeon enter`
  - **Phase 3** (HIGH effort): Equipment and items
    - Item database with rarities
    - Inventory system
    - Equipment slots with stat bonuses
    - Commands: `/inventory`, `/equip`, `/upgrade`
  - **Phase 4** (HIGH effort): Guilds and trading
    - Guild creation and management
    - Player-to-player trading
    - Guild quests and wars
    - Commands: `/guild create`, `/trade`, `/auction`
  - **Phase 5** (MEDIUM effort): Advanced features
    - Crafting professions
    - World events
    - Raid bosses
- **Value**: EXTREMELY HIGH - complete game loop, endless content
- **Database Additions**: Character stats, equipment, inventory, guilds, quests, monsters
- **User Impact**: Transforms bot from utility to destination

### 2. 🛍️ Virtual shop & coin economy (high priority) ⭐⭐
Complete the economy system (coins already fully implemented)
- **Current State**: Users earn coins via leveling/daily/gambling but can only spend via casino
- **Addition**: Multiple coin sinks for real value (see "💰 Coin Value & Spending Ideas" section)
- **Top Priority Items**:
  - **AI Image Generation**: Pay 100-500 coins per image via DALL-E/Stable Diffusion
  - **Collectible Cards**: NFT-style card packs, trading, rarity tiers (synergizes with RPG)
  - **Profile Customization**: Custom rank cards, badges, backgrounds
  - **Server Perks**: XP boosters, gambling advantages, music priority
- **Effort**: LOW-MEDIUM depending on feature
- **Value**: HIGH - gives purpose to earning coins and creates engaging economy
- **Implementation**: 
  - Start with `/imagine` command for AI images (MEDIUM effort, HIGH engagement)
  - Add card pack system with `/cards` commands (MEDIUM effort, HIGH retention)
  - Build profile shop with `/customize` (MEDIUM effort, MEDIUM value)
- **RPG Synergy**: Equipment shop, skill respecs, guild fees, quest rewards all use coins

### 3. 🗣️ Voice-to-voice AI chat (high priority) ⭐
Natural extension of existing infrastructure
- **Current State**: `/listen` (Whisper STT) + `/mistral` (AI responses) already work
- **Addition**: Text-to-speech output via OpenAI TTS API
- **Effort**: MEDIUM - mainly integration work
- **Value**: HIGH - killer feature, very engaging
- **Implementation**:
  - Extend `listen.ts` to auto-process transcriptions through Mistral
  - Add TTS API integration (OpenAI or ElevenLabs)
  - Play TTS audio in voice channel
  - Toggle on/off per conversation

### 3. ⭐ Role rewards at level milestones (medium priority)
Complete the level system integration
- **Current State**: XP/levels work but no automatic role rewards
- **Addition**: Auto-assign roles at configurable levels (10, 25, 50, 100)
- **Effort**: LOW - extends existing xpTracking service
- **Value**: MEDIUM - incentivizes server activity
- **Implementation**:
  - Level milestone configuration in DB
  - Check milestones on level-up
  - Auto-assign roles + announcement

### 4. 🎮 Tournament organizer (medium priority)
Great for gaming community engagement
- **Current State**: No tournament features
- **Addition**: Bracket generation, match tracking, team randomizer
- **Effort**: MEDIUM - mostly bot logic, no external APIs
- **Value**: MEDIUM-HIGH - encourages competitive play
- **Synergy**: Could integrate with LoL stats for skill-based brackets

### 5. 🎵 AI DJ mode for music bot (medium priority)
Enhance existing music player with AI
- **Current State**: Full music player implemented (YouTube/SoundCloud)
- **Addition**: Mistral suggests songs based on chat context/mood
- **Effort**: LOW - uses existing Mistral + music integration
- **Value**: MEDIUM - fun enhancement
- **Implementation**:
  - `/dj <mood/genre>` command
  - Mistral generates song recommendations
  - Auto-queue suggestions
  - Learn from user skips/likes

### 6. 🎮 Multi-game stats (Valorant/TFT, low-medium priority)
Extend gaming integration
- **Current State**: LoL stats fully implemented
- **Addition**: Valorant and TFT stats via same Riot API
- **Effort**: MEDIUM - similar to existing LoL commands
- **Value**: MEDIUM - depends on server game preferences
- **Benefit**: Reuses existing Riot API infrastructure

### 7. 🏆 Achievement system (low priority)
Gamification layer
- **Current State**: No achievement tracking
- **Addition**: Unlock achievements for milestones/activities
- **Effort**: MEDIUM - requires tracking many events
- **Value**: MEDIUM - nice-to-have engagement feature
- **Implementation**: Achievement definitions, progress tracking, notifications

### 8. 📊 Advanced server analytics (low priority)
Data visualization and insights
- **Current State**: Basic leaderboards
- **Addition**: Graphs, heatmaps, trends via chart generation
- **Effort**: MEDIUM - requires chart library integration
- **Value**: LOW-MEDIUM - interesting but not essential
- **Audience**: Primarily for server admins

## 🚧 Implementation guidelines

### Architecture requirements
- **TypeScript**: All commands in `commands/` with proper types from `types/command.ts`
- **Error Handling**: Console logs + user-friendly error messages
- **Testing**: Vitest tests in `__tests__/` for all new commands
- **Database**: MongoDB via `database/db.ts` for persistence
- **Cooldowns**: Configured per-command (default 3s)

### Development workflow
1. Create command file in `commands/` (use existing similar command as template)
2. Write unit tests in `__tests__/`
3. Run `npm test` to verify
4. Run `npm run deploy` to register command
5. Restart bot (`npm run dev` or `npm start`)

### Key patterns
- **Deferred replies**: Use for operations >3s (API calls, DB queries)
- **MongoDB integration**: Use existing schemas in `db.ts` or extend
- **API calls**: Use `undici` for HTTP requests
- **Voice features**: Leverage `@discordjs/voice` + existing infrastructure
- **AI features**: Use existing Mistral integration patterns

### Hosting considerations
- **Memory**: Limit 512MB for cPanel (use `npm run start:prod`)
- **Database**: MongoDB Atlas or local instance
- **Crash Recovery**: Passenger-compatible restart mechanism
- **Logging**: Console logs for monitoring

### Documentation
- Update `README.md` with new commands
- Update `TESTING.md` with test examples
- Update this file (`FEATURES_IDEAS.md`) to mark ✅ when implemented

## 📝 Legend

- ✅ **Implemented** - Feature fully working in production
- 🔥 **High Priority** - Recommended next implementation
- 🔮 **Future Idea** - Planned but not prioritized
- 🚧 **Partial** - Started but incomplete
- ⭐ **Quick Win** - Low effort, high value

**Last Updated**: November 2025  
**Bot Version**: 1.0.0  
**Total Commands**: 28 (ping, echo, mistral, conversation, listen, play, playlist, pause, resume, skip, stop, queue, nowplaying, loop, lol-stats, lol-matches, lol-lastgame, lol-rotation, rank, leaderboard, balance, daily, slots, blackjack, roulette, dice, birthday)
