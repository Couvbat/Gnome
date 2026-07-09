import { vi } from 'vitest';

// Mock API service responses
export const mockUser = {
  id: 'user-123',
  username: 'TestUser',
  coins: 1000,
  level: 5,
  experience: 500,
};

export const mockCharacter = {
  id: 'char-123',
  userId: 'user-123',
  name: 'TestHero',
  className: 'warrior' as const,
  level: 3,
  experience: 150,
  stats: {
    strength: 15,
    intelligence: 10,
    luck: 12,
    charisma: 8,
    vitality: 14,
    dexterity: 11,
  },
  energy: 100,
  maxEnergy: 100,
  casinoBonus: {
    luckBonus: 0.15,
    energyBonus: 0.1,
    specialAbility: 'Comeback',
    description: '+15% chance de comeback après une perte',
  },
};

export const mockGameTable = {
  id: 'table-123',
  gameType: 'blackjack' as const,
  playerCount: 1,
  maxPlayers: 6,
  minBet: 10,
  maxBet: 1000,
  gamePhase: 'betting',
};

export const mockSlotsResponse = {
  success: true,
  result: {
    reels: ['🍒', '🍒', '🍒'],
    outcome: 'win' as const,
    bet: 50,
    payout: 200,
    netChange: 150,
    winType: 'triple',
    multiplier: 4,
    xpGained: 25,
  },
};

export const mockDiceResponse = {
  success: true,
  result: {
    dice: [3, 4],
    total: 7,
    prediction: 7,
    predictionType: 'exact',
    isCorrect: true,
    outcome: 'win' as const,
    bet: 50,
    payout: 300,
    netChange: 250,
    payoutMultiplier: 6,
    xpGained: 30,
  },
};

// Create mock API service
export const createMockApiService = () => ({
  devLogin: vi.fn().mockResolvedValue({ token: 'mock-token', user: mockUser }),
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
  createCharacter: vi.fn().mockResolvedValue(mockCharacter),
  getMyCharacter: vi.fn().mockResolvedValue(mockCharacter),
  deleteCharacter: vi.fn().mockResolvedValue(undefined),
  getActiveTables: vi.fn().mockResolvedValue([mockGameTable]),
  createBlackjackTable: vi.fn().mockResolvedValue(mockGameTable),
  createRouletteTable: vi.fn().mockResolvedValue({ ...mockGameTable, gameType: 'roulette', maxPlayers: null }),
  spinSlots: vi.fn().mockResolvedValue(mockSlotsResponse),
  rollDice: vi.fn().mockResolvedValue(mockDiceResponse),
  getDiceInfo: vi.fn().mockResolvedValue({
    success: true,
    info: {
      predictions: [
        { type: 'exact', multiplier: 6, description: 'Guess exact total' },
        { type: 'high-low', multiplier: 2, description: 'High or low' },
      ],
    },
  }),
});

// Create mock WebSocket service
export const createMockWsService = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  joinBlackjackTable: vi.fn(),
  placeBlackjackBet: vi.fn(),
  hitBlackjack: vi.fn(),
  standBlackjack: vi.fn(),
  leaveBlackjackTable: vi.fn(),
  joinRouletteTable: vi.fn(),
  placeRouletteBet: vi.fn(),
  leaveRouletteTable: vi.fn(),
  triggerLuckySong: vi.fn(),
});

// Create mock Discord SDK service
export const createMockDiscordSdk = () => ({
  initializeDiscordSdk: vi.fn().mockResolvedValue(true),
  isRunningInDiscordActivity: vi.fn().mockReturnValue(false),
  getAuthToken: vi.fn().mockReturnValue(null),
  getCurrentUser: vi.fn().mockReturnValue({
    id: 'mock-user-123',
    username: 'MockUser',
    discriminator: '0001',
    avatar: 'abc123',
    bot: false,
    globalName: 'Mock User',
  }),
  getCurrentChannel: vi.fn().mockReturnValue({
    id: 'mock-channel-123',
    name: 'Test Channel',
    type: 2,
    guildId: 'mock-guild-123',
  }),
  getCurrentGuild: vi.fn().mockReturnValue({
    id: 'mock-guild-123',
    name: 'Test Server',
    icon: null,
  }),
  getVoiceParticipants: vi.fn().mockReturnValue([]),
  refreshVoiceParticipants: vi.fn().mockResolvedValue([]),
  openInviteDialog: vi.fn().mockResolvedValue(undefined),
  setActivity: vi.fn().mockResolvedValue(undefined),
  isDiscordSdkReady: vi.fn().mockReturnValue(true),
  getInstanceId: vi.fn().mockReturnValue('mock-instance-123'),
  getChannelId: vi.fn().mockReturnValue('mock-channel-123'),
  getGuildId: vi.fn().mockReturnValue('mock-guild-123'),
});

// Create mock for the @discord/embedded-app-sdk module
export const createDiscordSdkModuleMock = () => ({
  DiscordSDK: vi.fn().mockImplementation(() => ({
    ready: vi.fn().mockResolvedValue(undefined),
    commands: {
      authorize: vi.fn().mockResolvedValue({ code: 'mock-auth-code' }),
      authenticate: vi.fn().mockResolvedValue({
        user: { id: 'test-user', username: 'TestUser', discriminator: '0001', avatar: null },
      }),
      getInstanceConnectedParticipants: vi.fn().mockResolvedValue({ participants: [] }),
      openInviteDialog: vi.fn().mockResolvedValue(undefined),
      setActivity: vi.fn().mockResolvedValue(undefined),
    },
    subscribe: vi.fn().mockResolvedValue(undefined),
    channelId: 'mock-channel-123',
    guildId: 'mock-guild-123',
    instanceId: 'mock-instance-123',
  })),
  DiscordSDKMock: vi.fn().mockImplementation(() => ({
    ready: vi.fn().mockResolvedValue(undefined),
    commands: {
      authorize: vi.fn().mockResolvedValue({ code: 'mock-code' }),
      authenticate: vi.fn().mockResolvedValue({ user: { id: 'mock-user' } }),
      getInstanceConnectedParticipants: vi.fn().mockResolvedValue({ participants: [] }),
      openInviteDialog: vi.fn().mockResolvedValue(undefined),
      setActivity: vi.fn().mockResolvedValue(undefined),
    },
    subscribe: vi.fn().mockResolvedValue(undefined),
    channelId: 'mock-channel',
    guildId: 'mock-guild',
    instanceId: 'mock-instance',
  })),
  patchUrlMappings: vi.fn(),
});
