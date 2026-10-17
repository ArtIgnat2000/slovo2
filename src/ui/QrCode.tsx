import { useMemo } from 'react';
import { qrEncode, type QrEcc, type QrMatrix } from '../engine/qr';

const QUIET_ZONE = 4; // «тихая зона» вокруг кода: без неё сканеры не читают

/**
 * QR-код одним контуром: ~350 подпутей на ссылку вместо сотен <rect> — меньше
 * разметки, чётче границы на любом экране и никаких картинок-файлов (офлайн).
 */
export function QrSvg({ matrix, className = '' }: { matrix: QrMatrix; className?: string }) {
  const { path, total } = useMemo(() => {
    let d = '';
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (!matrix.modules[row * matrix.size + col]) continue;
        d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { path: d, total: matrix.size + QUIET_ZONE * 2 };
  }, [matrix]);

  return (
    <svg
      className={`qr-code ${className}`}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="QR-код со ссылкой на приложение: наведите камеру телефона"
      shapeRendering="crispEdges"
      focusable="false"
      style={{ colorScheme: 'only light', forcedColorAdjust: 'none', background: '#ffffff' }}
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}

/** QR для строки; null — если строка не влезает (тогда показываем только ссылку). */
export function QrCode({ text, ecc, className }: { text: string; ecc?: QrEcc; className?: string }) {
  const matrix = useMemo(() => qrEncode(text, ecc ? { ecc } : undefined), [text, ecc]);
  if (!matrix) return null;
  return <QrSvg matrix={matrix} className={className} />;
}
