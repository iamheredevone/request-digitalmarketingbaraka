<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import PortalChrome from '../components/PortalChrome.vue';
import { useRegions } from '../composables/useRegions.js';
import '../../Google Maps Agen Cabang/style.css';
import '../../shared/site-chrome.css';

const API = 'https://digitalmarketing.iamhere-devone.workers.dev/';
const regions = useRegions();
const busy = ref(false);
const toast = reactive({ text: '', error: false });
const reviewOpen = ref(false);
const payload = ref(null);
const requestTypes = ['Buat Maps Baru', 'Pindah Alamat', 'Update Info'];
const isNew = computed(() => ['Buat Maps Baru', 'Pindah Alamat'].includes(form.jenisPermintaan));
const isMove = computed(() => form.jenisPermintaan === 'Pindah Alamat');
const isUpdate = computed(() => form.jenisPermintaan === 'Update Info');
const form = reactive({ jenisPermintaan: '', jenisAgen: 'Agen', namaAgen: '', kepemilikan: '', kodeTop: '', portArea: '', noTelp: '', mapsBaru: '', namaJalan: '', mapsLama: '', alamatLama: '', mapsSaatIni: '', jamOperasional: '', deskripsi: '' });
let toastTimer;

function notify(text, error = false) {
  toast.text = text; toast.error = error;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.text = ''; }, 3500);
}
function openReview() {
  const data = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, String(value || '').trim()]));
  data.jenisForm = 'gmaps';
  data.provinsi = regions.provinceName(); data.kabupatenKota = regions.cityName();
  data.kecamatan = regions.districtName(); data.kelurahan = regions.villageName(); data.kodePos = regions.postalCode.value;
  payload.value = data; reviewOpen.value = true;
}
function reset() {
  Object.assign(form, { jenisPermintaan: '', jenisAgen: 'Agen', namaAgen: '', kepemilikan: '', kodeTop: '', portArea: '', noTelp: '', mapsBaru: '', namaJalan: '', mapsLama: '', alamatLama: '', mapsSaatIni: '', jamOperasional: '', deskripsi: '' });
  regions.provinceId.value = ''; regions.cityId.value = ''; regions.districtId.value = ''; regions.villageId.value = '';
  regions.cities.value = []; regions.districts.value = []; regions.villages.value = [];
}
async function submit() {
  if (busy.value || !payload.value) return;
  busy.value = true;
  try {
    const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload.value) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `Pengiriman gagal (HTTP ${response.status})`);
    notify('Laporan berhasil terkirim!'); reviewOpen.value = false; reset();
  } catch (error) { notify(`Gagal mengirim: ${error.message}`, true); }
  finally { busy.value = false; }
}
onMounted(() => { document.title = 'Permintaan Google Maps | Baraka Express'; regions.loadProvinces(); });
</script>

