import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { EnergyService } from '../services/EnergyService';
import { ReputationService } from '../services/ReputationService';
import { AbilityService } from '../services/AbilityService';

const router = Router();

// =====================
// ENERGY MANAGEMENT
// =====================

// GET /api/progression/energy - Get current energy status
router.get('/energy', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const energyInfo = await EnergyService.getEnergyInfo(userId, guildId);

    res.json({
      success: true,
      energy: energyInfo
    });
  } catch (error) {
    next(error);
  }
});

// NOTE: A POST /api/progression/energy/restore endpoint used to live here ("for
// admin/special events"), letting any authenticated user restore their own energy
// to full for free with no actual admin/service check. It has been removed. Energy
// regenerates via EnergyService's normal time-based regen (see EnergyService.getEnergyInfo).

// =====================
// REPUTATION SYSTEM
// =====================

// GET /api/progression/reputation - Get current reputation status
router.get('/reputation', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const repInfo = await ReputationService.getReputationInfo(userId, guildId);

    res.json({
      success: true,
      reputation: repInfo
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progression/reputation/tiers - Get all reputation tiers
router.get('/reputation/tiers', async (req: AuthenticatedRequest, res, next) => {
  try {
    const tiers = ReputationService.getAllTiers();

    res.json({
      success: true,
      tiers
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progression/reputation/bonuses - Get current reputation bonuses
router.get('/reputation/bonuses', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;

    const repInfo = await ReputationService.getReputationInfo(userId, guildId);
    const bonuses = ReputationService.getReputationBonuses(repInfo.tier);

    res.json({
      success: true,
      tier: repInfo.tier,
      bonuses
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// ABILITY SYSTEM
// =====================

// GET /api/progression/abilities - Get all available abilities and their status
router.get('/abilities', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { sessionId } = req.query;

    const abilityStatus = await AbilityService.getAbilityStatus(
      userId,
      guildId,
      sessionId as string | undefined
    );

    res.json({
      success: true,
      abilities: abilityStatus
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progression/abilities/:abilityKey - Check if specific ability can be used
router.get('/abilities/:abilityKey', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { abilityKey } = req.params;
    const { sessionId } = req.query;

    const canUse = await AbilityService.canUseAbility(
      userId,
      guildId,
      abilityKey,
      sessionId as string | undefined
    );

    res.json({
      success: canUse.success,
      ability: abilityKey,
      available: canUse.success,
      effect: canUse.effect,
      message: canUse.message,
      cooldownRemaining: canUse.cooldownRemaining,
      usesRemaining: canUse.usesRemaining
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// COMBINED STATS
// =====================

// GET /api/progression/stats - Get all progression stats in one call
router.get('/stats', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { userId, guildId } = req.user!;
    const { sessionId } = req.query;

    const [energyInfo, repInfo, abilityStatus] = await Promise.all([
      EnergyService.getEnergyInfo(userId, guildId),
      ReputationService.getReputationInfo(userId, guildId),
      AbilityService.getAbilityStatus(userId, guildId, sessionId as string | undefined)
    ]);

    const bonuses = ReputationService.getReputationBonuses(repInfo.tier);

    res.json({
      success: true,
      progression: {
        energy: energyInfo,
        reputation: {
          ...repInfo,
          bonuses
        },
        abilities: abilityStatus
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
