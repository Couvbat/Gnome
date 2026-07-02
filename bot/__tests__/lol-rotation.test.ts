import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock undici before importing the command
vi.mock('undici');

import lolRotation from '../commands/lol-rotation';
import { request } from 'undici';

describe('LoL Rotation Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RIOT_GAMES_API_KEY = 'test-riot-api-key';
  });

  test('should have correct command structure', () => {
    expect(lolRotation.data.name).toBe('lol-rotation');
    expect(lolRotation.execute).toBeDefined();
    expect(typeof lolRotation.execute).toBe('function');
  });

  test('should defer reply and fetch champion rotation', async () => {
    const mockRotationResponse = {
      freeChampionIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      freeChampionIdsForNewPlayers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      maxNewPlayerLevel: 10
    };

    const mockChampionData = {
      type: 'champion',
      format: 'standAloneComplex',
      version: '14.21.1',
      data: {
        Annie: {
          version: '14.21.1',
          id: 'Annie',
          key: '1',
          name: 'Annie',
          title: 'the Dark Child',
          blurb: 'Test blurb',
          info: {
            attack: 2,
            defense: 3,
            magic: 10,
            difficulty: 6
          },
          image: {
            full: 'Annie.png',
            sprite: 'champion0.png',
            group: 'champion',
            x: 0,
            y: 0,
            w: 48,
            h: 48
          },
          tags: ['Mage']
        },
        Ahri: {
          version: '14.21.1',
          id: 'Ahri',
          key: '2',
          name: 'Ahri',
          title: 'the Nine-Tailed Fox',
          blurb: 'Test blurb',
          info: {
            attack: 3,
            defense: 4,
            magic: 8,
            difficulty: 5
          },
          image: {
            full: 'Ahri.png',
            sprite: 'champion0.png',
            group: 'champion',
            x: 48,
            y: 0,
            w: 48,
            h: 48
          },
          tags: ['Mage', 'Assassin']
        }
      }
    };

    // Mock API responses
    request
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockRotationResponse)
        }
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockChampionData)
        }
      });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolRotation.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      'https://euw1.api.riotgames.com/lol/platform/v3/champion-rotations',
      expect.objectContaining({
        headers: {
          'X-Riot-Token': 'test-riot-api-key'
        }
      })
    );
    expect(request).toHaveBeenCalledWith(
      'https://ddragon.leagueoflegends.com/cdn/14.21.1/data/fr_FR/champion.json'
    );
    expect(mockInteraction.editReply).toHaveBeenCalled();
  });

  test('should handle missing API key', async () => {
    delete process.env.RIOT_GAMES_API_KEY;

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolRotation.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Erreur: La clé API Riot n\'est pas configurée.'
    });
  });

  test('should handle rotation API error', async () => {
    request.mockResolvedValueOnce({
      statusCode: 500,
      body: {
        json: vi.fn().mockResolvedValue({})
      }
    });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolRotation.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue lors de la récupération de la rotation. Réessayez plus tard.'
    });
  });

  test('should handle Data Dragon API error', async () => {
    const mockRotationResponse = {
      freeChampionIds: [1, 2, 3],
      freeChampionIdsForNewPlayers: [1, 2, 3],
      maxNewPlayerLevel: 10
    };

    request
      .mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue(mockRotationResponse)
        }
      })
      .mockResolvedValueOnce({
        statusCode: 500,
        body: {
          json: vi.fn().mockResolvedValue({})
        }
      });

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolRotation.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue lors de la récupération de la rotation. Réessayez plus tard.'
    });
  });

  test('should handle general API errors gracefully', async () => {
    request.mockRejectedValueOnce(new Error('Network Error'));

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await lolRotation.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue lors de la récupération de la rotation. Réessayez plus tard.'
    });
  });
});
