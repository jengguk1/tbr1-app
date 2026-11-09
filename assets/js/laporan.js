// ============================================================
// laporan.js — Laporan tabungan per siswa
// Tampilan: Per Setoran (tiap transaksi), Per Minggu, Per Bulan, Per Tahun
// Selalu memisahkan Pemasukan (setor) dan Penarikan (tarik) + saldo.
// ============================================================
let lapSiswa = [];       // daftar siswa yang boleh dilihat akun ini
let lapTransaksi = [];   // semua transaksi tabungan (urut lama -> baru)
let lapMode = "transaksi";
let lapInfo = null;
let lapIsAdmin = false;
let lapTerakhir = { header: [], rows: [], footer: null, judul: "" }; // untuk unduh CSV

const $ = (id) => document.getElementById(id);

async function initLaporanPage() {
  const profile = window.currentProfile;
  lapIsAdmin = !!(profile && profile.role === "admin");
  if (lapIsAdmin) $("wrapKelasLaporan").style.display = "block";

  try {
    const [siswa, trx] = await Promise.all([
      fetchAll(() => window.db.from("siswa").select("id, nama, kelas, aktif")
        .order("kelas").order("nama").order("id")),
      fetchAll(() => window.db.from("tabungan")
        .select("id, tanggal, jenis, jumlah, keterangan, petugas, siswa_id, siswa:siswa_id(nama, kelas)")
        .order("tanggal").order("created_at").order("id"))
    ]);
    lapSiswa = siswa;
    lapTransaksi = trx;
  } catch (err) {
    $("tbodyLaporan").innerHTML = `<tr><td style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(err.message || err)}</td></tr>`;
    return;
  }

  lapInfo = await infoSekolah();
  isiPilihanSiswa();
  renderLaporan();
  renderRingkasanPerKelas();

  $("fKelasLaporan").addEventListener("change", () => { isiPilihanSiswa(); renderLaporan(); });
  ["fSiswaLaporan", "fDari", "fSampai", "chkTerbaru"].forEach(id => $(id).addEventListener("change", renderLaporan));

  document.querySelectorAll("#segMode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      lapMode = btn.dataset.mode;
      document.querySelectorAll("#segMode .seg-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderLaporan();
    });
  });

  $("btnCetak").addEventListener("click", () => window.print());
  $("btnCsv").addEventListener("click", unduhCsv);
}

function kelasTerpilih() {
  return lapIsAdmin ? $("fKelasLaporan").value : "";
}

function isiPilihanSiswa() {
  const kelas = kelasTerpilih();
  const list = lapSiswa.filter(s => !kelas || s.kelas === kelas);
  const labelSemua = kelas ? `Semua Siswa (${kelas})` : (lapIsAdmin ? "Semua Siswa" : "Semua Siswa (kelas saya)");
  $("fSiswaLaporan").innerHTML =
    `<option value="">${esc(labelSemua)}</option>` +
    list.map(s => `<option value="${esc(s.id)}">${esc(s.nama)} — ${esc(s.kelas || "-")}${s.aktif ? "" : " (nonaktif)"}</option>`).join("");
}

