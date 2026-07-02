# RPG system: technical reference

Technical reference for the casino backend's RPG progression system: character classes, abilities, energy management, and reputation tiers, and how they integrate with the four casino games.

## Table of contents

1. [System overview](#system-overview)
2. [Architecture](#architecture)
3. [Character classes & abilities](#character-classes--abilities)
4. [Energy system](#energy-system)
5. [Reputation & progression](#reputation--progression)
6. [Ability system](#ability-system)
7. [Quests](#quests)
8. [Game integration](#game-integration)
9. [API endpoints reference](#api-endpoints-reference)
10. [Database schemas](#database-schemas)

## System overview

Every casino game runs through the RPG progression system:

- 6 character classes, each with distinct passive and active abilities
- An energy system that gates play and regenerates over time, with class-specific rates
- A 7-tier reputation ladder with unlockable perks
- 12 character abilities with cooldown and per-session usage tracking
- Full integration across all 4 casino games (Blackjack, Roulette, Slots, Dice)

Players create a character, then energy, XP, reputation, and ability cooldowns are all tracked and applied automatically as they play.

## Architecture

### Request flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      CASINO BACKEND RPG SYSTEM                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENT REQUEST                                 │
│  POST /api/games/blackjack/play { bet: 100, strategy: "hit" }            │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION MIDDLEWARE                           │
│  - Verify JWT token                                                      │
│  - Extract userId, guildId                                               │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CASINO GAME ENGINE                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. GET PLAYER CONTEXT                                            │   │
│  │    ├─ User (coins, level, XP)                                    │   │
│  │    ├─ Character (class, stats, abilities)                        │   │
│  │    ├─ Casino Profile (energy, reputation)                        │   │
│  │    └─ Calculate total luck (base + class + stats)                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 2. CHECK ENERGY AVAILABILITY                                     │   │
│  │    └─ EnergyService.hasEnoughEnergy()                            │   │
│  │       ├─ Regenerate energy based on time passed                  │   │
│  │       ├─ Apply class regen bonuses                               │   │
│  │       └─ Return true/false                                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 3. EXECUTE GAME LOGIC (engine.playX())                           │   │
│  │    ├─ Deal cards / spin / roll                                   │   │
│  │    ├─ Apply luck modifier to RNG                                 │   │
│  │    ├─ Check for special abilities                                │   │
│  │    ├─ Execute player strategy                                    │   │
│  │    └─ Determine outcome                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 4. APPLY CHARACTER BONUSES                                       │   │
│  │    ├─ Merchant: bonus on winnings                                │   │
│  │    ├─ Paladin: loss protection                                   │   │
│  │    ├─ Warrior: comeback mechanic                                 │   │
│  │    └─ Rogue: loss reduction chance                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 5. PROCESS GAME RESULT                                           │   │
│  │    ├─ Update user coins                                          │   │
│  │    ├─ Award XP → CharacterService.levelUpCharacter()             │   │
│  │    ├─ Award reputation → ReputationService.awardReputation()     │   │
│  │    ├─ Consume energy → EnergyService.consumeEnergy()             │   │
│  │    ├─ Update casino stats (wagered/won/lost, streak, biggest)    │   │
│  │    └─ Log game → CasinoGameLog.create()                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           RESPONSE TO CLIENT                              │
│  {                                                                        │
│    "outcome": "win", "finalPayout": 240, "xpGained": 15,                  │
│    "reputationGained": 18, "tierChanged": false,                          │
│    "specialAbilityTriggered": "merchant_coin_sense",                      │
│    "playerHand": {...}, "dealerHand": {...}, "newBalance": 1240,          │
│    "energy": { "current": 82, "max": 125, "regenRate": 1.3 }              │
│  }                                                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

### Service layer

```text
┌─────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐
│  CharacterService   │  │   EnergyService      │  │  ReputationService  │
├─────────────────────┤  ├──────────────────────┤  ├─────────────────────┤
│ • createCharacter() │  │ • getEnergyInfo()    │  │ • getReputationInfo │
│ • levelUpCharacter()│  │ • regenerateEnergy() │  │ • awardReputation() │
│ • getCharacterInfo()│  │ • consumeEnergy()    │  │ • getTierInfo()     │
│ • getAllClasses()   │  │ • restoreEnergy()    │  │ • getTierPerks()    │
│ • deleteCharacter() │  │ • calculateCost()    │  │ • getAllTiers()     │
└─────────────────────┘  └──────────────────────┘  └─────────────────────┘

           │                       │                         │
           └───────────────────────┴─────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   AbilityService     │
                        ├──────────────────────┤
                        │ • canUseAbility()    │
                        │ • useAbility()       │
                        │ • getAbilityStatus() │
                        │ • getClassAbilities()│
                        └──────────────────────┘
```

### Database layer

```text
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐  ┌───────────┐
│     User     │  │    Character    │  │  CasinoProfile   │  │  Session  │
├──────────────┤  ├─────────────────┤  ├──────────────────┤  ├───────────┤
│ • userId     │  │ • userId        │  │ • userId         │  │ • userId  │
│ • coins      │  │ • className     │  │ • energy         │  │ • active  │
│ • level      │  │ • stats         │  │ • maxEnergy      │  │ • ability │
│ • xp         │  │ • experience    │  │ • reputation     │  │   Usage   │
│ • lastDaily  │  │ • lastAbilityUse│  │ • reputationTier │  └───────────┘
└──────────────┘  └─────────────────┘  │ • stats          │
                                       │ • lastEnergyRegen│
                                       └──────────────────┘
```

## Character classes & abilities

### Warrior ⚔️

**Playstyle:** High-risk comeback specialist

- **Battle Rage** (passive) — 25% payout boost after a loss
- **Battle Frenzy** (active) — enhanced multiplier on jackpot wins · cooldown 15 min · 2 uses/session · energy cost 30

**Stats:** +20 max energy, 1.2x regen

### Mage 🔮

**Playstyle:** Strategic, information-based

- **Arcane Insight** (active) — see card probabilities in blackjack · cooldown 10 min · 3 uses/session · energy cost 20
- **Pattern Recognition** (passive) — double XP for strategic betting
- **Triple Completion** (passive) — 15% chance to complete slot triples

**Stats:** +15 max energy, 1.0x regen

### Rogue 🥷

**Playstyle:** Risk mitigation, loss reduction

- **Sleight of Hand** (passive) — 15% chance to lose only half the bet
- **Probability Manipulation** (active) — reduced losses on high-risk bets · cooldown 8 min · 5 uses/session · energy cost 15
- **Card Counting** (passive) — better odds information in blackjack

**Stats:** +10 max energy, 1.0x regen

### Merchant 💰

**Playstyle:** Profit maximization, steady gains

- **Coin Sense** (passive, always active) — 20% bonus on all winnings
- **Lucky Business Deal** (active) — special high-payout event · cooldown 20 min · 1 use/session · energy cost 40

**Stats:** +25 max energy, 1.3x regen

### Bard 🎵

**Playstyle:** Social, multiplayer bonuses

- **Lucky Song** (active) — slight bias toward favorable outcomes for the whole table · cooldown 12 min · 4 uses/session · energy cost 25
- **Harmony Boost** (passive) — affects other players at the same table (multiplayer only)
- **Social Bonuses** (passive) — community jackpot contributions

**Stats:** +15 max energy, 1.0x regen

### Paladin ⚔️✨

**Playstyle:** Defensive, loss protection

- **Divine Blessing** (passive) — 30% reduction on large losses (>100 coins)
- **Holy Protection** (active) — converts some losses to pushes · cooldown 30 min · 1 use/session · energy cost 50
- **Divine Luck** (passive) — protection from catastrophic losses

**Stats:** +30 max energy (highest), 1.5x regen (highest)

### Class comparison

| Class | Best for | Key strength | Energy bonus | Regen rate |
|---|---|---|---|---|
| Warrior | High-risk plays | Comeback mechanics | +20 | 1.2x |
| Mage | Strategic play | Information advantage | +15 | 1.0x |
| Rogue | Loss mitigation | Risk reduction | +10 | 1.0x |
| Merchant | Profit maximization | 20% win bonus | +25 | 1.3x |
| Bard | Social play | Team bonuses | +15 | 1.0x |
| Paladin | Safe play | Loss protection | +30 | 1.5x |

## Energy system

Energy gates play and prevents unlimited gambling.

- **Base max energy:** 100 (+10 to +30 depending on class)
- **Regeneration:** 1 energy/minute base, scaled by class regen rate
- **Consumption:** scales with bet size and game complexity

### Energy cost by game

Each game has a base cost, plus a uniform bet-size surcharge of 1 energy per 100 coins wagered (`floor(bet / 100)`), applied on top of whichever is larger — the base cost or base-plus-scaling:

```text
Blackjack: base 2
Roulette:  base 1
Slots:     base 1
Dice:      base 1

cost = max(base, base + floor(bet / 100))
```

Example: a 100-coin blackjack bet costs `max(2, 2 + 1) = 3` energy; a 5000-coin blackjack bet costs `max(2, 2 + 50) = 52` energy.

### Regeneration by class

```text
Base:     100 energy @ 1.0/min  → 100 min to full
Warrior:  120 energy @ 1.2/min  → 100 min to full
Merchant: 125 energy @ 1.3/min  → 96 min to full
Paladin:  130 energy @ 1.5/min  → 87 min to full
```

```typescript
const minutesPassed = (Date.now() - lastRegenTime) / 60000;
const regenAmount = minutesPassed * regenRate;
const newEnergy = Math.min(current + regenAmount, maxEnergy);
```

## Reputation & progression

Long-term progression that unlocks perks independent of energy or class.

| Tier | Min points | Key perks |
|---|---|---|
| Novice | 0 | Basic access |
| Amateur | 100 | 5% buy-in discount, +5 energy, +10% daily bonus |
| Seasoned | 500 | 10% discount, +10 energy, +25% daily, VIP tables |
| Professional | 1,500 | 15% discount, +20 energy, +50% daily, tournaments |
| High Roller | 5,000 | 20% discount, +30 energy, 2x daily, +10% jackpots |
| Legend | 15,000 | 25% discount, +50 energy, 3x daily, special abilities |
| Mythic | 50,000 | 30% discount, +100 energy, 5x daily, enhanced abilities |

### Reputation gain formula

```text
Base = bet / 10

Multipliers:
  Jackpot: 3.0x        Win: 1.5x            Loss: 1.0x         Push: 0.5x
  Game complexity: 0.8x–1.2x
  High stakes (>100): +1.2x     Very high stakes (>500): +1.5x
  Character level: 1 + (level * 0.05)

Total = Base * (all multipliers)
```

Examples: a 10-coin win yields ~2 reputation, a 100-coin win ~18, a 500-coin win ~112, a 500-coin jackpot ~270.

Approximate pace: Novice → Amateur in 5–10 games; Amateur → Seasoned in 25–40; Seasoned → Professional in 50–80; Professional → High Roller in 200–350; High Roller → Legend in 600–1000; Legend → Mythic in 2000–3500.

## Ability system

Each ability has a cooldown (minutes before reuse), a session limit (max uses per casino session), and an energy cost.

| Class | Ability | Type | Cooldown | Session limit | Energy cost |
|---|---|---|---|---|---|
| Warrior | Battle Rage | Passive | 5 min | unlimited (auto) | 0 |
| Warrior | Battle Frenzy | Active | 15 min | 2 | 30 |
| Mage | Card Reading | Active | 10 min | 3 | 20 |
| Mage | Pattern Insight | Passive | — | unlimited | 0 |
| Rogue | Sleight of Hand | Passive | — | unlimited (chance) | 0 |
| Rogue | Probability Twist | Active | 8 min | 5 | 15 |
| Merchant | Coin Sense | Passive | — | unlimited | 0 |
| Merchant | Lucky Deal | Active | 20 min | 1 | 40 |
| Bard | Lucky Song | Active | 12 min | 4 | 25 |
| Bard | Harmony Boost | Passive | — | unlimited | 0 |
| Paladin | Divine Blessing | Passive | — | unlimited (auto) | 0 |
| Paladin | Holy Protection | Active | 30 min | 1 | 50 |

## Quests

`QuestService` and the `/api/quests` router provide a quest lifecycle independent of the casino games themselves: daily and story quests, progress tracking, and completion history.

| Endpoint | Description |
|---|---|
| `GET /api/quests/available` | Quests available to the player |
| `GET /api/quests/active` | Player's active quests |
| `GET /api/quests/history` | Completed quest history |
| `POST /api/quests/:questId/start` | Start a quest |
| `POST /api/quests/:questId/abandon` | Abandon a quest |
| `POST /api/quests/progress` | Update quest progress (used by game engines) |
| `POST /api/quests/admin/init-daily` | Seed daily quests for a guild |
| `POST /api/quests/admin/init-story` | Seed story quests for a guild |

Quests are stored as `Quest` (definitions: type, category, objectives, rewards, chaining) and `UserQuest` (per-player progress and status).

## Game integration

| Class | Blackjack | Roulette | Slots | Dice |
|---|---|---|---|---|
| **Warrior** | Battle rage on high hands (≥19) | Jackpot multiplier | Comeback bonus on wins | High-risk bet bonus |
| **Mage** | Card reading advice (30%) | Pattern recognition, 2x XP | Triple completion (15%) | 2x XP on exact predictions |
| **Rogue** | Loss reduction (15%) | Probability manipulation | Sleight of hand (50% loss reduction) | High-risk loss reduction |
| **Merchant** | 1.2x winnings | 1.2x winnings | 1.2x winnings | 1.2x winnings |
| **Paladin** | Divine protection | Small-loss conversion | Large-loss protection | Divine blessing (>100 loss) |
| **Bard** | Multiplayer only | Harmony boost | Multiplayer only | Lucky 7 (5% chance) |

## API endpoints reference

### Energy

```http
GET /api/progression/energy
```
```json
{ "current": 85, "max": 120, "regenRate": 1.3, "lastRegen": "...", "minutesUntilFull": 27 }
```

```http
POST /api/progression/energy/restore
```

### Reputation

```http
GET /api/progression/reputation
```
```json
{
  "current": 2400, "tier": "professional", "nextTier": "high_roller", "pointsToNextTier": 2600,
  "bonuses": { "buyInDiscount": 0.15, "energyBonus": 20, "dailyBonusMultiplier": 1.5, "jackpotMultiplier": 1.0 }
}
```

```http
GET /api/progression/reputation/tiers
GET /api/progression/reputation/bonuses
```

### Abilities

```http
GET /api/progression/abilities
```
```json
{
  "mage_card_reading": { "available": true, "cooldownRemaining": 0, "usesRemaining": 2 },
  "merchant_coin_sense": { "available": true, "cooldownRemaining": 0, "usesRemaining": null }
}
```

```http
GET /api/progression/abilities/:abilityKey
GET /api/progression/stats   # combined energy + reputation + abilities
```

### Characters

```http
POST /api/characters/create
{ "name": "TestMage", "className": "mage" }

GET /api/characters/:characterId
```

### Casino games

```http
POST /api/games/blackjack/play
{ "bet": 100, "strategy": "hit" }
```
```json
{
  "outcome": "win", "finalPayout": 240, "xpGained": 15, "reputationGained": 18,
  "tierChanged": false, "specialAbilityTriggered": "merchant_coin_sense",
  "playerHand": [...], "dealerHand": [...], "newBalance": 1240,
  "energy": { "current": 82, "max": 130, "regenRate": 1.5, "minutesUntilFull": 32 }
}
```

`POST /api/games/roulette/play`, `POST /api/games/slots/spin`, and `POST /api/games/dice/roll` return the same shape of enriched response (payout, XP, reputation, energy, triggered ability).

Note: `POST /api/casino/slots/spin` and `POST /api/casino/dice/roll` (the older, non-RPG-integrated routes on the `/api/casino` router) return `410 Gone` — use the `/api/games/*` endpoints above.

## Database schemas

### Character

```typescript
interface Character {
  userId: string;
  guildId: string;
  name: string;
  className: 'warrior' | 'mage' | 'rogue' | 'merchant' | 'bard' | 'paladin';
  level: number;
  experience: number;
  stats: {
    strength: number;
    intelligence: number;
    luck: number;
    charisma: number;
    vitality: number;
    dexterity: number;
  };
  lastAbilityUse: { [abilityKey: string]: Date };
  createdAt: Date;
  updatedAt: Date;
}
```

### Casino profile

```typescript
interface CasinoProfile {
  userId: string;
  guildId: string;
  energy: number;
  maxEnergy: number;
  lastEnergyRegen: Date;
  reputation: number;
  reputationLevel: 'novice' | 'amateur' | 'seasoned' | 'professional' | 'high_roller' | 'legend' | 'mythic';
  stats: {
    biggestWin: number;
    biggestLoss: number;
    favoriteGame: string;
    totalWagered: number;
    totalWon: number;
    totalLost: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Casino session

```typescript
interface CasinoSession {
  userId: string;
  guildId: string;
  active: boolean;
  startTime: Date;
  endTime?: Date;
  abilityUsage: { [abilityKey: string]: number };
}
```

## Related documentation

- [RPG lore & world-building](RPG_LORE.md) — the story and setting of the Golden Gnome Tavern
- [Feature ideas](FEATURES_IDEAS.md) — unimplemented systems (items, guilds, tournaments) and other future directions
- [Backend README](../backend/README.md) — full REST/WebSocket API surface
