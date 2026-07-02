import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all I/O before imports
vi.mock('@discordjs/voice', () => ({
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn(),
  AudioPlayerStatus: { Playing: 'playing', Idle: 'idle', Paused: 'paused' },
  VoiceConnectionStatus: { Disconnected: 'disconnected', Destroyed: 'destroyed', Ready: 'ready', Signalling: 'signalling', Connecting: 'connecting' },
  entersState: vi.fn().mockResolvedValue(undefined),
  StreamType: { Raw: 'raw', OggOpus: 'ogg/opus' },
}));

vi.mock('play-dl', () => ({
  default: {
    yt_validate: vi.fn(),
    so_validate: vi.fn(),
    search: vi.fn(),
    stream: vi.fn(),
    video_basic_info: vi.fn(),
    soundcloud: vi.fn(),
    playlist_info: vi.fn(),
    setToken: vi.fn(),
  },
}));

vi.mock('../services/ytdlpService', () => ({
  ytdlpService: {
    isAvailable: vi.fn().mockResolvedValue(true),
    getInfo: vi.fn(),
    search: vi.fn(),
    createAudioStream: vi.fn(),
    isYouTubeUrl: vi.fn(),
    isSoundCloudUrl: vi.fn(),
  },
}));

import { createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } from '@discordjs/voice';
import playdl from 'play-dl';
import { ytdlpService } from '../services/ytdlpService';
import { MusicService } from '../services/musicService';

// ── helpers ────────────────────────────────────────────────────────────────

