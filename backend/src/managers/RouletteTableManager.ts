import { RouletteTable } from '../models/schemas';
import { RouletteEngine } from '../engines/RouletteEngine';
import { BardAbilities } from '../services/BardAbilities';
import type { Server as SocketIOServer } from 'socket.io';
import { EconomyService } from '../services/EconomyService';

/**
 * RouletteTableManager
 * Manages multiplayer roulette tables with synchronized betting rounds and spins
 */
export class RouletteTableManager {
  private static timers: Map<string, NodeJS.Timeout> = new Map();
  private static locks: Map<string, boolean> = new Map();

  /**
   * Create a new roulette table
   */
  static async createTable(
    guildId: string,
    tableId: string,
    minBet: number = 10,
    maxBet: number = 1000
  ): Promise<any> {
    const table = await RouletteTable.create({
      tableId,
      guildId,
      minBet,
      maxBet,
      isActive: true,
      gamePhase: 'waiting',
      spinTimer: 30,
      bets: [],
      lastResults: [],
      activePlayers: [],
      spectators: []
    });

    return table;
  }

  /**
   * Start a new betting round
   */
  static async startBettingRound(
    tableId: string,
    io: SocketIOServer
  ): Promise<void> {
    // Acquire lock to prevent race conditions
    if (this.locks.get(tableId)) {
      console.log(`Table ${tableId} is locked, skipping start betting round`);
      return;
    }
    this.locks.set(tableId, true);

    try {
      const table = await RouletteTable.findOne({ tableId });
      if (!table) {
        console.error(`Table ${tableId} not found`);
        return;
      }

      const tableDoc = table as any;

      // Refund any lingering staked bets before clearing them. In the normal
      // round chain the engine already settled and cleared them, so this only
      // fires for stale state (e.g. a server restart mid-betting) where the
      // coins were charged at placeBet but the spin never resolved.
      if (Array.isArray(tableDoc.bets)) {
        for (const staleBet of tableDoc.bets) {
          if (staleBet?.userId && staleBet.totalWagered > 0) {
            await EconomyService.addCoins(staleBet.userId, tableDoc.guildId, staleBet.totalWagered);
            console.log(`[RouletteTableManager] Refunded stale bet of ${staleBet.totalWagered} to ${staleBet.userId} on table ${tableId}`);
          }
        }
      }

      // Update table state
      tableDoc.gamePhase = 'betting';
      tableDoc.spinStartTime = new Date(Date.now() + 30000); // 30 seconds from now
      tableDoc.bets = []; // Clear previous bets
      await table.save();

      // Broadcast to all players at the table
      io.to(`roulette:${tableId}`).emit('roulette:betting_opened', {
        tableId,
        timeRemaining: 30,
        minBet: tableDoc.minBet,
        maxBet: tableDoc.maxBet
      });

      // Schedule warning at 5 seconds remaining
      const warningTimer = setTimeout(() => {
        io.to(`roulette:${tableId}`).emit('roulette:betting_closing', {
          tableId,
          countdown: 5
        });
      }, 25000);

      // Schedule betting close and spin
      const spinTimer = setTimeout(() => {
        this.executeSpin(tableId, io);
      }, 30000);

      // Clear any existing timers before overwriting to prevent duplicate executeSpin calls
      const existingSpin = this.timers.get(tableId);
      if (existingSpin) clearTimeout(existingSpin);
      const existingWarning = this.timers.get(`${tableId}_warning`);
      if (existingWarning) clearTimeout(existingWarning);

      this.timers.set(tableId, spinTimer);
      this.timers.set(`${tableId}_warning`, warningTimer);
    } finally {
      this.locks.set(tableId, false);
    }
  }

