import { Quest, UserQuest } from '../models/schemas';
import { Character, type IQuestObjective, type IQuestProgressItem } from '../models/database';
import { Types } from 'mongoose';
import { AppError } from '../middleware/errorHandler';
import { CharacterService } from './CharacterService';
import { EconomyService } from './EconomyService';

export interface QuestProgress {
  objectiveIndex: number;
  current: number;
  required: number;
  completed: boolean;
  description: string;
}

export interface ActiveQuest {
  questId: string;
  title: string;
  description: string;
  type: string;
  category: string;
  status: string;
  progress: QuestProgress[];
  rewards: {
    coins: number;
    xp: number;
    items?: string[];
    reputation?: number;
  };
  startedAt?: Date;
}

export class QuestService {
  /**
   * Get all available quests for a player
   */
  static async getAvailableQuests(
    userId: string,
    guildId: string
  ): Promise<any[]> {
    const character = await Character.findOne({ userId, guildId });
    if (!character) {
      return [];
    }

    // Get all active quests for this guild
    const allQuests = await Quest.find({ 
      guildId, 
      isActive: true,
      $or: [
        { startDate: { $lte: new Date() }, endDate: { $gte: new Date() } },
        { startDate: null, endDate: null }
      ]
    });

    // Get user's quest statuses
    const userQuests = await UserQuest.find({ userId, guildId });
    const questStatusMap = new Map(userQuests.map(uq => [uq.questId, uq]));

    // Filter quests based on requirements
    const availableQuests = allQuests.filter(quest => {
      const userQuest = questStatusMap.get(quest.questId);
      
      // Already completed and not repeatable
      if (userQuest?.status === 'completed' && quest.maxCompletions === 1) {
        return false;
      }

      // Check level requirement
      if (quest.requirements?.level && character.level < quest.requirements.level) {
        return false;
      }

      // Check class requirement
      if (quest.requirements?.class && quest.requirements.class.length > 0) {
        if (!quest.requirements.class.includes(character.class || '')) {
          return false;
        }
      }

      // Check previous quest requirement
      if (quest.requirements?.previousQuests) {
        for (const prevQuestId of quest.requirements.previousQuests) {
          const prevQuest = questStatusMap.get(prevQuestId);
          if (!prevQuest || prevQuest.status !== 'completed') {
            return false;
          }
        }
      }

      return true;
    });

    return availableQuests.map(quest => ({
      questId: quest.questId,
      title: quest.title,
      description: quest.description,
      type: quest.type,
      category: quest.category,
      requirements: quest.requirements,
      objectives: quest.objectives.map((obj: IQuestObjective) => ({
        type: obj.type,
        target: obj.target,
        required: obj.required,
        description: obj.description
      })),
      rewards: quest.rewards,
      status: questStatusMap.get(quest.questId)?.status || 'available'
    }));
  }

  /**
   * Start a quest for a player
   */
  static async startQuest(
    userId: string,
    guildId: string,
    questId: string
  ): Promise<ActiveQuest> {
    const character = await Character.findOne({ userId, guildId });
    if (!character) {
      throw new AppError('Character not found', 404);
    }

    const quest = await Quest.findOne({ questId, guildId, isActive: true });
    if (!quest) {
      throw new AppError('Quest not found', 404);
    }

    // Check if already active
    const existingQuest = await UserQuest.findOne({
      userId,
      guildId,
      questId,
      status: 'active'
    });
    if (existingQuest) {
      throw new AppError('Quest already active', 400);
    }

    // Create user quest
    const userQuest = new UserQuest({
      userId,
      guildId,
      questId,
      characterId: character._id,
      status: 'active',
      progress: quest.objectives.map((_obj: IQuestObjective, index: number) => ({
        objectiveId: index,
        current: 0,
        completed: false
      })),
      startedAt: new Date(),
      lastUpdate: new Date(),
      completionCount: 0
    });

    await userQuest.save();

    return {
      questId: quest.questId,
      title: quest.title,
      description: quest.description,
      type: quest.type,
      category: quest.category,
      status: 'active',
      progress: quest.objectives.map((obj: IQuestObjective, index: number) => ({
        objectiveIndex: index,
        current: 0,
        required: obj.required,
        completed: false,
        description: obj.description
      })),
      rewards: quest.rewards as {
        coins: number;
        xp: number;
        items?: string[];
        reputation?: number;
      },
      startedAt: userQuest.startedAt
    };
  }

