// Тема на Android: проверяем не только смену CSS после запуска, но и самый
// первый байт HTML. В 0.14.4 скрипт менял meta на «only light», однако исходный
// тег оставался «light dark» — браузер мог включить Auto Dark до скрипта.
// Samsung Internet с принудительным затемнением может игнорировать даже
// исправленный тег: отрицательная проверка canvas НЕ доказывает обратного.
//
// С 0.16.0 оформление — два выбора: яркость (auto/light/dark) и тема-стиль
// (classic/neon/space/sea). Оба дублируются в localStorage и применяются
// инлайн-скриптом index.html до первого кадра.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { check } from './ui-helpers';
import {
  applyTheme,
  browserDarkModeHelp,
  browserName,
  DEFAULT_PALETTE,
  detectForcedRepaint,
  normalizePalette,
  PALETTE_IDS,
  PALETTE_MIRROR_KEY,
  PALETTES,
  readPaletteMirror,
  readThemeMirror,
  repaintAssessment,
  resolveTheme,
  systemPrefersDark,
  THEME_MIRROR_KEY,
  themeColorFor,
  writePaletteMirror,
  writeThemeMirror,
} from '../src/platform/theme';

function schemeMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="color-scheme"]');
}

function themeColorMeta(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
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
  document.documentElement.removeAttribute('data-palette');
  document.documentElement.style.colorScheme = '';
  schemeMeta()?.setAttribute('content', 'only light');
}

