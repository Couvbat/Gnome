import { vi } from 'vitest';
import { ref } from 'vue';

/**
 * Stateful in-memory backend for the E2E user-journey suite.
 *
 * Instead of stubbing each API call per test, this module simulates the
 * backend's observable behaviour (balances, XP, leveling, energy) behind the
 * real apiService interface, so a test can walk the entire user journey -
 * login → character creation → games → leveling - and assert that state
 * flows through the UI the way it would against the real server.
 *
 * Level rule mirrors the spirit of the backend CharacterService: every
 * 100 XP grants a level. Games charge the bet, credit the scripted payout,
 * award the scripted XP and drain energy - the same contract as
 * POST /api/games/{slots/spin,dice/roll}.
 */

export const XP_PER_LEVEL = 100;
export const ENERGY_COST_PER_GAME = 5;

export interface ScriptedOutcome {
  outcome: 'win' | 'loss' | 'jackpot';
  /** Total payout credited (stake included), e.g. bet * 4 on a slots win */
  payoutMultiplier: number;
  xpGained: number;
}

interface FakeState {
  loggedIn: boolean;
  devLoginCount: number;
  coins: number;
  characterName: string | null;
  characterClass: string | null;
  characterXp: number;
  energy: { current: number; max: number; regenRate: number };
  /** FIFO scripts consumed by spinSlots / rollDice; defaults to a loss */
  slotsOutcomes: ScriptedOutcome[];
  diceOutcomes: ScriptedOutcome[];
  /** Error injection switches */
  failDevLogin: boolean;
  failCreateCharacter: boolean;
  /** When true, the next getCurrentUser call behaves like a 401: it flips
   *  authExpired (as the real axios interceptor does) and rejects. */
  expireSessionOnNextUserFetch: boolean;
}

const initialState = (): FakeState => ({
  loggedIn: false,
  devLoginCount: 0,
  coins: 1000,
  characterName: null,
  characterClass: null,
  characterXp: 0,
  energy: { current: 100, max: 100, regenRate: 1 },
  slotsOutcomes: [],
  diceOutcomes: [],
  failDevLogin: false,
  failCreateCharacter: false,
  expireSessionOnNextUserFetch: false,
});

export const state: FakeState = initialState();

export function resetBackend(): void {
  Object.assign(state, initialState());
  authExpired.value = false;
  wsListeners.clear();
}

export function characterLevel(): number {
  return 1 + Math.floor(state.characterXp / XP_PER_LEVEL);
}

function currentUser() {
  return {
    id: 'me',
    userId: 'me',
    username: 'Demo User',
    coins: state.coins,
    level: characterLevel(),
    experience: state.characterXp,
  };
}

function currentCharacter() {
  if (!state.characterName || !state.characterClass) return null;
  return {
    id: 'char-1',
    userId: 'me',
    name: state.characterName,
    className: state.characterClass,
    level: characterLevel(),
    experience: state.characterXp,
    stats: { strength: 20, intelligence: 8, luck: 10, charisma: 12, vitality: 18, dexterity: 10 },
    energy: state.energy.current,
    maxEnergy: state.energy.max,
  };
}

function settleGame(bet: number, script: ScriptedOutcome | undefined) {
  if (state.coins < bet) throw new Error('Insufficient balance to place this bet');
  const outcome: ScriptedOutcome = script ?? { outcome: 'loss', payoutMultiplier: 0, xpGained: Math.floor(bet / 10) };
  state.coins -= bet;
  const payout = outcome.outcome === 'loss' ? 0 : bet * outcome.payoutMultiplier;
  state.coins += payout;
  state.characterXp += outcome.xpGained;
  state.energy.current = Math.max(0, state.energy.current - ENERGY_COST_PER_GAME);
  return { outcome: outcome.outcome, payout, netChange: payout - bet, xpGained: outcome.xpGained };
}

// Same reactive 401 signal the real services/api.ts module exports
export const authExpired = ref(false);

