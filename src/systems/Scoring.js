import { CONFIG } from '../data/config.js';

// Sistem skor murni (tanpa Phaser).
// - Skor dasar: +pointsPerMeter per meter.
// - Poin tertib: lampu merah dipatuhi, jaga jarak aman. Poin tertib mengisi meteran bonus.
// - Meteran penuh: pengali skor x2 selama multiplierSeconds.
// - Pelanggaran ETLE: −etlePenalty (skor tidak bisa negatif).
// Tidak ada poin untuk perilaku berbahaya (nerobos, nyalip tipis, dsb).
export class Scoring {
  constructor(cfg = CONFIG.scoring) {
    this.cfg = cfg;
    this.score = 0;
    this.tertib = 0;
    this.bonusMeter = 0;
    this.multiplierLeft = 0;
    this.safeTimer = 0;
    this.etleCount = 0;
  }

  get multiplier() {
    return this.multiplierLeft > 0 ? this.cfg.multiplier : 1;
  }

  get total() {
    return Math.floor(this.score);
  }

  get bonusRatio() {
    return Math.min(1, this.bonusMeter / this.cfg.bonusMeterMax);
  }

  update(dt) {
    this.multiplierLeft = Math.max(0, this.multiplierLeft - dt);
  }

  addDistance(meters) {
    this.score += meters * this.cfg.pointsPerMeter * this.multiplier;
  }

  // Tambah poin tertib. Mengembalikan { gained, activated } untuk umpan balik di layar.
  addTertib(points) {
    const gained = points * this.multiplier;
    this.score += gained;
    this.tertib += points;
    let activated = false;
    // Meteran hanya terisi saat pengali tidak aktif.
    if (this.multiplierLeft <= 0) {
      this.bonusMeter += points;
      if (this.bonusMeter >= this.cfg.bonusMeterMax) {
        this.bonusMeter = 0;
        this.multiplierLeft = this.cfg.multiplierSeconds;
        activated = true;
      }
    }
    return { gained, activated };
  }

  obeyRedLight() {
    return this.addTertib(this.cfg.redLightObeyed);
  }

  etleViolation() {
    this.score = Math.max(0, this.score - this.cfg.etlePenalty);
    this.etleCount++;
  }

  // Jaga jarak aman. gap = jarak (px) ke kendaraan di depan di lajur yang sama, atau null kalau
  // tidak ada kendaraan di depan (timer berhenti, tidak di-reset). Mengembalikan hasil addTertib
  // saat bonus didapat, selain itu null.
  updateSafeDistance(dt, gap, minGap) {
    if (gap === null || gap === undefined) return null;
    if (gap < minGap) {
      this.safeTimer = 0;
      return null;
    }
    this.safeTimer += dt;
    if (this.safeTimer >= this.cfg.safeDistanceSeconds) {
      this.safeTimer -= this.cfg.safeDistanceSeconds;
      return this.addTertib(this.cfg.safeDistance);
    }
    return null;
  }
}
