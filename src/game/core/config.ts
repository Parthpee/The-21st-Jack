export const CFG = {
  decks: 6,
  startBankroll: 1000,
  minBet: 10,
  maxBet: 500,
  blackjackPay: 1.5,
  insurancePay: 2,
  dealerHitsSoft17: true,
  doubleAfterSplit: true,
  lateSurrender: true,
  maxHands: 4,
  penetration: 0.75
} as const;
