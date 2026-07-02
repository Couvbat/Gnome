import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiceEngine } from '../src/engines/DiceEngine';
import { CasinoGameEngine } from '../src/engines/CasinoGameEngine';

const mockContext = {
  user: { userId: 'user1', guildId: 'guild1', coins: 1000 },
  character: null,
  casinoProfile: null,
  characterBonus: { className: 'none', luckBonus: 0, energyBonus: 0, specialAbility: '' },
  totalLuck: 10,
  bardBoost: 0
};

// With Math.random() = r, die = Math.floor(r * 6) + 1.
// 0.0 → 1,  0.5 → 4,  0.999 → 6
function mockDiceRoll(die1Value: number, die2Value: number): void {
  // Convert desired die face (1-6) to a Math.random value that produces it.
  const r1 = (die1Value - 1) / 6;
  const r2 = (die2Value - 1) / 6;
  const randomMock = vi.spyOn(Math, 'random');
  randomMock.mockReturnValueOnce(r1);
  randomMock.mockReturnValueOnce(r2);
  // Subsequent calls (e.g. luck reroll, bard) return a value that never triggers
  // the < 0.1 / < 0.05 thresholds (luckModifier = 1.0 anyway for no-character context).
  randomMock.mockReturnValue(0.999);
}

describe('DiceEngine', () => {
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

  describe('getDiceGameInfo', () => {
    it('returns all defined prediction types', () => {
      const { predictionTypes } = DiceEngine.getDiceGameInfo();
      const types = predictionTypes.map(p => p.type);
      expect(types).toContain('high');
      expect(types).toContain('low');
      expect(types).toContain('exact');
      expect(types).toContain('range');
    });

    it('returns character bonuses for all six classes', () => {
      const { characterBonuses } = DiceEngine.getDiceGameInfo();
      for (const cls of ['warrior', 'mage', 'rogue', 'merchant', 'bard', 'paladin']) {
        expect(characterBonuses[cls]).toBeDefined();
      }
    });
  });

  describe('rollDice', () => {
    it('throws when player has insufficient energy', async () => {
      vi.spyOn(CasinoGameEngine, 'checkEnergyAvailable').mockResolvedValue(false);
      await expect(DiceEngine.rollDice('user1', 'guild1', 100, 'high')).rejects.toThrow(
        'Insufficient energy'
      );
    });

    it('high prediction wins when total is 7 or above (2x payout)', async () => {
      mockDiceRoll(6, 6); // total = 12
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 'high');
      expect(result.isCorrect).toBe(true);
      expect(result.total).toBe(12);
      expect(result.payoutMultiplier).toBe(2);
      expect(result.outcome).toBe('win');
    });

    it('high prediction loses when total is 6 or below', async () => {
      mockDiceRoll(3, 3); // total = 6
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 'high');
      expect(result.isCorrect).toBe(false);
      expect(result.outcome).toBe('loss');
    });

    it('low prediction wins when total is 6 or below (2x payout)', async () => {
      mockDiceRoll(1, 1); // total = 2
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 'low');
      expect(result.isCorrect).toBe(true);
      expect(result.total).toBe(2);
      expect(result.payoutMultiplier).toBe(2);
      expect(result.outcome).toBe('win');
    });

    it('low prediction loses when total is 7 or above', async () => {
      mockDiceRoll(4, 4); // total = 8
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 'low');
      expect(result.isCorrect).toBe(false);
      expect(result.outcome).toBe('loss');
    });

    it('exact 7 prediction pays 5x', async () => {
      mockDiceRoll(3, 4); // total = 7
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 7);
      expect(result.isCorrect).toBe(true);
      expect(result.payoutMultiplier).toBe(5);
      expect(result.baseWinnings).toBe(500); // 100 * 5
    });

    it('snake eyes (exact 2) pays 30x', async () => {
      mockDiceRoll(1, 1); // total = 2
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 2);
      expect(result.isCorrect).toBe(true);
      expect(result.payoutMultiplier).toBe(30);
      expect(result.outcome).toBe('jackpot');
    });

    it('boxcars (exact 12) pays 30x', async () => {
      mockDiceRoll(6, 6); // total = 12
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 12);
      expect(result.isCorrect).toBe(true);
      expect(result.payoutMultiplier).toBe(30);
      expect(result.outcome).toBe('jackpot');
    });

    it('exact prediction fails when total does not match', async () => {
      mockDiceRoll(6, 6); // total = 12
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 7);
      expect(result.isCorrect).toBe(false);
      expect(result.total).toBe(12);
      expect(result.outcome).toBe('loss');
    });

    it('exposes both dice values in the result', async () => {
      mockDiceRoll(2, 5); // total = 7
      const result = await DiceEngine.rollDice('user1', 'guild1', 100, 7);
      expect(result.dice).toHaveLength(2);
      expect(result.dice[0] + result.dice[1]).toBe(result.total);
    });
  });
});
