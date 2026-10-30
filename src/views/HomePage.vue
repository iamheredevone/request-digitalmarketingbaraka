<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import defaults from '../../site-content-defaults.json';
import '../../style.css';

const WORKER = 'https://digitalmarketing.iamhere-devone.workers.dev/';
const logo = 'https://res.cloudinary.com/dj0kb9tg7/image/upload/v1761968452/Logo_Final_Baraka_Polos_1_vtwwmn.png';
const icons = {
  file: 'fa-regular fa-file-lines', palette: 'fa-solid fa-palette', location: 'fa-solid fa-location-dot', clipboard: 'fa-regular fa-clipboard',
  truck: 'fa-solid fa-truck', box: 'fa-solid fa-box', 'boxes-stacked': 'fa-solid fa-boxes-stacked', warehouse: 'fa-solid fa-warehouse', store: 'fa-solid fa-store', building: 'fa-solid fa-building', map: 'fa-solid fa-map', phone: 'fa-solid fa-phone', envelope: 'fa-solid fa-envelope', comments: 'fa-solid fa-comments', bullhorn: 'fa-solid fa-bullhorn', image: 'fa-solid fa-image', camera: 'fa-solid fa-camera', video: 'fa-solid fa-video', 'bag-shopping': 'fa-solid fa-bag-shopping', 'cart-shopping': 'fa-solid fa-cart-shopping', tag: 'fa-solid fa-tag', gift: 'fa-solid fa-gift', star: 'fa-solid fa-star', heart: 'fa-solid fa-heart', 'calendar-days': 'fa-solid fa-calendar-days', clock: 'fa-solid fa-clock', users: 'fa-solid fa-users', 'user-tie': 'fa-solid fa-user-tie', handshake: 'fa-solid fa-handshake', 'chart-line': 'fa-solid fa-chart-line', 'money-bill': 'fa-solid fa-money-bill', 'credit-card': 'fa-solid fa-credit-card', gear: 'fa-solid fa-gear', 'shield-halved': 'fa-solid fa-shield-halved', 'circle-check': 'fa-solid fa-circle-check', 'circle-info': 'fa-solid fa-circle-info', lightbulb: 'fa-solid fa-lightbulb', rocket: 'fa-solid fa-rocket', globe: 'fa-solid fa-globe', link: 'fa-solid fa-link', download: 'fa-solid fa-download', print: 'fa-solid fa-print', pen: 'fa-solid fa-pen', book: 'fa-solid fa-book'
};
const fallbackSlides = [
  { path: 'assets/Cabang Pekanbaru Utara WEB.png', alt: 'Cabang Pekanbaru Utara' },
  { path: 'assets/Cabang Bekasi Utara WEB.jpg', alt: 'Cabang Bekasi Utara' },
  { path: 'assets/Agen Surabaya Manukan WEB.png', alt: 'Agen Surabaya Manukan' },
  { path: 'assets/Cabang Curup WEB.jpg', alt: 'Cabang Curup' },
  { path: 'assets/Cabang Mojokerto Timur WEB.png', alt: 'Cabang Mojokerto Timur' }
];
const copy = (value) => JSON.parse(JSON.stringify(value));
const content = ref(copy(defaults));
const slides = ref(fallbackSlides);
const currentSlide = ref(0);
const navOpen = ref(false);
const editorPreview = new URLSearchParams(location.search).has('editorPreview');
const sectionOrder = computed(() => Array.isArray(content.value.sections) ? content.value.sections : defaults.sections);
const pageStyle = computed(() => ({ backgroundColor: content.value.theme?.background || defaults.theme.background, '--primary': content.value.theme?.primary || defaults.theme.primary }));
const heroStyle = computed(() => surfaceStyle(content.value.hero));
const gallerySlide = computed(() => slides.value.length ? currentSlide.value % slides.value.length : 0);

