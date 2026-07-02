/**
 * Discord Embedded App SDK Integration
 * Enables the casino to run as a Discord Activity within voice channels
 */
import { DiscordSDK, DiscordSDKMock, patchUrlMappings } from '@discord/embedded-app-sdk';

// Extend ImportMeta for Vite environment variables
declare global {
  interface ImportMeta {
    env: {
      VITE_DISCORD_CLIENT_ID?: string;
      DEV: boolean;
      [key: string]: string | boolean | undefined;
    };
  }
}

// Environment variables for Discord configuration - use typed ImportMeta
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';

// Check if running embedded in Discord (has frame_id query param)
const queryParams = new URLSearchParams(window.location.search);
const isEmbedded = queryParams.get('frame_id') != null;

console.log('[DiscordSDK] Module loaded - isEmbedded:', isEmbedded, 'clientId:', DISCORD_CLIENT_ID ? DISCORD_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET');

// Types for voice channel participants
export interface VoiceChannelParticipant {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot: boolean;
  globalName: string | null;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot: boolean;
  globalName: string | null;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: number;
  guildId: string;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
}

// Singleton instance
let discordSdk: DiscordSDK | DiscordSDKMock | null = null;
let isReady = false;
let currentUser: DiscordUser | null = null;
let currentChannel: ChannelInfo | null = null;
let currentGuild: GuildInfo | null = null;
let voiceParticipants: VoiceChannelParticipant[] = [];

/**
 * Initialize the Discord SDK
 * Must be called before any other SDK functions
 */
export async function initializeDiscordSdk(): Promise<boolean> {
  try {
    // Check if running in Discord iframe
    if (!isEmbedded) {
      console.log('[DiscordSDK] Not embedded in Discord - using mock SDK for development');
      
      // DiscordSDKMock requires: clientId, guildId, channelId, locationId
      const mockGuildId = 'mock-guild-123';
      const mockChannelId = 'mock-channel-123';
      const mockLocationId = 'mock-location-123';
      discordSdk = new DiscordSDKMock(DISCORD_CLIENT_ID || 'mock-client', mockGuildId, mockChannelId, mockLocationId);
      isReady = true;
      
      // Set mock user data
      currentUser = {
        id: 'dev-user-123',
        username: 'DevUser',
        discriminator: '0001',
        avatar: null,
        bot: false,
        globalName: 'Development User'
      };
      
      return true;
    }

    // Running as Discord Activity - Initialize real Discord SDK
    if (!DISCORD_CLIENT_ID) {
      console.error('[DiscordSDK] No Discord Client ID provided - check VITE_DISCORD_CLIENT_ID env var');
      return false;
    }

    console.log('[DiscordSDK] Creating Discord SDK instance with client ID:', DISCORD_CLIENT_ID.substring(0, 8) + '...');
    discordSdk = new DiscordSDK(DISCORD_CLIENT_ID, {
      disableConsoleLogOverride: true,
    });
    
    // CRITICAL: Patch URL mappings for Discord's proxy
    // This makes fetch/XHR requests work correctly within the Discord iframe
    patchUrlMappings([]);
    console.log('[DiscordSDK] URL mappings patched');
    
    // Wait for SDK to be ready with timeout
    console.log('[DiscordSDK] Waiting for SDK ready...');
    const readyPromise = discordSdk.ready();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Discord SDK ready() timed out after 10 seconds')), 10000)
    );
    
    await Promise.race([readyPromise, timeoutPromise]);
    isReady = true;
    console.log('[DiscordSDK] SDK ready!');

    // Generate state for CSRF protection
    const stateValue = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    sessionStorage.setItem('discord_oauth_state', stateValue);

    // Authenticate with Discord - note: for Activities, redirect_uri is handled by Discord
    console.log('[DiscordSDK] Starting authorization...');
    const { code } = await discordSdk.commands.authorize({
      client_id: DISCORD_CLIENT_ID,
      response_type: 'code',
      state: stateValue,
      prompt: 'none',
      scope: [
        'identify',
        'guilds',
        'rpc.voice.read'
      ]
    });
    console.log('[DiscordSDK] Authorization successful, got code');

    // Exchange code for access token via backend (state is verified by Discord's OAuth flow)
    const response = await fetch('/api/auth/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with backend');
    }

    const { access_token } = await response.json();

    // Authenticate SDK with access token
    const authResult = await discordSdk.commands.authenticate({ access_token });
    
    if (authResult?.user) {
      // Map Discord API user to our DiscordUser type
      const apiUser = authResult.user;
      currentUser = {
        id: apiUser.id,
        username: apiUser.username,
        discriminator: apiUser.discriminator || '0000',
        avatar: apiUser.avatar || null,
        bot: false,
        globalName: (apiUser as any).global_name || apiUser.username
      };
      console.log('[DiscordSDK] Authenticated as:', currentUser.username);
    }

    // Get channel and guild info
    await fetchChannelInfo();
    await fetchGuildInfo();
    
    // Subscribe to voice channel events
    await subscribeToVoiceEvents();

    return true;
  } catch (error) {
    console.error('[DiscordSDK] Initialization failed:', error);
    return false;
  }
}

/**
 * Fetch current channel information
 */
async function fetchChannelInfo(): Promise<void> {
  if (!discordSdk || !isReady) return;

  try {
    const channelId = discordSdk.channelId;
    if (channelId) {
      // Get channel details via Discord API
      currentChannel = {
        id: channelId,
        name: 'Casino Table',
        type: 2, // Voice channel
        guildId: discordSdk.guildId || ''
      };
    }
  } catch (error) {
    console.error('[DiscordSDK] Failed to fetch channel info:', error);
  }
}

