<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import PortalChrome from '../components/PortalChrome.vue';
import { useRegions } from '../composables/useRegions.js';
import '../../Design Agen Cabang/style.css';
import '../../shared/site-chrome.css';

const WORKER = 'https://digitalmarketing.iamhere-devone.workers.dev/';
const regions = useRegions();
const requests = ['Brosur', 'Plang Banner', 'Spanduk Komersial', 'Papan Meja, Papan Dinding (Interior)'];
const selectedRequests = ref([]);
const allPackage = ref(false);
const customSize = ref(false);
const showDesign = ref(false);
const showReview = ref(false);
const busy = ref(false);
const notice = reactive({ text: '', error: false });
const directory = ref([]);
const suggestionsOpen = ref(false);
const activeSuggestion = ref(-1);
const autoFilledAgent = ref('');
const directoryStatus = ref('Memuat daftar nama cabang…');
const model = reactive({ jenisAgen: '', namaAgen: '', portArea: '', kodeTop: '', statusAgen: '', namaJalan: '', noTelp: '', ukuranBanner: '', customUkuran: '', deskripsi: '' });
const portNames = ['BOGOR','SOLOK','CIKARANG','BANDUNG','DELISERDANG','LEGUNDI','JEMBRANA','MARUNDA','TANGERANG','CIPAYUNG','MAKASSAR','PALEMBANG','PEKANBARU','BANJARMASIN','KALIWUNGU','MADIUN','PROBOLINGGO','LAMPUNG','PEJAGAN','PONTIANAK','BALIKPAPAN'];
const normalizedName = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
const matches = computed(() => {
  const query = normalizedName(model.namaAgen);
  return query ? directory.value.filter((item) => normalizedName(item.name).includes(query)).slice(0, 8) : directory.value.slice(0, 8);
});
const needsSize = computed(() => selectedRequests.value.includes('Spanduk Komersial'));

