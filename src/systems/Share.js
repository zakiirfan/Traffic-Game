// Kartu skor dirender ke canvas, lalu dibagikan lewat Web Share API.
// Fallback: unduh sebagai PNG.

export function renderScoreCard({ score, tertib, seconds, distance, caption, helmet }) {
  const W = 600;
  const H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Latar: jalan dengan busway.
  ctx.fillStyle = '#1b1b1f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3b3b40';
  ctx.fillRect(60, 0, 480, H);
  ctx.fillStyle = '#8e3b2e';
  ctx.fillRect(380, 0, 160, H);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let y = 0; y < H; y += 80) ctx.fillRect(218, y, 6, 40);
  ctx.fillStyle = 'rgba(27,27,31,0.82)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.fillText('LAMPU MERAH', W / 2, 110);
  ctx.fillText('JAKARTA', W / 2, 172);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 30px Arial, sans-serif';
  wrapText(ctx, `"${caption}"`, W / 2, 250, W - 80, 38);

  ctx.fillStyle = '#bdbdbd';
  ctx.font = '26px Arial, sans-serif';
  ctx.fillText('SKOR', W / 2, 380);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px Arial, sans-serif';
  ctx.fillText(String(score), W / 2, 500);

  ctx.fillStyle = '#7dff9a';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.fillText(`Poin tertib: ${tertib}`, W / 2, 575);
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '26px Arial, sans-serif';
  ctx.fillText(`${distance} m · ${seconds} detik · ${helmet ? 'pakai helm' : 'tanpa helm'}`, W / 2, 625);

  ctx.fillStyle = '#8fd3ff';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('Tertib dapat poin. Ugal-ugalan ada akibatnya.', W / 2, 730);
  return canvas;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

// Konversi sinkron supaya navigator.share tetap dipanggil dalam aktivasi pengguna (tap).
function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Mengembalikan 'shared' | 'downloaded' | 'cancelled' | 'failed'.
export async function shareScore(data) {
  const fileName = 'lampu-merah-jakarta-skor.png';
  let dataUrl;
  try {
    dataUrl = renderScoreCard(data).toDataURL('image/png');
  } catch {
    return 'failed';
  }
  const text = `Skorku ${data.score} di Lampu Merah Jakarta (poin tertib ${data.tertib}). Berani lebih tertib?`;

  try {
    const file = new File([dataUrlToBlob(dataUrl)], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Lampu Merah Jakarta', text });
      return 'shared';
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
    // Gagal share: lanjut ke unduhan.
  }

  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
