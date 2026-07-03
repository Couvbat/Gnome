import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { User, Character, CasinoProfile } from '../src/models/database';
import characterRoutes from '../src/routes/characters';
import { authMiddleware } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { CharacterService } from '../src/services/CharacterService';
import { EconomyService } from '../src/services/EconomyService';

// Helper to stub a `Character.find(...).sort().skip().limit()` chain
function findChain(result: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

// Mock the database models
vi.mock('../src/models/database');
// Mock the CharacterService
vi.mock('../src/services/CharacterService');
vi.mock('../src/services/EconomyService');

// Create test app without full server setup
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/characters', authMiddleware, characterRoutes);
app.use(errorHandler);

describe('Character Creation API', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    testUserId = 'test-user-' + Date.now();
    
    // Generate JWT token for authentication using the same secret as the middleware
    const jwtSecret = process.env.JWT_SECRET || 'gnome-casino-secret'; // Match auth middleware default
    authToken = jwt.sign(
      { 
        userId: testUserId,
        guildId: 'test-guild-456',
        username: 'TestUser',
        discordId: testUserId
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
  });

  beforeEach(() => {
    // Setup common mocks
    (User.findOne as Mock).mockResolvedValue({
      userId: testUserId,
      guildId: 'test-guild-456',
      username: 'TestUser',
      coins: 1000,
      xp: 0,
      level: 1
    });
  });

  describe('GET /api/characters/classes', () => {
    it('should return all character classes', async () => {
      const response = await request(app)
        .get('/api/characters/classes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.classes).toBeDefined();
      expect(response.body.classes.length).toBe(6); // warrior, mage, rogue, merchant, bard, paladin
    });
  });

  describe('GET /api/characters/classes/:className', () => {
    it('should return specific class details', async () => {
      const response = await request(app)
        .get('/api/characters/classes/warrior')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.class.name).toBe('Warrior');
      expect(response.body.class.baseStats).toBeDefined();
      expect(response.body.class.casinoBonus).toBeDefined();
    });

    it('should return 404 for invalid class', async () => {
      const response = await request(app)
        .get('/api/characters/classes/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/characters/create', () => {
    it('should create a new character successfully', async () => {
      // Mock no existing character
      (Character.findOne as Mock).mockResolvedValue(null);
      (CasinoProfile.findOne as Mock).mockResolvedValue(null);
      
      // Mock createCharacter service method
      const mockResult = {
        success: true,
        character: {
          _id: 'char-123',
          userId: testUserId,
          guildId: 'test-guild-456',
          name: 'TestHero',
          class: 'warrior',  // Use 'class' to match ICharacter interface
          level: 1,
          xp: 0,
          stats: {
            strength: 20,
            intelligence: 8,
            luck: 10,
            charisma: 12,
            vitality: 18,
            dexterity: 10
          },
          casinoBonus: {
            luckBonus: 5,
            energyBonus: 20
          }
        },
        classInfo: {
          name: 'Warrior',
          description: 'A brave fighter',
          casinoBonus: {
            luckBonus: 5,
            energyBonus: 20,
            specialAbility: 'battle_rage',
            description: 'Higher chance of winning after a loss'
          },
          baseStats: {}
        }
      };
      (CharacterService.createCharacter as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/characters/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'TestHero',
          className: 'warrior'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.character.name).toBe('TestHero');
      expect(response.body.character.className).toBe('warrior');
    });

    it('should reject invalid character data', async () => {
      const response = await request(app)
        .post('/api/characters/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Invalid empty name
          className: 'warrior'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/characters/me', () => {
    it('should return current user character', async () => {
      // Mock getCharacterInfo static method
      const mockCharacterInfo = {
        character: {
          _id: 'char-123',
          name: 'TestHero',
          className: 'warrior',
          level: 5,
          xp: 500,
          experience: 500,
          stats: {
            strength: 10,
            intelligence: 5,
            luck: 5,
            charisma: 5,
            vitality: 10,
            dexterity: 7
          },
          casinoBonus: {
            luckBonus: 5,
            energyBonus: 10
          },
          createdAt: new Date()
        },
        classInfo: {
          name: 'Warrior',
          description: 'A mighty warrior',
          baseStats: {}
        },
        totalStats: {
          strength: 15,
          intelligence: 7,
          luck: 8,
          charisma: 6,
          vitality: 15,
          dexterity: 10
        },
        levelProgress: {
          currentLevel: 5,
          currentXP: 500,
          xpForNextLevel: 1000,
          progress: 50
        }
      };
      
      (CharacterService.getCharacterInfo as Mock).mockResolvedValue(mockCharacterInfo);

      const response = await request(app)
        .get('/api/characters/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.hasCharacter).toBe(true);
      expect(response.body.character).toBeDefined();
      expect(response.body.classInfo).toBeDefined();
      expect(response.body.totalStats).toBeDefined();
      expect(response.body.levelProgress).toBeDefined();
    });
  });

  // PUT /api/characters/level-up was removed - it let any authenticated user grant
  // themselves arbitrary XP via a raw client-supplied `xp` body param. See routes/characters.ts.
  describe('PUT /api/characters/level-up - removed endpoint', () => {
    it('should no longer be reachable', async () => {
      const response = await request(app)
        .put('/api/characters/level-up')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ xp: 120 });

      expect(response.status).toBe(404);
      expect(CharacterService.levelUpCharacter).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/characters/me', () => {
    it('deletes the current character', async () => {
      (CharacterService.deleteCharacter as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/characters/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(CharacterService.deleteCharacter).toHaveBeenCalledWith(testUserId, 'test-guild-456');
      expect(response.body).toEqual({ success: true, message: 'Character deleted successfully' });
    });

    it('propagates an error if deletion fails', async () => {
      (CharacterService.deleteCharacter as Mock).mockRejectedValue(new Error('DB unavailable'));

      const response = await request(app)
        .delete('/api/characters/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/characters/:characterId/stats', () => {
    it('returns detailed stats for an existing character', async () => {
      (Character.findOne as Mock).mockResolvedValue({
        _id: 'char-123',
        name: 'TestHero',
        class: 'warrior',
        level: 5,
        xp: 500,
        stats: { strength: 20, intelligence: 8, luck: 10, charisma: 12, vitality: 18, dexterity: 10 },
        casinoBonus: { luckBonus: 5 },
      });
      (CharacterService.calculateTotalStats as Mock).mockReturnValue({ total: 78 });
      (CharacterService.calculateLevelProgress as Mock).mockReturnValue({
        currentLevel: 5,
        currentXP: 500,
        xpForNextLevel: 1000,
        progress: 50,
      });

      const response = await request(app)
        .get('/api/characters/char-123/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Character.findOne).toHaveBeenCalledWith({ _id: 'char-123', guildId: 'test-guild-456' });
      expect(response.body.character).toMatchObject({ id: 'char-123', name: 'TestHero', className: 'warrior' });
      expect(response.body.stats.total).toEqual({ total: 78 });
      expect(response.body.classInfo.name).toBe('Warrior');
      expect(response.body.levelProgress.progress).toBe(50);
    });

    it('returns 404 when the character does not exist', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/characters/does-not-exist/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/characters/leaderboard', () => {
    it('returns a ranked, paginated leaderboard', async () => {
      const characters = [
        { _id: 'c1', name: 'Hero1', class: 'warrior', level: 10, xp: 5000 },
        { _id: 'c2', name: 'Hero2', class: 'mage', level: 9, xp: 4500 },
      ];
      (Character.find as Mock).mockReturnValue(findChain(characters));
      (Character.countDocuments as Mock).mockResolvedValue(2);
      (CharacterService.calculateTotalStats as Mock).mockReturnValue({ total: 50 });

      const response = await request(app)
        .get('/api/characters/leaderboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.leaderboard).toHaveLength(2);
      expect(response.body.leaderboard[0]).toMatchObject({ rank: 1, name: 'Hero1', class: 'Warrior' });
      expect(response.body.leaderboard[1]).toMatchObject({ rank: 2, name: 'Hero2', class: 'Mage' });
      expect(response.body.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
    });

    it('applies the page and limit query parameters', async () => {
      (Character.find as Mock).mockReturnValue(findChain([]));
      (Character.countDocuments as Mock).mockResolvedValue(25);

      const response = await request(app)
        .get('/api/characters/leaderboard?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toEqual({ page: 2, limit: 5, total: 25, totalPages: 5 });
    });
  });

  describe('GET /api/characters/search', () => {
    it('searches by name (case-insensitive)', async () => {
      (Character.find as Mock).mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          { _id: 'c1', name: 'Aragorn', class: 'warrior', level: 8, createdAt: new Date() },
        ]),
      });

      const response = await request(app)
        .get('/api/characters/search?name=arag')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.results[0]).toMatchObject({ name: 'Aragorn', class: 'Warrior' });
    });

    it('rejects a search with no name or className filter', async () => {
      const response = await request(app)
        .get('/api/characters/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });
});

