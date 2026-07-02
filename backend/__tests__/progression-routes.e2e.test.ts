import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { Mock } from 'vitest';
/**
 * End-to-end tests for Progression API routes
 * Tests energy, reputation, and ability system flows
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Mock dependencies BEFORE importing routes
vi.mock('../src/models/database');
vi.mock('../src/models/schemas');
vi.mock('../src/services/EnergyService');
vi.mock('../src/services/ReputationService');
vi.mock('../src/services/AbilityService');

// Import after mocking
import progressionRoutes from '../src/routes/progression';
import { authMiddleware } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { EnergyService } from '../src/services/EnergyService';
import { ReputationService } from '../src/services/ReputationService';
import { AbilityService } from '../src/services/AbilityService';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/progression', authMiddleware, progressionRoutes);
app.use(errorHandler);

describe('Progression API E2E Tests', () => {
  let authToken: string;
  const testUserId = 'progression-test-user';
  const testGuildId = 'progression-test-guild';
  const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';

  beforeAll(() => {
    authToken = jwt.sign(
      { 
        userId: testUserId,
        guildId: testGuildId,
        username: 'ProgressionTestUser',
        discordId: testUserId
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================
  // ENERGY MANAGEMENT TESTS
  // =====================
  describe('GET /api/progression/energy - Energy Status', () => {
    it('should return current energy status', async () => {
      const mockEnergyInfo = {
        current: 75,
        max: 100,
        regenRate: 5,
        nextRegenAt: new Date(Date.now() + 300000),
        percentFull: 75,
        canPlay: true,
        lowEnergyWarning: false
      };

      (EnergyService.getEnergyInfo as Mock).mockResolvedValue(mockEnergyInfo);

      const response = await request(app)
        .get('/api/progression/energy')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.energy.current).toBe(75);
      expect(response.body.energy.max).toBe(100);
      expect(response.body.energy.canPlay).toBe(true);
    });

    it('should show low energy warning', async () => {
      const mockEnergyInfo = {
        current: 10,
        max: 100,
        regenRate: 5,
        nextRegenAt: new Date(Date.now() + 60000),
        percentFull: 10,
        canPlay: true,
        lowEnergyWarning: true
      };

      (EnergyService.getEnergyInfo as Mock).mockResolvedValue(mockEnergyInfo);

      const response = await request(app)
        .get('/api/progression/energy')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.energy.current).toBe(10);
      expect(response.body.energy.lowEnergyWarning).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/progression/energy');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/progression/energy/restore - Energy Restore', () => {
    it('should restore energy successfully', async () => {
      const mockResult = {
        current: 100,
        max: 100,
        restored: 50,
        message: 'Energy restored'
      };

      (EnergyService.restoreEnergy as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/progression/energy/restore')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Restored 50 energy');
      expect(response.body.energy.current).toBe(100);
    });

    it('should cap energy at max', async () => {
      const mockResult = {
        current: 100,
        max: 100,
        restored: 25, // Only 25 needed to reach max
        message: 'Energy restored to max'
      };

      (EnergyService.restoreEnergy as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/progression/energy/restore')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100 });

      expect(response.status).toBe(200);
      expect(response.body.energy.current).toBe(100);
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/progression/energy/restore')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid amount');
    });

    it('should reject negative amount', async () => {
      const response = await request(app)
        .post('/api/progression/energy/restore')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: -10 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid amount');
    });
  });

  // =====================
  // REPUTATION SYSTEM TESTS
  // =====================
  describe('GET /api/progression/reputation - Reputation Status', () => {
    it('should return current reputation status', async () => {
      const mockRepInfo = {
        current: 350,
        tier: 'seasoned',
        tierProgress: 50,
        nextTier: 'professional',
        nextTierAt: 500,
        multiplierBonus: 1.15,
        unlockedPerks: ['bonus_spins', 'vip_tables']
      };

      (ReputationService.getReputationInfo as Mock).mockResolvedValue(mockRepInfo);

      const response = await request(app)
        .get('/api/progression/reputation')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reputation.current).toBe(350);
      expect(response.body.reputation.tier).toBe('seasoned');
      expect(response.body.reputation.nextTier).toBe('professional');
    });

    it('should show max tier status', async () => {
      const mockRepInfo = {
        current: 5000,
        tier: 'mythic',
        tierProgress: 100,
        nextTier: null,
        nextTierAt: null,
        multiplierBonus: 1.5,
        unlockedPerks: ['all_perks']
      };

      (ReputationService.getReputationInfo as Mock).mockResolvedValue(mockRepInfo);

      const response = await request(app)
        .get('/api/progression/reputation')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.reputation.tier).toBe('mythic');
      expect(response.body.reputation.nextTier).toBeNull();
    });
  });

  describe('GET /api/progression/reputation/tiers - All Reputation Tiers', () => {
    it('should return all reputation tiers', async () => {
      const mockTiers = [
        { name: 'novice', minRep: 0, bonuses: { multiplier: 1.0 } },
        { name: 'amateur', minRep: 100, bonuses: { multiplier: 1.05 } },
        { name: 'seasoned', minRep: 250, bonuses: { multiplier: 1.1 } },
        { name: 'professional', minRep: 500, bonuses: { multiplier: 1.15 } },
        { name: 'high_roller', minRep: 1000, bonuses: { multiplier: 1.25 } },
        { name: 'legend', minRep: 2500, bonuses: { multiplier: 1.35 } },
        { name: 'mythic', minRep: 5000, bonuses: { multiplier: 1.5 } }
      ];

      (ReputationService.getAllTiers as Mock).mockReturnValue(mockTiers);

      const response = await request(app)
        .get('/api/progression/reputation/tiers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tiers).toHaveLength(7);
      expect(response.body.tiers[0].name).toBe('novice');
      expect(response.body.tiers[6].name).toBe('mythic');
    });
  });

  describe('GET /api/progression/reputation/bonuses - Current Bonuses', () => {
    it('should return current tier bonuses', async () => {
      const mockRepInfo = {
        current: 600,
        tier: 'professional'
      };

      const mockBonuses = {
        multiplier: 1.15,
        energyBonus: 10,
        xpBonus: 15,
        perks: ['vip_tables', 'reduced_cooldowns']
      };

      (ReputationService.getReputationInfo as Mock).mockResolvedValue(mockRepInfo);
      (ReputationService.getReputationBonuses as Mock).mockReturnValue(mockBonuses);

      const response = await request(app)
        .get('/api/progression/reputation/bonuses')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tier).toBe('professional');
      expect(response.body.bonuses.multiplier).toBe(1.15);
      expect(response.body.bonuses.perks).toContain('vip_tables');
    });
  });

  // =====================
  // ABILITY SYSTEM TESTS
  // =====================
  describe('GET /api/progression/abilities - Ability Status', () => {
    it('should return all abilities status', async () => {
      const mockAbilityStatus = {
        battle_rage: {
          available: true,
          cooldownRemaining: 0,
          usesRemaining: 3,
          effect: '+20% damage after loss'
        },
        fortune_sight: {
          available: false,
          cooldownRemaining: 120,
          usesRemaining: 0,
          effect: 'Predict next outcome'
        },
        shadow_gambit: {
          available: true,
          cooldownRemaining: 0,
          usesRemaining: 2,
          effect: 'Double or nothing'
        }
      };

      (AbilityService.getAbilityStatus as Mock).mockResolvedValue(mockAbilityStatus);

      const response = await request(app)
        .get('/api/progression/abilities')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.abilities.battle_rage.available).toBe(true);
      expect(response.body.abilities.fortune_sight.available).toBe(false);
      expect(response.body.abilities.fortune_sight.cooldownRemaining).toBe(120);
    });

    it('should accept session ID for ability tracking', async () => {
      const mockAbilityStatus = {
        steady_hand: {
          available: true,
          cooldownRemaining: 0,
          usesRemaining: 5,
          effect: '+10% accuracy'
        }
      };

      (AbilityService.getAbilityStatus as Mock).mockResolvedValue(mockAbilityStatus);

      const response = await request(app)
        .get('/api/progression/abilities')
        .query({ sessionId: 'session_123' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(AbilityService.getAbilityStatus).toHaveBeenCalledWith(
        testUserId, testGuildId, 'session_123'
      );
    });
  });

  describe('GET /api/progression/abilities/:abilityKey - Specific Ability Check', () => {
    it('should check if ability can be used', async () => {
      const mockCanUse = {
        success: true,
        effect: '+25% luck bonus',
        message: 'Ability ready',
        cooldownRemaining: 0,
        usesRemaining: 2
      };

      (AbilityService.canUseAbility as Mock).mockResolvedValue(mockCanUse);

      const response = await request(app)
        .get('/api/progression/abilities/fortune_sight')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ability).toBe('fortune_sight');
      expect(response.body.available).toBe(true);
      expect(response.body.effect).toBe('+25% luck bonus');
    });

    it('should show ability on cooldown', async () => {
      const mockCanUse = {
        success: false,
        effect: null,
        message: 'Ability on cooldown',
        cooldownRemaining: 180,
        usesRemaining: 0
      };

      (AbilityService.canUseAbility as Mock).mockResolvedValue(mockCanUse);

      const response = await request(app)
        .get('/api/progression/abilities/battle_rage')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.available).toBe(false);
      expect(response.body.cooldownRemaining).toBe(180);
      expect(response.body.message).toContain('cooldown');
    });

    it('should show no uses remaining', async () => {
      const mockCanUse = {
        success: false,
        effect: null,
        message: 'No uses remaining today',
        cooldownRemaining: 0,
        usesRemaining: 0
      };

      (AbilityService.canUseAbility as Mock).mockResolvedValue(mockCanUse);

      const response = await request(app)
        .get('/api/progression/abilities/shadow_gambit')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.usesRemaining).toBe(0);
    });
  });

  // =====================
  // COMBINED STATS TESTS
  // =====================
  describe('GET /api/progression/stats - Combined Progression Stats', () => {
    it('should return all progression stats in one call', async () => {
      const mockEnergyInfo = {
        current: 80,
        max: 100,
        regenRate: 5,
        canPlay: true
      };

      const mockRepInfo = {
        current: 450,
        tier: 'professional',
        nextTier: 'high_roller'
      };

      const mockBonuses = {
        multiplier: 1.15,
        perks: ['vip_tables']
      };

      const mockAbilityStatus = {
        battle_rage: { available: true, usesRemaining: 3 },
        fortune_sight: { available: false, cooldownRemaining: 60 }
      };

      (EnergyService.getEnergyInfo as Mock).mockResolvedValue(mockEnergyInfo);
      (ReputationService.getReputationInfo as Mock).mockResolvedValue(mockRepInfo);
      (ReputationService.getReputationBonuses as Mock).mockReturnValue(mockBonuses);
      (AbilityService.getAbilityStatus as Mock).mockResolvedValue(mockAbilityStatus);

      const response = await request(app)
        .get('/api/progression/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Energy section
      expect(response.body.progression.energy.current).toBe(80);
      expect(response.body.progression.energy.canPlay).toBe(true);
      
      // Reputation section
      expect(response.body.progression.reputation.current).toBe(450);
      expect(response.body.progression.reputation.tier).toBe('professional');
      expect(response.body.progression.reputation.bonuses.multiplier).toBe(1.15);
      
      // Abilities section
      expect(response.body.progression.abilities.battle_rage.available).toBe(true);
      expect(response.body.progression.abilities.fortune_sight.available).toBe(false);
    });

    it('should handle partial service failures gracefully', async () => {
      (EnergyService.getEnergyInfo as Mock).mockRejectedValue(new Error('Energy service down'));

      const response = await request(app)
        .get('/api/progression/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  // =====================
  // AUTHENTICATION TESTS
  // =====================
  describe('Authentication across all progression endpoints', () => {
    const progressionEndpoints = [
      { method: 'get', path: '/api/progression/energy' },
      { method: 'post', path: '/api/progression/energy/restore', body: { amount: 50 } },
      { method: 'get', path: '/api/progression/reputation' },
      { method: 'get', path: '/api/progression/reputation/tiers' },
      { method: 'get', path: '/api/progression/reputation/bonuses' },
      { method: 'get', path: '/api/progression/abilities' },
      { method: 'get', path: '/api/progression/abilities/battle_rage' },
      { method: 'get', path: '/api/progression/stats' }
    ];

    it.each(progressionEndpoints)('should require authentication for $method $path', async (endpoint) => {
      const req = endpoint.method === 'get'
        ? request(app).get(endpoint.path)
        : request(app).post(endpoint.path).send(endpoint.body);

      const response = await req;
      expect(response.status).toBe(401);
    });

    it.each(progressionEndpoints)('should reject invalid token for $method $path', async (endpoint) => {
      const req = endpoint.method === 'get'
        ? request(app).get(endpoint.path).set('Authorization', 'Bearer invalid-token')
        : request(app).post(endpoint.path).set('Authorization', 'Bearer invalid-token').send(endpoint.body);

      const response = await req;
      expect(response.status).toBe(401);
    });
  });

  // =====================
  // WORKFLOW TESTS
  // =====================
  describe('Progression Flow E2E', () => {
    it('should track complete progression flow: check energy → play → gain reputation → unlock ability', async () => {
      // Step 1: Check initial energy
      const initialEnergy = {
        current: 100,
        max: 100,
        canPlay: true
      };

      (EnergyService.getEnergyInfo as Mock).mockResolvedValue(initialEnergy);

      const energyResponse = await request(app)
        .get('/api/progression/energy')
        .set('Authorization', `Bearer ${authToken}`);

      expect(energyResponse.status).toBe(200);
      expect(energyResponse.body.energy.current).toBe(100);

      // Step 2: After playing games, check reduced energy
      const afterGameEnergy = {
        current: 70,
        max: 100,
        canPlay: true
      };

      (EnergyService.getEnergyInfo as Mock).mockResolvedValue(afterGameEnergy);

      const afterGameResponse = await request(app)
        .get('/api/progression/energy')
        .set('Authorization', `Bearer ${authToken}`);

      expect(afterGameResponse.body.energy.current).toBe(70);

      // Step 3: Check increased reputation
      const increasedRep = {
        current: 200,
        tier: 'amateur',
        nextTier: 'seasoned'
      };

      (ReputationService.getReputationInfo as Mock).mockResolvedValue(increasedRep);

      const repResponse = await request(app)
        .get('/api/progression/reputation')
        .set('Authorization', `Bearer ${authToken}`);

      expect(repResponse.body.reputation.current).toBe(200);
      expect(repResponse.body.reputation.tier).toBe('amateur');

      // Step 4: Check unlocked ability
      const unlockedAbility = {
        success: true,
        effect: '+10% luck',
        cooldownRemaining: 0,
        usesRemaining: 3
      };

      (AbilityService.canUseAbility as Mock).mockResolvedValue(unlockedAbility);

      const abilityResponse = await request(app)
        .get('/api/progression/abilities/fortune_sight')
        .set('Authorization', `Bearer ${authToken}`);

      expect(abilityResponse.body.available).toBe(true);
      expect(abilityResponse.body.usesRemaining).toBe(3);
    });
  });
});

