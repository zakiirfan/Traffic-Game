import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/data/config.js';
import {
  Spawner,
  escapeLanes,
  estimateFootprint,
  isSpawnFair,
  rowLeavesEscape,
  wrongWayLaneClear,
  blockedByIncomingWrongWay,
} from '../src/systems/Spawner.js';
import { getPhase } from '../src/systems/Difficulty.js';

// RNG deterministik (mulberry32) supaya test bisa diulang.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPEED = CONFIG.player.baseSpeed;
const fp = (id, lanes, eta) => ({ id, lanes, etaMin: eta, etaMax: eta });

describe('rowLeavesEscape', () => {
  it('busway tidak dihitung sebagai jalan keluar', () => {
    expect(escapeLanes()).toEqual([0, 1]);
  });

  it('menolak baris yang menutup ketiga lajur', () => {
    expect(rowLeavesEscape([0, 1, 2])).toBe(false);
  });

  it('menolak baris yang hanya menyisakan busway', () => {
    expect(rowLeavesEscape([0, 1])).toBe(false);
  });

  it('menerima baris yang menyisakan satu lajur biasa', () => {
    expect(rowLeavesEscape([0])).toBe(true);
    expect(rowLeavesEscape([1, 2])).toBe(true);
    expect(rowLeavesEscape([0, 2])).toBe(true);
    expect(rowLeavesEscape([])).toBe(true);
  });
});

describe('isSpawnFair', () => {
  it('menolak dua rintangan bersamaan di lajur 0 dan 1', () => {
    expect(isSpawnFair([fp(2, [1], 3.0)], [fp(1, [0], 3.1)])).toBe(false);
  });

  it('menerima dua rintangan di lajur 0 dan 1 bila waktunya cukup berjauhan', () => {
    const gap = CONFIG.fairness.gapSeconds;
    expect(isSpawnFair([fp(2, [1], 3.0 + gap + 0.1)], [fp(1, [0], 3.0)])).toBe(true);
  });

  it('menolak rintangan baru yang bersamaan dengan pejalan kaki', () => {
    expect(isSpawnFair([fp(2, [2], 3.0)], [fp(1, [0, 1, 2], 3.0)])).toBe(false);
  });

  it('pejalan kaki sendirian tetap boleh', () => {
    expect(isSpawnFair([fp(1, [0, 1, 2], 3.0)], [])).toBe(true);
  });

  it('bus di busway + satu rintangan di lajur biasa boleh', () => {
    expect(isSpawnFair([fp(2, [2], 3.0)], [fp(1, [0], 3.0)])).toBe(true);
  });

  it('menolak rintangan yang menumpuk di lajur yang sama', () => {
    expect(isSpawnFair([fp(2, [0], 3.0)], [fp(1, [0], 3.1)])).toBe(false);
  });

  it('memperhitungkan rentang waktu (angkot yang mungkin ngerem)', () => {
    const angkot = { id: 1, lanes: [0], etaMin: 2.0, etaMax: 4.0 };
    expect(isSpawnFair([fp(2, [1], 3.0)], [angkot])).toBe(false);
  });

  it('ojol yang akan pindah lajur memblokir lajur asal dan tujuan', () => {
    const ojol = estimateFootprint(
      { id: 1, type: 'ojol', lane: 0, targetLane: 1, y: 100, height: 40, ownSpeed: 130 },
      SPEED,
    );
    expect(ojol.lanes.sort()).toEqual([0, 1]);
    expect(isSpawnFair([ojol], [])).toBe(true);
    expect(isSpawnFair([fp(9, [0], ojol.etaMin)], [ojol])).toBe(false);
  });
});

