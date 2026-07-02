import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { User, Character } from '../models/database';
import { EconomyService } from '../services/EconomyService';

// Historical starting balance for brand-new casino players, on top of the shared
// economy's own default of 100 coins (bot/database/db.ts's UserLevel default).
const NEW_PLAYER_WELCOME_BONUS = 900;

const router = Router();

// POST /api/auth/dev - Development mode authentication (no Discord token required)
router.post('/dev', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Development authentication not allowed in production', 403);
    }

    const { username } = req.body;
    const userId = 'dev-user-demo'; // Fixed demo user ID
    const guildId = 'dev-guild';

    const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';
    const token = jwt.sign(
      {
        userId,
        guildId,
        discordId: userId,
        username: username || 'Demo User'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Development authentication successful',
      token,
      user: {
        id: userId,
        userId,
        guildId,
        username: username || 'Demo User',
        coins: 1000,
        level: 1,
        experience: 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/discord - Exchange Discord OAuth code for access token (for Discord Activity)
router.post('/discord', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, discordToken, userId, guildId, username } = req.body;

    // Handle OAuth code exchange for Discord Activity
    if (code) {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new AppError('Discord OAuth not configured', 500);
      }

      // Exchange the code for an access token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code: code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('[Auth] Discord OAuth error:', errorData);
        throw new AppError('Failed to exchange OAuth code', 401);
      }

      const tokenData = await tokenResponse.json() as {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        scope: string;
      };

      res.json({
        success: true,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope
      });
      return;
    }

    // Legacy flow: Direct token authentication
    if (!discordToken || !userId || !guildId) {
      throw new AppError('Missing required fields', 400);
    }

    // In a real implementation, you would validate the Discord token
    // For now, we'll create a JWT token with the provided info
    const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';
    const token = jwt.sign(
      {
        userId,
        guildId,
        discordId: userId,
        username: username || 'Discord User'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        userId,
        guildId,
        username: username || 'Discord User'
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh - Refresh authentication token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';
    const decoded = jwt.verify(refreshToken, jwtSecret) as any;

    const newToken = jwt.sign(
      {
        userId: decoded.userId,
        guildId: decoded.guildId,
        discordId: decoded.discordId,
        username: decoded.username
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid refresh token', 401));
      return;
    }
    next(error);
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Access token required', 401);
    }

    const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Fetch user from database
    let user = await User.findOne({ userId: decoded.userId, guildId: decoded.guildId });

    // Create user if doesn't exist (for demo mode)
    if (!user) {
      user = await User.create({
        userId: decoded.userId,
        guildId: decoded.guildId,
        username: decoded.username || 'Demo User',
        level: 1,
        xp: 0
      });
      await EconomyService.addCoins(decoded.userId, decoded.guildId, NEW_PLAYER_WELCOME_BONUS);
    }

    // Fetch character to get XP/level (character progression is the primary progression system)
    const [character, coins] = await Promise.all([
      Character.findOne({ userId: decoded.userId, guildId: decoded.guildId }),
      EconomyService.getCoins(decoded.userId, decoded.guildId)
    ]);

    // Return actual user data from database, with character XP/level if character exists
    res.json({
      success: true,
      user: {
        id: user.userId,
        userId: user.userId,
        username: user.username,
        coins,
        level: character ? (character as any).level : user.level,
        experience: character ? (character as any).xp : user.xp
      }
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid access token', 401));
      return;
    }
    next(error);
  }
});

export default router;
