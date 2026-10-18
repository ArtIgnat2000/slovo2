/**
 * Тема оформления и объявление схемы браузеру.
 *
 * Статичный <meta name="color-scheme" content="only light"> в index.html
 * защищает первый кадр от Chrome Auto Dark ещё ДО выполнения скриптов.
 * Инлайн-скрипт затем читает зеркала цветовой схемы и стиля; applyTheme и
 * applyThemeStyle поддерживают их после загрузки IndexedDB и при переключении.
 *
 * Это не способ отключить принудительное затемнение Samsung Internet:
 * некоторые его версии перекрашивают готовые пиксели, игнорируя color-scheme.
 * Проверка Chrome Auto Dark ниже тоже не видит такую перекраску. Поэтому
 * диагностике нельзя говорить «браузер не перекрашивает» при отрицательном
 * результате проверки (см. docs/RELEASE-0.14.5.md).
 */

import { isThemeStyle, THEME_STYLES, type ThemeStyle } from '../engine/theme-styles';
export type { ThemeStyle } from '../engine/theme-styles';

/** Выбор цветовой схемы в настройках: «как в телефоне», «светлая» или «тёмная». */
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
/** Зеркало визуального стиля для оформления первого кадра до загрузки IndexedDB. */
export const THEME_STYLE_MIRROR_KEY = 'slovo2-theme-style';

/** Цвет системной панели приложения в классической тёмной теме. */
export const DARK_THEME_COLOR = '#171426';
/** Цвет системной панели приложения в классической светлой теме. */
export const LIGHT_THEME_COLOR = '#7C5CFF';
/** Цвет системной панели в неоновой тёмной теме. */
export const NEON_DARK_THEME_COLOR = '#0d0d1a';
/** Цвет системной панели в неоновой светлой теме. */
export const NEON_LIGHT_THEME_COLOR = '#f0f4ff';

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

/** Прочитать зеркало визуального стиля (null — выбор ещё не записан). */
export function readThemeStyleMirror(): ThemeStyle | null {
  try {
    const raw = window.localStorage.getItem(THEME_STYLE_MIRROR_KEY);
    return isThemeStyle(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Записать стиль, чтобы он был виден с первого кадра при следующем запуске. */
export function writeThemeStyleMirror(style: ThemeStyle): void {
  try {
    window.localStorage.setItem(THEME_STYLE_MIRROR_KEY, style);
  } catch {
    // Без зеркала класс приложения применит стиль после загрузки IndexedDB.
  }
}

function currentThemeStyle(): ThemeStyle {
  const style = document.documentElement.dataset.themeStyle;
  return isThemeStyle(style) ? style : 'classic';
}

function updateThemeColor(theme: ResolvedTheme, style: ThemeStyle): void {
  const option = THEME_STYLES.find((item) => item.id === style) ?? THEME_STYLES[0];
  const color = theme === 'dark' ? option.panelColor.dark : option.panelColor.light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

/** Применить визуальный стиль, не меняя выбранную светлую/тёмную схему. */
export function applyThemeStyle(style: ThemeStyle): ThemeStyle {
  const resolved = isThemeStyle(style) ? style : 'classic';
  const root = document.documentElement;
  root.dataset.themeStyle = resolved;
  updateThemeColor(root.dataset.theme === 'dark' ? 'dark' : 'light', resolved);
  return resolved;
}

/**
 * Выбрать токены палитры, схему страницы и цвет системной панели.
 *
 * `only light` в HTML и CSS отключает Chrome Auto Dark. В тёмной теме CSS
 * использует `only dark`, но в HTML-метатеге допустимо `dark`, не `only dark`.
 * Samsung Internet может проигнорировать оба объявления при включённой
 * принудительной тёмной теме веб-контента.
 */
export function applyTheme(theme: ThemeSetting, prefersDark?: boolean): ResolvedTheme {
  const resolved = resolveTheme(theme, prefersDark);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved === 'dark' ? 'only dark' : 'only light';
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved === 'dark' ? 'dark' : 'only light');
  updateThemeColor(resolved, currentThemeStyle());
  return resolved;
}

/**
 * Признак Chrome Auto Dark: системный цвет `canvas` при `color-scheme: light`
 * должен быть белым (метод из документации Chrome).
 *
 * Отрицательный результат НЕ доказывает, что экран не перекрашен: Samsung
 * Internet может изменять цвета после расчёта CSS, не меняя getComputedStyle.
 * Без поддержки canvas/DOM возвращаем false (= «не обнаружено»).
 */
export function detectForcedRepaint(): boolean {
  if (typeof document === 'undefined' || !document.body || typeof getComputedStyle !== 'function') return false;
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

/**
 * Формулировка результата проверки. Samsung Internet не обязан отражать свой
 * фильтр в getComputedStyle, поэтому «false» нельзя переводить как «нет».
 */
export function repaintAssessment(browser: string, detected: boolean): string {
  if (detected) return 'обнаружена проверкой Auto Dark';
  if (browser === 'Samsung Internet') return 'не определяется этой проверкой в Samsung Internet';
  return 'не обнаружена проверкой Auto Dark (другие фильтры возможны)';
}

/** Совет относится к браузеру ярлыка, а не к настройке темы в СЛОВО. */
export function browserDarkModeHelp(browser: string): string {
  if (browser === 'Samsung Internet') {
    return 'Samsung Internet: ☰ → Настройки → Просмотр веб-страниц и прокрутка → Тёмный режим → выключите «Принудительный тёмный режим для веб-контента» (название может отличаться). Проверьте этот пункт при обычной теме телефона: после её смены он может снова включиться. Если есть только Labs → «Использовать тёмную тему сайта», её, наоборот, нужно включить. Затем закройте ярлык из недавних приложений и откройте снова.';
  }
  if (browser === 'Chrome') {
    return 'Chrome: ⋮ → Настройки → Тема → выключите «Затемнять сайты», если такой пункт есть. Затем закройте и снова откройте ярлык.';
  }
  if (browser === 'Яндекс.Браузер') {
    return 'Яндекс.Браузер: Настройки → Внешний вид → выключите принудительную тёмную тему для сайтов. Затем закройте и снова откройте ярлык.';
  }
  return 'В браузере, из которого установлен ярлык, проверьте настройку принудительного затемнения веб-страниц и выключите её. Затем закройте и снова откройте ярлык.';
}

/** Имя браузера по строке user-agent — нужно, чтобы дать подходящую инструкцию. */
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
