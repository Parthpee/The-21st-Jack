import type { Card } from './cards';

export interface HandValue {
  total: number;
  soft: boolean;
  blackjack: boolean;
  bust: boolean;
}

export function evaluateHand(cards: Card[]): HandValue {
  let total = 0;
  let acesAsEleven = 0;

  for (const card of cards) {
    total += card.value;
    if (card.rank === 'A') acesAsEleven += 1;
  }

  while (total > 21 && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven -= 1;
  }

  return {
    total,
    soft: acesAsEleven > 0 && total <= 21,
    blackjack: cards.length === 2 && total === 21,
    bust: total > 21
  };
}

export function isPair(cards: Card[]): boolean {
  return cards.length === 2 && cards[0].rank === cards[1].rank;
}
