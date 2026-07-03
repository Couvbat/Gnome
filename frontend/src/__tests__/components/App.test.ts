import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';
import App from '../../App.vue';
import CharacterCreation from '../../components/CharacterCreation.vue';
import CasinoLobby from '../../components/CasinoLobby.vue';

vi.mock('../../services/api', () => ({
  apiService: {
    devLogin: vi.fn(),
    getCurrentUser: vi.fn(),
    getMyCharacter: vi.fn(),
    getEnergy: vi.fn(),
  },
  // Must be a real ref (not a plain object) so App.vue's watch(authExpired, ...) works.
  authExpired: ref(false),
}));

vi.mock('../../services/websocket', () => ({
  wsService: { connect: vi.fn(), disconnect: vi.fn() },
}));

vi.mock('../../services/discordSdk', () => ({
  initializeDiscordSdk: vi.fn(),
  isRunningInDiscordActivity: vi.fn().mockReturnValue(false),
  getAuthToken: vi.fn().mockReturnValue(null),
  getCurrentUser: vi.fn(),
}));

import { apiService, authExpired } from '../../services/api';
import { wsService } from '../../services/websocket';
import { isRunningInDiscordActivity, getAuthToken } from '../../services/discordSdk';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authExpired.value = false;
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 100, max: 100, regenRate: 1, lastRegen: new Date().toISOString(), minutesUntilFull: 0,
    } as any);
    vi.mocked(apiService.devLogin).mockResolvedValue({ token: 'tok-123', user: { id: 'me' } } as any);
    vi.mocked(isRunningInDiscordActivity).mockReturnValue(false);
    vi.mocked(getAuthToken).mockReturnValue(null);
    // Not embedded in a Discord iframe by default
    window.history.replaceState({}, '', '/');
  });

  it('shows character creation when the logged-in user has no character yet', async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 100 } as any);
    vi.mocked(apiService.getMyCharacter).mockResolvedValue(null);

    const wrapper = shallowMount(App);
    await flushPromises();

    expect(apiService.devLogin).toHaveBeenCalledWith('Demo User');
    expect(wrapper.findComponent(CharacterCreation).exists()).toBe(true);
    expect(wrapper.findComponent(CasinoLobby).exists()).toBe(false);
    expect(wsService.connect).not.toHaveBeenCalled();
  });

  it('shows the casino lobby and connects the websocket when a character already exists', async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 250 } as any);
    vi.mocked(apiService.getMyCharacter).mockResolvedValue({ id: 'char-1', className: 'warrior' } as any);

    const wrapper = shallowMount(App);
    await flushPromises();

    expect(wrapper.findComponent(CasinoLobby).exists()).toBe(true);
    expect(wrapper.findComponent(CasinoLobby).props('userCoins')).toBe(250);
    expect(wsService.connect).toHaveBeenCalledWith('tok-123');
  });

  it('falls back to the character-creation view with an error message when initialization fails entirely', async () => {
    vi.mocked(apiService.devLogin).mockRejectedValue(new Error('network down'));

    const wrapper = shallowMount(App);
    await flushPromises();

    expect(wrapper.text()).toContain('network down');
    expect(wrapper.findComponent(CharacterCreation).exists()).toBe(true);
  });

  it('switches to the casino view and connects the websocket once a character is created', async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 100 } as any);
    vi.mocked(apiService.getMyCharacter).mockResolvedValue(null);
    // setup.ts stubs window.localStorage with a plain vi.fn()-based mock, not a real Storage instance
    vi.mocked(window.localStorage.getItem).mockReturnValue('stored-token');

    const wrapper = shallowMount(App);
    await flushPromises();
    expect(wrapper.findComponent(CharacterCreation).exists()).toBe(true);

    const newCharacter = { id: 'char-2', className: 'mage' };
    await wrapper.findComponent(CharacterCreation).vm.$emit('characterCreated', newCharacter);
    await flushPromises();

    expect(wrapper.findComponent(CasinoLobby).exists()).toBe(true);
    expect(wrapper.findComponent(CasinoLobby).props('character')).toEqual(newCharacter);
    expect(wsService.connect).toHaveBeenCalledWith('stored-token');
  });

  it('refreshes user and character data when the lobby reports a balance change', async () => {
    vi.mocked(apiService.getCurrentUser)
      .mockResolvedValueOnce({ id: 'me', coins: 100 } as any)
      .mockResolvedValueOnce({ id: 'me', coins: 175 } as any);
    vi.mocked(apiService.getMyCharacter).mockResolvedValue({ id: 'char-1', className: 'warrior' } as any);

    const wrapper = shallowMount(App);
    await flushPromises();
    expect(wrapper.findComponent(CasinoLobby).props('userCoins')).toBe(100);

    await wrapper.findComponent(CasinoLobby).vm.$emit('balanceChange');
    await flushPromises();

    expect(wrapper.findComponent(CasinoLobby).props('userCoins')).toBe(175);
  });

  it('uses the real Discord OAuth session (not devLogin) when running as a genuine Discord Activity', async () => {
    window.history.replaceState({}, '', '/?frame_id=abc123');
    vi.mocked(isRunningInDiscordActivity).mockReturnValue(true);
    vi.mocked(getAuthToken).mockReturnValue('real-discord-jwt');
    const { initializeDiscordSdk } = await import('../../services/discordSdk');
    vi.mocked(initializeDiscordSdk).mockResolvedValue(true);
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'discord-user', coins: 500 } as any);
    vi.mocked(apiService.getMyCharacter).mockResolvedValue({ id: 'char-1', className: 'bard' } as any);

    const wrapper = shallowMount(App);
    await flushPromises();

    expect(apiService.devLogin).not.toHaveBeenCalled();
    expect(wsService.connect).toHaveBeenCalledWith('real-discord-jwt');
    expect(wrapper.findComponent(CasinoLobby).exists()).toBe(true);
  });

  it('surfaces an error instead of falling back to devLogin when Discord auth fails in a real Activity', async () => {
    window.history.replaceState({}, '', '/?frame_id=abc123');
    vi.mocked(isRunningInDiscordActivity).mockReturnValue(true);
    vi.mocked(getAuthToken).mockReturnValue(null);
    const { initializeDiscordSdk } = await import('../../services/discordSdk');
    vi.mocked(initializeDiscordSdk).mockResolvedValue(true);

    const wrapper = shallowMount(App);
    await flushPromises();

    expect(apiService.devLogin).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("L'authentification Discord a échoué");
  });
});
