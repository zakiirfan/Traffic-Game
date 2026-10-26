# Lampu Merah Jakarta

Prototipe game web endless runner top-down tentang keselamatan berkendara di Jakarta.
Motor melaju otomatis ke atas; bertahan sejauh mungkin. Perilaku tertib diberi poin,
perilaku berbahaya ada akibatnya. Dibuat dengan Phaser 3 + Vite (JavaScript), grafik bentuk
sederhana tanpa aset gambar. Resolusi dasar 405x720 portrait, scaling FIT, jalan di desktop dan HP.

## Menjalankan

Butuh Node.js 18+.

```bash
npm install
npm run dev       # server pengembangan (http://localhost:5173)
npm test          # unit test Vitest (spawner, skor, fakta, statistik)
npm run build     # hasil build statis di folder dist/
npm run preview   # mencoba hasil build secara lokal
```

### Deploy

Setiap push ke `main` otomatis menjalankan test, build, lalu deploy ke GitHub Pages lewat
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Hasilnya ada di
`https://zakiirfan.github.io/Traffic-Game/`. Pengaturan sekali saja: di repo GitHub buka
Settings → Pages → Build and deployment → Source: **GitHub Actions**. Deploy manual bisa
dijalankan dari tab Actions → "Deploy ke GitHub Pages" → Run workflow.

Folder `dist/` memakai path relatif (`base: './'`), jadi bisa langsung di-upload ke itch.io
(zip isi `dist/`, jenis proyek HTML) atau GitHub Pages (subfolder apa pun).

## Kontrol

| Aksi | HP (touch) | Keyboard |
|---|---|---|
| Pindah lajur kiri | Tap sisi kiri layar | ← atau A |
| Pindah lajur kanan | Tap sisi kanan layar | → atau D |
| Rem (sampai berhenti) | Tahan layar > 250 ms | Spasi atau ↓ |
| Main lagi (layar game over) | Tap di mana saja (setelah 0,5 dtk) | Spasi atau Enter |

## Aturan singkat

- 3 lajur; lajur kanan adalah busway. Busway sering kosong, tapi ada kamera ETLE (−20 poin)
  dan bus (tabrakan).
- Rintangan: angkot (lampu rem menyala dulu), ojol (sein berkedip dulu), pejalan kaki (berdiri
  di trotoar dulu), lubang, motor lawan arus (ikon "!" di tepi atas dulu), bus.
- Lampu merah tiap ±30 detik: berhenti sebelum garis stop = +30 poin tertib. Nerobos = 0 poin,
  50% ada pos polisi (langsung tilang), selain itu ada kendaraan melintas dari samping.
- Helm: selamat dari satu tabrakan. Tanpa helm: lebih ngebut 10%, sekali tabrak tamat.
- Skor: +1 per meter, +30 lampu merah dipatuhi, +10 jaga jarak aman 5 detik, meteran bonus
  penuh = skor x2 selama 10 detik. Tidak ada bonus untuk perilaku berbahaya.

## Mengubah angka balancing

Semua angka ada di [`src/data/config.js`](src/data/config.js); scene dan objek tidak menyimpan angka
sendiri. Bagian yang paling sering diubah:

| Bagian | Isi |
|---|---|
| `player` | kecepatan dasar, bonus tanpa helm, rem/akselerasi, durasi tween lajur, batas tahan untuk rem, durasi kebal |
| `speed` | kenaikan kecepatan (8% tiap 10 dtk) dan batas maksimum |
| `difficulty.phases` | fase kesulitan: batas detik (`until`), jarak antar-baris spawn, peluang spawn, jumlah maksimum per baris, bobot jenis rintangan |
| `fairness.gapSeconds` | jarak waktu minimum antar-rintangan yang dianggap "satu baris" oleh validator keadilan |
| `obstacles.*` | ukuran, warna, kecepatan, dan waktu peringatan tiap rintangan |
| `trafficLight` | jadwal lampu merah, durasi merah, peluang polisi, jeda spawner di sekitar perempatan, kendaraan melintas |
| `etle` | jarak antar-kamera ETLE |
| `scoring` | semua poin, meteran bonus, pengali, penalti ETLE |

Contoh: supaya game lebih santai, turunkan `speed.stepMultiplier` ke `1.05` atau naikkan
`difficulty.phases[2].spawnEveryMeters`. Jalankan `npm test` setelah mengubah angka;
test simulasi spawner memastikan aturan keadilan tetap terpenuhi.

## Struktur

```
src/
  main.js              konfigurasi Phaser (405x720, Scale.FIT)
  scenes/              BootScene, MenuScene (helm, statistik), GameScene, GameOverScene
  objects/             Player, Obstacle (Angkot, Ojol, Pedestrian, Pothole, WrongWay, Bus), TrafficLight, EtleCamera
  systems/             Spawner, Scoring, Difficulty (logika murni, bisa di-test tanpa Phaser)
                       Facts, Stats, Storage, Share, analytics
  data/                config.js, facts.json, captions.json
  ui/Button.js         tombol sederhana
tests/                 Vitest: Spawner (aturan keadilan), Scoring, Facts, Stats
```

### Aturan keadilan spawner

