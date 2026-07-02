import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '../types';

// Type for socket callback functions
type SocketCallback = (...args: any[]) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, SocketCallback[]> = new Map();

  connect(authToken: string): void {
    if (this.socket?.connected) {
      console.warn('WebSocket already connected');
      return;
    }

    this.socket = io('http://localhost:3001', {
      auth: { token: authToken },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });

    // Re-attach all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event, callback);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on<K extends keyof SocketEvents>(
    event: K,
    callback: SocketEvents[K]
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    if (this.socket?.connected) {
      this.socket.on(event, callback as any);
    }
  }

  off<K extends keyof SocketEvents>(
    event: K,
    callback: SocketEvents[K]
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }

    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      console.error('Cannot emit event: WebSocket not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  // Blackjack multiplayer actions (backend/src/websocket/socketHandlers.ts)
  joinBlackjackTable(tableId: string, characterClass?: string): void {
    this.emit('blackjack:join_table', { tableId, characterClass });
  }

  placeBlackjackBet(tableId: string, betAmount: number): void {
    this.emit('blackjack:place_bet', { tableId, betAmount });
  }

  hitBlackjack(tableId: string): void {
    this.emit('blackjack:hit', { tableId });
  }

  standBlackjack(tableId: string): void {
    this.emit('blackjack:stand', { tableId });
  }

  leaveBlackjackTable(tableId: string): void {
    this.emit('blackjack:leave_table', { tableId });
  }

  // Roulette multiplayer actions
  joinRouletteTable(tableId: string): void {
    this.emit('roulette:join_table', { tableId });
  }

  // RouletteTableManager.placeBet replaces the player's entire bet list on
  // every call - always send the full current set of bets, not an increment.
  placeRouletteBet(tableId: string, bets: Array<{ type: string; value?: number; amount: number }>): void {
    this.emit('roulette:place_bet', { tableId, bet: bets });
  }

  leaveRouletteTable(tableId: string): void {
    this.emit('roulette:leave_table', { tableId });
  }

  // Bard ability
  triggerLuckySong(tableId: string, gameType: 'roulette' | 'blackjack'): void {
    this.emit('bard:trigger_lucky_song', { tableId, gameType });
  }
}

export const wsService = new WebSocketService();
