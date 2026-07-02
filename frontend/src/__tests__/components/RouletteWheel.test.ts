import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RouletteWheel from '../../components/games/RouletteWheel.vue';
import RouletteNumberGrid from '../../components/molecules/RouletteNumberGrid.vue';
import RouletteBetButtons from '../../components/molecules/RouletteBetButtons.vue';

vi.mock('../../services/api', () => ({
  apiService: { getCurrentUser: vi.fn() },
}));

vi.mock('../../services/websocket', () => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    wsService: {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(cb);
      }),
      off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        const cbs = listeners.get(event);
        if (cbs) {
          const i = cbs.indexOf(cb);
          if (i > -1) cbs.splice(i, 1);
        }
      }),
      joinRouletteTable: vi.fn(),
      placeRouletteBet: vi.fn(),
      leaveRouletteTable: vi.fn(),
      __trigger: (event: string, ...args: unknown[]) => {
        (listeners.get(event) || []).forEach((cb) => cb(...args));
      },
      __reset: () => listeners.clear(),
    },
  };
});

import { apiService } from '../../services/api';
import { wsService } from '../../services/websocket';

const trigger = (event: string, ...args: unknown[]) => (wsService as any).__trigger(event, ...args);

const table = { id: 'table-1', gameType: 'roulette' as const, playerCount: 1, maxPlayers: null };

function mountWheel(props: Partial<InstanceType<typeof RouletteWheel>['$props']> = {}) {
  return mount(RouletteWheel, { props: { table, ...props } });
}

describe('RouletteWheel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (wsService as any).__reset();
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 500 } as any);
    vi.stubGlobal('alert', vi.fn());
    vi.useFakeTimers();
  });

  it('fetches the balance and joins the table on mount', async () => {
    mountWheel();
    await flushPromises();

    expect(apiService.getCurrentUser).toHaveBeenCalled();
    expect(wsService.joinRouletteTable).toHaveBeenCalledWith('table-1');
  });

  it('opens betting and starts the countdown from a table_state event', async () => {
    const wrapper = mountWheel();
    await flushPromises();

    trigger('roulette:table_state', { gamePhase: 'betting', timeRemaining: 20 });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('20s restantes');
  });

  it('resets bets and starts a fresh countdown on betting_opened', async () => {
    const wrapper = mountWheel();
    await flushPromises();

    trigger('roulette:betting_opened', { timeRemaining: 30 });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('30s restantes');
  });

  it('counts down every second while in the betting phase', async () => {
    const wrapper = mountWheel();
    await flushPromises();

    trigger('roulette:betting_opened', { timeRemaining: 5 });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('5s restantes');

    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.text()).toContain('2s restantes');
  });

  it('places a straight-number bet and sends it over the websocket', async () => {
    const wrapper = mountWheel();
    await flushPromises();
    trigger('roulette:betting_opened', { timeRemaining: 30 });
    await wrapper.vm.$nextTick();

    const grid = wrapper.findComponent(RouletteNumberGrid);
    grid.props('onNumberClick')(17);
    await wrapper.vm.$nextTick();

    expect(wsService.placeRouletteBet).toHaveBeenCalledWith('table-1', [
      { type: 'straight', value: 17, amount: 10 },
    ]);
  });

  it('places a special bet (e.g. red) via RouletteBetButtons', async () => {
    const wrapper = mountWheel();
    await flushPromises();
    trigger('roulette:betting_opened', { timeRemaining: 30 });
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(RouletteBetButtons).vm.$emit('betPlaced', 'red', 25);

    expect(wsService.placeRouletteBet).toHaveBeenCalledWith('table-1', [{ type: 'red', amount: 25 }]);
  });

  it('rejects a bet that would exceed the available balance', async () => {
    const wrapper = mountWheel();
    await flushPromises();
    trigger('roulette:betting_opened', { timeRemaining: 30 });
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(RouletteBetButtons).vm.$emit('betPlaced', 'red', 1000);

    expect(alert).toHaveBeenCalledWith('Fonds insuffisants!');
    expect(wsService.placeRouletteBet).not.toHaveBeenCalled();
  });

  it('tracks other players joining and leaving without touching my own bets', async () => {
    const wrapper = mountWheel();
    await flushPromises();

    trigger('roulette:player_bet', {
      userId: 'other-user',
      bets: [{ type: 'black', amount: 20 }],
      totalWagered: 20,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Joueurs à la table (1)');

    // the backend broadcasts this under the shared "table:player_left" event, not a roulette-prefixed one
    trigger('table:player_left', { userId: 'other-user' });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain('Joueurs à la table');
  });

  it('ignores my own bet echoed back from the server', async () => {
    const wrapper = mountWheel();
    await flushPromises();

    trigger('roulette:player_bet', { userId: 'me', bets: [{ type: 'red', amount: 10 }], totalWagered: 10 });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain('Joueurs à la table');
  });

  it('resolves a winning spin, refreshes balance, and emits balanceChange', async () => {
    const wrapper = mountWheel();
    await flushPromises();
    trigger('roulette:betting_opened', { timeRemaining: 30 });
    await wrapper.vm.$nextTick();
    wrapper.findComponent(RouletteNumberGrid).props('onNumberClick')(17);
    await wrapper.vm.$nextTick();

    trigger('roulette:spin_started');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('La roue tourne');

    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 850 } as any);
    trigger('roulette:spin_result', {
      number: 17,
      color: 'black',
      winners: [{ userId: 'me', payout: 360 }],
      totalPayouts: 360,
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Gagné 360 pièces');
    expect(wrapper.emitted('balanceChange')).toBeTruthy();
  });

  it('reports a loss when none of my bets hit', async () => {
    const wrapper = mountWheel();
    await flushPromises();
    trigger('roulette:betting_opened', { timeRemaining: 30 });
    await wrapper.vm.$nextTick();
    wrapper.findComponent(RouletteNumberGrid).props('onNumberClick')(3);
    await wrapper.vm.$nextTick();

    trigger('roulette:spin_result', { number: 17, color: 'black', winners: [], totalPayouts: 0 });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Perdu 10 pièces');
  });

  it('shows an alert on a server error event', async () => {
    mountWheel();
    await flushPromises();

    trigger('error', { message: 'Betting round is closed' });

    expect(alert).toHaveBeenCalledWith('Betting round is closed');
  });

  it('unregisters listeners, clears the countdown timer, and leaves the table on unmount', async () => {
    const wrapper = mountWheel();
    await flushPromises();
    trigger('roulette:betting_opened', { timeRemaining: 30 });
    await wrapper.vm.$nextTick();

    wrapper.unmount();

    expect(wsService.leaveRouletteTable).toHaveBeenCalledWith('table-1');
    expect(wsService.off).toHaveBeenCalledWith('roulette:spin_result', expect.any(Function));
    expect(wsService.off).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('emits leave when the lobby button is clicked', async () => {
    const wrapper = mountWheel();
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('leave')).toBeTruthy();
  });
});
