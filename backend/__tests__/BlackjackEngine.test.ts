import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BlackjackEngine, type Card } from '../src/engines/BlackjackEngine';
import { CasinoGameEngine } from '../src/engines/CasinoGameEngine';

const mockContext = {
  user: { userId: 'user1', guildId: 'guild1', coins: 1000 },
  character: null,
  casinoProfile: null,
  characterBonus: { className: 'none', luckBonus: 0, energyBonus: 0, specialAbility: '' },
  totalLuck: 10,
  bardBoost: 0
};

function card(rank: Card['rank'], value: number, isAce = false): Card {
  return { rank, suit: 'spades', value, isAce };
}

// Returns a minimal deck where pop() gives cards in the provided order.
// First element in `popOrder` is returned first by deck.pop().
function deckFor(popOrder: Card[]): Card[] {
  return [...popOrder].reverse();
}

describe('BlackjackEngine', () => {
  beforeEach(() => {
    vi.spyOn(CasinoGameEngine, 'getPlayerContext').mockResolvedValue(mockContext);
    vi.spyOn(CasinoGameEngine, 'checkEnergyAvailable').mockResolvedValue(true);
    // passthrough so we can assert on what the engine computed
    vi.spyOn(CasinoGameEngine, 'processGameResult').mockImplementation(
      async (_uid, _gid, _type, _bet, result) => result as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBlackjackGameInfo', () => {
    it('returns basic strategy tips', () => {
      const info = BlackjackEngine.getBlackjackGameInfo();
      expect(info.basicStrategy.length).toBeGreaterThan(0);
      expect(info.basicStrategy[0]).toContain('hit');
    });

    it('returns strategies for all six character classes', () => {
      const { characterStrategies } = BlackjackEngine.getBlackjackGameInfo();
      for (const cls of ['warrior', 'mage', 'rogue', 'merchant', 'bard', 'paladin']) {
        expect(characterStrategies[cls]).toBeDefined();
      }
    });

    it('returns payout information', () => {
      const { payouts } = BlackjackEngine.getBlackjackGameInfo();
      expect(payouts.blackjack).toBeDefined();
      expect(payouts.win).toBeDefined();
      expect(payouts.push).toBeDefined();
    });
  });

  describe('playSinglePlayerBlackjack', () => {
    it('throws when player has insufficient energy', async () => {
      vi.spyOn(CasinoGameEngine, 'checkEnergyAvailable').mockResolvedValue(false);
      await expect(
        BlackjackEngine.playSinglePlayerBlackjack('user1', 'guild1', 100)
      ).rejects.toThrow('Insufficient energy');
    });

    it('detects natural blackjack: jackpot with 3:2 payout', async () => {
      // Player: A + K = 21 (blackjack). Dealer: 5 + 8 = 13 (no blackjack).
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('A', 11, true),   // player card 1
          card('K', 10),          // player card 2
          card('5', 5),           // dealer up
          card('8', 8),           // dealer hidden
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack('user1', 'guild1', 100);
      expect(result.outcome).toBe('jackpot');
      expect(result.gameType).toBe('blackjack');
      expect(result.playerHand.isBlackjack).toBe(true);
      expect(result.baseWinnings).toBe(250); // 100 * 2.5
    });

    it('push when both player and dealer have natural blackjack', async () => {
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('A', 11, true),  // player card 1
          card('K', 10),         // player card 2
          card('A', 11, true),  // dealer up
          card('K', 10),         // dealer hidden
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack('user1', 'guild1', 100);
      expect(result.outcome).toBe('push');
      expect(result.gameType).toBe('push');
      expect(result.playerHand.isBlackjack).toBe(true);
    });

    it('player wins when their value beats dealer value', async () => {
      // Player: K+K = 20 (stands). Dealer: 10+5 = 15, draws 3 = 18. 20 > 18.
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('K', 10),   // player card 1
          card('K', 10),   // player card 2
          card('10', 10),  // dealer up
          card('5', 5),    // dealer hidden
          card('3', 3),    // dealer draws to reach 18
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack('user1', 'guild1', 100);
      expect(result.outcome).toBe('win');
      expect(result.playerHand.value).toBe(20);
      expect(result.dealerHand.value).toBe(18);
    });

    it('player loses when dealer value is higher', async () => {
      // Player: 8+5 = 13 (strategy=stand). Dealer: K+K = 20. 13 < 20.
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('8', 8),   // player card 1
          card('5', 5),   // player card 2
          card('K', 10),  // dealer up
          card('K', 10),  // dealer hidden
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack(
        'user1', 'guild1', 100, 'stand'
      );
      expect(result.outcome).toBe('loss');
    });

    it('player busts when hitting and exceeding 21', async () => {
      // Player: 8+5 = 13, hits and draws K = 23 (bust).
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('8', 8),   // player card 1
          card('5', 5),   // player card 2
          card('2', 2),   // dealer up
          card('3', 3),   // dealer hidden
          card('K', 10),  // player draws → 8+5+K = 23 (bust)
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack(
        'user1', 'guild1', 100, 'hit'
      );
      expect(result.outcome).toBe('loss');
      expect(result.gameType).toBe('bust');
      expect(result.playerHand.isBusted).toBe(true);
    });

    it('player wins when dealer busts', async () => {
      // Player: K+K = 20 (stands). Dealer: 5+10 = 15, draws K = 25 (bust).
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('K', 10),  // player card 1
          card('K', 10),  // player card 2
          card('5', 5),   // dealer up
          card('10', 10), // dealer hidden
          card('K', 10),  // dealer draws → 5+10+K = 25 (bust)
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack('user1', 'guild1', 100);
      expect(result.outcome).toBe('win');
      expect(result.gameType).toBe('dealer_bust');
      expect(result.dealerHand.isBusted).toBe(true);
    });

    it('push when player and dealer end on equal values', async () => {
      // Player: K+Q = 20 (stands). Dealer: J+10 = 20 (stands). Tie.
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('K', 10),  // player card 1
          card('Q', 10),  // player card 2
          card('J', 10),  // dealer up
          card('10', 10), // dealer hidden
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack('user1', 'guild1', 100);
      expect(result.outcome).toBe('push');
      expect(result.gameType).toBe('push');
      expect(result.baseWinnings).toBe(100); // bet returned
    });

    it('respects explicit stand strategy: player does not draw', async () => {
      // Player: 8+5 = 13, but strategy=stand forces them to stay.
      vi.spyOn(BlackjackEngine as any, 'createShuffledDeck').mockReturnValue(
        deckFor([
          card('8', 8),   // player card 1
          card('5', 5),   // player card 2
          card('2', 2),   // dealer up
          card('3', 3),   // dealer hidden — dealer draws until >= 17
          card('K', 10),  // dealer draw → 2+3+K = 15, then 9
          card('9', 9),   // dealer draw → 15+9 = 24 (bust) — player wins
        ])
      );

      const result = await BlackjackEngine.playSinglePlayerBlackjack(
        'user1', 'guild1', 100, 'stand'
      );
      // Player stays at 13 cards (2 cards only)
      expect(result.playerHand.cards).toHaveLength(2);
      expect(result.playerHand.value).toBe(13);
    });
  });
});
