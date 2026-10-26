import { describe, it, expect } from 'vitest';
import FACTS from '../src/data/facts.json';
import CAPTIONS from '../src/data/captions.json';
import { pickCaption, pickFact } from '../src/systems/Facts.js';

describe('facts.json', () => {
  it('setiap fakta punya field wajib', () => {
    for (const f of FACTS) {
      expect(typeof f.id).toBe('string');
      expect(typeof f.trigger).toBe('string');
      expect(typeof f.text).toBe('string');
      expect(typeof f.source).toBe('string');
      expect(typeof f.verified).toBe('boolean');
    }
  });

  it('fakta yang belum terverifikasi diawali [PERLU VERIFIKASI]', () => {
    for (const f of FACTS.filter((x) => !x.verified)) {
      expect(f.text.startsWith('[PERLU VERIFIKASI]')).toBe(true);
    }
  });
});

describe('pickFact', () => {
  it('hanya mengembalikan fakta terverifikasi', () => {
    for (const cause of ['angkot', 'ojol', 'pejalan_kaki', 'lubang', 'lawan_arus', 'bus', 'tilang', 'perempatan']) {
      for (let i = 0; i < 20; i++) expect(pickFact(cause).verified).toBe(true);
    }
  });

  it('memakai fakta sesuai penyebab bila ada', () => {
    expect(pickFact('lawan_arus').trigger).toBe('lawan_arus');
  });

  it('jatuh ke "umum" bila tidak ada fakta terverifikasi untuk penyebab itu', () => {
    expect(pickFact('angkot').trigger).toBe('umum');
  });

  it('null bila tidak ada fakta terverifikasi sama sekali', () => {
    expect(pickFact('angkot', [{ id: 'x', trigger: 'umum', text: 't', source: 's', verified: false }])).toBeNull();
  });
});

describe('pickCaption', () => {
  it('mengisi detik pada caption tilang', () => {
    const c = pickCaption('tilang', { tilang: ['Kena tilang di detik ke-{detik}'] }, 47);
    expect(c).toBe('Kena tilang di detik ke-47');
  });

  it('setiap penyebab kematian punya caption', () => {
    for (const cause of ['angkot', 'ojol', 'pejalan_kaki', 'lubang', 'lawan_arus', 'bus', 'tilang', 'perempatan']) {
      expect(CAPTIONS[cause]?.length).toBeGreaterThan(0);
    }
  });
});
