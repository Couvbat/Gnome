import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, VueWrapper } from '@vue/test-utils';

/**
 * End-to-end user-journey tests for the Discord Activity frontend.
 *
 * The full real component tree is mounted (App.vue downwards, no stubs) with
 * only the three service boundaries replaced: the REST client is a stateful
 * in-memory backend (see ./fake-backend), the websocket service records
 * emissions and lets tests play the server's role via __trigger, and the
 * Discord SDK reports "local browser dev mode" so App takes the devLogin path.
 *
 * Together the tests walk the complete player journey:
 *   first login → character creation → lobby → each casino game →
 *   XP/leveling/energy progression → session expiry and recovery.
 */

vi.mock('../../services/api', async () => (await import('./fake-backend')).apiModuleMock);
vi.mock('../../services/websocket', async () => (await import('./fake-backend')).wsModuleMock);
vi.mock('../../services/discordSdk', async () => (await import('./fake-backend')).discordModuleMock);

import App from '../../App.vue';
import CharacterCreation from '../../components/CharacterCreation.vue';
import CasinoLobby from '../../components/CasinoLobby.vue';
import SlotMachine from '../../components/games/SlotMachine.vue';
import DiceGame from '../../components/games/DiceGame.vue';
import BlackjackTable from '../../components/games/BlackjackTable.vue';
import RouletteWheel from '../../components/games/RouletteWheel.vue';
import {
  state,
  resetBackend,
  authExpired,
  fakeApiService,
  fakeWsService,
  fakeDiscordSdk,
} from './fake-backend';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let wrapper: VueWrapper | null = null;

function buttonByText(text: string | RegExp) {
  const match = wrapper!
    .findAll('button')
    .find((b) => (typeof text === 'string' ? b.text().includes(text) : text.test(b.text())));
  if (!match) throw new Error(`Button matching ${text} not found`);
  return match;
}

async function clickButton(text: string | RegExp) {
  await buttonByText(text).trigger('click');
  await flushPromises();
}

/** Simulate a server-sent websocket event and let the UI settle */
async function serverEvent(event: string, ...args: unknown[]) {
  fakeWsService.__trigger(event, ...args);
  await flushPromises();
}

async function bootApp() {
  wrapper = mount(App);
  await flushPromises();
  return wrapper;
}

/** Boot as a returning player who already has a character */
async function bootWithCharacter(className = 'warrior', name = 'GnomeSlayer') {
  state.characterName = name;
  state.characterClass = className;
  return bootApp();
}

async function fillCharacterForm(name: string, classLabel: string) {
  await wrapper!.find('#character-name').setValue(name);
  await clickButton(classLabel);
}

/**
 * Drive the slot machine / dice reel animation: both run a 100ms setInterval
 * (15 and 10 ticks respectively) before firing the real backend call.
 */
async function runGameAnimation(startButton: string | RegExp) {
  vi.useFakeTimers();
  await buttonByText(startButton).trigger('click');
  await vi.advanceTimersByTimeAsync(1600);
  vi.useRealTimers();
  await flushPromises();
}

const card = (rank: string, suit: string, value: number) => ({ rank, suit, value });

beforeEach(() => {
  resetBackend();
  vi.stubGlobal('alert', vi.fn());
  window.history.replaceState({}, '', '/');

  // setup.ts replaces localStorage with bare vi.fn()s; make it behave like
  // real storage for the auth token so App can read back what devLogin stored.
  let storedToken: string | null = null;
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => {
    if (key === 'authToken') storedToken = value;
  });
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) =>
    key === 'authToken' ? storedToken : null
  );
  vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => {
    if (key === 'authToken') storedToken = null;
  });
});

