// ====== Konfigurasi kontak (ganti sesuai data asli) ======
const CONFIG = {
  whatsapp: "6282211958695", // format internasional tanpa +
  waText: "Halo Baraka Express, saya ingin bertanya tentang layanan.",
  email: "barakaexpress_id@gmail.com",
  mapsUrl: "https://share.google/Z3KPMU4mmRjNcqhy6",
  galleryInterval: 4000, // jeda slide otomatis (ms)
  galleryJsonUrl: "https://digitalmarketing.iamhere-devone.workers.dev/?resource=gallery"
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

  // ---------- Galeri slider dari file JSON lokal ----------
  const track = document.getElementById("galleryTrack");
  const gallery = document.getElementById("gallery");
  const dotsWrap = document.getElementById("galleryDots");

  if (track && gallery && dotsWrap) {
    const fallbackSlides = [
      { path: "assets/Cabang Pekanbaru Utara WEB.png", alt: "Cabang Pekanbaru Utara" },
      { path: "assets/Cabang Bekasi Utara WEB.jpg", alt: "Cabang Bekasi Utara" },
      { path: "assets/Agen Surabaya Manukan WEB.png", alt: "Agen Surabaya Manukan" },
      { path: "assets/Cabang Curup WEB.jpg", alt: "Cabang Curup" },
      { path: "assets/Cabang Mojokerto Timur WEB.png", alt: "Cabang Mojokerto Timur" }
    ];

    function renderSlides(items) {
      track.replaceChildren();
      dotsWrap.replaceChildren();
      items.forEach((item, i) => {
        const slide = document.createElement("div");
        slide.className = "gallery-slide";
        const img = document.createElement("img");
        img.src = item.path;
        img.alt = item.alt || `Galeri Baraka Express ${i + 1}`;
        if (i > 0) img.loading = "lazy";
        img.addEventListener("error", () => console.warn("Gambar galeri gagal dimuat:", item.path));
        slide.appendChild(img);
        track.appendChild(slide);
      });

      const slides = track.children;
      if (!slides.length) return;
      let index = 0;
      let timer = null;

      for (let i = 0; i < slides.length; i++) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Gambar ${i + 1}`);
        button.addEventListener("click", () => { go(i); start(); });
        dotsWrap.appendChild(button);
      }
      const dots = dotsWrap.children;
      const prev = document.getElementById("galleryPrev");
      const next = document.getElementById("galleryNext");
      if (prev) prev.hidden = slides.length < 2;
      if (next) next.hidden = slides.length < 2;
      dotsWrap.hidden = slides.length < 2;

      function go(i) {
        index = (i + slides.length) % slides.length;
        track.style.transform = `translateX(-${index * 100}%)`;
        [...dots].forEach((d, n) => d.classList.toggle("active", n === index));
      }
      function stop() { clearInterval(timer); timer = null; }
      function start() {
        stop();
        if (slides.length > 1) timer = setInterval(() => go(index + 1), CONFIG.galleryInterval);
      }

      if (prev) prev.addEventListener("click", () => { go(index - 1); start(); });
      if (next) next.addEventListener("click", () => { go(index + 1); start(); });
      if (window.matchMedia("(hover: hover)").matches) {
        gallery.addEventListener("mouseenter", stop);
        gallery.addEventListener("mouseleave", start);
      }
      document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
      let startX = null;
      gallery.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
      gallery.addEventListener("touchend", (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); start(); }
        startX = null;
      });
      go(0);
      start();
    }

    async function loadGallery() {
      const response = await fetch(CONFIG.galleryJsonUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`JSON gallery gagal dimuat (${response.status})`);
      const data = await response.json();
      const slides = Array.isArray(data) ? data : data.slides;
      if (!Array.isArray(slides) || !slides.length) throw new Error("JSON gallery tidak berisi gambar");
      return slides.filter((item) => item && typeof item.path === "string" && item.path.trim());
    }

    loadGallery()
      .catch((error) => {
        console.warn("Menggunakan gambar default karena data spreadsheet gagal dimuat:", error);
        return fallbackSlides;
      })
      .then(renderSlides);
  }
});