describe('estimateFootprint', () => {
  it('rintangan diam tiba sesuai kecepatan pemain', () => {
    const p = CONFIG.player;
    const f = estimateFootprint({ id: 1, type: 'pothole', lane: 0, y: 0, height: 30, ownSpeed: 0 }, 260);
    const dy = p.y - p.height / 2 - 15;
    expect(f.etaMin).toBeCloseTo(dy / 260);
    // Selesai lewat setelah panjang lubang + panjang motor.
    expect(f.etaMax).toBeCloseTo((dy + 30 + p.height) / 260);
  });

  it('motor lawan arus tiba lebih cepat', () => {
    const still = estimateFootprint({ id: 1, type: 'pothole', lane: 0, y: 0, height: 44, ownSpeed: 0 }, 260);
    const wrong = estimateFootprint({ id: 2, type: 'wrongway', lane: 0, y: 0, height: 44, ownSpeed: -140 }, 260);
    expect(wrong.etaMin).toBeLessThan(still.etaMin);
  });

  it('mengabaikan rintangan yang sudah lewat', () => {
    expect(estimateFootprint({ id: 1, type: 'pothole', lane: 0, y: 900, height: 30 }, 260)).toBeNull();
  });
});

describe('wrongWayLaneClear', () => {
  it('menolak lajur yang masih ada kendaraan di depan pemain', () => {
    const angkot = { id: 1, type: 'angkot', lane: 0, y: 200, height: 74 };
    expect(wrongWayLaneClear(0, [angkot])).toBe(false);
    expect(wrongWayLaneClear(1, [angkot])).toBe(true);
  });

  it('memperhitungkan lajur tujuan ojol dan pejalan kaki', () => {
    const ojol = { id: 1, type: 'ojol', lane: 0, targetLane: 1, y: 200, height: 40 };
    expect(wrongWayLaneClear(1, [ojol])).toBe(false);
    const ped = { id: 2, type: 'pedestrian', lane: 0, y: 100, height: 22 };
    expect(wrongWayLaneClear(1, [ped])).toBe(false);
  });

  it('mengabaikan rintangan yang sudah di belakang pemain', () => {
    const angkot = { id: 1, type: 'angkot', lane: 0, y: CONFIG.player.y + 100, height: 74 };
    expect(wrongWayLaneClear(0, [angkot])).toBe(true);
  });
});

describe('blockedByIncomingWrongWay', () => {
  const wrong = { id: 1, type: 'wrongway', lane: 0, y: -300, height: 44, ownSpeed: -140 };
  it('menolak rintangan baru di lajur motor lawan arus yang masih datang', () => {
    expect(blockedByIncomingWrongWay({ type: 'angkot', lane: 0, y: -40 }, [wrong])).toBe(true);
    expect(blockedByIncomingWrongWay({ type: 'ojol', lane: 1, targetLane: 0, y: -24 }, [wrong])).toBe(true);
    expect(blockedByIncomingWrongWay({ type: 'pedestrian', lane: 2, y: -15 }, [wrong])).toBe(true);
  });

  it('lajur lain atau motor yang sudah lewat tidak masalah', () => {
    expect(blockedByIncomingWrongWay({ type: 'angkot', lane: 1, y: -40 }, [wrong])).toBe(false);
    expect(blockedByIncomingWrongWay({ type: 'angkot', lane: 0, y: -40 }, [{ ...wrong, y: 200 }])).toBe(false);
  });
});

