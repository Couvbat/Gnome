import { describe, test, expect, vi, beforeEach } from 'vitest';
import { request } from 'undici';

// Mock undici before importing the command
vi.mock('undici', () => ({
  request: vi.fn()
}));

import mistral from '../commands/mistral';

describe('Mistral Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set test environment variable
    process.env.MISTRAL_API_KEY = 'test-api-key';
  });

  test('should have correct command structure', () => {
    expect(mistral.data.name).toBe('mistral');
    expect(mistral.execute).toBeDefined();
    expect(mistral.cooldown).toBe(5);
    expect(typeof mistral.execute).toBe('function');
  });

  test('should defer reply and call Mistral API', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Test response from Mistral'
          }
        }
      ]
    };

    // Mock API response
    vi.mocked(request).mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: vi.fn().mockResolvedValue(mockResponse)
      }
    } as any);

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      user: {
        username: 'TestUser'
      },
      options: {
        getString: vi.fn().mockReturnValue('Test prompt')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await mistral.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key'
        })
      })
    );
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'TestUser demande : Test prompt reponse : Test response from Mistral'
    });
  });

  test('should handle API error gracefully', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('API Error'));

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      user: {
        username: 'TestUser'
      },
      options: {
        getString: vi.fn().mockReturnValue('Test prompt')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await mistral.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue. Réessaie plus tard.'
    });
  });

  test('should handle missing API key', async () => {
    const originalKey = process.env.MISTRAL_API_KEY;
    process.env.MISTRAL_API_KEY = '';

    vi.mocked(request).mockRejectedValueOnce(new Error('Unauthorized'));

    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      user: {
        username: 'TestUser'
      },
      options: {
        getString: vi.fn().mockReturnValue('Test prompt')
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };

    await mistral.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Une erreur est survenue. Réessaie plus tard.'
    });

    // Restore original key
    process.env.MISTRAL_API_KEY = originalKey;
  });
});