function rgba(hex, opacity = 100) {
  if (!/^#[\da-f]{6}$/i.test(hex || '')) return 'transparent';
  const raw = hex.slice(1);
  return `rgba(${parseInt(raw.slice(0, 2), 16)},${parseInt(raw.slice(2, 4), 16)},${parseInt(raw.slice(4, 6), 16)},${Math.min(100, Math.max(0, opacity)) / 100})`;
}
function surfaceStyle(surface = {}) {
  const style = {};
  if (/^#[\da-f]{6}$/i.test(surface.background || '')) {
    style.backgroundColor = rgba(surface.background, surface.backgroundOpacity ?? 100);
    if (/^#[\da-f]{6}$/i.test(surface.backgroundEnd || '')) {
      style.backgroundImage = `linear-gradient(${surface.gradientAngle ?? 135}deg, ${rgba(surface.background, surface.backgroundOpacity ?? 100)}, ${rgba(surface.backgroundEnd, surface.backgroundOpacity ?? 100)})`;
    }
  }
  if (surface.glow > 0) style.boxShadow = `0 0 ${surface.glow * 2}px ${rgba(surface.glowColor || surface.background || '#0b6c83', 38)}`;
  return style;
}
function itemStyle(item = {}) {
  return {
    ...surfaceStyle(item),
    color: item.textColor || '',
    fontSize: item.fontSize ? `${item.fontSize}px` : '',
    textAlign: item.textAlign || '',
    borderRadius: Number.isInteger(item.radius) ? `${item.radius}px` : '',
    border: item.borderWidth > 0 && item.borderColor ? `${item.borderWidth}px solid ${item.borderColor}` : '',
    gridColumn: `span ${Math.max(1, Number(item.width) || 1)}`,
    gridRow: item.rowSpan > 1 ? `span ${item.rowSpan}` : ''
  };
}
function gridStyle(section, minWidth) {
  const desired = Math.max(1, Number(section?.columns) || 1);
  return { gap: `${Number(section?.gap) || 0}px`, '--editor-columns': desired, '--min-card': `${minWidth}px` };
}
function validHref(value) {
  const url = String(value || '').toLowerCase();
  return ['https://', 'http://', 'mailto:', 'tel:', './', '#', '/'].some((prefix) => url.startsWith(prefix) && !(prefix === '/' && url.startsWith('//')));
}
function normalizeContent(input) {
  const next = copy(input || defaults);
  next.sections = Array.isArray(next.sections) ? next.sections : copy(defaults.sections);
  next.theme = { ...defaults.theme, ...(next.theme || {}) };
  for (const section of ['hero', 'services', 'digital', 'custom', 'contact']) next[section] = { ...defaults[section], ...(next[section] || {}) };
  for (const section of ['services', 'digital', 'custom']) next[section].items = Array.isArray(next[section].items) ? next[section].items : [];
  return next;
}
function applyContent(input) {
  content.value = normalizeContent(input);
  if (editorPreview) nextTick(() => {
    window.parent.postMessage({ type: 'site-editor-preview-applied' }, location.origin);
    publishPreviewHeight();
  });
}
function moveTo(index) { if (slides.value.length > 1) currentSlide.value = (index + slides.value.length) % slides.value.length; }
function navTo(event, id) {
  if (editorPreview) { event.preventDefault(); return; }
  navOpen.value = false;
  if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}
function preventPreviewNavigation(event) {
  if (editorPreview && event.target.closest('a')) event.preventDefault();
}
function previewMessage(event) {
  if (event.origin !== location.origin || !event.data) return;
  const message = event.data;
  try {
    if (message.type === 'site-editor-preview-init') {
      window.parent.postMessage({ type: 'site-editor-preview-ready' }, location.origin);
    } else if (message.type === 'site-editor-preview') {
      applyContent(message.content);
      requestAnimationFrame(() => window.parent.postMessage({ type: 'site-editor-preview-applied' }, location.origin));
    } else if (message.type === 'site-editor-preview-scroll') {
      window.scrollTo(0, Math.max(0, Number(message.scrollY) || 0));
    }
  } catch (error) {
    window.parent.postMessage({ type: 'site-editor-preview-error', message: error.message }, location.origin);
  }
}
let timer;
let resizeObserver;
function publishPreviewHeight() {
  if (!editorPreview) return;
  const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  window.parent.postMessage({ type: 'site-editor-preview-height', height }, location.origin);
}
onMounted(async () => {
  document.title = 'Portal Layanan | Baraka Express';
  window.addEventListener('message', previewMessage);
  document.addEventListener('click', preventPreviewNavigation, true);
  window.addEventListener('resize', publishPreviewHeight);
  if (editorPreview) {
    window.__siteEditorApplyContent = applyContent;
    window.parent.postMessage({ type: 'site-editor-preview-ready' }, location.origin);
    resizeObserver = new ResizeObserver(publishPreviewHeight);
    resizeObserver.observe(document.body);
    requestAnimationFrame(publishPreviewHeight);
  } else {
    fetch(`${WORKER}?resource=site-editor`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.content) applyContent(data.content); })
      .catch(() => {});
  }
  try {
    const response = await fetch(`${WORKER}?resource=gallery`, { cache: 'no-store' });
    const result = await response.json();
    if (Array.isArray(result.slides) && result.slides.length) slides.value = result.slides.filter((slide) => slide?.path);
  } catch { /* carousel tetap memakai gambar lokal */ }
  timer = window.setInterval(() => moveTo(gallerySlide.value + 1), 4000);
});
onUnmounted(() => {
  clearInterval(timer);
  resizeObserver?.disconnect();
  window.removeEventListener('message', previewMessage);
  document.removeEventListener('click', preventPreviewNavigation, true);
  window.removeEventListener('resize', publishPreviewHeight);
  delete window.__siteEditorApplyContent;
});
</script>

