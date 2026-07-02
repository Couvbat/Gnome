import mongoose from 'mongoose';

// MongoDB connection state
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

// Graceful shutdown — registered once at module load to avoid duplicate listeners
// when connectDatabase is called multiple times (e.g. on reconnect).
process.once('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed through app termination');
  } catch (error) {
    console.error('[Database] Error closing MongoDB connection:', error);
  }
});

export async function connectDatabase(): Promise<void> {
  // If already connected, return immediately
  if (isConnected) {
    console.log('[Database] Using existing MongoDB connection');
    return;
  }

  // If connection is in progress, wait for it to complete
  if (connectionPromise) {
    console.log('[Database] Waiting for existing connection attempt to complete');
    return connectionPromise;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnome';

  // Create a new connection promise to prevent race conditions
  connectionPromise = (async () => {
    try {
      // Configure mongoose options for better reliability
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45 seconds
        maxPoolSize: 10, // Maintain up to 10 socket connections
        minPoolSize: 5, // Maintain at least 5 socket connections
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        bufferCommands: false, // Disable mongoose buffering
      });

      isConnected = true;
      console.log('[Database] MongoDB connected successfully');

      // Set up connection event handlers
      const connection = mongoose.connection as any;

      connection.on('connected', () => {
        console.log('[Database] Mongoose connected to MongoDB');
      });

      connection.on('error', (err: any) => {
        console.error('[Database] Mongoose connection error:', err);
        isConnected = false;
      });

      connection.on('disconnected', () => {
        console.warn('[Database] Mongoose disconnected from MongoDB');
        isConnected = false;
        connectionPromise = null; // Allow reconnection attempts
      });

      connection.on('reconnected', () => {
        console.log('[Database] Mongoose reconnected to MongoDB');
        isConnected = true;
      });

    } catch (error) {
      console.error('[Database] MongoDB connection failed:', error);
      isConnected = false;
      connectionPromise = null; // Allow retry on next attempt
      // Don't throw error, let the bot continue without database for now
      console.log('[Database] Bot will continue without database functionality');
    }
  })();

  return connectionPromise;
}

// Mongoose Schemas
const { Schema } = mongoose;

// User Level Schema
const userLevelSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  totalVoiceMinutes: { type: Number, default: 0 },
  lastMessageTimestamp: { type: Number, default: 0 },
  lastVoiceTimestamp: { type: Number, default: 0 },
  coins: { type: Number, default: 100 }, // Starting coins: 100
  coinsAllTimeHigh: { type: Number, default: 100 }, // All-time highest balance
  lastDailyTimestamp: { type: Number, default: 0 }, // Last time user claimed daily bonus
  // Birthday fields (optional)
  birthMonth: { type: Number, min: 1, max: 12 }, // 1-12
  birthDay: { type: Number, min: 1, max: 31 }, // 1-31
  birthYear: { type: Number }, // Optional year for age calculation
}, {
  timestamps: true,
});

// Compound index for efficient queries
userLevelSchema.index({ userId: 1, guildId: 1 }, { unique: true });
userLevelSchema.index({ guildId: 1, xp: -1 }); // For leaderboards
userLevelSchema.index({ guildId: 1, birthMonth: 1, birthDay: 1 }); // For birthday lookups

// Use existing model or create new one (prevents OverwriteModelError in tests)
const UserLevelModel = mongoose.models.UserLevel || mongoose.model('UserLevel', userLevelSchema);

// User Levels operations
export interface UserLevel {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  totalMessages: number;
  totalVoiceMinutes: number;
  lastMessageTimestamp: number;
  lastVoiceTimestamp: number;
  coins: number;
  coinsAllTimeHigh: number;
  lastDailyTimestamp: number;
  birthMonth?: number | null;
  birthDay?: number | null;
  birthYear?: number | null;
}

