/**
 * Визуальные оформления приложения. Цветовая схема light/dark/auto — отдельная
 * настройка; каждый стиль имеет светлый и тёмный вариант.
 */
export const THEME_STYLES = [
  {
    id: 'classic',
    title: 'Классическая',
    emoji: '🌤️',
    description: 'Светлая — тёплый фон и фиолетовые акценты. Тёмная — обсидиан и шампань в стиле Maybach.',
    preview: { light: '#fff8ec', dark: '#16120d', accent: '#7c5cff', secondary: '#ff9f0a' },
    panelColor: { light: '#7C5CFF', dark: '#16120d' },
  },
  {
    id: 'neon',
    title: 'Неоновая аркада',
    emoji: '✨',
    description: 'Розово-голубая сетка и сияние, как в «Луи Брайль».',
    preview: { light: '#f0f4ff', dark: '#0d0d1a', accent: '#ff00ff', secondary: '#00ffff' },
    panelColor: { light: '#f0f4ff', dark: '#0d0d1a' },
  },
  {
    id: 'space',
    title: 'Космос',
    emoji: '🌌',
    description: 'Звёздное небо, индиго и холодные голубые огни.',
    preview: { light: '#f2efff', dark: '#101027', accent: '#7857ff', secondary: '#36d8ff' },
    panelColor: { light: '#f2efff', dark: '#101027' },
  },
  {
    id: 'forest',
    title: 'Лесная сказка',
    emoji: '🌿',
    description: 'Спокойные зелёные оттенки с тёплыми солнечными акцентами.',
    preview: { light: '#f1f8e9', dark: '#11231d', accent: '#238452', secondary: '#f4bb48' },
    panelColor: { light: '#f1f8e9', dark: '#11231d' },
  },
  {
    id: 'ocean',
    title: 'Океан',
    emoji: '🌊',
    description: 'Прохладная бирюзовая палитра и глубокий морской фон.',
    preview: { light: '#ecf8ff', dark: '#0b2030', accent: '#0787a8', secondary: '#48d5d0' },
    panelColor: { light: '#ecf8ff', dark: '#0b2030' },
  },
  // ── 0.70.0: «уютные» оформления (docs/proposals/shop-girls-catalog.md, вариант A) ──
  // Пять прежних стилей — про «какой будет экран». Эти три — про «мой уголок»:
  // тёплая спальня, сад со светлячками и закат. Выбор остаётся бесплатным и
  // независимым от light/dark, как и раньше.
  {
    id: 'bedroom',
    title: 'Спальня с гирляндой',
    emoji: '🛏️',
    description: 'Тёплый персиковый свет, гирлянда лампочек и плед.',
    preview: { light: '#fff4ec', dark: '#241726', accent: '#b64f7f', secondary: '#ffc178' },
    panelColor: { light: '#fff4ec', dark: '#241726' },
  },
  {
    id: 'fairygarden',
    title: 'Сад фей',
    emoji: '🧚',
    description: 'Мята, сирень и светлячки между листьями.',
    preview: { light: '#f2f8f1', dark: '#141f1c', accent: '#6b4fa8', secondary: '#7ed6b3' },
    panelColor: { light: '#f2f8f1', dark: '#141f1c' },
  },
  {
    id: 'sunset',
    title: 'Радужный закат',
    emoji: '🌅',
    description: 'Пастельные полосы, облака и тёплый розовый свет.',
    preview: { light: '#fff1f4', dark: '#2a1723', accent: '#b6485f', secondary: '#f0a05a' },
    panelColor: { light: '#fff1f4', dark: '#2a1723' },
  },
] as const;

export type ThemeStyle = (typeof THEME_STYLES)[number]['id'];
export type ThemeStyleOption = (typeof THEME_STYLES)[number];

export function isThemeStyle(value: unknown): value is ThemeStyle {
  return THEME_STYLES.some((style) => style.id === value);
}
