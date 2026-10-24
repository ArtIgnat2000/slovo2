// ── UI-иконки: 20 штук вместо функциональных эмодзи (0.54.0) ────────────────
//
// Решение пользователя 2026-10-24 (разбор — docs/proposals/ui-icons.md):
// вариант **B** — «линия + акцент». Штрих рисуется `currentColor` (цвет
// берётся от текста кнопки), одна деталь заливается `--icon-accent` из темы.
//
// Почему SVG, а не эмодзи:
//  • 16–24 px: эмодзи разной оптической плотности и зависят от шрифта
//    устройства (`☰` в части сборок — линии разной толщины);
//  • тёмная тема: эмодзи не наследуют цвет, `🤍` на светлом почти исчезает;
//  • доступность: иконка `aria-hidden`, смысл — в тексте кнопки или title;
//    скринридер не читает «камень» вместо «кристаллы».
//
// Правила набора (не менять без разбора):
//  1. viewBox 24×24, штрих 2, round caps/joins — единая сетка;
//  2. никаких букв и цифр внутри иконки (как у картинок слов);
//  3. вес файла ≤ 25 КБ на весь набор — проверяет `npm run test:icons`;
//  4. иконка никогда не единственный носитель смысла (WCAG 1.4.1):
//     рядом всегда текст или `title`.
//
// Эмодзи в контенте (слова, темы уроков, интонация тостов) не трогаем —
// это часть контента, а не интерфейса.

export type IconName =
  | 'crystal' | 'chest' | 'heart' | 'palette' | 'puzzle' | 'hat' | 'flame' | 'bolt' | 'bulb' | 'menu' | 'speaker' | 'speaker-off' | 'trophy' | 'star' | 'book' | 'calendar' | 'check' | 'close' | 'arrow' | 'sparkle';

interface IconDef {
  /** Деталь, которая заливается акцентом темы (вариант B). */
  accent?: string;
  paths: string[];
}

