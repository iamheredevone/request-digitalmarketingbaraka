/**
 * Cloudflare Worker: satu endpoint untuk 4 form.
 * Data masuk ke tab sheet sesuai "jenisForm" yang dikirim form.
 *
 *   jenisForm  | Tab sheet               | Foto
 *   -----------+-------------------------+------
 *   banner     | Permintaan Banner       | -
 *   gmaps      | Permintaan Google Maps  | -
 *   cabang     | Form Cabang Agen Baru   | -
 *   audit      | Laporan Audit           | Drive
 *
 * Variabel / secret di dashboard Cloudflare:
 *   GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID (sudah ada)
 *   Webhook Discord per form (Secret), kosong = form itu tidak kirim notifikasi:
 *     DISCORD_WEBHOOK_URL (lama = channel Banner, dipakai form banner), DISCORD_WEBHOOK_CABANG,
 *     DISCORD_WEBHOOK_GMAPS, DISCORD_WEBHOOK_AUDIT
 *   DRIVE_FOLDER_ID   : ID folder foto audit (harus di Shared Drive)
 *   GALLERY_ADMIN_ID, GALLERY_ADMIN_PASSWORD : Secret login admin gallery
 *   GALLERY_KV        : binding KV untuk data gallery dan sesi login
 *   Master direktori TOP memakai spreadsheet PJ Korwil. Berikan akses Viewer
 *   spreadsheet tersebut ke GOOGLE_CLIENT_EMAIL agar Worker bisa membaca datanya.
 *   ALLOWED_ORIGINS   : origin GitHub Pages untuk admin, daftar dipisah koma
 *                       Kosong = akses admin ditolak; endpoint form tetap mengikuti perilaku lama.
 * SHEET_NAME tidak dipakai lagi (nama tab ditentukan di bawah).
 */

/* ===================== PENGATURAN ===================== */
const STATUS_AWAL_BANNER = 'Baru';   // isi kolom "Status" untuk baris baru di Permintaan Banner
const MAX_BODY_CHARS = 9000000;
const MAX_FOTO_BASE64 = 8000000;     // sekitar 6 MB file
const TYPE_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif'
};
const GOOGLE_SCOPES =
  'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';

/* ===================== HELPER ISI SEL ===================== */
function str(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
// Teks: awalan ' memaksa Sheets menyimpan sebagai teks (angka 0 di depan aman, rumus tidak dijalankan)
function t(v, max = 1000) {
  const s = str(v, max);
  return s ? "'" + s : '';
}
// Tanggal YYYY-MM-DD: dibiarkan agar dikenali Sheets sebagai tanggal
function d(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
}
function getJamOperasional(tipeTop) {
  if (tipeTop === 'Cabang') {
    return '08.00 WIB - 17.00 WIB';
  }
  if (tipeTop === 'Agen') {
    return '09.00 WIB - 17.00 WIB';
  }
  return '';
}
function namaGabung(x) {
  return t([str(x.jenisAgen, 20), str(x.namaAgen, 150)].filter(Boolean).join(' '));
}
function timestamp() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
}
function jenisPermintaanBanner(x) {
  const items = str(x.tambahan, 500);
  const paket = x.paketAll === true || x.paketAll === 'true';
  return paket ? 'Paket Cabang / Agen Baru' + (items ? ': ' + items : '') : items;
}

/* ===================== DEFINISI FORM ===================== */
const FORMS = {
  // ---- Permintaan Banner (16 kolom: A-P) ----
  banner: {
    sheet: 'Permintaan Banner',
    validate: (x) => (str(x.namaAgen, 150) ? '' : 'Nama agen/cabang wajib diisi'),
    row: (x, ts) => [
      ts,                                  // Timestamp
      namaGabung(x),                       // Nama Agen/Cabang
      t(x.kodeTop),                        // Kode TOP (form ini tidak mengirim -> kosong)
      t(x.statusAgen),                     // Pemilik
      t(x.namaJalan),                      // Nama Jalan
      t(x.kelurahan),                      // Kelurahan
      t(x.kecamatan),                      // Kecamatan
      t(x.kabupatenKota),                  // Kabupaten/Kota
      t(x.provinsi),                       // Provinsi
      t(x.kodePos),                        // Kode Pos
      t(x.noTelp),                         // Nomor Telepon
      t(x.ukuranBanner),                   // Ukuran Banner Kirim Barang Berat
      t(jenisPermintaanBanner(x), 600),    // Jenis Permintaan
      t(x.deskripsi, 2000),                // Deskripsi
      STATUS_AWAL_BANNER,                  // Status
      ''                                   // Keterangan Tambahan
    ]
  },

  // ---- Permintaan Google Maps (18 kolom: A-R) ----
  gmaps: {
    sheet: 'Permintaan Google Maps',
    validate: (x) =>
      !str(x.jenisPermintaan, 50) ? 'Jenis permintaan wajib dipilih'
      : !str(x.namaAgen, 150) ? 'Nama agen wajib diisi' : '',
    row: (x, ts) => [
      ts,                                  // Timestamp
      t(x.jenisPermintaan),                // Jenis Permintaan
      namaGabung(x),                       // Nama Agen
      t(x.kodeTop),                        // Kode TOP
      t(x.kepemilikan),                    // Kepemilikan
      t(x.noTelp),                         // No Telepon
      t(x.portArea),                       // Port Area
      t(x.namaJalan),                      // Nama Jalan
      t(x.kelurahan),                      // Kelurahan
      t(x.kecamatan),                      // Kecamatan
      t(x.kabupatenKota),                  // Kabupaten/Kota
      t(x.provinsi),                       // Provinsi
      t(x.kodePos),                        // Kode Pos
      t(x.mapsBaru),                       // Link Maps Baru
      t(x.mapsLama || x.mapsSaatIni),      // Link Maps Lama (untuk "Update Info" diisi link maps saat ini)
      t(x.alamatLama, 1000),               // Alamat (teks alamat lama)
      t(x.jamOperasional),                 // Jam Operasional
      t(x.deskripsi, 2000)                 // Keterangan Tambahan
    ]
  },

  // ---- Form Cabang Agen Baru (14 kolom: A-N) ----
  cabang: {
    sheet: 'Form Cabang Agen Baru',
    validate: (x) =>
      !str(x.namaAgen, 150) ? 'Lokasi pembukaan wajib diisi'
      : !str(x.tipe, 50) ? 'Port area wajib dipilih' : '',
    row: (x, ts) => [
      ts,                                  // Time Stamp
      t(x.tipe),                           // Port Area
      t(x.tipeTop),                        // Jenis TOp
      t(x.namaAgen, 150),                  // Lokasi Pembukaan
      t(x.kepemilikan),                    // Kepemilikan
      d(x.tanggalPembukaan),               // Tanggal Buka
      t(x.alamat, 1000),                   // Alamat
      t(x.telepon),                        // No Hp/WA
      t(x.provinsiNama),                   // Provinsi
      t(x.kabupatenNama),                  // Kota/Kab
      t(x.kecamatanNama),                  // Kec
      t(x.kelurahanNama),                  // Kel
      t(x.kodePos),                   // Kode Pos
      t(x.gmaps, 500),                // Gmap
      t(getJamOperasional(x.tipeTop)) // Jam Operasional

    ]
  },

  // ---- Laporan Audit (17 kolom: A-Q), foto ke Drive ----
  audit: {
    sheet: 'Laporan Audit',
    photo: true,
    validate: (x) => {
      if (!str(x.port, 100)) return 'Port wajib diisi';
      if (!TYPE_EXT[x.fotoType] || typeof x.fotoData !== 'string' || !x.fotoData) return 'Foto tidak valid';
      if (x.fotoData.length > MAX_FOTO_BASE64) return 'Ukuran foto terlalu besar';
      return '';
    },
    row: (x, ts, extra) => {
      const row = [
        ts,                                // Waktu Input
        t(x.kodeTop, 50),                  // Kode TOP
        t(x.port, 100),                    // Port
        t(x.auditor, 100),                 // Auditor
        d(x.tanggalAudit)                  // Tanggal Audit
      ];
      for (let i = 1; i <= 11; i++) {      // 1. Desain & Logo ... 11. Sosmed
        row.push(x['q' + i] === 'TIDAK' ? 'TIDAK' : 'YA');
      }
      row.push(extra.fotoUrl || '');       // Link Foto
      return row;
    }
  }
};

