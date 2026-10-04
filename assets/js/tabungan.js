// ============================================================
// tabungan.js — Catat setoran/tarikan, saldo per siswa, riwayat
// ============================================================
let daftarSiswaCache = [];

async function initTabunganPage() {
  const profile = window.currentProfile;
  const isAdmin = profile && profile.role === "admin";
  const namaPetugas = (profile && profile.nama) || "Admin";

  document.getElementById("fTanggal").value = hariIni();

  if (isAdmin) {
    const filterEl = document.getElementById("filterKelasSaldo");
    filterEl.style.display = "inline-block";
    filterEl.addEventListener("change", () => renderSaldoPerSiswa());
  }

  await muatDaftarSiswaUntukForm();
  await Promise.all([renderSaldoPerSiswa(), muatRiwayatTabungan()]);

  document.getElementById("formTabungan").addEventListener("submit", (e) => handleSubmitTabungan(e, namaPetugas));
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
        .select("jenis, jumlah").eq("siswa_id", payload.siswa_id).order("created_at").order("id"));
      const saldoSiswa = riwayat.reduce(
        (a, r) => a + (r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah)), 0);
      if (payload.jumlah > saldoSiswa) {
        throw new Error(`penarikan melebihi saldo siswa (saldo saat ini ${formatRupiah(saldoSiswa)}).`);
      }
    }
    const { error } = await window.db.from("tabungan").insert(payload);
    if (error) throw error;
    showMsg("Transaksi tabungan berhasil dicatat.", "success");
    document.getElementById("formTabungan").reset();
    document.getElementById("fTanggal").value = hariIni();
    await Promise.all([renderSaldoPerSiswa(), muatRiwayatTabungan()]);
  } catch (err) {
    showMsg("Gagal menyimpan: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Transaksi";
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
    <tr>
      <td>${esc(s.nama)}</td>
      <td>${esc(s.kelas || "-")}</td>
      <td>${formatRupiah(s.saldo)}</td>
    </tr>`).join("");
}

async function muatRiwayatTabungan() {
  const tbody = document.getElementById("tableRiwayat");
  const { data, error } = await window.db
    .from("tabungan")
    .select("id, tanggal, jenis, jumlah, keterangan, petugas, siswa:siswa_id(nama, kelas)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada transaksi tabungan.</td></tr>`;
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
        ${r.jenis === "tarik" ? `<button class="link-btn" data-action="kwitansi" data-id="${esc(r.id)}">Cetak Kwitansi</button> &nbsp;·&nbsp;` : ""}
        <button class="link-btn" data-action="hapus" data-id="${esc(r.id)}">Hapus</button>
      </td>
    </tr>`).join("");

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
