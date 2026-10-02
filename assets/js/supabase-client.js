// ============================================================
// Konfigurasi koneksi ke Supabase
// URL didapat dari "ref" yang tertanam di dalam anon key Anda.
// Jika Anda mengganti project Supabase, ganti dua nilai di bawah ini.
// ============================================================
const SUPABASE_URL = "https://kpgzdnpbhvfstrrdjwum.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwZ3pkbnBiaHZmc3RycmRqd3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjc1NjEsImV4cCI6MjEwNTk0MzU2MX0.Av2zKSRIWMx5pVKNBaplF--bpWQ9cL64T5oLeKLQejA";

// Diekspos ke window supaya halaman lain (mis. pengaturan.js) bisa bikin
// client Supabase KEDUA yang terisolasi, tanpa mengganggu sesi login utama.
window.SUPABASE_URL_FOR_TEMP = SUPABASE_URL;
window.SUPABASE_ANON_KEY_FOR_TEMP = SUPABASE_ANON_KEY;

// Dibuat sebagai variabel global window.db supaya dipakai file JS lain
window.db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
