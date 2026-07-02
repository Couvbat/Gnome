import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BlackjackTable from '../../components/games/BlackjackTable.vue';
import PlayerSeat from '../../components/games/blackjack/PlayerSeat.vue';
import DealerSection from '../../components/games/blackjack/DealerSection.vue';
import BettingControls from '../../components/games/blackjack/BettingControls.vue';
import GameControls from '../../components/games/blackjack/GameControls.vue';

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
      joinBlackjackTable: vi.fn(),
      placeBlackjackBet: vi.fn(),
      hitBlackjack: vi.fn(),
      standBlackjack: vi.fn(),
      leaveBlackjackTable: vi.fn(),
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

const table = { id: 'table-1', gameType: 'blackjack' as const, playerCount: 1, maxPlayers: 6 };

function mountTable(props: Partial<InstanceType<typeof BlackjackTable>['$props']> = {}) {
  return mount(BlackjackTable, {
    props: { table, characterClass: 'warrior', ...props },
    global: { stubs: { transition: false } },
  });
}

describe('BlackjackTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (wsService as any).__reset();
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 500 } as any);
    vi.stubGlobal('alert', vi.fn());
  });

  it('fetches the balance and joins the table on mount', async () => {
    const wrapper = mountTable();
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wsService.joinBlackjackTable).toHaveBeenCalledWith('table-1', 'warrior');
    expect(wrapper.text()).toContain('500');
  });

  it('does not join a table when no table is provided', async () => {
    mountTable({ table: null });
    await flushPromises();

    expect(wsService.joinBlackjackTable).not.toHaveBeenCalled();
  });

  it('populates seats and identifies my seat from the joined event', async () => {
    const wrapper = mountTable();
    await flushPromises();

    trigger('blackjack:joined', {
      message: 'ok',
      tableState: {
        players: [
          { userId: 'me', bet: 0, hand: [], isBusted: false, isStanding: false, hasPlacedBet: false },
          { userId: 'other', bet: 10, hand: [], isBusted: false, isStanding: false, hasPlacedBet: true },
        ],
        currentPlayer: null,
        gamePhase: 'betting',
        dealer: {},
      },
    });
    await wrapper.vm.$nextTick();

    const seats = wrapper.findAllComponents(PlayerSeat);
    expect(seats[0].props('seat')).toMatchObject({ userId: 'me', status: 'waiting' });
    expect(seats[0].props('isMe')).toBe(true);
    expect(seats[1].props('seat')).toMatchObject({ userId: 'other', status: 'betting', bet: 10 });
    expect(seats[1].props('isMe')).toBe(false);

    // My seat is waiting to bet -> betting controls should render
    expect(wrapper.findComponent(BettingControls).exists()).toBe(true);
  });

  it('sends a bet over the websocket when placeBet is triggered from BettingControls', async () => {
    const wrapper = mountTable();
    await flushPromises();

    trigger('blackjack:joined', {
      message: 'ok',
      tableState: {
        players: [{ userId: 'me', bet: 0, hand: [], isBusted: false, isStanding: false, hasPlacedBet: false }],
        currentPlayer: null,
        gamePhase: 'betting',
        dealer: {},
      },
    });
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(BettingControls).vm.$emit('placeBet');

    expect(wsService.placeBlackjackBet).toHaveBeenCalledWith('table-1', 10); // default betAmount
  });

  it('deals cards and shows game controls when it becomes my turn', async () => {
    const wrapper = mountTable();
    await flushPromises();

    trigger('blackjack:joined', {
      message: 'ok',
      tableState: {
        players: [{ userId: 'me', bet: 10, hand: [], isBusted: false, isStanding: false, hasPlacedBet: true }],
        currentPlayer: null,
        gamePhase: 'betting',
        dealer: {},
      },
    });
    await wrapper.vm.$nextTick();

    trigger('blackjack:game_started', {
      players: [{ userId: 'me', hand: [{ suit: 'hearts', rank: 'K', value: 10 }, { suit: 'spades', rank: '7', value: 7 }], handValue: 17 }],
      dealerUpCard: { suit: 'clubs', rank: 'A', value: 11 },
      currentPlayer: 'me',
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent(GameControls).exists()).toBe(true);
    expect(wrapper.findComponent(DealerSection).props('dealerHiddenCard')).toBe(true);
  });

  it('hit and stand call the corresponding websocket actions', async () => {
    const wrapper = mountTable();
    await flushPromises();

    trigger('blackjack:joined', {
      message: 'ok',
      tableState: {
        players: [{ userId: 'me', bet: 10, hand: [], isBusted: false, isStanding: false, hasPlacedBet: true }],
        currentPlayer: 'me',
        gamePhase: 'playing',
        dealer: {},
      },
    });
    await wrapper.vm.$nextTick();
    trigger('blackjack:game_started', {
      players: [{ userId: 'me', hand: [{ suit: 'hearts', rank: '9', value: 9 }, { suit: 'spades', rank: '7', value: 7 }], handValue: 16 }],
      dealerUpCard: { suit: 'clubs', rank: '5', value: 5 },
      currentPlayer: 'me',
    });
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(GameControls).vm.$emit('hit');
    expect(wsService.hitBlackjack).toHaveBeenCalledWith('table-1');

    await wrapper.findComponent(GameControls).vm.$emit('stand');
    expect(wsService.standBlackjack).toHaveBeenCalledWith('table-1');
  });

  it('marks a seat as bust when the player busts on hit', async () => {
    const wrapper = mountTable();
    await flushPromises();

    trigger('blackjack:joined', {
      message: 'ok',
      tableState: {
        players: [{ userId: 'other', bet: 10, hand: [], isBusted: false, isStanding: false, hasPlacedBet: true }],
        currentPlayer: 'other',
        gamePhase: 'playing',
        dealer: {},
      },
    });
    await wrapper.vm.$nextTick();

    trigger('blackjack:player_hit', {
      userId: 'other',
      card: { suit: 'diamonds', rank: 'K', value: 10 },
      handValue: 25,
      isBusted: true,
    });
    await wrapper.vm.$nextTick();

    const seat = wrapper.findAllComponents(PlayerSeat)[0];
    expect(seat.props('seat')).toMatchObject({ status: 'bust' });
  });

  it('resolves the round, refreshes balance, and emits balanceChange on game complete', async () => {
    const wrapper = mountTable();
    await flushPromises();

    trigger('blackjack:joined', {
      message: 'ok',
      tableState: {
        players: [{ userId: 'me', bet: 10, hand: [], isBusted: false, isStanding: false, hasPlacedBet: true }],
        currentPlayer: null,
        gamePhase: 'playing',
        dealer: {},
      },
    });
    await wrapper.vm.$nextTick();

    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 520 } as any);

    trigger('blackjack:game_complete', {
      dealerHand: [{ suit: 'hearts', rank: 'K', value: 10 }, { suit: 'spades', rank: '9', value: 9 }],
      dealerValue: 19,
      results: [{ userId: 'me', outcome: 'win', payout: 20 }],
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain('520'));

    expect(wrapper.emitted('balanceChange')).toBeTruthy();
    const seat = wrapper.findAllComponents(PlayerSeat)[0];
    expect(seat.props('seat')).toMatchObject({ status: 'won', payout: 20 });
  });

  it('shows an alert and clears isProcessing on a server error', async () => {
    const wrapper = mountTable();
    await flushPromises();

    trigger('error', { message: 'Table is full' });
    await wrapper.vm.$nextTick();

    expect(window.alert).toHaveBeenCalledWith('Table is full');
  });

  it('unregisters listeners and leaves the table on unmount', async () => {
    const wrapper = mountTable();
    await flushPromises();

    wrapper.unmount();

    expect(wsService.leaveBlackjackTable).toHaveBeenCalledWith('table-1');
    expect(wsService.off).toHaveBeenCalledWith('blackjack:joined', expect.any(Function));
    expect(wsService.off).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('emits leave when the lobby button is clicked', async () => {
    const wrapper = mountTable();
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('leave')).toBeTruthy();
  });
});
