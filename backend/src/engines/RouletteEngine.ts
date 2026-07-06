import { CasinoGameEngine, GameResult } from './CasinoGameEngine';
import { AppError } from '../middleware/errorHandler';
import { CharacterService } from '../services/CharacterService';
import { EconomyService } from '../services/EconomyService';

export interface RouletteBet {
  type: 'straight' | 'split' | 'street' | 'corner' | 'line' | 'dozen' | 'column' | 
        'red' | 'black' | 'odd' | 'even' | 'low' | 'high';
  numbers: number[];
  payout: number;
  amount: number;
  description: string;
}

export interface RouletteGameResult extends GameResult {
  winningNumber: number;
  winningColor: 'red' | 'black' | 'green';
  bets: RouletteBet[];
  winningBets: RouletteBet[];
  totalBetAmount: number;
  socialBonus?: number;
  communityPayout?: number;
}

export interface RouletteTable {
  id: string;
  players: Map<string, {
    userId: string;
    bets: RouletteBet[];
    totalBet: number;
    characterClass?: string;
  }>;
  currentSpin: {
    number: number;
    color: 'red' | 'black' | 'green';
  } | null;
  gamePhase: 'betting' | 'spinning' | 'payouts' | 'finished';
  spinTimer: number; // seconds until spin
  history: number[]; // last 10 spins
  communityJackpot: number; // shared jackpot pool
}

export class RouletteEngine extends CasinoGameEngine {
  // European roulette layout (0-36, no 00)
  private static readonly RED_NUMBERS = [
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
  ];

  private static readonly BET_TYPES = {
    // Inside bets
    straight: { payout: 35, description: 'Single number' },
    split: { payout: 17, description: 'Two adjacent numbers' },
    street: { payout: 11, description: 'Three numbers in a row' },
    corner: { payout: 8, description: 'Four numbers in a square' },
    line: { payout: 5, description: 'Six numbers in two rows' },
    
    // Outside bets
    dozen: { payout: 2, description: 'First/Second/Third dozen' },
    column: { payout: 2, description: 'Column of 12 numbers' },
    red: { payout: 1, description: 'All red numbers' },
    black: { payout: 1, description: 'All black numbers' },
    odd: { payout: 1, description: 'All odd numbers' },
    even: { payout: 1, description: 'All even numbers' },
    low: { payout: 1, description: 'Numbers 1-18' },
    high: { payout: 1, description: 'Numbers 19-36' }
  };

