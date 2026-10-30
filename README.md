# Portal Digital Baraka Express

Frontend sekarang dibangun dengan Vue 3 dan JavaScript menggunakan Vite. Halaman tetap multi-page agar tautan dan URL formulir yang sudah digunakan tetap berlaku. Formulir mengirim data ke Cloudflare Worker yang sama.

## Halaman dan source

- `src/views/HomePage.vue`: portal, carousel, konten terbit, dan preview Editor Website.
- `src/views/BranchRequest.vue`, `DesignRequest.vue`, `MapsRequest.vue`, `AuditReport.vue`: empat formulir.
- `src/views/GalleryAdmin.vue`: Admin Galeri, upload resumable, dan tes notifikasi Discord.
- `src/views/SiteEditor.vue`: halaman editor visual yang dimount lewat Vue. Engine canvas editor tetap di `admin-site-editor.js` agar interaksi drag/resize iframe dan fitur editor yang sudah ada tetap terjaga.
- `src/components/PortalChrome.vue` dan `src/composables/useRegions.js`: header/footer formulir dan dropdown wilayah berjenjang.
- `src/main.js`, `vite.config.js`: pemilihan halaman dan konfigurasi build multi-page.
- Folder halaman dan `index.html` adalah entry point Vite. `assets/` tetap menjadi sumber aset statis.
- `worker-cloudflare-gallery.js`: sumber Worker gabungan untuk formulir, galeri, editor, dan upload gambar. Worker tetap dideploy terpisah di Cloudflare.
- `worker.js` dan `workerbckup.js`: sumber lama/varian terdahulu; jangan dideploy tanpa memeriksa fitur dan binding yang dibutuhkan.

## Jalankan dan build

Perlu Node.js 18 atau lebih baru.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Hasil produksi ada di `dist/`. Workflow `.github/workflows/deploy-pages.yml` menjalankan `npm ci`, membangun Vue, lalu menerbitkan `dist/` ke GitHub Pages setiap ada push ke branch `main`. Workflow juga bisa dijalankan manual dari tab **Actions**. Worker tetap menggunakan URL dan kontrak payload yang sekarang dan dideploy terpisah.

### Aktifkan GitHub Pages otomatis

1. Push workflow dan source ke branch `main`.
2. Di GitHub buka **Settings → Pages**.
3. Pada **Build and deployment → Source**, pilih **GitHub Actions**.
4. Buka tab **Actions** dan pastikan workflow **Build and deploy Vue site** selesai dengan status sukses.
5. Buka alamat Pages yang ditampilkan GitHub. Push berikutnya ke `main` akan membangun dan menerbitkan versi baru otomatis.

Di Windows, jalankan perintah dari drive letter yang memetakan folder proyek. `cmd.exe` yang dipakai skrip instalasi tidak dapat berjalan dengan current directory UNC (`\\server\share\...`).

Entry point yang dipertahankan:

- `/index.html`
- `/Cabang Agen Baru/index.html`
- `/Design Agen Cabang/index.html`
- `/Google Maps Agen Cabang/index.html`
- `/Audit/index.html`
- `/admin-gallery.html` dan `/admin-site-editor.html`

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
4. Frontend diterbitkan oleh workflow GitHub Pages setelah perubahan masuk ke `main`. Worker tetap perlu dideploy terpisah ke Cloudflare. Setelah keduanya aktif, buka Admin Galeri, login, lalu pilih **Buka Editor Website**.

Login memakai secret yang ada dan session acak 30 menit. Worker juga menambah lockout best-effort setelah lima kegagalan per alamat IP selama 15 menit melalui KV; Cloudflare WAF rate-limit rule tetap lebih kuat karena KV bersifat eventual-consistent.
