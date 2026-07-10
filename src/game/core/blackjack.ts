import { CFG } from './config';
import { Shoe, type Card, type ShoeStats } from './cards';
import { evaluateHand } from './hand';
import { getOptimal, type StrategyResult } from './strategy';

export type Phase = 'betting' | 'insurance' | 'player' | 'dealer' | 'roundOver';
export type RoundResult = 'win' | 'lose' | 'push' | 'bj';

export interface PlayerHand {
  id: number;
  cards: Card[];
  bet: number;
  done: boolean;
  fromSplit?: boolean;
  surrendered?: boolean;
  result?: RoundResult;
  resultText?: string;
}

export interface SessionStats {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  profit: number;
  history: RoundResult[];
}

export interface Telemetry {
  optimal: StrategyResult | null;
  playerEdge: number;
  winProbability: number | null;
}

export interface GameSnapshot {
  phase: Phase;
  bankroll: number;
  selectedBet: number;
  dealer: Card[];
  hands: PlayerHand[];
  activeHandIndex: number;
  message: string;
  toastType: RoundResult | 'info' | null;
  shoe: ShoeStats;
  session: SessionStats;
  telemetry: Telemetry;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  canDeal: boolean;
  insuranceBet: number;
}

type Listener = (snapshot: GameSnapshot) => void;

const emptyStats = (): SessionStats => ({
  hands: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  profit: 0,
  history: []
});

const LOSS_ROASTS = [
  'Ha ha, sucker.',
  'Your granny did not teach that move, did she?',
  'The dealer just sent you a thank-you note.',
  'That hand got cooked medium-well.',
  'Casino donation received. Very generous.',
  'The shoe said: nice try, champ.',
  'Oof. Even the chips looked embarrassed.',
  'That was not blackjack. That was performance art.',
  'The dealer is trying really hard not to laugh.',
  'Next time, maybe ask the cards for permission first.'
];

function randomLossRoast(): string {
  return LOSS_ROASTS[Math.floor(Math.random() * LOSS_ROASTS.length)];
}

export class BlackjackEngine {
  private shoe = new Shoe();
  private phase: Phase = 'betting';
  private bankroll: number = CFG.startBankroll;
  private selectedBet: number = CFG.minBet;
  private dealer: Card[] = [];
  private hands: PlayerHand[] = [];
  private activeHandIndex = 0;
  private nextHandId = 1;
  private message = 'Place your bet';
  private toastType: RoundResult | 'info' | null = null;
  private insuranceBet = 0;
  private session = emptyStats();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  setBet(amount: number): void {
    this.selectedBet = Math.max(CFG.minBet, Math.min(CFG.maxBet, amount));
    this.emit('Bet updated', 'info');
  }

  reset(): void {
    this.phase = 'betting';
    this.bankroll = CFG.startBankroll;
    this.selectedBet = CFG.minBet;
    this.dealer = [];
    this.hands = [];
    this.activeHandIndex = 0;
    this.insuranceBet = 0;
    this.session = emptyStats();
    this.message = 'Bankroll reset';
    this.toastType = 'info';
    this.shoe.reset();
    this.notify();
  }

  startRound(): void {
    if (this.phase !== 'betting' && this.phase !== 'roundOver') return;
    if (this.bankroll < this.selectedBet) {
      this.emit('Insufficient bankroll', 'info');
      return;
    }

    this.bankroll -= this.selectedBet;
    this.insuranceBet = 0;
    this.dealer = [this.shoe.draw(), this.shoe.draw()];
    this.hands = [{ id: this.nextHandId++, cards: [this.shoe.draw(), this.shoe.draw()], bet: this.selectedBet, done: false }];
    this.activeHandIndex = 0;
    this.phase = this.dealer[0].rank === 'A' ? 'insurance' : 'player';
    this.message = this.phase === 'insurance' ? 'Dealer shows Ace — insurance?' : 'Your move';
    this.toastType = 'info';

    if (this.phase === 'player') this.checkNaturals();
    this.notify();
  }

  handleInsurance(buy: boolean): void {
    if (this.phase !== 'insurance') return;
    const hand = this.hands[0];
    const maxInsurance = Math.floor(hand.bet / 2);
    if (buy && this.bankroll >= maxInsurance) {
      this.insuranceBet = maxInsurance;
      this.bankroll -= maxInsurance;
    }

    const dealerValue = evaluateHand(this.dealer);
    if (dealerValue.blackjack) {
      if (this.insuranceBet > 0) this.bankroll += this.insuranceBet * (CFG.insurancePay + 1);
      this.resolveAll('Dealer blackjack');
      return;
    }

    this.phase = 'player';
    this.message = this.insuranceBet > 0 ? 'No dealer blackjack — insurance lost' : 'Insurance declined';
    this.toastType = 'info';
    this.checkNaturals();
    this.notify();
  }