describe('Spawner.generateRow (simulasi)', () => {
  // Simulasi sederhana: rintangan bergerak lurus, spawner dipanggil berulang. Di setiap langkah
  // waktu, kumpulan rintangan yang tiba "bersamaan" di garis pemain harus selalu menyisakan
  // minimal satu lajur non-busway.
  function simulate(seed, seconds) {
    const rng = seeded(seed);
    const spawner = new Spawner(CONFIG, rng);
    let active = [];
    let t = 0;
    let sinceSpawn = 0;
    const dt = 1 / 30;
    const violations = [];
    const spawned = [];
    while (t < seconds) {
      t += dt;
      const phase = getPhase(t);
      sinceSpawn += (SPEED * dt) / CONFIG.pxPerMeter;
      if (sinceSpawn >= phase.spawnEveryMeters) {
        sinceSpawn = 0;
        const specs = spawner.generateRow({ phase, playerSpeed: SPEED, activeStates: active });
        const before = active.map((s) => estimateFootprint(s, SPEED)).filter(Boolean);
        const fresh = specs.map((s) => estimateFootprint(s, SPEED));
        if (!isSpawnFair(fresh, before)) violations.push({ t, specs });
        for (const s of specs) {
          const blocked = fresh.filter(Boolean).flatMap((f) => (f.lanes.length > 1 ? [] : f.lanes));
          if (!rowLeavesEscape(blocked)) violations.push({ t, specs });
          spawned.push(s.type);
        }
        active.push(...specs.map((s) => ({ ...s })));
      }
      for (const s of active) {
        // Angkot ngerem mendadak (langsung berhenti) begitu dekat, skenario terburuk.
        const p = CONFIG.player;
        const dy = p.y - p.height / 2 - (s.y + s.height / 2);
        if (s.type === 'angkot' && !s.decided && dy < CONFIG.obstacles.angkot.brakeTriggerDy) {
          s.decided = true;
          if (rng() < 0.5) {
            s.ownSpeed = 0;
            s.braking = true;
          }
        }
        s.y += (SPEED - s.ownSpeed) * dt;
      }
      active = active.filter((s) => s.y - s.height / 2 < CONFIG.height + 40);

      // Cek geometris independen: rintangan yang sedang berada di pita setinggi motor di garis
      // pemain tidak boleh bersama-sama menutup lajur 0 dan 1 (tidak ada celah untuk lewat).
      const p = CONFIG.player;
      const bandTop = p.y - p.height / 2;
      const bandBottom = p.y + p.height / 2;
      const inBand = active.filter((s) => s.y + s.height / 2 > bandTop && s.y - s.height / 2 < bandBottom);
      if (inBand.length > 1) {
        const lanes = new Set(
          inBand.flatMap((s) =>
            s.type === 'pedestrian' ? [0, 1, 2] : s.type === 'ojol' ? [s.lane, s.targetLane] : [s.lane],
          ),
        );
        if (lanes.has(0) && lanes.has(1)) violations.push({ t, wall: inBand.map((s) => s.type) });
      }

      // Motor lawan arus tidak boleh menembus rintangan lain di lajurnya.
      for (const w of active.filter((s) => s.type === 'wrongway')) {
        for (const o of active) {
          if (o === w || o.type === 'pedestrian') continue;
          const sameLane = o.lane === w.lane || o.targetLane === w.lane;
          if (sameLane && Math.abs(o.y - w.y) < (o.height + w.height) / 2) {
            violations.push({ t, headOn: [w.type, o.type] });
          }
        }
      }
    }
    return { violations, spawned };
  }

  it('tidak pernah menghasilkan spawn yang melanggar aturan keadilan', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { violations } = simulate(seed, 120);
      expect(violations).toEqual([]);
    }
  });

  it('tetap memunculkan rintangan (aturan tidak membuat jalan kosong)', () => {
    const { spawned } = simulate(7, 120);
    expect(spawned.length).toBeGreaterThan(40);
    expect(new Set(spawned).size).toBeGreaterThanOrEqual(5);
  });

  it('fase awal (0-15 dtk) hanya angkot', () => {
    const { spawned } = simulate(3, 14);
    expect(spawned.every((t) => t === 'angkot')).toBe(true);
  });

  it('motor lawan arus hanya muncul di fase padat', () => {
    const rng = seeded(11);
    const spawner = new Spawner(CONFIG, rng);
    const phase = getPhase(30);
    for (let i = 0; i < 200; i++) {
      const specs = spawner.generateRow({ phase, playerSpeed: SPEED, activeStates: [] });
      expect(specs.some((s) => s.type === 'wrongway')).toBe(false);
    }
  });

  it('bus hanya di busway, rintangan lain tidak di busway (kecuali pejalan kaki di trotoar)', () => {
    const rng = seeded(5);
    const spawner = new Spawner(CONFIG, rng);
    const phase = getPhase(60);
    for (let i = 0; i < 300; i++) {
      for (const s of spawner.generateRow({ phase, playerSpeed: SPEED, activeStates: [] })) {
        if (s.type === 'bus') expect(s.lane).toBe(CONFIG.road.buswayLane);
        else if (s.type !== 'pedestrian') expect(s.lane).not.toBe(CONFIG.road.buswayLane);
      }
    }
  });
});
