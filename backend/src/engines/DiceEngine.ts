import { CasinoGameEngine, GameResult } from './CasinoGameEngine';
import { AppError } from '../middleware/errorHandler';

export interface DiceGameResult extends GameResult {
  dice: [number, number];
  total: number;
  prediction: string | number;
  predictionType: 'high' | 'low' | 'exact' | 'range';
  isCorrect: boolean;
  payoutMultiplier: number;
}

export interface DicePrediction {
  type: 'high' | 'low' | 'exact' | 'range';
  value: string | number | [number, number];
  multiplier: number;
  description: string;
}

export class DiceEngine extends CasinoGameEngine {
  private static readonly PREDICTION_TYPES: DicePrediction[] = [
    { type: 'low', value: 'low', multiplier: 2, description: 'Total 2-6 (2x payout)' },
    { type: 'high', value: 'high', multiplier: 2, description: 'Total 7-12 (2x payout)' },
    { type: 'exact', value: 7, multiplier: 5, description: 'Exact 7 (5x payout)' },
    { type: 'exact', value: 2, multiplier: 30, description: 'Snake Eyes (30x payout)' },
    { type: 'exact', value: 12, multiplier: 30, description: 'Boxcars (30x payout)' },
    { type: 'range', value: [3, 5], multiplier: 4, description: 'Low Range 3-5 (4x payout)' },
    { type: 'range', value: [8, 10], multiplier: 4, description: 'High Range 8-10 (4x payout)' }
  ];

  static async rollDice(
    userId: string,
    guildId: string,
    bet: number,
    prediction: string | number
  ): Promise<DiceGameResult> {
    // Get player context (character, stats, bonuses)
    const context = await this.getPlayerContext(userId, guildId);
    
    // Check energy availability
    const energyRequired = Math.max(1, Math.floor(bet / 100));
    if (!(await this.checkEnergyAvailable(userId, guildId, energyRequired))) {
      throw new AppError('Insufficient energy to play. Rest or wait for energy to regenerate.', 400);
    }

    // Parse prediction
    const predictionInfo = this.parsePrediction(prediction);
    
    // Roll dice with character luck influence
    const dice = this.rollWithLuck(context.totalLuck, context.characterBonus);
    const total = dice[0] + dice[1];
    
    // Check if prediction is correct
    const isCorrect = this.checkPrediction(total, dice, predictionInfo);
    
    // Calculate winnings
    let baseWinnings = 0;
    let outcome: 'win' | 'loss' | 'push' | 'jackpot' = 'loss';
    
    if (isCorrect) {
      baseWinnings = bet * predictionInfo.multiplier;
      outcome = predictionInfo.multiplier >= 20 ? 'jackpot' : 'win';
    }

    // Apply character-specific bonuses
    let bonusMultiplier = 1.0;
    let specialAbilityTriggered = '';

    // Warrior battle rage: Better odds on high-risk bets after recent losses
    if (context.characterBonus.className === 'warrior' && predictionInfo.multiplier >= 20) {
      // Check for recent losses (simplified - in real implementation check game history)
      const rageBonus = await this.triggerWarriorBattleRage(context, false);
      if (rageBonus > 1.0) {
        baseWinnings *= rageBonus;
        bonusMultiplier *= rageBonus;
        specialAbilityTriggered = 'warrior_battle_rage';
      }
    }

    // Merchant coin sense bonus
    if (context.characterBonus.className === 'merchant' && outcome === 'win') {
      const merchantBonus = await this.triggerMerchantCoinSense(context, baseWinnings);
      baseWinnings = merchantBonus;
      bonusMultiplier *= 1.2;
      specialAbilityTriggered = 'merchant_coin_sense';
    }

    // Rogue sleight of hand (reduce losses on high-risk bets)
    let actualBetLoss = bet;
    if (outcome === 'loss' && context.characterBonus.className === 'rogue' && predictionInfo.multiplier >= 10) {
      actualBetLoss = await this.triggerRogueSleightOfHand(context, bet);
      if (actualBetLoss < bet) {
        specialAbilityTriggered = 'rogue_sleight_of_hand';
      }
    }

    // Paladin divine blessing
    if (outcome === 'loss' && context.characterBonus.className === 'paladin') {
      const protectedLoss = await this.triggerPaladinDivineBlessing(context, bet, actualBetLoss);
      if (protectedLoss < actualBetLoss) {
        actualBetLoss = protectedLoss;
        specialAbilityTriggered = 'paladin_divine_blessing';
      }
    }

    // Mage arcane insight: Bonus XP for exact predictions
    let xpMultiplier = 1.0;
    if (context.characterBonus.className === 'mage' && predictionInfo.type === 'exact' && isCorrect) {
      xpMultiplier = 2.0;
      specialAbilityTriggered = specialAbilityTriggered || 'mage_arcane_insight';
    }

    // Calculate final payout and XP (on a loss, payout is 0)
    const finalPayout = outcome === 'loss' ? 0 : baseWinnings;
    const xpGained = this.calculateXpGain(bet, outcome, context.character?.level || 1) * xpMultiplier;

    const result: DiceGameResult = {
      outcome,
      baseWinnings,
      bonusMultiplier,
      finalPayout,
      xpGained,
      specialAbilityTriggered,
      characterBonus: context.characterBonus,
      dice,
      total,
      prediction,
      predictionType: predictionInfo.type,
      isCorrect,
      payoutMultiplier: predictionInfo.multiplier
    };

    // Process the game result
    return await this.processGameResult(
      userId,
      guildId,
      'dice',
      bet,
      result,
      {
        dice,
        total,
        prediction,
        predictionType: predictionInfo.type,
        multiplier: predictionInfo.multiplier,
        luckModifier: this.calculateLuckModifier(context.totalLuck),
        specialAbility: specialAbilityTriggered
      }
    ) as DiceGameResult;
  }

