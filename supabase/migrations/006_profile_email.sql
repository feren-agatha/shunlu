alter table profiles add column if not exists email text;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nama, email) values (new.id, coalesce(new.raw_user_meta_data->>'nama', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
