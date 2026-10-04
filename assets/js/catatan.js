// ============================================================
// catatan.js — Catat pinjaman dari tabungan kelas (tabel: hutang)
// + riwayat setiap cicilan (tabel: pembayaran_hutang)
// Peminjam BUKAN siswa dan TIDAK dibatasi per kelas — boleh siapa
// saja (guru lain/teman sejawat), dicatat & dilihat akun aktif mana pun.
// ============================================================
let namaPetugasGlobal = "Admin";
let bayarTarget = null; // { id, nama, sisa }

async function initCatatanPage() {
  const profile = window.currentProfile;
  namaPetugasGlobal = (profile && profile.nama) || "Admin";

  document.getElementById("fTanggalPinjam").value = hariIni();

  document.getElementById("formPinjam").addEventListener("submit", handleSubmitPinjam);
  document.getElementById("formBayar").addEventListener("submit", handleSubmitBayar);
  document.getElementById("btnBatalBayar").addEventListener("click", tutupModalBayar);
  document.getElementById("modalBayar").addEventListener("click", (e) => {
    if (e.target.id === "modalBayar") tutupModalBayar();
  });

  await refreshSemua();
}

function refreshSemua() {
  return Promise.all([renderRekapPinjam(), muatRiwayatPinjam(), muatRiwayatBayar()]);
}

// ---------- Catat pinjaman baru ----------
async function handleSubmitPinjam(e) {
  e.preventDefault();
  const msgBox = document.getElementById("formMsg");
  const btn = document.getElementById("btnSimpanPinjam");
  const showMsg = (text, type) => {
    msgBox.textContent = text;
    msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
    msgBox.style.display = text ? "block" : "none";
  };
  showMsg("", null);

  const payload = {
    nama_peminjam: document.getElementById("fNamaPeminjam").value.trim(),
    tanggal: document.getElementById("fTanggalPinjam").value,
    jumlah: Number(document.getElementById("fJumlahPinjam").value),
    jumlah_dibayar: 0,
    status: "belum",
    keterangan: document.getElementById("fKeteranganPinjam").value.trim() || null,
    petugas: namaPetugasGlobal
  };

  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  try {
    const saldoKas = await hitungSaldoKas();
    if (payload.jumlah > saldoKas) {
      throw new Error(`jumlah pinjaman melebihi Saldo Kas yang ada sekarang (${formatRupiah(saldoKas)}).`);
    }
    const { error } = await window.db.from("hutang").insert(payload);
    if (error) throw error;
    showMsg("Pinjaman berhasil dicatat.", "success");
    document.getElementById("formPinjam").reset();
    document.getElementById("fTanggalPinjam").value = hariIni();
    await refreshSemua();
  } catch (err) {
    showMsg("Gagal menyimpan: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Pinjaman";
  }
}

// ---------- Rekap sisa pinjaman per nama ----------
async function renderRekapPinjam() {
  const tbody = document.getElementById("tableRekapPinjam");
  let rows;
  try {
    rows = await fetchAll(() => window.db.from("hutang")
      .select("nama_peminjam, jumlah, jumlah_dibayar").order("created_at").order("id"));
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(error.message)}</td></tr>`;
    return;
  }

  const map = {};
  rows.forEach(r => {
    const key = r.nama_peminjam || "-";
    map[key] = (map[key] || 0) + (Number(r.jumlah) - Number(r.jumlah_dibayar || 0));
  });

  const hasil = Object.entries(map)
    .map(([nama, sisa]) => ({ nama, sisa }))
    .filter(r => r.sisa > 0)
    .sort((a, b) => a.nama.localeCompare(b.nama));

  if (hasil.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#94a1bd; padding:20px;">Tidak ada pinjaman yang belum lunas.</td></tr>`;
    return;
  }
  tbody.innerHTML = hasil.map(r => `
    <tr>
      <td>${esc(r.nama)}</td>
      <td>${formatRupiah(r.sisa)}</td>
    </tr>`).join("");
}

