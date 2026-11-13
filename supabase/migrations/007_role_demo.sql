alter type app_role add value if not exists 'demo';
-- (jalankan terpisah dari bagian di bawah)
create or replace function public.has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('superadmin', 'demo') or my_role() = r, false)
$$;
create or replace function public.staff_kota() returns text[]
language sql stable security definer set search_path = public as $$
  select case when my_role() in ('superadmin', 'demo') then null
    else coalesce((select array_agg(distinct b.kota) from profiles p join branch b on b.id = any(p.branch_ids) where p.id = auth.uid()), '{}') end
$$;
drop policy if exists publik_baca on rekening; create policy publik_baca on rekening for select using (tampil or my_role() in ('superadmin','demo'));
drop policy if exists publik_baca on konten; create policy publik_baca on konten for select using (status = 'terbit' or my_role() in ('superadmin','demo'));
drop policy if exists publik_baca on rating; create policy publik_baca on rating for select using (tampil or my_role() in ('superadmin','demo'));
