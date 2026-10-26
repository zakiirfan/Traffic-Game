import { CONFIG, laneX } from '../data/config.js';

// Spawner murni (tanpa Phaser) supaya aturan keadilan bisa di-unit-test.
//
// Ide dasarnya: setiap rintangan punya "jejak" (footprint) = lajur yang diblokir dan rentang
// perkiraan waktu (detik dari sekarang) dari saat rintangan sampai di depan motor hingga
// selesai terlewati.
// Dua rintangan yang rentang waktunya berdekatan (< gapSeconds) dianggap satu "baris".
// Baris tidak boleh menutup semua lajur non-busway: busway tidak dihitung sebagai jalan keluar.

// Lajur yang sah sebagai jalan keluar (semua lajur kecuali busway).
export function escapeLanes(cfg = CONFIG) {
  const lanes = [];
  for (let i = 0; i < cfg.road.lanes; i++) {
    if (i !== cfg.road.buswayLane) lanes.push(i);
  }
  return lanes;
}

// Validasi satu baris: true kalau masih ada minimal satu lajur non-busway yang kosong.
export function rowLeavesEscape(blockedLanes, cfg = CONFIG) {
  const blocked = new Set(blockedLanes);
  return escapeLanes(cfg).some((l) => !blocked.has(l));
}

// Perkirakan jejak rintangan dari keadaannya sekarang.
// state: { id, type, lane, targetLane?, y (tengah), height, ownSpeed (px/s, + = searah pemain),
//          braking? }
// playerSpeed: kecepatan jelajah pemain (px/s). Mengembalikan null kalau tidak akan bertemu pemain.
export function estimateFootprint(state, playerSpeed, cfg = CONFIG) {
  const p = cfg.player;
  const playerTop = p.y - p.height / 2;
  const playerBottom = p.y + p.height / 2;
  const top = state.y - state.height / 2;
  const bottom = state.y + state.height / 2;
  if (top > playerBottom) return null; // sudah lewat

  const dy = Math.max(0, playerTop - bottom);
  const own = state.ownSpeed ?? 0;
  const rel = playerSpeed - own;
  if (rel <= 0) return null; // bergerak menjauh, tidak akan tersusul

  let etaMin = dy / rel;
  let etaMax = dy / rel;

  if (state.type === 'angkot' && !state.braking) {
    // Angkot bisa ngerem mendadak (sampai berhenti) begitu dekat; ambil skenario tercepat.
    const trig = cfg.obstacles.angkot.brakeTriggerDy;
    etaMin = dy > trig ? (dy - trig) / rel + trig / playerSpeed : dy / playerSpeed;
  } else if (state.type === 'angkot' && state.braking) {
    etaMin = dy / playerSpeed;
  }

  // Rintangan baru "selesai lewat" setelah seluruh panjangnya plus panjang motor terlewati.
  // Pakai kecepatan relatif paling lambat supaya perkiraannya aman.
  etaMax += (state.height + p.height) / rel;

  let lanes;
  if (state.type === 'pedestrian') {
    // Pejalan kaki menyeberang semua lajur; dianggap memblokir semuanya.
    lanes = [];
    for (let i = 0; i < cfg.road.lanes; i++) lanes.push(i);
  } else if (state.type === 'ojol' && !state.swerved && state.targetLane !== undefined && state.targetLane !== null) {
    // Ojol bisa tetap di lajurnya atau pindah ke lajur tujuan: dua-duanya dianggap terblokir.
    lanes = [state.lane, state.targetLane];
  } else {
    lanes = [state.lane];
  }

  return { id: state.id, type: state.type, lanes, etaMin, etaMax };
}

function timeOverlap(a, b, gap) {
  return a.etaMin - gap < b.etaMax && b.etaMin - gap < a.etaMax;
}

// Aturan keadilan utama. newFootprints = calon rintangan baru, activeFootprints = yang sudah ada.
// Tidak adil kalau ada dua rintangan berbeda yang waktunya berdekatan dan:
//   - bersama-sama menutup semua lajur non-busway, atau
//   - menumpuk di lajur yang sama.
// Satu rintangan yang bergerak melintasi beberapa lajur (pejalan kaki) sendirian tetap boleh,
// karena di satu waktu ia hanya menempati satu titik.
export function isSpawnFair(newFootprints, activeFootprints, cfg = CONFIG) {
  const gap = cfg.fairness.gapSeconds;
  const escapes = escapeLanes(cfg);
  const fresh = newFootprints.filter(Boolean);
  const all = [...activeFootprints.filter(Boolean), ...fresh];

  for (const f of fresh) {
    for (const g of all) {
      if (g === f || !timeOverlap(f, g, gap)) continue;
      const union = new Set([...f.lanes, ...g.lanes]);
      if (escapes.every((l) => union.has(l))) return false;
      if (f.lanes.some((l) => g.lanes.includes(l))) return false;
    }
  }
  return true;
}

