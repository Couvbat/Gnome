import { Character, CasinoProfile } from '../models/database';
import { CasinoSession } from '../models/schemas';
import { Types } from 'mongoose';

export interface AbilityUsage {
  abilityName: string;
  characterClass: string;
  cooldownMinutes: number;
  usesPerSession: number;
  energyCost: number;
}

export interface AbilityResult {
  success: boolean;
  effect: any;
  message: string;
  cooldownRemaining?: number;
  usesRemaining?: number;
}

export class AbilityService {
  // Define ability limitations and cooldowns
  private static readonly ABILITY_CONFIG: { [key: string]: AbilityUsage } = {
    // Mage abilities
    mage_card_reading: {
      abilityName: 'Arcane Insight - Card Reading',
      characterClass: 'mage',
      cooldownMinutes: 10,
      usesPerSession: 3,
      energyCost: 20
    },
    mage_pattern_insight: {
      abilityName: 'Pattern Insight',
      characterClass: 'mage',
      cooldownMinutes: 0,
      usesPerSession: 999, // Passive
      energyCost: 0
    },
    
    // Warrior abilities
    warrior_battle_rage: {
      abilityName: 'Battle Rage - Comeback',
      characterClass: 'warrior',
      cooldownMinutes: 5,
      usesPerSession: 999, // Triggered automatically
      energyCost: 0
    },
    warrior_battle_frenzy: {
      abilityName: 'Battle Frenzy',
      characterClass: 'warrior',
      cooldownMinutes: 15,
      usesPerSession: 2,
      energyCost: 30
    },
    
    // Rogue abilities
    rogue_sleight_of_hand: {
      abilityName: 'Sleight of Hand',
      characterClass: 'rogue',
      cooldownMinutes: 0,
      usesPerSession: 999, // Chance-based
      energyCost: 0
    },
    rogue_probability_twist: {
      abilityName: 'Probability Manipulation',
      characterClass: 'rogue',
      cooldownMinutes: 8,
      usesPerSession: 5,
      energyCost: 15
    },
    
    // Merchant abilities
    merchant_coin_sense: {
      abilityName: 'Coin Sense',
      characterClass: 'merchant',
      cooldownMinutes: 0,
      usesPerSession: 999, // Always active
      energyCost: 0
    },
    merchant_lucky_deal: {
      abilityName: 'Lucky Business Deal',
      characterClass: 'merchant',
      cooldownMinutes: 20,
      usesPerSession: 1,
      energyCost: 40
    },
    
    // Bard abilities
    bard_lucky_song: {
      abilityName: 'Lucky Song',
      characterClass: 'bard',
      cooldownMinutes: 12,
      usesPerSession: 4,
      energyCost: 25
    },
    bard_harmony_boost: {
      abilityName: 'Harmony Boost',
      characterClass: 'bard',
      cooldownMinutes: 0,
      usesPerSession: 999, // Passive table effect
      energyCost: 0
    },
    
    // Paladin abilities
    paladin_divine_blessing: {
      abilityName: 'Divine Blessing',
      characterClass: 'paladin',
      cooldownMinutes: 0,
      usesPerSession: 999, // Triggered on losses
      energyCost: 0
    },
    paladin_holy_protection: {
      abilityName: 'Holy Protection',
      characterClass: 'paladin',
      cooldownMinutes: 30,
      usesPerSession: 1,
      energyCost: 50
    }
  };

