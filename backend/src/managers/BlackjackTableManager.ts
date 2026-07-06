import { BlackjackEngine } from '../engines/BlackjackEngine';
import type { IBlackjackPlayer } from '../models/database';
import { EconomyService } from '../services/EconomyService';

/**
 * BlackjackTableManager
 * Manages multiplayer blackjack table lifecycle, turn-based gameplay, and state synchronization
 * 
 * Game Flow:
 * 1. Players join table and place bets (betting phase)
 * 2. Dealer deals 2 cards to each player and themselves
 * 3. Players take turns hitting/standing (30s timeout per action)
 * 4. After all players finish, dealer plays their hand (hits until 17+)
 * 5. Calculate payouts for all players
 * 6. Reset for next round
 */
export class BlackjackTableManager {
  private static activeTables = new Map<string, {
    timer: NodeJS.Timeout | null;
    warningTimer: NodeJS.Timeout | null;
    isProcessing: boolean;
    currentPlayerIndex: number;
  }>();

  /**
   * Create a new multiplayer blackjack table
   */
  static async createTable(
    tableId: string,
    guildId: string,
    minBet: number = 10,
    maxBet: number = 1000,
    maxPlayers: number = 6
  ): Promise<void> {
    const { BlackjackTable } = await import('../models/schemas');

    // Check if table already exists
    const existing = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (existing) {
      throw new Error(`Blackjack table ${tableId} already exists in guild ${guildId}`);
    }

    // Create new table
    await BlackjackTable.create({
      tableId,
      guildId,
      players: [],
      dealer: {
        hand: [],
        handValue: 0,
        isStanding: false,
        isBusted: false
      },
      gamePhase: 'betting',
      currentPlayerIndex: 0,
      actionTimer: null,
      minBet,
      maxBet,
      maxPlayers,
      createdAt: new Date(),
      lastActivity: new Date()
    });

    console.log(`[BlackjackTableManager] Created table ${tableId} in guild ${guildId} (minBet: ${minBet}, maxBet: ${maxBet}, maxPlayers: ${maxPlayers})`);
  }

  /**
   * Add a player to the table
   */
  static async playerJoin(
    tableId: string,
    guildId: string,
    userId: string,
    characterClass?: string,
    io?: any
  ): Promise<{ success: boolean; message: string; tableState?: any }> {
    const { BlackjackTable } = await import('../models/schemas');
    const { User } = await import('../models/database');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      return { success: false, message: `Table ${tableId} not found` };
    }

    // Check if table is full
    if (table.players.length >= table.maxPlayers) {
      return { success: false, message: 'Table is full' };
    }

    // Check if player already at table
    if (table.players.some((p: IBlackjackPlayer) => p.userId === userId)) {
      return { success: false, message: 'You are already at this table' };
    }

    // Check if game is in progress (only allow joining during betting phase)
    if (table.gamePhase !== 'betting') {
      return { success: false, message: 'Cannot join during active game. Wait for next round.' };
    }

    // Get user balance
    const user = await User.findOne({ userId }).exec();
    const coins = await EconomyService.getCoins(userId, guildId);
    if (!user || coins < table.minBet) {
      return { success: false, message: `Insufficient balance. Minimum bet: ${table.minBet} coins` };
    }

    // Add player to table
    table.players.push({
      userId,
      characterClass: characterClass || 'default',
      bet: 0,
      hand: [],
      handValue: 0,
      isStanding: false,
      isBusted: false,
      hasPlacedBet: false
    });

    table.lastActivity = new Date();
    await table.save();

    console.log(`[BlackjackTableManager] Player ${userId} joined table ${tableId} (${table.players.length}/${table.maxPlayers} players)`);

    // Broadcast join event
    if (io) {
      io.to(tableId).emit('blackjack:player_joined', {
        tableId,
        userId,
        characterClass,
        playerCount: table.players.length,
        maxPlayers: table.maxPlayers
      });
    }

