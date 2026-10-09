// ============================================================
// siswa.js — Data Siswa (tambah/ubah/aktifkan, dibatasi per kelas oleh RLS)
// ============================================================
let editingSiswaId = null;

async function initSiswaPage() {
  const profile = window.currentProfile;
  const isAdmin = profile && profile.role === "admin";

  const kelasSelect = document.getElementById("fKelasSiswa");
  const filterKelas = document.getElementById("filterKelas");

  if (isAdmin) {
    // Admin boleh pilih kelas manapun saat menambah siswa, dan boleh memfilter daftar per kelas.
    filterKelas.style.display = "inline-block";
    filterKelas.addEventListener("change", () => muatDaftarSiswa(isAdmin));
  } else if (profile && profile.kelas) {
    // Guru: kelas otomatis terkunci ke kelasnya sendiri.
    kelasSelect.value = profile.kelas;
    kelasSelect.disabled = true;
  }
  document.getElementById("cariSiswa").addEventListener("input", () => muatDaftarSiswa(isAdmin));

  document.getElementById("formSiswa").addEventListener("submit", (e) => handleSubmitSiswa(e, isAdmin, profile));
  document.getElementById("btnBatalEdit").addEventListener("click", () => resetFormSiswa(isAdmin, profile));

  await muatDaftarSiswa(isAdmin);
  initKenaikanKelas(isAdmin, profile);
}

// ---------- Kenaikan Kelas ----------
const URUTAN_KELAS = ["Kelas I", "Kelas II", "Kelas III", "Kelas IV", "Kelas V", "Kelas VI"];

function initKenaikanKelas(isAdmin, profile) {
  const selAsal = document.getElementById("fKelasAsal");
  const pilihan = isAdmin ? URUTAN_KELAS : URUTAN_KELAS.filter(k => k === profile?.kelas);

  selAsal.innerHTML = `<option value="" disabled selected>Pilih kelas</option>` +
    pilihan.map(k => `<option>${esc(k)}</option>`).join("");

  selAsal.addEventListener("change", () => {
    const idx = URUTAN_KELAS.indexOf(selAsal.value);
    const tujuan = idx === -1 ? "" : (idx === URUTAN_KELAS.length - 1 ? "Lulus" : URUTAN_KELAS[idx + 1]);
    document.getElementById("fKelasTujuan").value = tujuan;
    document.getElementById("btnNaikKelas").textContent = tujuan === "Lulus" ? "Luluskan Siswa" : "Proses Kenaikan Kelas";
  });

  document.getElementById("btnNaikKelas").addEventListener("click", () => prosesKenaikanKelas(profile));
}

