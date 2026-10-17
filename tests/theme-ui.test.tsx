// Тема оформления: как приложение объявляет палитру браузеру.
//
// Проверяем три вещи, из-за которых светлая тема выглядела тёмно-серой на
// Android-телефоне:
//  1) схема страницы объявляется и в атрибуте документа, и в теге
//     <meta name="color-scheme"> (браузер читает именно тег);
//  2) то же самое происходит ДО первого кадра — инлайн-скрипт в index.html
//     ставит data-theme и схему по зеркалу выбора темы в localStorage;
//  3) приложение умеет отличить «тёмная тема выбрана в приложении» от
//     «страницу перекрашивает браузер» — и не путает их.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { check } from './ui-helpers';
import {
  applyTheme,
  browserName,
  detectForcedRepaint,
  readThemeMirror,
  resolveTheme,
  systemPrefersDark,
  THEME_MIRROR_KEY,
  writeThemeMirror,
} from '../src/platform/theme';

/** Тег со схемой — такой же, как в настоящем index.html. */
function schemeMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="color-scheme"]');
}

/** Считывает инлайн-скрипт из настоящего index.html. */
function readBootScript(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i += 1) {
    const candidate = path.join(dir, 'index.html');
    if (existsSync(candidate)) {
      const html = readFileSync(candidate, 'utf8');
      const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      const boot = blocks.find((code) => code.includes(THEME_MIRROR_KEY));
      if (!boot) throw new Error('В index.html нет инлайн-скрипта, который ставит тему до первого кадра');
      return boot;
    }
    dir = path.dirname(dir);
  }
  throw new Error(`Не найден index.html рядом с ${process.cwd()}`);
}

/** Приводит документ в исходное состояние: тема не задана, схема статичная. */
function resetDocument(): void {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  schemeMeta()?.setAttribute('content', 'light dark');
}

