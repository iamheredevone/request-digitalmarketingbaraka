// script.js
// Logika form "Permintaan Desain": checkbox tambahan, ukuran spanduk,
// modal konfirmasi, dan pengiriman data.
// Dropdown wilayah (provinsi sampai kode pos) ada di wilayah.js

// ===================== PENGATURAN =====================
// Isi dengan URL tujuan pengiriman data (mis. Web App Google Apps Script, berakhiran /exec)
const SCRIPT_URL = "https://digitalmarketing.iamhere-devone.workers.dev/";
const AGENT_DIRECTORY_URL = `${SCRIPT_URL}?resource=agent-directory`;

// ===================== HELPER =====================
const $ = (id) => document.getElementById(id);
const form = () => $("formDesain");
let agentDirectory = [];
let autoFilledAgent = "";
let activeSuggestion = -1;

function normalizeAgentName(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function setSelectValue(select, value) {
  if (!select || !value) return;
  let option = Array.from(select.options).find((item) => normalizeAgentName(item.value) === normalizeAgentName(value));
  if (!option) {
    option = new Option(value, value, true, true);
    select.add(option);
  }
  select.value = option.value;
}

function setOwnership(value) {
  const normalized = normalizeAgentName(value);
  const choice = normalized.includes("independent") || normalized.includes("independen")
    ? "Independent"
    : normalized.includes("pusat") || normalized.includes("perusahaan") ? "Pusat" : "";
  if (!choice) return;
  const radio = document.querySelector(`input[name="statusAgen"][value="${choice}"]`);
  if (radio) radio.checked = true;
}

function closeAgentSuggestions() {
  const suggestions = $("agentSuggestions");
  if (!suggestions) return;
  suggestions.hidden = true;
  suggestions.replaceChildren();
  $("namaAgen").setAttribute("aria-expanded", "false");
  activeSuggestion = -1;
}

function chooseAgent(item) {
  $("namaAgen").value = item.name;
  closeAgentSuggestions();
  applyAgentDirectoryMatch();
}

function setActiveSuggestion(index) {
  const suggestions = $("agentSuggestions");
  if (!suggestions) return;
  const options = Array.from(suggestions.querySelectorAll(".agent-suggestion"));
  if (!options.length) return;
  activeSuggestion = Math.max(0, Math.min(index, options.length - 1));
  options.forEach((option, optionIndex) => {
    const active = optionIndex === activeSuggestion;
    option.classList.toggle("active", active);
    option.setAttribute("aria-selected", String(active));
  });
  options[activeSuggestion].scrollIntoView({ block: "nearest" });
}

function renderAgentSuggestions() {
  const input = $("namaAgen");
  const suggestions = $("agentSuggestions");
  const query = normalizeAgentName(input && input.value);
  if (!suggestions || !query || !agentDirectory.length) {
    closeAgentSuggestions();
    return;
  }

  const exactMatch = agentDirectory.find((item) => normalizeAgentName(item.name) === query);
  if (exactMatch) {
    closeAgentSuggestions();
    applyAgentDirectoryMatch();
    return;
  }

  const matches = agentDirectory
    .filter((item) => normalizeAgentName(item.name).includes(query))
    .slice(0, 12);
  if (!matches.length) {
    closeAgentSuggestions();
    return;
  }

  suggestions.replaceChildren(...matches.map((item, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "agent-suggestion";
    option.dataset.name = item.name;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    const name = document.createElement("span");
    name.className = "agent-suggestion-name";
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "agent-suggestion-meta";
    meta.textContent = [item.jenisTop, item.kepemilikan, item.kodeTop, item.portArea].filter(Boolean).join(" · ");
    option.append(name, meta);
    option.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      chooseAgent(item);
    });
    option.addEventListener("mouseenter", () => setActiveSuggestion(index));
    suggestions.append(option);
    return option;
  }));
  suggestions.hidden = false;
  $("namaAgen").setAttribute("aria-expanded", "true");
  activeSuggestion = -1;
}

function applyAgentDirectoryMatch() {
  const nameInput = $("namaAgen");
  const name = normalizeAgentName(nameInput && nameInput.value);
  const match = name && agentDirectory.find((item) => normalizeAgentName(item.name) === name);
  const status = $("agentDirectoryStatus");

  if (match) {
    setSelectValue($("jenisAgen"), match.jenisTop);
    setSelectValue($("portArea"), match.portArea);
    setOwnership(match.kepemilikan);
    $("kodeTop").value = match.kodeTop || "";
    autoFilledAgent = name;
    if (status) status.textContent = `Jenis TOP, kepemilikan, kode, dan PORT terisi otomatis untuk ${match.name}.`;
    return;
  }

  if (autoFilledAgent) {
    $("jenisAgen").value = "";
    $("portArea").value = "";
    document.querySelectorAll('input[name="statusAgen"]').forEach((radio) => { radio.checked = false; });
    $("kodeTop").value = "";
    autoFilledAgent = "";
  }
}

async function loadAgentDirectory() {
  const status = $("agentDirectoryStatus");
  try {
    const response = await fetch(AGENT_DIRECTORY_URL, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Daftar nama tidak tersedia.");
    agentDirectory = Array.isArray(payload.agents) ? payload.agents : [];

    if (status) status.textContent = agentDirectory.length
      ? `${agentDirectory.length} nama tersedia. Pilih saran atau ketik nama yang sesuai.`
      : "Belum ada data nama di spreadsheet.";
    applyAgentDirectoryMatch();
    renderAgentSuggestions();
  } catch (error) {
    console.warn("Daftar agen/cabang gagal dimuat.", error);
    if (status) status.textContent = "Daftar nama belum termuat. Field tetap bisa diisi manual.";
  }
}

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

$("namaAgen").addEventListener("input", () => {
  applyAgentDirectoryMatch();
  renderAgentSuggestions();
});
$("namaAgen").addEventListener("focus", renderAgentSuggestions);
$("namaAgen").addEventListener("blur", () => setTimeout(closeAgentSuggestions, 120));
$("namaAgen").addEventListener("keydown", (event) => {
  const suggestions = $("agentSuggestions");
  const options = suggestions ? Array.from(suggestions.querySelectorAll(".agent-suggestion")) : [];
  if (!options.length || suggestions.hidden) {
    if (event.key === "Escape") closeAgentSuggestions();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveSuggestion(activeSuggestion + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveSuggestion(activeSuggestion < 0 ? options.length - 1 : activeSuggestion - 1);
  } else if (event.key === "Enter" && activeSuggestion >= 0) {
    event.preventDefault();
    const selectedName = options[activeSuggestion].dataset.name;
    const selected = agentDirectory.find((item) => item.name === selectedName);
    if (selected) chooseAgent(selected);
  } else if (event.key === "Escape") {
    closeAgentSuggestions();
  }
});
["jenisAgen", "portArea"].forEach((id) => {
  $(id).addEventListener("change", () => { autoFilledAgent = ""; });
});
document.querySelectorAll('input[name="statusAgen"]').forEach((radio) => {
  radio.addEventListener("change", () => { autoFilledAgent = ""; });
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
    jenisForm: "banner",
    jenisAgen: fd.get("jenisAgen") || "",
    namaAgen: (fd.get("namaAgen") || "").trim(),
    kodeTop: (fd.get("kodeTop") || "").trim(),
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
      title: "Data TOP",
      rows: [
        ["Nama TOP", d.namaAgen],
        ["Jenis TOP", d.jenisAgen],
        ["Kode TOP", d.kodeTop],
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
loadAgentDirectory();
