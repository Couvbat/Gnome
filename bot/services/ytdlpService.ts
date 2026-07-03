import { spawn } from 'child_process';
import { Readable } from 'node:stream';

export interface YtDlpTrackInfo {
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  webpage_url: string;
}

export interface YtDlpPlaylistInfo {
  title: string;
  entries: YtDlpTrackInfo[];
}

/**
 * Service for using native Linux yt-dlp for downloading/streaming music
 * This is an alternative to npm packages like play-dl when they don't work
 */
export class YtDlpService {
  private ytdlpPath: string;

  // Hard cap for the one-shot yt-dlp calls below (info/search/version lookups).
  // Without this, a stalled network call spawns a child process that never
  // exits, hanging the caller (and leaking the process) indefinitely.
  private static readonly SPAWN_TIMEOUT_MS = 15000;

  constructor(ytdlpPath: string = 'yt-dlp') {
    this.ytdlpPath = ytdlpPath;
  }

  /**
   * Check if yt-dlp is available on the system
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.ytdlpPath, ['--version']);
      let settled = false;

      // A version check should be near-instant; 10s is generous.
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.error('[YT-DLP] isAvailable check timed out, killing process');
        proc.kill('SIGKILL');
        resolve(false);
      }, 10000);

      proc.on('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(false);
      });

      proc.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(code === 0);
      });
    });
  }

  /**
   * Get video/audio info from a URL
   */
  async getInfo(url: string): Promise<YtDlpTrackInfo | null> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        url
      ];

      const proc = spawn(this.ytdlpPath, args);
      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.error('[YT-DLP] getInfo timed out, killing process');
        proc.kill('SIGKILL');
        resolve(null);
      }, YtDlpService.SPAWN_TIMEOUT_MS);

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        console.error('[YT-DLP] Process error:', error);
        reject(error);
      });

      proc.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (code !== 0) {
          console.error('[YT-DLP] Error:', stderr);
          resolve(null);
          return;
        }

        try {
          const info = JSON.parse(stdout);
          resolve({
            title: info.title || 'Unknown Title',
            url: info.url || info.webpage_url,
            duration: info.duration || 0,
            thumbnail: info.thumbnail || '',
            webpage_url: info.webpage_url || url
          });
        } catch (error) {
          console.error('[YT-DLP] JSON parse error:', error);
          resolve(null);
        }
      });
    });
  }

  /**
   * Get playlist info
   */
  async getPlaylistInfo(url: string): Promise<YtDlpPlaylistInfo | null> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        url
      ];

      const proc = spawn(this.ytdlpPath, args);
      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.error('[YT-DLP] getPlaylistInfo timed out, killing process');
        proc.kill('SIGKILL');
        resolve(null);
      }, YtDlpService.SPAWN_TIMEOUT_MS);

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        console.error('[YT-DLP] Process error:', error);
        reject(error);
      });

      proc.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (code !== 0) {
          console.error('[YT-DLP] Error:', stderr);
          resolve(null);
          return;
        }

        try {
          // Each line is a separate JSON object for playlist entries
          const lines = stdout.trim().split('\n').filter(line => line.trim());
          const entries: YtDlpTrackInfo[] = [];

          for (const line of lines) {
            const entry = JSON.parse(line);
            entries.push({
              title: entry.title || 'Unknown Title',
              url: entry.url || entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
              duration: entry.duration || 0,
              thumbnail: entry.thumbnail || '',
              webpage_url: entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`
            });
          }

          resolve({
            title: 'Playlist',
            entries
          });
        } catch (error) {
          console.error('[YT-DLP] JSON parse error:', error);
          resolve(null);
        }
      });
    });
  }

  /**
   * Get audio stream URL for a video
   * Returns the best audio format URL that can be used with ffmpeg
   */
  async getStreamUrl(url: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
        '-g', // Get URL only
        '--no-playlist',
        '--no-warnings',
        url
      ];

      const proc = spawn(this.ytdlpPath, args);
      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.error('[YT-DLP] getStreamUrl timed out, killing process');
        proc.kill('SIGKILL');
        resolve(null);
      }, YtDlpService.SPAWN_TIMEOUT_MS);

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        console.error('[YT-DLP] Process error:', error);
        reject(error);
      });

      proc.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (code !== 0) {
          console.error('[YT-DLP] Error getting stream URL:', stderr);
          resolve(null);
          return;
        }

        const streamUrl = stdout.trim().split('\n')[0];
        if (streamUrl) {
          resolve(streamUrl);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Create an audio stream using yt-dlp and ffmpeg
   * This pipes yt-dlp output through ffmpeg for real-time audio streaming
   */
  createAudioStream(url: string): { stream: Readable; cleanup: () => void } {
    // Use yt-dlp to download and pipe to ffmpeg for audio extraction
    const ytdlpArgs = [
      '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
      '-o', '-', // Output to stdout
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      url
    ];

    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const ffmpegArgs = [
      '-i', 'pipe:0', // Input from stdin (yt-dlp output)
      '-analyzeduration', '0',
      '-loglevel', 'error', // Only log actual errors
      '-f', 's16le', // Output format for Discord
      '-ar', '48000', // Sample rate
      '-ac', '2', // Stereo
      'pipe:1' // Output to stdout
    ];

    const ytdlpProcess = spawn(this.ytdlpPath, ytdlpArgs);
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    // Pipe yt-dlp output to ffmpeg input
    ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);

    // Error handling
    ytdlpProcess.stderr.on('data', (data: Buffer) => {
      console.error('[YT-DLP] stderr:', data.toString());
    });

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      // With -loglevel error, all stderr output is actual errors
      console.error('[FFMPEG] error:', data.toString());
    });

    ytdlpProcess.on('error', (error: Error) => {
      console.error('[YT-DLP] Process error:', error);
    });

    ffmpegProcess.on('error', (error: Error) => {
      console.error('[FFMPEG] Process error:', error);
    });

    const cleanup = () => {
      try {
        // Try graceful termination first
        ytdlpProcess.kill('SIGTERM');
        ffmpegProcess.kill('SIGTERM');
        
        // Force kill after 5 seconds if processes don't respond
        setTimeout(() => {
          try {
            ytdlpProcess.kill('SIGKILL');
            ffmpegProcess.kill('SIGKILL');
          } catch (e) {
            // Processes might already be dead
          }
        }, 5000);
      } catch (e) {
        // Processes might already be dead
      }
    };

    return {
      stream: ffmpegProcess.stdout as Readable,
      cleanup
    };
  }

  /**
   * Search YouTube for videos
   */
  async search(query: string, limit: number = 5): Promise<YtDlpTrackInfo[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        `ytsearch${limit}:${query}`
      ];

      const proc = spawn(this.ytdlpPath, args);
      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.error('[YT-DLP] search timed out, killing process');
        proc.kill('SIGKILL');
        resolve([]);
      }, YtDlpService.SPAWN_TIMEOUT_MS);

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        console.error('[YT-DLP] Process error:', error);
        reject(error);
      });

      proc.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (code !== 0) {
          console.error('[YT-DLP] Search error:', stderr);
          resolve([]);
          return;
        }

        try {
          const lines = stdout.trim().split('\n').filter(line => line.trim());
          const results: YtDlpTrackInfo[] = [];

          for (const line of lines) {
            const entry = JSON.parse(line);
            results.push({
              title: entry.title || 'Unknown Title',
              url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
              duration: entry.duration || 0,
              thumbnail: entry.thumbnail || '',
              webpage_url: entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`
            });
          }

          resolve(results);
        } catch (error) {
          console.error('[YT-DLP] JSON parse error:', error);
          resolve([]);
        }
      });
    });
  }

  /**
   * Check if a URL is a playlist
   */
  isPlaylist(url: string): boolean {
    return url.includes('playlist') || url.includes('/sets/') || url.includes('list=');
  }

  /**
   * Check if a URL is a YouTube URL
   * Uses URL parsing to properly validate the hostname
   */
  isYouTubeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'youtube.com' || 
             hostname === 'www.youtube.com' || 
             hostname === 'youtu.be' ||
             hostname === 'm.youtube.com' ||
             hostname === 'music.youtube.com';
    } catch {
      // If URL parsing fails, fall back to simple check
      return false;
    }
  }

  /**
   * Check if a URL is a SoundCloud URL
   * Uses URL parsing to properly validate the hostname
   */
  isSoundCloudUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'soundcloud.com' || 
             hostname === 'www.soundcloud.com' ||
             hostname === 'm.soundcloud.com';
    } catch {
      // If URL parsing fails, fall back to simple check
      return false;
    }
  }
}

// Export singleton instance
export const ytdlpService = new YtDlpService();
