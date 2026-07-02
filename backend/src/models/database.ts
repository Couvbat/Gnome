import mongoose, { Schema, Document, Types } from 'mongoose';

// =====================
// CORE USER & CHARACTER MODELS
// =====================

export interface IUser extends Document {
  userId: string; // Discord user ID
  guildId: string; // Discord guild ID
  username: string; // Discord username
  level: number;
  xp: number;
  createdAt: Date;
  // Link to character profile
  characterId?: Types.ObjectId;
}

export interface ICharacter extends Document {
  userId: string;
  guildId: string;
  name: string;
  class: 'warrior' | 'mage' | 'rogue' | 'merchant' | 'bard' | 'paladin' | null;
  level: number;
  xp: number;
  
  // Core RPG Stats
  stats: {
    strength: number;
    intelligence: number;
    luck: number;
    charisma: number;
    vitality: number;
    dexterity: number;
    availablePoints: number;
  };
  
  // Derived Stats
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  energy: number;
  maxEnergy: number;
  lastEnergyRegen: Date;
  
  // Skills & Abilities
  skills: string[];
  availableSkillPoints: number;
  
  // Equipment
  equipment: {
    weapon?: Types.ObjectId;
    armor?: Types.ObjectId;
    accessory?: Types.ObjectId;
  };
  
  // Inventory
  inventory: Types.ObjectId[];
  
  // Character flags
  isClassChosen: boolean;
  createdAt: Date;
  lastLogin: Date;
}

// =====================
// CASINO-SPECIFIC MODELS
// =====================

export interface ICasinoProfile extends Document {
  userId: string;
  guildId: string;
  characterId: Types.ObjectId;
  
  // Energy System
  energy: number;
  maxEnergy: number;
  lastEnergyRegen: Date;
  
  // Casino Statistics
  stats: {
    totalWagered: number;
    totalWon: number;
    totalLost: number;
    biggestWin: number;
    biggestLoss: number;
    sessionsPlayed: number;
    favoriteGame: string;
  };
  
  // Casino Reputation & Progression
  reputation: number;
  reputationLevel: 'novice' | 'amateur' | 'seasoned' | 'professional' | 'high_roller' | 'legend' | 'mythic';
  
  // Casino-specific skills
  casinoSkills: {
    luckMastery: number;
    riskAssessment: number;
    socialGaming: number;
    cardCounting: number;
  };
  
  // Daily/Weekly limits and tracking
  dailyLossLimit: number;
  currentDailyLoss: number;
  lastDailyReset: Date;
  
  // Special abilities cooldowns
  cooldowns: {
    classAbility: Date | null;
    luckyCharm: Date | null;
    blessingUsed: Date | null;
  };
  
  // Achievement tracking
  achievements: string[];
  titles: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ICasinoSession extends Document {
  userId: string;
  guildId: string;
  characterId: Types.ObjectId;
  
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  
  // Session stats
  startingBalance: number;
  currentBalance: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  
  // Games played in this session
  gamesPlayed: {
    gameType: string;
    rounds: number;
    wagered: number;
    won: number;
  }[];
  
  // Location in casino
  currentTable?: string;
  currentRoom: 'main_hall' | 'blackjack_quarter' | 'arena' | 'merchant_exchange';
}

// =====================
// GAME STATE MODELS
// =====================

// Type for a player at a blackjack table
export interface IBlackjackPlayer {
  userId: string;
  characterClass: string;
  bet: number;
  hand: any[]; // Card objects
  handValue: number;
  isStanding: boolean;
  isBusted: boolean;
  hasPlacedBet: boolean;
}

// Type for the dealer
export interface IBlackjackDealer {
  hand: any[]; // Card objects
  handValue: number;
  isStanding: boolean;
  isBusted: boolean;
}

export interface IBlackjackTable extends Document {
  tableId: string;
  guildId: string;
  
  // Table configuration
  minBet: number;
  maxBet: number;
  maxPlayers: number;
  
  // Current game state
  gamePhase: 'betting' | 'playing' | 'dealer_turn' | 'finished';
  currentPlayerIndex: number;
  actionTimer: number | null;
  
  // Players at table
  players: IBlackjackPlayer[];
  
  // Dealer
  dealer: IBlackjackDealer;
  
  // Deck state
  deck: any[]; // Remaining Card objects
  
  createdAt: Date;
  lastActivity: Date;
}

export interface IRouletteTable extends Document {
  tableId: string;
  guildId: string;
  
  // Game state
  isActive: boolean;
  gamePhase: 'betting' | 'spinning' | 'payouts' | 'waiting';
  spinTimer: number;
  spinStartTime?: Date;
  
