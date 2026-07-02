import { CharacterClass } from '../types';

// Character class configuration - single source of truth
export interface ClassInfo {
  name: string;
  emoji: string;
  description: string;
  bonuses: string[];
  color: string;
  baseStats: {
    strength: number;
    intelligence: number;
    luck: number;
    charisma: number;
    vitality: number;
    dexterity: number;
  };
}

export const CHARACTER_CLASSES: Record<CharacterClass, ClassInfo> = {
  warrior: {
    name: 'Guerrier',
    emoji: '🗡️',
    description: 'Combattant endurci avec des mécaniques de retour',
    bonuses: [
      '+15% chance de comeback après une perte',
      'Bonus de vitalité pour sessions longues',
      'Compétences défensives au blackjack'
    ],
    color: 'text-red-400',
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
    emoji: '🔮',
    description: 'Maître des arcanes avec des capacités de prédiction',
    bonuses: [
      '+10% chance de prédire le résultat à la roulette',
      'Bonus d\'intelligence pour calculs complexes',
      'Capacités spéciales aux machines à sous'
    ],
    color: 'text-purple-400',
    baseStats: {
      strength: 8,
      intelligence: 20,
      luck: 14,
      charisma: 10,
      vitality: 10,
      dexterity: 16
    }
  },
  rogue: {
    name: 'Voleur',
    emoji: '🥷',
    description: 'Joueur furtif avec des bonus risque/récompense',
    bonuses: [
      '+20% gains sur paris à haut risque',
      'Bonus de dextérité pour réactions rapides',
      'Capacité de vol de chance aux dés'
    ],
    color: 'text-green-400',
    baseStats: {
      strength: 10,
      intelligence: 12,
      luck: 16,
      charisma: 10,
      vitality: 10,
      dexterity: 20
    }
  },
  merchant: {
    name: 'Marchand',
    emoji: '💰',
    description: 'Spécialiste économique avec optimisation de profit',
    bonuses: [
      '+5% sur tous les gains',
      'Réduction de 10% des mises minimales',
      'Bonus de charisme pour négociations'
    ],
    color: 'text-yellow-400',
    baseStats: {
      strength: 8,
      intelligence: 16,
      luck: 14,
      charisma: 20,
      vitality: 12,
      dexterity: 8
    }
  },
  bard: {
    name: 'Barde',
    emoji: '🎵',
    description: 'Influenceur social avec bonus de groupe',
    bonuses: [
      '+3% par joueur à la même table (max 15%)',
      'Bonus de charisme pour interactions',
      'Capacités de buff d\'équipe'
    ],
    color: 'text-pink-400',
    baseStats: {
      strength: 8,
      intelligence: 12,
      luck: 14,
      charisma: 20,
      vitality: 12,
      dexterity: 12
    }
  },
  paladin: {
    name: 'Paladin',
    emoji: '⚔️',
    description: 'Protecteur noble avec bonus stables et fiables',
    bonuses: [
      '+8% gains constants sur tous les jeux',
      'Protection contre les pertes catastrophiques',
      'Bonus de force et vitalité équilibrés'
    ],
    color: 'text-blue-400',
    baseStats: {
      strength: 16,
      intelligence: 10,
      luck: 10,
      charisma: 14,
      vitality: 18,
      dexterity: 10
    }
  }
};

// Game configuration
export const GAME_CONFIG = {
  MIN_BET: 10,
  MAX_BET: 10000,
  DEFAULT_BET: 10,
  JACKPOT_AMOUNT: 5000,
  BASE_ENERGY: 100,
  MAX_ENERGY: 120,
  ENERGY_REGEN_RATE: 1.2, // per minute
} as const;

// Stat bar colors for consistent styling
export const STAT_COLORS: Record<string, string> = {
  strength: 'bg-red-500',
  intelligence: 'bg-blue-500',
  luck: 'bg-yellow-500',
  charisma: 'bg-pink-500',
  vitality: 'bg-green-500',
  dexterity: 'bg-purple-500',
};

// Slot machine symbols
export const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '7️⃣'] as const;

// Roulette configuration
export const ROULETTE_CONFIG = {
  RED_NUMBERS: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36] as const,
  PAYOUTS: {
    number: 35,
    color: 1,
    evenOdd: 1,
    highLow: 1,
    dozen: 2,
    column: 2,
  },
} as const;

// Dice game configuration
export const DICE_CONFIG = {
  MULTIPLIERS: {
    2: 36,
    3: 18,
    4: 12,
    5: 6,
    6: 6,
    7: 6,
    8: 6,
    9: 6,
    10: 12,
    11: 18,
    12: 36,
  } as Record<number, number>,
} as const;

// Helper to get number color in roulette
export function getRouletteNumberColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green';
  return ROULETTE_CONFIG.RED_NUMBERS.includes(num as typeof ROULETTE_CONFIG.RED_NUMBERS[number]) ? 'red' : 'black';
}

// XP calculation helpers
export function calculateXpForLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

export function calculateLevelProgress(level: number, experience: number): {
  currentLevelXp: number;
  nextLevelXp: number;
  xpProgress: number;
  xpNeeded: number;
} {
  const currentLevelXp = calculateXpForLevel(level - 1);
  const nextLevelXp = calculateXpForLevel(level);
  const xpInCurrentLevel = experience - currentLevelXp;
  const xpRequiredForLevel = nextLevelXp - currentLevelXp;
  const xpProgress = (xpInCurrentLevel / xpRequiredForLevel) * 100;
  const xpNeeded = nextLevelXp - experience;

  return {
    currentLevelXp,
    nextLevelXp,
    xpProgress: Math.min(100, Math.max(0, xpProgress)),
    xpNeeded,
  };
}
