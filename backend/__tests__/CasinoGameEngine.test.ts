import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CasinoGameEngine } from '../src/engines/CasinoGameEngine';
import { AbilityService } from '../src/services/AbilityService';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeContext(className: string) {
  return {
    user: { userId: 'user1', guildId: 'guild1' },
    characterBonus: { className }
  };
}

describe('CasinoGameEngine', () => {
  describe('calculateLuckModifier', () => {
    it('returns 1.0 at base luck of 10', () => {
      expect(CasinoGameEngine.calculateLuckModifier(10)).toBe(1.0);
    });

    it('increases by 1% per luck point above base', () => {
      expect(CasinoGameEngine.calculateLuckModifier(60)).toBe(1.5);
    });

    it('caps at 2.0 regardless of how high luck is', () => {
      expect(CasinoGameEngine.calculateLuckModifier(110)).toBe(2.0);
      expect(CasinoGameEngine.calculateLuckModifier(500)).toBe(2.0);
    });

    it('returns below 1.0 for luck under base', () => {
      expect(CasinoGameEngine.calculateLuckModifier(5)).toBeCloseTo(0.95);
    });
  });

  describe('calculateXpGain', () => {
    it('applies 1.5x multiplier for wins at level 1', () => {
      // baseXp=10, multiplier=1.5, levelPenalty=0.95 → floor(14.25) = 14
      expect(CasinoGameEngine.calculateXpGain(100, 'win', 1)).toBe(14);
    });

    it('applies 1.0x multiplier for losses at level 1', () => {
      // baseXp=10, multiplier=1.0, levelPenalty=0.95 → floor(9.5) = 9
      expect(CasinoGameEngine.calculateXpGain(100, 'loss', 1)).toBe(9);
    });

    it('applies 2.0x multiplier for jackpots at level 1', () => {
      // baseXp=10, multiplier=2.0, levelPenalty=0.95 → floor(19.0) = 19
      expect(CasinoGameEngine.calculateXpGain(100, 'jackpot', 1)).toBe(19);
    });

    it('applies 2.0x multiplier for pushes (non-win/loss outcomes)', () => {
      expect(CasinoGameEngine.calculateXpGain(100, 'push', 1)).toBe(19);
    });

    it('reduces XP via level penalty at higher levels', () => {
      // level 10: penalty = max(0.1, 1-0.5) = 0.5 → floor(10*1.5*0.5) = 7
      expect(CasinoGameEngine.calculateXpGain(100, 'win', 10)).toBe(7);
    });

    it('floors level penalty at 0.1 to prevent zero XP', () => {
      // level 20: penalty = max(0.1, 1-1.0) = 0.1 → floor(10*1.5*0.1) = 1
      expect(CasinoGameEngine.calculateXpGain(100, 'win', 20)).toBe(1);
    });

    it('scales baseXp with bet size', () => {
      // bet=200 → baseXp=20, win at level 1 → floor(20*1.5*0.95) = floor(28.5) = 28
      expect(CasinoGameEngine.calculateXpGain(200, 'win', 1)).toBe(28);
    });
  });

  // ─── ability triggers ────────────────────────────────────────────────────

  describe('triggerWarriorBattleRage', () => {
    beforeEach(() => {
      vi.spyOn(AbilityService, 'canUseAbility').mockResolvedValue({ success: true, message: '' });
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
    });

    afterEach(() => vi.restoreAllMocks());

    it('returns 1.0 when character is not a warrior', async () => {
      const result = await CasinoGameEngine.triggerWarriorBattleRage(makeContext('mage'), true);
      expect(result).toBe(1.0);
    });

    it('returns 1.0 when last game was not a loss (no comeback needed)', async () => {
      const result = await CasinoGameEngine.triggerWarriorBattleRage(makeContext('warrior'), false);
      expect(result).toBe(1.0);
    });

    it('returns 1.25 comeback bonus when warrior just lost and ability is available', async () => {
      const result = await CasinoGameEngine.triggerWarriorBattleRage(makeContext('warrior'), true);
      expect(result).toBe(1.25);
      expect(AbilityService.useAbility).toHaveBeenCalledOnce();
    });

    it('returns 1.0 when ability is on cooldown', async () => {
      vi.spyOn(AbilityService, 'canUseAbility').mockResolvedValue({
        success: false,
        message: 'Ability on cooldown'
      });
      const result = await CasinoGameEngine.triggerWarriorBattleRage(makeContext('warrior'), true);
      expect(result).toBe(1.0);
      expect(AbilityService.useAbility).not.toHaveBeenCalled();
    });
  });

  describe('triggerRogueSleightOfHand', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns the full bet when character is not a rogue', async () => {
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
      const result = await CasinoGameEngine.triggerRogueSleightOfHand(makeContext('warrior'), 100);
      expect(result).toBe(100);
    });

    it('returns half the bet when the 15% random trigger fires', async () => {
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
      vi.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 < 0.15 → triggers
      const result = await CasinoGameEngine.triggerRogueSleightOfHand(makeContext('rogue'), 100);
      expect(result).toBe(50);
      expect(AbilityService.useAbility).toHaveBeenCalledOnce();
    });

    it('returns the full bet when the random trigger does not fire', async () => {
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 >= 0.15 → no trigger
      const result = await CasinoGameEngine.triggerRogueSleightOfHand(makeContext('rogue'), 100);
      expect(result).toBe(100);
      expect(AbilityService.useAbility).not.toHaveBeenCalled();
    });
  });

  describe('triggerMerchantCoinSense', () => {
    beforeEach(() => {
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
    });

    afterEach(() => vi.restoreAllMocks());

    it('returns base winnings unchanged for non-merchant classes', async () => {
      const result = await CasinoGameEngine.triggerMerchantCoinSense(makeContext('mage'), 500);
      expect(result).toBe(500);
      expect(AbilityService.useAbility).not.toHaveBeenCalled();
    });

    it('returns winnings * 1.2 for the merchant class', async () => {
      const result = await CasinoGameEngine.triggerMerchantCoinSense(makeContext('merchant'), 500);
      expect(result).toBe(600);
      expect(AbilityService.useAbility).toHaveBeenCalledOnce();
    });
  });

  describe('triggerPaladinDivineBlessing', () => {
    beforeEach(() => {
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
    });

    afterEach(() => vi.restoreAllMocks());

    it('returns the potential loss unchanged for non-paladin classes', async () => {
      const result = await CasinoGameEngine.triggerPaladinDivineBlessing(makeContext('rogue'), 200, 200);
      expect(result).toBe(200);
    });

    it('returns the potential loss unchanged when it is 100 or less', async () => {
      const result = await CasinoGameEngine.triggerPaladinDivineBlessing(makeContext('paladin'), 100, 100);
      expect(result).toBe(100);
      expect(AbilityService.useAbility).not.toHaveBeenCalled();
    });

    it('reduces losses larger than 100 by 30%', async () => {
      const result = await CasinoGameEngine.triggerPaladinDivineBlessing(makeContext('paladin'), 200, 200);
      expect(result).toBe(140); // 200 * 0.7
      expect(AbilityService.useAbility).toHaveBeenCalledOnce();
    });
  });

  describe('triggerBardLuckySong', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns 1.0 when character is not a bard', async () => {
      const result = await CasinoGameEngine.triggerBardLuckySong(makeContext('warrior'), 'guild1');
      expect(result).toBe(1.0);
    });

    it('returns 1.0 when ability is on cooldown', async () => {
      vi.spyOn(AbilityService, 'canUseAbility').mockResolvedValue({
        success: false,
        message: 'Ability on cooldown'
      });
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
      const result = await CasinoGameEngine.triggerBardLuckySong(makeContext('bard'), 'guild1');
      expect(result).toBe(1.0);
      expect(AbilityService.useAbility).not.toHaveBeenCalled();
    });

    it('returns 1.1 luck boost when bard ability is available', async () => {
      vi.spyOn(AbilityService, 'canUseAbility').mockResolvedValue({ success: true, message: '' });
      vi.spyOn(AbilityService, 'useAbility').mockResolvedValue(undefined as any);
      const result = await CasinoGameEngine.triggerBardLuckySong(makeContext('bard'), 'guild1');
      expect(result).toBe(1.1);
      expect(AbilityService.useAbility).toHaveBeenCalledOnce();
    });
  });
});