  private static parsePrediction(prediction: string | number): DicePrediction {
    if (typeof prediction === 'number') {
      // Exact number prediction
      const multiplier = prediction === 2 || prediction === 12 ? 30 : 
                        prediction === 7 ? 5 : 15;
      return {
        type: 'exact',
        value: prediction,
        multiplier,
        description: `Exact ${prediction} (${multiplier}x payout)`
      };
    }

    const pred = prediction.toString().toLowerCase();
    
    if (pred === 'high') {
      return this.PREDICTION_TYPES.find(p => p.value === 'high')!;
    }
    
    if (pred === 'low') {
      return this.PREDICTION_TYPES.find(p => p.value === 'low')!;
    }

    // Try to parse as number
    const num = parseInt(pred);
    if (!isNaN(num) && num >= 2 && num <= 12) {
      const multiplier = num === 2 || num === 12 ? 30 : 
                        num === 7 ? 5 : 15;
      return {
        type: 'exact',
        value: num,
        multiplier,
        description: `Exact ${num} (${multiplier}x payout)`
      };
    }

    // Default to high if invalid
    return this.PREDICTION_TYPES.find(p => p.value === 'high')!;
  }

  private static rollWithLuck(totalLuck: number, characterBonus: any): [number, number] {
    let die1 = Math.floor(Math.random() * 6) + 1;
    let die2 = Math.floor(Math.random() * 6) + 1;

    // Apply luck influence - higher luck gives slight bias toward favorable outcomes
    const luckModifier = this.calculateLuckModifier(totalLuck);
    
    if (luckModifier > 1.1 && Math.random() < 0.1) {
      // 10% chance for lucky players to reroll low dice
      if (die1 <= 2) die1 = Math.floor(Math.random() * 6) + 1;
      if (die2 <= 2) die2 = Math.floor(Math.random() * 6) + 1;
    }

    // Bard lucky song: Small chance for perfect dice
    if (characterBonus.className === 'bard' && Math.random() < 0.05) {
      // 5% chance to get lucky 7
      die1 = 3;
      die2 = 4;
    }

    return [die1, die2];
  }

  private static checkPrediction(
    total: number,
    dice: [number, number],
    prediction: DicePrediction
  ): boolean {
    switch (prediction.type) {
      case 'high':
        return total >= 7;
      
      case 'low':
        return total <= 6;
      
      case 'exact':
        return total === prediction.value;
      
      case 'range':
        const [min, max] = prediction.value as [number, number];
        return total >= min && total <= max;
      
      default:
        return false;
    }
  }

  static getDiceGameInfo(): {
    predictionTypes: DicePrediction[];
    tips: string[];
    characterBonuses: { [className: string]: string };
  } {
    return {
      predictionTypes: this.PREDICTION_TYPES,
      tips: [
        'Higher luck increases chances of favorable rolls',
        'Exact predictions have higher payouts but lower odds',
        'High/Low bets are safer with 2x payout',
        'Snake Eyes (2) and Boxcars (12) offer 30x payout',
        'Character classes provide unique bonuses'
      ],
      characterBonuses: {
        warrior: 'Battle Rage: Bonus on high-risk bets after losses',
        mage: 'Arcane Insight: Double XP for exact predictions',
        rogue: 'Sleight of Hand: Reduced losses on failed high-risk bets',
        merchant: 'Coin Sense: 20% bonus on all winnings',
        bard: 'Lucky Song: Small chance for perfect dice rolls',
        paladin: 'Divine Blessing: Protection from large losses'
      }
    };
  }
}