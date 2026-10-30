<script setup>
import { onMounted, ref } from 'vue';
import editorDocument from '../legacy/admin-site-editor-template.html?raw';
import '../../admin-site-editor.css';

const host = ref(null);
const parsed = new DOMParser().parseFromString(editorDocument, 'text/html');
const markup = parsed.body.innerHTML.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const loginCss = parsed.head.querySelector('style')?.textContent || '';

onMounted(async () => {
  document.title = 'Super Admin | Baraka Express';
  document.querySelector('#legacy-site-editor-login')?.remove();
  if (loginCss) {
    const style = document.createElement('style'); style.id = 'vue-site-editor-login-style'; style.textContent = loginCss; document.head.append(style);
  }
  const engine = await import('../../admin-site-editor.js');
  engine.initAdminSiteEditor();
  const toggle = host.value?.querySelector('#togglePassword');
  const password = host.value?.querySelector('#adminPassword');
  toggle?.addEventListener('click', () => {
    if (!password) return;
    const show = password.type === 'password'; password.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
    toggle.firstElementChild?.classList.toggle('fa-eye-slash', show);
    toggle.firstElementChild?.classList.toggle('fa-eye', !show);
  });
});
</script>

<template>
  <div ref="host" class="site-editor-vue-host" v-html="markup"></div>
</template>

<style>
html:has(.site-editor-vue-host),body:has(.site-editor-vue-host),.site-editor-vue-host{min-height:100%;margin:0}
.site-editor-vue-host{font-family:"Manrope",system-ui,sans-serif}
</style>
