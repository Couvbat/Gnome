import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
/**
 * End-to-end workflow tests for complete Casino RPG system
 * Tests full user journeys from character creation to casino gameplay
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Mock dependencies BEFORE importing routes
vi.mock('../src/models/database');
vi.mock('../src/services/CharacterService');
vi.mock('../src/services/EconomyService');

// Import after mocking
import authRoutes from '../src/routes/auth';
import characterRoutes from '../src/routes/characters';
import casinoRoutes from '../src/routes/casino';
import { authMiddleware } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { User, Character, CasinoProfile } from '../src/models/database';
import { CharacterService } from '../src/services/CharacterService';
import { EconomyService } from '../src/services/EconomyService';

// Create test app with all routes
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/characters', authMiddleware, characterRoutes);
app.use('/api/casino', authMiddleware, casinoRoutes);
app.use(errorHandler);

describe('Casino RPG System - Complete E2E Workflows', () => {
  const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';
  let authToken: string;
  let userId: string;
  let guildId: string;

  describe('New Player Onboarding Flow', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.NODE_ENV = 'test';
      userId = `test-player-${Date.now()}`;
      guildId = 'test-guild-123';
    });

    it('should complete full onboarding: login → create character → check profile → claim daily', async () => {
      // Step 1: Initial authentication
      const authResponse = await request(app)
        .post('/api/auth/dev')
        .send({ username: 'NewPlayer' });

      expect(authResponse.status).toBe(200);
      expect(authResponse.body.success).toBe(true);
      authToken = authResponse.body.token;
      userId = authResponse.body.user.userId;

      // Verify token is valid
      const decoded = jwt.verify(authToken, jwtSecret) as any;
      expect(decoded.userId).toBe(userId);

      // Step 2: Check available character classes
      const mockUser = {
        userId,
        guildId: 'dev-guild',
        username: 'NewPlayer',
        coins: 1000,
        xp: 0,
        level: 1
      };

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(mockUser));

      const classesResponse = await request(app)
        .get('/api/characters/classes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(classesResponse.status).toBe(200);
      expect(classesResponse.body.classes).toHaveLength(6);
      const classNames = classesResponse.body.classes.map((c: any) => c.name.toLowerCase());
      expect(classNames).toContain('warrior');
      expect(classNames).toContain('mage');
      expect(classNames).toContain('rogue');

      // Step 3: Create character
      (Character.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(null));
      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(null));
      
      const mockCharacter = {
        _id: 'char-123',
        userId,
        guildId: 'dev-guild',
        name: 'TestWarrior',
        class: 'warrior',  // Use 'class' to match ICharacter interface
        level: 1,
        xp: 0,
        stats: {
          strength: 20,
          intelligence: 8,
          luck: 10,
          charisma: 12,
          vitality: 18,
          dexterity: 10
        },
        casinoBonus: {
          luckBonus: 5,
          energyBonus: 20
        }
      };

      (CharacterService.createCharacter as Mock).mockResolvedValue({
        success: true,
        character: mockCharacter,
        classInfo: {
          name: 'Warrior',
          description: 'A brave fighter',
          casinoBonus: {
            luckBonus: 5,
            energyBonus: 20,
            specialAbility: 'battle_rage',
            description: 'Higher chance of winning after a loss'
          },
          baseStats: {}
        }
      });

      const createCharResponse = await request(app)
        .post('/api/characters/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'TestWarrior',
          className: 'warrior'
        });

      expect(createCharResponse.status).toBe(200);
      expect(createCharResponse.body.success).toBe(true);
      expect(createCharResponse.body.character.name).toBe('TestWarrior');
      expect(createCharResponse.body.character.className).toBe('warrior');

      // Step 4: Check casino profile
      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(mockUser));
      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve({
        userId,
        guildId: 'dev-guild',
        energy: 100,
        maxEnergy: 100,
        reputation: 0
      }));
      (EconomyService.getCoins as Mock).mockResolvedValue(1000);

      const profileResponse = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.user.coins).toBe(1000);
      expect(profileResponse.body.casino.energy).toBe(100);

      // Step 5: Claim daily reward
      const updatedUser = {
        ...mockUser,
        lastDaily: null,
        save: vi.fn().mockResolvedValue(true)
      };

      const mockCasinoProfileWithSave = {
        userId,
        guildId: 'dev-guild',
        energy: 100,
        maxEnergy: 100,
        save: vi.fn().mockResolvedValue(true)
      };

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(updatedUser));
      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(mockCasinoProfileWithSave));
      (EconomyService.claimDaily as Mock).mockResolvedValue({ claimed: true, newBalance: 1125 });

      const dailyResponse = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      if (dailyResponse.status !== 200) {
        console.log('Daily error:', dailyResponse.body);
      }

      expect(dailyResponse.status).toBe(200);
      expect(dailyResponse.body.success).toBe(true);
      expect(dailyResponse.body.coinsReceived).toBeGreaterThan(0);
    });

    it('should reject character creation without authentication', async () => {
      const response = await request(app)
        .post('/api/characters/create')
        .send({
          name: 'NoAuthCharacter',
          className: 'warrior'
        });

      expect(response.status).toBe(401);
    });

    it('should validate character creation data', async () => {
      // Authenticate first
      const authResponse = await request(app)
        .post('/api/auth/dev')
        .send({ username: 'ValidationTest' });

      authToken = authResponse.body.token;

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve({
        userId: 'dev-user-demo',
        guildId: 'dev-guild',
        coins: 1000
      }));

      // Try with empty name
      const invalidResponse = await request(app)
        .post('/api/characters/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
          className: 'warrior'
        });

      expect(invalidResponse.status).toBe(400);
    });
  });

  describe('Casino Gameplay Flow', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      userId = 'gameplay-user';
      guildId = 'gameplay-guild';
      
      authToken = jwt.sign(
        { userId, guildId, username: 'GamePlayer' },
        jwtSecret,
        { expiresIn: '24h' }
      );
    });

    it('should complete game session: check balance → play → update stats', async () => {
      // Step 1: Check initial balance
      const initialUser = {
        userId,
        guildId,
        coins: 1000,
        xp: 100,
        level: 3,
        save: vi.fn().mockResolvedValue(true)
      };

      const initialProfile = {
        userId,
        guildId,
        energy: 80,
        maxEnergy: 100,
        reputation: 50,
        totalWagered: 500,
        totalWon: 300,
        totalLost: 200,
        save: vi.fn().mockResolvedValue(true)
      };

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(initialUser));
      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(initialProfile));
      (EconomyService.getCoins as Mock).mockResolvedValue(1000);

      const balanceResponse = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceResponse.status).toBe(200);
      const initialCoins = balanceResponse.body.user.coins;
      const initialEnergy = balanceResponse.body.casino.energy;
      expect(initialCoins).toBe(1000);
      expect(initialEnergy).toBe(80);

      // Step 2: Simulate game play (e.g., slots win)
      // Game would update: coins +500, xp +25, energy -10
      const updatedUser = {
        ...initialUser,
        coins: 1500,
        xp: 125
      };

      const updatedProfile = {
        ...initialProfile,
        energy: 70,
        totalWagered: 600,
        totalWon: 800
      };

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(updatedUser));
      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(updatedProfile));
      (EconomyService.getCoins as Mock).mockResolvedValue(1500);

      // Step 3: Verify updated balance
      const updatedBalanceResponse = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedBalanceResponse.status).toBe(200);
      expect(updatedBalanceResponse.body.user.coins).toBe(1500);
      expect(updatedBalanceResponse.body.user.xp).toBe(125);
      expect(updatedBalanceResponse.body.casino.energy).toBe(70);
      expect(updatedBalanceResponse.body.casino.totalWon).toBe(800);
    });

    it('should handle multiple game sessions with energy depletion', async () => {
      const testUser = {
        userId,
        guildId,
        coins: 2000,
        level: 5,
        save: vi.fn().mockResolvedValue(true)
      };

      // Session 1: Full energy
      let casinoProfile = {
        userId,
        guildId,
        energy: 100,
        maxEnergy: 100,
        save: vi.fn().mockResolvedValue(true)
      };

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(testUser));
      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(casinoProfile));

      let response1 = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.body.casino.energy).toBe(100);

      // Session 2: Energy depleted to 50
      casinoProfile.energy = 50;
      
      let response2 = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response2.body.casino.energy).toBe(50);

      // Session 3: Energy near zero
      casinoProfile.energy = 10;
      
      let response3 = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response3.body.casino.energy).toBe(10);
      // User should consider using daily to restore energy
    });
  });

  describe('Character Progression Flow', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      userId = 'progression-user';
      guildId = 'progression-guild';
      
      authToken = jwt.sign(
        { userId, guildId, username: 'ProgressPlayer' },
        jwtSecret,
        { expiresIn: '24h' }
      );
    });

    it('should track progression: create character → play games → level up', async () => {
      // Step 1: Create character
      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve({
        userId,
        guildId,
        coins: 1000,
        xp: 0,
        level: 1
      }));

      (Character.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(null));
      
      const newCharacter = {
        userId,
        guildId,
        name: 'ProgressWarrior',
        className: 'warrior',
        level: 1,
        xp: 0
      };

      (CharacterService.createCharacter as Mock).mockResolvedValue({
        success: true,
        character: newCharacter,
        profile: { energy: 100 }
      });

      const createResponse = await request(app)
        .post('/api/characters/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'ProgressWarrior',
          className: 'warrior'
        });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.character.level).toBe(1);

      // Step 2: Play multiple games to gain XP
      // Simulate games played (each game gives ~25 XP)
      const gamesPlayed = 10;
      const xpPerGame = 25;
      const totalXpGained = gamesPlayed * xpPerGame;

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve({
        userId,
        guildId,
        coins: 1500,
        xp: totalXpGained,
        level: 1
      }));

      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve({
        userId,
        guildId,
        energy: 50,
        maxEnergy: 100
      }));

      const profileAfterGames = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(profileAfterGames.body.user.xp).toBe(totalXpGained);

      // Step 3: Verify character info reflects progression
      const characterInfo = {
        character: {
          ...newCharacter,
          level: 2, // Leveled up
          xp: totalXpGained
        },
        classInfo: {
          name: 'Warrior',
          baseStats: { strength: 15, vitality: 12 }
        }
      };

      (CharacterService.getCharacterInfo as Mock).mockResolvedValue(characterInfo);

      const charResponse = await request(app)
        .get('/api/characters/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(charResponse.status).toBe(200);
    });
  });

  describe('Daily Reward Routine Flow', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      userId = 'daily-user';
      guildId = 'daily-guild';
      
      authToken = jwt.sign(
        { userId, guildId, username: 'DailyPlayer' },
        jwtSecret,
        { expiresIn: '24h' }
      );
    });

    it('should complete daily routine: login → check time → claim daily', async () => {
      // Day 1: First claim
      const day1User = {
        userId,
        guildId,
        username: 'DailyPlayer',
        level: 5
      };

      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(day1User));
      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(null));
      (EconomyService.claimDaily as Mock).mockResolvedValueOnce({ claimed: true, newBalance: 725 });

      const day1Response = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(day1Response.status).toBe(200);
      expect(day1Response.body.success).toBe(true);
      const day1Reward = day1Response.body.coinsReceived;
      expect(day1Reward).toBe(100 + (5 * 25)); // Base + level bonus

      // Try to claim again immediately (should fail)
      (EconomyService.claimDaily as Mock).mockResolvedValueOnce({ claimed: false, hoursLeft: 24 });

      const tooSoonResponse = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(tooSoonResponse.body.success).toBe(false);
      expect(tooSoonResponse.body.hoursLeft).toBeGreaterThan(0);

      // Day 2: After 24 hours (simulate)
      day1User.level = 6; // Leveled up
      (EconomyService.claimDaily as Mock).mockResolvedValueOnce({ claimed: true, newBalance: 975 });

      const day2Response = await request(app)
        .post('/api/casino/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(day2Response.status).toBe(200);
      expect(day2Response.body.success).toBe(true);
      const day2Reward = day2Response.body.coinsReceived;
      expect(day2Reward).toBe(100 + (6 * 25)); // Increased with level
      expect(day2Reward).toBeGreaterThan(day1Reward);
    });
  });

  describe('Error Recovery Flow', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      userId = 'error-user';
      guildId = 'error-guild';
      
      authToken = jwt.sign(
        { userId, guildId, username: 'ErrorTest' },
        jwtSecret,
        { expiresIn: '24h' }
      );
    });

    it('should handle authentication errors gracefully', async () => {
      // Invalid token
      const response1 = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response1.status).toBe(401);

      // Missing token
      const response2 = await request(app)
        .get('/api/casino/profile');

      expect(response2.status).toBe(401);

      // Valid token works
      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve({
        userId,
        guildId,
        username: 'ErrorTest',
        coins: 1000
      }));

      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(null));

      const response3 = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response3.status).toBe(200);
    });

    it('should handle database failures during game flow', async () => {
      // Database error on profile fetch
      (User.findOne as Mock).mockRejectedValue(new Error('DB Connection Lost'));

      const profileResponse = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(profileResponse.status).toBe(500);

      // Recovery: database comes back online
      (User.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve({
        userId,
        guildId,
        username: 'ErrorTest',
        coins: 1000
      }));

      (CasinoProfile.findOne as Mock) = vi.fn().mockImplementation(() => Promise.resolve(null));

      const recoveryResponse = await request(app)
        .get('/api/casino/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(recoveryResponse.status).toBe(200);
    });
  });
});

