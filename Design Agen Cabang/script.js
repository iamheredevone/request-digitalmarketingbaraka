// script.js
// Logika form "Permintaan Desain": checkbox tambahan, ukuran spanduk,
// modal konfirmasi, dan pengiriman data.
// Dropdown wilayah (provinsi sampai kode pos) ada di wilayah.js

// ===================== PENGATURAN =====================
// Isi dengan URL tujuan pengiriman data (mis. Web App Google Apps Script, berakhiran /exec)
const SCRIPT_URL = "GANTI_DENGAN_URL_WEB_APP";

// ===================== HELPER =====================
const $ = (id) => document.getElementById(id);
const form = () => $("formDesain");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openModal(id) {
  const m = $(id);
  if (!m) return;
  m.classList.add("show");
  m.style.display = "flex";
}

function closeModal(id) {
  const m = $(id);
  if (!m) return;
  m.classList.remove("show");
  m.style.display = "none";
}

function showMsg(text, isError) {
  const el = $("msg");
  if (!el) return alert(text);
  el.textContent = text;
  el.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
    "padding:12px 18px;border-radius:10px;color:#fff;z-index:9999;font-size:14px;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.2);background:" +
    (isError ? "#dc2626" : "#16a34a");
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => (el.style.display = "none"), 4000);
}

// ===================== MODAL CONTOH DESAIN =====================
function openDesignModal() {
  openModal("designModal");
}

// ===================== CHECKBOX TAMBAHAN =====================
function getTambahanBoxes() {
  return Array.from(document.querySelectorAll('input[name="tambahan"]'));
}

function checkTambahan() {
  const boxes = getTambahanBoxes();

  // Jika ada yang tidak dicentang, "Paket" ikut tidak dicentang
  const paket = document.querySelector('input[name="paketAll"]');
  if (paket) paket.checked = boxes.every((b) => b.checked);

  // Ukuran spanduk hanya muncul jika Spanduk Komersial dipilih
  const spanduk = boxes.find((b) => b.value === "Spanduk Komersial");
  const box = $("ukuranContainer");
  const select = $("ukuranSelect");
  const show = !!(spanduk && spanduk.checked);

  if (box) box.style.display = show ? "block" : "none";
  if (select) {
    select.required = show;
    if (!show) {
      select.value = "";
      checkCustomUkuran();
    }
  }
}

function togglePaketAll(cb) {
  getTambahanBoxes().forEach((b) => (b.checked = cb.checked));
  checkTambahan();
  // checkTambahan menyamakan status paket dengan kotak lain, pastikan tetap sesuai pilihan
  cb.checked = getTambahanBoxes().every((b) => b.checked) && cb.checked;
}

function checkCustomUkuran() {
  const select = $("ukuranSelect");
  const input = $("customUkuranInput");
  if (!select || !input) return;
  const custom = select.value === "custom";
  input.style.display = custom ? "block" : "none";
  input.required = custom;
  if (!custom) input.value = "";
}

// ===================== INPUT ANGKA SAJA =====================
document.addEventListener("input", (e) => {
  if (e.target.classList && e.target.classList.contains("only-number")) {
    e.target.value = e.target.value.replace(/\D/g, "");
  }
});

// ===================== KUMPULKAN DATA FORM =====================
function collectData() {
  const f = form();
  const fd = new FormData(f);
  const tambahan = fd.getAll("tambahan");
  const paketAll = !!f.querySelector('input[name="paketAll"]:checked');
  const ukuran =
    fd.get("ukuranBanner") === "custom"
      ? (fd.get("customUkuran") || "").trim()
      : fd.get("ukuranBanner") || "";

  return {
    jenisAgen: fd.get("jenisAgen") || "",
    namaAgen: (fd.get("namaAgen") || "").trim(),
    portArea: fd.get("portArea") || "",
    statusAgen: fd.get("statusAgen") || "",
    namaJalan: (fd.get("namaJalan") || "").trim(),
    noTelp: (fd.get("noTelp") || "").trim(),
    provinsi: fd.get("provinsi") || "",
    kabupatenKota: fd.get("kabupatenKota") || "",
    kecamatan: fd.get("kecamatan") || "",
    kelurahan: fd.get("kelurahan") || "",
    kodePos: fd.get("kodePos") || "",
    paketAll: paketAll,
    tambahan: tambahan.join(", "),
    ukuranBanner: ukuran,
    deskripsi: (fd.get("deskripsi") || "").trim(),
    waktuKirim: new Date().toISOString(),
  };
}