  // Current spin
  currentSpin?: {
    result: number;
    color: 'red' | 'black' | 'green';
    even: boolean;
    high: boolean; // 19-36
  };
  
  // Player bets for current round
  bets: {
    userId: string;
    characterId: Types.ObjectId;
    bets: {
      type: 'number' | 'red' | 'black' | 'even' | 'odd' | 'high' | 'low' | 'dozen' | 'column';
      value: number | string;
      amount: number;
    }[];
    totalWagered: number;
  }[];
  
  // History
  lastResults: number[];
  
  // Active players and spectators
  activePlayers: string[];
  spectators: string[];
  
  createdAt: Date;
  lastActivity: Date;
}

export interface ISlotMachine extends Document {
  machineId: string;
  guildId: string;
  
  // Machine configuration
  name: string;
  theme: 'classic' | 'dragon' | 'magic' | 'warrior' | 'rogue' | 'merchant';
  minBet: number;
  maxBet: number;
  
  // Progressive jackpot
  progressiveJackpot: number;
  jackpotContribution: number; // Percentage of each bet
  lastJackpotWin?: Date;
  jackpotWinner?: string;
  
  // Current player
  currentPlayer?: {
    userId: string;
    characterId: Types.ObjectId;
    currentBet: number;
    spinsLeft: number;
  };
  
  // Machine state
  isActive: boolean;
  isInMaintenance: boolean;
  
  // Statistics
  totalCoinsIn: number;
  totalCoinsOut: number;
  totalSpins: number;
  payoutPercentage: number;
  
  createdAt: Date;
  lastActivity: Date;
}

// =====================
// QUEST & EVENT MODELS
// =====================

// Type for quest objectives
export interface IQuestObjective {
  type: 'win_games' | 'wager_amount' | 'visit_location' | 'social_action' | 'item_collect';
  target: string | number;
  current?: number;
  required: number;
  description: string;
}

// Type for quest progress tracking
export interface IQuestProgressItem {
  objectiveId: number;
  current: number;
  completed: boolean;
}

export interface IQuest extends Document {
  questId: string;
  guildId: string;
  
  // Quest details
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'story' | 'repeatable' | 'event' | 'guild';
  category: 'casino' | 'social' | 'combat' | 'exploration';
  
  // Requirements
  requirements: {
    level?: number;
    class?: string[];
    previousQuests?: string[];
    items?: string[];
    reputation?: number;
  };
  
  // Objectives
  objectives: IQuestObjective[];
  
  // Rewards
  rewards: {
    coins: number;
    xp: number;
    items?: string[];
    reputation?: number;
    titles?: string[];
    unlocks?: string[];
  };
  
  // Availability
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  maxCompletions?: number;
  
  // Story quest chain
  chainId?: string;
  previousQuest?: string;
  nextQuest?: string;
  
  createdAt: Date;
}

export interface IUserQuest extends Document {
  userId: string;
  guildId: string;
  questId: string;
  characterId: Types.ObjectId;
  
  // Progress tracking
  status: 'available' | 'active' | 'completed' | 'failed' | 'abandoned';
  progress: IQuestProgressItem[];
  
  // Timestamps
  startedAt?: Date;
  completedAt?: Date;
  lastUpdate: Date;
  
  // Additional data
  completionCount: number; // For repeatable quests
}

// =====================
// GUILD & SOCIAL MODELS
// =====================

export interface IGuild extends Document {
  guildId: string; // Discord guild ID
  discordGuildId: string;
  
  // Guild info
  name: string;
  description: string;
  level: number;
  experience: number;
  
  // Guild stats
  totalMembers: number;
  totalCoins: number;
  totalCasinoWinnings: number;
  
  // Guild features
  features: {
    casinoHall: boolean;
    privateEvents: boolean;
    exclusiveQuests: boolean;
    customRooms: boolean;
  };
  
