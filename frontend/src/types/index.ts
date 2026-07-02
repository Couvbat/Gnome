// Character Types
export type CharacterClass = 'warrior' | 'mage' | 'rogue' | 'merchant' | 'bard' | 'paladin';

export interface CharacterStats {
  strength: number;
  intelligence: number;
  luck: number;
  charisma: number;
  vitality: number;
  dexterity: number;
}

export interface Character {
  id: string;
  userId?: string;
  name: string;
  className: CharacterClass; // API response uses className (mapped from backend's 'class' field)
  level: number;
  experience: number; // API response uses experience (mapped from backend's 'xp' field)
  stats: CharacterStats;
  energy?: number;
  maxEnergy?: number;
  createdAt?: Date;
  casinoBonus?: {
    luckBonus: number;
    energyBonus: number;
    specialAbility: string;
    description?: string;
  };
}

// Casino Types
export type GameType = 'blackjack' | 'roulette' | 'slots' | 'dice';

export interface GameTable {
  id: string;
  gameType: GameType;
  playerCount: number;
  maxPlayers: number | null; // null for roulette - no player cap on the shared table
  minBet: number;
  maxBet: number;
  gamePhase: string;
}

export interface BlackjackHand {
  cards: string[];
  value: number;
  isBlackjack: boolean;
  isBusted: boolean;
}

export interface BlackjackTable extends GameTable {
  gameType: 'blackjack';
  hands: Map<string, BlackjackHand>;
  dealerHand: BlackjackHand;
  currentPlayer: string | null;
  gamePhase: 'betting' | 'dealing' | 'playing' | 'revealing';
}

export interface RouletteBet {
  type: 'number' | 'color' | 'dozen' | 'column' | 'even-odd' | 'high-low';
  value: number | string;
  amount: number;
}

export interface RouletteTable extends GameTable {
  gameType: 'roulette';
  bets: Map<string, RouletteBet[]>;
  spinTimer: number;
  currentPhase: 'betting' | 'spinning' | 'payouts';
  lastResults: number[];
}

export interface User {
  id: string;
  username: string;
  coins: number;
  level: number;
  experience: number;
  character?: Character;
  // Discord profile data (when running as Discord Activity)
  avatarUrl?: string;
  discordUsername?: string;
  discordGlobalName?: string;
}

// Game Response Types
export interface CharacterBonus {
  luckBonus: number;
  energyBonus: number;
  specialAbility: string;
  className: string;
}

export interface SlotsSpinResponse {
  success: boolean;
  result: {
    reels: string[];
    outcome: 'win' | 'lose' | 'jackpot';
    bet: number;
    payout: number;
    netChange: number;
    winType?: string;
    multiplier?: number;
    xpGained: number;
    specialAbility?: boolean;
    characterBonus?: CharacterBonus;
  };
}

export interface DiceRollResponse {
  success: boolean;
  result: {
    dice: number[];
    total: number;
    prediction: number;
    predictionType: string;
    isCorrect: boolean;
    outcome: 'win' | 'lose';
    bet: number;
    payout: number;
    netChange: number;
    payoutMultiplier: number;
    xpGained: number;
    specialAbility?: boolean;
    characterBonus?: CharacterBonus;
  };
}

export interface DiceInfoResponse {
  success: boolean;
  info: {
    predictions: Array<{
      type: string;
      multiplier: number;
      description: string;
    }>;
  };
}


// WebSocket Events - mirrors backend/src/websocket/socketHandlers.ts and the
// broadcasts made by BlackjackTableManager/RouletteTableManager. Event names
// and payload shapes here must match the server exactly.
export interface BackendCard { suit: string; rank: string; value: number; isAce: boolean }

export interface BlackjackPlayerState {
  userId: string;
  characterClass: string;
  bet: number;
  hand: BackendCard[];
  handValue: number;
  isStanding: boolean;
  isBusted: boolean;
  hasPlacedBet: boolean;
}

