import Phaser from 'phaser';
import { CONFIG, laneX } from '../data/config.js';

// Tiang kamera ETLE generik di trotoar kanan, mengawasi jalur busway.
// Garis deteksi tipis di busway menunjukkan titik pemotretan.
export default class EtleCamera extends Phaser.GameObjects.Container {
  constructor(scene, y) {
    super(scene, 0, y);
    this.triggered = false;
    this.setDepth(7);

    const W = CONFIG.width;
    const px = W - CONFIG.road.sidewalkWidth / 2 + 6;
    const bx = laneX(CONFIG.road.buswayLane);
    const lw = CONFIG.road.laneWidth;

    // Garis deteksi putus-putus di busway.
    for (let x = bx - lw / 2 + 4; x < bx + lw / 2 - 4; x += 14) {
      this.add(scene.add.rectangle(x + 4, 0, 8, 2, 0xffffff, 0.55));
    }
    this.add(scene.add.rectangle(px, 0, 5, 46, 0x2b2b2b));
    this.add(scene.add.rectangle(px - 12, -18, 26, 14, 0xe0e0e0).setStrokeStyle(2, 0x2b2b2b));
    this.add(scene.add.circle(px - 22, -18, 4, 0x1b1b1f));
    this.add(
      scene.add
        .text(px - 10, -18, 'ETLE', { fontFamily: 'Arial', fontSize: '8px', fontStyle: 'bold', color: '#1b1b1f' })
        .setOrigin(0.5),
    );
    this.led = scene.add.circle(px - 2, -26, 2.5, 0xff3030);
    this.add(this.led);
    scene.tweens.add({ targets: this.led, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });

    scene.add.existing(this);
  }

  step(dt, playerSpeed) {
    this.y += playerSpeed * dt;
  }

  isGone() {
    return this.y > CONFIG.height + 60;
  }

  destroy(fromScene) {
    this.scene?.tweens.killTweensOf(this.led);
    super.destroy(fromScene);
  }
}
