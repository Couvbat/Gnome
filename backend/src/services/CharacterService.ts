import { User, Character, CasinoProfile } from '../models/database';
import { AppError } from '../middleware/errorHandler';

export interface CharacterClass {
  name: string;
  description: string;
  casinoBonus: {
    luckBonus: number;
    energyBonus: number;
    specialAbility: string;
    description: string;
  };
  baseStats: {
    strength: number;
    intelligence: number;
    luck: number;
    charisma: number;
    vitality: number;
    dexterity: number;
  };
}

export const CHARACTER_CLASSES: { [key: string]: CharacterClass } = {
  warrior: {
    name: 'Warrior',
    description: 'A brave fighter who relies on strength and courage in battle.',
    casinoBonus: {
      luckBonus: 5,
      energyBonus: 20,
      specialAbility: 'battle_rage',
      description: 'Higher chance of winning after a loss (comeback mechanic)'
    },
    baseStats: {
      strength: 20,
      intelligence: 8,
      luck: 10,
      charisma: 12,
      vitality: 18,
      dexterity: 10
    }
  },
  mage: {
    name: 'Mage',
    description: 'A master of arcane arts who uses intelligence to predict outcomes.',
    casinoBonus: {
      luckBonus: 10,
      energyBonus: 15,
      specialAbility: 'arcane_insight',
      description: 'Can see the next card in blackjack once per session'
    },
    baseStats: {
      strength: 6,
      intelligence: 22,
      luck: 15,
      charisma: 14,
      vitality: 10,
      dexterity: 8
    }
  },
  rogue: {
    name: 'Rogue',
    description: 'A cunning trickster who uses dexterity and wit to gain advantages.',
    casinoBonus: {
      luckBonus: 15,
      energyBonus: 10,
      specialAbility: 'sleight_of_hand',
      description: 'Small chance to not lose coins on a losing bet'
    },
    baseStats: {
      strength: 12,
      intelligence: 14,
      luck: 18,
      charisma: 10,
      vitality: 12,
      dexterity: 20
    }
  },
  merchant: {
    name: 'Merchant',
    description: 'A savvy trader who understands the value of money and risk.',
    casinoBonus: {
      luckBonus: 8,
      energyBonus: 25,
      specialAbility: 'coin_sense',
      description: 'Higher payouts on wins, better daily bonus'
    },
    baseStats: {
      strength: 10,
      intelligence: 16,
      luck: 12,
      charisma: 20,
      vitality: 14,
      dexterity: 12
    }
  },
  bard: {
    name: 'Bard',
    description: 'A charismatic performer who brings luck and joy wherever they go.',
    casinoBonus: {
      luckBonus: 12,
      energyBonus: 15,
      specialAbility: 'lucky_song',
      description: 'Boosts luck for all players at the same table'
    },
    baseStats: {
      strength: 8,
      intelligence: 15,
      luck: 16,
      charisma: 22,
      vitality: 12,
      dexterity: 14
    }
  },
  paladin: {
    name: 'Paladin',
    description: 'A holy warrior blessed with divine protection and righteousness.',
    casinoBonus: {
      luckBonus: 10,
      energyBonus: 30,
      specialAbility: 'divine_blessing',
      description: 'Protection from large losses, bonus on charitable actions'
    },
    baseStats: {
      strength: 18,
      intelligence: 12,
      luck: 14,
      charisma: 18,
      vitality: 20,
      dexterity: 8
    }
  }
};

