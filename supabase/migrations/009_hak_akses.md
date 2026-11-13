Migrasi 009 (hak akses kustom) sudah terpasang di project Supabase "shunlu":
- tabel hak_akses (nama, deskripsi, izin[], sistem) + 4 peran bawaan
- profiles.hak_akses_id
- fungsi punya_izin, staf, izin_saya; my_role/has_role/is_super/staff_kota membaca izin
- kebijakan RLS profiles, activity_log, settings, rekening, konten, rating, hak_akses
- trigger jaga_pengelola: user aktif terakhir yang bisa mengelola user tidak bisa dicabut
Lihat riwayat migrasi di Dashboard Supabase > Database > Migrations untuk SQL lengkapnya.
