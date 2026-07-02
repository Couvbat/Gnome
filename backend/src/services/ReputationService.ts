import { CasinoProfile } from '../models/database';

export type ReputationTier = 'novice' | 'amateur' | 'seasoned' | 'professional' | 'high_roller' | 'legend' | 'mythic';

export interface ReputationInfo {
  current: number;
  tier: ReputationTier;
  nextTier: ReputationTier | null;
  pointsToNextTier: number;
  perks: string[];
}

export interface ReputationGain {
  base: number;
  multipliers: { source: string; value: number }[];
  total: number;
}

export class ReputationService {
  // Reputation thresholds for each tier
  private static readonly REPUTATION_TIERS: { tier: ReputationTier; minPoints: number; perks: string[] }[] = [
    {
      tier: 'novice',
      minPoints: 0,
      perks: ['Access to basic casino games', 'Standard energy regeneration']
    },
    {
      tier: 'amateur',
      minPoints: 100,
      perks: ['5% discount on buy-ins', '+5 max energy', 'Daily bonus increased by 10%']
    },
    {
      tier: 'seasoned',
      minPoints: 500,
      perks: ['10% discount on buy-ins', '+10 max energy', 'Daily bonus increased by 25%', 'Access to VIP tables']
    },
    {
      tier: 'professional',
      minPoints: 1500,
      perks: ['15% discount on buy-ins', '+20 max energy', 'Daily bonus increased by 50%', 'Priority seating', 'Exclusive tournaments']
    },
    {
      tier: 'high_roller',
      minPoints: 5000,
      perks: ['20% discount on buy-ins', '+30 max energy', 'Daily bonus doubled', 'Private tables', 'Jackpot multiplier +10%']
    },
    {
      tier: 'legend',
      minPoints: 15000,
      perks: ['25% discount on buy-ins', '+50 max energy', 'Daily bonus tripled', 'Legendary status icon', 'Special abilities unlocked']
    },
    {
      tier: 'mythic',
      minPoints: 50000,
      perks: ['30% discount on buy-ins', '+100 max energy', 'Daily bonus x5', 'Mythic status', 'All abilities enhanced', 'Personal dealer']
    }
  ];

  /**
   * Get current reputation info for a user
   */
  static async getReputationInfo(userId: string, guildId: string): Promise<ReputationInfo> {
    const casinoProfile = await CasinoProfile.findOne({ userId, guildId });
    const currentRep = casinoProfile?.reputation || 0;

    const currentTierInfo = this.getTierInfo(currentRep);
    const nextTierInfo = this.getNextTier(currentRep);

    return {
      current: currentRep,
      tier: currentTierInfo.tier,
      nextTier: nextTierInfo?.tier || null,
      pointsToNextTier: nextTierInfo ? nextTierInfo.minPoints - currentRep : 0,
      perks: currentTierInfo.perks
    };
  }

  /**
   * Award reputation points based on game activity
   */
  static async awardReputation(
    userId: string,
    guildId: string,
    gameType: string,
    bet: number,
    outcome: 'win' | 'loss' | 'push' | 'jackpot',
    characterLevel: number = 1
  ): Promise<{ gained: number; newTotal: number; tierChanged: boolean; newTier?: ReputationTier }> {
    const casinoProfile = await CasinoProfile.findOne({ userId, guildId });
    if (!casinoProfile) {
      throw new Error('Casino profile not found');
    }

    const oldRep = casinoProfile.reputation;
    const oldTier = this.getTierInfo(oldRep).tier;

    // Calculate reputation gain
    const repGain = this.calculateReputationGain(gameType, bet, outcome, characterLevel);

    // Update reputation
    const newRep = oldRep + repGain.total;
    casinoProfile.reputation = newRep;

    // Update reputation level
    (casinoProfile as any).reputationLevel = this.getTierInfo(newRep).tier;

    await casinoProfile.save();

    const newTier = this.getTierInfo(newRep).tier;
    const tierChanged = oldTier !== newTier;

    return {
      gained: repGain.total,
      newTotal: newRep,
      tierChanged,
      newTier: tierChanged ? newTier : undefined
    };
  }

