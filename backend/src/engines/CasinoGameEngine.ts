import { CharacterService, CHARACTER_CLASSES } from '../services/CharacterService';
import { EnergyService } from '../services/EnergyService';
import { ReputationService } from '../services/ReputationService';
import { AbilityService } from '../services/AbilityService';
import { EconomyService } from '../services/EconomyService';
import { User, Character, CasinoProfile } from '../models/database';
import { CasinoGameLog } from '../models/schemas';
import { AppError } from '../middleware/errorHandler';

export interface GameResult {
  outcome: 'win' | 'loss' | 'push' | 'jackpot';
  baseWinnings: number;
  bonusMultiplier: number;
  finalPayout: number;
  xpGained: number;
  specialAbilityTriggered?: string;
  characterBonus?: any;
}

export interface CharacterBonus {
  luckBonus: number;
  energyBonus: number;
  specialAbility: string;
  className: string;
}

export class CasinoGameEngine {
  /**
   * Single source of truth for turning a Character document into its class casino bonus.
   * Used by both single-player (getPlayerContext) and multiplayer (batch-fetched characters).
   */
  static buildCharacterBonus(character: any): CharacterBonus {
    if (character) {
      const classInfo = CHARACTER_CLASSES[character.class];
      if (classInfo) {
        return {
          luckBonus: classInfo.casinoBonus.luckBonus,
          energyBonus: classInfo.casinoBonus.energyBonus,
          specialAbility: classInfo.casinoBonus.specialAbility,
          className: character.class
        };
      }
    }

    return {
      luckBonus: 0,
      energyBonus: 0,
      specialAbility: '',
      className: 'none'
    };
  }

  static async getPlayerContext(userId: string, guildId: string, tableId?: string): Promise<any> {
    const [user, character, casinoProfile] = await Promise.all([
      User.findOne({ userId, guildId }),
      Character.findOne({ userId, guildId }),
      CasinoProfile.findOne({ userId, guildId })
    ]);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const characterBonus = this.buildCharacterBonus(character);

    // Base luck calculation
    let totalLuck = 10 + characterBonus.luckBonus + ((character as any)?.stats?.luck || 0);

    // Check for active Bard buffs if tableId provided
    let bardBoost = 0;
    if (tableId) {
      const BardAbilities = await import('../services/BardAbilities');
      bardBoost = await BardAbilities.BardAbilities.checkActiveBardBuffs(userId, guildId);
      
      // Apply Bard harmony boost to luck (10% boost = +10 luck points)
      if (bardBoost > 0) {
        totalLuck += Math.floor(bardBoost * 100);
      }
    }

    return {
      user,
      character,
      casinoProfile,
      characterBonus,
      totalLuck,
      bardBoost
    };
  }

  static calculateLuckModifier(totalLuck: number): number {
    // Base luck is 10, each point above adds 1% better odds
    const luckModifier = 1 + (totalLuck - 10) * 0.01;
    return Math.min(luckModifier, 2.0); // Cap at 2x multiplier
  }

  static calculateXpGain(bet: number, outcome: string, characterLevel: number): number {
    const baseXp = Math.floor(bet / 10); // 1 XP per 10 coins bet
    const outcomeMultiplier = outcome === 'win' ? 1.5 : outcome === 'loss' ? 1.0 : 2.0; // Jackpot = 2x
    const levelPenalty = Math.max(0.1, 1 - (characterLevel * 0.05)); // Harder to gain XP at higher levels
    
    return Math.floor(baseXp * outcomeMultiplier * levelPenalty);
  }

