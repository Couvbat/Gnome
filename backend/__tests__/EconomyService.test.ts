import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { EconomyService } from '../src/services/EconomyService';
import { SharedEconomy } from '../src/models/database';

// Mock database models
vi.mock('../src/models/database');

// Helper to stub a `Model.method(...).lean()` chain
function leanResolve(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe('EconomyService', () => {
  const userId = 'user-123';
  const guildId = 'guild-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCoins', () => {
    it('returns the stored coin balance', async () => {
      (SharedEconomy.findOne as Mock).mockReturnValue(leanResolve({ coins: 750 }));

      const coins = await EconomyService.getCoins(userId, guildId);

      expect(SharedEconomy.findOne).toHaveBeenCalledWith({ userId, guildId });
      expect(coins).toBe(750);
    });

    it('defaults to 100 coins when the user has no record', async () => {
      (SharedEconomy.findOne as Mock).mockReturnValue(leanResolve(null));

      const coins = await EconomyService.getCoins(userId, guildId);

      expect(coins).toBe(100);
    });
  });

  describe('addCoins', () => {
    it('atomically increments the balance and returns the new total', async () => {
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve({ coins: 600 }));

      const result = await EconomyService.addCoins(userId, guildId, 100);

      expect(SharedEconomy.findOneAndUpdate).toHaveBeenCalledWith(
        { userId, guildId },
        expect.any(Array),
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      expect(result).toBe(600);
    });

    it('supports negative amounts (used to compensate a failed transfer)', async () => {
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve({ coins: 400 }));

      const result = await EconomyService.addCoins(userId, guildId, -100);

      expect(result).toBe(400);
    });
  });

  describe('spendCoins', () => {
    it('returns true and deducts the balance when funds are sufficient', async () => {
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve({ coins: 400 }));

      const result = await EconomyService.spendCoins(userId, guildId, 100);

      expect(SharedEconomy.findOneAndUpdate).toHaveBeenCalledWith(
        { userId, guildId, coins: { $gte: 100 } },
        { $inc: { coins: -100 } },
        { new: true }
      );
      expect(result).toBe(true);
    });

    it('returns false without mutating the balance when funds are insufficient', async () => {
      // The $gte filter fails to match, so findOneAndUpdate resolves null
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve(null));

      const result = await EconomyService.spendCoins(userId, guildId, 5000);

      expect(result).toBe(false);
    });
  });

  describe('claimDaily', () => {
    it('ensures the record exists before attempting the atomic claim', async () => {
      (SharedEconomy.updateOne as Mock).mockResolvedValue({ acknowledged: true });
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve({ coins: 150 }));

      await EconomyService.claimDaily(userId, guildId, 50);

      expect(SharedEconomy.updateOne).toHaveBeenCalledWith(
        { userId, guildId },
        { $setOnInsert: { coins: 100, coinsAllTimeHigh: 100, lastDailyTimestamp: 0 } },
        { upsert: true }
      );
    });

    it('grants the reward and reports the new balance on a first-time claim', async () => {
      (SharedEconomy.updateOne as Mock).mockResolvedValue({ acknowledged: true });
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve({ coins: 150 }));

      const result = await EconomyService.claimDaily(userId, guildId, 50);

      expect(result).toEqual({ claimed: true, newBalance: 150 });
    });

    it('rejects the claim and reports hours remaining when the cooldown has not elapsed', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      (SharedEconomy.updateOne as Mock).mockResolvedValue({ acknowledged: true });
      // Atomic cooldown gate fails to match -> findOneAndUpdate resolves null
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve(null));
      // Fallback read to compute remaining time: claimed 10 hours ago
      const lastClaim = now - 10 * 60 * 60 * 1000;
      (SharedEconomy.findOne as Mock).mockReturnValue(leanResolve({ lastDailyTimestamp: lastClaim }));

      const result = await EconomyService.claimDaily(userId, guildId, 50);

      expect(result.claimed).toBe(false);
      // 24h cooldown - 10h elapsed = 14h left
      expect(result.hoursLeft).toBe(14);

      vi.restoreAllMocks();
    });

    it('never returns a negative hoursLeft value', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      (SharedEconomy.updateOne as Mock).mockResolvedValue({ acknowledged: true });
      (SharedEconomy.findOneAndUpdate as Mock).mockReturnValue(leanResolve(null));
      // Cooldown technically already elapsed by the time of the fallback read
      const lastClaim = now - 25 * 60 * 60 * 1000;
      (SharedEconomy.findOne as Mock).mockReturnValue(leanResolve({ lastDailyTimestamp: lastClaim }));

      const result = await EconomyService.claimDaily(userId, guildId, 50);

      expect(result.hoursLeft).toBe(0);

      vi.restoreAllMocks();
    });
  });
});
