// worker.js
// Cloudflare Worker: menerima "Form Permintaan Desain" lalu menyimpannya sebagai
// satu baris di Google Sheets lewat Google Sheets API (service account).
// Langkah pemasangan ada di PANDUAN-WORKER.md

// ===================== PENGATURAN =====================
// Diisi lewat Variables and Secrets di Cloudflare (lihat panduan):
//   SPREADSHEET_ID      ID Google Sheet (teks biasa)
//   SHEET_NAME          nama tab, default "Permintaan Desain" (teks biasa)
//   ALLOWED_ORIGINS     alamat situs yang boleh mengirim, pisahkan dengan koma (teks biasa)
//   GOOGLE_CLIENT_EMAIL client_email dari file JSON service account (secret)
//   GOOGLE_PRIVATE_KEY  private_key dari file JSON service account (secret)

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TIMEZONE = "Asia/Jakarta";
const MAX_BODY = 20000; // batas ukuran kiriman (karakter)
const MAX_LEN = 1000; // batas panjang tiap isian

const HEADERS = [
  "Waktu Kirim",
  "Jenis",
  "Nama Agen / Cabang",
  "PORT Area",
  "Kepemilikan",
  "Nama Jalan / Patokan",
  "Nomor Telepon",
  "Provinsi",
  "Kabupaten / Kota",
  "Kecamatan",
  "Kelurahan / Desa",
  "Kode Pos",
  "Paket Cabang / Agen Baru",
  "Jenis Permintaan",
  "Ukuran Spanduk",
  "Deskripsi",
];
const LAST_COL = String.fromCharCode(64 + HEADERS.length); // 16 kolom -> "P"

// Isian wajib (nama field sesuai yang dikirim script.js)
const REQUIRED = [
  "jenisAgen", "namaAgen", "portArea", "statusAgen", "namaJalan", "noTelp",
  "provinsi", "kabupatenKota", "kecamatan", "kelurahan", "kodePos",
];

// Disimpan selama Worker aktif supaya tidak minta token dan cek sheet di tiap kiriman
let tokenCache = { value: null, exp: 0 };
let sheetReady = false;

// ===================== ENDPOINT =====================
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const originOk = !origin || allowed.length === 0 || allowed.includes(origin);

    const cors = originOk && origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : {};

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === "GET") {
      return json({ ok: true, message: "API aktif" }, 200, cors);
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Metode tidak didukung" }, 405, cors);
    }
    if (!originOk) {
      return json({ ok: false, error: "Origin tidak diizinkan" }, 403, cors);
    }
    if (!env.SPREADSHEET_ID || !env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
      console.error("Variabel Worker belum lengkap");
      return json({ ok: false, error: "Konfigurasi server belum lengkap" }, 500, cors);
    }

    // Baca dan periksa data
    let d;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY) {
        return json({ ok: false, error: "Data terlalu besar" }, 413, cors);
      }
      d = JSON.parse(text);
    } catch (_) {
      return json({ ok: false, error: "Format data tidak valid" }, 400, cors);
    }

    const kosong = REQUIRED.filter((k) => !clean(d[k]));
    if (kosong.length) {
      return json({ ok: false, error: "Isian wajib kosong: " + kosong.join(", ") }, 400, cors);
    }

    const values = [
      new Date().toLocaleString("sv-SE", { timeZone: TIMEZONE }), // 2026-10-15 10:24:00
      clean(d.jenisAgen),
      clean(d.namaAgen),
      clean(d.portArea),
      clean(d.statusAgen),
      clean(d.namaJalan),
      clean(d.noTelp),
      clean(d.provinsi),
      clean(d.kabupatenKota),
      clean(d.kecamatan),
      clean(d.kelurahan),
      clean(d.kodePos),
      d.paketAll === true || d.paketAll === "true" ? "Ya" : "Tidak",
      labelPermintaan(clean(d.tambahan)),
      clean(d.ukuranBanner),
      clean(d.deskripsi),
    ];

    // Simpan ke Google Sheets
    try {
      const token = await getAccessToken(env);
      await ensureSheet(env, token);
      await appendRow(env, token, values);

      // Kirim notifikasi Discord setelah Sheets berhasil
      try {
        console.log("Mencoba mengirim notifikasi Discord...");

        const result = await sendDiscord(env, d);

        console.log(
          "Discord webhook berhasil:",
          JSON.stringify(result)
        );
      } catch (discordErr) {
        console.error(
          "Discord notification failed:",
          discordErr?.stack || discordErr?.message || String(discordErr)
        );
      }

      return json({ ok: true }, 200, cors);
    } catch (err) {
      console.error("Google Sheets save failed:", err);
      return json(
        { ok: false, error: "Gagal menyimpan data" },
        502,
        cors
      );
    }
  },
};

// ===================== DISCORD =====================

