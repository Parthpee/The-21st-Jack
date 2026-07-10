import { describe, expect, it } from 'vitest';
import { evaluateHand } from '../../src/game/core/hand';
import type { Card } from '../../src/game/core/cards';

const card = (rank: Card['rank'], suit: Card['suit'] = '♠'): Card => ({
  rank,
  suit,
  value: rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank),
  count: ['2', '3', '4', '5', '6'].includes(rank) ? 1 : ['10', 'J', 'Q', 'K', 'A'].includes(rank) ? -1 : 0,
  red: suit === '♥' || suit === '♦'
});

describe('evaluateHand', () => {
  it('detects blackjack', () => {
    const value = evaluateHand([card('A'), card('K')]);
    expect(value.total).toBe(21);
    expect(value.blackjack).toBe(true);
    expect(value.bust).toBe(false);
  });

  it('demotes ace from 11 to 1 when needed', () => {
    const value = evaluateHand([card('A'), card('9'), card('8')]);
    expect(value.total).toBe(18);
    expect(value.soft).toBe(false);
  });

  it('marks a busted hand', () => {
    const value = evaluateHand([card('K'), card('9'), card('5')]);
    expect(value.bust).toBe(true);
  });
});
