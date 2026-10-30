import { createApp } from 'vue';

const path = decodeURI(window.location.pathname).replace(/\\/g, '/');
const isPortalForm = ['/Design Agen Cabang/', '/Google Maps Agen Cabang/', '/Cabang Agen Baru/', '/Audit/'].some((part) => path.includes(part));
if (isPortalForm) document.body.classList.add('portal-page');
if (path.includes('/Cabang Agen Baru/')) document.body.classList.add('portal-branch-form');
async function start() {
  let page;
  if (path.endsWith('/admin-gallery.html')) {
    page = (await import('./views/GalleryAdmin.vue')).default;
  } else if (path.endsWith('/admin-site-editor.html')) {
    page = (await import('./views/SiteEditor.vue')).default;
  } else if (path.includes('/Design Agen Cabang/')) {
    page = (await import('./views/DesignRequest.vue')).default;
  } else if (path.includes('/Google Maps Agen Cabang/')) {
    page = (await import('./views/MapsRequest.vue')).default;
  } else if (path.includes('/Cabang Agen Baru/')) {
    page = (await import('./views/BranchRequest.vue')).default;
  } else if (path.includes('/Audit/')) {
    page = (await import('./views/AuditReport.vue')).default;
  } else {
    page = (await import('./views/HomePage.vue')).default;
  }
  createApp(page).mount('#app');
}

start();
