-- ============================================================
-- Migrasi 05 — Jejak Penghapusan (Audit Log)
-- Mencatat siapa menghapus apa, kapan, dan data yang dihapus —
-- supaya kalau ada yang salah hapus, gampang ditelusuri.
-- Jalankan SETELAH 04_cicilan.sql.
-- Supabase Dashboard > SQL Editor > New query > tempel semua isi file ini > Run
-- ============================================================

create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  waktu timestamptz not null default now(),
  aksi text not null,              -- mis. "hapus"
  tabel text not null,             -- mis. "tabungan", "hutang", "pembayaran_hutang"
  ringkasan text,                  -- deskripsi singkat yang mudah dibaca
  data_sebelum jsonb,              -- salinan baris sebelum dihapus
  oleh_id uuid,
  oleh_nama text
);

alter table audit_log enable row level security;

-- Semua akun aktif boleh MENULIS log (saat mereka sendiri menghapus sesuatu).
drop policy if exists "audit_insert" on audit_log;
create policy "audit_insert" on audit_log
  for insert with check (akun_aktif());

-- Hanya admin yang boleh MELIHAT seluruh log.
drop policy if exists "audit_select_admin" on audit_log;
create policy "audit_select_admin" on audit_log
  for select using (is_admin());
