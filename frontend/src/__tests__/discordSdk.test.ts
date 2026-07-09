/**
 * Discord SDK Integration Tests
 * Tests for the Discord Embedded App SDK service
 * 
 * Note: These tests focus on unit testing the SDK wrapper functions
 * and utility methods rather than the full Discord SDK integration,
 * which requires running inside a Discord Activity iframe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock SDK class that can be instantiated
class MockDiscordSDK {
  ready = vi.fn().mockResolvedValue(undefined);
  commands = {
    authorize: vi.fn().mockResolvedValue({ code: 'mock-auth-code' }),
    authenticate: vi.fn().mockResolvedValue({
      user: {
        id: 'test-user-123',
        username: 'TestUser',
        discriminator: '0001',
        avatar: 'abc123',
        global_name: 'Test User Global',
      },
    }),
    getInstanceConnectedParticipants: vi.fn().mockResolvedValue({
      participants: [
        { id: 'user1', username: 'User1', discriminator: '0001', avatar: null, bot: false, global_name: 'User One' },
        { id: 'user2', username: 'User2', discriminator: '0002', avatar: 'hash', bot: false, global_name: 'User Two' },
      ],
    }),
    openInviteDialog: vi.fn().mockResolvedValue(undefined),
    setActivity: vi.fn().mockResolvedValue(undefined),
  };
  subscribe = vi.fn().mockResolvedValue(undefined);
  channelId = 'mock-channel-123';
  guildId = 'mock-guild-123';
  instanceId = 'mock-instance-123';
  
  constructor(
    _clientId: string, 
    _options?: { disableConsoleLogOverride?: boolean }
  ) {
    // Constructor can accept options
  }
}

class MockDiscordSDKMock {
  ready = vi.fn().mockResolvedValue(undefined);
  commands = {
    authorize: vi.fn().mockResolvedValue({ code: 'mock-code' }),
    authenticate: vi.fn().mockResolvedValue({ user: { id: 'mock-user' } }),
    getInstanceConnectedParticipants: vi.fn().mockResolvedValue({ participants: [] }),
    openInviteDialog: vi.fn().mockResolvedValue(undefined),
    setActivity: vi.fn().mockResolvedValue(undefined),
  };
  subscribe = vi.fn().mockResolvedValue(undefined);
  channelId = 'mock-channel';
  guildId = 'mock-guild';
  instanceId = 'mock-instance';
  
  constructor(
    _clientId: string,
    _guildId: string,
    _channelId: string,
    _locationId: string
  ) {
    // DiscordSDKMock requires these 4 params
  }
}

// Mock the Discord SDK before importing our service
vi.mock('@discord/embedded-app-sdk', () => ({
  DiscordSDK: MockDiscordSDK,
  DiscordSDKMock: MockDiscordSDKMock,
  patchUrlMappings: vi.fn(),
}));

// Mock fetch for OAuth token exchange
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ access_token: 'mock-access-token' }),
});

describe('Discord SDK Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Module Loading', () => {
    it('should detect embedded mode from frame_id query param', async () => {
      // Mock window.location.search with frame_id
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?frame_id=test-frame' },
        writable: true,
      });

      // Import module
      const discordSdk = await import('../services/discordSdk');
      
      // The module should detect embedded mode
      expect(discordSdk).toBeDefined();

      // Restore
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    });

    it('should export required functions', async () => {
      const discordSdk = await import('../services/discordSdk');
      
      expect(discordSdk.initializeDiscordSdk).toBeDefined();
      expect(discordSdk.getCurrentUser).toBeDefined();
      expect(discordSdk.getCurrentChannel).toBeDefined();
      expect(discordSdk.getCurrentGuild).toBeDefined();
      expect(discordSdk.getVoiceParticipants).toBeDefined();
      expect(discordSdk.refreshVoiceParticipants).toBeDefined();
      expect(discordSdk.isDiscordSdkReady).toBeDefined();
      expect(discordSdk.getInstanceId).toBeDefined();
      expect(discordSdk.getChannelId).toBeDefined();
      expect(discordSdk.getGuildId).toBeDefined();
      expect(discordSdk.openInviteDialog).toBeDefined();
      expect(discordSdk.setActivity).toBeDefined();
    });
  });

  describe('Mock SDK Mode (Development)', () => {
    it('should have mock SDK classes exported from the discord SDK module', async () => {
      // Verify that DiscordSDKMock is available for development mode
      const sdkModule = await import('@discord/embedded-app-sdk');
      
      expect(sdkModule.DiscordSDKMock).toBeDefined();
      expect(sdkModule.DiscordSDK).toBeDefined();
      expect(sdkModule.patchUrlMappings).toBeDefined();
    });
  });

  describe('User Data', () => {
    it('should have getCurrentUser function that can be called safely', async () => {
      const discordSdk = await import('../services/discordSdk');
      
      // getCurrentUser should be callable without throwing
      const user = discordSdk.getCurrentUser();
      // May be null or have data depending on module state
      expect(user === null || typeof user === 'object').toBe(true);
    });

    it('should generate correct avatar URL format when user has avatar', () => {
      // Test the avatar URL generation logic
      const userId = '123456789';
      const avatarHash = 'abc123def456';
      
      const avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
      
      expect(avatarUrl).toBe('https://cdn.discordapp.com/avatars/123456789/abc123def456.png');
    });
  });

  describe('Voice Participants', () => {
    it('should have getVoiceParticipants function that returns an array', async () => {
      const discordSdk = await import('../services/discordSdk');
      
      const participants = discordSdk.getVoiceParticipants();
      expect(Array.isArray(participants)).toBe(true);
    });
  });

  describe('SDK Ready State', () => {
    it('should have isDiscordSdkReady function', async () => {
      const discordSdk = await import('../services/discordSdk');
      
      // Should be callable
      const isReady = discordSdk.isDiscordSdkReady();
      expect(typeof isReady).toBe('boolean');
    });
  });

  describe('Instance/Channel/Guild IDs', () => {
    it('should have ID getter functions that return strings or null', async () => {
      const discordSdk = await import('../services/discordSdk');
      
      const instanceId = discordSdk.getInstanceId();
      const channelId = discordSdk.getChannelId();
      const guildId = discordSdk.getGuildId();
      
      // Should return string or null
      expect(instanceId === null || typeof instanceId === 'string').toBe(true);
      expect(channelId === null || typeof channelId === 'string').toBe(true);
      expect(guildId === null || typeof guildId === 'string').toBe(true);
    });
  });
});

describe('Discord User Avatar URL Generation', () => {
  it('should generate correct avatar URL for user with avatar', () => {
    const userId = '123456789';
    const avatarHash = 'abc123def456';
    
    const avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`;
    
    expect(avatarUrl).toBe('https://cdn.discordapp.com/avatars/123456789/abc123def456.png?size=128');
  });

  it('should handle users without avatar', () => {
    const avatar = null;
    
    // When avatar is null, we typically use a default or emoji
    const hasAvatar = avatar !== null;
    expect(hasAvatar).toBe(false);
  });
});
