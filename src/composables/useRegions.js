import { computed, ref } from 'vue';

const API = 'https://www.emsifa.com/api-wilayah-indonesia/v2';

export function useRegions() {
  const provinces = ref([]);
  const cities = ref([]);
  const districts = ref([]);
  const villages = ref([]);
  const provinceId = ref('');
  const cityId = ref('');
  const districtId = ref('');
  const villageId = ref('');
  const postalCode = computed(() => villages.value.find((item) => item.id === villageId.value)?.postal_code || '');
  const loading = ref(false);
  const error = ref('');

  async function load(url) {
    const response = await fetch(`${API}/${url}`);
    if (!response.ok) throw new Error('Data wilayah gagal dimuat. Coba refresh halaman.');
    const result = await response.json();
    return Array.isArray(result.data) ? result.data : [];
  }

  async function loadProvinces() {
    loading.value = true;
    try { provinces.value = await load('provinces.json'); error.value = ''; }
    catch (e) { error.value = e.message; }
    finally { loading.value = false; }
  }

  async function selectProvince(id) {
    provinceId.value = id; cityId.value = ''; districtId.value = ''; villageId.value = '';
    cities.value = []; districts.value = []; villages.value = [];
    if (!id) return;
    try { cities.value = await load(`regencies/${id}.json`); }
    catch (e) { error.value = e.message; }
  }
  async function selectCity(id) {
    cityId.value = id; districtId.value = ''; villageId.value = ''; districts.value = []; villages.value = [];
    if (!id) return;
    try { districts.value = await load(`districts/${id}.json`); }
    catch (e) { error.value = e.message; }
  }
  async function selectDistrict(id) {
    districtId.value = id; villageId.value = ''; villages.value = [];
    if (!id) return;
    try { villages.value = await load(`villages/${id}.json`); }
    catch (e) { error.value = e.message; }
  }
  function nameOf(list, id) { return list.value.find((item) => item.id === id)?.name || ''; }

  return {
    provinces, cities, districts, villages, provinceId, cityId, districtId, villageId,
    postalCode, loading, error, loadProvinces, selectProvince, selectCity, selectDistrict,
    provinceName: () => nameOf(provinces, provinceId.value),
    cityName: () => nameOf(cities, cityId.value),
    districtName: () => nameOf(districts, districtId.value),
    villageName: () => nameOf(villages, villageId.value)
  };
}
