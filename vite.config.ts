import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Имя репозитория на GitHub Pages. Если репозиторий назовёте иначе — поменяйте тут.
const REPO_BASE = '/slovo2/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: REPO_BASE,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'СЛОВО 2.0 — учи словарные слова',
        short_name: 'СЛОВО',
        description: 'Увлекательная тренировка словарных слов для 2 класса. Работает без интернета.',
        lang: 'ru',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF8EC',
        theme_color: '#7C5CFF',
        categories: ['education', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: {
    host: '0.0.0.0',
    // Разрешаем открывать приложение по адресу предпросмотра (e2b) и с телефона в LAN.
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1', '.local', '.ngrok.io', '.trycloudflare.com'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
  },
}));
