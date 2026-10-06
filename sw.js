// ============================================================
// sw.js — Service worker minimal, dua tujuan:
//  1) Supaya browser menganggap aplikasi ini "bisa diinstal" (syarat PWA).
//  2) Cadangan offline SAJA (file dipakai dari cache hanya kalau benar-benar
//     tidak ada internet) — BUKAN untuk mempercepat, supaya pembaruan kode
//     selalu langsung terlihat begitu di-deploy. Pelajaran dari percobaan
//     pertama: strategi "cache dulu baru jaringan" bikin file JS/CSS lama
//     nyangkut terus di browser orang meski server sudah di-update.
// TIDAK PERNAH menyimpan data Supabase — permintaan ke *.supabase.co selalu
// langsung ke internet, tidak pernah dari cache.
//
// CACHE_NAME sengaja dibuat berbeda dari versi sebelumnya (v1 -> v2).
// File ini sendiri berubah setiap kali CACHE_NAME dinaikkan, sehingga
// browser otomatis sadar ada service worker baru dan langsung menghapus
// cache lama (lihat "activate" di bawah) — PENTING: setiap kali mengubah
// cara kerja file ini lagi di kemudian hari, naikkan juga CACHE_NAME-nya.
// ============================================================
const CACHE_NAME = "tbr1-shell-v2";
const ASSET_PATTERN = /\.(?:css|js|png|jpg|jpeg|svg|woff2?)$/;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Hanya tangani file dari domain situs ini sendiri.
  if (url.origin !== self.location.origin) return;

  // File statis (css/js/gambar/font) MAUPUN halaman HTML: selalu coba ambil
  // dari jaringan dulu. Cache hanya dipakai sebagai cadangan kalau request
  // itu gagal (mis. sedang offline) — jadi versi terbaru selalu yang tampil
  // ketika internet tersedia, cache tidak pernah "mengalahkan" server.
  if (ASSET_PATTERN.test(url.pathname) || event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then(resp => {
        const salinan = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, salinan));
        return resp;
      }).catch(() => caches.match(event.request))
    );
  }
});
