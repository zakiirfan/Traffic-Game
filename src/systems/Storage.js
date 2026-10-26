// Pembungkus localStorage yang aman: semua akses di dalam try/catch karena storage bisa
// tidak tersedia (mode privat, diblokir, dsb). Game tetap jalan tanpa storage.

export function loadJSON(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
