import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';

vi.mock('../services/discordSdk', () => ({
  initializeDiscordSdk: vi.fn(),
  getCurrentUser: vi.fn(),
  getCurrentChannel: vi.fn(),
  getCurrentGuild: vi.fn(),
  getVoiceParticipants: vi.fn(),
  refreshVoiceParticipants: vi.fn(),
  openInviteDialog: vi.fn(),
  setActivity: vi.fn(),
  getInstanceId: vi.fn(),
  getChannelId: vi.fn(),
  getGuildId: vi.fn(),
}));

import * as discordSdkService from '../services/discordSdk';
import { useDiscordSdk } from '../composables/useDiscordSdk';

function mountUseDiscordSdk() {
  let exposed: ReturnType<typeof useDiscordSdk>;
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = useDiscordSdk();
        return () => h('div');
      },
    })
  );
  return { wrapper, get state() { return exposed; } };
}

const mockUser = { id: 'user-1', username: 'Alice', discriminator: '0', avatar: null, global_name: 'Alice' } as any;
const mockChannel = { id: 'chan-1', name: 'General' } as any;
const mockGuild = { id: 'guild-1', name: 'Test Guild' } as any;

describe('useDiscordSdk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('populates user/channel/guild state when initialization succeeds', async () => {
    vi.mocked(discordSdkService.initializeDiscordSdk).mockResolvedValue(true);
    vi.mocked(discordSdkService.getCurrentUser).mockReturnValue(mockUser);
    vi.mocked(discordSdkService.getCurrentChannel).mockReturnValue(mockChannel);
    vi.mocked(discordSdkService.getCurrentGuild).mockReturnValue(mockGuild);
    vi.mocked(discordSdkService.getVoiceParticipants).mockReturnValue([]);

    const { state } = mountUseDiscordSdk();

    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    expect(state.isReady.value).toBe(true);
    expect(state.error.value).toBeNull();
    expect(state.user.value).toEqual(mockUser);
    expect(state.channel.value).toEqual(mockChannel);
    expect(state.guild.value).toEqual(mockGuild);
  });

  it('sets an error when the SDK fails to initialize', async () => {
    vi.mocked(discordSdkService.initializeDiscordSdk).mockResolvedValue(false);

    const { state } = mountUseDiscordSdk();

    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    expect(state.isReady.value).toBe(false);
    expect(state.error.value).toBe('Failed to initialize Discord SDK');
  });

  it('captures the error message when initialization throws', async () => {
    vi.mocked(discordSdkService.initializeDiscordSdk).mockRejectedValue(new Error('SDK unavailable'));

    const { state } = mountUseDiscordSdk();

    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    expect(state.isReady.value).toBe(false);
    expect(state.error.value).toBe('SDK unavailable');
  });

  it('filters bots out of humanParticipants', async () => {
    vi.mocked(discordSdkService.initializeDiscordSdk).mockResolvedValue(true);
    vi.mocked(discordSdkService.getCurrentUser).mockReturnValue(mockUser);
    vi.mocked(discordSdkService.getCurrentChannel).mockReturnValue(mockChannel);
    vi.mocked(discordSdkService.getCurrentGuild).mockReturnValue(mockGuild);
    vi.mocked(discordSdkService.getVoiceParticipants).mockReturnValue([
      { id: 'user-1', username: 'Alice', bot: false } as any,
      { id: 'bot-1', username: 'Le Gnome', bot: true } as any,
      { id: 'user-2', username: 'Bob', bot: false } as any,
    ]);

    const { state } = mountUseDiscordSdk();
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    expect(state.voiceParticipants.value).toHaveLength(3);
    expect(state.humanParticipants.value).toHaveLength(2);
    expect(state.humanParticipants.value.map((p) => p.id)).toEqual(['user-1', 'user-2']);
  });

  it('polls refreshVoiceParticipants on an interval once ready', async () => {
    vi.mocked(discordSdkService.initializeDiscordSdk).mockResolvedValue(true);
    vi.mocked(discordSdkService.getCurrentUser).mockReturnValue(mockUser);
    vi.mocked(discordSdkService.getCurrentChannel).mockReturnValue(mockChannel);
    vi.mocked(discordSdkService.getCurrentGuild).mockReturnValue(mockGuild);
    vi.mocked(discordSdkService.getVoiceParticipants).mockReturnValue([]);
    vi.mocked(discordSdkService.refreshVoiceParticipants).mockResolvedValue([
      { id: 'user-3', username: 'Carol', bot: false } as any,
    ]);

    const { state } = mountUseDiscordSdk();
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    expect(discordSdkService.refreshVoiceParticipants).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);

    expect(discordSdkService.refreshVoiceParticipants).toHaveBeenCalledTimes(1);
    expect(state.voiceParticipants.value).toHaveLength(1);
  });

  it('stops polling after the component unmounts', async () => {
    vi.mocked(discordSdkService.initializeDiscordSdk).mockResolvedValue(true);
    vi.mocked(discordSdkService.getCurrentUser).mockReturnValue(mockUser);
    vi.mocked(discordSdkService.getCurrentChannel).mockReturnValue(mockChannel);
    vi.mocked(discordSdkService.getCurrentGuild).mockReturnValue(mockGuild);
    vi.mocked(discordSdkService.getVoiceParticipants).mockReturnValue([]);
    vi.mocked(discordSdkService.refreshVoiceParticipants).mockResolvedValue([]);

    const { wrapper, state } = mountUseDiscordSdk();
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(20000);

    expect(discordSdkService.refreshVoiceParticipants).not.toHaveBeenCalled();
  });

  it('delegates inviteFriends and updateActivity to the underlying service', async () => {
    vi.mocked(discordSdkService.initializeDiscordSdk).mockResolvedValue(true);
    vi.mocked(discordSdkService.getCurrentUser).mockReturnValue(mockUser);
    vi.mocked(discordSdkService.getCurrentChannel).mockReturnValue(mockChannel);
    vi.mocked(discordSdkService.getCurrentGuild).mockReturnValue(mockGuild);
    vi.mocked(discordSdkService.getVoiceParticipants).mockReturnValue([]);
    vi.mocked(discordSdkService.openInviteDialog).mockResolvedValue(undefined);
    vi.mocked(discordSdkService.setActivity).mockResolvedValue(undefined);

    const { state } = mountUseDiscordSdk();
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    await state.inviteFriends();
    expect(discordSdkService.openInviteDialog).toHaveBeenCalledTimes(1);

    await state.updateActivity('Playing Blackjack', 'In the tavern');
    expect(discordSdkService.setActivity).toHaveBeenCalledWith('Playing Blackjack', 'In the tavern');
  });
});
