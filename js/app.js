(() => {
const $ = s => document.querySelector(s);
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const GOL = { II: 'Gol. II', III: 'Gol. III', KASI: 'Istri Kepala Seksi Bidang' };
const blnLabel = p => BLN[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4);
const today = () => new Date().toLocaleDateString('sv-SE');
let token = sessionStorage.getItem('kas_token'), st = { anggota: [], tarif: {} };
const ICO = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  transaksi: '<path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4"/>',
  arisan: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 010 5"/>',
  anggota: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3.5 3.5 0 010 7M22 20c0-3-1.5-5-4-5.5"/>',
  pengaturan: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  laporan: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2M3 10h18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'
};
const ic = (n, z = 18) => `<svg viewBox="0 0 24 24" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[n]}</svg>`;
const head = (i, t, sub, act = '') => `<div class="ph"><span class="pi">${ic(i, 22)}</span><div><h2>${t}</h2><p>${sub}</p></div>${act}</div>`;
const tag = x => x.tipe === 'masuk' ? '<span class="tag g">Pemasukan</span>' : '<span class="tag r">Pengeluaran</span>';

async function api(action, data = {}) {
  const res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token, ...data }) });
  const j = await res.json();
  if (!j.ok) { if (j.auth) logout(); throw new Error(j.error); }
  return j.data;
}
let tt, wajib = false;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => t.className = '', 3500); }
async function run(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message || 'Terjadi kesalahan', true); } finally { if (btn) btn.disabled = false; }
}
const readB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
const safeUrl = u => /^https:\/\/(drive|docs)\.google\.com\//.test(u) ? u : '';

/* ---- Login ---- */
$('#fLogin').onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  run(e.target.querySelector('button'), async () => {
    token = (await api('login', { username: f.get('username'), password: f.get('password') })).token;
    sessionStorage.setItem('kas_token', token); e.target.reset(); await start();
  });
};
function logout() {
  if (token) fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'logout', token }) }).catch(() => {});
  token = null; sessionStorage.removeItem('kas_token'); $('#app').hidden = true; $('#login').hidden = false;
}
$('#logout').onclick = logout;
async function start() { st = await api('init'); wajib = !!st.wajibGanti; const isW = st.role === 'wakil'; $('.user b').textContent = isW ? 'Wakil Bendahara' : 'Bendahara'; $('.av').textContent = isW ? 'W' : 'B'; $('#login').hidden = true; $('#app').hidden = false; go('dashboard'); }

/* ---- Navigasi ---- */
const views = { dashboard: vDash, transaksi: vTrx, arisan: vArisan, anggota: vAnggotaView, pengaturan: vSet, laporan: vLaporan };
function go(v) {
  if (wajib) v = 'pengaturan';
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#view').onclick = null; $('#view').onchange = null;
  $('#view').innerHTML = '<p>Memuat…</p>';
  run(null, () => views[v]()).catch(() => {});
}
$('#nav').onclick = e => { const b = e.target.closest('[data-v]'); if (b) go(b.dataset.v); };

/* ---- Tabel transaksi ---- */
function tblTrx(list, del) {
  if (!list.length) return '<p>Belum ada transaksi.</p>';
  return `<div class="tw"><table><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Uraian</th><th class="r">Nominal</th><th>Bukti</th>${del ? '<th>Aksi</th>' : ''}</tr>` +
    list.map(x => `<tr><td>${esc(x.tanggal)}</td><td>${tag(x)}</td><td><span class="tag n">${esc(x.kategori)}</span></td><td>${esc(x.nama)}${x.periode ? ' (' + esc(x.periode) + ')' : ''} ${esc(x.keterangan)}</td>
    <td class="r ${x.tipe === 'masuk' ? 'in' : 'out'}">${x.tipe === 'masuk' ? '+' : '−'}${rp(x.jumlah)}</td>
    <td>${safeUrl(x.bukti) ? `<a href="${esc(x.bukti)}" target="_blank" rel="noopener">Lihat</a>` : '–'}</td>
    ${del ? `<td><button class="del" data-del="${esc(x.id)}">Hapus</button></td>` : ''}</tr>`).join('') + '</table></div>';
}

