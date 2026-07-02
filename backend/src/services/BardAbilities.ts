import { BlackjackTable, RouletteTable, CasinoSession } from '../models/schemas';
import { AbilityService } from './AbilityService';
import type { Server as SocketIOServer } from 'socket.io';

/**
 * BardAbilities Service
 * Handles Bard-specific multiplayer abilities that affect other players at the same table
 */
export class BardAbilities {
  /**
   * Trigger Bard's Lucky Song ability - applies luck boost to all players at the table
   * @param bardUserId - The Bard user's ID
   * @param guildId - The guild ID
   * @param tableId - The casino table ID
   * @param gameType - Type of game ('blackjack' or 'roulette')
   * @param io - Socket.io server instance for broadcasting
   * @returns Success status and list of affected player IDs
   */
  static async triggerLuckySong(
    bardUserId: string,
    guildId: string,
    tableId: string,
    gameType: 'blackjack' | 'roulette',
    io: SocketIOServer
  ): Promise<{ success: boolean; affectedPlayers: string[]; message?: string }> {
    try {
      // Check if ability can be used (cooldown, energy, etc.)
      const canUse = await AbilityService.canUseAbility(
        bardUserId,
        guildId,
        'bard_lucky_song'
      );

      if (!canUse.success) {
        return { 
          success: false, 
          affectedPlayers: [], 
          message: canUse.message || 'Ability on cooldown or insufficient energy'
        };
      }

      // Get all players at the table
      let players: string[] = [];
      
      if (gameType === 'blackjack') {
        const table = await BlackjackTable.findOne({ tableId, guildId });
        if (!table) {
          return { success: false, affectedPlayers: [], message: 'Table not found' };
        }
        players = (table as any).players.map((p: any) => p.userId);
      } else if (gameType === 'roulette') {
        const table = await RouletteTable.findOne({ tableId, guildId });
        if (!table) {
          return { success: false, affectedPlayers: [], message: 'Table not found' };
        }
        players = (table as any).activePlayers || [];
      }

      // Remove bard from affected players (they already have their own bonus)
      players = players.filter(p => p !== bardUserId);

      if (players.length === 0) {
        return { 
          success: false, 
          affectedPlayers: [], 
          message: 'No other players at table to buff' 
        };
      }

      // Apply buff to each player's active session
      const luckBoost = 0.1; // 10% luck boost
      const durationMinutes = 12;
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      for (const userId of players) {
        const session = await CasinoSession.findOne({ 
          userId, 
          guildId, 
          isActive: true 
        });

        if (session) {
          const sessionDoc = session as any;
          
          // Initialize temporaryBuffs array if it doesn't exist
          if (!sessionDoc.temporaryBuffs) {
            sessionDoc.temporaryBuffs = [];
          }

          // Check if Bard buff already exists from this source
          const existingBuffIndex = sessionDoc.temporaryBuffs.findIndex(
            (b: any) => b.type === 'bard_lucky_song' && b.source === bardUserId
          );

          if (existingBuffIndex >= 0) {
            // Refresh existing buff
            sessionDoc.temporaryBuffs[existingBuffIndex].expiresAt = expiresAt;
            sessionDoc.temporaryBuffs[existingBuffIndex].appliedAt = new Date();
          } else {
            // Add new buff
            sessionDoc.temporaryBuffs.push({
              type: 'bard_lucky_song',
              source: bardUserId,
              value: luckBoost,
              expiresAt,
              appliedAt: new Date()
            });
          }

          await session.save();
        }
      }

      // Record ability usage for the Bard
      await AbilityService.useAbility(
        bardUserId,
        guildId,
        'bard_lucky_song'
      );

      // Broadcast to all players at the table
      io.to(`${gameType}:${tableId}`).emit('bard:buff_applied', {
        tableId,
        bardUserId,
        buffType: 'luck',
        value: luckBoost * 100, // Convert to percentage
        durationMinutes,
        affectedPlayersCount: players.length
      });

      return { 
        success: true, 
        affectedPlayers: players 
      };
    } catch (error) {
      console.error('Error triggering Bard Lucky Song:', error);
      return { 
        success: false, 
        affectedPlayers: [], 
        message: 'Internal error triggering ability' 
      };
    }
  }

