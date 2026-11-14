/**
 * Буквёнок — герой «Тропы слов» (0.111.0).
 *
 * Инлайн-SVG вместо эмодзи: у героя три честных состояния (стоит, идёт,
 * радуется), он наследует цвета темы через токены и не тянет сеть. Размер
 * задаётся пропом; на плитах он маленький (20–22 px), на открытке — крупнее.
 *
 * Анимация только у `walk` (шагающие ноги и руки) и `cheer` (звезда). Всё
 * выключается `prefers-reduced-motion` в CSS — позы при этом остаются
 * читаемыми, а не превращаются в «сломанную» картинку.
 */
export type TrailHeroState = 'idle' | 'walk' | 'cheer';

export function TrailHero({
  state = 'idle',
  size = 22,
  label,
}: {
  state?: TrailHeroState;
  /** Ширина в пикселях; высота считается из пропорций 32:40. */
  size?: number;
  /** Если задан — герой становится картинкой с подписью для скринридера. */
  label?: string;
}) {
  return (
    <svg
      className={`trail-hero-svg is-${state}`}
      viewBox="0 0 32 40"
      width={size}
      height={(size * 40) / 32}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {/* Тень: держит героя на плите и на карточке. */}
      <ellipse cx="16" cy="37.4" rx="8.4" ry="2" fill="var(--ink)" opacity="0.14" />

      <g className="trail-hero-legs">
        <rect
          className="trail-hero-leg trail-hero-leg-a"
          x="10.4"
          y="27"
          width="4.6"
          height="9"
          rx="2.3"
          fill="var(--ink-2)"
        />
        <rect
          className="trail-hero-leg trail-hero-leg-b"
          x="17"
          y="27"
          width="4.6"
          height="9"
          rx="2.3"
          fill="var(--ink-2)"
        />
      </g>

      <g className="trail-hero-arms">
        <path
          className="trail-hero-arm trail-hero-arm-a"
          d="M9 19.5 Q5.2 22.4 5.6 26.4"
          fill="none"
          stroke="var(--green)"
          strokeWidth="3.3"
          strokeLinecap="round"
        />
        <path
          className="trail-hero-arm trail-hero-arm-b"
          d="M23 19.5 Q26.8 22.4 26.4 26.4"
          fill="none"
          stroke="var(--green)"
          strokeWidth="3.3"
          strokeLinecap="round"
        />
      </g>

      {/* Рюкзак — сбоку, чтобы силуэт читался даже на 20 px. */}
      <rect x="21.6" y="17.4" width="5.8" height="7.4" rx="2.6" fill="var(--orange-soft)" />
      <rect x="8.6" y="15.2" width="14.8" height="13" rx="6.5" fill="var(--green)" />
      <rect x="10.4" y="14.6" width="11.2" height="3.2" rx="1.6" fill="var(--orange)" />

      <circle cx="16" cy="9.4" r="7" fill="var(--card)" stroke="var(--ink)" strokeWidth="0.9" />
      {/* Волосы: шапка, а не заливка всего круга — лицо остаётся светлым. */}
      <path d="M9.1 8.4 Q10.6 2.2 18.4 2.5 Q24 2.9 23 9.6 Q21.8 6.3 18.6 5.7 Q13.4 4.7 9.1 8.4Z" fill="var(--ink)" />
      <circle cx="13.4" cy="10.2" r="1.05" fill="var(--ink)" />
      <circle cx="18.6" cy="10.2" r="1.05" fill="var(--ink)" />
      <path
        d="M14.2 12.9 Q16 14.3 17.8 12.9"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Звезда появляется только в `cheer`: радость видно с одного взгляда. */}
      <g className="trail-hero-star">
        <path
          d="M27 3 l.8 1.7 1.9.2 -1.4 1.3 .4 1.9 -1.7-1 -1.7 1 .4-1.9 -1.4-1.3 1.9-.2Z"
          fill="var(--orange)"
        />
      </g>
    </svg>
  );
}
