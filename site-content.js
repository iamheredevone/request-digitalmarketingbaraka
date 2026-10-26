(() => {
  const API_URL = "https://digitalmarketing.iamhere-devone.workers.dev/?resource=site-editor";
  const DEFAULT_URL = "site-content-defaults.json";
  const editorPreview = new URLSearchParams(location.search).has("editorPreview");
  const SERVICE_TEMPLATE = document.querySelector('[data-editor-section="services"] > .service-card')?.cloneNode(true);
  const DIGITAL_TEMPLATE = document.querySelector('[data-editor-section="digital"] .digital-grid > .digital-card')?.cloneNode(true);
  const ICONS = {
    file: "fa-regular fa-file-lines",
    palette: "fa-solid fa-palette",
    location: "fa-solid fa-location-dot",
    clipboard: "fa-regular fa-clipboard"
  };

  function validImage(value) {
    return typeof value === "string" && (/^https:\/\//i.test(value) || (/^assets\/[a-zA-Z0-9_./ -]+$/.test(value) && !value.split("/").includes("..")));
  }

  function validHref(value) {
    if (typeof value !== "string") return false;
    const lower = value.toLowerCase();
    return !lower.startsWith("javascript:") && (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("mailto:") || lower.startsWith("tel:") || (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("./") || value.startsWith("#"));
  }
  function applyItemStyle(element, item, columns) {
    element.style.backgroundColor = /^#[0-9a-f]{6}$/i.test(item.background || "") ? item.background : "";
    element.style.color = /^#[0-9a-f]{6}$/i.test(item.textColor || "") ? item.textColor : "";
    element.style.fontSize = Number.isInteger(item.fontSize) && item.fontSize >= 12 && item.fontSize <= 32 ? `${item.fontSize}px` : "";
    const columnCount = Number(columns || (element.parentElement && element.parentElement.dataset.editorColumns) || 1);
    element.style.gridColumn = `span ${Math.max(1, Math.min(Number(item.width) || 1, columnCount))}`;
  }

  function renderServices(model) {
    const section = document.querySelector('[data-editor-section="services"]');
    if (!section) return;
    const existing = Array.from(section.querySelectorAll(":scope > .service-card"));
    const template = SERVICE_TEMPLATE || existing[0];
    if (!template) return;
    const cols = window.matchMedia("(max-width: 760px)").matches ? 1 : model.services.columns;
    section.dataset.editorColumns = String(cols);
    section.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    section.style.gap = `${model.services.gap}px`;
    section.replaceChildren();
    model.services.items.forEach((item, index) => {
      const card = template.cloneNode(true);
      const body = card.querySelector(".service-body");
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
      applyItemStyle(card, item, cols);
      section.append(card);
    });
  }

  function renderDigital(model) {
    const section = document.querySelector('[data-editor-section="digital"]');
    const grid = section && section.querySelector(".digital-grid");
    if (!grid) return;
    const existing = Array.from(grid.querySelectorAll(":scope > .digital-card"));
    const template = DIGITAL_TEMPLATE || existing[0];
    if (!template) return;
    const cols = window.matchMedia("(max-width: 480px)").matches ? 1 : window.matchMedia("(max-width: 760px)").matches ? 2 : model.digital.columns;
    grid.dataset.editorColumns = String(cols);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gap = `${model.digital.gap}px`;
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
    if (hero) hero.style.backgroundColor = model.hero.background;

    renderServices(model);
    renderDigital(model);

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
    const map = document.querySelector(".map-card iframe");
    if (map) map.src = `https://www.google.com/maps?q=${encodeURIComponent(contact.address)}&output=embed`;

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
      applyContent(published && published.content ? published.content : defaults);
    } catch (error) {
      console.warn("Konten terbit gagal dimuat; HTML bawaan digunakan.", error);
    }
  }

  if (editorPreview) {
    window.__siteEditorApplyContent = applyContent;
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin || event.source !== window.parent || !event.data) return;
      if (event.data.type === "site-editor-preview-init") {
        window.parent.postMessage({ type: "site-editor-preview-ready" }, location.origin);
        return;
      }
      if (event.data.type !== "site-editor-preview") return;
      try {
        applyContent(event.data.content);
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