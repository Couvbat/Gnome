import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Import routes
import casinoRoutes from './routes/casino';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';
import characterRoutes from './routes/characters';
import progressionRoutes from './routes/progression';
import questRoutes from './routes/quests';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Import socket handlers
import { setupSocketHandlers } from './websocket/socketHandlers';

// Load environment variables
dotenv.config();

const app = express();

// Production runs behind o2switch's Passenger/Apache proxy - without this,
// req.ip is the proxy's address, so the per-IP rate limiter below lumps every
// client into a single shared bucket (one abusive client locks everyone out).
app.set('trust proxy', 1);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.DISCORD_ACTIVITY_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per 60 seconds
});

const rateLimitMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    await rateLimiter.consume(clientIP);
    next();
  } catch (rejRes: any) {
    res.status(429).json({ error: 'Too Many Requests', retryAfter: rejRes.msBeforeNext });
  }
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  }
}));
app.use(compression());
app.use(cors({
  origin: process.env.DISCORD_ACTIVITY_URL || "http://localhost:3000",
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimitMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/casino', authMiddleware, casinoRoutes);
app.use('/api/games', authMiddleware, gameRoutes);
app.use('/api/characters', authMiddleware, characterRoutes);
app.use('/api/progression', authMiddleware, progressionRoutes);
app.use('/api/quests', authMiddleware, questRoutes);

// Socket.IO setup
setupSocketHandlers(io);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnome-casino';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  await connectDB();
  
  httpServer.listen(PORT, () => {
    console.log(`🎰 Le Gnome Casino Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
};

// Crash visibility: Node 22 kills the process on an unhandled rejection with
// no useful log line; log it and keep serving (mirrors bot/index.ts). For
// uncaught exceptions the process state is unknown - log, then exit so
// Passenger restarts a clean instance.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled promise rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught exception:', error);
  httpServer.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Process terminated');
  });
});

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { app, io };