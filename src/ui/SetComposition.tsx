import { BUILDING_BY_ID } from '../engine/buildings';
import { ITEM_BY_ID } from '../engine/shop';
import { COSTUME_BY_ID } from '../engine/puzzles';
import type { BaseSet } from '../engine/base-sets';
import { ProductPhoto, hasProductPhoto } from './ProductPhoto';
import { Mascot } from './Mascot';

/**
 * Состав набора (0.89.8): что именно лежит внутри, картинками.
 *
 * Зачем: набор «Атом» продавался как лотерея. В листе были строка описания и
 * четыре эмодзи в ряд — по ним нельзя было понять, что получишь: база это
 * здание или открытка, а «машина Квант» — какая из машин. Ребёнок покупал за
 * четыре сотни кристаллов то, чего не видел.
 *
 * Теперь у каждой части своя плитка с её собственным снимком (база — фасад,
 * машина и самолёт — студийные фото) и подписью с настоящим названием товара.
 * Костюм снимать нечего: он существует только на БУКе, поэтому в его плитке —
 * сова в этом костюме, ровно та, которую ребёнок увидит после покупки.
 *
 * Плитки одного размера и с одинаковой рамкой: это «упаковочный лист», а не
 * фотогалерея, поэтому разный материал внутри читается как список вещей, а не
 * как смесь жанров в одном кадре.
 */
export type SetPartOwned = {
  base: boolean;
  car: boolean;
  plane: boolean;
  costume: boolean;
};

type Part = {
  key: 'base' | 'car' | 'plane' | 'costume';
  kind: string;
  title: string;
  owned: boolean;
  photoId?: string;
  costumeId?: string;
};

export function setParts(set: BaseSet, owned: SetPartOwned): Part[] {
  return [
    {
      key: 'base',
      kind: 'База',
      title: BUILDING_BY_ID[set.baseId]?.title ?? set.baseId,
      owned: owned.base,
      photoId: hasProductPhoto(set.baseId) ? set.baseId : undefined,
    },
    {
      key: 'car',
      kind: 'Машина',
      title: ITEM_BY_ID[set.carId]?.title ?? set.carId,
      owned: owned.car,
      photoId: hasProductPhoto(set.carId) ? set.carId : undefined,
    },
    {
      key: 'plane',
      kind: 'Самолёт',
      title: ITEM_BY_ID[set.planeId]?.title ?? set.planeId,
      owned: owned.plane,
      photoId: hasProductPhoto(set.planeId) ? set.planeId : undefined,
    },
    {
      key: 'costume',
      kind: 'Костюм',
      title: COSTUME_BY_ID[set.costumeId]?.title ?? set.costumeId,
      owned: owned.costume,
      costumeId: set.costumeId,
    },
  ];
}

export function SetComposition({ set, owned, stage = 1 }: { set: BaseSet; owned: SetPartOwned; stage?: number }) {
  const parts = setParts(set, owned);
  return (
    <ul className="set-parts" aria-label={`Что внутри набора «${set.title}»`}>
      {parts.map((part) => (
        <li key={part.key} className={`set-part${part.owned ? ' owned' : ''}`} data-part={part.key}>
          <span className="set-part-art">
            {part.photoId ? (
              <ProductPhoto id={part.photoId} alt={`${part.title} — фото товара`} className="set-part-photo" />
            ) : (
              <Mascot mood="idle" costumeId={part.costumeId} stage={stage} size={64} />
            )}
          </span>
          <span className="set-part-kind">{part.kind}</span>
          <span className="set-part-name">{part.title}</span>
          <span className="set-part-state">{part.owned ? 'уже есть ✓' : 'в наборе'}</span>
        </li>
      ))}
    </ul>
  );
}
