import { CasinoGameEngine, GameResult } from './CasinoGameEngine';
import { AppError } from '../middleware/errorHandler';

export interface SlotReel {
  symbol: string;
  emoji: string;
  rarity: number; // Lower = rarer
  payout: number; // Multiplier for bet
}

export interface SlotMachineResult extends GameResult {
  reels: string[];
  symbols: SlotReel[];
  winType: 'none' | 'pair' | 'three_of_kind' | 'jackpot' | 'special_combo';
  machineType: string;
}

export class SlotsEngine extends CasinoGameEngine {
  private static readonly SLOT_SYMBOLS: SlotReel[] = [
    { symbol: 'cherry', emoji: '🍒', rarity: 8, payout: 3 },
    { symbol: 'lemon', emoji: '🍋', rarity: 7, payout: 4 },
    { symbol: 'orange', emoji: '🍊', rarity: 6, payout: 5 },
    { symbol: 'grape', emoji: '🍇', rarity: 5, payout: 7 },
    { symbol: 'bell', emoji: '🔔', rarity: 4, payout: 10 },
    { symbol: 'diamond', emoji: '💎', rarity: 2, payout: 25 },
    { symbol: 'star', emoji: '⭐', rarity: 1, payout: 50 },
    { symbol: 'seven', emoji: '7️⃣', rarity: 1, payout: 100 }
  ];

  private static readonly THEMED_SYMBOLS: { [theme: string]: SlotReel[] } = {
    dragon: [
      { symbol: 'gold', emoji: '🏆', rarity: 8, payout: 4 },
      { symbol: 'sword', emoji: '⚔️', rarity: 6, payout: 6 },
      { symbol: 'shield', emoji: '🛡️', rarity: 5, payout: 8 },
      { symbol: 'dragon', emoji: '🐉', rarity: 2, payout: 30 },
      { symbol: 'treasure', emoji: '💰', rarity: 1, payout: 75 }
    ],
    magic: [
      { symbol: 'potion', emoji: '🧪', rarity: 7, payout: 5 },
      { symbol: 'wand', emoji: '🪄', rarity: 5, payout: 8 },
      { symbol: 'crystal', emoji: '🔮', rarity: 3, payout: 15 },
      { symbol: 'grimoire', emoji: '📚', rarity: 2, payout: 25 },
      { symbol: 'phoenix', emoji: '🔥', rarity: 1, payout: 60 }
    ],
    warrior: [
      { symbol: 'helm', emoji: '⛑️', rarity: 8, payout: 3 },
      { symbol: 'axe', emoji: '🪓', rarity: 6, payout: 6 },
      { symbol: 'armor', emoji: '🥋', rarity: 4, payout: 10 },
      { symbol: 'crown', emoji: '👑', rarity: 2, payout: 25 },
      { symbol: 'victory', emoji: '🏆', rarity: 1, payout: 80 }
    ]
  };

