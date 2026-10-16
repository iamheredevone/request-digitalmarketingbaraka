// ====== Konfigurasi kontak (ganti sesuai data asli) ======
const CONFIG = {
  whatsapp: "6282211958695", // format internasional tanpa +
  waText: "Halo Baraka Express, saya ingin bertanya tentang layanan.",
  email: "barakaexpress_id@gmail.com",
  mapsUrl: "https://share.google/Z3KPMU4mmRjNcqhy6",
  galleryInterval: 4000 // jeda slide otomatis (ms)
};

document.addEventListener("DOMContentLoaded", () => {

  // ---------- Header berubah saat scroll ----------
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------- Link kontak ----------
  document.querySelectorAll("[data-contact-link]").forEach((el) => {
    const type = el.dataset.contactLink;
    if (type === "whatsapp") {
      el.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.waText)}`;
      el.target = "_blank"; el.rel = "noopener";
    } else if (type === "email") {
      el.href = `mailto:${CONFIG.email}`;
    } else if (type === "maps") {
      el.href = CONFIG.mapsUrl;
      el.target = "_blank"; el.rel = "noopener";
    }
  });

  // ---------- Link materi digital yang belum diisi ----------
  document.querySelectorAll("[data-placeholder-link]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (el.getAttribute("href") === "#") {
        e.preventDefault();
        alert("Tautan materi ini belum diatur. Ganti href pada index.html.");
      }
    });
  });

  // ---------- Navigasi mobile ----------
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  // ---------- Galeri slider ----------
  const track = document.getElementById("galleryTrack");
  const gallery = document.getElementById("gallery");
  const dotsWrap = document.getElementById("galleryDots");

  if (track && gallery && dotsWrap) {
    const slides = track.children;
    let index = 0;
    let timer = null;

    // Titik navigasi
    for (let i = 0; i < slides.length; i++) {
      const b = document.createElement("button");
      b.setAttribute("aria-label", `Gambar ${i + 1}`);
      b.addEventListener("click", () => { go(i); start(); });
      dotsWrap.appendChild(b);
    }
    const dots = dotsWrap.children;

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      [...dots].forEach((d, n) => d.classList.toggle("active", n === index));
    }
    function stop() {
      clearInterval(timer);
      timer = null;
    }
    function start() {
      stop();
      if (slides.length > 1) {
        timer = setInterval(() => go(index + 1), CONFIG.galleryInterval);
      }
    }

    const prev = document.getElementById("galleryPrev");
    const next = document.getElementById("galleryNext");
    if (prev) prev.addEventListener("click", () => { go(index - 1); start(); });
    if (next) next.addEventListener("click", () => { go(index + 1); start(); });

    // Jeda saat kursor di atas galeri (hanya perangkat dengan mouse)
    if (window.matchMedia("(hover: hover)").matches) {
      gallery.addEventListener("mouseenter", stop);
      gallery.addEventListener("mouseleave", start);
    }

    // Jeda saat tab tidak aktif, lanjut saat kembali
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(); else start();
    });

    // Swipe di HP
    let startX = null;
    gallery.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    gallery.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); start(); }
      startX = null;
    });

    // Info di Console jika ada gambar yang gagal dimuat
    gallery.querySelectorAll("img").forEach((img) =>
      img.addEventListener("error", () => console.warn("Gambar gagal dimuat:", img.getAttribute("src")))
    );

    go(0);
    start();
  }
});