`src/systems/Spawner.js` memperkirakan "jejak" tiap rintangan: lajur yang diblokir dan rentang
waktu dari saat rintangan sampai di depan motor hingga selesai terlewati (termasuk skenario angkot
ngerem). Spawn ditolak bila:

- rintangan yang waktunya berdekatan bersama-sama menutup semua lajur non-busway
  (busway tidak dihitung sebagai jalan keluar), atau menumpuk di lajur yang sama;
- motor lawan arus akan berpapasan dengan rintangan lain di lajurnya.

Fungsi validasinya (`rowLeavesEscape`, `isSpawnFair`, `wrongWayLaneClear`,
`blockedByIncomingWrongWay`) diuji di `tests/Spawner.test.js`, termasuk simulasi 40 seed dengan
pengecekan geometris independen per frame.

### Fakta keselamatan

`src/data/facts.json` berformat `{ id, trigger, text, source, verified }`. Game hanya menampilkan
fakta `verified: true`; kalau tidak ada untuk penyebab kematian itu, dipakai fakta `"umum"`.
Placeholder diberi `verified: false` dan teks diawali `[PERLU VERIFIKASI]`. Setelah sumbernya
dicek, isi `source`, hapus awalan itu, lalu ubah `verified` menjadi `true`.

Nilai `trigger`: `umum`, `angkot`, `ojol`, `pejalan_kaki`, `lubang`, `lawan_arus`, `bus`,
`tilang`, `perempatan`.

### Statistik dan analytics

Statistik (jumlah ronde, % ronde pakai helm, % lampu merah dipatuhi, penyebab kematian terbanyak)
dan skor tertinggi disimpan di localStorage, semua aksesnya dibungkus try/catch. Menu "Statistik"
menampilkannya. `src/systems/analytics.js` punya `track(event, data)` yang sekarang hanya
`console.log`; ganti isinya untuk menyambung ke Firebase. Event yang dikirim: `round_start`,
`red_light`, `etle_violation`, `helmet_save`, `game_over`, `share`.

## Asumsi

Keputusan desain yang tidak dijelaskan rinci di spesifikasi, dipilih yang paling sederhana:

- **Lampu merah selalu merah saat terlihat.** Hitung mundur 2–4 detik ke hijau baru dimulai
  saat motor benar-benar berhenti (di mana saja sebelum garis stop). Jadi setiap perempatan selalu
  jadi pilihan: berhenti atau nerobos. "Melewati garis stop" = bagian depan motor melewati garis.
- **Lampu terlihat 2 detik sebelum garis stop** dihitung dengan kecepatan jelajah. Pada kecepatan
  tinggi garis stop masih di luar layar, jadi muncul penanda "LAMPU MERAH ▲" di atas layar.
- **Spawner berhenti** mulai 3,5 detik sebelum perempatan muncul sampai pemain melewatinya,
  supaya berhenti di lampu merah selalu aman. Angkot tidak ngerem mendadak di zona ini, dan
  kendaraan NPC ikut berhenti di garis stop saat merah.
- **Kendaraan melintas** hanya ada selama merah dan hanya dimunculkan kalau sempat keluar sebelum
  lampu hijau, jadi pemain yang patuh tidak tertabrak saat lampu hijau.
- **Tilang tidak bisa diselamatkan helm** (bukan tabrakan). Tabrakan dengan kendaraan melintas
  bisa diselamatkan helm. Rintangan yang tertabrak saat helm menyelamatkan pemain akan menghilang.
- **Jaga jarak aman** hanya dihitung bila ada kendaraan di depan pada lajur yang sama dalam
  jarak 320 px dan motor sedang bergerak. Tanpa kendaraan di depan, timer berhenti (tidak
  bertambah, tidak di-reset). Jarak < panjang motor me-reset timer.
- **Meteran bonus** terisi dari poin tertib (maks 60). Selama x2 aktif, meteran tidak terisi.
  Pengali berlaku untuk semua poin positif (jarak dan tertib), tidak untuk penalti.
- **Skor tidak bisa negatif** karena penalti ETLE.
- **ETLE** memotret saat tiang kamera sejajar motor; terkena bila pemain sedang di lajur busway
  (lajur tujuan dihitung segera saat tombol ditekan).
- **Ojol** pindah ke lajur sebelahnya (boleh ke busway); batal pindah bila lajur tujuan sedang
  terisi kendaraan. Validator menganggap ojol memblokir lajur asal dan tujuan sampai ia pindah.
- **Pejalan kaki** dianggap memblokir semua lajur oleh validator, jadi tidak pernah muncul
  bersamaan dengan rintangan lain.
- **Bus** hanya di busway; rintangan lain (selain ojol yang pindah lajur) hanya di lajur biasa.
- **Tap vs tahan:** sentuhan yang dilepas sebelum 250 ms = pindah lajur; lebih lama = rem
  (tanpa pindah lajur).
- **Kecepatan naik berdasarkan waktu bermain**, termasuk saat berhenti di lampu merah.
- **Share:** kartu skor 600x800 PNG. Bila `navigator.canShare({ files })` tidak didukung
  (kebanyakan desktop), gambar diunduh.
- Kendaraan dan pos polisi memakai bentuk dan warna generik; tidak ada logo atau nama merek.
