
export function Bar({ value, tone }: { value: number; tone?: 'green' | 'orange' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/**
 * Кольцо прогресса с подписью внутри.
 * SVG и `textLength` нужны, чтобы подпись влезала всегда: раньше «160/120»
 * вылезало за границы круга. Длинные подписи вида «набрано/цель» рисуем в две строки.
 */
export function Ring({ value, label, size = 76 }: { value: number; label: string; size?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const R = 32;
  const C = 2 * Math.PI * R;
  const [top, bottom] = label.includes('/') ? label.split('/') : [label, ''];
  const lines = bottom ? [top, `/${bottom}`] : [top];
  const longest = Math.max(...lines.map((l) => l.length));
  const fs = longest <= 3 ? 21 : longest <= 4 ? 19 : longest <= 5 ? 17 : longest <= 6 ? 15 : longest <= 8 ? 12.5 : 10.5;
  const gap = fs * 0.98;
  const maxWidth = 44;
  const y0 = 38 - ((lines.length - 1) * gap) / 2;

  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label} — ${Math.round(pct)}%`}>
      <svg viewBox="0 0 76 76" width={size} height={size}>
        <circle cx="38" cy="38" r={R} fill="none" stroke="var(--primary-soft)" strokeWidth="8" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke="var(--green)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
          transform="rotate(-90 38 38)"
        />
        {lines.map((line, i) => (
          <text
            key={i}
            x="38"
            y={y0 + i * gap}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fs}
            fontWeight={800}
            fill="var(--ink)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            {...(line.length * fs * 0.62 > maxWidth
              ? { textLength: maxWidth, lengthAdjust: 'spacingAndGlyphs' }
              : {})}
          >
            {line}
          </text>
        ))}
      </svg>
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
