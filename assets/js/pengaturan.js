// ============================================================
// pengaturan.js — Profil Saya (semua akun) + Manajemen Akun (khusus admin)
// ============================================================
async function initPengaturanPage() {
  const profile = window.currentProfile;
  const isAdmin = profile && profile.role === "admin";

  // ---------- Toggle lihat/sembunyikan password (berlaku di semua form) ----------
  document.querySelectorAll(".pass-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "👁" : "🙈";
    });
  });

  // ---------- Profil Saya (tampil untuk semua akun) ----------
  document.getElementById("pNama").textContent = (profile && profile.nama) || "-";
  document.getElementById("pEmail").textContent = (profile && profile.email) || "-";
  document.getElementById("pKelas").textContent = (profile && profile.kelas) || "-";
  document.getElementById("pRole").textContent = profile ? (profile.role === "admin" ? "Admin" : "Guru Kelas") : "-";

  document.getElementById("formProfilePass").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgBox = document.getElementById("profileMsg");
    const btn = document.getElementById("btnUbahPassSendiri");
    const showMsg = (text, type) => {
      msgBox.textContent = text;
      msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
      msgBox.style.display = text ? "block" : "none";
    };
    showMsg("", null);

    const p1 = document.getElementById("pPass1").value;
    const p2 = document.getElementById("pPass2").value;
    if (p1 !== p2) { showMsg("Password baru dan ulangi password tidak sama.", "error"); return; }
    if (p1.length < 6) { showMsg("Password minimal 6 karakter.", "error"); return; }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    try {
      const { error } = await window.db.auth.updateUser({ password: p1 });
      if (error) throw error;
      showMsg("Password berhasil diubah.", "success");
      document.getElementById("formProfilePass").reset();
    } catch (err) {
      showMsg("Gagal mengubah password: " + (err.message || err), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Ubah Password";
    }
  });

  // ---------- Cadangan Data (semua akun) ----------
  document.getElementById("btnBackup").addEventListener("click", unduhCadanganData);

  // ---------- Manajemen Akun (khusus admin) ----------
  document.getElementById("bukanAdminBox").style.display = isAdmin ? "none" : "block";
  document.getElementById("adminBox").style.display = isAdmin ? "block" : "none";
  if (!isAdmin) return;

  await Promise.all([muatDaftarAkun(), muatLogAudit(), initInfoSekolah()]);

  const form = document.getElementById("formAkun");
  const msgBox = document.getElementById("formMsg");
  const btnSimpan = document.getElementById("btnSimpanAkun");
  const showMsg = (text, type) => {
    msgBox.textContent = text;
    msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
    msgBox.style.display = text ? "block" : "none";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("", null);

    const nama = document.getElementById("fNama").value.trim();
    const email = document.getElementById("fEmail").value.trim();
    const kelas = document.getElementById("fKelas").value;
    const pass = document.getElementById("fPass").value;
    const pass2 = document.getElementById("fPass2").value;

    if (pass !== pass2) {
      showMsg("Password dan ulangi password tidak sama.", "error");
      return;
    }
    if (pass.length < 6) {
      showMsg("Password minimal 6 karakter.", "error");
      return;
    }

    btnSimpan.disabled = true;
    btnSimpan.textContent = "Menyimpan...";

    try {
      // Client terpisah supaya proses signUp TIDAK menimpa sesi admin yang sedang login.
      const tempClient = supabase.createClient(
        window.SUPABASE_URL_FOR_TEMP,
        window.SUPABASE_ANON_KEY_FOR_TEMP,
        { auth: { storageKey: "sb-temp-create-user", persistSession: false, autoRefreshToken: false } }
      );

      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({ email, password: pass });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Akun tidak terbentuk. Coba lagi.");

      const { error: profileError } = await window.db.from("profiles").insert({
        id: signUpData.user.id,
        nama, email, kelas, role: "guru", aktif: true
      });
      if (profileError) throw profileError;

      showMsg(`Akun "${nama}" berhasil dibuat. Jika konfirmasi email masih aktif di Supabase, minta guru tersebut mengecek email untuk verifikasi sebelum login pertama kali.`, "success");
      form.reset();
      await muatDaftarAkun();
    } catch (err) {
      showMsg("Gagal membuat akun: " + (err.message || err), "error");
    } finally {
      btnSimpan.disabled = false;
      btnSimpan.textContent = "Simpan Akun";
    }
  });
}

