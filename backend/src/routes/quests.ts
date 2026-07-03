import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
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

// NOTE: A POST /api/quests/progress endpoint used to live here, documented as
// "internal use" for game engines to report progress. Nothing in the codebase
// actually called it that way - it was directly reachable by any authenticated
// user, letting them complete quests instantly by POSTing arbitrary progress
// amounts. It has been removed. Game engines call QuestService.updateQuestProgress()
// in-process; if a genuine internal/service-to-service caller is ever needed, it
// should go through real service authentication, not a plain authenticated-user route.

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
