# Sistem Kode Ulasan Google Maps

Sistem untuk mencetak ratusan/ribuan kode QR yang awalnya **kosong (belum aktif)**.
Anda aktifkan satu-satu belakangan dengan menempelkan link Google Maps Review —
begitu diaktifkan, siapa pun yang scan kode itu langsung diarahkan ke link tersebut.

Cara kerja singkat:

```
1. Generate 1000 kode di panel admin  →  semua berstatus "belum aktif"
2. Cetak semua kode (lembar tiket siap potong)
3. Tempel kode fisik di lokasi / kartu / stiker
4. Kapan pun mau, buka panel admin → aktifkan 1 kode → tempel link Google Maps
5. Orang scan kode itu → langsung terbuka halaman review Google Maps Anda
6. Kode yang belum diaktifkan, kalau di-scan, akan menampilkan halaman
   "Belum Aktif" yang rapi — bukan error kosong.
```

## ⚠️ Yang perlu Anda tahu sebelum pakai

Ini adalah **kode sumber lengkap yang perlu di-deploy (di-hosting)** agar bisa
dipindai dari HP orang lain di dunia nyata. Panel admin dan lembar cetak ini
tidak bisa jalan hanya di dalam chat — QR code perlu mengarah ke **alamat
web yang benar-benar online**, karena kamera HP orang lain memindai barcode
itu langsung ke internet, bukan lewat percakapan ini.

Kabar baiknya: semua kodenya sudah lengkap dan siap pakai. Anda tinggal
deploy ke hosting (10–15 menit, langkah-langkahnya di bawah), atau jalankan
sendiri di komputer/VPS Anda.

## Isi proyek

```
gmaps-barcode-system/
├── server.js              # Server utama (Express)
├── lib/
│   ├── store.js           # Penyimpanan data kode (file JSON)
│   └── codes.js           # Pembuat kode unik
├── views/
│   ├── print.ejs           # Halaman cetak (lembar tiket QR)
│   └── pending.ejs         # Halaman saat kode belum aktif / tidak ada
├── public/
│   ├── admin.html           # Panel admin
│   ├── admin.css
│   └── admin.js
├── data/codes.json          # Database sederhana (dibuat otomatis)
├── .env.example              # Contoh pengaturan
└── package.json
```

## Menjalankan di komputer sendiri (untuk uji coba)

Butuh Node.js versi 18 ke atas.

```bash
cd gmaps-barcode-system
npm install
cp .env.example .env
```

Buka file `.env`, isi minimal dua baris ini:

```
ADMIN_PASSWORD=isi-password-anda-sendiri
SESSION_SECRET=string-acak-panjang-bebas
```

Lalu jalankan:

```bash
npm start
```

Buka `http://localhost:3000/admin` di browser, login dengan password yang
Anda isi tadi. Untuk uji coba lokal, QR code akan mengarah ke
`http://localhost:3000/...` — hanya bisa dibuka dari komputer Anda sendiri,
belum bisa di-scan dari HP orang lain sampai di-deploy online (lihat bawah).

## Deploy ke internet (supaya bisa di-scan dari HP mana pun)

Sistem ini butuh server yang **hidup terus** dan **menyimpan file** (karena
status "aktif/belum aktif" tiap kode disimpan di file `data/codes.json`).
Rekomendasi termudah:

### Opsi A — Railway atau Render (paling mudah, gratis untuk mulai)

1. Buat akun di [railway.app](https://railway.app) atau [render.com](https://render.com).
2. Upload folder proyek ini ke GitHub (bisa lewat GitHub Desktop atau `git push`).
3. Di Railway/Render, pilih "Deploy from GitHub repo", arahkan ke repo tadi.
4. Di pengaturan environment variables, isi:
   - `ADMIN_PASSWORD` → password admin Anda
   - `SESSION_SECRET` → string acak panjang
   - `BASE_URL` → alamat yang diberikan platform, misal `https://nama-app.up.railway.app`
     (harus diisi **setelah** Anda tahu alamatnya, karena ini dipakai di dalam QR code)
5. Aktifkan **persistent disk / volume** untuk folder `data/` supaya kode tidak
   hilang saat server restart (di Railway: tambahkan Volume, mount ke `/app/data`).
6. Deploy. Buka `https://alamat-anda/admin` untuk login.

### Opsi B — VPS sendiri (DigitalOcean, dsb.)

1. `git clone` proyek ini ke server, `npm install`, isi `.env` (termasuk `BASE_URL`
   dengan domain asli Anda, contoh `https://review.tokoanda.com`).
2. Jalankan dengan process manager agar tetap hidup, contoh:
   ```bash
   npm install -g pm2
   pm2 start server.js --name gmaps-review
   pm2 save
   ```
3. Pasang Nginx/Caddy di depan untuk HTTPS (domain + SSL), arahkan ke port 3000.

**Penting:** kolom `BASE_URL` di `.env` menentukan isi QR code. Kalau nanti
Anda pindah domain, QR yang sudah dicetak tidak akan ikut berubah — jadi
tentukan domain final dulu sebelum mencetak dalam jumlah banyak.

## Cara pakai panel admin

1. **Buat Kode Baru** — tentukan jumlah (misal 1000), awalan kode (opsional,
   misal `CBG` untuk cabang Cikarang), dan label batch. Semua kode baru
   otomatis berstatus *Belum Aktif*.
2. **Cetak Semua** atau **Cetak Terpilih** — membuka lembar cetak berisi kartu
   QR siap potong (ada garis putus-putus panduan gunting), lalu tekan
   "Cetak / Simpan PDF" di browser.
3. Tempelkan kode fisik di lokasi, meja, kemasan, dsb — kode ini masih *kosong*.
4. Saat siap dipakai (misalnya per meja, per outlet, atau per event), buka
   baris kode tersebut di tabel → klik **Aktifkan** → tempel link Google Maps
   Review Anda → simpan. Sejak saat itu, scan kode tersebut langsung
   mengarahkan ke link itu.
5. Anda bisa **Nonaktifkan** atau **Ubah Link** kapan saja tanpa cetak ulang
   kartu fisiknya — karena QR hanya berisi kode unik, bukan link itu sendiri.
6. **Ekspor CSV** untuk menyimpan daftar semua kode beserta statusnya.

## Cara mendapatkan link Google Maps Review Anda

Buka Google Maps → cari lokasi bisnis Anda → klik "Tulis ulasan" pada profil
bisnis Anda sendiri (perlu jadi pemilik/manager yang terverifikasi di Google
Business Profile) → salin link yang muncul. Link ini yang Anda tempel saat
mengaktifkan kode.

## Catatan keamanan

- Ganti `ADMIN_PASSWORD` dan `SESSION_SECRET` sebelum deploy — jangan pakai
  contoh di `.env.example`.
- Selalu akses panel admin lewat HTTPS di production.
- File `data/codes.json` adalah satu-satunya sumber data — cadangkan (backup)
  secara berkala jika kode sangat berharga (misal lewat fitur Ekspor CSV atau
  menyalin file tersebut).
