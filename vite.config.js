import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [vue()],
  publicDir: 'public',
  server: {
    watch: { usePolling: true, interval: 1000 }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        galleryAdmin: resolve(root, 'admin-gallery.html'),
        siteEditor: resolve(root, 'admin-site-editor.html'),
        design: resolve(root, 'Design Agen Cabang/index.html'),
        maps: resolve(root, 'Google Maps Agen Cabang/index.html'),
        branch: resolve(root, 'Cabang Agen Baru/index.html'),
        audit: resolve(root, 'Audit/index.html')
      }
    }
  }
});
