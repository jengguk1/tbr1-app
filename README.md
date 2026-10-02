# Tabungan SDN TAMBERU 1

Aplikasi web ringan untuk mengelola tabungan siswa, Total Catatan, dan catatan kelas.
Dibangun dengan HTML/CSS/JavaScript murni (tanpa framework berat) agar cepat dibuka
di PC maupun HP, dengan **Supabase** sebagai database & login, dan siap di-hosting
gratis di **Cloudflare Pages**.

## Struktur folder

```
tbr1-app/
├── index.html          -> Halaman login (+ "Lupa password?")
├── reset-password.html -> Halaman atur password baru (dibuka dari link email)
├── dashboard.html       -> Beranda (sudah aktif & terhubung ke database)
├── siswa.html           -> Data Siswa
├── tabungan.html        -> Tabungan (setor/tarik, saldo per siswa)
├── catatan.html         -> Buku Catatan (pinjaman, cicilan, cetak surat)
├── transaksi.html       -> Transaksi (buku kas gabungan)
├── laporan.html         -> Laporan per siswa (setoran/minggu/bulan/tahun)
├── pengaturan.html      -> Profil saya + Manajemen Akun (admin)
├── surat-pinjaman.html  -> Surat Pernyataan Peminjaman (dibuka dari tombol "Cetak Surat")
├── assets/
│   ├── css/style.css    -> Semua styling
│   └── js/
│       ├── supabase-client.js  -> Kunci koneksi Supabase
│       ├── layout.js            -> Sidebar, topbar, cek login, logout
│       └── dashboard.js         -> Logika halaman Beranda
├── partials/
│   ├── sidebar.html
│   └── topbar.html
└── supabase/
    ├── schema.sql          -> Skrip awal: pembuatan tabel & keamanan (RLS)
    ├── 02_multi_user.sql   -> Migrasi: tabel akun (profiles) + hak akses per kelas
    ├── 03_catatan_bebas.sql -> Migrasi: Buku Catatan pakai Nama bebas, tanpa batasan kelas
    └── 04_cicilan.sql      -> Migrasi: riwayat tiap cicilan pinjaman (tabel pembayaran_hutang)
```

## Langkah 1 — Siapkan database di Supabase