  static async playSinglePlayerRoulette(
    userId: string,
    guildId: string,
    bets: { type: string; amount: number; value?: number | string }[]
  ): Promise<RouletteGameResult> {
    // Get player context
    const context = await this.getPlayerContext(userId, guildId);
    
    // Calculate total bet and energy required
    const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const energyRequired = Math.max(1, Math.floor(totalBet / 80));
    
    if (!(await this.checkEnergyAvailable(userId, guildId, energyRequired))) {
      throw new AppError('Insufficient energy for roulette. Larger bets require more energy.', 400);
    }

    // Parse and validate bets
    const parsedBets = this.parseBets(bets);
    
    // Spin the wheel with luck influence
    const { number, color } = this.spinWheel(context.totalLuck, context.characterBonus);
    
    // Check winning bets
    const winningBets = this.checkWinningBets(parsedBets, number);
    
    // Calculate base winnings
    let baseWinnings = 0;
    for (const bet of winningBets) {
      baseWinnings += bet.amount * (bet.payout + 1); // Include original bet
    }

    let outcome: 'win' | 'loss' | 'push' | 'jackpot' = 'loss';
    if (baseWinnings > totalBet) {
      outcome = baseWinnings >= totalBet * 10 ? 'jackpot' : 'win';
    } else if (baseWinnings === totalBet) {
      outcome = 'push';
    }

    // Apply character-specific bonuses
    let bonusMultiplier = 1.0;
    let specialAbilityTriggered = '';
    let communityPayout = 0;
    let socialBonus = 0;

    // Bard harmony boost - affects other players too in multiplayer
    if (context.characterBonus.className === 'bard' && winningBets.length > 0) {
      const harmonyBonus = Math.min(1.3, 1.0 + (winningBets.length * 0.1));
      baseWinnings *= harmonyBonus;
      bonusMultiplier = harmonyBonus;
      specialAbilityTriggered = 'bard_harmony_boost';
      
      // In multiplayer, this would boost other players' wins too
      socialBonus = Math.floor(baseWinnings * 0.1);
    }

    // Loss-reduction abilities track how much of the stake is actually lost;
    // the difference (totalBet - actualLoss) is refunded via finalPayout below.
    let actualLoss = totalBet;

    // Paladin divine blessing - reduce large losses (the trigger only reduces
    // losses over 100 coins, so no extra bet-size gate here)
    if (outcome === 'loss' && context.characterBonus.className === 'paladin') {
      const protectedLoss = await this.triggerPaladinDivineBlessing(context, totalBet, actualLoss);
      if (protectedLoss < actualLoss) {
        actualLoss = protectedLoss;
        specialAbilityTriggered = 'paladin_divine_blessing';
      }
    }

    // Merchant coin multiplication
    if (outcome === 'win' && context.characterBonus.className === 'merchant') {
      baseWinnings = await this.triggerMerchantCoinSense(context, baseWinnings);
      bonusMultiplier *= 1.2;
      specialAbilityTriggered = 'merchant_coin_sense';
    }

    // Warrior battle frenzy on big wins
    if (outcome === 'jackpot' && context.characterBonus.className === 'warrior') {
      const frenzyBonus = await this.triggerWarriorBattleRage(context, true);
      baseWinnings *= frenzyBonus;
      bonusMultiplier *= frenzyBonus;
      specialAbilityTriggered = 'warrior_battle_frenzy';
    }

    // Rogue probability manipulation
    if (outcome === 'loss' && context.characterBonus.className === 'rogue' && totalBet >= 50) {
      const reducedLoss = await this.triggerRogueSleightOfHand(context, totalBet);
      if (reducedLoss < actualLoss) {
        actualLoss = reducedLoss;
        specialAbilityTriggered = 'rogue_probability_twist';
      }
    }

    // Mage pattern recognition bonus XP
    let xpMultiplier = 1.0;
    if (context.characterBonus.className === 'mage' && this.hasPatternPrediction(winningBets)) {
      xpMultiplier = 2.0;
      specialAbilityTriggered = specialAbilityTriggered || 'mage_pattern_insight';
    }

    // Community jackpot contribution (1% of all bets)
    communityPayout = Math.floor(totalBet * 0.01);

    const result: RouletteGameResult = {
      outcome,
      baseWinnings,
      bonusMultiplier,
      // On a loss only the ability-protected portion of the stake comes back
      // (0 for a plain loss) - the full stake is charged by processGameResult.
      finalPayout: outcome === 'loss' ? totalBet - actualLoss : baseWinnings,
      xpGained: this.calculateXpGain(totalBet, outcome, context.character?.level || 1) * xpMultiplier,
      specialAbilityTriggered,
      characterBonus: context.characterBonus,
      winningNumber: number,
      winningColor: color,
      bets: parsedBets,
      winningBets,
      totalBetAmount: totalBet,
      socialBonus,
      communityPayout
    };

    return await this.processGameResult(userId, guildId, 'roulette', totalBet, result, {
      winningNumber: number,
      winningColor: color,
      totalBets: parsedBets.length,
      winningBetsCount: winningBets.length,
      biggestWin: Math.max(...winningBets.map(b => b.amount * b.payout), 0),
      luckModifier: this.calculateLuckModifier(context.totalLuck),
      specialAbility: specialAbilityTriggered,
      socialBonus,
      communityContribution: communityPayout
    }) as RouletteGameResult;
  }

