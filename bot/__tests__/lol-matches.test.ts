import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock undici before importing the command
vi.mock('undici');

import lolMatches from '../commands/lol-matches';
import { request } from 'undici';

describe('LoL Matches Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RIOT_GAMES_API_KEY = 'test-riot-api-key';
  });

  test('should have correct command structure', () => {
    expect(lolMatches.data.name).toBe('lol-matches');
    expect(lolMatches.execute).toBeDefined();
    expect(typeof lolMatches.execute).toBe('function');
  });

  test('should defer reply and fetch match history', async () => {
    const mockAccountResponse = {
      puuid: 'test-puuid-123',
      gameName: 'Couvbat',
      tagLine: '1312'
    };

    const mockMatchIds = [
      'EUW1_123456789'
    ];

    const mockMatchData = {
      metadata: {
        matchId: 'EUW1_123456789',
        participants: ['test-puuid-123']
      },
      info: {
        gameCreation: Date.now(),
        gameDuration: 1800,
        gameMode: 'CLASSIC',
        participants: [
          {
            puuid: 'test-puuid-123',
            championName: 'Ahri',
            championId: 103,
            kills: 10,
            deaths: 5,
            assists: 8,
            totalMinionsKilled: 150,
            goldEarned: 12000,
            totalDamageDealtToChampions: 20000,
            win: true,
            summonerName: 'Couvbat',
            item0: 3089,
            item1: 3020,
            item2: 3135,
            item3: 3157,
            item4: 3116,
            item5: 3165,
            item6: 3364
          }
        ]
      }
    };

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
          json: vi.fn().mockResolvedValue(mockMatchIds)
        }
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockMatchData)
        }
      });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat#1312'),
        getInteger: vi.fn().mockReturnValue(5)
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolMatches.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      'https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Couvbat/1312',
      expect.objectContaining({
        headers: {
          'X-Riot-Token': 'test-riot-api-key'
        }
      })
    );
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
        getString: vi.fn().mockReturnValue('NonExistentPlayer#EUW'),
        getInteger: vi.fn().mockReturnValue(null)
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolMatches.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Joueur introuvable: NonExistentPlayer#EUW'
    });
  });

  test('should handle missing API key', async () => {
    delete process.env.RIOT_GAMES_API_KEY;

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat#1312'),
        getInteger: vi.fn().mockReturnValue(null)
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolMatches.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Erreur: La clé API Riot n\'est pas configurée.'
    });
  });

  test('should use default count of 5 when not specified', async () => {
    const mockAccountResponse = {
      puuid: 'test-puuid-123',
      gameName: 'Couvbat',
      tagLine: '1312'
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
        getString: vi.fn().mockReturnValue('Couvbat#1312'),
        getInteger: vi.fn().mockReturnValue(null) // No count specified
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolMatches.execute(mockInteraction);
  });

  test('should handle API errors gracefully', async () => {
    request.mockRejectedValueOnce(new Error('API Error'));

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat#1312'),
        getInteger: vi.fn().mockReturnValue(null)
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolMatches.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue lors de la récupération de l\'historique. Réessayez plus tard.'
    });
  });
});
