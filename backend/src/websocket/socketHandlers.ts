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

        const status = await RouletteTableManager.getTableStatus(tableId);
        socket.emit('roulette:table_state', status);

        io.to(`roulette:${tableId}`).emit('roulette:player_joined', {
          userId: socket.userId,
          username: socket.username,
          playerCount: status?.activePlayers || 0
        });

        // Kick off the first betting round once someone shows up at a fresh table.
        // Subsequent rounds are chained automatically by executeSpin/resetTable.
        if (status?.gamePhase === 'waiting') {
          await RouletteTableManager.startBettingRound(tableId, io);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('roulette:place_bet', async (data: { tableId: string; bet: any }) => {
      try {
        const { tableId, bet } = data;
        // Get characterId from the bet data or session
        const characterId = bet.characterId || socket.userId || '';
        
        const result = await RouletteTableManager.placeBet(
          tableId,
          socket.userId!,
          characterId,
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