  /**
   * Check if an ability can be used
   */
  static async canUseAbility(
    userId: string,
    guildId: string,
    abilityKey: string,
    sessionId?: string
  ): Promise<AbilityResult> {
    const config = this.ABILITY_CONFIG[abilityKey];
    
    if (!config) {
      return {
        success: false,
        effect: null,
        message: 'Unknown ability'
      };
    }

    // Get character and casino profile
    const [character, casinoProfile] = await Promise.all([
      Character.findOne({ userId, guildId }),
      CasinoProfile.findOne({ userId, guildId })
    ]);

    if (!character || (character as any).class !== config.characterClass) {
      return {
        success: false,
        effect: null,
        message: `This ability requires ${config.characterClass} class`
      };
    }

    // Check energy
    const currentEnergy = (casinoProfile as any)?.energy || 100;
    if (currentEnergy < config.energyCost) {
      return {
        success: false,
        effect: null,
        message: `Insufficient energy. Need ${config.energyCost}, have ${currentEnergy}`
      };
    }

    // Check cooldown (stored in character document)
    const lastUsed = (character as any).lastAbilityUse?.[abilityKey];
    if (lastUsed && config.cooldownMinutes > 0) {
      const now = new Date();
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      const timeSinceUse = now.getTime() - new Date(lastUsed).getTime();
      
      if (timeSinceUse < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceUse) / 60000);
        return {
          success: false,
          effect: null,
          message: `Ability on cooldown for ${remainingMinutes} more minutes`,
          cooldownRemaining: remainingMinutes
        };
      }
    }

    // Check session usage limit
    if (sessionId && config.usesPerSession < 999) {
      const session = await CasinoSession.findOne({ sessionId });
      const sessionUses = (session as any)?.abilityUsage?.find((u: any) => u.abilityKey === abilityKey)?.count || 0;
      
      if (sessionUses >= config.usesPerSession) {
        return {
          success: false,
          effect: null,
          message: `Ability limit reached for this session (${config.usesPerSession} uses)`,
          usesRemaining: 0
        };
      }
    }

    return {
      success: true,
      effect: config,
      message: 'Ability available',
      usesRemaining: sessionId ? config.usesPerSession - ((await this.getSessionUses(sessionId, abilityKey)) || 0) : undefined
    };
  }

  /**
   * Record ability usage
   */
  static async useAbility(
    userId: string,
    guildId: string,
    abilityKey: string,
    sessionId?: string
  ): Promise<void> {
    const config = this.ABILITY_CONFIG[abilityKey];
    if (!config) return;

    const [character, casinoProfile] = await Promise.all([
      Character.findOne({ userId, guildId }),
      CasinoProfile.findOne({ userId, guildId })
    ]);

    if (!character) return;

    // Update last usage timestamp
    if (!( character as any).lastAbilityUse) {
      (character as any).lastAbilityUse = {};
    }
    (character as any).lastAbilityUse[abilityKey] = new Date();
    await character.save();

    // Deduct energy
    if (casinoProfile && config.energyCost > 0) {
      (casinoProfile as any).energy = Math.max(0, ((casinoProfile as any).energy || 100) - config.energyCost);
      await casinoProfile.save();
    }

    // Track session usage (abilityUsage is an array of { abilityKey, usedAt, count })
    if (sessionId) {
      const incremented = await CasinoSession.findOneAndUpdate(
        { sessionId, 'abilityUsage.abilityKey': abilityKey },
        { $inc: { 'abilityUsage.$.count': 1 }, $set: { 'abilityUsage.$.usedAt': new Date() } }
      );
      if (!incremented) {
        await CasinoSession.updateOne(
          { sessionId },
          { $push: { abilityUsage: { abilityKey, usedAt: new Date(), count: 1 } } }
        );
      }
    }
  }

  /**
   * Get session usage count for an ability
   */
  private static async getSessionUses(sessionId: string, abilityKey: string): Promise<number> {
    const session = await CasinoSession.findOne({ sessionId });
    return (session as any)?.abilityUsage?.find((u: any) => u.abilityKey === abilityKey)?.count || 0;
  }

  /**
   * Get all available abilities for a character class
   */
  static getClassAbilities(characterClass: string): AbilityUsage[] {
    return Object.entries(this.ABILITY_CONFIG)
      .filter(([key, config]) => config.characterClass === characterClass)
      .map(([key, config]) => config);
  }

  /**
   * Get ability cooldown status for all character abilities
   */
  static async getAbilityStatus(
    userId: string,
    guildId: string,
    sessionId?: string
  ): Promise<{ [abilityKey: string]: { available: boolean; cooldownRemaining?: number; usesRemaining?: number } }> {
    const character = await Character.findOne({ userId, guildId });
    if (!character) return {};

    const characterClass = (character as any).class;
    const abilities = Object.keys(this.ABILITY_CONFIG).filter(
      key => this.ABILITY_CONFIG[key].characterClass === characterClass
    );

    const status: any = {};
    
    for (const abilityKey of abilities) {
      const canUse = await this.canUseAbility(userId, guildId, abilityKey, sessionId);
      status[abilityKey] = {
        available: canUse.success,
        cooldownRemaining: canUse.cooldownRemaining,
        usesRemaining: canUse.usesRemaining
      };
    }

    return status;
  }
}