  /**
   * Get a player's active quests
   */
  static async getActiveQuests(
    userId: string,
    guildId: string
  ): Promise<ActiveQuest[]> {
    const userQuests = await UserQuest.find({ 
      userId, 
      guildId, 
      status: 'active' 
    });

    const activeQuests: ActiveQuest[] = [];

    for (const userQuest of userQuests) {
      const quest = await Quest.findOne({ questId: userQuest.questId, guildId });
      if (!quest) continue;

      activeQuests.push({
        questId: quest.questId,
        title: quest.title,
        description: quest.description,
        type: quest.type,
        category: quest.category,
        status: userQuest.status,
        progress: quest.objectives.map((obj: IQuestObjective, index: number) => {
          const progress = userQuest.progress.find((p: IQuestProgressItem) => p.objectiveId === index);
          return {
            objectiveIndex: index,
            current: progress?.current || 0,
            required: obj.required,
            completed: progress?.completed || false,
            description: obj.description
          };
        }),
        rewards: quest.rewards as {
          coins: number;
          xp: number;
          items?: string[];
          reputation?: number;
        },
        startedAt: userQuest.startedAt
      });
    }

    return activeQuests;
  }

  /**
   * Update quest progress based on game actions
   */
  static async updateQuestProgress(
    userId: string,
    guildId: string,
    action: {
      type: 'win_games' | 'wager_amount' | 'visit_location' | 'social_action' | 'item_collect';
      target?: string | number;
      amount: number;
    }
  ): Promise<{ questsUpdated: string[]; questsCompleted: string[] }> {
    const userQuests = await UserQuest.find({ 
      userId, 
      guildId, 
      status: 'active' 
    });

    const questsUpdated: string[] = [];
    const questsCompleted: string[] = [];

    for (const userQuest of userQuests) {
      const quest = await Quest.findOne({ questId: userQuest.questId, guildId });
      if (!quest) continue;

      let questUpdated = false;

      for (let i = 0; i < quest.objectives.length; i++) {
        const objective = quest.objectives[i];
        const progress = userQuest.progress.find((p: IQuestProgressItem) => p.objectiveId === i);
        
        if (!progress || progress.completed) continue;

        // Check if action matches objective
        if (objective.type === action.type) {
          // For targets, check if they match
          if (objective.target && action.target && objective.target !== action.target) {
            continue;
          }

          // Update progress
          progress.current = Math.min(
            progress.current + action.amount,
            objective.required
          );

          if (progress.current >= objective.required) {
            progress.completed = true;
          }

          questUpdated = true;
        }
      }

      if (questUpdated) {
        userQuest.lastUpdate = new Date();
        
        // Check if all objectives completed
        const allCompleted = userQuest.progress.every((p: IQuestProgressItem) => p.completed);
        if (allCompleted) {
          userQuest.status = 'completed';
          userQuest.completedAt = new Date();
          userQuest.completionCount = (userQuest.completionCount || 0) + 1;
          questsCompleted.push(quest.questId);

          // Award rewards
          await this.awardQuestRewards(userId, guildId, quest);
        }

        await userQuest.save();
        questsUpdated.push(quest.questId);
      }
    }

    return { questsUpdated, questsCompleted };
  }

  /**
   * Award quest completion rewards
   */
  private static async awardQuestRewards(
    userId: string,
    guildId: string,
    quest: any
  ): Promise<void> {
    const { Character } = await import('../models/database');

    const character = await Character.findOne({ userId, guildId });

    if (quest.rewards?.coins) {
      await EconomyService.addCoins(userId, guildId, quest.rewards.coins);
    }

    // Character is the single owner of level/xp progression
    if (character && quest.rewards?.xp) {
      await CharacterService.levelUpCharacter(userId, guildId, quest.rewards.xp);
    }

    // TODO: Add item rewards to inventory
    // TODO: Add reputation rewards
    // TODO: Add title rewards
  }

  /**
   * Abandon a quest
   */
  static async abandonQuest(
    userId: string,
    guildId: string,
    questId: string
  ): Promise<void> {
    const userQuest = await UserQuest.findOne({
      userId,
      guildId,
      questId,
      status: 'active'
    });

    if (!userQuest) {
      throw new AppError('Quest not found or not active', 404);
    }

    userQuest.status = 'abandoned';
    userQuest.lastUpdate = new Date();
    await userQuest.save();
  }

