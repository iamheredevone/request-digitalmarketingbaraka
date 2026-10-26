(() => {
  const API_URL = "https://digitalmarketing.iamhere-devone.workers.dev/?resource=site-editor";
  const DEFAULT_URL = "site-content-defaults.json?v=visual-1";
  const editorPreview = new URLSearchParams(location.search).has("editorPreview");
  const SERVICE_TEMPLATE = document.querySelector('[data-editor-section="services"] > .service-card')?.cloneNode(true);
  const DIGITAL_TEMPLATE = document.querySelector('[data-editor-section="digital"] .digital-grid > .digital-card')?.cloneNode(true);
  const ICONS = {
    file: "fa-regular fa-file-lines", palette: "fa-solid fa-palette", location: "fa-solid fa-location-dot", clipboard: "fa-regular fa-clipboard",
    truck: "fa-solid fa-truck", box: "fa-solid fa-box", "boxes-stacked": "fa-solid fa-boxes-stacked", warehouse: "fa-solid fa-warehouse",
    store: "fa-solid fa-store", building: "fa-solid fa-building", map: "fa-solid fa-map", phone: "fa-solid fa-phone",
    envelope: "fa-solid fa-envelope", comments: "fa-solid fa-comments", bullhorn: "fa-solid fa-bullhorn", image: "fa-solid fa-image",
    camera: "fa-solid fa-camera", video: "fa-solid fa-video", "bag-shopping": "fa-solid fa-bag-shopping", "cart-shopping": "fa-solid fa-cart-shopping",
    tag: "fa-solid fa-tag", gift: "fa-solid fa-gift", star: "fa-solid fa-star", heart: "fa-solid fa-heart",
    "calendar-days": "fa-solid fa-calendar-days", clock: "fa-solid fa-clock", users: "fa-solid fa-users", "user-tie": "fa-solid fa-user-tie",
    handshake: "fa-solid fa-handshake", "chart-line": "fa-solid fa-chart-line", "money-bill": "fa-solid fa-money-bill", "credit-card": "fa-solid fa-credit-card",
    gear: "fa-solid fa-gear", "shield-halved": "fa-solid fa-shield-halved", "circle-check": "fa-solid fa-circle-check", "circle-info": "fa-solid fa-circle-info",
    lightbulb: "fa-solid fa-lightbulb", rocket: "fa-solid fa-rocket", globe: "fa-solid fa-globe", link: "fa-solid fa-link",
    download: "fa-solid fa-download", print: "fa-solid fa-print", pen: "fa-solid fa-pen", book: "fa-solid fa-book"
  };
  const HEX = /^#[0-9a-f]{6}$/i;
  const ORIGINAL_ADDRESS = (document.querySelector('[data-editor-contact="address"]') || {}).textContent;

  function validImage(value) {
    return typeof value === "string" && (/^https:\/\//i.test(value) || (/^assets\/[a-zA-Z0-9_./ -]+$/.test(value) && !value.split("/").includes("..")));
  }

  function validHref(value) {
    if (typeof value !== "string") return false;
    const lower = value.toLowerCase();
    return !lower.startsWith("javascript:") && (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("mailto:") || lower.startsWith("tel:") || (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("./") || value.startsWith("#"));
  }
  function rgba(hex, alpha) {
    if (!HEX.test(hex || "")) return "transparent";
    const value = hex.slice(1);
    const opacity = Math.max(0, Math.min(Number(alpha) || 0, 100)) / 100;
    return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${opacity})`;
  }


  /* ===== Responsif otomatis: jumlah kolom menyesuaikan lebar wadah ===== */
  const MIN_CARD = { services: 260, digital: 170, custom: 240 };
  (function injectResponsiveCss() {
    if (document.getElementById("site-content-responsive")) return;
    const st = document.createElement("style");
    st.id = "site-content-responsive";
    st.textContent = ".service-card,.digital-card,.custom-block{min-width:0;max-width:100%;overflow-wrap:anywhere;box-sizing:border-box}" +
      ".custom-block img,.custom-block-image,.digital-thumb{max-width:100%;height:auto}";
    document.head.append(st);
  })();
  (function injectCompactCss() {
    if (document.getElementById("site-content-compact")) return;
    const st = document.createElement("style");
    st.id = "site-content-compact";
    st.textContent =
      "@media (min-width:761px) and (max-width:1200px){" +
      ".services{padding-left:clamp(10px,2vw,24px)!important;padding-right:clamp(10px,2vw,24px)!important}" +
      ".services .service-card{padding:16px!important;gap:12px!important;min-height:0!important;border-radius:20px!important}" +
      ".services .service-icon{width:46px!important;height:46px!important;border-radius:14px!important;font-size:19px!important}" +
      ".services .service-number{top:12px!important;right:14px!important;font-size:12px!important}" +
      ".services .service-body p{padding-right:0!important;margin-bottom:34px}" +
      ".services .service-arrow{width:32px!important;height:32px!important;right:12px!important;bottom:12px!important;font-size:12px!important}}" +
      "@media (min-width:761px) and (max-width:1024px){" +
      ".services .service-body h3{font-size:13px!important}.services .service-body p{font-size:11px!important}}";
    document.head.append(st);
  })();
  function tint(hex, strength) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(255 - (255 - c) * strength);
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
  }
  function innerWidth(el) {
    const cs = getComputedStyle(el);
    const w = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return w > 0 ? w : 0;
  }
  function effectiveCols(container, desired, min) {
    const want = Math.max(1, Math.min(Number(desired) || 1, 5));
    const w = innerWidth(container);
    if (!w) return want;
    const gap = parseFloat(container.style.gap) || 0;
    const fit = Math.max(1, Math.floor((w + gap) / (min + gap)));
    return Math.max(1, Math.min(want, fit));
  }
  function layoutGrid(container) {
    if (!container || !container.dataset.desiredCols) return;
    let cols;
    if (container.dataset.singleRow) {
      // Layanan: desktop & tablet selalu satu baris; HP (<=760px) tersusun 1 kolom
      if (window.matchMedia("(max-width: 760px)").matches) cols = 1;
      else cols = Math.max(1, Math.min(12, Array.from(container.children).reduce((sum, child) => sum + Math.max(1, Math.min(Number(child.dataset.editorWidth) || 1, 5)), 0)));
    } else {
      cols = effectiveCols(container, container.dataset.desiredCols, Number(container.dataset.minCard) || 200);
    }
    container.dataset.editorColumns = String(cols);
    container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    Array.from(container.children).forEach((child) => {
      const w = Number(child.dataset.editorWidth) || 1;
      child.style.gridColumn = `span ${Math.max(1, Math.min(w, cols))}`;
    });
  }
  const gridObserver = "ResizeObserver" in window ? new ResizeObserver((entries) => entries.forEach((e) => layoutGrid(e.target))) : null;
  function watchGrid(container, desired, min) {
    container.dataset.desiredCols = String(desired);
    container.dataset.minCard = String(min);
    if (gridObserver && !container.dataset.watched) { container.dataset.watched = "1"; gridObserver.observe(container); }
    layoutGrid(container);
  }
  window.addEventListener("resize", () => {
    document.querySelectorAll("[data-desired-cols]").forEach(layoutGrid);
  });

  function applySurface(element, item) {
    const start = HEX.test(item.background || "") ? item.background : "";
    const end = HEX.test(item.backgroundEnd || "") ? item.backgroundEnd : "";
    const opacity = Number.isInteger(item.backgroundOpacity) ? item.backgroundOpacity : 100;
    element.style.backgroundColor = start && !end ? rgba(start, opacity) : "";
    element.style.backgroundImage = start && end
      ? `linear-gradient(${Number.isInteger(item.gradientAngle) ? item.gradientAngle : 135}deg, ${rgba(start, opacity)}, ${rgba(end, opacity)})`
      : "";
    const glow = Math.max(0, Math.min(Number(item.glow) || 0, 48));
    const glowColor = HEX.test(item.glowColor || "") ? item.glowColor : (start || "#0b6c83");
    element.style.boxShadow = glow ? `0 0 ${glow * 2}px ${rgba(glowColor, 38)}` : "";
  }

  function applyItemStyle(element, item, columns) {
    applySurface(element, item);
    element.style.color = HEX.test(item.textColor || "") ? item.textColor : "";
    if (HEX.test(item.textColor || "")) element.style.setProperty("--muted", item.textColor);
    const fontSize = Number.isInteger(item.fontSize) && item.fontSize >= 12 && item.fontSize <= 48 ? `${item.fontSize}px` : "";
    element.style.fontSize = fontSize;
    element.querySelectorAll(".service-body h3,.service-body p,.digital-name,.custom-block h3,.custom-block p").forEach((node) => { node.style.fontSize = fontSize; });
    element.style.textAlign = ["left", "center", "right"].includes(item.textAlign) ? item.textAlign : "";
    element.style.borderRadius = Number.isInteger(item.radius) ? `${item.radius}px` : "";
    element.style.border = Number(item.borderWidth) > 0 && HEX.test(item.borderColor || "")
      ? `${item.borderWidth}px solid ${item.borderColor}`
      : "";
    element.dataset.editorWidth = String(Math.max(1, Math.min(Number(item.width) || 1, 5)));
    const columnCount = Number(columns || (element.parentElement && element.parentElement.dataset.editorColumns) || 1);
    element.style.gridColumn = `span ${Math.max(1, Math.min(Number(item.width) || 1, columnCount))}`;
  }

  function renderServices(model) {
    const section = document.querySelector('[data-editor-section="services"]');
    if (!section) return;
    const existing = Array.from(section.querySelectorAll(":scope > .service-card"));
    const template = SERVICE_TEMPLATE || existing[0];
    if (!template) return;
    section.style.gap = `${model.services.gap}px`;
    const cols = effectiveCols(section, model.services.columns, MIN_CARD.services);
    section.dataset.editorColumns = String(cols);
    section.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    applySurface(section, model.services);
    section.replaceChildren();
    model.services.items.forEach((item, index) => {
      const card = template.cloneNode(true);
      const body = card.querySelector(".service-body");
      const box = card.querySelector(".service-icon");
      const icon = card.querySelector(".service-icon i");
      card.className = `service-card service-${item.color}`;
      card.dataset.editorId = item.id;
      card.href = validHref(item.href) ? item.href : "#";
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.querySelector(".service-number").textContent = String(index + 1).padStart(2, "0");
      body.querySelector("h3").textContent = item.title;
      body.querySelector("p").textContent = item.description;
      icon.className = ICONS[item.icon] || ICONS.file;
      const accent = HEX.test(item.accent || "") ? item.accent : "";
      if (accent) {
        card.style.setProperty("--c", accent);
        card.style.setProperty("--c2", tint(accent, 0.14));
      } else {
        card.style.removeProperty("--c");
        card.style.removeProperty("--c2");
      }
      icon.style.color = HEX.test(item.iconColor || "") ? item.iconColor : "";
      const customBox = HEX.test(item.iconBg || "") ? item.iconBg : "";
      if (box) {
        box.style.background = customBox;
        box.style.boxShadow = customBox ? `0 12px 24px ${rgba(customBox, 40)}` : "";
      }
      applyItemStyle(card, item, cols);
      section.append(card);
    });
    section.dataset.singleRow = "1";
    watchGrid(section, model.services.columns, MIN_CARD.services);
  }

  function renderDigital(model) {
    const section = document.querySelector('[data-editor-section="digital"]');
    const grid = section && section.querySelector(".digital-grid");
    if (!grid) return;
    const existing = Array.from(grid.querySelectorAll(":scope > .digital-card"));
    const template = DIGITAL_TEMPLATE || existing[0];
    if (!template) return;
    grid.style.gap = `${model.digital.gap}px`;
    const cols = effectiveCols(grid, model.digital.columns, MIN_CARD.digital);
    grid.dataset.editorColumns = String(cols);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    applySurface(section, model.digital);
    grid.replaceChildren();
    model.digital.items.forEach((item) => {
      const card = template.cloneNode(true);
      const image = card.querySelector(".digital-thumb");
      const title = card.querySelector(".digital-name");
      card.dataset.editorId = item.id;
      card.href = validHref(item.href) ? item.href : "#";
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      image.src = validImage(item.image) ? item.image : "assets/map.svg";
      image.alt = item.alt;
      title.textContent = item.title;
      title.style.whiteSpace = "pre-line";
      applyItemStyle(card, item, cols);
      grid.append(card);
    });
    watchGrid(grid, model.digital.columns, MIN_CARD.digital);
  }

  function renderCustom(model) {
    const section = document.querySelector('[data-editor-section="custom"]');
    const grid = section && section.querySelector(".custom-content-grid");
    if (!section || !grid) return;
    const content = model.custom || { title: "", columns: 3, gap: 20, items: [] };
    const items = Array.isArray(content.items) ? content.items : [];
    section.hidden = items.length === 0;
    applySurface(section, content);
    const heading = section.querySelector(".custom-content-heading");
    if (heading) {
      heading.textContent = content.title || "";
      heading.hidden = !content.title;
    }
    grid.style.gap = `${content.gap || 0}px`;
    const cols = effectiveCols(grid, content.columns || 3, MIN_CARD.custom);
    grid.dataset.editorColumns = String(cols);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.replaceChildren();
    items.forEach((item) => {
      const isCard = item.type === "card";
      const element = item.href && validHref(item.href) ? document.createElement("a") : document.createElement("article");
      element.className = `custom-block ${isCard ? "custom-card" : "custom-text"}`;
      element.dataset.editorId = item.id;
      if (element.tagName === "A") {
        element.href = item.href;
        element.target = "_blank";
        element.rel = "noopener noreferrer";
      }
      if (isCard && validImage(item.image)) {
        const image = document.createElement("img");
        image.className = "custom-block-image";
        image.src = item.image;
        image.alt = item.alt || "";
        element.append(image);
      }
      if (item.title) {
        const title = document.createElement("h3");
        title.textContent = item.title;
        element.append(title);
      }
      if (item.text) {
        const text = document.createElement("p");
        text.textContent = item.text;
        element.append(text);
      }
      applyItemStyle(element, item, cols);
      grid.append(element);
    });
    watchGrid(grid, content.columns || 3, MIN_CARD.custom);
  }

  function applyContent(model) {
    if (!model || model.schemaVersion !== 1) return;
    document.documentElement.style.setProperty("--teal", model.theme.primary);
    document.querySelector(".page").style.backgroundColor = model.theme.background;
    const eyebrow = document.querySelector('[data-editor-field="hero.eyebrow"]');
    const title = document.querySelector('[data-editor-field="hero.title"]');
    const description = document.querySelector('[data-editor-field="hero.description"]');
    const heroImage = document.querySelector('[data-editor-field="hero.image"]');
    const hero = document.querySelector('[data-editor-section="hero"]');
    if (eyebrow) eyebrow.textContent = model.hero.eyebrow;
    if (title) { title.textContent = model.hero.title; title.style.whiteSpace = "pre-line"; }
    if (description) description.textContent = model.hero.description;
    if (heroImage && validImage(model.hero.image)) heroImage.src = model.hero.image;
    if (hero) applySurface(hero, { background: model.hero.background, backgroundEnd: model.hero.backgroundEnd, gradientAngle: model.hero.gradientAngle, backgroundOpacity: model.hero.backgroundOpacity, glow: model.hero.glow, glowColor: model.hero.glowColor });

    renderServices(model);
    renderDigital(model);
    renderCustom(model);

    const contact = model.contact;
    const phone = document.querySelector('[data-editor-contact="phone"]');
    const email = document.querySelector('[data-editor-contact="email"]');
    const address = document.querySelector('[data-editor-contact="address"]');
    if (phone) { phone.textContent = contact.phone; phone.href = `https://wa.me/${contact.whatsapp}`; }
    if (email) { email.textContent = contact.email; email.href = `mailto:${contact.email}`; }
    if (address) address.textContent = contact.address;
    ["weekday", "weekdayHours", "sunday", "sundayStatus"].forEach((key) => {
      const node = document.querySelector(`[data-editor-contact="${key}"]`);
      if (node) node.textContent = contact[key];
    });
    // Peta hanya dimuat ulang jika alamat benar-benar berubah (menghindari kedip di preview)
    const map = document.querySelector(".map-card iframe");
    if (map) {
      if (map.dataset.addr === undefined) {
        map.dataset.addr = (ORIGINAL_ADDRESS || "").trim();
      }
      if (map.dataset.addr !== String(contact.address).trim()) {
        map.dataset.addr = String(contact.address).trim();
        map.src = `https://www.google.com/maps?q=${encodeURIComponent(contact.address)}&output=embed`;
      }
    }

    const main = document.querySelector("main");
    if (main) model.sections.forEach((id) => {
      const section = document.querySelector(`[data-editor-section="${id}"]`);
      if (section && section.parentElement === main) main.append(section);
    });
  }

  async function loadPublished() {
    try {
      const [defaultResponse, publishedResponse] = await Promise.all([
        fetch(DEFAULT_URL, { cache: "no-store" }),
        fetch(API_URL, { cache: "no-store" })
      ]);
      const defaults = defaultResponse.ok ? await defaultResponse.json() : null;
      const published = publishedResponse.ok ? await publishedResponse.json() : null;
      const source = published && published.content ? published.content : {};
      const model = defaults ? {
        ...defaults,
        ...source,
        sections: source.sections || defaults.sections,
        theme: { ...defaults.theme, ...source.theme },
        hero: { ...defaults.hero, ...source.hero },
        services: { ...defaults.services, ...source.services },
        digital: { ...defaults.digital, ...source.digital },
        custom: { ...defaults.custom, ...source.custom },
        contact: { ...defaults.contact, ...source.contact }
      } : source;
      applyContent(model);
    } catch (error) {
      console.warn("Konten terbit gagal dimuat; HTML bawaan digunakan.", error);
    }
  }

  if (editorPreview) {
    window.__siteEditorApplyContent = applyContent;
    const reportPreviewHeight = () => requestAnimationFrame(() => {
      const height = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
      window.parent.postMessage({ type: "site-editor-preview-height", height }, location.origin);
    });
    if ("ResizeObserver" in window) {
      const previewResizeObserver = new ResizeObserver(reportPreviewHeight);
      previewResizeObserver.observe(document.documentElement);
      if (document.body) previewResizeObserver.observe(document.body);
    }
    window.addEventListener("load", reportPreviewHeight, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reportPreviewHeight);
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin || event.source !== window.parent || !event.data) return;
      if (event.data.type === "site-editor-preview-scroll") {
        const header = document.querySelector(".site-header");
        if (header) header.classList.toggle("scrolled", Number(event.data.scrollY) > 40);
        return;
      }
      if (event.data.type === "site-editor-preview-init") {
        window.parent.postMessage({ type: "site-editor-preview-ready" }, location.origin);
        return;
      }
      if (event.data.type !== "site-editor-preview") return;
      try {
        applyContent(event.data.content);
        reportPreviewHeight();
        window.parent.postMessage({ type: "site-editor-preview-applied" }, location.origin);
      } catch (error) {
        window.parent.postMessage({ type: "site-editor-preview-error", message: String(error && error.message || error) }, location.origin);
      }
    });
    window.parent.postMessage({ type: "site-editor-preview-ready" }, location.origin);
  } else {
    loadPublished();
  }
})();
