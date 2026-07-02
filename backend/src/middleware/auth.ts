import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    guildId: string;
    discordId: string;
    username: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new AppError('Access token required', 401));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');
    const decoded = jwt.verify(token, jwtSecret) as any;

    // For Discord Activity, we expect the token to contain Discord user info
    if (!decoded.userId || !decoded.guildId) {
      return next(new AppError('Invalid token format', 401));
    }

    req.user = {
      userId: decoded.userId,
      guildId: decoded.guildId,
      discordId: decoded.discordId || decoded.userId,
      username: decoded.username || 'Unknown User'
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid access token', 401));
    }
    next(error);
  }
};

// Middleware for Discord SDK token validation (for Discord Activities)
export const discordAuthMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    // For Discord Activities, we might receive a different token format
    const discordToken = req.headers['x-discord-token'] as string;
    const instanceId = req.headers['x-discord-instance-id'] as string;

    if (!discordToken || !instanceId) {
      return next(new AppError('Discord authentication required', 401));
    }

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');
      const payload = jwt.verify(discordToken, jwtSecret) as any;

      req.user = {
        userId: payload.userId || payload.user?.id || payload.sub,
        guildId: payload.guildId || payload.guild_id || req.headers['x-discord-guild-id'] as string,
        discordId: payload.discordId || payload.user?.id || payload.sub,
        username: payload.username || payload.user?.username || 'Discord User'
      };

      next();
    } catch (tokenError) {
      return next(new AppError('Invalid or expired Discord token', 401));
    }
  } catch (error) {
    next(error);
  }
};