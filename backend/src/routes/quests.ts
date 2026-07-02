import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { QuestService } from '../services/QuestService';

const router = Router();

// =====================
// QUEST LISTING
// =====================

// GET /api/quests/available - Get all available quests for the player
router.get('/available', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const quests = await QuestService.getAvailableQuests(userId, guildId);

    res.json({
      success: true,
      quests,
      count: quests.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/quests/active - Get player's active quests
router.get('/active', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const quests = await QuestService.getActiveQuests(userId, guildId);

    res.json({
      success: true,
      quests,
      count: quests.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/quests/history - Get completed quests history
router.get('/history', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await QuestService.getQuestHistory(userId, guildId, limit);

    res.json({
      success: true,
      quests: history,
      count: history.length
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// QUEST ACTIONS
// =====================

// POST /api/quests/:questId/start - Start a quest
router.post('/:questId/start', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { questId } = req.params;

    const quest = await QuestService.startQuest(userId, guildId, questId);

    res.json({
      success: true,
      message: `Quest "${quest.title}" started!`,
      quest
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/quests/:questId/abandon - Abandon a quest
router.post('/:questId/abandon', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { questId } = req.params;

    await QuestService.abandonQuest(userId, guildId, questId);

    res.json({
      success: true,
      message: 'Quest abandoned'
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// QUEST PROGRESS (Internal API for game engines)
// =====================

// POST /api/quests/progress - Update quest progress (internal use)
router.post('/progress', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { type, target, amount } = req.body;

    if (!type || amount === undefined) {
      throw new AppError('Missing type or amount', 400);
    }

    const result = await QuestService.updateQuestProgress(userId, guildId, {
      type,
      target,
      amount
    });

    res.json({
      success: true,
      questsUpdated: result.questsUpdated,
      questsCompleted: result.questsCompleted,
      message: result.questsCompleted.length > 0
        ? `${result.questsCompleted.length} quest(s) completed!`
        : result.questsUpdated.length > 0
          ? 'Quest progress updated'
          : 'No active quests affected'
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// ADMIN QUEST MANAGEMENT
// =====================

// POST /api/quests/admin/init-daily - Initialize daily quests for the guild
router.post('/admin/init-daily', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;

    await QuestService.createDailyQuests(guildId);

    res.json({
      success: true,
      message: 'Daily quests initialized'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/quests/admin/init-story - Initialize story quests for the guild
router.post('/admin/init-story', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;

    await QuestService.createStoryQuests(guildId);

    res.json({
      success: true,
      message: 'Story quests initialized'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
