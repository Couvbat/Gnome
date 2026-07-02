import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock undici before requiring the command
vi.mock('undici');
import { request } from 'undici';
import { command } from '../commands/conversation';

describe('Conversation Command', () => {
  const mockThread = {
    id: 'thread123',
    toString: vi.fn().mockReturnValue('<#thread123>'),
    send: vi.fn().mockResolvedValue(undefined),
    createMessageCollector: vi.fn(),
    messages: {
      fetch: vi.fn()
    }
  };

  const mockInteraction = {
    isChatInputCommand: vi.fn().mockReturnValue(true),
    user: {
      id: 'testUser123',
      username: 'TestUser'
    },
    channel: {
      threads: {
        create: vi.fn().mockResolvedValue(mockThread)
      }
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a thread for conversation', async () => {
    const mockCollector = {
      on: vi.fn()
    };
    mockThread.createMessageCollector.mockReturnValue(mockCollector);

    await command.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.channel.threads.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining('TestUser'),
        autoArchiveDuration: 60
      })
    );
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Conversation démarrée')
      })
    );
  });

  it('should create message collector with correct settings', async () => {
    const mockCollector = {
      on: vi.fn()
    };
    mockThread.createMessageCollector.mockReturnValue(mockCollector);

    await command.execute(mockInteraction);

    expect(mockThread.createMessageCollector).toHaveBeenCalledWith(
      expect.objectContaining({
        time: 900000 // 15 minutes
      })
    );

    expect(mockCollector.on).toHaveBeenCalledWith('collect', expect.any(Function));
    expect(mockCollector.on).toHaveBeenCalledWith('end', expect.any(Function));
  });

  it('should handle channel without thread support', async () => {
    const noThreadInteraction = {
      ...mockInteraction,
      channel: {} // No threads property
    };

    await command.execute(noThreadInteraction);

    expect(noThreadInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('salon textuel qui supporte les threads')
      })
    );
  });

  it('should send expiration message when collector ends', async () => {
    let endCallback;
    const mockCollector = {
      on: vi.fn((event, callback) => {
        if (event === 'end') {
          endCallback = callback;
        }
      })
    };
    mockThread.createMessageCollector.mockReturnValue(mockCollector);

    await command.execute(mockInteraction);

    // Simulate collector end
    const mockCollection = new Map();
    endCallback(mockCollection, 'time');

    expect(mockThread.send).toHaveBeenCalledWith(
      expect.stringContaining('conversation a expiré')
    );
  });

  it('should handle Mistral API response in collector', async () => {
    let collectCallback;
    const mockCollector = {
      on: vi.fn((event, callback) => {
        if (event === 'collect') {
          collectCallback = callback;
        }
      })
    };
    mockThread.createMessageCollector.mockReturnValue(mockCollector);

    // Mock Mistral API response
    request.mockResolvedValue({
      body: {
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'This is a test response from Mistral AI.'
              }
            }
          ]
        })
      }
    });

    // Mock thread messages for conversation history
    mockThread.messages.fetch.mockResolvedValue(new Map());

    await command.execute(mockInteraction);

    // Simulate a message being collected
    const mockMessage = {
      author: {
        id: 'testUser123',
        bot: false
      },
      content: 'Hello, AI!',
      reply: vi.fn().mockResolvedValue(undefined)
    };

    await collectCallback(mockMessage);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(request).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': expect.stringContaining('Bearer')
        })
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    let collectCallback;
    const mockCollector = {
      on: vi.fn((event, callback) => {
        if (event === 'collect') {
          collectCallback = callback;
        }
      })
    };
    mockThread.createMessageCollector.mockReturnValue(mockCollector);

    // Mock API error
    request.mockRejectedValue(new Error('API Error'));

    mockThread.messages.fetch.mockResolvedValue(new Map());

    await command.execute(mockInteraction);

    const mockMessage = {
      author: {
        id: 'testUser123',
        bot: false
      },
      content: 'Hello, AI!',
      reply: vi.fn().mockResolvedValue(undefined)
    };

    await collectCallback(mockMessage);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that error message was sent to thread channel (not message.reply)
    expect(mockThread.send).toHaveBeenCalledWith(
      expect.stringContaining('erreur')
    );
  });

  it('should filter messages to only collect from original user', async () => {
    const mockCollector = {
      on: vi.fn()
    };
    mockThread.createMessageCollector.mockReturnValue(mockCollector);

    await command.execute(mockInteraction);

    const collectorOptions = mockThread.createMessageCollector.mock.calls[0][0];
    const filter = collectorOptions.filter;

    // Test filter with correct user
    const correctUserMessage = {
      author: {
        id: 'testUser123',
        bot: false
      }
    };
    expect(filter(correctUserMessage)).toBe(true);

    // Test filter with wrong user
    const wrongUserMessage = {
      author: {
        id: 'otherUser456',
        bot: false
      }
    };
    expect(filter(wrongUserMessage)).toBe(false);

    // Test filter with bot
    const botMessage = {
      author: {
        id: 'testUser123',
        bot: true
      }
    };
    expect(filter(botMessage)).toBe(false);
  });
});
