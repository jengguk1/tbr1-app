// ============================================================
// transaksi.js — Buku kas: semua uang masuk & keluar dalam satu daftar
//   Setoran  (tabungan, masuk)     Penarikan (tabungan, keluar)
//   Cicilan  (bayar pinjaman, masuk)   Pinjaman (uang dipinjam, keluar)
// Saldo Kas berjalan = setoran − penarikan − pinjaman + cicilan
// (sama dengan angka "Saldo Kas yang Ada Sekarang" di Beranda).
// Halaman ini hanya untuk melihat; mengubah data lewat menu asalnya.
// ============================================================
const $t = (id) => document.getElementById(id);

const JENIS_TRX = {
  setor:   { label: "Setoran",   css: "badge-setor", arah: 1 },
  tarik:   { label: "Penarikan", css: "badge-tarik", arah: -1 },
  pinjam:  { label: "Pinjaman",  css: "badge-belum", arah: -1 },
  cicilan: { label: "Cicilan",   css: "badge-lunas", arah: 1 }
};

let trxBuku = [];          // seluruh buku kas, urut lama -> baru, sudah ada saldo berjalan
let trxBatas = 100;        // jumlah baris yang ditampilkan di layar
let trxCsv = { header: [], rows: [], footer: null };
let trxInfo = null;

