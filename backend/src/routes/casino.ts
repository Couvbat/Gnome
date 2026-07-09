import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { User, Character, CasinoProfile, SharedEconomy } from '../models/database';
import { CasinoSession } from '../models/schemas';
import { EconomyService } from '../services/EconomyService';

const router = Router();

// =====================
// USER PROFILE & BALANCE
// =====================

// GET /api/casino/profile - Equivalent to /balance command
router.get('/profile', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const user = await User.findOne({ userId, guildId });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [character, casinoProfile, coins] = await Promise.all([
      Character.findOne({ userId, guildId }),
      CasinoProfile.findOne({ userId, guildId }),
      EconomyService.getCoins(userId, guildId)
    ]);
    const level = (character as any)?.level ?? user.level;
    const xp = (character as any)?.xp ?? user.xp;

    res.json({
      user: {
        id: user.userId,
        username: (user as any).username || 'Unknown User',
        coins,
        xp,
        level,
        totalXp: xp
      },
      character: (user as any).character || null,
      casino: casinoProfile ? {
        energy: (casinoProfile as any).energy || 100,
        maxEnergy: (casinoProfile as any).maxEnergy || 100,
        reputation: casinoProfile.reputation,
        totalWagered: (casinoProfile as any).totalWagered || 0,
        totalWon: (casinoProfile as any).totalWon || 0,
        totalLost: (casinoProfile as any).totalLost || 0,
        currentStreak: (casinoProfile as any).currentStreak || 0,
        bestStreak: (casinoProfile as any).bestStreak || 0
      } : {
        energy: 100,
        maxEnergy: 100,
        reputation: 0,
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0,
        currentStreak: 0,
        bestStreak: 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/casino/daily - Equivalent to /daily command
router.post('/daily', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const user = await User.findOne({ userId, guildId });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const character = await Character.findOne({ userId, guildId });
    const level = (character as any)?.level ?? user.level;

    // Calculate daily bonus based on level
    const baseAmount = 100;
    const levelBonus = level * 25;
    const dailyAmount = baseAmount + levelBonus;

    const claim = await EconomyService.claimDaily(userId, guildId, dailyAmount);
    if (!claim.claimed) {
      return res.json({
        success: false,
        message: `Vous avez déjà réclamé votre bonus quotidien! Revenez dans ${claim.hoursLeft}h.`,
        hoursLeft: claim.hoursLeft
      });
    }

    // Update casino profile energy
    const casinoProfile = await CasinoProfile.findOne({ userId, guildId });
    if (casinoProfile) {
      (casinoProfile as any).energy = Math.min((casinoProfile as any).maxEnergy || 100, ((casinoProfile as any).energy || 0) + 50);
      await casinoProfile.save();
    }

    res.json({
      success: true,
      message: `🎁 Bonus quotidien réclamé! +${dailyAmount} pièces`,
      coinsReceived: dailyAmount,
      newBalance: claim.newBalance,
      energyRestored: 50
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// CASINO SESSION MANAGEMENT
// =====================

// POST /api/casino/session/start - Start a casino session
router.post('/session/start', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const user = await User.findOne({ userId, guildId });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user already has an active session
    const existingSession = await CasinoSession.findOne({
      userId,
      guildId,
      isActive: true
    });

    if (existingSession) {
      return res.json({
        success: true,
        message: 'Session already active',
        session: existingSession
      });
    }

    // Create new session
    const sessionId = `session_${Date.now()}_${userId}`;
    const coins = await EconomyService.getCoins(userId, guildId);
    const newSession = new CasinoSession({
      userId,
      guildId,
      characterId: user.characterId || null,
      sessionId,
      startingBalance: coins,
      currentBalance: coins,
      startTime: new Date()
    });

    await newSession.save();

    res.json({
      success: true,
      message: 'Casino session started',
      session: {
        sessionId: newSession.sessionId,
        startingBalance: newSession.startingBalance,
        currentBalance: newSession.currentBalance,
        startTime: newSession.startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/casino/session - Get current session info
router.get('/session', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const session = await CasinoSession.findOne({
      userId,
      guildId,
      isActive: true
    }).populate('characterId');

    if (!session) {
      return res.json({
        success: false,
        message: 'No active session found'
      });
    }

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        startingBalance: session.startingBalance,
        currentBalance: session.currentBalance,
        totalWagered: session.totalWagered,
        totalWon: session.totalWon,
        totalLost: session.totalLost,
        gamesPlayed: session.gamesPlayed,
        currentRoom: session.currentRoom,
        startTime: session.startTime,
        duration: Date.now() - session.startTime.getTime()
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/casino/session/end - End casino session
router.post('/session/end', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const session = await CasinoSession.findOne({
      userId,
      guildId,
      isActive: true
    });

    if (!session) {
      return res.json({
        success: false,
        message: 'No active session found'
      });
    }

    // End session
    session.isActive = false;
    session.endTime = new Date();
    await session.save();

    // Calculate session stats
    const netChange = session.currentBalance - session.startingBalance;
    const duration = session.endTime.getTime() - session.startTime.getTime();
    const durationMinutes = Math.round(duration / (1000 * 60));

    res.json({
      success: true,
      message: 'Session ended',
      sessionStats: {
        duration: durationMinutes,
        netChange,
        totalWagered: session.totalWagered,
        totalWon: session.totalWon,
        totalLost: session.totalLost,
        gamesPlayed: session.gamesPlayed.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// LEADERBOARD & STATS
// =====================

// GET /api/casino/leaderboard - Equivalent to /leaderboard command
router.get('/leaderboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as string || 'level'; // level, coins, casino_winnings

    const skip = (page - 1) * limit;

    let sortField: any = { level: -1, xp: -1 };

    switch (type) {
      case 'coins': {
        const coinsLeaderboard = await SharedEconomy.find({ guildId })
          .sort({ coins: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        return res.json({
          success: true,
          leaderboard: coinsLeaderboard.map((doc: any, index) => ({
            rank: skip + index + 1,
            userId: doc.userId,
            username: 'Casino Player',
            coins: doc.coins || 0
          })),
          pagination: {
            page,
            limit,
            total: await SharedEconomy.countDocuments({ guildId })
          }
        });
      }
      case 'casino_winnings': {
        // We'll need to aggregate from CasinoProfile
        const casinoLeaderboard = await CasinoProfile.find({ guildId })
          .sort({ totalWon: -1 })
          .skip(skip)
          .limit(limit);

        return res.json({
          success: true,
          leaderboard: casinoLeaderboard.map((profile: any, index) => ({
            rank: skip + index + 1,
            userId: profile.userId,
            username: 'Casino Player',
            totalWon: profile.totalWon || 0,
            totalWagered: profile.totalWagered || 0,
            winRate: (profile.totalWagered || 0) > 0 ? ((profile.totalWon || 0) / (profile.totalWagered || 0)) * 100 : 0,
            reputation: profile.reputation || 0
          })),
          pagination: {
            page,
            limit,
            total: await CasinoProfile.countDocuments({ guildId })
          }
        });
      }
      default:
        sortField = { level: -1, xp: -1 };
    }

    const users = await User.find({ guildId })
      .sort(sortField)
      .skip(skip)
      .limit(limit)
      .populate('character');

    const total = await User.countDocuments({ guildId });

    const userIds = users.map((u: any) => u.userId);
    const economyDocs = await SharedEconomy.find({ userId: { $in: userIds }, guildId }).lean();
    const coinsByUserId = new Map(economyDocs.map((d: any) => [d.userId, d.coins]));

    res.json({
      success: true,
      leaderboard: users.map((user: any, index) => ({
        rank: skip + index + 1,
        userId: user.userId,
        username: user.username || 'Unknown User',
        level: user.level,
        xp: user.xp,
        coins: coinsByUserId.get(user.userId) ?? 100,
        character: user.character || null
      })),
      pagination: {
        page,
        limit,
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// CASINO GAMES STATUS
// =====================

// GET /api/casino/games/status - Get available games and tables
router.get('/games/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;

    // Import game models
    const { BlackjackTable, RouletteTable, SlotMachine } = await import('../models/schemas');

    const [blackjackTables, rouletteTables, slotMachines] = await Promise.all([
      BlackjackTable.find({ guildId, isActive: true }),
      RouletteTable.find({ guildId, isActive: true }),
      SlotMachine.find({ guildId, isActive: true })
    ]);

    res.json({
      success: true,
      games: {
        blackjack: {
          available: true,
          tables: blackjackTables.map((table: any) => ({
            tableId: table.tableId,
            name: table.name,
            theme: table.theme,
            minBet: table.minBet,
            maxBet: table.maxBet,
            players: table.players.length,
            maxPlayers: table.maxPlayers,
            gamePhase: table.gamePhase,
            spectators: table.spectators.length
          }))
        },
        roulette: {
          available: true,
          tables: rouletteTables.map((table: any) => ({
            tableId: table.tableId,
            gamePhase: table.gamePhase,
            spinTimer: table.spinTimer,
            activePlayers: table.activePlayers.length,
            spectators: table.spectators.length,
            lastResults: table.lastResults.slice(-5) // Last 5 results
          }))
        },
        slots: {
          available: true,
          machines: slotMachines.map((machine: any) => ({
            machineId: machine.machineId,
            name: machine.name,
            theme: machine.theme,
            minBet: machine.minBet,
            maxBet: machine.maxBet,
            progressiveJackpot: machine.progressiveJackpot,
            isActive: machine.isActive,
            isOccupied: !!machine.currentPlayer?.userId
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// DEPRECATED GAME ENDPOINTS
// =====================
// These legacy endpoints are deprecated in favor of the RPG-integrated
// endpoints in routes/games.ts which include character bonuses, energy,
// reputation, and full progression system integration.
//
// Migration guide:
// - /api/casino/slots/spin → /api/games/slots/spin
// - /api/casino/dice/roll → /api/games/dice/roll
// - /api/casino/blackjack/play → /api/games/blackjack/play
// - /api/casino/roulette/play → /api/games/roulette/play
//
// The new endpoints provide:
// - Character class bonuses (Warrior, Mage, Rogue, Merchant, Bard, Paladin)
// - Energy system with regeneration
// - Reputation and tier progression
// - XP and character leveling
// - Special ability tracking
// =====================

// DEPRECATED: POST /api/casino/slots/spin - Use /api/games/slots/spin instead
router.post('/slots/spin', async (req: AuthenticatedRequest, res) => {
  res.status(410).json({
    error: 'This endpoint is deprecated',
    message: 'Please use /api/games/slots/spin for full RPG integration including character bonuses, energy system, and reputation',
    migration: {
      newEndpoint: '/api/games/slots/spin',
      features: ['Character class bonuses', 'Energy system', 'Reputation progression', 'XP gain', 'Special abilities']
    }
  });
});

// DEPRECATED: POST /api/casino/dice/roll - Use /api/games/dice/roll instead
router.post('/dice/roll', async (req: AuthenticatedRequest, res) => {
  res.status(410).json({
    error: 'This endpoint is deprecated',
    message: 'Please use /api/games/dice/roll for full RPG integration including character bonuses, energy system, and reputation',
    migration: {
      newEndpoint: '/api/games/dice/roll',
      features: ['Character class bonuses', 'Energy system', 'Reputation progression', 'XP gain', 'Special abilities']
    }
  });
});

// =====================
// MULTIPLAYER TABLES
// =====================

import { RouletteTableManager } from '../managers/RouletteTableManager';
import { BlackjackTableManager } from '../managers/BlackjackTableManager';

// POST /api/casino/tables/roulette/create - Create new roulette table
router.post('/tables/roulette/create', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { tableId, minBet, maxBet } = req.body;
    const { guildId } = req.user!;

    if (!tableId) {
      throw new AppError('Table ID is required', 400);
    }

    await RouletteTableManager.createTable(
      guildId,
      tableId,
      minBet || 10,
      maxBet || 1000
    );

    res.json({
      success: true,
      message: `Roulette table ${tableId} created successfully`,
      tableId,
      minBet: minBet || 10,
      maxBet: maxBet || 1000
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/casino/tables/blackjack/create - Create new blackjack table
router.post('/tables/blackjack/create', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { tableId, minBet, maxBet, maxPlayers } = req.body;
    const { guildId } = req.user!;

    if (!tableId) {
      throw new AppError('Table ID is required', 400);
    }

    await BlackjackTableManager.createTable(
      tableId,
      guildId,
      minBet || 10,
      maxBet || 1000,
      maxPlayers || 6
    );

    res.json({
      success: true,
      message: `Blackjack table ${tableId} created successfully`,
      tableId,
      minBet: minBet || 10,
      maxBet: maxBet || 1000,
      maxPlayers: maxPlayers || 6
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/casino/tables/roulette - List all active roulette tables
router.get('/tables/roulette', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { RouletteTable } = await import('../models/schemas');

    const tables = await RouletteTable.find({ guildId }).exec();

    res.json({
      success: true,
      tables: tables.map(table => ({
        tableId: table.tableId,
        gamePhase: table.gamePhase,
        playerCount: table.bets.length,
        spinTimer: table.spinTimer,
        minBet: 10,
        maxBet: 1000,
        communityJackpot: 0,
        lastResults: table.lastResults.slice(-10).map((num: number) => ({
          number: num,
          color: num === 0 ? 'green' : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num) ? 'red' : 'black'
        }))
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/casino/tables/blackjack - List all active blackjack tables
router.get('/tables/blackjack', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { BlackjackTable } = await import('../models/schemas');

    const tables = await BlackjackTable.find({ guildId }).exec();

    res.json({
      success: true,
      tables: tables.map(table => ({
        tableId: table.tableId,
        gamePhase: table.gamePhase,
        playerCount: table.players.length,
        maxPlayers: table.maxPlayers,
        minBet: table.minBet,
        maxBet: table.maxBet,
        currentPlayerIndex: table.currentPlayerIndex,
        isFull: table.players.length >= table.maxPlayers
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/casino/tables/roulette/:tableId - Get roulette table status
router.get('/tables/roulette/:tableId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { tableId } = req.params;

    const status = await RouletteTableManager.getTableStatus(tableId, guildId);

    if (!status) {
      throw new AppError('Table not found', 404);
    }

    res.json({
      success: true,
      table: status
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/casino/tables/blackjack/:tableId - Get blackjack table status
router.get('/tables/blackjack/:tableId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { tableId } = req.params;

    const status = await BlackjackTableManager.getTableStatus(tableId, guildId);

    if (!status) {
      throw new AppError('Table not found', 404);
    }

    res.json({
      success: true,
      table: status
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/casino/tables/roulette/:tableId - Cleanup roulette table
router.delete('/tables/roulette/:tableId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { tableId } = req.params;

    // Verify the table belongs to the same guild as the requesting user
    const { RouletteTable } = await import('../models/schemas');
    const table = await RouletteTable.findOne({ tableId, guildId });
    if (!table) {
      throw new AppError('Table not found or access denied', 404);
    }

    await RouletteTableManager.cleanupTable(tableId, guildId);

    res.json({
      success: true,
      message: 'Table cleaned up successfully',
      tableId
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/casino/tables/blackjack/:tableId - Cleanup blackjack table
router.delete('/tables/blackjack/:tableId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { tableId } = req.params;

    // Verify the table belongs to the same guild as the requesting user
    const { BlackjackTable } = await import('../models/schemas');
    const table = await BlackjackTable.findOne({ tableId, guildId });
    if (!table) {
      throw new AppError('Table not found or access denied', 404);
    }

    await BlackjackTableManager.cleanupTable(tableId, guildId);

    res.json({
      success: true,
      message: 'Table cleaned up successfully',
      tableId
    });
  } catch (error) {
    next(error);
  }
});

export default router;