/* ---- Dashboard ---- */
async function vDash() {
  const d = await api('dashboard');
  $('#view').innerHTML = head('dashboard', `Dashboard <span class="pill">${blnLabel(d.periode)}</span>`, 'Ringkasan kas IAD Daerah Seruyan') + `
  <div class="stats">
    <div class="stat a"><div class="ti">${ic('up')}</div><span class="l">Total pemasukan</span><b>${rp(d.totalMasuk)}</b><small>Bulan ini ${rp(d.masukBulan)}</small></div>
    <div class="stat b"><div class="ti">${ic('down')}</div><span class="l">Total pengeluaran</span><b>${rp(d.totalKeluar)}</b><small>Bulan ini ${rp(d.keluarBulan)}</small></div>
    <div class="stat c"><div class="ti">${ic('arisan')}</div><span class="l">Penerima arisan bulan ini</span><b>${d.penerimaArisan ? esc(d.penerimaArisan) : 'Belum ditentukan'}</b><small>${blnLabel(d.periode)}</small></div>
    <div class="stat main"><div class="ti">${ic('wallet')}</div><span class="l">Saldo kas</span><b>${rp(d.saldo)}</b><small>Pemasukan dikurangi pengeluaran</small></div>
  </div>
  <div class="grid2">
    <div class="box"><h3>Belum bayar iuran wajib (${d.belumWajib.length})</h3><p>${d.belumWajib.map(esc).join(', ') || 'Semua sudah bayar bulan ini'}</p></div>
    <div class="box"><h3>Transaksi terbaru</h3>${tblTrx(d.terbaru, false)}</div>
  </div>`;
}