async function sendDiscord(env, d) {
  if (!env.DISCORD_WEBHOOK_URL) {
    throw new Error("DISCORD_WEBHOOK_URL belum dikonfigurasi");
  }

  const clean = (value) =>
    String(value ?? "").trim().slice(0, 1000);

  // Susun alamat lengkap
  const alamat = [
    clean(d.namaJalan),
    clean(d.kelurahan),
    clean(d.kecamatan),
    clean(d.kabupatenKota),
    clean(d.provinsi),
    clean(d.kodePos),
  ].filter(Boolean).join(", ");

  // Format jenis permintaan seperti di formulir
  const jenis = clean(d.tambahan)
    .replace("Plang Banner", "Plang Banner")
    .replace("Brosur", "Brosur Cetak") || "-";

  const embed = {
    title: "🆕 Permintaan Desain Baru",
    color: 0x1687e8,

    fields: [
      {
        name: "🏢 Agen / Cabang",
        value: `${clean(d.namaAgen) || "-"} (${clean(d.statusAgen) || "-"})`,
        inline: false
      },
      {
        name: "📍 Alamat",
        value: alamat.slice(0, 1024) || "-",
        inline: false
      },
      {
        name: "📞 Telepon",
        value: clean(d.noTelp) || "-",
        inline: true
      },
      {
        name: "🚩 PORT Area",
        value: clean(d.portArea) || "-",
        inline: true
      },
      {
        name: "📎 Jenis",
        value: jenis,
        inline: false
      },
      {
        name: "📐 Ukuran",
        value: clean(d.ukuranBanner) || "-",
        inline: false
      },
      {
        name: "🧾 Deskripsi",
        value: clean(d.deskripsi) || "-",
        inline: false
      }
    ],

    footer: {
      text: "Baraka Design Bot"
    },

    timestamp: new Date().toISOString()
  };

  const response = await fetch(
    env.DISCORD_WEBHOOK_URL + "?wait=true",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: "Baraka Design Bot",
        embeds: [embed],
        allowed_mentions: {
          parse: []
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Discord webhook ${response.status}: ${errorText}`
    );
  }

  return response.json();
}

// ===================== GOOGLE SHEETS =====================

async function sheets(token, path, init = {}) {
  const res = await fetch(SHEETS_API + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error("Sheets API " + res.status + ": " + (await res.text()));
  return res.json();
}

// Pastikan tab dan baris judul ada (dibuat otomatis kalau belum ada)
async function ensureSheet(env, token) {
  if (sheetReady) return;
  const id = env.SPREADSHEET_ID;
  const name = env.SHEET_NAME || "Permintaan Desain";

  const meta = await sheets(token, `/${id}?fields=sheets.properties.title`);
  const exists = (meta.sheets || []).some((s) => s.properties.title === name);
  if (!exists) {
    await sheets(token, `/${id}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          { addSheet: { properties: { title: name, gridProperties: { frozenRowCount: 1 } } } },
        ],
      }),
    });
  }

  const range = encodeURIComponent(`'${name}'!A1:${LAST_COL}1`);
  const head = await sheets(token, `/${id}/values/${range}`);
  if (!head.values || !head.values.length) {
    await sheets(token, `/${id}/values/${range}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [HEADERS] }),
    });
  }
  sheetReady = true;
}

async function appendRow(env, token, values) {
  const name = env.SHEET_NAME || "Permintaan Desain";
  const range = encodeURIComponent(`'${name}'!A:${LAST_COL}`);
  // RAW: isian disimpan apa adanya (angka 0 di depan nomor telepon tetap ada,
  // isian berawalan "=" tidak dijalankan sebagai rumus)
  await sheets(
    token,
    `/${env.SPREADSHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [values] }) }
  );
}

// ===================== TOKEN GOOGLE (service account) =====================

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.value && tokenCache.exp - 60 > now) return tokenCache.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64urlJson(header) + "." + b64urlJson(claim);

  const key = await importKey(env.GOOGLE_PRIVATE_KEY);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = unsigned + "." + b64url(new Uint8Array(sig));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error("Token Google " + res.status + ": " + (await res.text()));

  const data = await res.json();
  tokenCache = { value: data.access_token, exp: now + (data.expires_in || 3600) };
  return tokenCache.value;
}

function importKey(pem) {
  const body = String(pem)
    .replace(/\\n/g, "\n") // kalau kunci tertempel dengan tulisan \n
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function b64url(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj) {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

// ===================== HELPER =====================

function clean(v) {
  return String(v == null ? "" : v).trim().slice(0, MAX_LEN);
}

// Nilai checkbox di form -> nama yang tampil di form
function labelPermintaan(s) {
  return s
    .replace("Plang Banner", "Papan Nama Luar (Eksterior)")
    .replace("Brosur", "Brosur Cetak");
}

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}