function makeMockAudioPlayer() {
  const listeners: Record<string, Function[]> = {};
  return {
    play: vi.fn(),
    stop: vi.fn().mockReturnValue(true),
    pause: vi.fn().mockReturnValue(true),
    unpause: vi.fn().mockReturnValue(true),
    removeAllListeners: vi.fn(),
    on: vi.fn((event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    emit: (event: string, ...args: any[]) => listeners[event]?.forEach(cb => cb(...args)),
    _listeners: listeners,
  };
}

function makeMockVoiceConnection() {
  const listeners: Record<string, Function[]> = {};
  return {
    subscribe: vi.fn().mockReturnValue({ connection: {} }),
    destroy: vi.fn(),
    removeAllListeners: vi.fn(),
    on: vi.fn((event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
  };
}

function makeMockTextChannel() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function makeTrack(overrides = {}) {
  return {
    title: 'Test Track',
    url: 'https://www.youtube.com/watch?v=test',
    duration: '3:30',
    thumbnail: 'https://i.ytimg.com/vi/test/default.jpg',
    requestedBy: 'TestUser',
    source: 'youtube' as const,
    ...overrides,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('MusicService', () => {
  let service: MusicService;
  let mockPlayer: ReturnType<typeof makeMockAudioPlayer>;
  let mockConnection: ReturnType<typeof makeMockVoiceConnection>;
  let mockChannel: ReturnType<typeof makeMockTextChannel>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MusicService();
    mockPlayer = makeMockAudioPlayer();
    mockConnection = makeMockVoiceConnection();
    mockChannel = makeMockTextChannel();
    (createAudioPlayer as any).mockReturnValue(mockPlayer);
  });

  // ── Queue lifecycle ──────────────────────────────────────────────────────

  describe('getQueue', () => {
    it('returns undefined for unknown guild', () => {
      expect(service.getQueue('no-such-guild')).toBeUndefined();
    });
  });

  describe('createQueue', () => {
    it('creates and returns a queue with correct defaults', () => {
      const queue = service.createQueue('guild-1', mockChannel as any, mockConnection as any);

      expect(queue.playing).toBe(false);
      expect(queue.loop).toBe(false);
      expect(queue.tracks).toHaveLength(0);
      expect(queue.volume).toBe(50);
    });

    it('makes queue retrievable via getQueue', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      expect(service.getQueue('guild-1')).toBeDefined();
    });

    it('subscribes the audio player to the voice connection', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      expect(mockConnection.subscribe).toHaveBeenCalledWith(mockPlayer);
    });

    it('throws when voiceConnection.subscribe returns falsy', () => {
      mockConnection.subscribe.mockReturnValue(null);
      expect(() =>
        service.createQueue('guild-1', mockChannel as any, mockConnection as any)
      ).toThrow('Failed to subscribe audio player');
    });
  });

  describe('deleteQueue', () => {
    it('removes the queue so getQueue returns undefined', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      service.deleteQueue('guild-1');
      expect(service.getQueue('guild-1')).toBeUndefined();
    });

    it('stops the audio player and destroys the voice connection', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      service.deleteQueue('guild-1');
      expect(mockPlayer.stop).toHaveBeenCalledWith(true);
      expect(mockConnection.destroy).toHaveBeenCalled();
    });

    it('calls currentStreamCleanup if set', () => {
      const cleanup = vi.fn();
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const queue = service.getQueue('guild-1')!;
      queue.currentStreamCleanup = cleanup;

      service.deleteQueue('guild-1');

      expect(cleanup).toHaveBeenCalled();
    });

    it('is a no-op for unknown guild', () => {
      expect(() => service.deleteQueue('no-such-guild')).not.toThrow();
    });
  });

  // ── Playback controls ────────────────────────────────────────────────────

  describe('skip', () => {
    it('returns false when no queue', () => {
      expect(service.skip('guild-1')).toBe(false);
    });

    it('returns false when queue exists but not playing', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      expect(service.skip('guild-1')).toBe(false);
    });

    it('calls audioPlayer.stop() and returns true when playing', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const queue = service.getQueue('guild-1')!;
      queue.playing = true;

      const result = service.skip('guild-1');

      expect(mockPlayer.stop).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('pause', () => {
    it('returns false when no queue', () => {
      expect(service.pause('guild-1')).toBe(false);
    });

    it('returns false when not playing', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      expect(service.pause('guild-1')).toBe(false);
    });

    it('calls audioPlayer.pause() and returns its result when playing', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const queue = service.getQueue('guild-1')!;
      queue.playing = true;
      mockPlayer.pause.mockReturnValue(true);

      const result = service.pause('guild-1');

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('resume', () => {
    it('returns false when no queue', () => {
      expect(service.resume('guild-1')).toBe(false);
    });

    it('calls audioPlayer.unpause() and returns its result', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      mockPlayer.unpause.mockReturnValue(true);

      const result = service.resume('guild-1');

      expect(mockPlayer.unpause).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('stop', () => {
    it('returns false when no queue', () => {
      expect(service.stop('guild-1')).toBe(false);
    });

    it('clears tracks, stops player, and returns true', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const queue = service.getQueue('guild-1')!;
      queue.tracks.push(makeTrack());

      const result = service.stop('guild-1');

      expect(queue.tracks).toHaveLength(0);
      expect(mockPlayer.stop).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
    });
  });

  // ── Queue state ──────────────────────────────────────────────────────────

  describe('toggleLoop', () => {
    it('returns false when no queue', () => {
      expect(service.toggleLoop('guild-1')).toBe(false);
    });

    it('enables loop when currently disabled', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const result = service.toggleLoop('guild-1');
      expect(result).toBe(true);
      expect(service.getQueue('guild-1')!.loop).toBe(true);
    });

    it('disables loop when currently enabled', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      service.getQueue('guild-1')!.loop = true;

      const result = service.toggleLoop('guild-1');

      expect(result).toBe(false);
      expect(service.getQueue('guild-1')!.loop).toBe(false);
    });
  });

  describe('getCurrentTrack', () => {
    it('returns null when no queue', () => {
      expect(service.getCurrentTrack('guild-1')).toBeNull();
    });

    it('returns null when queue is empty', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      expect(service.getCurrentTrack('guild-1')).toBeNull();
    });

    it('returns the first track', () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const track = makeTrack();
      service.getQueue('guild-1')!.tracks.push(track, makeTrack({ title: 'Second' }));

      expect(service.getCurrentTrack('guild-1')).toBe(track);
    });
  });

  // ── playNext ─────────────────────────────────────────────────────────────

  describe('playNext', () => {
    it('removes first track when loop is false', async () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const queue = service.getQueue('guild-1')!;
      queue.tracks.push(makeTrack({ title: 'A' }), makeTrack({ title: 'B' }));
      // Isolate shift behavior — prevent play() from failing and re-triggering playNext
      vi.spyOn(service, 'play').mockResolvedValue(true);

      await service.playNext('guild-1');

      expect(queue.tracks).toHaveLength(1);
      expect(queue.tracks[0].title).toBe('B');
    });

    it('keeps first track when loop is true', async () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const queue = service.getQueue('guild-1')!;
      queue.loop = true;
      queue.tracks.push(makeTrack({ title: 'A' }), makeTrack({ title: 'B' }));

      // play() will be called — mock createAudioResource to avoid I/O
      (createAudioResource as any).mockReturnValue({});
      (ytdlpService.createAudioStream as any).mockReturnValue({
        stream: {},
        cleanup: vi.fn(),
      });

      await service.playNext('guild-1');

      expect(queue.tracks[0].title).toBe('A');
    });

    it('sends "Queue finished" message when no tracks remain', async () => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      const queue = service.getQueue('guild-1')!;
      queue.tracks.push(makeTrack());
      queue.loop = false;

      await service.playNext('guild-1');

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('Queue finished')
      );
    });

    it('is a no-op for unknown guild', async () => {
      await expect(service.playNext('no-such-guild')).resolves.not.toThrow();
    });
  });

  // ── addTrack (yt-dlp path) ────────────────────────────────────────────────

  describe('addTrack', () => {
    beforeEach(() => {
      service.createQueue('guild-1', mockChannel as any, mockConnection as any);
      (ytdlpService.isAvailable as any).mockResolvedValue(true);
      (ytdlpService.isYouTubeUrl as any).mockReturnValue(true);
      (ytdlpService.isSoundCloudUrl as any).mockReturnValue(false);
    });

    it('returns null when no queue exists for guild', async () => {
      const result = await service.addTrack('no-such-guild', 'test', 'user');
      expect(result).toBeNull();
    });

    it('fetches info for a URL and adds track to queue', async () => {
      const url = 'https://www.youtube.com/watch?v=abc';
      (ytdlpService.getInfo as any).mockResolvedValue({
        title: 'Test Song',
        duration: 180,
        thumbnail: 'https://thumbnail.url',
        webpage_url: url,
      });

      const track = await service.addTrack('guild-1', url, 'TestUser');

      expect(ytdlpService.getInfo).toHaveBeenCalledWith(url);
      expect(track).not.toBeNull();
      expect(track!.title).toBe('Test Song');
      expect(track!.requestedBy).toBe('TestUser');
    });

    it('searches for a text query and adds track to queue', async () => {
      (ytdlpService.search as any).mockResolvedValue([{
        title: 'Search Result',
        duration: 200,
        thumbnail: 'https://thumb.url',
        url: 'https://www.youtube.com/watch?v=xyz',
        webpage_url: 'https://www.youtube.com/watch?v=xyz',
      }]);

      const track = await service.addTrack('guild-1', 'some song', 'TestUser');

      expect(ytdlpService.search).toHaveBeenCalledWith('some song', 1);
      expect(track!.title).toBe('Search Result');
    });

    it('pushes track onto queue', async () => {
      (ytdlpService.getInfo as any).mockResolvedValue({
        title: 'Song A',
        duration: 120,
        thumbnail: '',
        webpage_url: 'https://www.youtube.com/watch?v=aaa',
      });

      await service.addTrack('guild-1', 'https://www.youtube.com/watch?v=aaa', 'User');

      expect(service.getQueue('guild-1')!.tracks).toHaveLength(1);
    });

    it('does not call play() when queue already has tracks', async () => {
      const queue = service.getQueue('guild-1')!;
      queue.tracks.push(makeTrack());
      queue.playing = true;

      (ytdlpService.getInfo as any).mockResolvedValue({
        title: 'Second Song',
        duration: 120,
        thumbnail: '',
        webpage_url: 'https://www.youtube.com/watch?v=bbb',
      });

      const playSpy = vi.spyOn(service, 'play');
      await service.addTrack('guild-1', 'https://www.youtube.com/watch?v=bbb', 'User');

      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  // ── play() ───────────────────────────────────────────────────────────────

  describe('play', () => {
    const GUILD = 'play-guild';
    let mockStream: { stream: Record<string, never>; cleanup: ReturnType<typeof vi.fn> };
    let mockResource: Record<string, never>;

    beforeEach(() => {
      mockStream = { stream: {}, cleanup: vi.fn() };
      mockResource = {};
      (ytdlpService.isAvailable as any).mockResolvedValue(true);
      (ytdlpService.createAudioStream as any).mockReturnValue(mockStream);
      (createAudioResource as any).mockReturnValue(mockResource);
      service.createQueue(GUILD, mockChannel as any, mockConnection as any);
    });

    function addTrack(overrides = {}) {
      service.getQueue(GUILD)!.tracks.push(makeTrack(overrides));
    }

    // ── Guards ──────────────────────────────────────────────────────────

    it('returns false when no queue exists', async () => {
      expect(await service.play('unknown-guild')).toBe(false);
    });

    it('returns false when queue has no tracks', async () => {
      expect(await service.play(GUILD)).toBe(false);
    });

    // ── yt-dlp happy path ────────────────────────────────────────────────

    it('creates stream via yt-dlp, plays resource, sends embed, returns true', async () => {
      addTrack({ source: 'youtube' });

      const result = await service.play(GUILD);

      expect(ytdlpService.createAudioStream).toHaveBeenCalledWith(makeTrack().url);
      expect(createAudioResource).toHaveBeenCalledWith(
        mockStream.stream,
        expect.objectContaining({ inputType: StreamType.Raw })
      );
      expect(mockPlayer.play).toHaveBeenCalledWith(mockResource);
      expect(mockChannel.send).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
      expect(result).toBe(true);
    });

    it('routes SoundCloud through yt-dlp when yt-dlp is available', async () => {
      addTrack({ source: 'soundcloud', url: 'https://soundcloud.com/artist/track' });

      await service.play(GUILD);

      expect(ytdlpService.createAudioStream).toHaveBeenCalledWith('https://soundcloud.com/artist/track');
      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it('stores new stream cleanup on queue', async () => {
      addTrack();

      await service.play(GUILD);

      expect(service.getQueue(GUILD)!.currentStreamCleanup).toBe(mockStream.cleanup);
    });

    // ── Previous stream cleanup ──────────────────────────────────────────

    it('calls and clears previous stream cleanup before new stream', async () => {
      const previousCleanup = vi.fn();
      service.getQueue(GUILD)!.currentStreamCleanup = previousCleanup;
      addTrack();

      await service.play(GUILD);

      expect(previousCleanup).toHaveBeenCalled();
    });

    // ── play-dl fallback ─────────────────────────────────────────────────

    it('falls back to playdl.stream for YouTube when yt-dlp unavailable', async () => {
      (ytdlpService.isAvailable as any).mockResolvedValue(false);
      addTrack({ source: 'youtube' });
      const fakeStreamInfo = { stream: {}, type: 'ogg/opus' };
      (playdl.stream as any).mockResolvedValue(fakeStreamInfo);

      const result = await service.play(GUILD);

      expect(playdl.stream).toHaveBeenCalledWith(makeTrack().url, { discordPlayerCompatibility: true });
      expect(createAudioResource).toHaveBeenCalledWith(
        fakeStreamInfo.stream,
        expect.objectContaining({ inputType: fakeStreamInfo.type })
      );
      expect(result).toBe(true);
    });

    it('falls back to playdl.stream for SoundCloud when yt-dlp unavailable', async () => {
      (ytdlpService.isAvailable as any).mockResolvedValue(false);
      const scUrl = 'https://soundcloud.com/artist/track';
      addTrack({ source: 'soundcloud', url: scUrl });
      const fakeStreamInfo = { stream: {}, type: 'ogg/opus' };
      (playdl.stream as any).mockResolvedValue(fakeStreamInfo);

      const result = await service.play(GUILD);

      expect(playdl.stream).toHaveBeenCalledWith(scUrl, { discordPlayerCompatibility: true });
      expect(result).toBe(true);
    });

    // ── Unsupported source ───────────────────────────────────────────────

    it('returns false immediately for unsupported source', async () => {
      addTrack({ source: 'url' });

      const result = await service.play(GUILD);

      expect(mockPlayer.play).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    // ── Error handling ───────────────────────────────────────────────────

    it('sends generic error message and calls playNext on stream failure', async () => {
      addTrack();
      (ytdlpService.createAudioStream as any).mockImplementation(() => {
        throw new Error('Connection failed');
      });
      vi.spyOn(service, 'playNext').mockResolvedValue(undefined);

      const result = await service.play(GUILD);

      expect(mockChannel.send).toHaveBeenCalledWith(
        '❌ Erreur lors de la lecture. Passage au titre suivant...'
      );
      expect(service.playNext).toHaveBeenCalledWith(GUILD);
      expect(result).toBe(false);
    });

    it('sends 403-specific message for Forbidden errors', async () => {
      addTrack();
      (ytdlpService.createAudioStream as any).mockImplementation(() => {
        throw new Error('HTTP Error 403 Forbidden');
      });
      vi.spyOn(service, 'playNext').mockResolvedValue(undefined);

      await service.play(GUILD);

      expect(mockChannel.send).toHaveBeenCalledWith(
        '❌ Vidéo bloquée par YouTube. Essayez une autre vidéo.'
      );
    });

    it('sends age-restriction message for unavailable/age-restricted errors', async () => {
      addTrack();
      (ytdlpService.createAudioStream as any).mockImplementation(() => {
        throw new Error('Video unavailable age-restricted');
      });
      vi.spyOn(service, 'playNext').mockResolvedValue(undefined);

      await service.play(GUILD);

      expect(mockChannel.send).toHaveBeenCalledWith(
        "❌ Cette vidéo n'est pas disponible ou est restreinte par âge."
      );
    });

    it('sends private-video message for private errors', async () => {
      addTrack();
      (ytdlpService.createAudioStream as any).mockImplementation(() => {
        throw new Error('This video is private');
      });
      vi.spyOn(service, 'playNext').mockResolvedValue(undefined);

      await service.play(GUILD);

      expect(mockChannel.send).toHaveBeenCalledWith('❌ Cette vidéo est privée.');
    });

    it('sends copyright message for copyright errors', async () => {
      addTrack();
      (ytdlpService.createAudioStream as any).mockImplementation(() => {
        throw new Error('copyright claim blocked');
      });
      vi.spyOn(service, 'playNext').mockResolvedValue(undefined);

      await service.play(GUILD);

      expect(mockChannel.send).toHaveBeenCalledWith(
        '❌ Vidéo bloquée pour des raisons de droits d\'auteur.'
      );
    });
  });
});
