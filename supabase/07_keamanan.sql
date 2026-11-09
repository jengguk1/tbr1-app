-- ============================================================
-- Migrasi 07 — Pengerasan Keamanan
-- Aman dijalankan berulang kali. Jalankan SETELAH 06_pengaturan_publik.sql.
-- Supabase Dashboard > SQL Editor > New query > tempel semua isi file ini > Run
--
-- Isi:
--  1. Kunci "search_path" pada fungsi bantuan (celah klasik fungsi security definer).
--  2. Semua aturan akses hanya berlaku untuk pengguna yang SUDAH LOGIN. Orang tanpa
--     login (peran "anon") tidak lagi menyentuh aturan/fungsi internal sama sekali.
--  3. Pengguna tanpa login dicabut izin tabelnya. Satu-satunya yang boleh dibaca:
--     info sekolah (untuk tampilan halaman login).
--  4. Log aktivitas: nama & ID pelaku DIISI OLEH SERVER, bukan oleh peramban,
--     sehingga tidak bisa dipalsukan atas nama orang lain.
--  5. Kolom "petugas" pada transaksi juga diisi server saat data dibuat.
-- ============================================================

-- ---------- 1. Fungsi bantuan: kunci search_path ----------
alter function public.is_admin()    set search_path = public, pg_temp;
alter function public.my_kelas()    set search_path = public, pg_temp;
alter function public.akun_aktif()  set search_path = public, pg_temp;

-- ---------- 2. Semua kebijakan: khusus pengguna yang sudah login ----------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname <> 'pengaturan_select_publik'
  loop
    execute format('alter policy %I on %I.%I to authenticated', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Info sekolah tetap boleh DIBACA siapa saja (untuk halaman login); menulis tetap khusus admin.
alter policy "pengaturan_select_publik" on public.pengaturan to anon, authenticated;

-- ---------- 3. Cabut izin tabel dari pengguna tanpa login ----------
revoke all on all tables in schema public from anon;
grant select on table public.pengaturan to anon;
alter default privileges in schema public revoke all on tables from anon;

revoke execute on function public.is_admin(), public.my_kelas(), public.akun_aktif() from public, anon;
grant  execute on function public.is_admin(), public.my_kelas(), public.akun_aktif() to authenticated;

-- ---------- 4. Log aktivitas: pelaku diisi server ----------
create or replace function public.audit_isi_pelaku()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  new.oleh_id   := auth.uid();
  new.oleh_nama := (select p.nama from public.profiles p where p.id = auth.uid());
  new.waktu     := now();
  return new;
end;
$$;
revoke execute on function public.audit_isi_pelaku() from public, anon, authenticated;

drop trigger if exists audit_isi_pelaku on public.audit_log;
create trigger audit_isi_pelaku
  before insert on public.audit_log
  for each row execute function public.audit_isi_pelaku();

-- ---------- 5. Kolom "petugas" diisi server saat data dibuat ----------
create or replace function public.isi_petugas()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare nama_akun text;
begin
  select p.nama into nama_akun from public.profiles p where p.id = auth.uid();
  if nama_akun is not null then
    new.petugas := nama_akun;
  end if;
  return new;
end;
$$;
revoke execute on function public.isi_petugas() from public, anon, authenticated;

drop trigger if exists isi_petugas on public.tabungan;
create trigger isi_petugas before insert on public.tabungan
  for each row execute function public.isi_petugas();

drop trigger if exists isi_petugas on public.hutang;
create trigger isi_petugas before insert on public.hutang
  for each row execute function public.isi_petugas();

drop trigger if exists isi_petugas on public.pembayaran_hutang;
create trigger isi_petugas before insert on public.pembayaran_hutang
  for each row execute function public.isi_petugas();
