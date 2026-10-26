import Phaser from 'phaser';
import { CONFIG, laneX } from '../data/config.js';

// Motor pemain. Posisi y tetap; jalan yang bergerak.
export default class Player extends Phaser.GameObjects.Container {
  constructor(scene, helmet) {
    const cfg = CONFIG.player;
    super(scene, laneX(1), cfg.y);
    this.cfg = cfg;
    this.lane = 1;
    this.helmet = helmet;
    this.invulnerableUntil = 0;
    this.speed = 0;

    const w = cfg.width;
    const h = cfg.height;
    this.bodyRect = scene.add.rectangle(0, 0, w, h, 0xe63946).setStrokeStyle(2, 0x1b1b1f);
    this.wheelFront = scene.add.rectangle(0, -h / 2 + 2, 8, 8, 0x111111);
    this.wheelBack = scene.add.rectangle(0, h / 2 - 2, 8, 8, 0x111111);
    this.headlight = scene.add.circle(0, -h / 2 + 3, 3, 0xfff3b0);
    // Pengendara dilihat dari atas: lingkaran kepala, warna helm atau rambut.
    this.head = scene.add.circle(0, 2, 8, helmet ? 0xffffff : 0x3a2a1a).setStrokeStyle(2, 0x1b1b1f);
    this.crack = scene.add.graphics().setVisible(false);
    this.crack.lineStyle(2, 0x1b1b1f).beginPath();
    this.crack.moveTo(-5, -3).lineTo(-1, 1).lineTo(-3, 4).lineTo(3, 6).strokePath();
    this.brakeLight = scene.add.rectangle(0, h / 2 - 1, 12, 4, 0xff2222).setVisible(false);

    this.add([this.wheelFront, this.wheelBack, this.bodyRect, this.headlight, this.brakeLight, this.head, this.crack]);
    scene.add.existing(this);
  }

  moveLane(dir) {
    const target = Phaser.Math.Clamp(this.lane + dir, 0, CONFIG.road.lanes - 1);
    if (target === this.lane) return;
    this.lane = target;
    this.scene.tweens.killTweensOf(this, ['x']);
    this.scene.tweens.add({
      targets: this,
      x: laneX(target),
      duration: this.cfg.laneTweenMs,
      ease: 'Sine.easeOut',
    });
  }

  setBraking(on) {
    this.brakeLight.setVisible(on);
  }

  isInvulnerable(now) {
    return now < this.invulnerableUntil;
  }

  // Helm menyelamatkan dari satu tabrakan.
  crackHelmet(now) {
    this.helmet = false;
    this.helmetCracked = true;
    this.crack.setVisible(true);
    this.head.setFillStyle(0xdddddd);
    this.invulnerableUntil = now + this.cfg.invulnerableMs;
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 120,
      yoyo: true,
      repeat: Math.floor(this.cfg.invulnerableMs / 240) - 1,
      onComplete: () => this.setAlpha(1),
    });
  }

  // Kotak tabrakan (sedikit diperkecil supaya terasa adil).
  getHitbox() {
    const w = this.cfg.width - 4;
    const h = this.cfg.height - 6;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  get top() {
    return this.y - this.cfg.height / 2;
  }
}
