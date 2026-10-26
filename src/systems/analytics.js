// Titik tunggal untuk analytics. Untuk sekarang hanya console.log; nanti tinggal ganti isi
// fungsi ini (mis. logEvent dari Firebase Analytics) tanpa mengubah pemanggilnya.
export function track(event, data = {}) {
  console.log('[analytics]', event, data);
}
