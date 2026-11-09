// Dipindahkan dari <script> tertanam di reset-password.html (syarat CSP ketat: tidak ada kode tertanam di halaman).
    document.querySelectorAll(".pass-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.textContent = showing ? "👁" : "🙈";
      });
    });

    const msgBox = document.getElementById("resetMsg");
    function showMsg(text, type) {
      msgBox.textContent = text;
      msgBox.className = "form-msg" + (type ? " form-msg-" + type : "");
      msgBox.style.display = text ? "block" : "none";
    }

    // Link dari email membawa token khusus di URL — Supabase otomatis membacanya
    // saat client dibuat. Kalau tidak ada sesi pemulihan yang valid, beri tahu penggunanya.
    window.db.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        showMsg("Link ini sudah tidak berlaku atau tidak valid. Minta admin mengirim ulang link reset password.", "error");
        document.getElementById("formReset").querySelectorAll("input, button").forEach(el => el.disabled = true);
      }
    });

    document.getElementById("formReset").addEventListener("submit", async (e) => {
      e.preventDefault();
      showMsg("", null);
      const p1 = document.getElementById("rPass1").value;
      const p2 = document.getElementById("rPass2").value;
      if (p1 !== p2) { showMsg("Password baru dan ulangi password tidak sama.", "error"); return; }
      if (p1.length < 8) { showMsg("Password minimal 8 karakter.", "error"); return; }

      const btn = document.getElementById("btnSimpanReset");
      btn.disabled = true;
      btn.textContent = "Menyimpan...";
      try {
        const { error } = await window.db.auth.updateUser({ password: p1 });
        if (error) throw error;
        showMsg("Password berhasil diganti. Mengarahkan ke halaman masuk...", "success");
        await window.db.auth.signOut();
        setTimeout(() => { window.location.href = "index.html"; }, 1800);
      } catch (err) {
        showMsg("Gagal menyimpan password: " + (err.message || err), "error");
        btn.disabled = false;
        btn.textContent = "Simpan Password Baru";
      }
    });
  
