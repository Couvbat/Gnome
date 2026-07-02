import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { setupSocketHandlers } from '../src/websocket/socketHandlers';
import { RouletteTableManager } from '../src/managers/RouletteTableManager';
import { BlackjackTableManager } from '../src/managers/BlackjackTableManager';
import { BardAbilities } from '../src/services/BardAbilities';

// This suite exercises the real transport layer (auth handshake, event
// routing, room broadcasts) with a live Socket.IO server + client pair.
// The table managers and Bard ability service have their own dedicated
// unit tests, so their business logic is mocked here.
vi.mock('../src/managers/RouletteTableManager');
vi.mock('../src/managers/BlackjackTableManager');
vi.mock('../src/services/BardAbilities');

const jwtSecret = process.env.JWT_SECRET as string;

function signToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    { userId: 'user-1', guildId: 'guild-1', username: 'TestUser', ...overrides },
    jwtSecret,
    { expiresIn: '1h' }
  );
}

describe('Socket.IO casino handlers (e2e)', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let port: number;

  beforeAll(async () => {
    httpServer = createServer();
    io = new SocketIOServer(httpServer);
    setupSocketHandlers(io);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function connect(auth: Record<string, unknown>): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(`http://localhost:${port}`, {
        auth,
        transports: ['websocket'],
        reconnection: false,
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  }

  describe('authentication', () => {
    it('rejects a connection with no token', async () => {
      await expect(connect({})).rejects.toThrow(/Authentication token required/);
    });

    it('rejects a connection with an invalid token', async () => {
      await expect(connect({ token: 'not-a-real-token' })).rejects.toThrow(/Invalid authentication token/);
    });

    it('accepts a connection with a valid token', async () => {
      const socket = await connect({ token: signToken() });
      expect(socket.connected).toBe(true);
      socket.disconnect();
    });
  });

  describe('roulette events', () => {
    it('joins the table room and returns table state', async () => {
      (RouletteTableManager.getTableStatus as Mock).mockResolvedValue({
        gamePhase: 'betting',
        activePlayers: 2,
      });

      const socket = await connect({ token: signToken() });
      const state = await new Promise((resolve) => {
        socket.on('roulette:table_state', resolve);
        socket.emit('roulette:join_table', { tableId: 'table-1' });
      });

      expect(RouletteTableManager.getTableStatus).toHaveBeenCalledWith('table-1');
      expect(state).toEqual({ gamePhase: 'betting', activePlayers: 2 });
      // Betting round should not be (re)started for a table that's not "waiting"
      expect(RouletteTableManager.startBettingRound).not.toHaveBeenCalled();

      socket.disconnect();
    });

    it('starts a betting round when joining a fresh table', async () => {
      (RouletteTableManager.getTableStatus as Mock).mockResolvedValue({
        gamePhase: 'waiting',
        activePlayers: 1,
      });
      (RouletteTableManager.startBettingRound as Mock).mockResolvedValue(undefined);

      const socket = await connect({ token: signToken() });
      await new Promise((resolve) => {
        socket.on('roulette:table_state', resolve);
        socket.emit('roulette:join_table', { tableId: 'table-2' });
      });

      expect(RouletteTableManager.startBettingRound).toHaveBeenCalledWith('table-2', io);

      socket.disconnect();
    });

    it('broadcasts player_joined to everyone already at the table', async () => {
      (RouletteTableManager.getTableStatus as Mock).mockResolvedValue({
        gamePhase: 'betting',
        activePlayers: 2,
      });

      const socketA = await connect({ token: signToken({ userId: 'user-a', username: 'Alice' }) });
      await new Promise((resolve) => {
        socketA.on('roulette:table_state', resolve);
        socketA.emit('roulette:join_table', { tableId: 'shared-table' });
      });

      const socketB = await connect({ token: signToken({ userId: 'user-b', username: 'Bob' }) });
      const notified = new Promise((resolve) => socketA.on('roulette:player_joined', resolve));
      socketB.emit('roulette:join_table', { tableId: 'shared-table' });

      expect(await notified).toMatchObject({ userId: 'user-b', username: 'Bob' });

      socketA.disconnect();
      socketB.disconnect();
    });

    it('emits an error event when placing a bet fails', async () => {
      (RouletteTableManager.placeBet as Mock).mockResolvedValue({
        success: false,
        message: 'Betting round is closed',
      });

      const socket = await connect({ token: signToken() });
      const error = new Promise((resolve) => socket.on('error', resolve));
      socket.emit('roulette:place_bet', { tableId: 'table-1', bet: { amount: 10, type: 'red' } });

      expect(await error).toEqual({ message: 'Betting round is closed' });

      socket.disconnect();
    });

    it('confirms a successful bet', async () => {
      (RouletteTableManager.placeBet as Mock).mockResolvedValue({ success: true });

      const socket = await connect({ token: signToken() });
      const confirmed = new Promise((resolve) => socket.on('roulette:bet_placed', resolve));
      socket.emit('roulette:place_bet', { tableId: 'table-1', bet: { amount: 10, type: 'red' } });

      await expect(confirmed).resolves.toBeDefined();

      socket.disconnect();
    });
  });

  describe('blackjack events', () => {
    it('joins a table on success and emits the table state', async () => {
      (BlackjackTableManager.playerJoin as Mock).mockResolvedValue({
        success: true,
        message: 'Joined table',
        tableState: { players: 1 },
      });

      const socket = await connect({ token: signToken() });
      const joined = await new Promise((resolve) => {
        socket.on('blackjack:joined', resolve);
        socket.emit('blackjack:join_table', { tableId: 'bj-1', characterClass: 'warrior' });
      });

      expect(BlackjackTableManager.playerJoin).toHaveBeenCalledWith(
        'bj-1', 'guild-1', 'user-1', 'warrior', io
      );
      expect(joined).toEqual({ message: 'Joined table', tableState: { players: 1 } });

      socket.disconnect();
    });

    it('emits an error when the table is full', async () => {
      (BlackjackTableManager.playerJoin as Mock).mockResolvedValue({
        success: false,
        message: 'Table is full',
      });

      const socket = await connect({ token: signToken() });
      const error = new Promise((resolve) => socket.on('error', resolve));
      socket.emit('blackjack:join_table', { tableId: 'bj-1' });

      expect(await error).toEqual({ message: 'Table is full' });

      socket.disconnect();
    });

    it('relays hit results including bust state', async () => {
      (BlackjackTableManager.playerHit as Mock).mockResolvedValue({
        success: true,
        message: 'Card dealt',
        card: { rank: 'K', suit: 'spades' },
        handValue: 24,
        isBusted: true,
      });

      const socket = await connect({ token: signToken() });
      const result = await new Promise((resolve) => {
        socket.on('blackjack:hit_result', resolve);
        socket.emit('blackjack:hit', { tableId: 'bj-1' });
      });

      expect(result).toEqual({
        message: 'Card dealt',
        card: { rank: 'K', suit: 'spades' },
        handValue: 24,
        isBusted: true,
      });

      socket.disconnect();
    });

    it('confirms standing', async () => {
      (BlackjackTableManager.playerStand as Mock).mockResolvedValue({
        success: true,
        message: 'Standing at 19',
      });

      const socket = await connect({ token: signToken() });
      const result = await new Promise((resolve) => {
        socket.on('blackjack:stand_confirmed', resolve);
        socket.emit('blackjack:stand', { tableId: 'bj-1' });
      });

      expect(result).toEqual({ message: 'Standing at 19' });

      socket.disconnect();
    });
  });

  describe('bard abilities', () => {
    it('broadcasts a harmony boost to the whole table on success', async () => {
      (BardAbilities.triggerLuckySong as Mock).mockResolvedValue({
        success: true,
        affectedPlayers: ['user-2', 'user-3'],
      });

      const bard = await connect({ token: signToken({ userId: 'bard-1', username: 'Luna' }) });
      await new Promise((resolve) => {
        bard.on('roulette:table_state', resolve);
        bard.emit('roulette:join_table', { tableId: 'rt-1' });
      });

      const listener = await connect({ token: signToken({ userId: 'user-2', username: 'Listener' }) });
      await new Promise((resolve) => {
        listener.on('roulette:table_state', resolve);
        listener.emit('roulette:join_table', { tableId: 'rt-1' });
      });

      const boost = new Promise((resolve) => listener.on('bard:harmony_boost_active', resolve));
      const triggered = new Promise((resolve) => bard.on('bard:ability_triggered', resolve));

      bard.emit('bard:trigger_lucky_song', { tableId: 'rt-1', gameType: 'roulette' });

      expect(await triggered).toEqual({ message: undefined, affectedPlayers: ['user-2', 'user-3'] });
      expect(await boost).toMatchObject({
        bardUserId: 'bard-1',
        bardUsername: 'Luna',
        affectedPlayers: ['user-2', 'user-3'],
      });

      bard.disconnect();
      listener.disconnect();
    });

    it('emits an error when the ability is on cooldown', async () => {
      (BardAbilities.triggerLuckySong as Mock).mockResolvedValue({
        success: false,
        message: 'Lucky Song is on cooldown',
      });

      const socket = await connect({ token: signToken() });
      const error = new Promise((resolve) => socket.on('error', resolve));
      socket.emit('bard:trigger_lucky_song', { tableId: 'rt-1', gameType: 'roulette' });

      expect(await error).toEqual({ message: 'Lucky Song is on cooldown' });

      socket.disconnect();
    });
  });

  describe('disconnect handling', () => {
    it('notifies the rest of the guild room when a player disconnects', async () => {
      const staying = await connect({ token: signToken({ userId: 'user-a', username: 'Alice' }) });
      const leaving = await connect({ token: signToken({ userId: 'user-b', username: 'Bob' }) });

      const notified = new Promise((resolve) => staying.on('casino:player_left', resolve));
      leaving.disconnect();

      expect(await notified).toEqual({ username: 'Bob', userId: 'user-b' });

      staying.disconnect();
    });
  });
});
