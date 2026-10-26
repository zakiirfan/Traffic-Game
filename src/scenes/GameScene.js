import Phaser from 'phaser';
import { CONFIG, laneX } from '../data/config.js';
import { TEXT_STYLE } from '../ui/Button.js';
import Player from '../objects/Player.js';
import { cruiseSpeed } from '../systems/Difficulty.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.helmetChoice = data?.helmet ?? true;
  }

  create() {
    const { width, height } = CONFIG;
    this.elapsed = 0;
    this.distanceMeters = 0;
    this.isOver = false;

    this.road = this.add.tileSprite(0, 0, width, height, 'road').setOrigin(0);
    this.buswayLabels = [];
    for (let i = 0; i < 3; i++) {
      const t = this.add
        .text(laneX(CONFIG.road.buswayLane), i * 260, 'BUSWAY', {
          ...TEXT_STYLE,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#f3d9d2',
        })
        .setOrigin(0.5)
        .setAngle(-90)
        .setAlpha(0.8);
      this.buswayLabels.push(t);
    }

    this.player = new Player(this, this.helmetChoice);
    this.player.speed = cruiseSpeed(0, this.helmetChoice);

    this.setupInput();
    this.createHud();
  }

  setupInput() {
    this.pointerDownAt = null;
    this.touchBraking = false;
    this.input.on('pointerdown', (p) => {
      this.pointerDownAt = this.time.now;
      this.pointerDownX = p.x;
      this.touchBraking = false;
    });
    this.input.on('pointerup', () => {
      if (this.pointerDownAt === null) return;
      const held = this.time.now - this.pointerDownAt;
      if (!this.touchBraking && held < CONFIG.player.holdToBrakeMs && !this.isOver) {
        this.player.moveLane(this.pointerDownX < CONFIG.width / 2 ? -1 : 1);
      }
      this.pointerDownAt = null;
      this.touchBraking = false;
    });

    // Event keydown (bukan JustDown) supaya dua tekanan cepat dalam satu frame tetap terhitung.
    const kb = this.input.keyboard;
    const steer = (dir) => () => !this.isOver && this.player.moveLane(dir);
    kb.on('keydown-LEFT', steer(-1));
    kb.on('keydown-A', steer(-1));
    kb.on('keydown-RIGHT', steer(1));
    kb.on('keydown-D', steer(1));
    this.keys = kb.addKeys({
      brake: Phaser.Input.Keyboard.KeyCodes.SPACE,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
    });
  }

  createHud() {
    this.hudScore = this.add
      .text(12, 10, '', { ...TEXT_STYLE, fontSize: '22px', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
      .setDepth(100);
    this.hudInfo = this.add
      .text(12, 40, '', { ...TEXT_STYLE, fontSize: '14px', stroke: '#000', strokeThickness: 3 })
      .setDepth(100);
  }

  readControls() {
    const k = this.keys;
    if (this.pointerDownAt !== null && this.time.now - this.pointerDownAt >= CONFIG.player.holdToBrakeMs) {
      this.touchBraking = true;
    }
    return k.brake.isDown || k.down.isDown || this.touchBraking;
  }

  update(_time, deltaMs) {
    if (this.isOver) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.elapsed += dt;

    const braking = this.readControls();
    const cruise = cruiseSpeed(this.elapsed, this.helmetChoice);
    const p = this.player;
    if (braking) {
      p.speed = Math.max(0, p.speed - CONFIG.player.brakeDecel * dt);
    } else if (p.speed < cruise) {
      p.speed = Math.min(cruise, p.speed + CONFIG.player.accel * dt);
    } else {
      p.speed = cruise;
    }
    p.setBraking(braking);

    const dy = p.speed * dt;
    this.scrollWorld(dy);
    this.distanceMeters += dy / CONFIG.pxPerMeter;

    this.hudScore.setText(`${Math.floor(this.distanceMeters)} m`);
    this.hudInfo.setText(`${Math.round((p.speed / CONFIG.pxPerMeter) * 3.6)} km/j`);
  }

  scrollWorld(dy) {
    this.road.tilePositionY -= dy;
    for (const t of this.buswayLabels) {
      t.y += dy;
      if (t.y > CONFIG.height + 60) t.y -= 260 * this.buswayLabels.length;
    }
  }
}