async function initTransaksiPage() {
  try {
    trxInfo = await infoSekolah();
    await muatBukuKas();
  } catch (err) {
    $t("tbodyT").innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(err.message || err)}</td></tr>`;
    return;
  }

  ["fJenisT", "fDariT", "fSampaiT", "chkTerbaruT"].forEach(id => $t(id).addEventListener("change", () => {
    if (id === "fDariT" || id === "fSampaiT") tandaiRentang(null);
    trxBatas = 100;
    renderTransaksi();
  }));
  $t("fCariT").addEventListener("input", () => { trxBatas = 100; renderTransaksi(); });

  document.querySelectorAll("#segRentang .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => { setRentang(btn.dataset.r); trxBatas = 100; renderTransaksi(); });
  });

  $t("btnLagi").addEventListener("click", () => { trxBatas += 100; renderTransaksi(); });
  $t("btnCsvT").addEventListener("click", unduhCsvTransaksi);
  $t("btnCetakT").addEventListener("click", () => {
    const lama = trxBatas;
    trxBatas = Infinity;          // saat dicetak, tampilkan semua baris hasil penyaringan
    renderTransaksi();
    window.print();
    trxBatas = lama;
    renderTransaksi();
  });

  renderTransaksi();
}

// ---------- Ambil & gabungkan data ----------
async function muatBukuKas() {
  const peringatan = [];

  // Tabungan wajib ada; bila gagal, seluruh halaman gagal
  const tabungan = await fetchAll(() => window.db.from("tabungan")
    .select("id, tanggal, jenis, jumlah, keterangan, petugas, created_at, siswa:siswa_id(nama, kelas)")
    .order("tanggal").order("created_at").order("id"));

  let pinjaman = [];
  try {
    pinjaman = await fetchAll(() => window.db.from("hutang")
      .select("id, tanggal, jumlah, keterangan, petugas, created_at, nama_peminjam")
      .order("tanggal").order("created_at").order("id"));
  } catch (err) {
    peringatan.push("Data pinjaman belum bisa dimuat (" + (err.message || err) + "). Jalankan migrasi 03_catatan_bebas.sql di Supabase.");
  }

  let cicilan = [];
  try {
    cicilan = await fetchAll(() => window.db.from("pembayaran_hutang")
      .select("id, tanggal, jumlah, keterangan, petugas, created_at, hutang:hutang_id(nama_peminjam)")
      .order("tanggal").order("created_at").order("id"));
  } catch (err) {
    peringatan.push("Riwayat cicilan belum aktif (" + (err.message || err) + "). Jalankan migrasi 04_cicilan.sql di Supabase — sampai saat itu saldo kas di halaman ini bisa lebih kecil dari Beranda.");
  }

  const semua = [
    ...tabungan.map(r => ({
      key: "t" + r.id, jenis: r.jenis === "tarik" ? "tarik" : "setor", tanggal: r.tanggal, dibuat: r.created_at,
      nama: (r.siswa && r.siswa.nama) || "-", kelas: (r.siswa && r.siswa.kelas) || "",
      ket: r.keterangan || "", petugas: r.petugas || "", jumlah: Number(r.jumlah)
    })),
    ...pinjaman.map(r => ({
      key: "h" + r.id, jenis: "pinjam", tanggal: r.tanggal, dibuat: r.created_at,
      nama: r.nama_peminjam || "-", kelas: "", ket: r.keterangan || "", petugas: r.petugas || "", jumlah: Number(r.jumlah)
    })),
    ...cicilan.map(r => ({
      key: "c" + r.id, jenis: "cicilan", tanggal: r.tanggal, dibuat: r.created_at,
      nama: (r.hutang && r.hutang.nama_peminjam) || "-", kelas: "", ket: r.keterangan || "", petugas: r.petugas || "", jumlah: Number(r.jumlah)
    }))
  ];

  semua.sort((a, b) =>
    a.tanggal.localeCompare(b.tanggal) || String(a.dibuat).localeCompare(String(b.dibuat)) || a.key.localeCompare(b.key));

  let saldo = 0;
  trxBuku = semua.map(e => {
    const arah = JENIS_TRX[e.jenis].arah;
    saldo += arah * e.jumlah;
    return { ...e, masuk: arah > 0 ? e.jumlah : 0, keluar: arah < 0 ? e.jumlah : 0, saldo };
  });

  const box = $t("peringatanT");
  if (peringatan.length) {
    box.innerHTML = peringatan.map(p => "⚠️ " + esc(p)).join("<br>");
    box.style.display = "block";
  } else {
    box.style.display = "none";
  }
}

// ---------- Rentang cepat ----------
function tandaiRentang(r) {
  document.querySelectorAll("#segRentang .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.r === r));
}
function setRentang(r) {
  const now = new Date();
  let dari = "", sampai = "";
  if (r === "hari") { dari = sampai = hariIni(); }
  if (r === "minggu") {
    const hariKe = (now.getDay() + 6) % 7;
    const senin = new Date(now.getFullYear(), now.getMonth(), now.getDate() - hariKe);
    const minggu = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + 6);
    dari = isoLokal(senin); sampai = isoLokal(minggu);
  }
  if (r === "bulan") {
    dari = isoLokal(new Date(now.getFullYear(), now.getMonth(), 1));
    sampai = isoLokal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }
  $t("fDariT").value = dari;
  $t("fSampaiT").value = sampai;
  tandaiRentang(r);
}

// ---------- Tampilkan ----------
const rp = (n) => formatRupiah(n);
const cellMasuk = (n) => n > 0 ? `<span class="amt-in">${rp(n)}</span>` : "-";
const cellKeluar = (n) => n > 0 ? `<span class="amt-out">${rp(n)}</span>` : "-";

function renderTransaksi() {
  const jenis = $t("fJenisT").value;
  const dari = $t("fDariT").value;
  const sampai = $t("fSampaiT").value;
  const cari = $t("fCariT").value.trim().toLowerCase();

  let tampil = trxBuku.filter(e =>
    (!jenis || e.jenis === jenis) &&
    (!dari || e.tanggal >= dari) &&
    (!sampai || e.tanggal <= sampai) &&
    (!cari || (e.nama + " " + e.ket + " " + e.petugas + " " + e.kelas).toLowerCase().includes(cari))
  );
  if ($t("chkTerbaruT").checked) tampil = tampil.slice().reverse();

  // Kartu ringkasan
  const jml = (j) => tampil.filter(e => e.jenis === j).length;
  const masuk = tampil.reduce((a, e) => a + e.masuk, 0);
  const keluar = tampil.reduce((a, e) => a + e.keluar, 0);

  $t("trxSaldoKas").textContent = rp(trxBuku.length ? trxBuku[trxBuku.length - 1].saldo : 0);
  $t("trxMasuk").textContent = rp(masuk);
  $t("trxMasukSub").textContent = `${jml("setor")} setoran · ${jml("cicilan")} cicilan`;
  $t("trxKeluar").textContent = rp(keluar);
  $t("trxKeluarSub").textContent = `${jml("tarik")} penarikan · ${jml("pinjam")} pinjaman`;
  $t("trxSelisih").innerHTML = `<span class="${masuk - keluar >= 0 ? "amt-in" : "amt-out"}">${masuk - keluar < 0 ? "− " : ""}${rp(Math.abs(masuk - keluar))}</span>`;
  $t("trxSelisihSub").textContent = `${tampil.length} transaksi`;

  // Tabel
  const tbody = $t("tbodyT");
  const dilihat = tampil.slice(0, trxBatas);
  if (tampil.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a1bd; padding:20px;">${trxBuku.length ? "Tidak ada transaksi yang cocok dengan penyaringan ini." : "Belum ada transaksi."}</td></tr>`;
    $t("tfootT").innerHTML = "";
  } else {
    tbody.innerHTML = dilihat.map(e => {
      const j = JENIS_TRX[e.jenis];
      return `
      <tr>
        <td style="white-space:nowrap;">${formatTanggal(e.tanggal)}</td>
        <td><span class="badge-status ${j.css}">${j.label}</span></td>
        <td>${esc(e.nama)}${e.kelas ? ` <span class="muted-sm">${esc(e.kelas)}</span>` : ""}</td>
        <td>${esc(e.ket || "-")}</td>
        <td>${cellMasuk(e.masuk)}</td>
        <td>${cellKeluar(e.keluar)}</td>
        <td><span class="${e.saldo < 0 ? "amt-out" : ""}">${rp(e.saldo)}</span></td>
        <td>${esc(e.petugas || "-")}</td>
      </tr>`;
    }).join("");
    $t("tfootT").innerHTML = `<tr>
      <td colspan="4">Total (${tampil.length} transaksi sesuai penyaringan)</td>
      <td>${cellMasuk(masuk)}</td><td>${cellKeluar(keluar)}</td><td></td><td></td></tr>`;
  }

  const sisa = tampil.length - dilihat.length;
  $t("wrapLagi").style.display = sisa > 0 ? "block" : "none";
  if (sisa > 0) $t("btnLagi").textContent = `Tampilkan ${Math.min(100, sisa)} lagi (${sisa} tersisa)`;

  // Data untuk CSV (seluruh hasil penyaringan, bukan hanya yang tampil)
  trxCsv = {
    header: ["Tanggal", "Jenis", "Nama", "Kelas", "Keterangan", "Masuk", "Keluar", "Saldo Kas", "Petugas"],
    rows: tampil.map(e => [formatTanggal(e.tanggal), JENIS_TRX[e.jenis].label, e.nama, e.kelas, e.ket,
      e.masuk || "", e.keluar || "", e.saldo, e.petugas]),
    footer: tampil.length ? ["Total", "", "", "", "", masuk, keluar, "", ""] : null
  };

  // Kop untuk cetak
  const teksJenis = jenis ? JENIS_TRX[jenis].label : "Semua jenis";
  const teksPeriode = (dari || sampai)
    ? `${dari ? formatTanggal(dari) : "awal"} s/d ${sampai ? formatTanggal(sampai) : "sekarang"}` : "Semua tanggal";
  const petugas = (window.currentProfile && window.currentProfile.nama) || "";
  const infoT = trxInfo || {};
  $t("printHeaderT").innerHTML = `
    <div style="text-align:center; border-bottom:3px double #111; padding-bottom:8px; margin-bottom:14px;">
      <div style="font-size:18px; font-weight:700;">${esc(infoT.nama_sekolah || "SDN TAMBERU 1")}</div>
      <div style="font-size:12px;">Kecamatan ${esc(infoT.kecamatan || "-")} — Kabupaten ${esc(infoT.kabupaten || "-")}, ${esc(infoT.provinsi || "-")}</div>
    </div>
    <div style="text-align:center; font-size:15px; font-weight:700; margin-bottom:6px;">BUKU KAS — RIWAYAT TRANSAKSI</div>
    <div style="font-size:12px; margin-bottom:12px;">
      Jenis: ${esc(teksJenis)}${cari ? " · Pencarian: " + esc(cari) : ""}<br>
      Periode: ${esc(teksPeriode)}<br>
      Dicetak: ${esc(formatTanggal(hariIni()))}${petugas ? " oleh " + esc(petugas) : ""}
    </div>`;
}

// ---------- Unduh CSV (bisa dibuka di Excel) ----------
function csvSel(v) {
  const s = String(v === null || v === undefined ? "" : v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function unduhCsvTransaksi() {
  const baris = [trxCsv.header, ...trxCsv.rows];
  if (trxCsv.footer) baris.push(trxCsv.footer);
  const isi = baris.map(r => r.map(csvSel).join(";")).join("\r\n");
  const blob = new Blob(["\ufeff" + isi], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `transaksi-${hariIni()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
