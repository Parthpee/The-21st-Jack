import Phaser from 'phaser';
import { engine } from '../runtime';
import type { Card } from '../core/cards';
import type { GameSnapshot, PlayerHand } from '../core/blackjack';
import { evaluateHand } from '../core/hand';

const GOLD = 0xc8a35a;
const GOLD_HI = 0xf4d483;
const WHITE = 0xf7f7fb;
const RED = 0xc92222;
const BLACK = 0x111118;
const GREEN = 0x34d399;
const BLUE = 0x60a5fa;
const DANGER = 0xf87171;

export class TableScene extends Phaser.Scene {
  private layer?: Phaser.GameObjects.Container;
  private lastPhase = '';

  constructor() {
    super('table');
  }

  create(): void {
    this.scale.on('resize', () => this.render(engine.snapshot()));

    this.input.keyboard?.on('keydown-SPACE', () => engine.startRound());
    this.input.keyboard?.on('keydown-H', () => engine.hit());
    this.input.keyboard?.on('keydown-S', () => engine.stand());
    this.input.keyboard?.on('keydown-D', () => engine.double());
    this.input.keyboard?.on('keydown-P', () => engine.split());
    this.input.keyboard?.on('keydown-R', () => engine.surrender());

    engine.subscribe(snapshot => this.render(snapshot));
  }

  private render(snapshot: GameSnapshot): void {
    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);

    const { width, height } = this.scale;
    const compact = width < 700 || height < 560;
    this.drawBackground(width, height, compact);

    const baseCardWidth = compact ? Math.min(width * 0.13, height * 0.145) : width * 0.075;
    const cardW = Phaser.Math.Clamp(baseCardWidth, compact ? 38 : 54, compact ? 68 : 92);
    const cardH = cardW * 1.42;
    const centerX = width / 2;

    this.addLabel(centerX, compact ? height * 0.065 : height * 0.075, 'DEALER');
    this.drawDealer(snapshot, centerX, compact ? height * 0.19 : height * 0.17, cardW, cardH);

    this.drawTableMarks(width, height, compact);
    this.drawHands(snapshot, centerX, compact ? height * 0.64 : height * 0.58, cardW, cardH);

    const phaseText = snapshot.phase === 'player'
      ? `Hand ${snapshot.activeHandIndex + 1} · ${snapshot.message}`
      : snapshot.message;
    this.addStatus(centerX, height - (compact ? 22 : 36), phaseText, snapshot.toastType);

