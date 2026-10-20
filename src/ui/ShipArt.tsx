import type { CSSProperties } from 'react';

/**
 * Морская коллекция БУКа: полноцветные карандашные рисунки крупных судов.
 * Изображения — вырезанные WebP с прозрачным фоном, одинаковым холстом 720×480
 * и общей линией корпуса, поэтому одинаково читаются в карточке магазина,
 * ангаре и подробном просмотре.
 */
export const SHIP_ART: Record<string, { file: string; kind: string; note: string }> = {
  'ship-paper': {
    file: 'ship-yacht',
    kind: 'Морская яхта',
    note: 'Несколько палуб, панорамные окна и широкая прогулочная палуба',
  },
  'ship-sail': {
    file: 'ship-container',
    kind: 'Контейнеровоз',
    note: 'Высокие штабеля цветных контейнеров идут через океан между портами',
  },
  'ship-steam': {
    file: 'ship-tanker',
    kind: 'Супертанкер',
    note: 'Длинная палуба с трубами и оборудованием для перевозки нефти',
  },
  'ship-carrier': {
    file: 'ship-carrier',
    kind: 'Авианосец',
    note: 'Широкая полётная палуба и самолёты на борту',
  },
};

export function hasShipArt(id: string): boolean {
  return id in SHIP_ART;
}

export function shipKind(id: string): string | null {
  return SHIP_ART[id]?.kind ?? null;
}

export function shipNote(id: string): string | null {
  return SHIP_ART[id]?.note ?? null;
}

export function shipAlt(id: string, fallback = ''): string {
  const art = SHIP_ART[id];
  if (!art) return fallback;
  return `${fallback || art.kind} — ${art.kind.toLowerCase()}`;
}

export function shipArtUrl(id: string): string | null {
  if (!hasShipArt(id)) return null;
  return `${import.meta.env.BASE_URL}ships/${SHIP_ART[id].file}.webp`;
}

/** Рисунок судна. Цветной тюнинг накладывается на изображение, не заменяя штриховку. */
export function ShipArt({
  id,
  tint,
  alt,
  className,
}: {
  id: string;
  tint?: string | null;
  /** Пустая строка — декоративное изображение, когда карточка уже подписана. */
  alt?: string;
  className?: string;
}) {
  const src = shipArtUrl(id);
  if (!src) return null;
  const style = tint
    ? ({
        '--ship-tint': tint,
        '--ship-mask': `url("${src}")`,
      } as unknown as CSSProperties)
    : undefined;
  return (
    <span className={`ship-art${className ? ` ${className}` : ''}`} style={style}>
      <img src={src} width={720} height={480} alt={alt ?? ''} draggable={false} decoding="async" loading="lazy" />
      {tint && <span className="ship-art-wash" aria-hidden="true" />}
    </span>
  );
}