/* ===================== NOTIFIKASI DISCORD ===================== */
// Tiap form punya pesan sendiri dan dikirim ke webhook (channel) sendiri, lihat DISCORD_WEBHOOK_VAR.
const AUDIT_POIN = [
  'Desain & Logo', 'Penempatan Signage', 'Kondisi Fisik', 'Informasi Kontak',
  'Poster/Banner', 'Media Cetak Brand', 'Signage Interior', 'Nama di Gmap',
  'Alamat Website', 'Sinkronisasi No. WA', 'Akun Media Sosial'
];

// Ubah daftar [nama, isi, inline] jadi field Discord; yang isinya kosong dibuang
function dFields(list) {
  return list
    .filter((f) => str(f[1], 1000))
    .map((f) => ({ name: `### ${f[0]}`, value: str(f[1], 1000), inline: !!f[2] }));
}
function titleCaseId(value, max = 1000) {
  return str(value, max)
    .toLocaleLowerCase('id-ID')
    .replace(/(^|[\s,./-])([a-z])/g, (match, separator, letter) => separator + letter.toLocaleUpperCase('id-ID'))
    .replace(/\b(Jl|Jln|Rt|Rw|Dki|Top|Port)\b/gi, (word) => ({ jl: 'Jl', jln: 'Jln', rt: 'RT', rw: 'RW', dki: 'DKI', top: 'TOP', port: 'PORT' }[word.toLowerCase()] || word));
}
function formatTopName(type, name) {
  return [titleCaseId(type, 50), titleCaseId(name, 150)].filter(Boolean).join(' ');
}
function formatAddress(parts, postalCode) {
  const address = titleCaseId(parts.map((part) => str(part, 300)).filter(Boolean).join(', '), 1000);
  return [address, str(postalCode, 20)].filter(Boolean).join(' ');
}
const DISCORD_EMBEDS = {
  cabang: (x) => {
    const v = (value, max = 1000) => str(value, max) || '-';
    const jam = getJamOperasional(x.tipeTop);
    return {
      title: '📋 Pendaftaran Agen/Cabang Baru',
      color: 2003199,
      fields: dFields([
        ['📍 PORT Area', v(x.tipe), false],
        ['🏷️ Jenis TOP', v(x.tipeTop), false],
        ...(jam ? [['⏰ Jam Operasional', jam, false]] : []),
        ['👤 Kepemilikan', v(x.kepemilikan), false],
        ['📅 Tanggal Pembukaan TOP', v(x.tanggalPembukaan), false],
        ['🏢 Nama TOP', formatTopName(x.tipeTop, x.namaAgen) || '-', false],
        ['🏠 Alamat', formatAddress([
          x.alamat,
          x.kelurahanNama,
          x.kecamatanNama,
          x.kabupatenNama,
          x.provinsiNama
        ], x.kodePos) || '-', false],
        ['📞 No. Telepon', v(x.telepon), false],
        ['🗺️ Link Google Maps', v(x.gmaps, 500), false]
      ]),
      timestamp: new Date().toISOString()
    };
  },

  banner: (x) => {
    return {
      title: '🎨 Permintaan Desain Baru',
      color: 15105570,
      fields: dFields([
        ['🏢 Nama TOP', formatTopName(x.jenisAgen, x.namaAgen), false],
        ['🔢 Kode TOP', x.kodeTop, true],
        ['📍 PORT Area', x.portArea, true],
        ['👤 Pemilik', x.statusAgen, true],
        ['🏠 Alamat', formatAddress([
          x.namaJalan,
          x.kelurahan,
          x.kecamatan,
          x.kabupatenKota,
          x.provinsi
        ], x.kodePos), false],
        ['📞 No. Telepon', x.noTelp, false],
        ['🎨 Jenis Permintaan', jenisPermintaanBanner(x), false],
        ['📐 Ukuran Spanduk', x.ukuranBanner, false],
        ['📝 Deskripsi', x.deskripsi, false]
      ]),
      timestamp: new Date().toISOString()
    };
  },

  gmaps: (x) => ({
    title: '🗺️ Request Google Maps',
    color: 3447003,
    fields: dFields([
      ['🔄 Jenis Permintaan', x.jenisPermintaan, false],
      ['🏢 Nama TOP', formatTopName(x.jenisAgen, x.namaAgen), false],
      ['🔢 Kode TOP', x.kodeTop, true],
      ['📍 PORT Area', x.portArea, true],
      ['👤 Kepemilikan', x.kepemilikan, true],
      ['🏠 Alamat Baru', formatAddress([
        x.namaJalan,
        x.kelurahan,
        x.kecamatan,
        x.kabupatenKota,
        x.provinsi
      ], x.kodePos), false],
      ['📞 No. Telepon', x.noTelp, false],
      ['🗺️ Link Maps Baru', x.mapsBaru, false],
      ['🔗 Link Maps Lama / Saat Ini', x.mapsLama || x.mapsSaatIni, false],
      ['🏠 Alamat Lama', titleCaseId(x.alamatLama), false],
      ['⏰ Jam Operasional', x.jamOperasional, false],
      ['📝 Keterangan', x.deskripsi, false]
    ]),
    timestamp: new Date().toISOString()
  }),

  audit: (x, extra) => {
    const tidak = [];
    for (let i = 1; i <= 11; i++) {
      if (x['q' + i] === 'TIDAK') tidak.push(i + '. ' + AUDIT_POIN[i - 1]);
    }
    return {
      title: '📝 Laporan Audit Branding',
      color: tidak.length ? 15158332 : 3066993,
      fields: dFields([
        ['🔢 Kode TOP', x.kodeTop, true],
        ['📍 Port', x.port, true],
        ['👤 Auditor', x.auditor, false],
        ['📅 Tanggal Audit', x.tanggalAudit, false],
        ['📊 Hasil', (11 - tidak.length) + ' YA, ' + tidak.length + ' TIDAK', false],
        ['⚠️ Poin TIDAK', tidak.length ? tidak.join('\n') : 'Semua poin YA ✅', false],
        ['📷 Foto Bukti', extra && extra.fotoUrl, false]
      ]),
      timestamp: new Date().toISOString()
    };
  }
};