    return {
      success: true,
      message: 'Joined table successfully',
      tableState: await this.getTableStatus(tableId, guildId)
    };
  }

  /**
   * Player places their bet for the round
   */
  static async placeBet(
    tableId: string,
    guildId: string,
    userId: string,
    betAmount: number,
    io?: any
  ): Promise<{ success: boolean; message: string }> {
    const { BlackjackTable } = await import('../models/schemas');
    const { User } = await import('../models/database');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      return { success: false, message: `Table ${tableId} not found` };
    }

    if (table.gamePhase !== 'betting') {
      return { success: false, message: 'Betting phase is closed' };
    }

    // Find player
    const player = table.players.find((p: IBlackjackPlayer) => p.userId === userId);
    if (!player) {
      return { success: false, message: 'You are not at this table' };
    }

    if (player.hasPlacedBet) {
      return { success: false, message: 'You have already placed a bet' };
    }

    // Validate bet amount
    if (betAmount < table.minBet || betAmount > table.maxBet) {
      return { success: false, message: `Bet must be between ${table.minBet} and ${table.maxBet} coins` };
    }

    // Check user balance and deduct the bet atomically
    const user = await User.findOne({ userId }).exec();
    const spent = user ? await EconomyService.spendCoins(userId, guildId, betAmount) : false;
    if (!spent) {
      return { success: false, message: 'Insufficient balance' };
    }

    // Set player bet
    player.bet = betAmount;
    player.hasPlacedBet = true;
    table.lastActivity = new Date();
    await table.save();

    console.log(`[BlackjackTableManager] Player ${userId} placed bet of ${betAmount} on table ${tableId}`);

    // Broadcast bet placed
    if (io) {
      io.to(tableId).emit('blackjack:bet_placed', {
        tableId,
        userId,
        betAmount,
        playersReady: table.players.filter((p: IBlackjackPlayer) => p.hasPlacedBet).length,
        totalPlayers: table.players.length
      });
    }

    // Check if all players have bet - if so, start game automatically
    if (table.players.every((p: IBlackjackPlayer) => p.hasPlacedBet) && table.players.length > 0) {
      console.log(`[BlackjackTableManager] All players ready on table ${tableId}, starting game...`);
      setTimeout(() => this.startGame(tableId, guildId, io), 2000); // 2s delay before dealing
    }

    return { success: true, message: 'Bet placed successfully' };
  }

  /**
   * Start the game - deal initial cards
   */
  static async startGame(
    tableId: string,
    guildId: string,
    io?: any
  ): Promise<void> {
    const { BlackjackTable } = await import('../models/schemas');

    // Atomically transition from 'betting' to 'playing' to prevent duplicate startGame calls
    const table = await BlackjackTable.findOneAndUpdate(
      { tableId, guildId, gamePhase: 'betting' },
      { $set: { gamePhase: 'playing' } },
      { new: true }
    ).exec();
    if (!table) {
      console.error(`[BlackjackTableManager] Cannot start game on table ${tableId} (not in betting phase)`);
      return;
    }

    // Filter out players who haven't bet
    const activePlayers = table.players.filter((p: IBlackjackPlayer) => p.hasPlacedBet);
    if (activePlayers.length === 0) {
      console.error(`[BlackjackTableManager] No players with bets on table ${tableId}`);
      return;
    }

    // Deal initial cards using BlackjackEngine
    const dealResult = await BlackjackEngine.dealInitialCards(tableId, guildId);

    table.gamePhase = 'playing';
    table.currentPlayerIndex = 0;
    table.lastActivity = new Date();

    // Update table with dealt cards
    table.players = dealResult.players;
    table.dealer = dealResult.dealer;

    await table.save();

    console.log(`[BlackjackTableManager] Game started on table ${tableId} with ${activePlayers.length} players`);

    // Broadcast game started
    if (io) {
      io.to(tableId).emit('blackjack:game_started', {
        tableId,
        players: dealResult.players.map((p: IBlackjackPlayer) => ({
          userId: p.userId,
          hand: p.hand,
          handValue: p.handValue
        })),
        dealerUpCard: dealResult.dealer.hand[0],
        currentPlayer: table.players[table.currentPlayerIndex].userId
      });
    }

    // Start turn timer for first player
    this.startTurnTimer(tableId, guildId, table.players[table.currentPlayerIndex].userId, io);
  }

  /**
   * Start 30-second turn timer for current player
   */
  private static startTurnTimer(
    tableId: string,
    guildId: string,
    userId: string,
    io?: any
  ): void {
    // Clear any existing timers
    const existing = this.activeTables.get(tableId);
    if (existing?.timer) clearTimeout(existing.timer);
    if (existing?.warningTimer) clearTimeout(existing.warningTimer);

    // Warn at 10 seconds
    const warningTimer = setTimeout(() => {
      if (io) {
        io.to(tableId).emit('blackjack:turn_warning', {
          tableId,
          userId,
          secondsRemaining: 10
        });
      }
    }, 20000); // 20s elapsed = 10s remaining

    // Auto-stand after 30 seconds
    const timer = setTimeout(async () => {
      console.log(`[BlackjackTableManager] Player ${userId} timed out on table ${tableId}, auto-standing...`);
      await this.playerStand(tableId, guildId, userId, io, true);
    }, 30000);

    this.activeTables.set(tableId, {
      timer,
      warningTimer,
      isProcessing: false,
      currentPlayerIndex: 0
    });
  }

  /**
   * Player hits (requests another card)
   */
  static async playerHit(
    tableId: string,
    guildId: string,
    userId: string,
    io?: any
  ): Promise<{ success: boolean; message: string; card?: any; handValue?: number; isBusted?: boolean }> {
    const tableState = this.activeTables.get(tableId);
    if (tableState?.isProcessing) {
      return { success: false, message: 'Action already in progress' };
    }

    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table || table.gamePhase !== 'playing') {
      return { success: false, message: 'Game is not in playing phase' };
    }

    // Verify it's this player's turn
    const currentPlayer = table.players[table.currentPlayerIndex];
    if (currentPlayer.userId !== userId) {
      return { success: false, message: 'Not your turn' };
    }

    if (currentPlayer.isStanding || currentPlayer.isBusted) {
      return { success: false, message: 'You have already finished your turn' };
    }

    // Mark as processing
    if (tableState) {
      tableState.isProcessing = true;
    }

    try {
      // Process hit using BlackjackEngine
      const result = await BlackjackEngine.processPlayerHit(tableId, guildId, userId);

      // Broadcast hit result
      if (io) {
        io.to(tableId).emit('blackjack:player_hit', {
          tableId,
          userId,
          card: result.card,
          handValue: result.handValue,
          isBusted: result.isBusted
        });
      }

      // If player busted, move to next player
      if (result.isBusted) {
        console.log(`[BlackjackTableManager] Player ${userId} busted on table ${tableId}`);
        setTimeout(() => this.advanceToNextPlayer(tableId, guildId, io), 2000);
      }

      return {
        success: true,
        message: result.isBusted ? 'Busted!' : 'Card dealt',
        card: result.card,
        handValue: result.handValue,
        isBusted: result.isBusted
      };
    } finally {
      if (tableState) {
        tableState.isProcessing = false;
      }
    }
  }

  /**
   * Player stands (ends their turn)
   */
  static async playerStand(
    tableId: string,
    guildId: string,
    userId: string,
    io?: any,
    isTimeout: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    const tableState = this.activeTables.get(tableId);
    if (tableState?.isProcessing && !isTimeout) {
      return { success: false, message: 'Action already in progress' };
    }

    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table || table.gamePhase !== 'playing') {
      return { success: false, message: 'Game is not in playing phase' };
    }

    // Verify it's this player's turn
    const currentPlayer = table.players[table.currentPlayerIndex];
    if (currentPlayer.userId !== userId && !isTimeout) {
      return { success: false, message: 'Not your turn' };
    }

    // Mark as processing
    if (tableState) {
      tableState.isProcessing = true;
    }

    try {
      // Process stand using BlackjackEngine
      await BlackjackEngine.processPlayerStand(tableId, guildId, userId);

      // Broadcast stand
      if (io) {
        io.to(tableId).emit('blackjack:player_stand', {
          tableId,
          userId,
          isTimeout
        });
      }

      console.log(`[BlackjackTableManager] Player ${userId} stood on table ${tableId}${isTimeout ? ' (timeout)' : ''}`);

      // Move to next player
      setTimeout(() => this.advanceToNextPlayer(tableId, guildId, io), 1500);

      return { success: true, message: 'You stand' };
    } finally {
      if (tableState) {
        tableState.isProcessing = false;
      }
    }
  }

  /**
   * Advance to next player or start dealer turn
   */
  static async advanceToNextPlayer(
    tableId: string,
    guildId: string,
    io?: any
  ): Promise<void> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table || table.gamePhase !== 'playing') {
      return;
    }

    // Clear current player's timer
    const tableState = this.activeTables.get(tableId);
    if (tableState?.timer) clearTimeout(tableState.timer);
    if (tableState?.warningTimer) clearTimeout(tableState.warningTimer);

    // Find next player who hasn't finished
    let nextPlayerIndex = table.currentPlayerIndex + 1;
    while (nextPlayerIndex < table.players.length) {
      const player = table.players[nextPlayerIndex];
      if (!player.isStanding && !player.isBusted && player.hasPlacedBet) {
        // Found next active player
        table.currentPlayerIndex = nextPlayerIndex;
        await table.save();

        console.log(`[BlackjackTableManager] Advancing to next player ${player.userId} on table ${tableId}`);

        // Broadcast turn change
        if (io) {
          io.to(tableId).emit('blackjack:turn_changed', {
            tableId,
            currentPlayer: player.userId,
            playerIndex: nextPlayerIndex
          });
        }

        // Start timer for next player
        this.startTurnTimer(tableId, guildId, player.userId, io);
        return;
      }
      nextPlayerIndex++;
    }

    // All players finished - start dealer turn
    console.log(`[BlackjackTableManager] All players finished on table ${tableId}, starting dealer turn...`);
    setTimeout(() => this.playDealerTurn(tableId, guildId, io), 2000);
  }

  /**
   * Play dealer's turn (dealer hits until 17+)
   */
  static async playDealerTurn(
    tableId: string,
    guildId: string,
    io?: any
  ): Promise<void> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table || table.gamePhase !== 'playing') {
      return;
    }

    // Clear any timers
    const tableState = this.activeTables.get(tableId);
    if (tableState?.timer) clearTimeout(tableState.timer);
    if (tableState?.warningTimer) clearTimeout(tableState.warningTimer);

    console.log(`[BlackjackTableManager] Dealer turn starting on table ${tableId}...`);

    // Reveal dealer's hole card
    if (io) {
      io.to(tableId).emit('blackjack:dealer_reveal', {
        tableId,
        dealerHand: table.dealer.hand,
        dealerValue: table.dealer.handValue
      });
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // 2s pause

    // Dealer plays using BlackjackEngine
    const result = await BlackjackEngine.playDealerTurnMultiplayer(tableId, guildId, io);

    // Broadcast final results
    if (io) {
      io.to(tableId).emit('blackjack:game_complete', {
        tableId,
        dealerHand: result.dealerHand,
        dealerValue: result.dealerValue,
        dealerBusted: result.dealerBusted,
        results: result.playerResults
      });
    }

    // Reset table for next round after 10 seconds
    setTimeout(() => this.resetTable(tableId, guildId, io), 10000);
  }

  /**
   * Reset table for next round
   */
  static async resetTable(
    tableId: string,
    guildId: string,
    io?: any
  ): Promise<void> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      return;
    }

    // Reset all player states
    for (const player of table.players) {
      player.hand = [];
      player.handValue = 0;
      player.bet = 0;
      player.isStanding = false;
      player.isBusted = false;
      player.hasPlacedBet = false;
    }

    // Reset dealer
    table.dealer = {
      hand: [],
      handValue: 0,
      isStanding: false,
      isBusted: false
    };

    table.gamePhase = 'betting';
    table.currentPlayerIndex = 0;
    table.lastActivity = new Date();

    await table.save();

    console.log(`[BlackjackTableManager] Table ${tableId} reset for next round`);

    // Broadcast new round
    if (io) {
      io.to(tableId).emit('blackjack:new_round', {
        tableId,
        players: table.players.map((p: IBlackjackPlayer) => ({ userId: p.userId, characterClass: p.characterClass }))
      });
    }

    // Clean up table state
    const tableState = this.activeTables.get(tableId);
    if (tableState?.timer) clearTimeout(tableState.timer);
    if (tableState?.warningTimer) clearTimeout(tableState.warningTimer);
    this.activeTables.delete(tableId);
  }

  /**
   * Player leaves table
   */
  static async playerLeave(
    tableId: string,
    guildId: string,
    userId: string,
    io?: any
  ): Promise<{ success: boolean; message: string }> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      return { success: false, message: `Table ${tableId} not found` };
    }

    const playerIndex = table.players.findIndex((p: IBlackjackPlayer) => p.userId === userId);
    if (playerIndex === -1) {
      return { success: false, message: 'You are not at this table' };
    }

    const player = table.players[playerIndex];

    // Refund bet if game is in betting phase and player has bet
    if (table.gamePhase === 'betting' && player.hasPlacedBet && player.bet > 0) {
      await EconomyService.addCoins(userId, guildId, player.bet);
      console.log(`[BlackjackTableManager] Refunded ${player.bet} coins to ${userId} on table leave`);
    }

    // Track whether it was the leaver's turn before indices shift below
    const wasCurrentPlayer = table.gamePhase === 'playing' && table.currentPlayerIndex === playerIndex;

    // Remove player. If they sat at or before the current turn position, shift
    // the index down so the turn pointer keeps referencing the same seat -
    // otherwise the splice makes it silently skip the next player.
    // (For the leaver themselves this parks the index one before their old
    // seat, which is exactly where advanceToNextPlayer resumes scanning from.)
    table.players.splice(playerIndex, 1);
    if (table.gamePhase === 'playing' && playerIndex <= table.currentPlayerIndex) {
      // May legitimately go to -1 when seat 0 leaves during their own turn:
      // advanceToNextPlayer scans from currentPlayerIndex + 1 = 0.
      table.currentPlayerIndex = table.currentPlayerIndex - 1;
    }
    table.lastActivity = new Date();
    await table.save();

    console.log(`[BlackjackTableManager] Player ${userId} left table ${tableId} (${table.players.length} remaining)`);

    // Broadcast leave event
    if (io) {
      io.to(tableId).emit('blackjack:player_left', {
        tableId,
        userId,
        playerCount: table.players.length
      });
    }

    // If no players left, cleanup table
    if (table.players.length === 0) {
      await this.cleanupTable(tableId, guildId);
    }

    // If current player left during their turn, advance
    if (wasCurrentPlayer) {
      this.advanceToNextPlayer(tableId, guildId, io);
    }

    return { success: true, message: 'Left table successfully' };
  }

  /**
   * Cleanup empty table
   */
  static async cleanupTable(tableId: string, guildId: string): Promise<void> {
    const { BlackjackTable } = await import('../models/schemas');

    await BlackjackTable.deleteOne({ tableId, guildId }).exec();

    // Clear timers
    const tableState = this.activeTables.get(tableId);
    if (tableState?.timer) clearTimeout(tableState.timer);
    if (tableState?.warningTimer) clearTimeout(tableState.warningTimer);
    this.activeTables.delete(tableId);

    console.log(`[BlackjackTableManager] Cleaned up empty table ${tableId}`);
  }

  /**
   * Get current table status
   */
  static async getTableStatus(tableId: string, guildId: string): Promise<any> {
    const { BlackjackTable } = await import('../models/schemas');

    const table = await BlackjackTable.findOne({ tableId, guildId }).exec();
    if (!table) {
      return null;
    }

    return {
      tableId: table.tableId,
      guildId: table.guildId,
      gamePhase: table.gamePhase,
      players: table.players.map((p: IBlackjackPlayer) => ({
        userId: p.userId,
        characterClass: p.characterClass,
        bet: p.bet,
        hand: table.gamePhase === 'betting' ? [] : p.hand,
        handValue: table.gamePhase === 'betting' ? 0 : p.handValue,
        isStanding: p.isStanding,
        isBusted: p.isBusted,
        hasPlacedBet: p.hasPlacedBet
      })),
      dealer: {
        upCard: table.dealer.hand.length > 0 ? table.dealer.hand[0] : null,
        hand: table.gamePhase === 'playing' && table.dealer.isStanding ? table.dealer.hand : [],
        handValue: table.gamePhase === 'playing' && table.dealer.isStanding ? table.dealer.handValue : 0
      },
      currentPlayerIndex: table.currentPlayerIndex,
      currentPlayer: table.players[table.currentPlayerIndex]?.userId || null,
      minBet: table.minBet,
      maxBet: table.maxBet,
      maxPlayers: table.maxPlayers
    };
  }
}
