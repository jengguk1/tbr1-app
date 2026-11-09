// Dipindahkan dari <script> tertanam di kwitansi.html (syarat CSP ketat: tidak ada kode tertanam di halaman).
// Tombol Tutup / Cetak (dulu memakai atribut onclick di HTML; kini lewat pendengar kejadian
// supaya halaman bisa memakai Content Security Policy yang ketat).
document.getElementById("btnTutup").addEventListener("click", () => window.close());
document.getElementById("btnCetak").addEventListener("click", () => window.print());

  infoSekolah().then(info => {
    document.getElementById("kopNama").textContent = info.nama_sekolah;
    document.getElementById("kopAlamat").textContent = `Kecamatan ${info.kecamatan} — Kabupaten ${info.kabupaten}, ${info.provinsi}`;
    const tempatEl = document.getElementById("outTempatTanggal");
    if (tempatEl) tempatEl.textContent = info.kecamatan;
  });

  function terbilang(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
    function sub(x) {
      if (x < 12) return satuan[x];
      if (x < 20) return sub(x - 10) + " belas";
      if (x < 100) return sub(Math.floor(x / 10)) + " puluh" + (x % 10 ? " " + sub(x % 10) : "");
      if (x < 200) return "seratus" + (x % 100 ? " " + sub(x % 100) : "");
      if (x < 1000) return sub(Math.floor(x / 100)) + " ratus" + (x % 100 ? " " + sub(x % 100) : "");
      if (x < 2000) return "seribu" + (x % 1000 ? " " + sub(x % 1000) : "");
      if (x < 1000000) return sub(Math.floor(x / 1000)) + " ribu" + (x % 1000 ? " " + sub(x % 1000) : "");
      if (x < 1000000000) return sub(Math.floor(x / 1000000)) + " juta" + (x % 1000000 ? " " + sub(x % 1000000) : "");
      return sub(Math.floor(x / 1000000000)) + " miliar" + (x % 1000000000 ? " " + sub(x % 1000000000) : "");
    }
    if (n === 0) return "nol";
    return sub(n).replace(/\s+/g, " ").trim();
  }
  function formatRp(n) { return Number(n || 0).toLocaleString("id-ID"); }
  function tgl(iso, panjang) {
    if (!iso) return "-";
    const d = new Date(iso);
    return panjang
      ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
      : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function set(id, v) { document.getElementById(id).textContent = v; }

  // jenis: "tarik" (penarikan tabungan biasa) atau "lulus" (penyerahan saldo kelulusan)
  const raw = sessionStorage.getItem("kwitansiData");
  if (!raw) {
    document.getElementById("kertas").innerHTML =
      '<p style="text-align:center; font-family:sans-serif; padding:60px 0;">Data kwitansi tidak ditemukan. ' +
      'Buka halaman ini lewat tombol "Cetak Kwitansi" di aplikasi.</p>';
  } else {
    const d = JSON.parse(raw);
    const lulus = d.jenis === "lulus";

    set("outJudul", lulus ? "KWITANSI PENYERAHAN TABUNGAN" : "KWITANSI PENARIKAN TABUNGAN");
    document.getElementById("labelKelas").textContent = "Kelas";
    document.getElementById("labelUntuk").textContent = lulus ? "Keterangan" : "Untuk";
    document.getElementById("labelPenerima").textContent = lulus ? "Yang Menerima (Siswa/Wali)" : "Yang Menerima";
    document.getElementById("labelPemberi").textContent = "Yang Menyerahkan";

    set("outNama", d.nama); set("outNama2", d.nama);
    set("outKelas", d.kelas || "-");
    set("outKeterangan", d.keterangan || (lulus ? "Penyerahan saldo tabungan karena kelulusan" : "Penarikan tabungan"));
    set("outJumlah", formatRp(d.jumlah));
    set("outTerbilang", terbilang(d.jumlah));
    set("outTanggalSingkat", tgl(d.tanggal, false));
    set("outTanggalPanjang", tgl(d.tanggal, true));
    set("outPetugas", d.petugas || "-");
  }
