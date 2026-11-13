// Shunlu — back office
const A = { user: null, role: null, profil: null, view: 'dashboard', stopKamera: null };
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MENU = [
  { id: 'dashboard', label: 'Dashboard', roles: ['superadmin', 'demo', 'admin_tiket', 'admin_cargo'] },
  { grup: 'Ticketing', roles: ['superadmin', 'demo', 'admin_tiket'] },
  { id: 'verifikasi', label: 'Verifikasi pembayaran', roles: ['superadmin', 'demo', 'admin_tiket'] },
  { id: 'rekonsiliasi', label: 'Rekonsiliasi mutasi', roles: ['superadmin', 'demo', 'admin_tiket'] },
  { id: 'manifest', label: 'Manifest & boarding', roles: ['superadmin', 'demo', 'admin_tiket'] },
  { grup: 'Cargo', roles: ['superadmin', 'demo', 'admin_cargo'] },
  { id: 'terima', label: 'Terima barang', roles: ['superadmin', 'demo', 'admin_cargo'] },
  { id: 'scan', label: 'Scan status koli', roles: ['superadmin', 'demo', 'admin_cargo'] },
  { id: 'serah', label: 'Serah terima', roles: ['superadmin', 'demo', 'admin_cargo'] },
  { grup: 'Master data', roles: ['superadmin', 'demo'] },
  { id: 'm-tiket', label: 'Master Ticketing', roles: ['superadmin', 'demo'] },
  { id: 'm-cargo', label: 'Master Cargo', roles: ['superadmin', 'demo'] },
  { id: 'layout', label: 'Layout kursi', roles: ['superadmin', 'demo'] },
  { id: 'laporan', label: 'Laporan', roles: ['superadmin', 'demo', 'admin_tiket', 'admin_cargo'] },
  { grup: 'Pengaturan', roles: ['superadmin', 'demo'] },
  { id: 'pengaturan', label: 'Pengaturan umum', roles: ['superadmin', 'demo'] },
  { id: 'konten', label: 'CMS konten', roles: ['superadmin', 'demo'] },
  { id: 'user', label: 'User & hak akses', roles: ['superadmin'] },
  { id: 'log', label: 'Log aktivitas', roles: ['superadmin'] }
];
const boleh = id => { const m = MENU.find(x => x.id === id); return m && m.roles.includes(A.role); };

function shell(judul, inner) {
  $('#app').innerHTML = `<div class="a-wrap"><nav class="a-side no-print" aria-label="Menu back office">${logoHtml('admin.html')}
    ${MENU.filter(m => m.roles.includes(A.role)).map(m => m.grup ? `<h5>${m.grup}</h5>` : `<a href="#${m.id}" class="${A.view === m.id ? 'on' : ''}">${m.label}${m.id === 'verifikasi' ? '<span class="cnt" id="cnt-v" hidden></span>' : ''}</a>`).join('')}
    <a href="#keluar" style="margin-top:auto">Keluar</a></nav>
    <div class="a-main"><div class="a-top no-print"><h1>${esc(judul)}</h1><span class="muted" style="font-size:13px">${esc(A.profil.nama || '')} · ${({ superadmin: 'Superadmin', admin_tiket: 'Admin Ticketing', admin_cargo: 'Admin Cargo', demo: 'Akun demo' })[A.role]}</span></div>
    <div class="a-content">${A.role === 'demo' ? '<div class="banner info no-print"><div><b>Akun demo.</b> Anda bisa mencoba verifikasi, rekonsiliasi, boarding, dan cargo. Master data, harga, dan pengaturan hanya bisa dilihat.</div></div>' : ''}<div id="isi" class="stack" style="gap:20px">${inner}</div></div></div></div>`;
  if (boleh('verifikasi')) sb.rpc('daftar_verifikasi').then(({ data }) => { const c = $('#cnt-v'); if (c && data && data.length) { c.textContent = data.length; c.hidden = false; } });
}
const kosong = (j, i) => `<div class="card empty"><h3>${j}</h3><p>${i}</p></div>`;
const err = e => toast(pesanGalat(e), 'bad');

/* ---------- Login ---------- */
function vLogin(mode = 'masuk') {
  $('#app').innerHTML = `<div style="min-height:100vh;padding:16px"><form class="card login" id="f-login" novalidate>${logoHtml('index.html')}
    <h1 style="font-size:22px">${mode === 'masuk' ? 'Masuk back office' : 'Daftar akun staf'}</h1>
    ${mode === 'daftar' ? '<p class="muted" style="margin:0">Akun baru belum punya akses sampai Superadmin memberi peran.</p><div class="field"><label for="nm">Nama</label><input id="nm" class="input" autocomplete="name"></div>' : ''}
    <div class="field"><label for="em">Email</label><input id="em" class="input" type="email" autocomplete="username"></div>
    <div class="field"><label for="pw">Password</label><input id="pw" class="input" type="password" autocomplete="${mode === 'masuk' ? 'current-password' : 'new-password'}" minlength="8"></div>
    <span class="err-text" id="le" hidden role="alert"></span>
    <button class="btn btn-primary btn-block">${mode === 'masuk' ? 'Masuk' : 'Daftar'}</button>
    <div class="spread"><a href="#" id="sw" class="btn-text" style="padding:0">${mode === 'masuk' ? 'Daftar akun staf' : 'Sudah punya akun? Masuk'}</a>${mode === 'masuk' ? '<a href="#" id="lupa" class="btn-text" style="padding:0">Lupa password</a>' : ''}</div></form></div>`;
  $('#sw').onclick = e => { e.preventDefault(); vLogin(mode === 'masuk' ? 'daftar' : 'masuk'); };
  const lp = $('#lupa'); if (lp) lp.onclick = async e => { e.preventDefault(); const em = $('#em').value.trim(); if (!em) { toast('Isi email dulu.'); return; } const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + '/admin.html' }); error ? err(error) : toast('Tautan atur ulang password dikirim ke email.', 'ok'); };
  $('#f-login').onsubmit = async e => {
    e.preventDefault(); const em = $('#em').value.trim(), pw = $('#pw').value; const le = $('#le');
    const r = mode === 'masuk' ? await sb.auth.signInWithPassword({ email: em, password: pw })
      : await sb.auth.signUp({ email: em, password: pw, options: { data: { nama: $('#nm').value.trim() }, emailRedirectTo: location.origin + '/admin.html' } });
    if (r.error) { le.textContent = r.error.message === 'Invalid login credentials' ? 'Email atau password salah.' : r.error.message; le.hidden = false; return; }
    if (mode === 'daftar' && !r.data.session) { le.textContent = 'Cek email Anda untuk konfirmasi, lalu masuk.'; le.hidden = false; return; }
    mulai();
  };
}
async function mulai() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { vLogin(); return; }
  A.user = session.user;
  const { data: p } = await sb.from('profiles').select('*').eq('id', A.user.id).maybeSingle();
  A.profil = p || { nama: A.user.email }; A.role = p && p.aktif ? p.role : null;
  if (!A.role) {
    $('#app').innerHTML = `<div style="min-height:100vh;padding:16px"><div class="card login"><span style="color:var(--ink-3)">${IC.lock}</span><h1 style="font-size:20px">Akun belum punya akses.</h1><p class="muted" style="margin:0">${esc(A.user.email)} sudah terdaftar. Minta Superadmin memberi peran dan branch di menu User & hak akses.</p><button class="btn btn-secondary" id="out">Keluar</button></div></div>`;
    $('#out').onclick = async () => { await sb.auth.signOut(); vLogin(); }; return;
  }
  window.onhashchange = route; route();
}
async function route() {
  if (A.stopKamera) { A.stopKamera(); A.stopKamera = null; }
  closeModal();
  const h = location.hash.slice(1) || 'dashboard';
  if (h === 'keluar') { await sb.auth.signOut(); location.hash = ''; vLogin(); return; }
  A.view = h;
  if (!boleh(h)) { shell('Akses ditolak', `<div class="card denied"><span style="color:var(--ink-3)">${IC.lock}</span><h2 style="font-size:18px">Anda tidak punya akses ke halaman ini.</h2><p class="muted" style="margin:0">Hubungi Superadmin bila butuh akses.</p><a class="btn btn-secondary" href="#dashboard">Kembali ke Dashboard</a></div>`); return; }
  const V = { dashboard: vDashboard, verifikasi: vVerifikasi, rekonsiliasi: vRekon, manifest: vManifest, terima: vTerima, scan: vScan, serah: vSerah,
    'm-tiket': () => vMaster('tiket'), 'm-cargo': () => vMaster('cargo'), layout: vLayout, laporan: vLaporan, pengaturan: vPengaturan, konten: () => vMasterTunggal('konten', 'CMS konten'), user: vUser, log: vLog };
  try { await V[h](); } catch (e) { console.error(e); shell('Galat', kosong('Halaman gagal dimuat.', esc(pesanGalat(e)))); }
}