export const fakeApiService = {
  devLogin: vi.fn(async (username = 'Demo User') => {
    if (state.failDevLogin) throw new Error('backend unreachable');
    state.devLoginCount += 1;
    state.loggedIn = true;
    const token = `dev-token-${state.devLoginCount}`;
    // The real devLogin persists the token; App later reads it back through
    // localStorage to connect the websocket after character creation.
    window.localStorage.setItem('authToken', token);
    return { token, user: { ...currentUser(), username } };
  }),

  login: vi.fn(async () => ({ token: 'discord-token', user: currentUser() })),

  getCurrentUser: vi.fn(async () => {
    if (state.expireSessionOnNextUserFetch) {
      state.expireSessionOnNextUserFetch = false;
      authExpired.value = true; // what the real 401 interceptor does
      throw new Error('Request failed with status code 401');
    }
    return currentUser();
  }),

  createCharacter: vi.fn(async (data: { name: string; class: string }) => {
    if (state.failCreateCharacter) throw new Error('creation failed');
    state.characterName = data.name;
    state.characterClass = data.class;
    return currentCharacter();
  }),

  getMyCharacter: vi.fn(async () => currentCharacter()),

  deleteCharacter: vi.fn(async () => {
    state.characterName = null;
    state.characterClass = null;
  }),

  updateCharacter: vi.fn(async () => currentCharacter()),

  getActiveTables: vi.fn(async (_gameType: 'blackjack' | 'roulette') => []),

  createBlackjackTable: vi.fn(async (minBet: number, maxBet: number, maxPlayers = 6) => ({
    id: 'bj-table-1',
    gameType: 'blackjack' as const,
    playerCount: 0,
    maxPlayers,
    minBet,
    maxBet,
    gamePhase: 'betting',
  })),

  createRouletteTable: vi.fn(async (minBet: number, maxBet: number) => ({
    id: 'rl-table-1',
    gameType: 'roulette' as const,
    playerCount: 0,
    maxPlayers: null,
    minBet,
    maxBet,
    gamePhase: 'waiting',
  })),

  getGameHistory: vi.fn(async () => []),

  spinSlots: vi.fn(async (bet: number, _machineType = 'dragon') => {
    const settled = settleGame(bet, state.slotsOutcomes.shift());
    const winning = settled.outcome !== 'loss';
    return {
      success: true,
      result: {
        reels: winning ? ['🍒', '🍒', '🍒'] : ['🍒', '🍋', '🍊'],
        outcome: settled.outcome,
        bet,
        payout: settled.payout,
        netChange: settled.netChange,
        winType: winning ? 'three_of_kind' : 'none',
        multiplier: 1,
        xpGained: settled.xpGained,
      },
    };
  }),

  rollDice: vi.fn(async (bet: number, prediction: number) => {
    const settled = settleGame(bet, state.diceOutcomes.shift());
    const winning = settled.outcome !== 'loss';
    // On a scripted win the dice land on the prediction; on a loss they miss it
    const total = winning ? prediction : prediction === 7 ? 9 : 7;
    const die1 = Math.max(1, Math.min(6, total - 1));
    return {
      success: true,
      result: {
        dice: [die1, total - die1],
        total,
        prediction,
        predictionType: 'exact',
        isCorrect: winning,
        outcome: settled.outcome,
        bet,
        payout: settled.payout,
        netChange: settled.netChange,
        payoutMultiplier: winning ? settled.payout / bet : 0,
        xpGained: settled.xpGained,
      },
    };
  }),

  getDiceInfo: vi.fn(async () => ({ success: true, info: { predictionTypes: [], tips: [], characterBonuses: {} } })),

  getEnergy: vi.fn(async () => ({
    current: state.energy.current,
    max: state.energy.max,
    regenRate: state.energy.regenRate,
    lastRegen: new Date().toISOString(),
    minutesUntilFull: Math.max(0, Math.ceil((state.energy.max - state.energy.current) / state.energy.regenRate)),
  })),
};

export const apiModuleMock = { apiService: fakeApiService, authExpired };

// ---------------------------------------------------------------------------
// WebSocket service mock: real listener registry (components register handlers
// with on/off) plus __trigger so tests can play the server's role.
// ---------------------------------------------------------------------------

const wsListeners = new Map<string, Array<(...args: unknown[]) => void>>();

export const fakeWsService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (!wsListeners.has(event)) wsListeners.set(event, []);
    wsListeners.get(event)!.push(cb);
  }),
  off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    const cbs = wsListeners.get(event);
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
  joinRouletteTable: vi.fn(),
  placeRouletteBet: vi.fn(),
  leaveRouletteTable: vi.fn(),
  triggerLuckySong: vi.fn(),
  /** Simulate a server-sent event */
  __trigger: (event: string, ...args: unknown[]) => {
    (wsListeners.get(event) || []).forEach((cb) => cb(...args));
  },
};

export const wsModuleMock = { wsService: fakeWsService };

// ---------------------------------------------------------------------------
// Discord SDK mock: local-browser dev mode (not framed, not an Activity),
// which routes App.vue through the devLogin path.
// ---------------------------------------------------------------------------

export const fakeDiscordSdk = {
  initializeDiscordSdk: vi.fn(async () => true),
  isRunningInDiscordActivity: vi.fn(() => false),
  isDiscordSdkReady: vi.fn(() => false),
  getAuthToken: vi.fn(() => null),
  getCurrentUser: vi.fn(() => null),
  getCurrentChannel: vi.fn(() => null),
  getCurrentGuild: vi.fn(() => null),
  getVoiceParticipants: vi.fn(() => []),
  refreshVoiceParticipants: vi.fn(async () => []),
  openInviteDialog: vi.fn(async () => undefined),
  setActivity: vi.fn(async () => undefined),
  getInstanceId: vi.fn(() => null),
  getChannelId: vi.fn(() => null),
  getGuildId: vi.fn(() => null),
};

export const discordModuleMock = fakeDiscordSdk;
