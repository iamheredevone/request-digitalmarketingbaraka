<script setup>
import { ref } from 'vue';

const menuOpen = ref(false);
const logo = 'https://res.cloudinary.com/dj0kb9tg7/image/upload/v1761968452/Logo_Final_Baraka_Polos_1_vtwwmn.png';
const links = [
  ['Beranda', '#beranda'], ['Layanan', '#layanan'], ['Materi Digital', '#materi'],
  ['Galeri', '#galeri'], ['Kontak', '#kontak']
];
</script>

<template>
  <header class="portal-header">
    <a class="portal-brand" href="../index.html#beranda" aria-label="Baraka Express - Beranda"><img :src="logo" alt="Logo Baraka Express"></a>
    <nav class="portal-nav" :class="{ open: menuOpen }" aria-label="Navigasi utama">
      <a v-for="[label, href] in links" :key="href" :href="`../index.html${href}`">{{ label }}</a>
    </nav>
    <a class="portal-contact" href="https://wa.me/6282211958695" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Hubungi Kami</a>
    <a class="portal-login" href="../admin-gallery.html" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-user" aria-hidden="true"></i> Login</a>
    <button class="portal-menu-toggle" type="button" aria-label="Buka navigasi" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
  </header>
  <slot />
  <footer class="portal-footer">
    <a class="portal-footer-brand" href="../index.html#beranda" aria-label="Baraka Express - Beranda"><img :src="logo" alt="Baraka Express"></a>
    <div class="portal-copyright"><strong>© 2026 Digital Marketing</strong><span>Seluruh hak cipta dilindungi.</span></div>
    <span class="portal-crafted">Crafted by <strong><a href="https://www.instagram.com/iamnotafra1d" target="_blank" rel="noopener noreferrer">iamnotafra1d</a></strong></span>
  </footer>
</template>
