/**
 * Тема оформления и объявление схемы браузеру.
 *
 * Оформление складывается из двух независимых выборов:
 *  • **яркость** (`ThemeSetting`): «как в телефоне», светлая или тёмная;
 *  • **тема-стиль** (`PaletteId`): классика, неон, космос или море — палитра,
 *    свечение и фоновый узор. У каждой темы есть свой светлый и тёмный вариант.
 *
 * Статичный <meta name="color-scheme" content="only light"> в index.html
 * защищает первый кадр от Chrome Auto Dark ещё ДО выполнения скриптов.
 * Инлайн-скрипт затем читает зеркала выбора и ставит `data-theme` и
 * `data-palette` до отрисовки; applyTheme поддерживает их после загрузки
 * IndexedDB и при переключении.
 *
 * Это не способ отключить принудительное затемнение Samsung Internet:
 * некоторые его версии перекрашивают готовые пиксели, игнорируя color-scheme.
 * Проверка Chrome Auto Dark ниже тоже не видит такую перекраску. Поэтому
 * диагностике нельзя говорить «браузер не перекрашивает» при отрицательном
 * результате проверки (см. docs/RELEASE-0.14.5.md).
 */

/** Выбор в настройках: «как в телефоне», «светлая» или «тёмная». */
export type ThemeSetting = 'auto' | 'light' | 'dark';
/** Что в итоге нарисовано на экране. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Тема-стиль оформления. Значения живут в атрибуте `data-palette` и в CSS
 * (tokens.css: `[data-palette='…']`); новые темы добавляются в оба места
 * и в PALETTES ниже — больше нигде.
 */
export type PaletteId = 'classic' | 'neon' | 'space' | 'sea';

/** Тема по умолчанию: та, что была в приложении до появления выбора. */
export const DEFAULT_PALETTE: PaletteId = 'classic';

/**
 * Ключ зеркала выбора темы в localStorage.
 *
 * Основное хранилище настроек — IndexedDB, и оно читается асинхронно: к
 * первому кадру ответ ещё не пришёл. Но объявить схему нужно до первой
 * отрисовки, поэтому выбор дублируется в localStorage — он читается
 * синхронно, и инлайн-скрипт в index.html успевает поставить `data-theme`,
 * `data-palette` и схему до того, как браузер нарисует первый кадр.
 */
export const THEME_MIRROR_KEY = 'slovo2-theme';
/** Ключ зеркала темы-стиля (см. THEME_MIRROR_KEY). */
export const PALETTE_MIRROR_KEY = 'slovo2-palette';

/** Описание темы-стиля для настроек и метатега системной панели. */
export interface PaletteInfo {
  id: PaletteId;
  /** Название для настроек — его читает и родитель, и ребёнок. */
  title: string;
  /** Чем тема отличается от других: подпись в настройках. */
  hint: string;
  /** Цвет системной панели для светлого и тёмного варианта темы. */
  themeColor: Record<ResolvedTheme, string>;
}

/** Все темы в порядке показа в настройках. */
export const PALETTES: Record<PaletteId, PaletteInfo> = {
  classic: {
    id: 'classic',
    title: 'Классическая',
    hint: 'Тёплый крем и сирень — как сегодня.',
    themeColor: { light: '#7C5CFF', dark: '#171426' },
  },
  neon: {
    id: 'neon',
    title: 'Неоновая',
    hint: 'Неон-аркада: магента, циан, светящиеся заголовки и сетка.',
    themeColor: { light: '#d600d6', dark: '#0d0d1a' },
  },
  space: {
    id: 'space',
    title: 'Космос',
    hint: 'Ночное небо: индиго, фиолетовое свечение и звёзды.',
    themeColor: { light: '#4f46e5', dark: '#0b1026' },
  },
  sea: {
    id: 'sea',
    title: 'Морская',
    hint: 'Бирюза, волны и морской бриз.',
    themeColor: { light: '#0d9488', dark: '#062a33' },
  },
};

/** id тем в порядке показа в настройках. */
export const PALETTE_IDS: PaletteId[] = ['classic', 'neon', 'space', 'sea'];

/** Провести тему через грязные данные (выгрузки, старые профили). */
export function normalizePalette(raw: unknown): PaletteId {
  return typeof raw === 'string' && (PALETTE_IDS as string[]).includes(raw) ? (raw as PaletteId) : DEFAULT_PALETTE;
}

/** Цвет системной панели для темы и яркости. */
export function themeColorFor(palette: PaletteId, resolved: ResolvedTheme): string {
  return PALETTES[normalizePalette(palette)].themeColor[resolved];
}

/** Тёмная ли системная тема телефона. */
export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Какая яркость на экране при таком выборе в настройках. */
export function resolveTheme(theme: ThemeSetting, prefersDark: boolean = systemPrefersDark()): ResolvedTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

/** Прочитать зеркало выбора яркости (null — зеркала ещё нет). */
export function readThemeMirror(): ThemeSetting | null {
  try {
    const raw = window.localStorage.getItem(THEME_MIRROR_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : null;
  } catch {
    // Приватный режим или запрет хранилища: тему применит приложение позже.
    return null;
  }
}

/** Записать зеркало выбора яркости, чтобы следующий запуск начался сразу с него. */
export function writeThemeMirror(theme: ThemeSetting): void {
  try {
    window.localStorage.setItem(THEME_MIRROR_KEY, theme);
  } catch {
    // Без зеркала приложение всё равно применит тему — просто чуть позже.
  }
}

/** Прочитать зеркало выбора темы-стиля (null — зеркала ещё нет). */
export function readPaletteMirror(): PaletteId | null {
  try {
    const raw = window.localStorage.getItem(PALETTE_MIRROR_KEY);
    return raw === null ? null : normalizePalette(raw);
  } catch {
    // Приватный режим или запрет хранилища: тему применит приложение позже.
    return null;
  }
}

/**
 * Записать зеркало выбора темы-стиля. Неизвестное значение пишется как
 * классическая: инлайн-скрипт в index.html проверяет значение строго.
 */
export function writePaletteMirror(palette: PaletteId): void {
  try {
    window.localStorage.setItem(PALETTE_MIRROR_KEY, normalizePalette(palette));
  } catch {
    // Без зеркала приложение всё равно применит тему — просто чуть позже.
  }
}

/**
 * Выбрать токены палитры, схему страницы и цвет системной панели.
 *
 * `only light` в HTML и CSS отключает Chrome Auto Dark. В тёмной теме CSS
 * использует `only dark`, но в HTML-метатеге допустимо `dark`, не `only dark`.
 * Samsung Internet может проигнорировать оба объявления при включённой
 * принудительной тёмной теме веб-контента.
 */
export function applyTheme(theme: ThemeSetting, palette: PaletteId = DEFAULT_PALETTE, prefersDark?: boolean): ResolvedTheme {
  const resolved = resolveTheme(theme, prefersDark);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.palette = normalizePalette(palette);
  root.style.colorScheme = resolved === 'dark' ? 'only dark' : 'only light';
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved === 'dark' ? 'dark' : 'only light');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColorFor(palette, resolved));
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
