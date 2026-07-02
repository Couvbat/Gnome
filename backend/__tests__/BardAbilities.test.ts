import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { BardAbilities } from '../src/services/BardAbilities';
import { AbilityService } from '../src/services/AbilityService';
import { BlackjackTable, RouletteTable, CasinoSession } from '../src/models/schemas';

vi.mock('../src/models/schemas', () => ({
  BlackjackTable: { findOne: vi.fn() },
  RouletteTable:  { findOne: vi.fn() },
  CasinoSession:  { findOne: vi.fn() }
}));

vi.mock('../src/services/AbilityService', () => ({
  AbilityService: {
    canUseAbility: vi.fn(),
    useAbility:    vi.fn()
  }
}));

// ─── shared fixtures ─────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 60 * 60 * 1000); // 1 h from now
const PAST   = new Date(Date.now() - 60 * 60 * 1000); // 1 h ago

function mockSession(buffs: object[] = [], extraFields: object = {}) {
  return {
    temporaryBuffs: buffs,
    save: vi.fn().mockResolvedValue(undefined),
    ...extraFields
  };
}

function mockIo() {
  const emit = vi.fn();
  return { io: { to: vi.fn().mockReturnValue({ emit }) }, emit };
}

describe('BardAbilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── pure function ────────────────────────────────────────────────────────

  describe('calculateHarmonyBoost', () => {
    it('returns 1.0 with no winning bets', () => {
      expect(BardAbilities.calculateHarmonyBoost(0)).toBe(1.0);
    });

    it('returns 1.1 with one winning bet', () => {
      expect(BardAbilities.calculateHarmonyBoost(1)).toBeCloseTo(1.1);
    });

    it('returns 1.3 at three winning bets (maximum)', () => {
      expect(BardAbilities.calculateHarmonyBoost(3)).toBeCloseTo(1.3);
    });

    it('caps at 1.3 beyond three winning bets', () => {
      expect(BardAbilities.calculateHarmonyBoost(10)).toBeCloseTo(1.3);
    });
  });

  // ─── checkActiveBardBuffs ─────────────────────────────────────────────────

  describe('checkActiveBardBuffs', () => {
    it('returns 0 when no active session exists', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue(null);
      expect(await BardAbilities.checkActiveBardBuffs('user1', 'guild1')).toBe(0);
    });

    it('returns 0 when session has no temporaryBuffs field', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue({});
      expect(await BardAbilities.checkActiveBardBuffs('user1', 'guild1')).toBe(0);
    });

    it('returns 0 when all bard buffs are expired', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue(
        mockSession([{ type: 'bard_lucky_song', source: 'bard1', value: 0.1, expiresAt: PAST }])
      );
      expect(await BardAbilities.checkActiveBardBuffs('user1', 'guild1')).toBe(0);
    });

    it('returns the buff value for one active bard buff', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue(
        mockSession([{ type: 'bard_lucky_song', source: 'bard1', value: 0.1, expiresAt: FUTURE }])
      );
      expect(await BardAbilities.checkActiveBardBuffs('user1', 'guild1')).toBeCloseTo(0.1);
    });

    it('sums multiple active buffs from different bards', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue(
        mockSession([
          { type: 'bard_lucky_song', source: 'bard1', value: 0.1, expiresAt: FUTURE },
          { type: 'bard_lucky_song', source: 'bard2', value: 0.1, expiresAt: FUTURE }
        ])
      );
      expect(await BardAbilities.checkActiveBardBuffs('user1', 'guild1')).toBeCloseTo(0.2);
    });

    it('ignores non-bard buff types', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue(
        mockSession([{ type: 'other_buff', source: 'someone', value: 0.5, expiresAt: FUTURE }])
      );
      expect(await BardAbilities.checkActiveBardBuffs('user1', 'guild1')).toBe(0);
    });

    it('returns 0 and does not throw on internal errors', async () => {
      (CasinoSession.findOne as Mock).mockRejectedValue(new Error('DB error'));
      expect(await BardAbilities.checkActiveBardBuffs('user1', 'guild1')).toBe(0);
    });
  });

  // ─── getActiveBuffs ───────────────────────────────────────────────────────

  describe('getActiveBuffs', () => {
    it('returns empty array when no session exists', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue(null);
      expect(await BardAbilities.getActiveBuffs('user1', 'guild1')).toEqual([]);
    });

    it('returns only buffs that have not yet expired', async () => {
      const activeBuff  = { type: 'bard_lucky_song', source: 'b1', value: 0.1, expiresAt: FUTURE, appliedAt: new Date() };
      const expiredBuff = { type: 'bard_lucky_song', source: 'b2', value: 0.1, expiresAt: PAST, appliedAt: new Date() };
      (CasinoSession.findOne as Mock).mockResolvedValue(mockSession([activeBuff, expiredBuff]));
      const buffs = await BardAbilities.getActiveBuffs('user1', 'guild1');
      expect(buffs).toHaveLength(1);
      expect(buffs[0].source).toBe('b1');
    });
  });

  // ─── cleanupExpiredBuffs ──────────────────────────────────────────────────

  describe('cleanupExpiredBuffs', () => {
    it('does not throw when no session exists', async () => {
      (CasinoSession.findOne as Mock).mockResolvedValue(null);
      await expect(BardAbilities.cleanupExpiredBuffs('user1', 'guild1')).resolves.toBeUndefined();
    });

    it('removes expired buffs and saves the session', async () => {
      const session = mockSession([
        { type: 'bard_lucky_song', expiresAt: PAST },    // expired
        { type: 'bard_lucky_song', expiresAt: FUTURE }   // active
      ]);
      (CasinoSession.findOne as Mock).mockResolvedValue(session);
      await BardAbilities.cleanupExpiredBuffs('user1', 'guild1');
      expect(session.temporaryBuffs).toHaveLength(1);
      expect(session.save).toHaveBeenCalledOnce();
    });

    it('keeps all buffs when none are expired', async () => {
      const session = mockSession([
        { type: 'bard_lucky_song', expiresAt: FUTURE },
        { type: 'bard_lucky_song', expiresAt: FUTURE }
      ]);
      (CasinoSession.findOne as Mock).mockResolvedValue(session);
      await BardAbilities.cleanupExpiredBuffs('user1', 'guild1');
      expect(session.temporaryBuffs).toHaveLength(2);
    });
  });

  // ─── triggerLuckySong ─────────────────────────────────────────────────────

  describe('triggerLuckySong', () => {
    it('returns failure when ability is on cooldown', async () => {
      (AbilityService.canUseAbility as Mock).mockResolvedValue({
        success: false,
        message: 'Ability on cooldown'
      });
      const { io } = mockIo();
      const result = await BardAbilities.triggerLuckySong('bard1', 'guild1', 't1', 'blackjack', io as any);
      expect(result.success).toBe(false);
      expect(result.affectedPlayers).toHaveLength(0);
    });

    it('returns failure when blackjack table is not found', async () => {
      (AbilityService.canUseAbility as Mock).mockResolvedValue({ success: true });
      (BlackjackTable.findOne as Mock).mockResolvedValue(null);
      const { io } = mockIo();
      const result = await BardAbilities.triggerLuckySong('bard1', 'guild1', 't1', 'blackjack', io as any);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Table not found');
    });

    it('returns failure when bard is the only player at the table', async () => {
      (AbilityService.canUseAbility as Mock).mockResolvedValue({ success: true });
      (BlackjackTable.findOne as Mock).mockResolvedValue({
        players: [{ userId: 'bard1' }]
      });
      const { io } = mockIo();
      const result = await BardAbilities.triggerLuckySong('bard1', 'guild1', 't1', 'blackjack', io as any);
      expect(result.success).toBe(false);
      expect(result.message).toContain('No other players');
    });

    it('buffs other players and broadcasts when conditions are met', async () => {
      (AbilityService.canUseAbility as Mock).mockResolvedValue({ success: true });
      (AbilityService.useAbility as Mock).mockResolvedValue(undefined);
      (BlackjackTable.findOne as Mock).mockResolvedValue({
        players: [{ userId: 'bard1' }, { userId: 'user2' }, { userId: 'user3' }]
      });
      // user2 and user3 have active sessions
      const session2 = mockSession();
      const session3 = mockSession();
      (CasinoSession.findOne as Mock)
        .mockResolvedValueOnce(session2)
        .mockResolvedValueOnce(session3);

      const { io, emit } = mockIo();
      const result = await BardAbilities.triggerLuckySong('bard1', 'guild1', 't1', 'blackjack', io as any);

      expect(result.success).toBe(true);
      expect(result.affectedPlayers).toEqual(['user2', 'user3']);
      // Buff was applied to each session
      expect(session2.temporaryBuffs).toHaveLength(1);
      expect(session2.temporaryBuffs[0].type).toBe('bard_lucky_song');
      expect(session2.save).toHaveBeenCalledOnce();
      // Ability usage recorded for bard
      expect(AbilityService.useAbility).toHaveBeenCalledWith('bard1', 'guild1', 'bard_lucky_song');
      // Socket.io broadcast sent
      expect(io.to).toHaveBeenCalledWith('blackjack:t1');
      expect(emit).toHaveBeenCalledWith('bard:buff_applied', expect.objectContaining({
        bardUserId: 'bard1',
        buffType: 'luck'
      }));
    });

    it('refreshes an existing buff instead of duplicating it', async () => {
      (AbilityService.canUseAbility as Mock).mockResolvedValue({ success: true });
      (AbilityService.useAbility as Mock).mockResolvedValue(undefined);
      (BlackjackTable.findOne as Mock).mockResolvedValue({
        players: [{ userId: 'bard1' }, { userId: 'user2' }]
      });
      // user2 already has a buff from bard1
      const existingBuff = { type: 'bard_lucky_song', source: 'bard1', value: 0.1, expiresAt: FUTURE, appliedAt: new Date() };
      const session2 = mockSession([existingBuff]);
      (CasinoSession.findOne as Mock).mockResolvedValue(session2);

      const { io } = mockIo();
      await BardAbilities.triggerLuckySong('bard1', 'guild1', 't1', 'blackjack', io as any);

      // Still only one buff (refreshed, not duplicated)
      expect(session2.temporaryBuffs).toHaveLength(1);
    });

    it('returns failure when roulette table is not found', async () => {
      (AbilityService.canUseAbility as Mock).mockResolvedValue({ success: true });
      (RouletteTable.findOne as Mock).mockResolvedValue(null);
      const { io } = mockIo();
      const result = await BardAbilities.triggerLuckySong('bard1', 'guild1', 't1', 'roulette', io as any);
      expect(result.success).toBe(false);
    });
  });
});