  /**
   * Add a player's bet to the table
   */
  static async placeBet(
    tableId: string,
    userId: string,
    characterId: string,
    bets: Array<{
      type: string;
      value?: number;
      amount: number;
    }>,
    io: SocketIOServer
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const table = await RouletteTable.findOne({ tableId });
      if (!table) {
        return { success: false, message: 'Table not found' };
      }

      const tableDoc = table as any;

      if (tableDoc.gamePhase !== 'betting') {
        return { success: false, message: 'Betting is closed' };
      }

      // Validate bets
      const totalWagered = bets.reduce((sum, bet) => sum + bet.amount, 0);

      if (totalWagered < tableDoc.minBet) {
        return { success: false, message: `Minimum bet is ${tableDoc.minBet}` };
      }

      if (totalWagered > tableDoc.maxBet) {
        return { success: false, message: `Maximum bet is ${tableDoc.maxBet}` };
      }

      // Find existing player bet or create new
      let playerBet = tableDoc.bets.find((b: any) => b.userId === userId);

      // Charge the bet atomically now (rejecting if the player can't afford it), same
      // pattern as BlackjackTableManager.placeBet - previously this table only moved
      // money at spin resolution, so a player could bet money they didn't have. Players
      // may revise their bet before the spin, so we only charge/refund the difference
      // against whatever they've already staked this round.
      const previousWagered = playerBet ? playerBet.totalWagered : 0;
      const delta = totalWagered - previousWagered;

      if (delta > 0) {
        const spent = await EconomyService.spendCoins(userId, tableDoc.guildId, delta);
        if (!spent) {
          return { success: false, message: 'Insufficient balance' };
        }
      } else if (delta < 0) {
        await EconomyService.addCoins(userId, tableDoc.guildId, -delta);
      }

      if (playerBet) {
        // Update existing bet
        playerBet.bets = bets;
        playerBet.totalWagered = totalWagered;
      } else {
        // Add new player bet
        tableDoc.bets.push({
          userId,
          characterId,
          bets,
          totalWagered
        });

        // Add to active players if not already there
        if (!tableDoc.activePlayers.includes(userId)) {
          tableDoc.activePlayers.push(userId);
        }
      }

      await table.save();

      // Broadcast bet to all players
      io.to(`roulette:${tableId}`).emit('roulette:player_bet', {
        tableId,
        userId,
        bets,
        totalWagered
      });

      return { success: true };
    } catch (error) {
      console.error('Error placing roulette bet:', error);
      return { success: false, message: 'Error placing bet' };
    }
  }

  /**
   * Execute the spin and calculate payouts
   */
  static async executeSpin(
    tableId: string,
    io: SocketIOServer
  ): Promise<void> {
    if (this.locks.get(tableId)) {
      console.log(`Table ${tableId} is locked, skipping execute spin`);
      return;
    }
    this.locks.set(tableId, true);

    try {
      const table = await RouletteTable.findOne({ tableId });
      if (!table) {
        console.error(`Table ${tableId} not found`);
        return;
      }

      const tableDoc = table as any;

      // Update phase
      tableDoc.gamePhase = 'spinning';
      await table.save();

      // Broadcast betting closed
      io.to(`roulette:${tableId}`).emit('roulette:betting_closed', { tableId });
      
      // Broadcast spin started (triggers animation)
      io.to(`roulette:${tableId}`).emit('roulette:spin_started', { tableId });

      // Wait for spin animation (5 seconds)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Execute spin using RouletteEngine
      const spinResult = await RouletteEngine.executeMultiplayerSpin(
        tableId,
        tableDoc.guildId,
        io
      );

      // Update table with result
      tableDoc.currentSpin = {
        result: spinResult.winningNumber,
        color: spinResult.winningColor,
        even: spinResult.winningNumber > 0 && spinResult.winningNumber % 2 === 0,
        high: spinResult.winningNumber >= 19 && spinResult.winningNumber <= 36
      };

      // Update last results (keep last 10)
      if (!tableDoc.lastResults) {
        tableDoc.lastResults = [];
      }
      tableDoc.lastResults.unshift(spinResult.winningNumber);
      if (tableDoc.lastResults.length > 10) {
        tableDoc.lastResults = tableDoc.lastResults.slice(0, 10);
      }

      tableDoc.gamePhase = 'payouts';
      await table.save();

      // Broadcast spin result
      io.to(`roulette:${tableId}`).emit('roulette:spin_result', {
        tableId,
        number: spinResult.winningNumber,
        color: spinResult.winningColor,
        winners: spinResult.winners,
        totalPayouts: spinResult.totalPayouts
      });

      // Wait for payout display (10 seconds)
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Stop the cycle when nobody is connected to the table room anymore,
      // otherwise the betting/spin loop keeps hammering the DB forever on an
      // empty table. The next roulette:join_table restarts it.
      const roomSize = io?.sockets?.adapter?.rooms?.get(`roulette:${tableId}`)?.size ?? 0;
      if (roomSize === 0) {
        tableDoc.gamePhase = 'waiting';
        await table.save();
        console.log(`[RouletteTableManager] Table ${tableId} idle (no connected players), pausing rounds`);
        return;
      }

      // Chain the next round only after this call releases the table lock -
      // awaiting startBettingRound inline would see our own lock and skip,
      // leaving the table stuck in the 'payouts' phase forever.
      const nextRound = setTimeout(() => this.startBettingRound(tableId, io), 0);
      this.timers.set(tableId, nextRound);
    } catch (error) {
      console.error('Error executing roulette spin:', error);
      
      // Try to recover by starting a new round
      setTimeout(() => {
        this.startBettingRound(tableId, io);
      }, 5000);
    } finally {
      this.locks.set(tableId, false);
    }
  }

  /**
   * Player leaves the table
   */
  static async playerLeave(
    tableId: string,
    userId: string,
    io: SocketIOServer
  ): Promise<void> {
    try {
      const table = await RouletteTable.findOne({ tableId });
      if (!table) return;

      const tableDoc = table as any;

      // Remove from active players
      tableDoc.activePlayers = tableDoc.activePlayers.filter(
        (id: string) => id !== userId
      );

      // Remove their bets if in betting phase and refund deducted coins
      if (tableDoc.gamePhase === 'betting') {
        const playerBets: Array<{ userId: string; totalWagered: number }> = tableDoc.bets.filter(
          (b: any) => b.userId === userId
        );
        const refundAmount = playerBets.reduce((sum, b) => sum + (b.totalWagered || 0), 0);
        if (refundAmount > 0) {
          // Refund through the shared economy (same collection/atomic pattern the bot
          // and BlackjackTableManager use) - the User model has no `coins` field, and
          // this update was previously missing the guildId scope too.
          await EconomyService.addCoins(userId, tableDoc.guildId, refundAmount);
        }
        tableDoc.bets = tableDoc.bets.filter((b: any) => b.userId !== userId);
      }

      await table.save();

      // Broadcast player left
      io.to(`roulette:${tableId}`).emit('table:player_left', {
        tableId,
        userId,
        gameType: 'roulette'
      });
    } catch (error) {
      console.error('Error handling player leave:', error);
    }
  }

  /**
   * Clean up table and timers
   */
  static async cleanupTable(tableId: string, guildId?: string): Promise<void> {
    // Clear any active timers
    const spinTimer = this.timers.get(tableId);
    if (spinTimer) {
      clearTimeout(spinTimer);
      this.timers.delete(tableId);
    }

    const warningTimer = this.timers.get(`${tableId}_warning`);
    if (warningTimer) {
      clearTimeout(warningTimer);
      this.timers.delete(`${tableId}_warning`);
    }

    // Remove lock
    this.locks.delete(tableId);

    // Mark table as inactive (scope by guildId if provided to prevent cross-guild deletion)
    await RouletteTable.updateOne(
      guildId ? { tableId, guildId } : { tableId },
      { isActive: false }
    );
  }

  /**
   * Whether this process has any scheduled timer for the table. Used to detect
   * tables stranded mid-cycle by a server restart (phase says betting/spinning/
   * payouts but no timer exists to ever advance it).
   */
  static hasActiveTimer(tableId: string): boolean {
    return this.timers.has(tableId);
  }

  /**
   * Get table status (scoped to the caller's guild when provided, so one
   * guild's members can't inspect another guild's tables)
   */
  static async getTableStatus(tableId: string, guildId?: string): Promise<any> {
    const table = await RouletteTable.findOne(guildId ? { tableId, guildId } : { tableId });
    if (!table) return null;

    const tableDoc = table as any;
    
    return {
      tableId: tableDoc.tableId,
      gamePhase: tableDoc.gamePhase,
      activePlayers: tableDoc.activePlayers.length,
      betsPlaced: tableDoc.bets.length,
      lastResults: tableDoc.lastResults || [],
      minBet: tableDoc.minBet,
      maxBet: tableDoc.maxBet,
      timeRemaining: tableDoc.spinStartTime 
        ? Math.max(0, Math.floor((new Date(tableDoc.spinStartTime).getTime() - Date.now()) / 1000))
        : 0
    };
  }
}