export interface BlackjackTableState {
  tableId: string;
  guildId: string;
  gamePhase: 'betting' | 'playing' | 'finished';
  players: BlackjackPlayerState[];
  dealer: { upCard: BackendCard | null; hand: BackendCard[]; handValue: number };
  currentPlayerIndex: number;
  currentPlayer: string | null;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
}

export interface RouletteTableState {
  tableId: string;
  gamePhase: 'waiting' | 'betting' | 'spinning' | 'payouts';
  activePlayers: number;
  betsPlaced: number;
  lastResults: number[];
  minBet: number;
  maxBet: number;
  timeRemaining: number;
}

export interface SocketEvents {
  // Blackjack multiplayer events (backend/src/managers/BlackjackTableManager.ts)
  'blackjack:joined': (data: { message: string; tableState: BlackjackTableState }) => void;
  'blackjack:player_joined': (data: { tableId: string; userId: string; characterClass?: string; playerCount: number; maxPlayers: number }) => void;
  'blackjack:bet_confirmed': (data: { message: string }) => void;
  'blackjack:bet_placed': (data: { tableId: string; userId: string; betAmount: number; playersReady: number; totalPlayers: number }) => void;
  'blackjack:game_started': (data: { tableId: string; players: Array<{ userId: string; hand: BackendCard[]; handValue: number }>; dealerUpCard: BackendCard; currentPlayer: string }) => void;
  'blackjack:turn_warning': (data: { tableId: string; userId: string; secondsRemaining: number }) => void;
  'blackjack:hit_result': (data: { message: string; card: BackendCard; handValue: number; isBusted: boolean }) => void;
  'blackjack:player_hit': (data: { tableId: string; userId: string; card: BackendCard; handValue: number; isBusted: boolean }) => void;
  'blackjack:stand_confirmed': (data: { message: string }) => void;
  'blackjack:player_stand': (data: { tableId: string; userId: string; isTimeout: boolean }) => void;
  'blackjack:turn_changed': (data: { tableId: string; currentPlayer: string; playerIndex: number }) => void;
  'blackjack:dealer_reveal': (data: { tableId: string; dealerHand: BackendCard[]; dealerValue: number }) => void;
  'blackjack:game_complete': (data: {
    tableId: string;
    dealerHand: BackendCard[];
    dealerValue: number;
    dealerBusted: boolean;
    results: Array<{ userId: string; outcome: string; payout: number; netChange: number; handValue: number; characterBonus?: string }>;
  }) => void;
  'blackjack:new_round': (data: { tableId: string; players: Array<{ userId: string; characterClass: string }> }) => void;
  'blackjack:player_left': (data: { tableId: string; userId: string; playerCount: number }) => void;

  // Roulette multiplayer events (backend/src/managers/RouletteTableManager.ts)
  'roulette:table_state': (data: RouletteTableState | null) => void;
  'roulette:player_joined': (data: { userId: string; username: string; playerCount: number }) => void;
  'roulette:bet_placed': (data: { message: string }) => void;
  'roulette:betting_opened': (data: { tableId: string; timeRemaining: number; minBet: number; maxBet: number }) => void;
  'roulette:betting_closing': (data: { tableId: string; countdown: number }) => void;
  'roulette:player_bet': (data: { tableId: string; userId: string; bets: Array<{ type: string; value?: number; amount: number }>; totalWagered: number }) => void;
  'roulette:betting_closed': (data: { tableId: string }) => void;
  'roulette:spin_started': (data: { tableId: string }) => void;
  'roulette:spin_result': (data: { tableId: string; number: number; color: 'red' | 'black' | 'green'; winners: Array<{ userId: string; payout: number; totalWon: number; characterClass?: string }>; totalPayouts: number }) => void;

  // Shared table events
  'table:player_left': (data: { tableId: string; userId: string; gameType?: string }) => void;

  // Bard ability events
  'bard:ability_triggered': (data: { message: string; affectedPlayers: string[] }) => void;
  'bard:harmony_boost_active': (data: { bardUserId: string; bardUsername: string; affectedPlayers: string[]; duration: number }) => void;

  // Error events
  error: (error: { message: string }) => void;
}