/** Черновик набора нарисован в docs/proposals/ui-icons/preview.html. */
const ICONS: Record<IconName, IconDef> = {
  'crystal': {
    accent: 'M5 9h14l-7 12Z',
    paths: [
      'M12 3 5 9l7 12 7-12-7-6Z',
      'M5 9h14',
      'M9 9l3 12 3-12',
    ],
  },
  'chest': {
    accent: 'M10.2 12.5h3.6v2h-3.6z',
    paths: [
      'M4 10.5h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z',
      'M4 10.5a8 8 0 0 1 16 0',
      'M12 12.5v3.5',
      'M12 16.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    ],
  },
  'heart': {
    accent: 'M12 20C7.2 16.4 4 13.2 4 9.6A3.6 3.6 0 0 1 12 7.3 3.6 3.6 0 0 1 20 9.6c0 3.6-3.2 6.8-8 10.4Z',
    paths: [
      'M12 20C7.2 16.4 4 13.2 4 9.6A3.6 3.6 0 0 1 12 7.3 3.6 3.6 0 0 1 20 9.6c0 3.6-3.2 6.8-8 10.4Z',
    ],
  },
  'palette': {
    accent: 'M12 3a9 9 0 0 0 0 18h1.6a2.2 2.2 0 0 0 0-4.4H13a2.2 2.2 0 0 1 0-4.4h3.6A3.4 3.4 0 0 0 20 8.8C20 5.6 16.4 3 12 3Z',
    paths: [
      'M12 3a9 9 0 0 0 0 18h1.6a2.2 2.2 0 0 0 0-4.4H13a2.2 2.2 0 0 1 0-4.4h3.6A3.4 3.4 0 0 0 20 8.8C20 5.6 16.4 3 12 3Z',
      'M8.6 8.4a1 1 0 1 0 0-.1',
      'M11.3 6.5a1 1 0 1 0 0-.1',
      'M14.6 6.9a1 1 0 1 0 0-.1',
      'M17 9.4a1 1 0 1 0 0-.1',
    ],
  },
  'puzzle': {
    accent: 'M9.2 4h5.6v2.4a1.8 1.8 0 1 0 3.6 0V4H22v5.6h-2.4a1.8 1.8 0 1 0 0 3.6H22V19h-5.6v-2.4a1.8 1.8 0 1 0-3.6 0V19H4v-5.8h2.4a1.8 1.8 0 1 0 0-3.6H4V4h5.2Z',
    paths: [
      'M9.2 4h5.6v2.4a1.8 1.8 0 1 0 3.6 0V4H22v5.6h-2.4a1.8 1.8 0 1 0 0 3.6H22V19h-5.6v-2.4a1.8 1.8 0 1 0-3.6 0V19H4v-5.8h2.4a1.8 1.8 0 1 0 0-3.6H4V4h5.2Z',
    ],
  },
  'hat': {
    accent: 'M7 14.5h10v2.2H7z',
    paths: [
      'M7 20V8.5A2.5 2.5 0 0 1 9.5 6h5A2.5 2.5 0 0 1 17 8.5V20',
      'M4.5 20h15',
      'M7 14.5h10',
    ],
  },
  'flame': {
    accent: 'M12 3c3.2 3.2 5 5.8 5 9a5 5 0 0 1-10 0c0-1.8.8-3.2 2-4.5.2 1.6 1 2.6 2 3 0-2.6.4-5 1-7.5Z',
    paths: [
      'M12 3c3.2 3.2 5 5.8 5 9a5 5 0 0 1-10 0c0-1.8.8-3.2 2-4.5.2 1.6 1 2.6 2 3 0-2.6.4-5 1-7.5Z',
    ],
  },
  'bolt': {
    accent: 'M13 2 5.5 14H11l-1 8 8-12h-6l1-8Z',
    paths: [
      'M13 2 5.5 14H11l-1 8 8-12h-6l1-8Z',
    ],
  },
  'bulb': {
    accent: 'M12 3a6 6 0 0 0-3.6 10.8V16h7.2v-2.2A6 6 0 0 0 12 3Z',
    paths: [
      'M12 3a6 6 0 0 0-3.6 10.8V16h7.2v-2.2A6 6 0 0 0 12 3Z',
      'M9.6 19h4.8',
      'M10.8 21.5h2.4',
    ],
  },
  'menu': {
    paths: [
      'M4 7h16',
      'M4 12h16',
      'M4 17h16',
    ],
  },
  'speaker': {
    accent: 'M4 10h3l4-3v10l-4-3H4z',
    paths: [
      'M4 10h3l4-3v10l-4-3H4z',
      'M15 9.5a4 4 0 0 1 0 5',
      'M17.6 7a7.5 7.5 0 0 1 0 10',
    ],
  },
  'speaker-off': {
    accent: 'M4 10h3l4-3v10l-4-3H4z',
    paths: [
      'M4 10h3l4-3v10l-4-3H4z',
      'M16 9.5l5 5',
      'M21 9.5l-5 5',
    ],
  },
  'trophy': {
    accent: 'M8 4h8v5a4 4 0 0 1-8 0V4Z',
    paths: [
      'M8 4h8v5a4 4 0 0 1-8 0V4Z',
      'M8 5.5H5.2v1.8A3.3 3.3 0 0 0 8.5 10.6',
      'M16 5.5h2.8v1.8a3.3 3.3 0 0 1-3.3 3.3',
      'M12 13v4',
      'M8.5 20h7',
    ],
  },
  'star': {
    accent: 'M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.9l6.1-.8L12 3.5Z',
    paths: [
      'M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.9l6.1-.8L12 3.5Z',
    ],
  },
  'book': {
    accent: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z',
    paths: [
      'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z',
      'M8 3v18',
    ],
  },
  'calendar': {
    accent: 'M7.5 12.5h3.5v3.5H7.5z',
    paths: [
      'M4.5 6.5h15v13h-15z',
      'M4.5 10.5h15',
      'M8.5 4v4',
      'M15.5 4v4',
    ],
  },
  'check': {
    paths: [
      'M5 12.5l4.5 4.5L19 7',
    ],
  },
  'close': {
    paths: [
      'M6.5 6.5l11 11',
      'M17.5 6.5l-11 11',
    ],
  },
  'arrow': {
    paths: [
      'M4.5 12h14',
      'M13 6.5l5.5 5.5L13 17.5',
    ],
  },
  'sparkle': {
    accent: 'M11 3.5l1.8 4.7 4.7 1.8-4.7 1.8L11 16.5l-1.8-4.7L4.5 10l4.7-1.8L11 3.5Z',
    paths: [
      'M11 3.5l1.8 4.7 4.7 1.8-4.7 1.8L11 16.5l-1.8-4.7L4.5 10l4.7-1.8L11 3.5Z',
      'M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z',
    ],
  },
};

/** Все имена — для теста: набор должен совпадать с разбором. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

interface IconProps {
  name: IconName;
  /** Размер в px. По умолчанию 1em — иконка наследует кегль текста. */
  size?: number | string;
  className?: string;
  /** Если передан — иконка становится самостоятельным смыслом (role=img). */
  title?: string;
}

/**
 * Иконка интерфейса. По умолчанию декоративная (`aria-hidden`): смысл несёт
 * текст рядом. `title` нужен там, где иконка стоит одна, без подписи.
 */
export function Icon({ name, size = '1em', className, title }: IconProps) {
  const def = ICONS[name];
  return (
    <svg
      className={className ? `ico ${className}` : 'ico'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-icon={name}
    >
      {def.accent && <path className="ico-acc" d={def.accent} />}
      {def.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

interface GemProps {
  /** Сколько кристаллов показать. */
  value: number | string;
  size?: number;
  className?: string;
}

/**
 * Кристалл и число одной группой: `[◆] 128`. Заменяет текстовое «💎 128»
 * в счётчиках, ценах и наградах — самое частое место в приложении (131).
 */
export function Gem({ value, size = 18, className }: GemProps) {
  return (
    <span className={className ? `gem-amount ${className}` : 'gem-amount'}>
      <Icon name="crystal" size={size} />
      <span>{value}</span>
    </span>
  );
}