// Nama variabel webhook per form; dipakai yang pertama kali terisi.
// DISCORD_WEBHOOK_URL (yang lama) adalah webhook channel Permintaan Banner.
const DISCORD_WEBHOOK_VAR = {
  cabang: ['DISCORD_WEBHOOK_CABANG'],
  banner: ['DISCORD_WEBHOOK_BANNER', 'DISCORD_WEBHOOK_URL'],
  gmaps: ['DISCORD_WEBHOOK_GMAPS'],
  audit: ['DISCORD_WEBHOOK_AUDIT']
};

function webhookFor(env, jenis) {
  const names = DISCORD_WEBHOOK_VAR[jenis] || [];
  for (let i = 0; i < names.length; i++) {
    if (env[names[i]]) return env[names[i]];
  }
  return '';
}

async function sendDiscord(url, embed) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Form Notifikasi', embeds: [embed] })
    });
    if (!res.ok) console.error('Discord menolak: ' + res.status + ' ' + (await res.text()));
  } catch (e) {
    console.error('Gagal kirim Discord: ' + e.message); // tidak boleh menggagalkan penyimpanan data
  }
}

function buildDiscordTestEmbed(jenis) {
  const shared = {
    jenisAgen: 'Agen',
    namaAgen: 'Contoh Tes Integrasi',
    kodeTop: 'TEST-001',
    portArea: 'PORT TEST',
    statusAgen: 'Independent',
    kepemilikan: 'Independent',
    noTelp: '081234567890',
    namaJalan: 'Jl. Contoh No. 1',
    kelurahan: 'Setu',
    kecamatan: 'Cipayung',
    kabupatenKota: 'Jakarta Timur',
    provinsi: 'DKI Jakarta',
    kodePos: '13880',
    deskripsi: 'Pesan TEST dari Admin Galeri. Tidak ada data formulir yang dikirim atau disimpan.'
  };
  let data;
  let extra = {};

  if (jenis === 'banner') {
    data = { ...shared, tambahan: 'Tes notifikasi', paketAll: true, ukuranBanner: '2:1' };
  } else if (jenis === 'gmaps') {
    data = {
      ...shared,
      jenisPermintaan: 'Tes Integrasi',
      mapsBaru: 'https://maps.google.com/?q=-6.2,106.8',
      mapsLama: '',
      mapsSaatIni: '',
      alamatLama: '',
      jamOperasional: '09.00 WIB - 17.00 WIB'
    };
  } else if (jenis === 'cabang') {
    data = {
      ...shared,
      tipe: 'PORT TEST',
      tipeTop: 'Agen',
      tanggalPembukaan: '2099-01-01',
      alamat: shared.namaJalan,
      telepon: shared.noTelp,
      provinsiNama: shared.provinsi,
      kabupatenNama: shared.kabupatenKota,
      kecamatanNama: shared.kecamatan,
      kelurahanNama: shared.kelurahan,
      gmaps: 'https://maps.google.com/?q=-6.2,106.8'
    };
  } else if (jenis === 'audit') {
    data = { ...shared, port: 'PORT TEST', auditor: 'Tes Integrasi', tanggalAudit: '2099-01-01' };
    for (let i = 1; i <= 11; i++) data['q' + i] = i === 1 ? 'TIDAK' : 'YA';
  } else {
    return null;
  }

  const embed = DISCORD_EMBEDS[jenis](data, extra);
  embed.title = '🧪 TEST · ' + embed.title;
  return embed;
}

async function sendDiscordTest(url, embed) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Form Notifikasi · TEST', embeds: [embed] })
  });
  if (!response.ok) throw new Error('Discord menolak pesan (HTTP ' + response.status + ')');
}

const DEFAULT_GALLERY = { slides: [
  { path: 'assets/Cabang Pekanbaru Utara WEB.png', alt: 'Cabang Pekanbaru Utara' },
  { path: 'assets/Cabang Bekasi Utara WEB.jpg', alt: 'Cabang Bekasi Utara' },
  { path: 'assets/Agen Surabaya Manukan WEB.png', alt: 'Agen Surabaya Manukan' },
  { path: 'assets/Cabang Curup WEB.jpg', alt: 'Cabang Curup' },
  { path: 'assets/Cabang Mojokerto Timur WEB.png', alt: 'Cabang Mojokerto Timur' }
] };

const AGENT_DIRECTORY_SPREADSHEET_ID = '19ErJSiCRFFeBLIwm7FHptke9DbwdIKQgD2XvLh8jBKs';
const AGENT_DIRECTORY_SHEET = 'PJ KORWIL';
const AGENT_DIRECTORY_ROW_LIMIT = 3000;

const SITE_EDITOR_VERSION_LIMIT = 20;
const SITE_EDITOR_CONTENT_LIMIT = 256 * 1024;
const SITE_EDITOR_SECTIONS = ['hero', 'services', 'custom', 'digital', 'gallery', 'contact'];
const SITE_EDITOR_ICONS = ['file', 'palette', 'location', 'clipboard', 'truck', 'box', 'boxes-stacked', 'warehouse', 'store', 'building', 'map', 'phone', 'envelope', 'comments', 'bullhorn', 'image', 'camera', 'video', 'bag-shopping', 'cart-shopping', 'tag', 'gift', 'star', 'heart', 'calendar-days', 'clock', 'users', 'user-tie', 'handshake', 'chart-line', 'money-bill', 'credit-card', 'gear', 'shield-halved', 'circle-check', 'circle-info', 'lightbulb', 'rocket', 'globe', 'link', 'download', 'print', 'pen', 'book'];

function editorString(value, max) {
  return typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}
function editorColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}
function editorOptionalColor(value) {
  return value == null || value === '' || editorColor(value);
}
function editorHref(value) {
  if (!editorString(value, 1200)) return false;
  const lower = value.toLowerCase();
  return !lower.startsWith('javascript:') && (lower.startsWith('https://') || lower.startsWith('http://') || lower.startsWith('mailto:') || lower.startsWith('tel:') || (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('./') || value.startsWith('#'));
}
function editorImage(value) {
  return editorString(value, 1200) && (/^https:\/\//i.test(value) || (/^assets\/[a-zA-Z0-9_./ -]+$/.test(value) && !value.split('/').includes('..')));
}
function validateSiteContent(input) {
  if (!input || typeof input !== 'object' || input.schemaVersion !== 1) return null;
  const sections = input.sections;
  const requiredSections = ['hero', 'services', 'digital', 'gallery', 'contact'];
  if (!Array.isArray(sections) || (sections.length !== 5 && sections.length !== SITE_EDITOR_SECTIONS.length) || new Set(sections).size !== sections.length || requiredSections.some((id) => !sections.includes(id)) || sections.some((id) => !SITE_EDITOR_SECTIONS.includes(id))) return null;
  const theme = input.theme || {};
  const hero = input.hero || {};
  const services = input.services || {};
  const digital = input.digital || {};
  const custom = input.custom || { title: '', columns: 3, gap: 20, items: [] };
  const contact = input.contact || {};
  if (!editorColor(theme.background) || !editorColor(theme.primary)) return null;
  if (!editorString(hero.eyebrow, 120) || !editorString(hero.title, 180) || !editorString(hero.description, 600) || !editorImage(hero.image) || !editorColor(hero.background) || !editorOptionalColor(hero.backgroundEnd) || (hero.backgroundEnd && !hero.background) || (hero.gradientAngle !== undefined && (!Number.isInteger(hero.gradientAngle) || hero.gradientAngle < 0 || hero.gradientAngle > 360)) || (hero.backgroundOpacity !== undefined && (!Number.isInteger(hero.backgroundOpacity) || hero.backgroundOpacity < 0 || hero.backgroundOpacity > 100)) || (hero.glow !== undefined && (!Number.isInteger(hero.glow) || hero.glow < 0 || hero.glow > 48)) || !editorOptionalColor(hero.glowColor)) return null;
  const validSurface = (surface) => editorOptionalColor(surface.background) && editorOptionalColor(surface.backgroundEnd) && (!surface.backgroundEnd || !!surface.background) && editorOptionalColor(surface.glowColor) && (surface.gradientAngle === undefined || (Number.isInteger(surface.gradientAngle) && surface.gradientAngle >= 0 && surface.gradientAngle <= 360)) && (surface.backgroundOpacity === undefined || (Number.isInteger(surface.backgroundOpacity) && surface.backgroundOpacity >= 0 && surface.backgroundOpacity <= 100)) && (surface.glow === undefined || (Number.isInteger(surface.glow) && surface.glow >= 0 && surface.glow <= 48));
  const cleanSurface = (surface) => ({ background: surface.background || '', backgroundEnd: surface.backgroundEnd || '', gradientAngle: surface.gradientAngle === undefined ? 135 : surface.gradientAngle, backgroundOpacity: surface.backgroundOpacity === undefined ? 100 : surface.backgroundOpacity, glow: surface.glow === undefined ? 0 : surface.glow, glowColor: surface.glowColor || '' });
  const validGrid = (grid) => Number.isInteger(grid.columns) && grid.columns >= 1 && grid.columns <= 5 && Number.isInteger(grid.gap) && grid.gap >= 0 && grid.gap <= 48 && Array.isArray(grid.items) && grid.items.length <= 12 && validSurface(grid);
  if (!validGrid(services) || !validGrid(digital)) return null;
  const idPattern = /^[a-zA-Z0-9_-]{1,40}$/;
  const validStyle = (item) => editorOptionalColor(item.background) && editorOptionalColor(item.backgroundEnd) && (!item.backgroundEnd || !!item.background) && editorOptionalColor(item.textColor) && editorOptionalColor(item.glowColor) && editorOptionalColor(item.borderColor) && Number.isInteger(item.fontSize) && item.fontSize >= 12 && item.fontSize <= 48 && Number.isInteger(item.width) && item.width >= 1 && item.width <= 5 && (item.gradientAngle === undefined || (Number.isInteger(item.gradientAngle) && item.gradientAngle >= 0 && item.gradientAngle <= 360)) && (item.backgroundOpacity === undefined || (Number.isInteger(item.backgroundOpacity) && item.backgroundOpacity >= 0 && item.backgroundOpacity <= 100)) && (item.glow === undefined || (Number.isInteger(item.glow) && item.glow >= 0 && item.glow <= 48)) && (item.radius === undefined || item.radius === '' || (Number.isInteger(item.radius) && item.radius >= 0 && item.radius <= 64)) && (item.borderWidth === undefined || (Number.isInteger(item.borderWidth) && item.borderWidth >= 0 && item.borderWidth <= 8)) && (item.textAlign === undefined || ['left', 'center', 'right'].includes(item.textAlign));
  const cleanStyle = (item) => ({ background: item.background || '', backgroundEnd: item.backgroundEnd || '', gradientAngle: item.gradientAngle === undefined ? 135 : item.gradientAngle, backgroundOpacity: item.backgroundOpacity === undefined ? 100 : item.backgroundOpacity, textColor: item.textColor || '', fontSize: item.fontSize, width: item.width, glow: item.glow === undefined ? 0 : item.glow, glowColor: item.glowColor || '', radius: item.radius === undefined ? '' : item.radius, borderColor: item.borderColor || '', borderWidth: item.borderWidth === undefined ? 0 : item.borderWidth, textAlign: item.textAlign || 'left' });
  if (services.items.some((item) => !item || !idPattern.test(item.id) || !editorString(item.title, 120) || !editorString(item.description, 300) || !editorHref(item.href) || !SITE_EDITOR_ICONS.includes(item.icon) || !editorOptionalColor(item.iconColor) || !['blue', 'purple', 'green', 'orange'].includes(item.color) || !validStyle(item))) return null;
  if (digital.items.some((item) => !item || !idPattern.test(item.id) || !editorString(item.title, 120) || !editorHref(item.href) || !editorImage(item.image) || !editorString(item.alt, 240) || !validStyle(item))) return null;
  if (!editorString(custom.title || '', 120) || !Number.isInteger(custom.columns) || custom.columns < 1 || custom.columns > 5 || !Number.isInteger(custom.gap) || custom.gap < 0 || custom.gap > 48 || !Array.isArray(custom.items) || custom.items.length > 24 || !validSurface(custom)) return null;
  if (custom.items.some((item) => !item || !idPattern.test(item.id) || !['text', 'card'].includes(item.type) || !editorString(item.title || '', 120) || !editorString(item.text || '', 800) || (item.href !== '' && !editorHref(item.href)) || (item.image !== '' && !editorImage(item.image)) || !editorString(item.alt || '', 240) || !validStyle(item))) return null;
  const componentIds = [...services.items, ...digital.items, ...custom.items].map((item) => item.id);
  if (new Set(componentIds).size !== componentIds.length) return null;
  if (!editorString(contact.phone, 50) || !/^[+0-9 ()-]+$/.test(contact.phone) || !editorString(contact.whatsapp, 24) || !/^\d{8,20}$/.test(contact.whatsapp) || !editorString(contact.email, 160) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) || !editorString(contact.address, 300) || !editorString(contact.weekday, 80) || !editorString(contact.weekdayHours, 80) || !editorString(contact.sunday, 40) || !editorString(contact.sundayStatus, 40)) return null;
  return {
    schemaVersion: 1,
    sections: sections.slice(),
    theme: { background: theme.background, primary: theme.primary },
    hero: { eyebrow: hero.eyebrow, title: hero.title, description: hero.description, image: hero.image, background: hero.background, backgroundEnd: hero.backgroundEnd || '', gradientAngle: hero.gradientAngle === undefined ? 135 : hero.gradientAngle, backgroundOpacity: hero.backgroundOpacity === undefined ? 100 : hero.backgroundOpacity, glow: hero.glow === undefined ? 0 : hero.glow, glowColor: hero.glowColor || '' },
    services: { columns: services.columns, gap: services.gap, ...cleanSurface(services), items: services.items.map((item) => ({ id: item.id, title: item.title, description: item.description, href: item.href, icon: item.icon, iconColor: item.iconColor || '', color: item.color, ...cleanStyle(item) })) },
    digital: { columns: digital.columns, gap: digital.gap, ...cleanSurface(digital), items: digital.items.map((item) => ({ id: item.id, title: item.title, href: item.href, image: item.image, alt: item.alt, ...cleanStyle(item) })) },
    custom: { title: custom.title || '', columns: custom.columns, gap: custom.gap, ...cleanSurface(custom), items: custom.items.map((item) => ({ id: item.id, type: item.type, title: item.title || '', text: item.text || '', href: item.href || '', image: item.image || '', alt: item.alt || '', ...cleanStyle(item) })) },
    contact: { phone: contact.phone, whatsapp: contact.whatsapp, email: contact.email, address: contact.address, weekday: contact.weekday, weekdayHours: contact.weekdayHours, sunday: contact.sunday, sundayStatus: contact.sundayStatus }
  };
}
async function galleryLoginRateKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown-client';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const suffix = Array.from(new Uint8Array(digest).slice(0, 12)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return 'gallery-login-rate:' + suffix;
}
async function readLimitedJson(request) {
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > SITE_EDITOR_CONTENT_LIMIT) return { error: 'Data editor terlalu besar (maksimal 256 KB)' };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > SITE_EDITOR_CONTENT_LIMIT) return { error: 'Data editor terlalu besar (maksimal 256 KB)' };
  try { return { value: JSON.parse(text) }; } catch (err) { return { error: 'JSON editor tidak valid' }; }
}

