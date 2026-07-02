import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { userLevelsDb } from '../database/db';
import { command } from '../commands/balance';

describe('Balance Command', () => {
  const mockInteraction = {
    options: {
      getUser: vi.fn()
    },
    user: { 
      id: 'testUser123',
      displayName: 'TestUser',
      displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png')
    },
    guildId: 'testGuild123',
    reply: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show user balance correctly', async () => {
    // Mock database response
    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      xp: 1000,
      level: 10,
      coins: 500
    });

    mockInteraction.options.getUser.mockReturnValue(null); // No target user specified
    
    await command.execute(mockInteraction);

    expect(userLevelsDb.get).toHaveBeenCalledWith('testUser123', 'testGuild123');
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: '💰 Solde de pièces',
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: '🪙 Pièces',
                  value: '**500** pièces'
                })
              ])
            })
          })
        ])
      })
    );
  });

  it('should handle user with no data', async () => {
    userLevelsDb.get = vi.fn().mockResolvedValue(null);

    mockInteraction.options.getUser.mockReturnValue(null);
    
    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: '🪙 Pièces',
                  value: '**0** pièces'
                })
              ])
            })
          })
        ])
      })
    );
  });
});