import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
import { AbilityService } from '../src/services/AbilityService';
import { Character, CasinoProfile } from '../src/models/database';
import { CasinoSession } from '../src/models/schemas';

// Mock database models
vi.mock('../src/models/database');
vi.mock('../src/models/schemas');

describe('AbilityService', () => {
  const mockUserId = 'user123';
  const mockGuildId = 'guild456';
  const mockSessionId = 'session789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canUseAbility', () => {
    it('should return failure for unknown ability', async () => {
      const result = await AbilityService.canUseAbility(
        mockUserId,
        mockGuildId,
        'unknown_ability'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown ability');
    });

    it('should return failure when no character found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);
      (CasinoProfile.findOne as Mock).mockResolvedValue({ energy: 100 });

      const result = await AbilityService.canUseAbility(
        mockUserId,
        mockGuildId,
        'warrior_battle_rage'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires warrior class');
    });

    it('should check character class for abilities', async () => {
      // When className doesn't match, should fail
      (Character.findOne as Mock).mockResolvedValue({
        userId: mockUserId,
        guildId: mockGuildId,
        className: 'mage'  // Mage can't use warrior ability
      });
      (CasinoProfile.findOne as Mock).mockResolvedValue({ energy: 100 });

      const result = await AbilityService.canUseAbility(
        mockUserId,
        mockGuildId,
        'warrior_battle_rage'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires warrior class');
    });
  });

  describe('useAbility', () => {
    it('should not throw error for unknown ability', async () => {
      await expect(
        AbilityService.useAbility(mockUserId, mockGuildId, 'unknown_ability')
      ).resolves.not.toThrow();
    });

    it('should not throw error when character not found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);
      
      await expect(
        AbilityService.useAbility(mockUserId, mockGuildId, 'warrior_battle_rage')
      ).resolves.not.toThrow();
    });
  });

  describe('getClassAbilities', () => {
    it('should return abilities for warrior class', () => {
      const abilities = AbilityService.getClassAbilities('warrior');
      
      expect(abilities).toContainEqual(
        expect.objectContaining({ abilityName: expect.stringContaining('Battle') })
      );
    });

    it('should return abilities for mage class', () => {
      const abilities = AbilityService.getClassAbilities('mage');
      
      expect(abilities).toContainEqual(
        expect.objectContaining({ abilityName: expect.stringContaining('Card Reading') })
      );
    });

    it('should return abilities for rogue class', () => {
      const abilities = AbilityService.getClassAbilities('rogue');
      
      expect(abilities.length).toBeGreaterThan(0);
    });

    it('should return abilities for merchant class', () => {
      const abilities = AbilityService.getClassAbilities('merchant');
      
      expect(abilities.length).toBeGreaterThan(0);
    });

    it('should return abilities for bard class', () => {
      const abilities = AbilityService.getClassAbilities('bard');
      
      expect(abilities.length).toBeGreaterThan(0);
    });

    it('should return abilities for paladin class', () => {
      const abilities = AbilityService.getClassAbilities('paladin');
      
      expect(abilities.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid class', () => {
      const abilities = AbilityService.getClassAbilities('invalid');
      
      expect(abilities).toEqual([]);
    });
  });

  describe('getAbilityStatus', () => {
    it('should return empty object when character not found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      const status = await AbilityService.getAbilityStatus(mockUserId, mockGuildId);

      expect(status).toEqual({});
    });
  });
});