  /**
   * Get quest completion history
   */
  static async getQuestHistory(
    userId: string,
    guildId: string,
    limit: number = 10
  ): Promise<any[]> {
    const completedQuests = await UserQuest.find({
      userId,
      guildId,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .limit(limit);

    const history: any[] = [];

    for (const userQuest of completedQuests) {
      const quest = await Quest.findOne({ questId: userQuest.questId, guildId });
      if (quest) {
        history.push({
          questId: quest.questId,
          title: quest.title,
          type: quest.type,
          completedAt: userQuest.completedAt,
          rewards: quest.rewards
        });
      }
    }

    return history;
  }

  /**
   * Create default daily quests for a guild
   */
  static async createDailyQuests(guildId: string): Promise<void> {
    const dailyQuests = [
      {
        questId: `daily_slots_${guildId}`,
        guildId,
        title: 'Maître des Machines',
        description: 'Jouez 5 parties aux machines à sous',
        type: 'daily',
        category: 'casino',
        objectives: [{
          type: 'win_games',
          target: 'slots',
          current: 0,
          required: 5,
          description: 'Jouer 5 parties aux machines à sous'
        }],
        rewards: {
          coins: 100,
          xp: 50,
          reputation: 5
        },
        isActive: true
      },
      {
        questId: `daily_blackjack_${guildId}`,
        guildId,
        title: 'As du 21',
        description: 'Gagnez 3 parties de blackjack',
        type: 'daily',
        category: 'casino',
        objectives: [{
          type: 'win_games',
          target: 'blackjack',
          current: 0,
          required: 3,
          description: 'Gagner 3 parties de blackjack'
        }],
        rewards: {
          coins: 150,
          xp: 75,
          reputation: 10
        },
        isActive: true
      },
      {
        questId: `daily_wager_${guildId}`,
        guildId,
        title: 'Gros Parieur',
        description: 'Misez un total de 500 pièces',
        type: 'daily',
        category: 'casino',
        objectives: [{
          type: 'wager_amount',
          target: null,
          current: 0,
          required: 500,
          description: 'Miser 500 pièces au total'
        }],
        rewards: {
          coins: 75,
          xp: 40,
          reputation: 3
        },
        isActive: true
      }
    ];

    for (const questData of dailyQuests) {
      await Quest.findOneAndUpdate(
        { questId: questData.questId, guildId },
        questData,
        { upsert: true, new: true }
      );
    }

    console.log(`Created/updated daily quests for guild ${guildId}`);
  }

  /**
   * Create story quests for a guild (one-time story progression)
   */
  static async createStoryQuests(guildId: string): Promise<void> {
    const storyQuests = [
      {
        questId: `story_intro_${guildId}`,
        guildId,
        title: 'Bienvenue à La Taverne',
        description: 'Commencez votre aventure à La Taverne Dorée du Gnome en créant votre personnage et en jouant votre première partie.',
        type: 'story',
        category: 'exploration',
        chainId: 'main_story',
        nextQuest: `story_first_win_${guildId}`,
        objectives: [{
          type: 'win_games',
          target: null,
          current: 0,
          required: 1,
          description: 'Jouez votre première partie au casino'
        }],
        rewards: {
          coins: 200,
          xp: 100,
          reputation: 10
        },
        isActive: true,
        maxCompletions: 1
      },
      {
        questId: `story_first_win_${guildId}`,
        guildId,
        title: 'Premier Triomphe',
        description: 'La chance des débutants vous sourit ! Remportez votre première victoire.',
        type: 'story',
        category: 'casino',
        chainId: 'main_story',
        previousQuest: `story_intro_${guildId}`,
        nextQuest: `story_high_roller_${guildId}`,
        requirements: {
          previousQuests: [`story_intro_${guildId}`]
        },
        objectives: [{
          type: 'win_games',
          target: null,
          current: 0,
          required: 5,
          description: 'Gagnez 5 parties au casino'
        }],
        rewards: {
          coins: 500,
          xp: 200,
          reputation: 25,
          titles: ['Chanceux']
        },
        isActive: true,
        maxCompletions: 1
      },
      {
        questId: `story_high_roller_${guildId}`,
        guildId,
        title: 'Les Hauts Enjeux',
        description: 'Prouvez votre courage en misant gros. Seuls les plus audacieux réussissent.',
        type: 'story',
        category: 'casino',
        chainId: 'main_story',
        previousQuest: `story_first_win_${guildId}`,
        requirements: {
          previousQuests: [`story_first_win_${guildId}`],
          level: 3
        },
        objectives: [{
          type: 'wager_amount',
          target: null,
          current: 0,
          required: 2000,
          description: 'Misez un total de 2000 pièces'
        }],
        rewards: {
          coins: 1000,
          xp: 500,
          reputation: 50,
          titles: ['Flambeur']
        },
        isActive: true,
        maxCompletions: 1
      }
    ];

    for (const questData of storyQuests) {
      await Quest.findOneAndUpdate(
        { questId: questData.questId, guildId },
        questData,
        { upsert: true, new: true }
      );
    }

    console.log(`Created/updated story quests for guild ${guildId}`);
  }
}
