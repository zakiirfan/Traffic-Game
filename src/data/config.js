// Semua angka balancing game ada di sini. Ubah nilai di file ini, jangan di kode scene/objek.
// Satuan: px (piksel di resolusi dasar 405x720), detik (s), milidetik (ms), meter (m).

export const CONFIG = {
  width: 405,
  height: 720,

  // Tata letak jalan. Lajur 0 = kiri, lajur 2 = kanan (busway).
  road: {
    sidewalkWidth: 45,
    laneWidth: 105,
    lanes: 3,
    buswayLane: 2,
  },

  // Konversi jarak: berapa px dihitung sebagai 1 meter.
  pxPerMeter: 20,

  player: {
    y: 590, // posisi tengah motor di layar (tetap)
    width: 24,
    height: 44,
    laneTweenMs: 120,
    holdToBrakeMs: 250, // tahan layar lebih lama dari ini = rem
    baseSpeed: 260, // px/s
    noHelmetSpeedBonus: 0.1, // tanpa helm: kecepatan awal +10%
    brakeDecel: 700, // px/s^2
    accel: 360, // px/s^2, saat kembali ke kecepatan jelajah
    invulnerableMs: 1500, // kebal setelah helm retak
  },

  // Kecepatan naik 8% tiap 10 detik, dibatasi maksimum.
  speed: {
    stepSeconds: 10,
    stepMultiplier: 1.08,
    maxMultiplier: 2.0,
  },

  // Kurva kesulitan. Fase dipilih berdasarkan detik permainan (until = batas atas, eksklusif).
  difficulty: {
    phases: [
      {
        name: 'sepi',
        until: 15,
        spawnEveryMeters: 40,
        spawnChance: 0.55,
        maxPerRow: 1,
        types: { angkot: 1 },
      },
      {
        name: 'dasar',
        until: 45,
        spawnEveryMeters: 22,
        spawnChance: 0.85,
        maxPerRow: 2,
        types: { angkot: 3, ojol: 2, pothole: 2, pedestrian: 1, bus: 1.5 },
      },
      {
        name: 'padat',
        until: Infinity,
        spawnEveryMeters: 15,
        spawnChance: 0.95,
        maxPerRow: 2,
        types: { angkot: 3, ojol: 2.5, pothole: 2, pedestrian: 1, bus: 1.5, wrongway: 1.5 },
      },
    ],
  },

  // Aturan keadilan spawner.
  fairness: {
    // Dua rintangan dianggap "bersamaan" kalau perkiraan waktu tibanya di garis pemain
    // berjarak kurang dari ini (detik). Rintangan bersamaan tidak boleh menutup semua
    // lajur non-busway.
    gapSeconds: 0.6,
    maxAttempts: 8,
  },

  obstacles: {
    angkot: {
      width: 46,
      height: 74,
      color: 0x8fd3ff,
      lanes: [0, 1],
      speedFactor: 0.45, // kecepatan sendiri relatif terhadap baseSpeed pemain
      brakeTriggerDy: 300, // mulai bisa ngerem saat jarak ke pemain < ini (px)
      brakeChance: 0.5,
      brakeWarningMs: 500, // lampu rem menyala sebelum benar-benar ngerem
      brakeDecel: 300,
    },
    ojol: {
      width: 22,
      height: 40,
      color: 0x3cb371,
      lanes: [0, 1],
      speedFactor: 0.5,
      swerveTriggerDy: 380, // sein mulai berkedip saat jarak ke pemain < ini
      signalMs: 600,
      swerveMs: 280,
    },
    pedestrian: {
      radius: 11,
      color: 0xffd166,
      waitMs: 1000, // berdiri di trotoar dulu setelah terlihat
      crossSpeed: 120, // px/s
    },
    pothole: {
      width: 50,
      height: 30,
      color: 0x2a2a2a,
      lanes: [0, 1],
    },
    wrongway: {
      width: 24,
      height: 44,
      color: 0xff8c1a,
      lanes: [0, 1],
      speedFactor: -0.55, // negatif = bergerak turun (melawan arus)
      warningMs: 1000, // ikon "!" di tepi atas sebelum muncul
    },
    bus: {
      width: 64,
      height: 170,
      color: 0x1f3a93,
      lanes: [2],
      speedFactor: 0.4,
    },
  },

  trafficLight: {
    firstAtSeconds: 20,
    intervalSeconds: 30,
    jitterSeconds: 4, // jadwal berikutnya = interval ± jitter
    visibleSecondsBeforeLine: 2,
    redMinSeconds: 2,
    redMaxSeconds: 4,
    policeChance: 0.5,
    spawnPauseBeforeSeconds: 3.5, // spawner berhenti sebelum perempatan muncul
    spawnResumeAfterMeters: 12, // spawner lanjut setelah pemain melewati perempatan
    crossBandHeight: 90, // tinggi jalan melintang di atas garis stop
    crossTraffic: {
      intervalMs: 900,
      speed: 360,
      width: 70,
      height: 36,
      color: 0xc0c0c0,
    },
  },

  etle: {
    firstAtMeters: 120,
    everyMeters: 260,
  },

  scoring: {
    pointsPerMeter: 1,
    redLightObeyed: 30,
    safeDistance: 10,
    safeDistanceSeconds: 5,
    safeDistanceLookaheadPx: 320, // hanya kendaraan dalam jarak ini yang dihitung "di depan"
    bonusMeterMax: 60,
    multiplier: 2,
    multiplierSeconds: 10,
    etlePenalty: 20,
  },

  gameOver: {
    tapAnywhereDelayMs: 500,
  },

  storageKeys: {
    highScore: 'lmj_highscore',
    stats: 'lmj_stats',
  },
};

// Posisi x tengah lajur.
export function laneX(lane, cfg = CONFIG) {
  return cfg.road.sidewalkWidth + cfg.road.laneWidth * (lane + 0.5);
}

export function roadLeft(cfg = CONFIG) {
  return cfg.road.sidewalkWidth;
}

export function roadRight(cfg = CONFIG) {
  return cfg.road.sidewalkWidth + cfg.road.laneWidth * cfg.road.lanes;
}
