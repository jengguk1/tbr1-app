// ============================================================
// dashboard.js — logika halaman Beranda
// ============================================================
(async function () {
  const session = await initLayout("dashboard", "Beranda");
  if (!session) return;

  const safe = (fn) => fn().catch(err => { console.error("Gagal memuat bagian dashboard:", err); });

  const ringkas = await safe(loadStatCards);
  await Promise.all([
    safe(loadBarChart),
    safe(() => loadDonut(ringkas)),
    safe(loadTransaksiTerbaru),
    safe(loadHutangTerbaru),
    safe(loadJuaraMenabung)
  ]);

  // ---------- Kartu ringkasan ----------
  async function loadStatCards() {
    const [siswaRows, tabunganRows, hutangRows, tCount, hCount, cCount] = await Promise.all([
      fetchAll(() => window.db.from("siswa").select("id, aktif").order("id")),
      fetchAll(() => window.db.from("tabungan").select("jenis, jumlah").order("created_at").order("id")),
      fetchAll(() => window.db.from("hutang").select("jumlah, jumlah_dibayar, status").order("created_at").order("id")),
      window.db.from("tabungan").select("id", { count: "exact", head: true }).gte("tanggal", awalBulanIni()).then(r => r.count),
      window.db.from("hutang").select("id", { count: "exact", head: true }).gte("tanggal", awalBulanIni()).then(r => r.count),
      // Cicilan: bila migrasi 04 belum dijalankan, dianggap 0 (tidak merusak halaman)
      window.db.from("pembayaran_hutang").select("id", { count: "exact", head: true }).gte("tanggal", awalBulanIni()).then(r => r.count || 0)
    ]);

    const totalSiswa = siswaRows.length;
    const siswaAktif = siswaRows.filter(s => s.aktif).length;

    const totalTabungan = tabunganRows.reduce(
      (acc, r) => acc + (r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah)), 0);
    const totalHutang = hutangRows.reduce((acc, r) => acc + Number(r.jumlah), 0);
    const sisaHutang = hutangRows.reduce(
      (acc, r) => acc + (Number(r.jumlah) - Number(r.jumlah_dibayar || 0)), 0);
    const saldoKas = totalTabungan - sisaHutang;

    document.getElementById("statTabungan").textContent = formatRupiah(totalTabungan);
    document.getElementById("statTabunganSub").textContent = `Dari ${siswaAktif} siswa aktif`;

    document.getElementById("statHutang").textContent = formatRupiah(sisaHutang);
    document.getElementById("statHutangSub").textContent = `Total pinjaman ${formatRupiah(totalHutang)}`;

    document.getElementById("statSiswa").textContent = siswaAktif;
    document.getElementById("statSiswaSub").textContent = `Dari ${totalSiswa} siswa terdaftar`;

    document.getElementById("statTransaksi").textContent = (tCount || 0) + (hCount || 0) + (cCount || 0);

    document.getElementById("statSaldoKas").textContent = formatRupiah(saldoKas);
    document.getElementById("statSaldoKasSub").textContent =
      `Tabungan ${formatRupiah(totalTabungan)} − Pinjaman belum kembali ${formatRupiah(sisaHutang)}`;

    return { totalTabungan, sisaHutang, saldoKas };
  }

  // ---------- Grafik batang: 6 bulan terakhir ----------
  async function loadBarChart() {
    const now = new Date();
    const awal = isoLokal(new Date(now.getFullYear(), now.getMonth() - 5, 1));

    const [tRows, hRows] = await Promise.all([
      fetchAll(() => window.db.from("tabungan").select("tanggal, jenis, jumlah").gte("tanggal", awal).order("tanggal").order("id")),
      fetchAll(() => window.db.from("hutang").select("tanggal, jumlah").gte("tanggal", awal).order("tanggal").order("id"))
    ]);

    const bulan = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bulan.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("id-ID", { month: "short" }),
        tabungan: 0, hutang: 0
      });
    }
    const idx = Object.fromEntries(bulan.map((b, i) => [b.key, i]));
    tRows.forEach(r => {
      const i = idx[r.tanggal.slice(0, 7)];
      if (i !== undefined) bulan[i].tabungan += (r.jenis === "tarik" ? -Number(r.jumlah) : Number(r.jumlah));
    });
    hRows.forEach(r => {
      const i = idx[r.tanggal.slice(0, 7)];
      if (i !== undefined) bulan[i].hutang += Number(r.jumlah);
    });

    new Chart(document.getElementById("chartBar"), {
      type: "bar",
      data: {
        labels: bulan.map(b => b.label),
        datasets: [
          { label: "Tabungan (setor − tarik)", data: bulan.map(b => b.tabungan), backgroundColor: "#2e7cf6", borderRadius: 6 },
          { label: "Pinjaman baru", data: bulan.map(b => b.hutang), backgroundColor: "#f5a2a2", borderRadius: 6 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // ---------- Grafik donat: saldo di kas vs sedang dipinjam ----------
  async function loadDonut(r) {
    const totalTabungan = r ? r.totalTabungan : 0;
    const sisaHutang = r ? r.sisaHutang : 0;
    new Chart(document.getElementById("chartDonut"), {
      type: "doughnut",
      data: {
        labels: ["Saldo di kas", "Sedang dipinjam"],
        datasets: [{
          data: [Math.max(totalTabungan - sisaHutang, 0), Math.max(sisaHutang, 0)],
          backgroundColor: ["#2e7cf6", "#f5a2a2"]
        }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }

  // ---------- Transaksi terbaru (gabungan Tabungan + Buku Catatan, terbaru dulu) ----------
  async function loadTransaksiTerbaru() {
    const [{ data: tRows }, { data: hRows }, { data: cRows }] = await Promise.all([
      window.db.from("tabungan").select("tanggal, jenis, jumlah, keterangan, created_at, siswa:siswa_id(nama)")
        .order("created_at", { ascending: false }).limit(8),
      window.db.from("hutang").select("tanggal, jumlah, keterangan, nama_peminjam, created_at")
        .order("created_at", { ascending: false }).limit(8),
      window.db.from("pembayaran_hutang").select("tanggal, jumlah, keterangan, created_at, hutang:hutang_id(nama_peminjam)")
        .order("created_at", { ascending: false }).limit(8)
    ]);

    const gabungan = [
      ...(tRows || []).map(r => ({
        tanggal: r.tanggal, created_at: r.created_at, nama: r.siswa?.nama,
        label: r.jenis === "tarik" ? "Tarik" : "Setor", kelasCss: r.jenis === "tarik" ? "badge-tarik" : "badge-setor",
        keterangan: r.keterangan, jumlah: r.jumlah
      })),
      ...(hRows || []).map(r => ({
        tanggal: r.tanggal, created_at: r.created_at, nama: r.nama_peminjam,
        label: "Pinjam", kelasCss: "badge-belum",
        keterangan: r.keterangan, jumlah: r.jumlah
      })),
      ...(cRows || []).map(r => ({
        tanggal: r.tanggal, created_at: r.created_at, nama: r.hutang?.nama_peminjam,
        label: "Cicilan", kelasCss: "badge-lunas",
        keterangan: r.keterangan, jumlah: r.jumlah
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

    const tbody = document.getElementById("tableTransaksi");
    if (gabungan.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada transaksi.</td></tr>`;
      return;
    }
    tbody.innerHTML = gabungan.map(r => `
      <tr>
        <td>${formatTanggal(r.tanggal)}</td>
        <td>${esc(r.nama || "-")}</td>
        <td><span class="badge-status ${r.kelasCss}">${r.label}</span></td>
        <td>${esc(r.keterangan || "-")}</td>
        <td>${formatRupiah(r.jumlah)}</td>
      </tr>`).join("");
  }

  // ---------- Buku Catatan (pinjaman) terbaru ----------
  async function loadHutangTerbaru() {
    const { data, error } = await window.db
      .from("hutang")
      .select("jumlah, status, nama_peminjam")
      .order("created_at", { ascending: false })
      .limit(6);

    const tbody = document.getElementById("tableHutang");
    if (error || !data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada catatan pinjaman.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(r => `
      <tr>
        <td>${esc(r.nama_peminjam || "-")}</td>
        <td>${formatRupiah(r.jumlah)}</td>
        <td><span class="badge-status ${r.status === "lunas" ? "badge-lunas" : "badge-belum"}">${r.status === "lunas" ? "Lunas" : "Belum"}</span></td>
      </tr>`).join("");
  }

  // ---------- 🏆 Rajin Menabung Bulan Ini (top 5 setoran terbanyak bulan berjalan) ----------
  async function loadJuaraMenabung() {
    const tbody = document.getElementById("tableJuara");
    const setoran = await fetchAll(() => window.db.from("tabungan")
      .select("siswa_id, jumlah, siswa:siswa_id(nama, kelas)")
      .eq("jenis", "setor").gte("tanggal", awalBulanIni()).order("id"));

    const perSiswa = {};
    setoran.forEach(r => {
      if (!r.siswa_id) return;
      if (!perSiswa[r.siswa_id]) perSiswa[r.siswa_id] = { nama: r.siswa?.nama || "-", kelas: r.siswa?.kelas || "-", total: 0 };
      perSiswa[r.siswa_id].total += Number(r.jumlah);
    });

    const top5 = Object.values(perSiswa).sort((a, b) => b.total - a.total).slice(0, 5);
    if (top5.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a1bd; padding:20px;">Belum ada setoran bulan ini.</td></tr>`;
      return;
    }
    const medali = ["🥇", "🥈", "🥉"];
    tbody.innerHTML = top5.map((s, i) => `
      <tr>
        <td>${medali[i] || (i + 1)}</td>
        <td>${esc(s.nama)}</td>
        <td>${esc(s.kelas)}</td>
        <td>${formatRupiah(s.total)}</td>
      </tr>`).join("");
  }
})();
