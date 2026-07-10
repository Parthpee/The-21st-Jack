import type { Card } from './cards';
import { evaluateHand, isPair } from './hand';

export type StrategyAction = 'H' | 'S' | 'D' | 'T' | 'R' | 'P';

export interface StrategyOptions {
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  firstDecision: boolean;
}

export interface StrategyResult {
  action: StrategyAction;
  label: string;
  deviation: boolean;
  deviationNote: string;
}

const dIdx = (dealerValue: number): number => dealerValue === 11 ? 9 : dealerValue >= 10 ? 8 : dealerValue - 2;

const HARD: Record<number, string> = {
  5: 'HHHHHHHHHH', 6: 'HHHHHHHHHH', 7: 'HHHHHHHHHH', 8: 'HHHHHHHHHH',
  9: 'HDDDDHHHHH',
  10: 'DDDDDDDDHH',
  11: 'DDDDDDDDDD',
  12: 'HHSSSHHHHH',
  13: 'SSSSSHHHHH', 14: 'SSSSSHHHHH',
  15: 'SSSSSHHHRH',
  16: 'SSSSSHHRRR'
};

const SOFT: Record<number, string> = {
  13: 'HHHDDHHHHH', 14: 'HHHDDHHHHH',
  15: 'HHDDDHHHHH', 16: 'HHDDDHHHHH',
  17: 'HDDDDHHHHH',
  18: 'TDDDDSSHHH',
  19: 'SSSSSSSSSS', 20: 'SSSSSSSSSS'
};

const PAIR: Record<number, string> = {
  2: 'PPPPPPHHHH', 3: 'PPPPPPHHHH',
  4: 'HHHPPHHHHH',
  5: 'DDDDDDDDHH',
  6: 'PPPPPHHHHH',
  7: 'PPPPPPHHHH',
  8: 'PPPPPPPPPP',
  9: 'PPPPPSPPSS',
  10: 'SSSSSSSSSS',
  11: 'PPPPPPPPPP'
};

const I18: Array<[type: 'hard' | 'soft', playerScore: number, dealerUp: number, trueCountMin: number, action: StrategyAction]> = [
  ['hard', 16, 10, 0, 'S'], ['hard', 15, 10, 4, 'S'],
  ['hard', 12, 3, 2, 'S'], ['hard', 12, 2, 3, 'S'],
  ['hard', 11, 11, 1, 'D'], ['hard', 10, 11, 4, 'D'],
  ['hard', 10, 10, 4, 'D'], ['hard', 9, 2, 1, 'D'],
  ['hard', 9, 7, 3, 'D'], ['hard', 16, 9, 5, 'S'],
  ['soft', 19, 6, 1, 'D']
];

const LABELS: Record<StrategyAction, string> = {
  H: 'Hit', S: 'Stand', D: 'Double', T: 'Double', R: 'Surrender', P: 'Split'
};

export function getOptimal(hand: Card[], dealerUp: Card, trueCount: number, opts: StrategyOptions): StrategyResult {
  if (!hand.length) return { action: 'H', label: 'Hit', deviation: false, deviationNote: '' };

  const value = evaluateHand(hand);
  const dealerValue = dealerUp.value;
  const dealerNormalized = dealerValue >= 10 && dealerValue !== 11 ? 10 : dealerValue;
  const idx = dIdx(dealerValue);
  let action: StrategyAction = 'H';

  if (isPair(hand) && opts.canSplit) {
    const pairKey = hand[0].rank === 'A' ? 11 : Math.min(10, hand[0].value);
    if (PAIR[pairKey]?.[idx] === 'P') action = 'P';
  }

  if (action === 'H' && value.soft && value.total >= 13 && value.total <= 20) {
    action = (SOFT[value.total]?.[idx] ?? 'H') as StrategyAction;
  }

  if (action === 'H') {
    action = value.total >= 17 ? 'S' : (HARD[value.total]?.[idx] ?? 'H') as StrategyAction;
  }

  let deviation = false;
  let deviationNote = '';
  for (const [type, playerScore, dealerTarget, tcMin, devAction] of I18) {
    const typeMatch = (type === 'soft' && value.soft) || (type === 'hard' && !value.soft);
    const scoreMatch = value.total === playerScore;
    const dealerMatch = dealerNormalized === dealerTarget || (dealerTarget === 11 && dealerValue === 11);
    if (typeMatch && scoreMatch && dealerMatch && trueCount >= tcMin && devAction !== action) {
      action = devAction;
      deviation = true;
      deviationNote = `Count deviation: TC ≥ ${tcMin} → ${LABELS[devAction]}`;
      break;
    }
  }

  if ((action === 'D' || action === 'T') && !opts.canDouble) action = action === 'T' ? 'S' : 'H';
  if (action === 'R' && (!opts.canSurrender || !opts.firstDecision)) action = 'H';
  if (action === 'P' && !opts.canSplit) action = 'H';

  return { action, label: LABELS[action], deviation, deviationNote };
}
