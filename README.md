# Shunlu 顺路 — tiket bus & cargo

Situs customer (`index.html`), back office (`admin.html`), dan prototype desain (`prototype.html`) dalam satu folder statis. Backend dan database ada di Supabase project **shunlu** (region Singapura) yang sudah terisi skema, fungsi, keamanan, dan data awal.

## 1. Deploy ke Vercel

Pilih salah satu:

Buka https://vercel.com/new, import repository ini, Framework Preset **Other**, tanpa build command, lalu Deploy. Folder `supabase` dan README tidak ikut dipublikasikan (`.vercelignore`).

## 2. Atur URL di Supabase (wajib untuk login back office)

Dashboard Supabase → project **shunlu** → Authentication → URL Configuration:
- Site URL: `https://<domain-vercel-anda>`
- Redirect URLs: tambahkan `https://<domain-vercel-anda>/admin.html`

## 3. Buat Superadmin pertama

1. Buka `https://<domain-vercel-anda>/admin.html` → **Daftar akun staf** → konfirmasi lewat email.
2. Di Supabase → SQL Editor, jalankan (ganti emailnya):

       update profiles set role = 'superadmin' where email = 'email-anda@contoh.com';

3. Masuk lagi. User staf berikutnya cukup mendaftar, lalu Superadmin memberi peran dan branch di menu **User & hak akses**.

## Isi folder

| Berkas | Isi |
| --- | --- |
| `index.html`, `app.js` | Situs customer: cari jadwal, kursi real-time, pemesanan, transfer berkode unik, unggah bukti, e-ticket QR, cek ongkir, resi, lacak |
| `admin.html`, `admin.js` | Back office: dashboard, verifikasi, rekonsiliasi mutasi CSV, manifest & scan boarding, terima barang, scan koli, serah terima, master data, layout kursi, laporan, pengaturan, CMS, user, log |
| `common.js` | Koneksi Supabase (URL + kunci publik anon) dan utilitas |
| `prototype.html` | Prototype desain dengan data contoh |
| `supabase/migrations/*.sql` | Skema, keamanan (RLS), fungsi API, hak eksekusi, cron — sudah terpasang di project |

## Catatan

- Kunci di `common.js` adalah kunci publik (anon). Semua akses dibatasi Row Level Security dan pemeriksaan peran di fungsi database.
- Pesanan yang tidak dibayar dikedaluwarsakan otomatis tiap menit (pg_cron).
- Notifikasi email (e-ticket, status cargo) belum aktif: customer membuka e-ticket dan status lewat situs. Untuk mengaktifkannya perlu layanan email (mis. Resend) dan satu Edge Function.
- Scan kamera memakai BarcodeDetector (Chrome Android). Di browser lain gunakan scanner USB/Bluetooth atau ketik kode.
