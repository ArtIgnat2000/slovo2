import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { STARTER_TRACK_IDS } from './src/engine/music';

// Имя репозитория на GitHub Pages. Если репозиторий назовёте иначе — поменяйте тут.
const REPO_BASE = '/slovo2/';

/**
 * База сборки. Для GitHub Pages — '/slovo2/', а для локального показа в песочнице
 * (npm run preview:build) нужен корень: превью-прокси открывает приложение по адресу
 * без пути репозитория, иначе получается белый экран из-за путей к /slovo2/assets/*.
 * Переопределяется переменной окружения VITE_BASE (см. package.json).
 */
const buildBase = process.env.VITE_BASE ?? REPO_BASE;

/** Номер релиза из package.json — поднимайте его в каждом PR в main, включая документацию. */
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
  base: command === 'build' ? buildBase : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      base: buildBase,
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
        // webp — картинки слов: без них офлайн-режим показывал бы пустые рамки.
        // audio/*.mp3 — стартовые мелодии: музыка должна звучать офлайн сразу
        // после установки PWA. Платные треки намеренно НЕ идут в precache —
        // они крупные и нужны только тем, кто их открыл (см. runtimeCaching).
        // Паттерн добавляется только если файл на месте: сборка без аудио
        // (свежий клон до npm run music:fetch) остаётся чистой и рабочей,
        // а полноту аудио проверяет npm run audio:check.
        globPatterns: [
          '**/*.{js,css,html,png,svg,webp,webmanifest}',
          ...STARTER_TRACK_IDS.filter((id) => existsSync(new URL(`./public/audio/${id}.mp3`, import.meta.url))).map(
            (id) => `**/audio/${id}.mp3`,
          ),
        ],
        // MP3 стартовых треков крупнее порога workbox по умолчанию (2 МБ).
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // Витрина вариантов карточки (docs/) — служебная страница для ревью,
        // ей нечего делать в офлайн-кэше у ребёнка.
        globIgnores: ['docs/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Остальная музыка (покупки, прослушивание): первый запрос кладёт файл
        // в кэш «slovo2-audio», дальше трек играет офлайн. Прогрев стартовых и
        // купленных треков — platform/music.ts:warmTracks.
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'slovo2-audio',
              expiration: { maxEntries: 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    reportCompressedSize: false,
        /**
         * Кроме приложения собираем витрины для дизайн-ревью: варианты
         * карточки слова и концепцию магазина. Они открываются по обычной
         * ссылке в той же сборке, потому что параметры адреса в
         * предпросмотре песочницы до приложения не доходят:
         *   /docs/word-cards/cards-demo.html
         *   /docs/shop-concept/shop-demo.html
         */
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          cardsDemo: fileURLToPath(new URL('./docs/word-cards/cards-demo.html', import.meta.url)),
          shopDemo: fileURLToPath(new URL('./docs/shop-concept/shop-demo.html', import.meta.url)),
        },
      },
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
