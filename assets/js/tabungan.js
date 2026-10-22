// ============================================================
// tabungan.js — Catat setoran/tarikan, saldo per siswa, riwayat
// ============================================================
let daftarSiswaCache = [];
let editingTabunganId = null;
let siswaTerpilihId = null; // siswa yang diketuk di tabel Saldo per Siswa (null = tampilan biasa)
let namaPetugasTabungan = "Admin";

async function initTabunganPage() {
  const profile = window.currentProfile;
  const isAdmin = profile && profile.role === "admin";
  namaPetugasTabungan = (profile && profile.nama) || "Admin";

  document.getElementById("fTanggal").value = hariIni();

  if (isAdmin) {
    const filterEl = document.getElementById("filterKelasSaldo");
    filterEl.style.display = "inline-block";
    filterEl.addEventListener("change", () => renderSaldoPerSiswa());
  }

  await muatDaftarSiswaUntukForm();
  await Promise.all([renderSaldoPerSiswa(), muatRiwayatTabungan()]);

  document.getElementById("formTabungan").addEventListener("submit", (e) => handleSubmitTabungan(e, namaPetugasTabungan));
  document.getElementById("btnBatalEditTabungan").addEventListener("click", resetFormTabungan);
  document.getElementById("btnSemuaRiwayat").addEventListener("click", () => pilihSiswaRiwayat(null));
}

function resetFormTabungan() {
  editingTabunganId = null;
  document.getElementById("formTabungan").reset();
  document.getElementById("fTanggal").value = hariIni();
  document.getElementById("formTabunganTitle").textContent = "Catat Tabungan";
  document.getElementById("btnSimpanTabungan").textContent = "Simpan Transaksi";
  document.getElementById("btnBatalEditTabungan").style.display = "none";
}

async function muatDaftarSiswaUntukForm() {
  const sel = document.getElementById("fSiswa");
  const { data, error } = await window.db
    .from("siswa").select("id, nama, kelas").eq("aktif", true).order("kelas").order("nama");

  if (error || !data || data.length === 0) {
    sel.innerHTML = `<option value="" disabled selected>Belum ada siswa aktif</option>`;
    daftarSiswaCache = [];
    return;
  }
  daftarSiswaCache = data;
  sel.innerHTML = `<option value="" disabled selected>Pilih siswa</option>` +
    data.map(s => `<option value="${s.id}">${esc(s.nama)} — ${esc(s.kelas || "-")}</option>`).join("");
}

async function handleSubmitTabungan(e, namaPetugas) {
  e.preventDefault();
  const msgBox = document.getElementById("formMsg");
  const btn = document.getElementById("btnSimpanTabungan");
  const showMsg = (text, type) => {
    msgBox.textContent = text;
    msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
    msgBox.style.display = text ? "block" : "none";
  };
  showMsg("", null);

  const payload = {
    siswa_id: document.getElementById("fSiswa").value,
    jenis: document.getElementById("fJenis").value,
    tanggal: document.getElementById("fTanggal").value,
    jumlah: Number(document.getElementById("fJumlah").value),
    keterangan: document.getElementById("fKeterangan").value.trim() || null,
    petugas: namaPetugas
  };

  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  try {
    if (payload.jenis === "tarik") {
      const riwayat = await fetchAll(() => window.db.from("tabungan")
        .select("id, jenis, jumlah").eq("siswa_id", payload.siswa_id).order("created_at").order("id"));
      const saldoSiswa = riwayat
        .filter(r => r.id !== editingTabunganId) // saat mengubah, abaikan efek baris lama ini sendiri
        .reduce((a, r) => a + (r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah)), 0);
      if (payload.jumlah > saldoSiswa) {
        throw new Error(`penarikan melebihi saldo siswa (saldo saat ini ${formatRupiah(saldoSiswa)}).`);
      }
    }

    if (editingTabunganId) {
      const { data: lama } = await window.db.from("tabungan").select("*").eq("id", editingTabunganId).single();
      const { error } = await window.db.from("tabungan").update(payload).eq("id", editingTabunganId);
      if (error) throw error;
      if (lama) {
        await catatAudit("ubah", "tabungan", lama,
          `${lama.jenis === "tarik" ? "Tarik" : "Setor"} ${formatRupiah(lama.jumlah)} → ${payload.jenis === "tarik" ? "Tarik" : "Setor"} ${formatRupiah(payload.jumlah)}`);
      }
      showMsg("Transaksi berhasil diperbarui.", "success");
    } else {
      const { error } = await window.db.from("tabungan").insert(payload);
      if (error) throw error;
      showMsg("Transaksi tabungan berhasil dicatat.", "success");
    }

    resetFormTabungan();
    await Promise.all([renderSaldoPerSiswa(), muatRiwayatTabungan()]);
  } catch (err) {
    showMsg("Gagal menyimpan: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = editingTabunganId ? "Update Transaksi" : "Simpan Transaksi";
  }
}

