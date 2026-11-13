-- Hak akses dan branch yang dipasang ke user harus milik PO (tenant) yang sama dengan user tersebut.
create or replace function cek_hak_akses_tenant() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.hak_akses_id is not null and not exists (select 1 from hak_akses where id = new.hak_akses_id and tenant_id = new.tenant_id) then
    raise exception 'hak_akses_beda_tenant';
  end if;
  if new.branch_ids is not null and exists (select 1 from unnest(new.branch_ids) b where not exists (select 1 from branch where id = b and tenant_id = new.tenant_id)) then
    raise exception 'akses_ditolak';
  end if;
  return new;
end $$;
drop trigger if exists jaga_hak_akses_tenant on profiles;
create trigger jaga_hak_akses_tenant before insert or update of hak_akses_id, branch_ids, tenant_id on profiles
  for each row execute function cek_hak_akses_tenant();
