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

  // ---------- Manajemen Akun (khusus admin) ----------
  document.getElementById("bukanAdminBox").style.display = isAdmin ? "none" : "block";
  document.getElementById("adminBox").style.display = isAdmin ? "block" : "none";
  if (!isAdmin) return;

  await muatDaftarAkun();

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
