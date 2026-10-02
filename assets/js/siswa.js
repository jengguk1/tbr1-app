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

  document.getElementById("formSiswa").addEventListener("submit", (e) => handleSubmitSiswa(e, isAdmin, profile));
  document.getElementById("btnBatalEdit").addEventListener("click", () => resetFormSiswa(isAdmin, profile));

  await muatDaftarSiswa(isAdmin);
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

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada data siswa.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${esc(s.nama)}</td>
      <td>${esc(s.kelas || "-")}</td>
      <td>${s.jenis_kelamin || "-"}</td>
      <td><span class="badge-status ${s.aktif ? "badge-lunas" : "badge-belum"}">${s.aktif ? "Aktif" : "Nonaktif"}</span></td>
      <td style="white-space:nowrap;">
        <button class="link-btn" data-action="edit" data-id="${s.id}">Ubah</button>
        &nbsp;·&nbsp;
        <button class="link-btn" data-action="toggle" data-id="${s.id}" data-aktif="${s.aktif}">${s.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
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
}
