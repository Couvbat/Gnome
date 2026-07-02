import { 
  VoiceConnection, 
  AudioPlayer, 
  AudioResource, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus,
  entersState,
  StreamType
} from '@discordjs/voice';
import { TextChannel, EmbedBuilder } from 'discord.js';
import playdl from 'play-dl';
import { ytdlpService } from './ytdlpService';

// Set FFmpeg path for audio processing
const ffmpegPath = require('ffmpeg-static');
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

// Set USE_YTDLP=false in .env to force play-dl (not recommended — play-dl YouTube auth is unreliable)
const FORCE_PLAYDL = process.env.USE_YTDLP === 'false';

export interface Track {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  requestedBy: string;
  source: 'youtube' | 'soundcloud' | 'url';
}

export interface MusicQueue {
  textChannel: TextChannel;
  voiceConnection: VoiceConnection;
  audioPlayer: AudioPlayer;
  tracks: Track[];
  volume: number;
  loop: boolean;
  playing: boolean;
  currentStreamCleanup?: () => void; // Cleanup function for yt-dlp streams
}

export class MusicService {
  private queues: Map<string, MusicQueue> = new Map();
  private ytdlpAvailable: boolean | null = null;

  /**
   * Check if native yt-dlp is available (cached)
   */
  private async checkYtDlpAvailable(): Promise<boolean> {
    if (this.ytdlpAvailable === null) {
      this.ytdlpAvailable = await ytdlpService.isAvailable();
      console.log(`[MUSIC] yt-dlp available: ${this.ytdlpAvailable}. Backend: ${
        FORCE_PLAYDL ? 'play-dl (forced)' : this.ytdlpAvailable ? 'yt-dlp' : 'play-dl (fallback)'
      }`);
    }
    return this.ytdlpAvailable;
  }

  /**
   * Determine which backend to use for streaming.
   * yt-dlp is preferred — play-dl YouTube auth breaks frequently.
   * Set USE_YTDLP=false in .env to force play-dl.
   */
  private async shouldUseYtDlp(): Promise<boolean> {
    if (FORCE_PLAYDL) return false;
    return await this.checkYtDlpAvailable();
  }

  /**
   * Check if URL is a YouTube playlist
   */  
  private isYouTubePlaylist(url: string): boolean {
    return playdl.yt_validate(url) === 'playlist';
  }

  /**
   * Check if URL is a SoundCloud playlist
   */
  private async isSoundCloudPlaylist(url: string): Promise<boolean> {
    const result = await playdl.so_validate(url);
    return result === 'playlist';
  }

