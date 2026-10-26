import Phaser from 'phaser';
import { CONFIG } from '../data/config.js';

// Membuat tekstur sederhana (tanpa aset gambar) lalu masuk ke menu.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.makeRoadTexture();
    this.input.mouse?.disableContextMenu();
    this.scene.start('MenuScene');
  }

  // Satu potongan jalan setinggi 80 px yang diulang dengan TileSprite.
  makeRoadTexture() {
    const { width } = CONFIG;
    const { sidewalkWidth, laneWidth, lanes, buswayLane } = CONFIG.road;
    const h = 80;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Trotoar dengan garis ubin.
    g.fillStyle(0x9a9a92).fillRect(0, 0, width, h);
    g.lineStyle(1, 0x85857d);
    for (let y = 0; y < h; y += 20) {
      g.lineBetween(0, y, sidewalkWidth, y);
      g.lineBetween(width - sidewalkWidth, y, width, y);
    }

    // Aspal.
    const roadW = laneWidth * lanes;
    g.fillStyle(0x3b3b40).fillRect(sidewalkWidth, 0, roadW, h);

    // Jalur busway merah bata.
    const bx = sidewalkWidth + laneWidth * buswayLane;
    g.fillStyle(0x8e3b2e).fillRect(bx, 0, laneWidth, h);

    // Kanstin.
    g.fillStyle(0xd8d8d0).fillRect(sidewalkWidth - 4, 0, 4, h);
    g.fillRect(sidewalkWidth + roadW, 0, 4, h);

    // Garis putus-putus antar lajur biasa, garis penuh pemisah busway.
    g.fillStyle(0xf2f2f2);
    for (let i = 1; i < lanes; i++) {
      const x = sidewalkWidth + laneWidth * i;
      if (i === buswayLane) {
        g.fillRect(x - 2, 0, 4, h);
      } else {
        g.fillRect(x - 2, 0, 4, 40);
      }
    }

    g.generateTexture('road', width, h);
    g.destroy();
  }
}
