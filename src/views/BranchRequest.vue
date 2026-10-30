<script setup>
import { onMounted, reactive, ref } from 'vue';
import PortalChrome from '../components/PortalChrome.vue';
import { useRegions } from '../composables/useRegions.js';
import '../../Cabang Agen Baru/style.css';
import '../../shared/site-chrome.css';

const API = 'https://digitalmarketing.iamhere-devone.workers.dev/';
const regions = useRegions();
const busy = ref(false);
const status = reactive({ text: '', kind: '' });
const form = reactive({ tipe: '', tipeTop: '', namaAgen: '', kepemilikan: '', tanggalPembukaan: '', alamat: '', telepon: '', gmaps: '' });
const ports = ['BOGOR','SOLOK','CIKARANG','BANDUNG','DELISERDANG','LEGUNDI','JEMBRANA','MARUNDA','TANGERANG','CIPAYUNG','MAKASSAR','PALEMBANG','PEKANBARU','BANJARMASIN','KALIWUNGU','MADIUN','PROBOLINGGO','LAMPUNG','PEJAGAN','PONTIANAK','BALIKPAPAN'];

function reset() {
  Object.assign(form, { tipe: '', tipeTop: '', namaAgen: '', kepemilikan: '', tanggalPembukaan: '', alamat: '', telepon: '', gmaps: '' });
  regions.provinceId.value = ''; regions.cityId.value = ''; regions.districtId.value = ''; regions.villageId.value = '';
  regions.cities.value = []; regions.districts.value = []; regions.villages.value = [];
}
async function submit() {
  if (busy.value) return;
  busy.value = true; status.text = ''; status.kind = '';
  const payload = {
    jenisForm: 'cabang', ...form,
    jamOperasional: form.tipeTop === 'Cabang' ? '08.00 WIB - 17.00 WIB' : form.tipeTop === 'Agen' ? '09.00 WIB - 17.00 WIB' : '',
    provinsiKode: regions.provinceId.value, provinsiNama: regions.provinceName(),
    kabupatenKode: regions.cityId.value, kabupatenNama: regions.cityName(),
    kecamatanKode: regions.districtId.value, kecamatanNama: regions.districtName(),
    kelurahanKode: regions.villageId.value, kelurahanNama: regions.villageName(),
    kodePos: regions.postalCode.value
  };
  try {
    const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || result.message || 'Gagal mengirim data.');
    status.text = 'Permintaan berhasil dikirim.'; status.kind = 'ok'; reset();
  } catch (error) { status.text = `Terjadi kesalahan: ${error.message}`; status.kind = 'err'; }
  finally { busy.value = false; }
}
onMounted(() => { document.title = 'Pendaftaran Agen / Cabang Baru | Baraka Express'; regions.loadProvinces(); });
</script>

<template>
  <div class="portal-page portal-branch-form">
    <PortalChrome>
      <div class="wrap">
        <form @submit.prevent="submit">
          <div class="head"><div class="eyebrow">Formulir Internal</div><h1>Pendaftaran Agen / Cabang Baru</h1><p>Lengkapi seluruh data di bawah ini untuk mengajukan pendaftaran agen atau cabang baru.</p></div>
          <fieldset><legend>Informasi Umum</legend>
            <div class="row">
              <div class="field small"><label>Port Area <span class="req">*</span></label><select v-model="form.tipe" required><option value="">Pilih Port Area</option><option v-for="port in ports" :key="port" :value="`PORT_${port}`">PORT {{ port }}</option></select></div>
              <div class="field small"><label>Tipe TOP <span class="req">*</span></label><select v-model="form.tipeTop" required><option value="">Pilih Tipe</option><option value="PORT">PORT</option><option value="Cabang">Cabang</option><option value="Agen">Agen</option></select></div>
              <div class="field"><label>Lokasi Pembukaan Agen/Cabang <span class="req">*</span></label><input v-model.trim="form.namaAgen" required maxlength="150"></div>
            </div>
            <div class="row"><div class="field"><label>Kepemilikan <span class="req">*</span></label><div class="radio-group"><label class="radio-option"><input v-model="form.kepemilikan" type="radio" name="kepemilikan" value="Pusat" required> Pusat</label><label class="radio-option"><input v-model="form.kepemilikan" type="radio" name="kepemilikan" value="Independent"> Independent</label></div></div></div>
            <div class="row"><div class="field small"><label>Tanggal Pembukaan TOP <span class="req">*</span></label><input v-model="form.tanggalPembukaan" type="date" required></div></div>
          </fieldset>
          <fieldset><legend>Alamat &amp; Kontak</legend><div class="row"><div class="field"><label>Alamat Lengkap <span class="req">*</span></label><input v-model.trim="form.alamat" required maxlength="1000"></div><div class="field small"><label>No. Telepon/WA Aktif <span class="req">*</span></label><input v-model.trim="form.telepon" type="tel" required></div></div></fieldset>
          <fieldset><legend>Lokasi Wilayah</legend>
            <div class="row"><div class="field"><label>Provinsi <span class="req">*</span></label><select :value="regions.provinceId.value" required @change="regions.selectProvince($event.target.value)"><option value="">{{ regions.loading.value ? 'Memuat...' : 'Pilih Provinsi' }}</option><option v-for="item in regions.provinces.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div class="field"><label>Kabupaten / Kota <span class="req">*</span></label><select :value="regions.cityId.value" required :disabled="!regions.provinceId.value" @change="regions.selectCity($event.target.value)"><option value="">Pilih kabupaten/kota</option><option v-for="item in regions.cities.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div></div>
            <div class="row"><div class="field"><label>Kecamatan <span class="req">*</span></label><select :value="regions.districtId.value" required :disabled="!regions.cityId.value" @change="regions.selectDistrict($event.target.value)"><option value="">Pilih kecamatan</option><option v-for="item in regions.districts.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div class="field"><label>Kelurahan / Desa <span class="req">*</span></label><select v-model="regions.villageId.value" required :disabled="!regions.districtId.value"><option value="">Pilih kelurahan/desa</option><option v-for="item in regions.villages.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div></div>
            <div class="row"><div class="field small"><label>Kode Pos</label><input :value="regions.postalCode.value" readonly placeholder="Otomatis"></div></div><p v-if="regions.error.value" class="msg err">{{ regions.error.value }}</p>
          </fieldset>
          <fieldset><legend>Peta</legend><div class="row"><div class="field"><label>Link Google Maps</label><input v-model.trim="form.gmaps" type="url" placeholder="https://maps.google.com/..."><div class="hint">Buka Google Maps, cari lokasi, salin link “Bagikan”, lalu tempel di sini.</div></div></div></fieldset>
          <div class="actions"><button type="submit" :disabled="busy">{{ busy ? 'Mengirim...' : 'Kirim Permintaan' }}</button><div class="msg" :class="status.kind" role="status" aria-live="polite">{{ status.text }}</div></div>
        </form>
      </div>
    </PortalChrome>
  </div>
</template>
