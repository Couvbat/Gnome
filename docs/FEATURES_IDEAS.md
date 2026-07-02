# Feature ideas

A backlog of ideas for Le Gnome that aren't built yet. For what's already implemented, see the package READMEs ([bot](../bot/README.md), [backend](../backend/README.md), [frontend](../frontend/README.md)) and the [RPG system reference](RPG_SYSTEM.md).

Legend: 🔥 high priority · 🔮 future idea

## Audio features

### Soundboard 🔮
Custom sound effects triggered by commands.
- Upload custom sounds (`.mp3`, `.wav`, `.ogg`), categorize them (memes, effects, quotes)
- `/soundboard play <name>`, random sound command, per-user favorites
- **Tech**: store audio locally or in cloud storage, `@discordjs/voice`

### Voice effects 🔮
Real-time voice modulation — pitch shift, echo, robot voice, reverb — applied to a user's live voice with toggleable presets.
- **Challenge**: requires audio DSP processing (complex)

### Ambient sound generator 🔮
Looping background sounds (rain, cafe, nature, white noise) for study/work sessions, with per-track volume mixing and timed auto-stop.

## Gaming enhancements

### Multi-game stats 🔥
Extend the League of Legends integration to Valorant and TFT via the Riot API, plus Steam (CS2, Dota 2) via the Steam Web API. Unified `/gaming-profile <user>` command, cross-game leaderboards.
- **Effort**: medium — reuses existing Riot API patterns

### Tournament organizer 🔥
Bracket generation, team randomizer, match scheduling.
- `/tournament create <name> <size>`, single/double elimination, `/tournament teams`, `/tournament match <id> <winner>`
- Bracket visualization, leaderboards, coin-integrated prize tracking
- **Effort**: medium — mostly bot logic, no external APIs

### Gaming sessions tracker 🔮
Auto-detect gaming activity via Discord Rich Presence, track hours per game per user, weekly/monthly reports.

### Game night scheduler 🔮
`/gamenight create <game> <date> <time>` with availability polls, auto-created Discord scheduled events, and reminders.
- **Effort**: low — uses the Discord events API

### Steam integration 🔮
`/steam link <steam-id>` to display level, badges, owned games, and recently played, via the Steam Web API.

## AI / Mistral upgrades

### Image generation 🔮
`/imagine <prompt>` via DALL-E, Stable Diffusion, or Flux, with style presets and variations.

### Code helper 🔮
Mistral-powered code review in threads — bug detection, optimization suggestions, language detection.
- **Effort**: low — reuses the existing Mistral integration

### Personalized AI profiles 🔮
Persistent per-user conversation memory and preferences (tone, interests, coding language) stored in MongoDB, with opt-in privacy controls.

### AI meme generator 🔮
`/meme <top> <bottom>` and `/ai-meme <description>`, combining Mistral-generated captions with canvas rendering.

### AI moderation assistant 🔮
Mistral-powered toxicity/spam detection with configurable sensitivity and AI-reasoned moderation logs.
- **Effort**: high — needs careful tuning before enabling

## Automation & integrations

### Twitch/YouTube alerts 🔮
Live-stream notifications with role mentions and viewer-count previews.

### RSS feed bot 🔮
Auto-post filtered news from gaming/tech feeds on a schedule.
- **Effort**: low

### Server backup 🔮
Automated MongoDB backups and message/config archiving with restore support.

### Cross-platform bridge 🔮
Two-way message sync with Telegram/Slack, including attachment forwarding.
- **Effort**: high — multiple long-lived connections to maintain

### Webhook system 🔮
`/webhook create <name> <url>` for external integrations, with event subscriptions and logs.
- **Effort**: low

### GitHub integration 🔮
Commit/PR/issue notifications and Discord-triggered issue creation.

## RPG world: cross-user interactions

The casino's RPG classes (see [RPG system reference](RPG_SYSTEM.md)) only affect gambling bonuses. This section is a separate, larger idea: a full RPG layer on top of the existing level/XP/coin system, with stats, PvP, PvE, guilds, and trading.

### Character system
- **Stats**: HP (`100 + VIT×10`), MP (`50 + INT×5`), Energy (100 max, +10/hour), 3 stat points and 1 skill point per level
- **Classes** (chosen at level 5): Warrior (tank/damage), Mage (spellcaster), Rogue (DPS/luck), Merchant (economy), Bard (support/buffer), Paladin (healer/tank) — each with unique skills and a respec cost (10,000 coins)
- **Commands**: `/character`, `/stats allocate <stat> <points>`, `/class choose <class>`, `/class respec`, `/skills`