function normalizedSheetHeader(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function readAgentDirectory(env) {
  const sheet = `'${AGENT_DIRECTORY_SHEET.replace(/'/g, "''")}'`;
  const params = new URLSearchParams();
  [`${sheet}!A1:A${AGENT_DIRECTORY_ROW_LIMIT}`, `${sheet}!C1:E${AGENT_DIRECTORY_ROW_LIMIT}`, `${sheet}!I1:I${AGENT_DIRECTORY_ROW_LIMIT}`].forEach((range) => params.append('ranges', range));
  params.set('valueRenderOption', 'FORMATTED_VALUE');
  const accessToken = await getAccessToken(env);
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(AGENT_DIRECTORY_SPREADSHEET_ID)}/values:batchGet?${params.toString()}`;
  const response = await fetch(endpoint, { headers: { 'Authorization': 'Bearer ' + accessToken } });
  if (!response.ok) throw new Error('Sheets directory read ' + response.status + ': ' + await response.text());
  const result = await response.json();
  const valueRanges = Array.isArray(result.valueRanges) ? result.valueRanges : [];
  const nameRows = valueRanges[0] && Array.isArray(valueRanges[0].values) ? valueRanges[0].values : [];
  const metadataRows = valueRanges[1] && Array.isArray(valueRanges[1].values) ? valueRanges[1].values : [];
  const portRows = valueRanges[2] && Array.isArray(valueRanges[2].values) ? valueRanges[2].values : [];
  const rowCount = Math.min(AGENT_DIRECTORY_ROW_LIMIT, Math.max(nameRows.length, metadataRows.length, portRows.length));
  const headerRow = Array.from({ length: rowCount }, (_, index) => index).find((index) =>
    normalizedSheetHeader(nameRows[index] && nameRows[index][0]) === 'nama top' &&
    normalizedSheetHeader(metadataRows[index] && metadataRows[index][0]) === 'jenis top' &&
    normalizedSheetHeader(metadataRows[index] && metadataRows[index][1]) === 'kepemilikan' &&
    normalizedSheetHeader(metadataRows[index] && metadataRows[index][2]) === 'kode top' &&
    normalizedSheetHeader(portRows[index] && portRows[index][0]) === 'port'
  );
  if (headerRow === undefined) {
    throw new Error('Header wajib: Nama TOP, JENIS TOP, KEPEMILIKAN, Kode TOP, PORT');
  }
  const byName = new Map();
  for (let index = headerRow + 1; index < rowCount; index += 1) {
    const name = str(nameRows[index] && nameRows[index][0], 150);
    if (!name) continue;
    byName.set(normalizedSheetHeader(name), {
      name,
      jenisTop: str(metadataRows[index] && metadataRows[index][0], 50),
      kepemilikan: str(metadataRows[index] && metadataRows[index][1], 50),
      kodeTop: str(metadataRows[index] && metadataRows[index][2], 50),
      portArea: str(portRows[index] && portRows[index][0], 100)
    });
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/* ===================== ENTRY POINT ===================== */
export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    if (url.searchParams.get('resource') === 'discord-test') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method !== 'POST') return fail('Method tidak diizinkan', 405, cors);
      if (!allowedList(env).length || !originAllowed(request.headers.get('Origin'), env)) return fail('Origin admin belum diizinkan', 403, cors);
      if (!env.GALLERY_KV) return fail('Binding GALLERY_KV belum dikonfigurasi', 503, cors);
      const session = request.headers.get('X-Admin-Session') || '';
      if (!session || !(await env.GALLERY_KV.get('gallery-session:' + session))) return fail('Sesi login berakhir, silakan login kembali', 401, cors);

      const parsed = await readLimitedJson(request);
      if (parsed.error) return fail(parsed.error, 400, cors);
      const jenis = parsed.value && parsed.value.form;
      const embed = buildDiscordTestEmbed(jenis);
      if (!embed) return fail('Jenis form tes tidak valid', 400, cors);
      const hook = webhookFor(env, jenis);
      if (!hook) return fail('Webhook Discord untuk form ini belum dikonfigurasi', 503, cors);

      const cooldownKey = 'discord-test-cooldown:' + session + ':' + jenis;
      if (await env.GALLERY_KV.get(cooldownKey)) return fail('Tunggu 15 detik sebelum mengirim tes berikutnya untuk form ini', 429, cors);
      await env.GALLERY_KV.put(cooldownKey, '1', { expirationTtl: 15 });
      try {
        await sendDiscordTest(hook, embed);
        return json({ ok: true, test: true, form: jenis }, 200, cors);
      } catch (err) {
        console.error('Discord test gagal:', err && err.message);
        return fail('Gagal mengirim notifikasi tes ke Discord', 502, cors);
      }
    }
    if (url.searchParams.get('resource') === 'drive-image') {
      if (request.method !== 'GET') return fail('Method tidak diizinkan', 405, cors);
      const fileId = url.searchParams.get('id') || '';
      if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return fail('ID gambar tidak valid', 400, cors);
      try {
        const gallery = env.GALLERY_KV ? await env.GALLERY_KV.get('gallery', 'json') : DEFAULT_GALLERY;
        const isListed = gallery && Array.isArray(gallery.slides) && gallery.slides.some((slide) => String(slide.path || '') === url.origin + '/?resource=drive-image&id=' + fileId);
        if (!isListed) return fail('Gambar tidak ditemukan', 404, cors);
        const accessToken = await getAccessToken(env);
        const image = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media&supportsAllDrives=true', { headers: { 'Authorization': 'Bearer ' + accessToken } });
        if (!image.ok) return fail('Gambar tidak dapat dibaca dari Drive', image.status, cors);
        const headers = new Headers(cors);
        headers.set('Content-Type', image.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Cache-Control', 'public, max-age=3600');
        return new Response(image.body, { status: 200, headers });
      } catch (err) { return fail('Gagal mengambil gambar dari Drive', 500, cors); }
    }
    if (url.searchParams.get('resource') === 'agent-directory') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method !== 'GET') return fail('Method tidak diizinkan', 405, cors);
      if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) return fail('Konfigurasi Google Sheets Worker belum lengkap', 503, cors);
      try {
        const response = json({ agents: await readAgentDirectory(env) }, 200, cors);
        response.headers.set('Cache-Control', 'no-store');
        return response;
      } catch (err) {
        console.error('Daftar agen dari spreadsheet gagal dibaca:', err && err.message);
        return fail('Gagal membaca daftar nama agen. Periksa nama tab dan header kolom spreadsheet.', 500, cors);
      }
    }
    if (url.searchParams.get('resource') === 'site-editor') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const action = url.searchParams.get('action') || 'published';
      if (request.method === 'GET' && action === 'published') {
        try {
          const stored = env.GALLERY_KV ? await env.GALLERY_KV.get('site-editor:published', 'json') : null;
          const response = json({ content: stored && stored.content ? stored.content : null, version: stored && stored.version ? stored.version : null, updatedAt: stored && stored.updatedAt ? stored.updatedAt : null }, 200, cors);
          response.headers.set('Cache-Control', 'no-store');
          return response;
        } catch (err) { return fail('Gagal membaca halaman terbit', 500, cors); }
      }
      if (!allowedList(env).length || !originAllowed(request.headers.get('Origin'), env)) return fail('Origin admin belum diizinkan', 403, cors);
      if (!env.GALLERY_KV) return fail('Binding GALLERY_KV belum dikonfigurasi', 503, cors);
      const session = request.headers.get('X-Admin-Session') || '';
      if (!session || !(await env.GALLERY_KV.get('gallery-session:' + session))) return fail('Sesi login berakhir, silakan login kembali', 401, cors);
      if (request.method === 'GET' && action === 'draft') {
        const [draft, published] = await Promise.all([
          env.GALLERY_KV.get('site-editor:draft', 'json'),
          env.GALLERY_KV.get('site-editor:published', 'json')
        ]);
        return json({ draft: draft || null, published: published || null }, 200, cors);
      }
      if (request.method === 'GET' && action === 'versions') {
        const versions = await env.GALLERY_KV.get('site-editor:versions', 'json');
        return json({ versions: Array.isArray(versions) ? versions : [] }, 200, cors);
      }
      if (request.method !== 'POST') return fail('Method tidak diizinkan', 405, cors);
      if (action === 'logout') {
        await env.GALLERY_KV.delete('gallery-session:' + session);
        return json({ ok: true }, 200, cors);
      }
      const parsed = await readLimitedJson(request);
      if (parsed.error) return fail(parsed.error, 400, cors);
      if (action === 'baseline') {
        const [published, existingVersions] = await Promise.all([
          env.GALLERY_KV.get('site-editor:published', 'json'),
          env.GALLERY_KV.get('site-editor:versions', 'json')
        ]);
        if (published || (Array.isArray(existingVersions) && existingVersions.length)) return json({ ok: true, created: false }, 200, cors);
        const content = validateSiteContent(parsed.value && parsed.value.content);
        if (!content) return fail('Struktur halaman tidak valid', 400, cors);
        const version = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await env.GALLERY_KV.put('site-editor:version:' + version, JSON.stringify({ content, updatedAt: createdAt }));
        await env.GALLERY_KV.put('site-editor:versions', JSON.stringify([{ id: version, createdAt, baseline: true }]));
        return json({ ok: true, created: true, version }, 200, cors);
      }
      if (action === 'draft') {
        const content = validateSiteContent(parsed.value && parsed.value.content);
        if (!content) return fail('Struktur halaman tidak valid', 400, cors);
        const draft = { content, updatedAt: new Date().toISOString() };
        await env.GALLERY_KV.put('site-editor:draft', JSON.stringify(draft));
        return json({ ok: true, updatedAt: draft.updatedAt }, 200, cors);
      }
      if (action === 'publish' || action === 'rollback') {
        let content;
        let rolledBackFrom = null;
        if (action === 'publish') {
          const draft = await env.GALLERY_KV.get('site-editor:draft', 'json');
          if (!draft || !draft.content) return fail('Simpan draft terlebih dahulu', 409, cors);
          content = validateSiteContent(draft.content);
        } else {
          const versionId = parsed.value && parsed.value.versionId;
          if (!/^[a-f0-9-]{36}$/i.test(String(versionId || ''))) return fail('Versi rollback tidak valid', 400, cors);
          const versions = await env.GALLERY_KV.get('site-editor:versions', 'json') || [];
          if (!versions.some((version) => version.id === versionId)) return fail('Versi tidak ditemukan', 404, cors);
          const snapshot = await env.GALLERY_KV.get('site-editor:version:' + versionId, 'json');
          if (!snapshot || !snapshot.content) return fail('Data versi tidak ditemukan', 404, cors);
          content = validateSiteContent(snapshot.content);
          rolledBackFrom = versionId;
        }
        if (!content) return fail('Isi halaman tidak valid', 400, cors);
        const previous = await env.GALLERY_KV.get('site-editor:published', 'json');
        let versions = await env.GALLERY_KV.get('site-editor:versions', 'json') || [];
        if (!Array.isArray(versions)) versions = [];
        if (previous && previous.content) {
          const previousId = previous.version || crypto.randomUUID();
          await env.GALLERY_KV.put('site-editor:version:' + previousId, JSON.stringify({ content: previous.content, updatedAt: previous.updatedAt || null }));
          versions = [{ id: previousId, createdAt: previous.updatedAt || new Date().toISOString() }, ...versions.filter((version) => version.id !== previousId)];
        }
        const now = new Date().toISOString();
        const version = crypto.randomUUID();
        const published = { content, version, updatedAt: now, rolledBackFrom };
        await env.GALLERY_KV.put('site-editor:published', JSON.stringify(published));
        const removed = versions.slice(SITE_EDITOR_VERSION_LIMIT - 1);
        versions = versions.slice(0, SITE_EDITOR_VERSION_LIMIT - 1);
        versions = [{ id: version, createdAt: now }, ...versions];
        await env.GALLERY_KV.put('site-editor:versions', JSON.stringify(versions));
        for (const item of removed) await env.GALLERY_KV.delete('site-editor:version:' + item.id);
        await env.GALLERY_KV.put('site-editor:version:' + version, JSON.stringify({ content, updatedAt: now }));
        if (action === 'publish') await env.GALLERY_KV.delete('site-editor:draft');
        return json({ ok: true, version, updatedAt: now, rolledBackFrom }, 200, cors);
      }
      return fail('Action editor tidak dikenal', 404, cors);
    }    if (url.searchParams.get('resource') === 'gallery') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method === 'GET') {
        try {
          const stored = env.GALLERY_KV ? await env.GALLERY_KV.get('gallery', 'json') : null;
          return json(stored || DEFAULT_GALLERY, 200, cors);
        } catch (err) { return fail('Gagal membaca gallery', 500, cors); }
      }
      if (!allowedList(env).length || !originAllowed(request.headers.get('Origin'), env)) return fail('Origin admin belum diizinkan', 403, cors);
      if (!env.GALLERY_KV) return fail('Binding GALLERY_KV belum dikonfigurasi', 503, cors);
      if (url.searchParams.get('action') === 'login' && request.method === 'POST') {
        let credentials;
        try { credentials = await request.json(); } catch (err) { return fail('Data login tidak valid', 400, cors); }
        const rateKey = await galleryLoginRateKey(request);
        const rate = await env.GALLERY_KV.get(rateKey, 'json') || { attempts: 0, lockedUntil: 0 };
        if (rate.lockedUntil > Date.now()) return fail('Terlalu banyak percobaan login. Coba lagi setelah 15 menit.', 429, cors);
        const validCredentials = env.GALLERY_ADMIN_ID && env.GALLERY_ADMIN_PASSWORD && credentials && credentials.id === env.GALLERY_ADMIN_ID && credentials.password === env.GALLERY_ADMIN_PASSWORD;
        if (!validCredentials) {
          const attempts = (Number(rate.attempts) || 0) + 1;
          const lockedUntil = attempts >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
          await env.GALLERY_KV.put(rateKey, JSON.stringify({ attempts, lockedUntil }), { expirationTtl: 900 });
          return fail(lockedUntil ? 'Terlalu banyak percobaan login. Coba lagi setelah 15 menit.' : 'ID atau password salah', lockedUntil ? 429 : 401, cors);
        }
        await env.GALLERY_KV.delete(rateKey);
        const session = crypto.randomUUID();
        await env.GALLERY_KV.put('gallery-session:' + session, '1', { expirationTtl: 1800 });
        return json({ ok: true, session, expiresIn: 1800 }, 200, cors);
      }
      if (request.method !== 'PUT' && !(['upload-init', 'upload-part', 'upload-complete'].includes(url.searchParams.get('action')) && request.method === 'POST')) return fail('Method tidak diizinkan', 405, cors);
      const session = request.headers.get('X-Admin-Session') || '';
      if (!session || !(await env.GALLERY_KV.get('gallery-session:' + session))) return fail('Sesi login berakhir, silakan login kembali', 401, cors);
      const action = url.searchParams.get('action');
      if (action === 'upload-init' && request.method === 'POST') {
        if (!env.DRIVE_FOLDER_ID) return fail('DRIVE_FOLDER_ID belum dikonfigurasi', 503, cors);
        let input; try { input = await request.json(); } catch (err) { return fail('Data upload tidak valid', 400, cors); }
        const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
        const extension = extensions[input && input.type];
        const maxSize = 500 * 1024 * 1024;
        if (!extension || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > maxSize) return fail('Format harus JPG, PNG, WebP dan ukuran maksimal 500 MB', 400, cors);
        try {
          const accessToken = await getAccessToken(env);
          const metadata = { name: 'gallery_' + crypto.randomUUID() + '.' + extension, mimeType: input.type, parents: [env.DRIVE_FOLDER_ID] };
          const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': input.type, 'X-Upload-Content-Length': String(input.size) },
            body: JSON.stringify(metadata)
          });
          if (!response.ok) throw new Error('Drive upload init ' + response.status + ': ' + await response.text());
          const sessionUri = response.headers.get('Location');
          if (!sessionUri) throw new Error('Drive tidak mengembalikan session URI');
          const uploadId = crypto.randomUUID();
          await env.GALLERY_KV.put('gallery-upload:' + uploadId, JSON.stringify({ session, sessionUri, size: input.size, type: input.type, offset: 0, nextPart: 1 }), { expirationTtl: 3600 });
          return json({ ok: true, uploadId, chunkSize: 8 * 1024 * 1024 }, 200, cors);
        } catch (err) { console.error('Gallery Drive init gagal:', err && err.message); return fail('Gagal memulai upload ke Google Drive', 500, cors); }
      }
      if (action === 'upload-part' && request.method === 'POST') {
        let input; try { input = await request.json(); } catch (err) { return fail('Data potongan tidak valid', 400, cors); }
        if (!input || !input.uploadId || !Number.isInteger(input.partNumber) || typeof input.data !== 'string' || input.data.length > 12000000) return fail('Potongan upload tidak valid', 400, cors);
        const stateText = await env.GALLERY_KV.get('gallery-upload:' + input.uploadId);
        if (!stateText) return fail('Sesi upload tidak ditemukan atau kedaluwarsa', 404, cors);
        const state = JSON.parse(stateText);
        if (state.session !== session) return fail('Sesi upload tidak cocok', 403, cors);
        if (state.fileId) return json({ ok: true, done: true, partNumber: input.partNumber, fileId: state.fileId }, 200, cors);
        if (input.partNumber !== state.nextPart) return fail('Nomor potongan upload tidak berurutan', 409, cors);
        try {
          const bytes = Uint8Array.from(atob(input.data), (char) => char.charCodeAt(0));
          const chunkSize = 8 * 1024 * 1024;
          const startByte = state.offset;
          const endByte = startByte + bytes.length;
          if (!bytes.length || bytes.length > chunkSize || endByte > state.size || (endByte < state.size && bytes.length % (256 * 1024) !== 0)) return fail('Ukuran potongan tidak valid', 400, cors);
          const accessToken = await getAccessToken(env);
          const response = await fetch(state.sessionUri, {
            method: 'PUT',
            redirect: 'manual',
            headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Length': String(bytes.length), 'Content-Range': 'bytes ' + startByte + '-' + (endByte - 1) + '/' + state.size },
            body: bytes
          });
          if (response.status === 308) {
            const receivedRange = response.headers.get('Range');
            const receivedEnd = receivedRange ? Number(receivedRange.match(/-(\d+)$/)?.[1]) + 1 : endByte;
            if (!Number.isSafeInteger(receivedEnd) || receivedEnd !== endByte) return fail('Drive menerima jumlah byte yang tidak sesuai; upload perlu dicoba ulang', 502, cors);
            state.offset = endByte;
            state.nextPart += 1;
            await env.GALLERY_KV.put('gallery-upload:' + input.uploadId, JSON.stringify(state), { expirationTtl: 3600 });
            return json({ ok: true, done: false, partNumber: input.partNumber }, 200, cors);
          }
          if (!response.ok) throw new Error('Drive upload chunk ' + response.status + ': ' + await response.text());
          const file = await response.json();
          if (!file.id || endByte !== state.size) throw new Error('Drive menyelesaikan upload pada offset yang salah');
          state.offset = endByte;
          state.fileId = file.id;
          await env.GALLERY_KV.put('gallery-upload:' + input.uploadId, JSON.stringify(state), { expirationTtl: 3600 });
          return json({ ok: true, done: true, partNumber: input.partNumber, fileId: file.id }, 200, cors);
        } catch (err) { console.error('Gallery Drive chunk gagal:', err && err.message); return fail('Gagal mengunggah potongan ke Google Drive', 500, cors); }
      }
      if (action === 'upload-complete' && request.method === 'POST') {
        let input; try { input = await request.json(); } catch (err) { return fail('Data penyelesaian tidak valid', 400, cors); }
        const stateText = input && input.uploadId ? await env.GALLERY_KV.get('gallery-upload:' + input.uploadId) : null;
        if (!stateText) return fail('Sesi upload tidak ditemukan atau kedaluwarsa', 404, cors);
        const state = JSON.parse(stateText);
        if (state.session !== session) return fail('Sesi upload tidak cocok', 403, cors);
        if (!state.fileId || state.offset !== state.size) return fail('Upload gambar belum lengkap', 409, cors);
        await env.GALLERY_KV.delete('gallery-upload:' + input.uploadId);
        return json({ ok: true, path: url.origin + '/?resource=drive-image&id=' + encodeURIComponent(state.fileId) }, 200, cors);
      }      if (request.method !== 'PUT') return fail('Method tidak diizinkan', 405, cors);
      let payload;
      try { payload = await request.json(); } catch (err) { return fail('JSON tidak valid', 400, cors); }
      if (!payload || !Array.isArray(payload.slides) || payload.slides.length > 50) return fail('Format slides tidak valid (maksimal 50)', 400, cors);
      const slides = payload.slides.map((item) => ({ path: str(item && item.path, 500), alt: str(item && item.alt, 300) }));
      if (slides.some((item) => !item.path || /^(javascript:|data:)/i.test(item.path))) return fail('Path gambar tidak valid', 400, cors);
      try {
        await env.GALLERY_KV.put('gallery', JSON.stringify({ slides }));
        return json({ ok: true, slides: slides.length }, 200, cors);
      } catch (err) { return fail('Gagal menyimpan gallery', 500, cors); }
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ ok: true, message: 'API form aktif' }, 200, cors);
    }

    if (!originAllowed(request.headers.get('Origin'), env)) {
      return fail('Origin tidak diizinkan', 403, cors);
    }

    // Isi dibaca sebagai teks lalu di-parse: form no-cors mengirim text/plain
    let data;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_CHARS) return fail('Data terlalu besar', 413, cors);
      data = JSON.parse(raw);
    } catch (e) {
      return fail('Format data tidak valid', 400, cors);
    }
    if (!data || typeof data !== 'object') return fail('Format data tidak valid', 400, cors);

    const jenis = resolveForm(data);
    if (!Object.prototype.hasOwnProperty.call(FORMS, jenis)) {
      return fail('jenisForm tidak dikenali: ' + str(data.jenisForm, 30), 400, cors);
    }
    const form = FORMS[jenis];

    const invalid = form.validate(data);
    if (invalid) return fail(invalid, 400, cors);

    let driveFileId = null;
    try {
      const extra = {};
      if (form.photo) {
        const file = await uploadFoto(env, data);
        driveFileId = file.id;
        extra.fotoUrl = file.webViewLink;
      }

      await appendRow(env, form.sheet, form.row(data, timestamp(), extra));

      const hook = webhookFor(env, jenis);
      if (DISCORD_EMBEDS[jenis] && hook) {
        ctx.waitUntil(sendDiscord(hook, DISCORD_EMBEDS[jenis](data, extra)));
      }
      return json({ ok: true, message: 'Berhasil' }, 200, cors);
    } catch (err) {
      console.error('Submit ' + jenis + ' gagal:', err && err.message);
      if (driveFileId) {
        ctx.waitUntil(deleteDriveFile(env, driveFileId).catch(() => {}));
      }
      return fail('Gagal menyimpan data. Coba lagi.', 500, cors);
    }
  }
};

function resolveForm(data) {
  // Pengaman masa transisi: form pendaftaran lama masih mengirim jenisForm "banner"
  if (data.tipeTop !== undefined && data.tanggalPembukaan !== undefined) return 'cabang';
  // Tanpa penanda = form Permintaan Desain (perilaku lama Worker)
  return str(data.jenisForm, 30) || 'banner';
}

/* ===================== GOOGLE SHEETS ===================== */
async function appendRow(env, sheetName, row) {
  const accessToken = await getAccessToken(env);
  const range = encodeURIComponent(`'${sheetName}'!A1`);
  const endpoint =
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });
  if (!res.ok) {
    throw new Error('Sheets API ' + res.status + ': ' + (await res.text()));
  }
}

/* ===================== GOOGLE DRIVE (foto audit) ===================== */
async function uploadFoto(env, data) {
  const ext = TYPE_EXT[data.fotoType];
  const bytes = Uint8Array.from(atob(data.fotoData), (c) => c.charCodeAt(0));
  const slug = (str(data.kodeTop, 50) || 'tanpa-kode').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const tgl = d(data.tanggalAudit) || new Date().toISOString().slice(0, 10);
  const name = `${tgl}_${slug}_${Date.now()}.${ext}`;

  const accessToken = await getAccessToken(env);
  const boundary = 'b' + crypto.randomUUID();
  const enc = new TextEncoder();
  const meta = JSON.stringify({ name: name, parents: [env.DRIVE_FOLDER_ID] });
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: ${data.fotoType}\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files' +
      '?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: body
    }
  );
  if (!res.ok) throw new Error('Drive upload ' + res.status + ': ' + (await res.text()));
  const file = await res.json();

  // Coba buka akses "siapa saja dengan link". Jika dilarang kebijakan admin, abaikan:
  // file tetap tersimpan dan bisa dibuka anggota yang punya akses folder.
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      }
    );
  } catch (e) { /* abaikan */ }

  return file;
}

async function deleteDriveFile(env, fileId) {
  const accessToken = await getAccessToken(env);
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
    { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + accessToken } }
  );
}

/* ===================== AUTH GOOGLE (service account) ===================== */
let tokenCache = { value: null, exp: 0 };

function b64url(input) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.value && tokenCache.exp - 60 > now) return tokenCache.value;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: GOOGLE_SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(claim));

  const pem = env.GOOGLE_PRIVATE_KEY
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + '.' + b64url(sig);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const out = await res.json();
  if (!res.ok) throw new Error('Auth Google gagal: ' + (out.error_description || out.error));

  tokenCache = { value: out.access_token, exp: now + (out.expires_in || 3600) };
  return out.access_token;
}

/* ===================== CORS & RESPON ===================== */
function allowedList(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
}

function originAllowed(origin, env) {
  const list = allowedList(env);
  if (list.length === 0) return true;
  return !!origin && list.indexOf(origin) !== -1;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const list = allowedList(env);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Session',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (list.length === 0) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && list.indexOf(origin) !== -1) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });
}

// "error" dibaca form pendaftaran/banner/gmaps, "message" dibaca form audit
function fail(msg, status, cors) {
  return json({ ok: false, error: msg, message: msg }, status, cors);
}
