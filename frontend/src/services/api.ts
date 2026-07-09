import axios, { AxiosInstance } from 'axios';
import { ref } from 'vue';
import {
  Character,
  User,
  GameTable,
  SlotsSpinResponse,
  DiceRollResponse,
  DiceInfoResponse
} from '../types';

function generateTableId(gameType: 'blackjack' | 'roulette'): string {
  return `${gameType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Reactive "auth expired" signal, flipped by the 401 response interceptor
// below. App.vue watches this to react (surface a re-login prompt) instead of
// requests failing silently once the stored token goes stale/invalid.
export const authExpired = ref(false);

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token interceptor
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Global 401 handling: clear the stale token and flag auth as expired so
    // the app shell can prompt for re-login instead of every subsequent call
    // failing silently.
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('authToken');
          authExpired.value = true;
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints - the real login path is the Discord SDK flow in
  // discordSdk.ts (POST /api/auth/discord); devLogin is the browser-only
  // fallback and 403s in production.
  async devLogin(username = 'Demo User'): Promise<{ token: string; user: User }> {
    const response = await this.client.post('/auth/dev', { username });
    if (response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get('/auth/me');
    return response.data.user;
  }

  // Character endpoints
  async createCharacter(data: {
    name: string;
    class: string;
  }): Promise<Character> {
    const response = await this.client.post('/characters/create', {
      name: data.name,
      className: data.class
    });
    return response.data.character;
  }

  // Renamed from getCharacter(userId) - it always hit /characters/me and
  // silently ignored whatever id was passed in. The backend has no endpoint
  // to fetch another user's character (backend/src/routes/characters.ts only
  // exposes /me for the authenticated user), so this honestly reflects what
  // it does instead of pretending to take a meaningful argument.
  async getMyCharacter(): Promise<Character | null> {
    try {
      const response = await this.client.get('/characters/me');
      if (response.data.hasCharacter) {
        return response.data.character;
      }
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteCharacter(): Promise<void> {
    await this.client.delete('/characters/me');
  }

  // Casino endpoints - multiplayer tables (see backend/src/routes/casino.ts
  // "MULTIPLAYER TABLES" section). Joining/leaving and gameplay actions
  // (bet/hit/stand/spin) happen over WebSocket - see services/websocket.ts.
  async getActiveTables(gameType: 'blackjack' | 'roulette'): Promise<GameTable[]> {
    const response = await this.client.get(`/casino/tables/${gameType}`);
    return response.data.tables.map((t: any) => ({
      id: t.tableId,
      gameType,
      playerCount: t.playerCount,
      maxPlayers: gameType === 'blackjack' ? t.maxPlayers : null,
      minBet: t.minBet,
      maxBet: t.maxBet,
      gamePhase: t.gamePhase
    }));
  }

  async createBlackjackTable(minBet: number, maxBet: number, maxPlayers = 6): Promise<GameTable> {
    const tableId = generateTableId('blackjack');
    const response = await this.client.post('/casino/tables/blackjack/create', {
      tableId, minBet, maxBet, maxPlayers
    });
    return {
      id: response.data.tableId,
      gameType: 'blackjack',
      playerCount: 0,
      maxPlayers: response.data.maxPlayers,
      minBet: response.data.minBet,
      maxBet: response.data.maxBet,
      gamePhase: 'betting'
    };
  }

  async createRouletteTable(minBet: number, maxBet: number): Promise<GameTable> {
    const tableId = generateTableId('roulette');
    const response = await this.client.post('/casino/tables/roulette/create', {
      tableId, minBet, maxBet
    });
    return {
      id: response.data.tableId,
      gameType: 'roulette',
      playerCount: 0,
      maxPlayers: null,
      minBet: response.data.minBet,
      maxBet: response.data.maxBet,
      gamePhase: 'waiting'
    };
  }

  // Single-player game endpoints (no tables, immediate play with RPG bonuses)
  async spinSlots(bet: number, machineType: string = 'dragon'): Promise<SlotsSpinResponse> {
    const response = await this.client.post('/games/slots/spin', {
      bet,
      machineType
    });
    return response.data;
  }

  async rollDice(bet: number, prediction: number): Promise<DiceRollResponse> {
    const response = await this.client.post('/games/dice/roll', {
      bet,
      prediction
    });
    return response.data;
  }

  async getDiceInfo(): Promise<DiceInfoResponse> {
    const response = await this.client.get('/games/dice/info');
    return response.data;
  }

  // Note: Single-player blackjack and roulette endpoints also exist at /api/games/*

  // Energy endpoints
  async getEnergy(): Promise<{
    current: number;
    max: number;
    regenRate: number;
    lastRegen: string;
    minutesUntilFull: number;
  }> {
    const response = await this.client.get('/progression/energy');
    return response.data.energy;
  }
}

export const apiService = new ApiService();
