-- ============================================================
-- Aplikasi Tabungan SDN TAMBERU 1 — Skema Database (Supabase)
-- Jalankan seluruh file ini di: Supabase Dashboard > SQL Editor > New query
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- 1. DATA SISWA ----------
create table if not exists siswa (
  id uuid primary key default uuid_generate_v4(),
  nama text not null,
  nisn text,
  kelas text,
  jenis_kelamin text check (jenis_kelamin in ('L','P')),
  alamat text,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 2. TABUNGAN (setoran / penarikan) ----------
create table if not exists tabungan (
  id uuid primary key default uuid_generate_v4(),
  siswa_id uuid not null references siswa(id) on delete cascade,
  tanggal date not null default current_date,
  jenis text not null check (jenis in ('setor','tarik')) default 'setor',
  jumlah numeric(12,2) not null check (jumlah > 0),
  keterangan text,
  petugas text,
  created_at timestamptz not null default now()
);

-- ---------- 3. BUKU HUTANG ----------
create table if not exists hutang (
  id uuid primary key default uuid_generate_v4(),
  siswa_id uuid not null references siswa(id) on delete cascade,
  tanggal date not null default current_date,
  jumlah numeric(12,2) not null check (jumlah > 0),
  jumlah_dibayar numeric(12,2) not null default 0,
  keterangan text,
  status text not null check (status in ('lunas','belum')) default 'belum',
  petugas text,
  created_at timestamptz not null default now()
);

-- ---------- 4. CATATAN TRANSAKSI (log gabungan, dipakai halaman Catatan & Laporan) ----------
create table if not exists transaksi (
  id uuid primary key default uuid_generate_v4(),
  siswa_id uuid references siswa(id) on delete set null,
  tanggal date not null default current_date,
  jenis text not null check (jenis in ('tabungan','hutang')),
  keterangan text,
  jumlah numeric(12,2) not null,
  petugas text,
  created_at timestamptz not null default now()
);

-- ---------- 5. BUKU CATATAN (catatan bebas guru) ----------
create table if not exists catatan (
  id uuid primary key default uuid_generate_v4(),
  judul text not null,
  isi text,
  tanggal date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- 6. PENGATURAN (satu baris konfigurasi sekolah) ----------
create table if not exists pengaturan (
  id int primary key default 1,
  nama_sekolah text not null default 'SDN TAMBERU 1',
  kecamatan text default 'Batumarmar',
  kabupaten text default 'Pamekasan',
  provinsi text default 'Jawa Timur',
  kepala_sekolah text default 'MUSTAJI, S.Pd.M.M.Pd',
  tahun_pelajaran text default '2025/2026',
  motto text default 'Anak Hebat Berawal dari Kebiasaan Baik',
  tagline text default 'Maju Bersama, Cerdas Semua',
  logo_url text,
  constraint pengaturan_single_row check (id = 1)
);
insert into pengaturan (id) values (1) on conflict (id) do nothing;

-- ---------- INDEXES ----------
create index if not exists idx_tabungan_siswa on tabungan(siswa_id);
create index if not exists idx_hutang_siswa on hutang(siswa_id);
create index if not exists idx_transaksi_siswa on transaksi(siswa_id);
create index if not exists idx_transaksi_tanggal on transaksi(tanggal);

-- ============================================================
-- ROW LEVEL SECURITY
-- Kunci Anon (anon key) TIDAK diberi akses langsung.
-- Hanya user yang login lewat Supabase Auth (admin sekolah) yang
-- boleh membaca/menulis data. Ini penting karena anon key akan
-- tertulis di kode frontend dan bisa dilihat siapa saja.
-- ============================================================
alter table siswa enable row level security;
alter table tabungan enable row level security;
alter table hutang enable row level security;
alter table transaksi enable row level security;
alter table catatan enable row level security;
alter table pengaturan enable row level security;

create policy "admin_all_siswa" on siswa
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin_all_tabungan" on tabungan
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin_all_hutang" on hutang
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin_all_transaksi" on transaksi
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin_all_catatan" on catatan
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin_all_pengaturan" on pengaturan
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- SETELAH MENJALANKAN FILE INI:
-- Buat akun admin lewat Supabase Dashboard > Authentication > Users > Add user
-- (isi email & password, misalnya admin@tamberu1.sch.id)
-- Akun itulah yang dipakai login di halaman index.html aplikasi.
-- ============================================================
