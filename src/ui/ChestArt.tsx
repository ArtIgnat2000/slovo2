interface KeySymbolProps {
  lit?: boolean;
}

/** Небольшой векторный ключ — одинаково выглядит на iOS, Android и в офлайне. */
export function KeySymbol({ lit = false }: KeySymbolProps) {
  return (
    <svg
      className={`key-symbol ${lit ? 'lit' : ''}`}
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6.3" />
      <circle className="key-symbol-hole" cx="11" cy="11" r="2.1" />
      <path d="M15.7 15.7 29 29m-6.2-6.2 3.7-3.7m-8.1-.1 3.7-3.7" />
    </svg>
  );
}

export type ChestGlyphState = 'locked' | 'ready' | 'opened';

/** Компактная версия сундука для карточки заданий дня. */
export function ChestGlyph({ state }: { state: ChestGlyphState }) {
  if (state === 'locked') {
    return (
      <svg className="chest-mini-glyph locked" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M15 21v-4a9 9 0 0 1 18 0v4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <rect x="10" y="20" width="28" height="22" rx="6" fill="currentColor" />
        <circle cx="24" cy="29" r="2.5" fill="var(--bg-2)" />
        <path d="M24 31v4" stroke="var(--bg-2)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={`chest-mini-glyph ${state}`} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M9 19c0-6 4-10 10-10h10c6 0 10 4 10 10v4H9z" fill="#b97028" stroke="#75401f" strokeWidth="2.5" />
      <path d="M8 22h32v18c0 2-2 4-4 4H12c-2 0-4-2-4-4z" fill="#d98a35" stroke="#75401f" strokeWidth="2.5" />
      <path d="M11 27h26M11 36h26" stroke="#f3bd63" strokeWidth="2" opacity=".8" />
      <path d="M20 21v22m8-22v22" stroke="#f8d68c" strokeWidth="3" />
      <rect x="20" y="25" width="8" height="9" rx="2" fill="#6a3d62" stroke="#f7cc67" strokeWidth="1.5" />
      {state === 'opened' && <path d="M11 16 7 8m30 8 4-8M24 7V2" stroke="#ffd36b" strokeWidth="2.5" strokeLinecap="round" />}
    </svg>
  );
}

/** Иллюстрация сундука БУКа. Открытая и закрытая версии — локальные WebP-спрайты. */
export function ChestIllustration() {
  const base = import.meta.env.BASE_URL;
  return (
    <div
      className="chest-illustration"
      role="img"
      aria-label="Бирюзовый сундук с золотой отделкой; внутри сияют разноцветные кристаллы"
    >
      <div className="chest-aura" aria-hidden="true" />
      <img
        className="chest-art-image chest-art-closed"
        src={`${base}illustrations/chest-closed.webp`}
        alt=""
        draggable={false}
      />
      <img
        className="chest-art-image chest-art-open"
        src={`${base}illustrations/chest-open.webp`}
        alt=""
        draggable={false}
      />
      <svg className="chest-art-keys" viewBox="0 0 900 900" aria-hidden="true" focusable="false">
        {/* Три ключа прилетают к замкам, соответствующим трём выполненным заданиям. */}
        <g transform="translate(462 408)">
          <g className="scene-key scene-key-one">
            <circle cx="0" cy="0" r="25" fill="#ffe17b" stroke="#a64e52" strokeWidth="8" />
            <circle cx="0" cy="0" r="9" fill="#733a4d" />
            <path d="M18 18 69 69h19V49H68m1 1 14-14" fill="none" stroke="#ffe17b" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 18 69 69h19V49H68m1 1 14-14" fill="none" stroke="#fff8d8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
          </g>
        </g>
        <g transform="translate(607 315)">
          <g className="scene-key scene-key-two">
            <circle cx="0" cy="0" r="25" fill="#ffe17b" stroke="#a64e52" strokeWidth="8" />
            <circle cx="0" cy="0" r="9" fill="#733a4d" />
            <path d="M18 18 69 69h19V49H68m1 1 14-14" fill="none" stroke="#ffe17b" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 18 69 69h19V49H68m1 1 14-14" fill="none" stroke="#fff8d8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
          </g>
        </g>
        <g transform="translate(745 365)">
          <g className="scene-key scene-key-three">
            <circle cx="0" cy="0" r="25" fill="#ffe17b" stroke="#a64e52" strokeWidth="8" />
            <circle cx="0" cy="0" r="9" fill="#733a4d" />
            <path d="M18 18 69 69h19V49H68m1 1 14-14" fill="none" stroke="#ffe17b" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 18 69 69h19V49H68m1 1 14-14" fill="none" stroke="#fff8d8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
          </g>
        </g>
        <path className="chest-spark chest-spark-one" d="M278 300v35m-17.5-17.5h35" stroke="#fff5b2" strokeWidth="9" strokeLinecap="round" />
        <path className="chest-spark chest-spark-two" d="M771 282v26m-13-13h26" stroke="#fff5b2" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
