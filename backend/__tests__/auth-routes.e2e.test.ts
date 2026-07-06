import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
/**
 * End-to-end tests for Authentication API routes
 * Tests complete authentication flows with real API requests
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import authRoutes from '../src/routes/auth';
import { User } from '../src/models/database';
import { errorHandler } from '../src/middleware/errorHandler';
import { EconomyService } from '../src/services/EconomyService';

// Mock the database models
vi.mock('../src/models/database');
vi.mock('../src/services/EconomyService');

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

describe('Auth API E2E Tests', () => {
  const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset NODE_ENV to test for dev endpoint
    process.env.NODE_ENV = 'test';
  });

  describe('POST /api/auth/dev - Development Authentication', () => {
    it('should authenticate with development credentials', async () => {
      const response = await request(app)
        .post('/api/auth/dev')
        .send({
          username: 'TestUser'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('TestUser');
      expect(response.body.user.userId).toBe('dev-user-demo');
      expect(response.body.user.guildId).toBe('dev-guild');
      expect(response.body.user.coins).toBe(1000);
      expect(response.body.user.level).toBe(1);

      // Verify JWT token is valid
      const decoded = jwt.verify(response.body.token, jwtSecret) as any;
      expect(decoded.userId).toBe('dev-user-demo');
      expect(decoded.username).toBe('TestUser');
    });

    it('should use default username if not provided', async () => {
      const response = await request(app)
        .post('/api/auth/dev')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('Demo User');
    });

    it('should reject in production mode', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/auth/dev')
        .send({
          username: 'TestUser'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not allowed in production');
    });

    it('should generate valid JWT with correct expiration', async () => {
      const response = await request(app)
        .post('/api/auth/dev')
        .send({
          username: 'ExpireTest'
        });

      const decoded = jwt.decode(response.body.token) as any;
      expect(decoded.exp).toBeDefined();
      
      // Token should expire in approximately 7 days
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;
      expect(expiresIn).toBeGreaterThan(6 * 24 * 3600); // > 6 days
      expect(expiresIn).toBeLessThan(8 * 24 * 3600); // < 8 days
    });
  });

  describe('POST /api/auth/discord - Discord OAuth Authentication', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    // Mocks the two Discord REST calls the route makes to verify a token:
    // GET /users/@me (identity) and GET /users/@me/guilds (membership check).
    function mockDiscordApi(
      user: { id: string; username: string; global_name?: string },
      guildIds: string[]
    ) {
      global.fetch = vi.fn(async (url: any) => {
        const href = url.toString();
        if (href === 'https://discord.com/api/users/@me') {
          return { ok: true, json: async () => user } as any;
        }
        if (href === 'https://discord.com/api/users/@me/guilds') {
          return { ok: true, json: async () => guildIds.map(id => ({ id })) } as any;
        }
        throw new Error(`Unexpected fetch call in test: ${href}`);
      }) as any;
    }

    it('should authenticate with a verified Discord token and confirmed guild membership', async () => {
      mockDiscordApi({ id: 'discord-123', username: 'DiscordUser' }, ['guild-456']);

      const response = await request(app)
        .post('/api/auth/discord')
        .send({
          guildId: 'guild-456',
          discordToken: 'mock-discord-token'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.userId).toBe('discord-123');
      expect(response.body.user.username).toBe('DiscordUser');

      // Verify JWT contains correct data
      const decoded = jwt.verify(response.body.token, jwtSecret) as any;
      expect(decoded.userId).toBe('discord-123');
      expect(decoded.guildId).toBe('guild-456');
    });

    it('should generate JWT token without database interaction', async () => {
      mockDiscordApi({ id: 'new-user', username: 'NewUser' }, ['guild-789']);

      const response = await request(app)
        .post('/api/auth/discord')
        .send({
          guildId: 'guild-789',
          discordToken: 'token'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      // Discord auth endpoint doesn't create users - that happens in /me endpoint
      expect(User.create).not.toHaveBeenCalled();
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it('should ignore a client-supplied userId and use the verified Discord id instead', async () => {
      mockDiscordApi({ id: 'real-verified-id', username: 'RealUser' }, ['any-guild']);

      const response = await request(app)
        .post('/api/auth/discord')
        .send({
          userId: 'attacker-supplied-id',
          guildId: 'any-guild',
          username: 'AttackerSuppliedUsername',
          discordToken: 'token'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.userId).toBe('real-verified-id');
      expect(response.body.user.username).toBe('RealUser');
    });

    it('should require discordToken and guildId', async () => {
      const response = await request(app)
        .post('/api/auth/discord')
        .send({
          username: 'NoIdUser'
        });

      expect(response.status).toBe(400);
    });

    it('should reject an invalid or expired Discord token', async () => {
      global.fetch = vi.fn(async () => ({ ok: false, text: async () => 'invalid_token' })) as any;

      const response = await request(app)
        .post('/api/auth/discord')
        .send({ guildId: 'guild-1', discordToken: 'bad-token' });

      expect(response.status).toBe(401);
    });

    it('should reject when the caller is not a member of the claimed guild', async () => {
      mockDiscordApi({ id: 'discord-123', username: 'DiscordUser' }, ['some-other-guild']);

      const response = await request(app)
        .post('/api/auth/discord')
        .send({ guildId: 'guild-not-a-member-of', discordToken: 'token' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh - Token Refresh', () => {
    it('should issue a new access token from a dedicated refresh token', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/dev')
        .send({ username: 'RefreshUser' });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.refreshToken).toBeDefined();
      const refreshDecoded = jwt.verify(loginResponse.body.refreshToken, jwtSecret) as any;
      expect(refreshDecoded.type).toBe('refresh');

      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginResponse.body.refreshToken });

      expect(refreshResponse.status).toBe(200);
      const newAccess = jwt.verify(refreshResponse.body.token, jwtSecret) as any;
      expect(newAccess.type).toBe('access');
      expect(newAccess.userId).toBe('dev-user-demo');
    });

    it('should reject an access token used as a refresh token', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/dev')
        .send({ username: 'RefreshUser' });

      // The 7-day access token must not be able to renew itself
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginResponse.body.token });

      expect(refreshResponse.status).toBe(401);
    });

    it('should reject a refresh token used as an access token on /me', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/dev')
        .send({ username: 'RefreshUser' });

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginResponse.body.refreshToken}`);

      expect(meResponse.status).toBe(401);
    });
  });

  describe('Authentication Flow E2E', () => {
    it('should complete full auth flow: dev login → JWT creation → token validation', async () => {
      // Step 1: Login with dev credentials
      const loginResponse = await request(app)
        .post('/api/auth/dev')
        .send({
          username: 'FlowTestUser'
        });

      expect(loginResponse.status).toBe(200);
      const { token, user } = loginResponse.body;

      // Step 2: Verify token is properly formatted
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);

      // Step 3: Decode and verify token contents
      const decoded = jwt.verify(token, jwtSecret) as any;
      expect(decoded.userId).toBe(user.userId);
      expect(decoded.username).toBe(user.username);
      expect(decoded.guildId).toBe(user.guildId);

      // Step 4: Verify token can be used for subsequent requests
      expect(() => jwt.verify(token, jwtSecret)).not.toThrow();
    });

    it('should complete Discord auth flow with user creation via /me endpoint', async () => {
      // Step 1: Discord authentication (generates JWT) - mock the two Discord API
      // verification calls the route makes (identity + guild membership).
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (url: any) => {
        const href = url.toString();
        if (href === 'https://discord.com/api/users/@me') {
          return { ok: true, json: async () => ({ id: 'flow-user', username: 'FlowUser' }) } as any;
        }
        if (href === 'https://discord.com/api/users/@me/guilds') {
          return { ok: true, json: async () => [{ id: 'flow-guild' }] } as any;
        }
        throw new Error(`Unexpected fetch call in test: ${href}`);
      }) as any;

      const authResponse = await request(app)
        .post('/api/auth/discord')
        .send({
          guildId: 'flow-guild',
          discordToken: 'mock-token'
        });

      global.fetch = originalFetch;

      expect(authResponse.status).toBe(200);
      expect(authResponse.body.token).toBeDefined();

      // Step 2: Use JWT to call /me endpoint (this creates the user)
      const token = authResponse.body.token;
      const decoded = jwt.verify(token, jwtSecret) as any;
      expect(decoded.userId).toBe('flow-user');

      // Mock user creation in /me endpoint
      (User.findOne as Mock).mockResolvedValue(null);
      (User.create as Mock).mockResolvedValue({
        userId: 'flow-user',
        guildId: 'flow-guild',
        username: 'FlowUser',
        xp: 0,
        level: 1
      });
      (EconomyService.getCoins as Mock).mockResolvedValue(1000);

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(User.create).toHaveBeenCalled();
      expect(meResponse.body.user.coins).toBe(1000);
      expect(meResponse.body.user.level).toBe(1);
    });
  });
});

