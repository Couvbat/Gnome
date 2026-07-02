import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { CharacterService, CHARACTER_CLASSES } from '../services/CharacterService';
import { EnergyService } from '../services/EnergyService';
import { EconomyService } from '../services/EconomyService';
import { User, CasinoProfile } from '../models/database';

// Historical starting balance for brand-new casino players, on top of the shared
// economy's own default of 100 coins (bot/database/db.ts's UserLevel default).
const NEW_PLAYER_WELCOME_BONUS = 900;

const router = Router();

// =====================
// CHARACTER CLASS INFO
// =====================

// GET /api/characters/classes - Get all available character classes
router.get('/classes', async (req: AuthenticatedRequest, res, next) => {
  try {
    const classes = await CharacterService.getAllClasses();

    res.json({
      success: true,
      classes: Object.keys(CHARACTER_CLASSES).map(key => ({
        id: key,
        ...CHARACTER_CLASSES[key]
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/characters/classes/:className - Get specific class details
router.get('/classes/:className', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { className } = req.params;
    const classInfo = CHARACTER_CLASSES[className.toLowerCase()];

    if (!classInfo) {
      throw new AppError('Character class not found', 404);
    }

    res.json({
      success: true,
      class: {
        id: className.toLowerCase(),
        ...classInfo
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// CHARACTER MANAGEMENT
// =====================

// POST /api/characters/create - Create new character
router.post('/create', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { name, className } = req.body;

    if (!name || !className) {
      throw new AppError('Character name and class are required', 400);
    }

    // Ensure user exists
    let user = await User.findOne({ userId, guildId });
    if (!user) {
      // Create user if doesn't exist
      user = new User({
        userId,
        guildId,
        username: req.user!.username || 'Unknown User',
        xp: 0,
        level: 1,
        joinedAt: new Date(),
        lastActive: new Date()
      });
      await user.save();
      await EconomyService.addCoins(userId, guildId, NEW_PLAYER_WELCOME_BONUS);
    }

    const result = await CharacterService.createCharacter(userId, guildId, {
      name: name.trim(),
      className: className.toLowerCase()
    });

    res.json({
      success: true,
      message: `Character ${result.character.name} created successfully!`,
      character: {
        id: result.character._id,
        name: result.character.name,
        className: result.character.class,
        level: result.character.level,
        stats: result.character.stats,
        casinoBonus: result.character.casinoBonus
      },
      classInfo: result.classInfo
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/characters/me - Get current user's character
router.get('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const characterInfo = await CharacterService.getCharacterInfo(userId, guildId);

    if (!characterInfo) {
      return res.json({
        success: true,
        message: 'No character found. Create one first!',
        hasCharacter: false,
        character: null
      });
    }

    // Fetch energy info from CasinoProfile
    let energyInfo = { current: 100, max: 100, regenRate: 1, minutesUntilFull: 0 };
    try {
      energyInfo = await EnergyService.getEnergyInfo(userId, guildId);
    } catch {
      // If no casino profile yet, use defaults
    }

    res.json({
      success: true,
      hasCharacter: true,
      character: {
        id: characterInfo.character._id,
        name: (characterInfo.character as any).name,
        className: (characterInfo.character as any).class,
        level: characterInfo.character.level,
        experience: characterInfo.character.xp || 0,
        stats: (characterInfo.character as any).stats,
        casinoBonus: (characterInfo.character as any).casinoBonus,
        createdAt: (characterInfo.character as any).createdAt,
        energy: energyInfo.current,
        maxEnergy: energyInfo.max
      },
      classInfo: characterInfo.classInfo,
      totalStats: characterInfo.totalStats,
      levelProgress: characterInfo.levelProgress,
      energy: energyInfo
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/characters/level-up - Level up character (for testing or admin use)
router.put('/level-up', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { xp } = req.body;

    if (!xp || xp < 1) {
      throw new AppError('XP amount must be positive', 400);
    }

    const result = await CharacterService.levelUpCharacter(userId, guildId, xp);

    res.json({
      success: true,
      message: result.leveledUp
        ? `Character leveled up from ${result.oldLevel} to ${result.newLevel}!`
        : `Gained ${result.xpGained} XP`,
      character: {
        id: result.character._id,
        name: (result.character as any).name,
        level: result.character.level,
        experience: result.totalXp
      },
      leveledUp: result.leveledUp,
      xpGained: result.xpGained
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/characters/me - Delete current character
router.delete('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    await CharacterService.deleteCharacter(userId, guildId);

    res.json({
      success: true,
      message: 'Character deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// CHARACTER STATS & INFO
// =====================

// GET /api/characters/:characterId/stats - Get character detailed stats
router.get('/:characterId/stats', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { characterId } = req.params;
    const { guildId } = req.user!;

    const { Character } = require('../models/database');
    const character = await Character.findOne({
      _id: characterId,
      guildId
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    const totalStats = CharacterService.calculateTotalStats(character);
    const levelProgress = CharacterService.calculateLevelProgress((character as any).xp || 0);
    const classInfo = CHARACTER_CLASSES[(character as any).class];

    res.json({
      success: true,
      character: {
        id: character._id,
        name: (character as any).name,
        className: (character as any).class,
        level: character.level,
        experience: (character as any).xp || 0
      },
      stats: {
        base: (character as any).stats,
        total: totalStats,
        casinoBonus: (character as any).casinoBonus
      },
      classInfo,
      levelProgress
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/characters/leaderboard - Character leaderboard
router.get('/leaderboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const skip = (page - 1) * limit;

    const { Character } = require('../models/database');
    const characters = await Character.find({ guildId })
      .sort({ level: -1, xp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Character.countDocuments({ guildId });

    res.json({
      success: true,
      leaderboard: characters.map((char: any, index: number) => {
        const totalStats = CharacterService.calculateTotalStats(char);
        const classInfo = CHARACTER_CLASSES[char.class];

        return {
          rank: skip + index + 1,
          id: char._id,
          name: char.name,
          className: char.class,
          level: char.level,
          experience: char.xp || 0,
          totalStatPoints: totalStats.total,
          class: classInfo ? classInfo.name : 'Unknown'
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// CHARACTER SEARCH
// =====================

// GET /api/characters/search - Search characters by name
router.get('/search', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { guildId } = req.user!;
    const { name, className } = req.query;

    if (!name && !className) {
      throw new AppError('Search requires name or className parameter', 400);
    }

    const { Character } = require('../models/database');
    let query: any = { guildId };

    if (name) {
      query.name = new RegExp(name as string, 'i');
    }

    if (className) {
      query.class = (className as string).toLowerCase();
    }

    const characters = await Character.find(query).limit(20);

    res.json({
      success: true,
      results: characters.map((char: any) => {
        const classInfo = CHARACTER_CLASSES[char.class];

        return {
          id: char._id,
          name: char.name,
          className: char.class,
          level: char.level,
          class: classInfo ? classInfo.name : 'Unknown',
          createdAt: char.createdAt
        };
      }),
      total: characters.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;
