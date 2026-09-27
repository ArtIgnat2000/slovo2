
export function Bar({ value, tone }: { value: number; tone?: 'green' | 'orange' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/**
 * Кольцо цели (стиль спортивных приложений — Garmin / Apple Fitness).
 *
 * Прогресс-план дробью («150/120») не показываем: при переборе это выглядит
 * некрасиво и ребёнку непонятно. Вместо этого:
 *  • крупное число в центре — сколько набрано;
 *  • мелкая подпись «цель 120» под числом;
 *  • кольцо закрывается на 100% и становится зелёным с галочкой ✓.
 * «Лишние» XP хозяин экрана выносит бейджем рядом с текстом.
 */
export function Ring({
  value,
  main,
  sub,
  done = false,
  size = 76,
}: {
  /** Процент к цели (клампится до 0..100) */
  value: number;
  /** Крупное число в центре, например «150» */
  main: string;
  /** Мелкая подпись под числом, например «цель 120» */
  sub?: string;
  /** Цель выполнена: зелёное кольцо + галочка */
  done?: boolean;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const R = 32;
  const C = 2 * Math.PI * R;
  const fs = main.length <= 3 ? 23 : main.length <= 4 ? 19 : main.length <= 5 ? 15.5 : 12.5;
  const maxWidth = 48;

  return (
    <div
      className={`ring ${done ? 'done' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${main} XP, ${sub ?? ''}${done ? ', цель выполнена' : ''}`}
    >
      <svg viewBox="0 0 76 76" width={size} height={size}>
        <circle cx="38" cy="38" r={R} fill="none" stroke="var(--primary-soft)" strokeWidth="8" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke={done ? 'var(--green)' : 'var(--primary)'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
          transform="rotate(-90 38 38)"
          style={{ transition: 'stroke-dashoffset .5s ease, stroke .3s ease' }}
        />
        <text
          x="38"
          y={sub ? 32 : 38}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fs}
          fontWeight={800}
          fill="var(--ink)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          {...(main.length * fs * 0.62 > maxWidth
            ? { textLength: maxWidth, lengthAdjust: 'spacingAndGlyphs' }
            : {})}
        >
          {main}
        </text>
        {sub && (
          <text
            x="38"
            y={53}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9.5}
            fontWeight={700}
            fill="var(--ink-3)"
          >
            {sub}
          </text>
        )}
      </svg>
      {done && <span className="ring-check">✓</span>}
    </div>
  );
}

export function Stars({ n, size = 40 }: { n: number; size?: number }) {
  return (
    <div className="stars" style={{ fontSize: size }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'pop' : 'star off'} style={{ animationDelay: `${i * 0.12}s` }}>
          ⭐
        </span>
      ))}
    </div>
  );
}

export function Crowns({ level }: { level: number }) {
  return (
    <div className="crowns">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`crown ${i < level ? 'on' : ''}`} />
      ))}
    </div>
  );
}

export function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const bits = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 60, overflow: 'hidden' }}>
      {bits.map((i) => {
        const left = (i * 4.17 + Math.random() * 3) % 100;
        const delay = Math.random() * 0.5;
        const dur = 1.4 + Math.random() * 1.2;
        const colors = ['#7c5cff', '#22c55e', '#ff9f0a', '#3b82f6', '#ff6fb5'];
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: -20,
              left: `${left}%`,
              width: 10,
              height: 14,
              background: colors[i % colors.length],
              borderRadius: 2,
              animation: `fall ${dur}s linear ${delay}s forwards`,
            }}
          />
        );
      })}
      <style>{`@keyframes fall { to { transform: translateY(105dvh) rotate(540deg); opacity: .9 } }`}</style>
    </div>
  );
}
