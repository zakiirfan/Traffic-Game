import Phaser from 'phaser';
import { CONFIG, roadLeft, roadRight } from '../data/config.js';

// Perempatan dengan lampu lalu lintas. Posisi y container = garis stop.
// Jalan melintang ada di atas garis stop (y negatif relatif container).
//
// Lampu selalu merah saat terlihat. Begitu pemain berhenti sebelum garis stop, lampu
// menghitung mundur 2-4 detik lalu hijau. Jadi setiap perempatan adalah pilihan: berhenti atau nerobos.
export default class TrafficLight extends Phaser.GameObjects.Container {
  constructor(scene, y, hasPolice) {
    super(scene, 0, y);
    this.cfg = CONFIG.trafficLight;
    this.hasPolice = hasPolice;
    this.state = 'red';
    this.greenAt = null;
    this.resolved = false; // sudah dinilai (patuh / nerobos)
    this.crossCars = [];
    this.nextCrossAt = 0;
    this.crossFromLeft = true;
    this.setDepth(6);

    const left = roadLeft();
    const right = roadRight();
    const band = this.cfg.crossBandHeight;
    const W = CONFIG.width;

    // Jalan melintang (menutup trotoar juga) + zebra cross.
    this.add(scene.add.rectangle(W / 2, -band / 2, W, band, 0x3b3b40));
    for (let x = left + 8; x < right - 8; x += 22) {
      this.add(scene.add.rectangle(x + 6, -12, 12, 18, 0xe8e8e8));
      this.add(scene.add.rectangle(x + 6, -band + 12, 12, 18, 0xe8e8e8));
    }
    // Garis stop.
    this.add(scene.add.rectangle((left + right) / 2, 3, right - left, 6, 0xffffff));

    // Tiang lampu di trotoar kanan.
    const px = W - CONFIG.road.sidewalkWidth / 2;
    this.add(scene.add.rectangle(px, 30, 4, 50, 0x222222));
    this.add(scene.add.rectangle(px, 6, 22, 58, 0x111111).setStrokeStyle(2, 0x444444));
    this.redLamp = scene.add.circle(px, -10, 8, 0xff2a2a);
    this.yellowLamp = scene.add.circle(px, 6, 8, 0x4a3b00);
    this.greenLamp = scene.add.circle(px, 22, 8, 0x0b3d12);
    this.add([this.redLamp, this.yellowLamp, this.greenLamp]);

    this.countdownText = scene.add
      .text(px, 52, '', { fontFamily: 'Arial', fontSize: '14px', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5);
    this.add(this.countdownText);

    // Pos polisi generik di trotoar kiri.
    if (hasPolice) {
      const x = CONFIG.road.sidewalkWidth / 2;
      this.add(scene.add.rectangle(x, 34, 36, 30, 0xf4f4f4).setStrokeStyle(2, 0x1f3a93));
      this.add(scene.add.rectangle(x, 22, 40, 8, 0x1f3a93));
      this.add(
        scene.add
          .text(x, 38, 'POS', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#1f3a93' })
          .setOrigin(0.5),
      );
    }

    scene.add.existing(this);
  }

  get lineY() {
    return this.y;
  }

  startCountdown(now) {
    if (this.greenAt !== null || this.state !== 'red') return;
    const secs = Phaser.Math.FloatBetween(this.cfg.redMinSeconds, this.cfg.redMaxSeconds);
    this.greenAt = now + secs * 1000;
  }

  setGreen() {
    this.state = 'green';
    this.redLamp.setFillStyle(0x4a0b0b);
    this.greenLamp.setFillStyle(0x2bff5a);
    this.countdownText.setText('');
  }

  step(dt, playerSpeed, now) {
    this.y += playerSpeed * dt;
    if (this.state === 'red' && this.greenAt !== null) {
      const left = Math.max(0, (this.greenAt - now) / 1000);
      this.countdownText.setText(left.toFixed(1));
      if (now >= this.greenAt) this.setGreen();
    }
    this.updateCrossTraffic(dt, now);
  }

  // Kendaraan melintas dari samping selama lampu merah dan perempatan terlihat.
  updateCrossTraffic(dt, now) {
    const c = this.cfg.crossTraffic;
    const W = CONFIG.width;
    if (this.state === 'red' && this.y > -40 && now >= this.nextCrossAt) {
      this.nextCrossAt = now + c.intervalMs;
      const fromLeft = this.crossFromLeft;
      this.crossFromLeft = !fromLeft;
      // Lajur arah ke kanan di setengah bawah jalan melintang, arah ke kiri di setengah atas.
      const band = this.cfg.crossBandHeight;
      const y = fromLeft ? -band * 0.28 : -band * 0.72;
      const car = this.scene.add.rectangle(fromLeft ? -c.width : W + c.width, y, c.width, c.height, c.color);
      car.setStrokeStyle(2, 0x1b1b1f);
      car.dir = fromLeft ? 1 : -1;
      this.add(car);
      this.crossCars.push(car);
    }
    for (const car of this.crossCars) car.x += car.dir * c.speed * dt;
    this.crossCars = this.crossCars.filter((car) => {
      if (car.x < -c.width * 2 || car.x > W + c.width * 2) {
        car.destroy();
        return false;
      }
      return true;
    });
  }

  // Kotak tabrakan kendaraan melintas, dalam koordinat layar.
  getCrossHitboxes() {
    const c = this.cfg.crossTraffic;
    return this.crossCars.map((car) => ({
      x: car.x - c.width / 2 + 2,
      y: this.y + car.y - c.height / 2 + 2,
      w: c.width - 4,
      h: c.height - 4,
    }));
  }

  isGone() {
    return this.y - this.cfg.crossBandHeight > CONFIG.height + 40;
  }
}
