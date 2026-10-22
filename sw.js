// ============================================================
// sw.js — Service worker minimal, dua tujuan:
//  1) Supaya browser menganggap aplikasi ini "bisa diinstal" (syarat PWA).
//  2) Cadangan saat jaringan buruk/offline: file dari situs ini diambil dari
//     JARINGAN dulu (supaya pembaruan kode langsung terlihat); kalau jaringan
//     gagal ATAU terlalu lama (> 6 detik) dan sudah ada salinan lama, salinan
//     itulah yang ditampilkan — jadi di paket data yang lambat, aplikasi tidak
//     menggantung di layar logo.
// TIDAK PERNAH menyimpan data Supabase — hanya file dari domain situs ini.
//
// ATURAN: setiap kali isi file ini diubah, naikkan CACHE_NAME (v3 -> v4, dst.)
// supaya browser sadar ada service worker baru dan membuang cache lama.
// ============================================================
const CACHE_NAME = "tbr1-shell-v3";
const ASSET_PATTERN = /\.(?:css|js|png|jpg|jpeg|svg|woff2?)$/;
const BATAS_TUNGGU_MS = 6000;

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

async function jaringanDuluBaruCache(req) {
  const cache = await caches.open(CACHE_NAME);
  const salinan = await cache.match(req);

  // Ambil dari jaringan; kalau berhasil, simpan salinan baru (juga kalau datangnya terlambat).
  const jaringan = fetch(req).then(resp => {
    if (resp && resp.ok && resp.type === "basic") cache.put(req, resp.clone());
    return resp;
  });
  jaringan.catch(() => {}); // cegah galat "unhandled" kalau kalah balapan di bawah

  if (!salinan) return jaringan; // belum punya salinan: tunggu jaringan apa adanya

  const habisWaktu = new Promise((_, tolak) => setTimeout(() => tolak(new Error("timeout")), BATAS_TUNGGU_MS));
  try {
    return await Promise.race([jaringan, habisWaktu]);
  } catch (e) {
    return salinan;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jangan sentuh permintaan ke Supabase dsb.

  if (ASSET_PATTERN.test(url.pathname) || req.mode === "navigate") {
    event.respondWith(jaringanDuluBaruCache(req));
  }
});
