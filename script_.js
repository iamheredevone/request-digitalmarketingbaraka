// Mobile navigation
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");

navToggle?.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.innerHTML = isOpen
    ? '<i class="fa-solid fa-xmark"></i>'
    : '<i class="fa-solid fa-bars"></i>';
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
    if (navToggle) navToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
  });
});

// Gallery carousel: auto-slide every 4.5 seconds, manual arrows, dots, swipe, pause on hover.
(() => {
  const gallery = document.getElementById("gallery");
  const track = document.getElementById("galleryTrack");
  const dotsWrap = document.getElementById("galleryDots");
  if (!gallery || !track || !dotsWrap) return;

  const slides = [...track.querySelectorAll(".gallery-slide")];
  const prev = document.getElementById("galleryPrev");
  const next = document.getElementById("galleryNext");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let timer = null;
  let touchStartX = 0;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "gallery-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Tampilkan gambar ${i + 1}`);
    dot.addEventListener("click", () => { goTo(i); restart(); });
    dotsWrap.appendChild(dot);
  });
  const dots = [...dotsWrap.querySelectorAll(".gallery-dot")];

  function goTo(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
      dot.setAttribute("aria-current", i === index ? "true" : "false");
    });
  }
  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }
  function start() {
    stop();
    if (!reduceMotion && slides.length > 1) {
      timer = window.setInterval(() => goTo(index + 1), 4500);
    }
  }
  function restart() { start(); }

  prev?.addEventListener("click", () => { goTo(index - 1); restart(); });
  next?.addEventListener("click", () => { goTo(index + 1); restart(); });
  gallery.addEventListener("mouseenter", stop);
  gallery.addEventListener("mouseleave", start);
  gallery.addEventListener("focusin", stop);
  gallery.addEventListener("focusout", start);
  gallery.addEventListener("touchstart", e => { touchStartX = e.changedTouches[0].clientX; stop(); }, { passive: true });
  gallery.addEventListener("touchend", e => {
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 45) goTo(index + (delta < 0 ? 1 : -1));
    start();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  goTo(0);
  start();
})();

// Configuration: replace these example values with official contact details and asset links.
const BARAKA_CONFIG = {
  whatsapp: "", // Example: "6281234567890" (country code, no + or spaces)
  email: "",    // Example: "marketing@company.co.id"
  address: "",  // Full office address
  mapsUrl: "",  // Google Maps share link
  digitalLinks: {
    flyer: "",
    mascot: "",
    profilePicture: "",
    socialContent: "",
    whatsappStickers: ""
  }
};

const contactLinks = {
  whatsapp: BARAKA_CONFIG.whatsapp ? `https://wa.me/${BARAKA_CONFIG.whatsapp}` : "",
  email: BARAKA_CONFIG.email ? `mailto:${BARAKA_CONFIG.email}` : "",
  maps: BARAKA_CONFIG.mapsUrl || (BARAKA_CONFIG.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BARAKA_CONFIG.address)}`
    : "")
};

document.querySelectorAll("[data-contact-link]").forEach(link => {
  const key = link.dataset.contactLink;
  if (contactLinks[key]) {
    link.href = contactLinks[key];
    if (key !== "email") link.target = "_blank";
    link.rel = "noopener noreferrer";
  } else {
    link.addEventListener("click", event => {
      event.preventDefault();
      alert("Silakan isi informasi kontak resmi pada konfigurasi di file script.js.");
    });
  }
});

const digitalKeys = ["flyer", "mascot", "profilePicture", "socialContent", "whatsappStickers"];
document.querySelectorAll("[data-placeholder-link]").forEach((link, i) => {
  const target = BARAKA_CONFIG.digitalLinks[digitalKeys[i]];
  if (target) {
    link.href = target;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.removeAttribute("data-placeholder-link");
  } else {
    link.addEventListener("click", event => {
      event.preventDefault();
      alert("Tambahkan tautan materi digital pada konfigurasi di file script.js.");
    });
  }
});