    this.lastPhase = snapshot.phase;
  }

  private drawBackground(width: number, height: number, compact = false): void {
    if (!this.layer) return;
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a2a1f, 0x061b14, 0x03100b, 0x020806, 1);
    g.fillRect(0, 0, width, height);

    const outerPadX = compact ? width * 0.035 : width * 0.05;
    const outerPadY = compact ? height * 0.055 : height * 0.08;
    g.lineStyle(2, GOLD, 0.24);
    g.strokeRoundedRect(outerPadX, outerPadY, width - outerPadX * 2, height - outerPadY * 1.55, compact ? 22 : 34);
    g.lineStyle(1, 0xffffff, 0.06);
    g.strokeRoundedRect(outerPadX + width * 0.02, outerPadY + height * 0.03, width - (outerPadX + width * 0.02) * 2, height - outerPadY * 2.05, compact ? 16 : 26);

    for (let i = 0; i < 90; i += 1) {
      const x = (i * 137) % width;
      const y = (i * 71) % height;
      g.fillStyle(0xffffff, 0.025);
      g.fillCircle(x, y, 1.1);
    }

    this.layer.add(g);
  }

  private drawTableMarks(width: number, height: number, compact = false): void {
    if (!this.layer) return;
    const text = this.add.text(width / 2, compact ? height * 0.40 : height * 0.38, 'BLACKJACK PAYS 3 TO 2', {
      color: '#c8a35a',
      fontFamily: 'Georgia, serif',
      fontSize: `${Phaser.Math.Clamp(width * (compact ? 0.038 : 0.025), 13, compact ? 22 : 28)}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(compact ? 0.25 : 0.38);

    const sub = this.add.text(width / 2, compact ? height * 0.455 : height * 0.425, 'INSURANCE PAYS 2 TO 1', {
      color: '#ffffff',
      fontFamily: 'Inter, system-ui',
      fontSize: `${Phaser.Math.Clamp(width * (compact ? 0.022 : 0.014), 9, 16)}px`,
    }).setOrigin(0.5).setAlpha(compact ? 0.14 : 0.2);

    this.layer.add([text, sub]);
  }

  private drawDealer(snapshot: GameSnapshot, centerX: number, y: number, cardW: number, cardH: number): void {
    if (!this.layer) return;
    const hidden = snapshot.phase === 'player' || snapshot.phase === 'insurance';
    const count = Math.max(snapshot.dealer.length, 2);
    const gap = cardW * 0.52;
    const startX = centerX - ((count - 1) * gap) / 2;

    snapshot.dealer.forEach((card, index) => {
      const cardObj = this.createCard(startX + index * gap, y, cardW, cardH, card, hidden && index === 1);
      this.layer?.add(cardObj);
    });

    const visibleCards = hidden ? [snapshot.dealer[0]].filter(Boolean) : snapshot.dealer;
    const score = visibleCards.length ? evaluateHand(visibleCards).total : 0;
    const scoreText = hidden ? String(snapshot.dealer[0]?.value ?? '—') : String(score);
    this.addScore(centerX, y + cardH / 2 + 22, scoreText, !hidden && score > 21 ? 'bust' : 'normal');
  }

  private drawHands(snapshot: GameSnapshot, centerX: number, y: number, cardW: number, cardH: number): void {
    if (!this.layer) return;
    if (!snapshot.hands.length) {
      this.drawEmptySeat(centerX, y, cardW, cardH);
      return;
    }

    const compact = this.scale.width < 700 || this.scale.height < 560;
    const handGap = Math.min(cardW * (compact ? 2.45 : 3.0), this.scale.width / Math.max(compact ? 1.25 : 1.5, snapshot.hands.length));
    const startX = centerX - ((snapshot.hands.length - 1) * handGap) / 2;

    snapshot.hands.forEach((hand, index) => {
      const x = startX + index * handGap;
      this.drawHand(hand, x, y, cardW, cardH, index === snapshot.activeHandIndex && snapshot.phase === 'player', snapshot.hands.length);
    });
  }

  private drawHand(hand: PlayerHand, centerX: number, y: number, cardW: number, cardH: number, active: boolean, totalHands: number): void {
    if (!this.layer) return;
    const compact = this.scale.width < 700 || this.scale.height < 560;
    const scale = totalHands > 3 ? (compact ? 0.62 : 0.74) : totalHands > 2 ? (compact ? 0.74 : 0.84) : 1;
    const w = cardW * scale;
    const h = cardH * scale;
    const gap = w * 0.42;
    const startX = centerX - ((hand.cards.length - 1) * gap) / 2;

    if (active) {
      const glow = this.add.graphics();
      glow.fillStyle(GOLD, 0.09);
      const glowW = Math.max(w * 2.4, w * (1.35 + hand.cards.length * 0.42));
      glow.fillRoundedRect(centerX - glowW / 2, y - h * 0.68, glowW, h * 1.68, compact ? 18 : 26);
      glow.lineStyle(2, GOLD, 0.34);
      glow.strokeRoundedRect(centerX - glowW / 2, y - h * 0.68, glowW, h * 1.68, compact ? 18 : 26);
      this.layer.add(glow);
    }

    hand.cards.forEach((card, index) => {
      const cardObj = this.createCard(startX + index * gap, y, w, h, card, false);
      this.layer?.add(cardObj);
    });

    const value = evaluateHand(hand.cards);
    this.addScore(centerX, y + h / 2 + 22, value.bust ? `${value.total} BUST` : String(value.total), value.bust ? 'bust' : value.total >= 18 ? 'good' : 'normal');

    const bet = this.add.text(centerX, y + h / 2 + 52, `$${hand.bet}`, {
      color: '#f4d483',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: `${compact ? 10 : 13}px`,
      fontStyle: 'bold',
      backgroundColor: 'rgba(200,163,90,0.12)',
      padding: { x: 9, y: 4 }
    }).setOrigin(0.5);
    this.layer.add(bet);

    if (hand.resultText) {
      const result = this.add.text(centerX, y - h / 2 - (compact ? 16 : 24), hand.resultText, {
        color: hand.result === 'win' || hand.result === 'bj' ? '#34d399' : hand.result === 'push' ? '#60a5fa' : '#f87171',
        fontFamily: 'Inter, system-ui',
        fontSize: `${compact ? 11 : 14}px`,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.layer.add(result);
    }
  }

  private drawEmptySeat(centerX: number, y: number, cardW: number, cardH: number): void {
    if (!this.layer) return;
    const g = this.add.graphics();
    g.lineStyle(2, GOLD, 0.18);
    g.strokeRoundedRect(centerX - cardW * 1.6, y - cardH * 0.65, cardW * 3.2, cardH * 1.3, 26);
    this.layer.add(g);
    const label = this.add.text(centerX, y, 'PLACE BET TO START', {
      color: '#c8a35a',
      fontFamily: 'Inter, system-ui',
      fontSize: `${Phaser.Math.Clamp(this.scale.width * 0.03, 11, 14)}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.65);
    this.layer.add(label);
  }

  private createCard(x: number, y: number, w: number, h: number, card: Card, hidden = false): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();

    if (hidden) {
      g.fillGradientStyle(0x12345a, 0x0d2949, 0x07172b, 0x061120, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2, 0xffffff, 0.12);
      g.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 6);
      g.lineStyle(1, GOLD, 0.18);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      c.add(g);
      const back = this.add.text(0, 0, '◆', { color: '#c8a35a', fontSize: `${w * 0.45}px` }).setOrigin(0.5).setAlpha(0.8);
      c.add(back);
    } else {
      g.fillStyle(0xf8f7f2, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(1, 0x000000, 0.12);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      c.add(g);

      const color = card.red ? RED : BLACK;
      const rankSize = Math.max(12, w * 0.22);
      const suitSize = Math.max(18, w * 0.42);
      const smallSuit = Math.max(10, w * 0.18);
      const top = this.add.text(-w / 2 + 8, -h / 2 + 6, `${card.rank}\n${card.suit}`, {
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        fontFamily: 'Georgia, serif',
        fontSize: `${rankSize}px`,
        fontStyle: 'bold',
        align: 'center',
        lineSpacing: -3
      }).setOrigin(0, 0);
      const center = this.add.text(0, 0, card.suit, {
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        fontFamily: 'Georgia, serif',
        fontSize: `${suitSize}px`,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      const bottom = this.add.text(w / 2 - 8, h / 2 - 6, `${card.rank}\n${card.suit}`, {
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        fontFamily: 'Georgia, serif',
        fontSize: `${smallSuit}px`,
        fontStyle: 'bold',
        align: 'center',
        lineSpacing: -3
      }).setOrigin(1, 1).setAngle(180);
      c.add([top, center, bottom]);
    }

    c.setScale(0.98);
    if (this.lastPhase !== 'player' && this.lastPhase !== 'dealer') {
      c.setAlpha(0).setY(y - 24);
      this.tweens.add({ targets: c, y, alpha: 1, duration: 160, ease: 'Cubic.Out' });
    }
    return c;
  }

  private addLabel(x: number, y: number, value: string): void {
    if (!this.layer) return;
    const text = this.add.text(x, y, value, {
      color: '#ffffff',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: `${Phaser.Math.Clamp(this.scale.width * 0.025, 9, 12)}px`,
    }).setOrigin(0.5).setAlpha(0.34);
    this.layer.add(text);
  }

  private addScore(x: number, y: number, value: string, mood: 'normal' | 'good' | 'bust'): void {
    if (!this.layer) return;
    const color = mood === 'bust' ? DANGER : mood === 'good' ? GREEN : WHITE;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.lineStyle(1, color, 0.35);
    const pillW = Phaser.Math.Clamp(this.scale.width * 0.09, 56, 84);
    bg.fillRoundedRect(x - pillW / 2, y - 14, pillW, 28, 8);
    bg.strokeRoundedRect(x - pillW / 2, y - 14, pillW, 28, 8);
    const text = this.add.text(x, y, value, {
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: `${Phaser.Math.Clamp(this.scale.width * 0.03, 11, 14)}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.layer.add([bg, text]);
  }

  private addStatus(x: number, y: number, value: string, type: GameSnapshot['toastType']): void {
    if (!this.layer) return;
    const color = type === 'win' || type === 'bj' ? GREEN : type === 'lose' ? DANGER : type === 'push' ? BLUE : GOLD_HI;
    const text = this.add.text(x, y, value, {
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontFamily: 'Inter, system-ui',
      fontSize: `${Phaser.Math.Clamp(this.scale.width * 0.018, 13, 22)}px`,
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);
    this.layer.add(text);
  }
}
