import type { ItemRarity } from './shop';

/**
 * Каталог научных баз для витрины БУКа.
 * Базы стоят на участке, могут становиться фоном «Моего мира» и имеют редкость.
 */
export interface BuildingItem {
  id: string;
  title: string;
  desc: string;
  price: number;
  emoji: string;
  isBase: true;
  rarity: Extract<ItemRarity, 'legendary' | 'top'>;
}

export const BUILDINGS: BuildingItem[] = [
  {
    id: 'atomic-base',
    title: 'Ядерная база',
    desc: 'Фантастический научный центр с защитным куполом и атомной энергией',
    price: 260,
    emoji: '⚛️',
    isBase: true,
    rarity: 'top',
  },
  {
    id: 'electron-base',
    title: 'Электронная база',
    desc: 'Комплекс умных лабораторий, солнечных панелей и башен связи',
    price: 105,
    emoji: '🔋',
    isBase: true,
    rarity: 'legendary',
  },
  {
    id: 'arctic-base',
    title: 'Арктическая база',
    desc: 'Полярная научная станция среди айсбергов и северного сияния',
    price: 135,
    emoji: '🧊',
    isBase: true,
    rarity: 'legendary',
  },
  {
    id: 'moon-base',
    title: 'Лунная база',
    desc: 'Купольный научный городок на серебристой поверхности Луны',
    price: 140,
    emoji: '🌙',
    isBase: true,
    rarity: 'top',
  },
];

export const BUILDING_BY_ID: Record<string, BuildingItem> = Object.fromEntries(
  BUILDINGS.map((building) => [building.id, building]),
);

export const WORLD_BASES: BuildingItem[] = BUILDINGS;

/** Первая база для нового участка, если коллекция открыта целиком. */
export const DEFAULT_BUILDING_ID = 'atomic-base';

/** Чистит сохранённую коллекцию: оставляет известные id один раз и по порядку. */
export function normalizeBuildingsOwned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const result: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !BUILDING_BY_ID[value] || result.includes(value)) continue;
    result.push(value);
  }
  return result;
}

/** Активной на участке может быть только база, уже находящаяся в коллекции. */
export function normalizeActiveBuilding(raw: unknown, owned: string[]): string | null {
  return typeof raw === 'string' && BUILDING_BY_ID[raw] && owned.includes(raw) ? raw : null;
}

/** Для фона мира подходят только купленные базы. */
export function normalizeWorldBase(raw: unknown, owned: string[]): string | null {
  return typeof raw === 'string' && BUILDING_BY_ID[raw]?.isBase && owned.includes(raw) ? raw : null;
}

export function isBuildingOwned(owned: string[] | undefined, id: string): boolean {
  return Boolean(owned?.includes(id));
}
