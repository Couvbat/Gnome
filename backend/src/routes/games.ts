import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { SlotsEngine } from '../engines/SlotsEngine';
import { DiceEngine } from '../engines/DiceEngine';
import { BlackjackEngine } from '../engines/BlackjackEngine';
import { RouletteEngine } from '../engines/RouletteEngine';

const router = Router();

// Single-player games have no table-configured limits (unlike multiplayer tables, which
// carry their own minBet/maxBet - see BlackjackTableManager/RouletteTableManager), so we
// enforce a flat ceiling here, consistent with the default maxBet used across those tables.
const MAX_BET = 1000;

// =====================
// ENHANCED SLOTS GAME API
// =====================

// POST /api/games/slots/spin - Enhanced with RPG character system
router.post('/slots/spin', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { bet, machineType } = req.body;

    if (!bet || bet < 10) {
      throw new AppError('Minimum bet is 10 coins', 400);
    }

    if (bet > MAX_BET) {
      throw new AppError(`Maximum bet is ${MAX_BET} coins`, 400);
    }

    // The requested machine type is the *theme* (5th parameter) - passing it as
    // machineId (4th) silently fell through to the 'classic' symbol set.
    const theme = machineType || 'dragon';
    const result = await SlotsEngine.spin(userId, guildId, bet, theme, theme);

    res.json({
      success: true,
      result: {
        reels: result.reels,
        outcome: result.outcome,
        bet,
        payout: result.finalPayout,
        netChange: result.finalPayout - bet,
        winType: result.winType,
        multiplier: result.bonusMultiplier,
        xpGained: result.xpGained,
        specialAbility: result.specialAbilityTriggered,
        characterBonus: result.characterBonus
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// ENHANCED DICE GAME API
// =====================

// POST /api/games/dice/roll - Enhanced with RPG character bonuses
router.post('/dice/roll', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { bet, prediction } = req.body;

    if (!bet || bet < 10) {
      throw new AppError('Minimum bet is 10 coins', 400);
    }

    if (bet > MAX_BET) {
      throw new AppError(`Maximum bet is ${MAX_BET} coins`, 400);
    }

    if (!prediction) {
      throw new AppError('Prediction required (high/low or specific number)', 400);
    }

    const result = await DiceEngine.rollDice(userId, guildId, bet, prediction);

    res.json({
      success: true,
      result: {
        dice: result.dice,
        total: result.total,
        prediction: result.prediction,
        predictionType: result.predictionType,
        isCorrect: result.isCorrect,
        outcome: result.outcome,
        bet,
        payout: result.finalPayout,
        netChange: result.finalPayout - bet,
        payoutMultiplier: result.payoutMultiplier,
        xpGained: result.xpGained,
        specialAbility: result.specialAbilityTriggered,
        characterBonus: result.characterBonus
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/dice/info - Get dice game info and predictions
router.get('/dice/info', async (req: AuthenticatedRequest, res, next) => {
  try {
    const diceInfo = DiceEngine.getDiceGameInfo();
    res.json({ success: true, info: diceInfo });
  } catch (error) {
    next(error);
  }
});

// =====================
// ENHANCED BLACKJACK API
// =====================

// POST /api/games/blackjack/play - Single-player blackjack with character bonuses
router.post('/blackjack/play', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { bet, strategy } = req.body; // strategy: 'hit', 'stand', 'double' (optional)

    if (!bet || bet < 10) {
      throw new AppError('Minimum bet is 10 coins', 400);
    }

    if (bet > MAX_BET) {
      throw new AppError(`Maximum bet is ${MAX_BET} coins`, 400);
    }

    const result = await BlackjackEngine.playSinglePlayerBlackjack(
      userId,
      guildId,
      bet,
      strategy
    );

    res.json({
      success: true,
      result: {
        playerHand: {
          cards: result.playerHand.cards.map(c => `${c.rank}${c.suit[0]}`),
          value: result.playerHand.value,
          isBlackjack: result.playerHand.isBlackjack,
          isBusted: result.playerHand.isBusted,
          isSoft: result.playerHand.isSoft
        },
        dealerHand: {
          cards: result.dealerHand.cards.map(c => `${c.rank}${c.suit[0]}`),
          value: result.dealerHand.value,
          isBusted: result.dealerHand.isBusted
        },
        outcome: result.outcome,
        gameType: result.gameType,
        bet,
        payout: result.finalPayout,
        netChange: result.finalPayout - bet,
        doubleDowned: result.doubleDowned,
        xpGained: result.xpGained,
        specialAbility: result.specialAbilityTriggered,
        characterBonus: result.characterBonus
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/blackjack/info - Get blackjack strategies and character bonuses
router.get('/blackjack/info', async (req: AuthenticatedRequest, res, next) => {
  try {
    const blackjackInfo = BlackjackEngine.getBlackjackGameInfo();
    res.json({ success: true, info: blackjackInfo });
  } catch (error) {
    next(error);
  }
});

// =====================
// ENHANCED ROULETTE API
// =====================

// POST /api/games/roulette/play - Single-player roulette with multiple bets
router.post('/roulette/play', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { bets } = req.body; // bets: [{ type: 'red', amount: 50 }, { type: 'straight', amount: 10, value: 7 }]

    if (!bets || !Array.isArray(bets) || bets.length === 0) {
      throw new AppError('At least one bet required', 400);
    }

    const totalBet = bets.reduce((sum: number, bet: any) => sum + (bet.amount || 0), 0);
    if (totalBet < 10) {
      throw new AppError('Minimum total bet is 10 coins', 400);
    }

    if (totalBet > MAX_BET) {
      throw new AppError(`Maximum total bet is ${MAX_BET} coins`, 400);
    }

    const result = await RouletteEngine.playSinglePlayerRoulette(userId, guildId, bets);

    res.json({
      success: true,
      result: {
        winningNumber: result.winningNumber,
        winningColor: result.winningColor,
        bets: result.bets.map(bet => ({
          type: bet.type,
          amount: bet.amount,
          description: bet.description,
          payout: bet.payout,
          won: result.winningBets.includes(bet)
        })),
        outcome: result.outcome,
        totalBet: result.totalBetAmount,
        payout: result.finalPayout,
        netChange: result.finalPayout - result.totalBetAmount,
        winningBetsCount: result.winningBets.length,
        xpGained: result.xpGained,
        specialAbility: result.specialAbilityTriggered,
        socialBonus: result.socialBonus,
        communityPayout: result.communityPayout,
        characterBonus: result.characterBonus
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/roulette/info - Get roulette bet types and payouts
router.get('/roulette/info', async (req: AuthenticatedRequest, res, next) => {
  try {
    const rouletteInfo = RouletteEngine.getRouletteGameInfo();
    res.json({ success: true, info: rouletteInfo });
  } catch (error) {
    next(error);
  }
});

// =====================
// GAME STATISTICS AND LEADERBOARDS
// =====================

// GET /api/games/stats/user - Get user's game statistics
router.get('/stats/user', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const { CasinoGameLog } = await import('../models/schemas');

    const stats = await CasinoGameLog.aggregate([
      { $match: { userId, guildId } },
      {
        $group: {
          _id: '$gameType',
          totalGames: { $sum: 1 },
          totalWagered: { $sum: '$bet' },
          totalWon: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, '$payout', 0] } },
          biggestWin: { $max: '$payout' },
          winRate: { $avg: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } }
        }
      }
    ]);

    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/leaderboard - Get casino leaderboard
router.get('/leaderboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { period = 'all' } = req.query; // 'daily', 'weekly', 'monthly', 'all'

    const { User, SharedEconomy } = await import('../models/database');

    let dateFilter: any = {};
    if (period === 'daily') {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      dateFilter = { lastDailyTimestamp: { $gte: yesterday } };
    } else if (period === 'weekly') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      dateFilter = { lastDailyTimestamp: { $gte: weekAgo } };
    }

    const topEconomies = await SharedEconomy.find({ guildId, ...dateFilter })
      .sort({ coins: -1 })
      .limit(10)
      .select('userId coins')
      .lean();

    const userIds = topEconomies.map((e: any) => e.userId);
    const users = await User.find({ guildId, userId: { $in: userIds } })
      .select('userId username level xp')
      .lean();
    const usersById = new Map<string, any>(users.map((u: any) => [u.userId, u]));

    const leaderboard = topEconomies.map((economy: any) => {
      const user = usersById.get(economy.userId);
      return {
        userId: economy.userId,
        username: user?.username || 'Unknown User',
        coins: economy.coins,
        level: user?.level,
        xp: user?.xp
      };
    });

    res.json({ success: true, leaderboard, period });
  } catch (error) {
    next(error);
  }
});

export default router;
