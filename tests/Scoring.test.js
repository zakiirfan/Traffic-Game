import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/data/config.js';
import { Scoring } from '../src/systems/Scoring.js';

const S = CONFIG.scoring;
const MIN_GAP = CONFIG.player.height;

describe('Scoring', () => {
  it('+1 per meter', () => {
    const s = new Scoring();
    s.addDistance(123.7);
    expect(s.total).toBe(123);
  });

  it('+30 tertib untuk lampu merah yang dipatuhi', () => {
    const s = new Scoring();
    s.obeyRedLight();
    expect(s.total).toBe(S.redLightObeyed);
    expect(s.tertib).toBe(S.redLightObeyed);
  });

  it('ETLE mengurangi 20 poin dan tidak membuat skor negatif', () => {
    const s = new Scoring();
    s.addDistance(50);
    s.etleViolation();
    expect(s.total).toBe(50 - S.etlePenalty);
    s.etleViolation();
    s.etleViolation();
    expect(s.total).toBe(0);
    expect(s.etleCount).toBe(3);
  });

  it('meteran bonus penuh mengaktifkan pengali x2 selama 10 detik', () => {
    const s = new Scoring();
    s.obeyRedLight(); // 30
    expect(s.multiplier).toBe(1);
    expect(s.bonusRatio).toBeCloseTo(30 / S.bonusMeterMax);
    const r = s.obeyRedLight(); // 60 -> penuh
    expect(r.activated).toBe(true);
    expect(s.multiplier).toBe(S.multiplier);
    expect(s.bonusRatio).toBe(0);

    const before = s.score;
    s.addDistance(10);
    expect(s.score - before).toBe(10 * S.multiplier);

    s.update(S.multiplierSeconds - 0.01);
    expect(s.multiplier).toBe(S.multiplier);
    s.update(0.02);
    expect(s.multiplier).toBe(1);
  });

  it('pengali juga berlaku untuk poin tertib, meteran tidak terisi saat pengali aktif', () => {
    const s = new Scoring();
    s.obeyRedLight();
    s.obeyRedLight();
    const before = s.score;
    const r = s.obeyRedLight();
    expect(r.gained).toBe(S.redLightObeyed * S.multiplier);
    expect(s.score - before).toBe(S.redLightObeyed * S.multiplier);
    expect(s.bonusMeter).toBe(0);
  });

  describe('jaga jarak aman', () => {
    it('+10 setelah 5 detik berturut-turut dengan jarak >= satu panjang motor', () => {
      const s = new Scoring();
      let result = null;
      for (let t = 0; t < S.safeDistanceSeconds - 0.1; t += 0.1) {
        result = s.updateSafeDistance(0.1, MIN_GAP + 10, MIN_GAP) ?? result;
      }
      expect(result).toBeNull();
      expect(s.total).toBe(0);
      result = s.updateSafeDistance(0.2, MIN_GAP + 10, MIN_GAP);
      expect(result.gained).toBe(S.safeDistance);
      expect(s.total).toBe(S.safeDistance);
    });

    it('terlalu dekat me-reset timer', () => {
      const s = new Scoring();
      s.updateSafeDistance(4, MIN_GAP + 1, MIN_GAP);
      s.updateSafeDistance(0.1, MIN_GAP - 1, MIN_GAP);
      expect(s.updateSafeDistance(4, MIN_GAP + 1, MIN_GAP)).toBeNull();
      expect(s.total).toBe(0);
    });

    it('tanpa kendaraan di depan, timer berhenti (tidak bertambah, tidak di-reset)', () => {
      const s = new Scoring();
      s.updateSafeDistance(4, MIN_GAP + 1, MIN_GAP);
      s.updateSafeDistance(100, null, MIN_GAP);
      expect(s.total).toBe(0);
      expect(s.updateSafeDistance(1, MIN_GAP + 1, MIN_GAP)).not.toBeNull();
    });
  });
});
