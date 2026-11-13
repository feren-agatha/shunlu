import { createClient } from 'jsr:@supabase/supabase-js@2';

// Kelola user back office per tenant (PO). Pemanggil harus punya izin `user`;
// user baru selalu masuk ke tenant yang sedang dikelola pemanggil.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'metode_tidak_didukung' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = req.headers.get('Authorization') ?? '';
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'belum_login' }, 401);
    const { data: boleh } = await caller.rpc('punya_izin', { p: 'user' });
    if (!boleh) return json({ error: 'akses_ditolak' }, 403);
    const { data: tenant } = await caller.rpc('tenant_staf');
    if (!tenant) return json({ error: 'tenant_tidak_ada' }, 403);

    const admin = createClient(url, svc, { auth: { persistSession: false } });
    const body = await req.json();

    if (body.aksi === 'buat') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const nama = String(body.nama ?? '').trim();
      if (!nama) return json({ error: 'nama_wajib' }, 400);
      if (!emailOk(email)) return json({ error: 'email_tidak_valid' }, 400);
      if (password.length < 8) return json({ error: 'password_min_8' }, 400);
      if (!body.hak_akses_id) return json({ error: 'hak_akses_wajib' }, 400);
      const { data: ha } = await admin.from('hak_akses').select('id').eq('id', body.hak_akses_id).eq('tenant_id', tenant).maybeSingle();
      if (!ha) return json({ error: 'hak_akses_beda_tenant' }, 400);
      const branchIds = Array.isArray(body.branch_ids) ? body.branch_ids : [];
      if (branchIds.length) {
        const { count } = await admin.from('branch').select('id', { count: 'exact', head: true }).in('id', branchIds).eq('tenant_id', tenant);
        if (count !== branchIds.length) return json({ error: 'akses_ditolak' }, 400);
      }
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nama } });
      if (error) return json({ error: /already/i.test(error.message) ? 'email_sudah_terdaftar' : error.message }, 400);
      const { error: e2 } = await admin.from('profiles').update({
        nama, email, tenant_id: tenant, hak_akses_id: body.hak_akses_id, branch_ids: branchIds, aktif: true,
      }).eq('id', data.user.id);
      if (e2) return json({ error: e2.message }, 400);
      await admin.from('activity_log').insert({ tenant_id: tenant, user_id: user.id, aksi: 'Membuat user', objek: email });
      return json({ ok: true, id: data.user.id });
    }

    if (body.aksi === 'set_password') {
      const password = String(body.password ?? '');
      if (!body.id) return json({ error: 'user_wajib' }, 400);
      if (password.length < 8) return json({ error: 'password_min_8' }, 400);
      const { data: target } = await admin.from('profiles').select('id,tenant_id,platform_admin').eq('id', body.id).maybeSingle();
      if (!target || target.tenant_id !== tenant || (target.platform_admin && target.id !== user.id)) return json({ error: 'akses_ditolak' }, 403);
      const { data: u, error } = await admin.auth.admin.updateUserById(body.id, { password });
      if (error) return json({ error: error.message }, 400);
      await admin.from('activity_log').insert({ tenant_id: tenant, user_id: user.id, aksi: 'Mengatur ulang password', objek: u.user?.email ?? body.id });
      return json({ ok: true });
    }

    return json({ error: 'aksi_tidak_dikenal' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
