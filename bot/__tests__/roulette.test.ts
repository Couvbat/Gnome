import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { command } from '../commands/roulette';
import { userLevelsDb } from '../database/db';

describe('Roulette Command', () => {
  let mockInteraction;
  let mockResponse;
  let mockCollector;

  beforeEach(() => {
    // Mock database functions
    userLevelsDb.getCoins = vi.fn().mockResolvedValue(100);
    userLevelsDb.spendCoins = vi.fn().mockResolvedValue(true);
    userLevelsDb.addCoins = vi.fn().mockResolvedValue(undefined);
    userLevelsDb.addXp = vi.fn().mockResolvedValue(undefined);

    // Mock collector
    mockCollector = {
      on: vi.fn((event, callback) => {
        mockCollector[`_${event}`] = callback;
      }),
    };

    // Mock response with collector
    mockResponse = {
      createMessageComponentCollector: vi.fn(() => mockCollector),
    };

    // Mock interaction
    mockInteraction = {
      reply: vi.fn().mockResolvedValue(mockResponse),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: {
        getInteger: vi.fn().mockReturnValue(50) // Default bet amount
      },
      user: {
        id: 'test-user-id',
        username: 'TestUser',
      },
      guildId: 'test-guild-id',
    };
  });

  test('command should be defined', () => {
    expect(command).toBeDefined();
    expect(command.data).toBeDefined();
    expect(command.execute).toBeDefined();
  });

  test('command should have correct name and description', () => {
    expect(command.data.name).toBe('roulette');
    expect(command.data.description).toBe('Jouer à la roulette européenne');
  });

  test('should reply with game embed and buttons', async () => {
    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    const replyCall = mockInteraction.reply.mock.calls[0][0];
    
    // Check that reply includes embeds and components
    expect(replyCall.embeds).toBeDefined();
    expect(replyCall.embeds.length).toBe(1);
    expect(replyCall.components).toBeDefined();
    expect(replyCall.components.length).toBe(2); // Two rows of buttons
    expect(replyCall.fetchReply).toBe(true);
  });

  test('should create message component collector on response, not channel', async () => {
    await command.execute(mockInteraction);

    // Critical fix verification: collector should be created on the response message
    expect(mockResponse.createMessageComponentCollector).toHaveBeenCalledTimes(1);
    expect(mockResponse.createMessageComponentCollector).toHaveBeenCalledWith({
      componentType: 2, // ComponentType.Button
      time: 60000,
    });
    
    // Verify collector is NOT created on the channel
    expect(mockInteraction.channel?.createMessageComponentCollector).toBeUndefined();
  });

  test('should have collect and end event handlers', async () => {
    await command.execute(mockInteraction);

    expect(mockCollector.on).toHaveBeenCalledWith('collect', expect.any(Function));
    expect(mockCollector.on).toHaveBeenCalledWith('end', expect.any(Function));
  });

  test('embed should explain bet types and payouts', async () => {
    await command.execute(mockInteraction);

    const replyCall = mockInteraction.reply.mock.calls[0][0];
    const embed = replyCall.embeds[0];
    
    expect(embed.data.title).toBe('🎰 Roulette Européenne');
    expect(embed.data.fields).toBeDefined();
    expect(embed.data.fields.length).toBeGreaterThanOrEqual(3);
    
    // Check for bet type fields
    const fieldNames = embed.data.fields.map(f => f.name);
    expect(fieldNames.some(name => name.includes('Couleurs'))).toBe(true);
    expect(fieldNames.some(name => name.includes('Parité'))).toBe(true);
    expect(fieldNames.some(name => name.includes('Position'))).toBe(true);
  });

  test('buttons should include red, black, even, odd, low, high, number', async () => {
    await command.execute(mockInteraction);

    const replyCall = mockInteraction.reply.mock.calls[0][0];
    const actionRows = replyCall.components;
    
    expect(actionRows.length).toBe(2);
    
    const allButtons = [
      ...actionRows[0].components,
      ...actionRows[1].components
    ];
    
    const buttonIds = allButtons.map(btn => btn.data.custom_id);
    expect(buttonIds).toContain('bet_red');
    expect(buttonIds).toContain('bet_black');
    expect(buttonIds).toContain('bet_even');
    expect(buttonIds).toContain('bet_odd');
    expect(buttonIds).toContain('bet_low');
    expect(buttonIds).toContain('bet_high');
    expect(buttonIds).toContain('bet_number');
  });

  test('should have appropriate cooldown', () => {
    expect(command.cooldown).toBeDefined();
    expect(typeof command.cooldown).toBe('number');
    expect(command.cooldown).toBeGreaterThanOrEqual(0);
  });

  test('collector should handle button interactions from correct user', async () => {
    await command.execute(mockInteraction);

    const collectHandler = mockCollector._collect;
    expect(collectHandler).toBeDefined();

    // Mock a button interaction from the same user
    const mockButtonInteraction = {
      user: { id: 'test-user-id' },
      customId: 'bet_red',
      component: { label: 'Rouge' },
      update: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    // Should not throw and should process the interaction
    await expect(collectHandler(mockButtonInteraction)).resolves.not.toThrow();
    expect(mockButtonInteraction.update).toHaveBeenCalled();
  });

  test('collector should reject interactions from different users', async () => {
    await command.execute(mockInteraction);

    const collectHandler = mockCollector._collect;

    // Mock a button interaction from a different user
    const mockButtonInteraction = {
      user: { id: 'different-user-id' },
      customId: 'bet_red',
      update: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await collectHandler(mockButtonInteraction);

    // Should send ephemeral message to wrong user
    expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('ne vous appartient pas'),
      ephemeral: true,
    });
  });

  test('collector end handler should disable buttons', async () => {
    await command.execute(mockInteraction);

    const endHandler = mockCollector._end;
    expect(endHandler).toBeDefined();

    await endHandler();

    expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);
    const editCall = mockInteraction.editReply.mock.calls[0][0];
    expect(editCall.components).toBeDefined();
    expect(editCall.components.length).toBe(0);
  });

  test('should show "la roulette tourne" message when bet is placed', async () => {
    await command.execute(mockInteraction);

    const collectHandler = mockCollector._collect;

    // Mock a button interaction for a bet type (not number)
    const mockButtonInteraction = {
      user: { id: 'test-user-id' },
      customId: 'bet_red',
      component: { label: 'Rouge' },
      update: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await collectHandler(mockButtonInteraction);

    // Verify the spinning message is shown
    expect(mockButtonInteraction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('La roulette tourne'),
      })
    );
  });
});
