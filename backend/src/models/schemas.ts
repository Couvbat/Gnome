import mongoose, { Schema } from 'mongoose';
import { 
  IBlackjackTable, 
  IRouletteTable, 
  ISlotMachine,
  IQuest,
  IUserQuest,
  IGuild,
  IGuildMember,
  IItem,
  IUserInventory,
  ICasinoEvent,
  ICasinoGameLog,
  ICasinoAnalytics,
  INPCState
} from './database';

// =====================
// GAME STATE SCHEMAS
// =====================

const BlackjackTableSchema = new Schema<IBlackjackTable>({
  tableId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  minBet: { type: Number, default: 10 },
  maxBet: { type: Number, default: 1000 },
  maxPlayers: { type: Number, default: 6 },
  gamePhase: { 
    type: String, 
    enum: ['betting', 'playing', 'dealer_turn', 'finished'],
    default: 'betting'
  },
  currentPlayerIndex: { type: Number, default: 0 },
  actionTimer: { type: Number, default: null },
  players: [{
    userId: { type: String, required: true },
    characterClass: { type: String, default: 'default' },
    bet: { type: Number, default: 0 },
    hand: [{ type: Schema.Types.Mixed }], // Store Card objects
    handValue: { type: Number, default: 0 },
    isStanding: { type: Boolean, default: false },
    isBusted: { type: Boolean, default: false },
    hasPlacedBet: { type: Boolean, default: false }
  }],
  dealer: {
    hand: [{ type: Schema.Types.Mixed }], // Store Card objects
    handValue: { type: Number, default: 0 },
    isStanding: { type: Boolean, default: false },
    isBusted: { type: Boolean, default: false }
  },
  deck: [{ type: Schema.Types.Mixed }], // Store remaining Card objects
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
});

const RouletteTableSchema = new Schema<IRouletteTable>({
  tableId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  gamePhase: { 
    type: String, 
    enum: ['betting', 'spinning', 'payouts', 'waiting'],
    default: 'waiting'
  },
  spinTimer: { type: Number, default: 30 },
  spinStartTime: { type: Date },
  currentSpin: {
    result: { type: Number },
    color: { type: String, enum: ['red', 'black', 'green'] },
    even: { type: Boolean },
    high: { type: Boolean }
  },
  bets: [{
    userId: { type: String, required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    bets: [{
      type: { 
        type: String, 
        enum: ['number', 'red', 'black', 'even', 'odd', 'high', 'low', 'dozen', 'column'],
        required: true
      },
      value: { type: Schema.Types.Mixed, required: true },
      amount: { type: Number, required: true }
    }],
    totalWagered: { type: Number, required: true }
  }],
  lastResults: [{ type: Number }],
  activePlayers: [{ type: String }],
  spectators: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
});

const SlotMachineSchema = new Schema<ISlotMachine>({
  machineId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  theme: { 
    type: String, 
    enum: ['classic', 'dragon', 'magic', 'warrior', 'rogue', 'merchant'],
    default: 'classic'
  },
  minBet: { type: Number, default: 10 },
  maxBet: { type: Number, default: 500 },
  progressiveJackpot: { type: Number, default: 10000 },
  jackpotContribution: { type: Number, default: 0.01 }, // 1% of each bet
  lastJackpotWin: { type: Date },
  jackpotWinner: { type: String },
  currentPlayer: {
    userId: { type: String },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    currentBet: { type: Number },
    spinsLeft: { type: Number }
  },
  isActive: { type: Boolean, default: true },
  isInMaintenance: { type: Boolean, default: false },
  totalCoinsIn: { type: Number, default: 0 },
  totalCoinsOut: { type: Number, default: 0 },
  totalSpins: { type: Number, default: 0 },
  payoutPercentage: { type: Number, default: 0.92 }, // 92% RTP
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
});

// =====================
// QUEST SYSTEM SCHEMAS
// =====================

const QuestSchema = new Schema<IQuest>({
  questId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['daily', 'weekly', 'story', 'repeatable', 'event', 'guild'],
    required: true
  },
  category: { 
    type: String, 
    enum: ['casino', 'social', 'combat', 'exploration'],
    required: true
  },
  requirements: {
    level: { type: Number },
    class: [{ type: String }],
    previousQuests: [{ type: String }],
    items: [{ type: String }],
    reputation: { type: Number }
  },
  objectives: [{
    type: { 
      type: String, 
      enum: ['win_games', 'wager_amount', 'visit_location', 'social_action', 'item_collect'],
      required: true
    },
    target: { type: Schema.Types.Mixed, required: true },
    current: { type: Number, default: 0 },
    required: { type: Number, required: true },
    description: { type: String, required: true }
  }],
  rewards: {
    coins: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    items: [{ type: String }],
    reputation: { type: Number, default: 0 },
    titles: [{ type: String }],
    unlocks: [{ type: String }]
  },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date },
  endDate: { type: Date },
  maxCompletions: { type: Number },
  chainId: { type: String },
  previousQuest: { type: String },
  nextQuest: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const UserQuestSchema = new Schema<IUserQuest>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  questId: { type: String, required: true },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  status: { 
    type: String, 
    enum: ['available', 'active', 'completed', 'failed', 'abandoned'],
    default: 'available'
  },
  progress: [{
    objectiveId: { type: Number, required: true },
    current: { type: Number, default: 0 },
    completed: { type: Boolean, default: false }
  }],
  startedAt: { type: Date },
  completedAt: { type: Date },
  lastUpdate: { type: Date, default: Date.now },
  completionCount: { type: Number, default: 0 }
});

