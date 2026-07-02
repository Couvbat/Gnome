import { CasinoGameEngine, GameResult } from './CasinoGameEngine';
import type { IBlackjackPlayer } from '../models/database';
import { AppError } from '../middleware/errorHandler';
import { CharacterService } from '../services/CharacterService';
import { EconomyService } from '../services/EconomyService';

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  value: number;
  isAce: boolean;
}

export interface BlackjackHand {
  cards: Card[];
  value: number;
  isBusted: boolean;
  isBlackjack: boolean;
  isSoft: boolean; // Contains usable ace
}

export interface BlackjackGameResult extends GameResult {
  playerHand: BlackjackHand;
  dealerHand: BlackjackHand;
  gameType: 'blackjack' | 'push' | 'bust' | 'dealer_bust';
  insuranceBet?: number;
  insuranceWon?: boolean;
  doubleDowned?: boolean;
  split?: boolean;
}

export interface BlackjackTable {
  id: string;
  players: Map<string, {
    userId: string;
    bet: number;
    hand: BlackjackHand;
    status: 'playing' | 'standing' | 'busted' | 'blackjack' | 'waiting';
    insuranceBet?: number;
    doubleDowned?: boolean;
    characterClass?: string;
  }>;
  dealer: {
    hand: BlackjackHand;
    hiddenCard?: Card;
  };
  deck: Card[];
  gamePhase: 'betting' | 'dealing' | 'playing' | 'dealer_turn' | 'finished';
  currentPlayer?: string;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
}

export class BlackjackEngine extends CasinoGameEngine {
  private static readonly SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  private static readonly RANKS: { rank: Card['rank'], value: number }[] = [
    { rank: 'A', value: 11 }, { rank: '2', value: 2 }, { rank: '3', value: 3 },
    { rank: '4', value: 4 }, { rank: '5', value: 5 }, { rank: '6', value: 6 },
    { rank: '7', value: 7 }, { rank: '8', value: 8 }, { rank: '9', value: 9 },
    { rank: '10', value: 10 }, { rank: 'J', value: 10 }, { rank: 'Q', value: 10 }, { rank: 'K', value: 10 }
  ];