// ---------- Ringkasan per Kelas (sepanjang waktu, tidak terikat saringan tabel di bawah) ----------
const URUTAN_KELAS_LAPORAN = ["Kelas I", "Kelas II", "Kelas III", "Kelas IV", "Kelas V", "Kelas VI"];
function renderRingkasanPerKelas() {
  const tbody = $("tablePerKelas");
  const saldoPerSiswa = {};
  lapTransaksi.forEach(r => {
    const delta = r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah);
    saldoPerSiswa[r.siswa_id] = (saldoPerSiswa[r.siswa_id] || 0) + delta;
  });

  const perKelas = {};
  lapSiswa.forEach(s => {
    const kelas = s.kelas || "-";
    if (!perKelas[kelas]) perKelas[kelas] = { kelas, aktif: 0, total: 0 };
    if (s.aktif) perKelas[kelas].aktif++;
    perKelas[kelas].total += saldoPerSiswa[s.id] || 0;
  });

  const daftar = Object.values(perKelas).sort((a, b) => {
    const ia = URUTAN_KELAS_LAPORAN.indexOf(a.kelas), ib = URUTAN_KELAS_LAPORAN.indexOf(b.kelas);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (daftar.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada data siswa.</td></tr>`;
    return;
  }
  tbody.innerHTML = daftar.map(k => `
    <tr>
      <td>${esc(k.kelas)}</td>
      <td>${k.aktif}</td>
      <td>${formatRupiah(k.total)}</td>
    </tr>`).join("");
}

// ---------- Utilitas tanggal & periode ----------
function parseTgl(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtPendek(d) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
function periodeDari(tgl, mode) {
  const d = parseTgl(tgl);
  if (mode === "tahun") {
    return { key: String(d.getFullYear()), label: String(d.getFullYear()) };
  }
  if (mode === "bulan") {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return {
      key: `${d.getFullYear()}-${mm}`,
      label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    };
  }
  // Minggu: Senin s/d Minggu
  const hariKe = (d.getDay() + 6) % 7; // 0 = Senin
  const senin = new Date(d.getFullYear(), d.getMonth(), d.getDate() - hariKe);
  const minggu = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + 6);
  return {
    key: isoLokal(senin),
    label: `${fmtPendek(senin)} – ${fmtPendek(minggu)} ${minggu.getFullYear()}`
  };
}

// ---------- Hitung data sesuai filter ----------
function hitungData() {
  const kelas = kelasTerpilih();
  const siswaId = $("fSiswaLaporan").value;
  const dari = $("fDari").value;
  const sampai = $("fSampai").value;

  // Semua transaksi dalam cakupan (tanpa filter tanggal) -> saldo berjalan yang benar
  let saldo = 0;
  const cakupan = lapTransaksi
    .filter(r => (!siswaId || r.siswa_id === siswaId) && (!kelas || (r.siswa && r.siswa.kelas === kelas)))
    .map(r => {
      const masuk = r.jenis === "tarik" ? 0 : Number(r.jumlah);
      const keluar = r.jenis === "tarik" ? Number(r.jumlah) : 0;
      saldo += masuk - keluar;
      return { ...r, masuk, keluar, saldo };
    });

  let saldoAwal = 0;
  const tampil = [];
  cakupan.forEach(r => {
    if (dari && r.tanggal < dari) { saldoAwal = r.saldo; return; }
    if (sampai && r.tanggal > sampai) return;
    tampil.push(r);
  });

  const totalMasuk = tampil.reduce((a, r) => a + r.masuk, 0);
  const totalKeluar = tampil.reduce((a, r) => a + r.keluar, 0);
  return {
    tampil, saldoAwal, totalMasuk, totalKeluar,
    saldoAkhir: saldoAwal + totalMasuk - totalKeluar,
    jumlahSetor: tampil.filter(r => r.masuk > 0).length,
    jumlahTarik: tampil.filter(r => r.keluar > 0).length,
    dari, sampai, siswaId, kelas
  };
}

const NAMA_MODE = {
  transaksi: "Per Setoran", minggu: "Per Minggu", bulan: "Per Bulan", tahun: "Per Tahun"
};

// Sel tabel: v = nilai mentah (untuk CSV), h = HTML (untuk layar)
const sel = (v, h) => ({ v, h: h === undefined ? esc(v) : h });
const rpIn = (n) => n > 0 ? `<span class="amt-in">${formatRupiah(n)}</span>` : "-";
const rpOut = (n) => n > 0 ? `<span class="amt-out">${formatRupiah(n)}</span>` : "-";
const rpNet = (n) => `<span class="${n >= 0 ? "amt-in" : "amt-out"}">${n < 0 ? "− " : ""}${formatRupiah(Math.abs(n))}</span>`;

function renderLaporan() {
  const d = hitungData();
  const semuaSiswa = !d.siswaId;

  // Kartu ringkasan
  $("lapSaldoAwal").textContent = formatRupiah(d.saldoAwal);
  $("lapSaldoAwalSub").textContent = d.dari ? `Sebelum ${formatTanggal(d.dari)}` : "Awal pencatatan";
  $("lapMasuk").textContent = formatRupiah(d.totalMasuk);
  $("lapMasukSub").textContent = `${d.jumlahSetor} kali setoran`;
  $("lapKeluar").textContent = formatRupiah(d.totalKeluar);
  $("lapKeluarSub").textContent = `${d.jumlahTarik} kali penarikan`;
  $("lapSaldoAkhir").textContent = formatRupiah(d.saldoAkhir);

  $("judulTabel").textContent = `Rincian ${NAMA_MODE[lapMode]}`;

  let header, rows, footer;

  if (lapMode === "transaksi") {
    header = ["Tanggal", ...(semuaSiswa ? ["Nama", "Kelas"] : []), "Jenis", "Pemasukan", "Penarikan", "Saldo", "Keterangan", "Petugas"];
    rows = d.tampil.map(r => [
      sel(formatTanggal(r.tanggal)),
      ...(semuaSiswa ? [sel(r.siswa ? r.siswa.nama : "-"), sel(r.siswa ? r.siswa.kelas || "-" : "-")] : []),
      sel(r.jenis === "tarik" ? "Penarikan" : "Pemasukan",
        `<span class="badge-status ${r.jenis === "tarik" ? "badge-tarik" : "badge-setor"}">${r.jenis === "tarik" ? "Penarikan" : "Pemasukan"}</span>`),
      sel(r.masuk || "", rpIn(r.masuk)),
      sel(r.keluar || "", rpOut(r.keluar)),
      sel(r.saldo, formatRupiah(r.saldo)),
      sel(r.keterangan || "-"),
      sel(r.petugas || "-")
    ]);
    footer = [
      sel("Total"),
      ...Array((semuaSiswa ? 2 : 0) + 1).fill(sel("", "")),
      sel(d.totalMasuk, rpIn(d.totalMasuk)),
      sel(d.totalKeluar, rpOut(d.totalKeluar)),
      sel(d.saldoAkhir, formatRupiah(d.saldoAkhir)),
      sel("", ""), sel("", "")
    ];
  } else {
    const groups = new Map();
    d.tampil.forEach(r => {
      const p = periodeDari(r.tanggal, lapMode);
      let g = groups.get(p.key);
      if (!g) { g = { key: p.key, label: p.label, jumlah: 0, masuk: 0, keluar: 0, saldoAkhir: 0 }; groups.set(p.key, g); }
      g.jumlah++;
      g.masuk += r.masuk;
      g.keluar += r.keluar;
      g.saldoAkhir = r.saldo;
    });
    const daftar = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));

    header = ["Periode", "Transaksi", "Pemasukan", "Penarikan", "Selisih", "Saldo Akhir"];
    rows = daftar.map(g => [
      sel(g.label),
      sel(g.jumlah),
      sel(g.masuk || "", rpIn(g.masuk)),
      sel(g.keluar || "", rpOut(g.keluar)),
      sel(g.masuk - g.keluar, rpNet(g.masuk - g.keluar)),
      sel(g.saldoAkhir, formatRupiah(g.saldoAkhir))
    ]);
    footer = [
      sel("Total"),
      sel(d.tampil.length),
      sel(d.totalMasuk, rpIn(d.totalMasuk)),
      sel(d.totalKeluar, rpOut(d.totalKeluar)),
      sel(d.totalMasuk - d.totalKeluar, rpNet(d.totalMasuk - d.totalKeluar)),
      sel(d.saldoAkhir, formatRupiah(d.saldoAkhir))
    ];
  }

  if ($("chkTerbaru").checked) rows = rows.slice().reverse();

  $("theadLaporan").innerHTML = `<tr>${header.map(h => `<th>${esc(h)}</th>`).join("")}</tr>`;
  $("tbodyLaporan").innerHTML = rows.length === 0
    ? `<tr><td colspan="${header.length}" style="text-align:center; color:#94a1bd; padding:20px;">Tidak ada transaksi pada pilihan ini.</td></tr>`
    : rows.map(r => `<tr>${r.map(c => `<td>${c.h}</td>`).join("")}</tr>`).join("");
  $("tfootLaporan").innerHTML = rows.length === 0 ? "" : `<tr>${footer.map(c => `<td>${c.h}</td>`).join("")}</tr>`;

  // Simpan untuk unduh CSV
  lapTerakhir = { header, rows: rows.map(r => r.map(c => c.v)), footer: rows.length ? footer.map(c => c.v) : null };

  // Kop untuk cetak
  const optSiswa = $("fSiswaLaporan").selectedOptions[0];
  const namaSiswa = optSiswa ? optSiswa.textContent : "-";
  const periodeTeks = (d.dari || d.sampai)
    ? `${d.dari ? formatTanggal(d.dari) : "awal"} s/d ${d.sampai ? formatTanggal(d.sampai) : "sekarang"}`
    : "Semua tanggal";
  const petugas = (window.currentProfile && window.currentProfile.nama) || "";
  const info = lapInfo || {};
  $("printHeader").innerHTML = `
    <div style="text-align:center; border-bottom:3px double #111; padding-bottom:8px; margin-bottom:14px;">
      <div style="font-size:18px; font-weight:700;">${esc(info.nama_sekolah || "SDN TAMBERU 1")}</div>
      <div style="font-size:12px;">Kecamatan ${esc(info.kecamatan || "-")} — Kabupaten ${esc(info.kabupaten || "-")}, ${esc(info.provinsi || "-")}</div>
    </div>
    <div style="text-align:center; font-size:15px; font-weight:700; margin-bottom:6px;">LAPORAN TABUNGAN (${esc(NAMA_MODE[lapMode].toUpperCase())})</div>
    <div style="font-size:12px; margin-bottom:12px;">
      Siswa: <b>${esc(namaSiswa)}</b><br>
      Periode: ${esc(periodeTeks)}<br>
      Dicetak: ${esc(formatTanggal(hariIni()))}${petugas ? " oleh " + esc(petugas) : ""}
    </div>`;
}

// ---------- Unduh CSV (bisa dibuka di Excel) ----------
function csvCell(v) { return csvAman(v); }

function unduhCsv() {
  const t = lapTerakhir;
  const baris = [t.header, ...t.rows];
  if (t.footer) baris.push(t.footer);
  const isi = baris.map(r => r.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob(["\ufeff" + isi], { type: "text/csv;charset=utf-8;" });

  const opt = $("fSiswaLaporan").selectedOptions[0];
  const namaBersih = (opt ? opt.textContent : "semua").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `laporan-tabungan-${namaBersih}-${lapMode}-${hariIni()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
