import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import cron from 'node-cron';
import { birthdaysDb } from '../database/db';
import { initBirthdayChecker } from '../services/birthdayChecker';

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
}));

vi.mock('../database/db', () => ({
  birthdaysDb: { getTodayBirthdays: vi.fn() },
}));

function makeChannel(name: string, textBased = true) {
  return {
    name,
    isTextBased: () => textBased,
    send: vi.fn().mockResolvedValue(undefined),
  };
}

function makeGuild(name: string, channels: ReturnType<typeof makeChannel>[]) {
  return { name, channels: { cache: channels } };
}

function makeClient(guilds: Record<string, ReturnType<typeof makeGuild>>) {
  return {
    guilds: { cache: new Map(Object.entries(guilds)) },
    users: { fetch: vi.fn() },
  };
}

// Registers the cron job and returns the captured daily-check callback
async function runDailyCheck(client: ReturnType<typeof makeClient>) {
  initBirthdayChecker(client as any);
  const callback = (cron.schedule as Mock).mock.calls[0][1] as () => Promise<void>;
  await callback();
}

describe('initBirthdayChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a daily cron job at 9:00 AM', () => {
    initBirthdayChecker(makeClient({}) as any);
    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function));
  });

  it('sends a birthday message in the #anniversaires channel when it exists', async () => {
    const anniversaires = makeChannel('anniversaires');
    const general = makeChannel('general');
    const guild = makeGuild('Test Guild', [general, anniversaires]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'user-1', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
    ]);
    (client.users.fetch as Mock).mockResolvedValue({ id: 'user-1', username: 'Alice' });

    await runDailyCheck(client);

    expect(anniversaires.send).toHaveBeenCalledWith(expect.stringContaining('<@user-1>'));
    expect(general.send).not.toHaveBeenCalled();
  });

  it('falls back to #general when there is no #anniversaires channel', async () => {
    const general = makeChannel('general');
    const random = makeChannel('random');
    const guild = makeGuild('Test Guild', [random, general]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'user-1', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
    ]);
    (client.users.fetch as Mock).mockResolvedValue({ id: 'user-1', username: 'Alice' });

    await runDailyCheck(client);

    expect(general.send).toHaveBeenCalledTimes(1);
    expect(random.send).not.toHaveBeenCalled();
  });

  it('falls back to the first text channel when neither #anniversaires nor #general exist', async () => {
    const random = makeChannel('random');
    const guild = makeGuild('Test Guild', [random]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'user-1', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
    ]);
    (client.users.fetch as Mock).mockResolvedValue({ id: 'user-1', username: 'Alice' });

    await runDailyCheck(client);

    expect(random.send).toHaveBeenCalledTimes(1);
  });

  it('skips a guild with no birthdays today without sending anything', async () => {
    const channel = makeChannel('general');
    const guild = makeGuild('Test Guild', [channel]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([]);

    await runDailyCheck(client);

    expect(channel.send).not.toHaveBeenCalled();
  });

  it('skips a guild with no suitable text channel', async () => {
    const guild = makeGuild('Test Guild', []);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'user-1', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
    ]);

    await expect(runDailyCheck(client)).resolves.toBeUndefined();
    expect(client.users.fetch).not.toHaveBeenCalled();
  });

  it('includes the age in the message when a reasonable birth year is set', async () => {
    const channel = makeChannel('general');
    const guild = makeGuild('Test Guild', [channel]);
    const client = makeClient({ 'guild-1': guild });
    const currentYear = new Date().getFullYear();

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'user-1', guildId: 'guild-1', birthMonth: 6, birthDay: 15, birthYear: currentYear - 25 },
    ]);
    (client.users.fetch as Mock).mockResolvedValue({ id: 'user-1', username: 'Alice' });

    await runDailyCheck(client);

    expect(channel.send).toHaveBeenCalledWith(expect.stringContaining('25 ans'));
  });

  it('omits the age when the birth year would produce an unreasonable age', async () => {
    const channel = makeChannel('general');
    const guild = makeGuild('Test Guild', [channel]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'user-1', guildId: 'guild-1', birthMonth: 6, birthDay: 15, birthYear: 1800 },
    ]);
    (client.users.fetch as Mock).mockResolvedValue({ id: 'user-1', username: 'Alice' });

    await runDailyCheck(client);

    const message = (channel.send as Mock).mock.calls[0][0];
    expect(message).not.toContain('ans aujourd');
  });

  it('skips a birthday entry with a missing userId', async () => {
    const channel = makeChannel('general');
    const guild = makeGuild('Test Guild', [channel]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: '', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
    ]);

    await runDailyCheck(client);

    expect(client.users.fetch).not.toHaveBeenCalled();
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('skips a birthday when the user cannot be fetched', async () => {
    const channel = makeChannel('general');
    const guild = makeGuild('Test Guild', [channel]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'ghost-user', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
    ]);
    (client.users.fetch as Mock).mockRejectedValue(new Error('Unknown User'));

    await runDailyCheck(client);

    expect(channel.send).not.toHaveBeenCalled();
  });

  it('sends a message for every birthday in the guild', async () => {
    const channel = makeChannel('general');
    const guild = makeGuild('Test Guild', [channel]);
    const client = makeClient({ 'guild-1': guild });

    (birthdaysDb.getTodayBirthdays as Mock).mockResolvedValue([
      { userId: 'user-1', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
      { userId: 'user-2', guildId: 'guild-1', birthMonth: 6, birthDay: 15 },
    ]);
    (client.users.fetch as Mock).mockImplementation((id: string) =>
      Promise.resolve({ id, username: `User-${id}` })
    );

    await runDailyCheck(client);

    expect(channel.send).toHaveBeenCalledTimes(2);
  });

  it('continues processing other guilds when one guild throws', async () => {
    const brokenGuild = makeGuild('Broken Guild', []);
    // Force an error while resolving birthdays for the first guild
    const workingChannel = makeChannel('general');
    const workingGuild = makeGuild('Working Guild', [workingChannel]);
    const client = makeClient({ 'guild-broken': brokenGuild, 'guild-ok': workingGuild });

    (birthdaysDb.getTodayBirthdays as Mock)
      .mockRejectedValueOnce(new Error('DB unavailable'))
      .mockResolvedValueOnce([{ userId: 'user-1', guildId: 'guild-ok', birthMonth: 6, birthDay: 15 }]);
    (client.users.fetch as Mock).mockResolvedValue({ id: 'user-1', username: 'Alice' });

    await expect(runDailyCheck(client)).resolves.toBeUndefined();
    expect(workingChannel.send).toHaveBeenCalledTimes(1);
  });
});