  // Guild settings
  settings: {
    joinRequirement: 'open' | 'invite' | 'application';
    minLevel: number;
    weeklyTax: number;
    casinoTaxRate: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IGuildMember extends Document {
  userId: string;
  guildId: string;
  characterId: Types.ObjectId;
  
  // Member status
  rank: 'member' | 'officer' | 'leader';
  joinedAt: Date;
  lastActive: Date;
  
  // Contributions
  coinsContributed: number;
  questsCompleted: number;
  casinoWinningsShared: number;
  
  // Guild-specific achievements
  guildAchievements: string[];
  
  // Permissions
  permissions: {
    inviteMembers: boolean;
    manageEvents: boolean;
    accessTreasury: boolean;
    moderateChat: boolean;
  };
}

// =====================
// ITEMS & INVENTORY MODELS
// =====================

export interface IItem extends Document {
  itemId: string;
  
  // Basic info
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'quest' | 'casino_chip' | 'lucky_charm';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  
  // Stats and effects
  stats?: {
    strength?: number;
    intelligence?: number;
    luck?: number;
    charisma?: number;
    vitality?: number;
    dexterity?: number;
  };
  
  // Casino-specific effects
  casinoEffects?: {
    luckBonus?: number;
    winMultiplier?: number;
    lossReduction?: number;
    energyCostReduction?: number;
    specialAbility?: string;
  };
  
  // Item properties
  stackable: boolean;
  maxStack?: number;
  durability?: number;
  value: number;
  
  // Acquisition
  obtainableMethods: string[];
  dropChance?: number;
  shopPrice?: number;
  
  // Requirements
  requirements?: {
    level?: number;
    class?: string[];
    reputation?: number;
  };
  
  // Visual
  icon: string;
  color: string;
  
  createdAt: Date;
}

export interface IUserInventory extends Document {
  userId: string;
  guildId: string;
  characterId: Types.ObjectId;
  
  items: {
    itemId: string;
    quantity: number;
    durability?: number;
    acquiredAt: Date;
    isEquipped: boolean;
    slot?: 'weapon' | 'armor' | 'accessory';
  }[];
  
  // Inventory limits
  maxSlots: number;
  usedSlots: number;
  
  updatedAt: Date;
}

// =====================
// EVENTS & TOURNAMENTS
// =====================

export interface ICasinoEvent extends Document {
  eventId: string;
  guildId: string;
  
  // Event details
  name: string;
  description: string;
  type: 'tournament' | 'bonus' | 'jackpot' | 'class_challenge' | 'guild_war';
  gameType?: 'blackjack' | 'roulette' | 'slots' | 'all';
  
  // Timing
  startTime: Date;
  endTime: Date;
  registrationStart: Date;
  registrationEnd: Date;
  
  // Participation
  participants: {
    userId: string;
    characterId: Types.ObjectId;
    registeredAt: Date;
    score?: number;
    rank?: number;
    eliminated?: boolean;
  }[];
  
  maxParticipants?: number;
  entryFee?: number;
  
  // Rewards
  prizePool: number;
  rewards: {
    rank: number;
    coins: number;
    items?: string[];
    titles?: string[];
  }[];
  
  // Event modifiers
  modifiers?: {
    luckBonus?: number;
    xpMultiplier?: number;
    coinMultiplier?: number;
  };
  
  // Status
  status: 'scheduled' | 'registration' | 'active' | 'completed' | 'cancelled';
  
  createdAt: Date;
}

// =====================
// ANALYTICS & LOGS
// =====================

export interface ICasinoGameLog extends Document {
  logId: string;
  userId: string;
  guildId: string;
  characterId: Types.ObjectId;
  sessionId: string;
  
  // Game details
  gameType: 'blackjack' | 'roulette' | 'slots' | 'dice';
  tableId?: string;
  gameId: string;
  
  // Outcome
  bet: number;
  result: 'win' | 'loss' | 'push';
  payout: number;
  netChange: number;
  
  // Game-specific data
  gameData: any; // Flexible for different game types
  
  // Context
  characterClass: string;
  characterLevel: number;
  characterLuck: number;
  
  // Bonuses applied
  bonuses: {
    type: string;
    value: number;
    source: string;
  }[];
  
  timestamp: Date;
}

export interface ICasinoAnalytics extends Document {
  guildId: string;
  date: Date;
  
  // Daily aggregates
  totalPlayers: number;
  totalSessions: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  houseEdge: number;
  
  // Game breakdown
  gameStats: {
    gameType: string;
    players: number;
    sessions: number;
    wagered: number;
    paidOut: number;
    houseEdge: number;
  }[];
  
  // Class performance
  classStats: {
    className: string;
    players: number;
    avgWinRate: number;
    totalWagered: number;
  }[];
  
  // Top performers
  topWinners: {
    userId: string;
    characterId: Types.ObjectId;
    winnings: number;
  }[];
  
  createdAt: Date;
}

// =====================
// NPC & LORE MODELS
// =====================

export interface INPCState extends Document {
  npcId: string;
  guildId: string;
  
  // NPC details
  name: string;
  type: 'dealer' | 'quest_giver' | 'merchant' | 'entertainer' | 'guard';
  location: string;
  
  // Current state
  isActive: boolean;
  currentDialogue?: string;
  mood: 'happy' | 'neutral' | 'grumpy' | 'excited';
  
  // Interaction counts
  dailyInteractions: number;
  totalInteractions: number;
  
  // Special states
  specialEvents: string[];
  temporaryModifiers?: any;
  
  lastInteraction: Date;
  updatedAt: Date;
}

// =====================
// SCHEMA DEFINITIONS
// =====================

const UserSchema = new Schema<IUser>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  username: { type: String, default: 'Unknown User' },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character' }
});

const CharacterSchema = new Schema<ICharacter>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  class: { 
    type: String, 
    enum: ['warrior', 'mage', 'rogue', 'merchant', 'bard', 'paladin', null],
    default: null 
  },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  stats: {
    strength: { type: Number, default: 10 },
    intelligence: { type: Number, default: 10 },
    luck: { type: Number, default: 10 },
    charisma: { type: Number, default: 10 },
    vitality: { type: Number, default: 10 },
    dexterity: { type: Number, default: 10 },
    availablePoints: { type: Number, default: 0 }
  },
  hp: { type: Number, default: 100 },
  maxHp: { type: Number, default: 100 },
  mp: { type: Number, default: 50 },
  maxMp: { type: Number, default: 50 },
  energy: { type: Number, default: 100 },
  maxEnergy: { type: Number, default: 100 },
  lastEnergyRegen: { type: Date, default: Date.now },
  skills: [{ type: String }],
  availableSkillPoints: { type: Number, default: 0 },
  equipment: {
    weapon: { type: Schema.Types.ObjectId, ref: 'Item' },
    armor: { type: Schema.Types.ObjectId, ref: 'Item' },
    accessory: { type: Schema.Types.ObjectId, ref: 'Item' }
  },
  inventory: [{ type: Schema.Types.ObjectId, ref: 'UserInventory' }],
  isClassChosen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

const CasinoProfileSchema = new Schema<ICasinoProfile>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: false },
  energy: { type: Number, default: 100 },
  maxEnergy: { type: Number, default: 100 },
  lastEnergyRegen: { type: Date, default: Date.now },
  stats: {
    totalWagered: { type: Number, default: 0 },
    totalWon: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },
    biggestWin: { type: Number, default: 0 },
    biggestLoss: { type: Number, default: 0 },
    sessionsPlayed: { type: Number, default: 0 },
    favoriteGame: { type: String, default: 'blackjack' }
  },
  reputation: { type: Number, default: 0 },
  reputationLevel: { 
    type: String, 
    enum: ['novice', 'amateur', 'seasoned', 'professional', 'high_roller', 'legend', 'mythic'],
    default: 'novice'
  },
  casinoSkills: {
    luckMastery: { type: Number, default: 0 },
    riskAssessment: { type: Number, default: 0 },
    socialGaming: { type: Number, default: 0 },
    cardCounting: { type: Number, default: 0 }
  },
  dailyLossLimit: { type: Number, default: 5000 },
  currentDailyLoss: { type: Number, default: 0 },
  lastDailyReset: { type: Date, default: Date.now },
  cooldowns: {
    classAbility: { type: Date, default: null },
    luckyCharm: { type: Date, default: null },
    blessingUsed: { type: Date, default: null }
  },
  achievements: [{ type: String }],
  titles: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for performance