  /**
   * Create a new music queue for a guild
   */
  createQueue(guildId: string, textChannel: TextChannel, voiceConnection: VoiceConnection): MusicQueue {
    const audioPlayer = createAudioPlayer();
    
    const queue: MusicQueue = {
      textChannel,
      voiceConnection,
      audioPlayer,
      tracks: [],
      volume: 50,
      loop: false,
      playing: false
    };

    // Subscribe the connection to the audio player
    const subscription = voiceConnection.subscribe(audioPlayer);
    if (!subscription) {
      console.error('[VOICE] Failed to subscribe audio player to voice connection');
      throw new Error('Failed to subscribe audio player');
    }
    console.log('[VOICE] Audio player successfully subscribed to voice connection');

    // Handle audio player state changes
    audioPlayer.on('stateChange', (oldState, newState) => {
      console.log(`[AUDIO PLAYER] State: ${oldState.status} -> ${newState.status}`);
      
      if (newState.status === AudioPlayerStatus.Playing) {
        queue.playing = true;
      } else if (newState.status === AudioPlayerStatus.Idle) {
        queue.playing = false;
        // Only play next if we were previously playing
        if (oldState.status === AudioPlayerStatus.Playing) {
          this.playNext(guildId);
        }
      }
    });

    audioPlayer.on('error', (error) => {
      console.error('[AUDIO PLAYER] Error:', error);
      console.error('[AUDIO PLAYER] Error resource:', (error as any).resource);
      queue.playing = false;
      
      // Send error message to channel
      textChannel.send('❌ Erreur audio. Passage au titre suivant...').catch(console.error);
      
      this.playNext(guildId);
    });

    // Handle voice connection state changes properly
    voiceConnection.on('stateChange', async (oldState, newState) => {
      console.log(`[VOICE] State: ${oldState.status} -> ${newState.status}`);
      
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        // Try to reconnect within 5 seconds.
        // Sequential catches avoid dangling entersState listeners from Promise.race.
        try {
          await entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5_000)
            .catch(() => entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000));
        } catch (error) {
          // Probably disconnected permanently, clean up
          console.log(`[VOICE] Failed to reconnect for guild ${guildId}`);
          this.deleteQueue(guildId);
        }
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        console.log(`[VOICE] Connection destroyed for guild ${guildId}`);
        this.deleteQueue(guildId);
      } else if (
        !subscription.connection && 
        newState.status === VoiceConnectionStatus.Ready
      ) {
        // Resubscribe if connection was lost
        try {
          voiceConnection.subscribe(audioPlayer);
        } catch (error) {
          console.error('[VOICE] Failed to resubscribe audio player:', error);
        }
      }
    });

    this.queues.set(guildId, queue);
    return queue;
  }

  /**
   * Get the music queue for a guild
   */
  getQueue(guildId: string): MusicQueue | undefined {
    return this.queues.get(guildId);
  }

  /**
   * Delete a music queue
   */
  deleteQueue(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (queue) {
      // Clean up yt-dlp stream if exists
      if (queue.currentStreamCleanup) {
        queue.currentStreamCleanup();
      }
      
      // Remove all event listeners to prevent memory leaks
      queue.audioPlayer.removeAllListeners();
      queue.voiceConnection.removeAllListeners();
      
      queue.audioPlayer.stop(true);
      queue.voiceConnection.destroy();
      this.queues.delete(guildId);
      
      console.log(`[MUSIC] Cleaned up queue for guild ${guildId}`);
    }
  }

  /**
   * Add a track to the queue
   */
  async addTrack(guildId: string, query: string, requestedBy: string): Promise<Track | null> {
    const queue = this.getQueue(guildId);
    if (!queue) return null;

    const useYtDlp = await this.shouldUseYtDlp();

    try {
      let track: Track | null = null;

      // If using native yt-dlp, try to get info that way first
      if (useYtDlp) {
        console.log(`[MUSIC] Using native yt-dlp to get track info for: ${query}`);
        
        // Check if it's a URL or a search query
        const isUrl = query.startsWith('http://') || query.startsWith('https://');
        
        if (isUrl) {
          const info = await ytdlpService.getInfo(query);
          if (info) {
            const source: 'youtube' | 'soundcloud' | 'url' = 
              ytdlpService.isYouTubeUrl(query) ? 'youtube' :
              ytdlpService.isSoundCloudUrl(query) ? 'soundcloud' : 'url';
            
            track = {
              title: info.title,
              url: info.webpage_url || query,
              duration: this.formatDuration(info.duration),
              thumbnail: info.thumbnail,
              requestedBy,
              source
            };
          }
        } else {
          // Search using yt-dlp
          const results = await ytdlpService.search(query, 1);
          if (results.length > 0) {
            const result = results[0];
            track = {
              title: result.title,
              url: result.webpage_url || result.url,
              duration: this.formatDuration(result.duration),
              thumbnail: result.thumbnail,
              requestedBy,
              source: 'youtube'
            };
          }
        }

        if (track) {
          queue.tracks.push(track);
          
          // If nothing is playing, start playing
          if (!queue.playing && queue.tracks.length === 1) {
            this.play(guildId);
          }
          
          return track;
        }
        
        // If yt-dlp failed, fall back to play-dl
        console.log('[MUSIC] yt-dlp failed, falling back to play-dl');
      }

      // Use play-dl (original implementation)
      // Check if it's a YouTube URL
      const ytType = playdl.yt_validate(query);
      if (ytType === 'video') {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('YouTube info fetch timeout')), 15000);
        });
        
        const info = await Promise.race([
          playdl.video_basic_info(query),
          timeoutPromise
        ]);
        
        const video = info.video_details;
        
        track = {
          title: video.title || 'Unknown Title',
          url: query, // Use the original query URL, not video.url
          duration: this.formatDuration(video.durationInSec),
          thumbnail: video.thumbnails[0]?.url || '',
          requestedBy,
          source: 'youtube'
        };
      } 
      // Check if it's a SoundCloud URL
      else {
        const soType = await playdl.so_validate(query);
        if (soType === 'track') {
          try {
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('SoundCloud info fetch timeout')), 15000);
            });
            
            const info = await Promise.race([
              playdl.soundcloud(query),
              timeoutPromise
            ]);
            
            if (info && info.type === 'track') {
              track = {
                title: info.name || 'Unknown Title',
                url: query,
                duration: this.formatDuration(info.durationInSec || 0),
                thumbnail: (info as any).thumbnail || '',
                requestedBy,
                source: 'soundcloud'
              };
            }
          } catch (error) {
            console.error('Error fetching SoundCloud info:', error);
            // Fallback to YouTube search
            return this.searchAndAddTrack(guildId, query, requestedBy);
          }
        } else {
          // Search YouTube
          return this.searchAndAddTrack(guildId, query, requestedBy);
        }
      }

      if (track) {
        queue.tracks.push(track);
        
        // If nothing is playing, start playing
        if (!queue.playing && queue.tracks.length === 1) {
          this.play(guildId);
        }
        
        return track;
      }
    } catch (error) {
      console.error('Error adding track:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide specific error feedback
      if (errorMessage.includes('private')) {
        throw new Error('Cette vidéo est privée et ne peut pas être lue.');
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        throw new Error('Accès refusé par YouTube. La vidéo peut être restreinte dans votre région.');
      } else if (errorMessage.includes('timeout')) {
        throw new Error('Délai d\'attente dépassé lors de la récupération des informations.');
      }
    }

    return null;
  }

  /**
   * Search YouTube and add track
   */
  private async searchAndAddTrack(guildId: string, query: string, requestedBy: string): Promise<Track | null> {
    const queue = this.getQueue(guildId);
    if (!queue) return null;

    try {
      // Add timeout to prevent hanging on YouTube search
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('YouTube search timeout')), 10000);
      });
      
      const searchResults = await Promise.race([
        playdl.search(query, { limit: 1, source: { youtube: 'video' } }),
        timeoutPromise
      ]);
      
      if (searchResults.length > 0) {
        const video = searchResults[0];
        const track: Track = {
          title: video.title || 'Unknown Title',
          url: video.url,
          duration: this.formatDuration(video.durationInSec),
          thumbnail: video.thumbnails[0]?.url || '',
          requestedBy,
          source: 'youtube'
        };

        queue.tracks.push(track);
        
        // If nothing is playing, start playing
        if (!queue.playing && queue.tracks.length === 1) {
          this.play(guildId);
        }
        
        return track;
      }
    } catch (error) {
      console.error('Error searching YouTube:', error);
    }

    return null;
  }

  /**
   * Play the current track or start the queue
   */
  async play(guildId: string): Promise<boolean> {
    const queue = this.getQueue(guildId);
    if (!queue || queue.tracks.length === 0) return false;

    // Clean up previous stream if exists
    if (queue.currentStreamCleanup) {
      try {
        queue.currentStreamCleanup();
      } catch (cleanupError) {
        console.error('[PLAY] Error cleaning up previous stream:', cleanupError);
      }
      queue.currentStreamCleanup = undefined;
    }

    const track = queue.tracks[0];
    const useYtDlp = await this.shouldUseYtDlp();

    try {
      let audioResource: AudioResource;

      // Sanitize track title for logging (prevent log injection)
      const sanitizedTitle = track.title.replace(/[\n\r]/g, ' ').substring(0, 100);

      if (useYtDlp && (track.source === 'youtube' || track.source === 'soundcloud')) {
        // Use native yt-dlp for streaming
        console.log(`[PLAY] Creating stream using native yt-dlp for: ${sanitizedTitle}`);
        
        const { stream, cleanup } = ytdlpService.createAudioStream(track.url);
        queue.currentStreamCleanup = cleanup;
        
        audioResource = createAudioResource(stream, {
          inputType: StreamType.Raw,
          metadata: track,
          inlineVolume: true
        });
        
        console.log(`[PLAY] yt-dlp stream created successfully`);
      } else if (track.source === 'youtube') {
        console.log(`[PLAY] Creating YouTube stream for: ${track.title}`);
        
        // Use play-dl stream with discordPlayerCompatibility option
        const streamInfo = await playdl.stream(track.url, {
          discordPlayerCompatibility: true
        });
        
        console.log(`[PLAY] Stream created successfully`);

        audioResource = createAudioResource(streamInfo.stream, {
          inputType: streamInfo.type,
          metadata: track,
          inlineVolume: true
        });

        console.log(`[PLAY] Audio resource created successfully`);
      } else if (track.source === 'soundcloud') {
        console.log(`[PLAY] Creating SoundCloud stream for: ${track.title}`);
        
        const streamInfo = await playdl.stream(track.url, {
          discordPlayerCompatibility: true
        });
        audioResource = createAudioResource(streamInfo.stream, {
          inputType: streamInfo.type,
          metadata: track,
          inlineVolume: true
        });
      } else {
        console.error(`[PLAY] Unsupported source: ${track.source}`);
        return false;
      }

      console.log(`[PLAY] Starting playback for: ${track.title}`);
      queue.audioPlayer.play(audioResource);
      
      // Send now playing message
      try {
        const embed = this.createNowPlayingEmbed(track);
        await queue.textChannel.send({ embeds: [embed] });
      } catch (error) {
        console.error('[PLAY] Failed to send now playing message:', error);
      }
      
      return true;
    } catch (error) {
      console.error('[PLAY] Error playing track:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      try {
        let userFriendlyMessage = '❌ Erreur lors de la lecture. Passage au titre suivant...';
        
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          userFriendlyMessage = '❌ Vidéo bloquée par YouTube. Essayez une autre vidéo.';
        } else if (errorMessage.includes('unavailable') || errorMessage.includes('age-restricted')) {
          userFriendlyMessage = '❌ Cette vidéo n\'est pas disponible ou est restreinte par âge.';
        } else if (errorMessage.includes('private')) {
          userFriendlyMessage = '❌ Cette vidéo est privée.';
        } else if (errorMessage.includes('copyright')) {
          userFriendlyMessage = '❌ Vidéo bloquée pour des raisons de droits d\'auteur.';
        }
        
        await queue.textChannel.send(userFriendlyMessage);
      } catch (msgError) {
        console.error('[PLAY] Failed to send error message:', msgError);
      }
      
      // Skip to next track
      this.playNext(guildId);
      return false;
    }
  }

  /**
   * Play the next track in queue
   */
  async playNext(guildId: string): Promise<void> {
    const queue = this.getQueue(guildId);
    if (!queue) return;

    if (!queue.loop) {
      queue.tracks.shift(); // Remove current track if not looping
    }

    if (queue.tracks.length > 0) {
      await this.play(guildId);
    } else {
      queue.playing = false;
      // Optionally send a message that the queue is empty
      await queue.textChannel.send('🎵 Queue finished! Add more songs to continue playing.');
    }
  }

  /**
   * Skip the current track
   */
  skip(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.playing) return false;

    queue.audioPlayer.stop();
    return true;
  }

  /**
   * Pause the current track
   */
  pause(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.playing) return false;

    return queue.audioPlayer.pause();
  }

  /**
   * Resume the current track
   */
  resume(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;

    return queue.audioPlayer.unpause();
  }

  /**
   * Stop playing and clear the queue
   */
  stop(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;

    queue.tracks = [];
    queue.audioPlayer.stop(true);
    return true;
  }

  /**
   * Set volume (not implemented in discord.js voice, but kept for future use)
   */
  setVolume(guildId: string, volume: number): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || volume < 0 || volume > 100) return false;

    queue.volume = volume;
    // Note: discord.js voice doesn't support volume control directly
    // This would need additional audio processing
    return true;
  }

  /**
   * Toggle loop mode
   */
  toggleLoop(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;

    queue.loop = !queue.loop;
    return queue.loop;
  }

  /**
   * Get current track
   */
  getCurrentTrack(guildId: string): Track | null {
    const queue = this.getQueue(guildId);
    if (!queue || queue.tracks.length === 0) return null;
    return queue.tracks[0];
  }

  /**
   * Create a now playing embed
   */
  createNowPlayingEmbed(track: Track): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎵 Now Playing')
      .setDescription(`**${track.title}**`)
      .addFields(
        { name: '⏱️ Duration', value: track.duration, inline: true },
        { name: '👤 Requested by', value: track.requestedBy, inline: true }
      )
      .setThumbnail(track.thumbnail)
      .setTimestamp();
  }

  /**
   * Create a queue embed
   */
  createQueueEmbed(guildId: string, page: number = 1): EmbedBuilder | null {
    const queue = this.getQueue(guildId);
    if (!queue || queue.tracks.length === 0) return null;

    const tracksPerPage = 10;
    const start = (page - 1) * tracksPerPage;
    const end = start + tracksPerPage;
    const tracks = queue.tracks.slice(start, end);

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎵 Music Queue')
      .setTimestamp();

    let description = '';
    tracks.forEach((track, index) => {
      const position = start + index + 1;
      const prefix = position === 1 ? '🎵 **Now Playing:** ' : `${position}. `;
      description += `${prefix}[${track.title}](${track.url}) - ${track.duration}\n`;
    });

    embed.setDescription(description);

    if (queue.tracks.length > tracksPerPage) {
      const totalPages = Math.ceil(queue.tracks.length / tracksPerPage);
      embed.setFooter({ text: `Page ${page}/${totalPages} • ${queue.tracks.length} tracks total` });
    } else {
      embed.setFooter({ text: `${queue.tracks.length} tracks total` });
    }

    return embed;
  }

  /**
   * Add multiple tracks from a playlist
   */
  async addPlaylist(guildId: string, playlistUrl: string, requestedBy: string): Promise<{ added: number; failed: number }> {
    const queue = this.getQueue(guildId);
    if (!queue) return { added: 0, failed: 0 };

    let added = 0;
    let failed = 0;

    try {
      if (this.isYouTubePlaylist(playlistUrl)) {
        // Use play-dl to get playlist info
        const playlist = await playdl.playlist_info(playlistUrl, { incomplete: true });
        if (!playlist) return { added: 0, failed: 0 };

        const videos = await playlist.all_videos();
        
        for (const video of videos) {
          try {
            const track: Track = {
              title: video.title || 'Unknown Title',
              url: video.url,
              duration: this.formatDuration(video.durationInSec || 0),
              thumbnail: video.thumbnails?.[0]?.url || '',
              requestedBy,
              source: 'youtube'
            };

            queue.tracks.push(track);
            added++;

            // Start playing if this is the first track and nothing is playing
            if (!queue.playing && queue.tracks.length === 1) {
              this.play(guildId);
            }
          } catch (error) {
            console.error('Error adding track from playlist:', error);
            failed++;
          }
        }
      } else if (await this.isSoundCloudPlaylist(playlistUrl)) {
        try {
          const playlist = await playdl.soundcloud(playlistUrl);
          if (playlist && playlist.type === 'playlist') {
            const playlistData = playlist as any;
            const tracks = await playlistData.all_tracks();
            
            for (const scTrack of tracks) {
              try {
                const track: Track = {
                  title: scTrack.name || 'Unknown Title',
                  url: scTrack.url,
                  duration: this.formatDuration(scTrack.durationInSec || 0),
                  thumbnail: scTrack.thumbnail || '',
                  requestedBy,
                  source: 'soundcloud'
                };

                queue.tracks.push(track);
                added++;

                // Start playing if this is the first track and nothing is playing
                if (!queue.playing && queue.tracks.length === 1) {
                  this.play(guildId);
                }
              } catch (error) {
                console.error('Error adding SoundCloud track from playlist:', error);
                failed++;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching SoundCloud playlist:', error);
          failed++;
        }
      }
    } catch (error) {
      console.error('Error adding playlist:', error);
      failed++;
    }

    return { added, failed };
  }

  /**
   * Format duration from seconds to mm:ss
   */
  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Export a singleton instance
export const musicService = new MusicService();