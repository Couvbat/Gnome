import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock undici before importing the command
vi.mock('undici');

import lolLastgame from '../commands/lol-lastgame';
import { request } from 'undici';

describe('LoL LastGame Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RIOT_GAMES_API_KEY = 'test-riot-api-key';
    process.env.MISTRAL_API_KEY = 'test-mistral-api-key';
  });

  test('should have correct command structure', () => {
    expect(lolLastgame.data.name).toBe('lol-lastgame');
    expect(lolLastgame.execute).toBeDefined();
    expect(typeof lolLastgame.execute).toBe('function');
  });

  test('should defer reply and fetch last game data', async () => {
    const mockAccountResponse = {
      puuid: 'test-puuid-123',
      gameName: 'Couvbat',
      tagLine: '1312'
    };

    const mockMatchIds = ['EUW1_123456789'];

    const mockMatchData = {
      metadata: {
        matchId: 'EUW1_123456789',
        participants: ['test-puuid-123', 'other-puuid']
      },
      info: {
        gameCreation: Date.now(),
        gameDuration: 1800,
        gameMode: 'CLASSIC',
        queueId: 420,
        participants: [
          {
            puuid: 'test-puuid-123',
            championName: 'Ahri',
            championId: 103,
            kills: 10,
            deaths: 5,
            assists: 8,
            totalMinionsKilled: 150,
            neutralMinionsKilled: 20,
            goldEarned: 12000,
            totalDamageDealtToChampions: 20000,
            totalDamageTaken: 15000,
            win: true,
            summoner1Id: 4,
            summoner2Id: 14,
            item0: 3089,
            item1: 3020,
            item2: 3135,
            item3: 3157,
            item4: 3116,
            item5: 3165,
            item6: 3364,
            visionScore: 30,
            wardsPlaced: 15,
            wardsKilled: 5,
            doubleKills: 2,
            tripleKills: 1,
            quadraKills: 0,
            pentaKills: 0,
            largestKillingSpree: 5,
            goldSpent: 11500,
            champLevel: 16,
            totalHeal: 3000,
            damageSelfMitigated: 8000
          },
          {
            puuid: 'other-puuid',
            championName: 'Zed',
            championId: 238,
            kills: 8,
            deaths: 6,
            assists: 10,
            totalMinionsKilled: 140,
            neutralMinionsKilled: 10,
            goldEarned: 11000,
            totalDamageDealtToChampions: 18000,
            totalDamageTaken: 16000,
            win: true,
            summoner1Id: 4,
            summoner2Id: 14,
            item0: 3142,
            item1: 3814,
            item2: 3071,
            item3: 3156,
            item4: 3053,
            item5: 3139,
            item6: 3364,
            visionScore: 25,
            wardsPlaced: 12,
            wardsKilled: 4,
            doubleKills: 1,
            tripleKills: 0,
            quadraKills: 0,
            pentaKills: 0,
            largestKillingSpree: 4,
            goldSpent: 10500,
            champLevel: 15,
            totalHeal: 2500,
            damageSelfMitigated: 7000
          }
        ]
      }
    };

    const mockMistralResponse = {
      choices: [
        {
          message: {
            content: 'Great game! You played well as Ahri.'
          }
        }
      ]
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
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockMistralResponse)
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

    await lolLastgame.execute(mockInteraction);

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
        getString: vi.fn().mockReturnValue('NonExistentPlayer#EUW')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolLastgame.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue lors de la récupération de la dernière partie. Réessayez plus tard.'
    });
  });

  test('should handle missing Riot API key', async () => {
    delete process.env.RIOT_GAMES_API_KEY;

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('Couvbat#1312')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolLastgame.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Erreur: La clé API Riot n\'est pas configurée.'
    });
  });

  test('should handle no recent games', async () => {
    const mockAccountResponse = {
      puuid: 'test-puuid-123',
      gameName: 'Couvbat',
      tagLine: 'EUW'
    };

    const mockMatchIds = [];

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
      });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('TestPlayer#EUW')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolLastgame.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Aucune partie récente trouvée pour TestPlayer#EUW'
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

    await lolLastgame.execute(mockInteraction);

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

    await lolLastgame.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue lors de la récupération de la dernière partie. Réessayez plus tard.'
    });
  });
});
