(() => {
  const header = document.querySelector(".portal-header");
  const toggle = document.querySelector(".portal-menu-toggle");
  const nav = document.querySelector(".portal-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Tutup navigasi" : "Buka navigasi");
      toggle.innerHTML = `<i class="fa-solid ${open ? "fa-xmark" : "fa-bars"}" aria-hidden="true"></i>`;
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Buka navigasi");
      toggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    }));
  }
  if (header) {
    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }
})();
