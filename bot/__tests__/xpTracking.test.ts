import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { EventEmitter } from 'events';
import { Events } from 'discord.js';
import { userLevelsDb } from '../database/db';
import { initXpTracking } from '../services/xpTracking';

vi.mock('../database/db', () => ({
  userLevelsDb: {
    addXp: vi.fn(),
    upsert: vi.fn(),
    addCoins: vi.fn(),
  },
}));

function makeClient() {
  return new EventEmitter() as EventEmitter & { on: EventEmitter['on'] };
}

// messageXpCooldowns is a module-level Map keyed by userId-guildId that
// outlives each test (tests run within milliseconds of each other, well
// under the 30s cooldown), so every test uses its own userId to avoid
// bleeding cooldown state into unrelated tests.
function makeMessage(userId: string, overrides: Record<string, unknown> = {}) {
  const send = vi.fn().mockResolvedValue(undefined);
  return {
    author: { id: userId, username: 'Alice', bot: false },
    guildId: 'guild-1',
    channel: { isTextBased: () => true, send },
    ...overrides,
  };
}

// Message handlers are async; give their microtasks a chance to settle
// before assertions run.
async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('initXpTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0); // -> xpGain = floor(0*11)+5 = 5
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('message XP', () => {
    it('ignores messages from bots', async () => {
      const client = makeClient();
      initXpTracking(client as any);

      client.emit(Events.MessageCreate, makeMessage('user-bot-test', { author: { id: 'bot-1', bot: true } }));
      await flush();

      expect(userLevelsDb.addXp).not.toHaveBeenCalled();
    });

    it('ignores DMs (no guildId)', async () => {
      const client = makeClient();
      initXpTracking(client as any);

      client.emit(Events.MessageCreate, makeMessage('user-dm-test', { guildId: null }));
      await flush();

      expect(userLevelsDb.addXp).not.toHaveBeenCalled();
    });

    it('awards XP for a normal guild message', async () => {
      (userLevelsDb.addXp as Mock).mockResolvedValue({ level: 1, totalMessages: 3, leveledUp: false });
      (userLevelsDb.upsert as Mock).mockResolvedValue(undefined);

      const client = makeClient();
      initXpTracking(client as any);

      client.emit(Events.MessageCreate, makeMessage('user-normal'));
      await flush();

      expect(userLevelsDb.addXp).toHaveBeenCalledWith('user-normal', 'guild-1', 5);
      expect(userLevelsDb.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-normal', guildId: 'guild-1', totalMessages: 4 })
      );
    });

    it('does not award XP again within the cooldown window', async () => {
      (userLevelsDb.addXp as Mock).mockResolvedValue({ level: 1, totalMessages: 1, leveledUp: false });

      const client = makeClient();
      initXpTracking(client as any);

      client.emit(Events.MessageCreate, makeMessage('user-cooldown'));
      await flush();
      client.emit(Events.MessageCreate, makeMessage('user-cooldown'));
      await flush();

      expect(userLevelsDb.addXp).toHaveBeenCalledTimes(1);
    });

    it('awards coins and announces a level-up in the channel', async () => {
      (userLevelsDb.addXp as Mock).mockResolvedValue({ level: 3, totalMessages: 10, leveledUp: true });
      (userLevelsDb.upsert as Mock).mockResolvedValue(undefined);
      (userLevelsDb.addCoins as Mock).mockResolvedValue(undefined);

      const client = makeClient();
      initXpTracking(client as any);

      const message = makeMessage('user-levelup');
      client.emit(Events.MessageCreate, message);
      await flush();

      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('user-levelup', 'guild-1', 150); // level 3 * 50
      expect(message.channel.send).toHaveBeenCalledWith(expect.stringContaining('niveau **3**'));
    });

    it('does not send a level-up announcement when the channel is not text-based', async () => {
      (userLevelsDb.addXp as Mock).mockResolvedValue({ level: 2, totalMessages: 5, leveledUp: true });
      (userLevelsDb.upsert as Mock).mockResolvedValue(undefined);
      (userLevelsDb.addCoins as Mock).mockResolvedValue(undefined);

      const client = makeClient();
      initXpTracking(client as any);

      const message = makeMessage('user-nontext', { channel: { isTextBased: () => false } });
      client.emit(Events.MessageCreate, message);
      await flush();

      // Coins are still awarded even if the announcement can't be sent
      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('user-nontext', 'guild-1', 100);
    });

    it('does not throw when addXp rejects', async () => {
      (userLevelsDb.addXp as Mock).mockRejectedValue(new Error('DB down'));

      const client = makeClient();
      initXpTracking(client as any);

      expect(() => client.emit(Events.MessageCreate, makeMessage('user-reject'))).not.toThrow();
      await flush();
    });
  });

  describe('voice XP', () => {
    function makeVoiceState(channelId: string | null, overrides: Record<string, unknown> = {}) {
      return {
        id: 'user-1',
        channelId,
        guild: { id: 'guild-1', channels: { cache: { find: vi.fn().mockReturnValue(undefined) } } },
        member: { user: { username: 'Alice' } },
        ...overrides,
      };
    }

    it('starts tracking when a user joins a voice channel and awards nothing yet', async () => {
      const client = makeClient();
      initXpTracking(client as any);

      client.emit(Events.VoiceStateUpdate, makeVoiceState(null), makeVoiceState('vc-1'));
      await flush();

      expect(userLevelsDb.addXp).not.toHaveBeenCalled();
    });

    it('awards XP based on minutes spent in voice when the user leaves', async () => {
      (userLevelsDb.addXp as Mock).mockResolvedValue({ level: 1, totalVoiceMinutes: 0, leveledUp: false });
      (userLevelsDb.upsert as Mock).mockResolvedValue(undefined);

      vi.useFakeTimers();
      const client = makeClient();
      initXpTracking(client as any);

      const now = Date.now();
      client.emit(Events.VoiceStateUpdate, makeVoiceState(null), makeVoiceState('vc-1'));

      vi.setSystemTime(now + 3 * 60 * 1000); // 3 minutes later
      client.emit(Events.VoiceStateUpdate, makeVoiceState('vc-1'), makeVoiceState(null));
      vi.useRealTimers();
      await flush();

      expect(userLevelsDb.addXp).toHaveBeenCalledWith('user-1', 'guild-1', 15); // 3 min * 5 XP
      expect(userLevelsDb.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', guildId: 'guild-1', totalVoiceMinutes: 3 })
      );
    });

    it('does not award XP for less than one full minute in voice', async () => {
      vi.useFakeTimers();
      const client = makeClient();
      initXpTracking(client as any);

      const now = Date.now();
      client.emit(Events.VoiceStateUpdate, makeVoiceState(null), makeVoiceState('vc-1'));
      vi.setSystemTime(now + 30 * 1000); // 30 seconds
      client.emit(Events.VoiceStateUpdate, makeVoiceState('vc-1'), makeVoiceState(null));
      vi.useRealTimers();
      await flush();

      expect(userLevelsDb.addXp).not.toHaveBeenCalled();
    });

    it('finds a #general text channel and announces a voice level-up', async () => {
      (userLevelsDb.addXp as Mock).mockResolvedValue({ level: 4, totalVoiceMinutes: 20, leveledUp: true });
      (userLevelsDb.upsert as Mock).mockResolvedValue(undefined);
      (userLevelsDb.addCoins as Mock).mockResolvedValue(undefined);

      const send = vi.fn().mockResolvedValue(undefined);
      const generalChannel = { name: 'general', isTextBased: () => true, send };

      vi.useFakeTimers();
      const client = makeClient();
      initXpTracking(client as any);

      const guild = {
        id: 'guild-1',
        channels: { cache: { find: vi.fn().mockReturnValue(generalChannel) } },
      };
      const now = Date.now();
      client.emit(Events.VoiceStateUpdate, makeVoiceState(null, { guild }), makeVoiceState('vc-1', { guild }));
      vi.setSystemTime(now + 2 * 60 * 1000);
      client.emit(Events.VoiceStateUpdate, makeVoiceState('vc-1', { guild }), makeVoiceState(null, { guild }));
      vi.useRealTimers();
      await flush();

      expect(userLevelsDb.addCoins).toHaveBeenCalledWith('user-1', 'guild-1', 200); // level 4 * 50
      expect(send).toHaveBeenCalledWith(expect.stringContaining('niveau **4**'));
    });

    it('does not track anything when a user switches between voice channels', async () => {
      const client = makeClient();
      initXpTracking(client as any);

      client.emit(
        Events.VoiceStateUpdate,
        makeVoiceState('vc-1'),
        makeVoiceState('vc-2')
      );
      await flush();

      expect(userLevelsDb.addXp).not.toHaveBeenCalled();
    });
  });
});