export class CharacterService {
  static async createCharacter(userId: string, guildId: string, characterData: {
    name: string;
    className: string;
  }): Promise<any> {
    const { name, className } = characterData;

    // Validate class
    const characterClass = CHARACTER_CLASSES[className.toLowerCase()];
    if (!characterClass) {
      throw new AppError(`Invalid character class: ${className}`, 400);
    }

    // Check if user already has a character
    const existingCharacter = await Character.findOne({ userId, guildId });
    if (existingCharacter) {
      throw new AppError('User already has a character', 409);
    }

    // Validate character name
    if (!name || name.length < 2 || name.length > 20) {
      throw new AppError('Character name must be between 2 and 20 characters', 400);
    }

    // Check if name is already taken in this guild
    const nameExists = await Character.findOne({ 
      guildId, 
      name: new RegExp(`^${name}$`, 'i') 
    });
    if (nameExists) {
      throw new AppError('Character name already taken', 409);
    }

    // Create character
    const character = new Character({
      userId,
      guildId,
      name,
      class: characterClass.name.toLowerCase(),
      level: 1,
      xp: 0,
      stats: characterClass.baseStats,
      casinoBonus: characterClass.casinoBonus,
      createdAt: new Date()
    });

    await character.save();

    // Create CasinoProfile linked to this character
    const casinoProfile = new CasinoProfile({
      userId,
      guildId,
      characterId: character._id,
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

    await casinoProfile.save();

    // Update user's character reference
    await User.updateOne(
      { userId, guildId },
      { characterId: character._id }
    );

    return {
      character,
      classInfo: characterClass
    };
  }

  static async getCharacterInfo(userId: string, guildId: string): Promise<any> {
    const character = await Character.findOne({ userId, guildId });
    if (!character) {
      return null;
    }

    const classInfo = CHARACTER_CLASSES[(character as any).class];
    
    return {
      character,
      classInfo,
      totalStats: this.calculateTotalStats(character),
      levelProgress: this.calculateLevelProgress((character as any).xp || 0)
    };
  }

  static async getAllClasses(): Promise<CharacterClass[]> {
    return Object.values(CHARACTER_CLASSES);
  }

  static async deleteCharacter(userId: string, guildId: string): Promise<void> {
    const character = await Character.findOne({ userId, guildId });
    if (!character) {
      throw new AppError('Character not found', 404);
    }

    // Remove character reference from user
    await User.updateOne(
      { userId, guildId },
      { $unset: { characterId: 1 } }
    );

    // Delete character
    await Character.deleteOne({ userId, guildId });

    // Delete or reset casino profile to allow fresh start
    await CasinoProfile.deleteOne({ userId, guildId });
  }

  static calculateTotalStats(character: any): any {
    const baseStats = character.stats;
    const levelBonus = Math.floor(character.level / 5); // +1 to all stats every 5 levels

    return {
      strength: baseStats.strength + levelBonus,
      intelligence: baseStats.intelligence + levelBonus,
      luck: baseStats.luck + levelBonus,
      charisma: baseStats.charisma + levelBonus,
      vitality: baseStats.vitality + levelBonus,
      dexterity: baseStats.dexterity + levelBonus,
      total: Object.values(baseStats).reduce((sum: number, stat: any) => sum + stat, 0) + (levelBonus * 6)
    };
  }

  static calculateLevelProgress(experience: number): { currentLevel: number; nextLevelXp: number; progress: number } {
    // Ensure experience is a valid number
    const safeExperience = experience || 0;
    const level = Math.floor(Math.sqrt(safeExperience / 100)) + 1;
    const currentLevelXp = Math.pow(level - 1, 2) * 100;
    const nextLevelXp = Math.pow(level, 2) * 100;
    const progress = ((safeExperience - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

    return {
      currentLevel: level,
      nextLevelXp: nextLevelXp - safeExperience,
      progress: Math.round(progress * 100) / 100
    };
  }

  static async levelUpCharacter(userId: string, guildId: string, xpGained: number): Promise<any> {
    const character = await Character.findOne({ userId, guildId });
    if (!character) {
      throw new AppError('Character not found', 404);
    }

    const oldLevel = character.level || 1;
    // Ensure xp starts at 0 if undefined - use the correct 'xp' field from schema
    const currentXp = character.xp || 0;
    character.xp = currentXp + xpGained;
    
    const newLevelInfo = this.calculateLevelProgress(character.xp);
    character.level = newLevelInfo.currentLevel;

    const leveledUp = character.level > oldLevel;
    
    await character.save();

    return {
      character,
      leveledUp,
      oldLevel,
      newLevel: character.level,
      xpGained,
      totalXp: character.xp
    };
  }
}