import Phaser from 'phaser';
import { CONFIG } from '../data/config.js';
import { makeButton, TEXT_STYLE } from '../ui/Button.js';
import { CAUSE_LABELS, loadStats, summarize } from '../systems/Stats.js';
import { loadJSON } from '../systems/Storage.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = CONFIG;
    this.add.tileSprite(0, 0, width, height, 'road').setOrigin(0).setAlpha(0.35);

    this.add
      .text(width / 2, 120, 'LAMPU MERAH\nJAKARTA', {
        ...TEXT_STYLE,
        fontSize: '44px',
        fontStyle: 'bold',
        align: 'center',
        color: '#f2c14e',
        stroke: '#1b1b1f',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 215, 'Bertahan sejauh mungkin.\nTertib dapat poin, ugal-ugalan ada akibatnya.', {
        ...TEXT_STYLE,
        fontSize: '15px',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add.text(width / 2, 300, 'Sebelum jalan:', { ...TEXT_STYLE, fontSize: '18px' }).setOrigin(0.5);

    makeButton(this, width / 2, 350, 'Pakai helm', () => this.startGame(true));
    this.add
      .text(width / 2, 388, 'Selamat dari 1 tabrakan', { ...TEXT_STYLE, fontSize: '13px', color: '#cfcfcf' })
      .setOrigin(0.5);

    makeButton(this, width / 2, 440, 'Tanpa helm', () => this.startGame(false), { fill: 0x9a9a92 });
    this.add
      .text(width / 2, 478, 'Lebih ngebut 10%, sekali tabrak tamat', {
        ...TEXT_STYLE,
        fontSize: '13px',
        color: '#cfcfcf',
      })
      .setOrigin(0.5);

    makeButton(this, width / 2, 548, 'Statistik', () => this.showStats(), {
      width: 180,
      height: 44,
      fontSize: '18px',
      fill: 0x8fd3ff,
    });
    const high = Number(loadJSON(CONFIG.storageKeys.highScore, 0)) || 0;
    this.add
      .text(width / 2, 590, `Skor tertinggi: ${high}`, { ...TEXT_STYLE, fontSize: '15px', color: '#f2c14e' })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height - 70,
        'Tap kiri/kanan atau ← → : pindah lajur\nTahan layar atau SPASI : rem',
        { ...TEXT_STYLE, fontSize: '14px', align: 'center', color: '#e0e0e0' },
      )
      .setOrigin(0.5);
  }

  showStats() {
    if (this.statsPanel) return;
    const { width, height } = CONFIG;
    const sum = summarize(loadStats());
    const fmt = (v) => (v === null ? '-' : `${v}%`);
    const top = sum.topCause ? `${CAUSE_LABELS[sum.topCause.cause] ?? sum.topCause.cause} (${sum.topCause.count}x)` : '-';
    const lines = [
      `Jumlah ronde: ${sum.rounds}`,
      `Ronde pakai helm: ${fmt(sum.helmetPct)}`,
      `Lampu merah dipatuhi: ${fmt(sum.obeyPct)}`,
      `   (dari ${sum.lightsTotal} lampu merah)`,
      '',
      'Penyebab game over terbanyak:',
      top,
    ];

    const panel = this.add.container(0, 0).setDepth(50);
    const shade = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
    const box = this.add.graphics();
    box.fillStyle(0x2a2a30, 1).fillRoundedRect(24, 150, width - 48, 380, 14);
    box.lineStyle(2, 0x8fd3ff, 1).strokeRoundedRect(24, 150, width - 48, 380, 14);
    const title = this.add
      .text(width / 2, 186, 'STATISTIK', { ...TEXT_STYLE, fontSize: '24px', fontStyle: 'bold', color: '#8fd3ff' })
      .setOrigin(0.5);
    const body = this.add
      .text(48, 226, lines.join('\n'), { ...TEXT_STYLE, fontSize: '17px', lineSpacing: 6, wordWrap: { width: width - 96 } });
    const note = this.add
      .text(width / 2, 446, 'Tersimpan hanya di perangkat ini.', { ...TEXT_STYLE, fontSize: '12px', color: '#9a9a9a' })
      .setOrigin(0.5);
    const close = makeButton(this, width / 2, 488, 'Tutup', () => {
      panel.destroy();
      this.statsPanel = null;
    }, { width: 160, height: 44, fontSize: '18px' });
    panel.add([shade, box, title, body, note, close]);
    this.statsPanel = panel;
  }

  startGame(helmet) {
    this.scene.start('GameScene', { helmet });
  }
}
