import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import type { Mock } from 'vitest';
import { CharacterService, CHARACTER_CLASSES } from '../src/services/CharacterService';
import { Character, User } from '../src/models/database';

// Mock database models
vi.mock('../src/models/database');

describe('CharacterService', () => {
  const mockUserId = 'user123';
  const mockGuildId = 'guild456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CHARACTER_CLASSES', () => {
    it('should have 6 character classes defined', () => {
      const classes = Object.keys(CHARACTER_CLASSES);
      expect(classes).toHaveLength(6);
      expect(classes).toContain('warrior');
      expect(classes).toContain('mage');
      expect(classes).toContain('rogue');
      expect(classes).toContain('merchant');
      expect(classes).toContain('bard');
      expect(classes).toContain('paladin');
    });

    it('should have correct warrior class properties', () => {
      const warrior = CHARACTER_CLASSES.warrior;
      expect(warrior.name).toBe('Warrior');
      expect(warrior.baseStats.strength).toBe(20);
      expect(warrior.baseStats.vitality).toBe(18);
      expect(warrior.casinoBonus.specialAbility).toBe('battle_rage');
      expect(warrior.casinoBonus.energyBonus).toBe(20);
    });

    it('should have correct mage class properties', () => {
      const mage = CHARACTER_CLASSES.mage;
      expect(mage.name).toBe('Mage');
      expect(mage.baseStats.intelligence).toBe(22);
      expect(mage.baseStats.luck).toBe(15);
      expect(mage.casinoBonus.specialAbility).toBe('arcane_insight');
      expect(mage.casinoBonus.luckBonus).toBe(10);
    });

    it('should have correct rogue class properties', () => {
      const rogue = CHARACTER_CLASSES.rogue;
      expect(rogue.name).toBe('Rogue');
      expect(rogue.baseStats.dexterity).toBe(20);
      expect(rogue.baseStats.luck).toBe(18);
      expect(rogue.casinoBonus.specialAbility).toBe('sleight_of_hand');
      expect(rogue.casinoBonus.luckBonus).toBe(15);
    });

    it('should have correct merchant class properties', () => {
      const merchant = CHARACTER_CLASSES.merchant;
      expect(merchant.name).toBe('Merchant');
      expect(merchant.baseStats.charisma).toBe(20);
      expect(merchant.baseStats.intelligence).toBe(16);
      expect(merchant.casinoBonus.specialAbility).toBe('coin_sense');
      expect(merchant.casinoBonus.energyBonus).toBe(25);
    });

    it('should have correct bard class properties', () => {
      const bard = CHARACTER_CLASSES.bard;
      expect(bard.name).toBe('Bard');
      expect(bard.baseStats.charisma).toBeGreaterThan(15);
      expect(bard.casinoBonus.luckBonus).toBe(12);
    });

    it('should have correct paladin class properties', () => {
      const paladin = CHARACTER_CLASSES.paladin;
      expect(paladin.name).toBe('Paladin');
      expect(paladin.baseStats.vitality).toBeGreaterThan(15);
      expect(paladin.casinoBonus.energyBonus).toBeGreaterThan(10);
    });

    it('should have all required properties for each class', () => {
      for (const [className, classInfo] of Object.entries(CHARACTER_CLASSES)) {
        expect(classInfo.name).toBeDefined();
        expect(classInfo.description).toBeDefined();
        expect(classInfo.baseStats).toBeDefined();
        expect(classInfo.baseStats.strength).toBeDefined();
        expect(classInfo.baseStats.intelligence).toBeDefined();
        expect(classInfo.baseStats.luck).toBeDefined();
        expect(classInfo.baseStats.charisma).toBeDefined();
        expect(classInfo.baseStats.vitality).toBeDefined();
        expect(classInfo.baseStats.dexterity).toBeDefined();
        expect(classInfo.casinoBonus).toBeDefined();
        expect(classInfo.casinoBonus.luckBonus).toBeDefined();
        expect(classInfo.casinoBonus.energyBonus).toBeDefined();
        expect(classInfo.casinoBonus.specialAbility).toBeDefined();
        expect(classInfo.casinoBonus.description).toBeDefined();
      }
    });
  });

  describe('getAllClasses', () => {
    it('should return all character classes', async () => {
      const classes = await CharacterService.getAllClasses();
      expect(classes).toHaveLength(6);
    });
  });

  describe('calculateTotalStats', () => {
    it('should calculate total stats correctly for a character', () => {
      const mockCharacter = {
        level: 10,
        stats: {
          strength: 15,
          intelligence: 12,
          luck: 18,
          charisma: 14,
          vitality: 16,
          dexterity: 13
        }
      };

      const totalStats = CharacterService.calculateTotalStats(mockCharacter);

      expect(totalStats).toBeDefined();
      expect(totalStats.strength).toBeGreaterThanOrEqual(mockCharacter.stats.strength);
      expect(totalStats.intelligence).toBeGreaterThanOrEqual(mockCharacter.stats.intelligence);
      expect(totalStats.luck).toBeGreaterThanOrEqual(mockCharacter.stats.luck);
      expect(totalStats.charisma).toBeGreaterThanOrEqual(mockCharacter.stats.charisma);
      expect(totalStats.vitality).toBeGreaterThanOrEqual(mockCharacter.stats.vitality);
      expect(totalStats.dexterity).toBeGreaterThanOrEqual(mockCharacter.stats.dexterity);
    });

    it('should scale stats with level', () => {
      const lowLevelChar = {
        level: 1,
        stats: { strength: 10, intelligence: 10, luck: 10, charisma: 10, vitality: 10, dexterity: 10 }
      };

      const highLevelChar = {
        level: 20,
        stats: { strength: 10, intelligence: 10, luck: 10, charisma: 10, vitality: 10, dexterity: 10 }
      };

      const lowStats = CharacterService.calculateTotalStats(lowLevelChar);
      const highStats = CharacterService.calculateTotalStats(highLevelChar);

      expect(highStats.strength).toBeGreaterThan(lowStats.strength);
    });

    it('should add level bonus every 5 levels', () => {
      const level5Char = {
        level: 5,
        stats: { strength: 10, intelligence: 10, luck: 10, charisma: 10, vitality: 10, dexterity: 10 }
      };

      const level10Char = {
        level: 10,
        stats: { strength: 10, intelligence: 10, luck: 10, charisma: 10, vitality: 10, dexterity: 10 }
      };

      const stats5 = CharacterService.calculateTotalStats(level5Char);
      const stats10 = CharacterService.calculateTotalStats(level10Char);

      expect(stats10.strength - stats5.strength).toBe(1); // +1 per 5 levels
    });
  });

  describe('calculateLevelProgress', () => {
    it('should return correct level for experience', () => {
      const progress = CharacterService.calculateLevelProgress(0);
      expect(progress.currentLevel).toBe(1);
    });

    it('should calculate correct progress percentage', () => {
      const progress = CharacterService.calculateLevelProgress(50);
      expect(progress.progress).toBeGreaterThanOrEqual(0);
      expect(progress.progress).toBeLessThanOrEqual(100);
    });

    it('should increase level with more experience', () => {
      const lowXp = CharacterService.calculateLevelProgress(100);
      const highXp = CharacterService.calculateLevelProgress(10000);
      
      expect(highXp.currentLevel).toBeGreaterThan(lowXp.currentLevel);
    });

    it('should calculate XP to next level', () => {
      const progress = CharacterService.calculateLevelProgress(50);
      expect(progress.nextLevelXp).toBeGreaterThan(0);
    });

    it('should follow correct XP formula (level = sqrt(xp/100) + 1)', () => {
      // At 100 XP: level = sqrt(100/100) + 1 = sqrt(1) + 1 = 2
      const level2Progress = CharacterService.calculateLevelProgress(100);
      expect(level2Progress.currentLevel).toBe(2);

      // At 400 XP: level = sqrt(400/100) + 1 = sqrt(4) + 1 = 3
      const level3Progress = CharacterService.calculateLevelProgress(400);
      expect(level3Progress.currentLevel).toBe(3);

      // At 900 XP: level = sqrt(900/100) + 1 = sqrt(9) + 1 = 4
      const level4Progress = CharacterService.calculateLevelProgress(900);
      expect(level4Progress.currentLevel).toBe(4);
    });

    it('should handle high XP values correctly', () => {
      const highXp = CharacterService.calculateLevelProgress(100000);
      // At 100000 XP: level = sqrt(100000/100) + 1 = sqrt(1000) + 1 ≈ 32.6
      expect(highXp.currentLevel).toBeGreaterThan(30);
      expect(highXp.nextLevelXp).toBeDefined();
    });

    it('should show progress percentage within current level', () => {
      // At 50 XP, should be 50% progress to level 2 (which requires 100 XP)
      const midProgress = CharacterService.calculateLevelProgress(50);
      expect(midProgress.currentLevel).toBe(1);
      expect(midProgress.progress).toBeGreaterThan(0);
    });
  });

  describe('Multi-Level Up Scenarios', () => {
    it('should handle multi-level jump when gaining large XP', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 1,
        xp: 0,
        save: vi.fn().mockResolvedValue(true)
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);

      // Add 1000 XP, which should result in multiple level ups
      const result = await CharacterService.levelUpCharacter(
        mockUserId,
        mockGuildId,
        1000
      );

      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBeGreaterThan(2); // Should be at least level 3+
      // levelsGained is calculated as newLevel - oldLevel
      expect(result.newLevel - result.oldLevel).toBeGreaterThan(1);
    });

    it('should correctly track levels gained in result', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 5,
        xp: 1600, // Level 5
        save: vi.fn().mockResolvedValue(true)
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);

      // Add enough XP to gain exactly one level
      const result = await CharacterService.levelUpCharacter(
        mockUserId,
        mockGuildId,
        500
      );

      expect(result.totalXp).toBe(2100);
      expect(result.xpGained).toBe(500);
    });

    it('should not level up when XP is insufficient', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 2, // Needs 400 XP for level 3
        xp: 110,
        save: vi.fn().mockResolvedValue(true)
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);

      const result = await CharacterService.levelUpCharacter(
        mockUserId,
        mockGuildId,
        10
      );

      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBe(result.oldLevel);
    });

    it('should handle XP at exact level threshold', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 1,
        xp: 99, // One XP away from level 2 (100 XP threshold)
        save: vi.fn().mockResolvedValue(true)
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);

      const result = await CharacterService.levelUpCharacter(
        mockUserId,
        mockGuildId,
        1
      );

      expect(result.totalXp).toBe(100);
      expect(result.leveledUp).toBe(true);
    });
  });

  describe('levelUpCharacter', () => {
    it('should add XP to character', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 5,
        xp: 2500,
        save: vi.fn().mockResolvedValue(true)
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);

      const result = await CharacterService.levelUpCharacter(
        mockUserId,
        mockGuildId,
        100
      );

      expect(result).toBeDefined();
      expect(result.xpGained).toBe(100);
      expect(result.totalXp).toBe(2600);
    });

    it('should detect level up', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        level: 1,
        xp: 90, // Just below level 2
        save: vi.fn().mockResolvedValue(true)
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);

      const result = await CharacterService.levelUpCharacter(
        mockUserId,
        mockGuildId,
        50
      );

      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBeGreaterThan(result.oldLevel);
    });

    it('should throw error when character not found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      await expect(
        CharacterService.levelUpCharacter(mockUserId, mockGuildId, 100)
      ).rejects.toThrow('Character not found');
    });
  });

  describe('createCharacter', () => {
    it('should create a new character with valid data', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);
      (User.updateOne as Mock).mockResolvedValue({ modifiedCount: 1 });
      
      const mockSave = vi.fn().mockResolvedValue({
        userId: mockUserId,
        guildId: mockGuildId,
        name: 'TestHero',
        className: 'warrior',
        level: 1,
        xp: 0,
        stats: CHARACTER_CLASSES.warrior.baseStats
      });

      (Character as unknown as Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await CharacterService.createCharacter(
        mockUserId,
        mockGuildId,
        { name: 'TestHero', className: 'warrior' }
      );

      expect(result).toBeDefined();
      expect(result.classInfo).toBeDefined();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should reject invalid class name', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      await expect(
        CharacterService.createCharacter(
          mockUserId,
          mockGuildId,
          { name: 'TestHero', className: 'invalidClass' }
        )
      ).rejects.toThrow('Invalid character class');
    });

    it('should reject if user already has character', async () => {
      (Character.findOne as Mock).mockResolvedValue({
        userId: mockUserId,
        guildId: mockGuildId
      });

      await expect(
        CharacterService.createCharacter(
          mockUserId,
          mockGuildId,
          { name: 'TestHero', className: 'warrior' }
        )
      ).rejects.toThrow('already has a character');
    });

    it('should reject too short name', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      await expect(
        CharacterService.createCharacter(
          mockUserId,
          mockGuildId,
          { name: 'A', className: 'warrior' }
        )
      ).rejects.toThrow('must be between 2 and 20');
    });

    it('should reject too long name', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      await expect(
        CharacterService.createCharacter(
          mockUserId,
          mockGuildId,
          { name: 'ThisNameIsTooLongForCharacter', className: 'warrior' }
        )
      ).rejects.toThrow('must be between 2 and 20');
    });
  });

  describe('getCharacterInfo', () => {
    it('should return character info when found', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId,
        name: 'TestHero',
        class: 'warrior',  // Use 'class' to match ICharacter interface
        level: 5,
        xp: 500,
        stats: CHARACTER_CLASSES.warrior.baseStats
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);

      const result = await CharacterService.getCharacterInfo(mockUserId, mockGuildId);

      expect(result).toBeDefined();
      expect(result.character).toBeDefined();
      expect(result.classInfo).toBeDefined();
      expect(result.totalStats).toBeDefined();
      expect(result.levelProgress).toBeDefined();
    });

    it('should return null when character not found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      const result = await CharacterService.getCharacterInfo(mockUserId, mockGuildId);

      expect(result).toBeNull();
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character and update user', async () => {
      const mockCharacter = {
        userId: mockUserId,
        guildId: mockGuildId
      };

      (Character.findOne as Mock).mockResolvedValue(mockCharacter);
      (User.updateOne as Mock).mockResolvedValue({ modifiedCount: 1 });
      (Character.deleteOne as Mock).mockResolvedValue({ deletedCount: 1 });

      await CharacterService.deleteCharacter(mockUserId, mockGuildId);

      expect(User.updateOne).toHaveBeenCalled();
      expect(Character.deleteOne).toHaveBeenCalled();
    });

    it('should throw error when character not found', async () => {
      (Character.findOne as Mock).mockResolvedValue(null);

      await expect(
        CharacterService.deleteCharacter(mockUserId, mockGuildId)
      ).rejects.toThrow('Character not found');
    });
  });

  describe('Character Progression Edge Cases', () => {
    describe('XP Formula Boundary Tests', () => {
      it('should be level 1 at 0 XP', () => {
        const result = CharacterService.calculateLevelProgress(0);
        expect(result.currentLevel).toBe(1);
        expect(result.progress).toBe(0);
      });

      it('should be level 1 at 99 XP (just before level 2)', () => {
        const result = CharacterService.calculateLevelProgress(99);
        expect(result.currentLevel).toBe(1);
        expect(result.progress).toBe(99);
      });

      it('should be level 2 at exactly 100 XP', () => {
        const result = CharacterService.calculateLevelProgress(100);
        expect(result.currentLevel).toBe(2);
        expect(result.progress).toBe(0);
      });

      it('should be level 3 at exactly 400 XP (2^2 * 100)', () => {
        const result = CharacterService.calculateLevelProgress(400);
        expect(result.currentLevel).toBe(3);
        expect(result.progress).toBe(0);
      });

      it('should be level 4 at exactly 900 XP (3^2 * 100)', () => {
        const result = CharacterService.calculateLevelProgress(900);
        expect(result.currentLevel).toBe(4);
        expect(result.progress).toBe(0);
      });

      it('should be level 10 at exactly 8100 XP (9^2 * 100)', () => {
        const result = CharacterService.calculateLevelProgress(8100);
        expect(result.currentLevel).toBe(10);
        expect(result.progress).toBe(0);
      });

      it('should calculate 50% progress correctly', () => {
        // Level 1->2 requires 100 XP (0 to 100)
        // 50 XP = 50% progress
        const result = CharacterService.calculateLevelProgress(50);
        expect(result.currentLevel).toBe(1);
        expect(result.progress).toBe(50);
      });

      it('should calculate mid-level progress for higher levels', () => {
        // Level 2->3 requires XP from 100 to 400 (range of 300)
        // At 250 XP: (250-100)/(400-100) = 150/300 = 50%
        const result = CharacterService.calculateLevelProgress(250);
        expect(result.currentLevel).toBe(2);
        expect(result.progress).toBe(50);
      });

      it('should handle very high XP values', () => {
        // Level 100 requires (99^2 * 100) = 980100 XP
        const result = CharacterService.calculateLevelProgress(980100);
        expect(result.currentLevel).toBe(100);
        expect(result.progress).toBe(0);
      });

      it('should calculate nextLevelXp correctly', () => {
        // At 50 XP (level 1), need 50 more to reach level 2
        const result = CharacterService.calculateLevelProgress(50);
        expect(result.nextLevelXp).toBe(50);
      });
    });

    describe('Multi-Level Jump Tests', () => {
      it('should handle gaining enough XP to skip multiple levels', async () => {
        const mockCharacter = {
          userId: mockUserId,
          guildId: mockGuildId,
          level: 1,
          xp: 0,
          save: vi.fn().mockResolvedValue(true)
        };

        (Character.findOne as Mock).mockResolvedValue(mockCharacter);

        // Gain 1000 XP - should go from level 1 to level 4
        // Level 2 at 100, Level 3 at 400, Level 4 at 900
        const result = await CharacterService.levelUpCharacter(
          mockUserId,
          mockGuildId,
          1000
        );

        expect(result.leveledUp).toBe(true);
        expect(result.oldLevel).toBe(1);
        expect(result.newLevel).toBe(4); // sqrt(1000/100) + 1 = 4.16, floor = 4
      });

      it('should correctly detect no level up when XP is insufficient', async () => {
        const mockCharacter = {
          userId: mockUserId,
          guildId: mockGuildId,
          level: 5,
          xp: 1700, // Level 5 is at 1600, Level 6 at 2500
          save: vi.fn().mockResolvedValue(true)
        };

        (Character.findOne as Mock).mockResolvedValue(mockCharacter);

        // Gain only 50 XP - not enough to level up
        const result = await CharacterService.levelUpCharacter(
          mockUserId,
          mockGuildId,
          50
        );

        expect(result.leveledUp).toBe(false);
        expect(result.oldLevel).toBe(5);
        expect(result.newLevel).toBe(5);
        expect(result.totalXp).toBe(1750);
      });

      it('should handle exact threshold XP gain', async () => {
        const mockCharacter = {
          userId: mockUserId,
          guildId: mockGuildId,
          level: 1,
          xp: 90,
          save: vi.fn().mockResolvedValue(true)
        };

        (Character.findOne as Mock).mockResolvedValue(mockCharacter);

        // Gain exactly 10 XP to hit 100 and level up
        const result = await CharacterService.levelUpCharacter(
          mockUserId,
          mockGuildId,
          10
        );

        expect(result.leveledUp).toBe(true);
        expect(result.newLevel).toBe(2);
        expect(result.totalXp).toBe(100);
      });
    });

    describe('Stat Scaling at High Levels', () => {
      it('should add +1 to all stats at level 5', () => {
        const character = {
          level: 5,
          stats: CHARACTER_CLASSES.warrior.baseStats
        };

        const totalStats = CharacterService.calculateTotalStats(character);

        // Warrior base strength is 20, +1 at level 5
        expect(totalStats.strength).toBe(21);
        expect(totalStats.intelligence).toBe(9);
        expect(totalStats.luck).toBe(11);
      });

      it('should add +2 to all stats at level 10', () => {
        const character = {
          level: 10,
          stats: CHARACTER_CLASSES.mage.baseStats
        };

        const totalStats = CharacterService.calculateTotalStats(character);

        // Mage base intelligence is 22, +2 at level 10
        expect(totalStats.intelligence).toBe(24);
        expect(totalStats.strength).toBe(8);
      });

      it('should add +10 to all stats at level 50', () => {
        const character = {
          level: 50,
          stats: CHARACTER_CLASSES.rogue.baseStats
        };

        const totalStats = CharacterService.calculateTotalStats(character);

        // Rogue base dexterity is 20, +10 at level 50
        expect(totalStats.dexterity).toBe(30);
        expect(totalStats.luck).toBe(28);
      });

      it('should add +20 to all stats at level 100', () => {
        const character = {
          level: 100,
          stats: CHARACTER_CLASSES.paladin.baseStats
        };

        const totalStats = CharacterService.calculateTotalStats(character);

        // Paladin base vitality is 20, +20 at level 100
        expect(totalStats.vitality).toBe(40);
        expect(totalStats.strength).toBe(38);
      });

      it('should calculate total correctly as sum of all stats', () => {
        const character = {
          level: 10,
          stats: CHARACTER_CLASSES.merchant.baseStats
        };

        const totalStats = CharacterService.calculateTotalStats(character);

        // Merchant base total: 10+16+12+20+14+12 = 84
        // Plus +2 bonus for each of 6 stats = 84 + 12 = 96
        expect(totalStats.total).toBe(96);
      });
    });

    describe('Character Class Stat Comparisons', () => {
      it('should have warrior as highest strength class', () => {
        const allClasses = Object.values(CHARACTER_CLASSES);
        const maxStrength = Math.max(...allClasses.map(c => c.baseStats.strength));
        
        expect(CHARACTER_CLASSES.warrior.baseStats.strength).toBe(maxStrength);
      });

      it('should have mage as highest intelligence class', () => {
        const allClasses = Object.values(CHARACTER_CLASSES);
        const maxIntelligence = Math.max(...allClasses.map(c => c.baseStats.intelligence));
        
        expect(CHARACTER_CLASSES.mage.baseStats.intelligence).toBe(maxIntelligence);
      });

      it('should have rogue as highest dexterity class', () => {
        const allClasses = Object.values(CHARACTER_CLASSES);
        const maxDexterity = Math.max(...allClasses.map(c => c.baseStats.dexterity));
        
        expect(CHARACTER_CLASSES.rogue.baseStats.dexterity).toBe(maxDexterity);
      });

      it('should have rogue as highest luck class', () => {
        const allClasses = Object.values(CHARACTER_CLASSES);
        const maxLuck = Math.max(...allClasses.map(c => c.baseStats.luck));
        
        expect(CHARACTER_CLASSES.rogue.baseStats.luck).toBe(maxLuck);
      });

      it('should have paladin as highest vitality class', () => {
        const allClasses = Object.values(CHARACTER_CLASSES);
        const maxVitality = Math.max(...allClasses.map(c => c.baseStats.vitality));
        
        expect(CHARACTER_CLASSES.paladin.baseStats.vitality).toBe(maxVitality);
      });

      it('should have bard as highest charisma class', () => {
        const allClasses = Object.values(CHARACTER_CLASSES);
        const maxCharisma = Math.max(...allClasses.map(c => c.baseStats.charisma));
        
        expect(CHARACTER_CLASSES.bard.baseStats.charisma).toBe(maxCharisma);
      });

      it('should have all classes with balanced total stats (within reasonable range)', () => {
        for (const [className, classInfo] of Object.entries(CHARACTER_CLASSES)) {
          const totalBaseStats = Object.values(classInfo.baseStats).reduce((sum, stat) => sum + stat, 0);
          // All classes should have total stats between 75 and 92
          // (warrior: 78, mage: 75, rogue: 86, merchant: 84, bard: 87, paladin: 90)
          expect(totalBaseStats).toBeGreaterThanOrEqual(75);
          expect(totalBaseStats).toBeLessThanOrEqual(92);
        }
      });
    });
  });
});