/* ---- Transaksi ---- */
async function vTrx() {
  const all = await api('listTransaksi');
  let q = '', tp = '', pg = 1, sz = 10;
  $('#view').innerHTML = head('transaksi', 'Transaksi', 'Kelola pemasukan dan pengeluaran kas', st.edit ? `<button class="btn" id="add">${ic('plus')} Tambah Transaksi</button>` : '') + `
  <div class="box"><div class="bar"><label class="srch">${ic('search')}<input id="q" placeholder="Cari nama, kategori, atau keterangan…"></label>
    <select id="tp"><option value="">Semua tipe</option><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option></select></div><div id="lst"></div></div>
  <dialog id="dlg"><form id="fTrx" class="form"><h3>Tambah transaksi</h3>
    <div class="seg"><label><input type="radio" name="tipe" value="masuk" checked> Pemasukan</label><label><input type="radio" name="tipe" value="keluar"> Pengeluaran</label></div>
    <label>Tanggal<input type="date" name="tanggal" value="${today()}" required></label>
    <label data-m>Kategori<select name="kategori"><option value="arisan">Arisan</option><option value="jimpitan">Jimpitan</option><option value="wajib">Iuran wajib</option><option value="lainnya">Lainnya</option></select></label>
    <label data-k hidden>Kategori pengeluaran<input name="kategoriK" maxlength="60" placeholder="mis. Konsumsi, Santunan"></label>
    <label data-m>Anggota<select name="anggotaId"><option value="">— pilih —</option>${st.anggota.map(a => `<option value="${esc(a.id)}">${esc(a.nama)}</option>`).join('')}</select></label>
    <label data-m>Periode<input type="month" name="periode" value="${today().slice(0, 7)}"></label>
    <label>Jumlah (Rp)<input type="number" name="jumlah" min="1" required></label>
    <label>Keterangan<input name="keterangan" maxlength="300"></label>
    <label data-k hidden>Bukti pengeluaran (JPG/PNG/PDF, maks. 5 MB)<input type="file" name="file" accept="image/jpeg,image/png,application/pdf"></label>
    <div class="acts"><button type="button" class="ghost2" id="cancel">Batal</button><button class="btn">Simpan</button></div>
  </form></dialog>`;
  const draw = () => {
    const s = q.toLowerCase(), f = all.filter(x => (!tp || x.tipe === tp) && (!s || [x.nama, x.kategori, x.keterangan].join(' ').toLowerCase().includes(s)));
    const pages = Math.max(1, Math.ceil(f.length / sz)); pg = Math.min(pg, pages);
    $('#lst').innerHTML = tblTrx(f.slice((pg - 1) * sz, pg * sz), st.edit) +
      `<div class="pg"><span>${f.length ? (pg - 1) * sz + 1 : 0}–${Math.min(pg * sz, f.length)} dari ${f.length} transaksi</span><span>Baris:<select id="sz">${[5, 10, 20, 50].map(n => `<option ${n === sz ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="ghost2" id="pv" ${pg <= 1 ? 'disabled' : ''}>‹</button> ${pg}/${pages} <button class="ghost2" id="nx" ${pg >= pages ? 'disabled' : ''}>›</button></span></div>`;
    $('#sz').onchange = e => { sz = +e.target.value; pg = 1; draw(); };
    $('#pv').onclick = () => { pg--; draw(); }; $('#nx').onclick = () => { pg++; draw(); };
  };
  draw();
  $('#q').oninput = e => { q = e.target.value; pg = 1; draw(); };
  $('#tp').onchange = e => { tp = e.target.value; pg = 1; draw(); };
  if ($('#add')) $('#add').onclick = () => $('#dlg').showModal();
  $('#cancel').onclick = () => $('#dlg').close();
  const f = $('#fTrx');
  const auto = () => {
    if (f.tipe.value !== 'masuk') return;
    const k = f.kategori.value, m = st.anggota.find(a => a.id === f.anggotaId.value);
    const v = k === 'arisan' ? st.tarif.arisan : k === 'jimpitan' ? st.tarif.jimpitan : k === 'wajib' && m ? st.tarif.wajib[m.golongan] : '';
    if (v) f.jumlah.value = v;
  };
  const sync = () => {
    const keluar = f.tipe.value === 'keluar';
    f.querySelectorAll('[data-m]').forEach(e => e.hidden = keluar);
    f.querySelectorAll('[data-k]').forEach(e => e.hidden = !keluar);
    auto();
  };
  f.onchange = e => (e.target.name === 'tipe' ? sync() : auto());
  f.onsubmit = e => {
    e.preventDefault();
    run(f.querySelector('.btn'), async () => {
      const keluar = f.tipe.value === 'keluar', d = {
        tipe: f.tipe.value, tanggal: f.tanggal.value, jumlah: f.jumlah.value, keterangan: f.keterangan.value,
        kategori: keluar ? f.kategoriK.value : f.kategori.value, anggotaId: f.anggotaId.value, periode: f.periode.value
      };
      if (keluar) {
        const file = f.file.files[0];
        if (!file) throw new Error('Bukti pengeluaran wajib diunggah.');
        if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran bukti maksimal 5 MB.');
        d.file = { mime: file.type, data: await readB64(file) };
      }
      await api('addTransaksi', d); toast('Transaksi tersimpan'); vTrx();
    });
  };
  $('#lst').onclick = e => {
    const id = e.target.dataset.del;
    if (id && confirm('Hapus transaksi ini?')) run(e.target, async () => { await api('deleteTransaksi', { id }); toast('Transaksi dihapus'); vTrx(); });
  };
}

/* ---- Arisan ---- */
async function vArisan(tahun = new Date().getFullYear()) {
  const rows = await api('listArisan', { tahun });
  $('#view').innerHTML = head('arisan', 'Penerima Arisan', 'Atur penerima arisan tiap bulan') + `
  <div class="box"><label>Tahun<input type="number" id="thn" value="${tahun}" min="2020" max="2100" style="max-width:120px"></label>
  <div class="tw"><table><tr><th>Bulan</th><th>Penerima</th></tr>${rows.map((r, i) => `<tr><td>${BLN[i]}</td><td>
    <select data-p="${r.periode}" ${st.edit ? '' : 'disabled'}><option value="">— belum ditentukan —</option>${st.anggota.map(a => `<option value="${esc(a.id)}" ${a.id === r.anggotaId ? 'selected' : ''}>${esc(a.nama)}</option>`).join('')}</select></td></tr>`).join('')}</table></div></div>`;
  $('#thn').onchange = e => run(null, () => vArisan(e.target.value));
  $('#view').onchange = e => { const p = e.target.dataset.p; if (p) run(e.target, async () => { await api('setArisan', { periode: p, anggotaId: e.target.value }); toast('Penerima arisan tersimpan'); }); };
}

/* ---- Anggota ---- */
function vAnggotaView() {
  vAnggota();
  if (!st.edit) { const f = $('#fAng'); if (f) f.remove(); $('#view').querySelectorAll('.del').forEach(b => b.remove()); }
}
function vAnggota() {
  $('#view').innerHTML = head('anggota', 'Anggota', 'Kelola anggota dan golongan iuran wajib') + `
  <div class="grid2"><form id="fAng" class="box"><h3>Tambah anggota</h3>
    <label>Nama<input name="nama" maxlength="80" required></label>
    <label>Golongan / pangkat suami<select name="golongan">${Object.entries(GOL).map(([k, v]) => `<option value="${k}">${v} (${rp(st.tarif.wajib[k])})</option>`).join('')}</select></label>
    <button class="btn">Tambah</button></form>
  <div class="box tw"><table><tr><th>Nama</th><th>Golongan</th><th></th></tr>${st.anggota.map(a => `<tr><td>${esc(a.nama)}</td><td>${esc(GOL[a.golongan] || a.golongan)}</td><td><button class="del" data-del="${esc(a.id)}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="3">Belum ada anggota.</td></tr>'}</table></div></div>`;
  $('#fAng').onsubmit = e => { e.preventDefault(); run(e.target.querySelector('button'), async () => { st.anggota = await api('saveAnggota', { nama: e.target.nama.value, golongan: e.target.golongan.value }); toast('Anggota ditambahkan'); vAnggota(); }); };
  $('#view').onclick = e => { const id = e.target.dataset.del; if (id && confirm('Hapus anggota ini?')) run(e.target, async () => { st.anggota = await api('deleteAnggota', { id }); vAnggota(); }); };
}

/* ---- Pengaturan ---- */
async function vSet() {
  const d = await api('getPengaturan'), full = d.role === 'bendahara' && !wajib;
  $('#view').innerHTML = head('pengaturan', 'Pengaturan', full ? 'Akun, penanda tangan laporan, dan wakil bendahara' : 'Keamanan akun') +
    (wajib ? '<div class="box" style="background:var(--yl);margin-bottom:16px">Ini login pertama. Ganti password awal dulu sebelum memakai aplikasi.</div>' : '') +
    `<div class="grid2">${full ? `<form id="fSet" class="box"><h3>Penanda tangan &amp; akun bendahara</h3>
      <label>Nama Ketua IAD Daerah Seruyan<input name="ketua" maxlength="80" value="${esc(d.ketua)}"></label>
      <label>Nama Bendahara IAD Daerah Seruyan<input name="bendahara" maxlength="80" value="${esc(d.bendahara)}"></label>
      <label>Username bendahara<input name="username" maxlength="40" value="${esc(d.username)}" required></label>
      <h3>Wakil bendahara</h3>
      <label>Nama wakil bendahara<input name="namaWakil" maxlength="80" value="${esc(d.namaWakil)}"></label>
      <label>Username wakil (kosongkan untuk menonaktifkan akun)<input name="usernameWakil" maxlength="40" value="${esc(d.usernameWakil)}"></label>
      <label>Password wakil ${d.adaWakil ? '(kosongkan bila tidak diubah)' : '(password awal, min. 8 karakter)'}<input type="password" name="passwordWakil" autocomplete="new-password" minlength="8"></label>
      <label>Hak akses wakil<select name="hakWakil"><option value="penuh" ${d.hakWakil !== 'cetak' ? 'selected' : ''}>Penuh, sama seperti bendahara (input, hapus, arisan, anggota, cetak PDF)</option><option value="cetak" ${d.hakWakil === 'cetak' ? 'selected' : ''}>Hanya lihat data &amp; cetak PDF</option></select></label>
      <button class="btn">Simpan</button></form>` : ''}
    <form id="fPw" class="box"><h3>Ganti password saya</h3>
      <label>Password lama<input type="password" name="lama" autocomplete="current-password" required></label>
      <label>Password baru (min. 8 karakter)<input type="password" name="baru" autocomplete="new-password" minlength="8" required></label>
      <label>Ulangi password baru<input type="password" name="ulang" autocomplete="new-password" required></label>
      <button class="btn">Ganti password</button></form></div>`;
  const fs = $('#fSet');
  if (fs) fs.onsubmit = e => {
    e.preventDefault();
    run(fs.querySelector('button'), async () => {
      await api('savePengaturan', { ketua: fs.ketua.value, bendahara: fs.bendahara.value, username: fs.username.value, namaWakil: fs.namaWakil.value, usernameWakil: fs.usernameWakil.value, passwordWakil: fs.passwordWakil.value, hakWakil: fs.hakWakil.value });
      toast('Pengaturan tersimpan'); vSet();
    });
  };
  $('#fPw').onsubmit = e => {
    e.preventDefault(); const f = e.target;
    if (f.baru.value !== f.ulang.value) return toast('Ulangi password tidak sama', true);
    run(f.querySelector('button'), async () => {
      await api('gantiPassword', { lama: f.lama.value, baru: f.baru.value });
      const was = wajib; wajib = false; st = await api('init'); f.reset(); toast('Password diganti'); go(was ? 'dashboard' : 'pengaturan');
    });
  };
}

/* ---- Laporan (PDF) ---- */
function vLaporan() {
  const y = new Date().getFullYear();
  $('#view').innerHTML = head('laporan', 'Cetak Laporan', 'Unduh LPJ dan laporan arisan dalam format PDF') + `<div class="grid2">
  <form id="fLpj" class="box"><h3>LPJ IAD Daerah Seruyan</h3>
    <label>Dari tanggal<input type="date" name="dari" value="${y}-01-01" required></label>
    <label>Sampai tanggal<input type="date" name="sampai" value="${today()}" required></label>
    <button class="btn">Unduh LPJ (PDF)</button></form>
  <form id="fArs" class="box"><h3>Laporan Arisan IAD Daerah Seruyan</h3>
    <label>Tahun<input type="number" name="tahun" value="${y}" min="2020" max="2100" required></label>
    <button class="btn gold">Unduh laporan arisan (PDF)</button></form></div>`;
  $('#fLpj').onsubmit = e => { e.preventDefault(); pdf('pdfLPJ', { dari: e.target.dari.value, sampai: e.target.sampai.value }, e.target.querySelector('button')); };
  $('#fArs').onsubmit = e => { e.preventDefault(); pdf('pdfArisan', { tahun: e.target.tahun.value }, e.target.querySelector('button')); };
}
function pdf(action, data, btn) {
  run(btn, async () => {
    const r = await api(action, data), bin = atob(r.base64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })); a.download = r.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('PDF siap diunduh');
  });
}

document.querySelectorAll('#nav button').forEach(b => b.insertAdjacentHTML('afterbegin', ic(b.dataset.v)));
$('#logout').insertAdjacentHTML('afterbegin', ic('logout', 16) + ' ');
if (token) start().catch(logout);
})();
