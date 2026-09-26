import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Имя репозитория на GitHub Pages. Если репозиторий назовёте иначе — поменяйте тут.
const REPO_BASE = '/slovo2/';

/** Номер релиза из package.json — поднимайте его перед каждым релизом. */
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

/**
 * Короткий SHA коммита, из которого собрана версия приложения (показывается
 * в настройках). Суффикс «-dirty» — были незакоммиченные изменения при сборке.
 * По SHA легко сверить, что за версия стоит на сайте и что в разработке.
 */
function buildSha(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    // tsc -b и сам Vite генерируют эти файлы при сборке — это не изменения исходников.
    const dirty = execSync(
      "git status --porcelain --untracked-files=all -- . ':!tsconfig.tsbuildinfo' ':!vite.config.ts.timestamp-*.mjs'",
      {
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
      .toString()
      .trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'dev';
  }
}

// Передаём в приложение через import.meta.env (работает и в dev, и в build —
// обычный `define` в dev-сервере vite не подставляется).
process.env.VITE_APP_VERSION = pkg.version;
process.env.VITE_BUILD_SHA = buildSha();

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