/* ---------- Dashboard ---------- */
async function vDashboard() {
  shell('Dashboard', '<div class="skeleton" style="height:300px"></div>');
  const d = await rpc('ringkasan_dashboard', {});
  const tiket = A.role !== 'admin_cargo', cargo = A.role !== 'admin_tiket';
  const k = [
    tiket && { l: 'Pendapatan tiket hari ini', v: rp(d.pendapatan_hari_ini), s: 'Pesanan lunas hari ini' },
    tiket && { l: 'Tiket terjual hari ini', v: d.tiket_terjual, s: 'Kursi lunas' },
    tiket && { l: 'Menunggu verifikasi', v: d.menunggu_verifikasi, s: d.lewat_sla ? d.lewat_sla + ' lewat SLA' : 'Semua dalam SLA', c: d.lewat_sla ? 'bad' : '' },
    tiket && { l: 'Median verifikasi (7 hari)', v: d.median_verifikasi_menit == null ? '—' : d.median_verifikasi_menit + ' mnt', s: 'Target ≤ 15 menit' },
    cargo && { l: 'Resi dalam perjalanan', v: d.resi_dalam_perjalanan, s: 'Status saat ini' },
    cargo && { l: 'Resi lewat estimasi', v: d.resi_lewat_estimasi, s: 'Belum diterima', c: d.resi_lewat_estimasi ? 'warn' : '' }
  ].filter(Boolean);
  const seri = d.pendapatan_14_hari || [];
  const max = Math.max(1, ...seri.map(x => x.nilai)); const W = 640, H = 220, l = 56, b = 28, t = 16, r = 12, bw = (W - l - r) / Math.max(1, seri.length);
  const y = v => t + (H - t - b) * (1 - v / max);
  const ticks = [0, .25, .5, .75, 1].map(f => max * f);
  const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Pendapatan tiket 14 hari terakhir">${ticks.map(v => `<line x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}" stroke="#EDF1F5"/><text x="${l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6E7D8E">${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })}</text>`).join('')}
    ${seri.map((s, i) => { const x = l + i * bw + 4, last = i === seri.length - 1; return `<rect x="${x}" y="${y(s.nilai)}" width="${bw - 8}" height="${y(0) - y(s.nilai)}" rx="3" fill="${last ? '#0F5C4D' : '#9CCBBE'}"><title>${tglPendek(s.tanggal)}: ${rp(s.nilai)}</title></rect><text x="${x + (bw - 8) / 2}" y="${H - 10}" text-anchor="middle" font-size="10.5" fill="#6E7D8E">${new Date(s.tanggal + 'T00:00:00').getDate()}</text>`; }).join('')}<text x="${l}" y="10" font-size="11" fill="#6E7D8E">Rp juta</text></svg>`;
  const per = (d.peringatan || []);
  $('#isi').innerHTML = `<div class="kpis">${k.map(x => `<div class="card kpi ${x.c || ''}"><span>${x.l}</span><b class="num">${x.v}</b><small>${x.s}</small></div>`).join('')}</div>
    <div class="dash-grid">${tiket ? `<section class="card panel"><h2>Pendapatan tiket harian</h2>${chart}</section>` : ''}
    <section class="card panel"><h2>Peringatan SLA</h2>${per.length ? per.map(p => `<div class="alert"><i class="${p.jenis === 'verifikasi' ? 'bad' : ''}"></i><div><b class="mono">${esc(p.kode)}</b> ${p.jenis === 'verifikasi' ? `menunggu verifikasi ${p.menit} menit` : `lewat estimasi tiba ${tglPendek(p.estimasi)}`}</div><a class="btn btn-secondary btn-sm" href="#${p.jenis === 'verifikasi' ? 'verifikasi' : 'scan'}">Buka</a></div>`).join('') : '<p class="muted" style="margin:0">Tidak ada peringatan.</p>'}</section></div>
    ${tiket ? `<section class="card panel"><h2>Okupansi jadwal hari ini</h2>${(d.okupansi || []).map(o => `<div class="occ"><span class="num">${esc(o.jadwal)}</span><span class="bar"><i style="width:${o.persen}%;${o.persen < 65 ? 'background:var(--warn)' : ''}"></i></span><b class="num">${o.persen}%</b></div>`).join('') || '<p class="muted">Tidak ada jadwal hari ini.</p>'}</section>` : ''}`;
}