function notify(text, error = false) { notice.text = text; notice.error = error; setTimeout(() => { if (notice.text === text) notice.text = ''; }, 4000); }
function setOwnership(value) {
  const text = normalizedName(value);
  if (text.includes('independent') || text.includes('independen')) model.statusAgen = 'Independent';
  else if (text.includes('pusat') || text.includes('perusahaan')) model.statusAgen = 'Pusat';
}
function matchAgent() {
  const name = normalizedName(model.namaAgen);
  const item = directory.value.find((agent) => normalizedName(agent.name) === name);
  if (item) {
    model.namaAgen = item.name; model.jenisAgen = item.jenisTop || ''; model.portArea = item.portArea || ''; model.kodeTop = item.kodeTop || '';
    setOwnership(item.kepemilikan); autoFilledAgent.value = name;
    directoryStatus.value = `Data TOP dan PORT terisi otomatis untuk ${item.name}.`;
  } else if (autoFilledAgent.value) {
    model.jenisAgen = ''; model.portArea = ''; model.kodeTop = ''; model.statusAgen = ''; autoFilledAgent.value = '';
  }
}
function chooseAgent(item) { model.namaAgen = item.name; matchAgent(); suggestionsOpen.value = false; }
function onAgentKeydown(event) {
  if (!suggestionsOpen.value || !matches.value.length) return;
  if (event.key === 'ArrowDown') { event.preventDefault(); activeSuggestion.value = (activeSuggestion.value + 1) % matches.value.length; }
  else if (event.key === 'ArrowUp') { event.preventDefault(); activeSuggestion.value = (activeSuggestion.value + matches.value.length - 1) % matches.value.length; }
  else if (event.key === 'Enter' && activeSuggestion.value >= 0) { event.preventDefault(); chooseAgent(matches.value[activeSuggestion.value]); }
  else if (event.key === 'Escape') suggestionsOpen.value = false;
}
function setPackage(value) { allPackage.value = value; selectedRequests.value = value ? [...requests] : []; }
function toggleRequest() { allPackage.value = selectedRequests.value.length === requests.length; if (!needsSize.value) model.ukuranBanner = ''; }
function closeModals() { showDesign.value = false; showReview.value = false; }
function collectData() {
  return {
    jenisForm: 'banner', jenisAgen: model.jenisAgen, namaAgen: model.namaAgen.trim(), kodeTop: model.kodeTop.trim(), portArea: model.portArea,
    statusAgen: model.statusAgen, namaJalan: model.namaJalan.trim(), noTelp: model.noTelp.trim(), provinsi: regions.provinceName(),
    kabupatenKota: regions.cityName(), kecamatan: regions.districtName(), kelurahan: regions.villageName(), kodePos: regions.postalCode.value,
    paketAll: allPackage.value, tambahan: selectedRequests.value.join(', '), ukuranBanner: model.ukuranBanner === 'custom' ? model.customUkuran.trim() : model.ukuranBanner,
    deskripsi: model.deskripsi.trim(), waktuKirim: new Date().toISOString()
  };
}
function review() {
  const data = collectData();
  if (!data.kodePos) { notify('Kode pos belum terisi. Pilih Kelurahan/Desa terlebih dahulu.', true); return; }
  if (needsSize.value && (!model.ukuranBanner || (model.ukuranBanner === 'custom' && !model.customUkuran.trim()))) { notify('Pilih ukuran spanduk terlebih dahulu.', true); return; }
  showReview.value = true;
}
async function submit() {
  if (busy.value) return;
  busy.value = true;
  try {
    const response = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectData()) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || result.message || 'Gagal mengirim data.');
    showReview.value = false; Object.assign(model, { jenisAgen: '', namaAgen: '', portArea: '', kodeTop: '', statusAgen: '', namaJalan: '', noTelp: '', ukuranBanner: '', customUkuran: '', deskripsi: '' });
    selectedRequests.value = []; allPackage.value = false; regions.provinceId.value = ''; regions.cityId.value = ''; regions.districtId.value = ''; regions.villageId.value = ''; regions.cities.value = []; regions.districts.value = []; regions.villages.value = [];
    notify('Permintaan berhasil dikirim.');
  } catch (error) { notify(`Gagal mengirim. ${error.message}`, true); }
  finally { busy.value = false; }
}
onMounted(async () => {
  document.title = 'Permintaan Desain | Baraka Express';
  regions.loadProvinces();
  try {
    const response = await fetch(`${WORKER}?resource=agent-directory`, { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Daftar nama tidak tersedia.');
    directory.value = Array.isArray(result.agents) ? result.agents : [];
    directoryStatus.value = directory.value.length ? `${directory.value.length} nama tersedia. Pilih saran atau ketik nama yang sesuai.` : 'Belum ada data nama di spreadsheet.';
  } catch { directoryStatus.value = 'Daftar nama belum termuat. Field tetap bisa diisi manual.'; }
});
</script>

<template>
  <div class="portal-page">
    <PortalChrome>
      <div class="card">
        <h2>Permintaan Desain</h2>
        <form @submit.prevent="review">
          <div class="grid2"><div><label>Nama TOP</label><div class="agen-row"><select v-model="model.jenisAgen" required @change="autoFilledAgent = ''"><option value="">Pilih</option><option>Agen</option><option>Cabang</option><option>PORT</option></select><div class="agent-name-wrap"><input v-model="model.namaAgen" placeholder="Ketik nama TOP" autocomplete="off" aria-autocomplete="list" :aria-expanded="suggestionsOpen" aria-describedby="agentDirectoryStatus" required @input="matchAgent(); suggestionsOpen = true; activeSuggestion = -1" @focus="suggestionsOpen = true" @blur="setTimeout(() => suggestionsOpen = false, 150)" @keydown="onAgentKeydown"><div v-if="suggestionsOpen && matches.length" class="agent-suggestions" role="listbox" aria-label="Pilihan nama TOP"><button v-for="(agent,index) in matches" :key="agent.name" type="button" class="agent-suggestion" :class="{ active: index === activeSuggestion }" role="option" :aria-selected="index === activeSuggestion" @mousedown.prevent="chooseAgent(agent)"><strong>{{ agent.name }}</strong><small>{{ agent.jenisTop }} · {{ agent.portArea }}</small></button></div></div></div><small id="agentDirectoryStatus" class="field-hint" role="status">{{ directoryStatus }}</small></div>
            <div><label>PORT Area</label><select v-model="model.portArea" required @change="autoFilledAgent = ''"><option value="">Pilih PORT Area</option><option v-for="port in portNames" :key="port" :value="`PORT ${port}`">PORT {{ port }}</option></select></div></div>
          <input v-model="model.kodeTop" type="hidden">
          <div class="form-group"><label>Kepemilikan</label><div class="status-box row"><label><input v-model="model.statusAgen" type="radio" name="statusAgen" value="Pusat" required @change="autoFilledAgent = ''"> Pusat</label><label><input v-model="model.statusAgen" type="radio" name="statusAgen" value="Independent" required @change="autoFilledAgent = ''"> Independent</label></div></div>
          <div class="grid2"><div><label>Nama Jalan / Patokan</label><input v-model.trim="model.namaJalan" placeholder="Contoh: Jl. Merdeka No.10" required></div><div><label>Nomor Telepon</label><input v-model="model.noTelp" placeholder="08123456789" class="only-number" inputmode="numeric" required @input="model.noTelp = model.noTelp.replace(/\D/g, '')"></div></div>
          <div class="grid2"><div><label>Provinsi</label><select :value="regions.provinceId.value" required @change="regions.selectProvince($event.target.value)"><option value="">Pilih Provinsi</option><option v-for="item in regions.provinces.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div><label>Kabupaten / Kota</label><select :value="regions.cityId.value" required :disabled="!regions.provinceId.value" @change="regions.selectCity($event.target.value)"><option value="">Pilih Kabupaten/Kota</option><option v-for="item in regions.cities.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div></div>
          <div class="grid2"><div><label>Kecamatan</label><select :value="regions.districtId.value" required :disabled="!regions.cityId.value" @change="regions.selectDistrict($event.target.value)"><option value="">Pilih Kecamatan</option><option v-for="item in regions.districts.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div><label>Kelurahan / Desa</label><select v-model="regions.villageId.value" required :disabled="!regions.districtId.value"><option value="">Pilih Kelurahan/Desa</option><option v-for="item in regions.villages.value" :key="item.id" :value="item.id">{{ item.name }}</option></select></div></div>
          <div><label>Kode Pos</label><input :value="regions.postalCode.value" placeholder="Otomatis terisi" class="kodepos-input" readonly required></div>
          <div class="lihat-contoh" role="button" tabindex="0" @click="showDesign = true" @keydown.enter="showDesign = true"><i class="bi bi-eye"></i> Lihat Contoh Design</div>
          <label>Jenis Permintaan Tambahan</label><div class="checkbox-group"><label v-for="(request,index) in requests" :key="request"><input v-model="selectedRequests" type="checkbox" :value="request" @change="toggleRequest"> {{ ['Brosur Cetak','Papan Nama Luar (Eksterior)','Spanduk Komersial','Papan Meja, Papan Dinding (Interior)'][index] }}</label><div style="font-size:12px;color:#64748b;margin:-6px 0 10px 30px"><i>*Pendistribusian dilakukan bertahap dari Tim GA</i></div><label style="border-top:1px solid #e2e8f0;padding-top:10px"><input v-model="allPackage" type="checkbox" @change="setPackage(allPackage)"> <b>Paket Cabang / Agen Baru</b></label></div>
          <div v-if="needsSize" id="ukuranContainer"><label>Ukuran Spanduk Komersial</label><select v-model="model.ukuranBanner" required><option value="">Pilih ukuran</option><option value="3:1">3:1</option><option value="2:1">2:1</option><option value="1:1">1:1</option><option value="custom">Custom Ukuran</option></select><input v-if="model.ukuranBanner === 'custom'" v-model.trim="model.customUkuran" type="text" style="margin-top:10px" placeholder="Contoh: Panjang 2 meter (Untuk ukuran custom cukup masukkan panjangnya saja)" required></div>
          <label>Deskripsi Tambahan</label><textarea v-model.trim="model.deskripsi" rows="3" placeholder="Contoh: Plang Banner ukuran 3x1 meter"></textarea>
          <div class="note-box"><div class="note-title"><i class="bi bi-info-circle-fill"></i> Informasi Pemrosesan</div><div class="note-content"><ul><li><b>Cabang / Agen Pusat (Request Cetak)</b><br>Permintaan diteruskan ke <b>Tim GA Pusat</b> untuk produksi &amp; distribusi.</li><li><b>Cabang / Agen Independent (Request Softfile)</b><br>Permintaan diteruskan ke kontak Admin di form untuk cetak mandiri.</li></ul></div></div>
          <button type="submit">Kirim Permintaan</button>
        </form>
      </div>
      <div v-if="showReview" id="reviewModal" class="modal show" role="dialog" aria-modal="true" @click.self="showReview = false"><div class="modal-content"><button class="close" type="button" aria-label="Tutup" @click="showReview = false">&times;</button><div class="modal-header">Konfirmasi Data</div><div id="reviewContent" class="review-content">
        <section><div class="rv-title">Data TOP</div><div class="rv-row"><span>Nama TOP</span><strong>{{ model.namaAgen || '-' }}</strong></div><div class="rv-row"><span>Jenis TOP</span><strong>{{ model.jenisAgen || '-' }}</strong></div><div class="rv-row"><span>Kode TOP</span><strong>{{ model.kodeTop || '-' }}</strong></div><div class="rv-row"><span>PORT Area</span><strong>{{ model.portArea || '-' }}</strong></div><div class="rv-row"><span>Kepemilikan</span><strong>{{ model.statusAgen || '-' }}</strong></div><div class="rv-row"><span>Telepon</span><strong>{{ model.noTelp || '-' }}</strong></div></section>
        <section><div class="rv-title">Alamat</div><div v-for="[label,value] in [['Jalan / Patokan',model.namaJalan],['Provinsi',regions.provinceName()],['Kabupaten / Kota',regions.cityName()],['Kecamatan',regions.districtName()],['Kelurahan / Desa',regions.villageName()],['Kode Pos',regions.postalCode.value]]" :key="label" class="rv-row"><span>{{ label }}</span><strong>{{ value || '-' }}</strong></div></section>
        <section><div class="rv-title">Permintaan</div><div class="rv-row"><span>Jenis</span><strong>{{ allPackage ? 'Paket Cabang / Agen Baru' : selectedRequests.join(', ') || '-' }}</strong></div><div v-if="allPackage" class="rv-row"><span>Isi Paket</span><strong>{{ selectedRequests.join(', ') }}</strong></div><div v-if="model.ukuranBanner" class="rv-row"><span>Ukuran Spanduk</span><strong>{{ model.ukuranBanner === 'custom' ? model.customUkuran : model.ukuranBanner }}</strong></div><div class="rv-row"><span>Deskripsi</span><strong>{{ model.deskripsi || '-' }}</strong></div></section>
      </div><div class="btn-group-modal"><button type="button" style="background:#e2e8f0;color:#333" :disabled="busy" @click="showReview = false">Edit Form</button><button type="button" id="btnKirim" :disabled="busy" @click="submit">{{ busy ? 'Mengirim...' : 'Konfirmasi & Kirim' }}</button></div></div></div>
      <div v-if="showDesign" id="designModal" class="modal show" role="dialog" aria-modal="true" @click.self="showDesign = false"><div class="modal-content"><button class="close" type="button" aria-label="Tutup" @click="showDesign = false">&times;</button><div class="modal-header">Contoh Design</div><div class="design-grid"><div class="design-item"><img src="https://drive.google.com/thumbnail?id=1HURX2QoKa9n05OFurrFZl0SPwYPiidC5" alt="Brosur"><b>Brosur Cetak</b></div><div class="design-item"><img src="https://drive.google.com/thumbnail?id=1JrgdrUz4utippW8D1lxMWM0CqTFg1dJO&amp;sz" alt="Spanduk"><b>Spanduk Komersial</b></div><div class="design-item"><img src="https://drive.google.com/thumbnail?id=1w6lI5XpALFHQyxfuurFTtsHADlHeQDna" alt="Plang"><b>Papan Nama Luar</b></div></div></div></div>
      <div v-if="notice.text" id="msg" class="app-notice" :class="{ error: notice.error }" role="status">{{ notice.text }}</div>
    </PortalChrome>
  </div>
</template>

<style>
.agent-name-wrap { position: relative; flex: 1; min-width: 0; }
.agent-suggestions { position: absolute; z-index: 30; top: calc(100% + 5px); left: 0; right: 0; max-height: 260px; overflow: auto; border: 1px solid #dbe4ed; border-radius: 12px; background: white; box-shadow: 0 12px 28px #12303b22; }
.agent-suggestion { display: flex; flex-direction: column; width: 100%; padding: 10px 12px; text-align: left; border: 0; background: white; color: #17394e; cursor: pointer; }
.agent-suggestion:hover,.agent-suggestion.active { background: #eaf4f8; }
.agent-suggestion small { color: #64748b; }
.review-content { max-height: 60vh; overflow-y: auto; }
.review-content section { margin-bottom: 16px; }
.rv-title { padding-bottom: 6px; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.rv-row { display: grid; grid-template-columns: 140px minmax(0,1fr); gap: 12px; padding: 7px 0; border-bottom: 1px dashed #eef2f7; overflow-wrap: anywhere; }
.rv-row span { color: #64748b; font-size: 13px; }
.rv-row strong { color: #0f172a; font-size: 14px; }
.app-notice { position: fixed; z-index: 2000; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 12px 18px; border-radius: 10px; color: white; background: #16a34a; box-shadow: 0 4px 12px #0003; }
.app-notice.error { background: #dc2626; }
@media(max-width:480px){.rv-row{grid-template-columns:1fr;gap:2px}}
</style>
