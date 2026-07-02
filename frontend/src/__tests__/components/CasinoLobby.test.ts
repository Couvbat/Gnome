import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import CasinoLobby from '../../components/CasinoLobby.vue';
import GamesGrid from '../../components/organisms/GamesGrid.vue';
import BlackjackTable from '../../components/games/BlackjackTable.vue';
import RouletteWheel from '../../components/games/RouletteWheel.vue';
import SlotMachine from '../../components/games/SlotMachine.vue';
import DiceGame from '../../components/games/DiceGame.vue';

vi.mock('../../services/api', () => ({
  apiService: {
    getActiveTables: vi.fn(),
    createBlackjackTable: vi.fn(),
    createRouletteTable: vi.fn(),
  },
}));

vi.mock('../../services/discordSdk', () => ({
  isDiscordSdkReady: vi.fn().mockReturnValue(false),
}));

import { apiService } from '../../services/api';

const character = { id: 'char-1', className: 'warrior' } as any;

function mountLobby(props: Record<string, unknown> = {}) {
  return shallowMount(CasinoLobby, {
    props: { character, userCoins: 500, energy: null, ...props },
  });
}

describe('CasinoLobby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getActiveTables).mockResolvedValue([]);
  });

  it('loads active blackjack and roulette tables on mount', async () => {
    vi.mocked(apiService.getActiveTables).mockImplementation((gameType: string) =>
      Promise.resolve(
        gameType === 'blackjack'
          ? [{ id: 'bj-1', gameType: 'blackjack', playerCount: 2, maxPlayers: 6 }]
          : [{ id: 'rt-1', gameType: 'roulette', playerCount: 1, maxPlayers: null }]
      ) as any
    );

    const wrapper = mountLobby();
    await flushPromises();

    expect(apiService.getActiveTables).toHaveBeenCalledWith('blackjack');
    expect(apiService.getActiveTables).toHaveBeenCalledWith('roulette');
    expect(wrapper.findComponent(GamesGrid).props('activeTables')).toHaveLength(2);
  });

  it('joins an existing table instead of creating a new one', async () => {
    vi.mocked(apiService.getActiveTables).mockImplementation((gameType: string) =>
      Promise.resolve(
        gameType === 'blackjack'
          ? [{ id: 'bj-existing', gameType: 'blackjack', playerCount: 2, maxPlayers: 6 }]
          : []
      ) as any
    );

    const wrapper = mountLobby();
    await flushPromises();

    await wrapper.findComponent(GamesGrid).vm.$emit('joinGame', 'blackjack');
    await flushPromises();

    expect(apiService.createBlackjackTable).not.toHaveBeenCalled();
    expect(wrapper.findComponent(BlackjackTable).props('table')).toMatchObject({ id: 'bj-existing' });
  });

  it('creates a new blackjack table when none is available', async () => {
    const newTable = { id: 'bj-new', gameType: 'blackjack', playerCount: 0, maxPlayers: 6 };
    vi.mocked(apiService.createBlackjackTable).mockResolvedValue(newTable as any);

    const wrapper = mountLobby();
    await flushPromises();

    await wrapper.findComponent(GamesGrid).vm.$emit('joinGame', 'blackjack');
    await flushPromises();

    expect(apiService.createBlackjackTable).toHaveBeenCalled();
    expect(wrapper.findComponent(BlackjackTable).props('table')).toMatchObject({ id: 'bj-new' });
  });

  it('creates a new roulette table when none is available', async () => {
    const newTable = { id: 'rt-new', gameType: 'roulette', playerCount: 0, maxPlayers: null };
    vi.mocked(apiService.createRouletteTable).mockResolvedValue(newTable as any);

    const wrapper = mountLobby();
    await flushPromises();

    await wrapper.findComponent(GamesGrid).vm.$emit('joinGame', 'roulette');
    await flushPromises();

    expect(apiService.createRouletteTable).toHaveBeenCalled();
    expect(wrapper.findComponent(RouletteWheel).props('table')).toMatchObject({ id: 'rt-new' });
  });

  it('does not create or select a table for solo games (slots, dice)', async () => {
    const wrapper = mountLobby();
    await flushPromises();

    await wrapper.findComponent(GamesGrid).vm.$emit('joinGame', 'slots');
    await flushPromises();

    expect(apiService.createBlackjackTable).not.toHaveBeenCalled();
    expect(apiService.createRouletteTable).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SlotMachine).exists()).toBe(true);
  });

  it('switches to the dice view directly without any table lookup', async () => {
    const wrapper = mountLobby();
    await flushPromises();

    await wrapper.findComponent(GamesGrid).vm.$emit('joinGame', 'dice');
    await flushPromises();

    expect(wrapper.findComponent(DiceGame).exists()).toBe(true);
  });

  it('returns to the lobby and refreshes tables when a game emits leave', async () => {
    const wrapper = mountLobby();
    await flushPromises();

    await wrapper.findComponent(GamesGrid).vm.$emit('joinGame', 'dice');
    await flushPromises();
    expect(wrapper.findComponent(DiceGame).exists()).toBe(true);

    vi.mocked(apiService.getActiveTables).mockClear();
    await wrapper.findComponent(DiceGame).vm.$emit('leave');
    await flushPromises();

    expect(wrapper.findComponent(DiceGame).exists()).toBe(false);
    expect(wrapper.findComponent(GamesGrid).exists()).toBe(true);
    expect(apiService.getActiveTables).toHaveBeenCalled();
  });

  it('forwards balanceChange events from the active game up to the parent', async () => {
    const wrapper = mountLobby();
    await flushPromises();
    await wrapper.findComponent(GamesGrid).vm.$emit('joinGame', 'slots');
    await flushPromises();

    await wrapper.findComponent(SlotMachine).vm.$emit('balanceChange');

    expect(wrapper.emitted('balanceChange')).toBeTruthy();
  });
});
