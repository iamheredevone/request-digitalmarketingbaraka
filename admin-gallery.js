const API_URL = "https://digitalmarketing.iamhere-devone.workers.dev/?resource=gallery";
const MAX_IMAGE_SIZE = 500 * 1024 * 1024;
const rows = document.getElementById("rows");
const status = document.getElementById("status");
const panel = document.getElementById("panel");
const loginButton = document.getElementById("loginButton");
const idInput = document.getElementById("adminId");
const passwordInput = document.getElementById("adminPassword");

let slides = [];
let session = "";

function setStatus(message) {
  status.textContent = message;
  status.className = "status";

  if (/berhasil|tersimpan|keluar/i.test(message)) {
    status.classList.add("ok");
  } else if (/gagal|harus|maksimal|pilih|http|error|salah|tidak/i.test(message)) {
    status.classList.add("err");
  }
}

function createInput(placeholder, value, label, onInput) {
  const input = document.createElement("input");
  input.placeholder = placeholder;
  input.value = value || "";
  input.setAttribute("aria-label", label);
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function drawSlides() {
  rows.replaceChildren();

  slides.forEach((slide, index) => {
    const row = document.createElement("div");
    row.className = "row";

    const pathInput = createInput(
      "Path gambar atau URL hasil upload",
      slide.path,
      `Path gambar ${index + 1}`,
      (value) => { slide.path = value; }
    );
    const altInput = createInput(
      "Teks alt",
      slide.alt,
      `Teks alt ${index + 1}`,
      (value) => { slide.alt = value; }
    );
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp";
    fileInput.setAttribute("aria-label", `Pilih file gambar ${index + 1}`);

    const uploadButton = document.createElement("button");
    uploadButton.className = "upload";
    uploadButton.type = "button";
    uploadButton.textContent = "Upload";
    uploadButton.addEventListener("click", () => {
      uploadImage(fileInput.files[0], slide, uploadButton);
    });

    const removeButton = document.createElement("button");
    removeButton.className = "remove";
    removeButton.type = "button";
    removeButton.textContent = "Hapus";
    removeButton.addEventListener("click", () => {
      slides.splice(index, 1);
      drawSlides();
    });

    const fileGroup = document.createElement("div");
    fileGroup.append(fileInput, uploadButton);
    row.append(pathInput, altInput, fileGroup, removeButton);
    rows.append(row);
  });
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function sessionHeaders() {
  return { "Content-Type": "application/json", "X-Admin-Session": session };
}

async function uploadImage(file, slide, button) {
  if (!file) {
    setStatus("Pilih file gambar terlebih dahulu.");
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    setStatus("Ukuran maksimal 500 MB.");
    return;
  }

  button.disabled = true;
  setStatus("Memulai upload...");

  try {
    const init = await requestJson(`${API_URL}&action=upload-init`, {
      method: "POST",
      headers: sessionHeaders(),
      body: JSON.stringify({ type: file.type, size: file.size })
    });
    const chunkSize = init.chunkSize;
    let partNumber = 1;

    for (let start = 0; start < file.size; start += chunkSize, partNumber += 1) {
      const end = Math.min(start + chunkSize, file.size);
      const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
      let binary = "";

      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }

      await requestJson(`${API_URL}&action=upload-part`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({
          uploadId: init.uploadId,
          partNumber,
          data: btoa(binary)
        })
      });

      const progress = Math.min(100, Math.round((start + bytes.length) / file.size * 100));
      setStatus(`Upload ${progress}%`);
    }

    const complete = await requestJson(`${API_URL}&action=upload-complete`, {
      method: "POST",
      headers: sessionHeaders(),
      body: JSON.stringify({ uploadId: init.uploadId })
    });

    slide.path = complete.path;
    drawSlides();
    setStatus("Upload berhasil. Klik Simpan perubahan untuk menambahkannya ke carousel.");
  } catch (error) {
    setStatus(`Upload gagal: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function loadSlides() {
  const data = await requestJson(API_URL);
  slides = Array.isArray(data.slides) ? data.slides : [];
  drawSlides();
}

function setEditorView(isEditing) {
  document.getElementById("login").hidden = isEditing;
  document.getElementById("editor").hidden = !isEditing;
  panel.classList.toggle("wide", isEditing);
  document.getElementById("title").textContent = "Kelola Gallery";
  document.getElementById("sub").textContent = isEditing
    ? "Atur urutan slide, teks alt, dan unggah gambar baru."
    : "Login untuk mengatur slide dan mengunggah gambar langsung dari komputer.";
}

function shakePanel() {
  panel.classList.remove("shake");
  void panel.offsetWidth;
  panel.classList.add("shake");
}

async function login() {
  if (loginButton.disabled) return;

  loginButton.disabled = true;
  loginButton.classList.add("loading");
  setStatus("Memeriksa login...");

  try {
    const data = await requestJson(`${API_URL}&action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idInput.value, password: passwordInput.value })
    });

    session = data.session;
    await loadSlides();
    passwordInput.value = "";
    setEditorView(true);
    setStatus("Login berhasil.");
  } catch (error) {
    setStatus(error.message);
    shakePanel();
  } finally {
    loginButton.disabled = false;
    loginButton.classList.remove("loading");
  }
}

async function saveSlides() {
  if (slides.some((slide) => !slide.path.trim())) {
    setStatus("Semua path harus diisi.");
    return;
  }

  setStatus("Menyimpan daftar gallery...");
  try {
    const data = await requestJson(API_URL, {
      method: "PUT",
      headers: sessionHeaders(),
      body: JSON.stringify({ slides })
    });
    setStatus(`Tersimpan: ${data.slides} gambar.`);
  } catch (error) {
    session = "";
    setEditorView(false);
    setStatus(error.message);
    shakePanel();
  }
}

function logout() {
  session = "";
  slides = [];
  setEditorView(false);
  setStatus("Anda sudah keluar.");
}

document.getElementById("togglePw").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const showPassword = passwordInput.type === "password";
  passwordInput.type = showPassword ? "text" : "password";
  button.classList.toggle("show", showPassword);
  button.setAttribute("aria-label", showPassword ? "Sembunyikan password" : "Tampilkan password");
});

[idInput, passwordInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginButton.click();
  });
});

document.getElementById("loginButton").addEventListener("click", login);
document.getElementById("add").addEventListener("click", () => {
  slides.push({ path: "", alt: "" });
  drawSlides();
});
document.getElementById("save").addEventListener("click", saveSlides);
document.getElementById("logout").addEventListener("click", logout);