  /**
   * Check if a player has active Bard buffs and return total luck bonus
   * @param userId - The player's user ID
   * @param guildId - The guild ID
   * @returns Total luck boost percentage (e.g., 0.1 for 10%)
   */
  static async checkActiveBardBuffs(
    userId: string, 
    guildId: string
  ): Promise<number> {
    try {
      const session = await CasinoSession.findOne({ 
        userId, 
        guildId, 
        isActive: true 
      });

      if (!session || !(session as any).temporaryBuffs) {
        return 0;
      }

      const now = new Date();
      const sessionDoc = session as any;
      
      // Filter active Bard buffs
      const activeBardBuffs = sessionDoc.temporaryBuffs.filter(
        (b: any) => 
          b.type === 'bard_lucky_song' && 
          new Date(b.expiresAt) > now
      );

      // Sum up all active buffs (in case multiple Bards at table)
      const totalBoost = activeBardBuffs.reduce(
        (sum: number, buff: any) => sum + buff.value, 
        0
      );

      return totalBoost;
    } catch (error) {
      console.error('Error checking Bard buffs:', error);
      return 0;
    }
  }

  /**
   * Clean up expired buffs from a player's session
   * @param userId - The player's user ID
   * @param guildId - The guild ID
   */
  static async cleanupExpiredBuffs(
    userId: string, 
    guildId: string
  ): Promise<void> {
    try {
      const session = await CasinoSession.findOne({ 
        userId, 
        guildId, 
        isActive: true 
      });

      if (!session || !(session as any).temporaryBuffs) {
        return;
      }

      const now = new Date();
      const sessionDoc = session as any;
      
      // Keep only non-expired buffs
      sessionDoc.temporaryBuffs = sessionDoc.temporaryBuffs.filter(
        (b: any) => new Date(b.expiresAt) > now
      );

      await session.save();
    } catch (error) {
      console.error('Error cleaning up expired buffs:', error);
    }
  }

  /**
   * Get all active buffs for a player (for UI display)
   * @param userId - The player's user ID
   * @param guildId - The guild ID
   * @returns Array of active buffs with details
   */
  static async getActiveBuffs(
    userId: string, 
    guildId: string
  ): Promise<Array<{
    type: string;
    source: string;
    value: number;
    expiresAt: Date;
    appliedAt: Date;
  }>> {
    try {
      const session = await CasinoSession.findOne({ 
        userId, 
        guildId, 
        isActive: true 
      });

      if (!session || !(session as any).temporaryBuffs) {
        return [];
      }

      const now = new Date();
      const sessionDoc = session as any;
      
      return sessionDoc.temporaryBuffs.filter(
        (b: any) => new Date(b.expiresAt) > now
      );
    } catch (error) {
      console.error('Error getting active buffs:', error);
      return [];
    }
  }

  /**
   * Calculate Harmony Boost for Roulette (Bard ability that grows with winning bets)
   * @param bardUserId - The Bard user's ID
   * @param guildId - The guild ID
   * @param winningBetsCount - Number of winning bets the Bard has
   * @returns Harmony bonus multiplier
   */
  static calculateHarmonyBoost(winningBetsCount: number): number {
    // 10% boost per winning bet, capped at 30% (3 winning bets)
    const harmonyBonus = Math.min(1.3, 1.0 + (winningBetsCount * 0.1));
    return harmonyBonus;
  }

  /**
   * Distribute social bonus from Bard to other players (Roulette-specific)
   * Currently calculates but doesn't distribute - placeholder for future implementation
   * @param bardUserId - The Bard user's ID
   * @param tableId - The roulette table ID
   * @param socialBonusAmount - Amount to distribute
   */
  static async distributeSocialBonus(
    bardUserId: string,
    tableId: string,
    socialBonusAmount: number
  ): Promise<void> {
    // TODO: Future implementation for distributing social bonus to nearby players
    // This would require:
    // 1. Fetch all players at roulette table
    // 2. Calculate portion for each player
    // 3. Update their balances
    // 4. Notify via Socket.io
    console.log(`Social bonus ${socialBonusAmount} from Bard ${bardUserId} at table ${tableId} - distribution pending`);
  }
}