  hit(): void {
    const hand = this.activeHand();
    if (!hand || this.phase !== 'player') return;
    hand.cards.push(this.shoe.draw());
    const value = evaluateHand(hand.cards);
    if (value.bust || value.total === 21) this.advanceHand();
    else this.emit('Card dealt', 'info');
  }

  stand(): void {
    if (this.phase !== 'player') return;
    this.advanceHand();
  }

  double(): void {
    const hand = this.activeHand();
    if (!hand || !this.canDouble()) return;
    this.bankroll -= hand.bet;
    hand.bet *= 2;
    hand.cards.push(this.shoe.draw());
    this.advanceHand();
  }

  split(): void {
    const hand = this.activeHand();
    if (!hand || !this.canSplit()) return;

    this.bankroll -= hand.bet;
    const movedCard = hand.cards.pop();
    if (!movedCard) return;

    hand.cards.push(this.shoe.draw());
    const newHand: PlayerHand = {
      id: this.nextHandId++,
      cards: [movedCard, this.shoe.draw()],
      bet: hand.bet,
      done: false,
      fromSplit: true
    };
    hand.fromSplit = true;
    this.hands.splice(this.activeHandIndex + 1, 0, newHand);
    this.emit('Hand split', 'info');
  }

  surrender(): void {
    const hand = this.activeHand();
    if (!hand || !this.canSurrender()) return;
    const returned = Math.floor(hand.bet / 2);
    this.bankroll += returned;
    hand.surrendered = true;
    hand.done = true;
    this.record('lose', hand.bet - returned);
    hand.result = 'lose';
    hand.resultText = 'Surrender';
    this.phase = 'roundOver';
    this.message = `Surrendered — $${returned} returned`;
    this.toastType = 'info';
    this.notify();
  }

  canDouble(): boolean {
    const hand = this.activeHand();
    return Boolean(hand && this.phase === 'player' && hand.cards.length === 2 && this.bankroll >= hand.bet && (CFG.doubleAfterSplit || !hand.fromSplit));
  }

  canSplit(): boolean {
    const hand = this.activeHand();
    return Boolean(
      hand &&
      this.phase === 'player' &&
      hand.cards.length === 2 &&
      hand.cards[0].rank === hand.cards[1].rank &&
      this.bankroll >= hand.bet &&
      this.hands.length < CFG.maxHands
    );
  }

  canSurrender(): boolean {
    const hand = this.activeHand();
    return Boolean(hand && this.phase === 'player' && CFG.lateSurrender && hand.cards.length === 2 && this.hands.length === 1);
  }

  snapshot(): GameSnapshot {
    const shoe = this.shoe.stats();
    const active = this.activeHand();
    const canHit = this.phase === 'player' && Boolean(active);
    const canStand = this.phase === 'player' && Boolean(active);
    const optimal = active && this.dealer[0] && this.phase === 'player'
      ? getOptimal(active.cards, this.dealer[0], shoe.trueCount, {
        canDouble: this.canDouble(),
        canSplit: this.canSplit(),
        canSurrender: this.canSurrender(),
        firstDecision: active.cards.length === 2
      })
      : null;

    return {
      phase: this.phase,
      bankroll: this.bankroll,
      selectedBet: this.selectedBet,
      dealer: this.dealer.map(card => ({ ...card })),
      hands: this.hands.map(hand => ({ ...hand, cards: hand.cards.map(card => ({ ...card })) })),
      activeHandIndex: this.activeHandIndex,
      message: this.message,
      toastType: this.toastType,
      shoe,
      session: { ...this.session, history: [...this.session.history] },
      telemetry: {
        optimal,
        playerEdge: ((shoe.trueCount - 1) * 0.005 - 0.004) * 100,
        winProbability: active && this.dealer[0] ? estimateWinProbability(evaluateHand(active.cards).total, this.dealer[0].value, this.shoe.values()) : null
      },
      canHit,
      canStand,
      canDouble: this.canDouble(),
      canSplit: this.canSplit(),
      canSurrender: this.canSurrender(),
      canDeal: this.phase === 'betting' || this.phase === 'roundOver',
      insuranceBet: this.insuranceBet
    };
  }

  private activeHand(): PlayerHand | undefined {
    return this.hands[this.activeHandIndex];
  }

  private checkNaturals(): void {
    const player = evaluateHand(this.hands[0].cards);
    const dealer = evaluateHand(this.dealer);
    if (!player.blackjack && !dealer.blackjack) return;
    this.resolveAll(player.blackjack ? 'Blackjack' : 'Dealer blackjack');
  }

