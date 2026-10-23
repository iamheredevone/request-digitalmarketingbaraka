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
 *   GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID, DISCORD_WEBHOOK_URL (sudah ada)
 *   DRIVE_FOLDER_ID   : ID folder foto audit (harus di Shared Drive)
 *   ALLOWED_ORIGINS   : opsional, daftar origin dipisah koma, mis. https://akun.github.io
 *                       Kosong = semua origin boleh.
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
      t(x.kodePos),                        // Kode Pos
      t(x.gmaps, 500)                      // Gmap
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
// Hanya form yang terdaftar di sini yang mengirim notifikasi.
// Nilai awal: form cabang saja (sama seperti sistem lama). Tambahkan form lain jika perlu.
const DISCORD_EMBEDS = {
  cabang: (x) => {
    const wilayah = [x.kelurahanNama, x.kecamatanNama, x.kabupatenNama, x.provinsiNama]
      .filter(Boolean).join(', ');
    const v = (s, max = 1000) => str(s, max) || '-';
    return {
      title: '📋 Pendaftaran Agen/Cabang Baru',
      color: 2003199,
      fields: [
        { name: 'Port Area', value: v(x.tipe), inline: true },
        { name: 'Tipe TOP', value: v(x.tipeTop), inline: true },
        { name: 'Kepemilikan', value: v(x.kepemilikan), inline: true },
        { name: 'Tanggal Pembukaan TOP', value: v(x.tanggalPembukaan), inline: true },
        { name: 'Nama Agen/Cabang', value: v(x.namaAgen, 150), inline: false },
        { name: 'Alamat', value: v(str(x.alamat, 500) + '\n' + wilayah), inline: false },
        { name: 'Kode Pos', value: v(x.kodePos), inline: true },
        { name: 'No. Telepon', value: v(x.telepon), inline: true },
        { name: 'Link Google Maps', value: v(x.gmaps, 500), inline: false }
      ],
      timestamp: new Date().toISOString()
    };
  }
};

async function sendDiscord(env, embed) {
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Form Pendaftaran', embeds: [embed] })
    });
    if (!res.ok) console.error('Discord menolak: ' + res.status + ' ' + (await res.text()));
  } catch (e) {
    console.error('Gagal kirim Discord: ' + e.message); // tidak boleh menggagalkan penyimpanan data
  }
}

const DEFAULT_GALLERY = { slides: [
  { path: 'assets/Cabang Pekanbaru Utara WEB.png', alt: 'Cabang Pekanbaru Utara' },
  { path: 'assets/Cabang Bekasi Utara WEB.jpg', alt: 'Cabang Bekasi Utara' },
  { path: 'assets/Agen Surabaya Manukan WEB.png', alt: 'Agen Surabaya Manukan' },
  { path: 'assets/Cabang Curup WEB.jpg', alt: 'Cabang Curup' },
  { path: 'assets/Cabang Mojokerto Timur WEB.png', alt: 'Cabang Mojokerto Timur' }
] };

/* ===================== ENTRY POINT ===================== */
export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    if (url.searchParams.get('resource') === 'gallery') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method === 'GET') {
        try { const stored = env.GALLERY_KV ? await env.GALLERY_KV.get('gallery', 'json') : null; return json(stored || DEFAULT_GALLERY, 200, cors); }
        catch (err) { return fail('Gagal membaca gallery', 500, cors); }
      }
      if (!allowedList(env).length || !originAllowed(request.headers.get('Origin'), env)) return fail('Origin admin belum diizinkan', 403, cors);
      if (!env.GALLERY_KV) return fail('Binding GALLERY_KV belum dikonfigurasi', 503, cors);
      if (url.searchParams.get('action') === 'login' && request.method === 'POST') {
        let credentials; try { credentials = await request.json(); } catch (err) { return fail('Data login tidak valid', 400, cors); }
        if (!env.GALLERY_ADMIN_ID || !env.GALLERY_ADMIN_PASSWORD || credentials.id !== env.GALLERY_ADMIN_ID || credentials.password !== env.GALLERY_ADMIN_PASSWORD) return fail('ID atau password salah', 401, cors);
        const session = crypto.randomUUID();
        await env.GALLERY_KV.put('gallery-session:' + session, '1', { expirationTtl: 1800 });
        return json({ ok: true, session, expiresIn: 1800 }, 200, cors);
      }
      if (request.method !== 'PUT') return fail('Method tidak diizinkan', 405, cors);
      const session = request.headers.get('X-Admin-Session') || '';
      if (!session || !(await env.GALLERY_KV.get('gallery-session:' + session))) return fail('Sesi login berakhir, silakan login kembali', 401, cors);
      let payload; try { payload = await request.json(); } catch (err) { return fail('JSON tidak valid', 400, cors); }
      if (!payload || !Array.isArray(payload.slides) || payload.slides.length > 50) return fail('Format slides tidak valid (maksimal 50)', 400, cors);
      const slides = payload.slides.map((item) => ({ path: str(item && item.path, 500), alt: str(item && item.alt, 300) }));
      if (slides.some((item) => !item.path || /^(javascript:|data:)/i.test(item.path))) return fail('Path gambar tidak valid', 400, cors);
      try { await env.GALLERY_KV.put('gallery', JSON.stringify({ slides })); return json({ ok: true, slides: slides.length }, 200, cors); }
      catch (err) { return fail('Gagal menyimpan gallery', 500, cors); }
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

      if (DISCORD_EMBEDS[jenis] && env.DISCORD_WEBHOOK_URL) {
        ctx.waitUntil(sendDiscord(env, DISCORD_EMBEDS[jenis](data)));
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
