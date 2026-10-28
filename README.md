# Portal Digital Baraka Express

Situs statis ini di-host melalui GitHub Pages. Formulir mengirim data ke Cloudflare Worker.

## Struktur utama

- `index.html`, `style.css`, `script.js`: halaman utama dan carousel.
- `gallery.json`: data awal carousel; data produksi dibaca dan diperbarui melalui Worker/KV.
- `admin-gallery.html`, `admin-gallery.css`, `admin-gallery.js`: halaman admin galeri, dipisah berdasarkan HTML, tampilan, dan logika.
- `assets/`: gambar dan ikon situs.
- `shared/wilayah.js`: daftar wilayah yang dipakai bersama oleh tiga formulir.
- `Cabang Agen Baru/`, `Design Agen Cabang/`, `Google Maps Agen Cabang/`, `Audit/`: halaman formulir mandiri beserta CSS/JS masing-masing.
- `worker-cloudflare-gallery.js`: sumber Worker gabungan yang mencakup formulir, galeri, dan upload gambar. Salin file ini saat memperbarui Worker di Cloudflare.
- `worker.js` dan `workerbckup.js`: sumber lama/varian terdahulu; jangan dipakai untuk deploy tanpa mengecek fitur dan binding yang dibutuhkan.

## Perubahan yang perlu dijaga

- Jika mengganti nama folder form, perbarui juga tautan di `index.html`.
- Data carousel memakai objek `{ "slides": [{ "path": "...", "alt": "..." }] }`.
- Upload galeri memakai Worker, binding KV `GALLERY_KV`, secret admin, serta konfigurasi Google Drive yang dijelaskan di header `worker-cloudflare-gallery.js`.
- Saat memperbarui Worker, deploy versi `worker-cloudflare-gallery.js`, bukan file Worker lama.
## Editor Website visual

Editor berada di `admin-site-editor.html` dan dibuka dari Admin Galeri setelah login. Ia memakai endpoint login dan session yang sama (`?resource=gallery&action=login`, header `X-Admin-Session`); tidak ada password, token Google, atau webhook di frontend. Worker memeriksa session pada setiap operasi draft, publish, rollback, dan logout.

### Audit penyimpanan/integrasi saat ini

- GitHub Pages menyajikan HTML/CSS/JS statis. Sebelum editor, konten halaman utama berasal dari file repo; tidak ada layanan database lain yang menyimpan teks/layout situs.
- `GALLERY_KV` menyimpan metadata carousel (`gallery`), session admin (`gallery-session:*`), status upload resumable (`gallery-upload:*`), dan sekarang draft/versi halaman (`site-editor:*`). Tidak ada D1 atau R2 yang dipakai.
- Gambar carousel diunggah ke Google Drive pada `DRIVE_FOLDER_ID`; Worker mengirim gambar melalui endpoint `drive-image` setelah memeriksa daftar carousel.
- Worker menulis data formulir ke Google Sheets (`SPREADSHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`) dan mengirim notifikasi ke webhook Discord per form. Foto Audit juga disimpan di Google Drive. Editor tidak mengubah kontrak/integrasi tersebut.
- Form Permintaan Desain mengambil direktori TOP dari tab `PJ KORWIL` melalui endpoint `?resource=agent-directory`. Worker hanya membaca kolom A, C:E, dan I (`Nama TOP`, `JENIS TOP`, `KEPEMILIKAN`, `Kode TOP`, `PORT`) dan hanya mengirim lima data itu ke halaman. Bagikan spreadsheet master sebagai Viewer kepada email service account Worker. ID spreadsheet dan nama tab ada di konstanta `AGENT_DIRECTORY_SPREADSHEET_ID` dan `AGENT_DIRECTORY_SHEET` pada Worker. Endpoint tidak memakai cache sehingga update spreadsheet terbaca saat form dimuat kembali.
- `worker.js` dan `workerbckup.js` adalah varian lama. Deploy hanya `worker-cloudflare-gallery.js`.

### Cara kerja editor

- Halaman publik membaca `site-content-defaults.json` sebagai nilai awal lalu mengambil versi terbit dari `?resource=site-editor`. Jika API belum tersedia, halaman tetap menampilkan HTML bawaan.
- Worker menyimpan `site-editor:draft` terpisah dari `site-editor:published`; menyimpan versi dan snapshot di `site-editor:versions` serta `site-editor:version:<uuid>` (maksimal 20 versi). Publik hanya menerima versi terbit. Data konten dibatasi 256 KB dan divalidasi dengan schema versi 1.
- Pratinjau memakai halaman asli dalam iframe. Editor mendukung klik layer di kanvas, tambah elemen teks/card custom, ubah teks/gambar/link, palet warna, gradient, transparansi, glow, border, radius, alignment, ukuran kartu, kolom/jarak grid, urutan layer, undo/redo, ukuran desktop/tablet/mobile, simpan draft, publish, dan rollback.
- Section Hero, Layanan, Konten Tambahan, Materi Digital, dan Kontak dapat diedit. Urutan Galeri dapat dipindah; isi carousel tetap memakai Admin Galeri. Header/footer dan formulir mandiri belum menjadi komponen editor.
- Path gambar dapat memakai `assets/...` atau URL HTTPS. Upload gambar baru tetap dilakukan melalui Admin Galeri dan URL/path hasil upload bisa ditempel ke editor; file upload langsung dari editor belum tersedia.
- Tidak ada deployment build atau commit otomatis ke GitHub. Publish menyimpan data runtime di KV; GitHub Pages tetap menampilkan HTML terakhir jika Worker/API gagal.

### Konfigurasi/deploy

1. Di Cloudflare Worker yang sudah digunakan, deploy kode terbaru `worker-cloudflare-gallery.js` dari repo. Versi ini menambah validasi untuk elemen teks/card custom dan pengaturan gradient/glow. Worker tetap memakai binding `GALLERY_KV` dan secret yang ada; editor tidak meminta binding D1/R2 baru.
2. Pastikan `ALLOWED_ORIGINS` berisi origin halaman GitHub Pages, misalnya `https://iamheredevone.github.io` (tambahkan origin custom domain jika digunakan). Worker menolak akses admin jika daftar ini kosong atau origin tidak cocok. Origin bukan pengganti session/password.
3. Pastikan `GALLERY_ADMIN_ID`, `GALLERY_ADMIN_PASSWORD`, dan `GALLERY_KV` tetap terkonfigurasi. Secret Google/Discord tetap hanya berada pada Worker.
4. Push file frontend ke GitHub Pages secara manual setelah meninjau perubahan. Setelah Worker dan frontend aktif, buka Admin Galeri, login, lalu pilih **Buka Editor Website**.

Login memakai secret yang ada dan session acak 30 menit. Worker juga menambah lockout best-effort setelah lima kegagalan per alamat IP selama 15 menit melalui KV; Cloudflare WAF rate-limit rule tetap lebih kuat karena KV bersifat eventual-consistent.