  static async spin(
    userId: string,
    guildId: string,
    bet: number,
    machineId: string,
    machineTheme: string = 'classic'
  ): Promise<SlotMachineResult> {
    // Get player context (character, stats, bonuses)
    const context = await this.getPlayerContext(userId, guildId);
    
    // Check energy availability
    const energyRequired = Math.max(1, Math.floor(bet / 50));
    if (!(await this.checkEnergyAvailable(userId, guildId, energyRequired))) {
      throw new AppError('Insufficient energy to play. Rest or wait for energy to regenerate.', 400);
    }

    // Select symbol set based on machine theme
    const symbolSet = this.THEMED_SYMBOLS[machineTheme] || this.SLOT_SYMBOLS;
    
    // Calculate luck modifier from character
    const luckModifier = this.calculateLuckModifier(context.totalLuck);
    
    // Generate reels with luck influence
    const reels = this.generateReels(symbolSet, luckModifier, context);
    const winAnalysis = this.analyzeWin(reels, symbolSet);
    
    // Calculate base winnings
    let baseWinnings = winAnalysis.payout * bet;
    let outcome: 'win' | 'loss' | 'push' | 'jackpot' = 'loss';
    
    if (baseWinnings > 0) {
      outcome = winAnalysis.winType === 'jackpot' ? 'jackpot' : 'win';
    }

    // Apply character-specific bonuses
    let bonusMultiplier = 1.0;
    let specialAbilityTriggered = '';

    // Warrior battle rage (comeback bonus on wins)
    if (outcome === 'win' && context.characterBonus.className === 'warrior') {
      const warriorBonus = await this.triggerWarriorBattleRage(context, true);
      if (warriorBonus > 1.0) {
        baseWinnings *= warriorBonus;
        bonusMultiplier *= warriorBonus;
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

    // Rogue sleight of hand (reduce losses)
    let actualBetLoss = bet;
    if (outcome === 'loss' && context.characterBonus.className === 'rogue') {
      actualBetLoss = await this.triggerRogueSleightOfHand(context, bet);
      if (actualBetLoss < bet) {
        specialAbilityTriggered = 'rogue_sleight_of_hand';
      }
    }

    // Paladin divine blessing (reduce large losses)
    if (outcome === 'loss' && context.characterBonus.className === 'paladin') {
      const protectedLoss = await this.triggerPaladinDivineBlessing(context, bet, actualBetLoss);
      if (protectedLoss < actualBetLoss) {
        actualBetLoss = protectedLoss;
        specialAbilityTriggered = 'paladin_divine_blessing';
      }
    }

    // Calculate final payout. The full bet is charged by processGameResult, so on
    // a loss the payout is the ability-protected refund (bet - actualBetLoss,
    // 0 for a plain loss) - otherwise Rogue/Paladin loss reduction would be a no-op.
    const finalPayout = outcome === 'loss' ? bet - actualBetLoss : baseWinnings;
    
    // Calculate XP gain
    const xpGained = this.calculateXpGain(bet, outcome, context.character?.level || 1);

    const result: SlotMachineResult = {
      outcome,
      baseWinnings,
      bonusMultiplier,
      finalPayout,
      xpGained,
      specialAbilityTriggered,
      characterBonus: context.characterBonus,
      reels: reels.map(r => r.emoji),
      symbols: reels,
      winType: winAnalysis.winType,
      machineType: machineTheme
    };

    // Process the game result (update balances, XP, etc.)
    return await this.processGameResult(
      userId,
      guildId,
      'slots',
      bet,
      result,
      {
        machineId,
        theme: machineTheme,
        reels: result.reels,
        winType: result.winType,
        luckModifier,
        specialAbility: specialAbilityTriggered
      }
    ) as SlotMachineResult;
  }

  private static generateReels(
    symbolSet: SlotReel[],
    luckModifier: number,
    context: any
  ): SlotReel[] {
    const reels: SlotReel[] = [];
    
    for (let i = 0; i < 3; i++) {
      // Create weighted probability based on rarity and luck
      const weightedSymbols: SlotReel[] = [];
      
      for (const symbol of symbolSet) {
        // Higher luck makes rare symbols more likely
        const adjustedRarity = Math.max(1, symbol.rarity / luckModifier);
        const weight = Math.floor(10 - adjustedRarity);
        
        for (let w = 0; w < weight; w++) {
          weightedSymbols.push(symbol);
        }
      }
      
      // Mage special ability: Arcane Insight (slight bias toward matching symbols on 3rd reel)
      if (context.characterBonus.className === 'mage' && i === 2 && reels.length === 2) {
        const firstSymbol = reels[0];
        const secondSymbol = reels[1];
        
        if (firstSymbol.symbol === secondSymbol.symbol && Math.random() < 0.15) {
          // 15% chance to complete the triple for mages
          reels.push(firstSymbol);
          continue;
        }
      }
      
      // Select random symbol from weighted array
      const randomIndex = Math.floor(Math.random() * weightedSymbols.length);
      reels.push(weightedSymbols[randomIndex]);
    }
    
    return reels;
  }

  private static analyzeWin(
    reels: SlotReel[],
    symbolSet: SlotReel[]
  ): { winType: 'none' | 'pair' | 'three_of_kind' | 'jackpot' | 'special_combo'; payout: number } {
    const [first, second, third] = reels;
    
    // Check for three of a kind (jackpot conditions)
    if (first.symbol === second.symbol && second.symbol === third.symbol) {
      const symbol = symbolSet.find(s => s.symbol === first.symbol);
      
      // Special jackpot for rarest symbols
      if (symbol && symbol.rarity <= 1) {
        return { winType: 'jackpot', payout: symbol.payout * 2 };
      }
      
      return { winType: 'three_of_kind', payout: symbol?.payout || 0 };
    }
    
    // Check for pairs
    if (first.symbol === second.symbol || second.symbol === third.symbol || first.symbol === third.symbol) {
      // Use the matching symbol's payout divided by 2
      let matchingSymbol: SlotReel | undefined;
      
      if (first.symbol === second.symbol) matchingSymbol = first;
      else if (second.symbol === third.symbol) matchingSymbol = second;
      else if (first.symbol === third.symbol) matchingSymbol = first;
      
      return { winType: 'pair', payout: Math.floor((matchingSymbol?.payout || 0) / 2) };
    }
    
    // Check for special combinations (different symbols but valuable)
    const symbolNames = reels.map(r => r.symbol).sort();
    const specialCombos: { [key: string]: number } = {
      'diamond,seven,star': 20, // High value combo
      'bell,diamond,star': 15,
      'dragon,phoenix,treasure': 25, // Themed combo
      'crystal,grimoire,phoenix': 20,
      'crown,sword,victory': 18
    };
    
    const comboKey = symbolNames.join(',');
    if (specialCombos[comboKey]) {
      return { winType: 'special_combo', payout: specialCombos[comboKey] };
    }
    
    return { winType: 'none', payout: 0 };
  }

  static getSlotMachineInfo(theme: string): {
    theme: string;
    symbols: SlotReel[];
    description: string;
    specialFeatures: string[];
  } {
    const symbols = this.THEMED_SYMBOLS[theme] || this.SLOT_SYMBOLS;
    
    const themeInfo: { [key: string]: { description: string; features: string[] } } = {
      classic: {
        description: 'Traditional slot machine with fruits and classic symbols',
        features: ['Standard payouts', 'Reliable gameplay', 'Good for beginners']
      },
      dragon: {
        description: 'Dragon-themed machine with fantasy adventure symbols',
        features: ['Higher variance', 'Epic jackpots', 'Warrior class bonus']
      },
      magic: {
        description: 'Mystical machine filled with magical artifacts',
        features: ['Mage class synergy', 'Arcane bonuses', 'Spell-powered wins']
      },
      warrior: {
        description: 'Battle-themed machine for brave fighters',
        features: ['Combat rewards', 'Victory multipliers', 'Honor-based payouts']
      }
    };
    
    return {
      theme,
      symbols,
      description: themeInfo[theme]?.description || themeInfo.classic.description,
      specialFeatures: themeInfo[theme]?.features || themeInfo.classic.features
    };
  }

  static getSlotsGameInfo(): {
    themes: string[];
    payoutTable: { [symbol: string]: number };
    characterBonuses: { [className: string]: string };
    tips: string[];
  } {
    return {
      themes: ['classic', 'dragon', 'magic', 'warrior'],
      payoutTable: {
        '🍒 Cherry': 3,
        '🍋 Lemon': 4,
        '🍊 Orange': 5,
        '🍇 Grapes': 6,
        '🔔 Bell': 8,
        '💎 Diamond': 12,
        '⭐ Star': 20,
        '🐉 Dragon': 25,
        '🔮 Crystal': 30,
        '⚔️ Sword': 35
      },
      characterBonuses: {
        warrior: 'Battle Fury: Higher payouts on warrior-themed symbols',
        mage: 'Arcane Insight: Better odds on magic-themed machines',
        rogue: 'Lucky Charm: Reduced losses on failed spins',
        merchant: 'Coin Sense: 20% bonus on all winnings',
        bard: 'Harmony: Social bonuses affect nearby players',
        paladin: 'Divine Protection: Shields from major losses'
      },
      tips: [
        'Different themes favor different character classes',
        'Higher luck stat improves symbol alignment',
        'Three-of-a-kind pays the most',
        'Progressive jackpots grow with every spin',
        'Character abilities can trigger special bonuses'
      ]
    };
  }
}