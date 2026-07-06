import { CasinoProfile, Character } from '../models/database';
import { CHARACTER_CLASSES } from './CharacterService';

export interface EnergyInfo {
  current: number;
  max: number;
  regenRate: number; // Energy per minute
  lastRegen: Date;
  minutesUntilFull: number;
}

export class EnergyService {
  // Base energy regeneration: 1 energy per minute
  private static readonly BASE_REGEN_RATE = 1;
  
  // Maximum energy (can be increased by character class)
  private static readonly BASE_MAX_ENERGY = 100;

  /**
   * Get current energy info for a user
   */
  static async getEnergyInfo(userId: string, guildId: string): Promise<EnergyInfo> {
    const [casinoProfile, character] = await Promise.all([
      CasinoProfile.findOne({ userId, guildId }),
      Character.findOne({ userId, guildId })
    ]);

    // Calculate max energy based on character class and level
    let maxEnergy = this.BASE_MAX_ENERGY;
    let regenRate = this.BASE_REGEN_RATE;

    if (character) {
      const classInfo = CHARACTER_CLASSES[(character as any).class];
      if (classInfo) {
        maxEnergy += classInfo.casinoBonus.energyBonus;
        
        // Some classes regenerate energy faster
        switch ((character as any).class) {
          case 'paladin':
            regenRate = 1.5; // 50% faster regen
            break;
          case 'merchant':
            regenRate = 1.3; // 30% faster regen
            break;
          case 'warrior':
            regenRate = 1.2; // 20% faster regen
            break;
          default:
            regenRate = this.BASE_REGEN_RATE;
        }
      }
      
      // Add level bonus: +5 max energy per level (starting from level 2)
      const levelBonus = ((character as any).level - 1) * 5;
      maxEnergy += levelBonus;
    }

    // Get current energy (with regeneration calculation)
    const currentEnergy = await this.regenerateEnergy(userId, guildId, maxEnergy, regenRate);
    const lastRegen = (casinoProfile as any)?.lastEnergyRegen || new Date();
    
    const minutesUntilFull = currentEnergy >= maxEnergy ? 0 : 
      Math.ceil((maxEnergy - currentEnergy) / regenRate);

    return {
      current: currentEnergy,
      max: maxEnergy,
      regenRate,
      lastRegen,
      minutesUntilFull
    };
  }