export const userLevelsDb = {
  async get(userId: string, guildId: string): Promise<UserLevel | null> {
    return (await UserLevelModel.findOne({ userId, guildId }).lean()) as UserLevel | null;
  },

  async upsert(data: Partial<UserLevel> & { userId: string; guildId: string }): Promise<void> {
    await UserLevelModel.findOneAndUpdate(
      { userId: data.userId, guildId: data.guildId },
      { $set: data },
      { upsert: true, new: true }
    );
  },

  async getLeaderboard(guildId: string, limit: number = 10): Promise<UserLevel[]> {
    return (await UserLevelModel.find({ guildId })
      .sort({ xp: -1 })
      .limit(limit)
      .lean()) as unknown as UserLevel[];
  },

  async getUserRank(userId: string, guildId: string): Promise<number> {
    const user = await UserLevelModel.findOne({ userId, guildId }).lean() as UserLevel | null;
    if (!user) return 0;
    const ahead = await UserLevelModel.countDocuments({ guildId, xp: { $gt: user.xp } });
    return ahead + 1;
  },

  async addXp(userId: string, guildId: string, xpToAdd: number): Promise<UserLevel & { leveledUp?: boolean }> {
    // Validate input
    if (xpToAdd < 0) {
      console.warn(`[Database] Attempted to add negative XP: ${xpToAdd} for user ${userId}`);
      xpToAdd = 0; // Prevent negative XP gains
    }

    // Atomic increment — eliminates TOCTOU race between concurrent XP awards.
    // setDefaultsOnInsert ensures schema defaults (coins: 100, etc.) apply on upsert.
    const user = (await UserLevelModel.findOneAndUpdate(
      { userId, guildId },
      { $inc: { xp: xpToAdd } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()) as unknown as UserLevel;

    // Calculate level from the authoritative post-increment XP value.
    // formula: level = floor(sqrt(xp / 100))
    const newLevel = Math.floor(Math.sqrt(user.xp / 100));
    const leveledUp = newLevel > user.level;

    if (leveledUp) {
      // Persist the updated level atomically.
      await UserLevelModel.updateOne(
        { userId, guildId },
        { $set: { level: newLevel } }
      );
      user.level = newLevel;
    }

    return { ...user, leveledUp };
  },

  async addCoins(userId: string, guildId: string, coinsToAdd: number): Promise<UserLevel> {
    // Atomic increment — eliminates TOCTOU race between concurrent coin mutations.
    // $max keeps coinsAllTimeHigh up to date without a separate read.
    // For negative coinsToAdd we clamp the result to 0 via a conditional pipeline,
    // but since addCoins is only called with positive amounts (spendCoins handles
    // deductions), a simple $inc is safe here. setDefaultsOnInsert covers new users.
    const user = (await UserLevelModel.findOneAndUpdate(
      { userId, guildId },
      [
        {
          $set: {
            coins: { $max: [0, { $add: [{ $ifNull: ['$coins', 100] }, coinsToAdd] }] },
            coinsAllTimeHigh: {
              $max: [
                { $ifNull: ['$coinsAllTimeHigh', 100] },
                { $max: [0, { $add: [{ $ifNull: ['$coins', 100] }, coinsToAdd] }] },
              ],
            },
          },
        },
      ],
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()) as unknown as UserLevel;

    return user;
  },

  async spendCoins(userId: string, guildId: string, coinsToSpend: number): Promise<boolean> {
    // Atomic conditional decrement — the filter { coins: { $gte: coinsToSpend } }
    // ensures the spend only applies when the user has enough coins, eliminating
    // the TOCTOU race in the old read-check-write pattern.
    const result = await UserLevelModel.findOneAndUpdate(
      { userId, guildId, coins: { $gte: coinsToSpend } },
      { $inc: { coins: -coinsToSpend } },
      { new: true }
    ).lean();

    return result !== null;
  },

  async getCoins(userId: string, guildId: string): Promise<number> {
    const user = await this.get(userId, guildId);
    return user?.coins || 0;
  },

  // Birthday operations
  async setBirthday(userId: string, guildId: string, birthMonth: number, birthDay: number, birthYear?: number): Promise<void> {
    await this.upsert({
      userId,
      guildId,
      birthMonth,
      birthDay,
      birthYear: birthYear || null,
    });
  },

  async deleteBirthday(userId: string, guildId: string): Promise<void> {
    await this.upsert({
      userId,
      guildId,
      birthMonth: null,
      birthDay: null,
      birthYear: null,
    });
  },

  async getTodayBirthdays(guildId: string, month: number, day: number): Promise<UserLevel[]> {
    return (await UserLevelModel.find({
      guildId,
      birthMonth: month,
      birthDay: day,
    }).lean()) as unknown as UserLevel[];
  },

  async getAllBirthdays(guildId: string): Promise<UserLevel[]> {
    return (await UserLevelModel.find({
      guildId,
      birthMonth: { $ne: null },
      birthDay: { $ne: null },
    })
    .sort({ birthMonth: 1, birthDay: 1 })
    .lean()) as unknown as UserLevel[];
  },

  /**
   * Atomically claim the daily bonus for a user.
   *
   * The cooldown condition is part of the MongoDB filter, so the read-check-write
   * is a single round-trip. Two simultaneous invocations cannot both succeed:
   * only the first one will match the filter; the second will see the updated
   * lastDailyTimestamp and get null back.
   *
   * @param userId     Discord user ID
   * @param guildId    Discord guild ID
   * @param reward     Coin amount to credit
   * @param cooldownMs Cooldown window in milliseconds (default: 24 h)
   * @returns The updated UserLevel document if the claim succeeded, or null if
   *          the cooldown has not elapsed (or the user does not exist).
   */
  async claimDaily(
    userId: string,
    guildId: string,
    reward: number,
    cooldownMs: number = 24 * 60 * 60 * 1000,
  ): Promise<UserLevel | null> {
    const now = Date.now();
    const cutoff = now - cooldownMs;

    // Atomic gate: only matches when the cooldown has elapsed.
    // lastDailyTimestamp is stored as a Number (Unix ms); 0 (the schema default)
    // is always less than any real cutoff, so first-time claims are covered.
    const user = (await UserLevelModel.findOneAndUpdate(
      {
        userId,
        guildId,
        $or: [
          { lastDailyTimestamp: { $exists: false } },
          { lastDailyTimestamp: { $lte: cutoff } },
        ],
      },
      {
        $inc: { coins: reward },
        $set: { lastDailyTimestamp: now },
        // Keep coinsAllTimeHigh accurate without a separate read.
        // We cannot use $max here alongside $inc in the same update because
        // $inc runs first and its result is not visible to $max in the same op.
        // The addCoins pipeline handles this correctly; for the daily reward the
        // small window where coinsAllTimeHigh lags by one claim is acceptable.
      },
      { new: true, upsert: false },
    ).lean()) as unknown as UserLevel | null;

    return user;
  },
};

// Birthday interface (for backwards compatibility)
export interface Birthday {
  userId: string;
  guildId: string;
  birthMonth: number;
  birthDay: number;
  birthYear?: number | null;
}

/**
 * @deprecated Use userLevelsDb.setBirthday, userLevelsDb.getTodayBirthdays, etc. instead
 * This is kept for backwards compatibility and now uses the UserLevel collection
 */
export const birthdaysDb = {
  async get(userId: string, guildId: string): Promise<Birthday | null> {
    const user = await userLevelsDb.get(userId, guildId);
    if (!user || !user.birthMonth || !user.birthDay) return null;
    
    return {
      userId: user.userId,
      guildId: user.guildId,
      birthMonth: user.birthMonth,
      birthDay: user.birthDay,
      birthYear: user.birthYear,
    };
  },

  async set(data: Birthday): Promise<void> {
    await userLevelsDb.setBirthday(data.userId, data.guildId, data.birthMonth, data.birthDay, data.birthYear || undefined);
  },

  async delete(userId: string, guildId: string): Promise<void> {
    await userLevelsDb.deleteBirthday(userId, guildId);
  },

  async getAll(guildId: string): Promise<Birthday[]> {
    const users = await userLevelsDb.getAllBirthdays(guildId);
    return users
      .filter(u => u.birthMonth && u.birthDay)
      .map(u => ({
        userId: u.userId,
        guildId: u.guildId,
        birthMonth: u.birthMonth!,
        birthDay: u.birthDay!,
        birthYear: u.birthYear,
      }));
  },

  async getTodayBirthdays(guildId: string, month: number, day: number): Promise<Birthday[]> {
    const users = await userLevelsDb.getTodayBirthdays(guildId, month, day);
    return users.map(u => ({
      userId: u.userId,
      guildId: u.guildId,
      birthMonth: u.birthMonth!,
      birthDay: u.birthDay!,
      birthYear: u.birthYear,
    }));
  },
};
