// Card utility functions for blackjack

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // Blackjack value
}

/**
 * Get the image path for a card
 */
export function getCardImage(suit: Suit, rank: Rank): string {
  return `/src/assets/kenney_playing-cards-pack/PNG/Cards (large)/card_${suit}_${rank}.png`;
}

/**
 * Get card back image
 */
export function getCardBack(): string {
  return `/src/assets/kenney_playing-cards-pack/PNG/Cards (large)/card_back.png`;
}

/**
 * Calculate blackjack value of a card
 */
export function getCardValue(rank: Rank): number {
  if (rank === 'A') return 11; // Ace default to 11
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

/**
 * Calculate total hand value in blackjack
 * Handles aces as 1 or 11 automatically
 */
export function calculateHandValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else {
      total += card.value;
    }
  }

  // Convert aces from 11 to 1 if needed to avoid bust
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

/**
 * Create a card object
 */
export function createCard(suit: Suit, rank: Rank): Card {
  return {
    suit,
    rank,
    value: getCardValue(rank),
  };
}

/**
 * Convert a multiplayer WebSocket card payload (e.g. { suit: 'hearts', rank: '7', value: 7 })
 * into the frontend's zero-padded Card shape.
 */
export function fromBackendCard(card: { suit: string; rank: string; value: number }): Card {
  const rankMap: Record<string, Rank> = {
    'A': 'A', '2': '02', '3': '03', '4': '04', '5': '05',
    '6': '06', '7': '07', '8': '08', '9': '09', '10': '10',
    'J': 'J', 'Q': 'Q', 'K': 'K'
  };

  const rank = rankMap[card.rank];
  if (!rank || !card.suit) {
    console.error('Failed to convert backend card:', card);
    throw new Error(`Invalid backend card: ${JSON.stringify(card)}`);
  }

  return { suit: card.suit as Suit, rank, value: card.value };
}

/**
 * Parse card from backend format (e.g., "AH" = Ace of Hearts)
 */
export function parseCard(cardString: string): Card {
  if (!cardString || typeof cardString !== 'string') {
    console.error('Invalid card string:', cardString);
    throw new Error(`Invalid card string: ${cardString}`);
  }

  const rankMap: Record<string, Rank> = {
    'A': 'A', '2': '02', '3': '03', '4': '04', '5': '05',
    '6': '06', '7': '07', '8': '08', '9': '09', '10': '10',
    'J': 'J', 'Q': 'Q', 'K': 'K'
  };
  
  const suitMap: Record<string, Suit> = {
    'H': 'hearts', 'D': 'diamonds', 'C': 'clubs', 'S': 'spades'
  };

  const rankStr = cardString.slice(0, -1);
  const suitStr = cardString.slice(-1);

  const suit = suitMap[suitStr];
  const rank = rankMap[rankStr];

  if (!suit || !rank) {
    console.error('Failed to parse card:', { cardString, rankStr, suitStr, suit, rank });
    throw new Error(`Invalid card format: ${cardString}`);
  }

  return createCard(suit, rank);
}