  // Single-player blackjack game
  static async playSinglePlayerBlackjack(
    userId: string,
    guildId: string,
    bet: number,
    strategy?: 'hit' | 'stand' | 'double'
  ): Promise<BlackjackGameResult> {
    // Get player context
    const context = await this.getPlayerContext(userId, guildId);
    
    // Check energy
    const energyRequired = Math.max(2, Math.floor(bet / 50)); // Blackjack requires more energy
    if (!(await this.checkEnergyAvailable(userId, guildId, energyRequired))) {
      throw new AppError('Insufficient energy for blackjack. This game requires more energy.', 400);
    }

    // Create fresh deck
    const deck = this.createShuffledDeck();
    
    // Deal initial cards
    const playerHand = this.createHand([this.drawCard(deck), this.drawCard(deck)]);
    const dealerUpCard = this.drawCard(deck);
    const dealerHiddenCard = this.drawCard(deck);
    const dealerHand = this.createHand([dealerUpCard, dealerHiddenCard]);

    // Character-specific insights
    let characterAdvice = '';
    let bonusInfo = '';

    // Mage card reading ability
    if (context.characterBonus.className === 'mage' && Math.random() < 0.3) {
      characterAdvice = this.getMageCardAdvice(playerHand, dealerUpCard, deck);
      bonusInfo = 'mage_card_reading';
    }

    // Rogue card counting simulation
    if (context.characterBonus.className === 'rogue') {
      const count = this.simulateCardCount(deck, [playerHand, dealerHand]);
      if (count > 5) {
        characterAdvice = 'Card count suggests favorable odds for aggressive play';
        bonusInfo = 'rogue_card_counting';
      }
    }

    // Check for immediate blackjack
    if (playerHand.isBlackjack) {
      const dealerBlackjack = dealerHand.isBlackjack;
      let outcome: 'win' | 'push' | 'jackpot' = dealerBlackjack ? 'push' : 'jackpot';
      let payout = dealerBlackjack ? bet : bet * 2.5; // Blackjack pays 3:2
      
      // Merchant bonus for blackjack
      if (context.characterBonus.className === 'merchant' && outcome === 'jackpot') {
        payout *= 1.2;
        bonusInfo = 'merchant_coin_sense';
      }

      const result: BlackjackGameResult = {
        outcome,
        baseWinnings: payout,
        bonusMultiplier: outcome === 'jackpot' && context.characterBonus.className === 'merchant' ? 1.2 : 1.0,
        finalPayout: payout,
        xpGained: this.calculateXpGain(bet, outcome, context.character?.level || 1) * (outcome === 'jackpot' ? 2.0 : 1.0),
        specialAbilityTriggered: bonusInfo,
        characterBonus: context.characterBonus,
        playerHand,
        dealerHand,
        gameType: outcome === 'push' ? 'push' : 'blackjack'
      };

      return await this.processGameResult(userId, guildId, 'blackjack', bet, result, {
        playerCards: playerHand.cards.map(c => `${c.rank}${c.suit[0]}`),
        dealerCards: dealerHand.cards.map(c => `${c.rank}${c.suit[0]}`),
        playerValue: playerHand.value,
        dealerValue: dealerHand.value,
        gameType: 'natural_blackjack',
        characterAdvice,
        bonusInfo
      }) as BlackjackGameResult;
    }

    // Player decision phase (simplified auto-play with character bonuses)
    let finalPlayerHand = playerHand;
    let doubleDowned = false;
    
    // Character-influenced basic strategy
    const recommendedAction = this.getCharacterBasicStrategy(
      playerHand, 
      dealerUpCard, 
      context.characterBonus.className
    );

    if (strategy) {
      // Player provided strategy
      finalPlayerHand = await this.executePlayerStrategy(strategy, playerHand, deck, bet);
      doubleDowned = strategy === 'double';
    } else {
      // Auto-play with character strategy
      finalPlayerHand = await this.executePlayerStrategy(recommendedAction, playerHand, deck, bet);
      doubleDowned = recommendedAction === 'double';
    }

    // Dealer plays
    let finalDealerHand = dealerHand;
    if (!finalPlayerHand.isBusted) {
      finalDealerHand = this.playDealerHand(dealerHand, deck);
    }

    // Determine outcome
    let outcome: 'win' | 'loss' | 'push' | 'jackpot' = 'loss';
    let baseWinnings = 0;
    let gameType: BlackjackGameResult['gameType'] = 'bust';

    if (finalPlayerHand.isBusted) {
      outcome = 'loss';
      gameType = 'bust';
    } else if (finalDealerHand.isBusted) {
      outcome = 'win';
      gameType = 'dealer_bust';
      baseWinnings = bet * (doubleDowned ? 2 : 1);
    } else {
      const playerValue = finalPlayerHand.value;
      const dealerValue = finalDealerHand.value;
      
      if (playerValue > dealerValue) {
        outcome = 'win';
        gameType = 'blackjack';
        baseWinnings = bet * (doubleDowned ? 2 : 1);
      } else if (playerValue === dealerValue) {
        outcome = 'push';
        gameType = 'push';
        baseWinnings = bet; // Return bet
      } else {
        outcome = 'loss';
        gameType = 'blackjack';
      }
    }

    // Apply character bonuses
    let bonusMultiplier = 1.0;
    let specialAbilityTriggered = bonusInfo;

    // Rogue sleight of hand (reduce losses)
    let actualBetLoss = bet;
    if (outcome === 'loss' && context.characterBonus.className === 'rogue') {
      actualBetLoss = await this.triggerRogueSleightOfHand(context, bet);
      if (actualBetLoss < bet) {
        baseWinnings = actualBetLoss; // Reduced loss
        specialAbilityTriggered = 'rogue_sleight_of_hand';
      }
    }

    // Paladin divine protection
    if (outcome === 'loss' && context.characterBonus.className === 'paladin') {
      const protectedBet = await this.triggerPaladinDivineBlessing(context, bet, actualBetLoss);
      if (protectedBet < actualBetLoss) {
        outcome = 'push'; // Convert loss to push
        baseWinnings = protectedBet;
        specialAbilityTriggered = 'paladin_divine_blessing';
      }
    }

    // Warrior comeback bonus
    if (outcome === 'win' && context.characterBonus.className === 'warrior' && finalPlayerHand.value >= 19) {
      const warriorBonus = await this.triggerWarriorBattleRage(context, true);
      baseWinnings *= warriorBonus;
      bonusMultiplier = warriorBonus;
      specialAbilityTriggered = 'warrior_battle_rage';
    }

    // Merchant coin sense
    if (outcome === 'win' && context.characterBonus.className === 'merchant') {
      baseWinnings = await this.triggerMerchantCoinSense(context, baseWinnings);
      bonusMultiplier = 1.2;
      specialAbilityTriggered = 'merchant_coin_sense';
    }

    // Calculate XP (more XP for skilled play and character bonuses)
    let xpMultiplier = 1.0;
    if (context.characterBonus.className === 'mage' && characterAdvice) {
      xpMultiplier = 1.5; // Bonus XP for using mage insights
    }

    const result: BlackjackGameResult = {
      outcome,
      baseWinnings,
      bonusMultiplier,
      finalPayout: baseWinnings,
      xpGained: this.calculateXpGain(bet, outcome, context.character?.level || 1) * xpMultiplier,
      specialAbilityTriggered,
      characterBonus: context.characterBonus,
      playerHand: finalPlayerHand,
      dealerHand: finalDealerHand,
      gameType,
      doubleDowned
    };

    return await this.processGameResult(userId, guildId, 'blackjack', bet, result, {
      playerCards: finalPlayerHand.cards.map(c => `${c.rank}${c.suit[0]}`),
      dealerCards: finalDealerHand.cards.map(c => `${c.rank}${c.suit[0]}`),
      playerValue: finalPlayerHand.value,
      dealerValue: finalDealerHand.value,
      gameType,
      characterAdvice,
      recommendedAction,
      doubleDowned,
      luckModifier: this.calculateLuckModifier(context.totalLuck)
    }) as BlackjackGameResult;
  }

