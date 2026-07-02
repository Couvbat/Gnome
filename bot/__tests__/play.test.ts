import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Mock dependencies first
vi.mock('../services/musicService');
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: vi.fn(),
  entersState: vi.fn(),
  VoiceConnectionStatus: {
    Ready: 'ready',
    Disconnected: 'disconnected'
  }
}));

import { command } from '../commands/play';
import { musicService } from '../services/musicService';
import { joinVoiceChannel, entersState } from '@discordjs/voice';

describe('Play Command', () => {
  let mockInteraction;
  let mockMember;
  let mockVoiceChannel;
  let mockGuild;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock entersState to resolve by default (successful connection)
    entersState.mockResolvedValue(undefined);

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
        getString: vi.fn().mockReturnValue('test song')
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

  it('should check bot permissions', async () => {
    // Mock insufficient permissions
    mockVoiceChannel.permissionsFor.mockReturnValue({
      has: vi.fn().mockReturnValue(false)
    });

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      '❌ Je n\'ai pas les permissions pour rejoindre ou parler dans ce salon vocal.'
    );
  });

  it('should create queue when none exists', async () => {
    // Mock no existing queue
    musicService.getQueue.mockReturnValue(null);
    const mockQueue = {
      tracks: [{
        title: 'Test Song',
        url: 'https://youtube.com/test',
        duration: '3:45',
        thumbnail: 'thumbnail.jpg',
        requestedBy: 'TestUser',
        source: 'youtube'
      }],
      playing: true
    };
    musicService.createQueue.mockReturnValue(mockQueue);
    musicService.addTrack.mockResolvedValue({
      title: 'Test Song',
      url: 'https://youtube.com/test',
      duration: '3:45',
      thumbnail: 'thumbnail.jpg',
      requestedBy: 'TestUser',
      source: 'youtube'
    });
    musicService.createNowPlayingEmbed.mockReturnValue({
      title: 'Now Playing',
      description: 'Test Song'
    });

    // Mock voice connection
    const mockConnection = {
      on: vi.fn(),
      subscribe: vi.fn()
    };
    joinVoiceChannel.mockReturnValue(mockConnection);

    // Mock connection ready event immediately
    mockConnection.on.mockImplementation((event, callback) => {
      if (event === 'Ready') {
        setImmediate(callback);
      }
    });

    await command.execute(mockInteraction);

    expect(joinVoiceChannel).toHaveBeenCalled();
    expect(musicService.createQueue).toHaveBeenCalled();
    expect(musicService.addTrack).toHaveBeenCalledWith(
      'test-guild-id',
      'test song',
      'TestUser'
    );
  }, 15000);

  it('should add track to existing queue', async () => {
    // Mock existing queue - simulate it will have 2 tracks after adding
    const mockQueue = {
      tracks: [{ title: 'Existing Song' }, { title: 'New Song' }],
      playing: true
    };
    musicService.getQueue.mockReturnValue(mockQueue);
    musicService.addTrack.mockResolvedValue({
      title: 'New Song',
      url: 'https://youtube.com/new',
      duration: '4:20',
      thumbnail: 'new-thumbnail.jpg',
      requestedBy: 'TestUser',
      source: 'youtube'
    });

    await command.execute(mockInteraction);

    expect(musicService.addTrack).toHaveBeenCalledWith(
      'test-guild-id',
      'test song',
      'TestUser'
    );
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      '🔴 **New Song** ajoutée à la file d\'attente (position 2)'
    );
  });

  it('should handle track not found', async () => {
    // Mock existing queue
    musicService.getQueue.mockReturnValue({
      tracks: [],
      playing: false
    });
    // Mock track not found
    musicService.addTrack.mockResolvedValue(null);

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      '❌ Impossible de trouver cette piste. Vérifiez votre recherche ou URL.'
    );
  });

  it('should handle voice connection errors', async () => {
    // Mock no existing queue
    musicService.getQueue.mockReturnValue(null);

    // Mock voice connection
    const mockConnection = {
      on: vi.fn(),
      destroy: vi.fn()
    };
    joinVoiceChannel.mockReturnValue(mockConnection);

    // Mock entersState to throw error (connection timeout)
    entersState.mockRejectedValueOnce(new Error('Timeout'));

    await command.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      '❌ Impossible de rejoindre le salon vocal. Le délai de connexion a expiré.'
    );
  }, 15000);
});