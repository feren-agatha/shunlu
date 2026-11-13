-- Nusalaju — skema inti
create type app_role as enum ('superadmin','admin_tiket','admin_cargo');
create type status_pesanan as enum ('menunggu_bayar','menunggu_verifikasi','lunas','ditolak','kedaluwarsa','batal');
create type status_cargo as enum ('dibuat','diterima_asal','dalam_perjalanan','tiba_tujuan','siap_diambil','diterima','batal');
create type status_boarding as enum ('belum','naik','no_show');

-- Pengaturan umum (satu baris)
create table settings (
  id int primary key default 1 check (id = 1),
  nama_brand text not null default 'Nusalaju',
  nama_perusahaan text not null default 'Nusalaju',
  warna_brand text not null default '#0F5C4D',
  logo_url text,
  wa_tiket text, wa_cargo text, instagram text, facebook text,
  kunci_kursi_menit int not null default 10 check (kunci_kursi_menit between 1 and 60),
  batas_bayar_menit int not null default 30 check (batas_bayar_menit between 5 and 1440),
  tutup_jual_jam int not null default 2 check (tutup_jual_jam between 0 and 48),
  maks_kursi int not null default 6 check (maks_kursi between 1 and 20),
  maks_hari_kedepan int not null default 60,
  kode_unik boolean not null default true,
  sla_verifikasi_menit int not null default 30,
  updated_at timestamptz not null default now()
);

create table rekening (
  id uuid primary key default gen_random_uuid(),
  bank text not null, nomor text not null, atas_nama text not null,
  tampil boolean not null default true, urutan int not null default 0
);

create table branch (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique, kota text not null,
  fungsi text[] not null default '{}', alamat text, jam_operasional text,
  aktif boolean not null default true
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nama text, role app_role, branch_ids uuid[] not null default '{}',
  aktif boolean not null default true, created_at timestamptz not null default now()
);

-- Master ticketing
create table rute (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique, asal text not null, tujuan text not null,
  jarak_km int, estimasi_menit int not null, aktif boolean not null default true,
  check (asal <> tujuan)
);

create table layout_kursi (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  grid jsonb not null,   -- array baris; tiap sel: k (kursi), kv (VIP), l, t, p, s
  kursi jsonb not null   -- [{"no":"1A","kelas":"VIP","baris":1,"kolom":0}]
);

create table armada (
  id uuid primary key default gen_random_uuid(),
  nopol text not null unique, jenis text not null,
  layout_id uuid not null references layout_kursi,
  bagasi_kg int not null default 0,
  status text not null default 'Aktif' check (status in ('Aktif','Perawatan','Nonaktif'))
);

create table driver (
  id uuid primary key default gen_random_uuid(),
  nama text not null, sim_golongan text not null, sim_berlaku date not null,
  shift text, branch_id uuid references branch,
  status text not null default 'Aktif' check (status in ('Aktif','Cuti','Nonaktif'))
);

create table jadwal (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  rute_id uuid not null references rute,
  hari smallint[] not null default '{1,2,3,4,5,6,7}',  -- ISO: 1 = Senin
  jam time not null,
  armada_id uuid not null references armada,
  driver_id uuid references driver,
  harga_eksekutif int not null check (harga_eksekutif > 0),
  harga_vip int,
  titik_naik jsonb not null default '[]',   -- [{"nama":"Bekasi Timur","menit":40}]
  titik_turun jsonb not null default '[]',
  jual_online boolean not null default true,
  aktif boolean not null default true,
  check (harga_vip is null or harga_vip >= harga_eksekutif)
);

create table aturan_harga (
  id uuid primary key default gen_random_uuid(),
  nama text not null, prioritas int not null,
  tanggal_mulai date, tanggal_selesai date,
  hari smallint[], rute_ids uuid[], jam time,
  persen numeric(5,2) not null check (persen between -90 and 300),
  aktif boolean not null default true
);

create table promo (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique check (kode ~ '^[A-Z0-9]+$'),
  tipe text not null check (tipe in ('nominal','persen')),
  nilai int not null check (nilai > 0),
  maks_potongan int,
  rute_ids uuid[], hari smallint[],
  khusus_member boolean not null default false,
  min_kursi int not null default 1,
  mulai date not null, selesai date not null,
  kuota int not null, terpakai int not null default 0,
  maks_per_user int,
  aktif boolean not null default true,
  check (selesai >= mulai), check (terpakai <= kuota)
);

-- Status kursi publik (dipakai realtime); sesi disimpan sebagai hash
create table seat_status (
  jadwal_id uuid not null references jadwal on delete cascade,
  tanggal date not null, kursi text not null,
  status text not null check (status in ('held','taken')),
  sesi_hash text, expires_at timestamptz, pesanan_id uuid,
  primary key (jadwal_id, tanggal, kursi)
);

