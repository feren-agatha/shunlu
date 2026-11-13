-- Fungsi bisnis berjalan sebagai role nl_fungsi (tanpa bypass RLS),
-- sehingga setiap query di dalamnya otomatis terbatas ke tenant aktif.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'nl_fungsi') then create role nl_fungsi nologin; end if;
end $$;
grant nl_fungsi to postgres;
grant usage, create on schema public to nl_fungsi;
grant usage on schema auth to nl_fungsi;
grant all on all tables in schema public to nl_fungsi;
grant all on all sequences in schema public to nl_fungsi;
grant execute on all functions in schema public to nl_fungsi;
alter default privileges in schema public grant all on tables to nl_fungsi;

do $$
declare t text;
begin
  foreach t in array array['settings','rekening','branch','profiles','rute','layout_kursi','armada','driver','jadwal','aturan_harga','promo',
    'seat_status','pesanan','pesanan_kursi','mutasi','zona','layanan','tarif','gudang','asuransi','pengiriman','koli','status_log',
    'bukti_terima','konten','rating','activity_log','hak_akses'] loop
    execute format('create policy fungsi_tenant on %I for all to nl_fungsi using (tenant_id = tenant_ini()) with check (tenant_id = tenant_ini())', t);
  end loop;
end $$;
create policy fungsi_baca on tenant for select to nl_fungsi using (true);

do $$
declare f record; d text;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and p.proname in ('buat_pengiriman','buat_pesanan','cari_jadwal','cek_pesanan','daftar_verifikasi','harga_kursi','hitung_ongkir',
      'impor_mutasi','koreksi_status_koli','kunci_kursi','lacak_resi','lepas_kursi','log_aktivitas','manifest','peta_kursi',
      'ringkasan_dashboard','scan_boarding','scan_koli','selesaikan_pengiriman','setujui_mutasi_cocok','sinkron_status_resi',
      'terima_barang','tutup_boarding','unggah_bukti','verifikasi_pembayaran') loop
    d := pg_get_functiondef(f.oid);
    if position('from settings where id = 1' in d) > 0 then
      execute replace(d, 'from settings where id = 1', 'from settings where tenant_id = tenant_ini()');
    end if;
    execute format('alter function %s owner to nl_fungsi', f.oid::regprocedure);
  end loop;
end $$;

-- Situs customer: cari tenant dari slug (?po=) atau domain
create or replace function tenant_info(p_slug text default null, p_host text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('id', id, 'slug', slug, 'nama', nama) from tenant
      where aktif and (slug = lower(p_slug) or lower(p_host) = any(domain))
      order by (slug = lower(p_slug)) desc nulls last limit 1),
    (select jsonb_build_object('id', id, 'slug', slug, 'nama', nama) from tenant where slug = 'nusalaju'))
$$;

-- Platform admin: pindah tenant aktif
create or replace function pilih_tenant(p_tenant uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_platform() then raise exception 'akses_ditolak'; end if;
  if not exists (select 1 from tenant where id = p_tenant) then raise exception 'tenant_tidak_ada'; end if;
  update profiles set tenant_aktif = p_tenant where id = auth.uid();
end $$;

-- Platform admin: buat tenant baru beserta pengaturan, hak akses, layout kursi, dan layanan dasar
create or replace function buat_tenant(p_slug text, p_nama text, p_domain text[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; src uuid := (select id from tenant where slug = 'nusalaju');
begin
  if not is_platform() then raise exception 'akses_ditolak'; end if;
  if coalesce(trim(p_nama), '') = '' then raise exception 'nama_wajib'; end if;
  if lower(p_slug) !~ '^[a-z0-9][a-z0-9-]{1,29}$' then raise exception 'slug_tidak_valid'; end if;
  if exists (select 1 from tenant where slug = lower(p_slug)) then raise exception 'slug_sudah_dipakai'; end if;
  insert into tenant (slug, nama, domain) values (lower(p_slug), trim(p_nama), coalesce(p_domain, '{}')) returning id into v;
  insert into settings (tenant_id, nama_brand, nama_perusahaan) values (v, trim(p_nama), trim(p_nama));
  insert into hak_akses (tenant_id, nama, deskripsi, izin, sistem) select v, nama, deskripsi, izin, sistem from hak_akses where tenant_id = src and sistem;
  insert into layout_kursi (tenant_id, nama, grid, kursi) select v, nama, grid, kursi from layout_kursi where tenant_id = src;
  insert into layanan (tenant_id, nama, janji, batas_serah, aktif) select v, nama, janji, batas_serah, aktif from layanan where tenant_id = src;
  insert into activity_log (tenant_id, user_id, aksi, objek) values (v, auth.uid(), 'Membuat tenant', p_nama);
  return v;
end $$;

revoke execute on function pilih_tenant(uuid), buat_tenant(text, text, text[]) from anon;
grant execute on function tenant_info(text, text) to anon, authenticated;
grant execute on function tenant_staf(), tenant_ini(), is_platform() to anon, authenticated;

-- Warna merek Nusalaju mengikuti tema baru
update settings set warna_brand = '#7A2BF0' where tenant_id = (select id from tenant where slug = 'nusalaju');
