import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
import { ReputationService, ReputationTier } from '../src/services/ReputationService';
import { CasinoProfile } from '../src/models/database';

// Mock database models
vi.mock('../src/models/database');

describe('ReputationService', () => {
  const mockUserId = 'user123';
  const mockGuildId = 'guild456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReputationInfo', () => {
    it('should return novice tier for 0 reputation', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 0
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('novice');
      expect(result.current).toBe(0);
    });

    it('should return amateur tier for 100+ reputation', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 150
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('amateur');
      expect(result.current).toBe(150);
    });

    it('should return seasoned tier for 500+ reputation', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 750
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('seasoned');
    });

    it('should return professional tier for 1500+ reputation', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 2000
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('professional');
    });

    it('should return high_roller tier for 5000+ reputation', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 7000
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('high_roller');
    });

    it('should return legend tier for 15000+ reputation', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 20000
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('legend');
    });

    it('should return mythic tier for 50000+ reputation', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 55000
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('mythic');
    });

    it('should calculate points to next tier correctly', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 80
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('novice');
      expect(result.nextTier).toBe('amateur');
      expect(result.pointsToNextTier).toBe(20); // 100 - 80
    });

    it('should return null for next tier when at max tier', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 60000
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.tier).toBe('mythic');
      expect(result.nextTier).toBeNull();
      expect(result.pointsToNextTier).toBe(0);
    });

    it('should return perks for current tier', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 600
      });

      const result = await ReputationService.getReputationInfo(mockUserId, mockGuildId);

      expect(result.perks).toBeDefined();
      expect(Array.isArray(result.perks)).toBe(true);
      expect(result.perks.length).toBeGreaterThan(0);
    });
  });

  describe('awardReputation', () => {
    it('should award reputation for a win', async () => {
      const mockProfile = {
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const result = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        100,
        'win',
        5
      );

      expect(result.gained).toBeGreaterThan(0);
      expect(result.newTotal).toBeGreaterThan(100);
      expect(mockProfile.save).toHaveBeenCalled();
    });

    it('should award more reputation for jackpot wins', async () => {
      const mockProfile = {
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const jackpotResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'slots',
        100,
        'jackpot',
        5
      );

      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      });

      const winResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'slots',
        100,
        'win',
        5
      );

      expect(jackpotResult.gained).toBeGreaterThan(winResult.gained);
    });

    it('should award less reputation for push', async () => {
      const mockProfile = {
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const pushResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        100,
        'push',
        5
      );

      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      });

      const winResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        100,
        'win',
        5
      );

      expect(pushResult.gained).toBeLessThan(winResult.gained);
    });

    it('should detect tier change', async () => {
      const mockProfile = {
        reputation: 95,
        reputationLevel: 'novice',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const result = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        100,
        'win',
        5
      );

      if (result.newTotal >= 100) {
        expect(result.tierChanged).toBe(true);
        expect(result.newTier).toBe('amateur');
      }
    });

    it('should apply high stakes bonus', async () => {
      const mockProfile = {
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const highStakesResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        500, // High stakes bet
        'win',
        5
      );

      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      });

      const lowStakesResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        50,
        'win',
        5
      );

      expect(highStakesResult.gained).toBeGreaterThan(lowStakesResult.gained);
    });

    it('should apply character level bonus', async () => {
      const mockProfile = {
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const highLevelResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        100,
        'win',
        20 // High level
      );

      (CasinoProfile.findOne as Mock).mockResolvedValue({
        reputation: 100,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      });

      const lowLevelResult = await ReputationService.awardReputation(
        mockUserId,
        mockGuildId,
        'blackjack',
        100,
        'win',
        1 // Low level
      );

      expect(highLevelResult.gained).toBeGreaterThan(lowLevelResult.gained);
    });

    it('should throw error when profile not found', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue(null);

      await expect(
        ReputationService.awardReputation(
          mockUserId,
          mockGuildId,
          'blackjack',
          100,
          'win',
          5
        )
      ).rejects.toThrow('Casino profile not found');
    });
  });

  describe('removeReputation', () => {
    it('should remove reputation correctly', async () => {
      const mockProfile = {
        reputation: 150,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const result = await ReputationService.removeReputation(
        mockUserId,
        mockGuildId,
        50,
        'rule violation'
      );

      expect(result.newTotal).toBe(100);
    });

    it('should not go below 0 reputation', async () => {
      const mockProfile = {
        reputation: 30,
        reputationLevel: 'novice',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const result = await ReputationService.removeReputation(
        mockUserId,
        mockGuildId,
        50,
        'rule violation'
      );

      expect(result.newTotal).toBe(0);
    });

    it('should detect tier change on reputation removal', async () => {
      const mockProfile = {
        reputation: 110,
        reputationLevel: 'amateur',
        save: vi.fn().mockResolvedValue(true)
      };

      (CasinoProfile.findOne as Mock).mockResolvedValue(mockProfile);

      const result = await ReputationService.removeReputation(
        mockUserId,
        mockGuildId,
        20,
        'rule violation'
      );

      expect(result.newTotal).toBe(90);
      expect(result.tierChanged).toBe(true);
    });

    it('should throw error when profile not found', async () => {
      (CasinoProfile.findOne as Mock).mockResolvedValue(null);

      await expect(
        ReputationService.removeReputation(
          mockUserId,
          mockGuildId,
          50,
          'rule violation'
        )
      ).rejects.toThrow('Casino profile not found');
    });
  });

  describe('getAllTiers', () => {
    it('should return all tier definitions', () => {
      const tiers = ReputationService.getAllTiers();

      expect(tiers).toBeDefined();
      expect(Array.isArray(tiers)).toBe(true);
      expect(tiers.length).toBe(7); // novice, amateur, seasoned, professional, high_roller, legend, mythic
    });

    it('should have tiers in ascending order of minPoints', () => {
      const tiers = ReputationService.getAllTiers();

      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].minPoints).toBeGreaterThan(tiers[i - 1].minPoints);
      }
    });
  });

  describe('getTierPerks', () => {
    it('should return perks for novice tier', () => {
      const perks = ReputationService.getTierPerks('novice');
      expect(perks).toBeDefined();
      expect(Array.isArray(perks)).toBe(true);
      expect(perks.length).toBeGreaterThan(0);
    });

    it('should return perks for high_roller tier', () => {
      const perks = ReputationService.getTierPerks('high_roller');
      expect(perks).toBeDefined();
      expect(Array.isArray(perks)).toBe(true);
      expect(perks.length).toBeGreaterThan(2); // Should have more perks
    });

    it('should return empty array for invalid tier', () => {
      const perks = ReputationService.getTierPerks('invalid' as ReputationTier);
      expect(perks).toEqual([]);
    });
  });

  describe('getReputationBonuses', () => {
    it('should return correct bonuses for novice tier', () => {
      const bonuses = ReputationService.getReputationBonuses('novice');

      expect(bonuses.buyInDiscount).toBe(0);
      expect(bonuses.energyBonus).toBe(0);
      expect(bonuses.dailyBonusMultiplier).toBe(1.0);
      expect(bonuses.jackpotMultiplier).toBe(1.0);
    });

    it('should return correct bonuses for amateur tier', () => {
      const bonuses = ReputationService.getReputationBonuses('amateur');

      expect(bonuses.buyInDiscount).toBe(0.05);
      expect(bonuses.energyBonus).toBe(5);
      expect(bonuses.dailyBonusMultiplier).toBe(1.1);
    });

    it('should return correct bonuses for high_roller tier', () => {
      const bonuses = ReputationService.getReputationBonuses('high_roller');

      expect(bonuses.buyInDiscount).toBe(0.20);
      expect(bonuses.energyBonus).toBe(30);
      expect(bonuses.dailyBonusMultiplier).toBe(2.0);
      expect(bonuses.jackpotMultiplier).toBe(1.1);
    });

    it('should return correct bonuses for mythic tier', () => {
      const bonuses = ReputationService.getReputationBonuses('mythic');

      expect(bonuses.buyInDiscount).toBe(0.30);
      expect(bonuses.energyBonus).toBe(100);
      expect(bonuses.dailyBonusMultiplier).toBe(5.0);
      expect(bonuses.jackpotMultiplier).toBe(1.5);
    });

    it('should have increasing bonuses for higher tiers', () => {
      const tiers: ReputationTier[] = ['novice', 'amateur', 'seasoned', 'professional', 'high_roller', 'legend', 'mythic'];

      for (let i = 1; i < tiers.length; i++) {
        const prevBonuses = ReputationService.getReputationBonuses(tiers[i - 1]);
        const currBonuses = ReputationService.getReputationBonuses(tiers[i]);

        expect(currBonuses.buyInDiscount).toBeGreaterThanOrEqual(prevBonuses.buyInDiscount);
        expect(currBonuses.energyBonus).toBeGreaterThanOrEqual(prevBonuses.energyBonus);
        expect(currBonuses.dailyBonusMultiplier).toBeGreaterThanOrEqual(prevBonuses.dailyBonusMultiplier);
      }
    });
  });
});

