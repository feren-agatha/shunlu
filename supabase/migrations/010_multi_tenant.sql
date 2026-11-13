-- Nusalaju — multi-tenant per PO bus
-- Setiap PO (tenant) punya data sendiri. Situs customer mengirim header x-tenant (slug),
-- back office memakai tenant dari profil staf. Platform admin bisa berpindah tenant.

create table tenant (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,29}$'),
  nama text not null,
  domain text[] not null default '{}',
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
insert into tenant (slug, nama) values ('nusalaju', 'Nusalaju');

-- 1. Kolom tenant_id di semua tabel data, data lama masuk tenant Nusalaju
do $$
declare t text; v uuid := (select id from tenant where slug = 'nusalaju');
begin
  foreach t in array array['settings','rekening','branch','profiles','rute','layout_kursi','armada','driver','jadwal','aturan_harga','promo',
    'seat_status','pesanan','pesanan_kursi','mutasi','zona','layanan','tarif','gudang','asuransi','pengiriman','koli','status_log',
    'bukti_terima','konten','rating','activity_log','hak_akses'] loop
    execute format('alter table %I add column tenant_id uuid references tenant on delete cascade', t);
    execute format('update %I set tenant_id = %L', t, v);
    execute format('alter table %I alter column tenant_id set not null', t);
    execute format('create index %I on %I (tenant_id)', t || '_tenant_idx', t);
  end loop;
end $$;

alter table profiles add column platform_admin boolean not null default false,
  add column tenant_aktif uuid references tenant on delete set null;
update profiles set platform_admin = true where lower(email) = 'ferenagatha0612@gmail.com';

-- 2. Fungsi konteks tenant
create or replace function tenant_staf() returns uuid language sql stable security definer set search_path = public as $$
  select case when p.platform_admin then coalesce(p.tenant_aktif, p.tenant_id) else p.tenant_id end
  from profiles p where p.id = auth.uid()
$$;

create or replace function tenant_ini() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    case when auth.uid() is null
      then (select id from tenant where aktif and slug = nullif(current_setting('request.headers', true), '')::json ->> 'x-tenant')
      else tenant_staf() end,
    (select id from tenant where slug = 'nusalaju'))
$$;

create or replace function is_platform() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and aktif and platform_admin)
$$;

do $$
declare t text;
begin
  foreach t in array array['settings','rekening','branch','profiles','rute','layout_kursi','armada','driver','jadwal','aturan_harga','promo',
    'seat_status','pesanan','pesanan_kursi','mutasi','zona','layanan','tarif','gudang','asuransi','pengiriman','koli','status_log',
    'bukti_terima','konten','rating','activity_log','hak_akses'] loop
    execute format('alter table %I alter column tenant_id set default tenant_ini()', t);
  end loop;
end $$;

-- 3. Unik per tenant
alter table branch drop constraint branch_nama_key, add constraint branch_nama_key unique (tenant_id, nama);
alter table rute drop constraint rute_kode_key, add constraint rute_kode_key unique (tenant_id, kode);
alter table layout_kursi drop constraint layout_kursi_nama_key, add constraint layout_kursi_nama_key unique (tenant_id, nama);
alter table jadwal drop constraint jadwal_kode_key, add constraint jadwal_kode_key unique (tenant_id, kode);
alter table promo drop constraint promo_kode_key, add constraint promo_kode_key unique (tenant_id, kode);
alter table zona drop constraint zona_kode_key, add constraint zona_kode_key unique (tenant_id, kode);
alter table layanan drop constraint layanan_nama_key, add constraint layanan_nama_key unique (tenant_id, nama);
alter table gudang drop constraint gudang_nama_key, add constraint gudang_nama_key unique (tenant_id, nama);
alter table konten drop constraint konten_slug_key, add constraint konten_slug_key unique (tenant_id, slug);
alter table hak_akses drop constraint hak_akses_nama_key, add constraint hak_akses_nama_key unique (tenant_id, nama);
drop index asuransi_satu_aktif;
create unique index asuransi_satu_aktif on asuransi (tenant_id) where aktif;
alter table settings drop constraint settings_id_check;
create sequence settings_id_seq owned by settings.id;
select setval('settings_id_seq', (select max(id) from settings));
alter table settings alter column id set default nextval('settings_id_seq'), add constraint settings_tenant_key unique (tenant_id);

