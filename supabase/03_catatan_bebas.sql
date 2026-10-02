-- ============================================================
-- Migrasi 03 — Buku Catatan bukan untuk siswa, dan tidak dibatasi kelas
-- Yang meminjam dari tabungan kelas adalah guru lain/teman sejawat —
-- bukan siswa, dan boleh siapa saja (tidak dikunci per kelas seperti
-- Data Siswa/Tabungan). Jadi catatan pinjaman pakai Nama bebas (teks),
-- bisa diisi/dilihat oleh akun mana pun yang aktif.
-- Jalankan SETELAH schema.sql dan 02_multi_user.sql.
-- Supabase Dashboard > SQL Editor > New query > tempel semua isi file ini > Run
-- ============================================================

alter table hutang alter column siswa_id drop not null;
alter table hutang add column if not exists nama_peminjam text;

-- RLS baru: semua akun yang aktif (admin ATAUPUN guru kelas manapun)
-- boleh mencatat dan melihat semua pinjaman — tidak dibatasi per kelas,
-- karena peminjamnya bukan siswa satu kelas tertentu.
drop policy if exists "akses_hutang" on hutang;
create policy "akses_hutang" on hutang
  for all using (akun_aktif()) with check (akun_aktif());
