// ===================== PENGATURAN =====================
// URL Worker Cloudflare tujuan pengiriman data (boleh berakhiran /).
// Nama sengaja dibuat berbeda dari WORKER_URL agar tidak bentrok dengan wilayah.js.
const WORKER_ENDPOINT = "https://digitalmarketing.iamhere-devone.workers.dev/";

// ===================== ELEMEN =====================
const selProvinsi = document.getElementById("provinsi");
const selKabupaten = document.getElementById("kabupaten");
const selKecamatan = document.getElementById("kecamatan");
const selKelurahan = document.getElementById("kelurahan");
const inpKodePos = document.getElementById("kodePos");

const form = document.getElementById("formPendaftaran");
const btnSubmit = document.getElementById("btnSubmit");
const msg = document.getElementById("msg");

function resetSelect(select, placeholder) {
  select.innerHTML = "";
  select.add(new Option(placeholder, ""));
  select.disabled = true;
}


// ===================== JAM OPERASIONAL =====================
  function getJamOperasional(tipeTop) {
    if (tipeTop === "Cabang") {
      return "08.00 WIB - 17.00 WIB";
    }

    if (tipeTop === "Agen") {
      return "09.00 WIB - 17.00 WIB";
    }

    return "";
  }

// ===================== KIRIM DATA =====================
form.addEventListener("submit", async function (e) {
  e.preventDefault();

  msg.className = "msg";
  msg.textContent = "";

  if (!WORKER_ENDPOINT || WORKER_ENDPOINT.startsWith("GANTI")) {
    msg.className = "msg err";
    msg.textContent =
      "URL Worker belum diisi di script (WORKER_ENDPOINT).";
    console.error("WORKER_ENDPOINT belum diisi.");
    return;
  }

  const kepemilikanEl = form.querySelector(
    'input[name="kepemilikan"]:checked'
  );

  const data = {
    jenisForm: "cabang",


    tipe: document.getElementById("tipe").value,
    tipeTop: document.getElementById("tipeTop").value,
    jamOperasional: getJamOperasional(
      document.getElementById("tipeTop").value
    ),
    namaAgen: document.getElementById("namaAgen").value.trim(),
    kepemilikan: kepemilikanEl ? kepemilikanEl.value : "",
    tanggalPembukaan:
      document.getElementById("tanggalPembukaan").value,
    alamat: document.getElementById("alamat").value.trim(),
    telepon: document.getElementById("telepon").value.trim(),

    provinsiKode: selProvinsi.value,
    provinsiNama:
      selProvinsi.selectedOptions[0]?.text || "",

    kabupatenKode: selKabupaten.value,
    kabupatenNama:
      selKabupaten.selectedOptions[0]?.text || "",

    kecamatanKode: selKecamatan.value,
    kecamatanNama:
      selKecamatan.selectedOptions[0]?.text || "",

    kelurahanKode: selKelurahan.value,
    kelurahanNama:
      selKelurahan.selectedOptions[0]?.text || "",

    kodePos: inpKodePos.value.trim(),
    gmaps: document.getElementById("gmaps").value.trim()
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Mengirim...";

  try {
    const response = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    // Jika balasan bukan JSON, jangan sampai error parsing menutupi penyebab aslinya
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || result.message || "Gagal mengirim data."
      );
    }

    msg.className = "msg ok";
    msg.textContent = "Permintaan berhasil dikirim.";

    form.reset();

    resetSelect(selKabupaten, "Pilih provinsi dahulu");
    resetSelect(selKecamatan, "Pilih kabupaten/kota dahulu");
    resetSelect(selKelurahan, "Pilih kecamatan dahulu");

    inpKodePos.value = "";

  } catch (err) {
    console.error("Pengiriman form Banner gagal:", err);
    msg.className = "msg err";
    msg.textContent = "Terjadi kesalahan: " + err.message;

  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Kirim Permintaan";
  }
});