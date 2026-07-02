import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RouletteEngine } from '../src/engines/RouletteEngine';
import { CasinoGameEngine } from '../src/engines/CasinoGameEngine';

const mockContext = {
  user: { userId: 'user1', guildId: 'guild1', coins: 1000 },
  character: null,
  casinoProfile: null,
  characterBonus: { className: 'none', luckBonus: 0, energyBonus: 0, specialAbility: '' },
  totalLuck: 10,
  bardBoost: 0
};

// European wheel: number = Math.floor(Math.random() * 37), range 0-36.
// Using r = winningNumber / 37 produces Math.floor(r * 37) = winningNumber reliably.
function mockWheelSpin(winningNumber: number): void {
  const r = winningNumber / 37;
  vi.spyOn(Math, 'random').mockReturnValue(r);
}

describe('RouletteEngine', () => {
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

  describe('createRouletteTable', () => {
    it('creates a table with correct initial state', () => {
      const table = RouletteEngine.createRouletteTable('t1');
      expect(table.id).toBe('t1');
      expect(table.gamePhase).toBe('betting');
      expect(table.spinTimer).toBe(30);
      expect(table.currentSpin).toBeNull();
      expect(table.communityJackpot).toBe(0);
      expect(table.players.size).toBe(0);
    });

    it('accepts custom min and max bet values', () => {
      const table = RouletteEngine.createRouletteTable('t2', 10, 500);
      // Table structure is returned correctly regardless of bet limits
      expect(table.id).toBe('t2');
    });
  });

  describe('addPlayerToTable', () => {
    it('adds a new player', () => {
      const table = RouletteEngine.createRouletteTable('t1');
      RouletteEngine.addPlayerToTable(table, 'user1', 'mage');
      expect(table.players.has('user1')).toBe(true);
      expect(table.players.get('user1')?.characterClass).toBe('mage');
    });

    it('does not duplicate a player already at the table', () => {
      const table = RouletteEngine.createRouletteTable('t1');
      RouletteEngine.addPlayerToTable(table, 'user1', 'warrior');
      RouletteEngine.addPlayerToTable(table, 'user1', 'mage'); // re-join with different class
      expect(table.players.size).toBe(1);
      // Original class is preserved on re-join
      expect(table.players.get('user1')?.characterClass).toBe('warrior');
    });
  });

  describe('getRouletteGameInfo', () => {
    it('returns all bet types with payout multipliers', () => {
      const { betTypes } = RouletteEngine.getRouletteGameInfo();
      expect(betTypes.straight.payout).toBe(35);
      expect(betTypes.red.payout).toBe(1);
      expect(betTypes.dozen.payout).toBe(2);
    });

    it('returns a payout chart with odds', () => {
      const { payoutChart } = RouletteEngine.getRouletteGameInfo();
      expect(Object.keys(payoutChart).length).toBeGreaterThan(0);
    });

    it('returns character bonuses for all six classes', () => {
      const { characterBonuses } = RouletteEngine.getRouletteGameInfo();
      for (const cls of ['warrior', 'mage', 'rogue', 'merchant', 'bard', 'paladin']) {
        expect(characterBonuses[cls]).toBeDefined();
      }
    });
  });

  describe('playSinglePlayerRoulette', () => {
    it('throws when player has insufficient energy', async () => {
      vi.spyOn(CasinoGameEngine, 'checkEnergyAvailable').mockResolvedValue(false);
      await expect(
        RouletteEngine.playSinglePlayerRoulette('user1', 'guild1', [{ type: 'red', amount: 100 }])
      ).rejects.toThrow('Insufficient energy');
    });

    it('red bet wins when wheel lands on a red number', async () => {
      // 36 is in the RED_NUMBERS array
      mockWheelSpin(36);
      const result = await RouletteEngine.playSinglePlayerRoulette('user1', 'guild1', [
        { type: 'red', amount: 100 }
      ]);
      expect(result.winningColor).toBe('red');
      expect(result.winningBets).toHaveLength(1);
      expect(result.outcome).toBe('win');
      // payout: 100 * (1 + 1) = 200
      expect(result.baseWinnings).toBe(200);
    });

    it('red bet loses when wheel lands on green (0)', async () => {
      mockWheelSpin(0);
      const result = await RouletteEngine.playSinglePlayerRoulette('user1', 'guild1', [
        { type: 'red', amount: 100 }
      ]);
      expect(result.winningNumber).toBe(0);
      expect(result.winningColor).toBe('green');
      expect(result.winningBets).toHaveLength(0);
      expect(result.outcome).toBe('loss');
    });

    it('straight bet wins on exact number match (35:1 payout → jackpot)', async () => {
      mockWheelSpin(36);
      const result = await RouletteEngine.playSinglePlayerRoulette('user1', 'guild1', [
        { type: 'straight', amount: 10, value: 36 }
      ]);
      expect(result.winningBets).toHaveLength(1);
      // payout: 10 * (35 + 1) = 360; 360 >= 10 * 10 = 100 → jackpot
      expect(result.outcome).toBe('jackpot');
      expect(result.baseWinnings).toBe(360);
    });

    it('straight bet loses when wheel lands on a different number', async () => {
      mockWheelSpin(0); // lands on 0, bet is on 36
      const result = await RouletteEngine.playSinglePlayerRoulette('user1', 'guild1', [
        { type: 'straight', amount: 10, value: 36 }
      ]);
      expect(result.winningBets).toHaveLength(0);
      expect(result.outcome).toBe('loss');
    });

    it('throws on straight bet with number out of range', async () => {
      await expect(
        RouletteEngine.playSinglePlayerRoulette('user1', 'guild1', [
          { type: 'straight', amount: 10, value: 37 }
        ])
      ).rejects.toThrow('Invalid straight bet number');
    });

    it('reports the winning number and color in the result', async () => {
      mockWheelSpin(1); // 1 is red
      const result = await RouletteEngine.playSinglePlayerRoulette('user1', 'guild1', [
        { type: 'black', amount: 50 }
      ]);
      expect(result.winningNumber).toBe(1);
      expect(result.winningColor).toBe('red');
    });
  });
});
