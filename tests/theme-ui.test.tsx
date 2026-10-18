// Тема на Android: проверяем не только смену CSS после запуска, но и самый
// первый байт HTML. В 0.14.4 скрипт менял meta на «only light», однако исходный
// тег оставался «light dark» — браузер мог включить Auto Dark до скрипта.
// Samsung Internet с принудительным затемнением может игнорировать даже
// исправленный тег: отрицательная проверка canvas НЕ доказывает обратного.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { check } from './ui-helpers';
import {
  applyTheme,
  applyThemeStyle,
  browserDarkModeHelp,
  browserName,
  detectForcedRepaint,
  readThemeMirror,
  readThemeStyleMirror,
  repaintAssessment,
  resolveTheme,
  systemPrefersDark,
  THEME_MIRROR_KEY,
  THEME_STYLE_MIRROR_KEY,
  writeThemeMirror,
  writeThemeStyleMirror,
} from '../src/platform/theme';

function schemeMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="color-scheme"]');
}

/** Читаем настоящий HTML, а не копию тега в тестовом DOM. */
function readIndexHtml(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i += 1) {
    const candidate = path.join(dir, 'index.html');
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
    dir = path.dirname(dir);
  }
  throw new Error(`Не найден index.html рядом с ${process.cwd()}`);
}

function readBootScript(html: string): string {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const boot = blocks.find((code) => code.includes(THEME_MIRROR_KEY));
  if (!boot) throw new Error('В index.html нет скрипта темы до первого кадра');
  return boot;
}

/** Состояние HTML до выполнения какого-либо скрипта. */
function resetDocument(): void {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-style');
  document.documentElement.style.colorScheme = '';
  schemeMeta()?.setAttribute('content', 'only light');
}

