import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { RouletteTableManager } from '../managers/RouletteTableManager';
import { BlackjackTableManager } from '../managers/BlackjackTableManager';
import { BardAbilities } from '../services/BardAbilities';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  guildId?: string;
  username?: string;
}

export const setupSocketHandlers = (io: SocketIOServer) => {
  // Authentication middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');
      const decoded = jwt.verify(token, jwtSecret) as any;

      // Refresh tokens are only valid on /api/auth/refresh
      if (decoded.type === 'refresh') {
        return next(new Error('Invalid authentication token'));
      }

      socket.userId = decoded.userId;
      socket.guildId = decoded.guildId;
      socket.username = decoded.username;
      
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.username} (${socket.userId}) connected to casino`);

    // Join guild-specific room
    socket.join(socket.guildId!);

    // =====================
    // ROULETTE EVENTS
    // =====================

    socket.on('roulette:join_table', async (data: { tableId: string }) => {
      try {
        const { tableId } = data;
        socket.join(`roulette:${tableId}`);

        const status = await RouletteTableManager.getTableStatus(tableId, socket.guildId);
        socket.emit('roulette:table_state', status);

        io.to(`roulette:${tableId}`).emit('roulette:player_joined', {
          userId: socket.userId,
          username: socket.username,
          playerCount: status?.activePlayers || 0
        });

        // Kick off the first betting round once someone shows up at a fresh table.
        // Subsequent rounds are chained automatically by executeSpin/resetTable.
        // Also restart tables stranded mid-cycle by a server restart: the phase
        // says betting/spinning/payouts but no timer exists in this process to
        // ever advance it (startBettingRound refunds any stale charged bets).
        if (status && (status.gamePhase === 'waiting' || !RouletteTableManager.hasActiveTimer(tableId))) {
          await RouletteTableManager.startBettingRound(tableId, io);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('roulette:place_bet', async (data: { tableId: string; bet: any }) => {
      try {
        const { tableId, bet } = data;

        // characterId must be a real Character ObjectId (RouletteTable.bets.characterId is
        // a required ObjectId ref) - look it up server-side from the authenticated userId
        // instead of trusting a client-supplied field, which previously fell back to the
        // raw Discord snowflake socket.userId and blew up Mongoose's ObjectId cast.
        const { Character } = await import('../models/database');
        const character = await Character.findOne({ userId: socket.userId, guildId: socket.guildId }).exec();

        if (!character) {
          socket.emit('error', { message: 'Create a character before placing bets' });
          return;
        }

        const result = await RouletteTableManager.placeBet(
          tableId,
          socket.userId!,
          (character._id as any).toString(),
          Array.isArray(bet) ? bet : [bet],
          io
        );

        if (!result.success) {
          socket.emit('error', { message: result.message });
        } else {
          socket.emit('roulette:bet_placed', { message: 'Bet placed successfully' });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('roulette:leave_table', async (data: { tableId: string }) => {
      try {
        const { tableId } = data;
        await RouletteTableManager.playerLeave(tableId, socket.userId!, io);
        socket.leave(`roulette:${tableId}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // =====================
    // BLACKJACK EVENTS
    // =====================

    socket.on('blackjack:join_table', async (data: { tableId: string; characterClass?: string }) => {
      try {
        const { tableId, characterClass } = data;
        const result = await BlackjackTableManager.playerJoin(
          tableId,
          socket.guildId!,
          socket.userId!,
          characterClass,
          io
        );

        if (!result.success) {
          socket.emit('error', { message: result.message });
        } else {
          socket.join(`blackjack:${tableId}`);
          socket.emit('blackjack:joined', { 
            message: result.message,
            tableState: result.tableState
          });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('blackjack:place_bet', async (data: { tableId: string; betAmount: number }) => {
      try {
        const { tableId, betAmount } = data;
        const result = await BlackjackTableManager.placeBet(
          tableId,
          socket.guildId!,
          socket.userId!,
          betAmount,
          io
        );

        if (!result.success) {
          socket.emit('error', { message: result.message });
        } else {
          socket.emit('blackjack:bet_confirmed', { message: result.message });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('blackjack:hit', async (data: { tableId: string }) => {
      try {
        const { tableId } = data;
        const result = await BlackjackTableManager.playerHit(
          tableId,
          socket.guildId!,
          socket.userId!,
          io
        );

        if (!result.success) {
          socket.emit('error', { message: result.message });
        } else {
          socket.emit('blackjack:hit_result', {
            message: result.message,
            card: result.card,
            handValue: result.handValue,
            isBusted: result.isBusted
          });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('blackjack:stand', async (data: { tableId: string }) => {
      try {
        const { tableId } = data;
        const result = await BlackjackTableManager.playerStand(
          tableId,
          socket.guildId!,
          socket.userId!,
          io
        );

        if (!result.success) {
          socket.emit('error', { message: result.message });
        } else {
          socket.emit('blackjack:stand_confirmed', { message: result.message });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('blackjack:leave_table', async (data: { tableId: string }) => {
      try {
        const { tableId } = data;
        await BlackjackTableManager.playerLeave(tableId, socket.guildId!, socket.userId!, io);
        socket.leave(`blackjack:${tableId}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // =====================
    // BARD ABILITY EVENTS
    // =====================

    socket.on('bard:trigger_lucky_song', async (data: { tableId: string; gameType: 'roulette' | 'blackjack' }) => {
      try {
        const { tableId, gameType } = data;
        const result = await BardAbilities.triggerLuckySong(
          socket.userId!,
          socket.guildId!,
          tableId,
          gameType,
          io
        );

        if (!result.success) {
          socket.emit('error', { message: result.message });
        } else {
          socket.emit('bard:ability_triggered', {
            message: result.message,
            affectedPlayers: result.affectedPlayers
          });
          
          // Broadcast to all table players
          io.to(`${gameType}:${tableId}`).emit('bard:harmony_boost_active', {
            bardUserId: socket.userId,
            bardUsername: socket.username,
            affectedPlayers: result.affectedPlayers,
            duration: 720 // 12 minutes in seconds
          });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // =====================
    // DISCONNECT HANDLING
    // =====================

    // 'disconnecting' fires while socket.rooms is still populated with the rooms this
    // socket was in - by the time 'disconnect' fires, Socket.IO has already removed the
    // socket from all of them, so table cleanup has to happen here instead.
    socket.on('disconnecting', async () => {
      // Clean up table membership so a dropped connection doesn't leave a ghost
      // player occupying a seat / blocking turn order at any table it was part of.
      for (const room of socket.rooms) {
        try {
          if (room.startsWith('roulette:')) {
            const tableId = room.slice('roulette:'.length);
            await RouletteTableManager.playerLeave(tableId, socket.userId!, io);
          } else if (room.startsWith('blackjack:')) {
            const tableId = room.slice('blackjack:'.length);
            await BlackjackTableManager.playerLeave(tableId, socket.guildId!, socket.userId!, io);
          }
        } catch (error: any) {
          console.error(`[Socket] Failed to clean up ${socket.userId} from room ${room} on disconnect:`, error);
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User ${socket.username} disconnected from casino`);

      // Notify rooms about player leaving
      socket.to(socket.guildId!).emit('casino:player_left', {
        username: socket.username,
        userId: socket.userId
      });
    });
  });
};