  private advanceHand(): void {
    const hand = this.activeHand();
    if (!hand) return;
    hand.done = true;
    this.activeHandIndex += 1;

    if (this.activeHandIndex >= this.hands.length) {
      this.playDealer();
      return;
    }

    this.message = `Hand ${this.activeHandIndex + 1}: your move`;
    this.toastType = 'info';
    this.notify();
  }

  private playDealer(): void {
    this.phase = 'dealer';
    const allBust = this.hands.every(hand => evaluateHand(hand.cards).bust || hand.surrendered);
    if (!allBust) {
      let dealerValue = evaluateHand(this.dealer);
      while (dealerValue.total < 17 || (dealerValue.total === 17 && CFG.dealerHitsSoft17 && dealerValue.soft)) {
        this.dealer.push(this.shoe.draw());
        dealerValue = evaluateHand(this.dealer);
      }
    }
    this.resolveAll('Round resolved');
  }

  private resolveAll(reason: string): void {
    this.phase = 'roundOver';
    const dealerValue = evaluateHand(this.dealer);
    const messages: string[] = [];
    let highestToast: RoundResult | 'info' = 'info';

    this.hands.forEach((hand, index) => {
      if (hand.surrendered) return;
      const playerValue = evaluateHand(hand.cards);
      let result: RoundResult = 'lose';
      let delta = 0;
      let text = 'Loss';

      if (playerValue.bust) {
        result = 'lose';
        delta = hand.bet;
        text = 'Bust';
      } else if (playerValue.blackjack && !hand.fromSplit && this.hands.length === 1 && !dealerValue.blackjack) {
        result = 'bj';
        delta = Math.floor(hand.bet * CFG.blackjackPay);
        this.bankroll += hand.bet + delta;
        text = 'BLACKJACK';
      } else if (dealerValue.blackjack && !playerValue.blackjack) {
        result = 'lose';
        delta = hand.bet;
        text = 'Dealer BJ';
      } else if (dealerValue.bust) {
        result = 'win';
        delta = hand.bet;
        this.bankroll += hand.bet * 2;
        text = 'Dealer bust';
      } else if (playerValue.total > dealerValue.total) {
        result = 'win';
        delta = hand.bet;
        this.bankroll += hand.bet * 2;
        text = 'Win';
      } else if (playerValue.total < dealerValue.total) {
        result = 'lose';
        delta = hand.bet;
        text = 'Loss';
      } else {
        result = 'push';
        delta = 0;
        this.bankroll += hand.bet;
        text = 'Push';
      }

      hand.result = result;
      hand.resultText = text;
      this.record(result, delta);
      if (result === 'bj' || result === 'win') highestToast = 'win';
      else if (result === 'push' && highestToast !== 'win') highestToast = 'push';
      else if (highestToast === 'info') highestToast = 'lose';
      messages.push(this.hands.length > 1 ? `H${index + 1}: ${text}` : text);
    });

    const finalToast = highestToast as RoundResult | 'info';
    this.message = messages.length ? messages.join(' · ') : reason;
    if (finalToast === 'lose') {
      this.message = `${this.message} — ${randomLossRoast()}`;
    }
    this.toastType = finalToast;
    this.notify();
  }

  private record(result: RoundResult, amount: number): void {
    this.session.hands += 1;
    this.session.history.push(result);
    if (this.session.history.length > 32) this.session.history.shift();

    if (result === 'win' || result === 'bj') {
      this.session.wins += 1;
      this.session.profit += amount;
      if (result === 'bj') this.session.blackjacks += 1;
    } else if (result === 'push') {
      this.session.pushes += 1;
    } else {
      this.session.losses += 1;
      this.session.profit -= amount;
    }
  }

  private emit(message: string, toastType: RoundResult | 'info' = 'info'): void {
    this.message = message;
    this.toastType = toastType;
    this.notify();
  }

  private notify(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

function estimateWinProbability(playerScore: number, dealerUp: number, shoeValues: number[]): number {
  if (playerScore > 21) return 0;
  const sims = 600;
  let wins = 0;

  for (let i = 0; i < sims; i += 1) {
    const pool = [...shoeValues];
    let dealerTotal = dealerUp;
    let aces = dealerUp === 11 ? 1 : 0;

    while (dealerTotal < 17 || (dealerTotal === 17 && CFG.dealerHitsSoft17 && aces > 0)) {
      if (!pool.length) break;
      const idx = Math.floor(Math.random() * pool.length);
      const value = pool.splice(idx, 1)[0];
      dealerTotal += value;
      if (value === 11) aces += 1;
      while (dealerTotal > 21 && aces > 0) {
        dealerTotal -= 10;
        aces -= 1;
      }
    }

    if (dealerTotal > 21 || playerScore > dealerTotal) wins += 1;
  }

  return Number(((wins / sims) * 100).toFixed(1));
}
