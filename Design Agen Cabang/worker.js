/**
 * Cloudflare Worker: GitHub Pages -> Google Sheets
 *
 * Required Worker secrets/variables:
 * GOOGLE_SERVICE_ACCOUNT_EMAIL (secret or variable)
 * GOOGLE_PRIVATE_KEY            (secret; paste the full private key)
 * SPREADSHEET_ID                (variable)
 * SHEET_NAME                    (variable; e.g. Permintaan)
 * ALLOWED_ORIGIN                 (variable; e.g. https://USERNAME.github.io)
 */
const corsHeaders = (origin, env) => {
  const allowed = env.ALLOWED_ORIGIN || "*";
  const permitted = allowed === "*" || origin === allowed;
  return {
    "Access-Control-Allow-Origin": permitted ? (allowed === "*" ? "*" : origin) : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
};

function base64url(input) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error("Gagal memperoleh token Google: " + (data.error_description || data.error || response.status));
  }
  return data.access_token;
}

function clean(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, 5000);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/permintaan-desain" || request.method !== "POST") {
      return Response.json({ error: "Endpoint tidak ditemukan." }, { status: 404, headers: cors });
    }

    if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin !== env.ALLOWED_ORIGIN) {
      return Response.json({ error: "Origin tidak diizinkan." }, { status: 403, headers: cors });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return Response.json({ error: "Body JSON tidak valid." }, { status: 400, headers: cors });
    }

    const required = ["jenisAgen", "namaAgen", "portArea", "statusAgen", "namaJalan",
      "noTelp", "provinsi", "kabupatenKota", "kecamatan", "kelurahan", "kodePos"];
    const missing = required.filter(key => !clean(data[key]));
    if (missing.length) {
      return Response.json({ error: "Data wajib belum lengkap: " + missing.join(", ") }, { status: 400, headers: cors });
    }

    try {
      const token = await getGoogleAccessToken(env);
      const spreadsheetId = env.SPREADSHEET_ID;
      const sheetName = env.SHEET_NAME || "Permintaan";
      const range = `'${sheetName.replace(/'/g, "''")}'!A:Z`;
      const values = [[
        new Date().toISOString(),
        clean(data.jenisAgen),
        clean(data.namaAgen),
        clean(data.portArea),
        clean(data.statusAgen),
        clean(data.namaJalan),
        clean(data.noTelp),
        clean(data.provinsi),
        clean(data.kabupatenKota),
        clean(data.kecamatan),
        clean(data.kelurahan),
        clean(data.kodePos),
        clean(data.tambahan),
        clean(data.ukuranBanner),
        clean(data.customUkuran),
        clean(data.deskripsi),
      ]];

      const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      });
      const result = await response.json();
      if (!response.ok) {
        console.error("Sheets API error", result);
        return Response.json({ error: "Gagal menyimpan ke Google Sheets. Periksa konfigurasi Worker dan akses spreadsheet." }, { status: 502, headers: cors });
      }

      return Response.json({ ok: true, message: "Permintaan berhasil disimpan." }, { status: 200, headers: cors });
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Backend gagal memproses data. Periksa konfigurasi Worker." }, { status: 500, headers: cors });
    }
  },
};
