/**
 * Стабильные legacy-ID сохраняют купленные телефоны и их место в ангаре.
 *
 * 0.83.0: вещи раздела сняты студийными фотографиями, поэтому 3D-спинки
 * больше не показываются — они остались запасным вариантом, если снимок
 * у товара почему-то не найдётся.
 */
export const ELECTRONICS_ART: Record<string, string> = {
  'phone-smart': 'phone-air-back',
  'phone-flip': 'phone-17-back',
  'phone-retro': 'phone-max-back',
  'phone-pro': 'phone-pro-back',
  // 0.72.0: линейка iPhone 18 переиспользовала чужие спинки;
  // 0.72.1: у каждой модели своя сгенерированная 3D-спинка.
  'phone-18': 'phone-18-back',
  'phone-18-air': 'phone-18-air-back',
  'phone-18-pro': 'phone-18-pro-back',
  'phone-18-max': 'phone-18-pro-max-back',
  'laptop-air': 'laptop-air',
  'tv-cinema': 'tv-cinema',
  'headphones-max': 'headphones-max',
};

export function hasElectronicsArt(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ELECTRONICS_ART, id);
}

/** Раздел электроники: товар показывается как обычная иллюстрация. */
export function ElectronicsArt({ id, className, alt }: {
  id: string;
  className?: string;
  alt?: string;
}) {
  if (!hasElectronicsArt(id)) return null;
  const src = `${import.meta.env.BASE_URL}electronics/${ELECTRONICS_ART[id]}.webp`;
  return (
    <span className={`electronics-art${className ? ` ${className}` : ''}`}>
      <img src={src} width={960} height={960} alt={alt ?? ''} draggable={false} decoding="async" loading="lazy" />
    </span>
  );
}
