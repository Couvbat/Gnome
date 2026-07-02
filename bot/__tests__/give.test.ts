import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { userLevelsDb } from '../database/db';
import { command } from '../commands/give';

describe('/give command', () => {
  let mockInteraction;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Setup mock interaction
    mockInteraction = {
      user: {
        id: 'sender123',
        displayName: 'SenderUser',
      },
      guildId: 'guild123',
      options: {
        getUser: vi.fn(),
        getInteger: vi.fn(),
      },
      reply: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('Validation Tests', () => {
    test('should prevent giving coins to yourself', async () => {
      mockInteraction.options.getUser.mockReturnValue(mockInteraction.user);
      mockInteraction.options.getInteger.mockReturnValue(100);

      await command.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '❌ Transfert impossible',
                description: 'Vous ne pouvez pas vous transférer des pièces à vous-même!',
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });

    test('should prevent giving coins to a bot', async () => {
      const botUser = {
        id: 'bot123',
        displayName: 'BotUser',
        bot: true,
      };

      mockInteraction.options.getUser.mockReturnValue(botUser);
      mockInteraction.options.getInteger.mockReturnValue(100);

      await command.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '❌ Transfert impossible',
                description: 'Vous ne pouvez pas transférer des pièces à un bot!',
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });

    test('should prevent giving more coins than the sender has', async () => {
      userLevelsDb.get = vi.fn().mockResolvedValue({
        userId: 'sender123',
        guildId: 'guild123',
        coins: 100,
        xp: 0,
        level: 0,
      });

      const recipient = {
        id: 'recipient123',
        displayName: 'RecipientUser',
        bot: false,
      };

      mockInteraction.options.getUser.mockReturnValue(recipient);
      mockInteraction.options.getInteger.mockReturnValue(500);

      await command.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '❌ Solde insuffisant',
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });
  });

  describe('Successful Transfer Tests', () => {
    test('should successfully transfer coins between users', async () => {
      userLevelsDb.get = vi.fn()
        .mockResolvedValueOnce({
          userId: 'sender123',
          guildId: 'guild123',
          coins: 500,
          xp: 0,
          level: 0,
        })
        .mockResolvedValueOnce({
          userId: 'sender123',
          guildId: 'guild123',
          coins: 400,
          xp: 0,
          level: 0,
        })
        .mockResolvedValueOnce({
          userId: 'recipient123',
          guildId: 'guild123',
          coins: 200,
          xp: 0,
          level: 0,
        });

      userLevelsDb.addCoins = vi.fn();

      const recipient = {
        id: 'recipient123',
        displayName: 'RecipientUser',
        bot: false,
      };

      mockInteraction.options.getUser.mockReturnValue(recipient);
      mockInteraction.options.getInteger.mockReturnValue(100);

      await command.execute(mockInteraction);

      // Check that coins were deducted from sender
      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('sender123', 'guild123', -100);
      
      // Check that coins were added to recipient
      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('recipient123', 'guild123', 100);

      // Check success message
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '✅ Transfert réussi',
              }),
            }),
          ]),
        })
      );
    });

    test('should handle transfer of minimum amount (1 coin)', async () => {
      userLevelsDb.get = vi.fn()
        .mockResolvedValueOnce({
          userId: 'sender123',
          guildId: 'guild123',
          coins: 50,
          xp: 0,
          level: 0,
        })
        .mockResolvedValueOnce({
          userId: 'sender123',
          guildId: 'guild123',
          coins: 49,
          xp: 0,
          level: 0,
        })
        .mockResolvedValueOnce({
          userId: 'recipient123',
          guildId: 'guild123',
          coins: 101,
          xp: 0,
          level: 0,
        });

      userLevelsDb.addCoins = vi.fn();

      const recipient = {
        id: 'recipient123',
        displayName: 'RecipientUser',
        bot: false,
      };

      mockInteraction.options.getUser.mockReturnValue(recipient);
      mockInteraction.options.getInteger.mockReturnValue(1);

      await command.execute(mockInteraction);

      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('sender123', 'guild123', -1);
      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('recipient123', 'guild123', 1);
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '✅ Transfert réussi',
              }),
            }),
          ]),
        })
      );
    });

    test('should handle transfer when sender has exactly the amount', async () => {
      userLevelsDb.get = vi.fn()
        .mockResolvedValueOnce({
          userId: 'sender123',
          guildId: 'guild123',
          coins: 100,
          xp: 0,
          level: 0,
        })
        .mockResolvedValueOnce({
          userId: 'sender123',
          guildId: 'guild123',
          coins: 0,
          xp: 0,
          level: 0,
        })
        .mockResolvedValueOnce({
          userId: 'recipient123',
          guildId: 'guild123',
          coins: 200,
          xp: 0,
          level: 0,
        });

      userLevelsDb.addCoins = vi.fn();

      const recipient = {
        id: 'recipient123',
        displayName: 'RecipientUser',
        bot: false,
      };

      mockInteraction.options.getUser.mockReturnValue(recipient);
      mockInteraction.options.getInteger.mockReturnValue(100);

      await command.execute(mockInteraction);

      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('sender123', 'guild123', -100);
      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('recipient123', 'guild123', 100);
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '✅ Transfert réussi',
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      userLevelsDb.get = vi.fn().mockResolvedValueOnce({
        userId: 'sender123',
        guildId: 'guild123',
        coins: 500,
        xp: 0,
        level: 0,
      });

      userLevelsDb.addCoins = vi.fn().mockRejectedValueOnce(new Error('Database connection failed'));

      const recipient = {
        id: 'recipient123',
        displayName: 'RecipientUser',
        bot: false,
      };

      mockInteraction.options.getUser.mockReturnValue(recipient);
      mockInteraction.options.getInteger.mockReturnValue(100);

      await command.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '❌ Erreur',
                description: 'Une erreur est survenue lors du transfert. Veuillez réessayer.',
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });

    test('should handle sender with no existing user data (0 coins)', async () => {
      userLevelsDb.get = vi.fn().mockResolvedValue(null);

      const recipient = {
        id: 'recipient123',
        displayName: 'RecipientUser',
        bot: false,
      };

      mockInteraction.options.getUser.mockReturnValue(recipient);
      mockInteraction.options.getInteger.mockReturnValue(100);

      await command.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '❌ Solde insuffisant',
              }),
            }),
          ]),
          ephemeral: true,
        })
      );
    });
  });

  describe('Command Properties', () => {
    test('should have correct command name and description', () => {
      expect(command.data.name).toBe('give');
      expect(command.data.description).toBe('Transférer des pièces à un autre joueur');
    });

    test('should have cooldown set', () => {
      expect(command.cooldown).toBe(3);
    });
  });
});
