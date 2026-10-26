import Phaser from 'phaser';
import { CONFIG, laneX } from '../data/config.js';
import { TEXT_STYLE } from '../ui/Button.js';
import Player from '../objects/Player.js';
import { createObstacle, DEATH_CAUSE } from '../objects/Obstacle.js';
import TrafficLight from '../objects/TrafficLight.js';
import EtleCamera from '../objects/EtleCamera.js';
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

    this.light = null;
    this.nextLightAt = CONFIG.trafficLight.firstAtSeconds;
    this.etles = [];
    this.nextEtleAt = CONFIG.etle.firstAtMeters;
    this.counters = { lightsObeyed: 0, lightsRan: 0, etle: 0, helmetSaves: 0 };

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

    // Penanda lampu merah di depan saat perempatan belum masuk layar.
    const W = CONFIG.width;
    this.hudLight = this.add.container(W / 2, 26).setDepth(100).setVisible(false);
    this.hudLight.add(this.add.rectangle(0, 0, 150, 30, 0x111111, 0.85).setStrokeStyle(2, 0xff3030));
    this.hudLight.add(this.add.circle(-56, 0, 8, 0xff2a2a));
    this.hudLight.add(
      this.add.text(8, 0, 'LAMPU MERAH ▲', { ...TEXT_STYLE, fontSize: '13px', fontStyle: 'bold' }).setOrigin(0.5),
    );
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

    this.updateLight(dt, cruise);
    if (this.isOver) return;
    this.updateEtle(dt);
    this.updateSpawning(dm, cruise);
    this.updateObstacles(dt);
    this.checkCollisions();
    if (this.isOver) return;

    this.hudScore.setText(`${Math.floor(this.distanceMeters)} m`);
    const helm = p.helmet ? 'Helm: aman' : p.helmetCracked ? 'Helm: retak' : 'Tanpa helm';
    this.hudInfo.setText(`${Math.round((p.speed / CONFIG.pxPerMeter) * 3.6)} km/j · ${helm}`);
    this.hudLight.setVisible(!!this.light && this.light.state === 'red' && this.light.lineY < 10);
  }

  // Spawner berhenti sebentar sebelum perempatan muncul sampai pemain melewatinya, supaya
  // berhenti di lampu merah selalu aman.
  spawnPaused() {
    const lp = CONFIG.trafficLight;
    if (this.elapsed >= this.nextLightAt - lp.spawnPauseBeforeSeconds) return true;
    return !!this.light && this.light.lineY < this.player.y + lp.spawnResumeAfterMeters * CONFIG.pxPerMeter;
  }

  updateLight(dt, cruise) {
    const lp = CONFIG.trafficLight;
    const p = this.player;
    const now = this.time.now;
    if (!this.light && this.elapsed >= this.nextLightAt) {
      // Garis stop ditempatkan sejauh visibleSecondsBeforeLine dari motor pada kecepatan jelajah.
      const y = p.top - lp.visibleSecondsBeforeLine * cruise;
      this.light = new TrafficLight(this, y, Math.random() < lp.policeChance);
      this.nextLightAt = this.elapsed + lp.intervalSeconds + Phaser.Math.FloatBetween(-lp.jitterSeconds, lp.jitterSeconds);
    }
    const light = this.light;
    if (!light) return;

    light.step(dt, p.speed, now);
    if (!light.resolved) {
      if (light.state === 'red') {
        if (p.top < light.lineY) {
          light.resolved = true;
          this.ranRedLight(light);
        } else if (p.speed < 1 && light.lineY > 0) {
          light.startCountdown(now);
        }
      } else {
        light.resolved = true;
        this.obeyedRedLight();
      }
    }
    if (light.isGone()) {
      light.destroy();
      this.light = null;
    }
  }

  obeyedRedLight() {
    this.counters.lightsObeyed++;
    this.floatText(this.player.x, this.player.y - 50, '+30 TERTIB', '#7dff9a');
  }

  // Nerobos lampu merah: tidak ada poin. Kalau ada polisi di pos, langsung ditilang.
  ranRedLight(light) {
    this.counters.lightsRan++;
    if (light.hasPolice) {
      this.floatText(CONFIG.width / 2, this.player.y - 60, 'KENA TILANG!', '#ff6b6b');
      this.gameOver('tilang');
      return;
    }
    this.floatText(this.player.x, this.player.y - 50, 'NEROBOS! 0 poin', '#ff6b6b');
  }

  updateEtle(dt) {
    const p = this.player;
    if (this.distanceMeters >= this.nextEtleAt) {
      // Jangan menumpuk dengan perempatan.
      const nearLight = this.light && this.light.lineY > -400;
      if (nearLight || this.elapsed >= this.nextLightAt - 1) {
        this.nextEtleAt += 40;
      } else {
        this.etles.push(new EtleCamera(this, -60));
        this.nextEtleAt += CONFIG.etle.everyMeters;
      }
    }
    for (const cam of this.etles) {
      cam.step(dt, p.speed);
      if (!cam.triggered && cam.y >= p.y) {
        cam.triggered = true;
        if (p.lane === CONFIG.road.buswayLane) this.caughtByEtle();
      }
    }
    this.etles = this.etles.filter((cam) => {
      if (cam.isGone()) {
        cam.destroy();
        return false;
      }
      return true;
    });
  }

  caughtByEtle() {
    this.counters.etle++;
    this.cameras.main.flash(220, 255, 255, 255);
    this.floatText(CONFIG.width / 2, CONFIG.height / 2, 'TERTANGKAP ETLE  −20', '#ffd166', '26px');
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
    for (const spec of specs) this.spawnObstacle(spec);
  }

  spawnObstacle(spec) {
    const o = createObstacle(this, spec);
    this.obstacles.push(o);
    return o;
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

  // Kendaraan searah tidak saling tembus (yang di belakang ikut melambat) dan berhenti di garis
  // stop saat lampu merah.
  keepNpcSpacing() {
    const light = this.light && this.light.state === 'red' ? this.light : null;
    for (const back of this.obstacles) {
      if (!back.isVehicle || back.baseOwnSpeed <= 0 || back.braking) continue;
      let limit = back.baseOwnSpeed;
      for (const front of this.obstacles) {
        if (front === back || !front.isVehicle || front.lane !== back.lane || front.y >= back.y) continue;
        const gap = back.y - back.h / 2 - (front.y + front.h / 2);
        if (gap < 16) limit = Math.min(limit, Math.max(0, front.ownSpeed));
      }
      if (light) {
        const toLine = back.y - back.h / 2 - light.lineY;
        if (toLine >= 0 && toLine < 24) limit = 0;
      }
      back.ownSpeed = limit;
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
    if (this.light) {
      for (const box of this.light.getCrossHitboxes()) {
        if (overlaps(hb, box)) {
          this.handleCrash('perempatan', null);
          return;
        }
      }
    }
  }

  // Tabrakan: helm menyelamatkan satu kali, selain itu game over.
  handleCrash(cause, obstacle) {
    const p = this.player;
    if (p.helmet) {
      this.counters.helmetSaves++;
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
        ...this.counters,
      });
    });
  }

  floatText(x, y, msg, color = '#ffffff', fontSize = '18px') {
    const t = this.add
      .text(x, y, msg, { ...TEXT_STYLE, fontSize, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 })
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
