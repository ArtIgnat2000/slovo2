import { useState, type CSSProperties } from 'react';
import { ITEM_BY_ID } from '../engine/shop';

/** Stable legacy IDs preserve purchased phones and their place in the hangar. */
export const ELECTRONICS_ART: Record<string, string> = {
  'phone-smart': 'phone-air-back',
  'phone-flip': 'phone-17-back',
  'phone-retro': 'phone-max-back',
  'phone-pro': 'phone-pro-back',
  'laptop-air': 'laptop-air',
  'tv-cinema': 'tv-cinema',
  'headphones-max': 'headphones-max',
};

export function hasElectronicsArt(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ELECTRONICS_ART, id);
}

export function isRotatingPhone(id: string): boolean {
  return hasElectronicsArt(id) && id.startsWith('phone-');
}

/** Interactive only where explicitly enabled: never nest a button in a hangar button. */
export function ElectronicsArt({ id, className, interactive = false, tint, alt }: {
  id: string;
  className?: string;
  interactive?: boolean;
  tint?: string | null;
  alt?: string;
}) {
  const [front, setFront] = useState(false);
  if (!hasElectronicsArt(id)) return null;
  const src = `${import.meta.env.BASE_URL}electronics/${ELECTRONICS_ART[id]}.webp`;
  const cls = `electronics-art${className ? ` ${className}` : ''}`;
  const image = <img src={src} width={960} height={960} alt={alt ?? ''} draggable={false} decoding="async" loading="lazy" />;
  const back = <span className="phone-face phone-face-back">
    {image}
    {tint && <span className="phone-tint" aria-hidden="true" style={{ '--phone-tint': tint, '--phone-mask': `url("${src}")` } as CSSProperties} />}
  </span>;
  if (!isRotatingPhone(id)) return <span className={cls}>{image}</span>;
  const content = <span className={`phone-turntable${front ? ' is-front' : ''}`} aria-hidden="true">
    {back}
    <span className="phone-face phone-face-front">
      <img src={`${import.meta.env.BASE_URL}electronics/phone-front.webp`} width={960} height={960} alt="" draggable={false} decoding="async" />
    </span>
  </span>;
  if (!interactive) return <span className={`${cls} phone-view`}>{back}</span>;
  return (
    <button
      type="button"
      className={`${cls} phone-view phone-rotate`}
      aria-label={`${ITEM_BY_ID[id]?.title ?? 'Телефон'}: ${front ? 'экран' : 'задняя панель'}. Повернуть`}
      aria-pressed={front}
      title="Нажми, чтобы повернуть телефон"
      onClick={(event) => { event.stopPropagation(); setFront(value => !value); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {content}
    </button>
  );
}
