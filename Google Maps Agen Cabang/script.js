
/* =========================================
   KONFIGURASI CLOUDFLARE WORKER
   Ganti URL di bawah dengan URL Worker aktif.
========================================= */

const WORKER_URL = "https://digitalmarketing.iamhere-devone.workers.dev/";


/* =========================================
   UI LOGIC: SHOW/HIDE SECTIONS
========================================= */

function toggleSections() {
  const jenis = document.getElementById("jenisPermintaan").value;
  const secAlamatBaru = document.getElementById("sectionAlamatBaru");
  const secAlamatLama = document.getElementById("sectionAlamatLama");
  const secUpdateInfo = document.getElementById("sectionUpdateInfo");
  const titleBaru = document.getElementById("titleAlamatBaru");

  document.getElementById("reqMapsBaru").required = false;
  document.getElementById("reqJalan").required = false;
  document.getElementById("reqMapsSaatIni").required = false;

  secAlamatBaru.style.display = "none";
  secAlamatLama.style.display = "none";
  secUpdateInfo.style.display = "none";

  if (jenis === "Buat Maps Baru") {
    secAlamatBaru.style.display = "block";
    titleBaru.innerText = "Alamat Lengkap & Titik Maps Baru";
    document.getElementById("reqMapsBaru").required = true;
    document.getElementById("reqJalan").required = true;
  } else if (jenis === "Pindah Alamat") {
    secAlamatBaru.style.display = "block";
    secAlamatLama.style.display = "block";
    titleBaru.innerText = "Alamat & Titik Maps Tujuan (Baru)";
    document.getElementById("reqMapsBaru").required = true;
  } else if (jenis === "Update Info") {
    secUpdateInfo.style.display = "block";
    document.getElementById("reqMapsSaatIni").required = true;
  }
}


/* =========================================
   REVIEW & SUBMIT LOGIC
========================================= */

function getSelectName(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

let finalPayload = {};

function showReview(e) {
  e.preventDefault();

  const form = document.getElementById("formGmaps");

  // Ambil semua data form
  const fd = new FormData(form);
  finalPayload = Object.fromEntries(fd.entries());

  // Penanda agar Worker mengenali form GMaps
  finalPayload.jenisForm = "gmaps";

  // Pastikan nama wilayah ikut terkirim
  finalPayload.provinsi = getSelectName("provinsi");
  finalPayload.kabupatenKota = getSelectName("kabupaten");
  finalPayload.kecamatan = getSelectName("kecamatan");
  finalPayload.kelurahan = getSelectName("kelurahan");

  let html =
    `<strong>Jenis Request:</strong> ${finalPayload.jenisPermintaan || "-"}`
    + '<br><hr style="border:0; border-top:1px dashed #ccc; margin:10px 0">';

  html += `<strong>Agen:</strong> ${finalPayload.jenisAgen || "-"} ${finalPayload.namaAgen || "-"}<br>`;
  html += `<strong>TOP:</strong> ${finalPayload.kodeTop || "-"} | <strong>Area:</strong> ${finalPayload.portArea || "-"}<br>`;

  if (finalPayload.noTelp) {
    html += `<strong>HP:</strong> ${finalPayload.noTelp}<br>`;
  }

  document.getElementById("reviewText").innerHTML = html;
  document.getElementById("modalReview").style.display = "block";
}


/* =========================================
   KIRIM DATA KE CLOUDFLARE WORKER
========================================= */

async function executeSubmit() {
  const btn = document.getElementById("btnConfirmSend");
  const originalText = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Memproses...';

  try {
    // Kirim JSON ke Cloudflare Worker
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(finalPayload)
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server tidak valid. Periksa konfigurasi Worker.");
    }

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || `Pengiriman gagal (HTTP ${response.status})`
      );
    }

    showToast("Laporan berhasil terkirim!");

    document.getElementById("modalReview").style.display = "none";
    document.getElementById("formGmaps").reset();

    toggleSections();

  } catch (err) {
    console.error("Gagal mengirim data GMaps:", err);
    showToast("Gagal mengirim: " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}


/* =========================================
   TOAST NOTIFICATION
========================================= */

function showToast(msg, isError = false) {
  const t = document.getElementById("toastMsg");

  t.innerText = msg;
  t.className = isError ? "toast error show" : "toast show";

  setTimeout(() => {
    t.className = "toast";
  }, 3500);
}
