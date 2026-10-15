# Permintaan Desain — GitHub Pages + Cloudflare Worker + Google Sheets

Paket ini mempertahankan halaman HTML/CSS, memakai API wilayah Indonesia dari Emsifa, dan mengirim formulir ke Google Sheets melalui Cloudflare Worker. GitHub Pages tidak menjalankan backend; Worker menjadi backend gratis.

## Isi paket
- `index.html` — halaman formulir; sesuaikan `API_BACKEND` setelah Worker dibuat.
- `style.css` — stylesheet.
- `worker.js` — backend Cloudflare Worker yang menulis baris ke Google Sheets.
- `wrangler.toml.example` — contoh konfigurasi non-rahasia.

## A. Siapkan Google Sheets
1. Buat/buka spreadsheet tujuan.
2. Buat tab bernama `Permintaan` (atau sesuaikan `SHEET_NAME`).
3. Tambahkan header di baris pertama:
   `Waktu, Jenis Agen, Nama Agen, PORT Area, Kepemilikan, Jalan/Patokan, Telepon, Provinsi, Kabupaten/Kota, Kecamatan, Kelurahan/Desa, Kode Pos, Permintaan Tambahan, Ukuran Banner, Ukuran Custom, Deskripsi`
4. Buka Google Cloud Console dan buat project.
5. Aktifkan **Google Sheets API**.
6. Buat **Service Account**, lalu buat key JSON. Simpan file JSON dengan aman; jangan commit ke GitHub.
7. Salin email service account (`client_email`) dan bagikan spreadsheet sebagai **Editor** ke email itu.

## B. Deploy Cloudflare Worker
1. Buat akun Cloudflare gratis, buka **Workers & Pages** → **Create** → **Worker**.
2. Buat Worker baru dan tempel isi `worker.js`.
3. Di pengaturan Worker → **Settings / Variables and Secrets**, tambahkan:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — dari `client_email`.
   - `GOOGLE_PRIVATE_KEY` — secret dari `private_key` pada JSON service-account. Tempel seluruh nilai termasuk `-----BEGIN PRIVATE KEY-----` dan `-----END PRIVATE KEY-----`; pertahankan baris baru.
   - `SPREADSHEET_ID` — bagian ID dari URL Google Sheets di antara `/d/` dan `/edit`.
   - `SHEET_NAME` — `Permintaan`.
   - `ALLOWED_ORIGIN` — origin GitHub Pages, misalnya `https://USERNAME.github.io`. Jika repo bukan `USERNAME.github.io`, origin tetap `https://USERNAME.github.io` (jangan tambahkan nama repo). Untuk uji lokal, sementara boleh `*`, lalu kunci lagi ke origin produksi.
4. Deploy Worker. Catat URL Worker, misalnya `https://nama-worker.NAMA-AKUN.workers.dev`.

## C. Hubungkan frontend
Di bagian atas script `index.html`, ubah:
`const API_BACKEND = "https://GANTI-DENGAN-NAMA-WORKER.workers.dev";`
menjadi URL Worker yang sebenarnya, tanpa garis miring di akhir.
Contoh:
`const API_BACKEND = "https://permintaan-desain.username.workers.dev";`

Commit `index.html` dan `style.css` ke repo GitHub Pages, lalu tunggu deployment selesai.

## D. API wilayah dan kode pos
- Dropdown menggunakan API wilayah Emsifa:
  `https://www.emsifa.com/api-wilayah-indonesia/api`
- Data wilayah Emsifa tidak selalu menyertakan kode pos. Frontend mencoba layanan pencarian kode pos eksternal sebagai fallback. Karena layanan pihak ketiga bisa berubah/tidak tersedia, uji beberapa wilayah. Jika kode pos kosong, jangan menebak; gunakan sumber kode pos resmi/tepercaya atau ubah agar kode pos diisi manual.
- API eksternal gratis dapat memiliki batas penggunaan dan sewaktu-waktu berubah.

## E. Tes
1. Pilih provinsi → kabupaten/kota → kecamatan → kelurahan.
2. Periksa apakah kode pos terisi. Jika tidak, lihat Console/Network browser.
3. Isi formulir lalu klik `Konfirmasi & Kirim`.
4. Pastikan baris baru muncul di tab `Permintaan`.
5. Jika gagal, lihat log Worker di Cloudflare.

## Keamanan penting
- Jangan pernah memasukkan `private_key` service account ke `index.html` atau repo GitHub.
- Hanya simpan private key sebagai **Worker Secret**.
- `ALLOWED_ORIGIN` membantu membatasi browser origin, tetapi bukan autentikasi penuh. Endpoint publik tetap dapat dipanggil dengan tool non-browser. Jika formulir berisiko disalahgunakan, tambahkan CAPTCHA/rate limiting dan validasi server-side.
- Jangan commit file service-account JSON.