export async function runThemeChecks(): Promise<void> {
  console.log('\n── Тема: первый байт HTML, смена палитры и Android ──');

  const originalMatchMedia = window.matchMedia;
  const originalMirror = readThemeMirror();
  const originalStyleMirror = readThemeStyleMirror();
  const originalTheme = document.documentElement.dataset.theme;
  const originalThemeStyle = document.documentElement.dataset.themeStyle;
  const originalScheme = document.documentElement.style.colorScheme;
  const originalMeta = schemeMeta()?.getAttribute('content') ?? null;
  const originalThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;

  // Существующие проверки цветовой схемы относятся к классическому виду.
  applyThemeStyle('classic');

  // ── 1. HTML из сборки: тег должен быть безопасным уже при парсинге ──────
  const html = readIndexHtml();
  const staticMeta = /<meta\s+name="color-scheme"\s+content="([^"]+)"\s*\/>/.exec(html);
  check(
    'исходный HTML объявляет only light ещё до скрипта (не light dark)',
    staticMeta?.[1] === 'only light' && staticMeta.index < html.indexOf('<script>'),
    staticMeta?.[0] ?? 'тег не найден',
  );
  check('в HTML ровно один тег color-scheme', (html.match(/<meta\s+name="color-scheme"/g) ?? []).length === 1);

  // ── 2. Настройка после загрузки и при переключении ──────────────────────
  applyTheme('light');
  check(
    'светлая тема: атрибут и CSS color-scheme',
    document.documentElement.dataset.theme === 'light' &&
      document.documentElement.style.colorScheme === 'only light',
    document.documentElement.style.colorScheme,
  );
  check('светлая тема: метатег only light', schemeMeta()?.getAttribute('content') === 'only light');
  check(
    'светлая тема: цвет панели',
    document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#7C5CFF',
  );

  applyTheme('dark');
  check(
    'тёмная тема: атрибут и CSS color-scheme',
    document.documentElement.dataset.theme === 'dark' &&
      document.documentElement.style.colorScheme === 'only dark',
    document.documentElement.style.colorScheme,
  );
  check('тёмная тема: метатег dark (only dark в HTML недопустим)', schemeMeta()?.getAttribute('content') === 'dark');
  check(
    'тёмная тема: цвет панели',
    document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#171426',
  );
  applyTheme('light');
  check('после возврата к светлой метатег снова only light', schemeMeta()?.getAttribute('content') === 'only light');

  // ── 3. «Как в телефоне» следует системной теме ──────────────────────────
  window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: true })) as typeof window.matchMedia;
  check('при тёмной системе auto выбирает тёмную палитру', resolveTheme('auto') === 'dark');
  check('при тёмной системе auto объявляет метатег dark', applyTheme('auto') === 'dark' && schemeMeta()?.content === 'dark');
  window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: false })) as typeof window.matchMedia;
  check('при светлой системе auto выбирает светлую палитру', resolveTheme('auto') === 'light');
  check('явная светлая не зависит от системной', resolveTheme('light', true) === 'light');
  check('явная тёмная не зависит от системной', resolveTheme('dark', false) === 'dark');
  window.matchMedia = originalMatchMedia;
  check('системная тема читается без ошибок', typeof systemPrefersDark() === 'boolean');

  writeThemeMirror('light');
  check('зеркало записывает светлую тему', readThemeMirror() === 'light');
  writeThemeMirror('dark');
  check('зеркало перезаписывается', readThemeMirror() === 'dark');

  // ── 4. Визуальный стиль независим от цветовой схемы ─────────────────────
  applyTheme('light');
  check(
    'неоновый стиль ставит атрибут и цвет светлой панели',
    applyThemeStyle('neon') === 'neon' &&
      document.documentElement.dataset.themeStyle === 'neon' &&
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#f0f4ff',
  );
  applyTheme('dark');
  check(
    'неоновый стиль сохраняет свой тёмный цвет панели при смене схемы',
    document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#0d0d1a',
  );
  applyThemeStyle('classic');
  check(
    'возврат к классическому стилю восстанавливает исходный цвет панели',
    document.documentElement.dataset.themeStyle === 'classic' &&
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#171426',
  );
  applyThemeStyle('space');
  applyTheme('light');
  check(
    'новый стиль «Космос» применяется к атрибуту и цвету панели',
    document.documentElement.dataset.themeStyle === 'space' &&
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#f2efff',
  );
  writeThemeStyleMirror('forest');
  check('зеркало принимает новые стили', readThemeStyleMirror() === 'forest');
  writeThemeStyleMirror('classic');
  check('зеркало стиля перезаписывается', readThemeStyleMirror() === 'classic');
  window.localStorage.setItem(THEME_STYLE_MIRROR_KEY, 'future-style');
  check('неизвестный стиль в зеркале безопасно игнорируется', readThemeStyleMirror() === null);

  // ── 5. Выполняем именно скрипт из index.html ────────────────────────────
  const boot = readBootScript(html);
  const runBoot = (mirror: string | null, prefersDark: boolean, styleMirror: string | null = null) => {
    if (mirror === null) window.localStorage.removeItem(THEME_MIRROR_KEY);
    else window.localStorage.setItem(THEME_MIRROR_KEY, mirror);
    if (styleMirror === null) window.localStorage.removeItem(THEME_STYLE_MIRROR_KEY);
    else window.localStorage.setItem(THEME_STYLE_MIRROR_KEY, styleMirror);
    window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: prefersDark })) as typeof window.matchMedia;
    resetDocument();
    (window as unknown as { eval: (code: string) => void }).eval(boot);
    window.matchMedia = originalMatchMedia;
  };

  resetDocument();
  check('без JavaScript страница начинается со светлой схемы', schemeMeta()?.content === 'only light');
  runBoot('light', true);
  check(
    'явная светлая до первого кадра остаётся светлой даже при тёмной системе',
    document.documentElement.dataset.theme === 'light' &&
      document.documentElement.dataset.themeStyle === 'classic' &&
      document.documentElement.style.colorScheme === 'only light' && schemeMeta()?.content === 'only light',
  );
  runBoot('dark', false);
  check(
    'явная тёмная до первого кадра: CSS only dark, HTML dark',
    document.documentElement.dataset.theme === 'dark' &&
      document.documentElement.dataset.themeStyle === 'classic' &&
      document.documentElement.style.colorScheme === 'only dark' && schemeMeta()?.content === 'dark' &&
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#171426',
  );
  runBoot('dark', false, 'neon');
  check(
    'зеркало стиля включает неон до первого кадра и меняет цвет панели',
    document.documentElement.dataset.themeStyle === 'neon' &&
      document.documentElement.dataset.theme === 'dark' &&
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#0d0d1a',
  );
  runBoot('light', true, 'neon');
  check(
    'неоновый стиль сохраняется и в светлой цветовой схеме',
    document.documentElement.dataset.themeStyle === 'neon' &&
      document.documentElement.dataset.theme === 'light' &&
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#f0f4ff',
  );
  runBoot('dark', false, 'space');
  check(
    'зеркало темы «Космос» работает до первого кадра',
    document.documentElement.dataset.themeStyle === 'space' &&
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content') === '#101027',
  );
  runBoot('auto', true);
  check('сохранённое auto следует тёмной системе', document.documentElement.dataset.theme === 'dark' && schemeMeta()?.content === 'dark');
  runBoot(null, true);
  check('первый запуск следует тёмной системе', document.documentElement.dataset.theme === 'dark' && schemeMeta()?.content === 'dark');
  runBoot(null, false);
  check(
    'первый запуск при светлой системе остаётся светлым и классическим',
    document.documentElement.dataset.theme === 'light' &&
      document.documentElement.dataset.themeStyle === 'classic' && schemeMeta()?.content === 'only light',
  );

  const storagePrototype = Object.getPrototypeOf(window.localStorage) as Storage;
  const originalGetItem = storagePrototype.getItem;
  try {
    storagePrototype.getItem = () => { throw new Error('Хранилище недоступно'); };
    window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: true })) as typeof window.matchMedia;
    resetDocument();
    (window as unknown as { eval: (code: string) => void }).eval(boot);
    check(
      'без доступа к localStorage скрипт всё равно выбирает системную тему',
      document.documentElement.dataset.theme === 'dark' && schemeMeta()?.content === 'dark',
    );
  } finally {
    storagePrototype.getItem = originalGetItem;
    window.matchMedia = originalMatchMedia;
  }

  // ── 5. Отрицательная проверка не должна скрывать Samsung Force Dark ─────
  check('в jsdom Auto Dark не обнаружен', detectForcedRepaint() === false);
  check(
    'для Samsung отрицательный результат НЕ означает «нет перекраски»',
    repaintAssessment('Samsung Internet', false).includes('не определяется'),
  );
  check('положительный результат сообщается явно', repaintAssessment('Chrome', true).includes('обнаружена'));
  check(
    'инструкция Samsung: Force Dark выключить, а Use website dark theme ВКЛЮЧИТЬ',
    browserDarkModeHelp('Samsung Internet').includes('выключите «Принудительный') &&
      browserDarkModeHelp('Samsung Internet').includes('Labs') &&
      browserDarkModeHelp('Samsung Internet').includes('нужно включить'),
  );
  check(
    'инструкция Samsung: после смены темы телефона проверить Force Dark снова',
    browserDarkModeHelp('Samsung Internet').includes('при обычной теме телефона') &&
      browserDarkModeHelp('Samsung Internet').includes('снова включиться'),
  );
  check('Samsung определяется по user-agent', browserName('Mozilla/5.0 (Linux; Android 13) SamsungBrowser/23.0 Chrome/115 Mobile Safari/537.36') === 'Samsung Internet');
  check('Chrome не путается с Samsung', browserName('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36') === 'Chrome');

  // ── Восстанавливаем цветовую схему и стиль для остальных UI-проверок ────
  if (originalMirror) writeThemeMirror(originalMirror);
  else window.localStorage.removeItem(THEME_MIRROR_KEY);
  if (originalStyleMirror) writeThemeStyleMirror(originalStyleMirror);
  else window.localStorage.removeItem(THEME_STYLE_MIRROR_KEY);
  if (originalTheme) document.documentElement.dataset.theme = originalTheme;
  else document.documentElement.removeAttribute('data-theme');
  if (originalThemeStyle) document.documentElement.dataset.themeStyle = originalThemeStyle;
  else document.documentElement.removeAttribute('data-theme-style');
  document.documentElement.style.colorScheme = originalScheme;
  if (originalMeta) schemeMeta()?.setAttribute('content', originalMeta);
  if (originalThemeColor) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', originalThemeColor);
  window.matchMedia = originalMatchMedia;
}