export async function runThemeChecks(): Promise<void> {
  console.log('\n── Тема: первый байт HTML, смена палитры и Android ──');

  const originalMatchMedia = window.matchMedia;
  const originalMirror = readThemeMirror();
  const originalPaletteMirror = readPaletteMirror();
  const originalTheme = document.documentElement.dataset.theme;
  const originalPalette = document.documentElement.dataset.palette;
  const originalScheme = document.documentElement.style.colorScheme;
  const originalMeta = schemeMeta()?.getAttribute('content') ?? null;
  const originalThemeColor = themeColorMeta();

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
    'светлая тема: цвет панели классической темы',
    themeColorMeta() === '#7C5CFF',
    themeColorMeta() ?? 'нет метатега',
  );
  check('без явной темы остаётся классическая', document.documentElement.dataset.palette === 'classic');

  applyTheme('dark');
  check(
    'тёмная тема: атрибут и CSS color-scheme',
    document.documentElement.dataset.theme === 'dark' &&
      document.documentElement.style.colorScheme === 'only dark',
    document.documentElement.style.colorScheme,
  );
  check('тёмная тема: метатег dark (only dark в HTML недопустим)', schemeMeta()?.getAttribute('content') === 'dark');
  check(
    'тёмная тема: цвет панели классической темы',
    themeColorMeta() === '#171426',
    themeColorMeta() ?? 'нет метатега',
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

  // ── 3а. Темы-стили: выбор, зеркало, цвет панели ─────────────────────────
  check(
    'в списке четыре темы, классическая — первая',
    PALETTE_IDS.length === 4 && PALETTE_IDS[0] === 'classic' && PALETTE_IDS.includes('neon'),
    PALETTE_IDS.join(', '),
  );
  for (const id of PALETTE_IDS) {
    check(`у темы «${PALETTES[id].title}» есть подпись и цвета панели`,
      PALETTES[id].hint.length > 10 &&
        /^#[0-9a-fA-F]{6}$/.test(PALETTES[id].themeColor.light) &&
        /^#[0-9a-fA-F]{6}$/.test(PALETTES[id].themeColor.dark));
  }
  check('грязное значение темы становится классической', normalizePalette('nope') === DEFAULT_PALETTE && normalizePalette(undefined) === DEFAULT_PALETTE);
  check('корректное значение темы проходит как есть', normalizePalette('neon') === 'neon');

  writePaletteMirror('neon');
  check('зеркало записывает тему-стиль', readPaletteMirror() === 'neon');
  writePaletteMirror('sea');
  check('зеркало темы-стиля перезаписывается', readPaletteMirror() === 'sea');
  window.localStorage.setItem(PALETTE_MIRROR_KEY, 'bogus');
  check('мусор в зеркале читается как классическая', readPaletteMirror() === 'classic');

  applyTheme('dark', 'neon');
  check(
    'неоновая тёмная: data-palette и цвет панели',
    document.documentElement.dataset.palette === 'neon' && themeColorMeta() === '#0d0d1a',
    `${document.documentElement.dataset.palette} / ${themeColorMeta()}`,
  );
  applyTheme('light', 'neon');
  check(
    'неоновая светлая: data-palette и цвет панели',
    document.documentElement.dataset.palette === 'neon' && themeColorMeta() === '#d600d6',
    `${document.documentElement.dataset.palette} / ${themeColorMeta()}`,
  );
  applyTheme('dark', 'space');
  check('космос тёмный: цвет панели', document.documentElement.dataset.palette === 'space' && themeColorMeta() === '#0b1026');
  applyTheme('light', 'sea');
  check('море светлое: цвет панели', document.documentElement.dataset.palette === 'sea' && themeColorMeta() === '#0d9488');
  applyTheme('dark', 'sun' as never);
  check('неизвестная тема в applyTheme откатывается к классической', document.documentElement.dataset.palette === 'classic');
  check('themeColorFor согласован с PALETTES', themeColorFor('neon', 'light') === PALETTES.neon.themeColor.light && themeColorFor('sea', 'dark') === PALETTES.sea.themeColor.dark);

  // ── 4. Выполняем именно скрипт из index.html ────────────────────────────
  const boot = readBootScript(html);
  const runBoot = (mirror: string | null, prefersDark: boolean, paletteMirror: string | null = null) => {
    if (mirror === null) window.localStorage.removeItem(THEME_MIRROR_KEY);
    else window.localStorage.setItem(THEME_MIRROR_KEY, mirror);
    if (paletteMirror === null) window.localStorage.removeItem(PALETTE_MIRROR_KEY);
    else window.localStorage.setItem(PALETTE_MIRROR_KEY, paletteMirror);
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
      document.documentElement.style.colorScheme === 'only light' && schemeMeta()?.content === 'only light',
  );
  check('скрипт темы ставит и data-palette', document.documentElement.dataset.palette === 'classic');
  runBoot('dark', false);
  check(
    'явная тёмная до первого кадра: CSS only dark, HTML dark',
    document.documentElement.dataset.theme === 'dark' &&
      document.documentElement.style.colorScheme === 'only dark' && schemeMeta()?.content === 'dark' &&
      themeColorMeta() === '#171426',
  );
  runBoot('auto', true);
  check('сохранённое auto следует тёмной системе', document.documentElement.dataset.theme === 'dark' && schemeMeta()?.content === 'dark');
  runBoot(null, true);
  check('первый запуск следует тёмной системе', document.documentElement.dataset.theme === 'dark' && schemeMeta()?.content === 'dark');
  runBoot(null, false);
  check('первый запуск при светлой системе остаётся светлым', document.documentElement.dataset.theme === 'light' && schemeMeta()?.content === 'only light');

  runBoot('dark', false, 'neon');
  check(
    'до первого кадра применяется сохранённая тема-стиль (неон, тёмная)',
    document.documentElement.dataset.palette === 'neon' && themeColorMeta() === '#0d0d1a',
    `${document.documentElement.dataset.palette} / ${themeColorMeta()}`,
  );
  runBoot('light', false, 'sea');
  check(
    'до первого кадра: море в светлой яркости',
    document.documentElement.dataset.palette === 'sea' && themeColorMeta() === '#0d9488',
    `${document.documentElement.dataset.palette} / ${themeColorMeta()}`,
  );
  runBoot('light', false, 'sun');
  check(
    'мусор в зеркале темы-стиля не ломает первый кадр',
    document.documentElement.dataset.palette === 'classic' && themeColorMeta() === '#7C5CFF',
    `${document.documentElement.dataset.palette} / ${themeColorMeta()}`,
  );

  const storagePrototype = Object.getPrototypeOf(window.localStorage) as Storage;
  const originalGetItem = storagePrototype.getItem;
  try {
    storagePrototype.getItem = () => { throw new Error('Хранилище недоступно'); };
    window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: true })) as typeof window.matchMedia;
    resetDocument();
    (window as unknown as { eval: (code: string) => void }).eval(boot);
    check(
      'без доступа к localStorage скрипт всё равно выбирает системную тему и классическую палитру',
      document.documentElement.dataset.theme === 'dark' && schemeMeta()?.content === 'dark' &&
        document.documentElement.dataset.palette === 'classic',
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

  // ── Восстанавливаем тему для остальных UI-проверок ──────────────────────
  if (originalMirror) writeThemeMirror(originalMirror);
  else window.localStorage.removeItem(THEME_MIRROR_KEY);
  if (originalPaletteMirror) writePaletteMirror(originalPaletteMirror);
  else window.localStorage.removeItem(PALETTE_MIRROR_KEY);
  if (originalTheme) document.documentElement.dataset.theme = originalTheme;
  else document.documentElement.removeAttribute('data-theme');
  if (originalPalette) document.documentElement.dataset.palette = originalPalette;
  else document.documentElement.removeAttribute('data-palette');
  document.documentElement.style.colorScheme = originalScheme;
  if (originalMeta) schemeMeta()?.setAttribute('content', originalMeta);
  if (originalThemeColor) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', originalThemeColor);
  window.matchMedia = originalMatchMedia;
}
