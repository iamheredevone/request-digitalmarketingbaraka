/* =========================
   [PENGATURAN] URL Cloudflare Worker
   Isi dengan URL Worker dari dashboard Cloudflare (boleh berakhiran /)
   Contoh: https://nama-worker.akun-kamu.workers.dev/
========================== */
const SCRIPT_URL = "https://digitalmarketing.iamhere-devone.workers.dev/";

/* =========================
   [DATA] Question List
========================== */
const questions = [
  "Desain & Logo", "Penempatan Signage", "Kondisi Fisik",
  "Informasi Kontak", "Poster/Banner", "Media Cetak Brand",
  "Signage Interior", "Nama di Gmap", "Alamat Website",
  "Sinkronisasi No. WA", "Akun Media Sosial"
];

/* =========================
   [RENDER] Generate Questions UI
========================== */
const container = document.getElementById('questions-container');
questions.forEach((q, i) => {
  container.innerHTML += `
    <div class="q-box">
      <span class="q-title">${i + 1}. ${q}</span>
      <div class="radio-group">
        <label><input type="radio" name="q${i + 1}" value="YA" checked> YA</label>
        <label><input type="radio" name="q${i + 1}" value="TIDAK"> TIDAK</label>
      </div>
    </div>`;
});

/* =========================
   [FOTO] Kompres ke JPEG maks 1600px, hasil base64 tanpa prefix
========================== */
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function compressImage(file, maxSize = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({
        base64: canvas.toDataURL('image/jpeg', quality).split(',')[1],
        type: 'image/jpeg'
      });
    };
    img.onerror = async () => {
      // Format tidak bisa dibaca browser: kirim file asli apa adanya
      URL.revokeObjectURL(url);
      resolve({ base64: await readAsBase64(file), type: file.type || 'image/jpeg' });
    };
    img.src = url;
  });
}

/* =========================
   [SUBMIT] Validate + Kirim ke Worker
========================== */
const btnSubmit = document.getElementById('btn-submit');
const loader = document.getElementById('loading-text');

function resetLoading() {
  btnSubmit.disabled = false;
  loader.style.display = 'none';
}

async function submitData() {
  const portSelect = document.getElementById('port');
  const fileInput = document.getElementById('fotoFile');

  if (portSelect.value === '') {
    alert('Mohon pilih Nama Port terlebih dahulu!');
    return;
  }
  if (fileInput.files.length === 0) {
    alert('Wajib mengambil/memilih foto bukti!');
    return;
  }

  if (!SCRIPT_URL || SCRIPT_URL.startsWith('GANTI')) {
    alert('URL tujuan pengiriman belum diisi di script.js (SCRIPT_URL).');
    return;
  }

  btnSubmit.disabled = true;
  loader.style.display = 'block';

  try {
    const foto = await compressImage(fileInput.files[0]);

    const payload = {
      jenisForm: 'audit',
      kodeTop: document.getElementById('kodeTop').value,
      port: portSelect.value,
      auditor: document.getElementById('auditor').value,
      tanggalAudit: document.getElementById('tanggalAudit').value,
      fotoData: foto.base64,
      fotoType: foto.type
    };

    for (let i = 1; i <= 11; i++) {
      payload['q' + i] = document.querySelector(`input[name="q${i}"]:checked`).value;
    }

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await res.json().catch(() => ({}));

    if (res.ok && out.ok) {
      document.getElementById('form-content').style.display = 'none';
      document.getElementById('success-msg').style.display = 'block';
      window.scrollTo(0, 0);
    } else {
      alert(out.message || 'Terjadi kesalahan saat menyimpan data.');
      resetLoading();
    }
  } catch (err) {
    alert('Gagal terhubung ke server: ' + err.message);
    resetLoading();
  }
}

btnSubmit.addEventListener('click', submitData);
document.getElementById('btn-reset').addEventListener('click', () => window.location.reload());

/* =========================
   [MODAL PREVIEW] Open/Close + Zoom
========================== */
const examplePhoto = document.getElementById('examplePhoto');
const imgModal = document.getElementById('imgModal');
const modalImg = document.getElementById('modalImg');
const closeModalBtn = document.getElementById('closeModal');

let zoom = 1;

function openModal() {
  modalImg.src = examplePhoto.src;
  imgModal.classList.add('open');
  imgModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  zoom = 1;
  modalImg.style.transform = `scale(${zoom})`;
}

function closeModal() {
  imgModal.classList.remove('open');
  imgModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  modalImg.src = '';
}

examplePhoto.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);

imgModal.addEventListener('click', (e) => {
  if (e.target === imgModal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && imgModal.classList.contains('open')) closeModal();
});

imgModal.addEventListener('wheel', (e) => {
  if (!imgModal.classList.contains('open')) return;

  e.preventDefault();
  const delta = Math.sign(e.deltaY);

  if (delta < 0) zoom *= 1.1;
  else zoom /= 1.1;

  zoom = Math.min(Math.max(zoom, 1), 5);
  modalImg.style.transform = `scale(${zoom})`;
}, { passive: false });