async function renderSaldoPerSiswa() {
  const tbody = document.getElementById("tableSaldo");
  const filterEl = document.getElementById("filterKelasSaldo");
  const filterVal = filterEl ? filterEl.value : "";

  let tabunganRows;
  try {
    tabunganRows = await fetchAll(() => window.db.from("tabungan")
      .select("siswa_id, jenis, jumlah").order("created_at").order("id"));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(err.message)}</td></tr>`;
    return;
  }
  let siswaList = daftarSiswaCache.length ? daftarSiswaCache
    : (await window.db.from("siswa").select("id, nama, kelas").eq("aktif", true)).data || [];

  if (filterVal) siswaList = siswaList.filter(s => s.kelas === filterVal);

  const saldoMap = {};
  (tabunganRows || []).forEach(r => {
    const delta = r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah);
    saldoMap[r.siswa_id] = (saldoMap[r.siswa_id] || 0) + delta;
  });

  if (siswaList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada siswa aktif.</td></tr>`;
    return;
  }

  const rows = siswaList
    .map(s => ({ ...s, saldo: saldoMap[s.id] || 0 }))
    .sort((a, b) => (a.kelas || "").localeCompare(b.kelas || "") || a.nama.localeCompare(b.nama));

  tbody.innerHTML = rows.map(s => `
    <tr class="row-klik ${s.id === siswaTerpilihId ? "row-terpilih" : ""}" data-siswa-id="${esc(s.id)}">
      <td>${esc(s.nama)}</td>
      <td>${esc(s.kelas || "-")}</td>
      <td>${formatRupiah(s.saldo)}</td>
    </tr>`).join("");

  tbody.querySelectorAll("tr[data-siswa-id]").forEach(tr => {
    tr.addEventListener("click", () => {
      const id = tr.dataset.siswaId;
      pilihSiswaRiwayat(id === siswaTerpilihId ? null : id); // ketuk lagi = batal pilih
    });
  });
}

