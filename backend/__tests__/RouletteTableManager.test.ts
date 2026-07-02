import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
import { RouletteTableManager } from '../src/managers/RouletteTableManager';
import { RouletteEngine } from '../src/engines/RouletteEngine';
import { RouletteTable } from '../src/models/schemas';

// Mock dependencies
vi.mock('../src/engines/RouletteEngine');
vi.mock('../src/models/schemas', () => ({
  RouletteTable: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn()
  }
}));
vi.mock('../src/services/BardAbilities');

describe('RouletteTableManager', () => {
  const mockTableId = 'roulette123';
  const mockGuildId = 'guild456';
  const mockUserId = 'user789';
  const mockCharacterId = 'char123';

  let mockIo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Clear internal locks (access via any to bypass private)
    (RouletteTableManager as any).locks?.clear?.();

    // Mock Socket.io
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    (RouletteTableManager as any).locks?.clear?.();
  });

  describe('createTable', () => {
    it('should create a new roulette table', async () => {
      (RouletteTable.create as Mock).mockResolvedValue({
        tableId: mockTableId,
        guildId: mockGuildId,
        minBet: 10,
        maxBet: 1000,
        isActive: true,
        gamePhase: 'waiting'
      });

      const result = await RouletteTableManager.createTable(
        mockGuildId,
        mockTableId,
        10,
        1000
      );

      expect(RouletteTable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: mockTableId,
          guildId: mockGuildId,
          minBet: 10,
          maxBet: 1000,
          isActive: true,
          gamePhase: 'waiting'
        })
      );
      expect(result).toBeDefined();
    });

    it('should use default bet values if not provided', async () => {
      (RouletteTable.create as Mock).mockResolvedValue({
        tableId: mockTableId,
        guildId: mockGuildId
      });

      await RouletteTableManager.createTable(mockGuildId, mockTableId);

      expect(RouletteTable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          minBet: 10,
          maxBet: 1000
        })
      );
    });
  });

  describe('placeBet', () => {
    it('should successfully place a bet', async () => {
      const mockTable = {
        tableId: mockTableId,
        minBet: 10,
        maxBet: 1000,
        gamePhase: 'betting',
        bets: [],
        activePlayers: [],
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const result = await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        [{ type: 'red', amount: 100 }],
        mockIo
      );

      expect(result.success).toBe(true);
      expect(mockTable.bets).toHaveLength(1);
      expect(mockTable.save).toHaveBeenCalled();
    });

    it('should reject bet when table not found', async () => {
      (RouletteTable.findOne as Mock).mockResolvedValue(null);

      const result = await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        [{ type: 'red', amount: 100 }],
        mockIo
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should reject bet when betting is closed', async () => {
      const mockTable = {
        tableId: mockTableId,
        gamePhase: 'spinning',
        bets: [],
        activePlayers: []
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const result = await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        [{ type: 'red', amount: 100 }],
        mockIo
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('closed');
    });

    it('should reject bet below minimum', async () => {
      const mockTable = {
        tableId: mockTableId,
        minBet: 50,
        maxBet: 1000,
        gamePhase: 'betting',
        bets: [],
        activePlayers: []
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const result = await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        [{ type: 'red', amount: 10 }], // Below minimum
        mockIo
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Minimum');
    });

    it('should reject bet above maximum', async () => {
      const mockTable = {
        tableId: mockTableId,
        minBet: 10,
        maxBet: 500,
        gamePhase: 'betting',
        bets: [],
        activePlayers: []
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const result = await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        [{ type: 'red', amount: 600 }], // Above maximum
        mockIo
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Maximum');
    });

    it('should update existing bet for player', async () => {
      const mockTable = {
        tableId: mockTableId,
        minBet: 10,
        maxBet: 1000,
        gamePhase: 'betting',
        bets: [{
          userId: mockUserId,
          bets: [{ type: 'red', amount: 50 }],
          totalWagered: 50
        }],
        activePlayers: [mockUserId],
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const result = await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        [{ type: 'black', amount: 100 }],
        mockIo
      );

      expect(result.success).toBe(true);
      expect(mockTable.bets).toHaveLength(1); // Still 1 bet entry
      expect(mockTable.bets[0].totalWagered).toBe(100); // Updated
    });

    it('should handle multiple bets', async () => {
      const mockTable: any = {
        tableId: mockTableId,
        minBet: 10,
        maxBet: 1000,
        gamePhase: 'betting',
        bets: [],
        activePlayers: [],
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const multipleBets = [
        { type: 'red', amount: 50 },
        { type: 'number', value: 17, amount: 25 },
        { type: 'even', amount: 25 }
      ];

      const result = await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        multipleBets,
        mockIo
      );

      expect(result.success).toBe(true);
      expect(mockTable.bets[0].bets).toHaveLength(3);
      expect(mockTable.bets[0].totalWagered).toBe(100);
    });

    it('should broadcast bet placed event', async () => {
      const mockTable = {
        tableId: mockTableId,
        minBet: 10,
        maxBet: 1000,
        gamePhase: 'betting',
        bets: [],
        activePlayers: [],
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      await RouletteTableManager.placeBet(
        mockTableId,
        mockUserId,
        mockCharacterId,
        [{ type: 'red', amount: 100 }],
        mockIo
      );

      expect(mockIo.to).toHaveBeenCalledWith(`roulette:${mockTableId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'roulette:player_bet',
        expect.objectContaining({
          tableId: mockTableId,
          userId: mockUserId
        })
      );
    });
  });

  describe('startBettingRound', () => {
    it('should start a new betting round', async () => {
      const mockTable = {
        tableId: mockTableId,
        gamePhase: 'waiting',
        bets: [{ userId: 'oldPlayer' }],
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      await RouletteTableManager.startBettingRound(mockTableId, mockIo);

      expect(mockTable.gamePhase).toBe('betting');
      expect(mockTable.bets).toEqual([]); // Cleared
      expect(mockTable.save).toHaveBeenCalled();
      expect(mockIo.emit).toHaveBeenCalledWith(
        'roulette:betting_opened',
        expect.objectContaining({ tableId: mockTableId })
      );
    });

    it('should not start if table not found', async () => {
      (RouletteTable.findOne as Mock).mockResolvedValue(null);

      // Should not throw
      await expect(
        RouletteTableManager.startBettingRound(mockTableId, mockIo)
      ).resolves.not.toThrow();
    });

    it('should schedule warning and spin timers', async () => {
      const mockTable = {
        tableId: mockTableId,
        gamePhase: 'waiting',
        bets: [],
        minBet: 10,
        maxBet: 1000,
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      await RouletteTableManager.startBettingRound(mockTableId, mockIo);

      // Fast-forward 25 seconds for warning
      vi.advanceTimersByTime(25000);
      
      expect(mockIo.emit).toHaveBeenCalledWith(
        'roulette:betting_closing',
        expect.objectContaining({ countdown: 5 })
      );
    });
  });

  describe('executeSpin', () => {
    beforeEach(() => {
      // Ensure locks are cleared before each test
      (RouletteTableManager as any).locks?.clear?.();
    });

    it('should handle table not found gracefully', async () => {
      (RouletteTable.findOne as Mock).mockResolvedValue(null);

      // Should not throw
      await expect(
        RouletteTableManager.executeSpin(mockTableId, mockIo)
      ).resolves.not.toThrow();
    });

    it('should find the table during spin execution', async () => {
      // Use real timers for this test since it involves complex async/await with setTimeout
      vi.useRealTimers();
      
      const mockTable: any = {
        tableId: mockTableId,
        guildId: mockGuildId,
        gamePhase: 'betting',
        bets: [{ userId: mockUserId, bets: [{ type: 'red', amount: 100 }] }],
        lastResults: [],
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);
      (RouletteEngine.executeMultiplayerSpin as Mock).mockResolvedValue({
        winningNumber: 17,
        winningColor: 'black',
        winners: [],
        totalPayouts: 0
      });

      // Just verify the table is queried immediately (don't wait for the full spin)
      // The executeSpin method queries the table first before the 5-second delay
      const spinPromise = RouletteTableManager.executeSpin(mockTableId, mockIo);
      
      // Give it a moment to start and query the table
      await new Promise(resolve => setTimeout(resolve, 50));

      // The table should be queried
      expect(RouletteTable.findOne).toHaveBeenCalledWith({ tableId: mockTableId });
      
      // We don't need to wait for the full spin - just cancel it by switching back to fake timers
      vi.useFakeTimers();
    }, 10000); // Give extra time for the test setup
  });

  describe('playerLeave', () => {
    it('should remove player from active players', async () => {
      const mockTable = {
        tableId: mockTableId,
        activePlayers: [mockUserId, 'otherPlayer'],
        bets: [{ userId: mockUserId, bets: [] }],
        gamePhase: 'waiting',
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      await RouletteTableManager.playerLeave(mockTableId, mockUserId, mockIo);

      expect(mockTable.activePlayers).not.toContain(mockUserId);
      expect(mockTable.save).toHaveBeenCalled();
    });

    it('should remove bets if in betting phase', async () => {
      const mockTable = {
        tableId: mockTableId,
        activePlayers: [mockUserId],
        bets: [{ userId: mockUserId, bets: [{ type: 'red', amount: 100 }] }],
        gamePhase: 'betting',
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      await RouletteTableManager.playerLeave(mockTableId, mockUserId, mockIo);

      expect(mockTable.bets).toHaveLength(0);
    });

    it('should broadcast player left event', async () => {
      const mockTable = {
        tableId: mockTableId,
        activePlayers: [mockUserId],
        bets: [],
        gamePhase: 'waiting',
        save: vi.fn().mockResolvedValue(true)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      await RouletteTableManager.playerLeave(mockTableId, mockUserId, mockIo);

      expect(mockIo.emit).toHaveBeenCalledWith(
        'table:player_left',
        expect.objectContaining({
          tableId: mockTableId,
          userId: mockUserId,
          gameType: 'roulette'
        })
      );
    });

    it('should handle table not found gracefully', async () => {
      (RouletteTable.findOne as Mock).mockResolvedValue(null);

      // Should not throw
      await expect(
        RouletteTableManager.playerLeave(mockTableId, mockUserId, mockIo)
      ).resolves.not.toThrow();
    });
  });

  describe('cleanupTable', () => {
    it('should mark table as inactive', async () => {
      (RouletteTable.updateOne as Mock).mockResolvedValue({ modifiedCount: 1 });

      await RouletteTableManager.cleanupTable(mockTableId);

      expect(RouletteTable.updateOne).toHaveBeenCalledWith(
        { tableId: mockTableId },
        { isActive: false }
      );
    });
  });

  describe('getTableStatus', () => {
    it('should return table status correctly', async () => {
      const mockTable = {
        tableId: mockTableId,
        gamePhase: 'betting',
        activePlayers: [mockUserId],
        bets: [{ userId: mockUserId }],
        lastResults: [17, 4, 22],
        minBet: 10,
        maxBet: 1000,
        spinStartTime: new Date(Date.now() + 15000)
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const status = await RouletteTableManager.getTableStatus(mockTableId);

      expect(status).toBeDefined();
      expect(status.tableId).toBe(mockTableId);
      expect(status.gamePhase).toBe('betting');
      expect(status.activePlayers).toBe(1);
      expect(status.betsPlaced).toBe(1);
      expect(status.lastResults).toEqual([17, 4, 22]);
      expect(status.timeRemaining).toBeGreaterThan(0);
    });

    it('should return null if table not found', async () => {
      (RouletteTable.findOne as Mock).mockResolvedValue(null);

      const status = await RouletteTableManager.getTableStatus(mockTableId);

      expect(status).toBeNull();
    });

    it('should return 0 time remaining if no spin start time', async () => {
      const mockTable = {
        tableId: mockTableId,
        gamePhase: 'waiting',
        activePlayers: [],
        bets: [],
        lastResults: [],
        minBet: 10,
        maxBet: 1000,
        spinStartTime: null
      };

      (RouletteTable.findOne as Mock).mockResolvedValue(mockTable);

      const status = await RouletteTableManager.getTableStatus(mockTableId);

      expect(status.timeRemaining).toBe(0);
    });
  });
});

