import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { userLevelsDb } from '../database/db';
import { command } from '../commands/daily';

describe('Daily Command', () => {
  const mockInteraction = {
    user: {
      id: 'testUser123',
      displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png')
    },
    guildId: 'testGuild123',
    reply: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date.now() for consistent testing
    vi.spyOn(Date, 'now').mockReturnValue(1609459200000); // Fixed timestamp
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should give daily bonus for first time claim', async () => {
    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 5,
      coins: 100,
      lastDailyTimestamp: 0 // Never claimed before
    });

    // claimDaily is the atomic operation that actually grants the bonus
    userLevelsDb.claimDaily = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 5,
      coins: 175, // 100 + 75
      lastDailyTimestamp: 1609459200000
    });

    await command.execute(mockInteraction);

    // Expected bonus: 50 (base) + (5 * 5) = 75 coins
    expect(userLevelsDb.claimDaily).toHaveBeenCalledWith(
      'testUser123',
      'testGuild123',
      75,
      24 * 60 * 60 * 1000
    );
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('Bonus quotidien'),
              description: expect.stringContaining('+75')
            })
          })
        ])
      })
    );
  });

  it('should give correct bonus based on level', async () => {
    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 10,
      coins: 200,
      lastDailyTimestamp: 0
    });

    userLevelsDb.claimDaily = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 10,
      coins: 300, // 200 + 100
      lastDailyTimestamp: 1609459200000
    });

    await command.execute(mockInteraction);

    // Expected bonus: 50 (base) + (10 * 5) = 100 coins
    expect(userLevelsDb.claimDaily).toHaveBeenCalledWith(
      'testUser123',
      'testGuild123',
      100,
      24 * 60 * 60 * 1000
    );
  });

  it('should reject claim if cooldown not expired', async () => {
    const twentyThreeHoursAgo = Date.now() - (23 * 60 * 60 * 1000);

    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 5,
      coins: 100,
      lastDailyTimestamp: twentyThreeHoursAgo
    });

    // The cooldown gate is enforced atomically inside claimDaily itself,
    // which returns null when the cooldown has not elapsed.
    userLevelsDb.claimDaily = vi.fn().mockResolvedValue(null);

    await command.execute(mockInteraction);

    expect(userLevelsDb.claimDaily).toHaveBeenCalled();
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('déjà réclamé')
            })
          })
        ]),
        ephemeral: true
      })
    );
  });

  it('should allow claim after 24 hours', async () => {
    const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000);

    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 3,
      coins: 50,
      lastDailyTimestamp: twentyFiveHoursAgo
    });

    userLevelsDb.claimDaily = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 3,
      coins: 115, // 50 + 65
      lastDailyTimestamp: 1609459200000
    });

    await command.execute(mockInteraction);

    // Expected bonus: 50 (base) + (3 * 5) = 65 coins
    expect(userLevelsDb.claimDaily).toHaveBeenCalledWith(
      'testUser123',
      'testGuild123',
      65,
      24 * 60 * 60 * 1000
    );
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('réclamé')
            })
          })
        ])
      })
    );
  });

  it('should handle user with no level data', async () => {
    userLevelsDb.get = vi.fn().mockResolvedValue(null);
    userLevelsDb.claimDaily = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 0,
      coins: 50,
      lastDailyTimestamp: 1609459200000
    });

    await command.execute(mockInteraction);

    // Expected bonus: 50 (base) + (0 * 5) = 50 coins for level 0
    expect(userLevelsDb.claimDaily).toHaveBeenCalledWith(
      'testUser123',
      'testGuild123',
      50,
      24 * 60 * 60 * 1000
    );
  });

  it('should report a generic error if claimDaily throws', async () => {
    userLevelsDb.get = vi.fn().mockResolvedValue({
      userId: 'testUser123',
      guildId: 'testGuild123',
      level: 5,
      coins: 100,
      lastDailyTimestamp: 0
    });
    userLevelsDb.claimDaily = vi.fn().mockRejectedValue(new Error('DB unavailable'));

    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('erreur'),
        ephemeral: true
      })
    );
  });
});