  static async processGameResult(
    userId: string,
    guildId: string,
    gameType: string,
    bet: number,
    result: GameResult,
    gameData: any
  ): Promise<any> {
    const context = await this.getPlayerContext(userId, guildId);
    const { character, casinoProfile } = context;

    // Charge the bet atomically upfront - the { coins: { $gte: amount } } filter inside
    // spendCoins rejects the whole game (before any XP/profile/log side effects below are
    // persisted) if the player can't actually afford it, mirroring the pattern used by
    // BlackjackTableManager.placeBet for multiplayer tables.
    const spent = await EconomyService.spendCoins(userId, guildId, bet);
    if (!spent) {
      throw new AppError('Insufficient balance to place this bet', 400);
    }

    // Credit back any winnings/refund. finalPayout already represents the full amount
    // owed to the player for this round (e.g. bet returned on a push, reduced-loss refund
    // from a Rogue/Paladin ability, or bet + winnings on a win) - not just the delta.
    if (result.finalPayout > 0) {
      await EconomyService.addCoins(userId, guildId, result.finalPayout);
    }

    const netChange = result.finalPayout - bet;
    const newBalance = await EconomyService.getCoins(userId, guildId);

    // Award XP to character
    if (character && result.xpGained > 0) {
      const levelResult = await CharacterService.levelUpCharacter(userId, guildId, result.xpGained);
      if (levelResult.leveledUp) {
        result.specialAbilityTriggered = `LEVEL_UP:${levelResult.oldLevel}->${levelResult.newLevel}`;
      }
    }

    // Award reputation based on game performance
    let reputationGained = 0;
    let tierChanged = false;
    let newTier = null;
    
    if (casinoProfile) {
      const repResult = await ReputationService.awardReputation(
        userId,
        guildId,
        gameType,
        bet,
        result.outcome,
        character?.level || 1
      );
      reputationGained = repResult.gained;
      tierChanged = repResult.tierChanged;
      newTier = repResult.newTier;
    }

    // Update casino profile stats
    if (casinoProfile) {
      (casinoProfile as any).totalWagered += bet;
      if (result.outcome === 'win' || result.outcome === 'jackpot') {
        (casinoProfile as any).totalWon += result.finalPayout;
        (casinoProfile as any).currentStreak = ((casinoProfile as any).currentStreak || 0) + 1;
        (casinoProfile as any).bestStreak = Math.max(
          (casinoProfile as any).bestStreak || 0,
          (casinoProfile as any).currentStreak || 0
        );
        
        // Track biggest win
        if (result.finalPayout > ((casinoProfile as any).stats?.biggestWin || 0)) {
          if (!(casinoProfile as any).stats) (casinoProfile as any).stats = {};
          (casinoProfile as any).stats.biggestWin = result.finalPayout;
        }
      } else {
        (casinoProfile as any).totalLost += bet;
        (casinoProfile as any).currentStreak = 0;
        
        // Track biggest loss
        if (bet > ((casinoProfile as any).stats?.biggestLoss || 0)) {
          if (!(casinoProfile as any).stats) (casinoProfile as any).stats = {};
          (casinoProfile as any).stats.biggestLoss = bet;
        }
      }

      // Update favorite game
      if (!(casinoProfile as any).stats) (casinoProfile as any).stats = {};
      (casinoProfile as any).stats.favoriteGame = gameType;

      // Calculate max energy based on character class bonus and level
      const baseMaxEnergy = 100;
      const classBonus = context.characterBonus?.energyBonus || 0;
      const levelBonus = character ? ((character as any).level - 1) * 5 : 0; // +5 per level after level 1
      const maxEnergy = baseMaxEnergy + classBonus + levelBonus;
      
      // Deduct energy (calculated based on bet size and game type)
      const energyCost = EnergyService.calculateEnergyCost(gameType, bet);
      const currentEnergy = (casinoProfile as any).energy ?? maxEnergy;
      (casinoProfile as any).energy = Math.max(0, currentEnergy - energyCost);
      (casinoProfile as any).maxEnergy = maxEnergy; // Always keep maxEnergy updated
    }

    // Save all changes (coins are already persisted atomically via EconomyService.addCoins above)
    await casinoProfile?.save();

    // Log the game
    const gameLog = new CasinoGameLog({
      logId: `${gameType}_${Date.now()}_${userId}`,
      userId,
      guildId,
      characterId: character?._id || null,
      sessionId: `session_${userId}`,
      gameType,
      gameId: `game_${Date.now()}`,
      bet,
      result: result.outcome === 'loss' ? 'loss' : 'win',
      payout: result.finalPayout,
      netChange,
      gameData,
      characterClass: context.characterBonus.className || 'none',
      characterLevel: character?.level || 1,
      characterLuck: context.totalLuck,
      bonuses: [{
        type: 'character_luck',
        value: context.characterBonus.luckBonus || 0,
        source: context.characterBonus.className || 'none'
      }]
    });

    await gameLog.save();

    // Get energy info for response
    const energyInfo = await EnergyService.getEnergyInfo(userId, guildId);

    return {
      ...result,
      newBalance,
      netChange,
      reputationGained,
      tierChanged,
      newTier,
      energy: {
        current: energyInfo.current,
        max: energyInfo.max,
        regenRate: energyInfo.regenRate,
        minutesUntilFull: energyInfo.minutesUntilFull
      }
    };
  }

