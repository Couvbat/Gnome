/**
 * Mock Factory Functions for Testing
 * 
 * These factory functions create consistent, type-safe mock objects
 * for use across all test files. They provide sensible defaults while
 * allowing customization via partial overrides.
 */

import { vi, type Mock } from 'vitest';
import { Types } from 'mongoose';

// =====================
// USER & CHARACTER MOCKS
// =====================

export interface MockUser {
  _id: Types.ObjectId;
  userId: string;
  guildId: string;
  username: string;
  coins: number;
  level: number;
  xp: number;
  createdAt: Date;
  lastDaily: Date | null;
  characterId?: Types.ObjectId;
  save: Mock;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    _id: new Types.ObjectId(),
    userId: 'user-123',
    guildId: 'guild-456',
    username: 'TestUser',
    coins: 1000,
    level: 5,
    xp: 500,
    createdAt: new Date('2024-01-01'),
    lastDaily: null,
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

export interface MockCharacter {
  _id: Types.ObjectId;
  userId: string;
  guildId: string;
  name: string;
  class: 'warrior' | 'mage' | 'rogue' | 'merchant' | 'bard' | 'paladin';  // Matches ICharacter interface
  className: string;  // Alias kept for backward compatibility
  level: number;
  xp: number;  // Character XP (some code uses 'xp', others use 'experience')
  experience: number;  // Alias for xp - kept for compatibility with different service interfaces
  stats: {
    strength: number;
    intelligence: number;
    luck: number;
    charisma: number;
    vitality: number;
    dexterity: number;
  };
  lastAbilityUse?: Record<string, Date>;
  save: Mock;
}

// Class stats defined outside function for performance
const CLASS_STATS: Record<string, MockCharacter['stats']> = {
  warrior: { strength: 20, intelligence: 8, luck: 10, charisma: 12, vitality: 18, dexterity: 10 },
  mage: { strength: 6, intelligence: 22, luck: 15, charisma: 14, vitality: 10, dexterity: 8 },
  rogue: { strength: 12, intelligence: 14, luck: 18, charisma: 10, vitality: 12, dexterity: 20 },
  merchant: { strength: 10, intelligence: 16, luck: 12, charisma: 20, vitality: 14, dexterity: 12 },
  bard: { strength: 8, intelligence: 15, luck: 16, charisma: 22, vitality: 12, dexterity: 14 },
  paladin: { strength: 18, intelligence: 12, luck: 14, charisma: 18, vitality: 20, dexterity: 8 }
};

export function createMockCharacter(
  classType: 'warrior' | 'mage' | 'rogue' | 'merchant' | 'bard' | 'paladin' = 'warrior',
  overrides: Partial<MockCharacter> = {}
): MockCharacter {
  const xpValue = overrides.xp ?? overrides.experience ?? 500;
  
  return {
    _id: new Types.ObjectId(),
    userId: 'user-123',
    guildId: 'guild-456',
    name: `Test${classType.charAt(0).toUpperCase() + classType.slice(1)}`,
    class: classType,  // Matches ICharacter interface
    className: classType,  // Alias for backward compatibility
    level: 5,
    xp: xpValue,
    experience: xpValue,  // Keep in sync with xp
    stats: CLASS_STATS[classType],
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

// =====================
// CASINO PROFILE MOCKS
// =====================

export interface MockCasinoProfile {
  _id: Types.ObjectId;
  userId: string;
  guildId: string;
  energy: number;
  maxEnergy: number;
  lastEnergyRegen: Date;
  reputation: number;
  reputationLevel: 'novice' | 'amateur' | 'seasoned' | 'professional' | 'high_roller' | 'legend' | 'mythic';
  stats: {
    totalWagered: number;
    totalWon: number;
    totalLost: number;
    biggestWin: number;
    biggestLoss: number;
    sessionsPlayed: number;
    favoriteGame: string;
  };
  save: Mock;
}

export function createMockCasinoProfile(overrides: Partial<MockCasinoProfile> = {}): MockCasinoProfile {
  return {
    _id: new Types.ObjectId(),
    userId: 'user-123',
    guildId: 'guild-456',
    energy: 80,
    maxEnergy: 100,
    lastEnergyRegen: new Date(),
    reputation: 150,
    reputationLevel: 'amateur',
    stats: {
      totalWagered: 5000,
      totalWon: 3000,
      totalLost: 2000,
      biggestWin: 500,
      biggestLoss: 200,
      sessionsPlayed: 25,
      favoriteGame: 'blackjack'
    },
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

// =====================
// BLACKJACK TABLE MOCKS
// =====================

export interface MockBlackjackPlayer {
  userId: string;
  characterClass: string;
  bet: number;
  hand: Array<{ suit: string; value: string; numericValue: number }>;
  handValue: number;
  isStanding: boolean;
  isBusted: boolean;
  hasPlacedBet: boolean;
}

export interface MockBlackjackTable {
  _id: Types.ObjectId;
  tableId: string;
  guildId: string;
  players: MockBlackjackPlayer[];
  dealer: {
    hand: Array<{ suit: string; value: string; numericValue: number }>;
    handValue: number;
    isStanding: boolean;
    isBusted: boolean;
  };
  gamePhase: 'betting' | 'playing' | 'dealer_turn' | 'payouts';
  currentPlayerIndex: number;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
  lastActivity: Date;
  save: Mock;
}

export function createMockBlackjackPlayer(overrides: Partial<MockBlackjackPlayer> = {}): MockBlackjackPlayer {
  return {
    userId: 'user-123',
    characterClass: 'warrior',
    bet: 100,
    hand: [],
    handValue: 0,
    isStanding: false,
    isBusted: false,
    hasPlacedBet: false,
    ...overrides
  };
}

export function createMockBlackjackTable(overrides: Partial<MockBlackjackTable> = {}): MockBlackjackTable {
  return {
    _id: new Types.ObjectId(),
    tableId: 'table-123',
    guildId: 'guild-456',
    players: [],
    dealer: {
      hand: [],
      handValue: 0,
      isStanding: false,
      isBusted: false
    },
    gamePhase: 'betting',
    currentPlayerIndex: 0,
    minBet: 10,
    maxBet: 1000,
    maxPlayers: 6,
    lastActivity: new Date(),
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

// =====================
// ROULETTE TABLE MOCKS
// =====================

export interface MockRouletteBet {
  userId: string;
  characterId: string;
  bets: Array<{ type: string; value?: number; amount: number }>;
  totalWagered: number;
}

export interface MockRouletteTable {
  _id: Types.ObjectId;
  tableId: string;
  guildId: string;
  minBet: number;
  maxBet: number;
  isActive: boolean;
  gamePhase: 'waiting' | 'betting' | 'spinning' | 'payouts';
  spinTimer: number;
  spinStartTime: Date | null;
  bets: MockRouletteBet[];
  lastResults: number[];
  activePlayers: string[];
  spectators: string[];
  currentSpin?: {
    result: number;
    color: string;
    even: boolean;
    high: boolean;
  };
  save: Mock;
}

export function createMockRouletteTable(overrides: Partial<MockRouletteTable> = {}): MockRouletteTable {
  return {
    _id: new Types.ObjectId(),
    tableId: 'roulette-123',
    guildId: 'guild-456',
    minBet: 10,
    maxBet: 1000,
    isActive: true,
    gamePhase: 'waiting',
    spinTimer: 30,
    spinStartTime: null,
    bets: [],
    lastResults: [],
    activePlayers: [],
    spectators: [],
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

// =====================
// QUEST MOCKS
// =====================

export interface MockQuest {
  _id: Types.ObjectId;
  questId: string;
  guildId: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'story' | 'special';
  category: 'casino' | 'exploration' | 'social';
  isActive: boolean;
  objectives: Array<{
    type: string;
    target: string | null;
    required: number;
    description: string;
  }>;
  rewards: {
    coins: number;
    xp: number;
    reputation?: number;
    items?: string[];
  };
  requirements?: {
    level?: number;
    class?: string[];
    previousQuests?: string[];
  };
  maxCompletions: number;
}

export interface MockUserQuest {
  _id: Types.ObjectId;
  userId: string;
  guildId: string;
  questId: string;
  characterId: Types.ObjectId;
  status: 'available' | 'active' | 'completed' | 'abandoned';
  progress: Array<{
    objectiveId: number;
    current: number;
    completed: boolean;
  }>;
  startedAt: Date;
  completedAt?: Date;
  lastUpdate: Date;
  completionCount: number;
  save: Mock;
}

export function createMockQuest(overrides: Partial<MockQuest> = {}): MockQuest {
  return {
    _id: new Types.ObjectId(),
    questId: 'quest-123',
    guildId: 'guild-456',
    title: 'Test Quest',
    description: 'A test quest for unit testing',
    type: 'daily',
    category: 'casino',
    isActive: true,
    objectives: [
      {
        type: 'win_games',
        target: 'slots',
        required: 5,
        description: 'Win 5 slots games'
      }
    ],
    rewards: {
      coins: 100,
      xp: 50,
      reputation: 10
    },
    maxCompletions: 1,
    ...overrides
  };
}

export function createMockUserQuest(overrides: Partial<MockUserQuest> = {}): MockUserQuest {
  return {
    _id: new Types.ObjectId(),
    userId: 'user-123',
    guildId: 'guild-456',
    questId: 'quest-123',
    characterId: new Types.ObjectId(),
    status: 'active',
    progress: [
      {
        objectiveId: 0,
        current: 2,
        completed: false
      }
    ],
    startedAt: new Date(),
    lastUpdate: new Date(),
    completionCount: 0,
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

// =====================
// CASINO SESSION MOCKS
// =====================

export interface MockCasinoSession {
  _id: Types.ObjectId;
  sessionId: string;
  userId: string;
  guildId: string;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: Date;
  endedAt?: Date;
  gamesPlayed: number;
  totalWagered: number;
  totalWon: number;
  abilityUsage?: Record<string, number>;
  save: Mock;
}

export function createMockCasinoSession(overrides: Partial<MockCasinoSession> = {}): MockCasinoSession {
  return {
    _id: new Types.ObjectId(),
    sessionId: 'session-123',
    userId: 'user-123',
    guildId: 'guild-456',
    status: 'active',
    startedAt: new Date(),
    gamesPlayed: 5,
    totalWagered: 500,
    totalWon: 350,
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

// =====================
// SOCKET.IO MOCK
// =====================

export interface MockSocketIO {
  to: Mock;
  emit: Mock;
}

export function createMockSocketIO(): MockSocketIO {
  const mockIo: MockSocketIO = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn()
  };
  return mockIo;
}

// =====================
// DATABASE MODEL MOCK HELPERS
// =====================

/**
 * Creates a mock mongoose model with common methods
 */
export function createMockModel<T>(defaultData: T | null = null) {
  return {
    findOne: vi.fn().mockResolvedValue(defaultData),
    find: vi.fn().mockResolvedValue(defaultData ? [defaultData] : []),
    findById: vi.fn().mockResolvedValue(defaultData),
    create: vi.fn().mockImplementation((data) => Promise.resolve({ ...defaultData, ...data })),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    findOneAndUpdate: vi.fn().mockResolvedValue(defaultData),
    findByIdAndUpdate: vi.fn().mockResolvedValue(defaultData),
    countDocuments: vi.fn().mockResolvedValue(1),
    aggregate: vi.fn().mockResolvedValue([])
  };
}

/**
 * Creates a mongoose model mock with exec() support
 */
export function createMockModelWithExec<T>(defaultData: T | null = null) {
  const createQueryMock = (resolveValue: any) => ({
    exec: vi.fn().mockResolvedValue(resolveValue),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis()
  });

  return {
    findOne: vi.fn().mockReturnValue(createQueryMock(defaultData)),
    find: vi.fn().mockReturnValue(createQueryMock(defaultData ? [defaultData] : [])),
    findById: vi.fn().mockReturnValue(createQueryMock(defaultData)),
    create: vi.fn().mockImplementation((data) => Promise.resolve({ ...defaultData, ...data })),
    updateOne: vi.fn().mockReturnValue(createQueryMock({ modifiedCount: 1 })),
    deleteOne: vi.fn().mockReturnValue(createQueryMock({ deletedCount: 1 })),
    findOneAndUpdate: vi.fn().mockReturnValue(createQueryMock(defaultData)),
    findByIdAndUpdate: vi.fn().mockReturnValue(createQueryMock(defaultData)),
    countDocuments: vi.fn().mockReturnValue(createQueryMock(1))
  };
}

// =====================
// CARD & DECK MOCKS
// =====================

export interface MockCard {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: string;
  numericValue: number;
}

// Card value map defined outside function for performance
const CARD_VALUE_MAP: Record<string, number> = {
  'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10
};

export function createMockCard(
  value: string = 'K',
  suit: MockCard['suit'] = 'hearts'
): MockCard {
  return {
    suit,
    value,
    numericValue: CARD_VALUE_MAP[value] || 10
  };
}

export function createMockHand(cards: Array<{ value: string; suit?: MockCard['suit'] }>): MockCard[] {
  return cards.map(({ value, suit = 'hearts' }) => createMockCard(value, suit));
}

// =====================
// ASSERTION HELPERS
// =====================

/**
 * Helper to verify that a mock was called with specific parameters
 */
export function expectMockCalledWith(
  mock: Mock,
  expectedArgs: Record<string, any>
): void {
  expect(mock).toHaveBeenCalled();
  const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
  expect(lastCall[0]).toMatchObject(expectedArgs);
}

/**
 * Helper to verify model save was called
 */
export function expectSaved(mockObject: { save: Mock }): void {
  expect(mockObject.save).toHaveBeenCalled();
}
