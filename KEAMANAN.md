# Panduan Keamanan — Tabungan SDN TAMBERU 1

Dokumen ini untuk pengelola aplikasi. Isinya: apa yang memang publik, apa yang sudah dilindungi
(dan sudah diuji), apa yang perlu dilakukan pemilik akun, serta batasan yang masih ada.

## 1. Yang memang terlihat publik (dan itu wajar)

- **Kode aplikasi** (repo GitHub publik + situs). Tidak ada data siswa/tabungan di dalamnya.
- **`anon key` Supabase** di `assets/js/supabase-client.js`. Kunci ini *dirancang* terlihat publik;
  yang melindungi data adalah aturan akses per baris (RLS) di database, bukan kerahasiaan kunci ini.
- **Nama sekolah/kecamatan/kabupaten** (dibaca halaman login).

## 2. Yang TIDAK BOLEH pernah masuk ke repo atau chat

- **`service_role` key** Supabase (kunci yang menembus semua aturan akses).
- Password akun mana pun, dan token/kunci rahasia lain.
- Data siswa (nama, saldo, dsb.) dalam bentuk berkas CSV/cadangan.

Kalau `service_role` key pernah tertempel di mana pun: buka Supabase → Project Settings → API → buat ulang (rotate).

## 3. Yang sudah dilindungi dan diuji (migrasi `supabase/07_keamanan.sql`)

Diuji pada PostgreSQL sungguhan dengan 65 skenario (orang tanpa login, akun baru, guru nonaktif, guru kelas lain, admin):

- Orang tanpa login: **tidak bisa membaca/menulis apa pun** kecuali membaca info sekolah.
- Akun yang mendaftar sendiri lewat API (tanpa profil dari admin): **tidak punya akses apa pun**.
- Guru hanya melihat dan mengubah **kelasnya sendiri**; tidak bisa membaca email akun lain, tidak bisa
  menaikkan dirinya jadi admin, tidak bisa menambah akun, tidak bisa membaca/mengubah/menghapus log aktivitas.
- **Nama pelaku di log aktivitas dan kolom "petugas" diisi server** — tidak bisa dipalsukan atas nama orang lain.
- Fungsi bantuan database dikunci (`search_path`) dan tidak bisa dipanggil orang tanpa login.

Di sisi aplikasi (diuji di peramban dengan semua kolom teks diisi kode serangan):

- Semua teks dari database ditampilkan sebagai **teks**, bukan HTML (`esc()` / `textContent`).
- **CSP ketat** (`script-src 'self'`): peramban menolak menjalankan kode yang tidak berasal dari berkas aplikasi,
  dan hanya boleh berkomunikasi dengan situs sendiri + server Supabase milik sekolah.
- **Unduhan CSV aman dari rumus** (`=`, `+`, `-`, `@` di awal teks dinetralkan).
- Password minimal **8 karakter** pada form aplikasi.

## 4. Yang perlu dilakukan pemilik akun (sekali saja)

1. **Jalankan `supabase/07_keamanan.sql`** di Supabase → SQL Editor (aman diulang).
2. **Aktifkan verifikasi 2 langkah (2FA)** di akun **GitHub**, **Supabase**, dan **Cloudflare**.
   Siapa pun yang menguasai akun-akun ini menguasai aplikasi.
3. **GitHub** → repo → Settings → *Code security* → aktifkan **Secret scanning** dan **Push protection**
   (gratis untuk repo publik; menolak push yang mengandung kunci rahasia).
4. **Supabase** → Authentication → pengaturan Email: naikkan **Minimum password length** menjadi 8
   (letak menu bisa berbeda antar versi tampilan).
5. Pakai password admin yang **panjang dan unik** (jangan dipakai di tempat lain).
6. Tambahkan alamat situs ke **Redirect URLs** di Supabase (Authentication → URL Configuration)
   agar tautan reset password dari email mengarah ke situs yang benar.

## 5. Batasan yang diketahui (jujur)

- **Pendaftaran akun masih terbuka** di Supabase (dibutuhkan karena admin membuat akun guru dari dalam aplikasi).
  Akun yang mendaftar sendiri *tidak bisa melihat data apa pun* (sudah diuji), tapi bisa membuat akun kosong
  di daftar pengguna Supabase. Menutupnya butuh mengubah cara admin membuat akun guru (misalnya lewat Supabase
  Dashboard) — bisa dilakukan nanti bila diperlukan.
- **Buku Catatan (pinjaman) terlihat oleh semua akun aktif**, tidak dibatasi per kelas — ini disengaja
  (peminjamnya guru/rekan, bukan siswa satu kelas).
- **Guru dapat mengubah/menghapus data kelasnya sendiri** (sesuai desain). Pencatatan "ubah/hapus" di Log Aktivitas
  dilakukan oleh aplikasi; seseorang yang memanggil API langsung (di luar aplikasi) bisa mengubah data kelasnya tanpa
  tercatat. Siapa pelaku *penambahan* data dan *isi log* tetap terjamin oleh server.
- Admin memiliki akses penuh; akun admin harus dijaga ketat.
- Cadangan data (CSV) berisi data siswa: simpan di tempat aman, jangan dibagikan ke grup umum.