async function muatDaftarAkun() {
  const tbody = document.getElementById("tableAkun");
  const { data, error } = await window.db
    .from("profiles")
    .select("id, nama, email, kelas, role, aktif")
    .order("role", { ascending: false })
    .order("kelas", { ascending: true });

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada akun lain.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${esc(p.nama)}</td>
      <td>${esc(p.kelas || "-")}</td>
      <td>${p.role === "admin" ? "Admin" : "Guru Kelas"}</td>
      <td><span class="badge-status ${p.aktif ? "badge-lunas" : "badge-belum"}">${p.aktif ? "Aktif" : "Nonaktif"}</span></td>
      <td style="white-space:nowrap;">
        ${p.role === "admin" ? "" : `
          <button class="link-btn" data-action="toggle" data-id="${p.id}" data-aktif="${p.aktif}">${p.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
          &nbsp;·&nbsp;
          <button class="link-btn" data-action="reset" data-email="${esc(p.email)}" data-nama="${esc(p.nama)}">Reset Password</button>
        `}
      </td>
    </tr>`).join("");

  tbody.querySelectorAll('button[data-action="toggle"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const aktifBaru = btn.dataset.aktif !== "true";
      btn.disabled = true;
      const { error } = await window.db.from("profiles").update({ aktif: aktifBaru }).eq("id", btn.dataset.id);
      if (error) alert("Gagal mengubah status: " + error.message);
      await muatDaftarAkun();
    });
  });

  tbody.querySelectorAll('button[data-action="reset"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Kirim link reset password ke email ${btn.dataset.nama} (${btn.dataset.email})?`)) return;
      btn.disabled = true;
      btn.textContent = "Mengirim...";
      try {
        const { error } = await window.db.auth.resetPasswordForEmail(btn.dataset.email, {
          redirectTo: `${window.location.origin}/reset-password.html`
        });
        if (error) throw error;
        alert("Link reset password sudah dikirim ke " + btn.dataset.email + ". Minta guru tersebut membuka email dan mengikuti link-nya.");
      } catch (err) {
        alert("Gagal mengirim link reset: " + (err.message || err));
      } finally {
        btn.disabled = false;
        btn.textContent = "Reset Password";
      }
    });
  });
}

// ---------- Info Sekolah (khusus admin) ----------
async function initInfoSekolah() {
  const info = await infoSekolah();
  document.getElementById("fNamaSekolah").value = info.nama_sekolah || "";
  document.getElementById("fKepsek").value = info.kepala_sekolah || "";
  document.getElementById("fKecamatan").value = info.kecamatan || "";
  document.getElementById("fKabupaten").value = info.kabupaten || "";
  document.getElementById("fProvinsi").value = info.provinsi || "";
  document.getElementById("fTahunAjaran").value = info.tahun_pelajaran || "";
  document.getElementById("fTagline").value = info.tagline || "";
  document.getElementById("fMotto").value = info.motto || "";

  document.getElementById("formSekolah").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgBox = document.getElementById("sekolahMsg");
    const btn = document.getElementById("btnSimpanSekolah");
    const showMsg = (text, type) => {
      msgBox.textContent = text;
      msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
      msgBox.style.display = text ? "block" : "none";
    };
    showMsg("", null);
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    try {
      const { error } = await window.db.from("pengaturan").update({
        nama_sekolah: document.getElementById("fNamaSekolah").value.trim(),
        kepala_sekolah: document.getElementById("fKepsek").value.trim(),
        kecamatan: document.getElementById("fKecamatan").value.trim(),
        kabupaten: document.getElementById("fKabupaten").value.trim(),
        provinsi: document.getElementById("fProvinsi").value.trim(),
        tahun_pelajaran: document.getElementById("fTahunAjaran").value.trim(),
        tagline: document.getElementById("fTagline").value.trim(),
        motto: document.getElementById("fMotto").value.trim()
      }).eq("id", 1);
      if (error) throw error;
      showMsg("Info sekolah berhasil disimpan.", "success");
      const brandEl = document.getElementById("brandNamaSekolah");
      if (brandEl) brandEl.textContent = document.getElementById("fNamaSekolah").value.trim();
    } catch (err) {
      showMsg("Gagal menyimpan: " + (err.message || err), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Info Sekolah";
    }
  });
}

