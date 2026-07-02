import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock dependencies first
vi.mock('../services/musicService');

import { command as pauseCommand } from '../commands/pause';
import { command as resumeCommand } from '../commands/resume';
import { command as skipCommand } from '../commands/skip';
import { command as stopCommand } from '../commands/stop';
import { command as queueCommand } from '../commands/queue';
import { musicService } from '../services/musicService';

describe('Music Control Commands', () => {
  let mockInteraction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      reply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: {
        getInteger: vi.fn()
      },
      guildId: 'test-guild-id'
    };
  });

  describe('Pause Command', () => {
    it('should pause playing music', async () => {
      musicService.getQueue.mockReturnValue({ playing: true });
      musicService.pause.mockReturnValue(true);

      await pauseCommand.execute(mockInteraction);

      expect(musicService.pause).toHaveBeenCalledWith('test-guild-id');
      expect(mockInteraction.reply).toHaveBeenCalledWith('⏸️ Musique mise en pause.');
    });

    it('should reply error when pause() fails', async () => {
      musicService.getQueue.mockReturnValue({ playing: true });
      musicService.pause.mockReturnValue(false);

      await pauseCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Impossible de mettre en pause la musique.');
    });

    it('should handle no music playing', async () => {
      musicService.getQueue.mockReturnValue({ playing: false });

      await pauseCommand.execute(mockInteraction);

      expect(musicService.pause).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique n\'est en cours de lecture.');
    });

    it('should handle no queue', async () => {
      musicService.getQueue.mockReturnValue(null);

      await pauseCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique n\'est en cours de lecture.');
    });

    it('should handle missing guildId', async () => {
      mockInteraction.guildId = null;

      await pauseCommand.execute(mockInteraction);

      expect(musicService.getQueue).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Cette commande ne peut être utilisée que dans un serveur.');
    });
  });

  describe('Resume Command', () => {
    it('should resume paused music', async () => {
      musicService.getQueue.mockReturnValue({ playing: false });
      musicService.resume.mockReturnValue(true);

      await resumeCommand.execute(mockInteraction);

      expect(musicService.resume).toHaveBeenCalledWith('test-guild-id');
      expect(mockInteraction.reply).toHaveBeenCalledWith('▶️ Lecture reprise.');
    });

    it('should reply error when resume() fails', async () => {
      musicService.getQueue.mockReturnValue({ playing: false });
      musicService.resume.mockReturnValue(false);

      await resumeCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Impossible de reprendre la lecture.');
    });

    it('should handle already playing music', async () => {
      musicService.getQueue.mockReturnValue({ playing: true });

      await resumeCommand.execute(mockInteraction);

      expect(musicService.resume).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ La musique est déjà en cours de lecture.');
    });

    it('should handle no queue', async () => {
      musicService.getQueue.mockReturnValue(null);

      await resumeCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique dans la file d\'attente.');
    });

    it('should handle missing guildId', async () => {
      mockInteraction.guildId = null;

      await resumeCommand.execute(mockInteraction);

      expect(musicService.getQueue).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Cette commande ne peut être utilisée que dans un serveur.');
    });
  });

  describe('Skip Command', () => {
    it('should skip current track and show its title', async () => {
      musicService.getQueue.mockReturnValue({ playing: true });
      musicService.getCurrentTrack.mockReturnValue({ title: 'Current Song' });
      musicService.skip.mockReturnValue(true);

      await skipCommand.execute(mockInteraction);

      expect(musicService.skip).toHaveBeenCalledWith('test-guild-id');
      expect(mockInteraction.reply).toHaveBeenCalledWith('⏭️ **Current Song** ignorée.');
    });

    it('should show "Piste inconnue" when no current track', async () => {
      musicService.getQueue.mockReturnValue({ playing: true });
      musicService.getCurrentTrack.mockReturnValue(null);
      musicService.skip.mockReturnValue(true);

      await skipCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('⏭️ **Piste inconnue** ignorée.');
    });

    it('should reply error when skip() fails', async () => {
      musicService.getQueue.mockReturnValue({ playing: true });
      musicService.getCurrentTrack.mockReturnValue({ title: 'Current Song' });
      musicService.skip.mockReturnValue(false);

      await skipCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Impossible d\'ignorer la piste.');
    });

    it('should handle no music playing', async () => {
      musicService.getQueue.mockReturnValue({ playing: false });

      await skipCommand.execute(mockInteraction);

      expect(musicService.skip).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique n\'est en cours de lecture.');
    });

    it('should handle no queue', async () => {
      musicService.getQueue.mockReturnValue(null);

      await skipCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique n\'est en cours de lecture.');
    });

    it('should handle missing guildId', async () => {
      mockInteraction.guildId = null;

      await skipCommand.execute(mockInteraction);

      expect(musicService.getQueue).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Cette commande ne peut être utilisée que dans un serveur.');
    });
  });

  describe('Stop Command', () => {
    it('should stop music, delete queue, and confirm', async () => {
      musicService.getQueue.mockReturnValue({ tracks: ['song1', 'song2'] });
      musicService.stop.mockReturnValue(true);

      await stopCommand.execute(mockInteraction);

      expect(musicService.stop).toHaveBeenCalledWith('test-guild-id');
      expect(musicService.deleteQueue).toHaveBeenCalledWith('test-guild-id');
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        '⏹️ Musique arrêtée et file d\'attente vidée. Déconnexion du salon vocal.'
      );
    });

    it('should not call deleteQueue when stop() fails', async () => {
      musicService.getQueue.mockReturnValue({ tracks: ['song1'] });
      musicService.stop.mockReturnValue(false);

      await stopCommand.execute(mockInteraction);

      expect(musicService.deleteQueue).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Impossible d\'arrêter la musique.');
    });

    it('should handle no queue', async () => {
      musicService.getQueue.mockReturnValue(null);

      await stopCommand.execute(mockInteraction);

      expect(musicService.stop).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Aucune musique n\'est en cours de lecture.');
    });

    it('should handle missing guildId', async () => {
      mockInteraction.guildId = null;

      await stopCommand.execute(mockInteraction);

      expect(musicService.getQueue).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Cette commande ne peut être utilisée que dans un serveur.');
    });
  });

  describe('Queue Command', () => {
    it('should display queue with embed', async () => {
      const mockEmbed = { title: 'Queue Embed' };
      musicService.getQueue.mockReturnValue({ tracks: ['song1', 'song2'] });
      musicService.createQueueEmbed.mockReturnValue(mockEmbed);

      await queueCommand.execute(mockInteraction);

      expect(musicService.createQueueEmbed).toHaveBeenCalledWith('test-guild-id', 1);
      expect(mockInteraction.reply).toHaveBeenCalledWith({ embeds: [mockEmbed] });
    });

    it('should pass page parameter to createQueueEmbed', async () => {
      mockInteraction.options.getInteger.mockReturnValue(2);
      const mockEmbed = { title: 'Queue Embed Page 2' };
      musicService.getQueue.mockReturnValue({ tracks: ['song1', 'song2'] });
      musicService.createQueueEmbed.mockReturnValue(mockEmbed);

      await queueCommand.execute(mockInteraction);

      expect(musicService.createQueueEmbed).toHaveBeenCalledWith('test-guild-id', 2);
    });

    it('should reply error when createQueueEmbed returns null', async () => {
      musicService.getQueue.mockReturnValue({ tracks: ['song1'] });
      musicService.createQueueEmbed.mockReturnValue(null);

      await queueCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Impossible d\'afficher la file d\'attente.');
    });

    it('should handle empty tracks array', async () => {
      musicService.getQueue.mockReturnValue({ tracks: [] });

      await queueCommand.execute(mockInteraction);

      expect(musicService.createQueueEmbed).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        '❌ La file d\'attente est vide. Utilisez `/play` pour ajouter de la musique.'
      );
    });

    it('should handle no queue', async () => {
      musicService.getQueue.mockReturnValue(null);

      await queueCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        '❌ La file d\'attente est vide. Utilisez `/play` pour ajouter de la musique.'
      );
    });

    it('should handle missing guildId', async () => {
      mockInteraction.guildId = null;

      await queueCommand.execute(mockInteraction);

      expect(musicService.getQueue).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Cette commande ne peut être utilisée que dans un serveur.');
    });
  });
});