UserSchema.index({ userId: 1, guildId: 1 }, { unique: true });
CharacterSchema.index({ userId: 1, guildId: 1 }, { unique: true });
CasinoProfileSchema.index({ userId: 1, guildId: 1 }, { unique: true });

// =====================
// SHARED ECONOMY (bot <-> backend)
// =====================
// Points at the `userlevels` collection owned by the Discord bot (bot/database/db.ts),
// so coin balances and the daily-bonus claim are shared between the bot and this backend.
// strict:false because that collection also holds bot-only fields (xp, level, totalMessages,
// birthday, etc.) this schema must never declare or overwrite.

export interface ISharedEconomy extends Document {
  userId: string;
  guildId: string;
  coins: number;
  coinsAllTimeHigh: number;
  lastDailyTimestamp: number;
}

const SharedEconomySchema = new Schema<ISharedEconomy>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  coins: { type: Number, default: 100 },
  coinsAllTimeHigh: { type: Number, default: 100 },
  lastDailyTimestamp: { type: Number, default: 0 }
}, { strict: false, collection: 'userlevels' });

// Export models (check if already compiled to prevent OverwriteModelError in tests)
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Character = mongoose.models.Character || mongoose.model<ICharacter>('Character', CharacterSchema);
export const CasinoProfile = mongoose.models.CasinoProfile || mongoose.model<ICasinoProfile>('CasinoProfile', CasinoProfileSchema);
export const SharedEconomy = mongoose.models.SharedEconomy || mongoose.model<ISharedEconomy>('SharedEconomy', SharedEconomySchema);

// Additional schemas would be defined here following the same pattern
// For brevity, I'm including the main ones that demonstrate the structure