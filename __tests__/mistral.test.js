const mistral = require('../commands/mistral');
const { request } = require('undici');

// Mock undici
jest.mock('undici');

describe('Mistral Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set test environment variable
    process.env.MISTRAL_API_KEY = 'test-api-key';
  });

  test('should have correct command structure', () => {
    expect(mistral.data.name).toBe('mistral');
    expect(mistral.execute).toBeDefined();
    expect(mistral.cooldown).toBe('5');
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
    request.mockResolvedValue({
      body: {
        json: jest.fn().mockResolvedValue(mockResponse)
      }
    });

    const mockInteraction = {
      user: {
        username: 'TestUser'
      },
      options: {
        getString: jest.fn().mockReturnValue('Test prompt')
      },
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined)
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
    request.mockRejectedValue(new Error('API Error'));

    const mockInteraction = {
      user: {
        username: 'TestUser'
      },
      options: {
        getString: jest.fn().mockReturnValue('Test prompt')
      },
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined)
    };

    await mistral.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'An error occurred while processing your request. Please try again later.'
    });
  });

  test('should handle missing API key', async () => {
    const originalKey = process.env.MISTRAL_API_KEY;
    process.env.MISTRAL_API_KEY = '';

    request.mockRejectedValue(new Error('Unauthorized'));

    const mockInteraction = {
      user: {
        username: 'TestUser'
      },
      options: {
        getString: jest.fn().mockReturnValue('Test prompt')
      },
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined)
    };

    await mistral.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'An error occurred while processing your request. Please try again later.'
    });

    // Restore original key
    process.env.MISTRAL_API_KEY = originalKey;
  });
});
