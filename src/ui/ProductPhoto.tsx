/**
 * Фотографии товаров (0.76.0): ультрареалистичные студийные снимки вместо
 * векторных «мультяшек».
 *
 * Зачем: на витрине ребёнок выбирает вещь глазами, и рисунок «домик-ёлочка»
 * рядом с фотографией машины выглядел как две разные игры. Теперь все товары
 * сняты в одной студии — мягкий свет сверху-слева, нейтральный серый задник,
 * мягкая тень под предметом, предмет целиком в кадре.
 *
 * Где живут файлы: `public/products/<id>.webp` — ровно те же id, что в
 * `engine/shop.ts`. Сборка: `scripts/make-product-images.mjs` (исходники
 * генерации — в `images-src/products/`, в git они не попадают).
 *
 * Почему отдельный компонент, а не ветка в `ToyArt`: фото показывает уже
 * готовая сцена со своим фоном, поэтому в нише витрины снимок занимает
 * площадь целиком (object-fit), а не «стоит на подиуме» как рисунок с
 * прозрачным фоном. См. `.shop-case-photo` в app.css.
 */

/**
 * Товары, у которых есть фото. Список — источник правды для витрины: файл
 * `public/products/<id>.webp` обязан существовать, иначе сборка теста падает
 * («фото товаров: у каждого id из списка есть файл»).
 *
 * 0.77.0 — питомцы, спорт и вкусняшки. Следующие шаги тем же конвейером
 * `scripts/make-product-images.mjs`: техника (авто, самолёты, корабли,
 * электроника) и базы.
 */
export const PRODUCT_PHOTOS: readonly string[] = [
  // Питомцы
  'pet-cat',
  'pet-bunny',
  'pet-panda',
  'pet-corgi',
  'pet-hamster',
  'pet-chihuahua',
  'pet-cat-siamese',
  'pet-cat-scottish',
  'pet-poodle',
  'pet-cat-british',
  'pet-cat-sphynx',
  'pet-cat-mainecoon',
  'pet-elephant',
  // Спорт
  'sport-ball',
  'sport-skate',
  'sport-dumbbell',
  'sport-racket',
  // Вкусняшки
  'food-donut',
  'food-kulich',
  'food-icecream',
  'food-cake',
  // Самолёты
  'plane-swift',
  'plane-electron-base',
  'plane-arctic-base',
  'plane-moon-base',
  'plane-atomic-base',
  'plane-steam-base',
];

const PHOTOS = new Set(PRODUCT_PHOTOS);

/** Есть ли у товара фотография (иначе рисуем прежний векторный арт). */
export function hasProductPhoto(id: string): boolean {
  return PHOTOS.has(id);
}

export function productPhotoUrl(id: string): string {
  return `${import.meta.env.BASE_URL}products/${id}.webp`;
}

/**
 * Тёплый старт большой картинки (подробная карточка, «Мечты», мир): скачивание
 * начинается в момент тапа по карточке — к развороту листа снимок уже в кэше и по
 * тапу не «долго грузится» (жалоба 2026-10-29). Загрузка стартует и без ссылки на
 * элемент в DOM.
 */
export function warmProductPhoto(id: string): void {
  if (!hasProductPhoto(id)) return;
  const img = document.createElement('img');
  img.decoding = 'async';
  img.src = productPhotoUrl(id);
}

/**
 * Фото товара. Размер задаёт контекст (CSS): ниша карточки, крупный лист в
 * подробной карточке, строка гардероба. `alt` пустой, если карточка уже
 * названа словами и фото декоративное.
 */
export function ProductPhoto({ id, alt, className }: { id: string; alt?: string; className?: string }) {
  if (!hasProductPhoto(id)) return null;
  return (
    <img
      className={`product-photo${className ? ` ${className}` : ''}`}
      src={productPhotoUrl(id)}
      width={1200}
      height={900}
      alt={alt ?? ''}
      draggable={false}
      decoding="async"
      loading="lazy"
    />
  );
}
