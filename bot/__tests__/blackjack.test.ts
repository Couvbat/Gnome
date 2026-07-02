import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Import from built dist folder since TypeScript needs to be compiled
import blackjack from '../commands/blackjack.ts';
const command = blackjack.command || blackjack;
import { userLevelsDb } from '../database/db';

describe('Blackjack Command', () => {
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
      channel: {
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector)
      }
    };
  });

  test('command should be defined', () => {
    expect(command).toBeDefined();
    expect(command.data).toBeDefined();
    expect(command.execute).toBeDefined();
  });

  test('command should have correct name and description', () => {
    expect(command.data.name).toBe('blackjack');
    expect(command.data.description).toBe('Jouer au Blackjack contre le croupier');
  });

  test('should reply with game embed and buttons', async () => {
    await command.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    const replyCall = mockInteraction.reply.mock.calls[0][0];
    
    // Check that reply includes embeds and components
    expect(replyCall.embeds).toBeDefined();
    expect(replyCall.embeds.length).toBe(1);
    expect(replyCall.components).toBeDefined();
    expect(replyCall.components.length).toBe(1);
    expect(replyCall.fetchReply).toBe(true);
  });

  test('should create message component collector', async () => {
    await command.execute(mockInteraction);

    expect(mockResponse.createMessageComponentCollector).toHaveBeenCalledTimes(1);
    expect(mockResponse.createMessageComponentCollector).toHaveBeenCalledWith({
      componentType: 2, // ComponentType.Button
      time: 300_000,
    });
  });

  test('should have collect and end event handlers', async () => {
    await command.execute(mockInteraction);

    expect(mockCollector.on).toHaveBeenCalledWith('collect', expect.any(Function));
    expect(mockCollector.on).toHaveBeenCalledWith('end', expect.any(Function));
  });

  test('embed should contain player and dealer hands', async () => {
    await command.execute(mockInteraction);

    const replyCall = mockInteraction.reply.mock.calls[0][0];
    const embed = replyCall.embeds[0];
    
    expect(embed.data.title).toBe('🎰 Blackjack');
    expect(embed.data.fields).toBeDefined();
    expect(embed.data.fields.length).toBeGreaterThanOrEqual(2);
    
    // Check for player and dealer fields
    const fieldNames = embed.data.fields.map(f => f.name);
    expect(fieldNames).toContain('🎴 Votre main');
    expect(fieldNames).toContain('🎴 Main du croupier');
  });

  test('buttons should include hit, stand, and new game', async () => {
    await command.execute(mockInteraction);

    const replyCall = mockInteraction.reply.mock.calls[0][0];
    const actionRow = replyCall.components[0];
    
    expect(actionRow.components.length).toBe(3);
    
    const buttonIds = actionRow.components.map(btn => btn.data.custom_id);
    expect(buttonIds).toContain('hit');
    expect(buttonIds).toContain('stand');
    expect(buttonIds).toContain('newgame');
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
      customId: 'hit',
      update: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    // Should not throw and should process the interaction
    await expect(collectHandler(mockButtonInteraction)).resolves.not.toThrow();
  });

  test('collector should reject interactions from different users', async () => {
    await command.execute(mockInteraction);

    const collectHandler = mockCollector._collect;

    // Mock a button interaction from a different user
    const mockButtonInteraction = {
      user: { id: 'different-user-id' },
      customId: 'hit',
      update: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await collectHandler(mockButtonInteraction);

    // Should send ephemeral message to wrong user
    expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('pas votre partie'),
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
  });
});
