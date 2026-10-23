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