<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import PortalChrome from '../components/PortalChrome.vue';
import '../../Audit/style.css';
import '../../shared/site-chrome.css';

const WORKER = 'https://digitalmarketing.iamhere-devone.workers.dev/';
const questions = ['Desain & Logo', 'Penempatan Signage', 'Kondisi Fisik', 'Informasi Kontak', 'Poster/Banner', 'Media Cetak Brand', 'Signage Interior', 'Nama di Gmap', 'Alamat Website', 'Sinkronisasi No. WA', 'Akun Media Sosial'];
const ports = ['PORT B LAMPUNG','PORT BANDUNG','PORT BANJARMASIN','PORT BOGOR','PORT CIKARANG','PORT CIPAYUNG','PORT DELISERDANG','PORT JEMBRANA','PORT KALIWUNGU','PORT LEGUNDI','PORT MADIUN','PORT MAKASSAR','PORT MARUNDA','PORT PALEMBANG','PORT PEJAGAN','PORT PEKANBARU','PORT PONTIANAK','PORT PROBOLINGGO','PORT SOLOK','PORT TANGERANG','PORT BALIKPAPAN'];
const formVisible = ref(true);
const busy = ref(false);
const file = ref(null);
const previewOpen = ref(false);
const zoom = ref(1);
const form = ref({ kodeTop: '', port: '', auditor: '', tanggalAudit: '', answers: questions.map(() => 'YA') });
const example = 'https://res.cloudinary.com/dj0kb9tg7/image/upload/v1770953989/WhatsApp_Image_2026-02-13_at_10.24.36_tg5fmi.jpg';

function readAsBase64(image) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(image);
  });
}
async function compress(image, maxSize = 1600, quality = 0.8) {
  const src = URL.createObjectURL(image);
  try {
    const bitmap = await createImageBitmap(image);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return { base64: canvas.toDataURL('image/jpeg', quality).split(',')[1], type: 'image/jpeg' };
  } catch {
    return { base64: await readAsBase64(image), type: image.type || 'image/jpeg' };
  } finally { URL.revokeObjectURL(src); }
}
async function submit() {
  if (busy.value) return;
  if (!form.value.port) { window.alert('Mohon pilih Nama Port terlebih dahulu!'); return; }
  if (!file.value) { window.alert('Wajib mengambil/memilih foto bukti!'); return; }
  busy.value = true;
  try {
    const photo = await compress(file.value);
    const payload = { jenisForm: 'audit', kodeTop: form.value.kodeTop.trim(), port: form.value.port, auditor: form.value.auditor.trim(), tanggalAudit: form.value.tanggalAudit, fotoData: photo.base64, fotoType: photo.type };
    form.value.answers.forEach((answer,index) => { payload[`q${index + 1}`] = answer; });
    const response = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || result.error || 'Terjadi kesalahan saat menyimpan data.');
    formVisible.value = false; window.scrollTo(0, 0);
  } catch (error) { window.alert(`Gagal mengirim data: ${error.message}`); }
  finally { busy.value = false; }
}
function reset() { form.value = { kodeTop: '', port: '', auditor: '', tanggalAudit: '', answers: questions.map(() => 'YA') }; file.value = null; formVisible.value = true; }
function openPreview() { previewOpen.value = true; zoom.value = 1; document.body.style.overflow = 'hidden'; }
function closePreview() { previewOpen.value = false; document.body.style.overflow = ''; }
function handleWheel(event) { zoom.value = Math.min(5, Math.max(1, zoom.value * (event.deltaY < 0 ? 1.1 : 1 / 1.1))); }
function handleKey(event) { if (event.key === 'Escape') closePreview(); }
onMounted(() => { document.title = 'Laporan Audit Branding | Baraka Express'; document.addEventListener('keydown', handleKey); });
onUnmounted(() => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; });
</script>

<template>
  <div class="portal-page">
    <PortalChrome>
      <div class="container">
        <div class="header-section"><h2>Form Audit Branding</h2></div>
        <div v-if="formVisible" id="form-content">
          <div class="audit-fields-grid"><div class="audit-field"><label for="kodeTop">Kode TOP</label><input id="kodeTop" v-model.trim="form.kodeTop" placeholder="Contoh: 001CPY"></div><div class="audit-field"><label for="port">Nama Port</label><select id="port" v-model="form.port" required><option value="">-- Pilih Lokasi Port --</option><option v-for="port in ports" :key="port" :value="port">{{ port }}</option></select></div><div class="audit-field"><label for="auditor">Nama Auditor</label><input id="auditor" v-model.trim="form.auditor" placeholder="Nama staf pemeriksa"></div><div class="audit-field"><label for="tanggalAudit">Tanggal Audit</label><input id="tanggalAudit" v-model="form.tanggalAudit" type="date"></div></div>
          <div id="questions-container"><div v-for="(question,index) in questions" :key="question" class="q-box"><span class="q-title">{{ index + 1 }}. {{ question }}</span><div class="radio-group"><label><input v-model="form.answers[index]" type="radio" :name="`q${index+1}`" value="YA"> YA</label><label><input v-model="form.answers[index]" type="radio" :name="`q${index+1}`" value="TIDAK"> TIDAK</label></div></div></div>
          <div class="audit-evidence-grid"><div class="audit-field"><label for="fotoFile">Ambil Foto Bukti</label><input id="fotoFile" type="file" accept="image/*" capture="environment" @change="file = $event.target.files?.[0] || null"><span v-if="file" class="example-title">{{ file.name }}</span></div><div class="example-wrap"><div class="example-title">Contoh foto bukti:</div><img id="examplePhoto" class="example-photo" :src="example" alt="Contoh Foto Bukti" @click="openPreview"></div></div>
          <button id="btn-submit" type="button" :disabled="busy" @click="submit">{{ busy ? 'Sedang mengunggah data & foto...' : 'KIRIM LAPORAN SEKARANG' }}</button><p v-if="busy" id="loading-text" class="loading-text" style="display:block">Sedang mengunggah data &amp; foto...</p>
        </div>
        <div v-else id="success-msg" style="display:block"><div class="icon">✔</div><h3>Berhasil dikirim!</h3><p>Laporan audit branding telah tersimpan di sistem.</p><button type="button" class="btn-reset" @click="reset">Isi Laporan Baru</button></div>
      </div>
      <div v-if="previewOpen" id="imgModal" class="img-modal open" aria-hidden="false" @click.self="closePreview" @wheel.prevent="handleWheel"><button class="img-modal-close" type="button" aria-label="Tutup" @click="closePreview"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" /></svg></button><div class="img-modal-content"><img id="modalImg" :src="example" alt="Preview Foto Bukti" :style="{ transform: `scale(${zoom})` }"><div class="img-hint">Scroll untuk zoom, klik luar gambar untuk tutup</div></div></div>
    </PortalChrome>
  </div>
</template>
