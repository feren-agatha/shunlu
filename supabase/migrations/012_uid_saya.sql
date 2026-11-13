-- Fungsi milik nl_fungsi tidak punya akses ke schema auth; pakai pembungkus uid_saya().
create or replace function uid_saya() returns uuid language sql stable security definer set search_path = public as $$ select auth.uid() $$;
grant execute on function uid_saya() to nl_fungsi, anon, authenticated;
do $$
declare f record;
begin
  for f in select oid from pg_proc where proowner = 'nl_fungsi'::regrole and pg_get_functiondef(oid) like '%auth.uid()%' loop
    execute replace(pg_get_functiondef(f.oid), 'auth.uid()', 'uid_saya()');
  end loop;
end $$;
revoke execute on function pilih_tenant(uuid), buat_tenant(text, text, text[]) from public, anon;
grant execute on function pilih_tenant(uuid), buat_tenant(text, text, text[]) to authenticated;
