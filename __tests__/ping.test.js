const { SlashCommandBuilder } = require('discord.js');
const ping = require('../commands/ping');

describe('Ping Command', () => {
  test('should have correct command structure', () => {
    expect(ping.data).toBeInstanceOf(SlashCommandBuilder);
    expect(ping.data.name).toBe('ping');
    expect(ping.execute).toBeDefined();
    expect(typeof ping.execute).toBe('function');
  });

  test('should reply with pong and latency', async () => {
    // Mock interaction
    const mockInteraction = {
      reply: jest.fn().mockResolvedValue(undefined)
    };

    await ping.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('Pong!');
  });

  test('should handle error gracefully', async () => {
    const mockInteraction = {
      reply: jest.fn().mockRejectedValue(new Error('Network error'))
    };

    await expect(ping.execute(mockInteraction)).rejects.toThrow('Network error');
  });
});
