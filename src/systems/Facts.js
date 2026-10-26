import FACTS from '../data/facts.json';

// Hanya fakta terverifikasi yang ditampilkan. Kalau tidak ada untuk penyebab ini, pakai "umum".
export function pickFact(cause, facts = FACTS, rng = Math.random) {
  const verified = facts.filter((f) => f.verified === true);
  let pool = verified.filter((f) => f.trigger === cause);
  if (pool.length === 0) pool = verified.filter((f) => f.trigger === 'umum');
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

export function pickCaption(cause, captions, seconds, rng = Math.random) {
  const pool = captions[cause] ?? captions.umum ?? ['Game over'];
  const text = pool[Math.floor(rng() * pool.length) % pool.length];
  return text.replace('{detik}', String(seconds));
}
