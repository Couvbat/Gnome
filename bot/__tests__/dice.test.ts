import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { userLevelsDb } from '../database/db';
import { command } from '../commands/dice';

describe('Dice Command', () => {
  const mockInteraction = {
    options: {
      getInteger: vi.fn()
    },
    user: {
      id: 'testUser123'
    },
    guildId: 'testGuild123',
    reply: vi.fn().mockResolvedValue({
      edit: vi.fn().mockResolvedValue(undefined)
    }),
    editReply: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Math.random for predictable dice rolls
    vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject bet if user has insufficient coins', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(50);
    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'bet') return 100;
      if (name === 'prediction') return 7;
      return null;
    });

    await command.execute(mockInteraction);

    expect(userLevelsDb.getCoins).toHaveBeenCalledWith('testUser123', 'testGuild123');
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('pas assez de pièces'),
        ephemeral: true
      })
    );
  });

  it('should process winning bet correctly', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(200);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(true);
    userLevelsDb.addCoins = vi.fn().mockResolvedValue(undefined);
    userLevelsDb.addXp = vi.fn().mockResolvedValue(undefined);

    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'bet') return 50;
      if (name === 'prediction') return 7;
      return null;
    });

    // Mock dice rolls to give us 3 and 4 (total = 7)
    Math.random.mockReturnValueOnce(0.4).mockReturnValueOnce(0.6);

    await command.execute(mockInteraction);

    // Wait for setTimeout
    await new Promise(resolve => setTimeout(resolve, 2500));

    expect(userLevelsDb.spendCoins).toHaveBeenCalledWith('testUser123', 'testGuild123', 50);
    
    // Prediction 7 has multiplier of 6x, so payout = 50 * 6 = 300
    expect(userLevelsDb.addCoins).toHaveBeenCalledWith('testUser123', 'testGuild123', 300);
    
    // XP gain = bet / 2 = 25
    expect(userLevelsDb.addXp).toHaveBeenCalledWith('testUser123', 'testGuild123', 25);
  });

  it('should process losing bet correctly', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(200);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(true);
    userLevelsDb.addCoins = vi.fn().mockResolvedValue(undefined);
    userLevelsDb.addXp = vi.fn().mockResolvedValue(undefined);

    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'bet') return 50;
      if (name === 'prediction') return 12;
      return null;
    });

    // Mock dice rolls to give us 2 and 3 (total = 5, not 12)
    Math.random.mockReturnValueOnce(0.2).mockReturnValueOnce(0.4);

    await command.execute(mockInteraction);

    // Wait for setTimeout
    await new Promise(resolve => setTimeout(resolve, 2500));

    expect(userLevelsDb.spendCoins).toHaveBeenCalledWith('testUser123', 'testGuild123', 50);
    expect(userLevelsDb.addCoins).not.toHaveBeenCalled();
    expect(userLevelsDb.addXp).not.toHaveBeenCalled();
  });

  it('should handle edge case prediction of 2', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(200);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(true);
    userLevelsDb.addCoins = vi.fn().mockResolvedValue(undefined);
    userLevelsDb.addXp = vi.fn().mockResolvedValue(undefined);

    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'bet') return 20;
      if (name === 'prediction') return 2;
      return null;
    });

    // Mock dice rolls to give us 1 and 1 (total = 2)
    Math.random.mockReturnValueOnce(0.1).mockReturnValueOnce(0.1);

    await command.execute(mockInteraction);

    // Wait for setTimeout
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Prediction 2 has multiplier of 36x, so payout = 20 * 36 = 720
    expect(userLevelsDb.addCoins).toHaveBeenCalledWith('testUser123', 'testGuild123', 720);
    expect(userLevelsDb.addXp).toHaveBeenCalledWith('testUser123', 'testGuild123', 10);
  });

  it('should handle edge case prediction of 12', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(200);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(true);
    userLevelsDb.addCoins = vi.fn().mockResolvedValue(undefined);
    userLevelsDb.addXp = vi.fn().mockResolvedValue(undefined);

    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'bet') return 30;
      if (name === 'prediction') return 12;
      return null;
    });

    // Mock dice rolls to give us 6 and 6 (total = 12)
    Math.random.mockReturnValueOnce(0.99).mockReturnValueOnce(0.99);

    await command.execute(mockInteraction);

    // Wait for setTimeout
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Prediction 12 has multiplier of 36x, so payout = 30 * 36 = 1080
    expect(userLevelsDb.addCoins).toHaveBeenCalledWith('testUser123', 'testGuild123', 1080);
    expect(userLevelsDb.addXp).toHaveBeenCalledWith('testUser123', 'testGuild123', 15);
  });

  it('should show rolling animation before result', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(200);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(true);

    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'bet') return 50;
      if (name === 'prediction') return 7;
      return null;
    });

    Math.random.mockReturnValueOnce(0.4).mockReturnValueOnce(0.6);

    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('Jeu de Dés'),
              description: expect.stringContaining('roulent')
            })
          })
        ])
      })
    );
  });

  it('should handle failed coin deduction', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(200);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(false); // Deduction failed

    mockInteraction.options.getInteger.mockImplementation((name) => {
      if (name === 'bet') return 50;
      if (name === 'prediction') return 7;
      return null;
    });

    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Erreur'),
        ephemeral: true
      })
    );
  });
});
