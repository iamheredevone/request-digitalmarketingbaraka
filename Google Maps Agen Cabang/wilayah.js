// wilayah.js
// Dropdown wilayah Indonesia berjenjang dari API (emsifa):
// Provinsi -> Kabupaten/Kota -> Kecamatan -> Kelurahan/Desa -> Kode Pos

(function () {
  // API v2: respons dibungkus { data: [...], meta: {...} }, kelurahan sudah ada postal_code
  const API = "https://www.emsifa.com/api-wilayah-indonesia/v2";

  const provinsi  = document.getElementById("provinsi");
  const kabupaten = document.getElementById("kabupaten");
  const kecamatan = document.getElementById("kecamatan");
  const kelurahan = document.getElementById("kelurahan");
  const kodePos   = document.querySelector('input[name="kodePos"]');

  // Kalau elemen tidak ditemukan, hentikan supaya tidak error di halaman lain
  if (!provinsi || !kabupaten || !kecamatan || !kelurahan || !kodePos) {
    console.warn("wilayah.js: elemen form wilayah tidak lengkap.");
    return;
  }

  // Isi <select>. value = nama (dikirim ke server), data-id = id API (untuk request berikutnya)
  function fillSelect(select, placeholder, items) {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      opt.dataset.id = item.id;
      // Kelurahan/desa dari API sudah membawa kode pos
      const pos = item.postal_code ?? item.postalCode ?? item.kode_pos ?? item.kodePos;
      if (pos) opt.dataset.postal = pos;
      select.appendChild(opt);
    });
    select.disabled = false;
  }

  function resetSelect(select, placeholder) {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    select.disabled = true;
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Gagal memuat " + url);
    const json = await res.json();
    return json.data;
  }

  function selectedId(select) {
    return select.options[select.selectedIndex]?.dataset.id;
  }

  // 1. Load provinsi saat halaman dibuka
  async function loadProvinsi() {
    try {
      const data = await fetchJSON(`${API}/provinces.json`);
      fillSelect(provinsi, "Pilih Provinsi", data);
    } catch (e) {
      console.error(e);
      alert("Data provinsi gagal dimuat. Coba refresh halaman.");
    }
  }

  // 2. Provinsi -> Kabupaten/Kota
  provinsi.addEventListener("change", async () => {
    resetSelect(kabupaten, "Pilih Kabupaten/Kota");
    resetSelect(kecamatan, "Pilih Kecamatan");
    resetSelect(kelurahan, "Pilih Kelurahan/Desa");
    kodePos.value = "";

    const id = selectedId(provinsi);
    if (!id) return;
    kabupaten.options[0].textContent = "Memuat...";
    try {
      const data = await fetchJSON(`${API}/regencies/${id}.json`);
      fillSelect(kabupaten, "Pilih Kabupaten/Kota", data);
    } catch (e) {
      console.error(e);
      resetSelect(kabupaten, "Gagal memuat");
    }
  });

  // 3. Kabupaten -> Kecamatan
  kabupaten.addEventListener("change", async () => {
    resetSelect(kecamatan, "Pilih Kecamatan");
    resetSelect(kelurahan, "Pilih Kelurahan/Desa");
    kodePos.value = "";

    const id = selectedId(kabupaten);
    if (!id) return;
    kecamatan.options[0].textContent = "Memuat...";
    try {
      const data = await fetchJSON(`${API}/districts/${id}.json`);
      fillSelect(kecamatan, "Pilih Kecamatan", data);
    } catch (e) {
      console.error(e);
      resetSelect(kecamatan, "Gagal memuat");
    }
  });

  // 4. Kecamatan -> Kelurahan/Desa
  kecamatan.addEventListener("change", async () => {
    resetSelect(kelurahan, "Pilih Kelurahan/Desa");
    kodePos.value = "";

    const id = selectedId(kecamatan);
    if (!id) return;
    kelurahan.options[0].textContent = "Memuat...";
    try {
      const data = await fetchJSON(`${API}/villages/${id}.json`);
      fillSelect(kelurahan, "Pilih Kelurahan/Desa", data);
    } catch (e) {
      console.error(e);
      resetSelect(kelurahan, "Gagal memuat");
    }
  });

  // 5. Kelurahan -> Kode Pos
  kelurahan.addEventListener("change", () => {
    const opt = kelurahan.options[kelurahan.selectedIndex];
    kodePos.value = opt?.dataset.postal || "";
  });

  // Mulai: dropdown turunan nonaktif dulu, lalu load provinsi
  resetSelect(kabupaten, "Pilih Kabupaten/Kota");
  resetSelect(kecamatan, "Pilih Kecamatan");
  resetSelect(kelurahan, "Pilih Kelurahan/Desa");
  loadProvinsi();
})();