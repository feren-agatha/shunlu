-- Fungsi API Nusalaju. Semua transaksi lewat fungsi ini; tabel transaksi tidak bisa ditulis langsung.

create or replace function public.gen_kode(p_len int) returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, p_len)
$$;

create or replace function public.berangkat_at(p_tanggal date, p_jam time) returns timestamptz
language sql immutable as $$ select (p_tanggal + p_jam) at time zone 'Asia/Jakarta' $$;

create or replace function public.log_aktivitas(p_aksi text, p_objek text, p_detail jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into activity_log (user_id, aksi, objek, detail) values (auth.uid(), p_aksi, p_objek, p_detail)
$$;

create or replace function public.samarkan_nama(p text) returns text
language sql immutable as $$
  select string_agg(case when length(w) <= 2 then w else left(w, 2) || repeat('*', greatest(length(w) - 3, 1)) || right(w, 1) end, ' ')
  from regexp_split_to_table(trim(p), '\s+') as w
$$;

-- ===== Harga =====
create or replace function public.harga_kursi(p_jadwal uuid, p_tanggal date, p_kelas text) returns int
language plpgsql stable security definer set search_path = public as $$
declare j jadwal; v_base int; v_persen numeric;
begin
  select * into j from jadwal where id = p_jadwal;
  if not found then raise exception 'jadwal_tidak_ada'; end if;
  v_base := case when p_kelas = 'VIP' then coalesce(j.harga_vip, j.harga_eksekutif) else j.harga_eksekutif end;
  select a.persen into v_persen from aturan_harga a
   where a.aktif
     and (a.tanggal_mulai is null or p_tanggal >= a.tanggal_mulai)
     and (a.tanggal_selesai is null or p_tanggal <= a.tanggal_selesai)
     and (a.hari is null or extract(isodow from p_tanggal)::smallint = any(a.hari))
     and (a.rute_ids is null or j.rute_id = any(a.rute_ids))
     and (a.jam is null or a.jam = j.jam)
   order by a.prioritas asc limit 1;
  return round(v_base * (1 + coalesce(v_persen, 0) / 100.0) / 1000.0) * 1000;
end $$;

-- ===== Cari jadwal (L-04) =====
create or replace function public.cari_jadwal(p_asal text, p_tujuan text, p_tanggal date, p_pax int default 1)
returns table (jadwal_id uuid, kode text, jam time, tiba time, durasi_menit int, kelas text,
  harga_eksekutif int, harga_vip int, aturan text, sisa int, kapasitas int, titik_naik jsonb, titik_turun jsonb,
  armada text, ditutup boolean, alasan text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare s settings;
begin
  select * into s from settings where id = 1;
  return query
  with j as (
    select jd.*, r.estimasi_menit, r.asal, r.tujuan, a.nopol, a.jenis, l.kursi as lk
    from jadwal jd join rute r on r.id = jd.rute_id join armada a on a.id = jd.armada_id join layout_kursi l on l.id = a.layout_id
    where r.asal = p_asal and r.tujuan = p_tujuan and r.aktif and jd.aktif and a.status = 'Aktif'
      and extract(isodow from p_tanggal)::smallint = any(jd.hari)
  )
  select j.id, j.kode, j.jam, (j.jam + make_interval(mins => j.estimasi_menit))::time, j.estimasi_menit,
    case when j.harga_vip is null then 'Eksekutif' else 'VIP + Eksekutif' end,
    harga_kursi(j.id, p_tanggal, 'Eksekutif'),
    case when j.harga_vip is null then null else harga_kursi(j.id, p_tanggal, 'VIP') end,
    (select a.nama || ' ' || case when a.persen > 0 then '+' else '' end || trim(to_char(a.persen, 'FM990')) || '%'
       from aturan_harga a where a.aktif
        and (a.tanggal_mulai is null or p_tanggal >= a.tanggal_mulai) and (a.tanggal_selesai is null or p_tanggal <= a.tanggal_selesai)
        and (a.hari is null or extract(isodow from p_tanggal)::smallint = any(a.hari))
        and (a.rute_ids is null or j.rute_id = any(a.rute_ids)) and (a.jam is null or a.jam = j.jam)
       order by a.prioritas limit 1),
    (jsonb_array_length(j.lk) - (select count(*) from seat_status ss where ss.jadwal_id = j.id and ss.tanggal = p_tanggal
        and (ss.status = 'taken' or ss.expires_at > now())))::int,
    jsonb_array_length(j.lk),
    j.titik_naik, j.titik_turun, j.nopol,
    (not j.jual_online or berangkat_at(p_tanggal, j.jam) - make_interval(hours => s.tutup_jual_jam) < now()
      or p_tanggal > current_date + s.maks_hari_kedepan),
    case when not j.jual_online then 'Penjualan online ditutup sementara'
         when berangkat_at(p_tanggal, j.jam) - make_interval(hours => s.tutup_jual_jam) < now()
           then 'Penjualan online ditutup ' || s.tutup_jual_jam || ' jam sebelum berangkat'
         when p_tanggal > current_date + s.maks_hari_kedepan then 'Belum dibuka'
         else null end
  from j order by j.jam;
end $$;

-- ===== Peta kursi (L-05) =====
create or replace function public.peta_kursi(p_jadwal uuid, p_tanggal date, p_sesi uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_grid jsonb; v_kursi jsonb; v_hash text := md5(coalesce(p_sesi::text, '')); v_exp timestamptz;
begin
  select l.grid, l.kursi into v_grid, v_kursi from jadwal j join armada a on a.id = j.armada_id join layout_kursi l on l.id = a.layout_id where j.id = p_jadwal;
  if v_grid is null then raise exception 'jadwal_tidak_ada'; end if;
  select min(expires_at) into v_exp from seat_status where jadwal_id = p_jadwal and tanggal = p_tanggal and status = 'held' and sesi_hash = v_hash and expires_at > now();
  return jsonb_build_object(
    'grid', v_grid,
    'harga', jsonb_build_object('Eksekutif', harga_kursi(p_jadwal, p_tanggal, 'Eksekutif'), 'VIP', harga_kursi(p_jadwal, p_tanggal, 'VIP')),
    'kunci_berakhir', v_exp,
    'kursi', (select jsonb_agg(k || jsonb_build_object('status',
        case when ss.status = 'taken' then 'taken'
             when ss.status = 'held' and ss.expires_at > now() and ss.sesi_hash = v_hash then 'mine'
             when ss.status = 'held' and ss.expires_at > now() then 'held'
             else 'free' end))
      from jsonb_array_elements(v_kursi) k
      left join seat_status ss on ss.jadwal_id = p_jadwal and ss.tanggal = p_tanggal and ss.kursi = k->>'no')
  );
end $$;

create or replace function public.kunci_kursi(p_jadwal uuid, p_tanggal date, p_kursi text, p_sesi uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s settings; v_hash text := md5(p_sesi::text); v_exp timestamptz; v_jam time; v_n int; v_ok boolean;
begin
  select * into s from settings where id = 1;
  select jam into v_jam from jadwal where id = p_jadwal and aktif and jual_online;
  if not found then return jsonb_build_object('ok', false, 'alasan', 'jadwal_ditutup'); end if;
  if berangkat_at(p_tanggal, v_jam) - make_interval(hours => s.tutup_jual_jam) < now() then
    return jsonb_build_object('ok', false, 'alasan', 'jadwal_ditutup'); end if;
  if not exists (select 1 from jadwal j join armada a on a.id = j.armada_id join layout_kursi l on l.id = a.layout_id,
      jsonb_array_elements(l.kursi) k where j.id = p_jadwal and k->>'no' = p_kursi) then
    return jsonb_build_object('ok', false, 'alasan', 'kursi_tidak_ada'); end if;

  delete from seat_status where jadwal_id = p_jadwal and tanggal = p_tanggal and status = 'held' and expires_at < now();

  select count(*) into v_n from seat_status where jadwal_id = p_jadwal and tanggal = p_tanggal and status = 'held' and sesi_hash = v_hash and expires_at > now();
  if v_n >= s.maks_kursi then return jsonb_build_object('ok', false, 'alasan', 'maks_kursi', 'maks', s.maks_kursi); end if;

  select min(expires_at) into v_exp from seat_status where jadwal_id = p_jadwal and tanggal = p_tanggal and status = 'held' and sesi_hash = v_hash and expires_at > now();
  v_exp := coalesce(v_exp, now() + make_interval(mins => s.kunci_kursi_menit));

  insert into seat_status (jadwal_id, tanggal, kursi, status, sesi_hash, expires_at)
  values (p_jadwal, p_tanggal, p_kursi, 'held', v_hash, v_exp)
  on conflict (jadwal_id, tanggal, kursi) do nothing;
  get diagnostics v_n = row_count;
  v_ok := v_n = 1 or exists (select 1 from seat_status where jadwal_id = p_jadwal and tanggal = p_tanggal and kursi = p_kursi and sesi_hash = v_hash and status = 'held');
  if not v_ok then return jsonb_build_object('ok', false, 'alasan', 'kursi_diambil'); end if;
  return jsonb_build_object('ok', true, 'kunci_berakhir', v_exp);
end $$;

create or replace function public.lepas_kursi(p_jadwal uuid, p_tanggal date, p_kursi text, p_sesi uuid) returns void
language sql security definer set search_path = public as $$
  delete from seat_status where jadwal_id = p_jadwal and tanggal = p_tanggal and kursi = p_kursi and status = 'held' and sesi_hash = md5(p_sesi::text)
$$;

-- ===== Buat pesanan (L-06) =====
create or replace function public.buat_pesanan(p_jadwal uuid, p_tanggal date, p_sesi uuid, p_penumpang jsonb,
  p_nama text, p_hp text, p_email text, p_titik_naik text default null, p_titik_turun text default null, p_promo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare s settings; v_hash text := md5(p_sesi::text); v_n int; v_sub int := 0; v_pot int := 0; pr promo; v_unik int := 0;
  v_kode text; v_id uuid; p jsonb; v_kelas text; v_harga int; v_rute uuid; v_batas timestamptz;
begin
  select * into s from settings where id = 1;
  v_n := jsonb_array_length(p_penumpang);
  if v_n < 1 or v_n > s.maks_kursi then raise exception 'jumlah_kursi_tidak_valid'; end if;
  if coalesce(trim(p_nama), '') = '' or coalesce(trim(p_hp), '') = '' or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'kontak_tidak_valid'; end if;
  if exists (select 1 from jsonb_array_elements(p_penumpang) x where coalesce(trim(x->>'nama'), '') = '') then raise exception 'nama_penumpang_kosong'; end if;

  -- semua kursi harus dikunci sesi ini dan belum habis
  if (select count(*) from seat_status ss join jsonb_array_elements(p_penumpang) x on ss.kursi = x->>'kursi'
      where ss.jadwal_id = p_jadwal and ss.tanggal = p_tanggal and ss.status = 'held' and ss.sesi_hash = v_hash and ss.expires_at > now()) <> v_n then
    raise exception 'kunci_kursi_habis';
  end if;
  select rute_id into v_rute from jadwal where id = p_jadwal;

  for p in select * from jsonb_array_elements(p_penumpang) loop
    select k->>'kelas' into v_kelas from jadwal j join armada a on a.id = j.armada_id join layout_kursi l on l.id = a.layout_id, jsonb_array_elements(l.kursi) k
      where j.id = p_jadwal and k->>'no' = p->>'kursi';
    v_sub := v_sub + harga_kursi(p_jadwal, p_tanggal, v_kelas);
  end loop;

  if coalesce(trim(p_promo), '') <> '' then
    select * into pr from promo where kode = upper(trim(p_promo)) and aktif and current_date between mulai and selesai;
    if not found then raise exception 'promo_tidak_valid'; end if;
    if pr.terpakai >= pr.kuota then raise exception 'promo_kuota_habis'; end if;
    if v_n < pr.min_kursi then raise exception 'promo_min_kursi'; end if;
    if pr.hari is not null and not (extract(isodow from p_tanggal)::smallint = any(pr.hari)) then raise exception 'promo_hari'; end if;
    if pr.rute_ids is not null and not (v_rute = any(pr.rute_ids)) then raise exception 'promo_rute'; end if;
    if pr.khusus_member and auth.uid() is null then raise exception 'promo_khusus_member'; end if;
    v_pot := case when pr.tipe = 'nominal' then pr.nilai else least(floor(v_sub * pr.nilai / 100.0)::int, coalesce(pr.maks_potongan, v_sub)) end;
    v_pot := least(v_pot, v_sub);
    update promo set terpakai = terpakai + 1 where id = pr.id and terpakai < kuota;
    if not found then raise exception 'promo_kuota_habis'; end if;
  end if;

  if s.kode_unik then
    for i in 1..30 loop
      v_unik := 1 + floor(random() * 999)::int;
      exit when not exists (select 1 from pesanan where status in ('menunggu_bayar','menunggu_verifikasi')
        and total_transfer = v_sub - v_pot + v_unik);
    end loop;
  end if;

  loop
    v_kode := 'NL' || gen_kode(4);
    exit when not exists (select 1 from pesanan where kode = v_kode);
  end loop;
  v_batas := now() + make_interval(mins => s.batas_bayar_menit);

  insert into pesanan (kode, jadwal_id, tanggal, titik_naik, titik_turun, pemesan_nama, pemesan_hp, pemesan_email, member_id,
    subtotal, potongan, promo_id, kode_unik, total_transfer, batas_bayar)
  values (v_kode, p_jadwal, p_tanggal, p_titik_naik, p_titik_turun, trim(p_nama), trim(p_hp), lower(trim(p_email)), auth.uid(),
    v_sub, v_pot, pr.id, v_unik, v_sub - v_pot + v_unik, v_batas)
  returning id into v_id;

  insert into pesanan_kursi (pesanan_id, jadwal_id, tanggal, kursi, kelas, nama_penumpang, harga)
  select v_id, p_jadwal, p_tanggal, x->>'kursi', k->>'kelas', trim(x->>'nama'), harga_kursi(p_jadwal, p_tanggal, k->>'kelas')
  from jsonb_array_elements(p_penumpang) x
  join jadwal j on j.id = p_jadwal join armada a on a.id = j.armada_id join layout_kursi l on l.id = a.layout_id
  cross join lateral jsonb_array_elements(l.kursi) k
  where k->>'no' = x->>'kursi';

  update seat_status set status = 'taken', pesanan_id = v_id, sesi_hash = null, expires_at = null
   where jadwal_id = p_jadwal and tanggal = p_tanggal and sesi_hash = v_hash and kursi in (select x->>'kursi' from jsonb_array_elements(p_penumpang) x);

  return jsonb_build_object('kode', v_kode, 'subtotal', v_sub, 'potongan', v_pot, 'kode_unik', v_unik,
    'total_transfer', v_sub - v_pot + v_unik, 'batas_bayar', v_batas);
end $$;

-- ===== Pembayaran customer (L-07, L-08) =====
create or replace function public.unggah_bukti(p_kode text, p_email text, p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pesanan;
begin
  select * into v from pesanan where kode = upper(p_kode) and pemesan_email = lower(trim(p_email)) for update;
  if not found then raise exception 'pesanan_tidak_ada'; end if;
  if v.status not in ('menunggu_bayar','ditolak') then raise exception 'status_tidak_bisa_unggah'; end if;
  if v.batas_bayar < now() then raise exception 'batas_bayar_lewat'; end if;
  if p_path not like 'bukti-transfer/' || v.kode || '/%' and p_path not like v.kode || '/%' then raise exception 'path_tidak_valid'; end if;
  update pesanan set bukti_path = p_path, bukti_at = now(), status = 'menunggu_verifikasi', alasan_tolak = null where id = v.id;
  return jsonb_build_object('kode', v.kode, 'status', 'menunggu_verifikasi');
end $$;

create or replace function public.cek_pesanan(p_kode text, p_email text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'kode', p.kode, 'status', p.status, 'tanggal', p.tanggal, 'jam', j.jam, 'rute', r.asal || ' → ' || r.tujuan,
    'asal', r.asal, 'tujuan', r.tujuan, 'tiba', (j.jam + make_interval(mins => r.estimasi_menit))::time,
    'armada', a.nopol, 'titik_naik', p.titik_naik, 'titik_turun', p.titik_turun,
    'subtotal', p.subtotal, 'potongan', p.potongan, 'kode_unik', p.kode_unik, 'total_transfer', p.total_transfer,
    'batas_bayar', p.batas_bayar, 'alasan_tolak', p.alasan_tolak, 'pemesan', p.pemesan_nama, 'email', p.pemesan_email,
    'kursi', (select jsonb_agg(jsonb_build_object('kursi', k.kursi, 'kelas', k.kelas, 'nama', k.nama_penumpang, 'harga', k.harga) order by k.kursi)
              from pesanan_kursi k where k.pesanan_id = p.id),
    'rekening', (select jsonb_agg(jsonb_build_object('bank', bank, 'nomor', nomor, 'atas_nama', atas_nama) order by urutan) from rekening where tampil),
    'qr', case when p.status = 'lunas' then p.kode else null end)
  from pesanan p join jadwal j on j.id = p.jadwal_id join rute r on r.id = j.rute_id join armada a on a.id = j.armada_id
  where p.kode = upper(p_kode) and p.pemesan_email = lower(trim(p_email))
$$;

-- ===== Verifikasi & rekonsiliasi (L-10, L-11) =====
create or replace function public.daftar_verifikasi() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('admin_tiket') then raise exception 'akses_ditolak'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'kode', p.kode, 'nama', p.pemesan_nama, 'jadwal', to_char(p.tanggal, 'DD Mon') || ' · ' || to_char(j.jam, 'HH24:MI') || ' ' || r.kode,
      'total_transfer', p.total_transfer, 'bukti_path', p.bukti_path, 'menunggu_menit', floor(extract(epoch from now() - p.bukti_at) / 60),
      'mutasi', (select jsonb_build_object('waktu', m.waktu, 'keterangan', m.keterangan) from mutasi m where m.pesanan_id = p.id and m.hasil = 'cocok' limit 1))
      order by p.bukti_at)
    from pesanan p join jadwal j on j.id = p.jadwal_id join rute r on r.id = j.rute_id
    where p.status = 'menunggu_verifikasi' and dalam_cakupan(r.asal)), '[]'::jsonb);
end $$;

create or replace function public.verifikasi_pembayaran(p_kode text, p_setuju boolean, p_alasan text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pesanan; v_asal text;
begin
  if not has_role('admin_tiket') then raise exception 'akses_ditolak'; end if;
  select p.* into v from pesanan p where p.kode = upper(p_kode) for update;
  if not found then raise exception 'pesanan_tidak_ada'; end if;
  select r.asal into v_asal from jadwal j join rute r on r.id = j.rute_id where j.id = v.jadwal_id;
  if not dalam_cakupan(v_asal) then raise exception 'akses_ditolak'; end if;
  if v.status <> 'menunggu_verifikasi' then raise exception 'status_bukan_menunggu_verifikasi'; end if;
  if p_setuju then
    update pesanan set status = 'lunas', diverifikasi_oleh = auth.uid(), diverifikasi_at = now() where id = v.id;
  else
    if coalesce(trim(p_alasan), '') = '' then raise exception 'alasan_wajib'; end if;
    update pesanan set status = 'ditolak', alasan_tolak = trim(p_alasan), diverifikasi_oleh = auth.uid(), diverifikasi_at = now(),
      batas_bayar = greatest(batas_bayar, now() + interval '15 minutes') where id = v.id;
  end if;
  perform log_aktivitas(case when p_setuju then 'Menyetujui pembayaran' else 'Menolak pembayaran' end, v.kode, jsonb_build_object('alasan', p_alasan));
  return jsonb_build_object('kode', v.kode, 'status', case when p_setuju then 'lunas' else 'ditolak' end, 'email', v.pemesan_email);
end $$;

create or replace function public.impor_mutasi(p_rekening uuid, p_baris jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b jsonb; v_pid uuid; v_hasil text; c int := 0; r int := 0; x int := 0;
begin
  if not has_role('admin_tiket') then raise exception 'akses_ditolak'; end if;
  for b in select * from jsonb_array_elements(p_baris) loop
    if (b->>'nominal') is null or (b->>'waktu') is null then raise exception 'format_mutasi_tidak_dikenali'; end if;
    v_pid := null;
    select id into v_pid from pesanan where total_transfer = (b->>'nominal')::int and status in ('menunggu_bayar','menunggu_verifikasi')
      order by created_at desc limit 1;
    if v_pid is not null then v_hasil := 'cocok'; c := c + 1;
    else
      select id into v_pid from pesanan where total_transfer = (b->>'nominal')::int and status = 'kedaluwarsa' order by created_at desc limit 1;
      if v_pid is not null then v_hasil := 'ragu'; r := r + 1; else v_hasil := 'tidak_cocok'; x := x + 1; end if;
    end if;
    insert into mutasi (rekening_id, waktu, keterangan, nominal, hasil, pesanan_id, diunggah_oleh)
    values (p_rekening, (b->>'waktu')::timestamptz, b->>'keterangan', (b->>'nominal')::int, v_hasil, v_pid, auth.uid());
  end loop;
  perform log_aktivitas('Mengimpor mutasi', p_rekening::text, jsonb_build_object('cocok', c, 'ragu', r, 'tidak_cocok', x));
  return jsonb_build_object('cocok', c, 'ragu', r, 'tidak_cocok', x);
end $$;

create or replace function public.setujui_mutasi_cocok() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not has_role('admin_tiket') then raise exception 'akses_ditolak'; end if;
  with up as (
    update pesanan p set status = 'lunas', diverifikasi_oleh = auth.uid(), diverifikasi_at = now()
    from mutasi m where m.pesanan_id = p.id and m.hasil = 'cocok' and not m.disetujui and p.status in ('menunggu_bayar','menunggu_verifikasi')
    returning p.id)
  select count(*) into v_n from up;
  update mutasi set disetujui = true where hasil = 'cocok' and not disetujui;
  perform log_aktivitas('Menyetujui mutasi cocok', null, jsonb_build_object('jumlah', v_n));
  return jsonb_build_object('lunas', v_n);
end $$;

-- ===== Manifest & boarding (L-12) =====
create or replace function public.manifest(p_jadwal uuid, p_tanggal date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('admin_tiket') then raise exception 'akses_ditolak'; end if;
  return jsonb_build_object(
    'jadwal', (select jsonb_build_object('kode', j.kode, 'jam', j.jam, 'rute', r.asal || ' → ' || r.tujuan, 'armada', a.nopol, 'driver', d.nama,
        'kapasitas', jsonb_array_length(l.kursi))
      from jadwal j join rute r on r.id = j.rute_id join armada a on a.id = j.armada_id join layout_kursi l on l.id = a.layout_id
      left join driver d on d.id = j.driver_id where j.id = p_jadwal),
    'penumpang', coalesce((select jsonb_agg(jsonb_build_object('kursi', k.kursi, 'nama', k.nama_penumpang, 'kelas', k.kelas,
        'titik_naik', p.titik_naik, 'bayar', p.status, 'boarding', k.boarding, 'boarding_at', k.boarding_at, 'kode', p.kode) order by k.kursi)
      from pesanan_kursi k join pesanan p on p.id = k.pesanan_id
      where k.jadwal_id = p_jadwal and k.tanggal = p_tanggal and k.aktif), '[]'::jsonb));
end $$;

create or replace function public.scan_boarding(p_qr text, p_jadwal uuid, p_tanggal date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p pesanan; v_n int;
begin
  if not has_role('admin_tiket') then raise exception 'akses_ditolak'; end if;
  select * into p from pesanan where kode = upper(split_part(p_qr, ':', 1));
  if not found then return jsonb_build_object('ok', false, 'pesan', 'QR tidak dikenali'); end if;
  if p.jadwal_id <> p_jadwal or p.tanggal <> p_tanggal then
    return jsonb_build_object('ok', false, 'pesan', 'Tiket untuk jadwal ' || (select to_char(p.tanggal, 'DD Mon') || ' ' || to_char(jam, 'HH24:MI') from jadwal where id = p.jadwal_id)); end if;
  if p.status <> 'lunas' then return jsonb_build_object('ok', false, 'pesan', 'Belum lunas, arahkan ke loket'); end if;
  if not exists (select 1 from pesanan_kursi where pesanan_id = p.id and aktif and boarding = 'belum') then
    return jsonb_build_object('ok', false, 'pesan', 'Sudah naik pukul ' || (select to_char(max(boarding_at) at time zone 'Asia/Jakarta', 'HH24:MI') from pesanan_kursi where pesanan_id = p.id)); end if;
  update pesanan_kursi set boarding = 'naik', boarding_at = now() where pesanan_id = p.id and aktif and boarding = 'belum';
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'pesan', 'Naik — ' || (select string_agg(kursi || ' ' || nama_penumpang, ', ' order by kursi) from pesanan_kursi where pesanan_id = p.id and aktif), 'jumlah', v_n);
end $$;

create or replace function public.tutup_boarding(p_jadwal uuid, p_tanggal date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not has_role('admin_tiket') then raise exception 'akses_ditolak'; end if;
  update pesanan_kursi k set boarding = 'no_show' from pesanan p
   where p.id = k.pesanan_id and p.status = 'lunas' and k.jadwal_id = p_jadwal and k.tanggal = p_tanggal and k.aktif and k.boarding = 'belum';
  get diagnostics v_n = row_count;
  perform log_aktivitas('Menutup boarding', p_jadwal::text, jsonb_build_object('tanggal', p_tanggal, 'no_show', v_n));
  return jsonb_build_object('no_show', v_n);
end $$;

-- ===== Cargo (L-13 s.d. L-17) =====
create or replace function public.hitung_ongkir(p_asal text, p_tujuan text, p_layanan text, p_koli jsonb, p_asuransi boolean default false, p_nilai bigint default 0)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare z zona; l layanan; t tarif; a asuransi; k jsonb; v_rows jsonb := '[]'; v_vol numeric; v_bill int; v_total int := 0; v_raw int; v_ong int; v_ins int := 0;
begin
  select * into z from zona where asal = p_asal and tujuan = p_tujuan and aktif;
  if not found then return jsonb_build_object('ok', false, 'alasan', 'zona_tidak_dilayani'); end if;
  select * into l from layanan where nama = p_layanan and aktif;
  if not found then return jsonb_build_object('ok', false, 'alasan', 'layanan_tidak_tersedia'); end if;
  select * into t from tarif where zona_id = z.id and layanan_id = l.id;
  if not found then return jsonb_build_object('ok', false, 'alasan', 'layanan_tidak_tersedia'); end if;
  if jsonb_array_length(p_koli) = 0 then return jsonb_build_object('ok', false, 'alasan', 'koli_kosong'); end if;
  for k in select * from jsonb_array_elements(p_koli) loop
    if (k->>'berat')::numeric <= 0 or (k->>'p')::int <= 0 or (k->>'l')::int <= 0 or (k->>'t')::int <= 0 then
      return jsonb_build_object('ok', false, 'alasan', 'ukuran_tidak_valid'); end if;
    v_vol := round((k->>'p')::numeric * (k->>'l')::numeric * (k->>'t')::numeric / t.pembagi, 2);
    v_bill := ceil(greatest((k->>'berat')::numeric, v_vol));
    v_total := v_total + v_bill;
    v_rows := v_rows || jsonb_build_object('berat', (k->>'berat')::numeric, 'volume', v_vol, 'tertagih', v_bill, 'dipakai', case when v_vol > (k->>'berat')::numeric then 'volume' else 'aktual' end);
  end loop;
  v_raw := v_total * t.per_kg;
  v_ong := greatest(v_raw, t.min_charge);
  if p_asuransi then
    select * into a from asuransi where aktif limit 1;
    if found then
      if a.maks_nilai is not null and p_nilai > a.maks_nilai then return jsonb_build_object('ok', false, 'alasan', 'nilai_melebihi_batas', 'maks', a.maks_nilai); end if;
      v_ins := round(p_nilai * a.persen / 100.0);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'zona', z.kode, 'layanan', l.nama, 'per_kg', t.per_kg, 'pembagi', t.pembagi, 'min_charge', t.min_charge,
    'koli', v_rows, 'berat_tertagih', v_total, 'ongkir_dasar', v_raw, 'kena_minimum', v_raw < t.min_charge, 'ongkir', v_ong,
    'asuransi', v_ins, 'asuransi_persen', a.persen, 'asuransi_vendor', a.vendor, 'total', v_ong + v_ins,
    'estimasi', coalesce(l.janji, z.estimasi_teks), 'estimasi_teks', z.estimasi_teks,
    'gudang', (select jsonb_build_object('nama', g.nama, 'alamat', g.alamat, 'jam', g.jam_operasional) from gudang g where g.kota = p_asal and g.aktif limit 1));
end $$;

create or replace function public.buat_pengiriman(p_asal text, p_tujuan text, p_layanan text, p_koli jsonb, p_asuransi boolean, p_nilai bigint,
  p_pengirim jsonb, p_penerima jsonb, p_jenis text, p_catatan text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h jsonb; z zona; l layanan; v_resi text; v_id uuid; k jsonb; i int := 0; n int := jsonb_array_length(p_koli);
begin
  h := hitung_ongkir(p_asal, p_tujuan, p_layanan, p_koli, p_asuransi, p_nilai);
  if not (h->>'ok')::boolean then raise exception '%', h->>'alasan'; end if;
  if coalesce(trim(p_pengirim->>'nama'), '') = '' or coalesce(trim(p_pengirim->>'hp'), '') = '' then raise exception 'pengirim_tidak_lengkap'; end if;
  if coalesce(trim(p_penerima->>'nama'), '') = '' or length(regexp_replace(coalesce(p_penerima->>'hp', ''), '\D', '', 'g')) < 10
     or coalesce(trim(p_penerima->>'alamat'), '') = '' then raise exception 'penerima_tidak_lengkap'; end if;
  if coalesce(trim(p_jenis), '') = '' then raise exception 'jenis_barang_kosong'; end if;
  select * into z from zona where asal = p_asal and tujuan = p_tujuan and aktif;
  select * into l from layanan where nama = p_layanan;
  loop
    v_resi := 'NLC' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || gen_kode(3);
    exit when not exists (select 1 from pengiriman where resi = v_resi);
  end loop;
  insert into pengiriman (resi, zona_id, layanan_id, gudang_asal_id, pengirim_nama, pengirim_hp, pengirim_email, pengirim_alamat,
    penerima_nama, penerima_hp, penerima_alamat, jenis_barang, catatan, asuransi_id, nilai_barang, biaya_asuransi, estimasi_ongkir, estimasi_tiba)
  values (v_resi, z.id, l.id, (select id from gudang where kota = p_asal and aktif limit 1),
    trim(p_pengirim->>'nama'), trim(p_pengirim->>'hp'), nullif(lower(trim(p_pengirim->>'email')), ''), p_pengirim->>'alamat',
    trim(p_penerima->>'nama'), trim(p_penerima->>'hp'), trim(p_penerima->>'alamat'), trim(p_jenis), p_catatan,
    case when p_asuransi then (select id from asuransi where aktif limit 1) end, coalesce(p_nilai, 0), (h->>'asuransi')::int,
    (h->>'total')::int, current_date + z.estimasi_hari)
  returning id into v_id;
  for k in select * from jsonb_array_elements(p_koli) loop
    i := i + 1;
    insert into koli (pengiriman_id, no, label, berat, panjang, lebar, tinggi)
    values (v_id, i, v_resi || '-' || i || '/' || n, (k->>'berat')::numeric, (k->>'p')::int, (k->>'l')::int, (k->>'t')::int);
  end loop;
  insert into status_log (pengiriman_id, status, lokasi) values (v_id, 'dibuat', 'Online');
  return jsonb_build_object('resi', v_resi, 'estimasi_ongkir', (h->>'total')::int, 'gudang', h->'gudang', 'koli', n);
end $$;

create or replace function public.lacak_resi(p_resi text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'resi', p.resi, 'status', p.status, 'asal', z.asal, 'tujuan', z.tujuan, 'layanan', l.nama,
    'koli', (select count(*) from koli where pengiriman_id = p.id), 'estimasi_tiba', p.estimasi_tiba,
    'timeline', (select jsonb_agg(jsonb_build_object('status', s.status, 'lokasi', s.lokasi, 'catatan', s.catatan, 'waktu', s.waktu) order by s.waktu desc, s.id desc)
                 from status_log s where s.pengiriman_id = p.id and s.koli_id is null),
    'penerima', case when p.status = 'diterima' then samarkan_nama(b.nama_penerima) end,
    'ada_foto', b.foto_path is not null, 'ada_ttd', b.ttd_path is not null)
  from pengiriman p join zona z on z.id = p.zona_id join layanan l on l.id = p.layanan_id
  left join bukti_terima b on b.pengiriman_id = p.id
  where p.resi = upper(trim(p_resi))
$$;

create or replace function public.urutan_status(s status_cargo) returns int language sql immutable as $$
  select array_position(array['dibuat','diterima_asal','dalam_perjalanan','tiba_tujuan','siap_diambil','diterima']::status_cargo[], s)
$$;

create or replace function public.label_status(s status_cargo) returns text language sql immutable as $$
  select case s when 'dibuat' then 'Pengiriman dibuat' when 'diterima_asal' then 'Diterima di gudang asal'
    when 'dalam_perjalanan' then 'Dalam perjalanan' when 'tiba_tujuan' then 'Tiba di gudang tujuan'
    when 'siap_diambil' then 'Siap diambil / diantar' when 'diterima' then 'Diterima' else 'Dibatalkan' end
$$;

-- Status resi = status koli paling belakang; log tingkat resi ditulis saat status resi naik
create or replace function public.sinkron_status_resi(p_id uuid, p_lokasi text, p_catatan text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_min status_cargo; v_now status_cargo;
begin
  select status into v_now from pengiriman where id = p_id;
  select status into v_min from koli where pengiriman_id = p_id order by urutan_status(status) asc limit 1;
  if urutan_status(v_min) > urutan_status(v_now) then
    update pengiriman set status = v_min where id = p_id;
    insert into status_log (pengiriman_id, status, lokasi, catatan, oleh) values (p_id, v_min, p_lokasi, p_catatan, auth.uid());
  end if;
end $$;

create or replace function public.terima_barang(p_resi text, p_koli jsonb, p_lunas boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p pengiriman; z zona; l layanan; h jsonb; k jsonb; v_gudang text;
begin
  if not has_role('admin_cargo') then raise exception 'akses_ditolak'; end if;
  select * into p from pengiriman where resi = upper(p_resi) for update;
  if not found then raise exception 'resi_tidak_ada'; end if;
  select * into z from zona where id = p.zona_id;
  if not dalam_cakupan(z.asal) then raise exception 'bukan_gudang_asal'; end if;
  if p.status <> 'dibuat' then raise exception 'sudah_diterima'; end if;
  select * into l from layanan where id = p.layanan_id;
  h := hitung_ongkir(z.asal, z.tujuan, l.nama, p_koli, p.biaya_asuransi > 0, p.nilai_barang);
  if not (h->>'ok')::boolean then raise exception '%', h->>'alasan'; end if;
  for k in select * from jsonb_array_elements(p_koli) loop
    update koli set berat_final = (k->>'berat')::numeric, panjang = (k->>'p')::int, lebar = (k->>'l')::int, tinggi = (k->>'t')::int,
      status = case when p_lunas then 'diterima_asal' else status end
    where pengiriman_id = p.id and no = (k->>'no')::int;
  end loop;
  update pengiriman set ongkir_final = (h->>'total')::int, lunas = p_lunas where id = p.id;
  select nama into v_gudang from gudang where id = p.gudang_asal_id;
  if p_lunas then perform sinkron_status_resi(p.id, coalesce(v_gudang, z.asal), 'Ditimbang ' || (h->>'berat_tertagih') || ' kg'); end if;
  perform log_aktivitas('Menerima barang', p.resi, jsonb_build_object('ongkir_final', h->>'total'));
  return jsonb_build_object('resi', p.resi, 'ongkir_final', (h->>'total')::int, 'selisih', (h->>'total')::int - p.estimasi_ongkir,
    'label', (select jsonb_agg(label order by no) from koli where pengiriman_id = p.id));
end $$;

create or replace function public.scan_koli(p_label text, p_aksi status_cargo, p_jadwal uuid default null, p_tanggal date default null, p_lokasi text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare k koli; v_sebelum status_cargo; v_bagasi int; v_terpakai numeric; v_berat numeric; v_lok text;
begin
  if not has_role('admin_cargo') then raise exception 'akses_ditolak'; end if;
  if p_aksi in ('dibuat','diterima','batal','diterima_asal') then raise exception 'aksi_tidak_lewat_scan'; end if;
  select * into k from koli where label = upper(trim(p_label)) for update;
  if not found then return jsonb_build_object('ok', false, 'pesan', 'Label tidak dikenali'); end if;
  if k.status = p_aksi then return jsonb_build_object('ok', false, 'pesan', 'Koli ini sudah berstatus ' || label_status(p_aksi)); end if;
  v_sebelum := (array['dibuat','diterima_asal','dalam_perjalanan','tiba_tujuan','siap_diambil','diterima']::status_cargo[])[urutan_status(p_aksi) - 1];
  if k.status <> v_sebelum then
    return jsonb_build_object('ok', false, 'pesan', 'Status belum bisa diubah: koli ini belum ' || label_status(v_sebelum)); end if;
  v_berat := coalesce(k.berat_final, k.berat);
  if p_aksi = 'dalam_perjalanan' then
    if p_jadwal is null or p_tanggal is null then raise exception 'jadwal_wajib'; end if;
    select a.bagasi_kg into v_bagasi from jadwal j join armada a on a.id = j.armada_id where j.id = p_jadwal;
    select coalesce(sum(coalesce(berat_final, berat)), 0) into v_terpakai from koli where jadwal_id = p_jadwal and tanggal_muat = p_tanggal;
    if v_terpakai + v_berat > v_bagasi then
      return jsonb_build_object('ok', false, 'pesan', 'Bagasi jadwal ini penuh. Sisa kapasitas ' || trim(to_char(v_bagasi - v_terpakai, 'FM9990.##')) || ' kg.', 'sisa', v_bagasi - v_terpakai); end if;
    update koli set status = p_aksi, jadwal_id = p_jadwal, tanggal_muat = p_tanggal where id = k.id;
    select 'Dimuat ke bus ' || to_char(j.jam, 'HH24:MI') || ' ' || r.asal || ' → ' || r.tujuan || ' (' || a.nopol || ')' into v_lok
      from jadwal j join rute r on r.id = j.rute_id join armada a on a.id = j.armada_id where j.id = p_jadwal;
  else
    update koli set status = p_aksi where id = k.id;
    v_lok := p_lokasi;
  end if;
  insert into status_log (pengiriman_id, koli_id, status, lokasi, oleh) values (k.pengiriman_id, k.id, p_aksi, v_lok, auth.uid());
  perform sinkron_status_resi(k.pengiriman_id, v_lok);
  return jsonb_build_object('ok', true, 'pesan', k.label || ' · ' || label_status(p_aksi), 'berat', v_berat,
    'sisa', case when p_aksi = 'dalam_perjalanan' then v_bagasi - v_terpakai - v_berat end);
end $$;

create or replace function public.selesaikan_pengiriman(p_resi text, p_nama text, p_foto text default null, p_ttd text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p pengiriman;
begin
  if not has_role('admin_cargo') then raise exception 'akses_ditolak'; end if;
  if p_foto is null and p_ttd is null then raise exception 'bukti_wajib'; end if;
  if coalesce(trim(p_nama), '') = '' then raise exception 'nama_penerima_wajib'; end if;
  select * into p from pengiriman where resi = upper(p_resi) for update;
  if not found then raise exception 'resi_tidak_ada'; end if;
  if p.status <> 'siap_diambil' then raise exception 'belum_siap_diambil'; end if;
  insert into bukti_terima (pengiriman_id, foto_path, ttd_path, nama_penerima, oleh) values (p.id, p_foto, p_ttd, trim(p_nama), auth.uid());
  update koli set status = 'diterima' where pengiriman_id = p.id;
  perform sinkron_status_resi(p.id, (select tujuan from zona where id = p.zona_id));
  return jsonb_build_object('resi', p.resi, 'status', 'diterima', 'email', p.pengirim_email);
end $$;

create or replace function public.koreksi_status_koli(p_label text, p_status status_cargo, p_alasan text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k koli; v_min status_cargo;
begin
  if not is_super() then raise exception 'akses_ditolak'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'alasan_wajib'; end if;
  select * into k from koli where label = upper(p_label) for update;
  if not found then raise exception 'label_tidak_ada'; end if;
  update koli set status = p_status where id = k.id;
  select status into v_min from koli where pengiriman_id = k.pengiriman_id order by urutan_status(status) limit 1;
  update pengiriman set status = v_min where id = k.pengiriman_id;
  insert into status_log (pengiriman_id, koli_id, status, catatan, oleh) values (k.pengiriman_id, k.id, p_status, 'Koreksi: ' || p_alasan, auth.uid());
  perform log_aktivitas('Mengoreksi status cargo', k.label, jsonb_build_object('ke', p_status, 'alasan', p_alasan));
  return jsonb_build_object('label', k.label, 'status', p_status);
end $$;

-- ===== Dashboard (L-09) =====
create or replace function public.ringkasan_dashboard(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s settings;
begin
  if my_role() is null then raise exception 'akses_ditolak'; end if;
  select * into s from settings where id = 1;
  return jsonb_build_object(
    'pendapatan_hari_ini', (select coalesce(sum(p.subtotal - p.potongan), 0) from pesanan p join jadwal j on j.id = p.jadwal_id join rute r on r.id = j.rute_id
        where p.status = 'lunas' and (p.diverifikasi_at at time zone 'Asia/Jakarta')::date = p_tanggal and dalam_cakupan(r.asal)),
    'tiket_terjual', (select count(*) from pesanan_kursi k join pesanan p on p.id = k.pesanan_id join jadwal j on j.id = p.jadwal_id join rute r on r.id = j.rute_id
        where p.status = 'lunas' and k.aktif and (p.diverifikasi_at at time zone 'Asia/Jakarta')::date = p_tanggal and dalam_cakupan(r.asal)),
    'menunggu_verifikasi', (select count(*) from pesanan where status = 'menunggu_verifikasi'),
    'lewat_sla', (select count(*) from pesanan where status = 'menunggu_verifikasi' and bukti_at < now() - make_interval(mins => s.sla_verifikasi_menit)),
    'median_verifikasi_menit', (select round(percentile_cont(0.5) within group (order by extract(epoch from diverifikasi_at - bukti_at) / 60)::numeric, 0)
        from pesanan where status = 'lunas' and bukti_at is not null and diverifikasi_at > now() - interval '7 days'),
    'pendapatan_14_hari', (select jsonb_agg(jsonb_build_object('tanggal', d::date, 'nilai', coalesce((select sum(subtotal - potongan) from pesanan
        where status = 'lunas' and (diverifikasi_at at time zone 'Asia/Jakarta')::date = d::date), 0)) order by d)
        from generate_series((p_tanggal - 13)::timestamp, p_tanggal::timestamp, interval '1 day') d),
    'okupansi', (select jsonb_agg(jsonb_build_object('jadwal', to_char(j.jam, 'HH24:MI') || ' ' || r.kode,
        'persen', round(100.0 * (select count(*) from seat_status ss where ss.jadwal_id = j.id and ss.tanggal = p_tanggal and ss.status = 'taken') / jsonb_array_length(l.kursi))) order by j.jam)
        from jadwal j join rute r on r.id = j.rute_id join armada a on a.id = j.armada_id join layout_kursi l on l.id = a.layout_id
        where j.aktif and extract(isodow from p_tanggal)::smallint = any(j.hari) and dalam_cakupan(r.asal)),
    'resi_dalam_perjalanan', (select count(*) from pengiriman where status = 'dalam_perjalanan'),
    'resi_lewat_estimasi', (select count(*) from pengiriman where status not in ('diterima','batal') and estimasi_tiba < p_tanggal),
    'peringatan', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('jenis', 'verifikasi', 'kode', kode, 'menit', floor(extract(epoch from now() - bukti_at) / 60)) x
        from pesanan where status = 'menunggu_verifikasi' and bukti_at < now() - make_interval(mins => s.sla_verifikasi_menit)
        union all
        select jsonb_build_object('jenis', 'cargo', 'kode', resi, 'estimasi', estimasi_tiba)
        from pengiriman where status not in ('diterima','batal') and estimasi_tiba < p_tanggal) t), '[]'::jsonb));
end $$;

-- ===== Kedaluwarsa otomatis (dijalankan pg_cron tiap menit) =====
create or replace function public.kedaluwarsa_otomatis() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with ex as (
    update pesanan set status = 'kedaluwarsa' where status in ('menunggu_bayar','ditolak') and batas_bayar < now() returning id)
  select count(*) into v_n from ex;
  update pesanan_kursi k set aktif = false from pesanan p where p.id = k.pesanan_id and p.status = 'kedaluwarsa' and k.aktif;
  delete from seat_status ss using pesanan p where ss.pesanan_id = p.id and p.status = 'kedaluwarsa';
  delete from seat_status where status = 'held' and expires_at < now();
  return v_n;
end $$;

