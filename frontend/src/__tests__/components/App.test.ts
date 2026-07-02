import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import App from '../../App.vue';
import CharacterCreation from '../../components/CharacterCreation.vue';
import CasinoLobby from '../../components/CasinoLobby.vue';

vi.mock('../../services/api', () => ({
  apiService: {
    devLogin: vi.fn(),
    getCurrentUser: vi.fn(),
    getCharacter: vi.fn(),
    getEnergy: vi.fn(),
  },
}));

vi.mock('../../services/websocket', () => ({
  wsService: { connect: vi.fn(), disconnect: vi.fn() },
}));

vi.mock('../../services/discordSdk', () => ({
  initializeDiscordSdk: vi.fn(),
  getCurrentUser: vi.fn(),
  getGuildId: vi.fn(),
  getChannelId: vi.fn(),
}));

import { apiService } from '../../services/api';
import { wsService } from '../../services/websocket';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 100, max: 100, regenRate: 1, lastRegen: new Date().toISOString(), minutesUntilFull: 0,
    } as any);
    vi.mocked(apiService.devLogin).mockResolvedValue({ token: 'tok-123', user: { id: 'me' } } as any);
    // Not embedded in a Discord iframe by default
    window.history.replaceState({}, '', '/');
  });

  it('shows character creation when the logged-in user has no character yet', async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 100 } as any);
    vi.mocked(apiService.getCharacter).mockResolvedValue(null);

    const wrapper = shallowMount(App);
    await flushPromises();

    expect(apiService.devLogin).toHaveBeenCalledWith('Demo User');
    expect(wrapper.findComponent(CharacterCreation).exists()).toBe(true);
    expect(wrapper.findComponent(CasinoLobby).exists()).toBe(false);
    expect(wsService.connect).not.toHaveBeenCalled();
  });

  it('shows the casino lobby and connects the websocket when a character already exists', async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 250 } as any);
    vi.mocked(apiService.getCharacter).mockResolvedValue({ id: 'char-1', className: 'warrior' } as any);

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

    expect(wrapper.text()).toContain('Failed to initialize application');
    expect(wrapper.findComponent(CharacterCreation).exists()).toBe(true);
  });

  it('switches to the casino view and connects the websocket once a character is created', async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 100 } as any);
    vi.mocked(apiService.getCharacter).mockResolvedValue(null);
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
    vi.mocked(apiService.getCharacter).mockResolvedValue({ id: 'char-1', className: 'warrior' } as any);

    const wrapper = shallowMount(App);
    await flushPromises();
    expect(wrapper.findComponent(CasinoLobby).props('userCoins')).toBe(100);

    await wrapper.findComponent(CasinoLobby).vm.$emit('balanceChange');
    await flushPromises();

    expect(wrapper.findComponent(CasinoLobby).props('userCoins')).toBe(175);
  });
});
