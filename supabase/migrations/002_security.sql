-- Peran, RLS, storage, realtime
create or replace function public.my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and aktif
$$;

create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'superadmin', false)
$$;

create or replace function public.has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'superadmin' or my_role() = r, false)
$$;

-- Kota cakupan admin (superadmin: null = semua kota)
create or replace function public.staff_kota() returns text[]
language sql stable security definer set search_path = public as $$
  select case when my_role() = 'superadmin' then null
    else coalesce((select array_agg(distinct b.kota) from profiles p join branch b on b.id = any(p.branch_ids) where p.id = auth.uid()), '{}') end
$$;

create or replace function public.dalam_cakupan(kota text) returns boolean
language sql stable security definer set search_path = public as $$
  select staff_kota() is null or kota = any(staff_kota())
$$;

-- Profil otomatis untuk user baru (tanpa peran sampai diberi Superadmin)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nama) values (new.id, coalesce(new.raw_user_meta_data->>'nama', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Aktifkan RLS di semua tabel
do $$ declare t text; begin
  foreach t in array array['settings','rekening','branch','profiles','rute','layout_kursi','armada','driver','jadwal','aturan_harga','promo','seat_status','pesanan','pesanan_kursi','mutasi','zona','layanan','tarif','gudang','asuransi','pengiriman','koli','status_log','bukti_terima','konten','rating','activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Baca publik
create policy publik_baca on settings for select using (true);
create policy publik_baca on rekening for select using (tampil or is_super());
create policy publik_baca on branch for select using (aktif or my_role() is not null);
create policy publik_baca on rute for select using (aktif or my_role() is not null);
create policy publik_baca on layout_kursi for select using (true);
create policy publik_baca on armada for select using (true);
create policy publik_baca on jadwal for select using (aktif or my_role() is not null);
create policy publik_baca on zona for select using (aktif or my_role() is not null);
create policy publik_baca on layanan for select using (true);
create policy publik_baca on tarif for select using (true);
create policy publik_baca on gudang for select using (aktif or my_role() is not null);
create policy publik_baca on asuransi for select using (aktif or my_role() is not null);
create policy publik_baca on seat_status for select using (true);
create policy publik_baca on konten for select using (status = 'terbit' or is_super());
create policy publik_baca on rating for select using (tampil or is_super());

-- Staf saja
create policy staf_baca on driver for select using (my_role() is not null);
create policy staf_baca on aturan_harga for select using (my_role() is not null);
create policy staf_baca on promo for select using (my_role() is not null);
create policy diri_atau_super on profiles for select using (id = auth.uid() or is_super());
create policy super_baca on activity_log for select using (is_super());

create policy tiket_baca on pesanan for select using (
  has_role('admin_tiket') and exists (select 1 from jadwal j join rute r on r.id = j.rute_id where j.id = pesanan.jadwal_id and dalam_cakupan(r.asal))
);
create policy tiket_baca on pesanan_kursi for select using (
  has_role('admin_tiket') and exists (select 1 from jadwal j join rute r on r.id = j.rute_id where j.id = pesanan_kursi.jadwal_id and dalam_cakupan(r.asal))
);
create policy tiket_baca on mutasi for select using (has_role('admin_tiket'));

create policy cargo_baca on pengiriman for select using (
  has_role('admin_cargo') and exists (select 1 from zona z where z.id = pengiriman.zona_id and (dalam_cakupan(z.asal) or dalam_cakupan(z.tujuan)))
);
create policy cargo_baca on koli for select using (exists (select 1 from pengiriman p where p.id = koli.pengiriman_id));
create policy cargo_baca on status_log for select using (exists (select 1 from pengiriman p where p.id = status_log.pengiriman_id));
create policy cargo_baca on bukti_terima for select using (exists (select 1 from pengiriman p where p.id = bukti_terima.pengiriman_id));

-- Tulis master: Superadmin (transaksi hanya lewat fungsi)
do $$ declare t text; begin
  foreach t in array array['settings','rekening','branch','rute','layout_kursi','armada','driver','jadwal','aturan_harga','promo','zona','layanan','tarif','gudang','asuransi','konten','rating'] loop
    execute format('create policy super_tulis on public.%I for insert with check (is_super())', t);
    execute format('create policy super_ubah on public.%I for update using (is_super()) with check (is_super())', t);
    execute format('create policy super_hapus on public.%I for delete using (is_super())', t);
  end loop;
end $$;
create policy super_ubah on profiles for update using (is_super()) with check (is_super());

-- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('bukti-transfer', 'bukti-transfer', false, 5242880, array['image/jpeg','image/png','application/pdf']),
  ('bukti-terima', 'bukti-terima', false, 5242880, array['image/jpeg','image/png']),
  ('media', 'media', true, 2097152, array['image/jpeg','image/png','image/svg+xml','image/webp'])
on conflict (id) do nothing;

create policy bukti_unggah_publik on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'bukti-transfer');
create policy bukti_baca_staf on storage.objects for select to authenticated
  using (bucket_id = 'bukti-transfer' and public.has_role('admin_tiket'));
create policy terima_tulis_staf on storage.objects for insert to authenticated
  with check (bucket_id = 'bukti-terima' and public.has_role('admin_cargo'));
create policy terima_baca_staf on storage.objects for select to authenticated
  using (bucket_id = 'bukti-terima' and public.has_role('admin_cargo'));
create policy media_tulis_super on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_super());

-- Realtime peta kursi
alter publication supabase_realtime add table public.seat_status;
