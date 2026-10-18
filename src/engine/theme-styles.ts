/**
 * Визуальные оформления приложения. Цветовая схема light/dark/auto — отдельная
 * настройка; каждый стиль имеет светлый и тёмный вариант.
 */
export const THEME_STYLES = [
  {
    id: 'classic',
    title: 'Классическая',
    emoji: '🌤️',
    description: 'Тёплый фон и мягкие фиолетовые акценты — исходный вид приложения.',
    preview: { light: '#fff8ec', dark: '#171426', accent: '#7c5cff', secondary: '#ff9f0a' },
    panelColor: { light: '#7C5CFF', dark: '#171426' },
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
] as const;

export type ThemeStyle = (typeof THEME_STYLES)[number]['id'];
export type ThemeStyleOption = (typeof THEME_STYLES)[number];

export function isThemeStyle(value: unknown): value is ThemeStyle {
  return THEME_STYLES.some((style) => style.id === value);
}
