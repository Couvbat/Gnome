import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { Mock } from 'vitest';
/**
 * End-to-end tests for Games API routes
 * Tests complete casino game flows with real API requests
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Mock dependencies BEFORE importing routes
vi.mock('../src/models/database');
vi.mock('../src/models/schemas');
vi.mock('../src/engines/SlotsEngine');
vi.mock('../src/engines/DiceEngine');
vi.mock('../src/engines/BlackjackEngine');
vi.mock('../src/engines/RouletteEngine');

// Import after mocking
import gamesRoutes from '../src/routes/games';
import { authMiddleware } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { User, CasinoProfile } from '../src/models/database';
import { SlotsEngine } from '../src/engines/SlotsEngine';
import { DiceEngine } from '../src/engines/DiceEngine';
import { BlackjackEngine } from '../src/engines/BlackjackEngine';
import { RouletteEngine } from '../src/engines/RouletteEngine';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/games', authMiddleware, gamesRoutes);
app.use(errorHandler);

describe('Games API E2E Tests', () => {
  let authToken: string;
  const testUserId = 'games-test-user';
  const testGuildId = 'games-test-guild';
  const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret';

  beforeAll(() => {
    authToken = jwt.sign(
      { 
        userId: testUserId,
        guildId: testGuildId,
        username: 'GamesTestUser',
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
  // SLOTS GAME TESTS
  // =====================
  describe('POST /api/games/slots/spin - Slots Game', () => {
    it('should spin slots and return win result', async () => {
      const mockResult = {
        reels: ['🍒', '🍒', '🍒'],
        outcome: 'win',
        finalPayout: 500,
        winType: 'triple',
        bonusMultiplier: 1.2,
        xpGained: 25,
        specialAbilityTriggered: null,
        characterBonus: { luckBonus: 5 }
      };

      (SlotsEngine.spin as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/slots/spin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100, machineType: 'dragon' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.reels).toEqual(['🍒', '🍒', '🍒']);
      expect(response.body.result.payout).toBe(500);
      expect(response.body.result.netChange).toBe(400);
      expect(response.body.result.xpGained).toBe(25);
    });

    it('should spin slots and return loss result', async () => {
      const mockResult = {
        reels: ['🍒', '🔔', '💎'],
        outcome: 'loss',
        finalPayout: 0,
        winType: null,
        bonusMultiplier: 1.0,
        xpGained: 5,
        specialAbilityTriggered: null,
        characterBonus: null
      };

      (SlotsEngine.spin as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/slots/spin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 50 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.outcome).toBe('loss');
      expect(response.body.result.payout).toBe(0);
      expect(response.body.result.netChange).toBe(-50);
    });

    it('should reject bet below minimum', async () => {
      const response = await request(app)
        .post('/api/games/slots/spin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum bet');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/games/slots/spin')
        .send({ bet: 100 });

      expect(response.status).toBe(401);
    });

    it('should handle special ability trigger', async () => {
      const mockResult = {
        reels: ['💎', '💎', '💎'],
        outcome: 'jackpot',
        finalPayout: 5000,
        winType: 'jackpot',
        bonusMultiplier: 2.0,
        xpGained: 100,
        specialAbilityTriggered: 'fortune_sight',
        characterBonus: { luckBonus: 10, energyBonus: 5 }
      };

      (SlotsEngine.spin as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/slots/spin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100, machineType: 'mystic' });

      expect(response.status).toBe(200);
      expect(response.body.result.outcome).toBe('jackpot');
      expect(response.body.result.specialAbility).toBe('fortune_sight');
      expect(response.body.result.multiplier).toBe(2.0);
    });
  });

  // =====================
  // DICE GAME TESTS
  // =====================
  describe('POST /api/games/dice/roll - Dice Game', () => {
    it('should roll dice with high prediction win', async () => {
      const mockResult = {
        dice: [4, 5],
        total: 9,
        prediction: 'high',
        predictionType: 'range',
        isCorrect: true,
        outcome: 'win',
        finalPayout: 200,
        payoutMultiplier: 2.0,
        xpGained: 20,
        specialAbilityTriggered: null,
        characterBonus: null
      };

      (DiceEngine.rollDice as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/dice/roll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100, prediction: 'high' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.dice).toEqual([4, 5]);
      expect(response.body.result.total).toBe(9);
      expect(response.body.result.isCorrect).toBe(true);
      expect(response.body.result.payout).toBe(200);
    });

    it('should roll dice with low prediction loss', async () => {
      const mockResult = {
        dice: [5, 6],
        total: 11,
        prediction: 'low',
        predictionType: 'range',
        isCorrect: false,
        outcome: 'loss',
        finalPayout: 0,
        payoutMultiplier: 0,
        xpGained: 5,
        specialAbilityTriggered: null,
        characterBonus: null
      };

      (DiceEngine.rollDice as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/dice/roll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 50, prediction: 'low' });

      expect(response.status).toBe(200);
      expect(response.body.result.isCorrect).toBe(false);
      expect(response.body.result.outcome).toBe('loss');
      expect(response.body.result.netChange).toBe(-50);
    });

    it('should handle specific number prediction', async () => {
      const mockResult = {
        dice: [3, 4],
        total: 7,
        prediction: '7',
        predictionType: 'exact',
        isCorrect: true,
        outcome: 'win',
        finalPayout: 600,
        payoutMultiplier: 6.0,
        xpGained: 50,
        specialAbilityTriggered: 'shadow_gambit',
        characterBonus: { luckBonus: 15 }
      };

      (DiceEngine.rollDice as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/dice/roll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100, prediction: '7' });

      expect(response.status).toBe(200);
      expect(response.body.result.predictionType).toBe('exact');
      expect(response.body.result.payoutMultiplier).toBe(6.0);
      expect(response.body.result.specialAbility).toBe('shadow_gambit');
    });

    it('should reject missing prediction', async () => {
      const response = await request(app)
        .post('/api/games/dice/roll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Prediction required');
    });

    it('should reject bet below minimum', async () => {
      const response = await request(app)
        .post('/api/games/dice/roll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 5, prediction: 'high' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum bet');
    });
  });

  describe('GET /api/games/dice/info - Dice Game Info', () => {
    it('should return dice game information', async () => {
      const mockInfo = {
        predictions: ['high', 'low', 'exact'],
        payouts: { high: 2.0, low: 2.0, exact: 6.0 },
        rules: 'Roll two dice...'
      };

      (DiceEngine.getDiceGameInfo as Mock).mockReturnValue(mockInfo);

      const response = await request(app)
        .get('/api/games/dice/info')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.info.predictions).toBeDefined();
      expect(response.body.info.payouts).toBeDefined();
    });
  });

  // =====================
  // BLACKJACK GAME TESTS
  // =====================
  describe('POST /api/games/blackjack/play - Blackjack Game', () => {
    it('should play blackjack and win', async () => {
      const mockResult = {
        playerHand: {
          cards: [{ rank: 'K', suit: 'hearts' }, { rank: 'A', suit: 'spades' }],
          value: 21,
          isBlackjack: true,
          isBusted: false,
          isSoft: true
        },
        dealerHand: {
          cards: [{ rank: '10', suit: 'diamonds' }, { rank: '7', suit: 'clubs' }],
          value: 17,
          isBusted: false
        },
        outcome: 'blackjack',
        gameType: 'single_player',
        finalPayout: 250,
        doubleDowned: false,
        xpGained: 50,
        specialAbilityTriggered: null,
        characterBonus: null
      };

      (BlackjackEngine.playSinglePlayerBlackjack as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/blackjack/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.playerHand.isBlackjack).toBe(true);
      expect(response.body.result.outcome).toBe('blackjack');
      expect(response.body.result.payout).toBe(250);
    });

    it('should handle dealer bust', async () => {
      const mockResult = {
        playerHand: {
          cards: [{ rank: '10', suit: 'hearts' }, { rank: '8', suit: 'spades' }],
          value: 18,
          isBlackjack: false,
          isBusted: false,
          isSoft: false
        },
        dealerHand: {
          cards: [{ rank: '10', suit: 'diamonds' }, { rank: '6', suit: 'clubs' }, { rank: '9', suit: 'hearts' }],
          value: 25,
          isBusted: true
        },
        outcome: 'win',
        gameType: 'single_player',
        finalPayout: 200,
        doubleDowned: false,
        xpGained: 25,
        specialAbilityTriggered: null,
        characterBonus: null
      };

      (BlackjackEngine.playSinglePlayerBlackjack as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/blackjack/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100 });

      expect(response.status).toBe(200);
      expect(response.body.result.dealerHand.isBusted).toBe(true);
      expect(response.body.result.outcome).toBe('win');
    });

    it('should handle player bust', async () => {
      const mockResult = {
        playerHand: {
          cards: [{ rank: '10', suit: 'hearts' }, { rank: '6', suit: 'spades' }, { rank: '8', suit: 'clubs' }],
          value: 24,
          isBlackjack: false,
          isBusted: true,
          isSoft: false
        },
        dealerHand: {
          cards: [{ rank: '10', suit: 'diamonds' }, { rank: '?', suit: '?' }],
          value: 10,
          isBusted: false
        },
        outcome: 'bust',
        gameType: 'single_player',
        finalPayout: 0,
        doubleDowned: false,
        xpGained: 5,
        specialAbilityTriggered: null,
        characterBonus: null
      };

      (BlackjackEngine.playSinglePlayerBlackjack as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/blackjack/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100, strategy: 'hit' });

      expect(response.status).toBe(200);
      expect(response.body.result.playerHand.isBusted).toBe(true);
      expect(response.body.result.outcome).toBe('bust');
      expect(response.body.result.payout).toBe(0);
    });

    it('should handle double down', async () => {
      const mockResult = {
        playerHand: {
          cards: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'spades' }, { rank: '10', suit: 'clubs' }],
          value: 21,
          isBlackjack: false,
          isBusted: false,
          isSoft: false
        },
        dealerHand: {
          cards: [{ rank: '10', suit: 'diamonds' }, { rank: '8', suit: 'hearts' }],
          value: 18,
          isBusted: false
        },
        outcome: 'win',
        gameType: 'single_player',
        finalPayout: 400,
        doubleDowned: true,
        xpGained: 50,
        specialAbilityTriggered: 'battle_rage',
        characterBonus: { luckBonus: 5 }
      };

      (BlackjackEngine.playSinglePlayerBlackjack as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/blackjack/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100, strategy: 'double' });

      expect(response.status).toBe(200);
      expect(response.body.result.doubleDowned).toBe(true);
      expect(response.body.result.payout).toBe(400);
      expect(response.body.result.specialAbility).toBe('battle_rage');
    });

    it('should handle push (tie)', async () => {
      const mockResult = {
        playerHand: {
          cards: [{ rank: '10', suit: 'hearts' }, { rank: '8', suit: 'spades' }],
          value: 18,
          isBlackjack: false,
          isBusted: false,
          isSoft: false
        },
        dealerHand: {
          cards: [{ rank: '10', suit: 'diamonds' }, { rank: '8', suit: 'clubs' }],
          value: 18,
          isBusted: false
        },
        outcome: 'push',
        gameType: 'single_player',
        finalPayout: 100,
        doubleDowned: false,
        xpGained: 10,
        specialAbilityTriggered: null,
        characterBonus: null
      };

      (BlackjackEngine.playSinglePlayerBlackjack as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/blackjack/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 100 });

      expect(response.status).toBe(200);
      expect(response.body.result.outcome).toBe('push');
      expect(response.body.result.netChange).toBe(0);
    });

    it('should reject bet below minimum', async () => {
      const response = await request(app)
        .post('/api/games/blackjack/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bet: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum bet');
    });
  });

  describe('GET /api/games/blackjack/info - Blackjack Game Info', () => {
    it('should return blackjack game information', async () => {
      const mockInfo = {
        strategies: ['hit', 'stand', 'double'],
        payouts: { blackjack: 2.5, win: 2.0, push: 1.0 },
        rules: 'Beat the dealer...'
      };

      (BlackjackEngine.getBlackjackGameInfo as Mock).mockReturnValue(mockInfo);

      const response = await request(app)
        .get('/api/games/blackjack/info')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.info.strategies).toBeDefined();
      expect(response.body.info.payouts).toBeDefined();
    });
  });

  // =====================
  // ROULETTE GAME TESTS
  // =====================
  describe('POST /api/games/roulette/play - Roulette Game', () => {
    it('should play roulette with single color bet', async () => {
      const mockResult = {
        winningNumber: 7,
        winningColor: 'red',
        bets: [{ type: 'red', amount: 100, description: 'Red', payout: 200 }],
        winningBets: [{ type: 'red', amount: 100, description: 'Red', payout: 200 }],
        outcome: 'win',
        totalBetAmount: 100,
        finalPayout: 200,
        xpGained: 20,
        specialAbilityTriggered: null,
        socialBonus: null,
        communityPayout: 0,
        characterBonus: null
      };

      (RouletteEngine.playSinglePlayerRoulette as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/roulette/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bets: [{ type: 'red', amount: 100 }] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.winningNumber).toBe(7);
      expect(response.body.result.winningColor).toBe('red');
      expect(response.body.result.payout).toBe(200);
      expect(response.body.result.winningBetsCount).toBe(1);
    });

    it('should play roulette with multiple bets', async () => {
      const mockResult = {
        winningNumber: 17,
        winningColor: 'black',
        bets: [
          { type: 'black', amount: 50, description: 'Black', payout: 100 },
          { type: 'straight', amount: 10, value: 17, description: 'Straight 17', payout: 360 }
        ],
        winningBets: [
          { type: 'black', amount: 50, description: 'Black', payout: 100 },
          { type: 'straight', amount: 10, value: 17, description: 'Straight 17', payout: 360 }
        ],
        outcome: 'win',
        totalBetAmount: 60,
        finalPayout: 460,
        xpGained: 50,
        specialAbilityTriggered: 'fortune_sight',
        socialBonus: 50,
        communityPayout: 25,
        characterBonus: { luckBonus: 10 }
      };

      (RouletteEngine.playSinglePlayerRoulette as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/roulette/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          bets: [
            { type: 'black', amount: 50 },
            { type: 'straight', amount: 10, value: 17 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.result.winningBetsCount).toBe(2);
      expect(response.body.result.payout).toBe(460);
      expect(response.body.result.netChange).toBe(400);
      expect(response.body.result.specialAbility).toBe('fortune_sight');
      expect(response.body.result.socialBonus).toBe(50);
    });

    it('should handle roulette loss', async () => {
      const mockResult = {
        winningNumber: 0,
        winningColor: 'green',
        bets: [{ type: 'red', amount: 100, description: 'Red', payout: 0 }],
        winningBets: [],
        outcome: 'loss',
        totalBetAmount: 100,
        finalPayout: 0,
        xpGained: 5,
        specialAbilityTriggered: null,
        socialBonus: null,
        communityPayout: 0,
        characterBonus: null
      };

      (RouletteEngine.playSinglePlayerRoulette as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/games/roulette/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bets: [{ type: 'red', amount: 100 }] });

      expect(response.status).toBe(200);
      expect(response.body.result.outcome).toBe('loss');
      expect(response.body.result.winningNumber).toBe(0);
      expect(response.body.result.winningBetsCount).toBe(0);
      expect(response.body.result.netChange).toBe(-100);
    });

    it('should reject empty bets', async () => {
      const response = await request(app)
        .post('/api/games/roulette/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bets: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('At least one bet required');
    });

    it('should reject total bet below minimum', async () => {
      const response = await request(app)
        .post('/api/games/roulette/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bets: [{ type: 'red', amount: 5 }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum total bet');
    });
  });

  describe('GET /api/games/roulette/info - Roulette Game Info', () => {
    it('should return roulette game information', async () => {
      const mockInfo = {
        betTypes: ['straight', 'split', 'red', 'black', 'odd', 'even'],
        payouts: { straight: 36, red: 2, black: 2 },
        rules: 'Place your bets...'
      };

      (RouletteEngine.getRouletteGameInfo as Mock).mockReturnValue(mockInfo);

      const response = await request(app)
        .get('/api/games/roulette/info')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.info.betTypes).toBeDefined();
      expect(response.body.info.payouts).toBeDefined();
    });
  });

  // =====================
  // AUTHENTICATION TESTS
  // =====================
  describe('Authentication across all game endpoints', () => {
    const gameEndpoints = [
      { method: 'post', path: '/api/games/slots/spin', body: { bet: 100 } },
      { method: 'post', path: '/api/games/dice/roll', body: { bet: 100, prediction: 'high' } },
      { method: 'get', path: '/api/games/dice/info' },
      { method: 'post', path: '/api/games/blackjack/play', body: { bet: 100 } },
      { method: 'get', path: '/api/games/blackjack/info' },
      { method: 'post', path: '/api/games/roulette/play', body: { bets: [{ type: 'red', amount: 100 }] } },
      { method: 'get', path: '/api/games/roulette/info' }
    ];

    it.each(gameEndpoints)('should require authentication for $method $path', async (endpoint) => {
      const req = endpoint.method === 'get' 
        ? request(app).get(endpoint.path)
        : request(app).post(endpoint.path).send(endpoint.body);

      const response = await req;
      expect(response.status).toBe(401);
    });

    it.each(gameEndpoints)('should reject invalid token for $method $path', async (endpoint) => {
      const req = endpoint.method === 'get'
        ? request(app).get(endpoint.path).set('Authorization', 'Bearer invalid-token')
        : request(app).post(endpoint.path).set('Authorization', 'Bearer invalid-token').send(endpoint.body);

      const response = await req;
      expect(response.status).toBe(401);
    });
  });
});