  /**
   * Regenerate energy based on time passed
   */
  static async regenerateEnergy(
    userId: string,
    guildId: string,
    maxEnergy: number,
    regenRate: number
  ): Promise<number> {
    let casinoProfile = await CasinoProfile.findOne({ userId, guildId });
    let createdHere = false;

    // Create profile if it doesn't exist
    if (!casinoProfile) {
      createdHere = true;
      // Get character to link to casino profile (optional - can play without character)
      const character = await Character.findOne({ userId, guildId });
      
      casinoProfile = new CasinoProfile({
        userId,
        guildId,
        characterId: character?._id || null,
        reputation: 0,
        reputationLevel: 'novice',
        stats: {
          totalWagered: 0,
          totalWon: 0,
          totalLost: 0,
          biggestWin: 0,
          biggestLoss: 0,
          sessionsPlayed: 0,
          favoriteGame: 'blackjack'
        },
        casinoSkills: {
          luckMastery: 0,
          riskAssessment: 0,
          socialGaming: 0,
          cardCounting: 0
        },
        dailyLossLimit: 5000,
        currentDailyLoss: 0,
        lastDailyReset: new Date(),
        cooldowns: {
          classAbility: null,
          luckyCharm: null,
          blessingUsed: null
        },
        achievements: [],
        titles: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const now = new Date();
    // Raw field values as read, before any defaulting - the CAS guard below
    // must match exactly what is stored (null matches a missing field).
    const rawEnergy = (casinoProfile as any).energy;
    const rawLastRegen = (casinoProfile as any).lastEnergyRegen;
    const lastRegen = rawLastRegen || now;
    const currentEnergy = rawEnergy ?? maxEnergy;

    // Calculate energy regenerated since last check
    const minutesPassed = Math.floor((now.getTime() - lastRegen.getTime()) / 60000);
    const energyRegenerated = minutesPassed * regenRate;

    const newEnergy = Math.min(maxEnergy, currentEnergy + energyRegenerated);

    (casinoProfile as any).energy = newEnergy;
    (casinoProfile as any).maxEnergy = maxEnergy;
    (casinoProfile as any).lastEnergyRegen = now;

    if (createdHere) {
      await casinoProfile.save();
    } else {
      // Compare-and-swap on the values we read: if a concurrent writer (a bet
      // deducting energy, another regen tick) touched the profile since, skip
      // the write instead of clobbering their update with our stale snapshot.
      await CasinoProfile.updateOne(
        {
          userId,
          guildId,
          energy: rawEnergy === undefined ? null : rawEnergy,
          lastEnergyRegen: rawLastRegen === undefined ? null : rawLastRegen
        },
        { $set: { energy: newEnergy, maxEnergy, lastEnergyRegen: now } }
      );
    }

    return newEnergy;
  }

  /**
   * Consume energy for an action
   */
  static async consumeEnergy(
    userId: string,
    guildId: string,
    amount: number
  ): Promise<{ success: boolean; currentEnergy: number; maxEnergy: number }> {
    // getEnergyInfo also applies pending regeneration before we try to spend
    const energyInfo = await this.getEnergyInfo(userId, guildId);

    if (energyInfo.current < amount) {
      return {
        success: false,
        currentEnergy: energyInfo.current,
        maxEnergy: energyInfo.max
      };
    }

    // Atomic conditional decrement (same pattern as EconomyService.spendCoins):
    // the { energy: { $gte: amount } } filter makes the spend apply only while
    // the balance is still sufficient, closing the check-then-save race.
    const result = await CasinoProfile.updateOne(
      { userId, guildId, energy: { $gte: amount } },
      { $inc: { energy: -amount } }
    );

    if (!result || result.modifiedCount === 0) {
      return {
        success: false,
        currentEnergy: energyInfo.current,
        maxEnergy: energyInfo.max
      };
    }

    return {
      success: true,
      currentEnergy: energyInfo.current - amount,
      maxEnergy: energyInfo.max
    };
  }

  /**
   * Restore energy (for daily bonuses, special events, etc.)
   */
  static async restoreEnergy(
    userId: string,
    guildId: string,
    amount: number
  ): Promise<{ currentEnergy: number; maxEnergy: number }> {
    const energyInfo = await this.getEnergyInfo(userId, guildId);
    const newEnergy = Math.min(energyInfo.max, energyInfo.current + amount);

    // Atomic increment clamped to max via an aggregation-pipeline update, so a
    // concurrent deduction between our read and this write isn't overwritten.
    await CasinoProfile.updateOne(
      { userId, guildId },
      [
        {
          $set: {
            energy: {
              $min: [
                energyInfo.max,
                { $add: [{ $ifNull: ['$energy', energyInfo.max] }, amount] }
              ]
            }
          }
        }
      ]
    );

    return {
      currentEnergy: newEnergy,
      maxEnergy: energyInfo.max
    };
  }

  /**
   * Get energy cost for a game action
   */
  static calculateEnergyCost(gameType: string, bet: number): number {
    const baseCosts: { [key: string]: number } = {
      blackjack: 2, // Most complex game
      roulette: 1,
      slots: 1,
      dice: 1
    };

    const baseCost = baseCosts[gameType] || 1;
    const betScaling = Math.floor(bet / 100); // 1 energy per 100 coins
    
    return Math.max(baseCost, baseCost + betScaling);
  }

  /**
   * Check if user has enough energy for an action
   */
  static async hasEnoughEnergy(
    userId: string,
    guildId: string,
    requiredEnergy: number
  ): Promise<boolean> {
    const energyInfo = await this.getEnergyInfo(userId, guildId);
    return energyInfo.current >= requiredEnergy;
  }
}
