import Phaser from 'phaser';
import { CONFIG, laneX } from '../data/config.js';

// Penyebab kematian (dipakai caption, fakta, dan statistik) per jenis rintangan.
export const DEATH_CAUSE = {
  angkot: 'angkot',
  ojol: 'ojol',
  pedestrian: 'pejalan_kaki',
  pothole: 'lubang',
  wrongway: 'lawan_arus',
  bus: 'bus',
};

// Kelas dasar. Posisi y bergerak relatif terhadap pemain:
// laju di layar = kecepatan pemain - kecepatan sendiri.
export class Obstacle extends Phaser.GameObjects.Container {
  constructor(scene, spec) {
    super(scene, spec.x, spec.y);
    this.id = spec.id;
    this.type = spec.type;
    this.lane = spec.lane;
    this.w = spec.width;
    this.h = spec.height;
    this.ownSpeed = spec.ownSpeed ?? 0;
    this.cfg = CONFIG.obstacles[spec.type];
    this.isVehicle = false;
    this.setDepth(10);
    scene.add.existing(this);
  }

  // Jarak dari bagian bawah rintangan ke bagian depan motor pemain (px).
  dyToPlayer() {
    const p = CONFIG.player;
    return p.y - p.height / 2 - (this.y + this.h / 2);
  }

  step(dt, playerSpeed) {
    this.y += (playerSpeed - this.ownSpeed) * dt;
  }

  getHitbox() {
    const w = this.w - 4;
    const h = this.h - 4;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  isGone() {
    return this.y - this.h / 2 > CONFIG.height + 40 || this.y + this.h / 2 < -900;
  }

  toState() {
    return { id: this.id, type: this.type, lane: this.lane, y: this.y, height: this.h, ownSpeed: this.ownSpeed };
  }

  destroy(fromScene) {
    this.scene?.tweens.killTweensOf([this, ...this.list]);
    super.destroy(fromScene);
  }
}

export class Angkot extends Obstacle {
  constructor(scene, spec) {
    super(scene, spec);
    this.isVehicle = true;
    const { w, h } = this;
    this.add(scene.add.rectangle(0, 0, w, h, this.cfg.color).setStrokeStyle(2, 0x1b1b1f));
    this.add(scene.add.rectangle(0, -h / 2 + 12, w - 10, 14, 0x2b4d66)); // kaca depan
    this.add(scene.add.rectangle(0, h / 2 - 10, w - 10, 10, 0x2b4d66)); // kaca belakang
    this.add(scene.add.rectangle(0, 0, w - 4, 4, 0x1b1b1f, 0.35)); // garis atap
    this.brakeLights = [
      scene.add.rectangle(-w / 2 + 6, h / 2 - 2, 9, 5, 0x551111),
      scene.add.rectangle(w / 2 - 6, h / 2 - 2, 9, 5, 0x551111),
    ];
    this.add(this.brakeLights);
    this.decided = false;
    this.braking = false;
    this.brakeAt = null;
  }

  step(dt, playerSpeed, ctx) {
    if (!this.decided && this.dyToPlayer() < this.cfg.brakeTriggerDy && this.y > 0) {
      this.decided = true;
      if (!ctx.noBrakeZone && Math.random() < this.cfg.brakeChance) {
        // Peringatan dulu: lampu rem menyala, baru ngerem setelah brakeWarningMs.
        this.braking = true;
        this.brakeAt = ctx.now + this.cfg.brakeWarningMs;
        this.brakeLights.forEach((l) => l.setFillStyle(0xff2020));
      }
    }
    if (this.braking && ctx.now >= this.brakeAt) {
      this.ownSpeed = Math.max(0, this.ownSpeed - this.cfg.brakeDecel * dt);
    }
    super.step(dt, playerSpeed);
  }

  toState() {
    return { ...super.toState(), braking: this.braking };
  }
}

export class Ojol extends Obstacle {
  constructor(scene, spec) {
    super(scene, spec);
    this.isVehicle = true;
    this.targetLane = spec.targetLane;
    const { w, h } = this;
    this.add(scene.add.rectangle(0, 0, w, h, this.cfg.color).setStrokeStyle(2, 0x1b1b1f));
    this.add(scene.add.circle(0, 2, 7, 0x2e8b57).setStrokeStyle(2, 0x1b1b1f)); // helm hijau polos
    const dir = Math.sign(this.targetLane - this.lane);
    this.signal = scene.add.rectangle((dir * w) / 2, -h / 2 + 4, 6, 6, 0xffd400).setVisible(false);
    this.add(this.signal);
    this.state = 'cruise';
  }

  step(dt, playerSpeed, ctx) {
    if (this.state === 'cruise' && this.dyToPlayer() < this.cfg.swerveTriggerDy && this.y > 0) {
      // Batal pindah kalau lajur tujuan sedang terisi kendaraan lain di dekatnya.
      if (ctx.isLaneBusy?.(this.targetLane, this.y, this)) {
        this.state = 'stay';
        return super.step(dt, playerSpeed, ctx);
      }
      this.state = 'signal';
      this.signal.setVisible(true);
      this.blink = this.scene.tweens.add({
        targets: this.signal,
        alpha: 0,
        duration: 100,
        yoyo: true,
        repeat: -1,
      });
      this.scene.time.delayedCall(this.cfg.signalMs, () => this.swerve());
    }
    super.step(dt, playerSpeed, ctx);
  }

