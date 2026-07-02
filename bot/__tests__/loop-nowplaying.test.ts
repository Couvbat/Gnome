import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock dependencies first
vi.mock('../services/musicService');

import { command as loopCommand } from '../commands/loop';
import { command as nowplayingCommand } from '../commands/nowplaying';
import { musicService } from '../services/musicService';

describe('Loop Command', () => {
  let mockInteraction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      reply: vi.fn().mockResolvedValue(undefined),
      guildId: 'test-guild-id'
    };
  });

  it('should have correct command structure', () => {
    expect(loopCommand.data.name).toBe('loop');
    expect(loopCommand.execute).toBeDefined();
    expect(loopCommand.cooldown).toBe(2);
  });

  it('should enable loop when currently disabled', async () => {
    musicService.getQueue.mockReturnValue({
      playing: true
    });
    musicService.toggleLoop.mockReturnValue(true); // Returns new state (enabled)

    await loopCommand.execute(mockInteraction);

    expect(musicService.toggleLoop).toHaveBeenCalledWith('test-guild-id');
    expect(mockInteraction.reply).toHaveBeenCalledWith('🔂 Répétition activée.');
  });

  it('should disable loop when currently enabled', async () => {
    musicService.getQueue.mockReturnValue({
      playing: true
    });
    musicService.toggleLoop.mockReturnValue(false); // Returns new state (disabled)

    await loopCommand.execute(mockInteraction);

    expect(musicService.toggleLoop).toHaveBeenCalledWith('test-guild-id');
    expect(mockInteraction.reply).toHaveBeenCalledWith('▶️ Répétition désactivée.');
  });

  it('should handle no queue', async () => {
    musicService.getQueue.mockReturnValue(null);

    await loopCommand.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique dans la file d\'attente.');
  });

  it('should handle missing guildId', async () => {
    mockInteraction.guildId = null;

    await loopCommand.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Cette commande ne peut être utilisée que dans un serveur.');
  });
});

describe('Nowplaying Command', () => {
  let mockInteraction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      reply: vi.fn().mockResolvedValue(undefined),
      guildId: 'test-guild-id'
    };
  });

  it('should have correct command structure', () => {
    expect(nowplayingCommand.data.name).toBe('nowplaying');
    expect(nowplayingCommand.execute).toBeDefined();
    expect(nowplayingCommand.cooldown).toBe(3);
  });

  it('should display currently playing track', async () => {
    const mockTrack = {
      title: 'Test Song',
      artist: 'Test Artist',
      duration: 180
    };
    const mockEmbed = { title: 'Now Playing Embed' };

    musicService.getQueue.mockReturnValue({
      playing: true
    });
    musicService.getCurrentTrack.mockReturnValue(mockTrack);
    musicService.createNowPlayingEmbed.mockReturnValue(mockEmbed);

    await nowplayingCommand.execute(mockInteraction);

    expect(musicService.getCurrentTrack).toHaveBeenCalledWith('test-guild-id');
    expect(musicService.createNowPlayingEmbed).toHaveBeenCalledWith(mockTrack);
    expect(mockInteraction.reply).toHaveBeenCalledWith({ embeds: [mockEmbed] });
  });

  it('should handle no music playing', async () => {
    musicService.getQueue.mockReturnValue({
      playing: false
    });

    await nowplayingCommand.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique n\'est en cours de lecture.');
  });

  it('should handle no queue', async () => {
    musicService.getQueue.mockReturnValue(null);

    await nowplayingCommand.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique n\'est en cours de lecture.');
  });

  it('should handle no current track found', async () => {
    musicService.getQueue.mockReturnValue({
      playing: true
    });
    musicService.getCurrentTrack.mockReturnValue(null);

    await nowplayingCommand.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune piste trouvée.');
  });

  it('should handle missing guildId', async () => {
    mockInteraction.guildId = null;

    await nowplayingCommand.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Cette commande ne peut être utilisée que dans un serveur.');
  });
});
