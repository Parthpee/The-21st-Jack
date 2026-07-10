import { CFG } from './config';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
  count: number;
  red: boolean;
}

export interface ShoeStats {
  remaining: number;
  total: number;
  runningCount: number;
  trueCount: number;
  trueCountText: string;
  penetration: number;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function cardValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function hiLoValue(rank: Rank): number {
  if (rank === '2' || rank === '3' || rank === '4' || rank === '5' || rank === '6') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'A') return -1;
  return 0;
}

export function buildShoe(decks = CFG.decks): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          suit,
          rank,
          value: cardValue(rank),
          count: hiLoValue(rank),
          red: suit === '♥' || suit === '♦'
        });
      }
    }
  }
  return cards;
}

export function shuffle<T>(input: T[], rng: () => number = Math.random): T[] {
  const cards = [...input];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export class Shoe {
  private cards: Card[] = [];
  runningCount = 0;
  readonly total: number;

  constructor(private readonly decks = CFG.decks, private readonly rng: () => number = Math.random) {
    this.cards = shuffle(buildShoe(this.decks), this.rng);
    this.total = this.cards.length;
  }

  draw(): Card {
    if (this.cards.length <= this.total * (1 - CFG.penetration)) {
      this.reset();
    }
    const card = this.cards.pop();
    if (!card) {
      this.reset();
      return this.draw();
    }
    this.runningCount += card.count;
    return card;
  }

  reset(): void {
    this.cards = shuffle(buildShoe(this.decks), this.rng);
    this.runningCount = 0;
  }

  values(): number[] {
    return this.cards.map(card => card.value);
  }

  stats(): ShoeStats {
    const remaining = this.cards.length;
    const decksRemaining = Math.max(0.5, remaining / 52);
    const trueCount = this.runningCount / decksRemaining;
    return {
      remaining,
      total: this.total,
      runningCount: this.runningCount,
      trueCount,
      trueCountText: `${trueCount >= 0 ? '+' : ''}${trueCount.toFixed(1)}`,
      penetration: 1 - remaining / this.total
    };
  }

  kellyBet(bankroll: number): number {
    const trueCount = this.stats().trueCount;
    if (trueCount <= 1) return CFG.minBet;
    if (trueCount <= 2) return Math.min(25, bankroll);
    if (trueCount <= 3) return Math.min(50, bankroll);
    if (trueCount <= 4) return Math.min(100, bankroll);
    return Math.min(CFG.maxBet, Math.max(CFG.minBet, Math.floor(bankroll * 0.18)));
  }
}
