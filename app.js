// Nusalaju — situs customer
const KEY = 'nusalaju-state-v1';
const S = Object.assign({
  sesi: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
  tab: 'tiket', asal: 'Jakarta', tujuan: 'Bandung', tanggal: null, pax: 1,
  jadwal: null, kursi: [], naik: null, turun: null,
  pesanan: null, email: null,
  cAsal: 'Jakarta', cTujuan: 'Bandung', layanan: 'Reguler', koli: [{ berat: 2, p: 30, l: 20, t: 20 }], asuransi: false, nilai: 0,
  resi: null
}, (() => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
if (!S.tanggal || S.tanggal < hariIni()) S.tanggal = isoHari(hariIni(), 1);
const simpan = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
let SET = { wa_tiket: '', wa_cargo: '', maks_kursi: 6, nama_perusahaan: '' };
let KOTA = [], KOTA_CARGO = { asal: [], tujuan: [] }, LAYANAN = [];
let timers = [], channel = null;
const bersih = () => { timers.forEach(clearInterval); timers = []; if (channel) { sb.removeChannel(channel); channel = null; } closeModal(); };

/* ---------- Kerangka ---------- */
function layout(inner, opt = {}) {
  const wa = opt.wa || SET.wa_tiket;
  const teks = encodeURIComponent(opt.waText || `Halo CS ${MEREK.nama}, saya butuh bantuan.`);
  return `<header class="c-head"><div class="c-head-in">${logoHtml()}
    <nav class="c-nav" id="cnav" aria-label="Menu utama">
      <a href="#beranda">Beranda</a><a href="#pesanan">Cek Pesanan</a><a href="#ongkir">Cek Ongkir</a><a href="#lacak">Lacak Kiriman</a><a href="#bantuan">Bantuan</a>
    </nav>
    <button class="c-burger" id="burger" aria-label="Buka menu" aria-expanded="false">${IC.menu}</button>
  </div></header>
  <main class="c-main">${inner}</main>
  <footer class="c-foot"><div class="c-foot-in"><span>${esc(MEREK.nama)} · Tiket bus &amp; cargo antarkota</span><span>Harga tiket sudah termasuk iuran wajib Jasa Raharja</span></div></footer>
  ${wa && !opt.noFab ? `<a class="wa-fab no-print" href="https://wa.me/${esc(wa)}?text=${teks}" target="_blank" rel="noopener">${IC.wa}<span class="t">Butuh bantuan? Chat CS</span></a>` : ''}
  ${opt.bottom || ''}`;
}
function progress(step) {
  const n = ['Jadwal', 'Kursi', 'Data', 'Bayar', 'E-ticket'];
  return '<div class="progress" aria-label="Langkah pemesanan">' + n.map((x, i) => {
    const c = i + 1 < step ? 'done' : i + 1 === step ? 'on' : '';
    return (i ? '<i></i>' : '') + `<span class="${c}"><b>${i + 1 < step ? '✓' : i + 1}</b>${x}</span>`;
  }).join('') + '</div>';
}
function tampil(html, opt) {
  $('#app').innerHTML = layout(html, opt);
  const b = $('#burger'); if (b) b.onclick = () => { const nv = $('#cnav'); nv.classList.toggle('open'); b.setAttribute('aria-expanded', nv.classList.contains('open')); };
  const h = (location.hash.slice(1).split('/')[0]) || 'beranda';
  const peta = { jadwal: 'beranda', kursi: 'beranda', data: 'beranda', bayar: 'pesanan', eticket: 'pesanan', kirim: 'ongkir', resi: 'lacak' };
  $$('#cnav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + (peta[h] || h)));
  window.scrollTo(0, 0);
}
const kosong = (judul, isi, aksi = '') => `<div class="card empty"><h3>${judul}</h3><p>${isi}</p>${aksi}</div>`;
const opsi = (arr, sel) => arr.map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');

/* ---------- Beranda ---------- */
async function vBeranda() {
  const [{ data: konten }, rating] = await Promise.all([
    sb.from('konten').select('jenis,judul,ringkas,isi,slug').eq('status', 'terbit').order('urutan'),
    sb.from('rating').select('skor')
  ]);
  const promos = (konten || []).filter(k => k.jenis === 'promo');
  const r = rating.data || []; const avg = r.length ? (r.reduce((a, x) => a + x.skor, 0) / r.length).toFixed(1).replace('.', ',') : null;
  const tiket = `<form class="search-grid" id="f-cari" novalidate>
      <div class="field f-from"><label for="asal">Dari</label><select id="asal" class="select">${opsi(KOTA, S.asal)}</select></div>
      <button type="button" class="swap" id="tukar" aria-label="Tukar asal dan tujuan">${IC.swap}</button>
      <div class="field f-to"><label for="tujuan">Ke</label><select id="tujuan" class="select">${opsi(KOTA, S.tujuan)}</select><span class="err-text" id="err-tujuan" hidden>Kota tujuan harus berbeda</span></div>
      <div class="field f-date"><label for="tgl">Tanggal berangkat</label><input id="tgl" class="input" type="date" value="${S.tanggal}" min="${hariIni()}" max="${isoHari(hariIni(), SET.maks_hari_kedepan || 60)}"></div>
      <div class="field f-pax"><label id="pax-l">Penumpang</label><div class="stepper" role="group" aria-labelledby="pax-l"><button type="button" id="pax-kurang" aria-label="Kurangi penumpang">−</button><span id="pax" aria-live="polite">${S.pax}</span><button type="button" id="pax-tambah" aria-label="Tambah penumpang">+</button></div><span class="hint" id="pax-hint" ${S.pax >= SET.maks_kursi ? '' : 'hidden'}>Maksimal ${SET.maks_kursi} kursi per pesanan</span></div>
      <div class="field f-go"><button class="btn btn-primary" type="submit">Cari Jadwal</button></div></form>`;
  const cargo = `<form class="search-grid" id="f-lacak" style="grid-template-columns:1fr auto" novalidate>
      <div class="field"><label for="resi-in">Nomor resi</label><input id="resi-in" class="input mono" placeholder="Contoh: NLC261113A7K" maxlength="12"></div>
      <div class="field"><button class="btn btn-primary" type="submit">Lacak Kiriman</button></div></form>
      <p class="hint" style="margin:10px 0 0">Mau kirim barang? <a href="#ongkir" style="font-weight:600;color:var(--brand)">Cek ongkir dulu</a></p>`;
  tampil(`<section class="hero">
      <div class="hero-top"><div class="stack" style="gap:10px"><span class="badge b-lime" style="align-self:flex-start">Tiket bus &amp; cargo antarkota</span><h1>Laju antarkota, aman sampai.</h1><p>Pilih kursi sendiri, bayar transfer, e-ticket langsung terbit. Cargo ikut bus dan bisa dilacak sampai diterima.</p>
        <div class="hero-stats"><div><b>5</b><span>rute aktif</span></div><div><b>10 mnt</b><span>kursi dikunci untukmu</span></div><div><b>24/7</b><span>lacak resi</span></div></div></div>
        <div class="hero-bus" aria-hidden="true"><svg viewBox="0 0 420 170" width="100%"><ellipse cx="210" cy="156" rx="190" ry="8" fill="#0E0F11" opacity=".08"/><path d="M18 40q0-22 22-22h318q30 0 40 28l10 34v52q0 14-14 14H32q-14 0-14-14z" fill="#fff" stroke="#D5D9DE" stroke-width="2"/><rect x="34" y="34" width="250" height="44" rx="8" fill="#1F2226"/><g fill="#2E3238">${[0,1,2,3,4].map(i=>`<rect x="${40+i*49}" y="40" width="42" height="32" rx="4"/>`).join('')}</g><path d="M300 34h56q16 0 22 14l12 30H300z" fill="#1F2226"/><rect x="18" y="96" width="400" height="8" fill="#7A2BF0"/><rect x="18" y="108" width="400" height="3" fill="#C9F45E"/><text x="40" y="128" font-family="Urbanist,sans-serif" font-size="15" font-weight="600" fill="#0E0F11">${esc(MEREK.nama)}</text><g><circle cx="96" cy="146" r="17" fill="#1F2226"/><circle cx="96" cy="146" r="7" fill="#C9CDD3"/><circle cx="334" cy="146" r="17" fill="#1F2226"/><circle cx="334" cy="146" r="7" fill="#C9CDD3"/></g><rect x="398" y="84" width="14" height="8" rx="3" fill="#C9F45E"/></svg></div></div>
      <div class="search-card"><div class="tabs" role="tablist"><button role="tab" id="t-tiket" aria-selected="${S.tab === 'tiket'}">Tiket Bus</button><button role="tab" id="t-cargo" aria-selected="${S.tab === 'cargo'}">Cargo</button></div>${S.tab === 'tiket' ? tiket : cargo}</div>
    </section>
    <div class="feat">
      <div class="card"><div class="ico">${IC.seat}</div><h3>Pilih kursi sendiri</h3><p>Peta kursi diperbarui langsung. Kursi pilihan Anda dikunci 10 menit.</p></div>
      <div class="card"><div class="ico">${IC.shield}</div><h3>Penumpang terlindungi</h3><p>Harga tiket sudah termasuk iuran wajib Jasa Raharja.</p></div>
      <div class="card"><div class="ico">${IC.box}</div><h3>Cargo terlacak</h3><p>Setiap koli dipindai di gudang dan saat dimuat ke bus.</p></div>
      <div class="card"><div class="ico">${IC.pin}</div><h3>Naik dari dekat</h3><p>Beberapa jadwal berhenti di titik naik tambahan di rute.</p></div>
    </div>
    ${promos.length ? `<h2 class="sec-title">Promo berjalan</h2><div class="promo-grid">${promos.map((p, i) => `<div class="card promo"><div class="art" style="background:linear-gradient(120deg,${['#0F5C4D,#1F8A73', '#8A2A1E,#B3261E', '#7A5300,#E3A82B'][i % 3]})">${esc(p.judul)}</div><div class="body"><b>${esc(p.ringkas || '')}</b><p>${esc(p.isi || '')}</p></div></div>`).join('')}</div>` : ''}
    ${avg ? `<h2 class="sec-title">Kata penumpang</h2><div class="card" style="padding:18px 20px"><span class="num" style="font-size:32px;font-weight:700">${avg}</span><span class="muted"> / 5 dari ${r.length} rating</span></div>` : ''}`,
    { waText: `Halo CS ${MEREK.nama}, saya mau tanya jadwal dan tiket.` });
  $('#t-tiket').onclick = () => { S.tab = 'tiket'; simpan(); vBeranda(); };
  $('#t-cargo').onclick = () => { S.tab = 'cargo'; simpan(); vBeranda(); };
  const f = $('#f-cari');
  if (f) {
    const setPax = n => { S.pax = Math.min(SET.maks_kursi, Math.max(1, n)); $('#pax').textContent = S.pax; $('#pax-kurang').disabled = S.pax <= 1; $('#pax-tambah').disabled = S.pax >= SET.maks_kursi; $('#pax-hint').hidden = S.pax < SET.maks_kursi; };
    setPax(S.pax);
    $('#pax-kurang').onclick = () => setPax(S.pax - 1); $('#pax-tambah').onclick = () => setPax(S.pax + 1);
    $('#tukar').onclick = () => { const a = $('#asal').value; $('#asal').value = $('#tujuan').value; $('#tujuan').value = a; };
    f.onsubmit = e => {
      e.preventDefault();
      S.asal = $('#asal').value; S.tujuan = $('#tujuan').value; S.tanggal = $('#tgl').value || S.tanggal;
      const same = S.asal === S.tujuan; $('#err-tujuan').hidden = !same; $('#tujuan').classList.toggle('err', same);
      if (same) return;
      simpan(); location.hash = 'jadwal';
    };
  }
  const l = $('#f-lacak'); if (l) l.onsubmit = e => { e.preventDefault(); S.resi = $('#resi-in').value.trim().toUpperCase(); simpan(); location.hash = 'lacak'; };
}

/* ---------- Jadwal ---------- */
async function vJadwal() {
  tampil(progress(1) + '<div class="skeleton" style="height:320px"></div>');
  const tgls = [-3, -2, -1, 0, 1, 2, 3].map(d => isoHari(S.tanggal, d));
  const hasil = await Promise.all(tgls.map(t => t < hariIni() ? Promise.resolve({ data: [] }) : sb.rpc('cari_jadwal', { p_asal: S.asal, p_tujuan: S.tujuan, p_tanggal: t, p_pax: S.pax })));
  const list = hasil[3].data || [];
  if (hasil[3].error) { tampil(kosong('Gagal memuat jadwal.', esc(pesanGalat(hasil[3].error)))); return; }
  const strip = tgls.map((t, i) => { const d = (hasil[i].data || []).filter(x => !x.ditutup); const min = d.length ? Math.min(...d.map(x => x.harga_eksekutif)) : null;
    return `<button class="date" data-tgl="${t}" aria-pressed="${t === S.tanggal}" ${t < hariIni() ? 'disabled' : ''}><span>${new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' })}</span><b>${new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</b><small>${min ? rp(min).replace('Rp ', '') : '—'}</small></button>`; }).join('');
  const aturan = list.find(x => x.aturan);
  const head = `${progress(1)}<div class="sum-bar"><span class="route">${esc(S.asal)} → ${esc(S.tujuan)}</span><span class="muted">${tglPanjang(S.tanggal)} · ${S.pax} penumpang</span>${aturan ? `<span class="badge b-accent">${esc(aturan.aturan)}</span>` : ''}<a class="btn btn-secondary btn-sm" href="#beranda" style="margin-left:auto">Ubah</a></div><div class="dates" role="group" aria-label="Pilih tanggal lain">${strip}</div>`;
  const kartu = list.map(s => {
    const kurang = s.sisa < S.pax;
    const note = s.ditutup ? `<span class="badge b-neutral">${esc(s.alasan)}</span>` : kurang ? `<span class="badge b-bad">Sisa ${s.sisa} kursi</span>` : s.sisa <= 12 ? `<span class="badge b-warn">Sisa ${s.sisa} kursi</span>` : `<span class="badge b-ok">${s.sisa} kursi tersedia</span>`;
    const naik = (s.titik_naik || []).slice(1).map(t => t.nama).join(', ');
    return `<article class="card sched ${s.ditutup ? 'closed' : ''}"><div>
        <div class="time-line"><span class="time num">${jam(s.jam)}</span><span class="dur">${Math.floor(s.durasi_menit / 60)}j ${pad(s.durasi_menit % 60)}m<i></i></span><span class="time num">${jam(s.tiba)}</span></div>
        <div class="pts">${esc((s.titik_naik[0] || {}).nama || S.asal)} → ${esc((s.titik_turun[0] || {}).nama || S.tujuan)}${naik ? ` · <b>juga naik di ${esc(naik)}</b>` : ''}</div>
        <div class="facs"><span class="badge b-info">${esc(s.kelas)}</span><span class="badge b-neutral">${esc(s.armada)}</span></div></div>
      <div class="stack" style="gap:6px;align-items:flex-end"><div class="price num">${rp(s.harga_eksekutif)}<small>${s.harga_vip ? 'VIP ' + rp(s.harga_vip) : 'per orang'}</small></div>${note}</div>
      <div class="act"><button class="btn btn-primary" data-j="${s.jadwal_id}" ${s.ditutup || kurang ? 'disabled' : ''}>Pilih</button></div></article>`;
  }).join('');
  tampil(head + (list.length ? kartu : kosong('Belum ada jadwal untuk rute dan tanggal ini.', 'Coba tanggal lain di atas.')));
  $$('[data-tgl]').forEach(b => b.onclick = () => { S.tanggal = b.dataset.tgl; simpan(); vJadwal(); });
  $$('[data-j]').forEach(b => b.onclick = () => {
    const j = list.find(x => x.jadwal_id === b.dataset.j);
    if (S.jadwal && S.jadwal.id !== j.jadwal_id) lepasSemua();
    S.jadwal = { id: j.jadwal_id, jam: j.jam, tiba: j.tiba, kelas: j.kelas, naik: j.titik_naik, turun: j.titik_turun, armada: j.armada, tanggal: S.tanggal };
    S.naik = (j.titik_naik[0] || {}).nama || null; S.turun = (j.titik_turun[0] || {}).nama || null;
    simpan(); location.hash = 'kursi';
  });
}
async function lepasSemua() {
  if (!S.jadwal) return;
  const j = S.jadwal; const ks = S.kursi.slice(); S.kursi = []; simpan();
  await Promise.all(ks.map(k => sb.rpc('lepas_kursi', { p_jadwal: j.id, p_tanggal: j.tanggal, p_kursi: k, p_sesi: S.sesi })));
}

/* ---------- Kursi ---------- */
let PETA = null;
async function muatPeta() {
  PETA = await rpc('peta_kursi', { p_jadwal: S.jadwal.id, p_tanggal: S.jadwal.tanggal, p_sesi: S.sesi });
  S.kursi = PETA.kursi.filter(k => k.status === 'mine').map(k => k.no); simpan();
}
function petaHtml() {
  const byPos = {}; PETA.kursi.forEach(k => { byPos[k.baris + ':' + k.kolom] = k; });
  const cols = (PETA.grid[1] || PETA.grid[0]).length;
  let h = `<div class="grid-seats" style="grid-template-columns:${(PETA.grid[1] || PETA.grid[0]).map(c => c === 'l' ? '20px' : '48px').join(' ')}">`;
  PETA.grid.forEach((row, ri) => {
    if (ri === 0 || ri === PETA.grid.length - 1 && !row.some(c => c === 'k' || c === 'kv')) return;
    row.forEach((c, ci) => {
      if (c === 'l') { h += `<span class="rowno" aria-hidden="true">${ci === Math.floor(cols / 2) ? ri : ''}</span>`; return; }
      const k = byPos[ri + ':' + ci];
      if (!k) { h += '<span></span>'; return; }
      const vip = k.kelas === 'VIP';
      let cls = 'seat' + (vip ? ' vip' : ''), st = 'tersedia', dis = '';
      if (k.status === 'taken') { cls += ' taken'; st = 'terisi'; dis = 'disabled'; }
      else if (k.status === 'held') { cls += ' held'; st = 'sedang dipilih penumpang lain'; dis = 'aria-disabled="true"'; }
      else if (k.status === 'mine') { cls += ' mine'; st = 'pilihan Anda'; }
      const pos = (ci === 0 || ci === cols - 1) ? 'jendela' : 'lorong';
      h += `<button class="${cls}" data-seat="${k.no}" ${dis} aria-pressed="${k.status === 'mine'}" aria-label="Kursi ${k.no}, ${pos}, ${k.kelas}, ${st}">${k.no}</button>`;
    });
  });
  return h + '</div>';
}
function ringkasKursi() {
  const harga = k => PETA.harga[(PETA.kursi.find(x => x.no === k) || {}).kelas] || 0;
  const total = S.kursi.reduce((a, k) => a + harga(k), 0);
  return { total, html: `<div class="kv"><span>Jadwal</span><b>${tglPendek(S.jadwal.tanggal)} · ${jam(S.jadwal.jam)}</b></div>
    <div class="kv"><span>Kursi</span><b>${S.kursi.length ? S.kursi.join(', ') : 'Belum dipilih'}</b></div>
    ${S.kursi.map(k => `<div class="kv"><span>${k} · ${(PETA.kursi.find(x => x.no === k) || {}).kelas}</span><span class="num">${rp(harga(k))}</span></div>`).join('')}
    <div class="kv total"><span>Total</span><span class="num">${rp(total)}</span></div>` };
}
async function vKursi() {
  if (!S.jadwal) { location.hash = 'beranda'; return; }
  tampil(progress(2) + '<div class="skeleton" style="height:420px"></div>');
  try { await muatPeta(); } catch (e) { tampil(kosong('Peta kursi tidak bisa dimuat.', esc(pesanGalat(e)), '<a class="btn btn-secondary" href="#jadwal">Kembali ke jadwal</a>')); return; }
  const r = ringkasKursi(); const siap = S.kursi.length === S.pax;
  const naikOpt = (S.jadwal.naik || []).map(t => `<option ${t.nama === S.naik ? 'selected' : ''}>${esc(t.nama)}</option>`).join('');
  const turunOpt = (S.jadwal.turun || []).map(t => `<option ${t.nama === S.turun ? 'selected' : ''}>${esc(t.nama)}</option>`).join('');
  const bottom = `<div class="bottom-bar no-print"><div class="timer" style="justify-content:space-between" ${PETA.kunci_berakhir ? '' : 'hidden'} data-timerbox>Kursi dikunci <b data-cd>10:00</b></div><div class="spread"><div id="bb-sum"><b>${S.kursi.length}/${S.pax} kursi</b><div class="muted num" style="font-size:14px">${rp(r.total)}</div></div><button class="btn btn-primary" data-lanjut ${siap ? '' : 'disabled'}>Lanjut</button></div></div>`;
  tampil(`${progress(2)}<div id="offline" class="banner warn" role="alert" style="margin-bottom:16px" hidden><b>Koneksi terputus.</b>&nbsp;Status kursi mungkin belum terbaru. Kursi dicek ulang saat Anda menekan Lanjut.</div>
    <div class="seat-layout"><section class="card bus" aria-label="Peta kursi">
      <div class="spread" style="width:100%"><div><h2 style="font-size:17px">Pilih ${S.pax} kursi</h2><span class="hint">${tglPanjang(S.jadwal.tanggal)} · ${jam(S.jadwal.jam)} · ${esc(S.asal)} → ${esc(S.tujuan)} · ${esc(S.jadwal.armada)}</span></div><span class="badge b-ok" id="live">● Langsung</span></div>
      <div class="legend"><span><i></i>Tersedia</span><span><i class="mine"></i>Pilihan Anda</span><span><i class="held"></i>Sedang dipilih</span><span><i class="taken"></i>Terisi</span><span><i class="vip"></i>VIP</span></div>
      <div class="bus-body"><div class="bus-front"><span class="wheel" title="Sopir">S</span><span>DEPAN</span><span class="door">Pintu</span></div><div id="peta">${petaHtml()}</div><div class="bus-front" style="margin:14px 0 0"><span></span><span class="door">Toilet</span></div></div>
    </section>
    <aside class="card side-panel"><div class="timer" ${PETA.kunci_berakhir ? '' : 'hidden'} data-timerbox role="timer">Kursi dikunci untuk Anda <b data-cd>10:00</b></div><div class="stack" id="sum">${r.html}</div>
      ${naikOpt ? `<div class="field"><label for="naik">Titik naik</label><select id="naik" class="select">${naikOpt}</select></div>` : ''}
      ${turunOpt ? `<div class="field"><label for="turun">Titik turun</label><select id="turun" class="select">${turunOpt}</select></div>` : ''}
      <button class="btn btn-primary btn-block" data-lanjut ${siap ? '' : 'disabled'}>Lanjut</button><span class="hint">Pilih ${S.pax} kursi untuk lanjut.</span></aside></div>`, { bottom });
  const segarkan = () => {
    $('#peta').innerHTML = petaHtml(); const r2 = ringkasKursi(); $('#sum').innerHTML = r2.html;
    $('#bb-sum').innerHTML = `<b>${S.kursi.length}/${S.pax} kursi</b><div class="muted num" style="font-size:14px">${rp(r2.total)}</div>`;
    $$('[data-lanjut]').forEach(b => b.disabled = S.kursi.length !== S.pax);
    $$('[data-timerbox]').forEach(b => b.hidden = !PETA.kunci_berakhir);
  };
  let tunda = null;
  const muatUlang = () => { clearTimeout(tunda); tunda = setTimeout(async () => { try { await muatPeta(); segarkan(); } catch (e) {} }, 250); };
  channel = sb.channel('kursi-' + S.jadwal.id).on('postgres_changes', { event: '*', schema: 'public', table: 'seat_status', filter: 'jadwal_id=eq.' + S.jadwal.id }, muatUlang)
    .subscribe(st => { const off = st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED'; $('#offline') && ($('#offline').hidden = !off); $('#live') && ($('#live').textContent = off ? 'Tidak sinkron' : '● Langsung'); });
  $('#peta').onclick = async e => {
    const b = e.target.closest('[data-seat]'); if (!b || b.disabled) return;
    const no = b.dataset.seat; const k = PETA.kursi.find(x => x.no === no);
    if (k.status === 'held') { toast(`Kursi ${no} sedang dipilih penumpang lain. Silakan pilih kursi lain.`, 'bad'); return; }
    if (k.status === 'mine') { await sb.rpc('lepas_kursi', { p_jadwal: S.jadwal.id, p_tanggal: S.jadwal.tanggal, p_kursi: no, p_sesi: S.sesi }); await muatPeta(); segarkan(); return; }
    if (S.kursi.length >= S.pax) { toast(S.pax >= SET.maks_kursi ? `Maksimal ${SET.maks_kursi} kursi per pesanan` : `Anda memesan ${S.pax} kursi. Lepas satu kursi untuk memilih yang lain.`, S.pax >= SET.maks_kursi ? 'bad' : ''); return; }
    b.disabled = true;
    try {
      const r = await rpc('kunci_kursi', { p_jadwal: S.jadwal.id, p_tanggal: S.jadwal.tanggal, p_kursi: no, p_sesi: S.sesi });
      if (!r.ok) { toast(r.alasan === 'kursi_diambil' ? `Kursi ${no} baru saja dipilih penumpang lain. Silakan pilih kursi lain.` : pesanGalat(r.alasan), 'bad'); }
      await muatPeta(); segarkan();
    } catch (err) { toast(pesanGalat(err), 'bad'); b.disabled = false; }
  };
  const nk = $('#naik'); if (nk) nk.onchange = e => { S.naik = e.target.value; simpan(); };
  const tk = $('#turun'); if (tk) tk.onchange = e => { S.turun = e.target.value; simpan(); };
  $$('[data-lanjut]').forEach(b => b.onclick = () => { location.hash = 'data'; });
  timers.push(setInterval(() => {
    if (!PETA || !PETA.kunci_berakhir) return;
    const left = new Date(PETA.kunci_berakhir) - Date.now();
    $$('[data-cd]').forEach(el => el.textContent = mmss(left));
    $$('[data-timerbox]').forEach(el => el.classList.toggle('low', left < 60000));
    if (left <= 0 && !$('#modal')) {
      PETA.kunci_berakhir = null; S.kursi = []; simpan();
      const m = modal('<h3>Waktu memilih kursi habis.</h3><p style="margin:0;color:var(--ink-2)">Kursi sudah dilepas untuk penumpang lain.</p><button class="btn btn-primary" id="m-re">Pilih ulang</button>');
      $('#m-re', m).onclick = () => { closeModal(); vKursi(); };
    }
  }, 1000));
}

/* ---------- Data penumpang ---------- */
async function vData() {
  if (!S.jadwal || !S.kursi.length) { location.hash = S.jadwal ? 'kursi' : 'beranda'; return; }
  if (!PETA) { try { await muatPeta(); } catch (e) {} }
  const kelas = k => (PETA && PETA.kursi.find(x => x.no === k) || {}).kelas || 'Eksekutif';
  const harga = k => PETA ? PETA.harga[kelas(k)] : 0;
  const sub = S.kursi.reduce((a, k) => a + harga(k), 0);
  const d = S.kontak || {};
  tampil(`${progress(3)}<form class="two-col" id="f-data" novalidate>
    <div class="stack" style="gap:16px">
      <section class="card form-card"><h2>Kontak pemesan</h2><div class="fgrid">
        <div class="field"><label for="cn">Nama lengkap</label><input id="cn" class="input" autocomplete="name" value="${esc(d.nama || '')}" required><span class="err-text" hidden>Nama wajib diisi</span></div>
        <div class="field"><label for="ch">No. HP</label><input id="ch" class="input num" inputmode="tel" autocomplete="tel" value="${esc(d.hp || '')}" required><span class="err-text" hidden>Nomor HP minimal 10 digit</span></div>
        <div class="field" style="grid-column:1/-1"><label for="ce">Email</label><input id="ce" class="input" type="email" autocomplete="email" value="${esc(d.email || '')}" required><span class="hint">E-ticket dan status pembayaran dicek dengan email ini.</span><span class="err-text" hidden>Email tidak valid</span></div>
      </div></section>
      <section class="card form-card"><h2>Data penumpang</h2>${S.kursi.map((k, i) => `<div class="pax-block"><div class="spread"><b>Penumpang ${i + 1} · Kursi ${k}</b><span class="badge b-info">${kelas(k)}</span></div>
        <div class="field"><label for="pn${i}">Nama sesuai identitas</label><input id="pn${i}" class="input" data-kursi="${k}" autocomplete="${i ? 'off' : 'name'}"><span class="err-text" hidden>Nama penumpang wajib diisi</span></div>
        ${i === 0 ? '<label class="check"><input type="checkbox" id="sama"> Sama dengan pemesan</label>' : ''}</div>`).join('')}</section>
    </div>
    <aside class="card form-card"><h2>Rincian harga</h2>
      ${S.kursi.map(k => `<div class="kv"><span>Kursi ${k} · ${kelas(k)}</span><span class="num">${rp(harga(k))}</span></div>`).join('')}
      <div class="field"><label for="promo">Kode promo</label><input id="promo" class="input mono" placeholder="Opsional" value="${esc(S.promo || '')}"><span class="hint">Potongan dihitung saat Anda lanjut.</span></div>
      <div class="kv total"><span>Subtotal</span><span class="num">${rp(sub)}</span></div>
      <p class="hint" style="margin:0">Harga sudah termasuk iuran wajib Jasa Raharja</p>
      <label class="check" style="align-items:flex-start"><input type="checkbox" id="setuju" style="margin-top:3px"> <span style="font-size:13px">Saya setuju data saya dipakai untuk pemesanan dan manifest perjalanan sesuai Kebijakan Privasi</span></label>
      <button class="btn btn-primary btn-block" id="lanjut" disabled>Lanjut ke Pembayaran</button>
    </aside></form>`);
  $('#setuju').onchange = e => { $('#lanjut').disabled = !e.target.checked; };
  $('#sama').onchange = e => { if (e.target.checked) $('#pn0').value = $('#cn').value; };
  $('#f-data').onsubmit = async e => {
    e.preventDefault();
    const tandai = (el, bad) => { el.classList.toggle('err', bad); el.parentElement.querySelector('.err-text').hidden = !bad; return bad; };
    let bad = false;
    bad = tandai($('#cn'), !$('#cn').value.trim()) || bad;
    bad = tandai($('#ch'), $('#ch').value.replace(/\D/g, '').length < 10) || bad;
    bad = tandai($('#ce'), !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('#ce').value.trim())) || bad;
    $$('[data-kursi]').forEach(el => { bad = tandai(el, !el.value.trim()) || bad; });
    if (bad) { toast('Lengkapi kolom yang ditandai merah.', 'bad'); return; }
    S.kontak = { nama: $('#cn').value.trim(), hp: $('#ch').value.trim(), email: $('#ce').value.trim() }; S.promo = $('#promo').value.trim().toUpperCase(); simpan();
    const btn = $('#lanjut'); btn.disabled = true; btn.textContent = 'Memproses…';
    try {
      const r = await rpc('buat_pesanan', { p_jadwal: S.jadwal.id, p_tanggal: S.jadwal.tanggal, p_sesi: S.sesi,
        p_penumpang: $$('[data-kursi]').map(el => ({ kursi: el.dataset.kursi, nama: el.value.trim() })),
        p_nama: S.kontak.nama, p_hp: S.kontak.hp, p_email: S.kontak.email, p_titik_naik: S.naik, p_titik_turun: S.turun, p_promo: S.promo || null });
      S.pesanan = r.kode; S.email = S.kontak.email; S.kursi = []; S.jadwal = null; S.promo = ''; simpan();
      location.hash = 'bayar';
    } catch (err) {
      toast(pesanGalat(err), 'bad'); btn.disabled = false; btn.textContent = 'Lanjut ke Pembayaran';
      if ((err.message || '').includes('kunci_kursi_habis')) setTimeout(() => { location.hash = 'kursi'; }, 1200);
    }
  };
}

/* ---------- Pembayaran & e-ticket ---------- */
async function muatPesanan() { return await rpc('cek_pesanan', { p_kode: S.pesanan, p_email: S.email }); }
async function vBayar() {
  if (!S.pesanan) { location.hash = 'pesanan'; return; }
  tampil(progress(4) + '<div class="skeleton" style="height:360px"></div>');
  let p; try { p = await muatPesanan(); } catch (e) { p = null; }
  if (!p) { tampil(kosong('Pesanan tidak ditemukan.', 'Periksa kode booking dan email.', '<a class="btn btn-secondary" href="#pesanan">Cek pesanan</a>')); return; }
  if (p.status === 'lunas') { location.hash = 'eticket'; return; }
  const wa = `Halo CS ${MEREK.nama}, saya butuh bantuan untuk kode booking ${p.kode}.`;
  const ringkas = `<div class="kv"><span>Kode booking</span><b class="mono">${p.kode}</b></div><div class="kv"><span>Jadwal</span><b>${tglPendek(p.tanggal)} · ${jam(p.jam)}</b></div><div class="kv"><span>Rute</span><b>${esc(p.rute)}</b></div><div class="kv"><span>Kursi</span><b>${p.kursi.map(k => k.kursi).join(', ')}</b></div>`;
  if (p.status === 'menunggu_verifikasi') {
    tampil(`${progress(4)}<div class="card status-hero" style="max-width:640px;margin:0 auto"><span class="badge b-warn">Menunggu verifikasi</span><h2>Bukti terkirim.</h2><p style="margin:0;color:var(--ink-2)">Kursi Anda aman sampai pembayaran dicek, biasanya kurang dari 15 menit di jam operasional. Halaman ini diperbarui otomatis.</p>${ringkas}<div class="kv" style="width:100%"><span>Nominal</span><b class="num">${rp(p.total_transfer)}</b></div></div>`, { waText: wa });
    timers.push(setInterval(async () => { try { const x = await muatPesanan(); if (x && x.status !== 'menunggu_verifikasi') { bersih(); vBayar(); } } catch (e) {} }, 15000));
    return;
  }
  if (p.status === 'kedaluwarsa' || p.status === 'batal') {
    tampil(`${progress(4)}<div class="card status-hero" style="max-width:640px;margin:0 auto"><span class="badge b-bad">Kedaluwarsa</span><h2>Waktu pembayaran habis dan kursi sudah dilepas.</h2><p style="margin:0;color:var(--ink-2)">Bila Anda sudah transfer, hubungi CS dengan kode booking <b class="mono">${p.kode}</b>. Kami cocokkan dengan mutasi rekening.</p><div class="row">${SET.wa_tiket ? `<a class="btn btn-primary" href="https://wa.me/${SET.wa_tiket}?text=${encodeURIComponent(wa)}" target="_blank" rel="noopener">Chat CS</a>` : ''}<a class="btn btn-secondary" href="#beranda">Cari ulang</a></div></div>`, { noFab: true });
    return;
  }
  const s = p.total_transfer.toLocaleString('id-ID'); const h3 = s.slice(0, -3), t3 = s.slice(-3);
  tampil(`${progress(4)}<div class="two-col"><div class="stack" style="gap:16px">
      ${p.status === 'ditolak' ? `<div class="banner bad" role="alert"><div><b>Pembayaran belum bisa kami terima:</b> ${esc(p.alasan_tolak)}. Unggah ulang bukti sebelum waktu habis.</div></div>` : ''}
      <section class="card form-card"><div class="timer" role="timer">Selesaikan pembayaran dalam <b data-cd>--:--</b></div>
        <div><span class="hint">Transfer tepat</span><div class="amount num">Rp ${h3}<mark>${t3}</mark></div><div class="row" style="margin-top:6px"><button class="copy" id="salin-nom">Salin nominal</button><span class="hint">Transfer tepat sampai 3 digit terakhir agar cepat terverifikasi</span></div></div>
        <div class="stack" style="gap:10px">${(p.rekening || []).map(r => `<div class="card" style="padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b>${esc(r.bank)}</b><div class="mono">${esc(r.nomor)}</div><span class="hint">a.n. ${esc(r.atas_nama)}</span></div><button class="copy" data-salin="${esc(r.nomor.replace(/\s/g, ''))}">Salin</button></div>`).join('')}</div></section>
      <section class="card form-card"><h2>Unggah bukti transfer</h2>
        <label class="drop" id="drop" for="bukti"><span style="color:var(--brand)">${IC.up}</span><b id="drop-t">Pilih atau seret berkas ke sini</b><span class="hint">JPG, PNG, atau PDF · maksimal 5 MB</span><span class="err-text" id="drop-e" hidden role="alert"></span></label>
        <input type="file" id="bukti" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" class="sr">
        <button class="btn btn-primary btn-block" id="kirim" disabled>Kirim Bukti Pembayaran</button></section></div>
    <aside class="card form-card"><h2>Ringkasan</h2>${ringkas}<div class="kv"><span>Subtotal</span><span class="num">${rp(p.subtotal)}</span></div>${p.potongan ? `<div class="kv"><span>Promo</span><span class="num">− ${rp(p.potongan)}</span></div>` : ''}<div class="kv"><span>Kode unik</span><span class="num">${rp(p.kode_unik)}</span></div><div class="kv total"><span>Transfer</span><span class="num">${rp(p.total_transfer)}</span></div>
      <p class="hint" style="margin:0">Simpan kode booking dan email Anda untuk membuka pesanan ini lagi di menu Cek Pesanan.</p></aside></div>`, { waText: wa });
  $('#salin-nom').onclick = () => copyText(String(p.total_transfer), 'Nominal');
  $$('[data-salin]').forEach(b => b.onclick = () => copyText(b.dataset.salin, 'Nomor rekening'));
  let file = null;
  const pilih = f => {
    const e = $('#drop-e'); const ok = /\.(jpe?g|png|pdf)$/i.test(f.name);
    if (!ok) { e.textContent = 'Format tidak didukung. Pakai JPG, PNG, atau PDF.'; e.hidden = false; $('#drop').className = 'drop err'; file = null; }
    else if (f.size > 5 * 1048576) { e.textContent = `Ukuran maksimal 5 MB. Berkas Anda ${(f.size / 1048576).toFixed(1).replace('.', ',')} MB.`; e.hidden = false; $('#drop').className = 'drop err'; file = null; }
    else { e.hidden = true; $('#drop').className = 'drop has'; $('#drop-t').textContent = f.name; file = f; }
    $('#kirim').disabled = !file;
  };
  $('#bukti').onchange = e => e.target.files[0] && pilih(e.target.files[0]);
  const dz = $('#drop'); dz.ondragover = e => e.preventDefault(); dz.ondrop = e => { e.preventDefault(); e.dataTransfer.files[0] && pilih(e.dataTransfer.files[0]); };
  $('#kirim').onclick = async () => {
    const btn = $('#kirim'); btn.disabled = true; btn.textContent = 'Mengunggah…';
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${p.kode}/${Date.now()}.${ext}`;
      const up = await sb.storage.from('bukti-transfer').upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) throw up.error;
      await rpc('unggah_bukti', { p_kode: p.kode, p_email: S.email, p_path: path });
      toast('Bukti terkirim', 'ok'); bersih(); vBayar();
    } catch (err) { toast(pesanGalat(err), 'bad'); btn.disabled = false; btn.textContent = 'Kirim Bukti Pembayaran'; }
  };
  timers.push(setInterval(() => {
    const left = new Date(p.batas_bayar) - Date.now();
    $$('[data-cd]').forEach(el => el.textContent = mmss(left));
    if (left <= 0) { bersih(); setTimeout(vBayar, 65000); $$('[data-cd]').forEach(el => el.textContent = '00:00'); }
  }, 1000));
}
async function vEticket() {
  if (!S.pesanan) { location.hash = 'pesanan'; return; }
  let p; try { p = await muatPesanan(); } catch (e) { p = null; }
  if (!p || p.status !== 'lunas') { location.hash = 'bayar'; return; }
  tampil(`${progress(6)}<div class="banner ok no-print" style="max-width:720px;margin:0 auto 16px"><b>E-ticket Anda siap.</b>&nbsp;Tunjukkan QR ke petugas saat naik.</div>
    <article class="card ticket"><div class="main">
      <div class="spread">${logoHtml()}<span class="badge b-ok">Lunas</span></div>
      <div><span class="hint">Kode booking</span><div class="booking-code">${p.kode}</div></div>
      <div class="t-route"><div><b class="num">${jam(p.jam)}</b><span class="hint">${esc(p.titik_naik || p.asal)}</span></div><span style="flex:1;height:2px;background:var(--line)"></span><div style="text-align:right"><b class="num">${jam(p.tiba)}</b><span class="hint">${esc(p.titik_turun || p.tujuan)}</span></div></div>
      <div class="t-meta"><div><span>Tanggal</span><b>${tglPanjang(p.tanggal)}</b></div><div><span>Kursi</span><b>${p.kursi.map(k => k.kursi).join(', ')}</b></div><div><span>Armada</span><b>${esc(p.armada)}</b></div>${p.kursi.map(k => `<div><span>${k.kursi} · ${k.kelas}</span><b>${esc(k.nama)}</b></div>`).join('')}</div>
      <p class="hint" style="margin:0">Harga sudah termasuk iuran wajib Jasa Raharja. Datang 30 menit sebelum berangkat.</p></div>
      <div class="qr"><div class="qrbox" id="qr" role="img" aria-label="QR boarding ${p.kode}"></div><span class="hint mono">${p.kode}</span>
        <button class="btn btn-primary btn-sm btn-block no-print" onclick="window.print()">Cetak / simpan PDF</button></div></article>`,
    { waText: `Halo CS ${MEREK.nama}, saya butuh bantuan untuk kode booking ${p.kode}.` });
  renderQR($('#qr'), p.qr || p.kode);
}
function vCekPesanan() {
  tampil(`<h1 style="font-size:24px;margin-bottom:16px;text-align:center">Cek pesanan</h1>
    <form class="card form-card" id="f-cek" style="max-width:480px;margin:0 auto" novalidate>
      <div class="field"><label for="kode">Kode booking</label><input id="kode" class="input mono" maxlength="6" placeholder="NL7K2M" value="${esc(S.pesanan || '')}"></div>
      <div class="field"><label for="em">Email pemesan</label><input id="em" class="input" type="email" value="${esc(S.email || '')}"></div>
      <span class="err-text" id="cek-e" hidden></span><button class="btn btn-primary">Buka pesanan</button></form>`);
  $('#f-cek').onsubmit = async e => {
    e.preventDefault(); S.pesanan = $('#kode').value.trim().toUpperCase(); S.email = $('#em').value.trim(); simpan();
    let p = null; try { p = await muatPesanan(); } catch (x) {}
    if (!p) { const er = $('#cek-e'); er.textContent = PESAN_GALAT.pesanan_tidak_ada; er.hidden = false; return; }
    location.hash = p.status === 'lunas' ? 'eticket' : 'bayar';
  };
}

/* ---------- Cargo ---------- */
async function vOngkir() {
  const kolis = S.koli.map((k, i) => `<div class="koli" data-i="${i}"><span class="no">#${i + 1}</span>
      <div class="field f-w"><label for="kw${i}">Berat (kg)</label><input id="kw${i}" class="input num" type="number" min="0.1" step="0.1" value="${k.berat}" data-k="berat"></div>
      <div class="field f-p"><label for="kp${i}">P (cm)</label><input id="kp${i}" class="input num" type="number" min="1" value="${k.p}" data-k="p"></div>
      <div class="field f-l"><label for="kl${i}">L (cm)</label><input id="kl${i}" class="input num" type="number" min="1" value="${k.l}" data-k="l"></div>
      <div class="field f-t"><label for="kt${i}">T (cm)</label><input id="kt${i}" class="input num" type="number" min="1" value="${k.t}" data-k="t"></div>
      <button type="button" class="btn btn-text" data-del="${i}" aria-label="Hapus koli ${i + 1}" ${S.koli.length < 2 ? 'disabled' : ''} style="height:44px">✕</button></div>`).join('');
  tampil(`<h1 style="font-size:24px;margin-bottom:16px">Cek ongkir cargo</h1><div class="two-col">
    <section class="card form-card">
      <div class="fgrid"><div class="field"><label for="ca">Kota asal</label><select id="ca" class="select">${opsi(KOTA_CARGO.asal, S.cAsal)}</select></div><div class="field"><label for="ct">Kota tujuan</label><select id="ct" class="select">${opsi(KOTA_CARGO.tujuan, S.cTujuan)}</select></div></div>
      <div class="field"><label for="ly">Layanan</label><select id="ly" class="select">${LAYANAN.map(l => `<option value="${esc(l.nama)}" ${l.nama === S.layanan ? 'selected' : ''}>${esc(l.nama)} · ${esc(l.janji || '')}</option>`).join('')}</select></div>
      <h2>Koli</h2><div class="stack" id="kolis">${kolis}</div>
      <button class="btn btn-secondary" id="addk" style="align-self:flex-start">+ Tambah koli</button>
      <label class="switch"><input type="checkbox" id="ins" ${S.asuransi ? 'checked' : ''}> Asuransi barang</label>
      <div class="field" id="nilai-f" ${S.asuransi ? '' : 'hidden'}><label for="nilai">Nilai barang (Rp)</label><input id="nilai" class="input num" type="number" min="0" step="50000" value="${S.nilai || ''}"></div>
    </section>
    <aside class="card calc-res" id="hasil" aria-live="polite"><div class="skeleton" style="height:200px"></div></aside></div>`, { wa: SET.wa_cargo, waText: `Halo CS ${MEREK.nama}, saya mau tanya pengiriman cargo.` });
  let t = null;
  const hitung = () => { clearTimeout(t); t = setTimeout(async () => {
    simpan();
    let r; try { r = await rpc('hitung_ongkir', { p_asal: S.cAsal, p_tujuan: S.cTujuan, p_layanan: S.layanan, p_koli: S.koli, p_asuransi: S.asuransi, p_nilai: S.nilai || 0 }); } catch (e) { r = { ok: false, alasan: e.message }; }
    $('#hasil').innerHTML = !r.ok ? `<div class="banner bad" role="alert"><div><b>${esc(pesanGalat(r.alasan))}</b></div></div><button class="btn btn-primary btn-block" disabled>Buat Pengiriman</button>` :
      r.koli.map((x, i) => `<div class="wt"><span>Koli #${i + 1} · aktual</span><b class="num">${x.berat.toLocaleString('id-ID')} kg</b><span>Volume (P×L×T ÷ ${r.pembagi})</span><b class="num">${Number(x.volume).toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg</b><span>Berat tertagih</span><b class="num">${x.tertagih} kg <span class="badge b-accent">${x.dipakai === 'volume' ? 'volume dipakai' : 'aktual dipakai'}</span></b></div>`).join('') +
      `<div class="kv"><span>${r.berat_tertagih} kg × ${rp(r.per_kg)}</span><span class="num">${rp(r.ongkir_dasar)}</span></div>
      ${r.kena_minimum ? `<div class="kv"><span>Minimum charge</span><span class="num">${rp(r.min_charge)}</span></div>` : ''}
      ${S.asuransi && r.asuransi ? `<div class="kv"><span>Asuransi ${String(r.asuransi_persen).replace('.', ',')}% × ${rp(S.nilai)}</span><span class="num">${rp(r.asuransi)}</span></div>` : ''}
      <div class="kv total"><span>Estimasi ongkir</span><span class="num">${rp(r.total)}</span></div><div class="kv"><span>Estimasi tiba</span><b>${esc(r.estimasi_teks || r.estimasi)}</b></div>
      ${r.gudang ? `<div class="kv"><span>Serahkan di</span><b>${esc(r.gudang.nama)} · ${esc(r.gudang.jam)}</b></div>` : ''}
      <p class="hint" style="margin:0">Estimasi ongkir. Ongkir final setelah barang ditimbang di gudang.</p>
      <a class="btn btn-primary btn-block" href="#kirim">Buat Pengiriman</a>`;
  }, 250); };
  $('#ca').onchange = e => { S.cAsal = e.target.value; hitung(); };
  $('#ct').onchange = e => { S.cTujuan = e.target.value; hitung(); };
  $('#ly').onchange = e => { S.layanan = e.target.value; hitung(); };
  $('#kolis').oninput = e => { const el = e.target; if (!el.dataset.k) return; const i = +el.closest('[data-i]').dataset.i; S.koli[i][el.dataset.k] = parseFloat(el.value) || 0; hitung(); };
  $$('[data-del]').forEach(b => b.onclick = () => { S.koli.splice(+b.dataset.del, 1); simpan(); vOngkir(); });
  $('#addk').onclick = () => { S.koli.push({ berat: 1, p: 20, l: 20, t: 20 }); simpan(); vOngkir(); };
  $('#ins').onchange = e => { S.asuransi = e.target.checked; $('#nilai-f').hidden = !S.asuransi; hitung(); };
  $('#nilai').oninput = e => { S.nilai = +e.target.value || 0; hitung(); };
  hitung();
}
function vKirim() {
  const d = S.kirim || {};
  tampil(`<h1 style="font-size:24px;margin-bottom:16px">Buat pengiriman</h1><form class="two-col" id="f-kirim" novalidate>
    <div class="stack" style="gap:16px">
      <section class="card form-card"><h2>Pengirim</h2><div class="fgrid">
        <div class="field"><label for="pn">Nama</label><input id="pn" class="input" autocomplete="name" value="${esc(d.pn || '')}"></div>
        <div class="field"><label for="ph">No. HP</label><input id="ph" class="input num" inputmode="tel" value="${esc(d.ph || '')}"></div>
        <div class="field" style="grid-column:1/-1"><label for="pe">Email (untuk notifikasi status)</label><input id="pe" class="input" type="email" value="${esc(d.pe || '')}"></div></div></section>
      <section class="card form-card"><h2>Penerima</h2><div class="fgrid">
        <div class="field"><label for="rn">Nama</label><input id="rn" class="input" value="${esc(d.rn || '')}"></div>
        <div class="field"><label for="rh">No. HP</label><input id="rh" class="input num" inputmode="tel" value="${esc(d.rh || '')}"></div>
        <div class="field" style="grid-column:1/-1"><label for="ra">Alamat lengkap</label><textarea id="ra" class="input" style="height:80px;padding:10px">${esc(d.ra || '')}</textarea></div></div></section>
      <section class="card form-card"><h2>Barang</h2>
        <div class="field"><label for="jb">Jenis barang</label><input id="jb" class="input" placeholder="Contoh: pakaian, dokumen, suku cadang" value="${esc(d.jb || '')}"></div>
        <div class="field"><label for="cat">Catatan (opsional)</label><input id="cat" class="input" value="${esc(d.cat || '')}"></div></section>
    </div>
    <aside class="card form-card"><h2>Ringkasan</h2><div class="kv"><span>Rute</span><b>${esc(S.cAsal)} → ${esc(S.cTujuan)}</b></div><div class="kv"><span>Layanan</span><b>${esc(S.layanan)}</b></div><div class="kv"><span>Koli</span><b>${S.koli.length}</b></div>${S.asuransi ? `<div class="kv"><span>Asuransi</span><b>${rp(S.nilai)}</b></div>` : ''}
      <span class="err-text" id="kirim-e" hidden role="alert"></span>
      <button class="btn btn-primary btn-block" id="buat">Buat Pengiriman</button><a class="btn btn-text" href="#ongkir">Ubah koli</a></aside></form>`, { wa: SET.wa_cargo });
  $('#f-kirim').onsubmit = async e => {
    e.preventDefault();
    S.kirim = { pn: $('#pn').value, ph: $('#ph').value, pe: $('#pe').value, rn: $('#rn').value, rh: $('#rh').value, ra: $('#ra').value, jb: $('#jb').value, cat: $('#cat').value }; simpan();
    const b = $('#buat'); b.disabled = true; b.textContent = 'Memproses…';
    try {
      const r = await rpc('buat_pengiriman', { p_asal: S.cAsal, p_tujuan: S.cTujuan, p_layanan: S.layanan, p_koli: S.koli, p_asuransi: S.asuransi, p_nilai: S.nilai || 0,
        p_pengirim: { nama: S.kirim.pn, hp: S.kirim.ph, email: S.kirim.pe }, p_penerima: { nama: S.kirim.rn, hp: S.kirim.rh, alamat: S.kirim.ra }, p_jenis: S.kirim.jb, p_catatan: S.kirim.cat || null });
      S.resiBaru = r; S.resi = r.resi; simpan(); location.hash = 'resi';
    } catch (err) { const er = $('#kirim-e'); er.textContent = pesanGalat(err); er.hidden = false; b.disabled = false; b.textContent = 'Buat Pengiriman'; }
  };
}
function vResi() {
  const r = S.resiBaru; if (!r) { location.hash = 'lacak'; return; }
  const link = location.origin + location.pathname + '?po=' + MEREK.slug + '#lacak';
  tampil(`<div class="card resi-box" style="max-width:640px;margin:0 auto"><span class="badge b-ok">Pengiriman dibuat</span><span class="hint">Nomor resi</span><div class="resi-no">${r.resi}</div><svg id="bc" role="img" aria-label="Barcode ${r.resi}"></svg>
    <div class="stack" style="width:100%;text-align:left;gap:8px"><div class="kv"><span>Rute</span><b>${esc(S.cAsal)} → ${esc(S.cTujuan)}</b></div><div class="kv"><span>Koli</span><b>${r.koli} koli · ${esc(S.layanan)}</b></div><div class="kv"><span>Estimasi ongkir</span><b class="num">${rp(r.estimasi_ongkir)}</b></div>${r.gudang ? `<div class="kv"><span>Serahkan barang di</span><b>${esc(r.gudang.nama)} · ${esc(r.gudang.jam)}</b></div>` : ''}</div>
    <div class="banner info" style="text-align:left"><div>Bayar ongkir final di loket gudang setelah barang ditimbang. Bawa resi ini atau sebutkan nomornya.</div></div>
    <div class="row no-print" style="justify-content:center"><button class="btn btn-primary" onclick="window.print()">Cetak resi</button><button class="btn btn-secondary" id="cl">Salin nomor resi</button><a class="btn btn-secondary" href="https://wa.me/?text=${encodeURIComponent('Lacak kiriman ' + MEREK.nama + ' ' + r.resi + ': ' + link)}" target="_blank" rel="noopener">Bagikan ke WhatsApp</a></div></div>`, { wa: SET.wa_cargo });
  renderBarcode($('#bc'), r.resi);
  $('#cl').onclick = () => copyText(r.resi, 'Nomor resi');
}
const LABEL = { dibuat: 'Pengiriman dibuat', diterima_asal: 'Diterima di gudang asal', dalam_perjalanan: 'Dalam perjalanan', tiba_tujuan: 'Tiba di gudang tujuan', siap_diambil: 'Siap diambil / diantar', diterima: 'Diterima', batal: 'Dibatalkan' };
async function vLacak() {
  const form = `<form id="f-l" class="row" style="max-width:640px;margin:0 auto 20px;flex-wrap:nowrap"><label class="sr" for="lr">Nomor resi</label><input id="lr" class="input mono" maxlength="12" placeholder="NLC261113A7K" value="${esc(S.resi || '')}"><button class="btn btn-primary">Lacak</button></form>`;
  let r = null;
  if (S.resi) { try { r = await rpc('lacak_resi', { p_resi: S.resi }); } catch (e) {} }
  const body = !S.resi ? '' : !r ? `<div class="card empty" style="max-width:640px;margin:0 auto"><h3>Nomor resi tidak ditemukan.</h3><p>Periksa kembali 12 karakter pada resi Anda. Nomor resi diawali NLC.</p></div>` :
    `<div class="card" style="max-width:640px;margin:0 auto;padding:20px 24px;display:flex;flex-direction:column;gap:18px">
      <div class="spread"><div><span class="hint">Resi</span><div class="mono" style="font-size:20px;font-weight:600">${r.resi}</div></div><span class="badge ${r.status === 'diterima' ? 'b-ok' : 'b-info'}">${LABEL[r.status]}</span></div>
      <div class="t-meta"><div><span>Rute</span><b>${esc(r.asal)} → ${esc(r.tujuan)}</b></div><div><span>Layanan</span><b>${esc(r.layanan)} · ${r.koli} koli</b></div><div><span>Estimasi tiba</span><b>${r.estimasi_tiba ? tglPendek(r.estimasi_tiba) : '—'}</b></div></div>
      <ol class="timeline">${(r.timeline || []).map((t, i) => `<li class="${i === 0 ? (t.status === 'diterima' ? 'ok' : 'now') : ''}"><span class="dot"></span><div><h4>${LABEL[t.status]}</h4><p>${waktu(t.waktu)}${t.lokasi ? ' · ' + esc(t.lokasi) : ''}${t.catatan ? ' · ' + esc(t.catatan) : ''}</p>${t.status === 'diterima' && r.penerima ? `<p>Diterima oleh ${esc(r.penerima)}${r.ada_foto ? ' · foto tersimpan' : ''}${r.ada_ttd ? ' · tanda tangan tersimpan' : ''}</p>` : ''}</div></li>`).join('')}</ol></div>`;
  tampil(`<h1 style="font-size:24px;margin-bottom:16px;text-align:center">Lacak kiriman</h1>${form}${body}`, { wa: SET.wa_cargo });
  $('#f-l').onsubmit = e => { e.preventDefault(); S.resi = $('#lr').value.trim().toUpperCase(); simpan(); vLacak(); };
}
async function vBantuan() {
  const { data } = await sb.from('konten').select('judul,isi').eq('jenis', 'faq').eq('status', 'terbit').order('urutan');
  const { data: br } = await sb.from('branch').select('nama,kota,alamat,jam_operasional').eq('aktif', true);
  tampil(`<h1 style="font-size:24px;margin-bottom:16px">Bantuan</h1><div class="two-col"><section class="card form-card faq"><h2>Pertanyaan umum</h2>${(data || []).map(f => `<details><summary>${esc(f.judul)}</summary><p>${esc(f.isi)}</p></details>`).join('') || '<p class="muted">Belum ada FAQ.</p>'}</section>
    <aside class="card form-card"><h2>Kantor dan pool</h2>${(br || []).map(b => `<div><b>${esc(b.nama)}</b><div class="hint">${esc(b.alamat || b.kota)} · ${esc(b.jam_operasional || '')}</div></div>`).join('')}${SET.wa_tiket ? `<a class="btn btn-primary" href="https://wa.me/${SET.wa_tiket}" target="_blank" rel="noopener">Chat CS Tiket</a>` : ''}${SET.wa_cargo ? `<a class="btn btn-secondary" href="https://wa.me/${SET.wa_cargo}" target="_blank" rel="noopener">Chat CS Cargo</a>` : ''}</aside></div>`);
}

/* ---------- Router ---------- */
const RUTE = { beranda: vBeranda, jadwal: vJadwal, kursi: vKursi, data: vData, bayar: vBayar, eticket: vEticket, pesanan: vCekPesanan, ongkir: vOngkir, kirim: vKirim, resi: vResi, lacak: vLacak, bantuan: vBantuan };
async function route() {
  bersih();
  const h = location.hash.slice(1) || 'beranda';
  try { await (RUTE[h] || vBeranda)(); } catch (e) { console.error(e); tampil(kosong('Halaman gagal dimuat.', esc(pesanGalat(e)), '<a class="btn btn-secondary" href="#beranda">Ke beranda</a>')); }
}
(async function init() {
  let q = new URLSearchParams(location.search).get('po');
  try { if (q) localStorage.setItem('nl-po', q.toLowerCase()); else q = localStorage.getItem('nl-po'); } catch (e) { }
  const { data: tn } = await sb.rpc('tenant_info', { p_slug: q || null, p_host: location.hostname });
  pakaiTenant((tn && tn.slug) || 'nusalaju');
  const [st, rt, zn, ly] = await Promise.all([
    sb.from('settings').select('*').maybeSingle(),
    sb.from('rute').select('asal,tujuan').eq('aktif', true),
    sb.from('zona').select('asal,tujuan').eq('aktif', true),
    sb.from('layanan').select('nama,janji').eq('aktif', true)
  ]);
  if (st.data) { SET = st.data; pakaiMerek(SET); document.title = `${MEREK.nama} · Tiket Bus & Cargo`; }
  KOTA = [...new Set((rt.data || []).flatMap(r => [r.asal, r.tujuan]))].sort();
  KOTA_CARGO = { asal: [...new Set((zn.data || []).map(z => z.asal))].sort(), tujuan: [...new Set((zn.data || []).map(z => z.tujuan))].sort() };
  LAYANAN = ly.data || [];
  if (!KOTA.includes(S.asal)) S.asal = KOTA[0]; if (!KOTA.includes(S.tujuan)) S.tujuan = KOTA[1] || KOTA[0];
  window.addEventListener('hashchange', route);
  route();
})();
