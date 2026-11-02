// ============================================================
// boot.js — dimuat PALING AWAL di akhir <body>, sebelum library besar (supabase.js).
// Tugasnya satu: kalau setelah 15 detik library itu belum selesai diunduh (sinyal sangat
// lambat), tampilkan pesan "masih memuat" supaya pengguna tahu aplikasi tidak hang.
// Pesan hilang sendiri begitu aplikasi siap (window.db terbentuk).
// ============================================================
(function () {
  var timer = setTimeout(function () {
    if (window.db || document.getElementById("bannerMuat")) return;
    var d = document.createElement("div");
    d.id = "bannerMuat";
    d.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:300;background:#e8f1fe;color:#0b1e42;" +
      "padding:10px 14px;font-size:13px;line-height:1.5;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.2);";
    d.innerHTML = "⏳ Sinyal lambat — aplikasi masih dimuat. Mohon tunggu sebentar, atau " +
      "<a href='' style='color:#1a5fd0;font-weight:600;'>muat ulang</a>.";
    document.body.appendChild(d);
  }, 15000);

  var cek = setInterval(function () {
    if (window.db) {
      clearTimeout(timer);
      clearInterval(cek);
      var b = document.getElementById("bannerMuat");
      if (b) b.remove();
    }
  }, 500);
})();