// Motor lawan arus akan berpapasan dengan semua yang ada di lajurnya, jadi hanya boleh muncul
// kalau lajur itu kosong di antara atas layar dan motor pemain.
export function wrongWayLaneClear(lane, activeStates, cfg = CONFIG) {
  return !activeStates.some((s) => {
    if (s.y - s.height / 2 > cfg.player.y) return false;
    if (s.type === 'pedestrian') return true;
    return s.lane === lane || s.targetLane === lane;
  });
}

// Kebalikannya: rintangan baru tidak boleh muncul di lajur yang motor lawan arusnya masih
// datang dari atas (belum melewatinya).
export function blockedByIncomingWrongWay(spec, activeStates) {
  return activeStates.some((s) => {
    if (s.type !== 'wrongway' || s.y >= spec.y) return false;
    if (spec.type === 'pedestrian') return true;
    return s.lane === spec.lane || s.lane === spec.targetLane;
  });
}

export class Spawner {
  constructor(cfg = CONFIG, rng = Math.random) {
    this.cfg = cfg;
    this.rng = rng;
    this.nextId = 1;
  }

  pickWeighted(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [key, w] of entries) {
      r -= w;
      if (r < 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  pick(arr) {
    return arr[Math.floor(this.rng() * arr.length) % arr.length];
  }

  // Buat spesifikasi rintangan baru di atas layar.
  buildSpec(type, playerSpeed) {
    const cfg = this.cfg;
    const o = cfg.obstacles[type];
    const base = cfg.player.baseSpeed;
    const spec = { id: this.nextId++, type };

    if (type === 'pedestrian') {
      const side = this.rng() < 0.5 ? 'left' : 'right';
      spec.side = side;
      spec.height = o.radius * 2;
      spec.width = o.radius * 2;
      spec.y = -o.radius - 4;
      spec.x = side === 'left' ? cfg.road.sidewalkWidth / 2 : cfg.width - cfg.road.sidewalkWidth / 2;
      spec.lane = side === 'left' ? 0 : cfg.road.lanes - 1;
      spec.ownSpeed = 0;
      return spec;
    }

    spec.lane = this.pick(o.lanes);
    spec.width = o.width;
    spec.height = o.height;
    spec.ownSpeed = (o.speedFactor ?? 0) * base;
    spec.x = laneX(spec.lane, cfg);
    spec.y = -o.height / 2 - 4;

    if (type === 'ojol') {
      const options = [spec.lane - 1, spec.lane + 1].filter((l) => l >= 0 && l < cfg.road.lanes);
      spec.targetLane = this.pick(options);
    }
    if (type === 'wrongway') {
      // Mulai di luar layar sejauh waktu peringatan, jadi ikon "!" tampil selama warningMs.
      const rel = playerSpeed - spec.ownSpeed;
      spec.y -= (rel * o.warningMs) / 1000;
    }
    return spec;
  }

  // Coba buat satu baris rintangan. ctx: { phase, playerSpeed, activeStates }
  // Mengembalikan array spesifikasi (bisa kosong) yang dijamin lolos isSpawnFair.
  generateRow(ctx) {
    const { phase, playerSpeed, activeStates = [] } = ctx;
    if (this.rng() > phase.spawnChance) return [];

    const active = activeStates.map((s) => estimateFootprint(s, playerSpeed, this.cfg)).filter(Boolean);
    const wanted = phase.maxPerRow > 1 && this.rng() < 0.5 ? 2 : 1;

    for (let attempt = 0; attempt < this.cfg.fairness.maxAttempts; attempt++) {
      const count = attempt < this.cfg.fairness.maxAttempts / 2 ? wanted : 1;
      const specs = [];
      for (let i = 0; i < count; i++) {
        specs.push(this.buildSpec(this.pickWeighted(phase.types), playerSpeed));
      }
      const headOn = specs.some((s) => {
        const others = [...activeStates, ...specs.filter((o) => o !== s)];
        return s.type === 'wrongway'
          ? !wrongWayLaneClear(s.lane, others, this.cfg)
          : blockedByIncomingWrongWay(s, others);
      });
      if (headOn) continue;
      const fps = specs.map((s) => estimateFootprint(s, playerSpeed, this.cfg));
      const blocked = fps.filter(Boolean).flatMap((f) => (f.lanes.length > 1 ? [] : f.lanes));
      if (rowLeavesEscape(blocked, this.cfg) && isSpawnFair(fps, active, this.cfg)) {
        return specs;
      }
    }
    return [];
  }
}
