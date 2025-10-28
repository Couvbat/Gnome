const listen = require('../commands/listen');

describe('Listen Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  test('should have correct command structure', () => {
    expect(listen.data.name).toBe('listen');
    expect(listen.execute).toBeDefined();
    expect(listen.cooldown).toBe('10');
  });

  test('should require user to be in voice channel', async () => {
    const mockInteraction = {
      member: {
        voice: {
          channel: null // User not in voice channel
        }
      },
      options: {
        getString: jest.fn().mockReturnValue('start')
      },
      guildId: 'test-guild-id',
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined)
    };

    await listen.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Tu dois être dans un salon vocal pour que je puisse t\'écouter !'
    });
  });

  test('should handle stop when not listening', async () => {
    const mockInteraction = {
      options: {
        getString: jest.fn().mockReturnValue('stop')
      },
      guildId: 'test-guild-id-not-active',
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined)
    };

    await listen.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Je ne suis pas en train d\'écouter dans ce serveur.'
    });
  });
});