  private static parseBets(bets: { type: string; amount: number; value?: number | string }[]): RouletteBet[] {
    return bets.map(bet => {
      const betType = bet.type.toLowerCase();
      const amount = Math.max(1, bet.amount);
      
      if (betType === 'straight') {
        const number = typeof bet.value === 'number' ? bet.value : parseInt(bet.value?.toString() || '0');
        if (number < 0 || number > 36) throw new AppError('Invalid straight bet number', 400);
        
        return {
          type: 'straight',
          numbers: [number],
          payout: 35,
          amount,
          description: `Straight ${number}`
        };
      }
      
      if (betType === 'red') {
        return {
          type: 'red',
          numbers: this.RED_NUMBERS,
          payout: 1,
          amount,
          description: 'Red'
        };
      }
      
      if (betType === 'black') {
        const blackNumbers = [];
        for (let i = 1; i <= 36; i++) {
          if (!this.RED_NUMBERS.includes(i)) {
            blackNumbers.push(i);
          }
        }
        return {
          type: 'black',
          numbers: blackNumbers,
          payout: 1,
          amount,
          description: 'Black'
        };
      }
      
      if (betType === 'odd') {
        const oddNumbers = [];
        for (let i = 1; i <= 36; i += 2) {
          oddNumbers.push(i);
        }
        return {
          type: 'odd',
          numbers: oddNumbers,
          payout: 1,
          amount,
          description: 'Odd'
        };
      }
      
      if (betType === 'even') {
        const evenNumbers = [];
        for (let i = 2; i <= 36; i += 2) {
          evenNumbers.push(i);
        }
        return {
          type: 'even',
          numbers: evenNumbers,
          payout: 1,
          amount,
          description: 'Even'
        };
      }
      
      if (betType === 'low') {
        const lowNumbers = [];
        for (let i = 1; i <= 18; i++) {
          lowNumbers.push(i);
        }
        return {
          type: 'low',
          numbers: lowNumbers,
          payout: 1,
          amount,
          description: 'Low (1-18)'
        };
      }
      
      if (betType === 'high') {
        const highNumbers = [];
        for (let i = 19; i <= 36; i++) {
          highNumbers.push(i);
        }
        return {
          type: 'high',
          numbers: highNumbers,
          payout: 1,
          amount,
          description: 'High (19-36)'
        };
      }
      
      if (betType === 'dozen') {
        const dozen = typeof bet.value === 'string' ? bet.value.toLowerCase() : 'first';
        let numbers: number[] = [];
        
        if (dozen === 'first' || dozen === '1st' || dozen === '1') {
          numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        } else if (dozen === 'second' || dozen === '2nd' || dozen === '2') {
          numbers = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
        } else {
          numbers = [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
        }
        
        return {
          type: 'dozen',
          numbers,
          payout: 2,
          amount,
          description: `${dozen} dozen`
        };
      }
      
      // Default to red if unknown
      return {
        type: 'red',
        numbers: this.RED_NUMBERS,
        payout: 1,
        amount,
        description: 'Red (default)'
      };
    });
  }

  private static spinWheel(
    totalLuck: number,
    characterBonus: any
  ): { number: number; color: 'red' | 'black' | 'green' } {
    let number = Math.floor(Math.random() * 37); // 0-36 for European roulette
    
    // Apply luck influence
    const luckModifier = this.calculateLuckModifier(totalLuck);
    
    // Small chance for lucky players to avoid 0
    if (luckModifier > 1.1 && number === 0 && Math.random() < 0.1) {
      number = Math.floor(Math.random() * 36) + 1; // 1-36
    }

    // Bard lucky song: Slight bias toward player-friendly outcomes
    if (characterBonus.className === 'bard' && Math.random() < 0.05) {
      // 5% chance to land on a more common bet (red/black, odd/even)
      number = Math.floor(Math.random() * 36) + 1; // Avoid 0
    }

    // Mage probability manipulation
    if (characterBonus.className === 'mage' && Math.random() < 0.03) {
      // 3% chance for mage to influence outcome slightly
      const adjustment = Math.random() < 0.5 ? -1 : 1;
      number = Math.max(0, Math.min(36, number + adjustment));
    }

    let color: 'red' | 'black' | 'green';
    if (number === 0) {
      color = 'green';
    } else if (this.RED_NUMBERS.includes(number)) {
      color = 'red';
    } else {
      color = 'black';
    }

    return { number, color };
  }

  private static checkWinningBets(bets: RouletteBet[], winningNumber: number): RouletteBet[] {
    return bets.filter(bet => bet.numbers.includes(winningNumber));
  }

  private static hasPatternPrediction(winningBets: RouletteBet[]): boolean {
    // Check if player made strategic bets (multiple bet types)
    const betTypes = new Set(winningBets.map(bet => bet.type));
    return betTypes.size >= 2; // Multiple bet types suggests pattern analysis
  }

  // Multiplayer table management
  static createRouletteTable(
    tableId: string,
    minBet: number = 1,
    maxBet: number = 1000
  ): RouletteTable {
    return {
      id: tableId,
      players: new Map(),
      currentSpin: null,
      gamePhase: 'betting',
      spinTimer: 30, // 30 seconds betting phase
      history: [],
      communityJackpot: 0
    };
  }

  static addPlayerToTable(
    table: RouletteTable,
    userId: string,
    characterClass?: string
  ): RouletteTable {
    if (!table.players.has(userId)) {
      table.players.set(userId, {
        userId,
        bets: [],
        totalBet: 0,
        characterClass
      });
    }
    return table;
  }

  /**
   * Execute multiplayer roulette spin for an entire table
   * Processes all player bets in a single spin, applies character bonuses,
   * and returns results for WebSocket broadcasting
   */
  static async executeMultiplayerSpin(
    tableId: string,
    guildId: string,
    io?: any
  ): Promise<{
    winningNumber: number;
    winningColor: 'red' | 'black' | 'green';
    winners: Array<{ userId: string; payout: number; totalWon: number; characterClass?: string }>;
    totalPayouts: number;
    playerResults: Map<string, { won: number; lost: number; netChange: number }>;
  }> {
    const { RouletteTable: RouletteTableModel, CasinoSession } = await import('../models/schemas');
    const BardAbilities = await import('../services/BardAbilities');

    // Fetch table from database
    const table = await RouletteTableModel.findOne({ tableId, guildId }).exec();
    if (!table) {
      throw new Error(`Roulette table ${tableId} not found`);
    }

    if (table.gamePhase !== 'spinning') {
      throw new Error(`Table ${tableId} is not in spinning phase (current: ${table.gamePhase})`);
    }

    // Batch-fetch all sessions and characters before any loop to avoid N+1 queries
    const { Character } = await import('../models/database');
    const playerIds = table.bets.map((b: any) => b.userId).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    const [sessions, characters] = await Promise.all([
      CasinoSession.find({ userId: { $in: playerIds }, guildId }).exec(),
      Character.find({ userId: { $in: playerIds }, guildId }).exec(),
    ]);
    const sessionMap = new Map(sessions.map((s: any) => [s.userId, s]));
    const characterMap = new Map(characters.map((c: any) => [c.userId, c]));

    // Calculate average luck across all players for wheel spin
    let totalLuck = 0;
    let playerCount = 0;

    // Iterate over the bets array (each element contains a userId and their bets)
    for (const playerBetData of table.bets) {
      const session = sessionMap.get(playerBetData.userId);
      if (session) {
        // Fetch character for luck stat
        const character = characterMap.get(playerBetData.userId);
        if (character && character.stats) {
          totalLuck += character.stats.luck || 50;
          playerCount++;
        }
      }
    }

    const averageLuck = playerCount > 0 ? totalLuck / playerCount : 50;

    // Spin the wheel once for all players
    const { number: winningNumber, color: winningColor } = this.spinWheel(
      averageLuck,
      { className: 'default' } // Use average luck, not character-specific
    );

    // Process each player's bets
    const winners: Array<{ userId: string; payout: number; totalWon: number; characterClass?: string }> = [];
    const playerResults = new Map<string, { won: number; lost: number; netChange: number }>();
    let totalPayouts = 0;

    for (const playerBetData of table.bets) {
      const userId = playerBetData.userId;
      if (playerBetData.bets.length === 0) continue;

      // Fetch player session for character bonuses (using pre-fetched maps)
      const session = sessionMap.get(userId);
      const character = characterMap.get(userId);
      const classBonus = this.buildCharacterBonus(character);
      const characterClass = classBonus.className;

      // Calculate base luck for character bonuses
      const playerLuck = character?.stats?.luck || 50;

      // Check for active Bard buffs for this player
      const playerBardBoost = await BardAbilities.BardAbilities.checkActiveBardBuffs(userId, guildId);

      // Convert all bets to include numbers property - parse in single call for efficiency
      const betsToProcess = playerBetData.bets.map((bet: { type: string; value: number | string; amount: number }) => ({
        type: bet.type,
        amount: bet.amount,
        value: bet.value
      }));
      const parsedBets = this.parseBets(betsToProcess);

      // Check winning bets for this player
      const winningBets = parsedBets.filter((bet: RouletteBet) => 
        bet.numbers.includes(winningNumber)
      );

      // The stake was already charged atomically at placeBet time
      // (RouletteTableManager.placeBet -> EconomyService.spendCoins), so
      // settlement below only ever *credits* what the player is owed.
      const totalBet = playerBetData.bets.reduce((sum: number, bet: { amount: number }) => sum + bet.amount, 0);
      let totalWon = 0;
      let baseWinnings = 0;

      // Calculate base winnings from winning bets (payout multiplier + return of original stake)
      for (const bet of winningBets) {
        baseWinnings += bet.amount * (bet.payout + 1);
      }

      totalWon = baseWinnings;

      // Same outcome classification as playSinglePlayerRoulette
      let outcome: 'win' | 'loss' | 'push' | 'jackpot' = 'loss';
      if (totalWon > totalBet) {
        outcome = totalWon >= totalBet * 10 ? 'jackpot' : 'win';
      } else if (totalWon === totalBet) {
        outcome = 'push';
      }

      // Minimal context shape expected by the CasinoGameEngine.trigger* helpers
      const abilityContext = {
        user: { userId, guildId },
        characterBonus: classBonus
      };

      // Apply character bonuses - same mechanics as playSinglePlayerRoulette, via the shared triggers
      let specialAbility: string | null = null;

      // Loss-reduction abilities refund part of the already-charged stake
      let actualLoss = outcome === 'loss' ? totalBet : 0;

      // Paladin divine blessing - reduce large losses
      if (outcome === 'loss' && characterClass === 'paladin') {
        const protectedLoss = await this.triggerPaladinDivineBlessing(abilityContext, totalBet, actualLoss);
        if (protectedLoss < actualLoss) {
          actualLoss = protectedLoss;
          specialAbility = 'paladin_divine_blessing';
        }
      }

      // Merchant coin multiplication
      if (outcome === 'win' && characterClass === 'merchant') {
        totalWon = await this.triggerMerchantCoinSense(abilityContext, totalWon);
        specialAbility = 'merchant_coin_sense';
      }

      // Warrior battle frenzy on big wins
      if (outcome === 'jackpot' && characterClass === 'warrior') {
        const frenzyBonus = await this.triggerWarriorBattleRage(abilityContext, true);
        totalWon = Math.floor(totalWon * frenzyBonus);
        specialAbility = 'warrior_battle_frenzy';
      }

      // Rogue probability manipulation
      if (outcome === 'loss' && characterClass === 'rogue' && totalBet >= 50) {
        const reducedLoss = await this.triggerRogueSleightOfHand(abilityContext, totalBet);
        if (reducedLoss < actualLoss) {
          actualLoss = reducedLoss;
          specialAbility = 'rogue_probability_twist';
        }
      }

      // Bard: Apply harmony boost from lucky song
      if (playerBardBoost > 0 && totalWon > 0) {
        const bardBonus = Math.floor(totalWon * playerBardBoost);
        totalWon += bardBonus;
        specialAbility = specialAbility || 'bard_harmony_boost';
      }

      // Mage: Double XP for pattern betting (multiple bet types) - handled via xpMultiplier below
      const betTypes = new Set(winningBets.map((b: RouletteBet) => b.type));
      const xpMultiplier = (characterClass === 'mage' && betTypes.size >= 2) ? 2.0 : 1.0;

      // Amount owed back to the player: winnings (which already include the
      // returned stake of winning bets) plus any ability-protected refund.
      // The stake itself was charged at placeBet, so never deduct here -
      // settling the net delta would double-charge losing players.
      const lossRefund = outcome === 'loss' ? totalBet - actualLoss : 0;
      const payout = totalWon + lossRefund;
      const netChange = payout - totalBet;

      if (payout > 0) {
        await EconomyService.addCoins(userId, guildId, payout);
      }

      // Award XP (Character is the single owner of level/xp progression)
      if (character) {
        const xpGain = Math.floor(
          this.calculateXpGain(totalBet, netChange > 0 ? 'win' : 'loss', character.level || 1)
          * xpMultiplier
        );
        if (xpGain > 0) {
          await CharacterService.levelUpCharacter(userId, guildId, xpGain);
        }
      }

      // Track results
      playerResults.set(userId, {
        won: totalWon,
        lost: actualLoss,
        netChange
      });

      if (netChange > 0) {
        winners.push({
          userId,
          payout: netChange,
          totalWon,
          characterClass
        });
        totalPayouts += netChange;
      }

      // Log to casino game log. A logging failure must never abort settlement
      // for the remaining players, so it is contained per-player.
      try {
        const { CasinoGameLog } = await import('../models/schemas');
        await CasinoGameLog.create({
          logId: `roulette_${tableId}_${Date.now()}_${userId}`,
          userId,
          guildId,
          characterId: character?._id || null,
          sessionId: session?.sessionId || `session_${userId}`,
          gameType: 'roulette',
          tableId,
          gameId: `game_${Date.now()}`,
          bet: totalBet,
          result: outcome === 'push' ? 'push' : netChange > 0 ? 'win' : 'loss',
          payout,
          netChange,
          gameData: {
            multiplayer: true,
            winningNumber,
            winningColor,
            bets: playerBetData.bets.map((b: { type: string; amount: number }, index: number) => ({
              type: b.type,
              amount: b.amount,
              // Check if the corresponding parsed bet is in the winning bets array
              won: parsedBets[index] && winningBets.includes(parsedBets[index])
            })),
            characterBonus: specialAbility,
            bardBoost: playerBardBoost,
            xpMultiplier
          },
          characterClass,
          characterLevel: character?.level || 1,
          characterLuck: playerLuck,
          bonuses: []
        });
      } catch (logError) {
        console.error(`[RouletteEngine] Failed to log multiplayer result for ${userId}:`, logError);
      }
    }

    // Update table history using lastResults array
    table.lastResults.push(winningNumber);

    // Keep only last 20 spins in history
    if (table.lastResults.length > 20) {
      table.lastResults = table.lastResults.slice(-20);
    }

    // Clear all player bets after spin
    table.bets = [];

    // Save updated table
    await table.save();

    console.log(`[RouletteEngine] Multiplayer spin executed for table ${tableId}: ${winningNumber} ${winningColor}, ${winners.length} winners, ${totalPayouts} total payout`);

    return {
      winningNumber,
      winningColor,
      winners,
      totalPayouts,
      playerResults
    };
  }

  static getRouletteGameInfo(): {
    betTypes: typeof RouletteEngine.BET_TYPES;
    tips: string[];
    characterBonuses: { [className: string]: string };
    payoutChart: { [betType: string]: { odds: string; payout: string } };
  } {
    return {
      betTypes: this.BET_TYPES,
      tips: [
        'European roulette has better odds than American (no 00)',
        'Outside bets have lower payouts but better odds',
        'Straight bets pay 35:1 but have 2.7% chance',
        'Red/Black, Odd/Even, High/Low are safest bets',
        'Character classes provide unique advantages'
      ],
      characterBonuses: {
        warrior: 'Battle Frenzy: Bonus multiplier on jackpot wins',
        mage: 'Pattern Insight: Double XP for strategic betting',
        rogue: 'Probability Twist: Reduced losses on failed bets',
        merchant: 'Coin Multiplication: 20% bonus on all winnings',
        bard: 'Harmony Boost: Benefits all players when winning',
        paladin: 'Divine Luck: Small losses converted to pushes'
      },
      payoutChart: {
        'Straight (Single Number)': { odds: '2.7%', payout: '35:1' },
        'Split (Two Numbers)': { odds: '5.4%', payout: '17:1' },
        'Street (Three Numbers)': { odds: '8.1%', payout: '11:1' },
        'Corner (Four Numbers)': { odds: '10.8%', payout: '8:1' },
        'Line (Six Numbers)': { odds: '16.2%', payout: '5:1' },
        'Dozen/Column': { odds: '32.4%', payout: '2:1' },
        'Red/Black/Odd/Even': { odds: '48.6%', payout: '1:1' }
      }
    };
  }
}