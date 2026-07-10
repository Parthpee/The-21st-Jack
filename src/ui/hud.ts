import { engine } from '../game/runtime';
import type { GameSnapshot, RoundResult } from '../game/core/blackjack';
import { CFG } from '../game/core/config';

const $ = <T extends HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
};

const money = (value: number): string => `$${Math.round(value).toLocaleString()}`;
const signed = (value: number, digits = 1): string => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

let toastTimer: number | undefined;

export function bindHud(): void {
  const els = {
    bankroll: $('#bankroll'),
    betDisplay: $('#betDisplay'),
    chips: $('#chips'),
    dealBtn: $('#dealBtn') as HTMLButtonElement,
    hitBtn: $('#hitBtn') as HTMLButtonElement,
    standBtn: $('#standBtn') as HTMLButtonElement,
    doubleBtn: $('#doubleBtn') as HTMLButtonElement,
    splitBtn: $('#splitBtn') as HTMLButtonElement,
    surrenderBtn: $('#surrenderBtn') as HTMLButtonElement,
    resetBtn: $('#resetBtn') as HTMLButtonElement,
    shoeText: $('#shoeText'),
    shoeMeter: $('#shoeMeter'),
    runningCount: $('#runningCount'),
    trueCount: $('#trueCount'),
    playerEdge: $('#playerEdge'),
    kellyHint: $('#kellyHint'),
    phaseLabel: $('#phaseLabel'),
    optimalMove: $('#optimalMove'),
    deviationNote: $('#deviationNote'),
    insurancePanel: $('#insurancePanel'),
    insuranceText: $('#insuranceText'),
    buyInsuranceBtn: $('#buyInsuranceBtn') as HTMLButtonElement,
    declineInsuranceBtn: $('#declineInsuranceBtn') as HTMLButtonElement,
    handsPlayed: $('#handsPlayed'),
    winRate: $('#winRate'),
    profit: $('#profit'),
    blackjacks: $('#blackjacks'),
    history: $('#history'),
    toast: $('#toast')
  };

  els.chips.addEventListener('click', event => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-bet]');
    if (!btn) return;
    const bet = Number(btn.dataset.bet ?? CFG.minBet);
    engine.setBet(bet);
  });

  els.dealBtn.addEventListener('click', () => engine.startRound());
  els.hitBtn.addEventListener('click', () => engine.hit());
  els.standBtn.addEventListener('click', () => engine.stand());
  els.doubleBtn.addEventListener('click', () => engine.double());
  els.splitBtn.addEventListener('click', () => engine.split());
  els.surrenderBtn.addEventListener('click', () => engine.surrender());
  els.resetBtn.addEventListener('click', () => engine.reset());
  els.buyInsuranceBtn.addEventListener('click', () => engine.handleInsurance(true));
  els.declineInsuranceBtn.addEventListener('click', () => engine.handleInsurance(false));

  engine.subscribe(snapshot => renderHud(snapshot, els));
}

