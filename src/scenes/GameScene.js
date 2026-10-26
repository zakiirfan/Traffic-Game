import Phaser from 'phaser';
import { CONFIG, laneX } from '../data/config.js';
import { TEXT_STYLE } from '../ui/Button.js';
import Player from '../objects/Player.js';
import { createObstacle, DEATH_CAUSE } from '../objects/Obstacle.js';
import { cruiseSpeed, getPhase } from '../systems/Difficulty.js';
import { Spawner } from '../systems/Spawner.js';

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

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
    this.player.setDepth(20);

    this.obstacles = [];
    this.spawner = new Spawner();
    this.metersSinceSpawn = 0;

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
    const dm = dy / CONFIG.pxPerMeter;
    this.distanceMeters += dm;

    this.updateSpawning(dm, cruise);
    this.updateObstacles(dt);
    this.checkCollisions();
    if (this.isOver) return;

    this.hudScore.setText(`${Math.floor(this.distanceMeters)} m`);
    this.hudInfo.setText(`${Math.round((p.speed / CONFIG.pxPerMeter) * 3.6)} km/j`);
  }

  spawnPaused() {
    return false;
  }

  updateSpawning(dm, cruise) {
    this.metersSinceSpawn += dm;
    const phase = getPhase(this.elapsed);
    if (this.metersSinceSpawn < phase.spawnEveryMeters) return;
    this.metersSinceSpawn = 0;
    if (this.spawnPaused()) return;
    const specs = this.spawner.generateRow({
      phase,
      playerSpeed: cruise,
      activeStates: this.obstacles.map((o) => o.toState()),
    });
    for (const spec of specs) this.obstacles.push(createObstacle(this, spec));
  }

  updateObstacles(dt) {
    const ctx = {
      now: this.time.now,
      noBrakeZone: this.spawnPaused(),
      // Dipakai ojol sebelum pindah lajur: ada kendaraan di dekatnya, atau motor lawan arus yang
      // masih akan datang dari atas.
      isLaneBusy: (lane, y, self) =>
        this.obstacles.some(
          (o) =>
            o !== self &&
            o.isVehicle &&
            o.lane === lane &&
            (Math.abs(o.y - y) < (o.h + self.h) / 2 + 60 || (o.type === 'wrongway' && o.y < y)),
        ),
    };
    this.keepNpcSpacing();
    for (const o of this.obstacles) o.step(dt, this.player.speed, ctx);
    this.obstacles = this.obstacles.filter((o) => {
      if (o.isGone()) {
        o.destroy();
        return false;
      }
      return true;
    });
  }

  // Kendaraan searah yang menyusul kendaraan lain di lajur yang sama ikut melambat (tidak tembus).
  keepNpcSpacing() {
    const vehicles = this.obstacles.filter((o) => o.isVehicle && o.ownSpeed > 0);
    for (const back of vehicles) {
      for (const front of this.obstacles) {
        if (front === back || !front.isVehicle || front.lane !== back.lane || front.y >= back.y) continue;
        const gap = back.y - back.h / 2 - (front.y + front.h / 2);
        if (gap < 16) back.ownSpeed = Math.min(back.ownSpeed, Math.max(0, front.ownSpeed));
      }
    }
  }

  checkCollisions() {
    const p = this.player;
    if (p.isInvulnerable(this.time.now)) return;
    const hb = p.getHitbox();
    for (const o of this.obstacles) {
      if (overlaps(hb, o.getHitbox())) {
        this.handleCrash(DEATH_CAUSE[o.type], o);
        return;
      }
    }
  }

  // Tabrakan: helm menyelamatkan satu kali, selain itu game over.
  handleCrash(cause, obstacle) {
    const p = this.player;
    if (p.helmet) {
      p.crackHelmet(this.time.now);
      this.cameras.main.shake(180, 0.01);
      this.floatText(p.x, p.y - 40, 'HELM RETAK!', '#ffffff');
      if (obstacle) {
        this.obstacles = this.obstacles.filter((o) => o !== obstacle);
        this.tweens.add({ targets: obstacle, alpha: 0, duration: 250, onComplete: () => obstacle.destroy() });
      }
      return;
    }
    this.gameOver(cause);
  }

  gameOver(cause) {
    if (this.isOver) return;
    this.isOver = true;
    this.player.setBraking(false);
    this.cameras.main.shake(250, 0.015);
    this.cameras.main.flash(150, 255, 60, 60);
    this.time.delayedCall(650, () => {
      this.scene.start('GameOverScene', {
        cause,
        helmet: this.helmetChoice,
        seconds: Math.floor(this.elapsed),
        distance: Math.floor(this.distanceMeters),
      });
    });
  }

  floatText(x, y, msg, color = '#ffffff') {
    const t = this.add
      .text(x, y, msg, { ...TEXT_STYLE, fontSize: '18px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(110);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  scrollWorld(dy) {
    this.road.tilePositionY -= dy;
    for (const t of this.buswayLabels) {
      t.y += dy;
      if (t.y > CONFIG.height + 60) t.y -= 260 * this.buswayLabels.length;
    }
  }
}
