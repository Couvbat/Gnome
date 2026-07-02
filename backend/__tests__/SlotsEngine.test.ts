import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlotsEngine } from '../src/engines/SlotsEngine';
import { CasinoGameEngine } from '../src/engines/CasinoGameEngine';

const mockContext = {
  user: { userId: 'user1', guildId: 'guild1', coins: 1000 },
  character: null,
  casinoProfile: null,
  characterBonus: { className: 'none', luckBonus: 0, energyBonus: 0, specialAbility: '' },
  totalLuck: 10,
  bardBoost: 0
};

// Classic symbol weights (luckModifier=1.0):
//   cherry(8)→w2  lemon(7)→w3  orange(6)→w4  grape(5)→w5
//   bell(4)→w6  diamond(2)→w8  star(1)→w9  seven(1)→w9  total=46
//
// randomIndex = Math.floor(Math.random() * 46)
//   r=0.0    → index 0  → cherry
//   r=0.0435 → index 2  → lemon
//   r=0.109  → index 5  → orange
//   r=0.999  → index 45 → seven  (rarity=1 → jackpot on triple)
function mockReels(...randomValues: number[]): void {
  const mock = vi.spyOn(Math, 'random');
  randomValues.forEach(v => mock.mockReturnValueOnce(v));
  mock.mockReturnValue(0.5); // safe fallback
}

describe('SlotsEngine', () => {
  beforeEach(() => {
    vi.spyOn(CasinoGameEngine, 'getPlayerContext').mockResolvedValue(mockContext);
    vi.spyOn(CasinoGameEngine, 'checkEnergyAvailable').mockResolvedValue(true);
    vi.spyOn(CasinoGameEngine, 'processGameResult').mockImplementation(
      async (_uid, _gid, _type, _bet, result) => result as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSlotsGameInfo', () => {
    it('returns all four available themes', () => {
      const { themes } = SlotsEngine.getSlotsGameInfo();
      expect(themes).toContain('classic');
      expect(themes).toContain('dragon');
      expect(themes).toContain('magic');
      expect(themes).toContain('warrior');
    });

    it('returns character bonuses for all six classes', () => {
      const { characterBonuses } = SlotsEngine.getSlotsGameInfo();
      for (const cls of ['warrior', 'mage', 'rogue', 'merchant', 'bard', 'paladin']) {
        expect(characterBonuses[cls]).toBeDefined();
      }
    });
  });

  describe('getSlotMachineInfo', () => {
    it('returns dragon theme symbols for dragon machine', () => {
      const info = SlotsEngine.getSlotMachineInfo('dragon');
      expect(info.theme).toBe('dragon');
      expect(info.symbols.some(s => s.symbol === 'dragon')).toBe(true);
    });

    it('falls back to classic symbols for an unknown theme', () => {
      const info = SlotsEngine.getSlotMachineInfo('unknown');
      expect(info.symbols.some(s => s.symbol === 'cherry')).toBe(true);
    });
  });

  describe('spin win analysis', () => {
    it('throws when player has insufficient energy', async () => {
      vi.spyOn(CasinoGameEngine, 'checkEnergyAvailable').mockResolvedValue(false);
      await expect(
        SlotsEngine.spin('user1', 'guild1', 100, 'm1')
      ).rejects.toThrow('Insufficient energy');
    });

    it('three of a kind on rarest symbol → jackpot win type', async () => {
      // r=0.999 for all 3 reels → index 45 → seven (rarity=1)
      mockReels(0.999, 0.999, 0.999);
      const result = await SlotsEngine.spin('user1', 'guild1', 100, 'm1');
      expect(result.winType).toBe('jackpot');
      expect(result.outcome).toBe('jackpot');
      expect(result.baseWinnings).toBeGreaterThan(0);
    });

    it('three of a kind on common symbol → three_of_kind win type', async () => {
      // r=0.0 for all 3 reels → index 0 → cherry (rarity=8, not ≤1)
      mockReels(0.0, 0.0, 0.0);
      const result = await SlotsEngine.spin('user1', 'guild1', 100, 'm1');
      expect(result.winType).toBe('three_of_kind');
      expect(result.outcome).toBe('win');
    });

    it('two matching symbols → pair win type', async () => {
      // reel0=cherry, reel1=cherry, reel2=seven
      mockReels(0.0, 0.0, 0.999);
      const result = await SlotsEngine.spin('user1', 'guild1', 100, 'm1');
      expect(result.winType).toBe('pair');
      expect(result.outcome).toBe('win');
    });

    it('no match → none win type with zero payout', async () => {
      // cherry(r=0.0), lemon(r=0.0435+), orange(r=0.109)
      mockReels(0.0, 0.05, 0.12);
      const result = await SlotsEngine.spin('user1', 'guild1', 100, 'm1');
      expect(result.winType).toBe('none');
      expect(result.outcome).toBe('loss');
      expect(result.finalPayout).toBe(0);
    });

    it('result includes reel emojis matching the spin', async () => {
      mockReels(0.0, 0.0, 0.0); // three cherries
      const result = await SlotsEngine.spin('user1', 'guild1', 100, 'm1');
      expect(result.reels).toHaveLength(3);
      expect(result.reels.every(r => r === '🍒')).toBe(true);
    });

    it('uses the requested machine theme', async () => {
      mockReels(0.0, 0.0, 0.0);
      const result = await SlotsEngine.spin('user1', 'guild1', 100, 'm1', 'dragon');
      expect(result.machineType).toBe('dragon');
    });
  });
});
