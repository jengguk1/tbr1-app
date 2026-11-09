// Dipindahkan dari <script> tertanam di index.html (syarat CSP ketat: tidak ada kode tertanam di halaman).
    infoSekolah().then(info => {
      document.getElementById("loginSub").textContent = `Kecamatan ${info.kecamatan} — Kabupaten ${info.kabupaten}`;
    });
  

    // Kalau sudah login, langsung lempar ke dashboard
    window.db.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "dashboard.html";
    });

    const form = document.getElementById("loginForm");
    const errorBox = document.getElementById("loginError");
    const btn = document.getElementById("loginBtn");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.style.display = "none";
      btn.disabled = true;
      btn.textContent = "Memeriksa...";

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const { error } = await window.db.auth.signInWithPassword({ email, password });

      if (error) {
        const gagalJaringan = /fetch|network|timeout|failed/i.test(error.message || "");
        errorBox.textContent = gagalJaringan
          ? "Tidak bisa terhubung ke server. Periksa internet Anda — kalau memakai paket data, coba pindah ke WiFi atau jaringan lain."
          : "Gagal masuk: " + error.message;
        errorBox.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Masuk";
      } else {
        window.location.href = "dashboard.html";
      }
    });

    // ---------- Lupa password ----------
    const lupaBox = document.getElementById("lupaPassBox");
    const lupaMsg = document.getElementById("lupaMsg");
    function showLupaMsg(text, type) {
      lupaMsg.textContent = text;
      lupaMsg.className = "form-msg" + (type ? " form-msg-" + type : "");
      lupaMsg.style.display = text ? "block" : "none";
    }

    document.getElementById("linkLupaPass").addEventListener("click", () => {
      lupaBox.style.display = lupaBox.style.display === "none" ? "block" : "none";
    });

    document.getElementById("btnKirimReset").addEventListener("click", async () => {
      const email = document.getElementById("emailLupa").value.trim();
      showLupaMsg("", null);
      if (!email) { showLupaMsg("Isi email akun Anda dulu.", "error"); return; }

      const kirimBtn = document.getElementById("btnKirimReset");
      kirimBtn.disabled = true;
      kirimBtn.textContent = "Mengirim...";
      try {
        const { error } = await window.db.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("reset-password.html", window.location.href).href
        });
        if (error) throw error;
        showLupaMsg("Kalau email tersebut terdaftar, link reset password sudah dikirim. Silakan cek email Anda.", "success");
      } catch (err) {
        showLupaMsg("Gagal mengirim: " + (err.message || err), "error");
      } finally {
        kirimBtn.disabled = false;
        kirimBtn.textContent = "Kirim Link Reset Password";
      }
    });
  
