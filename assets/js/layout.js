// ============================================================
// layout.js — dipakai oleh semua halaman terproteksi (setelah login)
// Tugas:
//  1. Pastikan user sudah login (kalau belum -> lempar ke index.html)
//  2. Suntikkan sidebar & topbar ke dalam halaman
//  3. Tandai menu yang sedang aktif
//  4. Sediakan tombol keluar (logout)
// ============================================================

async function initLayout(pageKey, pageTitle) {
  // 1. Cek sesi login
  const { data: { session } } = await window.db.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  // 1b. Ambil profil (peran admin/guru, kelas, nama) — dipakai halaman lain lewat window.currentProfile
  let profile = null;
  try {
    const { data } = await window.db
      .from("profiles")
      .select("nama, email, kelas, role, aktif")
      .eq("id", session.user.id)
      .maybeSingle();
    profile = data || null;
  } catch (e) {
    console.warn("Profil belum tersedia:", e);
  }
  window.currentProfile = profile;

  // 2. Suntikkan partial sidebar & topbar
  const sidebarSlot = document.getElementById("sidebarSlot");
  const topbarSlot = document.getElementById("topbarSlot");

  const [sidebarHtml, topbarHtml] = await Promise.all([
    fetch("partials/sidebar.html").then(r => r.text()),
    fetch("partials/topbar.html").then(r => r.text())
  ]);
  sidebarSlot.innerHTML = sidebarHtml;
  topbarSlot.innerHTML = topbarHtml;

  // 3. Tandai menu aktif + judul halaman
  document.querySelectorAll(".nav-link").forEach(link => {
    if (link.dataset.page === pageKey) link.classList.add("active");
  });
  const titleEl = document.getElementById("topbarTitle");
  if (titleEl && pageTitle) titleEl.textContent = pageTitle;

  // 4. Tampilkan nama & inisial avatar (pakai nama profil kalau sudah ada, fallback ke email)
  const displayName = (profile && profile.nama) || session.user.email || "Admin";
  const subLabel = profile ? (profile.role === "admin" ? "Admin" : (profile.kelas || "Guru")) : session.user.email;
  const emailEl = document.getElementById("userEmail");
  const avatarEl = document.getElementById("userAvatar");
  if (emailEl) emailEl.textContent = profile ? `${displayName} · ${subLabel}` : displayName;
  if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();

  // 5. Tombol keluar
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await window.db.auth.signOut();
      window.location.href = "index.html";
    });
  }

  return session;
}

// Util format Rupiah dipakai di banyak halaman
function formatRupiah(angka) {
  const n = Number(angka || 0);
  return "Rp " + n.toLocaleString("id-ID");
}

// Util format tanggal Indonesia pendek
function formatTanggal(tgl) {
  if (!tgl) return "-";
  // Tanggal "yyyy-mm-dd" dibaca sebagai tanggal lokal (bukan UTC) supaya tidak geser sehari
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tgl));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(tgl);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Tanggal lokal (WIB dsb.) dalam format yyyy-mm-dd — toISOString() memakai UTC dan
// bisa mundur sehari pada dini hari, jadi jangan dipakai untuk tanggal transaksi.
function isoLokal(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function hariIni() { return isoLokal(new Date()); }
function awalBulanIni() {
  const n = new Date();
  return isoLokal(new Date(n.getFullYear(), n.getMonth(), 1));
}

// Supabase membatasi 1000 baris per permintaan. Fungsi ini mengambil SEMUA baris
// dengan membaca halaman demi halaman. buildQuery = fungsi yang mengembalikan query BARU
// (dengan .order(...) yang stabil), mis. () => window.db.from("tabungan").select("*").order("id")
async function fetchAll(buildQuery, pageSize = 1000) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Amankan teks dari input pengguna sebelum disisipkan ke innerHTML
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
