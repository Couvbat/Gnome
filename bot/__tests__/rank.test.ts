import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { userLevelsDb } from '../database/db';
import { command } from '../commands/rank';

describe('Rank Command', () => {
  const mockInteraction = {
    isChatInputCommand: vi.fn().mockReturnValue(true),
    options: {
      getUser: vi.fn()
    },
    user: {
      id: 'testUser123',
      username: 'TestUser',
      displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png')
    },
    guildId: 'testGuild123',
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display rank for user with data', async () => {
    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      xp: 1500,
      level: 3,
      totalMessages: 150,
      totalVoiceMinutes: 60
    });

    mockInteraction.options.getUser.mockReturnValue(null); // No target user specified

    await command.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(userLevelsDb.get).toHaveBeenCalledWith('testUser123', 'testGuild123');
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('Rang de TestUser'),
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: '🎯 Niveau',
                  value: '3'
                }),
                expect.objectContaining({
                  name: '⭐ XP Total',
                  value: '1500'
                }),
                expect.objectContaining({
                  name: '💬 Messages',
                  value: '150'
                }),
                expect.objectContaining({
                  name: '🎤 Minutes Vocales',
                  value: '60'
                })
              ])
            })
          })
        ])
      })
    );
  });

  it('should display rank for different user when specified', async () => {
    const targetUser = {
      id: 'otherUser456',
      username: 'OtherUser',
      displayAvatarURL: vi.fn().mockReturnValue('https://example.com/other-avatar.png')
    };

    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'otherUser456',
      guildId: 'testGuild123',
      xp: 5000,
      level: 7,
      totalMessages: 500,
      totalVoiceMinutes: 200
    });

    mockInteraction.options.getUser.mockReturnValue(targetUser);

    await command.execute(mockInteraction);

    expect(userLevelsDb.get).toHaveBeenCalledWith('otherUser456', 'testGuild123');
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('OtherUser')
            })
          })
        ])
      })
    );
  });

  it('should handle user with no XP data', async () => {
    userLevelsDb.get = vi.fn().mockResolvedValue(null);
    mockInteraction.options.getUser.mockReturnValue(null);

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('pas encore d\'XP')
    });
  });

  it('should calculate progress bar correctly', async () => {
    // Level 2, with 600 XP total
    // Level 2 starts at: 2^2 * 100 = 400 XP
    // Level 3 starts at: 3^2 * 100 = 900 XP
    // XP in current level: 600 - 400 = 200
    // XP needed for next level: 900 - 400 = 500
    // Progress: 200/500 = 40%
    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      xp: 600,
      level: 2,
      totalMessages: 50,
      totalVoiceMinutes: 20
    });

    mockInteraction.options.getUser.mockReturnValue(null);

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: '📈 Progression',
                  value: expect.stringContaining('200/500')
                })
              ])
            })
          })
        ])
      })
    );
  });

  it('should handle high level users correctly', async () => {
    // Level 10, with 12000 XP total
    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      xp: 12000,
      level: 10,
      totalMessages: 1200,
      totalVoiceMinutes: 600
    });

    mockInteraction.options.getUser.mockReturnValue(null);

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: '🎯 Niveau',
                  value: '10'
                })
              ])
            })
          })
        ])
      })
    );
  });
});
