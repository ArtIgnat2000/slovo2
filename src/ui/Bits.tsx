
export function Bar({ value, tone }: { value: number; tone?: 'green' | 'orange' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, label }: { value: number; label: string }) {
  return (
    <div className="ring" style={{ ['--p' as any]: Math.round(value) }}>
      <span>{label}</span>
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
