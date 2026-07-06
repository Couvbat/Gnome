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