// ---------- Cadangan Data: gabungkan beberapa tabel jadi satu file CSV ----------
function csvSelPengaturan(v) {
  const s = String(v === null || v === undefined ? "" : v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function unduhCadanganData() {
  const msgBox = document.getElementById("backupMsg");
  const btn = document.getElementById("btnBackup");
  const showMsg = (text, type) => {
    msgBox.textContent = text;
    msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
    msgBox.style.display = text ? "block" : "none";
  };
  showMsg("", null);
  btn.disabled = true;
  btn.textContent = "Menyiapkan...";

  try {
    const [siswa, tabungan, hutang, cicilan] = await Promise.all([
      fetchAll(() => window.db.from("siswa").select("nama, nisn, kelas, jenis_kelamin, alamat, aktif").order("kelas").order("nama")),
      fetchAll(() => window.db.from("tabungan").select("tanggal, jenis, jumlah, keterangan, petugas, siswa:siswa_id(nama, kelas)").order("tanggal")),
      fetchAll(() => window.db.from("hutang").select("tanggal, nama_peminjam, jumlah, jumlah_dibayar, status, keterangan, petugas").order("tanggal")).catch(() => []),
      fetchAll(() => window.db.from("pembayaran_hutang").select("tanggal, jumlah, keterangan, petugas, hutang:hutang_id(nama_peminjam)").order("tanggal")).catch(() => [])
    ]);

    const bagian = [];
    const tambah = (judul, header, baris) => {
      bagian.push([judul]);
      bagian.push(header);
      baris.forEach(b => bagian.push(b));
      bagian.push([]);
    };

    tambah("DATA SISWA", ["Nama", "NISN", "Kelas", "L/P", "Alamat", "Status"],
      siswa.map(s => [s.nama, s.nisn || "", s.kelas || "", s.jenis_kelamin || "", s.alamat || "", s.aktif ? "Aktif" : "Nonaktif"]));

    tambah("TABUNGAN", ["Tanggal", "Nama", "Kelas", "Jenis", "Jumlah", "Keterangan", "Petugas"],
      tabungan.map(t => [t.tanggal, t.siswa?.nama || "", t.siswa?.kelas || "", t.jenis === "tarik" ? "Tarik" : "Setor", t.jumlah, t.keterangan || "", t.petugas || ""]));

    tambah("BUKU CATATAN (PINJAMAN)", ["Tanggal", "Nama", "Jumlah", "Dibayar", "Status", "Keterangan", "Petugas"],
      hutang.map(h => [h.tanggal, h.nama_peminjam || "", h.jumlah, h.jumlah_dibayar || 0, h.status === "lunas" ? "Lunas" : "Belum", h.keterangan || "", h.petugas || ""]));

    tambah("RIWAYAT CICILAN", ["Tanggal", "Nama", "Jumlah", "Keterangan", "Petugas"],
      cicilan.map(c => [c.tanggal, c.hutang?.nama_peminjam || "", c.jumlah, c.keterangan || "", c.petugas || ""]));

    const isi = bagian.map(baris => baris.map(csvSelPengaturan).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + isi], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cadangan-tabungan-${hariIni()}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);

    showMsg("Berhasil diunduh. Simpan file ini di tempat aman (HP/laptop/Google Drive).", "success");
  } catch (err) {
    showMsg("Gagal membuat cadangan: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "⬇️ Unduh Semua Data (CSV)";
  }
}

// ---------- Log Aktivitas (penghapusan) — khusus admin ----------
async function muatLogAudit() {
  const tbody = document.getElementById("tableAudit");
  const { data, error } = await window.db
    .from("audit_log")
    .select("waktu, aksi, tabel, ringkasan, oleh_nama")
    .order("waktu", { ascending: false })
    .limit(100);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--red); padding:20px;">Belum aktif: ${esc(error.message)}<br><span style="font-size:11.5px;">Jalankan migrasi 05_audit_log.sql di Supabase.</span></td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada aktivitas yang tercatat.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td style="white-space:nowrap;">${new Date(r.waktu).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
      <td><span class="badge-status ${r.aksi === "hapus" ? "badge-belum" : "badge-setor"}">${esc(r.aksi === "hapus" ? "Hapus" : "Ubah")}</span></td>
      <td>${esc(r.tabel)}</td>
      <td>${esc(r.ringkasan || "-")}</td>
      <td>${esc(r.oleh_nama || "-")}</td>
    </tr>`).join("");
}
