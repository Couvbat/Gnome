# 🎮 RPG system: complete technical documentation

> **Comprehensive guide** to the casino backend RPG progression system integrating character classes, abilities, energy management, and reputation tiers.

## 📚 Table of contents

1. [System overview](#system-overview)
2. [System architecture](#system-architecture)
3. [Character classes & abilities](#character-classes--abilities)
4. [Energy system](#energy-system)
5. [Reputation & progression](#reputation--progression)
6. [Ability system](#ability-system)
7. [Game integration](#game-integration)
8. [API endpoints reference](#api-endpoints-reference)
9. [Database schemas](#database-schemas)
10. [Implementation status](#implementation-status)

## System overview

The casino backend features a **complete RPG progression system** integrated into all casino games. This system includes:

- ✅ 6 unique character classes with distinct abilities
- ✅ Dynamic energy management system with regeneration
- ✅ 7-tier reputation progression with perks
- ✅ 12 character abilities with cooldown tracking
- ✅ Complete integration with all 4 casino games
- ✅ RESTful API for all progression features

Players can create characters, use special abilities, manage energy, and progress through reputation tiers while gambling.

## System architecture

### Request flow diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      CASINO BACKEND RPG SYSTEM                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENT REQUEST                                 │
│  POST /api/casino/blackjack { bet: 100, strategy: "hit" }                │
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
│  │ 3. EXECUTE GAME LOGIC (BlackjackEngine.playSinglePlayerBlackjack)│   │
│  │    ├─ Deal cards                                                 │   │
│  │    ├─ Apply luck modifier to RNG                                 │   │
│  │    ├─ Check for special abilities:                               │   │
│  │    │  ├─ Mage: Card reading advice                               │   │
│  │    │  ├─ Rogue: Card counting simulation                         │   │
│  │    │  └─ Bard: Harmony boost                                     │   │
│  │    ├─ Execute player strategy                                    │   │
│  │    └─ Determine outcome                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 4. APPLY CHARACTER BONUSES                                       │   │
│  │    ├─ Merchant: 20% bonus on winnings                            │   │
│  │    │  └─ AbilityService.useAbility('merchant_coin_sense')        │   │
│  │    ├─ Paladin: Loss protection                                   │   │
│  │    │  └─ AbilityService.canUseAbility() → use if available       │   │
│  │    ├─ Warrior: Comeback mechanic                                 │   │
│  │    │  └─ Check recent losses → apply bonus                       │   │
│  │    └─ Rogue: Loss reduction chance                               │   │
│  │       └─ Random roll → reduce loss if triggered                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 5. PROCESS GAME RESULT                                           │   │
│  │    ├─ Update user coins                                          │   │
│  │    ├─ Award XP to character                                      │   │
│  │    │  └─ CharacterService.levelUpCharacter()                     │   │
│  │    ├─ Award reputation                                           │   │
│  │    │  └─ ReputationService.awardReputation()                     │   │
│  │    │     ├─ Calculate base (bet/10)                              │   │
│  │    │     ├─ Apply outcome multiplier                             │   │
│  │    │     ├─ Apply game complexity                                │   │
│  │    │     └─ Check for tier change                                │   │
│  │    ├─ Consume energy                                             │   │
│  │    │  └─ EnergyService.consumeEnergy()                           │   │
│  │    ├─ Update casino stats                                        │   │
│  │    │  ├─ Total wagered/won/lost                                  │   │
│  │    │  ├─ Current streak                                          │   │
│  │    │  └─ Biggest win/loss                                        │   │
│  │    └─ Log game to database                                       │   │
│  │       └─ CasinoGameLog.create()                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           RESPONSE TO CLIENT                              │
│  {                                                                        │
│    "outcome": "win",                                                      │
│    "finalPayout": 240,                                                    │
│    "xpGained": 15,                                                        │
│    "reputationGained": 18,                                                │
│    "tierChanged": false,                                                  │
│    "specialAbilityTriggered": "merchant_coin_sense",                      │
│    "playerHand": {...},                                                   │
│    "dealerHand": {...},                                                   │
│    "newBalance": 1240,                                                    │
│    "energy": {                                                            │
│      "current": 82,                                                       │
│      "max": 125,                                                          │
│      "regenRate": 1.3,                                                    │
│      "minutesUntilFull": 33                                               │
│    }                                                                      │
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

All 6 character classes have **unique passive and active abilities** that affect casino gameplay.

### Warrior ⚔️

**Playstyle:** High-risk comeback specialist

**Abilities:**
- **Battle Rage** (Passive): 25% payout boost after a loss (comeback mechanic)
- **Battle Frenzy** (Active): Enhanced multiplier on jackpot wins
  - Cooldown: 15 minutes
  - Uses per session: 2
  - Energy cost: 30

**Stats:**
- Energy Bonus: +20 max energy
- Energy Regen: 1.2x (20% faster than base)

**Best For:** Players who make aggressive bets and want comeback mechanics

### Mage 🔮

**Playstyle:** Strategic information-based player

**Abilities:**
- **Arcane Insight** (Active): See card probabilities in blackjack
  - Cooldown: 10 minutes
  - Uses per session: 3
  - Energy cost: 20
- **Pattern Recognition** (Passive): Double XP for strategic betting
- **Triple Completion** (Passive): 15% chance to complete slot triples

**Stats:**
- Energy Bonus: +15 max energy
- Energy Regen: 1.0x (base rate)

**Best For:** Players who value information and strategic decision-making

### Rogue 🥷

**Playstyle:** Risk mitigation and loss reduction

**Abilities:**
- **Sleight of Hand** (Passive): 15% chance to lose only half the bet
- **Probability Manipulation** (Active): Reduced losses on high-risk bets
  - Cooldown: 8 minutes
  - Uses per session: 5
  - Energy cost: 15
- **Card Counting** (Passive): Better odds information in blackjack

**Stats:**
- Energy Bonus: +10 max energy
- Energy Regen: 1.0x (base rate)

**Best For:** Players who want to minimize losses and play defensively

### Merchant 💰

**Playstyle:** Profit maximization and steady gains

**Abilities:**
- **Coin Sense** (Passive): 20% bonus on ALL winnings (always active)
- **Lucky Business Deal** (Active): Special high-payout events
  - Cooldown: 20 minutes
  - Uses per session: 1
  - Energy cost: 40

**Stats:**
- Energy Bonus: +25 max energy
- Energy Regen: 1.3x (30% faster than base)

**Best For:** Players who want consistent profit bonuses on every win

### Bard 🎵

**Playstyle:** Social player with multiplayer bonuses

**Abilities:**
- **Lucky Song** (Active): Slight bias toward favorable outcomes
  - Cooldown: 12 minutes
  - Uses per session: 4
  - Energy cost: 25
- **Harmony Boost** (Passive): Affects other players at same table (multiplayer)
- **Social Bonuses** (Passive): Community jackpot contributions

**Stats:**
- Energy Bonus: +15 max energy
- Energy Regen: 1.0x (base rate)

**Best For:** Players who enjoy multiplayer aspects and team play

### Paladin ⚔️✨

**Playstyle:** Defensive protection from large losses

**Abilities:**
- **Divine Blessing** (Passive): 30% reduction on large losses (>100 coins)
- **Holy Protection** (Active): Converts some losses to pushes
  - Cooldown: 30 minutes
  - Uses per session: 1
  - Energy cost: 50
- **Divine Luck** (Passive): Protection from catastrophic losses

**Stats:**
- Energy Bonus: +30 max energy (highest)
- Energy Regen: 1.5x (50% faster than base - highest)

**Best For:** Players who want maximum protection and sustainability

### Character class balance table

| Class | Best For | Key Strength | Energy Bonus | Regen Rate |
|-------|----------|--------------|--------------|------------|
| **Warrior** | High-risk plays | Comeback mechanics | +20 | 1.2x |
| **Mage** | Strategic play | Information advantage | +15 | 1.0x |
| **Rogue** | Loss mitigation | Risk reduction | +10 | 1.0x |
| **Merchant** | Profit maximization | 20% win bonus | +25 | 1.3x |
| **Bard** | Social play | Team bonuses | +15 | 1.0x |
| **Paladin** | Safe play | Loss protection | +30 | 1.5x |

## Energy system

**Purpose:** Prevents infinite gambling and adds strategic resource management.

### Energy mechanics

- **Base Max Energy:** 100
- **Class Bonuses:** +10 to +30 depending on class
- **Regeneration:** 1 energy/minute (base), varies by class
- **Consumption:** Scales with bet size and game complexity

### Energy costs by game

```text
Blackjack: 2 base + (bet / 50) energy
Roulette:  1 base + (bet / 80) energy
Slots:     1 base + (bet / 50) energy
Dice:      1 base + (bet / 100) energy
```

**Examples:**
- Blackjack with 100 coin bet: 2 + (100/50) = 4 energy
- Roulette with 500 coin bet: 1 + (500/80) = 7.25 energy
- Slots with 50 coin bet: 1 + (50/50) = 2 energy

### Energy regeneration

**Regeneration by class:**
```text
Base: 100 energy at 1/min     = 100 minutes to full
Warrior: 120 at 1.2/min       = 100 minutes to full
Merchant: 125 at 1.3/min      = 96 minutes to full
Paladin: 130 at 1.5/min       = 87 minutes to full
```

**Time-based calculation:**
```typescript
const minutesPassed = (Date.now() - lastRegenTime) / 60000;
const regenAmount = minutesPassed * regenRate;
const newEnergy = Math.min(current + regenAmount, maxEnergy);
```

## Reputation & progression

**Purpose:** Long-term progression that unlocks perks and bonuses.

### Reputation tiers

| Tier | Min Points | Key Perks |
|------|-----------|-----------|
| **Novice** | 0 | Basic access |
| **Amateur** | 100 | 5% buy-in discount, +5 energy, +10% daily bonus |
| **Seasoned** | 500 | 10% discount, +10 energy, +25% daily, VIP tables |
| **Professional** | 1,500 | 15% discount, +20 energy, +50% daily, Tournaments |
| **High Roller** | 5,000 | 20% discount, +30 energy, 2x daily, +10% jackpots |
| **Legend** | 15,000 | 25% discount, +50 energy, 3x daily, Special abilities |
| **Mythic** | 50,000 | 30% discount, +100 energy, 5x daily, Enhanced abilities |

### Reputation gain formula

```text
Base = bet / 10

Multipliers:
  - Jackpot: 3.0x
  - Win: 1.5x
  - Loss: 1.0x
  - Push: 0.5x
  - Game Complexity: 0.8x - 1.2x
  - High Stakes (>100): +1.2x
  - Very High Stakes (>500): +1.5x
  - Character Level: 1 + (level * 0.05)

Total = Base * (all multipliers)
```

**Examples:**
- Small bet (10 coins, win): ~2 reputation
- Medium bet (100 coins, win): ~18 reputation
- Large bet (500 coins, win): ~112 reputation
- Jackpot (500 coins): ~270 reputation

### Time to tier up (approximate)

```text
Novice → Amateur:          5-10 games (medium bets)
Amateur → Seasoned:        25-40 games
Seasoned → Professional:   50-80 games
Professional → High Roller: 200-350 games
High Roller → Legend:      600-1000 games
Legend → Mythic:           2000-3500 games
```

## Ability system

**Purpose:** Cooldown tracking and session limits for powerful abilities.

### Ability configuration

Each ability has:
- **Cooldown:** Minutes before ability can be reused
- **Session Limit:** Max uses per casino session
- **Energy Cost:** Additional energy required

### Character abilities reference

| Class | Ability | Type | Cooldown | Session Limit | Energy Cost |
|-------|---------|------|----------|---------------|-------------|
| **Warrior** | Battle Rage | Passive | 5 min | ∞ (auto) | 0 |
| **Warrior** | Battle Frenzy | Active | 15 min | 2 | 30 |
| **Mage** | Card Reading | Active | 10 min | 3 | 20 |
| **Mage** | Pattern Insight | Passive | None | ∞ | 0 |
| **Rogue** | Sleight of Hand | Passive | None | ∞ (chance) | 0 |
| **Rogue** | Probability Twist | Active | 8 min | 5 | 15 |
| **Merchant** | Coin Sense | Passive | None | ∞ | 0 |
| **Merchant** | Lucky Deal | Active | 20 min | 1 | 40 |
| **Bard** | Lucky Song | Active | 12 min | 4 | 25 |
| **Bard** | Harmony Boost | Passive | None | ∞ | 0 |
| **Paladin** | Divine Blessing | Passive | None | ∞ (auto) | 0 |
| **Paladin** | Holy Protection | Active | 30 min | 1 | 50 |

## Game integration

All casino games now integrate RPG features seamlessly.

### Blackjack integration

**Character Bonuses:**
- **Mage:** Card reading with probability calculations
- **Warrior:** Comeback mechanics after losses (+25% payout)
- **Merchant:** 20% payout bonus on wins
- **Paladin:** Loss protection (30% reduction on large losses)
- **Rogue:** Card counting simulation
- **Bard:** Harmony effects in multiplayer

### Roulette integration

**Character Bonuses:**
- **Bard:** Harmony boost (affects all players)
- **Mage:** Pattern recognition (double XP)
- **Rogue:** Probability manipulation
- **Merchant:** Coin multiplication (20% bonus)
- **Warrior:** Battle frenzy on jackpots
- **Paladin:** Divine luck protection

### Slots integration

**Character Bonuses:**
- **Mage:** Arcane insight (15% triple completion chance)
- **Merchant:** Coin sense (20% bonus)
- **Rogue:** Sleight of hand (50% loss reduction chance)
- **Paladin:** Divine blessing on losses
- **Warrior:** Battle rage after losing streaks
- **Bard:** Social bonuses with other players

### Dice integration

**Character Bonuses:**
- **Warrior:** Battle rage on high-risk bets
- **Mage:** Bonus XP for exact predictions (2x)
- **Rogue:** Loss mitigation
- **Paladin:** Divine blessing on large losses
- **Bard:** Lucky dice rolls (perfect roll chance)
- **Merchant:** Profit optimization (20% bonus)

## API endpoints reference

### Progression endpoints

#### Energy management

**Get energy status**
```http
GET /api/progression/energy
```

**Response:**
```json
{
  "current": 85,
  "max": 120,
  "regenRate": 1.3,
  "lastRegen": "2025-11-10T12:00:00Z",
  "minutesUntilFull": 27
}
```

**Restore energy (Admin)**
```http
POST /api/progression/energy/restore
```

#### Reputation management

**Get reputation status**
```http
GET /api/progression/reputation
```

**Response:**
```json
{
  "current": 2400,
  "tier": "professional",
  "nextTier": "high_roller",
  "pointsToNextTier": 2600,
  "bonuses": {
    "buyInDiscount": 0.15,
    "energyBonus": 20,
    "dailyBonusMultiplier": 1.5,
    "jackpotMultiplier": 1.0
  }
}
```

**Get all tiers**
```http
GET /api/progression/reputation/tiers
```

**Get current bonuses**
```http
GET /api/progression/reputation/bonuses
```

#### Ability management

**Get all abilities status**
```http
GET /api/progression/abilities
```

**Response:**
```json
{
  "mage_card_reading": {
    "available": true,
    "cooldownRemaining": 0,
    "usesRemaining": 2
  },
  "merchant_coin_sense": {
    "available": true,
    "cooldownRemaining": 0,
    "usesRemaining": null
  }
}
```

**Check specific ability**
```http
GET /api/progression/abilities/:abilityKey
```

#### Combined stats

**Get all progression data**
```http
GET /api/progression/stats
```

**Response:**
```json
{
  "success": true,
  "progression": {
    "energy": {
      "current": 85,
      "max": 130,
      "regenRate": 1.5,
      "minutesUntilFull": 30
    },
    "reputation": {
      "current": 2400,
      "tier": "professional",
      "nextTier": "high_roller",
      "pointsToNextTier": 2600,
      "bonuses": {
        "buyInDiscount": 0.15,
        "energyBonus": 20,
        "dailyBonusMultiplier": 1.5,
        "jackpotMultiplier": 1.0
      }
    },
    "abilities": {
      "mage_card_reading": {
        "available": true,
        "cooldownRemaining": 0,
        "usesRemaining": 2
      }
    }
  }
}
```

### Character endpoints

**Create character**
```http
POST /api/characters/create
{
  "name": "TestMage",
  "className": "mage"
}
```

**Get character info**
```http
GET /api/characters/:characterId
```

### Casino game endpoints

All casino games return enhanced responses with RPG data:

**Play Blackjack**
```http
POST /api/casino/blackjack
{
  "bet": 100,
  "strategy": "hit"
}
```

**Response:**
```json
{
  "outcome": "win",
  "finalPayout": 240,
  "xpGained": 15,
  "reputationGained": 18,
  "tierChanged": false,
  "specialAbilityTriggered": "merchant_coin_sense",
  "playerHand": [...],
  "dealerHand": [...],
  "newBalance": 1240,
  "energy": {
    "current": 82,
    "max": 130,
    "regenRate": 1.5,
    "minutesUntilFull": 32
  }
}
```

## Database schemas

### Character model

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
  lastAbilityUse: {
    [abilityKey: string]: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Casino profile model

```typescript
interface CasinoProfile {
  userId: string;
  guildId: string;
  energy: number;
  maxEnergy: number;
  lastEnergyRegen: Date;
  reputation: number;
  reputationLevel: 'novice' | 'amateur' | 'seasoned' | 'professional' | 
                   'high_roller' | 'legend' | 'mythic';
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

### Casino session model

```typescript
interface CasinoSession {
  userId: string;
  guildId: string;
  active: boolean;
  startTime: Date;
  endTime?: Date;
  abilityUsage: {
    [abilityKey: string]: number;
  };
}
```

## Implementation status

### ✅ Fully implemented

#### Services
- ✅ **AbilityService** (`/services/AbilityService.ts`)
  - Cooldown tracking for all abilities
  - Session-based usage limits
  - Energy cost management
  - 12 unique abilities across 6 classes
  - Ability availability checks
  - Automatic usage recording

- ✅ **EnergyService** (`/services/EnergyService.ts`)
  - Automatic energy regeneration (1 energy/minute base)
  - Class-based regeneration rates (1.0x - 1.5x)
  - Max energy bonuses by class (+10 to +100)
  - Dynamic energy consumption based on bet size
  - Time-based regeneration calculations

- ✅ **ReputationService** (`/services/ReputationService.ts`)
  - 7-tier progression system
  - Dynamic reputation gain calculations
  - Tier-based perks and bonuses
  - Reputation multipliers for different outcomes
  - High-stakes bonus multipliers

- ✅ **CharacterService** (`/services/CharacterService.ts`)
  - Character creation and management
  - Class definitions with bonuses
  - Level-up mechanics
  - Character info retrieval

#### Game engines
- ✅ **BlackjackEngine** - Mage card reading, Warrior comeback, Merchant bonus, Paladin protection
- ✅ **RouletteEngine** - Bard harmony, Mage pattern recognition, Merchant multiplication
- ✅ **SlotsEngine** - Mage triple completion, Merchant bonus, Rogue loss reduction
- ✅ **DiceEngine** - All class abilities integrated

#### API routes
- ✅ **Progression Routes** (`/routes/progression.ts`)
  - Energy endpoints
  - Reputation endpoints
  - Ability endpoints
  - Combined stats endpoint

- ✅ **Character Routes** (`/routes/characters.ts`)
  - Character creation
  - Character management
  - Class information

#### Database
- ✅ Character schema with ability cooldown tracking
- ✅ Casino profile schema with energy and reputation
- ✅ Session schema with ability usage tracking

### Game flow with RPG features

1. **Player joins casino** → Energy regenerates since last play
2. **Places bet** → Check energy availability
3. **Game executes** → Character abilities trigger automatically
4. **Result calculated** → Bonuses applied based on class
5. **Awards distributed:**
   - Coins updated
   - XP awarded to character
   - Reputation gained
   - Energy consumed
   - Ability cooldowns triggered
6. **Response sent** → Includes all progression data

## Testing

### Test character creation
```bash
npm run test:character
```

### Manual testing endpoints

**Create character:**
```bash
curl -X POST http://localhost:3001/api/characters/create \
  -H "Content-Type: application/json" \
  -d '{"name": "TestMage", "className": "mage"}'
```

**Check progression:**
```bash
curl http://localhost:3001/api/progression/stats
```

**Play game:**
```bash
curl -X POST http://localhost:3001/api/casino/blackjack \
  -H "Content-Type: application/json" \
  -d '{"bet": 50}'
```

## Production readiness & feature coverage

### ✅ Fully implemented features (production ready)

#### Core RPG services — 100% complete
- **CharacterService**: Character creation, stats calculation, leveling system
- **AbilityService**: Cooldown tracking, session limits, usage recording
- **EnergyService**: Auto-regeneration, consumption, class-specific bonuses
- **ReputationService**: Tier progression, bonus calculation, dynamic awards

#### Game engines — 95% complete
All 4 game engines fully integrated with RPG system:
- **BlackjackEngine**: All character bonuses implemented, including Rogue loss reduction (NEW)
- **RouletteEngine**: Social bonuses, Bard harmony boost, Mage pattern recognition
- **SlotsEngine**: Themed reels, progressive jackpots, Warrior battle rage (NEW)
- **DiceEngine**: High-risk mechanics, prediction types, all character abilities

#### Character bonuses by game

| Character Class | Blackjack | Roulette | Slots | Dice |
|-----------------|-----------|----------|-------|------|
| **Warrior** | ✅ Battle rage on high hands (≥19) | ✅ Jackpot multiplier | ✅ Comeback bonus on wins | ✅ High-risk bet bonus |
| **Mage** | ✅ Card reading advice (30%) | ✅ Pattern recognition 2x XP | ✅ Triple completion (15%) | ✅ 2x XP exact predictions |
| **Rogue** | ✅ Loss reduction (15%) | ✅ Probability manipulation | ✅ Sleight of hand (50% loss) | ✅ High-risk loss reduction |
| **Merchant** | ✅ 1.2x winnings | ✅ 1.2x winnings | ✅ 1.2x winnings | ✅ 1.2x winnings |
| **Paladin** | ✅ Divine protection | ✅ Small loss conversion | ✅ Large loss protection | ✅ Divine blessing (>100) |
| **Bard** | ⚠️ Multiplayer only | ✅ Harmony boost | ⚠️ Multiplayer only | ✅ Lucky 7 (5% chance) |

#### Database integration — 100% complete
- MongoDB schemas for all RPG features
- Persistent character progression
- Game logging with full bonus tracking
- Casino session management

#### API endpoints — 100% complete

**Character management:**
- `GET /api/characters/classes` - List all classes
- `GET /api/characters/classes/:className` - Class details
- `POST /api/characters/create` - Create character
- `GET /api/characters/me` - Get user's character
- `PUT /api/characters/level-up` - Manual level-up
- `DELETE /api/characters/me` - Delete character

**Progression system:**
- `GET /api/progression/energy` - Energy status
- `POST /api/progression/energy/restore` - Restore energy
- `GET /api/progression/reputation` - Reputation info
- `GET /api/progression/reputation/tiers` - All tiers
- `GET /api/progression/reputation/bonuses` - Current bonuses
- `GET /api/progression/abilities` - All ability statuses
- `GET /api/progression/abilities/:abilityKey` - Check specific ability
- `GET /api/progression/stats` - Combined stats

**Casino games (RPG-integrated):**
- `POST /api/games/blackjack/play` - Play blackjack with RPG bonuses
- `POST /api/games/roulette/play` - Play roulette with RPG bonuses
- `POST /api/games/slots/spin` - Spin slots with RPG bonuses
- `POST /api/games/dice/roll` - Roll dice with RPG bonuses

#### Testing — 100% complete
- ✅ `BlackjackEngine.test.ts` - 20+ test cases covering all character bonuses
- ✅ `RouletteEngine.test.ts` - 25+ test cases for bet types and abilities
- ✅ `SlotsEngine.test.ts` - 15+ test cases for reels and jackpots
- ✅ `DiceEngine.test.ts` - 20+ test cases for predictions and high-risk bets
- ✅ `character.test.ts` - Character creation and management API tests

### ⚠️ Partial implementation (future work)

#### Multiplayer casino tables — ✅ 100% complete (backend)

**Status**: Fully implemented backend infrastructure for multiplayer casino tables with real-time synchronization.

**Implemented components:**

1. **Table managers** (`/managers/`)
   - ✅ `RouletteTableManager.ts` - Complete multiplayer roulette table lifecycle
     - Create/join/leave table
     - 30-second betting rounds with 5-second warning
     - Automatic spin execution
     - State locking to prevent race conditions
     - Table cleanup on empty
   - ✅ `BlackjackTableManager.ts` - Complete turn-based blackjack
     - 2-6 players per table
     - 30-second per-action timeout
     - Auto-stand on timeout
     - Dealer turn after all players
     - Round reset and payout distribution

2. **Game engine multiplayer methods**
   - ✅ `RouletteEngine.executeMultiplayerSpin()` - Processes all player bets in single spin
     - Calculates average luck across all players
     - Applies character bonuses per player
     - Distributes Bard harmony boosts table-wide
     - Updates balances and logs results
   - ✅ `BlackjackEngine` multiplayer methods:
     - `dealInitialCards()` - Deals from 6-deck shoe
     - `processPlayerHit()` - Draw card with bust detection
     - `processPlayerStand()` - End player turn
     - `playDealerTurnMultiplayer()` - Dealer plays, calculates all payouts

3. **WebSocket event handlers** (`/websocket/socketHandlers.ts`)
   - ✅ Roulette events: `roulette:join_table`, `roulette:place_bet`, `roulette:leave_table`
   - ✅ Blackjack events: `blackjack:join_table`, `blackjack:place_bet`, `blackjack:hit`, `blackjack:stand`, `blackjack:leave_table`
   - ✅ Bard ability events: `bard:trigger_lucky_song` with table-wide broadcasts
   - ✅ JWT authentication middleware
   - ✅ Real-time game state synchronization

4. **REST API routes** (`/routes/casino.ts`)
   - ✅ `POST /api/casino/tables/roulette/create` - Create roulette table
   - ✅ `POST /api/casino/tables/blackjack/create` - Create blackjack table (2-6 players)
   - ✅ `GET /api/casino/tables/roulette` - List all active roulette tables
   - ✅ `GET /api/casino/tables/blackjack` - List all active blackjack tables
   - ✅ `GET /api/casino/tables/roulette/:tableId` - Get roulette table status
   - ✅ `GET /api/casino/tables/blackjack/:tableId` - Get blackjack table status
   - ✅ `POST /api/casino/tables/roulette/:tableId/start` - Start betting round
   - ✅ `DELETE /api/casino/tables/roulette/:tableId` - Cleanup table
   - ✅ `DELETE /api/casino/tables/blackjack/:tableId` - Cleanup table

5. **Database schemas** (`/models/schemas.ts`)
   - ✅ `BlackjackTableSchema` - Multiplayer blackjack state
     - Players array with Card objects
     - Dealer state
     - Current player index
     - Game phase tracking
   - ✅ `RouletteTableSchema` - Multiplayer roulette state
     - Players Map with bets
     - Spin timer (30s countdown)
     - Game phase (betting/spinning/payouts)
     - Last 20 spin history
   - ✅ `CasinoSessionSchema` extensions
     - `temporaryBuffs[]` - Table-wide Bard buffs
     - `abilityUsage[]` - Cooldown tracking

6. **Character bonus integration**
   - ✅ All 6 character classes work in multiplayer
   - ✅ Bard `Lucky Song` ability affects all players at table (12-minute duration)
   - ✅ Individual character bonuses applied per player:
     - Warrior: Battle frenzy on jackpots/high hands
     - Mage: Double XP for strategic bets
     - Rogue: 15% loss reduction
     - Merchant: 1.2x winnings
     - Paladin: Divine protection on losses
   - ✅ Harmony boost calculated and distributed

**Usage example:**

```typescript
// WebSocket Client Example
socket.emit('roulette:join_table', { tableId: 'table_001' });

socket.on('roulette:table_state', (state) => {
  console.log('Players:', state.playerCount);
  console.log('Phase:', state.gamePhase);
  console.log('Timer:', state.spinTimer);
});

socket.emit('roulette:place_bet', {
  tableId: 'table_001',
  bet: {
    type: 'straight',
    value: 17,
    amount: 50
  }
});

socket.on('roulette:spin_result', (result) => {
  console.log('Winning number:', result.number);
  console.log('Winners:', result.winners);
  console.log('Total payouts:', result.totalPayouts);
});

// Bard ability trigger
socket.emit('bard:trigger_lucky_song', {
  tableId: 'table_001',
  gameType: 'roulette'
});

socket.on('bard:harmony_boost_active', (data) => {
  console.log('Bard boost active for 12 minutes!');
  console.log('Affected players:', data.affectedPlayers);
});
```

**REST API example:**

```bash
# Create roulette table
curl -X POST http://localhost:3001/api/casino/tables/roulette/create \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"tableId":"table_001","minBet":10,"maxBet":1000}'

# List active tables
curl http://localhost:3001/api/casino/tables/roulette \
  -H "Authorization: Bearer ${TOKEN}"

# Get table status
curl http://localhost:3001/api/casino/tables/roulette/table_001 \
  -H "Authorization: Bearer ${TOKEN}"
```

**What's pending (frontend only):**
- Discord Activity iframe UI components
- 3D tavern visualization
- Real-time player animations
- Mobile Discord client optimization

**Recommendation**: Backend is production-ready. Frontend Discord Activity implementation is v2.0 feature.

#### Social features — 10% complete
- Community jackpot pot (contribution logic exists, distribution not implemented)
- Player-to-player interactions
- Chat integration
- Shared achievements

### 🚫 Not yet implemented (future enhancements)

- **Quest System**: Schemas exist, no quest logic
- **Item System**: Schemas exist, no equippable items
- **Guild System**: Schemas exist, no guild mechanics
- **Tournament Mode**: Planned for v3.0
- **Achievement System**: Planned for v2.5

## API migration guide

### Legacy vs new endpoints

⚠️ **IMPORTANT**: Legacy casino endpoints are **deprecated** as of November 2025.

#### Deprecated endpoints (no RPG integration)

```text
❌ POST /api/casino/slots/spin    → Returns HTTP 410 Gone
❌ POST /api/casino/dice/roll     → Returns HTTP 410 Gone
```

These endpoints provided basic gambling without:
- Character class bonuses
- Energy system
- Reputation progression
- XP gain
- Special abilities

#### New RPG-integrated endpoints

```text
✅ POST /api/games/slots/spin     → Full RPG integration
✅ POST /api/games/dice/roll      → Full RPG integration
✅ POST /api/games/blackjack/play → Full RPG integration
✅ POST /api/games/roulette/play  → Full RPG integration
```

### Migration steps

#### Step 1: Update API base path

**Old:**
```javascript
const response = await fetch('http://localhost:3001/api/casino/slots/spin', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ bet: 100 })
});
```

**New:**
```javascript
const response = await fetch('http://localhost:3001/api/games/slots/spin', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ bet: 100 })
});
```

#### Step 2: Handle enhanced response data

**Old response (legacy):**
```json
{
  "reels": ["🍒", "🍒", "🍋"],
  "result": "win",
  "payout": 200,
  "profit": 100
}
```

**New response (RPG-integrated):**
```json
{
  "outcome": "win",
  "reels": [["🍒", "🍋", "🍊"], ["🍒", "🍊", "🍇"], ["🍋", "🍊", "💎"]],
  "baseWinnings": 200,
  "bonusMultiplier": 1.2,
  "finalPayout": 240,
  "xpGained": 15,
  "specialAbilityTriggered": "merchant_coin_sense",
  "characterBonus": {
    "className": "merchant",
    "classDisplayName": "Merchant",
    "luck": 16,
    "energy": 25
  },
  "winType": "double",
  "energy": {
    "current": 88,
    "max": 125,
    "regenRate": 1.3,
    "minutesUntilFull": 28.46
  },
  "reputation": {
    "newReputation": 520,
    "gainedReputation": 20,
    "oldTier": "amateur",
    "newTier": "amateur",
    "tierChanged": false
  },
  "newLevel": 5,
  "leveledUp": false
}
```

#### Step 3: Update UI to display progression

```typescript
// Display character bonuses
if (result.specialAbilityTriggered) {
  showNotification(`${result.characterBonus.classDisplayName} ability activated!`);
}

// Show XP gain
updateXpBar(result.xpGained);

// Show energy status
updateEnergyBar(result.energy.current, result.energy.max);

// Show reputation progress
if (result.reputation.tierChanged) {
  showTierUpAnimation(result.reputation.newTier);
}
```

### Complete migration example

**Before (legacy API):**
```typescript
async function playSlots(bet: number) {
  const response = await fetch('/api/casino/slots/spin', {
    method: 'POST',
    body: JSON.stringify({ bet })
  });
  
  const data = await response.json();
  
  // Simple display
  displayReels(data.reels);
  displayPayout(data.payout);
}
```

**After (RPG-integrated API):**
```typescript
async function playSlots(bet: number) {
  const response = await fetch('/api/games/slots/spin', {
    method: 'POST',
    body: JSON.stringify({ bet })
  });
  
  const data = await response.json();
  
  // Rich RPG display
  displayReels(data.reels);
  displayPayout(data.finalPayout);
  
  // Show progression
  animateXpGain(data.xpGained);
  updateEnergyBar(data.energy.current, data.energy.max);
  
  // Show character bonus
  if (data.specialAbilityTriggered) {
    showAbilityAnimation(data.characterBonus.className, data.specialAbilityTriggered);
  }
  
  // Handle reputation changes
  if (data.reputation.tierChanged) {
    showTierUpNotification(data.reputation.newTier);
  }
  
  // Handle level up
  if (data.leveledUp) {
    showLevelUpAnimation(data.newLevel);
  }
}
```

### Error handling

**Legacy endpoint error:**
```json
{
  "error": "This endpoint is deprecated",
  "message": "Please use /api/games/slots/spin for full RPG integration",
  "migration": {
    "newEndpoint": "/api/games/slots/spin",
    "features": [
      "Character class bonuses",
      "Energy system",
      "Reputation progression",
      "XP gain",
      "Special abilities"
    ]
  }
}
```

**New endpoint errors:**
```json
{
  "success": false,
  "error": "Insufficient energy",
  "energyRequired": 5,
  "energyCurrent": 2,
  "minutesUntilEnough": 3
}
```

### Backwards compatibility

The new API is **not backwards compatible** with legacy endpoints. You must:

1. Update all API calls to use `/api/games/*` paths
2. Create a character before playing (or handle character creation flow)
3. Update UI to display RPG progression data
4. Handle energy requirements (games may fail if energy is insufficient)

### Testing your migration

```bash
# Test legacy endpoint (should return 410)
curl -X POST http://localhost:3001/api/casino/slots/spin \
  -H "Content-Type: application/json" \
  -d '{"bet": 100}'

# Test new endpoint (should work)
curl -X POST http://localhost:3001/api/games/slots/spin \
  -H "Authorization: Bearer jwt_access_token" \
  -H "Content-Type: application/json" \
  -d '{"bet": 100}'
```

## Future enhancements

### Planned features

1. **Quest System**
   - Daily quests (e.g., "Win 3 blackjack games")
   - Weekly challenges
   - Reputation rewards

2. **Achievement System**
   - Unlock special titles
   - Unique cosmetic rewards
   - Milestone bonuses

3. **Item System**
   - Equippable items (+luck, +energy, etc.)
   - Rare drops from jackpots
   - Trading between players

4. **Tournament Mode**
   - Ranked casino tournaments
   - Leaderboards
   - Prize pools

5. **Guild System**
   - Team-based casino competitions
   - Shared bonuses
   - Guild vs Guild events

## Related documentation

- [RPG Lore & World-Building](RPG_LORE.md) - The story and setting of The Golden Gnome Tavern
- [Feature Ideas](FEATURES_IDEAS.md) - Additional planned features and roadmap

## What this system provides

This RPG system is fully implemented and production-ready. It provides:

✅ **6 unique character classes** with distinct abilities  
✅ **Dynamic energy system** with regeneration  
✅ **7-tier reputation** progression with perks  
✅ **12 character abilities** with cooldown tracking  
✅ **Complete integration** with all 4 casino games  
✅ **RESTful API** for all progression features  
✅ **Database schemas** for persistent progression  
✅ **Comprehensive testing** capabilities  

Players can now enjoy a rich, strategic casino experience where character choice, resource management, and progression all matter! 🎉