  static async checkEnergyAvailable(userId: string, guildId: string, energyRequired: number): Promise<boolean> {
    return await EnergyService.hasEnoughEnergy(userId, guildId, energyRequired);
  }

  // Special ability implementations with proper ability tracking
  static async triggerWarriorBattleRage(context: any, lastGameWasLoss: boolean): Promise<number> {
    if (!lastGameWasLoss || context.characterBonus.className !== 'warrior') return 1.0;
    
    // Check if ability can be used
    const canUse = await AbilityService.canUseAbility(
      context.user.userId,
      context.user.guildId,
      'warrior_battle_rage'
    );
    
    if (!canUse.success) return 1.0;
    
    // Record ability usage
    await AbilityService.useAbility(
      context.user.userId,
      context.user.guildId,
      'warrior_battle_rage'
    );
    
    // 25% luck boost after a loss (comeback mechanic)
    return 1.25;
  }

  static async triggerRogueSleightOfHand(context: any, bet: number): Promise<number> {
    if (context.characterBonus.className !== 'rogue') return bet;
    
    // 15% chance to lose only half the bet
    if (Math.random() < 0.15) {
      // Record ability usage
      await AbilityService.useAbility(
        context.user.userId,
        context.user.guildId,
        'rogue_sleight_of_hand'
      );
      
      return bet * 0.5;
    }
    return bet;
  }

  static async triggerMerchantCoinSense(context: any, baseWinnings: number): Promise<number> {
    if (context.characterBonus.className !== 'merchant') return baseWinnings;
    
    // Record ability usage (passive, always active)
    await AbilityService.useAbility(
      context.user.userId,
      context.user.guildId,
      'merchant_coin_sense'
    );
    
    // 20% bonus on all winnings
    return baseWinnings * 1.2;
  }

  static async triggerPaladinDivineBlessing(context: any, bet: number, potentialLoss: number): Promise<number> {
    if (context.characterBonus.className !== 'paladin') return potentialLoss;
    
    // Reduce large losses by 30% (losses over 100 coins)
    if (potentialLoss > 100) {
      // Record ability usage
      await AbilityService.useAbility(
        context.user.userId,
        context.user.guildId,
        'paladin_divine_blessing'
      );
      
      return potentialLoss * 0.7;
    }
    return potentialLoss;
  }

  static async triggerBardLuckySong(context: any, guildId: string, tableId?: string): Promise<number> {
    if (context.characterBonus.className !== 'bard') return 1.0;
    
    // Check if ability can be used
    const canUse = await AbilityService.canUseAbility(
      context.user.userId,
      guildId,
      'bard_lucky_song'
    );
    
    if (!canUse.success) return 1.0;
    
    // Record ability usage
    await AbilityService.useAbility(
      context.user.userId,
      guildId,
      'bard_lucky_song'
    );
    
    // TODO: Implement table-wide luck boost for other players
    // This would require tracking active tables and applying bonuses to other players
    return 1.1; // 10% luck boost for bard
  }
}