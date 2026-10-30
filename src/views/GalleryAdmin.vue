<script setup>
import { computed, ref } from 'vue';
import '../../admin-gallery.css';

const API = 'https://digitalmarketing.iamhere-devone.workers.dev/?resource=gallery';
const TEST_API = 'https://digitalmarketing.iamhere-devone.workers.dev/?resource=discord-test';
const MAX_IMAGE_SIZE = 500 * 1024 * 1024;
const adminId = ref('');
const password = ref('');
const showPassword = ref(false);
const session = ref('');
const slides = ref([]);
const selectedForm = ref('banner');
const editing = ref(false);
const busy = ref(false);
const statusText = ref('');
const statusClass = computed(() => /berhasil|tersimpan|keluar/i.test(statusText.value) ? 'ok' : /gagal|harus|maksimal|pilih|http|error|salah|tidak/i.test(statusText.value) ? 'err' : '');
const formNames = { banner: 'Permintaan Desain', gmaps: 'Google Maps', cabang: 'Pendaftaran Cabang/Agen', audit: 'Audit Branding' };

function status(message) { statusText.value = message; }
async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function authHeaders() { return { 'Content-Type': 'application/json', 'X-Admin-Session': session.value }; }
async function login() {
  if (busy.value) return;
  busy.value = true; status('Memeriksa login...');
  try {
    const result = await requestJson(`${API}&action=login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: adminId.value, password: password.value }) });
    session.value = result.session;
    const gallery = await requestJson(API);
    slides.value = Array.isArray(gallery.slides) ? gallery.slides.map((slide) => ({ ...slide })) : [];
    password.value = ''; editing.value = true; status('Login berhasil.');
  } catch (error) { status(error.message); const panel = document.querySelector('.panel'); panel?.classList.remove('shake'); requestAnimationFrame(() => panel?.classList.add('shake')); }
  finally { busy.value = false; }
}
function addSlide() { slides.value.push({ path: '', alt: '' }); }
function removeSlide(index) { slides.value.splice(index, 1); }
function toBase64(bytes) { let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
async function uploadImage(file, slide) {
  if (!file) { status('Pilih file gambar terlebih dahulu.'); return; }
  if (file.size > MAX_IMAGE_SIZE) { status('Ukuran maksimal 500 MB.'); return; }
  busy.value = true; status('Memulai upload...');
  try {
    const init = await requestJson(`${API}&action=upload-init`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ type: file.type, size: file.size }) });
    for (let start = 0, partNumber = 1; start < file.size; start += init.chunkSize, partNumber += 1) {
      const end = Math.min(start + init.chunkSize, file.size);
      const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
      await requestJson(`${API}&action=upload-part`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ uploadId: init.uploadId, partNumber, data: toBase64(bytes) }) });
      status(`Upload ${Math.min(100, Math.round(end / file.size * 100))}%`);
    }
    const complete = await requestJson(`${API}&action=upload-complete`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ uploadId: init.uploadId }) });
    slide.path = complete.path; status('Upload berhasil. Klik Simpan perubahan untuk menambahkannya ke carousel.');
  } catch (error) { status(`Upload gagal: ${error.message}`); }
  finally { busy.value = false; }
}
async function saveSlides() {
  if (slides.value.some((slide) => !slide.path.trim())) { status('Semua path harus diisi.'); return; }
  busy.value = true; status('Menyimpan daftar gallery...');
  try {
    const result = await requestJson(API, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ slides: slides.value }) });
    status(`Tersimpan: ${result.slides} gambar.`);
  } catch (error) { session.value = ''; editing.value = false; status(error.message); }
  finally { busy.value = false; }
}
async function sendTest() {
  if (busy.value) return;
  busy.value = true; status('Mengirim notifikasi TEST ke Discord...');
  try {
    const result = await requestJson(TEST_API, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ form: selectedForm.value }) });
    status(`Notifikasi TEST untuk ${formNames[result.form] || result.form} berhasil dikirim.`);
  } catch (error) {
    status(`Gagal mengirim tes: ${error.message}`);
    if (error.message.includes('Sesi login berakhir')) { session.value = ''; editing.value = false; }
  } finally { busy.value = false; }
}
function logout() { session.value = ''; slides.value = []; editing.value = false; status('Anda sudah keluar.'); }
</script>

<template>
  <div class="gallery-admin-page">
    <div class="bg" aria-hidden="true"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="bubbles"><span></span><span></span><span></span><span></span><span></span></div></div>
    <main class="panel" :class="{ wide: editing }">
      <div class="brand"><div class="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="9" cy="10" r="1.8"></circle><path d="m21 16-5-5-8 9"></path></svg></div></div>
      <h1>Kelola Gallery</h1><p class="sub">{{ editing ? 'Atur urutan slide, teks alt, dan unggah gambar baru.' : 'Login untuk mengatur slide dan mengunggah gambar langsung dari komputer.' }}</p>
      <section v-if="!editing" aria-label="Login admin galeri">
        <form @submit.prevent="login">
          <div class="field"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg><input id="adminId" v-model="adminId" placeholder=" " autocomplete="username" aria-label="ID admin" required><label for="adminId">ID admin</label></div>
          <div class="field"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg><input id="adminPassword" v-model="password" :type="showPassword ? 'text' : 'password'" placeholder=" " autocomplete="current-password" aria-label="Password" required><label for="adminPassword">Password</label><button class="eye" type="button" :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'" @click="showPassword = !showPassword"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg></button></div>
          <button id="loginButton" type="submit" :disabled="busy" :class="{ loading: busy }"><span class="spinner" aria-hidden="true"></span><span class="label-text">{{ busy ? 'Memeriksa...' : 'Login' }}</span></button>
        </form>
        <a class="superadmin-link" href="./admin-site-editor.html" aria-label="Login as Super Admin untuk membuka Editor Website"><i class="fa-solid fa-shield-halved"></i> Login as Super Admin</a>
        <p class="secure"><i class="fa-solid fa-shield-halved"></i> Area khusus admin · sesi berlaku 30 menit</p>
      </section>
      <section v-else aria-label="Editor galeri">
        <div id="rows"><div v-for="(slide,index) in slides" :key="index" class="row"><input v-model="slide.path" placeholder="Path gambar atau URL hasil upload" :aria-label="`Path gambar ${index+1}`"><input v-model="slide.alt" placeholder="Teks alt" :aria-label="`Teks alt ${index+1}`"><div><input type="file" accept="image/jpeg,image/png,image/webp" :aria-label="`Pilih file gambar ${index+1}`" @change="uploadImage($event.target.files?.[0],slide)"><button class="upload" type="button" :disabled="busy" @click="$event.currentTarget.parentElement.querySelector('input[type=file]').click()">Upload</button></div><button class="remove" type="button" :disabled="busy" @click="removeSlide(index)">Hapus</button></div></div>
        <div class="actions"><button id="add" type="button" :disabled="busy" @click="addSlide">Tambah gambar</button><button id="save" type="button" :disabled="busy" @click="saveSlides">Simpan perubahan</button><button id="logout" type="button" @click="logout">Keluar</button></div>
        <div class="discord-test-actions"><label for="discordTestForm">Tes notifikasi Discord<select id="discordTestForm" v-model="selectedForm"><option value="banner">Permintaan Desain</option><option value="gmaps">Google Maps</option><option value="cabang">Pendaftaran Cabang/Agen</option><option value="audit">Audit Branding</option></select></label><button id="discordTestButton" type="button" :disabled="busy" @click="sendTest">Kirim notifikasi TEST</button><p>Pesan akan diberi label TEST. Data formulir dan spreadsheet tidak diubah.</p></div>
        <p class="hint">Format upload: JPG, PNG, WebP, maksimal 500 MB per gambar. Sesi login berlaku 30 menit.</p>
      </section>
      <div class="status" :class="statusClass" role="status" aria-live="polite">{{ statusText }}</div>
    </main>
  </div>
</template>

<style>
.superadmin-link { position: static; display: inline-flex; align-items: center; gap: 9px; justify-content: center; width: 100%; margin-top: 12px; padding: 10px 18px; border: 1.5px solid rgba(0,52,98,.2); border-radius: 14px; background: #fff; color: #003462; font: 800 14px/1 "Manrope",system-ui,sans-serif; text-decoration: none; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,52,98,.08); transition: .2s; }
.superadmin-link:hover,.superadmin-link:focus-visible { background:#003462;color:#fff;transform:translateY(-1px);box-shadow:0 12px 26px rgba(0,52,98,.32);outline:none }
.discord-test-actions { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;margin-top:18px;padding:16px;border:1px solid #dbe5ef;border-radius:14px;background:#f5f8fb }
.discord-test-actions label { display:grid;gap:7px;font-weight:700;color:#244765 }
.discord-test-actions select { min-height:42px;padding:9px 11px;border:1px solid #cbd7e3;border-radius:9px;background:white;color:#183b59;font:600 14px "Manrope",sans-serif }
.discord-test-actions button { min-height:42px;padding:10px 15px;border:0;border-radius:9px;background:#5865f2;color:white;font-weight:800;cursor:pointer }
.discord-test-actions button:disabled { opacity:.6;cursor:progress }
.discord-test-actions p { grid-column:1/-1;margin:0;color:#64748b;font-size:12px }
.gallery-admin-page { position:relative;z-index:1;min-height:100vh;display:grid;place-items:center;padding:24px }
.gallery-admin-page .bg { z-index:-1 }
@media(max-width:600px){.discord-test-actions{grid-template-columns:1fr}.discord-test-actions p{grid-column:auto}.superadmin-link{font-size:13px}}
</style>
