import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
import { BlackjackTableManager } from '../src/managers/BlackjackTableManager';
import { BlackjackEngine } from '../src/engines/BlackjackEngine';
import { User } from '../src/models/database';
import { EconomyService } from '../src/services/EconomyService';
import {
  createMockBlackjackTable,
  createMockBlackjackPlayer,
  createMockUser,
  createMockSocketIO
} from './__mocks__/mockFactories';

// Mock all dependencies
vi.mock('../src/engines/BlackjackEngine');
vi.mock('../src/models/database');
vi.mock('../src/services/EconomyService');
vi.mock('../src/models/schemas', () => ({
  BlackjackTable: {
    findOne: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue(null)
    }),
    create: vi.fn(),
    deleteOne: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue({ deletedCount: 1 })
    })
  }
}));

describe('BlackjackTableManager', () => {
  const mockTableId = 'table-123';
  const mockGuildId = 'guild-456';
  const mockUserId = 'user-789';

  let mockBlackjackTable: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Get reference to mocked BlackjackTable
    const { BlackjackTable } = await import('../src/models/schemas');
    mockBlackjackTable = BlackjackTable;
    
    // Reset findOne to return chainable mock
    mockBlackjackTable.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null)
    });
    
    // Reset deleteOne to return chainable mock
    mockBlackjackTable.deleteOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ deletedCount: 1 })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createTable', () => {
    it('should create a new blackjack table', async () => {
      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null)
      });
      const expectedTable = createMockBlackjackTable({ tableId: mockTableId, guildId: mockGuildId });
      mockBlackjackTable.create.mockResolvedValue(expectedTable);

      await BlackjackTableManager.createTable(
        mockTableId,
        mockGuildId,
        10,
        1000,
        6
      );

      expect(mockBlackjackTable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: mockTableId,
          guildId: mockGuildId,
          minBet: 10,
          maxBet: 1000,
          maxPlayers: 6,
          gamePhase: 'betting'
        })
      );
    });

    it('should throw error if table already exists', async () => {
      const existingTable = createMockBlackjackTable({ tableId: mockTableId, guildId: mockGuildId });
      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(existingTable)
      });

      await expect(
        BlackjackTableManager.createTable(mockTableId, mockGuildId)
      ).rejects.toThrow('already exists');
    });

    it('should use default values if not provided', async () => {
      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null)
      });
      mockBlackjackTable.create.mockResolvedValue({});

      await BlackjackTableManager.createTable(mockTableId, mockGuildId);

      expect(mockBlackjackTable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          minBet: 10,
          maxBet: 1000,
          maxPlayers: 6
        })
      );
    });
  });

  describe('playerJoin', () => {
    it('should successfully add player to table', async () => {
      const mockTable: any = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [],
        maxPlayers: 6,
        gamePhase: 'betting',
        minBet: 10,
        dealer: { hand: [], handValue: 0, isStanding: false, isBusted: false },
        save: vi.fn().mockResolvedValue(true)
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });
      (User.findOne as Mock).mockReturnValue({
        exec: vi.fn().mockResolvedValue({ userId: mockUserId })
      });
      (EconomyService.getCoins as Mock).mockResolvedValue(1000);

      const result = await BlackjackTableManager.playerJoin(
        mockTableId,
        mockGuildId,
        mockUserId,
        'warrior'
      );

      expect(result.success).toBe(true);
      expect(mockTable.players).toHaveLength(1);
      expect(mockTable.players[0].userId).toBe(mockUserId);
    });

    it('should reject if table is full', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{ userId: 'p1' }, { userId: 'p2' }, { userId: 'p3' }, { userId: 'p4' }, { userId: 'p5' }, { userId: 'p6' }],
        maxPlayers: 6,
        gamePhase: 'betting'
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.playerJoin(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('full');
    });

    it('should reject if player is already at table', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{ userId: mockUserId }],
        maxPlayers: 6,
        gamePhase: 'betting'
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.playerJoin(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already');
    });

    it('should reject if game is not in betting phase', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [],
        maxPlayers: 6,
        gamePhase: 'playing'
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.playerJoin(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Wait for next round');
    });

    it('should reject if user has insufficient balance', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [],
        maxPlayers: 6,
        gamePhase: 'betting',
        minBet: 100
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });
      (User.findOne as Mock).mockReturnValue({
        exec: vi.fn().mockResolvedValue({ userId: mockUserId })
      });
      (EconomyService.getCoins as Mock).mockResolvedValue(50);

      const result = await BlackjackTableManager.playerJoin(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient balance');
    });

    it('should return error if table not found', async () => {
      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null)
      });

      const result = await BlackjackTableManager.playerJoin(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('placeBet', () => {
    it('should successfully place a bet', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{
          userId: mockUserId,
          bet: 0,
          hasPlacedBet: false
        }],
        gamePhase: 'betting',
        minBet: 10,
        maxBet: 1000,
        save: vi.fn().mockResolvedValue(true)
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });
      (User.findOne as Mock).mockReturnValue({
        exec: vi.fn().mockResolvedValue({ userId: mockUserId })
      });
      (EconomyService.spendCoins as Mock).mockResolvedValue(true);

      const result = await BlackjackTableManager.placeBet(
        mockTableId,
        mockGuildId,
        mockUserId,
        100
      );

      expect(result.success).toBe(true);
      expect(mockTable.players[0].bet).toBe(100);
      expect(mockTable.players[0].hasPlacedBet).toBe(true);
      expect(EconomyService.spendCoins).toHaveBeenCalledWith(mockUserId, mockGuildId, 100);
    });

    it('should reject bet outside allowed range', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{
          userId: mockUserId,
          bet: 0,
          hasPlacedBet: false
        }],
        gamePhase: 'betting',
        minBet: 10,
        maxBet: 100
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.placeBet(
        mockTableId,
        mockGuildId,
        mockUserId,
        500 // Above max
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('between');
    });

    it('should reject if betting phase is closed', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{ userId: mockUserId }],
        gamePhase: 'playing',
        minBet: 10,
        maxBet: 1000
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.placeBet(
        mockTableId,
        mockGuildId,
        mockUserId,
        100
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('closed');
    });

    it('should reject if player already placed bet', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{
          userId: mockUserId,
          bet: 100,
          hasPlacedBet: true
        }],
        gamePhase: 'betting',
        minBet: 10,
        maxBet: 1000
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.placeBet(
        mockTableId,
        mockGuildId,
        mockUserId,
        100
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already placed');
    });
  });

  describe('playerHit', () => {
    it('should successfully process a hit', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{
          userId: mockUserId,
          hand: [{ suit: 'hearts', value: 'K' }],
          handValue: 10,
          isStanding: false,
          isBusted: false,
          hasPlacedBet: true
        }],
        gamePhase: 'playing',
        currentPlayerIndex: 0
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      (BlackjackEngine.processPlayerHit as Mock).mockResolvedValue({
        card: { suit: 'diamonds', value: '5' },
        handValue: 15,
        isBusted: false
      });

      const result = await BlackjackTableManager.playerHit(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.card).toBeDefined();
      expect(result.handValue).toBe(15);
      expect(result.isBusted).toBe(false);
    });

    it('should handle bust correctly', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{
          userId: mockUserId,
          hand: [{ suit: 'hearts', value: 'K' }, { suit: 'spades', value: 'K' }],
          handValue: 20,
          isStanding: false,
          isBusted: false,
          hasPlacedBet: true
        }],
        gamePhase: 'playing',
        currentPlayerIndex: 0
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      (BlackjackEngine.processPlayerHit as Mock).mockResolvedValue({
        card: { suit: 'diamonds', value: 'K' },
        handValue: 30,
        isBusted: true
      });

      const result = await BlackjackTableManager.playerHit(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.isBusted).toBe(true);
      expect(result.message).toContain('Busted');
    });

    it('should reject if not players turn', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [
          { userId: 'otherPlayer', isStanding: false, isBusted: false, hasPlacedBet: true },
          { userId: mockUserId, isStanding: false, isBusted: false, hasPlacedBet: true }
        ],
        gamePhase: 'playing',
        currentPlayerIndex: 0 // First player's turn
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.playerHit(
        mockTableId,
        mockGuildId,
        mockUserId // Second player trying to hit
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not your turn');
    });
  });

  describe('playerStand', () => {
    it('should successfully process a stand', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{
          userId: mockUserId,
          isStanding: false,
          isBusted: false,
          hasPlacedBet: true
        }],
        gamePhase: 'playing',
        currentPlayerIndex: 0,
        save: vi.fn().mockResolvedValue(true)
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      (BlackjackEngine.processPlayerStand as Mock).mockResolvedValue(true);

      const result = await BlackjackTableManager.playerStand(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('You stand');
    });
  });

  describe('playerLeave', () => {
    it('should successfully remove player from table', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{ userId: mockUserId, bet: 0, hasPlacedBet: false }],
        gamePhase: 'betting',
        save: vi.fn().mockResolvedValue(true)
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.playerLeave(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(mockTable.players).toHaveLength(0);
    });

    it('should refund bet if leaving during betting phase', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{ userId: mockUserId, bet: 100, hasPlacedBet: true }],
        gamePhase: 'betting',
        save: vi.fn().mockResolvedValue(true)
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });
      (EconomyService.addCoins as Mock).mockResolvedValue(1000);

      await BlackjackTableManager.playerLeave(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(EconomyService.addCoins).toHaveBeenCalledWith(mockUserId, mockGuildId, 100);
    });

    it('should return error if player not at table', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{ userId: 'otherPlayer' }],
        gamePhase: 'betting'
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const result = await BlackjackTableManager.playerLeave(
        mockTableId,
        mockGuildId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not at this table');
    });
  });

  describe('getTableStatus', () => {
    it('should return table status correctly', async () => {
      const mockTable = {
        tableId: mockTableId,
        guildId: mockGuildId,
        players: [{
          userId: mockUserId,
          characterClass: 'warrior',
          bet: 100,
          hand: [],
          handValue: 0,
          isStanding: false,
          isBusted: false,
          hasPlacedBet: true
        }],
        dealer: { hand: [], handValue: 0, isStanding: false, isBusted: false },
        gamePhase: 'betting',
        currentPlayerIndex: 0,
        minBet: 10,
        maxBet: 1000,
        maxPlayers: 6
      };

      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockTable)
      });

      const status = await BlackjackTableManager.getTableStatus(mockTableId, mockGuildId);

      expect(status).toBeDefined();
      expect(status.tableId).toBe(mockTableId);
      expect(status.gamePhase).toBe('betting');
      expect(status.players).toHaveLength(1);
      expect(status.minBet).toBe(10);
      expect(status.maxBet).toBe(1000);
    });

    it('should return null if table not found', async () => {
      mockBlackjackTable.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null)
      });

      const status = await BlackjackTableManager.getTableStatus(mockTableId, mockGuildId);

      expect(status).toBeNull();
    });
  });

  describe('cleanupTable', () => {
    it('should cleanup table correctly', async () => {
      mockBlackjackTable.deleteOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 1 })
      });

      await BlackjackTableManager.cleanupTable(mockTableId, mockGuildId);

      expect(mockBlackjackTable.deleteOne).toHaveBeenCalledWith({ tableId: mockTableId, guildId: mockGuildId });
    });
  });
});