  /**
   * Calculate reputation gain for a game
   */
  private static calculateReputationGain(
    gameType: string,
    bet: number,
    outcome: 'win' | 'loss' | 'push' | 'jackpot',
    characterLevel: number
  ): ReputationGain {
    // Base reputation: 1 point per 10 coins wagered
    const base = Math.floor(bet / 10);

    const multipliers: { source: string; value: number }[] = [];

    // Outcome multiplier
    switch (outcome) {
      case 'jackpot':
        multipliers.push({ source: 'Jackpot Win', value: 3.0 });
        break;
      case 'win':
        multipliers.push({ source: 'Win', value: 1.5 });
        break;
      case 'loss':
        multipliers.push({ source: 'Play', value: 1.0 });
        break;
      case 'push':
        multipliers.push({ source: 'Push', value: 0.5 });
        break;
    }

    // Game type multiplier (harder games = more reputation)
    const gameMultipliers: { [key: string]: number } = {
      blackjack: 1.2,
      roulette: 1.0,
      slots: 0.8,
      dice: 1.0
    };
    
    if (gameMultipliers[gameType]) {
      multipliers.push({ source: `${gameType} Complexity`, value: gameMultipliers[gameType] });
    }

    // High bet bonus (bets over 100 coins)
    if (bet >= 100) {
      multipliers.push({ source: 'High Stakes', value: 1.2 });
    }
    if (bet >= 500) {
      multipliers.push({ source: 'Very High Stakes', value: 1.5 });
    }

    // Character level bonus
    const levelBonus = 1 + (characterLevel * 0.05);
    multipliers.push({ source: 'Character Level', value: levelBonus });

    // Calculate total
    const totalMultiplier = multipliers.reduce((acc, m) => acc * m.value, 1);
    const total = Math.floor(base * totalMultiplier);

    return {
      base,
      multipliers,
      total: Math.max(1, total) // Minimum 1 rep per game
    };
  }

  /**
   * Remove reputation (for rule violations, etc.)
   */
  static async removeReputation(
    userId: string,
    guildId: string,
    amount: number,
    reason: string
  ): Promise<{ newTotal: number; tierChanged: boolean }> {
    const casinoProfile = await CasinoProfile.findOne({ userId, guildId });
    if (!casinoProfile) {
      throw new Error('Casino profile not found');
    }

    const oldTier = this.getTierInfo(casinoProfile.reputation).tier;
    const newRep = Math.max(0, casinoProfile.reputation - amount);
    
    casinoProfile.reputation = newRep;
    (casinoProfile as any).reputationLevel = this.getTierInfo(newRep).tier;
    await casinoProfile.save();

    const newTier = this.getTierInfo(newRep).tier;

    return {
      newTotal: newRep,
      tierChanged: oldTier !== newTier
    };
  }

  /**
   * Get tier information for a reputation amount
   */
  private static getTierInfo(reputation: number): { tier: ReputationTier; minPoints: number; perks: string[] } {
    for (let i = this.REPUTATION_TIERS.length - 1; i >= 0; i--) {
      if (reputation >= this.REPUTATION_TIERS[i].minPoints) {
        return this.REPUTATION_TIERS[i];
      }
    }
    return this.REPUTATION_TIERS[0];
  }

  /**
   * Get next tier information
   */
  private static getNextTier(reputation: number): { tier: ReputationTier; minPoints: number; perks: string[] } | null {
    for (let i = 0; i < this.REPUTATION_TIERS.length; i++) {
      if (reputation < this.REPUTATION_TIERS[i].minPoints) {
        return this.REPUTATION_TIERS[i];
      }
    }
    return null; // Already at max tier
  }

  /**
   * Get all tiers
   */
  static getAllTiers(): typeof ReputationService.REPUTATION_TIERS {
    return this.REPUTATION_TIERS;
  }

  /**
   * Get perks for a specific tier
   */
  static getTierPerks(tier: ReputationTier): string[] {
    const tierInfo = this.REPUTATION_TIERS.find(t => t.tier === tier);
    return tierInfo?.perks || [];
  }

  /**
   * Apply reputation benefits to game calculations
   */
  static getReputationBonuses(tier: ReputationTier): {
    buyInDiscount: number;
    energyBonus: number;
    dailyBonusMultiplier: number;
    jackpotMultiplier: number;
  } {
    const bonuses: { [key in ReputationTier]: any } = {
      novice: { buyInDiscount: 0, energyBonus: 0, dailyBonusMultiplier: 1.0, jackpotMultiplier: 1.0 },
      amateur: { buyInDiscount: 0.05, energyBonus: 5, dailyBonusMultiplier: 1.1, jackpotMultiplier: 1.0 },
      seasoned: { buyInDiscount: 0.10, energyBonus: 10, dailyBonusMultiplier: 1.25, jackpotMultiplier: 1.0 },
      professional: { buyInDiscount: 0.15, energyBonus: 20, dailyBonusMultiplier: 1.5, jackpotMultiplier: 1.0 },
      high_roller: { buyInDiscount: 0.20, energyBonus: 30, dailyBonusMultiplier: 2.0, jackpotMultiplier: 1.1 },
      legend: { buyInDiscount: 0.25, energyBonus: 50, dailyBonusMultiplier: 3.0, jackpotMultiplier: 1.2 },
      mythic: { buyInDiscount: 0.30, energyBonus: 100, dailyBonusMultiplier: 5.0, jackpotMultiplier: 1.5 }
    };

    return bonuses[tier];
  }
}
