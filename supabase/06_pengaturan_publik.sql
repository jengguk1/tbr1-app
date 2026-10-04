-- ============================================================
-- Migrasi 06 — Info sekolah boleh dibaca siapa saja (termasuk sebelum login)
-- Dipakai supaya halaman Login bisa menampilkan nama kecamatan/kabupaten
-- yang sebenarnya, bukan teks tetap. Mengubah data tetap KHUSUS ADMIN —
-- ini hanya menambah izin BACA untuk publik, bukan izin menulis.
-- Jalankan SETELAH 05_audit_log.sql.
-- Supabase Dashboard > SQL Editor > New query > tempel semua isi file ini > Run
-- ============================================================

drop policy if exists "pengaturan_select_publik" on pengaturan;
create policy "pengaturan_select_publik" on pengaturan
  for select using (true);
