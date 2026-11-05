// ============================================================
// sw.js — Service worker minimal, dua tujuan:
//  1) Supaya browser menganggap aplikasi ini "bisa diinstal" (syarat PWA).
//  2) Mempercepat pembukaan di sinyal lambat dan jadi cadangan saat jaringan buruk:
//     - assets/vendor/* (supabase.js, chart.js, font) TIDAK PERNAH berubah, jadi
//       disimpan permanen: setelah pembukaan pertama, tidak diunduh ulang lagi.
//     - File aplikasi lainnya (HTML/CSS/JS buatan sendiri) diambil dari JARINGAN dulu
//       supaya pembaruan langsung terlihat; kalau jaringan gagal atau lebih dari
//       4 detik, dipakai salinan tersimpan (salinan baru tetap disimpan di latar belakang).
// TIDAK PERNAH menyimpan data Supabase — hanya file dari domain situs ini.
//
// ATURAN: setiap kali isi file ini diubah ATAU file di assets/vendor diganti dengan
// versi lain, naikkan CACHE_NAME (v7 -> v8, dst.) supaya cache lama dibuang.
// ============================================================
const CACHE_NAME = "tbr1-shell-v7";
// termasuk .html (potongan menu di partials/) dan .json (manifest) supaya menu tetap tampil saat sinyal buruk
const ASSET_PATTERN = /\.(?:css|js|png|jpg|jpeg|webp|svg|woff2?|html|json)$/;
const BATAS_TUNGGU_MS = 4000;

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// File yang tidak pernah berubah: pakai salinan tersimpan kalau ada.
async function cacheDulu(req) {
  const cache = await caches.open(CACHE_NAME);
  const salinan = await cache.match(req);
  if (salinan) return salinan;
  const resp = await fetch(req);
  if (resp && resp.ok && resp.type === "basic") cache.put(req, resp.clone());
  return resp;
}

// File aplikasi biasa: jaringan dulu, cadangan salinan kalau gagal/terlalu lama.
async function jaringanDuluBaruCache(req) {
  const cache = await caches.open(CACHE_NAME);
  const salinan = await cache.match(req);

  const jaringan = fetch(req).then(resp => {
    if (resp && resp.ok && resp.type === "basic") cache.put(req, resp.clone());
    return resp;
  });
  jaringan.catch(() => {}); // cegah galat "unhandled" kalau kalah balapan di bawah

  if (!salinan) return jaringan;

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
  if (url.searchParams.has("cek")) return;         // permintaan dari halaman cek.html: biarkan langsung ke jaringan

  if (url.pathname.includes("/assets/vendor/")) {
    event.respondWith(cacheDulu(req));
  } else if (ASSET_PATTERN.test(url.pathname) || req.mode === "navigate") {
    event.respondWith(jaringanDuluBaruCache(req));
  }
});
