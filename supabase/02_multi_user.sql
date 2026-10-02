-- ============================================================
-- Migrasi 02 — Manajemen Akun (multi-user per kelas)
-- Jalankan file ini SETELAH schema.sql (tidak perlu mengulang schema.sql).
-- Supabase Dashboard > SQL Editor > New query > tempel semua isi file ini > Run
-- ============================================================

-- ---------- 1. TABEL PROFIL AKUN ----------
-- Setiap akun login (admin ATAU guru kelas) punya satu baris di sini.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text not null,
  kelas text,                -- null untuk admin; diisi untuk guru kelas, mis. "Kelas III"
  role text not null check (role in ('admin','guru')) default 'guru',
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- ---------- 2. FUNGSI BANTUAN (security definer, aman dari rekursi RLS) ----------
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and aktif = true
  );
$$;

create or replace function public.my_kelas()
returns text
language sql security definer stable
as $$
  select kelas from public.profiles where id = auth.uid() and aktif = true;
$$;

create or replace function public.akun_aktif()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and aktif = true
  );
$$;

-- ---------- 3. RLS TABEL PROFILES ----------
-- Semua orang yang login boleh melihat profil dirinya sendiri; admin boleh melihat semua.
create policy "profiles_select" on profiles
  for select using (auth.uid() = id or is_admin());

-- Hanya admin yang boleh menambah akun baru.
create policy "profiles_insert_admin" on profiles
  for insert with check (is_admin());

-- Hanya admin yang boleh mengubah akun (termasuk aktif/nonaktifkan).
create policy "profiles_update_admin" on profiles
  for update using (is_admin()) with check (is_admin());

-- ---------- 4. PERBARUI RLS TABEL LAMA: dibatasi per kelas untuk guru, bebas untuk admin ----------
drop policy if exists "admin_all_siswa" on siswa;
create policy "akses_siswa" on siswa
  for all
  using (akun_aktif() and (is_admin() or kelas = my_kelas()))
  with check (akun_aktif() and (is_admin() or kelas = my_kelas()));

drop policy if exists "admin_all_tabungan" on tabungan;
create policy "akses_tabungan" on tabungan
  for all
  using (
    akun_aktif() and (
      is_admin() or exists (select 1 from siswa s where s.id = tabungan.siswa_id and s.kelas = my_kelas())
    )
  )
  with check (
    akun_aktif() and (
      is_admin() or exists (select 1 from siswa s where s.id = tabungan.siswa_id and s.kelas = my_kelas())
    )
  );

drop policy if exists "admin_all_hutang" on hutang;
create policy "akses_hutang" on hutang
  for all
  using (
    akun_aktif() and (
      is_admin() or exists (select 1 from siswa s where s.id = hutang.siswa_id and s.kelas = my_kelas())
    )
  )
  with check (
    akun_aktif() and (
      is_admin() or exists (select 1 from siswa s where s.id = hutang.siswa_id and s.kelas = my_kelas())
    )
  );

drop policy if exists "admin_all_transaksi" on transaksi;
create policy "akses_transaksi" on transaksi
  for all
  using (
    akun_aktif() and (
      is_admin() or exists (select 1 from siswa s where s.id = transaksi.siswa_id and s.kelas = my_kelas())
    )
  )
  with check (
    akun_aktif() and (
      is_admin() or exists (select 1 from siswa s where s.id = transaksi.siswa_id and s.kelas = my_kelas())
    )
  );

-- Pengaturan sekolah: hanya admin yang boleh mengubah (guru boleh tidak perlu akses sama sekali dulu).
drop policy if exists "admin_all_pengaturan" on pengaturan;
create policy "akses_pengaturan" on pengaturan
  for all using (is_admin()) with check (is_admin());

-- Catatan bebas: tetap untuk semua akun aktif (belum dibatasi per kelas).
drop policy if exists "admin_all_catatan" on catatan;
create policy "akses_catatan" on catatan
  for all using (akun_aktif()) with check (akun_aktif());

-- ============================================================
-- WAJIB DILAKUKAN SEKALI SETELAH MENJALANKAN FILE INI:
-- Daftarkan akun admin yang SUDAH ADA (yang dibuat lewat Authentication > Users)
-- ke tabel profiles, supaya dikenali sebagai admin. Ganti email di bawah ini
-- dengan email admin Bapak, lalu jalankan terpisah:
--
-- insert into profiles (id, nama, email, role, kelas)
-- select id, 'Nama Admin', email, 'admin', null
-- from auth.users
-- where email = 'admin@tamberu1.sch.id'
-- on conflict (id) do update set role = 'admin';
--
-- Setelah baris admin ini ada, menu "Manajemen Akun" di halaman
-- Pengaturan baru bisa dipakai untuk menambah akun guru kelas lain.
-- ============================================================
