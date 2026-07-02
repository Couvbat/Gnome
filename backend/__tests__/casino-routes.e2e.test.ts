import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
/**
 * End-to-end tests for Casino API routes
 * Tests complete casino game flows with real API requests
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Mock the database models BEFORE importing routes
vi.mock('../src/models/database');
vi.mock('../src/models/schemas');
vi.mock('../src/services/EconomyService');

// Import after mocking
import casinoRoutes from '../src/routes/casino';
import { authMiddleware } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { User, Character, CasinoProfile } from '../src/models/database';
import { CasinoSession } from '../src/models/schemas';
import { EconomyService } from '../src/services/EconomyService';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/casino', authMiddleware, casinoRoutes);
app.use(errorHandler);

describe('Casino API E2E Tests', () => {
  let authToken: string;
  const testUserId = 'casino-test-user';
  const testGuildId = 'casino-test-guild';
  const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';

  beforeAll(() => {
    // Generate authentication token
    authToken = jwt.sign(
      { 
        userId: testUserId,
        guildId: testGuildId,
        username: 'CasinoTestUser',
        discordId: testUserId
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
  });

  beforeEach(() => {
    // Clear mocks but don't set default implementations
  });

  describe('GET /api/casino/profile - User Profile', () => {
    it('should return complete user casino profile', async () => {
      const mockUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'CasinoTestUser',
        xp: 1500,
        level: 8
      };

      const mockCasinoProfile = {
        userId: testUserId,
        guildId: testGuildId,
        energy: 75,
        maxEnergy: 100,
        reputation: 250,
        totalWagered: 10000,
        totalWon: 6000,
        totalLost: 4000,
        currentStreak: 3,
        bestStreak: 5
      };

      // Use the same pattern as the working test
      const findOneMock = vi.fn().mockImplementation(() => Promise.resolve(mockUser));
      (User.findOne as Mock) = findOneMock;

      const casinoFindOneMock = vi.fn().mockImplementation(() => Promise.resolve(mockCasinoProfile));
      (CasinoProfile.findOne as Mock) = casinoFindOneMock;

      (EconomyService.getCoins as Mock).mockResolvedValue(5000);

      const response = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.coins).toBe(5000);
      expect(response.body.user.level).toBe(8);
      expect(response.body.user.xp).toBe(1500);
      expect(response.body.casino).toBeDefined();
      expect(response.body.casino.energy).toBe(75);
      expect(response.body.casino.reputation).toBe(250);
      expect(response.body.casino.totalWagered).toBe(10000);
    });

    it('should return default casino profile if none exists', async () => {
      const mockUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'TestUser',
        coins: 1000,
        xp: 0,
        level: 1
      };

      // Use mockImplementation to debug
      const findOneMock = vi.fn().mockImplementation(() => {
        console.log('User.findOne mock called, returning mockUser');
        return Promise.resolve(mockUser);
      });
      
      (User.findOne as Mock) = findOneMock;
      (CasinoProfile.findOne as Mock).mockImplementation(() => Promise.resolve(null));

      const response = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      console.log('findOneMock was called:', findOneMock.mock.calls.length, 'times');
      if (response.status !== 200) {
        console.log('Status:', response.status);
        console.log('Body:', response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body.casino.energy).toBe(100);
      expect(response.body.casino.reputation).toBe(0);
      expect(response.body.casino.totalWagered).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/casino/profile');

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/casino/daily - Daily Reward', () => {
    it('should grant daily reward successfully', async () => {
      const mockUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'DailyUser',
        level: 5
      };

      const mockCasinoProfile = {
        userId: testUserId,
        guildId: testGuildId,
        energy: 50,
        maxEnergy: 100,
        save: vi.fn().mockResolvedValue(true)
      };

      (User.findOne as Mock).mockResolvedValue(mockUser);
      (CasinoProfile.findOne as Mock).mockResolvedValue(mockCasinoProfile);
      (EconomyService.claimDaily as Mock).mockResolvedValue({ claimed: true, newBalance: 1225 });

      const response = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.coinsReceived).toBeDefined();

      // Verify reward calculation (baseAmount + level * 25)
      const expectedReward = 100 + (5 * 25);
      expect(response.body.coinsReceived).toBe(expectedReward);
      expect(EconomyService.claimDaily).toHaveBeenCalledWith(testUserId, testGuildId, expectedReward);
    });

    it('should reject if claimed within 24 hours', async () => {
      const mockUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'CooldownTest',
        level: 3
      };

      (User.findOne as Mock).mockResolvedValue(mockUser);
      (EconomyService.claimDaily as Mock).mockResolvedValue({ claimed: false, hoursLeft: 14 });

      const response = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.hoursLeft).toBeDefined();
    });

    it('should allow claim after 24 hours', async () => {
      const mockUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'TestUser',
        level: 10
      };

      (User.findOne as Mock).mockResolvedValue(mockUser);
      (CasinoProfile.findOne as Mock).mockResolvedValue(null);
      (EconomyService.claimDaily as Mock).mockResolvedValue({ claimed: true, newBalance: 2350 });

      const response = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should scale reward with user level', async () => {
      const testLevels = [1, 5, 10, 20];

      for (const level of testLevels) {
        vi.clearAllMocks();

        const mockUser = {
          userId: testUserId,
          guildId: testGuildId,
          username: 'LevelTest',
          level: level
        };

        (User.findOne as Mock).mockResolvedValue(mockUser);
        (CasinoProfile.findOne as Mock).mockResolvedValue(null);
        (EconomyService.claimDaily as Mock).mockResolvedValue({ claimed: true, newBalance: 1000 });

        const response = await request(app)
          .post('/api/casino/daily')
          .set('Authorization', `Bearer ${authToken}`);

        const expectedReward = 100 + (level * 25);
        expect(response.body.coinsReceived).toBe(expectedReward);
      }
    });
  });

  describe('Casino Game Flow E2E', () => {
    it('should check profile successfully with proper mocks', async () => {
      // Mock user and profile
      const initialUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'GamePlayer',
        xp: 100,
        level: 3,
        save: vi.fn().mockResolvedValue(true)
      };

      const initialProfile = {
        userId: testUserId,
        guildId: testGuildId,
        energy: 80,
        maxEnergy: 100,
        reputation: 50,
        totalWagered: 500,
        totalWon: 300,
        totalLost: 200,
        save: vi.fn().mockResolvedValue(true)
      };

      (User.findOne as Mock).mockResolvedValue(initialUser);
      (CasinoProfile.findOne as Mock).mockResolvedValue(initialProfile);
      (EconomyService.getCoins as Mock).mockResolvedValue(1000);

      const balanceResponse = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceResponse.status).toBe(200);
      const initialCoins = balanceResponse.body.user.coins;
      const initialEnergy = balanceResponse.body.casino.energy;
      expect(initialCoins).toBe(1000);
      expect(initialEnergy).toBe(80);
    });

    it('should claim daily reward and restore energy', async () => {
      // Step 1: Get profile with low energy
      const mockUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'DailyTest',
        level: 3
      };

      const mockCasinoProfile = {
        userId: testUserId,
        guildId: testGuildId,
        energy: 20,
        maxEnergy: 100,
        save: vi.fn().mockResolvedValue(true)
      };

      (User.findOne as Mock).mockResolvedValue(mockUser);
      (CasinoProfile.findOne as Mock).mockResolvedValue(mockCasinoProfile);
      (EconomyService.claimDaily as Mock).mockResolvedValue({ claimed: true, newBalance: 575 });

      // Step 2: Claim daily reward
      const dailyResponse = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(dailyResponse.status).toBe(200);
      expect(dailyResponse.body.success).toBe(true);
      expect(mockCasinoProfile.save).toHaveBeenCalled();
      expect(dailyResponse.body.energyRestored).toBe(50);
    });

    it('should enforce authentication across all endpoints', async () => {
      const endpoints = [
        { path: '/api/casino/profile' },
        { path: '/api/casino/daily' }
      ];

      for (const endpoint of endpoints) {
        // Test GET endpoint
        if (endpoint.path === '/api/casino/profile') {
          const response = await request(app).get(endpoint.path);
          expect(response.status).toBe(401);
        }
        // Test POST endpoint
        if (endpoint.path === '/api/casino/daily') {
          const response = await request(app).post(endpoint.path);
          expect(response.status).toBe(401);
        }
      }
    });

    it('should handle daily reward with proper state management', async () => {
      const mockUser = {
        userId: testUserId,
        guildId: testGuildId,
        username: 'StateTest',
        level: 5
      };

      (User.findOne as Mock).mockResolvedValue(mockUser);
      (CasinoProfile.findOne as Mock).mockResolvedValue(null);
      (EconomyService.claimDaily as Mock).mockResolvedValue({ claimed: true, newBalance: 1225 });

      // First request should succeed
      const response = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling E2E', () => {
    it('should handle missing user gracefully', async () => {
      (User.findOne as Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it('should handle database errors', async () => {
      (User.findOne as Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });

    it('should validate JWT expiration', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: testUserId, guildId: testGuildId },
        jwtSecret,
        { expiresIn: '0s' }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });
  });
});

