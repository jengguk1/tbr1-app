// ============================================================
// sw.js — Service worker minimal, dua tujuan:
//  1) Supaya browser menganggap aplikasi ini "bisa diinstal" (syarat PWA).
//  2) Membuat file statis (css/js/gambar) sedikit lebih cepat dimuat ulang.
// TIDAK menyimpan data Supabase — semua permintaan ke luar domain ini
// (termasuk ke *.supabase.co) selalu diambil langsung dari internet,
// tidak pernah dari cache, supaya data yang ditampilkan selalu yang terbaru.
// ============================================================
const CACHE_NAME = "tbr1-shell-v1";
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

  // File statis (css/js/gambar/font): coba cache dulu, kalau tidak ada baru ambil dari jaringan.
  if (ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(resp => {
          const salinan = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, salinan));
          return resp;
        })
      )
    );
    return;
  }

  // Halaman HTML: selalu ambil dari jaringan dulu supaya tidak ada versi lama yang nyangkut;
  // cache hanya dipakai sebagai cadangan kalau benar-benar sedang offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