  private static createShuffledDeck(): Card[] {
    const deck: Card[] = [];
    
    for (const suit of this.SUITS) {
      for (const { rank, value } of this.RANKS) {
        deck.push({
          suit,
          rank,
          value,
          isAce: rank === 'A'
        });
      }
    }
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  private static drawCard(deck: Card[]): Card {
    const card = deck.pop();
    if (!card) {
      throw new Error('Deck is empty');
    }
    return card;
  }

  private static createHand(cards: Card[]): BlackjackHand {
    const hand = this.calculateHandValue(cards);
    return {
      cards,
      value: hand.value,
      isBusted: hand.value > 21,
      isBlackjack: hand.value === 21 && cards.length === 2,
      isSoft: hand.isSoft
    };
  }

  private static calculateHandValue(cards: Card[]): { value: number; isSoft: boolean } {
    let value = 0;
    let aces = 0;
    
    for (const card of cards) {
      if (card.isAce) {
        aces++;
        value += 11;
      } else {
        value += card.value;
      }
    }
    
    // Adjust for aces
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    return {
      value,
      isSoft: aces > 0 && value <= 21
    };
  }

  private static getMageCardAdvice(playerHand: BlackjackHand, dealerUpCard: Card, deck: Card[]): string {
    const remaining = deck.length;
    const highCards = deck.filter(c => c.value >= 10).length;
    const lowCards = deck.filter(c => c.value <= 6).length;
    
    const playerValue = playerHand.value;
    const dealerValue = dealerUpCard.value;
    
    if (playerValue <= 11) {
      return `🔮 Next card preview: ${(highCards / remaining * 100).toFixed(0)}% chance of 10-value card`;
    } else if (playerValue >= 17) {
      return `🔮 Dealer showing ${dealerValue}, ${(highCards / remaining * 100).toFixed(0)}% chance they bust`;
    } else {
      return `🔮 Deck is ${highCards > lowCards ? 'rich' : 'poor'} in high cards (${(highCards / remaining * 100).toFixed(0)}%)`;
    }
  }

  private static simulateCardCount(deck: Card[], hands: BlackjackHand[]): number {
    // Simplified Hi-Lo count simulation
    let count = 0;
    
    // Count visible cards
    for (const hand of hands) {
      for (const card of hand.cards) {
        if (card.value <= 6) {
          count += 1; // Low cards favor player
        } else if (card.value >= 10) {
          count -= 1; // High cards favor dealer
        }
      }
    }
    
    return count;
  }

  private static getCharacterBasicStrategy(
    playerHand: BlackjackHand, 
    dealerUpCard: Card, 
    characterClass?: string
  ): 'hit' | 'stand' | 'double' {
    const playerValue = playerHand.value;
    const dealerValue = dealerUpCard.value;
    
    // Basic strategy with character modifications
    if (playerValue <= 11) {
      return playerHand.cards.length === 2 ? 'double' : 'hit';
    } else if (playerValue >= 17) {
      return 'stand';
    } else if (playerValue >= 13 && dealerValue <= 6) {
      return 'stand';
    } else if (playerValue === 12 && dealerValue >= 4 && dealerValue <= 6) {
      return 'stand';
    }
    
    // Character-specific strategy adjustments
    switch (characterClass) {
      case 'warrior':
        // More aggressive, double more often
        return playerValue === 12 && dealerValue <= 6 ? 'double' : 'hit';
      
      case 'rogue':
        // Conservative, avoid busting
        return playerValue >= 16 ? 'stand' : 'hit';
      
      case 'mage':
        // Mathematical precision
        return (playerValue === 16 && dealerValue >= 7) ? 'hit' : 
               (playerValue >= 13 && dealerValue <= 6) ? 'stand' : 'hit';
      
      default:
        return 'hit';
    }
  }

  private static async executePlayerStrategy(
    strategy: 'hit' | 'stand' | 'double',
    hand: BlackjackHand,
    deck: Card[],
    bet: number
  ): Promise<BlackjackHand> {
    if (strategy === 'stand') {
      return hand;
    }
    
    if (strategy === 'double' && hand.cards.length === 2) {
      // Double down - take exactly one card
      const newCard = this.drawCard(deck);
      return this.createHand([...hand.cards, newCard]);
    }
    
    // Hit strategy
    let currentHand = hand;
    while (currentHand.value < 17 && !currentHand.isBusted) {
      const newCard = this.drawCard(deck);
      currentHand = this.createHand([...currentHand.cards, newCard]);
      
      if (currentHand.value >= 17) break;
    }
    
    return currentHand;
  }

  private static playDealerHand(dealerHand: BlackjackHand, deck: Card[]): BlackjackHand {
    let currentHand = dealerHand;
    
    while (currentHand.value < 17) {
      const newCard = this.drawCard(deck);
      currentHand = this.createHand([...currentHand.cards, newCard]);
    }
    
    return currentHand;
  }

  static getBlackjackGameInfo(): {
    basicStrategy: string[];
    characterStrategies: { [className: string]: string };
    payouts: { [outcome: string]: string };
  } {
    return {
      basicStrategy: [
        'Always hit on 11 or below',
        'Always stand on 17 or above', 
        'Stand on 12-16 when dealer shows 2-6',
        'Hit on 12-16 when dealer shows 7-A',
        'Double on 10-11 when dealer shows 2-9'
      ],
      characterStrategies: {
        warrior: 'Aggressive: More doubles and high-risk plays',
        mage: 'Analytical: Card reading and mathematical precision',
        rogue: 'Conservative: Card counting and loss avoidance',
        merchant: 'Profit-focused: 20% bonus on all winnings',
        bard: 'Intuitive: Luck-based decisions and social bonuses',
        paladin: 'Protected: Divine blessing reduces major losses'
      },
      payouts: {
        blackjack: '3:2 (150% payout)',
        win: '1:1 (100% payout)',
        push: 'Bet returned',
        insurance: '2:1 if dealer has blackjack'
      }
    };
  }

  // ==================== MULTIPLAYER METHODS ====================

  /**
   * Deal initial cards to all players and dealer
   */
  static async dealInitialCards(
    tableId: string,
    guildId: string
  ): Promise<{
    players: Array<{
      userId: string;
      characterClass: string;
      bet: number;
      hand: Card[];
      handValue: number;
      isStanding: boolean;
      isBusted: boolean;
      hasPlacedBet: boolean;
    }>;
    dealer: {
      hand: Card[];
      handValue: number;
      isStanding: boolean;
      isBusted: boolean;
    };
  }> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      throw new Error(`Blackjack table ${tableId} not found`);
    }