// ---------- Riwayat pinjaman ----------
async function muatRiwayatPinjam() {
  const tbody = document.getElementById("tableRiwayatPinjam");
  const { data, error } = await window.db
    .from("hutang")
    .select("id, tanggal, nama_peminjam, jumlah, jumlah_dibayar, status, keterangan, petugas")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(error.message)}<br><span style="font-size:11.5px;">Kemungkinan migrasi 03_catatan_bebas.sql belum dijalankan di Supabase.</span></td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada catatan pinjaman.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {
    const sisa = Number(r.jumlah) - Number(r.jumlah_dibayar || 0);
    return `
    <tr>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${esc(r.nama_peminjam || "-")}</td>
      <td>${formatRupiah(r.jumlah)}</td>
      <td>${formatRupiah(r.jumlah_dibayar || 0)}</td>
      <td>${formatRupiah(sisa)}</td>
      <td><span class="badge-status ${r.status === "lunas" ? "badge-lunas" : "badge-belum"}">${r.status === "lunas" ? "Lunas" : "Belum"}</span></td>
      <td>${esc(r.keterangan || "-")}</td>
      <td style="white-space:nowrap;">
        ${r.status === "lunas" ? "" : `<button class="link-btn" data-action="bayar" data-id="${esc(r.id)}">Bayar</button> &nbsp;·&nbsp;`}
        <button class="link-btn" data-action="cetak" data-id="${esc(r.id)}">Cetak Surat</button>
        &nbsp;·&nbsp;
        <button class="link-btn" data-action="hapus" data-id="${esc(r.id)}">Hapus</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll('button[data-action="bayar"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const row = data.find(r => r.id === btn.dataset.id);
      if (row) bukaModalBayar(row);
    });
  });

  tbody.querySelectorAll('button[data-action="hapus"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus catatan pinjaman ini beserta seluruh riwayat pembayarannya?")) return;
      btn.disabled = true;
      const row = data.find(r => r.id === btn.dataset.id);
      if (row) {
        await catatAuditHapus("hutang", row,
          `Pinjaman ${row.nama_peminjam || "-"} ${formatRupiah(row.jumlah)} (sisa ${formatRupiah(Number(row.jumlah) - Number(row.jumlah_dibayar || 0))})`);
      }
      const { error } = await window.db.from("hutang").delete().eq("id", btn.dataset.id);
      if (error) alert("Gagal menghapus: " + error.message);
      await refreshSemua();
    });
  });

  tbody.querySelectorAll('button[data-action="cetak"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const row = data.find(r => r.id === btn.dataset.id);
      if (!row) return;
      sessionStorage.setItem("suratPinjamanData", JSON.stringify({
        nama: row.nama_peminjam || "-",
        jumlah: row.jumlah,
        tanggal: row.tanggal,
        keterangan: row.keterangan || "-",
        petugas: row.petugas || namaPetugasGlobal
      }));
      window.open("surat-pinjaman.html", "_blank");
    });
  });
}

// ---------- Form pembayaran / cicilan ----------
function bukaModalBayar(row) {
  const sisa = Number(row.jumlah) - Number(row.jumlah_dibayar || 0);
  bayarTarget = { id: row.id, nama: row.nama_peminjam || "-", sisa };
  document.getElementById("bayarInfo").textContent =
    `${bayarTarget.nama} — pinjaman ${formatRupiah(row.jumlah)}, sudah dibayar ${formatRupiah(row.jumlah_dibayar || 0)}, sisa ${formatRupiah(sisa)}`;
  document.getElementById("fTanggalBayar").value = hariIni();
  document.getElementById("fJumlahBayar").value = sisa;
  document.getElementById("fKeteranganBayar").value = "";
  document.getElementById("bayarMsg").style.display = "none";
  document.getElementById("modalBayar").style.display = "flex";
}

function tutupModalBayar() {
  bayarTarget = null;
  document.getElementById("modalBayar").style.display = "none";
}

async function handleSubmitBayar(e) {
  e.preventDefault();
  if (!bayarTarget) return;
  const msgBox = document.getElementById("bayarMsg");
  const btn = document.getElementById("btnSimpanBayar");
  const showMsg = (text) => {
    msgBox.textContent = text;
    msgBox.className = "form-msg form-msg-error";
    msgBox.style.display = text ? "block" : "none";
  };
  showMsg("");

  const jumlah = Number(document.getElementById("fJumlahBayar").value);
  if (!jumlah || jumlah <= 0) { showMsg("Jumlah pembayaran tidak valid."); return; }
  if (jumlah > bayarTarget.sisa) {
    showMsg(`Jumlah melebihi sisa pinjaman (${formatRupiah(bayarTarget.sisa)}).`);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  try {
    const { error } = await window.db.from("pembayaran_hutang").insert({
      hutang_id: bayarTarget.id,
      tanggal: document.getElementById("fTanggalBayar").value,
      jumlah,
      keterangan: document.getElementById("fKeteranganBayar").value.trim() || null,
      petugas: namaPetugasGlobal
    });
    if (error) throw error;
    await sinkronkanPembayaran(bayarTarget.id);
    tutupModalBayar();
    await refreshSemua();
  } catch (err) {
    showMsg("Gagal menyimpan pembayaran: " + (err.message || err) +
      " (Jika pesannya soal tabel tidak ditemukan, jalankan dulu migrasi 04_cicilan.sql di Supabase.)");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Pembayaran";
  }
}

// Hitung ulang "dibayar" dan status pinjaman dari seluruh riwayat cicilannya,
// sehingga angka sisa selalu cocok dengan catatan pembayaran.
async function sinkronkanPembayaran(hutangId) {
  const { data: pays, error: e1 } = await window.db
    .from("pembayaran_hutang").select("jumlah").eq("hutang_id", hutangId);
  if (e1) throw e1;
  const total = (pays || []).reduce((a, p) => a + Number(p.jumlah), 0);

  const { data: h, error: e2 } = await window.db.from("hutang").select("jumlah").eq("id", hutangId).single();
  if (e2) throw e2;

  const status = total >= Number(h.jumlah) ? "lunas" : "belum";
  const { error: e3 } = await window.db.from("hutang")
    .update({ jumlah_dibayar: total, status }).eq("id", hutangId);
  if (e3) throw e3;
}

// ---------- Riwayat pembayaran (cicilan) ----------
async function muatRiwayatBayar() {
  const tbody = document.getElementById("tableRiwayatBayar");
  const { data, error } = await window.db
    .from("pembayaran_hutang")
    .select("id, hutang_id, tanggal, jumlah, keterangan, petugas, hutang:hutang_id(nama_peminjam)")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(error.message)}<br><span style="font-size:11.5px;">Kemungkinan migrasi 04_cicilan.sql belum dijalankan di Supabase.</span></td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada pembayaran yang dicatat.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${esc(r.hutang?.nama_peminjam || "-")}</td>
      <td>${formatRupiah(r.jumlah)}</td>
      <td>${esc(r.keterangan || "-")}</td>
      <td>${esc(r.petugas || "-")}</td>
      <td><button class="link-btn" data-id="${esc(r.id)}" data-hutang="${esc(r.hutang_id)}">Hapus</button></td>
    </tr>`).join("");

  tbody.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus catatan pembayaran ini? Sisa pinjaman akan otomatis dikoreksi.")) return;
      btn.disabled = true;
      try {
        const row = data.find(r => r.id === btn.dataset.id);
        if (row) {
          await catatAuditHapus("pembayaran_hutang", row,
            `Cicilan ${row.hutang?.nama_peminjam || "-"} ${formatRupiah(row.jumlah)}`);
        }
        const { error } = await window.db.from("pembayaran_hutang").delete().eq("id", btn.dataset.id);
        if (error) throw error;
        await sinkronkanPembayaran(btn.dataset.hutang);
      } catch (err) {
        alert("Gagal menghapus: " + (err.message || err));
      }
      await refreshSemua();
    });
  });
}
