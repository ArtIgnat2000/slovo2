/**
 * Два кадра одного наряда (0.89.0).
 *
 * Зачем: с 0.88.2 в репозитории лежат студийные фото нарядов, но витрина их не
 * показывала — карточка рисовала сову в этой вещи, а сама вещь на 96 px почти
 * не читалась («не нашёл очки и шляпу»). Здесь маленький просмотр пары:
 * главный кадр и второй, самостоятельный ракурс из `products/gallery/`.
 *
 * Почему отдельный файл, а не `PRODUCT_PHOTOS` в ProductPhoto.tsx: тот список
 * включает режим «фото вместо арта» целиком, а вместе с ним отключает
 * перекрашивание вещи (`canTint` в ShopScreen: фото — готовая сцена, палитра
 * по нему не рисуется). Наряды красить по-прежнему можно, поэтому пары живут
 * своим списком, а витрина спрашивает `hasOutfitPair`.
 *
 * Правило серии (docs/proposals/photo-series-plan.md): пара или ничего. Файлов
 * либо два, либо ни одного; второй кадр — другой ракурс, а не увеличенный кроп.
 * Это проверяет `npm run test:galleries` (tests/photo-plan.test.mjs): он же
 * требует, чтобы каждая полная пара в репозитории была подключена здесь.
 */
import { useEffect, useState } from 'react';
import { ITEM_BY_ID } from '../engine/shop';
import { productPhotoUrl } from './ProductPhoto';

/** Второй кадр пары: путь от `public/` и короткая подпись ракурса. */
type AlternateShot = { path: string; label: string };

/**
 * Полные пары нарядов. Ключ — id из `engine/shop.ts`. Порядок — как в каталоге.
 * Подписи короткие: они стоят под кадром рядом со счётчиком «1 / 2».
 */
export const OUTFIT_PAIRS: Record<string, AlternateShot> = {
  crown: { path: 'products/gallery/crown-alt.webp', label: 'Сзади-три четверти' },
  'glasses-heart': { path: 'products/gallery/glasses-heart-alt.webp', label: 'В профиль' },
  choker: { path: 'products/gallery/choker-alt.webp', label: 'Застёжка сзади' },
  cap: { path: 'products/gallery/cap-alt.webp', label: 'Сзади: регулировка' },
  bow: { path: 'products/gallery/bow-alt.webp', label: 'Сбоку: узел' },
  scarf: { path: 'products/gallery/scarf-alt.webp', label: 'Раскладка волной' },
  glasses: { path: 'products/gallery/glasses-alt.webp', label: 'В профиль' },
  medal: { path: 'products/gallery/medal-alt.webp', label: 'Оборот' },
  grad: { path: 'products/gallery/grad-alt.webp', label: 'Сверху сзади' },
  'clips-stars': { path: 'products/gallery/clips-stars-alt.webp', label: 'Раскрыты' },
  wreath: { path: 'products/gallery/wreath-alt.webp', label: 'Сзади: изнанка' },
  'hat-ribbon': { path: 'products/gallery/hat-ribbon-alt.webp', label: 'Сзади-сбоку' },
  'glasses-round': { path: 'products/gallery/glasses-round-alt.webp', label: 'В профиль' },
  beads: { path: 'products/gallery/beads-alt.webp', label: 'Раскладка дугой' },
  bag: { path: 'products/gallery/bag-alt.webp', label: 'Открыта: подкладка' },
  'brooch-flower': { path: 'products/gallery/brooch-flower-alt.webp', label: 'Оборот' },
};

/** Есть ли у наряда пара кадров. Только для вещей со слотом (kind: 'outfit'). */
export function hasOutfitPair(id: string): boolean {
  const item = ITEM_BY_ID[id];
  return item?.kind === 'outfit' && Object.prototype.hasOwnProperty.call(OUTFIT_PAIRS, id);
}

/**
 * Тёплый старт пары: оба кадра скачиваются в момент тапа по карточке, чтобы
 * лист открылся без «сначала размыто, потом резко».
 */
export function warmOutfitPair(id: string): void {
  if (!hasOutfitPair(id) || typeof document === 'undefined') return;
  const pair = OUTFIT_PAIRS[id];
  for (const src of [productPhotoUrl(id), `${import.meta.env.BASE_URL}${pair.path}`]) {
    const image = document.createElement('img');
    image.decoding = 'async';
    image.src = src;
  }
}

/**
 * Главный кадр пары для ниши витрины. Отдельный компонент, а не
 * `ProductPhoto`: тот пропускает только id из `PRODUCT_PHOTOS`, а наряды
 * живут своим списком пар (см. шапку файла).
 */
export function OutfitPhoto({ id, alt }: { id: string; alt: string }) {
  if (!hasOutfitPair(id)) return null;
  return (
    <img
      className="product-photo"
      src={productPhotoUrl(id)}
      width={1200}
      height={900}
      alt={alt}
      draggable={false}
      decoding="async"
      loading="lazy"
    />
  );
}

/**
 * Просмотр пары: кадр, подпись и счётчик. Тап по кадру переключает ракурс —
 * то же поведение, что у `TechTour`, чтобы витрина не учила двум жестам.
 */
export function OutfitPhotoTour({ id, alt }: { id: string; alt: string }) {
  const item = ITEM_BY_ID[id];
  const pair = OUTFIT_PAIRS[id];
  const [second, setSecond] = useState(false);
  useEffect(() => setSecond(false), [id]);
  if (!item || !pair || !hasOutfitPair(id)) return null;

  const viewName = second ? pair.label : 'Общий вид';
  const nextView = second ? 'общий вид' : pair.label.toLowerCase();

  return (
    <div className="photo-tour" data-photo-tour={id}>
      <button
        type="button"
        className="photo-tour-stage"
        onClick={() => setSecond((value) => !value)}
        aria-label={`${viewName}. Нажми, чтобы увидеть ${nextView}`}
      >
        {second ? (
          <img
            key={`${id}-second`}
            className="photo-tour-photo"
            src={`${import.meta.env.BASE_URL}${pair.path}`}
            alt={`${alt}: ${pair.label.toLowerCase()}`}
            width="1200"
            height="900"
            decoding="async"
            loading="eager"
            draggable={false}
          />
        ) : (
          <img
            key={`${id}-main`}
            className="photo-tour-photo"
            src={productPhotoUrl(id)}
            alt={alt}
            width="1200"
            height="900"
            decoding="async"
            loading="eager"
            draggable={false}
          />
        )}
      </button>
      <div className="photo-tour-caption" aria-live="polite">
        <span>{viewName}</span>
        <span className="photo-tour-count">{second ? '2' : '1'} / 2</span>
      </div>
      <div className="photo-tour-progress" aria-hidden="true">
        <i style={{ width: second ? '100%' : '50%' }} />
      </div>
    </div>
  );
}
