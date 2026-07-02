import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Use vi.hoisted to define mock before it's used in vi.mock
const { mockSpawn } = vi.hoisted(() => {
  return { mockSpawn: vi.fn() };
});

vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

import { YtDlpService } from '../services/ytdlpService';

describe('YtDlpService', () => {
  let service;
  let mockProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new YtDlpService();
    
    // Create mock process with EventEmitter-like behavior
    mockProcess = {
      stdout: {
        on: vi.fn(),
        pipe: vi.fn()
      },
      stderr: {
        on: vi.fn()
      },
      stdin: {},
      on: vi.fn(),
      kill: vi.fn()
    };
    
    mockSpawn.mockReturnValue(mockProcess);
  });

  describe('isAvailable', () => {
    it('should return true when yt-dlp is available', async () => {
      // Set up the mock to call the close callback with code 0
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
      });
      
      const result = await service.isAvailable();
      
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', ['--version']);
      expect(result).toBe(true);
    });

    it('should return false when yt-dlp is not available', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Command not found')), 0);
        }
      });
      
      const result = await service.isAvailable();
      
      expect(result).toBe(false);
    });
  });

  describe('isPlaylist', () => {
    it('should detect YouTube playlist URLs', () => {
      expect(service.isPlaylist('https://www.youtube.com/playlist?list=PLtest')).toBe(true);
      expect(service.isPlaylist('https://www.youtube.com/watch?v=abc&list=PLtest')).toBe(true);
    });

    it('should detect SoundCloud playlist URLs', () => {
      expect(service.isPlaylist('https://soundcloud.com/user/sets/myplaylist')).toBe(true);
    });

    it('should return false for single videos', () => {
      expect(service.isPlaylist('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
      expect(service.isPlaylist('https://soundcloud.com/user/track')).toBe(false);
    });
  });

  describe('isYouTubeUrl', () => {
    it('should detect YouTube URLs', () => {
      expect(service.isYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
      expect(service.isYouTubeUrl('https://youtu.be/abc')).toBe(true);
      expect(service.isYouTubeUrl('https://m.youtube.com/watch?v=abc')).toBe(true);
      expect(service.isYouTubeUrl('https://music.youtube.com/watch?v=abc')).toBe(true);
    });

    it('should return false for non-YouTube URLs', () => {
      expect(service.isYouTubeUrl('https://soundcloud.com/track')).toBe(false);
      expect(service.isYouTubeUrl('https://spotify.com/track')).toBe(false);
      expect(service.isYouTubeUrl('https://fake-youtube.com/watch?v=abc')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(service.isYouTubeUrl('not a url')).toBe(false);
    });
  });

  describe('isSoundCloudUrl', () => {
    it('should detect SoundCloud URLs', () => {
      expect(service.isSoundCloudUrl('https://soundcloud.com/user/track')).toBe(true);
      expect(service.isSoundCloudUrl('https://www.soundcloud.com/user/track')).toBe(true);
      expect(service.isSoundCloudUrl('https://m.soundcloud.com/user/track')).toBe(true);
    });

    it('should return false for non-SoundCloud URLs', () => {
      expect(service.isSoundCloudUrl('https://www.youtube.com/watch?v=abc')).toBe(false);
      expect(service.isSoundCloudUrl('https://fake-soundcloud.com/track')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(service.isSoundCloudUrl('not a url')).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should parse video info from yt-dlp output', async () => {
      const mockInfo = {
        title: 'Test Video',
        url: 'https://stream.url',
        duration: 180,
        thumbnail: 'https://thumb.url',
        webpage_url: 'https://youtube.com/watch?v=test'
      };

      let dataCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          dataCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const promise = service.getInfo('https://youtube.com/watch?v=test');

      // Simulate yt-dlp output
      dataCallback(Buffer.from(JSON.stringify(mockInfo)));
      closeCallback(0);

      const result = await promise;

      expect(result).toEqual({
        title: 'Test Video',
        url: 'https://stream.url',
        duration: 180,
        thumbnail: 'https://thumb.url',
        webpage_url: 'https://youtube.com/watch?v=test'
      });
    });

    it('should return null on error', async () => {
      let closeCallback;

      mockProcess.stderr.on.mockImplementation(() => {});
      mockProcess.stdout.on.mockImplementation(() => {});
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const promise = service.getInfo('https://invalid.url');
      closeCallback(1); // Non-zero exit code

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('createAudioStream', () => {
    it('should create yt-dlp and ffmpeg processes', () => {
      const result = service.createAudioStream('https://youtube.com/watch?v=test');

      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(result.stream).toBeDefined();
      expect(result.cleanup).toBeInstanceOf(Function);
    });

    it('should cleanup processes when called', () => {
      const result = service.createAudioStream('https://youtube.com/watch?v=test');

      result.cleanup();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});
