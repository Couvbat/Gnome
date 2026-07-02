import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock undici before importing the command
vi.mock('undici');

import lolStats from '../commands/lol-stats';
import { request } from 'undici';

describe('LoL Stats Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RIOT_GAMES_API_KEY = 'test-riot-api-key';
  });

  test('should have correct command structure', () => {
    expect(lolStats.data.name).toBe('lol-stats');
    expect(lolStats.execute).toBeDefined();
    expect(typeof lolStats.execute).toBe('function');
  });

  test('should defer reply and fetch player stats', async () => {
    const mockAccountResponse = {
      puuid: 'test-puuid-123',
      gameName: 'Couvbat',
      tagLine: '1312'
    };

    const mockSummonerResponse = {
      id: 'test-summoner-id',
      accountId: 'test-account-id',
      puuid: 'test-puuid-123',
      profileIconId: 1,
      revisionDate: Date.now(),
      summonerLevel: 100
    };

    const mockRankedData = [
      {
        queueType: 'RANKED_SOLO_5x5',
        tier: 'GOLD',
        rank: 'II',
        leaguePoints: 50,
        wins: 100,
        losses: 90,
        hotStreak: false,
        veteran: false,
        freshBlood: false
      }
    ];

    // Mock API responses
    request
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockAccountResponse)
        }
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockSummonerResponse)
        }
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockRankedData)
        }
      });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat#1312')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolStats.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      'https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Couvbat/1312',
      expect.objectContaining({
        headers: {
          'X-Riot-Token': 'test-riot-api-key'
        }
      })
    );
    expect(mockInteraction.editReply).toHaveBeenCalled();
  });

  test('should handle player not found error', async () => {
    request.mockResolvedValueOnce({
      statusCode: 404,
      body: {
        json: vi.fn().mockResolvedValue({})
      }
    });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('NonExistentPlayer#EUW')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolStats.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Joueur introuvable: NonExistentPlayer#EUW. Vérifiez le nom et le tag.'
    });
  });

  test('should handle missing API key', async () => {
    delete process.env.RIOT_GAMES_API_KEY;

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat#1312')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolStats.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Erreur: La clé API Riot n\'est pas configurée.'
    });
  });

  test('should handle API errors gracefully', async () => {
    request.mockRejectedValueOnce(new Error('API Error'));

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat#1312')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolStats.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue lors de la récupération des statistiques. Réessayez plus tard.'
    });
  });

  test('should parse summoner name without tag (default to EUW)', async () => {
    const mockAccountResponse = {
      puuid: 'test-puuid-123',
      gameName: 'Couvbat',
      tagLine: 'EUW'
    };

    request.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: vi.fn().mockResolvedValue(mockAccountResponse)
      }
    });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolStats.execute(mockInteraction);

    expect(request).toHaveBeenCalledWith(
      'https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Couvbat/EUW',
      expect.any(Object)
    );
  });
});
