import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// We test the ApiService by mocking axios and verifying the correct calls are made
// Since apiService is a singleton, we mock axios.create to return our mock instance

const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: {
      use: vi.fn(),
    },
    response: {
      use: vi.fn(),
    },
  },
};

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn((error) => error?.isAxiosError === true),
  },
  isAxiosError: vi.fn((error) => error?.isAxiosError === true),
}));

describe('ApiService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.patch.mockReset();
    mockAxiosInstance.delete.mockReset();
    // Clear module cache to get fresh import
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('authentication', () => {
    it('should call devLogin endpoint', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { token: 'mock-token', user: { id: 'user-1' } },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.devLogin('TestUser');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/dev', { username: 'TestUser' });
      expect(result.token).toBe('mock-token');
    });

    it('should call getCurrentUser endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { user: { id: 'user-1', username: 'TestUser' } },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.getCurrentUser();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/me');
      expect(result.id).toBe('user-1');
    });
  });

  describe('character endpoints', () => {
    it('should create character with correct payload', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { character: { id: 'char-1', name: 'Hero' } },
      });

      const { apiService } = await import('../services/api');
      await apiService.createCharacter({ name: 'Hero', class: 'warrior' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/characters/create', {
        name: 'Hero',
        className: 'warrior',
      });
    });

    it('should get character using /me endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { hasCharacter: true, character: { id: 'char-1' } },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.getMyCharacter();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/characters/me');
      expect(result?.id).toBe('char-1');
    });

    it('should return null when character does not exist', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { hasCharacter: false },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.getMyCharacter();

      expect(result).toBeNull();
    });

    it('should return null on 404 error', async () => {
      const error = { isAxiosError: true, response: { status: 404 } };
      mockAxiosInstance.get.mockRejectedValueOnce(error);
      // Use vi.mocked to properly type the mock
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const { apiService } = await import('../services/api');
      const result = await apiService.getMyCharacter();

      expect(result).toBeNull();
    });

    it('should delete character', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      const { apiService } = await import('../services/api');
      await apiService.deleteCharacter();

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/characters/me');
    });
  });

  describe('casino endpoints', () => {
    it('should get active blackjack tables', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { tables: [{ tableId: 'table-1', gamePhase: 'betting', playerCount: 2, maxPlayers: 6, minBet: 10, maxBet: 1000 }] },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.getActiveTables('blackjack');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/casino/tables/blackjack');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('table-1');
      expect(result[0].maxPlayers).toBe(6);
    });

    it('should get active roulette tables with no player cap', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { tables: [{ tableId: 'table-2', gamePhase: 'waiting', playerCount: 0, minBet: 10, maxBet: 1000 }] },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.getActiveTables('roulette');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/casino/tables/roulette');
      expect(result[0].maxPlayers).toBeNull();
    });

    it('should create a blackjack table', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true, tableId: 'blackjack-123', minBet: 10, maxBet: 1000, maxPlayers: 6 },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.createBlackjackTable(10, 1000);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/casino/tables/blackjack/create', expect.objectContaining({
        minBet: 10,
        maxBet: 1000,
        maxPlayers: 6,
      }));
      expect(result.id).toBe('blackjack-123');
    });

    it('should create a roulette table', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true, tableId: 'roulette-123', minBet: 10, maxBet: 1000 },
      });

      const { apiService } = await import('../services/api');
      const result = await apiService.createRouletteTable(10, 1000);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/casino/tables/roulette/create', expect.objectContaining({
        minBet: 10,
        maxBet: 1000,
      }));
      expect(result.id).toBe('roulette-123');
    });
  });

  describe('game endpoints', () => {
    it('should spin slots with bet and machine type', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true, result: { reels: ['🍒', '🍒', '🍒'] } },
      });

      const { apiService } = await import('../services/api');
      await apiService.spinSlots(50, 'dragon');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/games/slots/spin', {
        bet: 50,
        machineType: 'dragon',
      });
    });

    it('should roll dice with prediction', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true, result: { dice: [3, 4] } },
      });

      const { apiService } = await import('../services/api');
      await apiService.rollDice(50, 7);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/games/dice/roll', {
        bet: 50,
        prediction: 7,
      });
    });

    it('should get dice info', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, info: { predictions: [] } },
      });

      const { apiService } = await import('../services/api');
      await apiService.getDiceInfo();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/games/dice/info');
    });
  });

});
