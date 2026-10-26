import { describe, it, expect } from 'vitest';
import { emptyStats, recordRound, summarize } from '../src/systems/Stats.js';
import { loadJSON, saveJSON } from '../src/systems/Storage.js';

describe('Stats', () => {
  it('statistik kosong aman diringkas', () => {
    expect(summarize(emptyStats())).toEqual({
      rounds: 0,
      helmetPct: null,
      obeyPct: null,
      lightsTotal: 0,
      topCause: null,
    });
  });

  it('menghitung ronde, % helm, % lampu merah dipatuhi, penyebab terbanyak', () => {
    let s = emptyStats();
    s = recordRound(s, { helmet: true, cause: 'angkot', lightsObeyed: 2, lightsRan: 0 });
    s = recordRound(s, { helmet: false, cause: 'tilang', lightsObeyed: 0, lightsRan: 1 });
    s = recordRound(s, { helmet: true, cause: 'angkot', lightsObeyed: 1, lightsRan: 0 });
    s = recordRound(s, { helmet: true, cause: 'lubang', lightsObeyed: 0, lightsRan: 0 });
    const sum = summarize(s);
    expect(sum.rounds).toBe(4);
    expect(sum.helmetPct).toBe(75);
    expect(sum.obeyPct).toBe(75);
    expect(sum.topCause).toEqual({ cause: 'angkot', count: 2 });
  });

  it('recordRound tidak mengubah objek asal', () => {
    const s = emptyStats();
    recordRound(s, { helmet: true, cause: 'bus' });
    expect(s.rounds).toBe(0);
    expect(s.deaths).toEqual({});
  });
});

describe('Storage', () => {
  it('tidak melempar error saat localStorage tidak tersedia atau rusak', () => {
    expect(loadJSON('apa-saja', 7)).toBe(7);
    expect(() => saveJSON('apa-saja', { a: 1 })).not.toThrow();

    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    globalThis.localStorage = broken;
    try {
      expect(loadJSON('x', 'fallback')).toBe('fallback');
      expect(saveJSON('x', 1)).toBe(false);
    } finally {
      delete globalThis.localStorage;
    }
  });
});