function renderHud(snapshot: GameSnapshot, els: Record<string, HTMLElement>): void {
  document.documentElement.dataset.phase = snapshot.phase;
  document.documentElement.dataset.canDeal = String(snapshot.canDeal);

  const bankroll = els.bankroll;
  bankroll.textContent = money(snapshot.bankroll);
  bankroll.style.color = snapshot.bankroll >= 1000 ? 'var(--green)' : snapshot.bankroll <= 300 ? 'var(--red)' : 'var(--gold-hi)';

  els.betDisplay.textContent = money(snapshot.selectedBet);
  els.chips.querySelectorAll<HTMLButtonElement>('[data-bet]').forEach(btn => {
    btn.classList.toggle('is-active', Number(btn.dataset.bet) === snapshot.selectedBet);
    btn.disabled = !snapshot.canDeal;
  });

  (els.dealBtn as HTMLButtonElement).disabled = !snapshot.canDeal || snapshot.bankroll < snapshot.selectedBet;
  (els.hitBtn as HTMLButtonElement).disabled = !snapshot.canHit;
  (els.standBtn as HTMLButtonElement).disabled = !snapshot.canStand;
  (els.doubleBtn as HTMLButtonElement).disabled = !snapshot.canDouble;
  (els.splitBtn as HTMLButtonElement).disabled = !snapshot.canSplit;
  (els.surrenderBtn as HTMLButtonElement).disabled = !snapshot.canSurrender;

  els.phaseLabel.textContent = labelPhase(snapshot.phase);
  els.shoeText.textContent = `${snapshot.shoe.remaining} / ${snapshot.shoe.total}`;
  els.shoeMeter.style.width = `${Math.max(0, Math.min(100, (snapshot.shoe.remaining / snapshot.shoe.total) * 100))}%`;
  els.shoeMeter.style.background = snapshot.shoe.trueCount >= 2
    ? 'linear-gradient(90deg, var(--green), #c7f9cc)'
    : snapshot.shoe.trueCount <= -2
      ? 'linear-gradient(90deg, var(--red), #fecaca)'
      : 'linear-gradient(90deg, var(--green), var(--amber))';

  els.runningCount.textContent = `${snapshot.shoe.runningCount >= 0 ? '+' : ''}${snapshot.shoe.runningCount}`;
  els.trueCount.textContent = snapshot.shoe.trueCountText;
  els.playerEdge.textContent = `${signed(snapshot.telemetry.playerEdge, 2)}%`;
  els.playerEdge.style.color = snapshot.telemetry.playerEdge >= 0 ? 'var(--green)' : 'var(--red)';

  const suggested = snapshot.shoe.trueCount <= 1 ? CFG.minBet : Math.min(snapshot.bankroll, Math.max(CFG.minBet, Math.round(snapshot.shoe.trueCount * 25)));
  els.kellyHint.textContent = `Kelly Suggest: ${money(suggested)} · TC ${snapshot.shoe.trueCountText}`;

  if (snapshot.telemetry.optimal) {
    const prob = snapshot.telemetry.winProbability == null ? '' : ` · Win prob ${snapshot.telemetry.winProbability}%`;
    els.optimalMove.textContent = snapshot.telemetry.optimal.label;
    els.deviationNote.textContent = `${snapshot.telemetry.optimal.deviationNote}${prob}`;
  } else {
    els.optimalMove.textContent = '—';
    els.deviationNote.textContent = snapshot.phase === 'betting' || snapshot.phase === 'roundOver' ? 'Deal next hand to get strategy help.' : '';
  }

  els.insurancePanel.hidden = snapshot.phase !== 'insurance';
  const insPositive = snapshot.shoe.trueCount >= 3;
  els.insuranceText.textContent = insPositive
    ? `Insurance EV positive at TC ${snapshot.shoe.trueCountText}. Buying can be justified.`
    : `Insurance EV negative at TC ${snapshot.shoe.trueCountText}. Basic strategy says decline.`;

  els.handsPlayed.textContent = String(snapshot.session.hands);
  const winRate = snapshot.session.hands ? (snapshot.session.wins / snapshot.session.hands) * 100 : 0;
  els.winRate.textContent = `${winRate.toFixed(1)}%`;
  els.profit.textContent = `${snapshot.session.profit >= 0 ? '+' : '-'}${money(Math.abs(snapshot.session.profit))}`;
  els.profit.style.color = snapshot.session.profit >= 0 ? 'var(--green)' : 'var(--red)';
  els.blackjacks.textContent = String(snapshot.session.blackjacks);

  els.history.innerHTML = snapshot.session.history.map(result => `<span class="${classForResult(result)}" title="${result}"></span>`).join('');

  showToast(snapshot.message, snapshot.toastType, els.toast);
}

function labelPhase(phase: GameSnapshot['phase']): string {
  const labels: Record<GameSnapshot['phase'], string> = {
    betting: 'Betting',
    insurance: 'Insurance',
    player: 'Player Turn',
    dealer: 'Dealer Turn',
    roundOver: 'Round Over'
  };
  return labels[phase];
}

function classForResult(result: RoundResult): string {
  if (result === 'bj') return 'bj';
  return result;
}

function showToast(message: string, type: GameSnapshot['toastType'], toast: HTMLElement): void {
  toast.textContent = message;
  toast.className = `toast is-on ${type === 'bj' ? 'win' : type ?? 'info'}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-on');
  }, type === 'lose' ? 3200 : 2100);
}
