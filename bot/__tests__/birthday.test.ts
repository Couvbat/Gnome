import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { birthdaysDb } from '../database/db';
import { command } from '../commands/birthday';

describe('Birthday Command', () => {
  const mockInteraction = {
    isChatInputCommand: vi.fn().mockReturnValue(true),
    options: {
      getSubcommand: vi.fn(),
      getInteger: vi.fn(),
      getUser: vi.fn()
    },
    user: {
      id: 'testUser123',
      username: 'TestUser'
    },
    client: {
      users: {
        fetch: vi.fn()
      }
    },
    guild: {
      members: {
        fetch: vi.fn()
      }
    },
    guildId: 'testGuild123',
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    birthdaysDb.set = vi.fn().mockResolvedValue(undefined);
    birthdaysDb.get = vi.fn().mockResolvedValue(null);
    birthdaysDb.delete = vi.fn().mockResolvedValue(undefined);
    birthdaysDb.getAll = vi.fn().mockResolvedValue([]);
  });

  describe('set subcommand', () => {
    it('should set birthday with valid date', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('set');
      mockInteraction.options.getInteger.mockImplementation((name) => {
        if (name === 'day') return 15;
        if (name === 'month') return 6;
        if (name === 'year') return 1990;
        return null;
      });

      await command.execute(mockInteraction);

      expect(birthdaysDb.set).toHaveBeenCalledWith({
        userId: 'testUser123',
        guildId: 'testGuild123',
        birthMonth: 6,
        birthDay: 15,
        birthYear: 1990
      });
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('🎉'),
          ephemeral: true
        })
      );
    });

    it('should set birthday without year', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('set');
      mockInteraction.options.getInteger.mockImplementation((name, required) => {
        if (name === 'day') return 25;
        if (name === 'month') return 12;
        if (name === 'year') return null;
        return null;
      });

      await command.execute(mockInteraction);

      expect(birthdaysDb.set).toHaveBeenCalledWith({
        userId: 'testUser123',
        guildId: 'testGuild123',
        birthMonth: 12,
        birthDay: 25,
        birthYear: null
      });
    });

    it('should reject invalid date', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('set');
      mockInteraction.options.getInteger.mockImplementation((name) => {
        if (name === 'day') return 31;
        if (name === 'month') return 2; // February doesn't have 31 days
        if (name === 'year') return null;
        return null;
      });

      await command.execute(mockInteraction);

      expect(birthdaysDb.set).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('❌'),
          ephemeral: true
        })
      );
    });
  });

  describe('check subcommand', () => {
    it('should display existing birthday', async () => {
      birthdaysDb.get.mockResolvedValue({
        userId: 'testUser123',
        guildId: 'testGuild123',
        birthMonth: 5,
        birthDay: 10,
        birthYear: 1995
      });

      mockInteraction.options.getSubcommand.mockReturnValue('check');

      await command.execute(mockInteraction);

      expect(birthdaysDb.get).toHaveBeenCalledWith('testUser123', 'testGuild123');
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('10 mai'),
          ephemeral: true
        })
      );
    });

    it('should handle user with no birthday set', async () => {
      birthdaysDb.get.mockResolvedValue(null);
      mockInteraction.options.getSubcommand.mockReturnValue('check');

      await command.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('❌'),
          ephemeral: true
        })
      );
    });
  });

  describe('remove subcommand', () => {
    it('should remove existing birthday', async () => {
      birthdaysDb.get.mockResolvedValue({
        userId: 'testUser123',
        guildId: 'testGuild123',
        birthMonth: 5,
        birthDay: 10,
        birthYear: null
      });

      mockInteraction.options.getSubcommand.mockReturnValue('remove');

      await command.execute(mockInteraction);

      expect(birthdaysDb.delete).toHaveBeenCalledWith('testUser123', 'testGuild123');
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('✅'),
          ephemeral: true
        })
      );
    });

    it('should handle removing non-existent birthday', async () => {
      birthdaysDb.get.mockResolvedValue(null);
      mockInteraction.options.getSubcommand.mockReturnValue('remove');

      await command.execute(mockInteraction);

      expect(birthdaysDb.delete).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('❌'),
          ephemeral: true
        })
      );
    });
  });

  describe('list subcommand', () => {
    it('should display list of birthdays', async () => {
      mockInteraction.client.users.fetch.mockImplementation((userId) => {
        return Promise.resolve({
          id: userId,
          username: `User${userId.substring(0, 3)}`
        });
      });

      birthdaysDb.getAll.mockResolvedValue([
        { userId: 'user1', birthMonth: 1, birthDay: 15, birthYear: null },
        { userId: 'user2', birthMonth: 6, birthDay: 20, birthYear: 1990 }
      ]);

      mockInteraction.options.getSubcommand.mockReturnValue('list');

      await command.execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(birthdaysDb.getAll).toHaveBeenCalledWith('testGuild123');
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('Anniversaires')
              })
            })
          ])
        })
      );
    });

    it('should handle empty birthday list', async () => {
      birthdaysDb.getAll.mockResolvedValue([]);
      mockInteraction.options.getSubcommand.mockReturnValue('list');

      await command.execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Aucun anniversaire')
      );
    });
  });
});
