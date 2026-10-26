import { CONFIG } from '../data/config.js';
import { loadJSON, saveJSON } from './Storage.js';

export const CAUSE_LABELS = {
  angkot: 'Angkot ngerem mendadak',
  ojol: 'Ojol pindah lajur',
  pejalan_kaki: 'Pejalan kaki menyeberang',
  lubang: 'Lubang jalan',
  lawan_arus: 'Motor lawan arus',
  bus: 'Nabrak bus di busway',
  tilang: 'Kena tilang',
  perempatan: 'Tabrakan di perempatan',
};

export function emptyStats() {
  return { rounds: 0, helmetRounds: 0, lightsObeyed: 0, lightsTotal: 0, deaths: {} };
}

// Fungsi murni: kembalikan statistik baru setelah satu ronde.
export function recordRound(stats, round) {
  const s = { ...emptyStats(), ...stats, deaths: { ...(stats?.deaths ?? {}) } };
  s.rounds += 1;
  if (round.helmet) s.helmetRounds += 1;
  s.lightsObeyed += round.lightsObeyed ?? 0;
  s.lightsTotal += (round.lightsObeyed ?? 0) + (round.lightsRan ?? 0);
  if (round.cause) s.deaths[round.cause] = (s.deaths[round.cause] ?? 0) + 1;
  return s;
}

export function summarize(stats) {
  const s = { ...emptyStats(), ...stats };
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
  let topCause = null;
  for (const [cause, n] of Object.entries(s.deaths ?? {})) {
    if (!topCause || n > topCause.count) topCause = { cause, count: n };
  }
  return {
    rounds: s.rounds,
    helmetPct: pct(s.helmetRounds, s.rounds),
    obeyPct: pct(s.lightsObeyed, s.lightsTotal),
    lightsTotal: s.lightsTotal,
    topCause,
  };
}

export function loadStats() {
  return { ...emptyStats(), ...loadJSON(CONFIG.storageKeys.stats, {}) };
}

export function saveRound(round) {
  const next = recordRound(loadStats(), round);
  saveJSON(CONFIG.storageKeys.stats, next);
  return next;
}