### Quest system
Daily quests (reset every 24h), one-time story quests with chapter progression, repeatable quests, collaborative guild quests, and limited-time event quests, with auto-tracking off existing activity systems.
- **Commands**: `/quest list`, `/quest active`, `/quest complete <id>`, `/quest abandon <id>`

Note: a simpler quest system (daily/story quests, progress tracking) already exists in the backend for the casino RPG — see [RPG system → Quests](RPG_SYSTEM.md#quests). This idea describes a broader, bot-wide quest layer.

### PvP battle system
Turn-based duels: `/duel @user [wager]`, attack/defend/skill/item/flee actions, damage formula `(ATK × random(0.8–1.2)) − (DEF × 0.5)`, critical hits from DEX, ELO-style ranking.
- **Anti-abuse**: 10-minute cooldown per opponent pair, level-gated wagering, 5000-coin wager cap

### PvE system
Monster tiers (common → raid boss) with energy costs, dungeons with loot tables and difficulty tiers, daily dungeon bonus, party-based raid bosses.
- **Commands**: `/hunt`, `/dungeon enter <difficulty>`, `/dungeon party create/invite`, `/boss fight <name>`, `/bestiary`

### Equipment & items
Weapon/armor/accessory slots, 5-tier rarity (common → legendary), upgrade system with failure chance at higher levels.
- **Commands**: `/inventory`, `/equip`, `/unequip`, `/use`, `/upgrade`, `/dismantle`

### Guild system
Guild creation (5000 coins, level 10+), ranks (Master/Officer/Elite/Member/Recruit), guild bank, guild hall upgrades, weekly guild-vs-guild wars.
- **Commands**: `/guild create/invite/join/leave/info/members/bank/upgrade/quests/leaderboard`

### Trading & economy
Direct player trades with double-confirm anti-scam protection, an auction house (5% fee, timed listings), and player shops with passive offline income.

### Crafting
Blacksmith, Alchemist, Enchanter, Jeweler, and Cook professions; gather materials via `/gather herbs|ore|wood`; success chance scales with INT.

### Party system
`/party create` (max 5), shared XP and loot, party-only dungeons, expanded 10–20 player raid parties with weekly lockouts.

### World events
Server-wide World Boss spawns (scaled HP, every 6 hours), treasure hunts, double-XP weekends, guild war seasons, monster invasions, seasonal events.

### Achievements & titles
Combat, social, economy, quest, collection, gambling, and music achievement categories; earned titles shown in `/character` and before the username, some with stat bonuses.

### Idle/mobile features
Passive gathering, reduced offline XP, increasing daily login rewards, and quick-action buttons for common commands.

## Fun & social

### Mini-games 🔮
Trivia, Hangman, Word Chain, reaction games, Higher-or-Lower — each with its own leaderboard and coin rewards.

### Virtual shop 🔥
Spend coins on custom roles, temporary XP/coin-boost perks, cosmetic name tags, and profile customization.
- `/shop`, `/buy <item>`, admin `/shop add|remove|edit`
- **Effort**: low — extends the existing economy system

## Coin sinks

Ideas that give coins more places to go beyond the casino.

### AI image generation (pay-per-use) 🔥
`/imagine <prompt>` priced per quality tier (100–500 coins), with style presets, variations, and a bulk discount pack.

### Collectible card system 🔥
Character/achievement/event/legendary cards with a rarity-weighted pack system, trading, fusion, and profile showcases.
- `/cards buy|collection|trade|sell|info|leaderboard`

### Profile customization shop 🔮
Purchasable rank-card backgrounds, animated backgrounds, progress-bar colors, badges, name effects, and frames, with a preview-before-buy flow.

### Server perks & boosts 🔮
Temporary XP/coin boosters, gambling perks (insurance, lucky spin), music queue priority, voice priority speaker, and social perks (broadcast message, pin privilege).

### Premium AI features 🔮
Paid extensions on existing AI features: longer conversation windows, extended voice chat time, code review tiers, content-generation credits, and saved custom AI personalities.
- **Effort**: low — extends the existing Mistral integration

### Virtual pets 🔮
Tamagotchi-style companions with feeding/play/training/grooming loops, pet leveling, and unlockable passive bonuses (coin bonus, XP bonus, gambling luck).
- **Effort**: high — nontrivial state management

### Loot boxes 🔮
Gacha-style boxes (common → event) with a pity system guaranteeing a legendary every 50 opens.

### Server feature unlocks 🔮
Community-funded goals — custom channels, server emojis, funded events, crowdfunded bot features.

### Access passes 🔮
Recurring VIP/Premium subscription tiers bundling discounts, exclusive access, and free daily perks.

### Custom commands/macros 🔮
User-created trigger/response command pairs with templating, cooldowns, and optional server-wide sharing.

### Name change & cosmetics 🔮
Nickname changes, nickname color, display-name effects, avatar frames, and title/prefix purchases.

### Coin conversion services 🔮
Coin-funded raffles for Discord Nitro or game keys, and pooled contributions toward server merchandise — admin-managed.

### Seasonal & event items 🔮
Limited-time holiday themes, event badges, and time-boxed XP boosts.

### Role rewards at milestones 🔥
Auto-assign roles at configurable level milestones (5, 10, 25, 50, 100), with an unlock announcement.
- **Effort**: low — extends the existing XP tracking service

### Quote database 🔮
`/quote save|random|search`, quote-of-the-day, and a 💬-reaction quick-save.

### Birthday role 🔮
Temporary role auto-assigned on a user's birthday and removed after 24 hours, extending the existing birthday system.

### Achievement system 🔮
Unlockable achievements for milestones (first message, 100 messages, 10 blackjack wins, ...) with rarity tiers and coin rewards.

## Recommended next steps

Ranked by return on effort given the bot's current feature set.

### 1. RPG world layer
The biggest single addition: classes, stats, PvP, PvE, quests, guilds, trading, and equipment on top of the existing level/XP/coin system (see [RPG world: cross-user interactions](#rpg-world-cross-user-interactions) above). It reuses existing infrastructure (levels, coins, XP), and every sub-feature (equipment, respecs, guild fees) becomes a new coin sink.
- Natural phasing: character stats/classes/PvP first, then PvE/quests, then equipment, then guilds/trading, then crafting/world events.

### 2. Virtual shop & coin sinks
Coins currently have real utility only in the casino. Adding AI image generation, collectible cards, and profile customization gives coins more places to go and creates recurring engagement loops.
- Start with `/imagine` (reuses the existing image-generation research), then card packs, then the profile shop.

### 3. Role rewards at level milestones
Small, self-contained: auto-assign roles at configurable levels, using the existing `xpTracking` service.
- **Effort**: low · **Value**: incentivizes server activity

### 4. Tournament organizer
Bracket generation and match tracking for the gaming community; could integrate with LoL stats for skill-based brackets.

### 5. AI DJ mode
Mistral suggests songs based on chat mood/context, auto-queued via the existing music integration.
- `/dj <mood/genre>`, learns from skips/likes over time

### 6. Multi-game stats
Extend the LoL integration pattern to Valorant and TFT via the same Riot API.

### 7. Achievement system
Definitions, progress tracking, and notifications layered on existing activity events.

### 8. Advanced server analytics
Message/activity graphs and heatmaps for admins, via MongoDB aggregation + a chart library (Chart.js, quickchart.io).

## Implementation guidelines

- **TypeScript**: commands live in `bot/commands/`, typed via `types/command.ts`
- **Error handling**: detailed console logs, generic user-facing messages
- **Testing**: Vitest tests in `__tests__/` for every new command
- **Database**: MongoDB via `bot/database/db.ts` for bot-side persistence, or the backend's `src/models/` for casino/RPG data
- **Cooldowns**: configured per command (default 3s)

### Development workflow

1. Create the command file in `commands/`, using a similar existing command as a template
2. Write unit tests in `__tests__/`
3. `npm test` to verify
4. `npm run deploy` to register the command
5. Restart the bot

### Key patterns

- Deferred replies for anything over ~3s (API calls, DB queries)
- `undici` for HTTP requests
- `@discordjs/voice` for voice features
- Reuse the existing Mistral integration pattern for new AI features

## Related documentation

- [RPG system reference](RPG_SYSTEM.md) — what's implemented today in the casino RPG
- [RPG lore](RPG_LORE.md) — the Golden Gnome Tavern universe, useful for framing new RPG/casino features narratively
