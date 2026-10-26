import Phaser from 'phaser';
import { CONFIG } from '../data/config.js';
import CAPTIONS from '../data/captions.json';
import { makeButton, TEXT_STYLE } from '../ui/Button.js';
import { pickCaption, pickFact } from '../systems/Facts.js';
import { loadJSON, saveJSON } from '../systems/Storage.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    const { width, height } = CONFIG;
    this.result = data;
    const W = width;

    const prevHigh = Number(loadJSON(CONFIG.storageKeys.highScore, 0)) || 0;
    const isRecord = data.score > prevHigh;
    const high = Math.max(prevHigh, data.score);
    if (isRecord) saveJSON(CONFIG.storageKeys.highScore, high);

    this.caption = pickCaption(data.cause, CAPTIONS, data.seconds);
    this.fact = pickFact(data.cause);

    this.add.rectangle(0, 0, width, height, 0x1b1b1f).setOrigin(0);
    this.add.rectangle(W / 2, 0, W, 8, 0xe63946).setOrigin(0.5, 0);

    this.add
      .text(W / 2, 92, this.caption, {
        ...TEXT_STYLE,
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#f2c14e',
        align: 'center',
        wordWrap: { width: W - 40 },
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, 150, `Detik ke-${data.seconds} · ${data.distance} m`, { ...TEXT_STYLE, fontSize: '15px', color: '#bdbdbd' })
      .setOrigin(0.5);

    this.add.text(W / 2, 192, 'SKOR', { ...TEXT_STYLE, fontSize: '14px', color: '#bdbdbd' }).setOrigin(0.5);
    this.add.text(W / 2, 232, `${data.score}`, { ...TEXT_STYLE, fontSize: '54px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add
      .text(W / 2, 280, isRecord ? 'SKOR TERTINGGI BARU!' : `Skor tertinggi: ${high}`, {
        ...TEXT_STYLE,
        fontSize: '16px',
        fontStyle: isRecord ? 'bold' : 'normal',
        color: isRecord ? '#7dff9a' : '#e0e0e0',
      })
      .setOrigin(0.5);

    const lights = data.lightsObeyed + data.lightsRan;
    const lines = [
      `Poin tertib: ${data.tertib}`,
      `Lampu merah dipatuhi: ${data.lightsObeyed}/${lights}`,
      `Pelanggaran ETLE: ${data.etle}`,
      data.helmet ? 'Pakai helm' : 'Tanpa helm',
    ];
    this.add
      .text(W / 2, 334, lines.join('\n'), { ...TEXT_STYLE, fontSize: '15px', align: 'center', lineSpacing: 4, color: '#e0e0e0' })
      .setOrigin(0.5);

    this.drawFact(W / 2, 470, W - 32);

    makeButton(this, W / 2, 586, 'Main lagi', () => this.restart());
    makeButton(this, W / 2 - 68, 650, 'Bagikan', () => this.share(), {
      width: 124,
      height: 46,
      fontSize: '18px',
      fill: 0x8fd3ff,
    });
    makeButton(this, W / 2 + 68, 650, 'Menu', () => this.scene.start('MenuScene'), {
      width: 124,
      height: 46,
      fontSize: '18px',
      fill: 0x9a9a92,
    });

    this.add
      .text(W / 2, height - 22, 'Tap di mana saja untuk main lagi', { ...TEXT_STYLE, fontSize: '12px', color: '#9a9a9a' })
      .setOrigin(0.5);

    // Tap di area kosong (bukan tombol) setelah jeda singkat = main lagi.
    this.readyAt = this.time.now + CONFIG.gameOver.tapAnywhereDelayMs;
    this.input.on('pointerup', (_p, over) => {
      if (over.length === 0 && this.time.now >= this.readyAt) this.restart();
    });
    this.input.keyboard.on('keydown-SPACE', () => this.time.now >= this.readyAt && this.restart());
    this.input.keyboard.on('keydown-ENTER', () => this.time.now >= this.readyAt && this.restart());
  }

  drawFact(x, y, w) {
    const box = this.add.graphics();
    box.fillStyle(0x2a2a30, 1).fillRoundedRect(x - w / 2, y - 62, w, 124, 10);
    box.lineStyle(2, 0x8fd3ff, 0.8).strokeRoundedRect(x - w / 2, y - 62, w, 124, 10);
    this.add.text(x - w / 2 + 12, y - 54, 'TAHUKAH KAMU?', { ...TEXT_STYLE, fontSize: '12px', fontStyle: 'bold', color: '#8fd3ff' });
    if (!this.fact) return;
    this.add.text(x - w / 2 + 12, y - 34, this.fact.text, {
      ...TEXT_STYLE,
      fontSize: '14px',
      lineSpacing: 2,
      wordWrap: { width: w - 24 },
    });
    this.add
      .text(x + w / 2 - 12, y + 54, `Sumber: ${this.fact.source}`, { ...TEXT_STYLE, fontSize: '11px', color: '#9a9a9a' })
      .setOrigin(1, 1);
  }

  restart() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('GameScene', { helmet: this.result.helmet });
  }

  share() {}
}
