import axios, { AxiosInstance } from 'axios';
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
  }

  // Auth endpoints
  async login(discordToken: string): Promise<{ token: string; user: User }> {
    const response = await this.client.post('/auth/login', { discordToken });
    return response.data;
  }

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

  async getCharacter(_userId: string): Promise<Character | null> {
    try {
      // Note: userId is accepted for API consistency but we use /me endpoint
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

  async updateCharacter(
    userId: string,
    updates: Partial<Character>
  ): Promise<Character> {
    const response = await this.client.patch(`/characters/${userId}`, updates);
    return response.data;
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

  // Game endpoints (Single-player RPG games)
  async getGameHistory(userId: string, limit = 10): Promise<any[]> {
    const response = await this.client.get(`/games/history/${userId}`, {
      params: { limit },
    });
    return response.data;
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