export async function runThemeChecks(): Promise<void> {
  console.log('\n── Тема: схема страницы и первый кадр ──');

  const originalMatchMedia = window.matchMedia;
  const originalMirror = readThemeMirror();
  const originalTheme = document.documentElement.dataset.theme;
  const originalScheme = document.documentElement.style.colorScheme;
  const originalMeta = schemeMeta()?.getAttribute('content') ?? null;

  // ── 1. Схема объявляется и в документе, и в теге ────────────────────────
  applyTheme('light');
  check(
    'светлая тема: атрибут документа и инлайн-стиль',
    document.documentElement.dataset.theme === 'light' &&
      document.documentElement.style.colorScheme === 'only light',
    document.documentElement.style.colorScheme,
  );
  check(
    'светлая тема: тег <meta name="color-scheme">',
    schemeMeta()?.getAttribute('content') === 'only light',
    schemeMeta()?.getAttribute('content') ?? 'нет тега',
  );
  check(
    'светлая тема: цвет системной панели — фирменный',
    document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#7C5CFF',
    document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? 'нет тега',
  );

  applyTheme('dark');
  check(
    'тёмная тема: атрибут документа и инлайн-стиль',
    document.documentElement.dataset.theme === 'dark' &&
      document.documentElement.style.colorScheme === 'only dark',
    document.documentElement.style.colorScheme,
  );
  check(
    'тёмная тема: тег <meta name="color-scheme">',
    schemeMeta()?.getAttribute('content') === 'only dark',
    schemeMeta()?.getAttribute('content') ?? 'нет тега',
  );

  // ── 2. «Как в телефоне» следует за системной темой ───────────────────────
  window.matchMedia = ((query: string) => ({
    ...originalMatchMedia(query),
    matches: true,
  })) as typeof window.matchMedia;
  check('при тёмной системной теме выбирается тёмная палитра', resolveTheme('auto') === 'dark', resolveTheme('auto'));
  check('при тёмной системной теме схема объявлена как тёмная', applyTheme('auto') === 'dark', document.documentElement.style.colorScheme);

  window.matchMedia = ((query: string) => ({
    ...originalMatchMedia(query),
    matches: false,
  })) as typeof window.matchMedia;
  check('при светлой системной теме выбирается светлая палитра', resolveTheme('auto') === 'light', resolveTheme('auto'));
  check('выбор «светлая» не зависит от системной темы', resolveTheme('light', true) === 'light', resolveTheme('light', true));
  check('выбор «тёмная» не зависит от системной темы', resolveTheme('dark', false) === 'dark', resolveTheme('dark', false));

  window.matchMedia = originalMatchMedia;
  check('системная тема читается без ошибок', typeof systemPrefersDark() === 'boolean', String(systemPrefersDark()));

  // ── 3. Зеркало выбора темы ───────────────────────────────────────────────
  writeThemeMirror('light');
  check('выбор темы записывается в зеркало', readThemeMirror() === 'light', String(readThemeMirror()));
  writeThemeMirror('dark');
  check('зеркало перезаписывается при смене выбора', readThemeMirror() === 'dark', String(readThemeMirror()));

  // ── 4. Первый кадр: инлайн-скрипт из настоящего index.html ──────────────
  const boot = readBootScript();
  const runBoot = (mirror: string | null, prefersDark: boolean) => {
    if (mirror === null) window.localStorage.removeItem(THEME_MIRROR_KEY);
    else window.localStorage.setItem(THEME_MIRROR_KEY, mirror);
    window.matchMedia = ((query: string) => ({
      ...originalMatchMedia(query),
      matches: prefersDark,
    })) as typeof window.matchMedia;
    resetDocument();
    (window as unknown as { eval: (code: string) => void }).eval(boot);
    window.matchMedia = originalMatchMedia;
  };

  runBoot('light', false);
  check(
    'до первого кадра выбранная светлая тема уже объявлена',
    document.documentElement.dataset.theme === 'light' &&
      document.documentElement.style.colorScheme === 'only light' &&
      schemeMeta()?.getAttribute('content') === 'only light',
    `${document.documentElement.dataset.theme ?? '—'} / ${document.documentElement.style.colorScheme} / ${schemeMeta()?.getAttribute('content') ?? '—'}`,
  );

  runBoot('dark', false);
  check(
    'до первого кадра выбранная тёмная тема уже объявлена',
    document.documentElement.dataset.theme === 'dark' &&
      document.documentElement.style.colorScheme === 'only dark' &&
      schemeMeta()?.getAttribute('content') === 'only dark',
    `${document.documentElement.dataset.theme ?? '—'} / ${document.documentElement.style.colorScheme} / ${schemeMeta()?.getAttribute('content') ?? '—'}`,
  );

  runBoot(null, true);
  check(
    'без сохранённого выбора первая палитра следует за системной темой',
    document.documentElement.dataset.theme === 'dark' &&
      schemeMeta()?.getAttribute('content') === 'only dark',
    `${document.documentElement.dataset.theme ?? '—'} / ${schemeMeta()?.getAttribute('content') ?? '—'}`,
  );

  runBoot(null, false);
  check(
    'без сохранённого выбора при светлой системе палитра светлая',
    document.documentElement.dataset.theme === 'light' &&
      schemeMeta()?.getAttribute('content') === 'only light',
    `${document.documentElement.dataset.theme ?? '—'} / ${schemeMeta()?.getAttribute('content') ?? '—'}`,
  );

  // ── 5. Отличаем перекраску браузера от тёмной темы приложения ──────────
  check('в обычном браузере перекраски не видно', detectForcedRepaint() === false, 'элемент с системным цветом canvas');
  check('браузер определяется по строке user-agent', browserName('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115 Mobile Safari/537.36') === 'Samsung Internet', 'Samsung Internet');
  check('Chrome не путается с Samsung Internet', browserName('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36') === 'Chrome', 'Chrome');

  // ── Возвращаем как было ─────────────────────────────────────────────────
  if (originalMirror) writeThemeMirror(originalMirror);
  else window.localStorage.removeItem(THEME_MIRROR_KEY);
  if (originalTheme) document.documentElement.dataset.theme = originalTheme;
  else document.documentElement.removeAttribute('data-theme');
  if (originalScheme) document.documentElement.style.colorScheme = originalScheme;
  else document.documentElement.style.colorScheme = '';
  if (originalMeta) schemeMeta()?.setAttribute('content', originalMeta);
  window.matchMedia = originalMatchMedia;
}
