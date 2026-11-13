// Nusalaju — utilitas bersama (customer & back office)
window.SHUNLU_CONFIG = window.SHUNLU_CONFIG || {
  url: 'https://hnryfokljofawnfgedia.supabase.co',
  // Kunci publik (anon). Aman ditaruh di browser; akses dibatasi RLS dan fungsi di database.
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhucnlmb2tsam9mYXduZmdlZGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0OTk4MjAsImV4cCI6MjExMDA3NTgyMH0.jPy8OmD52XhD8eLRmsbo0DmlgzhE-lshNOpsk4gWFHU'
};
const sb = window.supabase.createClient(SHUNLU_CONFIG.url, SHUNLU_CONFIG.key, {
  auth: { persistSession: true, storageKey: 'nusalaju-auth' }
});

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const pad = n => String(n).padStart(2, '0');
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const jam = t => (t || '').slice(0, 5);
const tglPanjang = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const tglPendek = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
const waktu = ts => new Date(ts).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
const isoHari = (d, plus = 0) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + plus); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
const hariIni = () => { const x = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };

const PESAN_GALAT = {
  kursi_diambil: 'Kursi ini baru saja dipilih penumpang lain. Silakan pilih kursi lain.',
  maks_kursi: 'Maksimal kursi per pesanan sudah tercapai.',
  jadwal_ditutup: 'Penjualan online untuk jadwal ini sudah ditutup.',
  kunci_kursi_habis: 'Waktu memilih kursi habis. Pilih kursi lagi.',
  kontak_tidak_valid: 'Periksa nama, nomor HP, dan email pemesan.',
  nama_penumpang_kosong: 'Nama penumpang wajib diisi.',
  promo_tidak_valid: 'Kode promo tidak dikenali atau sudah tidak berlaku.',
  promo_kuota_habis: 'Kuota promo sudah habis.',
  promo_min_kursi: 'Promo ini butuh lebih banyak kursi per pesanan.',
  promo_hari: 'Promo ini tidak berlaku untuk hari keberangkatan tersebut.',
  promo_rute: 'Promo ini tidak berlaku untuk rute ini.',
  promo_khusus_member: 'Promo ini khusus member. Masuk dulu untuk memakainya.',
  batas_bayar_lewat: 'Batas waktu pembayaran sudah lewat.',
  status_tidak_bisa_unggah: 'Pesanan ini tidak menunggu bukti pembayaran.',
  pesanan_tidak_ada: 'Pesanan tidak ditemukan. Periksa kode booking dan email.',
  zona_tidak_dilayani: 'Rute ini belum kami layani.',
  layanan_tidak_tersedia: 'Layanan ini belum tersedia di rute tersebut.',
  ukuran_tidak_valid: 'Berat dan ukuran harus lebih dari 0.',
  nilai_melebihi_batas: 'Nilai barang melebihi batas asuransi.',
  penerima_tidak_lengkap: 'Lengkapi nama, nomor HP (minimal 10 digit), dan alamat penerima.',
  pengirim_tidak_lengkap: 'Lengkapi nama dan nomor HP pengirim.',
  jenis_barang_kosong: 'Isi jenis barang.',
  akses_ditolak: 'Anda tidak punya akses untuk aksi ini.',
  alasan_wajib: 'Alasan wajib diisi.',
  status_bukan_menunggu_verifikasi: 'Pesanan ini sudah diproses admin lain.',
  format_mutasi_tidak_dikenali: 'Format mutasi tidak dikenali. Kolom tanggal dan nominal tidak ditemukan.',
  bukan_gudang_asal: 'Resi ini bukan dari gudang Anda.',
  sudah_diterima: 'Barang ini sudah diterima di gudang.',
  resi_tidak_ada: 'Nomor resi tidak ditemukan.',
  belum_siap_diambil: 'Barang belum berstatus siap diambil.',
  bukti_wajib: 'Ambil foto atau tanda tangan penerima dulu.',
  jadwal_wajib: 'Pilih jadwal bus dulu.',
  email_sudah_terdaftar: 'Email ini sudah terdaftar. Ubah hak aksesnya di daftar user.',
  password_min_8: 'Password minimal 8 karakter.',
  email_tidak_valid: 'Email tidak valid.',
  nama_wajib: 'Nama wajib diisi.',
  hak_akses_wajib: 'Pilih hak akses.',
  pengelola_user_terakhir: 'Tidak bisa: ini satu-satunya user aktif yang bisa mengelola user.',
  belum_login: 'Sesi berakhir. Masuk lagi.'
};
function pesanGalat(err) {
  const m = (err && (err.message || err.alasan || err)) + '';
  const key = Object.keys(PESAN_GALAT).find(k => m.includes(k));
  return key ? PESAN_GALAT[key] : 'Terjadi galat: ' + m;
}
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) throw error;
  return data;
}

function toast(msg, kind = '') {
  let w = $('#toasts');
  if (!w) { w = document.createElement('div'); w.id = 'toasts'; w.className = 'toast-wrap'; w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.setAttribute('role', 'status'); t.textContent = msg;
  w.appendChild(t); setTimeout(() => t.remove(), 4200);
}
function modal(html) {
  closeModal();
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
  bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
  document.body.appendChild(bg);
  const f = bg.querySelector('input, textarea, select, button'); if (f) f.focus();
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  return bg;
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
async function copyText(t, label) {
  try { await navigator.clipboard.writeText(t); toast(label + ' disalin', 'ok'); } catch (e) { toast('Salin manual: ' + t); }
}
function unduh(nama, isi, tipe = 'text/csv') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([isi], { type: tipe })); a.download = nama; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const logoHtml = (href = 'index.html') => `<a class="logo" href="${href}" aria-label="Nusalaju"><span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 18.5V5.5l12 13V5.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 9.2l7 7.6" stroke="#E3A82B" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.6 2.4"/></svg></span>Nusalaju</a>`;
const IC = {
  swap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/></svg>',
  wa: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z"/></svg>',
  seat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h8a2 2 0 0 1 2 2v8H6z"/><path d="M4 13h14v4H4zM6 17v4M16 17v4"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  box: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  up: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  lock: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
};
function renderBarcode(el, text) {
  if (window.JsBarcode) { try { JsBarcode(el, text, { format: 'CODE128', height: 56, displayValue: false, margin: 0 }); return; } catch (e) {} }
  el.outerHTML = `<div class="mono">${esc(text)}</div>`;
}
function renderQR(el, text, size = 168) {
  el.innerHTML = '';
  if (window.QRCode) new QRCode(el, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
  else el.textContent = text;
}
// Pemindai kamera memakai BarcodeDetector bila browser mendukung; selain itu input teks (scanner USB/Bluetooth mengetik ke kolom)
async function mulaiKamera(videoEl, onHasil) {
  if (!('BarcodeDetector' in window)) { toast('Kamera scan belum didukung browser ini. Pakai scanner atau ketik kode.'); return null; }
  const det = new BarcodeDetector({ formats: ['qr_code', 'code_128'] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  videoEl.srcObject = stream; await videoEl.play();
  let aktif = true, terakhir = '', jeda = 0;
  (async function loop() {
    while (aktif) {
      try { const r = await det.detect(videoEl); if (r[0] && (r[0].rawValue !== terakhir || Date.now() > jeda)) { terakhir = r[0].rawValue; jeda = Date.now() + 2500; onHasil(r[0].rawValue); } } catch (e) {}
      await new Promise(res => setTimeout(res, 250));
    }
  })();
  return () => { aktif = false; stream.getTracks().forEach(t => t.stop()); };
}