    // Create shuffled deck (6 decks for multiplayer)
    const deck = [
      ...this.createShuffledDeck(),
      ...this.createShuffledDeck(),
      ...this.createShuffledDeck(),
      ...this.createShuffledDeck(),
      ...this.createShuffledDeck(),
      ...this.createShuffledDeck()
    ];

    // Shuffle all 6 decks together
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal 2 cards to each player
    for (const player of table.players) {
      if (!player.hasPlacedBet) continue;

      const card1 = deck.pop()!;
      const card2 = deck.pop()!;
      const hand = this.createHand([card1, card2]);

      player.hand = [card1, card2];
      player.handValue = hand.value;
      player.isBusted = hand.isBusted;
    }

    // Deal 2 cards to dealer (1 face up, 1 face down)
    const dealerCard1 = deck.pop()!;
    const dealerCard2 = deck.pop()!;
    const dealerHand = this.createHand([dealerCard1, dealerCard2]);

    table.dealer.hand = [dealerCard1, dealerCard2];
    table.dealer.handValue = dealerHand.value;

    // Store remaining deck in table
    table.deck = deck;

    await table.save();

    console.log(`[BlackjackEngine] Dealt initial cards to ${table.players.filter((p: IBlackjackPlayer) => p.hasPlacedBet).length} players on table ${tableId}`);

