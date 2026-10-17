import { useMemo } from 'react';
import { qrEncode, type QrEcc, type QrMatrix } from '../engine/qr';
import { qrPngDataUrl } from '../engine/qrPng';

/**
 * QR-код картинкой.
 *
 * Раньше код рисовался инлайновым SVG, и на Android с принудительной тёмной
 * темой он выглядел однотонно серым: браузер переводит цвет любой
 * SVG-отрисовки в одну яркость, так что чёрные модули и белое поле
 * совпадали по цвету (см. docs/RELEASE-0.14.4.md). Растровая картинка такого
 * не делает — её пиксели остаются чёрно-белыми при любых настройках браузера,
 * и код сканируется.
 */
export function QrImage({ matrix, className = '' }: { matrix: QrMatrix; className?: string }) {
  const src = useMemo(() => qrPngDataUrl(matrix), [matrix]);
  return (
    <img
      className={`qr-code ${className}`}
      src={src}
      alt="QR-код со ссылкой на приложение: наведите камеру телефона"
      draggable={false}
      style={{ colorScheme: 'only light', forcedColorAdjust: 'none', background: '#ffffff' }}
    />
  );
}

/** QR для строки; null — если строка не влезает (тогда показываем только ссылку). */
export function QrCode({ text, ecc, className }: { text: string; ecc?: QrEcc; className?: string }) {
  const matrix = useMemo(() => qrEncode(text, ecc ? { ecc } : undefined), [text, ecc]);
  if (!matrix) return null;
  return <QrImage matrix={matrix} className={className} />;
}
