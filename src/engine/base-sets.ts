import { BUILDING_BY_ID } from './buildings';
import { ITEM_BY_ID, type ItemRarity, RARITY_ORDER } from './shop';
import { COSTUME_BY_ID } from './puzzles';

/** A themed bundle contains one scientific base, matching car, airplane and costume. */
export interface BaseSet {
  id: string;
  baseId: string;
  carId: string;
  planeId: string;
  costumeId: string;
  title: string;
  desc: string;
  emoji: string;
  rarity: ItemRarity;
}

/** Набор выгоднее покупки по частям: скидка 25% от суммы недостающих частей. */
export const BASE_SET_PRICE_MULTIPLIER = 0.75;

export const BASE_SETS: BaseSet[] = [
  { id: 'atomic-set', baseId: 'atomic-base', carId: 'car-atomic-base', planeId: 'plane-atomic-base', costumeId: 'atomic-suit', title: 'Набор «Атом»', desc: 'Ядерная база, машина «Квант», самолёт «Атомный дозор» и костюм Хранителя атома', emoji: '⚛️', rarity: 'top' },
  { id: 'electron-set', baseId: 'electron-base', carId: 'car-electron-base', planeId: 'plane-electron-base', costumeId: 'electron-suit', title: 'Набор «Импульс»', desc: 'Электронная база, машина «Импульс», самолёт «Схемолёт» и костюм Повелителя импульса', emoji: '🔋', rarity: 'legendary' },
  { id: 'arctic-set', baseId: 'arctic-base', carId: 'car-arctic-base', planeId: 'plane-arctic-base', costumeId: 'arctic-suit', title: 'Набор «Полярный»', desc: 'Арктическая база, вездеход «Полярник», самолёт «Северный ветер» и костюм исследователя', emoji: '🧊', rarity: 'legendary' },
  { id: 'moon-set', baseId: 'moon-base', carId: 'car-moon-base', planeId: 'plane-moon-base', costumeId: 'moon-suit', title: 'Набор «Луна»', desc: 'Лунная база, машина «Луноход», самолёт «Лунный орёл» и костюм первооткрывателя', emoji: '🌙', rarity: 'top' },
  { id: 'steam-set', baseId: 'steam-base', carId: 'car-steam-base', planeId: 'plane-steam-base', costumeId: 'steam-suit', title: 'Набор «Пар»', desc: 'База паровозов, паровоз «Огнедышащий», биплан «Паролёт» и костюм Машиниста пара', emoji: '🚂', rarity: 'legendary' },
];

/** Sets are bundles: charge 75% of the combined cost of any missing components. */
export function baseSetPrice(
  set: BaseSet,
  ownedItems: string[],
  ownedBuildings: string[],
  assembledCostumes: string[],
): number {
  const missingPrices = [
    !ownedBuildings.includes(set.baseId) ? BUILDING_BY_ID[set.baseId]?.price ?? 0 : 0,
    !ownedItems.includes(set.carId) ? ITEM_BY_ID[set.carId]?.price ?? 0 : 0,
    !ownedItems.includes(set.planeId) ? ITEM_BY_ID[set.planeId]?.price ?? 0 : 0,
    !assembledCostumes.includes(set.costumeId) ? COSTUME_BY_ID[set.costumeId]?.price ?? 0 : 0,
  ];
  const total = missingPrices.reduce((sum, price) => sum + price, 0);
  return total > 0 ? Math.max(1, Math.round(total * BASE_SET_PRICE_MULTIPLIER)) : 0;
}

export function baseSetRarityIndex(set: BaseSet): number {
  return RARITY_ORDER.indexOf(set.rarity);
}
