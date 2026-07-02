import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock the database module
vi.mock('../database/db', () => ({
  userLevelsDb: {
    getLeaderboard: vi.fn(),
    get: vi.fn()
  },
  connectDatabase: vi.fn()
}));

import { userLevelsDb } from '../database/db';
import { command } from '../commands/leaderboard';

describe('Leaderboard Command', () => {
  let mockInteraction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getInteger: vi.fn()
      },
      user: {
        id: 'testUser123'
      },
      client: {
        users: {
          fetch: vi.fn()
        }
      },
      guildId: 'testGuild123',
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('should display top 10 leaderboard by default', async () => {
    const mockLeaderboard = [
      { userId: 'user1', level: 10, xp: 10500, coins: 500, totalMessages: 1000, coinsAllTimeHigh: 500 },
      { userId: 'user2', level: 9, xp: 8500, coins: 400, totalMessages: 850, coinsAllTimeHigh: 450 },
      { userId: 'user3', level: 8, xp: 7000, coins: 350, totalMessages: 700, coinsAllTimeHigh: 400 }
    ];

    userLevelsDb.getLeaderboard.mockResolvedValue(mockLeaderboard);
    mockInteraction.client.users.fetch.mockImplementation((userId) => {
      return Promise.resolve({
        id: userId,
        username: `User${userId.slice(-1)}`
      });
    });

    mockInteraction.options.getInteger.mockReturnValue(null); // Use default limit

    await command.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(userLevelsDb.getLeaderboard).toHaveBeenCalledWith('testGuild123', 10);
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('Classement'),
              description: expect.stringContaining('🥇')
            })
          })
        ])
      })
    );
  });

  it('should respect custom limit option', async () => {
    const mockLeaderboard = Array.from({ length: 15 }, (_, i) => ({
      userId: `user${i}`,
      level: 15 - i,
      xp: (15 - i) * 1000,
      coins: (15 - i) * 50,
      totalMessages: (15 - i) * 100,
      coinsAllTimeHigh: (15 - i) * 60
    }));

    userLevelsDb.getLeaderboard.mockResolvedValue(mockLeaderboard);
    mockInteraction.client.users.fetch.mockImplementation((userId) => {
      return Promise.resolve({
        id: userId,
        username: `User${userId.slice(-1)}`
      });
    });

    mockInteraction.options.getInteger.mockReturnValue(15);

    await command.execute(mockInteraction);

    expect(userLevelsDb.getLeaderboard).toHaveBeenCalledWith('testGuild123', 15);
  });

  it('should display medals for top 3 users', async () => {
    const mockLeaderboard = [
      { userId: 'user1', level: 10, xp: 10500, coins: 500, totalMessages: 1000, coinsAllTimeHigh: 500 },
      { userId: 'user2', level: 9, xp: 8500, coins: 400, totalMessages: 850, coinsAllTimeHigh: 450 },
      { userId: 'user3', level: 8, xp: 7000, coins: 350, totalMessages: 700, coinsAllTimeHigh: 400 },
      { userId: 'user4', level: 7, xp: 5500, coins: 300, totalMessages: 550, coinsAllTimeHigh: 350 }
    ];

    userLevelsDb.getLeaderboard.mockResolvedValue(mockLeaderboard);
    mockInteraction.client.users.fetch.mockImplementation((userId) => {
      return Promise.resolve({
        id: userId,
        username: `User${userId.slice(-1)}`
      });
    });

    mockInteraction.options.getInteger.mockReturnValue(null);

    await command.execute(mockInteraction);

    const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
    const description = editReplyCall.embeds[0].data.description;

    expect(description).toContain('🥇');
    expect(description).toContain('🥈');
    expect(description).toContain('🥉');
    expect(description).toContain('**4.**'); // 4th place should not have medal
  });

  it('should handle empty leaderboard', async () => {
    userLevelsDb.getLeaderboard.mockResolvedValue([]);
    mockInteraction.options.getInteger.mockReturnValue(null);

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Aucun utilisateur')
    );
  });

  it('should show current user position in footer if not in top list', async () => {
    const mockLeaderboard = Array.from({ length: 10 }, (_, i) => ({
      userId: `topUser${i}`,
      level: 20 - i,
      xp: (20 - i) * 1000,
      coins: (20 - i) * 50,
      totalMessages: (20 - i) * 100,
      coinsAllTimeHigh: (20 - i) * 60
    }));

    const allUsers = [
      ...mockLeaderboard,
      { userId: 'testUser123', level: 5, xp: 2500, coins: 200, totalMessages: 250 }
    ];

    userLevelsDb.getLeaderboard
      .mockResolvedValueOnce(mockLeaderboard) // First call for display
      .mockResolvedValueOnce(allUsers); // Second call for finding position

    userLevelsDb.get.mockResolvedValue({
      userId: 'testUser123',
      level: 5,
      xp: 2500,
      coins: 200
    });

    mockInteraction.client.users.fetch.mockImplementation((userId) => {
      return Promise.resolve({
        id: userId,
        username: userId
      });
    });

    mockInteraction.options.getInteger.mockReturnValue(null);

    await command.execute(mockInteraction);

    const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
    expect(editReplyCall.embeds[0].data.footer).toBeDefined();
    expect(editReplyCall.embeds[0].data.footer.text).toContain('#11'); // 11th position
  });

  it('should handle users that cannot be fetched', async () => {
    const mockLeaderboard = [
      { userId: 'validUser', level: 10, xp: 10500, coins: 500, totalMessages: 1000, coinsAllTimeHigh: 500 },
      { userId: 'deletedUser', level: 9, xp: 8500, coins: 400, totalMessages: 850, coinsAllTimeHigh: 450 }
    ];

    userLevelsDb.getLeaderboard.mockResolvedValue(mockLeaderboard);
    mockInteraction.client.users.fetch.mockImplementation((userId) => {
      if (userId === 'validUser') {
        return Promise.resolve({ id: userId, username: 'ValidUser' });
      }
      return Promise.reject(new Error('User not found'));
    });

    mockInteraction.options.getInteger.mockReturnValue(null);

    await command.execute(mockInteraction);

    const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
    const description = editReplyCall.embeds[0].data.description;

    expect(description).toContain('ValidUser');
    expect(description).toContain('Utilisateur inconnu');
  });
});
