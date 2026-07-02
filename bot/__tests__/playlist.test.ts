import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock dependencies first
vi.mock('../services/musicService');

import { command } from '../commands/playlist';
import { musicService } from '../services/musicService';

describe('Playlist Command', () => {
  let mockInteraction;
  let mockMember;
  let mockVoiceChannel;
  let mockGuild;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock voice channel
    mockVoiceChannel = {
      id: 'voice-channel-id',
      permissionsFor: vi.fn().mockReturnValue({
        has: vi.fn().mockReturnValue(true)
      })
    };

    // Mock guild member
    mockMember = {
      user: { username: 'TestUser' },
      voice: { channel: mockVoiceChannel }
    };

    // Mock guild
    mockGuild = {
      members: {
        me: { id: 'bot-id' }
      },
      voiceAdapterCreator: vi.fn()
    };

    // Mock interaction
    mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: {
        getString: vi.fn().mockReturnValue('https://www.youtube.com/playlist?list=PLtest')
      },
      member: mockMember,
      guildId: 'test-guild-id',
      guild: mockGuild,
      channel: { id: 'text-channel-id' }
    };
  });

  it('should require a voice channel', async () => {
    // User not in voice channel
    mockMember.voice.channel = null;

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      '❌ Vous devez être dans un salon vocal pour utiliser cette commande.'
    );
  });

  it('should validate playlist URL', async () => {
    // Invalid URL (not a playlist)
    mockInteraction.options.getString.mockReturnValue('https://www.youtube.com/watch?v=test');

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      '❌ Veuillez fournir une URL de playlist valide (YouTube ou SoundCloud).'
    );
  });

  it('should add playlist tracks successfully', async () => {
    // Mock existing queue
    const mockQueue = {
      tracks: []
    };
    musicService.getQueue.mockReturnValue(mockQueue);
    musicService.addPlaylist.mockResolvedValue({
      added: 15,
      failed: 2
    });

    await command.execute(mockInteraction);

    expect(musicService.addPlaylist).toHaveBeenCalledWith(
      'test-guild-id',
      'https://www.youtube.com/playlist?list=PLtest',
      'TestUser'
    );

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('✅ **15** pistes ajoutées')
    );
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ 2 pistes n\'ont pas pu être ajoutées')
    );
  });

  it('should handle empty playlist', async () => {
    // Mock existing queue
    musicService.getQueue.mockReturnValue({
      tracks: []
    });
    musicService.addPlaylist.mockResolvedValue({
      added: 0,
      failed: 0
    });

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      '❌ Impossible de charger la playlist. Vérifiez l\'URL et réessayez.'
    );
  });

  it('should recognize SoundCloud playlist URLs', async () => {
    // SoundCloud playlist URL
    mockInteraction.options.getString.mockReturnValue('https://soundcloud.com/user/sets/playlist-name');
    
    const mockQueue = {
      tracks: []
    };
    musicService.getQueue.mockReturnValue(mockQueue);
    musicService.addPlaylist.mockResolvedValue({
      added: 8,
      failed: 0
    });

    await command.execute(mockInteraction);

    expect(musicService.addPlaylist).toHaveBeenCalledWith(
      'test-guild-id',
      'https://soundcloud.com/user/sets/playlist-name',
      'TestUser'
    );
  });
});