  swerve() {
    if (!this.active) return;
    this.state = 'swerve';
    this.swerved = true;
    this.lane = this.targetLane;
    this.scene.tweens.add({
      targets: this,
      x: laneX(this.targetLane),
      duration: this.cfg.swerveMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.blink?.stop();
        this.signal.setVisible(false);
      },
    });
  }

  toState() {
    const swerved = this.swerved || this.state === 'stay';
    return { ...super.toState(), targetLane: this.targetLane, swerved };
  }
}

export class Pedestrian extends Obstacle {
  constructor(scene, spec) {
    super(scene, spec);
    this.side = spec.side;
    this.add(scene.add.circle(0, 0, this.cfg.radius, this.cfg.color).setStrokeStyle(2, 0x1b1b1f));
    this.add(scene.add.circle(0, 0, this.cfg.radius * 0.5, 0x5a3d2b));
    this.state = 'wait';
    this.waitLeft = this.cfg.waitMs / 1000;
    this.dir = this.side === 'left' ? 1 : -1;
  }

  step(dt, playerSpeed, ctx) {
    if (this.state === 'wait' && this.y > 0) {
      this.waitLeft -= dt;
      if (this.waitLeft <= 0) this.state = 'cross';
    } else if (this.state === 'cross') {
      this.x += this.dir * this.cfg.crossSpeed * dt;
      const rel = this.x - CONFIG.road.sidewalkWidth;
      this.lane = Phaser.Math.Clamp(Math.floor(rel / CONFIG.road.laneWidth), 0, CONFIG.road.lanes - 1);
    }
    super.step(dt, playerSpeed, ctx);
  }

  isGone() {
    return super.isGone() || this.x < -30 || this.x > CONFIG.width + 30;
  }
}

export class Pothole extends Obstacle {
  constructor(scene, spec) {
    super(scene, spec);
    this.setDepth(5);
    this.add(scene.add.ellipse(0, 0, this.w, this.h, this.cfg.color).setStrokeStyle(3, 0x5c5c5c));
    this.add(scene.add.ellipse(4, 3, this.w * 0.5, this.h * 0.4, 0x141414));
  }
}

export class WrongWay extends Obstacle {
  constructor(scene, spec) {
    super(scene, spec);
    this.isVehicle = true;
    const { w, h } = this;
    this.add(scene.add.rectangle(0, 0, w, h, this.cfg.color).setStrokeStyle(2, 0x1b1b1f));
    this.add(scene.add.circle(0, -2, 8, 0x333333).setStrokeStyle(2, 0x1b1b1f));
    // Menghadap ke bawah: lampu depan di sisi bawah, berkedip.
    this.headlight = scene.add.circle(0, h / 2 - 3, 5, 0xfff7c2);
    this.add(this.headlight);
    scene.tweens.add({ targets: this.headlight, alpha: 0.15, duration: 120, yoyo: true, repeat: -1 });

    // Ikon "!" di tepi atas layar selama motor belum terlihat.
    this.alert = scene.add.container(spec.x, 22).setDepth(90);
    this.alert.add(scene.add.triangle(0, 0, 0, 18, 13, -12, 26, 18, 0xff8c1a).setOrigin(0.5));
    this.alert.add(
      scene.add
        .text(0, 3, '!', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#1b1b1f' })
        .setOrigin(0.5),
    );
    scene.tweens.add({ targets: this.alert, alpha: 0.3, duration: 150, yoyo: true, repeat: -1 });
  }

  step(dt, playerSpeed, ctx) {
    super.step(dt, playerSpeed, ctx);
    if (this.alert && this.y + this.h / 2 > 0) {
      this.alert.destroy();
      this.alert = null;
    }
  }

  destroy(fromScene) {
    if (this.alert) this.scene?.tweens.killTweensOf(this.alert);
    this.alert?.destroy();
    this.alert = null;
    super.destroy(fromScene);
  }
}

export class Bus extends Obstacle {
  constructor(scene, spec) {
    super(scene, spec);
    this.isVehicle = true;
    const { w, h } = this;
    this.add(scene.add.rectangle(0, 0, w, h, this.cfg.color).setStrokeStyle(2, 0x0b1430));
    this.add(scene.add.rectangle(0, -h / 2 + 12, w - 10, 14, 0x9ec9ff)); // kaca depan
    for (let i = 0; i < 4; i++) {
      this.add(scene.add.rectangle(0, -h / 2 + 40 + i * 32, w - 14, 4, 0x3b5bb3)); // panel atap
    }
    this.add(scene.add.rectangle(-w / 2 + 7, h / 2 - 2, 10, 5, 0xff3030));
    this.add(scene.add.rectangle(w / 2 - 7, h / 2 - 2, 10, 5, 0xff3030));
  }
}

const CLASSES = {
  angkot: Angkot,
  ojol: Ojol,
  pedestrian: Pedestrian,
  pothole: Pothole,
  wrongway: WrongWay,
  bus: Bus,
};

export function createObstacle(scene, spec) {
  return new CLASSES[spec.type](scene, spec);
}
