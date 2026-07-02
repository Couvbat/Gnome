import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
import { QuestService } from '../src/services/QuestService';
import { Quest, UserQuest } from '../src/models/schemas';
import { Character, User } from '../src/models/database';
import { EconomyService } from '../src/services/EconomyService';

// Mock dependencies
vi.mock('../src/models/schemas', () => ({
  Quest: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn()
  },
  UserQuest: {
    find: vi.fn(),
    findOne: vi.fn()
  }
}));

vi.mock('../src/models/database');
vi.mock('../src/services/EconomyService');

describe('QuestService', () => {
  const mockUserId = 'user123';
  const mockGuildId = 'guild456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableQuests', () => {
    it('should return empty array if character not found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      const quests = await QuestService.getAvailableQuests(mockUserId, mockGuildId);

      expect(quests).toEqual([]);
    });

    it('should return available quests for character', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 5,
        class: 'warrior'
      };

      const mockQuests = [
        {
          questId: 'quest1',
          guildId: mockGuildId,
          title: 'Daily Quest 1',
          description: 'Complete this daily quest',
          type: 'daily',
          category: 'casino',
          isActive: true,
          objectives: [{ type: 'win_games', target: 'slots', required: 5, description: 'Win 5 slots games' }],
          rewards: { coins: 100, xp: 50 },
          requirements: {}
        }
      ];

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);
      (Quest.find as Mock).mockResolvedValue(mockQuests);
      (UserQuest.find as Mock).mockResolvedValue([]);

      const quests = await QuestService.getAvailableQuests(mockUserId, mockGuildId);

      expect(quests).toBeDefined();
      expect(quests.length).toBe(1);
      expect(quests[0].questId).toBe('quest1');
    });

    it('should filter out completed quests', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 5,
        class: 'warrior'
      };

      const mockQuests = [
        {
          questId: 'quest1',
          guildId: mockGuildId,
          title: 'Daily Quest 1',
          type: 'daily',
          category: 'casino',
          isActive: true,
          objectives: [],
          rewards: { coins: 100, xp: 50 },
          maxCompletions: 1
        }
      ];

      const mockUserQuests = [
        {
          questId: 'quest1',
          status: 'completed'
        }
      ];

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);
      (Quest.find as Mock).mockResolvedValue(mockQuests);
      (UserQuest.find as Mock).mockResolvedValue(mockUserQuests);

      const quests = await QuestService.getAvailableQuests(mockUserId, mockGuildId);

      expect(quests.length).toBe(0);
    });

    it('should filter quests by level requirement', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 3, // Low level
        class: 'warrior'
      };

      const mockQuests = [
        {
          questId: 'quest_high_level',
          guildId: mockGuildId,
          title: 'High Level Quest',
          type: 'story',
          category: 'casino',
          isActive: true,
          objectives: [],
          rewards: { coins: 500, xp: 200 },
          requirements: { level: 10 } // Requires level 10
        }
      ];

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);
      (Quest.find as Mock).mockResolvedValue(mockQuests);
      (UserQuest.find as Mock).mockResolvedValue([]);

      const quests = await QuestService.getAvailableQuests(mockUserId, mockGuildId);

      expect(quests.length).toBe(0);
    });
  });

  describe('startQuest', () => {
    it('should throw error if character not found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      await expect(
        QuestService.startQuest(mockUserId, mockGuildId, 'quest1')
      ).rejects.toThrow('Character not found');
    });

    it('should throw error if quest not found', async () => {
      (Character.findOne as Mock).mockResolvedValue({
        userId: mockUserId,
        guildId: mockGuildId
      });
      (Quest.findOne as Mock).mockResolvedValue(null);

      await expect(
        QuestService.startQuest(mockUserId, mockGuildId, 'nonexistent_quest')
      ).rejects.toThrow('Quest not found');
    });

    it('should throw error if quest already active', async () => {
      const mockCharacter = { userId: mockUserId, guildId: mockGuildId, _id: 'char123' };
      const mockQuest = {
        questId: 'quest1',
        guildId: mockGuildId,
        title: 'Test Quest',
        objectives: []
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);
      (Quest.findOne as Mock).mockResolvedValue(mockQuest);
      (UserQuest.findOne as Mock).mockResolvedValue({
        questId: 'quest1',
        status: 'active'
      });

      await expect(
        QuestService.startQuest(mockUserId, mockGuildId, 'quest1')
      ).rejects.toThrow('Quest already active');
    });
  });

  describe('getActiveQuests', () => {
    it('should return empty array if no active quests', async () => {
      (UserQuest.find as Mock).mockResolvedValue([]);

      const quests = await QuestService.getActiveQuests(mockUserId, mockGuildId);

      expect(quests).toEqual([]);
    });

    it('should return active quests with progress', async () => {
      const mockUserQuests = [
        {
          userId: mockUserId,
          guildId: mockGuildId,
          questId: 'quest1',
          status: 'active',
          progress: [{ objectiveId: 0, current: 2, completed: false }],
          startedAt: new Date()
        }
      ];

      const mockQuest = {
        questId: 'quest1',
        guildId: mockGuildId,
        title: 'Test Quest',
        description: 'A test quest',
        type: 'daily',
        category: 'casino',
        objectives: [{ type: 'win_games', target: 'slots', required: 5, description: 'Win 5 games' }],
        rewards: { coins: 100, xp: 50 }
      };

      (UserQuest.find as Mock).mockResolvedValue(mockUserQuests);
      (Quest.findOne as Mock).mockResolvedValue(mockQuest);

      const quests = await QuestService.getActiveQuests(mockUserId, mockGuildId);

      expect(quests.length).toBe(1);
      expect(quests[0].questId).toBe('quest1');
      expect(quests[0].progress[0].current).toBe(2);
    });
  });

  describe('updateQuestProgress', () => {
    it('should update quest progress for matching action', async () => {
      const mockUserQuest = {
        userId: mockUserId,
        guildId: mockGuildId,
        questId: 'quest1',
        status: 'active',
        progress: [{ objectiveId: 0, current: 2, completed: false }],
        lastUpdate: new Date(),
        save: vi.fn().mockResolvedValue(true)
      };

      const mockQuest = {
        questId: 'quest1',
        guildId: mockGuildId,
        objectives: [{ type: 'win_games', target: 'slots', required: 5, description: 'Win 5 games' }],
        rewards: { coins: 100, xp: 50 }
      };

      (UserQuest.find as Mock).mockResolvedValue([mockUserQuest]);
      (Quest.findOne as Mock).mockResolvedValue(mockQuest);

      const result = await QuestService.updateQuestProgress(
        mockUserId,
        mockGuildId,
        { type: 'win_games', target: 'slots', amount: 1 }
      );

      expect(result.questsUpdated).toContain('quest1');
    });

    it('should mark quest as completed when all objectives done', async () => {
      const mockUserQuest = {
        userId: mockUserId,
        guildId: mockGuildId,
        questId: 'quest1',
        status: 'active',
        progress: [{ objectiveId: 0, current: 4, completed: false }],
        lastUpdate: new Date(),
        completionCount: 0,
        save: vi.fn().mockResolvedValue(true)
      };

      const mockQuest = {
        questId: 'quest1',
        guildId: mockGuildId,
        objectives: [{ type: 'win_games', target: 'slots', required: 5, description: 'Win 5 games' }],
        rewards: { coins: 100, xp: 50 }
      };

      (UserQuest.find as Mock).mockResolvedValue([mockUserQuest]);
      (Quest.findOne as Mock).mockResolvedValue(mockQuest);
      (User.findOne as Mock).mockResolvedValue({
        userId: mockUserId,
        guildId: mockGuildId,
        coins: 1000,
        xp: 500,
        save: vi.fn().mockResolvedValue(true)
      });
      (Character.findOne as Mock).mockResolvedValue({
        userId: mockUserId,
        guildId: mockGuildId,
        xp: 500,
        level: 5,
        save: vi.fn().mockResolvedValue(true)
      });

      const result = await QuestService.updateQuestProgress(
        mockUserId,
        mockGuildId,
        { type: 'win_games', target: 'slots', amount: 1 }
      );

      expect(result.questsCompleted).toContain('quest1');
    });

    it('should not update non-matching actions', async () => {
      const mockUserQuest = {
        userId: mockUserId,
        guildId: mockGuildId,
        questId: 'quest1',
        status: 'active',
        progress: [{ objectiveId: 0, current: 2, completed: false }],
        lastUpdate: new Date(),
        save: vi.fn().mockResolvedValue(true)
      };

      const mockQuest = {
        questId: 'quest1',
        guildId: mockGuildId,
        objectives: [{ type: 'win_games', target: 'blackjack', required: 5, description: 'Win 5 blackjack games' }],
        rewards: { coins: 100, xp: 50 }
      };

      (UserQuest.find as Mock).mockResolvedValue([mockUserQuest]);
      (Quest.findOne as Mock).mockResolvedValue(mockQuest);

      const result = await QuestService.updateQuestProgress(
        mockUserId,
        mockGuildId,
        { type: 'win_games', target: 'slots', amount: 1 } // Different target
      );

      expect(result.questsUpdated).not.toContain('quest1');
    });
  });

  describe('abandonQuest', () => {
    it('should throw error if quest not found', async () => {
      (UserQuest.findOne as Mock).mockResolvedValue(null);

      await expect(
        QuestService.abandonQuest(mockUserId, mockGuildId, 'quest1')
      ).rejects.toThrow('Quest not found or not active');
    });

    it('should mark quest as abandoned', async () => {
      const mockUserQuest = {
        questId: 'quest1',
        status: 'active',
        lastUpdate: new Date(),
        save: vi.fn().mockResolvedValue(true)
      };

      (UserQuest.findOne as Mock).mockResolvedValue(mockUserQuest);

      await QuestService.abandonQuest(mockUserId, mockGuildId, 'quest1');

      expect(mockUserQuest.status).toBe('abandoned');
      expect(mockUserQuest.save).toHaveBeenCalled();
    });
  });

  describe('getQuestHistory', () => {
    it('should return completed quests', async () => {
      const mockCompletedQuests = [
        {
          questId: 'quest1',
          status: 'completed',
          completedAt: new Date()
        }
      ];

      const mockQuest = {
        questId: 'quest1',
        guildId: mockGuildId,
        title: 'Completed Quest',
        type: 'daily',
        rewards: { coins: 100, xp: 50 }
      };

      (UserQuest.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockCompletedQuests)
        })
      });
      (Quest.findOne as Mock).mockResolvedValue(mockQuest);

      const history = await QuestService.getQuestHistory(mockUserId, mockGuildId);

      expect(history.length).toBe(1);
      expect(history[0].questId).toBe('quest1');
      expect(history[0].title).toBe('Completed Quest');
    });

    it('should limit results', async () => {
      (UserQuest.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([])
        })
      });

      await QuestService.getQuestHistory(mockUserId, mockGuildId, 5);

      expect(UserQuest.find).toHaveBeenCalled();
    });
  });

  describe('createDailyQuests', () => {
    it('should create daily quests for guild', async () => {
      (Quest.findOneAndUpdate as Mock).mockResolvedValue({});

      await QuestService.createDailyQuests(mockGuildId);

      // Should create at least 3 daily quests
      expect(Quest.findOneAndUpdate).toHaveBeenCalledTimes(3);
    });

    it('should upsert quests to avoid duplicates', async () => {
      (Quest.findOneAndUpdate as Mock).mockResolvedValue({});

      await QuestService.createDailyQuests(mockGuildId);

      expect(Quest.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: mockGuildId }),
        expect.anything(),
        expect.objectContaining({ upsert: true })
      );
    });
  });

  describe('createStoryQuests', () => {
    it('should create story quests for guild', async () => {
      (Quest.findOneAndUpdate as Mock).mockResolvedValue({});

      await QuestService.createStoryQuests(mockGuildId);

      // Should create at least 3 story quests
      expect(Quest.findOneAndUpdate).toHaveBeenCalledTimes(3);
    });
  });
});