async function prosesKenaikanKelas(profile) {
  const msgBox = document.getElementById("naikMsg");
  const showMsg = (text, type) => {
    msgBox.textContent = text;
    msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
    msgBox.style.display = text ? "block" : "none";
  };
  showMsg("", null);
  document.getElementById("hasilKelulusan").style.display = "none";

  const asal = document.getElementById("fKelasAsal").value;
  const tujuan = document.getElementById("fKelasTujuan").value;
  if (!asal || !tujuan) { showMsg("Pilih kelas asal dahulu.", "error"); return; }

  const lulus = tujuan === "Lulus";
  const konfirmasi = lulus
    ? `Luluskan SEMUA siswa aktif di ${asal}? Saldo tabungan masing-masing akan ditarik penuh dan dicatat sebagai bukti penyerahan.`
    : `Naikkan SEMUA siswa aktif di ${asal} ke ${tujuan}?`;
  if (!confirm(konfirmasi)) return;

  const btn = document.getElementById("btnNaikKelas");
  btn.disabled = true;
  btn.textContent = "Memproses...";
  const namaPetugas = (profile && profile.nama) || "Admin";

  try {
    const siswaList = await fetchAll(() => window.db.from("siswa")
      .select("id, nama").eq("kelas", asal).eq("aktif", true).order("nama"));

    if (siswaList.length === 0) {
      showMsg(`Tidak ada siswa aktif di ${asal}.`, "error");
      return;
    }

    if (!lulus) {
      const { error } = await window.db.from("siswa").update({ kelas: tujuan })
        .eq("kelas", asal).eq("aktif", true);
      if (error) throw error;
      showMsg(`${siswaList.length} siswa berhasil dinaikkan dari ${asal} ke ${tujuan}.`, "success");
    } else {
      const hasil = [];
      for (const s of siswaList) {
        const riwayat = await fetchAll(() => window.db.from("tabungan")
          .select("jenis, jumlah").eq("siswa_id", s.id).order("id"));
        const saldo = riwayat.reduce((a, r) => a + (r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah)), 0);

        if (saldo > 0) {
          const { error: eTarik } = await window.db.from("tabungan").insert({
            siswa_id: s.id, tanggal: hariIni(), jenis: "tarik", jumlah: saldo,
            keterangan: "Penyerahan saldo kelulusan", petugas: namaPetugas
          });
          if (eTarik) throw eTarik;
        }
        const { error: eUpdate } = await window.db.from("siswa")
          .update({ kelas: "Lulus", aktif: false }).eq("id", s.id);
        if (eUpdate) throw eUpdate;

        hasil.push({ nama: s.nama, saldo });
      }

      showMsg(`${hasil.length} siswa di ${asal} telah diluluskan. Cetak kwitansi penyerahan di bawah ini untuk arsip.`, "success");
      const tbodyL = document.getElementById("tableKelulusan");
      tbodyL.innerHTML = hasil.map((h, i) => `
        <tr>
          <td>${esc(h.nama)}</td>
          <td>${formatRupiah(h.saldo)}</td>
          <td><button class="link-btn" data-i="${i}">Cetak Kwitansi</button></td>
        </tr>`).join("");
      tbodyL.querySelectorAll("button[data-i]").forEach(b => {
        b.addEventListener("click", () => {
          const h = hasil[Number(b.dataset.i)];
          sessionStorage.setItem("kwitansiData", JSON.stringify({
            jenis: "lulus", nama: h.nama, kelas: asal, jumlah: h.saldo, tanggal: hariIni(),
            keterangan: "Penyerahan saldo tabungan karena kelulusan", petugas: namaPetugas
          }));
          window.open("kwitansi.html", "_blank");
        });
      });
      document.getElementById("hasilKelulusan").style.display = "block";
    }

    document.getElementById("fKelasAsal").value = "";
    document.getElementById("fKelasTujuan").value = "";
    await muatDaftarSiswa(document.getElementById("filterKelas").style.display !== "none");
  } catch (err) {
    showMsg("Gagal memproses: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Proses Kenaikan Kelas";
  }
}

