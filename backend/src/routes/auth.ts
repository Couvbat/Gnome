import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { User, Character } from '../models/database';
import { EconomyService } from '../services/EconomyService';

// Historical starting balance for brand-new casino players, on top of the shared
// economy's own default of 100 coins (bot/database/db.ts's UserLevel default).
const NEW_PLAYER_WELCOME_BONUS = 900;

const router = Router();

interface SessionClaims {
  userId: string;
  guildId: string;
  discordId: string;
  username: string;
}

function requireJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');
  return jwtSecret;
}

function signAccessToken(claims: SessionClaims): string {
  return jwt.sign({ ...claims, type: 'access' }, requireJwtSecret(), { expiresIn: '7d' });
}

// Refresh tokens carry a distinct `type` claim: the auth middlewares reject
// them as access tokens, and /refresh rejects anything without it - so a
// stolen access token can't be laundered into an indefinitely renewable one.
function signRefreshToken(claims: SessionClaims): string {
  return jwt.sign({ ...claims, type: 'refresh' }, requireJwtSecret(), { expiresIn: '30d' });
}

// POST /api/auth/dev - Development mode authentication (no Discord token required)
router.post('/dev', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Fail closed: only explicitly-declared development/test environments may
    // use this. Gating on "not production" left the endpoint wide open on any
    // deployment where NODE_ENV simply wasn't set.
    const env = process.env.NODE_ENV;
    if (env !== 'development' && env !== 'test') {
      throw new AppError('Development authentication not allowed in production', 403);
    }

    const { username } = req.body;
    const userId = 'dev-user-demo'; // Fixed demo user ID
    const guildId = 'dev-guild';

    const claims: SessionClaims = {
      userId,
      guildId,
      discordId: userId,
      username: username || 'Demo User'
    };
    const token = signAccessToken(claims);

    res.json({
      success: true,
      message: 'Development authentication successful',
      token,
      refreshToken: signRefreshToken(claims),
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

// POST /api/auth/discord - Exchange Discord OAuth code for access token (for Discord Activity),
// or exchange a verified Discord access token for our own session JWT.
router.post('/discord', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, discordToken, guildId } = req.body;

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

    // Direct token authentication: the client supplies a Discord OAuth access token
    // (obtained via the `code` exchange above, or Discord's SDK) plus the guild
    // context. The token is verified against Discord's API below - userId is always
    // derived from that verified response, never trusted from client-supplied fields.
    if (!discordToken || !guildId) {
      throw new AppError('Missing required fields', 400);
    }

    const discordUserResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${discordToken}` }
    });

    if (!discordUserResponse.ok) {
      throw new AppError('Invalid or expired Discord token', 401);
    }

    const discordUser = await discordUserResponse.json() as {
      id: string;
      username: string;
      global_name?: string;
    };

    // Verify the caller is actually a member of the guild they're claiming - the
    // access token itself carries no guild context, so this prevents an attacker
    // from pointing an otherwise-valid token at an arbitrary guild's economy.
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${discordToken}` }
    });

    if (!guildsResponse.ok) {
      throw new AppError('Unable to verify guild membership (missing "guilds" scope?)', 401);
    }

    const guilds = await guildsResponse.json() as Array<{ id: string }>;
    if (!guilds.some(g => g.id === guildId)) {
      throw new AppError('You are not a member of the specified guild', 401);
    }

    const claims: SessionClaims = {
      userId: discordUser.id,
      guildId,
      discordId: discordUser.id,
      username: discordUser.global_name || discordUser.username
    };

    res.json({
      success: true,
      message: 'Authentication successful',
      token: signAccessToken(claims),
      refreshToken: signRefreshToken(claims),
      user: {
        userId: discordUser.id,
        guildId,
        username: discordUser.global_name || discordUser.username
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

    const decoded = jwt.verify(refreshToken, requireJwtSecret()) as any;

    // Only dedicated refresh tokens may mint new access tokens - accepting
    // any valid JWT here let a stolen 7-day access token renew itself forever.
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid refresh token', 401);
    }

    const claims: SessionClaims = {
      userId: decoded.userId,
      guildId: decoded.guildId,
      discordId: decoded.discordId,
      username: decoded.username
    };

    res.json({
      success: true,
      token: signAccessToken(claims)
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

    const decoded = jwt.verify(token, requireJwtSecret()) as any;

    // Refresh tokens are only valid on /refresh, never as an access token
    if (decoded.type === 'refresh') {
      throw new AppError('Invalid access token', 401);
    }

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