/**
 * Fetch current guild information
 */
async function fetchGuildInfo(): Promise<void> {
  if (!discordSdk || !isReady) return;

  try {
    const guildId = discordSdk.guildId;
    if (guildId) {
      currentGuild = {
        id: guildId,
        name: 'Discord Server',
        icon: null
      };
    }
  } catch (error) {
    console.error('[DiscordSDK] Failed to fetch guild info:', error);
  }
}

/**
 * Subscribe to voice channel participant updates
 */
async function subscribeToVoiceEvents(): Promise<void> {
  if (!discordSdk || !isReady) return;

  try {
    const channelId = discordSdk.channelId;
    if (!channelId) {
      console.log('[DiscordSDK] No channel ID available for voice subscriptions');
      return;
    }

    // Subscribe to speaking events (requires channel_id)
    await discordSdk.subscribe('SPEAKING_START', (event) => {
      console.log('[DiscordSDK] User started speaking:', event);
    }, { channel_id: channelId });

    await discordSdk.subscribe('SPEAKING_STOP', (event) => {
      console.log('[DiscordSDK] User stopped speaking:', event);
    }, { channel_id: channelId });

    // Subscribe to voice state updates to track participants
    await discordSdk.subscribe('VOICE_STATE_UPDATE', (event) => {
      console.log('[DiscordSDK] Voice state updated:', event);
      // Update our local list of participants
      refreshVoiceParticipants();
    }, { channel_id: channelId });

    // Initial fetch of participants
    await refreshVoiceParticipants();

  } catch (error) {
    console.error('[DiscordSDK] Failed to subscribe to voice events:', error);
  }
}

/**
 * Refresh the list of voice channel participants
 */
export async function refreshVoiceParticipants(): Promise<VoiceChannelParticipant[]> {
  if (!discordSdk || !isReady) {
    return [];
  }

  try {
    const channelId = discordSdk.channelId;
    if (!channelId) return [];

    // Define the expected participant structure from Discord API
    interface DiscordParticipant {
      id: string;
      username: string;
      discriminator?: string;
      avatar?: string | null;
      bot?: boolean;
      global_name?: string | null;
    }

    // Get voice channel participants
    const response = await discordSdk.commands.getInstanceConnectedParticipants();
    
    if (response?.participants) {
      voiceParticipants = (response.participants as DiscordParticipant[]).map((p) => ({
        id: p.id,
        username: p.username,
        discriminator: p.discriminator || '0000',
        avatar: p.avatar || null,
        bot: p.bot || false,
        globalName: p.global_name || p.username
      }));
      
      console.log('[DiscordSDK] Voice participants updated:', voiceParticipants.length);
    }
    
    return voiceParticipants;
  } catch (error) {
    console.error('[DiscordSDK] Failed to get voice participants:', error);
    return voiceParticipants;
  }
}

/**
 * Get current user info
 */
export function getCurrentUser(): DiscordUser | null {
  return currentUser;
}

/**
 * Get current channel info
 */
export function getCurrentChannel(): ChannelInfo | null {
  return currentChannel;
}

/**
 * Get current guild info
 */
export function getCurrentGuild(): GuildInfo | null {
  return currentGuild;
}

/**
 * Get current voice channel participants
 */
export function getVoiceParticipants(): VoiceChannelParticipant[] {
  return [...voiceParticipants];
}

/**
 * Check if user is in the voice channel
 */
export function isUserInVoiceChannel(userId: string): boolean {
  return voiceParticipants.some(p => p.id === userId);
}

/**
 * Check if SDK is initialized and ready
 */
export function isDiscordSdkReady(): boolean {
  return isReady;
}

/**
 * Get the Discord SDK instance
 */
export function getDiscordSdk(): DiscordSDK | DiscordSDKMock | null {
  return discordSdk;
}

/**
 * Get instance ID (unique per activity launch)
 */
export function getInstanceId(): string | null {
  return discordSdk?.instanceId || null;
}

/**
 * Get channel ID
 */
export function getChannelId(): string | null {
  return discordSdk?.channelId || null;
}

/**
 * Get guild ID
 */
export function getGuildId(): string | null {
  return discordSdk?.guildId || null;
}

/**
 * Open an invite dialog to invite friends to the activity
 */
export async function openInviteDialog(): Promise<void> {
  if (!discordSdk || !isReady) {
    console.warn('[DiscordSDK] Cannot open invite dialog - SDK not ready');
    return;
  }

  try {
    await discordSdk.commands.openInviteDialog();
  } catch (error) {
    console.error('[DiscordSDK] Failed to open invite dialog:', error);
  }
}

/**
 * Set the activity (rich presence)
 */
export async function setActivity(details: string, state?: string): Promise<void> {
  if (!discordSdk || !isReady) {
    return;
  }

  try {
    await discordSdk.commands.setActivity({
      activity: {
        type: 0, // Playing
        details,
        state,
        timestamps: {
          start: Date.now()
        }
      }
    });
  } catch (error) {
    console.error('[DiscordSDK] Failed to set activity:', error);
  }
}

export default {
  initializeDiscordSdk,
  getCurrentUser,
  getCurrentChannel,
  getCurrentGuild,
  getVoiceParticipants,
  refreshVoiceParticipants,
  isUserInVoiceChannel,
  isDiscordSdkReady,
  getDiscordSdk,
  getInstanceId,
  getChannelId,
  getGuildId,
  openInviteDialog,
  setActivity
};
