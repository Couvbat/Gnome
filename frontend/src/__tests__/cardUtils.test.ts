import { describe, it, expect } from 'vitest';
import {
  getCardImage,
  getCardBack,
  getCardValue,
  calculateHandValue,
  createCard,
  parseCard,
  type Card,
} from '../utils/cardUtils';

describe('cardUtils', () => {
  describe('getCardImage', () => {
    it('should return correct path for ace of hearts', () => {
      const path = getCardImage('hearts', 'A');
      expect(path).toBe('/src/assets/kenney_playing-cards-pack/PNG/Cards (large)/card_hearts_A.png');
    });

    it('should return correct path for numbered cards', () => {
      const path = getCardImage('spades', '07');
      expect(path).toBe('/src/assets/kenney_playing-cards-pack/PNG/Cards (large)/card_spades_07.png');
    });

    it('should return correct path for face cards', () => {
      const path = getCardImage('diamonds', 'K');
      expect(path).toBe('/src/assets/kenney_playing-cards-pack/PNG/Cards (large)/card_diamonds_K.png');
    });
  });

  describe('getCardBack', () => {
    it('should return correct card back path', () => {
      const path = getCardBack();
      expect(path).toBe('/src/assets/kenney_playing-cards-pack/PNG/Cards (large)/card_back.png');
    });
  });

  describe('getCardValue', () => {
    it('should return 11 for Ace', () => {
      expect(getCardValue('A')).toBe(11);
    });

    it('should return 10 for face cards', () => {
      expect(getCardValue('J')).toBe(10);
      expect(getCardValue('Q')).toBe(10);
      expect(getCardValue('K')).toBe(10);
    });

    it('should return numeric value for number cards', () => {
      expect(getCardValue('02')).toBe(2);
      expect(getCardValue('05')).toBe(5);
      expect(getCardValue('10')).toBe(10);
    });
  });

  describe('createCard', () => {
    it('should create a card object with correct properties', () => {
      const card = createCard('hearts', 'A');
      expect(card).toEqual({
        suit: 'hearts',
        rank: 'A',
        value: 11,
      });
    });

    it('should create number card with correct value', () => {
      const card = createCard('clubs', '07');
      expect(card).toEqual({
        suit: 'clubs',
        rank: '07',
        value: 7,
      });
    });
  });

  describe('calculateHandValue', () => {
    it('should calculate simple hand value', () => {
      const cards: Card[] = [
        createCard('hearts', '05'),
        createCard('spades', '10'),
      ];
      expect(calculateHandValue(cards)).toBe(15);
    });

    it('should handle ace as 11 when under 21', () => {
      const cards: Card[] = [
        createCard('hearts', 'A'),
        createCard('spades', '08'),
      ];
      expect(calculateHandValue(cards)).toBe(19);
    });

    it('should handle ace as 1 when over 21', () => {
      const cards: Card[] = [
        createCard('hearts', 'A'),
        createCard('spades', '08'),
        createCard('diamonds', '05'),
      ];
      expect(calculateHandValue(cards)).toBe(14); // 1 + 8 + 5
    });

    it('should handle multiple aces', () => {
      const cards: Card[] = [
        createCard('hearts', 'A'),
        createCard('spades', 'A'),
        createCard('diamonds', '09'),
      ];
      expect(calculateHandValue(cards)).toBe(21); // 1 + 11 + 9
    });

    it('should handle blackjack', () => {
      const cards: Card[] = [
        createCard('hearts', 'A'),
        createCard('spades', 'K'),
      ];
      expect(calculateHandValue(cards)).toBe(21);
    });

    it('should handle bust with multiple aces', () => {
      const cards: Card[] = [
        createCard('hearts', 'A'),
        createCard('spades', 'A'),
        createCard('diamonds', 'A'),
        createCard('clubs', '10'),
        createCard('hearts', '10'),
      ];
      expect(calculateHandValue(cards)).toBe(23); // 1 + 1 + 1 + 10 + 10
    });
  });

  describe('parseCard', () => {
    it('should parse ace of hearts', () => {
      const card = parseCard('AH');
      expect(card.suit).toBe('hearts');
      expect(card.rank).toBe('A');
      expect(card.value).toBe(11);
    });

    it('should parse numbered cards', () => {
      const card = parseCard('7S');
      expect(card.suit).toBe('spades');
      expect(card.rank).toBe('07');
      expect(card.value).toBe(7);
    });

    it('should parse 10 correctly', () => {
      const card = parseCard('10D');
      expect(card.suit).toBe('diamonds');
      expect(card.rank).toBe('10');
      expect(card.value).toBe(10);
    });

    it('should parse face cards', () => {
      const queen = parseCard('QC');
      expect(queen.suit).toBe('clubs');
      expect(queen.rank).toBe('Q');
      expect(queen.value).toBe(10);

      const jack = parseCard('JH');
      expect(jack.suit).toBe('hearts');
      expect(jack.rank).toBe('J');
      expect(jack.value).toBe(10);

      const king = parseCard('KS');
      expect(king.suit).toBe('spades');
      expect(king.rank).toBe('K');
      expect(king.value).toBe(10);
    });

    it('should throw error for invalid card string', () => {
      expect(() => parseCard('')).toThrow('Invalid card string');
      expect(() => parseCard('XY')).toThrow('Invalid card format');
    });

    it('should throw error for null/undefined', () => {
      expect(() => parseCard(null as unknown as string)).toThrow('Invalid card string');
      expect(() => parseCard(undefined as unknown as string)).toThrow('Invalid card string');
    });
  });
});