afterEach(() => {
  vi.useRealTimers();
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. First login
// ---------------------------------------------------------------------------

describe('first login', () => {
  it('logs in via devLogin and lands on character creation for a brand-new player', async () => {
    await bootApp();

    expect(fakeApiService.devLogin).toHaveBeenCalledWith('Demo User');
    expect(state.devLoginCount).toBe(1);
    expect(wrapper!.findComponent(CharacterCreation).exists()).toBe(true);
    expect(wrapper!.text()).toContain('Création de Personnage');
    // No character yet: the casino must stay closed and the socket offline
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(false);
    expect(fakeWsService.connect).not.toHaveBeenCalled();
  });

  it('sends a returning player straight to the casino lobby and connects the websocket', async () => {
    await bootWithCharacter();

    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(true);
    expect(wrapper!.text()).toContain('Jeux de Casino');
    expect(wrapper!.text()).toContain('GnomeSlayer');
    expect(fakeWsService.connect).toHaveBeenCalledWith('dev-token-1');
  });

  it('shows an initialization error when the backend is unreachable', async () => {
    state.failDevLogin = true;

    await bootApp();

    expect(wrapper!.text()).toContain("Erreur lors de l'initialisation");
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Character creation
// ---------------------------------------------------------------------------

describe('character creation', () => {
  it('keeps the create button disabled until a name and class are chosen', async () => {
    await bootApp();

    const createButton = () => buttonByText('Créer mon personnage');
    expect(createButton().attributes('disabled')).toBeDefined();

    await wrapper!.find('#character-name').setValue('GnomeSlayer');
    expect(createButton().attributes('disabled')).toBeDefined();

    await clickButton('Guerrier');
    expect(createButton().attributes('disabled')).toBeUndefined();
  });

  it('creates the character and enters the casino with the new hero at level 1', async () => {
    await bootApp();

    await fillCharacterForm('GnomeSlayer', 'Guerrier');
    await clickButton('Créer mon personnage');
    await flushPromises();

    expect(fakeApiService.createCharacter).toHaveBeenCalledWith({ name: 'GnomeSlayer', class: 'warrior' });
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(true);
    const character = wrapper!.findComponent(CasinoLobby).props('character') as { name: string; level: number };
    expect(character.name).toBe('GnomeSlayer');
    expect(character.level).toBe(1);
    // The websocket comes online only once a character exists
    expect(fakeWsService.connect).toHaveBeenCalledWith('dev-token-1');
    // Starting balance from the shared economy is displayed
    expect(wrapper!.text()).toContain('1000');
  });

  it('surfaces a creation error and stays on the form when the API rejects', async () => {
    state.failCreateCharacter = true;
    await bootApp();

    await fillCharacterForm('GnomeSlayer', 'Mage');
    await clickButton('Créer mon personnage');
    await flushPromises();

    expect(wrapper!.text()).toContain('Erreur lors de la création du personnage');
    expect(wrapper!.findComponent(CharacterCreation).exists()).toBe(true);
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Slots journey
// ---------------------------------------------------------------------------

describe('slot machine journey', () => {
  it('plays a winning spin: balance, XP and result banner all update', async () => {
    state.slotsOutcomes.push({ outcome: 'win', payoutMultiplier: 4, xpGained: 25 });
    await bootWithCharacter();

    await clickButton('Machines à Sous');
    expect(wrapper!.findComponent(SlotMachine).exists()).toBe(true);

    await runGameAnimation('TOURNER');

    // 1000 - 10 (bet) + 40 (payout) = 1030
    expect(fakeApiService.spinSlots).toHaveBeenCalledWith(10, 'dragon');
    expect(state.coins).toBe(1030);
    expect(wrapper!.text()).toContain('Gagné! +40');
    expect(wrapper!.text()).toContain('+25 XP');
    expect(wrapper!.text()).toContain('Solde: 1030');
  });

  it('plays a losing spin and reflects the reduced balance back in the lobby', async () => {
    await bootWithCharacter();

    await clickButton('Machines à Sous');
    await runGameAnimation('TOURNER');

    expect(state.coins).toBe(990);
    expect(wrapper!.text()).toContain('Perdu!');

    await clickButton('← Retour au lobby');
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(true);
    expect(wrapper!.findComponent(CasinoLobby).props('userCoins')).toBe(990);
  });

  it('blocks spinning when the balance cannot cover the minimum bet', async () => {
    state.coins = 5;
    await bootWithCharacter();

    await clickButton('Machines à Sous');

    const spinButton = buttonByText('FONDS INSUFFISANTS');
    expect(spinButton.attributes('disabled')).toBeDefined();
    expect(fakeApiService.spinSlots).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Dice journey
// ---------------------------------------------------------------------------

describe('dice journey', () => {
  it('requires picking a prediction before the dice can be rolled', async () => {
    await bootWithCharacter();
    await clickButton('Dés');
    expect(wrapper!.findComponent(DiceGame).exists()).toBe(true);

    expect(buttonByText('CHOISISSEZ UNE PRÉDICTION').attributes('disabled')).toBeDefined();
  });

  it('rolls a winning exact prediction and pays the multiplier', async () => {
    state.diceOutcomes.push({ outcome: 'win', payoutMultiplier: 6, xpGained: 30 });
    await bootWithCharacter();

    await clickButton('Dés');
    await clickButton(/^7x/); // predict a total of 7
    await runGameAnimation('LANCER LES DÉS');

    expect(fakeApiService.rollDice).toHaveBeenCalledWith(10, 7);
    // 1000 - 10 + 60 = 1050
    expect(state.coins).toBe(1050);
    expect(wrapper!.text()).toContain('Gagné! +60');
    expect(wrapper!.text()).toContain('+30 XP');
  });

  it('rolls a losing prediction and shows the actual total', async () => {
    await bootWithCharacter();

    await clickButton('Dés');
    await clickButton(/^7x/);
    await runGameAnimation('LANCER LES DÉS');

    expect(state.coins).toBe(990);
    expect(wrapper!.text()).toContain('Perdu! Le total était 9');
  });
});

// ---------------------------------------------------------------------------
// 5. Leveling and energy progression
// ---------------------------------------------------------------------------

describe('leveling and energy progression', () => {
  it('levels the character up once accumulated game XP crosses the threshold', async () => {
    // Two wins x 60 XP = 120 XP -> level 2 (100 XP per level)
    state.slotsOutcomes.push(
      { outcome: 'win', payoutMultiplier: 4, xpGained: 60 },
      { outcome: 'win', payoutMultiplier: 4, xpGained: 60 }
    );
    await bootWithCharacter();
    expect((wrapper!.findComponent(CasinoLobby).props('character') as { level: number }).level).toBe(1);

    await clickButton('Machines à Sous');
    await runGameAnimation('TOURNER');
    await runGameAnimation('TOURNER');
    await clickButton('← Retour au lobby');

    expect(state.characterXp).toBe(120);
    expect((wrapper!.findComponent(CasinoLobby).props('character') as { level: number }).level).toBe(2);
  });

  it('drains energy with each game and reflects it in the lobby display', async () => {
    await bootWithCharacter();
    expect(wrapper!.text()).toContain('100/100');

    await clickButton('Machines à Sous');
    await runGameAnimation('TOURNER');
    await clickButton('← Retour au lobby');

    expect(state.energy.current).toBe(95);
    expect(wrapper!.text()).toContain('95/100');
  });
});

// ---------------------------------------------------------------------------
// 6. Multiplayer blackjack over websocket
// ---------------------------------------------------------------------------

describe('multiplayer blackjack journey', () => {
  async function sitAtBlackjackTable() {
    await bootWithCharacter('warrior');
    await clickButton('Blackjack');
    expect(wrapper!.findComponent(BlackjackTable).exists()).toBe(true);

    // No free table existed, so the lobby created one and the game joined it
    expect(fakeApiService.createBlackjackTable).toHaveBeenCalled();
    expect(fakeWsService.joinBlackjackTable).toHaveBeenCalledWith('bj-table-1', 'warrior');

    await serverEvent('blackjack:joined', {
      message: 'joined',
      tableState: {
        players: [
          { userId: 'me', characterClass: 'warrior', bet: 0, hand: [], handValue: 0, isStanding: false, isBusted: false, hasPlacedBet: false },
        ],
        currentPlayer: null,
        gamePhase: 'betting',
        dealer: { upCard: null, hand: [] },
      },
    });
  }

  it('joins a table, bets, plays a hand to victory and updates the balance', async () => {
    await sitAtBlackjackTable();

    // Betting phase: my seat shows the betting controls
    expect(wrapper!.text()).toContain('Placer votre mise');
    await clickButton('Miser 10 pièces');
    expect(fakeWsService.placeBlackjackBet).toHaveBeenCalledWith('bj-table-1', 10);

    // Server charges the stake and confirms
    state.coins -= 10;
    await serverEvent('blackjack:bet_placed', { userId: 'me', betAmount: 10 });
    await serverEvent('blackjack:bet_confirmed', {});

    // Cards are dealt and it is my turn
    await serverEvent('blackjack:game_started', {
      players: [{ userId: 'me', hand: [card('K', 'hearts', 10), card('9', 'spades', 9)], handValue: 19 }],
      dealerUpCard: card('7', 'clubs', 7),
      currentPlayer: 'me',
    });
    expect(wrapper!.text()).toContain('Votre tour');

    await clickButton('Rester');
    expect(fakeWsService.standBlackjack).toHaveBeenCalledWith('bj-table-1');
    await serverEvent('blackjack:stand_confirmed', {});
    await serverEvent('blackjack:player_stand', { userId: 'me' });

    // Dealer finishes with 17: I win, the server settles 2x the stake
    await serverEvent('blackjack:dealer_reveal', {
      dealerHand: [card('7', 'clubs', 7), card('K', 'diamonds', 10)],
      dealerValue: 17,
    });
    state.coins += 20;
    await serverEvent('blackjack:game_complete', {
      dealerHand: [card('7', 'clubs', 7), card('K', 'diamonds', 10)],
      dealerValue: 17,
      results: [{ userId: 'me', outcome: 'win', payout: 20 }],
    });

    expect(wrapper!.text()).toContain('Nouvelle partie dans quelques secondes');
    // 1000 - 10 + 20 = 1010, refetched after game completion
    expect(wrapper!.text()).toContain('1010');
  });

  /** Place the stake and let the server deal the opening hand */
  async function betAndStart(hand: Array<ReturnType<typeof card>>, handValue: number, currentPlayer = 'me') {
    await clickButton('Miser 10 pièces');
    state.coins -= 10; // server charges the stake at bet time
    await serverEvent('blackjack:bet_placed', { userId: 'me', betAmount: 10 });
    await serverEvent('blackjack:bet_confirmed', {});
    await serverEvent('blackjack:game_started', {
      players: [{ userId: 'me', hand, handValue }],
      dealerUpCard: card('7', 'clubs', 7),
      currentPlayer,
    });
  }

  it('hits into a bust and settles the hand as a loss', async () => {
    await sitAtBlackjackTable();
    await betAndStart([card('8', 'hearts', 8), card('5', 'spades', 5)], 13);

    await clickButton('Tirer');
    expect(fakeWsService.hitBlackjack).toHaveBeenCalledWith('bj-table-1');

    // The drawn king busts the hand at 23
    await serverEvent('blackjack:hit_result', { card: card('K', 'diamonds', 10), handValue: 23, isBusted: true });
    await serverEvent('blackjack:player_hit', { userId: 'me', card: card('K', 'diamonds', 10), handValue: 23, isBusted: true });
    expect(wrapper!.text()).toContain('💥 BUST');

    await serverEvent('blackjack:game_complete', {
      dealerHand: [card('7', 'clubs', 7), card('10', 'hearts', 10)],
      dealerValue: 17,
      results: [{ userId: 'me', outcome: 'loss', payout: 0 }],
    });

    expect(wrapper!.text()).toContain('❌ -10');
    // The stake stays lost: 1000 - 10
    expect(wrapper!.text()).toContain('990');
  });

  it('returns the stake on a push against the dealer', async () => {
    await sitAtBlackjackTable();
    await betAndStart([card('K', 'hearts', 10), card('Q', 'spades', 10)], 20);

    await clickButton('Rester');
    await serverEvent('blackjack:stand_confirmed', {});
    await serverEvent('blackjack:player_stand', { userId: 'me' });

    state.coins += 10; // server returns the stake on a push
    await serverEvent('blackjack:game_complete', {
      dealerHand: [card('K', 'clubs', 10), card('J', 'hearts', 10)],
      dealerValue: 20,
      results: [{ userId: 'me', outcome: 'push', payout: 10 }],
    });

    expect(wrapper!.text()).toContain('🤝 Push');
    expect(wrapper!.text()).toContain('1000');
  });

  it('plays at a shared table: waits for the rival turn, then takes over when it changes', async () => {
    await bootWithCharacter('warrior');
    await clickButton('Blackjack');

    await serverEvent('blackjack:joined', {
      message: 'joined',
      tableState: {
        players: [
          { userId: 'rival', characterClass: 'mage', bet: 20, hand: [], handValue: 0, isStanding: false, isBusted: false, hasPlacedBet: true },
          { userId: 'me', characterClass: 'warrior', bet: 0, hand: [], handValue: 0, isStanding: false, isBusted: false, hasPlacedBet: false },
        ],
        currentPlayer: null,
        gamePhase: 'betting',
        dealer: { upCard: null, hand: [] },
      },
    });
    // The rival occupies a visible seat with their stake
    expect(wrapper!.text()).toContain('rival');
    expect(wrapper!.text()).toContain('20💰');

    await clickButton('Miser 10 pièces');
    await serverEvent('blackjack:bet_placed', { userId: 'me', betAmount: 10 });
    await serverEvent('blackjack:bet_confirmed', {});

    await serverEvent('blackjack:game_started', {
      players: [
        { userId: 'rival', hand: [card('9', 'hearts', 9), card('9', 'clubs', 9)], handValue: 18 },
        { userId: 'me', hand: [card('K', 'hearts', 10), card('9', 'spades', 9)], handValue: 19 },
      ],
      dealerUpCard: card('7', 'clubs', 7),
      currentPlayer: 'rival',
    });
    // Not my turn yet: action buttons are withheld
    expect(wrapper!.text()).toContain("En attente du tour d'un autre joueur");

    await serverEvent('blackjack:player_stand', { userId: 'rival' });
    await serverEvent('blackjack:turn_changed', { currentPlayer: 'me' });
    expect(wrapper!.text()).toContain('Votre tour');

    // The rival disconnects: their seat frees up
    await serverEvent('blackjack:player_left', { userId: 'rival' });
    expect(wrapper!.text()).not.toContain('rival');
    expect(wrapper!.text()).toContain('Place libre');
  });

  it('resets the table for the next round after a finished hand', async () => {
    await sitAtBlackjackTable();
    await betAndStart([card('K', 'hearts', 10), card('9', 'spades', 9)], 19);

    await clickButton('Rester');
    await serverEvent('blackjack:stand_confirmed', {});
    await serverEvent('blackjack:player_stand', { userId: 'me' });
    state.coins += 20;
    await serverEvent('blackjack:game_complete', {
      dealerHand: [card('7', 'clubs', 7), card('K', 'diamonds', 10)],
      dealerValue: 17,
      results: [{ userId: 'me', outcome: 'win', payout: 20 }],
    });
    expect(wrapper!.text()).toContain('✅ +20');

    await serverEvent('blackjack:new_round', {});

    // Fresh betting phase: result badges cleared, betting controls back
    expect(wrapper!.text()).not.toContain('✅ +20');
    expect(wrapper!.text()).toContain('Placer votre mise');
  });

  it('surfaces server rejections through an alert and re-enables the controls', async () => {
    await sitAtBlackjackTable();

    await clickButton('Miser 10 pièces');
    await serverEvent('error', { message: 'Insufficient balance' });

    expect(window.alert).toHaveBeenCalledWith('Insufficient balance');
    // Controls are usable again: the bet can be retried
    expect(buttonByText('Miser 10 pièces').attributes('disabled')).toBeUndefined();
  });

  it('leaves the table cleanly and returns to the lobby', async () => {
    await sitAtBlackjackTable();

    await clickButton('← Lobby');

    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(true);
    expect(fakeWsService.leaveBlackjackTable).toHaveBeenCalledWith('bj-table-1');
  });
});

// ---------------------------------------------------------------------------
// 7. Multiplayer roulette over websocket
// ---------------------------------------------------------------------------

describe('multiplayer roulette journey', () => {
  it('joins a table, bets on red, and celebrates the win when the wheel agrees', async () => {
    await bootWithCharacter();
    await clickButton('Roulette');
    expect(wrapper!.findComponent(RouletteWheel).exists()).toBe(true);
    expect(fakeWsService.joinRouletteTable).toHaveBeenCalledWith('rl-table-1');

    await serverEvent('roulette:betting_opened', { timeRemaining: 30 });
    expect(wrapper!.text()).toContain('Paris ouverts');

    await clickButton('Rouge (x2)');
    expect(fakeWsService.placeRouletteBet).toHaveBeenCalledWith('rl-table-1', [{ type: 'red', amount: 10 }]);
    await serverEvent('roulette:bet_placed', {});

    // Server charges the stake at bet time, then spins
    state.coins -= 10;
    await serverEvent('roulette:betting_closed', {});
    await serverEvent('roulette:spin_started', {});
    expect(wrapper!.text()).toContain('La roue tourne');

    state.coins += 20;
    await serverEvent('roulette:spin_result', {
      number: 1,
      color: 'red',
      winners: [{ userId: 'me', payout: 20 }],
      totalPayouts: 20,
    });

    expect(wrapper!.text()).toContain('Gagné 20 pièces');
    expect(wrapper!.text()).toContain('1010');
  });

  it('reports the loss when the wheel lands elsewhere', async () => {
    await bootWithCharacter();
    await clickButton('Roulette');

    await serverEvent('roulette:betting_opened', { timeRemaining: 30 });
    await clickButton('Noir (x2)');
    await serverEvent('roulette:bet_placed', {});

    state.coins -= 10;
    await serverEvent('roulette:betting_closed', {});
    await serverEvent('roulette:spin_started', {});
    await serverEvent('roulette:spin_result', { number: 1, color: 'red', winners: [], totalPayouts: 0 });

    expect(wrapper!.text()).toContain('Perdu 10 pièces');
    expect(wrapper!.text()).toContain('990');
  });

  /** Exact-match lookup for the number cells on the betting grid */
  function numberCell(num: number) {
    const match = wrapper!.findAll('button').find((b) => b.text().trim() === String(num));
    if (!match) throw new Error(`Roulette number cell ${num} not found`);
    return match;
  }

  async function openRouletteTable() {
    await bootWithCharacter();
    await clickButton('Roulette');
    await serverEvent('roulette:betting_opened', { timeRemaining: 30 });
  }

  it('accumulates straight number bets from the grid, re-sending the full bet list', async () => {
    await openRouletteTable();

    await numberCell(7).trigger('click');
    await flushPromises();
    expect(fakeWsService.placeRouletteBet).toHaveBeenLastCalledWith('rl-table-1', [
      { type: 'straight', value: 7, amount: 10 },
    ]);
    await serverEvent('roulette:bet_placed', {});

    await numberCell(17).trigger('click');
    await flushPromises();
    // The manager replaces the whole bet list on every call, so the client
    // must send the full current set - not just the increment
    expect(fakeWsService.placeRouletteBet).toHaveBeenLastCalledWith('rl-table-1', [
      { type: 'straight', value: 7, amount: 10 },
      { type: 'straight', value: 17, amount: 10 },
    ]);
    await serverEvent('roulette:bet_placed', {});

    expect(wrapper!.text()).toContain('#7: 10💰');
    expect(wrapper!.text()).toContain('#17: 10💰');
    expect(wrapper!.text()).toContain('Total des paris: 20');
  });

  it('clears all placed bets with the Effacer button', async () => {
    await openRouletteTable();

    await numberCell(7).trigger('click');
    await flushPromises();
    await serverEvent('roulette:bet_placed', {});
    expect(wrapper!.text()).toContain('#7: 10💰');

    await clickButton('Effacer');

    expect(fakeWsService.placeRouletteBet).toHaveBeenLastCalledWith('rl-table-1', []);
    expect(wrapper!.text()).not.toContain('#7: 10💰');
    expect(wrapper!.text()).toContain('Total des paris: 0');
  });

  it('rolls an optimistically-shown bet back when the server rejects it', async () => {
    await openRouletteTable();

    // The bet renders immediately, before any server confirmation
    await clickButton('Rouge (x2)');
    expect(wrapper!.text()).toContain('Rouge: 10💰');

    // Server rejects (e.g. insufficient balance): the phantom bet must vanish
    await serverEvent('error', { message: 'Insufficient balance' });

    expect(window.alert).toHaveBeenCalledWith('Insufficient balance');
    expect(wrapper!.text()).not.toContain('Rouge: 10💰');
    expect(wrapper!.text()).toContain('Total des paris: 0');
  });

  it('shows the other players at the table and their wagers', async () => {
    await openRouletteTable();

    await serverEvent('roulette:player_bet', {
      userId: 'rival',
      bets: [{ type: 'red', amount: 50 }],
      totalWagered: 50,
    });

    expect(wrapper!.text()).toContain('Joueurs à la table (1)');
    expect(wrapper!.text()).toContain('rival');
    expect(wrapper!.text()).toContain('50💰');

    // They leave: the roster empties
    await serverEvent('table:player_left', { userId: 'rival' });
    expect(wrapper!.text()).not.toContain('Joueurs à la table');
  });

  it('counts down the closing warning and starts a fresh round after the payout', async () => {
    await openRouletteTable();

    await clickButton('Rouge (x2)');
    await serverEvent('roulette:bet_placed', {});

    // 5-second warning before the wheel spins
    await serverEvent('roulette:betting_closing', { countdown: 5 });
    expect(wrapper!.text()).toContain('5s restantes');

    state.coins -= 10;
    await serverEvent('roulette:betting_closed', {});
    await serverEvent('roulette:spin_started', {});
    state.coins += 20;
    await serverEvent('roulette:spin_result', {
      number: 1,
      color: 'red',
      winners: [{ userId: 'me', payout: 20 }],
      totalPayouts: 20,
    });
    expect(wrapper!.text()).toContain('Gagné 20 pièces');

    // Next round opens: previous bets and results are wiped
    await serverEvent('roulette:betting_opened', { timeRemaining: 30 });

    expect(wrapper!.text()).toContain('Paris ouverts');
    expect(wrapper!.text()).not.toContain('Gagné 20 pièces');
    expect(wrapper!.text()).toContain('Total des paris: 0');
  });
});

// ---------------------------------------------------------------------------
// 8. Session expiry and recovery
// ---------------------------------------------------------------------------

describe('session expiry', () => {
  it('re-authenticates automatically and restores the lobby after a 401', async () => {
    await bootWithCharacter();
    expect(state.devLoginCount).toBe(1);

    authExpired.value = true;
    await flushPromises();
    await flushPromises();

    expect(fakeWsService.disconnect).toHaveBeenCalled();
    expect(state.devLoginCount).toBe(2);
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(true);
  });

  it('gives up after a failed retry instead of looping on re-authentication', async () => {
    await bootWithCharacter();

    // The retried session immediately 401s again: automatic recovery must
    // stop after one attempt instead of looping forever.
    state.expireSessionOnNextUserFetch = true;
    authExpired.value = true;
    await flushPromises();
    await flushPromises();
    await flushPromises();

    // Exactly one automatic retry happened, an error is displayed, and the
    // casino stays closed.
    expect(state.devLoginCount).toBe(2);
    expect(wrapper!.text()).toContain('Erreur');
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(false);

    // A further 401 signal is met with the "please reload" stop message, not
    // yet another automatic re-authentication.
    authExpired.value = true;
    await flushPromises();
    await flushPromises();

    expect(wrapper!.text()).toContain("Veuillez recharger l'application");
    expect(state.devLoginCount).toBe(2);
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Discord Activity boot path
// ---------------------------------------------------------------------------

describe('discord activity login', () => {
  it('boots through the Discord OAuth session instead of devLogin when framed', async () => {
    window.history.replaceState({}, '', '/?frame_id=abc123');
    fakeDiscordSdk.isRunningInDiscordActivity.mockReturnValue(true);
    fakeDiscordSdk.getAuthToken.mockReturnValue('discord-jwt' as never);
    state.characterName = 'GnomeSlayer';
    state.characterClass = 'bard';

    await bootApp();

    expect(fakeApiService.devLogin).not.toHaveBeenCalled();
    expect(fakeWsService.connect).toHaveBeenCalledWith('discord-jwt');
    expect(wrapper!.findComponent(CasinoLobby).exists()).toBe(true);
  });
});
