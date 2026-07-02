import { describe, test, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../commands/slots';
import { userLevelsDb } from '../database/db';

describe('Slots Command', () => {
  const mockInteraction = {
    options: {
      getInteger: vi.fn()
    },
    user: { id: 'testUser123' },
    guildId: 'testGuild123',
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject bet if user has insufficient coins', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(10); // User has 10 coins
    mockInteraction.options.getInteger.mockReturnValue(50); // Wants to bet 50
    
    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('Vous n\'avez pas assez de pièces'),
      ephemeral: true
    });
  });

  it('should deduct bet and show spinning animation', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(100);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(true);
    userLevelsDb.addCoins = vi.fn().mockResolvedValue(undefined);
    userLevelsDb.addXp = vi.fn().mockResolvedValue(undefined);
    
    mockInteraction.options.getInteger.mockReturnValue(20);
    
    // Execute command and wait for initial response (before setTimeout)
    await command.execute(mockInteraction);
    
    // Should check user coins
    expect(userLevelsDb.getCoins).toHaveBeenCalledWith('testUser123', 'testGuild123');
    
    // Should deduct coins
    expect(userLevelsDb.spendCoins).toHaveBeenCalledWith('testUser123', 'testGuild123', 20);
    
    // Should show spinning animation
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: '🎰 Machine à Sous',
            description: expect.stringContaining('🔄 Les rouleaux tournent...')
          })
        })
      ])
    });
  });

  it('should handle database error gracefully', async () => {
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(100);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(false); // Return false instead of throwing
    
    mockInteraction.options.getInteger.mockReturnValue(20);
    
    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('Erreur lors de la déduction des pièces'),
      ephemeral: true
    });
  });
});
