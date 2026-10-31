import { useEffect, useState } from 'react';
import { ITEM_BY_ID } from '../engine/shop';
import { productPhotoUrl, ProductPhoto } from './ProductPhoto';

/**
 * Photo-only product gallery. Every eligible product must have an explicit,
 * distinct second photograph or photorealistic product render in the same
 * neutral studio language. No generated crops, SVG scenes or hand-drawn assets
 * are used as substitute frames.
 */
type AlternatePhoto = { path: string; label: string; cutout?: boolean };

const ALTERNATES: Record<string, AlternatePhoto> = {
  // Front views: generated against the same neutral studio reference as the
  // original product photographs. All eight phone backs now have a front.
  'phone-smart': { path: 'products/gallery/phone-smart-front.webp', label: 'Вид спереди' },
  'phone-flip': { path: 'products/gallery/phone-flip-front.webp', label: 'Вид спереди' },
  'phone-retro': { path: 'products/gallery/phone-retro-front.webp', label: 'Вид спереди' },
  'phone-pro': { path: 'products/gallery/phone-pro-front.webp', label: 'Вид спереди' },
  'phone-18': { path: 'products/gallery/phone-18-front.webp', label: 'Вид спереди' },
  'phone-18-air': { path: 'products/gallery/phone-18-air-front.webp', label: 'Вид спереди' },
  'phone-18-pro': { path: 'products/gallery/phone-18-pro-front.webp', label: 'Вид спереди' },
  'phone-18-max': { path: 'products/gallery/phone-18-max-front.webp', label: 'Вид спереди' },
  // The four isolated vessel renders are photorealistic product renders, not
  // illustrations. Their neutral stage is matched to the catalog photographs.
  'ship-paper': { path: 'products/gallery/ship-paper-alt.webp', label: 'Другой ракурс' },
  'ship-sail': { path: 'ships/ship-container.webp', label: 'Другой ракурс', cutout: true },
  'ship-steam': { path: 'ships/ship-tanker.webp', label: 'Другой ракурс', cutout: true },
  'ship-carrier': { path: 'ships/ship-carrier.webp', label: 'Другой ракурс', cutout: true },
  'ship-titanic': { path: 'products/gallery/ship-titanic-alt.webp', label: 'Другой ракурс' },
  'plane-swift': { path: 'products/gallery/plane-swift-alt.webp', label: 'Другой ракурс' },
  'plane-electron-base': { path: 'products/gallery/plane-electron-base-alt.webp', label: 'Другой ракурс' },
  'plane-arctic-base': { path: 'products/gallery/plane-arctic-base-alt.webp', label: 'Другой ракурс' },
  'plane-moon-base': { path: 'products/gallery/plane-moon-base-alt.webp', label: 'Другой ракурс' },
  'plane-atomic-base': { path: 'products/gallery/plane-atomic-base-alt.webp', label: 'Другой ракурс' },
  'plane-steam-base': { path: 'products/gallery/plane-steam-base-alt.webp', label: 'Другой ракурс' },
  // Second angles for the everyday toys (0.89.7). Same studio, same scale,
  // same light: the label names what the second frame actually shows, so the
  // counter «1 / 2» and the «Далее» button read like a caption, not a stub.
  'sport-ball': { path: 'products/gallery/sport-ball-alt.webp', label: 'Сверху — ниппель и швы' },
  'sport-skate': { path: 'products/gallery/sport-skate-alt.webp', label: 'Снизу — подвески и колёса' },
  'sport-dumbbell': { path: 'products/gallery/sport-dumbbell-alt.webp', label: 'Лёжа — гриф и диски' },
  'sport-racket': { path: 'products/gallery/sport-racket-alt.webp', label: 'Плашмя — струны и мяч' },
  'food-donut': { path: 'products/gallery/food-donut-alt.webp', label: 'Сверху — глазурь и дырка' },
  'food-icecream': { path: 'products/gallery/food-icecream-alt.webp', label: 'Сверху — три шарика' },
  'food-cake': { path: 'products/gallery/food-cake-alt.webp', label: 'Срез — слои и крем' },
  'laptop-air': { path: 'products/gallery/laptop-air-alt.webp', label: 'Сзади — крышка и порты' },
};

export function isTechTourItem(id: string): boolean {
  // A toy gets the photo tour exactly when a second real frame exists for it.
  // The earlier type whitelist (phones, ships, planes) only described the set
  // that had been shot at the time; the list itself is the source of truth.
  const item = ITEM_BY_ID[id];
  return item?.kind === 'toy' && Object.prototype.hasOwnProperty.call(ALTERNATES, id);
}

/** Start loading the second real photo as soon as the product is opened. */
export function warmTechTour(id: string): void {
  if (!isTechTourItem(id) || typeof document === 'undefined') return;
  const urls = [productPhotoUrl(id)];
  const alternate = ALTERNATES[id];
  if (alternate) urls.push(`${import.meta.env.BASE_URL}${alternate.path}`);
  for (const src of urls) {
    const image = document.createElement('img');
    image.decoding = 'async';
    image.src = src;
  }
}

export function TechTour({ id, alt }: { id: string; alt: string }) {
  const item = ITEM_BY_ID[id];
  const alternate = ALTERNATES[id];
  const [detail, setDetail] = useState(false);
  useEffect(() => setDetail(false), [id]);
  if (!item || !alternate || !isTechTourItem(id)) return null;

  const viewName = detail
    ? alternate.label
    : item.toy === 'phone' ? 'Задняя панель' : 'Общий вид';
  const nextView = detail ? 'общий вид' : alternate.label.toLowerCase();

  return (
    <div className="tech-tour" data-tech-tour={id}>
      <button
        type="button"
        className="tech-tour-stage"
        onClick={() => setDetail((value) => !value)}
        aria-label={`${viewName}. Нажми, чтобы увидеть ${nextView}`}
      >
        {!detail ? (
          <ProductPhoto key={`${id}-main`} id={id} alt={alt} className="tech-tour-photo" />
        ) : (
          <img
            key={`${id}-alternate`}
            className={`tech-tour-photo tech-tour-alt-photo${alternate.cutout ? ' is-cutout' : ''}`}
            src={`${import.meta.env.BASE_URL}${alternate.path}`}
            alt={`${alt}: ${alternate.label.toLowerCase()}`}
            width="1200"
            height="900"
            decoding="async"
            loading="eager"
            draggable={false}
          />
        )}
      </button>
      <div className="tech-tour-caption" aria-live="polite">
        <span>{viewName}</span>
        <span className="tech-tour-count">{detail ? '2' : '1'} / 2</span>
      </div>
      <div className="tech-tour-progress" aria-hidden="true"><i style={{ width: detail ? '100%' : '50%' }} /></div>
    </div>
  );
}