// ===================== MODAL KONFIRMASI =====================
function showConfirmModal(e) {
  if (e) e.preventDefault();

  const d = collectData();

  if (!d.kodePos) {
    showMsg("Kode pos belum terisi. Pilih Kelurahan/Desa terlebih dahulu.", true);
    return false;
  }

  // Nama permintaan diambil dari teks label di form agar sama dengan yang dilihat pengguna
  const pilihan = getTambahanBoxes()
    .filter((b) => b.checked)
    .map((b) => b.closest("label").textContent.replace(/\s+/g, " ").trim());

  const sections = [
    {
      title: "Data Agen / Cabang",
      rows: [
        ["Nama", `${d.jenisAgen} ${d.namaAgen}`],
        ["PORT Area", d.portArea],
        ["Kepemilikan", d.statusAgen],
        ["Nomor Telepon", d.noTelp],
      ],
    },
    {
      title: "Alamat",
      rows: [
        ["Jalan / Patokan", d.namaJalan],
        ["Provinsi", d.provinsi],
        ["Kabupaten / Kota", d.kabupatenKota],
        ["Kecamatan", d.kecamatan],
        ["Kelurahan / Desa", d.kelurahan],
        ["Kode Pos", d.kodePos],
      ],
    },
    {
      title: "Permintaan",
      rows: [
        [
          "Jenis",
          { chips: d.paketAll ? ["Paket Cabang / Agen Baru"] : pilihan },
        ],
        ...(d.paketAll
          ? [["Isi Paket", { chips: pilihan }]]
          : []),
        ...(d.ukuranBanner ? [["Ukuran Spanduk", d.ukuranBanner]] : []),
        ["Deskripsi", d.deskripsi || "-"],
      ],
    },
  ];

  const renderValue = (v) =>
    v && typeof v === "object"
      ? v.chips.length
        ? v.chips.map((c) => `<span class="rv-chip">${escapeHtml(c)}</span>`).join("")
        : "-"
      : escapeHtml(v || "-");

  $("reviewContent").innerHTML = sections
    .map(
      (s) =>
        `<div class="rv-section">
           <div class="rv-title">${escapeHtml(s.title)}</div>
           ${s.rows
             .map(
               ([k, v]) =>
                 `<div class="rv-row"><div class="rv-label">${escapeHtml(k)}</div><div class="rv-value">${renderValue(v)}</div></div>`
             )
             .join("")}
         </div>`
    )
    .join("");

  injectReviewStyles();
  openModal("reviewModal");
  return false;
}

// Gaya untuk isi modal konfirmasi (disisipkan sekali lewat JS, tidak perlu ubah style.css)
function injectReviewStyles() {
  if (document.getElementById("reviewStyles")) return;
  const css = document.createElement("style");
  css.id = "reviewStyles";
  css.textContent = `
    #reviewContent { max-height: 60vh; overflow-y: auto; padding-right: 4px; }
    .rv-section { margin-bottom: 16px; }
    .rv-title {
      font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      color: #64748b; padding-bottom: 6px; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0;
    }
    .rv-row {
      display: grid; grid-template-columns: 140px 1fr; gap: 12px;
      padding: 7px 0; border-bottom: 1px dashed #eef2f7; align-items: start;
    }
    .rv-row:last-child { border-bottom: none; }
    .rv-label { font-size: 13px; color: #64748b; }
    .rv-value { font-size: 14px; font-weight: 600; color: #0f172a; word-break: break-word; }
    .rv-chip {
      display: inline-block; margin: 0 6px 6px 0; padding: 3px 10px; border-radius: 999px;
      background: #e8f0fb; color: #0b3b6f; font-size: 12.5px; font-weight: 600;
    }
    @media (max-width: 480px) {
      .rv-row { grid-template-columns: 1fr; gap: 2px; }
    }
  `;
  document.head.appendChild(css);
}

function closeReviewModal() {
  closeModal("reviewModal");
}

// ===================== KIRIM DATA =====================
async function submitFormNow() {
  const btn = $("btnKirim");

  if (!SCRIPT_URL || SCRIPT_URL.startsWith("GANTI")) {
    showMsg("URL tujuan pengiriman belum diisi di script.js (SCRIPT_URL).", true);
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Mengirim...";

  try {
    // no-cors: respons tidak bisa dibaca, tapi data tetap terkirim ke Apps Script
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(collectData()),
    });

    closeReviewModal();
    resetForm();
    showMsg("Permintaan berhasil dikirim.", false);
  } catch (err) {
    console.error(err);
    showMsg("Gagal mengirim. Periksa koneksi lalu coba lagi.", true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

function resetForm() {
  form().reset();
  // Kosongkan dropdown turunan wilayah (diatur wilayah.js lewat event change)
  const prov = $("provinsi");
  if (prov) prov.dispatchEvent(new Event("change"));
  checkTambahan();
  checkCustomUkuran();
}

// ===================== AWAL =====================
// Tutup modal saat klik area gelap di luar kotak
window.addEventListener("click", (e) => {
  if (e.target.classList && e.target.classList.contains("modal")) {
    closeModal(e.target.id);
  }
});

checkTambahan();
checkCustomUkuran();