    return {
      players: table.players.map((p: IBlackjackPlayer) => ({
        userId: p.userId,
        characterClass: p.characterClass,
        bet: p.bet,
        hand: p.hand,
        handValue: p.handValue,
        isStanding: p.isStanding,
        isBusted: p.isBusted,
        hasPlacedBet: p.hasPlacedBet
      })),
      dealer: {
        hand: table.dealer.hand,
        handValue: table.dealer.handValue,
        isStanding: table.dealer.isStanding,
        isBusted: table.dealer.isBusted
      }
    };
  }

  /**
   * Process player hit action (draw another card)
   */
  static async processPlayerHit(
    tableId: string,
    guildId: string,
    userId: string
  ): Promise<{ card: Card; handValue: number; isBusted: boolean }> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      throw new Error(`Blackjack table ${tableId} not found`);
    }

    const player = table.players.find((p: IBlackjackPlayer) => p.userId === userId);
    if (!player) {
      throw new Error(`Player ${userId} not found at table ${tableId}`);
    }

    if (player.isStanding || player.isBusted) {
      throw new Error('Player has already finished their turn');
    }

    // Draw card from deck
    const card = table.deck.pop();
    if (!card) {
      throw new Error('Deck is empty - this should not happen');
    }

    // Add to player hand
    player.hand.push(card);
    const newHand = this.createHand(player.hand);

    player.handValue = newHand.value;
    player.isBusted = newHand.isBusted;

    await table.save();

    console.log(`[BlackjackEngine] Player ${userId} hit on table ${tableId}, drew ${card.rank} of ${card.suit} (hand value: ${newHand.value}, busted: ${newHand.isBusted})`);

    return {
      card,
      handValue: newHand.value,
      isBusted: newHand.isBusted
    };
  }

  /**
   * Process player stand action (end turn)
   */
  static async processPlayerStand(
    tableId: string,
    guildId: string,
    userId: string
  ): Promise<void> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      throw new Error(`Blackjack table ${tableId} not found`);
    }

    const player = table.players.find((p: IBlackjackPlayer) => p.userId === userId);
    if (!player) {
      throw new Error(`Player ${userId} not found at table ${tableId}`);
    }

    player.isStanding = true;
    await table.save();

    console.log(`[BlackjackEngine] Player ${userId} stood on table ${tableId} with hand value ${player.handValue}`);
  }

  /**
   * Play dealer's turn and calculate all payouts
   */
  static async playDealerTurnMultiplayer(
    tableId: string,
    guildId: string,
    io?: any
  ): Promise<{
    dealerHand: Card[];
    dealerValue: number;
    dealerBusted: boolean;
    playerResults: Array<{
      userId: string;
      outcome: 'win' | 'loss' | 'push' | 'blackjack';
      payout: number;
      netChange: number;
      handValue: number;
      characterBonus?: string;
    }>;
  }> {
    const { BlackjackTable, CasinoSession, CasinoGameLog } = await import('../models/schemas');
    const BardAbilities = await import('../services/BardAbilities');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      throw new Error(`Blackjack table ${tableId} not found`);
    }

    // Dealer plays: hit until 17+
    let dealerHand = this.createHand(table.dealer.hand);

    // Broadcast each dealer card draw
    while (dealerHand.value < 17 && !dealerHand.isBusted) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s between cards

      const card = table.deck.pop();
      if (!card) break;

      table.dealer.hand.push(card);
      dealerHand = this.createHand(table.dealer.hand);

      if (io) {
        io.to(tableId).emit('blackjack:dealer_draw', {
          tableId,
          card,
          dealerValue: dealerHand.value,
          dealerBusted: dealerHand.isBusted
        });
      }

      console.log(`[BlackjackEngine] Dealer drew ${card.rank} of ${card.suit} (value: ${dealerHand.value})`);
    }

    table.dealer.handValue = dealerHand.value;
    table.dealer.isBusted = dealerHand.isBusted;
    table.dealer.isStanding = true;

    const dealerValue = dealerHand.value;
    const dealerBusted = dealerHand.isBusted;

    console.log(`[BlackjackEngine] Dealer finished with ${dealerValue}${dealerBusted ? ' (BUSTED)' : ''}`);

    // Calculate payouts for each player
    const playerResults: Array<{
      userId: string;
      outcome: 'win' | 'loss' | 'push' | 'blackjack';
      payout: number;
      netChange: number;
      handValue: number;
      characterBonus?: string;
    }> = [];

    // Batch-fetch all characters before the loop to avoid N+1 queries
    const { Character } = await import('../models/database');
    const playerIds = table.players.map((p: any) => p.userId);
    const characters = await Character.find({ userId: { $in: playerIds }, guildId }).exec();
    const characterMap = new Map(characters.map((c: any) => [c.userId, c]));

    for (const player of table.players) {
      if (!player.hasPlacedBet) continue;

      const playerValue = player.handValue;
      const bet = player.bet;

      let outcome: 'win' | 'loss' | 'push' | 'blackjack';
      let payout = 0;
      let characterBonus: string | undefined;

      // Fetch player character for class info
      const character = characterMap.get(player.userId);
      const classBonus = this.buildCharacterBonus(character);
      const characterClass = classBonus.className;
      // Minimal context shape expected by the CasinoGameEngine.trigger* helpers
      const abilityContext = {
        user: { userId: player.userId, guildId },
        characterBonus: classBonus
      };

      // Check for active Bard buffs for this player
      const playerBardBoost = await BardAbilities.BardAbilities.checkActiveBardBuffs(player.userId, guildId);

      // Determine outcome
      if (player.isBusted) {
        outcome = 'loss';
        payout = 0;
      } else if (dealerBusted) {
        outcome = 'win';
        payout = bet * 2; // Original bet + winnings
      } else if (playerValue > dealerValue) {
        outcome = 'win';
        payout = bet * 2;
      } else if (playerValue === dealerValue) {
        outcome = 'push';
        payout = bet; // Return original bet
      } else {
        outcome = 'loss';
        payout = 0;
      }

      // Same mechanics as playSinglePlayerBlackjack, via the shared CasinoGameEngine triggers
      if (outcome === 'loss') {
        let actualBetLoss = bet;

        // Rogue sleight of hand (reduce losses)
        actualBetLoss = await this.triggerRogueSleightOfHand(abilityContext, bet);
        if (actualBetLoss < bet) {
          payout = actualBetLoss;
          characterBonus = 'rogue_sleight_of_hand';
        }

        // Paladin divine protection
        const protectedBet = await this.triggerPaladinDivineBlessing(abilityContext, bet, actualBetLoss);
        if (protectedBet < actualBetLoss) {
          outcome = 'push';
          payout = protectedBet;
          characterBonus = 'paladin_divine_blessing';
        }
      }

      if (outcome === 'win') {
        // Warrior comeback bonus
        if (characterClass === 'warrior' && playerValue >= 19) {
          const warriorBonus = await this.triggerWarriorBattleRage(abilityContext, true);
          payout = Math.floor(payout * warriorBonus);
          characterBonus = 'warrior_battle_rage';
        }

        // Merchant coin sense
        if (characterClass === 'merchant') {
          payout = Math.floor(await this.triggerMerchantCoinSense(abilityContext, payout));
          characterBonus = 'merchant_coin_sense';
        }

        // Bard harmony boost
        if (playerBardBoost > 0) {
          const bardBonus = Math.floor(payout * playerBardBoost);
          payout += bardBonus;
          characterBonus = characterBonus || 'bard_harmony_boost';
        }
      }

      const netChange = payout - bet;

      // Update player balance
      if (payout > 0) {
        await EconomyService.addCoins(player.userId, guildId, payout);
      }

      // Award XP (Character is the single owner of level/xp progression)
      if (character) {
        const xpGain = this.calculateXpGain(
          bet,
          outcome === 'win' ? 'win' : outcome === 'push' ? 'push' : 'loss',
          character.level || 1
        );
        if (xpGain > 0) {
          await CharacterService.levelUpCharacter(player.userId, guildId, xpGain);
        }
      }

      // Log game result
      await CasinoGameLog.create({
        userId: player.userId,
        guildId,
        gameType: 'blackjack_multiplayer',
        betAmount: bet,
        payout: netChange,
        outcome: outcome === 'push' ? 'push' : (netChange > 0 ? 'win' : 'loss'),
        details: {
          tableId,
          playerHand: player.hand,
          playerValue,
          dealerHand: table.dealer.hand,
          dealerValue,
          dealerBusted,
          characterBonus,
          bardBoost: playerBardBoost
        },
        timestamp: new Date()
      });

      playerResults.push({
        userId: player.userId,
        outcome,
        payout,
        netChange,
        handValue: playerValue,
        characterBonus
      });

      console.log(`[BlackjackEngine] Player ${player.userId}: ${outcome} (hand: ${playerValue}, dealer: ${dealerValue}, payout: ${payout}, net: ${netChange})`);
    }

    await table.save();

    return {
      dealerHand: table.dealer.hand,
      dealerValue: table.dealer.handValue,
      dealerBusted: table.dealer.isBusted,
      playerResults
    };
  }
}