import { SharedEconomy } from '../models/database';

export class EconomyService {
  static async getCoins(userId: string, guildId: string): Promise<number> {
    const doc = await SharedEconomy.findOne({ userId, guildId }).lean();
    return (doc as any)?.coins ?? 100;
  }

  /**
   * Atomic increment (mirrors bot's userLevelsDb.addCoins) - avoids a
   * read-modify-write race, and avoids overwriting bot-only fields on this
   * shared document via a whole-document save.
   */
  static async addCoins(userId: string, guildId: string, amount: number): Promise<number> {
    const doc = await SharedEconomy.findOneAndUpdate(
      { userId, guildId },
      [
        {
          $set: {
            coins: { $max: [0, { $add: [{ $ifNull: ['$coins', 100] }, amount] }] },
            coinsAllTimeHigh: {
              $max: [
                { $ifNull: ['$coinsAllTimeHigh', 100] },
                { $max: [0, { $add: [{ $ifNull: ['$coins', 100] }, amount] }] }
              ]
            }
          }
        }
      ],
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return (doc as any).coins;
  }

  /**
   * Atomic conditional decrement (mirrors bot's userLevelsDb.spendCoins) - the
   * { coins: { $gte: amount } } filter makes the spend only apply when the
   * balance is sufficient, eliminating the TOCTOU race of a separate check.
   */
  static async spendCoins(userId: string, guildId: string, amount: number): Promise<boolean> {
    const result = await SharedEconomy.findOneAndUpdate(
      { userId, guildId, coins: { $gte: amount } },
      { $inc: { coins: -amount } },
      { new: true }
    ).lean();

    return result !== null;
  }

  /**
   * Atomic daily-bonus claim (mirrors bot's userLevelsDb.claimDaily). Ensures the
   * record exists first so a user's very first claim - via the Activity, before
   * ever touching the bot - isn't mistaken for "cooldown still active".
   */
  static async claimDaily(
    userId: string,
    guildId: string,
    reward: number,
    cooldownMs: number = 24 * 60 * 60 * 1000
  ): Promise<{ claimed: boolean; newBalance?: number; hoursLeft?: number }> {
    await SharedEconomy.updateOne(
      { userId, guildId },
      { $setOnInsert: { coins: 100, coinsAllTimeHigh: 100, lastDailyTimestamp: 0 } },
      { upsert: true }
    );

    const now = Date.now();
    const cutoff = now - cooldownMs;
    const doc = await SharedEconomy.findOneAndUpdate(
      {
        userId,
        guildId,
        $or: [
          { lastDailyTimestamp: { $exists: false } },
          { lastDailyTimestamp: { $lte: cutoff } }
        ]
      },
      { $inc: { coins: reward }, $set: { lastDailyTimestamp: now } },
      { new: true, upsert: false }
    ).lean();

    if (doc) {
      return { claimed: true, newBalance: (doc as any).coins };
    }

    const existing = await SharedEconomy.findOne({ userId, guildId }).lean();
    const lastClaim = (existing as any)?.lastDailyTimestamp || 0;
    const hoursLeft = Math.max(0, Math.ceil((lastClaim + cooldownMs - now) / (1000 * 60 * 60)));
    return { claimed: false, hoursLeft };
  }
}
