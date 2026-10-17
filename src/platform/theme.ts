/**
 * Тема оформления: как выбрана палитра и как объявить её браузеру.
 *
 * Отдельный модуль нужен по двум причинам.
 *
 * 1. **Браузер читает схему при загрузке страницы, а не когда приложение
 *    перерисует экран.** По документации Chrome (developer.chrome.com/blog/
 *    auto-dark-theme/) отказ от принудительного затемнения делает тег
 *    `<meta name="color-scheme">` — и он действует именно на этапе загрузки:
 *    «мета-тег не даёт Auto Dark Theme примениться вовсе, поэтому не бывает
 *    вспышки потемневшего содержимого». Статичный тег `light dark` из index.html
 *    означал «я умею обе схемы», и браузер успевал включить собственное
 *    перекрашивание раньше, чем приложение переписывало тег (это делал React
 *    уже после загрузки бандла). Поэтому схему нужно объявлять ДО первого
 *    кадра — инлайн-скриптом в index.html, который читает зеркало выбора темы.
 *
 * 2. **Нужен честный признак того, что страницу перекрашивает браузер.**
 *    Приложение умеет только нарисовать свою палитру: если экран серый, значит
 *    поверх нашей вёрстки браузер наложил собственную тёмную тему. Сказать
 *    об этом родителю и показать, что делать, — единственное, что мы можем
 *    сделать в этом случае: отключить принудительное затемнение на уровне
 *    страницы Samsung Internet не даёт (см. docs/RELEASE-0.14.4.md).
 */

/** Выбор в настройках: «как в телефоне», «светлая» или «тёмная». */
export type ThemeSetting = 'auto' | 'light' | 'dark';
/** Что в итоге нарисовано на экране. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Ключ зеркала темы в localStorage.
 *
 * Основное хранилище настроек — IndexedDB, и оно читается асинхронно: к
 * первому кадру ответ ещё не пришёл. Но объявить схему нужно до первой
 * отрисовки, поэтому выбор темы дублируется в localStorage — он читается
 * синхронно, и инлайн-скрипт в index.html успевает поставить `data-theme` и
 * схему до того, как браузер нарисует первый кадр.
 */
export const THEME_MIRROR_KEY = 'slovo2-theme';

/** Цвет системной панели приложения в тёмной теме. */
export const DARK_THEME_COLOR = '#171426';
/** Цвет системной панели приложения в светлой теме. */
export const LIGHT_THEME_COLOR = '#7C5CFF';

/** Тёмная ли системная тема телефона. */
export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Какая палитра на экране при таком выборе в настройках. */
export function resolveTheme(theme: ThemeSetting, prefersDark: boolean = systemPrefersDark()): ResolvedTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

/** Прочитать зеркало выбора темы (null — зеркала ещё нет). */
export function readThemeMirror(): ThemeSetting | null {
  try {
    const raw = window.localStorage.getItem(THEME_MIRROR_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : null;
  } catch {
    // Приватный режим или запрет хранилища: тему применит приложение позже.
    return null;
  }
}

/** Записать зеркало выбора темы, чтобы следующий запуск начался сразу с него. */
export function writeThemeMirror(theme: ThemeSetting): void {
  try {
    window.localStorage.setItem(THEME_MIRROR_KEY, theme);
  } catch {
    // Без зеркала приложение всё равно применит тему — просто чуть позже.
  }
}

/**
 * Объявить тему браузеру: атрибут `data-theme` (по нему выбираются токены
 * палитры), схема страницы и цвет системной панели.
 *
 * Схема объявляется со словом `only`: это не «я умею обе», а «другой темы
 * для этой страницы нет» — именно эта формулировка выключает собственное
 * перекрашивание в браузерах, которые его умеют.
 */
export function applyTheme(theme: ThemeSetting, prefersDark?: boolean): ResolvedTheme {
  const resolved = resolveTheme(theme, prefersDark);
  const scheme = resolved === 'dark' ? 'only dark' : 'only light';
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = scheme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', scheme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  return resolved;
}

/**
 * Перекрашивает ли браузер страницу поверх нашей палитры.
 *
 * Проверка из документации Chrome: подложка из системного цвета `canvas` при
 * `color-scheme: light` — белый цвет. Если вычисленный фон не белый, значит
 * браузер подмешал свою тёмную тему (Chrome Auto Dark Mode, принудительная
 * тёмная тема Samsung Internet).
 *
 * Если браузер не умеет считать `canvas` (или это не браузер вовсе), вернём
 * «не перекрашивает»: лишняя плашка с советом хуже, чем её отсутствие.
 */
export function detectForcedRepaint(): boolean {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return false;
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.width = '1px';
  probe.style.height = '1px';
  probe.style.overflow = 'hidden';
  probe.style.backgroundColor = 'canvas';
  probe.style.colorScheme = 'light';
  document.body.appendChild(probe);
  let painted = '';
  try {
    painted = getComputedStyle(probe).backgroundColor.trim().toLowerCase();
  } catch {
    painted = '';
  } finally {
    probe.remove();
  }
  if (!painted.startsWith('rgb')) return false;
  return painted !== 'rgb(255, 255, 255)';
}

/** Имя браузера по строке user-agent — нужно, чтобы дать точную инструкцию. */
export function browserName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('samsungbrowser')) return 'Samsung Internet';
  if (ua.includes('yabrowser')) return 'Яндекс.Браузер';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('crios')) return 'Chrome (iOS)';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('chrome/')) return 'Chrome';
  if (ua.includes('safari/')) return 'Safari';
  return 'неизвестный браузер';
}