// Pilih siswa dari tabel Saldo (atau null untuk kembali ke tampilan biasa), lalu muat ulang riwayat.
async function pilihSiswaRiwayat(id) {
  siswaTerpilihId = id;
  await Promise.all([renderSaldoPerSiswa(), muatRiwayatTabungan()]);
  if (id) {
    // Kalau panel riwayat masih jauh di bawah layar, gulirkan ke sana
    const panel = document.getElementById("panelRiwayat");
    if (panel && panel.getBoundingClientRect().top > window.innerHeight * 0.6) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

async function muatRiwayatTabungan() {
  const tbody = document.getElementById("tableRiwayat");
  const kolom = "id, siswa_id, tanggal, jenis, jumlah, keterangan, petugas, siswa:siswa_id(nama, kelas)";
  let data, error = null;
  try {
    if (siswaTerpilihId) {
      // Siswa dipilih: tampilkan SEMUA riwayatnya (bukan hanya 50 terakhir)
      data = await fetchAll(() => window.db.from("tabungan").select(kolom)
        .eq("siswa_id", siswaTerpilihId)
        .order("tanggal", { ascending: false }).order("created_at", { ascending: false }).order("id"));
    } else {
      const res = await window.db.from("tabungan").select(kolom)
        .order("created_at", { ascending: false }).limit(50);
      data = res.data; error = res.error;
    }
  } catch (e) { error = e; }

  perbaruiKepalaRiwayat(data || []);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(error.message || error)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a1bd; padding:20px;">${siswaTerpilihId ? "Siswa ini belum punya transaksi." : "Belum ada transaksi tabungan."}</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${esc(r.siswa?.nama || "-")}</td>
      <td>${esc(r.siswa?.kelas || "-")}</td>
      <td><span class="badge-status ${r.jenis === "tarik" ? "badge-tarik" : "badge-setor"}">${r.jenis === "tarik" ? "Tarik" : "Setor"}</span></td>
      <td>${formatRupiah(r.jumlah)}</td>
      <td>${esc(r.keterangan || "-")}</td>
      <td>${esc(r.petugas || "-")}</td>
      <td style="white-space:nowrap;">
        <button class="link-btn" data-action="ubah" data-id="${esc(r.id)}">Ubah</button> &nbsp;·&nbsp;
        ${r.jenis === "tarik" ? `<button class="link-btn" data-action="kwitansi" data-id="${esc(r.id)}">Cetak Kwitansi</button> &nbsp;·&nbsp;` : ""}
        <button class="link-btn" data-action="hapus" data-id="${esc(r.id)}">Hapus</button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll('button[data-action="ubah"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const row = data.find(r => r.id === btn.dataset.id);
      if (!row) return;
      editingTabunganId = row.id;
      document.getElementById("fSiswa").value = row.siswa_id || "";
      document.getElementById("fJenis").value = row.jenis;
      document.getElementById("fTanggal").value = row.tanggal;
      document.getElementById("fJumlah").value = row.jumlah;
      document.getElementById("fKeterangan").value = row.keterangan || "";
      document.getElementById("formTabunganTitle").textContent = "Ubah Transaksi";
      document.getElementById("btnSimpanTabungan").textContent = "Update Transaksi";
      document.getElementById("btnBatalEditTabungan").style.display = "inline-block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  tbody.querySelectorAll('button[data-action="hapus"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus transaksi ini? Saldo siswa akan otomatis berubah.")) return;
      btn.disabled = true;
      const row = data.find(r => r.id === btn.dataset.id);
      if (row) {
        await catatAuditHapus("tabungan", row,
          `${row.jenis === "tarik" ? "Tarik" : "Setor"} ${formatRupiah(row.jumlah)} — ${row.siswa?.nama || "-"}`);
      }
      const { error } = await window.db.from("tabungan").delete().eq("id", btn.dataset.id);
      if (error) alert("Gagal menghapus: " + error.message);
      await Promise.all([renderSaldoPerSiswa(), muatRiwayatTabungan()]);
    });
  });

  tbody.querySelectorAll('button[data-action="kwitansi"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const row = data.find(r => r.id === btn.dataset.id);
      if (!row) return;
      sessionStorage.setItem("kwitansiData", JSON.stringify({
        jenis: "tarik",
        nama: row.siswa?.nama || "-",
        kelas: row.siswa?.kelas || "-",
        jumlah: row.jumlah,
        tanggal: row.tanggal,
        keterangan: row.keterangan || "Penarikan tabungan",
        petugas: row.petugas || ""
      }));
      window.open("kwitansi.html", "_blank");
    });
  });
}

// Judul + ringkasan di atas tabel riwayat: berubah saat satu siswa dipilih.
function perbaruiKepalaRiwayat(data) {
  const judul = document.getElementById("judulRiwayat");
  const ringkas = document.getElementById("ringkasRiwayat");
  const tombol = document.getElementById("btnSemuaRiwayat");

  if (!siswaTerpilihId) {
    judul.textContent = "Riwayat Transaksi Tabungan";
    ringkas.style.display = "none";
    tombol.style.display = "none";
    return;
  }
  const siswa = daftarSiswaCache.find(x => x.id === siswaTerpilihId);
  const saldo = data.reduce((a, r) => a + (r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah)), 0);
  judul.textContent = "Riwayat: " + (siswa ? siswa.nama : "Siswa terpilih");
  ringkas.innerHTML = `${siswa ? esc(siswa.kelas || "-") + " · " : ""}<b>${data.length}</b> transaksi · saldo <b>${formatRupiah(saldo)}</b>`;
  ringkas.style.display = "block";
  tombol.style.display = "inline-block";
}