1. Masuk ke [supabase.com](https://supabase.com) dengan akun **masraji03@gmail.com**,
   buka project Anda (ref: `kpgzdnpbhvfstrrdjwum`).
2. Buka menu **SQL Editor → New query**, salin seluruh isi file
   `supabase/schema.sql`, lalu klik **Run**. Ini akan membuat semua tabel
   (siswa, tabungan, hutang, transaksi, catatan, pengaturan) beserta aturan
   keamanannya.
3. Buka menu **Authentication → Users → Add user**, buat satu akun admin,
   misalnya email `admin@tamberu1.sch.id` dengan kata sandi pilihan Anda.
   Akun inilah yang dipakai untuk login di aplikasi.
4. Buka **SQL Editor → New query** lagi, salin seluruh isi file
   `supabase/02_multi_user.sql`, lalu **Run**. Ini menambahkan sistem akun
   (admin vs guru kelas) dan membatasi setiap guru hanya melihat kelasnya sendiri.
5. Masih di SQL Editor, jalankan perintah berikut (ganti email sesuai admin
   yang Anda buat di langkah 3) supaya akun itu dikenali sebagai **admin**:
   ```sql
   insert into profiles (id, nama, email, role, kelas)
   select id, 'Nama Admin', email, 'admin', null
   from auth.users
   where email = 'admin@tamberu1.sch.id'
   on conflict (id) do update set role = 'admin';
   ```
6. (Opsional, tapi disarankan) Buka **Authentication → Providers → Email**,
   matikan **"Confirm email"** kalau Bapak ingin akun guru yang baru dibuat
   bisa langsung login tanpa perlu klik link konfirmasi di email dulu.
7. Buka **SQL Editor → New query** sekali lagi, salin seluruh isi file
   `supabase/03_catatan_bebas.sql`, lalu **Run**. Ini membuat halaman
   **Buku Catatan** bisa mencatat pinjaman dari siapa saja (guru lain/teman
   sejawat) — tidak wajib memilih dari Data Siswa, dan tidak dibatasi per
   kelas seperti menu lainnya (siapa pun akun aktif boleh mencatat & melihat).
8. Buka **SQL Editor → New query** sekali lagi, salin seluruh isi file
   `supabase/04_cicilan.sql`, lalu **Run**. Ini membuat tabel riwayat cicilan,
   sehingga setiap pembayaran pinjaman tercatat (tanggal, jumlah, keterangan,
   petugas). Pembayaran lama otomatis dimasukkan sebagai satu baris
   "Pembayaran sebelumnya (tanpa rincian tanggal)". Aman dijalankan ulang.

> **Kenapa perlu login?** Kunci "anon" yang Anda berikan bersifat publik —
> siapa pun yang membuka halaman bisa melihatnya di kode. Karena itu, tabel
> di atas dikunci dengan Row Level Security: hanya orang yang **berhasil
> login** lewat Supabase Auth yang boleh membaca/menulis data. Anon key
> sendiri tidak cukup untuk mengakses data.

> **Cara kerja akun (setelah migrasi 02):** Ada dua peran — **admin** (melihat
> semua kelas, dan satu-satunya yang bisa membuka menu Manajemen Akun di
> Pengaturan) dan **guru kelas** (hanya melihat & mengelola data kelasnya
> sendiri). Setiap akun baru dibuat lewat form di halaman Pengaturan;
> menghapus akun secara permanen harus lewat Supabase Dashboard karena
> aplikasi statis ini sengaja tidak menyimpan kunci admin Supabase (service
> role key) di dalam kode — itu akan berbahaya kalau sampai bocor.

## Langkah 2 — Coba dulu di komputer Anda (opsional)

Karena aplikasi ini memuat file `partials/*.html` lewat JavaScript, ia perlu
dijalankan lewat server lokal (bukan dibuka langsung dari File Explorer).
Cara termudah, dari dalam folder `tbr1-app`, jalankan salah satu:

```bash
# Jika punya Python
python -m http.server 8080

# Jika punya Node.js
npx serve .
```

Lalu buka `http://localhost:8080` di browser.

## Langkah 3 — Deploy ke Cloudflare Pages (gratis)

**Cara termudah (tanpa GitHub), lewat unggah langsung:**

1. Masuk ke [dash.cloudflare.com](https://dash.cloudflare.com) → menu **Workers & Pages**.
2. Klik **Create → Pages → Upload assets**.
3. Beri nama project, misalnya `tabungan-tamberu1`.
4. Seret (drag & drop) seluruh isi folder `tbr1-app` (bukan folder itu sendiri,
   tapi semua file & folder di dalamnya) ke area unggah.
5. Klik **Deploy site**. Cloudflare akan memberi alamat seperti
   `https://tabungan-tamberu1.pages.dev` yang bisa dibuka dari HP maupun PC.

**Cara lain (lewat GitHub, untuk update otomatis di kemudian hari):**

1. Unggah folder ini ke sebuah repository GitHub.
2. Di Cloudflare Pages, pilih **Connect to Git**, sambungkan repo tersebut.
3. Kosongkan "Build command" (tidak perlu proses build) dan isi
   "Build output directory" dengan `/` (folder utama).
4. Deploy. Setiap kali Anda mengubah file di GitHub, situs akan otomatis
   diperbarui.

## Status pembangunan

- [x] Skema database & keamanan (Supabase)
- [x] Halaman Login
- [x] Beranda / Dashboard (kartu ringkasan, grafik, transaksi terbaru, aksi cepat) — **sudah terhubung ke data asli**
- [x] Pengaturan → Manajemen Akun (admin tambah akun guru per kelas, aktif/nonaktifkan) — **sudah terhubung ke data asli**
- [x] Pengaturan → Profil Saya (semua akun bisa lihat profil & ubah password sendiri; admin bisa kirim link reset password untuk akun guru yang lupa password) — **sudah terhubung ke data asli**
- [x] Data Siswa (tambah/ubah/aktifkan siswa, otomatis dibatasi per kelas untuk guru) — **sudah terhubung ke data asli**
- [x] Tabungan (catat setor/tarik, saldo per siswa, riwayat + hapus) — **sudah terhubung ke data asli**
- [x] Buku Catatan (catat pinjaman dari tabungan kelas — peminjam bebas siapa saja, tidak dibatasi kelas; rekap sisa, riwayat cicilan per pembayaran, cetak Surat Pernyataan Peminjaman) — **sudah terhubung ke data asli**
- [x] Transaksi (buku kas gabungan: setoran, penarikan, pinjaman, cicilan; saldo kas berjalan; filter jenis/tanggal/pencarian; cetak & unduh Excel) — **sudah terhubung ke data asli**
- [x] Laporan (per siswa / semua siswa; Per Setoran, Per Minggu, Per Bulan, Per Tahun; pemasukan & penarikan; saldo awal-akhir; filter tanggal; cetak & unduh Excel) — **sudah terhubung ke data asli**

Modul-modul yang belum selesai akan dibangun secara bertahap pada percakapan
berikutnya, menyambung langsung dari fondasi ini tanpa perlu mengulang dari awal.
