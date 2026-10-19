import type { CSSProperties } from 'react';

/**
 * Автомобили мечты (0.21.0): карандашные рисунки настоящих моделей.
 *
 * До 0.21.0 машины рисовались кодом: общий силуэт седана и «фирменные приметы»
 * поверх него. Ребёнок узнавал марку по звёздочке или «ноздрям», но сам
 * автомобиль был условным — не той машиной, которую видно на улице.
 * Теперь у каждой вещи — свой рисунок конкретной модели, выполненный
 * графитом: ультрареалистичная карандашная техника (штриховка, блики хрома,
 * отражения в стёклах, тени под колёсами).
 *
 * Рисунки — файлы `public/cars/<id>.webp` с прозрачным фоном (сборка:
 * `scripts/make-car-images.mjs`, исходники лежат в `images-src/cars/` и в git
 * не попадают). Почему картинки, а не SVG:
 *
 * - ультрареализм — это тысячи полутонов и штрихов, в ручном SVG это мегабайты
 *   путей и «мультяшность»; растр честно передаёт карандаш;
 * - прозрачный фон и общая линия «пола» (низ рисунка у всех десяти машин
 *   на одной высоте) позволяют ставить машину на подиум витрины и рядом
 *   с БУКом без подгонки координат;
 * - PWA-pre-cache уже включает webp-файлы, поэтому рисунки работают офлайн.
 *
 * Файлы лежат в public, а URL собирается из `BASE_URL` — как у картинок слов
 * (`platform/word-images.ts`) и сундуков (`ui/ChestArt.tsx`). Так один и тот же
 * код работает и в корне превью, и по пути `/slovo2/` на GitHub Pages,
 * и в смоук-тестах, где нет загрузчика картинок.
 */

/** Что за машина на рисунке — подпись для карточки товара и alt. */
export const CAR_MODELS: Record<string, { model: string; note: string }> = {
  'car-mercedes': {
    model: 'Mercedes-Benz S-класс (W223)',
    note: 'Флагманский седан: трёхлучевая звезда, крупная решётка, хром по борту',
  },
  'car-bmw': {
    model: 'BMW M5 (F90)',
    note: 'Спортивный седан: длинный капот, «ноздри», M-обвес и четыре выхлопа',
  },
  'car-brabus': {
    model: 'Brabus 800 (Mercedes-AMG G 63)',
    note: 'Квадратный внедорожник: карбон на капоте, широкие арки, 23-дюймовые диски',
  },
  'car-maybach': {
    model: 'Mercedes-Maybach S 680 (X223)',
    note: 'Двухцветный лимузин: хромированная решётка с частыми ламелями, золотая нить',
  },
  'car-rolls': {
    model: 'Rolls-Royce Phantom VIII',
    note: '«Парфенон» на носу, «Дух экстаза» на капоте, почти вертикальное лобовое',
  },
  'car-lambo': {
    model: 'Lamborghini Aventador SVJ',
    note: 'Клин с антикрылом, Y-образные фары и огромные воздухозаборники',
  },
  'car-bugatti': {
    model: 'Bugatti Chiron',
    note: 'Подкова решётки, C-линия по борту, четыре квадратные фары с каждой стороны',
  },
  'car-racer': {
    model: 'Формула-1 (машина 2023 года)',
    note: 'Открытые колёса, антикрыло, halo над кокпитом',
  },
  'car-jeep': {
    model: 'Jeep Wrangler Rubicon',
    note: 'Семь прорезей решётки, круглая оптика, рама и внедорожные шины',
  },
  'car-taxi': {
    model: 'Ford Crown Victoria (такси Нью-Йорка)',
    note: 'Жёлтый седан с шашечками и фонариком на крыше',
  },
};

/** Есть ли для вещи карандашный рисунок настоящей модели. */
export function hasCarArt(id: string): boolean {
  return id in CAR_MODELS;
}

/** Название модели для подписи под рисунком. */
export function carModel(id: string): string | null {
  return CAR_MODELS[id]?.model ?? null;
}

/** URL рисунка: public/cars/<id>.webp с учётом базы сборки. */
export function carArtUrl(id: string): string | null {
  if (!hasCarArt(id)) return null;
  return `${import.meta.env.BASE_URL}cars/${id}.webp`;
}

/**
 * Рисунок машины.
 *
 * `tint` — цвет «цветного карандаша» поверх графита (тюнинг). Он накладывается
 * умножением и маскируется альфой самого рисунка: бумага вокруг машины
 * остаётся прозрачной, а штриховка и блики никуда не деваются. Без tint —
 * чистый графит, как на бумаге.
 *
 * Размер задаёт контекст (CSS): карточка витрины, полка техники, гардероб,
 * крупный лист в подробной карточке. Так один компонент обслуживает все места,
 * где раньше стоял SVG.
 */
export function CarArt({
  id,
  tint,
  alt,
  className,
}: {
  id: string;
  /** Цветной карандаш поверх графита; null/undefined — чистый графит. */
  tint?: string | null;
  /** Пустая строка — рисунок декоративный (карточка уже озвучена). */
  alt?: string;
  className?: string;
}) {
  const src = carArtUrl(id);
  if (!src) return null;
  const style = tint
    ? ({
        '--car-tint': tint,
        '--car-mask': `url("${src}")`,
      } as unknown as CSSProperties)
    : undefined;
  return (
    <span className={`car-art${className ? ` ${className}` : ''}`} style={style}>
      <img src={src} width={720} height={480} alt={alt ?? ''} draggable={false} decoding="async" loading="lazy" />
      {tint && <span className="car-art-wash" aria-hidden="true" />}
    </span>
  );
}
