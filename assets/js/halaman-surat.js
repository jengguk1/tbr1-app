// Dipindahkan dari <script> tertanam di surat-pinjaman.html (syarat CSP ketat: tidak ada kode tertanam di halaman).
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
    const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
      "sepuluh", "sebelas"];
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

  function formatRp(n) {
    return Number(n || 0).toLocaleString("id-ID");
  }

  function tanggalPanjang(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }

  const raw = sessionStorage.getItem("suratPinjamanData");
  if (!raw) {
    document.getElementById("kertas").innerHTML =
      '<p style="text-align:center; font-family:sans-serif; padding:60px 0;">' +
      'Data pinjaman tidak ditemukan. Buka surat ini lewat tombol "Cetak Surat" ' +
      'pada halaman Buku Catatan.</p>';
  } else {
    const d = JSON.parse(raw);
    document.getElementById("outNama").textContent = d.nama;
    document.getElementById("outNama2").textContent = d.nama;
    document.getElementById("outJumlah").textContent = formatRp(d.jumlah);
    document.getElementById("outTerbilang").textContent = terbilang(d.jumlah);
    document.getElementById("outTanggal").textContent = tanggalPanjang(d.tanggal);
    document.getElementById("outKeterangan").textContent = d.keterangan || "-";
    document.getElementById("outTanggalSurat").textContent = tanggalPanjang(d.tanggal);
    document.getElementById("outPetugas").textContent = d.petugas || "-";
  }