-- 4. Izin: platform admin punya semua izin
create or replace function punya_izin(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles pr where pr.id = auth.uid() and pr.aktif and pr.platform_admin)
      or exists (select 1 from profiles pr join hak_akses h on h.id = pr.hak_akses_id where pr.id = auth.uid() and pr.aktif and p = any(h.izin))
$$;
create or replace function staf() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and aktif and (hak_akses_id is not null or platform_admin))
$$;
create or replace function izin_saya() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nama', case when pr.platform_admin then 'Superadmin platform' else h.nama end,
    'izin', case when pr.platform_admin then to_jsonb(array['dashboard','verifikasi','rekonsiliasi','manifest','terima','scan','serah','laporan',
      'master_lihat','master_ubah','pengaturan_lihat','pengaturan_ubah','konten_lihat','konten_ubah','user','log','semua_branch']) else to_jsonb(h.izin) end,
    'profil', pr.nama, 'platform', pr.platform_admin,
    'tenant', (select jsonb_build_object('id', t.id, 'slug', t.slug, 'nama', t.nama) from tenant t where t.id = tenant_staf()))
  from profiles pr left join hak_akses h on h.id = pr.hak_akses_id
  where pr.id = auth.uid() and pr.aktif and (pr.platform_admin or h.id is not null)
$$;
create or replace function cek_pengelola_terakhir() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles p join hak_akses h on h.id = p.hak_akses_id
                 where p.aktif and 'user' = any(h.izin) and p.id <> old.id and p.tenant_id = old.tenant_id)
     and not old.platform_admin
     and exists (select 1 from hak_akses where id = old.hak_akses_id and 'user' = any(izin)) and old.aktif
     and (not new.aktif or new.hak_akses_id is distinct from old.hak_akses_id
          and not exists (select 1 from hak_akses where id = new.hak_akses_id and 'user' = any(izin))) then
    raise exception 'pengelola_user_terakhir';
  end if;
  return new;
end $$;

-- 5. RLS: semua kebijakan lama dibatasi ke tenant aktif
do $$
declare r record;
begin
  for r in select * from pg_policies where schemaname = 'public'
    and tablename in ('settings','rekening','branch','rute','layout_kursi','armada','driver','jadwal','aturan_harga','promo',
      'pesanan','pesanan_kursi','mutasi','zona','layanan','tarif','gudang','asuransi','pengiriman','koli','status_log',
      'bukti_terima','konten','rating','activity_log','hak_akses') loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
    execute format('create policy %I on %I for %s to %s %s %s', r.policyname, r.tablename, r.cmd, array_to_string(r.roles, ','),
      case when r.qual is not null then format('using (tenant_id = tenant_ini() and (%s))', r.qual) else '' end,
      case when r.with_check is not null then format('with check (tenant_id = tenant_ini() and (%s))', r.with_check) else '' end);
  end loop;
end $$;
-- seat_status tetap terbaca publik (dipakai realtime peta kursi; tidak berisi data pribadi)

drop policy diri_atau_user on profiles;
drop policy user_ubah on profiles;
create policy diri_atau_user on profiles for select using (id = auth.uid() or (tenant_id = tenant_ini() and punya_izin('user')));
create policy user_ubah on profiles for update using (tenant_id = tenant_ini() and punya_izin('user')) with check (tenant_id = tenant_ini() and punya_izin('user'));

alter table tenant enable row level security;
create policy publik_baca on tenant for select using (aktif or is_platform());
create policy platform_tulis on tenant for insert with check (is_platform());
create policy platform_ubah on tenant for update using (is_platform()) with check (is_platform());
grant select on tenant to anon, authenticated;
grant insert, update on tenant to authenticated;

-- Storage: staf hanya membuka bukti milik tenantnya
drop policy bukti_baca_staf on storage.objects;
create policy bukti_baca_staf on storage.objects for select to authenticated using (bucket_id = 'bukti-transfer' and has_role('admin_tiket')
  and exists (select 1 from public.pesanan p where p.kode = split_part(name, '/', 1)));
drop policy terima_baca_staf on storage.objects;
create policy terima_baca_staf on storage.objects for select to authenticated using (bucket_id = 'bukti-terima' and has_role('admin_cargo')
  and exists (select 1 from public.pengiriman p where p.resi = split_part(name, '/', 1)));
drop policy terima_tulis_staf on storage.objects;
create policy terima_tulis_staf on storage.objects for insert to authenticated with check (bucket_id = 'bukti-terima' and has_role('admin_cargo')
  and exists (select 1 from public.pengiriman p where p.resi = split_part(name, '/', 1)));