async function handleSubmitSiswa(e, isAdmin, profile) {
  e.preventDefault();
  const msgBox = document.getElementById("formMsg");
  const btn = document.getElementById("btnSimpanSiswa");
  const showMsg = (text, type) => {
    msgBox.textContent = text;
    msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
    msgBox.style.display = text ? "block" : "none";
  };
  showMsg("", null);

  const payload = {
    nama: document.getElementById("fNamaSiswa").value.trim(),
    nisn: document.getElementById("fNisn").value.trim() || null,
    kelas: document.getElementById("fKelasSiswa").value,
    jenis_kelamin: document.getElementById("fJk").value,
    alamat: document.getElementById("fAlamat").value.trim() || null,
    aktif: document.getElementById("fAktifSiswa").checked
  };

  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  try {
    let error;
    if (editingSiswaId) {
      ({ error } = await window.db.from("siswa").update(payload).eq("id", editingSiswaId));
    } else {
      ({ error } = await window.db.from("siswa").insert(payload));
    }
    if (error) throw error;

    showMsg(editingSiswaId ? "Data siswa berhasil diperbarui." : "Siswa baru berhasil ditambahkan.", "success");
    resetFormSiswa(isAdmin, profile);
    await muatDaftarSiswa(isAdmin);
  } catch (err) {
    showMsg("Gagal menyimpan: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Siswa";
  }
}

function resetFormSiswa(isAdmin, profile) {
  editingSiswaId = null;
  document.getElementById("formSiswa").reset();
  document.getElementById("formSiswaTitle").textContent = "Tambah Siswa";
  document.getElementById("btnSimpanSiswa").textContent = "Simpan Siswa";
  document.getElementById("btnBatalEdit").style.display = "none";
  document.getElementById("fAktifSiswa").checked = true;
  if (!isAdmin && profile && profile.kelas) {
    document.getElementById("fKelasSiswa").value = profile.kelas;
  }
}

async function muatDaftarSiswa(isAdmin) {
  const tbody = document.getElementById("tableSiswa");
  let query = window.db.from("siswa").select("id, nama, kelas, jenis_kelamin, aktif, nisn, alamat").order("kelas").order("nama");

  const filterVal = document.getElementById("filterKelas").value;
  if (isAdmin && filterVal) query = query.eq("kelas", filterVal);

  const { data: dataAsli, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--red); padding:20px;">Gagal memuat data: ${esc(error.message)}</td></tr>`;
    return;
  }
  const cari = document.getElementById("cariSiswa").value.trim().toLowerCase();
  const data = cari ? (dataAsli || []).filter(s => s.nama.toLowerCase().includes(cari)) : (dataAsli || []);

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a1bd; padding:20px;">${cari ? "Tidak ada siswa dengan nama itu." : "Belum ada data siswa."}</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${esc(s.nama)}</td>
      <td>${esc(s.kelas || "-")}</td>
      <td>${s.jenis_kelamin || "-"}</td>
      <td><span class="badge-status ${s.aktif ? "badge-lunas" : "badge-belum"}">${s.aktif ? "Aktif" : "Nonaktif"}</span></td>
      <td style="white-space:nowrap;">
        <button class="link-btn" data-action="edit" data-id="${esc(s.id)}">Ubah</button>
        &nbsp;·&nbsp;
        <button class="link-btn" data-action="toggle" data-id="${esc(s.id)}" data-aktif="${s.aktif}">${s.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
        ${!s.aktif ? `&nbsp;·&nbsp;<button class="link-btn" data-action="hapus" data-id="${esc(s.id)}" style="color:var(--red);">Hapus</button>` : ""}
      </td>
    </tr>`).join("");

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const row = data.find(s => s.id === btn.dataset.id);
      if (!row) return;
      editingSiswaId = row.id;
      document.getElementById("fNamaSiswa").value = row.nama || "";
      document.getElementById("fNisn").value = row.nisn || "";
      document.getElementById("fKelasSiswa").value = row.kelas || "";
      document.getElementById("fJk").value = row.jenis_kelamin || "";
      document.getElementById("fAlamat").value = row.alamat || "";
      document.getElementById("fAktifSiswa").checked = !!row.aktif;
      document.getElementById("formSiswaTitle").textContent = "Ubah Data Siswa";
      document.getElementById("btnSimpanSiswa").textContent = "Update Siswa";
      document.getElementById("btnBatalEdit").style.display = "inline-block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  tbody.querySelectorAll('button[data-action="toggle"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const aktifBaru = btn.dataset.aktif !== "true";
      const { error } = await window.db.from("siswa").update({ aktif: aktifBaru }).eq("id", btn.dataset.id);
      if (error) alert("Gagal mengubah status: " + error.message);
      await muatDaftarSiswa(document.getElementById("filterKelas").style.display !== "none");
    });
  });

  tbody.querySelectorAll('button[data-action="hapus"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = data.find(s => s.id === btn.dataset.id);
      if (!row) return;
      const yakin = confirm(
        `Hapus "${row.nama}" secara PERMANEN?\n\n` +
        `Ini akan ikut menghapus SELURUH riwayat tabungan siswa ini dan tidak bisa dibatalkan.\n` +
        `Kalau cuma ingin menyembunyikannya dari daftar, pakai "Nonaktifkan" saja (bisa diaktifkan lagi kapan pun).\n\n` +
        `Lanjutkan hapus permanen?`
      );
      if (!yakin) return;

      btn.disabled = true;
      btn.textContent = "Menghapus...";
      await catatAudit("hapus", "siswa", row, `Hapus siswa ${row.nama} (${row.kelas || "-"}) — termasuk seluruh riwayat tabungannya`);
      const { error } = await window.db.from("siswa").delete().eq("id", btn.dataset.id);
      if (error) {
        alert("Gagal menghapus: " + error.message);
        btn.disabled = false;
        btn.textContent = "Hapus";
        return;
      }
      await muatDaftarSiswa(document.getElementById("filterKelas").style.display !== "none");
    });
  });
}