// =====================
// GUILD SYSTEM SCHEMAS
// =====================

const GuildSchema = new Schema<IGuild>({
  guildId: { type: String, required: true, unique: true },
  discordGuildId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  totalMembers: { type: Number, default: 0 },
  totalCoins: { type: Number, default: 0 },
  totalCasinoWinnings: { type: Number, default: 0 },
  features: {
    casinoHall: { type: Boolean, default: false },
    privateEvents: { type: Boolean, default: false },
    exclusiveQuests: { type: Boolean, default: false },
    customRooms: { type: Boolean, default: false }
  },
  settings: {
    joinRequirement: { 
      type: String, 
      enum: ['open', 'invite', 'application'],
      default: 'open'
    },
    minLevel: { type: Number, default: 1 },
    weeklyTax: { type: Number, default: 0 },
    casinoTaxRate: { type: Number, default: 0.05 } // 5% tax on winnings
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const GuildMemberSchema = new Schema<IGuildMember>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  rank: { 
    type: String, 
    enum: ['member', 'officer', 'leader'],
    default: 'member'
  },
  joinedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  coinsContributed: { type: Number, default: 0 },
  questsCompleted: { type: Number, default: 0 },
  casinoWinningsShared: { type: Number, default: 0 },
  guildAchievements: [{ type: String }],
  permissions: {
    inviteMembers: { type: Boolean, default: false },
    manageEvents: { type: Boolean, default: false },
    accessTreasury: { type: Boolean, default: false },
    moderateChat: { type: Boolean, default: false }
  }
});

// =====================
// ITEM SYSTEM SCHEMAS
// =====================

const ItemSchema = new Schema<IItem>({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['weapon', 'armor', 'accessory', 'consumable', 'quest', 'casino_chip', 'lucky_charm'],
    required: true
  },
  rarity: { 
    type: String, 
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  stats: {
    strength: { type: Number, default: 0 },
    intelligence: { type: Number, default: 0 },
    luck: { type: Number, default: 0 },
    charisma: { type: Number, default: 0 },
    vitality: { type: Number, default: 0 },
    dexterity: { type: Number, default: 0 }
  },
  casinoEffects: {
    luckBonus: { type: Number, default: 0 },
    winMultiplier: { type: Number, default: 1.0 },
    lossReduction: { type: Number, default: 0 },
    energyCostReduction: { type: Number, default: 0 },
    specialAbility: { type: String }
  },
  stackable: { type: Boolean, default: false },
  maxStack: { type: Number, default: 1 },
  durability: { type: Number },
  value: { type: Number, required: true },
  obtainableMethods: [{ type: String }],
  dropChance: { type: Number },
  shopPrice: { type: Number },
  requirements: {
    level: { type: Number },
    class: [{ type: String }],
    reputation: { type: Number }
  },
  icon: { type: String, required: true },
  color: { type: String, default: '#ffffff' },
  createdAt: { type: Date, default: Date.now }
});

const UserInventorySchema = new Schema<IUserInventory>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  items: [{
    itemId: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    durability: { type: Number },
    acquiredAt: { type: Date, default: Date.now },
    isEquipped: { type: Boolean, default: false },
    slot: { 
      type: String, 
      enum: ['weapon', 'armor', 'accessory']
    }
  }],
  maxSlots: { type: Number, default: 50 },
  usedSlots: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// =====================
// EVENT SYSTEM SCHEMAS
// =====================

const CasinoEventSchema = new Schema<ICasinoEvent>({
  eventId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['tournament', 'bonus', 'jackpot', 'class_challenge', 'guild_war'],
    required: true
  },
  gameType: { 
    type: String, 
    enum: ['blackjack', 'roulette', 'slots', 'all']
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  registrationStart: { type: Date, required: true },
  registrationEnd: { type: Date, required: true },
  participants: [{
    userId: { type: String, required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    registeredAt: { type: Date, default: Date.now },
    score: { type: Number, default: 0 },
    rank: { type: Number },
    eliminated: { type: Boolean, default: false }
  }],
  maxParticipants: { type: Number },
  entryFee: { type: Number, default: 0 },
  prizePool: { type: Number, default: 0 },
  rewards: [{
    rank: { type: Number, required: true },
    coins: { type: Number, required: true },
    items: [{ type: String }],
    titles: [{ type: String }]
  }],
  modifiers: {
    luckBonus: { type: Number, default: 0 },
    xpMultiplier: { type: Number, default: 1.0 },
    coinMultiplier: { type: Number, default: 1.0 }
  },
  status: { 
    type: String, 
    enum: ['scheduled', 'registration', 'active', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  createdAt: { type: Date, default: Date.now }
});

// =====================
// ANALYTICS SCHEMAS
// =====================

const CasinoGameLogSchema = new Schema<ICasinoGameLog>({
  logId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: false },
  sessionId: { type: String, required: true },
  gameType: { 
    type: String, 
    enum: ['blackjack', 'roulette', 'slots', 'dice'],
    required: true
  },
  tableId: { type: String },
  gameId: { type: String, required: true },
  bet: { type: Number, required: true },
  result: { 
    type: String, 
    enum: ['win', 'loss', 'push'],
    required: true
  },
  payout: { type: Number, required: true },
  netChange: { type: Number, required: true },
  gameData: { type: Schema.Types.Mixed },
  characterClass: { type: String, required: true },
  characterLevel: { type: Number, required: true },
  characterLuck: { type: Number, required: true },
  bonuses: [{
    type: { type: String, required: true },
    value: { type: Number, required: true },
    source: { type: String, required: true }
  }],
  timestamp: { type: Date, default: Date.now }
});

const CasinoAnalyticsSchema = new Schema<ICasinoAnalytics>({
  guildId: { type: String, required: true },
  date: { type: Date, required: true },
  totalPlayers: { type: Number, default: 0 },
  totalSessions: { type: Number, default: 0 },
  totalWagered: { type: Number, default: 0 },
  totalWon: { type: Number, default: 0 },
  totalLost: { type: Number, default: 0 },
  houseEdge: { type: Number, default: 0 },
  gameStats: [{
    gameType: { type: String, required: true },
    players: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    wagered: { type: Number, default: 0 },
    paidOut: { type: Number, default: 0 },
    houseEdge: { type: Number, default: 0 }
  }],
  classStats: [{
    className: { type: String, required: true },
    players: { type: Number, default: 0 },
    avgWinRate: { type: Number, default: 0 },
    totalWagered: { type: Number, default: 0 }
  }],
  topWinners: [{
    userId: { type: String, required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    winnings: { type: Number, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

// =====================
// NPC & LORE SCHEMAS
// =====================

const NPCStateSchema = new Schema<INPCState>({
  npcId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['dealer', 'quest_giver', 'merchant', 'entertainer', 'guard'],
    required: true
  },
  location: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  currentDialogue: { type: String },
  mood: { 
    type: String, 
    enum: ['happy', 'neutral', 'grumpy', 'excited'],
    default: 'neutral'
  },
  dailyInteractions: { type: Number, default: 0 },
  totalInteractions: { type: Number, default: 0 },
  specialEvents: [{ type: String }],
  temporaryModifiers: { type: Schema.Types.Mixed },
  lastInteraction: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// =====================
// ADDITIONAL SCHEMAS
// =====================

const CasinoSessionSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  sessionId: { type: String, required: true, unique: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  isActive: { type: Boolean, default: true },
  startingBalance: { type: Number, required: true },
  currentBalance: { type: Number, required: true },
  totalWagered: { type: Number, default: 0 },
  totalWon: { type: Number, default: 0 },
  totalLost: { type: Number, default: 0 },
  gamesPlayed: [{
    gameType: { type: String, required: true },
    rounds: { type: Number, default: 0 },
    wagered: { type: Number, default: 0 },
    won: { type: Number, default: 0 }
  }],
  currentTable: { type: String },
  currentRoom: { 
    type: String, 
    enum: ['main_hall', 'blackjack_quarter', 'arena', 'merchant_exchange'],
    default: 'main_hall'
  },
  temporaryBuffs: [{
    type: { type: String, required: true },
    source: { type: String, required: true }, // userId of buff source (e.g., Bard)
    value: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    appliedAt: { type: Date, default: Date.now }
  }],
  abilityUsage: [{
    abilityKey: { type: String, required: true },
    usedAt: { type: Date, default: Date.now },
    count: { type: Number, default: 1 }
  }]
});

// =====================
// INDEX DEFINITIONS
// =====================

// Performance indexes
BlackjackTableSchema.index({ guildId: 1, isActive: 1 });
RouletteTableSchema.index({ guildId: 1, isActive: 1 });
SlotMachineSchema.index({ guildId: 1, isActive: 1 });
QuestSchema.index({ guildId: 1, type: 1, isActive: 1 });
UserQuestSchema.index({ userId: 1, guildId: 1, status: 1 });
GuildSchema.index({ discordGuildId: 1 }, { unique: true });
GuildMemberSchema.index({ userId: 1, guildId: 1 }, { unique: true });
ItemSchema.index({ type: 1, rarity: 1 });
UserInventorySchema.index({ userId: 1, guildId: 1 }, { unique: true });
CasinoEventSchema.index({ guildId: 1, status: 1, startTime: 1 });
CasinoGameLogSchema.index({ userId: 1, timestamp: -1 });
CasinoGameLogSchema.index({ guildId: 1, gameType: 1, timestamp: -1 });
CasinoAnalyticsSchema.index({ guildId: 1, date: -1 }, { unique: true });
NPCStateSchema.index({ guildId: 1, type: 1, isActive: 1 });
CasinoSessionSchema.index({ userId: 1, isActive: 1 });
CasinoSessionSchema.index({ guildId: 1, startTime: -1 });

// =====================
// MODEL EXPORTS
// =====================

// Check if models already exist to prevent OverwriteModelError in tests
export const BlackjackTable = mongoose.models.BlackjackTable || mongoose.model<IBlackjackTable>('BlackjackTable', BlackjackTableSchema);
export const RouletteTable = mongoose.models.RouletteTable || mongoose.model<IRouletteTable>('RouletteTable', RouletteTableSchema);
export const SlotMachine = mongoose.models.SlotMachine || mongoose.model<ISlotMachine>('SlotMachine', SlotMachineSchema);
export const Quest = mongoose.models.Quest || mongoose.model<IQuest>('Quest', QuestSchema);
export const UserQuest = mongoose.models.UserQuest || mongoose.model<IUserQuest>('UserQuest', UserQuestSchema);
export const Guild = mongoose.models.Guild || mongoose.model<IGuild>('Guild', GuildSchema);
export const GuildMember = mongoose.models.GuildMember || mongoose.model<IGuildMember>('GuildMember', GuildMemberSchema);
export const Item = mongoose.models.Item || mongoose.model<IItem>('Item', ItemSchema);
export const UserInventory = mongoose.models.UserInventory || mongoose.model<IUserInventory>('UserInventory', UserInventorySchema);
export const CasinoEvent = mongoose.models.CasinoEvent || mongoose.model<ICasinoEvent>('CasinoEvent', CasinoEventSchema);
export const CasinoGameLog = mongoose.models.CasinoGameLog || mongoose.model<ICasinoGameLog>('CasinoGameLog', CasinoGameLogSchema);
export const CasinoAnalytics = mongoose.models.CasinoAnalytics || mongoose.model<ICasinoAnalytics>('CasinoAnalytics', CasinoAnalyticsSchema);
export const NPCState = mongoose.models.NPCState || mongoose.model<INPCState>('NPCState', NPCStateSchema);
export const CasinoSession = mongoose.models.CasinoSession || mongoose.model('CasinoSession', CasinoSessionSchema);

// =====================
// UTILITY FUNCTIONS
// =====================

export class DatabaseSeeder {
  static async seedInitialData(guildId: string) {
    // Seed default NPCs
    const defaultNPCs = [
      {
        npcId: 'grimwald_blackjack',
        guildId,
        name: 'Grimwald the Half-Orc',
        type: 'dealer',
        location: 'blackjack_quarter',
        mood: 'neutral'
      },
      {
        npcId: 'mystara_roulette',
        guildId,
        name: 'Madame Mystara',
        type: 'dealer',
        location: 'main_hall',
        mood: 'mysterious'
      },
      {
        npcId: 'cogsworth_slots',
        guildId,
        name: 'Cogsworth',
        type: 'dealer',
        location: 'main_hall',
        mood: 'mechanical'
      },
      {
        npcId: 'luna_silvervoice',
        guildId,
        name: 'Luna Silvervoice',
        type: 'entertainer',
        location: 'performance_stage',
        mood: 'cheerful'
      },
      {
        npcId: 'brother_benedictus',
        guildId,
        name: 'Brother Benedictus',
        type: 'quest_giver',
        location: 'chapel',
        mood: 'serene'
      },
      {
        npcId: 'captain_ironforge',
        guildId,
        name: 'Captain Ironforge',
        type: 'quest_giver',
        location: 'arena',
        mood: 'battle_ready'
      }
    ];

    for (const npcData of defaultNPCs) {
      await NPCState.findOneAndUpdate(
        { npcId: npcData.npcId, guildId },
        npcData,
        { upsert: true, new: true }
      );
    }

    // Seed default slot machines
    const defaultSlotMachines = [
      {
        machineId: 'dragon_fortune_1',
        guildId,
        name: 'Dragon\'s Fortune',
        theme: 'dragon',
        minBet: 10,
        maxBet: 500,
        progressiveJackpot: 50000
      },
      {
        machineId: 'arcane_reels_1',
        guildId,
        name: 'Arcane Reels',
        theme: 'magic',
        minBet: 25,
        maxBet: 1000,
        progressiveJackpot: 100000
      },
      {
        machineId: 'warrior_wilds_1',
        guildId,
        name: 'Warrior\'s Wilds',
        theme: 'warrior',
        minBet: 50,
        maxBet: 2000,
        progressiveJackpot: 250000
      }
    ];

    for (const machineData of defaultSlotMachines) {
      await SlotMachine.findOneAndUpdate(
        { machineId: machineData.machineId, guildId },
        machineData,
        { upsert: true, new: true }
      );
    }

    // Seed default blackjack tables
    const defaultTables = [
      {
        tableId: 'warrior_den_1',
        guildId,
        name: 'Warrior\'s Honor Table',
        theme: 'warrior_den',
        minBet: 50,
        maxBet: 2000
      },
      {
        tableId: 'sage_study_1',
        guildId,
        name: 'Scholar\'s Wisdom Table',
        theme: 'sage_study',
        minBet: 25,
        maxBet: 1000
      },
      {
        tableId: 'rogue_corner_1',
        guildId,
        name: 'Shadow\'s Edge Table',
        theme: 'rogue_corner',
        minBet: 100,
        maxBet: 5000
      }
    ];

    for (const tableData of defaultTables) {
      await BlackjackTable.findOneAndUpdate(
        { tableId: tableData.tableId, guildId },
        tableData,
        { upsert: true, new: true }
      );
    }

    // Seed roulette table
    await RouletteTable.findOneAndUpdate(
      { tableId: 'roulette_of_fate', guildId },
      {
        tableId: 'roulette_of_fate',
        guildId,
        spinTimer: 30,
        lastResults: []
      },
      { upsert: true, new: true }
    );

    console.log(`Seeded initial casino data for guild ${guildId}`);
  }

  static async seedDefaultItems() {
    const defaultItems = [
      // Lucky Charms
      {
        itemId: 'rabbit_foot',
        name: 'Lucky Rabbit\'s Foot',
        description: 'A tiny charm that brings good fortune in games of chance.',
        type: 'lucky_charm',
        rarity: 'common',
        casinoEffects: { luckBonus: 5 },
        value: 100,
        obtainableMethods: ['casino_daily_quest', 'shop'],
        icon: '🐰'
      },
      {
        itemId: 'golden_coin',
        name: 'Aurelius\'s Golden Coin',
        description: 'A blessed coin from the legendary founder himself.',
        type: 'lucky_charm',
        rarity: 'epic',
        casinoEffects: { luckBonus: 15, winMultiplier: 1.1 },
        value: 5000,
        obtainableMethods: ['big_jackpot', 'special_event'],
        icon: '🪙'
      },
      {
        itemId: 'dragon_gem',
        name: 'Dragon\'s Eye Gem',
        description: 'A gem from an ancient dragon\'s hoard, pulsing with magical energy.',
        type: 'accessory',
        rarity: 'legendary',
        stats: { luck: 25, charisma: 10 },
        casinoEffects: { luckBonus: 25, winMultiplier: 1.25 },
        value: 50000,
        obtainableMethods: ['legendary_jackpot', 'dragon_quest'],
        icon: '💎'
      },
      // Class-specific items
      {
        itemId: 'rogues_marked_cards',
        name: 'Rogue\'s Marked Cards',
        description: 'Special cards that only a trained eye can read.',
        type: 'casino_chip',
        rarity: 'rare',
        requirements: { class: ['rogue'] },
        casinoEffects: { specialAbility: 'card_peek' },
        value: 1000,
        obtainableMethods: ['rogue_quest', 'underground_market'],
        icon: '🃏'
      },
      {
        itemId: 'merchants_ledger',
        name: 'Merchant\'s Probability Ledger',
        description: 'A detailed book of odds and probabilities.',
        type: 'accessory',
        rarity: 'rare',
        requirements: { class: ['merchant'] },
        stats: { intelligence: 15 },
        casinoEffects: { specialAbility: 'odds_reveal' },
        value: 2500,
        obtainableMethods: ['merchant_quest', 'shop'],
        icon: '📊'
      }
    ];

    for (const itemData of defaultItems) {
      await Item.findOneAndUpdate(
        { itemId: itemData.itemId },
        itemData,
        { upsert: true, new: true }
      );
    }

    console.log('Seeded default items');
  }
}

export default DatabaseSeeder;