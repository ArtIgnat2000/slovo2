import type { CSSProperties } from 'react';

/**
 * Самолёты (0.70.0, перенос из Slovo_Developer): детальные WebP-иллюстрации
 * в `public/planes/<id>.webp` с прозрачным фоном — как машины в CarArt.
 * Тюнинг работает так же: цветной «карандаш» (`colors[0]`) накладывается
 * поверх рисунка маской по его альфе, штриховка и блики сохраняются.
 */

export const AIRPLANE_IDS = [
  'plane-swift',
  'plane-atomic-base',
  'plane-electron-base',
  'plane-arctic-base',
  'plane-moon-base',
  'plane-steam-base',
] as const;

const AIRPLANE_FILES: Record<string, string> = {
  'plane-swift': 'plane-swift.webp',
  'plane-atomic-base': 'plane-atomic-base.webp',
  'plane-electron-base': 'plane-electron-base.webp',
  'plane-arctic-base': 'plane-arctic-base.webp',
  'plane-moon-base': 'plane-moon-base.webp',
  'plane-steam-base': 'plane-steam-base.webp',
};

export function hasAirplaneArt(id: string): boolean {
  return id in AIRPLANE_FILES;
}

/** URL рисунка: public/planes/<файл> с учётом базы сборки. */
export function airplaneArtUrl(id: string): string | null {
  const file = AIRPLANE_FILES[id];
  return file ? `${import.meta.env.BASE_URL}planes/${file}` : null;
}

export function AirplaneArt({
  id,
  size = 96,
  className,
  alt,
  colors,
}: {
  id: string;
  size?: number;
  className?: string;
  alt?: string;
  /** Цвета тюнинга: [основной, глубокий, акцент]; основной — «карандаш» поверх рисунка. */
  colors?: [string, string, string] | null;
}) {
  const src = airplaneArtUrl(id);
  if (!src) return null;
  const tint = colors?.[0];
  const style = {
    '--airplane-size': size,
    '--airplane-mask': `url("${src}")`,
    ...(tint ? { '--airplane-tint': tint } : {}),
  } as CSSProperties;
  return (
    <span
      className={`airplane-art${className ? ` ${className}` : ''}`}
      data-airplane-id={id}
      style={style}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : 'true'}
    >
      <img src={src} alt="" aria-hidden="true" draggable={false} decoding="async" loading="lazy" />
      {tint && <span className="airplane-art-wash" aria-hidden="true" />}
    </span>
  );
}