<template>
  <div class="page" :style="pageStyle" @click="preventPreviewNavigation">
    <header class="site-header">
      <a class="brand" href="#beranda" aria-label="Baraka Express - Beranda"><img :src="logo" alt="Logo Baraka Express"></a>
      <nav class="main-nav" :class="{ open: navOpen }" aria-label="Navigasi utama">
        <a v-for="[label, id] in [['Beranda','beranda'],['Layanan','layanan'],['Materi Digital','materi'],['Galeri','galeri'],['Kontak','kontak']]" :key="id" :href="`#${id}`" @click="navTo($event, id)">{{ label }}</a>
      </nav>
      <a class="header-cta" :href="`https://wa.me/${content.contact.whatsapp}?text=${encodeURIComponent('Halo Baraka Express, saya ingin bertanya tentang layanan.')}`" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> Hubungi Kami</a>
      <a class="header-admin" href="./admin-gallery.html" target="_blank" rel="noopener noreferrer" aria-label="Login admin galeri"><i class="fa-solid fa-user" aria-hidden="true"></i> Login</a>
      <button class="nav-toggle" type="button" aria-label="Buka navigasi" :aria-expanded="navOpen" @click="navOpen = !navOpen"><i class="fa-solid fa-bars"></i></button>
    </header>

    <main>
      <template v-for="section in sectionOrder" :key="section">
        <section v-if="section === 'hero'" class="hero" id="beranda" data-editor-section="hero" :style="heroStyle">
          <div class="hero-photo" aria-hidden="true"><img :src="content.hero.image" alt="" data-editor-field="hero.image"></div>
          <div class="hero-content"><span class="eyebrow" data-editor-field="hero.eyebrow">{{ content.hero.eyebrow }}</span><h1 data-editor-field="hero.title" style="white-space:pre-line">{{ content.hero.title }}</h1><p data-editor-field="hero.description">{{ content.hero.description }}</p><span class="hero-line"></span></div>
          <div class="hero-tagline" aria-hidden="true">Menghubungkan,<br>Lebih Banyak<br>Peluang</div>
        </section>

        <section v-else-if="section === 'services'" class="services" id="layanan" data-editor-section="services" :style="gridStyle(content.services, 260)">
          <a v-for="(item,index) in content.services.items" :key="item.id" class="service-card" :class="`service-${item.color || 'blue'}`" :href="validHref(item.href) ? item.href : '#layanan'" target="_blank" rel="noopener noreferrer" :data-editor-id="item.id" :data-editor-index="index" :data-editor-width="item.width || 1" :data-editor-col="item.col || 0" :data-editor-row="item.row || 0" :data-editor-row-span="item.rowSpan || 1" :style="itemStyle(item)">
            <span class="service-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="service-icon"><i :class="icons[item.icon] || icons.file" :style="{ color: item.iconColor || '' }"></i></span><div class="service-body"><h3>{{ item.title }}</h3><p>{{ item.description }}</p></div><span class="service-arrow"><i class="fa-solid fa-arrow-right"></i></span>
          </a>
        </section>

        <section v-else-if="section === 'custom'" class="custom-content-section" data-editor-section="custom" :hidden="!content.custom.items.length && !content.custom.title" :style="gridStyle(content.custom, 240)">
          <h2 class="custom-content-heading">{{ content.custom.title }}</h2><div class="custom-content-grid" :style="gridStyle(content.custom, 240)">
            <component :is="item.href && validHref(item.href) ? 'a' : 'div'" v-for="item in content.custom.items" :key="item.id" class="custom-block" :class="{ 'custom-text': item.type === 'text' }" :href="item.href || undefined" :data-editor-id="item.id" :style="itemStyle(item)">
              <img v-if="item.type === 'card' && item.image" class="custom-block-image" :src="item.image" :alt="item.alt || ''"><h3 v-if="item.title">{{ item.title }}</h3><p>{{ item.text }}</p>
            </component>
          </div>
        </section>

        <section v-else-if="section === 'digital'" class="digital" id="materi" data-editor-section="digital" :style="surfaceStyle(content.digital)">
          <h2>Materi Digital Baraka Express</h2><div class="digital-grid" :style="gridStyle(content.digital, 170)">
            <a v-for="item in content.digital.items" :key="item.id" class="digital-card" :href="validHref(item.href) ? item.href : '#materi'" target="_blank" rel="noopener noreferrer" :data-editor-id="item.id" :style="itemStyle(item)"><img class="digital-thumb" :src="item.image" :alt="item.alt || ''"><span class="digital-name">{{ item.title }}</span><i class="fa-solid fa-share-nodes share-icon"></i></a>
          </div>
        </section>

        <section v-else-if="section === 'gallery'" class="gallery-section" id="galeri" aria-label="Galeri Baraka Express" data-editor-section="gallery">
          <div class="gallery" id="gallery" @mouseenter="clearInterval(timer)" @mouseleave="timer = setInterval(() => moveTo(gallerySlide + 1), 4000)" @touchstart.passive="$event.currentTarget.dataset.touchX = $event.touches[0].clientX" @touchend="Math.abs($event.changedTouches[0].clientX - Number($event.currentTarget.dataset.touchX)) > 40 && moveTo(gallerySlide + ($event.changedTouches[0].clientX < Number($event.currentTarget.dataset.touchX) ? 1 : -1))">
            <div class="gallery-track" id="galleryTrack" aria-live="polite" :style="{ transform: `translateX(-${gallerySlide * 100}%)` }"><div v-for="(slide,index) in slides" :key="slide.path" class="gallery-slide"><img :src="slide.path" :alt="slide.alt || `Galeri Baraka Express ${index + 1}`" :loading="index ? 'lazy' : 'eager'"></div></div>
            <button v-if="slides.length > 1" class="gallery-arrow gallery-prev" id="galleryPrev" type="button" aria-label="Gambar sebelumnya" @click="moveTo(gallerySlide - 1)"><i class="fa-solid fa-chevron-left"></i></button><button v-if="slides.length > 1" class="gallery-arrow gallery-next" id="galleryNext" type="button" aria-label="Gambar berikutnya" @click="moveTo(gallerySlide + 1)"><i class="fa-solid fa-chevron-right"></i></button>
            <div v-if="slides.length > 1" class="gallery-dots" id="galleryDots" aria-label="Pilih gambar galeri"><button v-for="(_, index) in slides" :key="index" type="button" :aria-label="`Gambar ${index + 1}`" :class="{ active: index === gallerySlide }" @click="moveTo(index)"></button></div>
          </div>
        </section>

        <section v-else-if="section === 'contact'" class="contact-section" id="kontak" data-editor-section="contact">
          <div class="contact-panel"><div class="contact-details"><div class="contact-intro"><h2>Kontak Kami</h2></div>
            <div class="contact-item"><span class="contact-icon whatsapp" aria-hidden="true">☎</span><div class="contact-copy"><a class="contact-value contact-value-link" :href="`https://wa.me/${content.contact.whatsapp}`" target="_blank" rel="noopener noreferrer" data-editor-contact="phone">{{ content.contact.phone }}</a></div></div>
            <div class="contact-item"><span class="contact-icon email" aria-hidden="true">✉️</span><div class="contact-copy"><a class="contact-value contact-value-link" :href="`mailto:${content.contact.email}`" data-editor-contact="email">{{ content.contact.email }}</a></div></div>
            <div class="contact-item"><span class="contact-icon address" aria-hidden="true">📍</span><div class="contact-copy"><p class="contact-value" data-editor-contact="address">{{ content.contact.address }}</p></div></div>
            <div class="contact-bottom"><div class="contact-item"><span class="contact-icon hours" aria-hidden="true">◷</span><div class="contact-copy contact-hours"><h3 data-editor-contact="hoursTitle">Opening Hours</h3><div class="hours-row"><span data-editor-contact="weekday">{{ content.contact.weekday }}</span><span class="hours-colon">:</span><span data-editor-contact="weekdayHours">{{ content.contact.weekdayHours }}</span></div><div class="hours-row hours-closed"><span data-editor-contact="sunday">{{ content.contact.sunday }}</span><span class="hours-colon">:</span><span data-editor-contact="sundayStatus">{{ content.contact.sundayStatus }}</span></div><div class="contact-socials" aria-label="Media sosial Baraka Express"><a href="https://www.instagram.com/barakaexpress_id" target="_blank" rel="noopener noreferrer" aria-label="Instagram Baraka Express"><i class="fa-brands fa-instagram"></i></a><a href="https://www.facebook.com/expressbaraka" target="_blank" rel="noopener noreferrer" aria-label="Facebook Baraka Express"><i class="fa-brands fa-facebook-f"></i></a><a href="https://www.youtube.com/@baraka_express" target="_blank" rel="noopener noreferrer" aria-label="YouTube Baraka Express"><i class="fa-brands fa-youtube"></i></a><a href="https://www.tiktok.com/@barakaexpress_id" target="_blank" rel="noopener noreferrer" aria-label="TikTok Baraka Express"><i class="fa-brands fa-tiktok"></i></a></div></div></div>
              <div class="app-download"><h3>Download Sekarang!</h3><p>Aplikasi Baraka Customer</p><a class="google-play-badge" href="https://play.google.com/store/apps/details?id=com.barakacustomer.app&pcampaignid=web_share&pli=1" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-google-play"></i><span><small>GET IT ON</small><strong>Google Play</strong></span></a></div></div>
          </div><div class="map-card"><iframe src="https://maps.google.com/maps?ll=-6.3083671%2C106.9144878&z=17&output=embed" width="600" height="450" style="border:0" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" title="Peta lokasi HO Baraka Express"></iframe><span class="map-marker" aria-hidden="true"><i class="fa-solid fa-location-dot"></i></span><a class="map-open" href="https://maps.app.goo.gl/tzUQZhRxBahAUeuu5" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka di Maps</a></div></div>
        </section>
      </template>
    </main>

    <footer class="site-footer"><a class="footer-brand" href="#beranda"><img :src="logo" alt="Baraka Express"></a><div class="copyright"><strong>© 2026 Digital Marketing</strong><span>Seluruh hak cipta dilindungi.</span></div><span class="crafted">Crafted by <strong><a href="https://www.instagram.com/iamnotafra1d" target="_blank" rel="noopener noreferrer">iamnotafra1d</a></strong></span></footer>
  </div>
</template>

<style>
.services,.digital-grid,.custom-content-grid { grid-template-columns: repeat(var(--editor-columns,4),minmax(0,1fr)); }
@media(max-width:980px){.services{--editor-columns:2!important}.digital-grid{--editor-columns:3!important}}
@media(max-width:760px){.services{--editor-columns:1!important}.digital-grid{--editor-columns:2!important}}
@media(max-width:480px){.digital-grid{--editor-columns:1!important}}
</style>
