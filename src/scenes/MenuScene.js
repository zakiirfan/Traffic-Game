import Phaser from 'phaser';
import { CONFIG } from '../data/config.js';
import { makeButton, TEXT_STYLE } from '../ui/Button.js';

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

    this.add
      .text(
        width / 2,
        height - 70,
        'Tap kiri/kanan atau ← → : pindah lajur\nTahan layar atau SPASI : rem',
        { ...TEXT_STYLE, fontSize: '14px', align: 'center', color: '#e0e0e0' },
      )
      .setOrigin(0.5);
  }

  startGame(helmet) {
    this.scene.start('GameScene', { helmet });
  }
}