create table pesanan (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  jadwal_id uuid not null references jadwal,
  tanggal date not null,
  titik_naik text, titik_turun text,
  pemesan_nama text not null, pemesan_hp text not null, pemesan_email text not null,
  member_id uuid references auth.users,
  subtotal int not null, potongan int not null default 0,
  promo_id uuid references promo,
  kode_unik int not null default 0, total_transfer int not null,
  status status_pesanan not null default 'menunggu_bayar',
  batas_bayar timestamptz not null,
  bukti_path text, bukti_at timestamptz, alasan_tolak text,
  diverifikasi_oleh uuid references auth.users, diverifikasi_at timestamptz,
  created_at timestamptz not null default now()
);
create index pesanan_status_idx on pesanan (status, created_at);
create index pesanan_jadwal_idx on pesanan (jadwal_id, tanggal);
create index pesanan_total_idx on pesanan (total_transfer) where status in ('menunggu_bayar','menunggu_verifikasi','kedaluwarsa');

create table pesanan_kursi (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null references pesanan on delete cascade,
  jadwal_id uuid not null references jadwal, tanggal date not null,
  kursi text not null, kelas text not null, nama_penumpang text not null,
  harga int not null, aktif boolean not null default true,
  boarding status_boarding not null default 'belum', boarding_at timestamptz
);
-- Penjaga terakhir double booking
create unique index pesanan_kursi_aktif_uniq on pesanan_kursi (jadwal_id, tanggal, kursi) where aktif;
create index pesanan_kursi_pesanan_idx on pesanan_kursi (pesanan_id);

create table mutasi (
  id uuid primary key default gen_random_uuid(),
  rekening_id uuid references rekening,
  waktu timestamptz not null, keterangan text, nominal int not null,
  hasil text not null check (hasil in ('cocok','ragu','tidak_cocok')),
  pesanan_id uuid references pesanan,
  disetujui boolean not null default false,
  diunggah_oleh uuid references auth.users,
  created_at timestamptz not null default now()
);

-- Master cargo
create table zona (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique, asal text not null, tujuan text not null,
  jarak_km int, estimasi_hari int not null default 2, estimasi_teks text,
  aktif boolean not null default true, check (asal <> tujuan)
);
create table layanan (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique, janji text, batas_serah time,
  aktif boolean not null default true
);
create table tarif (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zona on delete cascade,
  layanan_id uuid not null references layanan,
  per_kg int not null check (per_kg > 0), min_charge int not null check (min_charge >= 0),
  pembagi int not null default 4000 check (pembagi > 0),
  unique (zona_id, layanan_id)
);
create table gudang (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique, kota text not null, branch_id uuid references branch,
  alamat text, jam_operasional text, aktif boolean not null default true
);
create table asuransi (
  id uuid primary key default gen_random_uuid(),
  vendor text not null, persen numeric(6,3) not null check (persen >= 0),
  maks_nilai bigint, aktif boolean not null default false
);
create unique index asuransi_satu_aktif on asuransi ((aktif)) where aktif;

create table pengiriman (
  id uuid primary key default gen_random_uuid(),
  resi text not null unique,
  zona_id uuid not null references zona, layanan_id uuid not null references layanan,
  gudang_asal_id uuid references gudang,
  pengirim_nama text not null, pengirim_hp text not null, pengirim_email text, pengirim_alamat text,
  penerima_nama text not null, penerima_hp text not null, penerima_alamat text not null,
  jenis_barang text not null, catatan text,
  asuransi_id uuid references asuransi, nilai_barang bigint not null default 0, biaya_asuransi int not null default 0,
  estimasi_ongkir int not null, ongkir_final int,
  lunas boolean not null default false,
  status status_cargo not null default 'dibuat',
  estimasi_tiba date,
  created_at timestamptz not null default now()
);
create index pengiriman_status_idx on pengiriman (status, created_at);

create table koli (
  id uuid primary key default gen_random_uuid(),
  pengiriman_id uuid not null references pengiriman on delete cascade,
  no int not null, label text not null unique,
  berat numeric(8,2) not null check (berat > 0),
  panjang int not null, lebar int not null, tinggi int not null,
  berat_final numeric(8,2),
  status status_cargo not null default 'dibuat',
  jadwal_id uuid references jadwal, tanggal_muat date,
  unique (pengiriman_id, no)
);
create index koli_muat_idx on koli (jadwal_id, tanggal_muat);

create table status_log (
  id bigserial primary key,
  pengiriman_id uuid not null references pengiriman on delete cascade,
  koli_id uuid references koli on delete cascade,
  status status_cargo not null, lokasi text, catatan text,
  oleh uuid references auth.users, waktu timestamptz not null default now()
);
create index status_log_idx on status_log (pengiriman_id, waktu desc);

create table bukti_terima (
  pengiriman_id uuid primary key references pengiriman on delete cascade,
  foto_path text, ttd_path text, nama_penerima text not null,
  oleh uuid references auth.users, waktu timestamptz not null default now(),
  check (foto_path is not null or ttd_path is not null)
);

-- CMS & log
create table konten (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('promo','berita','faq','halaman')),
  judul text not null, slug text not null unique, isi text, ringkas text, gambar_url text,
  urutan int not null default 0,
  status text not null default 'draf' check (status in ('draf','terbit','arsip')),
  updated_by uuid references auth.users, updated_at timestamptz not null default now()
);
create table rating (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null unique references pesanan,
  skor int not null check (skor between 1 and 5), ulasan text,
  tampil boolean not null default true, created_at timestamptz not null default now()
);
create table activity_log (
  id bigserial primary key,
  user_id uuid references auth.users, aksi text not null, objek text, detail jsonb,
  waktu timestamptz not null default now()
);