<template>
  <div class="portal-page">
    <PortalChrome>
      <div class="card">
        <h2>Form Request GMaps</h2>
        <form @submit.prevent="openReview">
          <div class="form-group" style="background:#e0f2fe;padding:15px;border-radius:8px;border:1px solid #bae6fd">
            <label style="color:#0369a1;font-size:15px">Jenis Permintaan (Wajib Pilih)</label>
            <select v-model="form.jenisPermintaan" required style="border-color:#7dd3fc;font-weight:bold;color:#0369a1"><option value="">-- Pilih Kebutuhan --</option><option v-for="(type,index) in requestTypes" :key="type" :value="type">{{ index + 1 }}. {{ type === 'Buat Maps Baru' ? 'Buat Maps Baru (Agen/Cabang Baru)' : type === 'Pindah Alamat' ? 'Perubahan Alamat & Geser Titik Maps' : 'Update Info (No HP / Jam / Foto)' }}</option></select>
          </div>
          <div class="section-title">Informasi Dasar Agen</div>
          <div class="grid2 form-group"><div><label>Jenis &amp; Nama</label><div class="agen-name-row"><select v-model="form.jenisAgen" required><option>Agen</option><option>Cabang</option><option>PORT</option></select><input v-model.trim="form.namaAgen" placeholder="Nama..." required maxlength="150"></div></div><div><label>Kepemilikan</label><div class="radio-group"><label><input v-model="form.kepemilikan" type="radio" name="kepemilikan" value="Pusat" required> Pusat</label><label><input v-model="form.kepemilikan" type="radio" name="kepemilikan" value="Independent"> Independent</label></div></div></div>
          <div class="grid2 form-group"><div><label>Kode TOP</label><input v-model.trim="form.kodeTop" placeholder="Contoh: 001JKT" required></div><div><label>Port Area</label><input v-model.trim="form.portArea" placeholder="Contoh: Tangerang" required></div></div>
          <div class="form-group"><label>Nomor Telepon GMap (Opsional)</label><input v-model.trim="form.noTelp" type="tel" placeholder="08123xxxx" pattern="[0-9]*" inputmode="numeric"></div>
          <div v-if="isNew" class="section-dynamic" style="display:block"><div class="section-title">{{ isMove ? 'Alamat & Titik Maps Tujuan (Baru)' : 'Alamat Lengkap & Titik Maps Baru' }}</div><div class="form-group"><label>Link Google Maps (Titik yang benar)</label><input v-model.trim="form.mapsBaru" type="url" placeholder="https://maps.app.goo.gl/..." required></div><div class="form-group"><label>Detail Jalan / Patokan</label><textarea v-model.trim="form.namaJalan" rows="2" placeholder="Jl. Raya Timur No.10, Samping Indomaret..." :required="form.jenisPermintaan === 'Buat Maps Baru'"></textarea></div>
            <div class="grid2 form-group"><div><label>Provinsi</label><select :value="regions.provinceId.value" @change="regions.selectProvince($event.target.value)"><option value="">Pilih</option><option v-for="item in regions.provinces.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div><label>Kabupaten / Kota</label><select :value="regions.cityId.value" :disabled="!regions.provinceId.value" @change="regions.selectCity($event.target.value)"><option value="">Pilih</option><option v-for="item in regions.cities.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div></div>
            <div class="grid2 form-group"><div><label>Kecamatan</label><select :value="regions.districtId.value" :disabled="!regions.cityId.value" @change="regions.selectDistrict($event.target.value)"><option value="">Pilih</option><option v-for="item in regions.districts.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div><label>Kelurahan / Desa</label><select v-model="regions.villageId.value" :disabled="!regions.districtId.value"><option value="">Pilih</option><option v-for="item in regions.villages.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div></div><div class="form-group"><label>Kode Pos</label><input :value="regions.postalCode.value" readonly style="background:#e2e8f0;text-align:center;font-weight:bold"></div>
          </div>
          <div v-if="isMove" class="section-dynamic" style="display:block;border-left-color:#f59e0b;background:#fffbeb"><div class="section-title" style="color:#d97706">Data Alamat Lama (Yang Salah/Lama)</div><div class="form-group"><label>Link Maps Lama</label><input v-model.trim="form.mapsLama" type="url" placeholder="https://maps.app.goo.gl/..."></div><div class="form-group"><label>Alamat Teks Lama</label><textarea v-model.trim="form.alamatLama" rows="2" placeholder="Masukkan alamat yang lama..."></textarea></div></div>
          <div v-if="isUpdate" class="section-dynamic" style="display:block;border-left-color:#10b981;background:#ecfdf5"><div class="section-title" style="color:#047857">Titik Maps Saat Ini</div><div class="form-group"><label>Link Maps Yang Ingin Diupdate</label><input v-model.trim="form.mapsSaatIni" type="url" placeholder="https://maps.app.goo.gl/..." required></div></div>
          <div class="section-dynamic" style="display:block;border-left-color:#64748b;background:#f8fafc"><div class="section-title" style="color:#334155">Informasi Lainnya</div><div class="form-group"><label>Jam Operasional</label><input v-model.trim="form.jamOperasional" placeholder="Cth: Sen-Sab: 08:00 - 17:00"></div><div class="form-group"><label>Keterangan Tambahan / Alasan Singkat</label><textarea v-model.trim="form.deskripsi" rows="3" placeholder="Jelaskan request Anda (Contoh: Tambah foto banner, ganti nomor HP)"></textarea></div></div>
          <button type="submit" class="btn-submit">Kirim Request</button>
        </form>
      </div>
      <div v-if="reviewOpen" class="modal" style="display:block" role="dialog" aria-modal="true" aria-labelledby="reviewTitle"><div class="modal-content"><div id="reviewTitle" class="modal-header">Konfirmasi Data</div><div class="review-data"><strong>Jenis Request:</strong> {{ payload?.jenisPermintaan || '-' }}<hr><strong>Agen:</strong> {{ payload?.jenisAgen }} {{ payload?.namaAgen }}<br><strong>TOP:</strong> {{ payload?.kodeTop || '-' }} | <strong>Area:</strong> {{ payload?.portArea || '-' }}<br><span v-if="payload?.noTelp"><strong>HP:</strong> {{ payload.noTelp }}</span></div><div class="btn-group"><button type="button" class="btn-edit" :disabled="busy" @click="reviewOpen = false">Kembali Edit</button><button type="button" class="btn-confirm" :disabled="busy" @click="submit">{{ busy ? 'Memproses...' : 'Kirim Sekarang' }}</button></div></div></div>
      <div v-if="toast.text" class="toast" :class="{ error: toast.error, show: true }" role="status" aria-live="polite">{{ toast.text }}</div>
    </PortalChrome>
  </div>
</template>
