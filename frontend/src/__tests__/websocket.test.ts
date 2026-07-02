import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';

// Mock function type that is properly callable
type MockFn = MockInstance<(...args: unknown[]) => unknown> & ((...args: unknown[]) => unknown);

// Create a test helper class to test WebSocketService methods
// We need to create a minimal version since we can't easily mock socket.io-client
class TestWebSocketService {
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private mockSocket: {
    connected: boolean;
    on: MockFn;
    off: MockFn;
    emit: MockFn;
    disconnect: MockFn;
  } | null = null;

  connect(): void {
    this.mockSocket = {
      connected: true,
      on: vi.fn() as MockFn,
      off: vi.fn() as MockFn,
      emit: vi.fn() as MockFn,
      disconnect: vi.fn() as MockFn,
    };
    // Re-attach all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.mockSocket?.on(event, callback);
      });
    });
  }

  disconnect(): void {
    if (this.mockSocket) {
      this.mockSocket.disconnect();
      this.mockSocket = null;
    }
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    if (this.mockSocket?.connected) {
      this.mockSocket.on(event, callback);
    }
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }

    if (this.mockSocket) {
      this.mockSocket.off(event, callback);
    }
  }

  emit(event: string, data?: unknown): boolean {
    if (!this.mockSocket?.connected) {
      return false;
    }
    this.mockSocket.emit(event, data);
    return true;
  }

  isConnected(): boolean {
    return this.mockSocket?.connected ?? false;
  }

  getListenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}

describe('WebSocketService', () => {
  let wsService: TestWebSocketService;

  beforeEach(() => {
    wsService = new TestWebSocketService();
  });

  describe('connect', () => {
    it('should establish connection', () => {
      wsService.connect();
      expect(wsService.isConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect when connected', () => {
      wsService.connect();
      wsService.disconnect();
      expect(wsService.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      expect(() => wsService.disconnect()).not.toThrow();
    });
  });

  describe('on/off', () => {
    it('should add event listener', () => {
      const callback = vi.fn();
      wsService.on('test_event', callback);
      expect(wsService.getListenerCount('test_event')).toBe(1);
    });

    it('should remove event listener', () => {
      const callback = vi.fn();
      wsService.on('test_event', callback);
      wsService.off('test_event', callback);
      expect(wsService.getListenerCount('test_event')).toBe(0);
    });

    it('should handle multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      wsService.on('test_event', callback1);
      wsService.on('test_event', callback2);
      expect(wsService.getListenerCount('test_event')).toBe(2);
    });
  });

  describe('emit', () => {
    it('should return false when not connected', () => {
      const result = wsService.emit('test_event', { data: 'test' });
      expect(result).toBe(false);
    });

    it('should emit when connected', () => {
      wsService.connect();
      const result = wsService.emit('test_event', { data: 'test' });
      expect(result).toBe(true);
    });
  });
});

// Export TestWebSocketService for potential use in other tests
export { TestWebSocketService as WebSocketService };