/* ---------- Verifikasi ---------- */
async function vVerifikasi(pilih) {
  shell('Verifikasi pembayaran', '<div class="skeleton" style="height:300px"></div>');
  const q = await rpc('daftar_verifikasi');
  if (!q.length) { $('#isi').innerHTML = kosong('Semua pembayaran sudah diverifikasi.', 'Antrean baru muncul di sini begitu customer mengunggah bukti.'); return; }
  const v = q.find(x => x.kode === pilih) || q[0];
  const s = v.total_transfer.toLocaleString('id-ID');
  $('#isi').innerHTML = `<div class="verif"><section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Menunggu</th><th>Kode</th><th>Pemesan</th><th>Nominal</th><th>Mutasi</th></tr></thead><tbody>
    ${q.map(x => `<tr class="click ${x.kode === v.kode ? 'sel' : ''}" data-k="${x.kode}" tabindex="0"><td class="age ${x.menunggu_menit > 30 ? 'late' : ''} num">${x.menunggu_menit} mnt</td><td class="mono">${x.kode}</td><td>${esc(x.nama)}<br><span class="hint">${esc(x.jadwal)}</span></td><td class="num">${rp(x.total_transfer)}</td><td>${x.mutasi ? `<span class="badge b-ok">Cocok mutasi</span>` : '<span class="badge b-neutral">Belum ada mutasi</span>'}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card panel"><div class="spread"><h2 class="mono">${v.kode}</h2><span class="badge b-warn">Menunggu verifikasi</span></div>
      <div class="kv"><span>Nominal diharapkan</span><b class="mono">Rp ${s.slice(0, -3)}<mark style="background:var(--accent);border-radius:4px;padding:0 2px">${s.slice(-3)}</mark></b></div>
      <div class="kv"><span>Mutasi rekening</span><b>${v.mutasi ? waktu(v.mutasi.waktu) + ' · ' + esc(v.mutasi.keterangan || '') : 'Belum ada'}</b></div>
      <div class="proof-img" id="bukti">Memuat bukti…</div>
      <div class="row"><button class="btn btn-primary" id="ok" style="flex:1">Setujui</button><button class="btn btn-danger" id="no" style="flex:1">Tolak</button></div>
      <span class="hint">Setujui hanya bila nominal sama persis dengan mutasi rekening.</span></section></div>`;
  $$('[data-k]').forEach(r => { r.onclick = () => vVerifikasi(r.dataset.k); r.onkeydown = e => { if (e.key === 'Enter') vVerifikasi(r.dataset.k); }; });
  const { data: su } = await sb.storage.from('bukti-transfer').createSignedUrl(v.bukti_path, 600);
  $('#bukti').innerHTML = su ? (/\.pdf$/i.test(v.bukti_path) ? `<a class="btn btn-secondary" href="${su.signedUrl}" target="_blank" rel="noopener">Buka bukti PDF</a>` : `<a href="${su.signedUrl}" target="_blank" rel="noopener"><img src="${su.signedUrl}" alt="Bukti transfer ${v.kode}" style="max-width:100%;max-height:360px;border-radius:8px"></a>`) : 'Bukti tidak bisa dimuat.';
  $('#ok').onclick = async () => { try { await rpc('verifikasi_pembayaran', { p_kode: v.kode, p_setuju: true }); toast(`${v.kode} lunas. Customer bisa membuka e-ticket.`, 'ok'); vVerifikasi(); } catch (e) { err(e); } };
  $('#no').onclick = () => {
    const m = modal(`<h3>Tolak pembayaran ${v.kode}?</h3><div class="field"><label for="why">Alasan (tampil ke customer)</label><textarea id="why" class="input" style="height:88px;padding:10px" placeholder="Contoh: nominal kurang Rp247"></textarea></div><div class="row" style="justify-content:flex-end"><button class="btn btn-secondary" id="m-c">Batal</button><button class="btn btn-danger solid" id="m-o" disabled>Tolak pembayaran</button></div>`);
    $('#why', m).oninput = e => { $('#m-o', m).disabled = !e.target.value.trim(); };
    $('#m-c', m).onclick = closeModal;
    $('#m-o', m).onclick = async () => { try { await rpc('verifikasi_pembayaran', { p_kode: v.kode, p_setuju: false, p_alasan: $('#why', m).value.trim() }); closeModal(); toast(`${v.kode} ditolak. Customer bisa unggah ulang.`); vVerifikasi(); } catch (e) { err(e); } };
  };
}

/* ---------- Rekonsiliasi ---------- */
function parseCSV(text) {
  const baris = text.split(/\r?\n/).filter(x => x.trim());
  const sep = (baris[0].match(/;/g) || []).length > (baris[0].match(/,/g) || []).length ? ';' : ',';
  const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
  const head = split(baris[0]).map(h => h.toLowerCase());
  const iT = head.findIndex(h => /tanggal|tgl|date|waktu/.test(h)), iN = head.findIndex(h => /nominal|jumlah|amount|kredit|credit|mutasi/.test(h)), iK = head.findIndex(h => /keterangan|deskripsi|description|berita|remark/.test(h));
  if (iT < 0 || iN < 0) throw new Error('format_mutasi_tidak_dikenali');
  return baris.slice(1).map(split).filter(c => c[iN]).map(c => {
    const raw = c[iN].replace(/[^\d,.-]/g, ''); const nominal = Math.round(parseFloat(/,\d{2}$/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/[.,](?=\d{3}\b)/g, '')));
    let t = c[iT]; const m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(.*)$/); if (m) t = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}${m[4] || ''}`;
    const d = new Date(t.trim().replace(' ', 'T')); return { waktu: isNaN(d) ? new Date().toISOString() : d.toISOString(), keterangan: iK >= 0 ? c[iK] : '', nominal };
  }).filter(x => x.nominal > 0);
}
async function vRekon() {
  shell('Rekonsiliasi mutasi', '<div class="skeleton" style="height:200px"></div>');
  const [{ data: rek }, { data: mut }] = await Promise.all([sb.from('rekening').select('*').order('urutan'), sb.from('mutasi').select('waktu,keterangan,nominal,hasil,disetujui,pesanan(kode,status)').order('created_at', { ascending: false }).limit(60)]);
  const g = h => (mut || []).filter(m => m.hasil === h);
  const tabel = rows => rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Keterangan</th><th>Nominal</th><th>Pesanan</th></tr></thead><tbody>${rows.map(m => `<tr><td class="num">${waktu(m.waktu)}</td><td>${esc(m.keterangan || '')}</td><td class="num">${rp(m.nominal)}</td><td>${m.pesanan ? `<span class="mono">${m.pesanan.kode}</span> · ${esc(m.pesanan.status)}` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="margin:0">Tidak ada.</p>';
  const belum = g('cocok').filter(m => !m.disetujui && m.pesanan && m.pesanan.status !== 'lunas').length;
  $('#isi').innerHTML = `<section class="card panel"><h2>Unggah mutasi rekening</h2><div class="fgrid"><div class="field"><label for="rk">Rekening</label><select id="rk" class="select">${(rek || []).map(r => `<option value="${r.id}">${esc(r.bank)} ${esc(r.nomor)}</option>`).join('')}</select></div></div>
      <label class="drop" for="mut"><span style="color:var(--brand)">${IC.up}</span><b>Pilih berkas CSV mutasi dari internet banking</b><span class="hint">Kolom minimal: tanggal dan nominal (kredit). Kolom keterangan dipakai bila ada.</span><span class="err-text" id="mut-e" hidden role="alert"></span></label><input type="file" id="mut" class="sr" accept=".csv,text/csv"></section>
    <div class="match"><div class="card"><span class="hint">Cocok</span><b class="num">${g('cocok').length}</b><span class="hint">Nominal + kode unik sesuai pesanan aktif</span></div><div class="card r"><span class="hint">Ragu</span><b class="num">${g('ragu').length}</b><span class="hint">Cocok dengan pesanan kedaluwarsa</span></div><div class="card x"><span class="hint">Tidak cocok</span><b class="num">${g('tidak_cocok').length}</b><span class="hint">Tanpa pesanan</span></div></div>
    <section class="card panel"><div class="spread"><h2>Cocok</h2><button class="btn btn-primary" id="appr" ${belum ? '' : 'disabled'}>Setujui yang cocok (${belum})</button></div>${tabel(g('cocok'))}</section>
    <section class="card panel"><h2>Ragu</h2><p class="hint" style="margin:0">Hubungi customer; kursi mungkin sudah terjual ulang. Catat untuk refund manual bila perlu.</p>${tabel(g('ragu'))}</section>
    <section class="card panel"><h2>Tidak cocok</h2>${tabel(g('tidak_cocok'))}</section>`;
  $('#mut').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const me = $('#mut-e');
    try { const rows = parseCSV(await f.text()); if (!rows.length) throw new Error('format_mutasi_tidak_dikenali');
      const r = await rpc('impor_mutasi', { p_rekening: $('#rk').value, p_baris: rows }); toast(`${r.cocok} cocok, ${r.ragu} ragu, ${r.tidak_cocok} tidak cocok`, 'ok'); vRekon();
    } catch (x) { me.textContent = pesanGalat(x) + ' Tidak ada status yang berubah.'; me.hidden = false; }
  };
  $('#appr').onclick = async () => { try { const r = await rpc('setujui_mutasi_cocok'); toast(`${r.lunas} pesanan lunas.`, 'ok'); vRekon(); } catch (e) { err(e); } };
}

/* ---------- Manifest & boarding ---------- */
async function opsiJadwal() {
  const { data } = await sb.from('jadwal').select('id,kode,jam,hari,rute(kode,asal,tujuan)').eq('aktif', true).order('jam');
  return data || [];
}
async function vManifest() {
  shell('Manifest & boarding', '<div class="skeleton" style="height:200px"></div>');
  const js = await opsiJadwal(); A.mJadwal = A.mJadwal || (js[0] && js[0].id); A.mTgl = A.mTgl || hariIni();
  const m = A.mJadwal ? await rpc('manifest', { p_jadwal: A.mJadwal, p_tanggal: A.mTgl }) : null;
  const badge = p => p.boarding === 'naik' ? '<span class="badge b-ok">Naik</span>' : p.boarding === 'no_show' ? '<span class="badge b-bad">No-show</span>' : '<span class="badge b-neutral">Belum naik</span>';
  $('#isi').innerHTML = `<div class="toolbar"><select id="mj" class="select" style="width:auto;height:38px" aria-label="Jadwal">${js.map(j => `<option value="${j.id}" ${j.id === A.mJadwal ? 'selected' : ''}>${jam(j.jam)} ${esc(j.rute.asal)} → ${esc(j.rute.tujuan)} (${esc(j.kode)})</option>`).join('')}</select><input id="mt" type="date" class="input" style="width:auto;height:38px" value="${A.mTgl}" aria-label="Tanggal">
      ${m ? `<span class="muted">${esc(m.jadwal.armada)} · Driver ${esc(m.jadwal.driver || '—')} · ${m.penumpang.length}/${m.jadwal.kapasitas} kursi</span>` : ''}
      <span class="row" style="margin-left:auto"><button class="btn btn-secondary btn-sm" onclick="window.print()">Cetak manifest</button><button class="btn btn-danger btn-sm" id="tutup">Tutup boarding</button></span></div>
    <div class="dash-grid"><section class="card scan-panel no-print"><h2 style="font-size:16px">Scan boarding</h2>
      <form id="f-scan" class="row" style="flex-wrap:nowrap"><label class="sr" for="qr">Kode QR</label><input id="qr" class="input mono" placeholder="Pindai QR atau ketik kode booking" autofocus><button class="btn btn-primary">Cek</button></form>
      <button class="btn btn-secondary btn-sm" id="kam" style="align-self:flex-start">Pakai kamera</button><video id="vid" playsinline muted style="width:100%;border-radius:12px;display:none"></video>
      <div id="hasil"></div><ul class="scan-list" id="log"></ul></section>
    <section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kursi</th><th>Nama</th><th>Naik di</th><th>Bayar</th><th>Boarding</th></tr></thead><tbody>${m && m.penumpang.length ? m.penumpang.map(p => `<tr><td class="mono">${p.kursi}</td><td>${esc(p.nama)}<br><span class="hint mono">${p.kode}</span></td><td>${esc(p.titik_naik || '')}</td><td>${p.bayar === 'lunas' ? '<span class="badge b-ok">Lunas</span>' : `<span class="badge b-warn">${esc(p.bayar.replace('_', ' '))}</span>`}</td><td>${badge(p)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Belum ada penumpang.</td></tr>'}</tbody></table></div></section></div>`;
  $('#mj').onchange = e => { A.mJadwal = e.target.value; vManifest(); };
  $('#mt').onchange = e => { A.mTgl = e.target.value; vManifest(); };
  const cek = async kode => {
    try { const r = await rpc('scan_boarding', { p_qr: kode, p_jadwal: A.mJadwal, p_tanggal: A.mTgl });
      $('#hasil').innerHTML = `<div class="scan-result ${r.ok ? 'ok' : 'bad'}" role="status">${r.ok ? '✓' : '✕'} ${esc(r.pesan)}</div>`;
      if (r.ok) { const li = document.createElement('li'); li.innerHTML = `<span class="mono">${esc(kode)}</span><span>${esc(r.pesan)}</span>`; $('#log').prepend(li); if (navigator.vibrate) navigator.vibrate(80); }
    } catch (e) { err(e); }
  };
  $('#f-scan').onsubmit = e => { e.preventDefault(); const v = $('#qr').value.trim(); if (v) cek(v); $('#qr').value = ''; };
  $('#kam').onclick = async () => { try { const v = $('#vid'); v.style.display = 'block'; A.stopKamera = await mulaiKamera(v, cek); if (!A.stopKamera) v.style.display = 'none'; } catch (e) { toast('Kamera tidak bisa dibuka: ' + e.message, 'bad'); } };
  $('#tutup').onclick = () => {
    const md = modal(`<h3>Tutup boarding?</h3><p style="margin:0;color:var(--ink-2)">Penumpang lunas yang belum dipindai akan berstatus No-show.</p><div class="row" style="justify-content:flex-end"><button class="btn btn-secondary" id="c">Batal</button><button class="btn btn-danger solid" id="o">Tutup boarding</button></div>`);
    $('#c', md).onclick = closeModal; $('#o', md).onclick = async () => { try { const r = await rpc('tutup_boarding', { p_jadwal: A.mJadwal, p_tanggal: A.mTgl }); closeModal(); toast(`${r.no_show} penumpang no-show.`); vManifest(); } catch (e) { err(e); } };
  };
}

/* ---------- Cargo: terima, scan, serah ---------- */
async function vTerima() {
  shell('Terima barang', `<section class="card panel" style="max-width:720px"><form id="f-r" class="row" style="flex-wrap:nowrap"><label class="sr" for="rs">Nomor resi</label><input id="rs" class="input mono" placeholder="Pindai atau ketik nomor resi" maxlength="12" autofocus><button class="btn btn-primary">Cari</button></form><div id="hasil"></div></section>`);
  $('#f-r').onsubmit = async e => {
    e.preventDefault(); const resi = $('#rs').value.trim().toUpperCase();
    const { data: p } = await sb.from('pengiriman').select('*, zona(asal,tujuan), layanan(nama), koli(*)').eq('resi', resi).maybeSingle();
    if (!p) { $('#hasil').innerHTML = `<p class="err-text">${PESAN_GALAT.resi_tidak_ada}</p>`; return; }
    const koli = (p.koli || []).sort((a, b) => a.no - b.no);
    $('#hasil').innerHTML = `<div class="stack" style="margin-top:12px"><div class="kv"><span>Rute</span><b>${esc(p.zona.asal)} → ${esc(p.zona.tujuan)} · ${esc(p.layanan.nama)}</b></div><div class="kv"><span>Pengirim</span><b>${esc(p.pengirim_nama)} · ${esc(p.pengirim_hp)}</b></div><div class="kv"><span>Penerima</span><b>${esc(p.penerima_nama)}</b></div><div class="kv"><span>Estimasi ongkir</span><b class="num">${rp(p.estimasi_ongkir)}</b></div><div class="kv"><span>Status</span><b>${esc(p.status)}</b></div>
      ${p.status !== 'dibuat' ? '<div class="banner info">Barang ini sudah diterima di gudang.</div>' : `<h2 style="font-size:16px">Timbang ulang</h2>${koli.map(k => `<div class="koli" data-no="${k.no}"><span class="no">#${k.no}</span><div class="field f-w"><label>Berat (kg)</label><input class="input num" type="number" step="0.1" value="${k.berat}" data-k="berat"></div><div class="field f-p"><label>P</label><input class="input num" type="number" value="${k.panjang}" data-k="p"></div><div class="field f-l"><label>L</label><input class="input num" type="number" value="${k.lebar}" data-k="l"></div><div class="field f-t"><label>T</label><input class="input num" type="number" value="${k.tinggi}" data-k="t"></div><span></span></div>`).join('')}
      <label class="check"><input type="checkbox" id="lunas"> Ongkir final sudah dibayar di loket</label><button class="btn btn-primary" id="trm" disabled>Terima barang dan cetak label</button>`}</div><div id="label" class="label-print" style="margin-top:16px"></div>`;
    const l = $('#lunas'); if (l) l.onchange = e => { $('#trm').disabled = !e.target.checked; };
    const t = $('#trm'); if (t) t.onclick = async () => {
      const data = $$('[data-no]').map(r => ({ no: +r.dataset.no, ...Object.fromEntries($$('[data-k]', r).map(i => [i.dataset.k, parseFloat(i.value) || 0])) }));
      try { const r = await rpc('terima_barang', { p_resi: resi, p_koli: data, p_lunas: true });
        toast(`Ongkir final ${rp(r.ongkir_final)} (${r.selisih >= 0 ? '+' : ''}${rp(r.selisih).replace('Rp ', 'Rp')} dari estimasi)`, 'ok');
        $('#label').innerHTML = r.label.map((x, i) => `<div class="card"><b>${esc(p.zona.asal)} → ${esc(p.zona.tujuan)}</b><svg id="lb${i}"></svg><div class="mono">${esc(x)}</div><span class="hint">${esc(p.penerima_nama)}</span></div>`).join('') + '<button class="btn btn-secondary no-print" onclick="window.print()">Cetak label</button>';
        r.label.forEach((x, i) => renderBarcode($('#lb' + i), x)); t.disabled = true;
      } catch (e) { err(e); }
    };
  };
}
async function vScan() {
  const js = await opsiJadwal(); const { data: gd } = await sb.from('gudang').select('nama').eq('aktif', true);
  A.sAksi = A.sAksi || 'dalam_perjalanan'; A.sTgl = A.sTgl || hariIni();
  shell('Scan status koli', `<section class="card scan-panel phone-ui">
    <div class="field"><label for="ak">Aksi</label><select id="ak" class="select">${[['dalam_perjalanan', 'Muat ke jadwal bus'], ['tiba_tujuan', 'Tiba di gudang tujuan'], ['siap_diambil', 'Siap diambil / diantar']].map(([v, l]) => `<option value="${v}" ${A.sAksi === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${A.sAksi === 'dalam_perjalanan' ? `<div class="field"><label for="sj">Jadwal bus</label><select id="sj" class="select">${js.map(j => `<option value="${j.id}" ${j.id === A.sJadwal ? 'selected' : ''}>${jam(j.jam)} ${esc(j.rute.asal)} → ${esc(j.rute.tujuan)}</option>`).join('')}</select></div><div class="field"><label for="st">Tanggal</label><input id="st" type="date" class="input" value="${A.sTgl}"></div>`
      : `<div class="field"><label for="lk">Lokasi</label><select id="lk" class="select">${(gd || []).map(g => `<option ${g.nama === A.sLok ? 'selected' : ''}>${esc(g.nama)}</option>`).join('')}</select></div>`}
    <form id="f-s" class="row" style="flex-wrap:nowrap"><label class="sr" for="lb">Label koli</label><input id="lb" class="input mono" placeholder="Pindai label koli" autofocus><button class="btn btn-primary">Scan</button></form>
    <button class="btn btn-secondary btn-sm" id="kam" style="align-self:flex-start">Pakai kamera</button><video id="vid" playsinline muted style="width:100%;border-radius:12px;display:none"></video>
    <div id="hasil"></div><ul class="scan-list" id="log"></ul></section>`);
  $('#ak').onchange = e => { A.sAksi = e.target.value; vScan(); };
  const sj = $('#sj'); if (sj) { A.sJadwal = sj.value; sj.onchange = e => { A.sJadwal = e.target.value; }; $('#st').onchange = e => { A.sTgl = e.target.value; }; }
  const lk = $('#lk'); if (lk) { A.sLok = lk.value; lk.onchange = e => { A.sLok = e.target.value; }; }
  const scan = async label => {
    try { const r = await rpc('scan_koli', { p_label: label, p_aksi: A.sAksi, p_jadwal: A.sAksi === 'dalam_perjalanan' ? A.sJadwal : null, p_tanggal: A.sAksi === 'dalam_perjalanan' ? A.sTgl : null, p_lokasi: A.sLok || null });
      $('#hasil').innerHTML = `<div class="scan-result ${r.ok ? 'ok' : 'bad'}" role="status">${r.ok ? '✓' : '✕'} ${esc(r.pesan)}${r.ok && r.sisa != null ? ` · sisa bagasi ${r.sisa} kg` : ''}</div>`;
      if (r.ok) { const li = document.createElement('li'); li.innerHTML = `<span class="mono">${esc(label.toUpperCase())}</span><span>${r.berat} kg</span>`; $('#log').prepend(li); if (navigator.vibrate) navigator.vibrate(80); }
    } catch (e) { err(e); }
  };
  $('#f-s').onsubmit = e => { e.preventDefault(); const v = $('#lb').value.trim(); if (v) scan(v); $('#lb').value = ''; };
  $('#kam').onclick = async () => { try { const v = $('#vid'); v.style.display = 'block'; A.stopKamera = await mulaiKamera(v, scan); if (!A.stopKamera) v.style.display = 'none'; } catch (e) { toast('Kamera tidak bisa dibuka: ' + e.message, 'bad'); } };
}
function vSerah() {
  shell('Serah terima', `<section class="card scan-panel phone-ui"><div class="field"><label for="rs">Nomor resi</label><input id="rs" class="input mono" maxlength="12" placeholder="SLC…"></div>
    <div class="field"><label for="nm">Nama penerima</label><input id="nm" class="input"></div>
    <div class="field"><label for="ft">Foto barang diterima</label><input id="ft" type="file" accept="image/jpeg,image/png" capture="environment" class="input" style="padding-top:9px"></div>
    <div class="field"><label>Tanda tangan penerima</label><canvas class="sig" id="sig" width="600" height="180" aria-label="Area tanda tangan"></canvas><button class="btn btn-text btn-sm" id="hapus" style="align-self:flex-start">Hapus tanda tangan</button></div>
    <button class="btn btn-primary btn-block" id="done" disabled>Tandai diterima</button><span class="hint" id="hint">Ambil foto atau tanda tangan dulu.</span></section>`);
  const cv = $('#sig'), ctx = cv.getContext('2d'); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#14202E'; let draw = false, ttd = false;
  const upd = () => { const ok = ttd || $('#ft').files.length; $('#done').disabled = !ok; $('#hint').hidden = !!ok; };
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.onpointerdown = e => { draw = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  cv.onpointermove = e => { if (!draw) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); if (!ttd) { ttd = true; upd(); } };
  cv.onpointerup = () => { draw = false; };
  $('#hapus').onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); ttd = false; upd(); };
  $('#ft').onchange = upd;
  $('#done').onclick = async () => {
    const resi = $('#rs').value.trim().toUpperCase(), nama = $('#nm').value.trim();
    if (!resi || !nama) { toast('Isi nomor resi dan nama penerima.', 'bad'); return; }
    const b = $('#done'); b.disabled = true; b.textContent = 'Menyimpan…';
    try {
      let foto = null, tt = null;
      if ($('#ft').files[0]) { foto = `${resi}/foto-${Date.now()}.jpg`; const u = await sb.storage.from('bukti-terima').upload(foto, $('#ft').files[0]); if (u.error) throw u.error; }
      if (ttd) { const blob = await new Promise(r => cv.toBlob(r, 'image/png')); tt = `${resi}/ttd-${Date.now()}.png`; const u = await sb.storage.from('bukti-terima').upload(tt, blob, { contentType: 'image/png' }); if (u.error) throw u.error; }
      await rpc('selesaikan_pengiriman', { p_resi: resi, p_nama: nama, p_foto: foto, p_ttd: tt });
      toast(`${resi} diterima.`, 'ok'); vSerah();
    } catch (e) { err(e); b.disabled = false; b.textContent = 'Tandai diterima'; }
  };
}

/* ---------- Master data (generik) ---------- */
const F = (k, label, type = 'text', o = {}) => ({ k, label, type, ...o });
const MASTER = {
  rute: { label: 'Rute', order: 'kode', fields: [F('kode', 'Kode'), F('asal', 'Kota asal'), F('tujuan', 'Kota tujuan'), F('jarak_km', 'Jarak (km)', 'number', { opt: 1 }), F('estimasi_menit', 'Estimasi (menit)', 'number'), F('aktif', 'Aktif', 'bool')] },
  jadwal: { label: 'Jadwal & harga', order: 'jam', select: '*, rute(kode), armada(nopol), driver(nama)', fields: [F('kode', 'Kode'), F('rute_id', 'Rute', 'fk', { tabel: 'rute', show: 'kode' }), F('hari', 'Hari operasi', 'days'), F('jam', 'Jam berangkat', 'time'),
    F('armada_id', 'Armada', 'fk', { tabel: 'armada', show: 'nopol' }), F('driver_id', 'Driver', 'fk', { tabel: 'driver', show: 'nama', opt: 1 }), F('harga_eksekutif', 'Harga dasar Eksekutif', 'number', { rp: 1, hint: 'Sebelum aturan harga dan promo; sudah termasuk iuran wajib Jasa Raharja' }), F('harga_vip', 'Harga dasar VIP', 'number', { rp: 1, opt: 1, hint: 'Kosongkan bila tanpa kursi VIP' }),
    F('titik_naik', 'Titik naik', 'titik', { hint: 'Satu per baris: Nama tempat | menit setelah berangkat' }), F('titik_turun', 'Titik turun', 'titik', { hint: 'Satu per baris: Nama tempat | menit' }), F('jual_online', 'Dijual online', 'bool'), F('aktif', 'Aktif', 'bool')] },
  aturan_harga: { label: 'Aturan harga', order: 'prioritas', fields: [F('prioritas', 'Prioritas (1 = teratas)', 'number'), F('nama', 'Nama aturan'), F('persen', 'Penyesuaian (%)', 'number', { hint: 'Positif menaikkan, negatif menurunkan' }), F('tanggal_mulai', 'Mulai', 'date', { opt: 1 }), F('tanggal_selesai', 'Selesai', 'date', { opt: 1 }), F('hari', 'Hari', 'days', { opt: 1 }), F('rute_ids', 'Rute', 'multifk', { tabel: 'rute', show: 'kode', opt: 1 }), F('jam', 'Hanya jadwal jam', 'time', { opt: 1 }), F('aktif', 'Aktif', 'bool')] },
  promo: { label: 'Promo', order: 'kode', fields: [F('kode', 'Kode', 'text', { upper: 1 }), F('tipe', 'Tipe', 'select', { opsi: ['nominal', 'persen'] }), F('nilai', 'Nilai (Rp atau %)', 'number'), F('maks_potongan', 'Maks potongan (Rp)', 'number', { opt: 1 }), F('min_kursi', 'Min. kursi', 'number'), F('hari', 'Hari berlaku', 'days', { opt: 1 }), F('rute_ids', 'Rute', 'multifk', { tabel: 'rute', show: 'kode', opt: 1 }), F('khusus_member', 'Khusus member', 'bool'), F('mulai', 'Mulai', 'date'), F('selesai', 'Selesai', 'date'), F('kuota', 'Kuota', 'number'), F('terpakai', 'Terpakai', 'number', { ro: 1 }), F('maks_per_user', 'Maks per user', 'number', { opt: 1 }), F('aktif', 'Aktif', 'bool')] },
  armada: { label: 'Armada', order: 'nopol', select: '*, layout_kursi(nama)', fields: [F('nopol', 'No. polisi'), F('jenis', 'Jenis kendaraan'), F('layout_id', 'Layout kursi', 'fk', { tabel: 'layout_kursi', show: 'nama' }), F('bagasi_kg', 'Kapasitas bagasi (kg)', 'number'), F('status', 'Status', 'select', { opsi: ['Aktif', 'Perawatan', 'Nonaktif'] })] },
  driver: { label: 'Driver', order: 'nama', select: '*, branch(nama)', fields: [F('nama', 'Nama'), F('sim_golongan', 'Golongan SIM', 'select', { opsi: ['B1 Umum', 'B2 Umum'] }), F('sim_berlaku', 'SIM berlaku s.d.', 'date'), F('shift', 'Shift', 'select', { opsi: ['Pagi', 'Siang', 'Malam'], opt: 1 }), F('branch_id', 'Branch', 'fk', { tabel: 'branch', show: 'nama', opt: 1 }), F('status', 'Status', 'select', { opsi: ['Aktif', 'Cuti', 'Nonaktif'] })] },
  branch: { label: 'Branch', order: 'nama', fields: [F('nama', 'Nama'), F('kota', 'Kota'), F('fungsi', 'Fungsi', 'arr', { hint: 'Pisahkan koma: loket, titik_naik, titik_turun, gudang' }), F('alamat', 'Alamat', 'text', { opt: 1 }), F('jam_operasional', 'Jam operasional', 'text', { opt: 1 }), F('aktif', 'Aktif', 'bool')] },
  zona: { label: 'Zona', order: 'kode', fields: [F('kode', 'Kode'), F('asal', 'Kota asal'), F('tujuan', 'Kota tujuan'), F('jarak_km', 'Jarak (km)', 'number', { opt: 1 }), F('estimasi_hari', 'Estimasi tiba (hari)', 'number', { hint: 'Dipakai untuk peringatan SLA' }), F('estimasi_teks', 'Teks estimasi', 'text', { opt: 1 }), F('aktif', 'Aktif', 'bool')] },
  tarif: { label: 'Tarif', order: 'per_kg', select: '*, zona(kode), layanan(nama)', fields: [F('zona_id', 'Zona', 'fk', { tabel: 'zona', show: 'kode' }), F('layanan_id', 'Layanan', 'fk', { tabel: 'layanan', show: 'nama' }), F('per_kg', 'Tarif per kg', 'number', { rp: 1 }), F('min_charge', 'Minimum charge', 'number', { rp: 1 }), F('pembagi', 'Pembagi volumetrik', 'number', { hint: 'Berat volume = P × L × T (cm) ÷ pembagi' })] },
  gudang: { label: 'Gudang', order: 'nama', select: '*, branch(nama)', fields: [F('nama', 'Nama'), F('kota', 'Kota'), F('branch_id', 'Branch', 'fk', { tabel: 'branch', show: 'nama', opt: 1 }), F('alamat', 'Alamat', 'text', { opt: 1 }), F('jam_operasional', 'Jam operasional', 'text', { opt: 1 }), F('aktif', 'Aktif', 'bool')] },
  layanan: { label: 'Layanan', order: 'nama', fields: [F('nama', 'Nama'), F('janji', 'Janji waktu', 'text', { opt: 1 }), F('batas_serah', 'Batas serah barang', 'time', { opt: 1 }), F('aktif', 'Aktif', 'bool')] },
  asuransi: { label: 'Konstanta asuransi', order: 'vendor', fields: [F('vendor', 'Vendor'), F('persen', 'Persentase (%)', 'number', { step: '0.001' }), F('maks_nilai', 'Nilai barang maks', 'number', { rp: 1, opt: 1 }), F('aktif', 'Aktif (hanya satu)', 'bool')] },
  rekening: { label: 'Rekening', order: 'urutan', fields: [F('bank', 'Bank'), F('nomor', 'Nomor rekening'), F('atas_nama', 'Atas nama'), F('urutan', 'Urutan', 'number'), F('tampil', 'Tampil di pembayaran', 'bool')] },
  konten: { label: 'Konten', order: 'urutan', fields: [F('jenis', 'Jenis', 'select', { opsi: ['promo', 'berita', 'faq', 'halaman'] }), F('judul', 'Judul'), F('slug', 'Slug'), F('ringkas', 'Ringkasan', 'text', { opt: 1 }), F('isi', 'Isi', 'textarea', { opt: 1 }), F('urutan', 'Urutan', 'number'), F('status', 'Status', 'select', { opsi: ['draf', 'terbit', 'arsip'] })] }
};
const GRUP = { tiket: ['jadwal', 'aturan_harga', 'promo', 'rute', 'armada', 'driver', 'branch', 'rekening'], cargo: ['tarif', 'zona', 'gudang', 'layanan', 'asuransi'] };
const FKCACHE = {};
async function fkOpsi(tabel, show) { if (!FKCACHE[tabel]) { const { data } = await sb.from(tabel).select('id,' + show).order(show); FKCACHE[tabel] = data || []; } return FKCACHE[tabel]; }
function sel(row, f) {
  const v = row[f.k];
  if (f.type === 'bool') return v ? '<span class="badge b-ok">Ya</span>' : '<span class="badge b-neutral">Tidak</span>';
  if (f.type === 'fk') { const rel = Object.values(row).find(x => x && typeof x === 'object' && !Array.isArray(x) && f.show in x); return esc(rel ? rel[f.show] : (v ? '…' : '—')); }
  if (f.type === 'multifk') return v && v.length ? esc((FKCACHE[f.tabel] || []).filter(o => v.includes(o.id)).map(o => o[f.show]).join(', ')) : 'Semua';
  if (f.type === 'days') return v && v.length ? (v.length === 7 ? 'Setiap hari' : v.map(d => HARI[d - 1]).join(', ')) : 'Semua';
  if (f.type === 'titik') return esc((v || []).map(t => t.nama).join(', '));
  if (f.type === 'arr') return esc((v || []).join(', '));
  if (f.type === 'time') return v ? jam(v) : '—';
  if (f.type === 'textarea') return esc((v || '').slice(0, 60));
  if (v == null || v === '') return '<span class="muted">—</span>';
  if (f.rp) return `<span class="num">${rp(v)}</span>`;
  if (f.k === 'status') return `<span class="badge ${['Aktif', 'terbit'].includes(v) ? 'b-ok' : ['Perawatan', 'Cuti', 'draf'].includes(v) ? 'b-warn' : 'b-neutral'}">${esc(v)}</span>`;
  return esc(v);
}
async function tabelMaster(key) {
  const m = MASTER[key];
  for (const f of m.fields) if (f.type === 'fk' || f.type === 'multifk') await fkOpsi(f.tabel, f.show);
  const { data, error } = await sb.from(key).select(m.select || '*').order(m.order);
  if (error) throw error;
  const cols = m.fields.filter(f => f.type !== 'textarea' || key === 'konten').slice(0, 9);
  return `<div class="toolbar"><label class="sr" for="q">Cari</label><input id="q" class="input" placeholder="Cari ${m.label.toLowerCase()}"><span class="muted">${data.length} data</span><span class="row" style="margin-left:auto"><button class="btn btn-secondary btn-sm" id="csv">Unduh CSV</button><button class="btn btn-primary btn-sm" id="add">+ Tambah</button></span></div>
    <div class="card tbl-wrap"><table class="tbl"><thead><tr>${cols.map(f => `<th>${f.label}</th>`).join('')}<th></th></tr></thead><tbody>${data.map((r, i) => `<tr>${cols.map(f => `<td>${sel(r, f)}</td>`).join('')}<td style="text-align:right"><button class="btn btn-text btn-sm" data-edit="${i}">Ubah</button></td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="muted">Belum ada data.</td></tr>`}</tbody></table></div>
    ${key === 'aturan_harga' ? '<span class="hint">Harga akhir = harga dasar jadwal × (1 + penyesuaian). Bila beberapa aturan berlaku di tanggal yang sama, hanya prioritas teratas yang dipakai.</span>' : ''}
    <script type="application/json" id="rows">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
function bindMaster(key, ulang) {
  const rows = JSON.parse($('#rows').textContent);
  $('#q').oninput = e => { const t = e.target.value.toLowerCase(); $$('.tbl tbody tr').forEach(tr => { tr.hidden = t && !tr.textContent.toLowerCase().includes(t); }); };
  $('#add').onclick = () => drawer(key, null, ulang);
  $$('[data-edit]').forEach(b => b.onclick = () => drawer(key, rows[+b.dataset.edit], ulang));
  $('#csv').onclick = () => { const f = MASTER[key].fields; unduh(`${key}.csv`, [f.map(x => x.label).join(',')].concat(rows.map(r => f.map(x => JSON.stringify(Array.isArray(r[x.k]) || (r[x.k] && typeof r[x.k] === 'object') ? JSON.stringify(r[x.k]) : (r[x.k] ?? ''))).join(','))).join('\n')); };
}
function input(f, v) {
  const id = 'f-' + f.k, ro = f.ro ? 'disabled' : '';
  let c;
  if (f.type === 'bool') return `<label class="switch"><input type="checkbox" id="${id}" ${v ?? true ? 'checked' : ''} ${ro}> ${f.label}</label>`;
  if (f.type === 'select') c = `<select id="${id}" class="select">${f.opt ? '<option value="">—</option>' : ''}${f.opsi.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  else if (f.type === 'fk') c = `<select id="${id}" class="select">${f.opt ? '<option value="">—</option>' : ''}${(FKCACHE[f.tabel] || []).map(o => `<option value="${o.id}" ${o.id === v ? 'selected' : ''}>${esc(o[f.show])}</option>`).join('')}</select>`;
  else if (f.type === 'multifk') c = `<div class="daychips" id="${id}">${(FKCACHE[f.tabel] || []).map(o => `<label><input type="checkbox" value="${o.id}" ${(v || []).includes(o.id) ? 'checked' : ''}> ${esc(o[f.show])}</label>`).join('')}</div><span class="hint">Kosongkan untuk semua.</span>`;
  else if (f.type === 'days') c = `<div class="daychips" id="${id}">${HARI.map((d, i) => `<label><input type="checkbox" value="${i + 1}" ${(v || (f.opt ? [] : [1, 2, 3, 4, 5, 6, 7])).includes(i + 1) ? 'checked' : ''}> ${d}</label>`).join('')}</div>`;
  else if (f.type === 'titik') c = `<textarea id="${id}" class="input" style="height:76px;padding:10px">${esc((v || []).map(t => `${t.nama} | ${t.menit || 0}`).join('\n'))}</textarea>`;
  else if (f.type === 'textarea') c = `<textarea id="${id}" class="input" style="height:140px;padding:10px">${esc(v || '')}</textarea>`;
  else if (f.type === 'arr') c = `<input id="${id}" class="input" value="${esc((v || []).join(', '))}">`;
  else c = `<input id="${id}" class="input ${f.type === 'number' ? 'num' : ''}" type="${f.type}" ${f.step ? `step="${f.step}"` : ''} value="${esc(v == null ? '' : (f.type === 'time' ? jam(v) : v))}" ${ro}>`;
  return `<div class="field"><label for="${id}">${f.label}${f.opt ? ' <span class="muted">(opsional)</span>' : ''}</label>${c}${f.hint ? `<span class="hint">${f.hint}</span>` : ''}<span class="err-text" id="e-${f.k}" hidden>${f.label} wajib diisi</span></div>`;
}
function ambil(f, root) {
  const el = $('#f-' + f.k, root);
  if (f.type === 'bool') return el.checked;
  if (f.type === 'days') { const a = $$('input:checked', el).map(x => +x.value); return a.length ? a : (f.opt ? null : []); }
  if (f.type === 'multifk') { const a = $$('input:checked', el).map(x => x.value); return a.length ? a : null; }
  if (f.type === 'titik') return el.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [n, m] = l.split('|'); return { nama: n.trim(), menit: parseInt(m) || 0 }; });
  if (f.type === 'arr') return el.value.split(',').map(x => x.trim()).filter(Boolean);
  const v = el.value.trim(); if (v === '') return null;
  if (f.type === 'number') return Number(v);
  return f.upper ? v.toUpperCase() : v;
}
function drawer(key, row, ulang) {
  const m = MASTER[key];
  const bg = document.createElement('div'); bg.className = 'drawer-bg'; bg.id = 'modal';
  bg.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true"><div class="spread"><h3>${row ? 'Ubah' : 'Tambah'} ${m.label.toLowerCase()}</h3><button class="btn btn-text" id="x" aria-label="Tutup">✕</button></div>
    ${m.fields.map(f => input(f, row ? row[f.k] : undefined)).join('')}<span class="err-text" id="d-e" hidden role="alert"></span>
    <div class="foot">${row ? '<button class="btn btn-danger" id="del" style="margin-right:auto">Hapus</button>' : ''}<button class="btn btn-secondary" id="c">Batal</button><button class="btn btn-primary" id="s">Simpan</button></div></aside>`;
  document.body.appendChild(bg); const close = () => bg.remove();
  $('#x', bg).onclick = close; $('#c', bg).onclick = close; bg.onclick = e => { if (e.target === bg) close(); };
  const del = $('#del', bg); if (del) del.onclick = async () => {
    const { error } = await sb.from(key).delete().eq('id', row.id);
    if (error) { $('#d-e', bg).textContent = error.code === '23503' ? 'Data ini masih dipakai data lain. Nonaktifkan saja.' : error.message; $('#d-e', bg).hidden = false; return; }
    close(); delete FKCACHE[key]; toast('Data dihapus.'); ulang();
  };
  $('#s', bg).onclick = async () => {
    if (A.role === 'demo') { toast('Akun demo hanya bisa melihat. Perubahan tidak disimpan.'); return; }
    const data = {}; let ok = true;
    m.fields.filter(f => !f.ro).forEach(f => { const v = ambil(f, bg); const bad = !f.opt && f.type !== 'bool' && (v == null || (Array.isArray(v) && !v.length && f.type !== 'titik')); $('#e-' + f.k, bg).hidden = !bad; if (bad) ok = false; data[f.k] = v; });
    if (!ok) return;
    const q = row ? sb.from(key).update(data).eq('id', row.id) : sb.from(key).insert(data);
    const { error } = await q;
    if (error) { $('#d-e', bg).textContent = error.code === '23505' ? 'Data dengan kode/nama ini sudah ada.' : error.code === '23514' ? 'Isian melanggar aturan (cek harga VIP ≥ Eksekutif, tanggal selesai ≥ mulai, atau nilai lain).' : error.message; $('#d-e', bg).hidden = false; return; }
    close(); delete FKCACHE[key]; toast(`${m.label} tersimpan.`, 'ok'); ulang();
  };
}
async function vMaster(grup) {
  A.mt = A.mt || {}; A.mt[grup] = A.mt[grup] || GRUP[grup][0]; const cur = A.mt[grup];
  shell(grup === 'tiket' ? 'Master Ticketing' : 'Master Cargo', '<div class="skeleton" style="height:300px"></div>');
  const tabs = `<div class="a-tabs" role="tablist">${GRUP[grup].map(k => `<button role="tab" data-t="${k}" aria-selected="${k === cur}">${MASTER[k].label}</button>`).join('')}</div>`;
  $('#isi').innerHTML = tabs + await tabelMaster(cur);
  $$('[data-t]').forEach(b => b.onclick = () => { A.mt[grup] = b.dataset.t; vMaster(grup); });
  bindMaster(cur, () => vMaster(grup));
}
async function vMasterTunggal(key, judul) {
  shell(judul, '<div class="skeleton" style="height:300px"></div>');
  $('#isi').innerHTML = await tabelMaster(key); bindMaster(key, () => vMasterTunggal(key, judul));
}

/* ---------- Layout kursi ---------- */
async function vLayout() {
  shell('Layout kursi', '<div class="skeleton" style="height:300px"></div>');
  const { data: lays } = await sb.from('layout_kursi').select('*').order('nama');
  A.lay = A.lay || (lays[0] && lays[0].id); const cur = lays.find(l => l.id === A.lay);
  A.grid = A.grid && A.gridId === A.lay ? A.grid : (cur ? JSON.parse(JSON.stringify(cur.grid)) : Array.from({ length: 12 }, () => ['k', 'k', 'l', 'k', 'k']));
  A.gridId = A.lay; A.lMode = A.lMode || 'k';
  const lab = { k: 'Kursi', kv: 'VIP', l: 'Lorong', t: 'Toilet', p: 'Pintu', s: 'Sopir' };
  const n = A.grid.flat().filter(c => c === 'k' || c === 'kv').length, nv = A.grid.flat().filter(c => c === 'kv').length;
  $('#isi').innerHTML = `<div class="toolbar"><select id="pl" class="select" style="width:auto;height:38px" aria-label="Layout">${lays.map(l => `<option value="${l.id}" ${l.id === A.lay ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}<option value="baru" ${A.lay === 'baru' ? 'selected' : ''}>+ Layout baru</option></select>
      <label class="sr" for="ln">Nama layout</label><input id="ln" class="input" style="max-width:260px;height:38px" value="${esc(cur ? cur.nama : '')}" placeholder="Nama layout"></div>
    <div class="dash-grid lay"><section class="card panel"><div class="row" role="group" aria-label="Jenis sel">${Object.entries(lab).map(([k, v]) => `<button class="btn btn-sm ${A.lMode === k ? 'btn-primary' : 'btn-secondary'}" data-m="${k}">${v}</button>`).join('')}</div>
      <span class="hint">Pilih jenis, lalu klik sel. Baris pertama untuk sopir dan pintu. Nomor kursi dibuat otomatis per baris (1A, 1B, …).</span>
      <div class="layout-grid" id="lg" style="grid-template-columns:repeat(${A.grid[0].length},44px)">${A.grid.map((row, r) => row.map((c, ci) => `<button class="lcell ${c}" data-r="${r}" data-c="${ci}" aria-label="Baris ${r + 1} kolom ${ci + 1}: ${lab[c]}">${c === 'l' ? '' : lab[c].slice(0, 5)}</button>`).join('')).join('')}</div>
      <div class="row"><button class="btn btn-secondary btn-sm" id="addr">+ Baris</button><button class="btn btn-secondary btn-sm" id="delr">− Baris</button></div></section>
    <aside class="card panel"><h2>Ringkasan</h2><div class="kv"><span>Total kursi</span><b class="num">${n}</b></div><div class="kv"><span>VIP</span><b class="num">${nv}</b></div><div class="kv"><span>Eksekutif</span><b class="num">${n - nv}</b></div>
      <button class="btn btn-primary" id="sv">Simpan layout</button><span class="hint">Armada yang memakai layout ini ikut berubah. Jadwal dengan pesanan aktif tetap memakai nomor kursi yang sama bila nomornya masih ada.</span></aside></div>`;
  $('#pl').onchange = e => { A.lay = e.target.value; A.grid = null; if (A.lay === 'baru') { A.grid = [['s', 'l', 'l', 'l', 'p']].concat(Array.from({ length: 10 }, () => ['k', 'k', 'l', 'k', 'k'])); A.gridId = 'baru'; } vLayout(); };
  $$('[data-m]').forEach(b => b.onclick = () => { A.lMode = b.dataset.m; vLayout(); });
  $('#lg').onclick = e => { const c = e.target.closest('.lcell'); if (!c) return; A.grid[+c.dataset.r][+c.dataset.c] = A.lMode; vLayout(); };
  $('#addr').onclick = () => { A.grid.push(A.grid[A.grid.length - 1].map(c => c === 'p' || c === 's' ? 'k' : c)); vLayout(); };
  $('#delr').onclick = () => { if (A.grid.length > 2) { A.grid.pop(); vLayout(); } };
  $('#sv').onclick = async () => {
    if (A.role === 'demo') { toast('Akun demo hanya bisa melihat. Perubahan tidak disimpan.'); return; }
    const nama = $('#ln').value.trim(); if (!nama) { toast('Isi nama layout.', 'bad'); return; }
    let baris = 0; const kursi = [];
    A.grid.forEach((row, r) => { const seats = row.map((c, ci) => [c, ci]).filter(([c]) => c === 'k' || c === 'kv'); if (!seats.length) return; baris = r; seats.forEach(([c, ci], i) => kursi.push({ no: r + String.fromCharCode(65 + i), kelas: c === 'kv' ? 'VIP' : 'Eksekutif', baris: r, kolom: ci })); });
    if (!kursi.length) { toast('Layout minimal punya 1 kursi', 'bad'); return; }
    const rec = { nama, grid: A.grid, kursi };
    const { data, error } = A.lay === 'baru' ? await sb.from('layout_kursi').insert(rec).select().single() : await sb.from('layout_kursi').update(rec).eq('id', A.lay).select().single();
    if (error) { toast(error.message, 'bad'); return; }
    A.lay = data.id; A.gridId = data.id; delete FKCACHE.layout_kursi; toast(`Layout tersimpan: ${kursi.length} kursi.`, 'ok'); vLayout();
  };
}

/* ---------- Laporan ---------- */
async function vLaporan() {
  A.lap = A.lap || { jenis: A.role === 'admin_cargo' ? 'cargo' : 'tiket', dari: isoHari(hariIni(), -29), sampai: hariIni() };
  const L = A.lap;
  shell('Laporan', '<div class="skeleton" style="height:300px"></div>');
  let rows = [], kpi = [], head = [], csv = [];
  if (L.jenis === 'tiket') {
    const { data } = await sb.from('pesanan').select('kode,subtotal,potongan,status,diverifikasi_at,jadwal(kode,rute(kode)),pesanan_kursi(boarding,aktif)').eq('status', 'lunas').gte('diverifikasi_at', L.dari + 'T00:00:00+07:00').lte('diverifikasi_at', L.sampai + 'T23:59:59+07:00');
    const g = {}; (data || []).forEach(p => { const k = p.jadwal.rute.kode; g[k] = g[k] || { t: 0, r: 0, n: 0, ns: 0 }; const ks = p.pesanan_kursi.filter(x => x.aktif); g[k].t += ks.length; g[k].r += p.subtotal - p.potongan; g[k].n++; g[k].ns += ks.filter(x => x.boarding === 'no_show').length; });
    head = ['Rute', 'Pesanan', 'Tiket', 'Pendapatan', 'No-show']; rows = Object.entries(g).map(([k, v]) => [k, v.n, v.t, rp(v.r), v.ns]);
    const tot = Object.values(g).reduce((a, v) => ({ r: a.r + v.r, t: a.t + v.t, ns: a.ns + v.ns }), { r: 0, t: 0, ns: 0 });
    kpi = [['Pendapatan', rp(tot.r)], ['Tiket lunas', tot.t], ['Pesanan', (data || []).length], ['No-show', tot.ns]];
    csv = [['kode', 'rute', 'jadwal', 'diverifikasi', 'subtotal', 'potongan']].concat((data || []).map(p => [p.kode, p.jadwal.rute.kode, p.jadwal.kode, p.diverifikasi_at, p.subtotal, p.potongan]));
  } else {
    const { data } = await sb.from('pengiriman').select('resi,status,estimasi_ongkir,ongkir_final,estimasi_tiba,created_at,zona(kode),layanan(nama)').gte('created_at', L.dari + 'T00:00:00+07:00').lte('created_at', L.sampai + 'T23:59:59+07:00');
    const g = {}; (data || []).forEach(p => { const k = p.zona.kode + ' · ' + p.layanan.nama; g[k] = g[k] || { n: 0, r: 0, d: 0 }; g[k].n++; g[k].r += p.ongkir_final || 0; g[k].d += p.status === 'diterima' ? 1 : 0; });
    head = ['Zona · layanan', 'Resi', 'Pendapatan (ongkir final)', 'Diterima']; rows = Object.entries(g).map(([k, v]) => [k, v.n, rp(v.r), v.d]);
    const tot = Object.values(g).reduce((a, v) => ({ n: a.n + v.n, r: a.r + v.r, d: a.d + v.d }), { n: 0, r: 0, d: 0 });
    kpi = [['Pendapatan', rp(tot.r)], ['Resi', tot.n], ['Diterima', tot.d], ['Belum diterima', tot.n - tot.d]];
    csv = [['resi', 'zona', 'layanan', 'status', 'estimasi_ongkir', 'ongkir_final', 'dibuat']].concat((data || []).map(p => [p.resi, p.zona.kode, p.layanan.nama, p.status, p.estimasi_ongkir, p.ongkir_final ?? '', p.created_at]));
  }
  $('#isi').innerHTML = `<div class="a-tabs" role="tablist">${A.role !== 'admin_cargo' ? `<button role="tab" data-j="tiket" aria-selected="${L.jenis === 'tiket'}">Tiket</button>` : ''}${A.role !== 'admin_tiket' ? `<button role="tab" data-j="cargo" aria-selected="${L.jenis === 'cargo'}">Cargo</button>` : ''}</div>
    <div class="toolbar"><label class="hint" for="d1">Dari</label><input id="d1" type="date" class="input" style="width:auto;height:38px" value="${L.dari}"><label class="hint" for="d2">Sampai</label><input id="d2" type="date" class="input" style="width:auto;height:38px" value="${L.sampai}"><span class="row" style="margin-left:auto"><button class="btn btn-secondary btn-sm" id="dl" ${csv.length > 1 ? '' : 'disabled'}>Unduh CSV (Excel)</button><button class="btn btn-secondary btn-sm" onclick="window.print()">Cetak / PDF</button></span></div>
    ${csv.length > 1 ? `<div class="rpt-grid">${kpi.map(k => `<div class="card kpi"><span>${k[0]}</span><b class="num">${k[1]}</b><small>${tglPendek(L.dari)} – ${tglPendek(L.sampai)}</small></div>`).join('')}</div>
    <div class="card tbl-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : kosong('Tidak ada data untuk periode ini.', 'Ubah rentang tanggal. Tombol unduh aktif lagi bila ada data.')}`;
  $$('[data-j]').forEach(b => b.onclick = () => { L.jenis = b.dataset.j; vLaporan(); });
  $('#d1').onchange = e => { L.dari = e.target.value; vLaporan(); }; $('#d2').onchange = e => { L.sampai = e.target.value; vLaporan(); };
  $('#dl').onclick = () => unduh(`laporan-${L.jenis}-${L.dari}-${L.sampai}.csv`, '\ufeff' + csv.map(r => r.map(c => JSON.stringify(c ?? '')).join(',')).join('\n'));
}

/* ---------- Pengaturan, user, log ---------- */
async function vPengaturan() {
  const { data: s } = await sb.from('settings').select('*').eq('id', 1).single();
  const f = (k, l, t = 'text', h = '') => `<div class="field"><label for="g-${k}">${l}</label><input id="g-${k}" class="input ${t === 'number' ? 'num' : ''}" type="${t}" value="${esc(s[k] ?? '')}">${h ? `<span class="hint">${h}</span>` : ''}</div>`;
  shell('Pengaturan umum', `<div class="dash-grid"><section class="card panel"><h2>Identitas</h2><div class="fgrid">${f('nama_brand', 'Nama aplikasi')}${f('nama_perusahaan', 'Nama perusahaan (rekening, dokumen)')}${f('wa_tiket', 'WhatsApp CS Tiket', 'text', 'Format 62…')}${f('wa_cargo', 'WhatsApp CS Cargo', 'text', 'Format 62…')}${f('instagram', 'Instagram')}${f('facebook', 'Facebook')}</div><a class="btn btn-secondary" href="#m-tiket" onclick="A.mt={tiket:'rekening'}">Kelola rekening</a></section>
    <section class="card panel"><h2>Aturan penjualan tiket</h2>${f('kunci_kursi_menit', 'Kunci kursi saat dipilih (menit)', 'number')}${f('batas_bayar_menit', 'Batas waktu bayar (menit)', 'number')}${f('tutup_jual_jam', 'Tutup penjualan online sebelum berangkat (jam)', 'number')}${f('maks_kursi', 'Maks kursi per pesanan', 'number')}${f('maks_hari_kedepan', 'Pemesanan paling jauh (hari)', 'number')}
      <label class="switch"><input type="checkbox" id="g-kode_unik" ${s.kode_unik ? 'checked' : ''}> Kode unik 3 digit di nominal transfer</label>${f('sla_verifikasi_menit', 'Peringatan verifikasi lebih dari (menit)', 'number')}
      <button class="btn btn-primary" id="sv">Simpan pengaturan</button></section></div>`);
  $('#sv').onclick = async () => {
    if (A.role === 'demo') { toast('Akun demo hanya bisa melihat. Perubahan tidak disimpan.'); return; }
    const d = {}; ['nama_brand', 'nama_perusahaan', 'wa_tiket', 'wa_cargo', 'instagram', 'facebook'].forEach(k => d[k] = $('#g-' + k).value.trim() || null);
    ['kunci_kursi_menit', 'batas_bayar_menit', 'tutup_jual_jam', 'maks_kursi', 'maks_hari_kedepan', 'sla_verifikasi_menit'].forEach(k => d[k] = +$('#g-' + k).value);
    d.kode_unik = $('#g-kode_unik').checked; d.updated_at = new Date().toISOString();
    const { error } = await sb.from('settings').update(d).eq('id', 1);
    error ? toast(error.code === '23514' ? 'Ada nilai di luar batas yang diizinkan.' : error.message, 'bad') : toast('Pengaturan tersimpan. Berlaku untuk pesanan baru.', 'ok');
  };
}
async function vUser() {
  const [{ data: us }, { data: br }] = await Promise.all([sb.from('profiles').select('*').order('created_at'), sb.from('branch').select('id,nama,kota').order('nama')]);
  shell('User & hak akses', `<div class="banner info"><div>User baru mendaftar sendiri lewat halaman masuk back office (Daftar akun staf), lalu Superadmin memberi peran dan branch di sini. Admin hanya melihat data branch-nya; Superadmin melihat semua.</div></div>
    <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Branch</th><th>Aktif</th><th></th></tr></thead><tbody>
    ${us.map(u => `<tr data-u="${u.id}"><td>${esc(u.nama || '')}</td><td>${esc(u.email || '')}</td><td><select class="select" style="height:36px" data-f="role" ${u.id === A.user.id ? 'disabled' : ''}><option value="">Belum ada akses</option>${['superadmin', 'admin_tiket', 'admin_cargo', 'demo'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${({ superadmin: 'Superadmin', admin_tiket: 'Admin Ticketing', admin_cargo: 'Admin Cargo', demo: 'Akun demo' })[r]}</option>`).join('')}</select></td>
      <td><div class="daychips">${br.map(b => `<label><input type="checkbox" value="${b.id}" ${(u.branch_ids || []).includes(b.id) ? 'checked' : ''}> ${esc(b.nama)}</label>`).join('')}</div></td>
      <td><label class="switch"><input type="checkbox" data-f="aktif" ${u.aktif ? 'checked' : ''} ${u.id === A.user.id ? 'disabled' : ''} aria-label="Aktif"></label></td><td><button class="btn btn-primary btn-sm" data-save>Simpan</button></td></tr>`).join('')}</tbody></table></div>`);
  $$('[data-save]').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr'); const id = tr.dataset.u;
    const d = { branch_ids: $$('.daychips input:checked', tr).map(x => x.value) };
    if (id !== A.user.id) { d.role = $('[data-f=role]', tr).value || null; d.aktif = $('[data-f=aktif]', tr).checked; }
    const { error } = await sb.from('profiles').update(d).eq('id', id);
    error ? toast(error.message, 'bad') : toast('Hak akses tersimpan.', 'ok');
  });
}
async function vLog() {
  const { data } = await sb.from('activity_log').select('*').order('waktu', { ascending: false }).limit(200);
  const { data: us } = await sb.from('profiles').select('id,nama');
  const nm = id => (us.find(u => u.id === id) || {}).nama || 'Sistem';
  shell('Log aktivitas', `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Objek</th><th>Detail</th></tr></thead><tbody>${(data || []).map(l => `<tr><td class="num">${waktu(l.waktu)}</td><td>${esc(nm(l.user_id))}</td><td>${esc(l.aksi)}</td><td class="mono">${esc(l.objek || '')}</td><td class="hint">${esc(l.detail ? JSON.stringify(l.detail) : '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Belum ada aktivitas.</td></tr>'}</tbody></table></div>`);
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { const m = modal('<h3>Atur password baru</h3><div class="field"><label for="np">Password baru</label><input id="np" type="password" class="input" minlength="8"></div><button class="btn btn-primary" id="sp">Simpan</button>'); $('#sp', m).onclick = async () => { const { error } = await sb.auth.updateUser({ password: $('#np', m).value }); error ? err(error) : (closeModal(), toast('Password diperbarui.', 'ok')); }; } });
mulai();
