-- ============================================================
-- Migrasi 04 — Riwayat Cicilan (setiap pembayaran pinjaman tercatat)
-- Sebelumnya pembayaran hanya menambah angka "jumlah_dibayar" sehingga
-- tidak ada catatan kapan & berapa tiap cicilan dibayar. Sekarang setiap
-- pembayaran disimpan sebagai satu baris tersendiri.
-- Jalankan SETELAH 03_catatan_bebas.sql.
-- Supabase Dashboard > SQL Editor > New query > tempel semua isi file ini > Run
-- ============================================================

create table if not exists pembayaran_hutang (
  id uuid primary key default uuid_generate_v4(),
  hutang_id uuid not null references hutang(id) on delete cascade,
  tanggal date not null default current_date,
  jumlah numeric(12,2) not null check (jumlah > 0),
  keterangan text,
  petugas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pembayaran_hutang on pembayaran_hutang(hutang_id);

alter table pembayaran_hutang enable row level security;

drop policy if exists "akses_pembayaran_hutang" on pembayaran_hutang;
create policy "akses_pembayaran_hutang" on pembayaran_hutang
  for all using (akun_aktif()) with check (akun_aktif());

-- Pembayaran yang sudah terlanjur tercatat sebelum fitur ini: dimasukkan sebagai
-- satu baris supaya total riwayat cicilan sama dengan angka "dibayar" yang lama.
-- (Aman dijalankan ulang — hanya menambah untuk pinjaman yang belum punya riwayat.)
insert into pembayaran_hutang (hutang_id, tanggal, jumlah, keterangan, petugas)
select h.id, h.created_at::date, h.jumlah_dibayar,
       'Pembayaran sebelumnya (tanpa rincian tanggal)', h.petugas
from hutang h
where h.jumlah_dibayar > 0
  and not exists (select 1 from pembayaran_hutang p where p.hutang_id = h.id);
