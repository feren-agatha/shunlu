revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.cari_jadwal(text, text, date, int), public.peta_kursi(uuid, date, uuid), public.kunci_kursi(uuid, date, text, uuid),
  public.lepas_kursi(uuid, date, text, uuid), public.buat_pesanan(uuid, date, uuid, jsonb, text, text, text, text, text, text),
  public.unggah_bukti(text, text, text), public.cek_pesanan(text, text), public.hitung_ongkir(text, text, text, jsonb, boolean, bigint),
  public.buat_pengiriman(text, text, text, jsonb, boolean, bigint, jsonb, jsonb, text, text), public.lacak_resi(text), public.harga_kursi(uuid, date, text),
  public.my_role(), public.is_super(), public.has_role(app_role), public.staff_kota(), public.dalam_cakupan(text)
to anon;
revoke execute on function public.kedaluwarsa_otomatis(), public.sinkron_status_resi(uuid, text, text), public.log_aktivitas(text, text, jsonb),
  public.gen_kode(int), public.handle_new_user() from authenticated;
create extension if not exists pg_cron;
select cron.schedule('shunlu-kedaluwarsa', '* * * * *', 'select public.kedaluwarsa_otomatis()');
