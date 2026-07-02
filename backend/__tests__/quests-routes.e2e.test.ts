import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { Mock } from 'vitest';
/**
 * End-to-end tests for Quests API routes
 * Tests quest system flows including listing, starting, progress, and completion
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Mock dependencies BEFORE importing routes
vi.mock('../src/models/database');
vi.mock('../src/models/schemas');
vi.mock('../src/services/QuestService');

// Import after mocking
import questsRoutes from '../src/routes/quests';
import { authMiddleware } from '../src/middleware/auth';
import { errorHandler, AppError } from '../src/middleware/errorHandler';
import { QuestService } from '../src/services/QuestService';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/quests', authMiddleware, questsRoutes);
app.use(errorHandler);

describe('Quests API E2E Tests', () => {
  let authToken: string;
  const testUserId = 'quests-test-user';
  const testGuildId = 'quests-test-guild';
  const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';

  beforeAll(() => {
    authToken = jwt.sign(
      { 
        userId: testUserId,
        guildId: testGuildId,
        username: 'QuestsTestUser',
        discordId: testUserId
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================
  // QUEST LISTING TESTS
  // =====================
  describe('GET /api/quests/available - Available Quests', () => {
    it('should return all available quests', async () => {
      const mockQuests = [
        {
          id: 'quest-1',
          title: 'First Steps',
          description: 'Win your first game',
          type: 'daily',
          objectives: [{ type: 'win', target: 1, current: 0 }],
          rewards: { coins: 100, xp: 25 },
          difficulty: 'easy'
        },
        {
          id: 'quest-2',
          title: 'High Roller',
          description: 'Bet 1000 coins in a single session',
          type: 'daily',
          objectives: [{ type: 'wager', target: 1000, current: 0 }],
          rewards: { coins: 250, xp: 50 },
          difficulty: 'medium'
        },
        {
          id: 'quest-3',
          title: 'Lucky Seven',
          description: 'Win 7 games in a row',
          type: 'weekly',
          objectives: [{ type: 'streak', target: 7, current: 0 }],
          rewards: { coins: 500, xp: 100, reputation: 25 },
          difficulty: 'hard'
        }
      ];

      (QuestService.getAvailableQuests as Mock).mockResolvedValue(mockQuests);

      const response = await request(app)
        .get('/api/quests/available')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.quests).toHaveLength(3);
      expect(response.body.count).toBe(3);
      expect(response.body.quests[0].title).toBe('First Steps');
      expect(response.body.quests[2].type).toBe('weekly');
    });

    it('should return empty list when no quests available', async () => {
      (QuestService.getAvailableQuests as Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/quests/available')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.quests).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/quests/available');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/quests/active - Active Quests', () => {
    it('should return player active quests', async () => {
      const mockActiveQuests = [
        {
          id: 'active-1',
          title: 'Blackjack Master',
          description: 'Win 5 blackjack games',
          type: 'daily',
          objectives: [{ type: 'win_blackjack', target: 5, current: 3 }],
          rewards: { coins: 200, xp: 50 },
          progress: 60,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      ];

      (QuestService.getActiveQuests as Mock).mockResolvedValue(mockActiveQuests);

      const response = await request(app)
        .get('/api/quests/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.quests).toHaveLength(1);
      expect(response.body.quests[0].progress).toBe(60);
      expect(response.body.quests[0].objectives[0].current).toBe(3);
    });

    it('should return empty list when no active quests', async () => {
      (QuestService.getActiveQuests as Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/quests/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.quests).toHaveLength(0);
    });
  });

  describe('GET /api/quests/history - Quest History', () => {
    it('should return completed quests history', async () => {
      const mockHistory = [
        {
          id: 'completed-1',
          title: 'Beginner Luck',
          completedAt: new Date('2024-01-15'),
          rewards: { coins: 100, xp: 25 }
        },
        {
          id: 'completed-2',
          title: 'Big Winner',
          completedAt: new Date('2024-01-14'),
          rewards: { coins: 500, xp: 100 }
        }
      ];

      (QuestService.getQuestHistory as Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/quests/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.quests).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should respect limit parameter', async () => {
      const mockHistory = [
        { id: 'completed-1', title: 'Quest 1' },
        { id: 'completed-2', title: 'Quest 2' },
        { id: 'completed-3', title: 'Quest 3' }
      ];

      (QuestService.getQuestHistory as Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/quests/history')
        .query({ limit: 5 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(QuestService.getQuestHistory).toHaveBeenCalledWith(testUserId, testGuildId, 5);
    });

    it('should use default limit of 10', async () => {
      (QuestService.getQuestHistory as Mock).mockResolvedValue([]);

      await request(app)
        .get('/api/quests/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(QuestService.getQuestHistory).toHaveBeenCalledWith(testUserId, testGuildId, 10);
    });
  });

  // =====================
  // QUEST ACTION TESTS
  // =====================
  describe('POST /api/quests/:questId/start - Start Quest', () => {
    it('should start a quest successfully', async () => {
      const mockQuest = {
        id: 'quest-123',
        title: 'Slot Champion',
        description: 'Win 10 slot games',
        type: 'daily',
        objectives: [{ type: 'win_slots', target: 10, current: 0 }],
        rewards: { coins: 300, xp: 75 },
        startedAt: new Date(),
        status: 'active'
      };

      (QuestService.startQuest as Mock).mockResolvedValue(mockQuest);

      const response = await request(app)
        .post('/api/quests/quest-123/start')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Slot Champion');
      expect(response.body.quest.status).toBe('active');
    });

    it('should reject non-existent quest', async () => {
      (QuestService.startQuest as Mock).mockRejectedValue(new AppError('Quest not found', 404));

      const response = await request(app)
        .post('/api/quests/invalid-quest/start')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should reject already active quest', async () => {
      (QuestService.startQuest as Mock).mockRejectedValue(new AppError('Quest already active', 400));

      const response = await request(app)
        .post('/api/quests/quest-123/start')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/quests/:questId/abandon - Abandon Quest', () => {
    it('should abandon quest successfully', async () => {
      (QuestService.abandonQuest as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/quests/quest-123/abandon')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Quest abandoned');
    });

    it('should reject abandoning non-existent quest', async () => {
      (QuestService.abandonQuest as Mock).mockRejectedValue(new AppError('Quest not found', 404));

      const response = await request(app)
        .post('/api/quests/invalid-quest/abandon')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  // =====================
  // QUEST PROGRESS TESTS
  // =====================
  describe('POST /api/quests/progress - Update Quest Progress', () => {
    it('should update quest progress', async () => {
      const mockResult = {
        questsUpdated: ['quest-1', 'quest-2'],
        questsCompleted: []
      };

      (QuestService.updateQuestProgress as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/quests/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'win',
          target: 'blackjack',
          amount: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.questsUpdated).toHaveLength(2);
      expect(response.body.message).toContain('Quest progress updated');
    });

    it('should notify when quest is completed', async () => {
      const mockResult = {
        questsUpdated: ['quest-1'],
        questsCompleted: [{ id: 'quest-1', title: 'First Win', rewards: { coins: 100 } }]
      };

      (QuestService.updateQuestProgress as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/quests/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'win',
          amount: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.questsCompleted).toHaveLength(1);
      expect(response.body.message).toContain('1 quest(s) completed');
    });

    it('should handle no active quests affected', async () => {
      const mockResult = {
        questsUpdated: [],
        questsCompleted: []
      };

      (QuestService.updateQuestProgress as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/quests/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'wager',
          amount: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('No active quests affected');
    });

    it('should reject missing type', async () => {
      const response = await request(app)
        .post('/api/quests/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing type or amount');
    });

    it('should reject missing amount', async () => {
      const response = await request(app)
        .post('/api/quests/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'win' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing type or amount');
    });
  });

  // =====================
  // ADMIN QUEST MANAGEMENT TESTS
  // =====================
  describe('POST /api/quests/admin/init-daily - Initialize Daily Quests', () => {
    it('should initialize daily quests', async () => {
      (QuestService.createDailyQuests as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/quests/admin/init-daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Daily quests initialized');
      expect(QuestService.createDailyQuests).toHaveBeenCalledWith(testGuildId);
    });

    it('should handle initialization error', async () => {
      (QuestService.createDailyQuests as Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/quests/admin/init-daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/quests/admin/init-story - Initialize Story Quests', () => {
    it('should initialize story quests', async () => {
      (QuestService.createStoryQuests as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/quests/admin/init-story')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Story quests initialized');
      expect(QuestService.createStoryQuests).toHaveBeenCalledWith(testGuildId);
    });
  });

  // =====================
  // AUTHENTICATION TESTS
  // =====================
  describe('Authentication across all quest endpoints', () => {
    const questEndpoints = [
      { method: 'get', path: '/api/quests/available' },
      { method: 'get', path: '/api/quests/active' },
      { method: 'get', path: '/api/quests/history' },
      { method: 'post', path: '/api/quests/quest-123/start' },
      { method: 'post', path: '/api/quests/quest-123/abandon' },
      { method: 'post', path: '/api/quests/progress', body: { type: 'win', amount: 1 } },
      { method: 'post', path: '/api/quests/admin/init-daily' },
      { method: 'post', path: '/api/quests/admin/init-story' }
    ];

    it.each(questEndpoints)('should require authentication for $method $path', async (endpoint) => {
      const req = endpoint.method === 'get'
        ? request(app).get(endpoint.path)
        : request(app).post(endpoint.path).send(endpoint.body || {});

      const response = await req;
      expect(response.status).toBe(401);
    });

    it.each(questEndpoints)('should reject invalid token for $method $path', async (endpoint) => {
      const req = endpoint.method === 'get'
        ? request(app).get(endpoint.path).set('Authorization', 'Bearer invalid-token')
        : request(app).post(endpoint.path).set('Authorization', 'Bearer invalid-token').send(endpoint.body || {});

      const response = await req;
      expect(response.status).toBe(401);
    });
  });

  // =====================
  // WORKFLOW TESTS
  // =====================
  describe('Quest Workflow E2E', () => {
    it('should complete full quest workflow: browse → start → progress → complete', async () => {
      // Step 1: Browse available quests
      const availableQuests = [
        {
          id: 'quest-workflow',
          title: 'Quick Win',
          description: 'Win 1 game',
          objectives: [{ type: 'win', target: 1, current: 0 }],
          rewards: { coins: 50, xp: 10 }
        }
      ];

      (QuestService.getAvailableQuests as Mock).mockResolvedValue(availableQuests);

      const browseResponse = await request(app)
        .get('/api/quests/available')
        .set('Authorization', `Bearer ${authToken}`);

      expect(browseResponse.status).toBe(200);
      expect(browseResponse.body.quests).toHaveLength(1);

      // Step 2: Start the quest
      const startedQuest = {
        ...availableQuests[0],
        status: 'active',
        startedAt: new Date()
      };

      (QuestService.startQuest as Mock).mockResolvedValue(startedQuest);

      const startResponse = await request(app)
        .post('/api/quests/quest-workflow/start')
        .set('Authorization', `Bearer ${authToken}`);

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.quest.status).toBe('active');

      // Step 3: Check active quests
      (QuestService.getActiveQuests as Mock).mockResolvedValue([startedQuest]);

      const activeResponse = await request(app)
        .get('/api/quests/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(activeResponse.body.quests).toHaveLength(1);

      // Step 4: Update progress (win a game)
      const progressResult = {
        questsUpdated: ['quest-workflow'],
        questsCompleted: [{ id: 'quest-workflow', title: 'Quick Win', rewards: { coins: 50 } }]
      };

      (QuestService.updateQuestProgress as Mock).mockResolvedValue(progressResult);

      const progressResponse = await request(app)
        .post('/api/quests/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'win', amount: 1 });

      expect(progressResponse.status).toBe(200);
      expect(progressResponse.body.questsCompleted).toHaveLength(1);
      expect(progressResponse.body.message).toContain('completed');

      // Step 5: Check history for completed quest
      const history = [
        {
          id: 'quest-workflow',
          title: 'Quick Win',
          completedAt: new Date(),
          rewards: { coins: 50, xp: 10 }
        }
      ];

      (QuestService.getQuestHistory as Mock).mockResolvedValue(history);

      const historyResponse = await request(app)
        .get('/api/quests/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(historyResponse.body.quests).toHaveLength(1);
      expect(historyResponse.body.quests[0].title).toBe('Quick Win');
    });

    it('should handle quest abandonment workflow', async () => {
      // Start a quest
      const startedQuest = {
        id: 'abandon-test',
        title: 'Hard Quest',
        status: 'active'
      };

      (QuestService.startQuest as Mock).mockResolvedValue(startedQuest);
      (QuestService.abandonQuest as Mock).mockResolvedValue(undefined);
      (QuestService.getActiveQuests as Mock).mockResolvedValue([]);

      // Start quest
      await request(app)
        .post('/api/quests/abandon-test/start')
        .set('Authorization', `Bearer ${authToken}`);

      // Abandon quest
      const abandonResponse = await request(app)
        .post('/api/quests/abandon-test/abandon')
        .set('Authorization', `Bearer ${authToken}`);

      expect(abandonResponse.status).toBe(200);
      expect(abandonResponse.body.success).toBe(true);

      // Verify no active quests
      const activeResponse = await request(app)
        .get('/api/quests/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(activeResponse.body.quests).toHaveLength(0);
    });
  });
});

