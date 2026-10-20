// ── Магазин БУКа ────────────────────────────────────────────────────────────
//
// Пункт 4 плана: кристаллам нужна трата. Решение — «аксессуары БУКа»:
// ребёнок покупает шляпы/очки/шарфы и наряжает сову. Цены устроены так, что
// один день занятий (3 задания + сундук ≈ 24 💎) даёт простой аксессуар,
// а академическая шапочка — цель на пару дней. Картинки — в ui/MascotLook.tsx,
// здесь только правила и цены (чистая логика без React).
//
// 0.19.0: витрина стала магазином с полками, а к нарядам добавилась третья
// ветка — техника (авто, телефоны, корабли). Вещь живёт в слоте `toy`,
// её видно рядом с БУКом на главной, в уроках и в гардеробе. Каталог по-прежнему
// один: покупка, вишлист, тюнинг и выгрузка работают одинаково для всех вещей.

import type { PuzzleState, ShopSlot } from '../types';
import { COSTUMES, type Costume, costumeProgress, normalizePuzzle, activeCostume } from './puzzles';
import { MUSIC_TRACKS, type MusicTrack } from './music';

/** Полка витрины: наряды или техника. Костюмы/музыка/звуки живут отдельно. */
export type ShopItemKind = 'outfit' | 'toy';

/** Разделы техники в магазине и ангаре. Авто и корабли идут рядом, телефоны отдельно. */
export type ToyKind = 'car' | 'ship' | 'phone';

export interface ShopItem {
  id: string;
  slot: ShopSlot;
  title: string;
  /** Как объяснить покупку ребёнку — без канцелярита */
  desc: string;
  price: number;
  /** Наряд или техника. Без поля считается нарядом (старые данные/тесты). */
  kind?: ShopItemKind;
  /** Для техники — на какую подполку её ставить. */
  toy?: ToyKind;
  /** Эмодзи для диалогов и тостов (у нарядов её нет — там 🎩). */
  emoji?: string;
}

export const SLOT_TITLE: Record<ShopSlot, string> = {
  head: 'Головные уборы',
  face: 'Очки',
  neck: 'На шею',
  badge: 'Значки',
  toy: 'Техника',
};

/** Полки техники: порядок и подписи для витрины. */
export const TOY_SHELVES: { id: ToyKind; title: string; emoji: string }[] = [
  { id: 'car', title: 'Авто', emoji: '🚗' },
  { id: 'ship', title: 'Корабли', emoji: '🚢' },
  { id: 'phone', title: 'Телефоны', emoji: '📱' },
];

export const SHOP_ITEMS: ShopItem[] = [
  // ── Наряды (полка «Наряды») ──────────────────────────────────────────────
  { id: 'cap', slot: 'head', kind: 'outfit', title: 'Кепка', desc: 'БУК становится спортивным', price: 20 },
  { id: 'bow', slot: 'neck', kind: 'outfit', title: 'Бантик', desc: 'Нарядный бант на шею', price: 20 },
  { id: 'scarf', slot: 'neck', kind: 'outfit', title: 'Шарфик', desc: 'Тёплый, как в январе', price: 30 },
  { id: 'glasses', slot: 'face', kind: 'outfit', title: 'Умные очки', desc: 'В таких всё видно правильно', price: 35 },
  { id: 'medal', slot: 'badge', kind: 'outfit', title: 'Медаль', desc: 'За то, что не сдаёшься', price: 45 },
  { id: 'grad', slot: 'head', kind: 'outfit', title: 'Шапочка магистра', desc: 'Самая умная шапка в совиной школе', price: 60 },
  // ── Техника (полка «Техника»): телефоны ─────────────────────────────────
  { id: 'phone-smart', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone Air', desc: 'Тонкий серебристый корпус и одна камера. Нажми на телефон, чтобы увидеть экран', price: 25 },
  { id: 'phone-flip', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 17', desc: 'Лавандовое стекло и две камеры. Нажми на телефон, чтобы повернуть', price: 30 },
  { id: 'phone-retro', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 17 Pro Max', desc: 'Оранжевый корпус и три объектива. Поверни и рассмотри с другой стороны', price: 55 },
  // Современная электроника остаётся на полке «Телефоны».
  { id: 'phone-pro', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 17 Pro', desc: 'Глубокий синий металл и три камеры. Нажми на телефон, чтобы повернуть', price: 75 },
  { id: 'laptop-air', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '💻', title: 'Невесомый Air', desc: 'Тонкий серебристый ноутбук: настоящие клавиши, большой трекпад и яркий экран', price: 110 },
  { id: 'tv-cinema', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📺', title: 'Домашний кинотеатр', desc: 'Большой телевизор с тонкой рамкой: горное озеро на экране как живое', price: 95 },
  { id: 'headphones-max', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '🎧', title: 'Серебряный Max', desc: 'Наушники в стиле Apple: сетчатое оголовье, мягкие амбушюры и металлические чашки', price: 65 },
  // ── Техника: машины ──────────────────────────────────────────────────────
  { id: 'car-racer', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🏎️', title: 'Болид', desc: 'Гоночная машина: открытые колёса и антикрыло', price: 35 },
  { id: 'car-jeep', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚙', title: 'Скалолаз', desc: 'Квадратный внедорожник: семь прорезей и зубастые шины', price: 40 },
  { id: 'car-taxi', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚕', title: 'Жёлтый кэб', desc: 'Городское такси: шашечки и фонарик на крыше', price: 50 },
  // ── Авто с характером (0.21.0; цвет и имена без брендов — 0.21.1) ────────
  { id: 'car-mercedes', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Звезда', desc: 'Флагманский седан: звезда, хром, тишина салона', price: 55 },
  { id: 'car-bmw', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Стрела', desc: 'Спортивный седан: длинный капот и четыре выхлопа', price: 60 },
  { id: 'car-brabus', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Кубик', desc: 'Квадратный богатырь: карбон и огромные диски', price: 65 },
  { id: 'car-maybach', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Адмирал', desc: 'Двухцветный лимузин: чёрный верх и золотой низ', price: 70 },
  { id: 'car-rolls', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Лорд', desc: 'Парадный лимузин: огромная решётка и фигурка на капоте', price: 80 },
  { id: 'car-lambo', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Бык', desc: 'Зелёный суперкар: Y-фары и антикрыло', price: 85 },
  { id: 'car-bugatti', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Молния', desc: 'Голубой гиперкар: подкова решётки и C-линия по борту', price: 90 },
  // ── Техника: морские суда ────────────────────────────────────────────────
  // Старые id ship-paper/ship-sail/ship-steam сохраняем: так покупки,
  // избранный корабль и купленные оттенки в профилях не теряются при обновлении.
  { id: 'ship-paper', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🛥️', title: 'Морская яхта', desc: 'Быстрая яхта с несколькими палубами и просторной каютой', price: 55 },
  { id: 'ship-sail', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🚢', title: 'Контейнеровоз', desc: 'Перевозит контейнеры между морскими портами', price: 70 },
  { id: 'ship-steam', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🛳️', title: 'Супертанкер', desc: 'Огромное судно для перевозки нефти', price: 85 },
  { id: 'ship-carrier', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🛳️', title: 'Авианосец', desc: 'Военный корабль с длинной взлётной палубой', price: 100 },
];

export const ITEM_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

/** Наряды и техника — одним фильтром, чтобы витрина не смешивала полки. */
export const OUTFIT_ITEMS = SHOP_ITEMS.filter((item) => item.kind !== 'toy');
export const TOY_ITEMS = SHOP_ITEMS.filter((item) => item.kind === 'toy');

export function isToy(item: ShopItem): boolean {
  return item.kind === 'toy';
}

/**
 * Рисуется ли вещь на маскоте (0.22.0, docs/proposals/large-items-scene.md).
 *
 * Техника — НЕТ: машина на 40-пиксельном помощнике превращалась в цветную
 * кашу, корабль наползал на лапы, а слот `toy` один — коллекция из десятка
 * машин была невидима. Вся техника экспонируется в сцене «Ангар»
 * (ui/HangarScene.tsx), а `equipped.toy` с 0.22.0 означает «любимая вещь,
 * стоит на главном подиуме ангара». Наряды остаются на БУКе — они и рисовались
 * по размеру совы. Правило живёт в движке: будущие товары с `kind: 'toy'`
 * попадают в ангар автоматически, без правки картинок.
 */
export function showsOnBuk(item: ShopItem): boolean {
  return item.kind !== 'toy';
}

export function toysByShelf(kind: ToyKind): ShopItem[] {
  return TOY_ITEMS.filter((item) => item.toy === kind);
}

export function isOwned(owned: string[], id: string): boolean {
  return owned.includes(id);
}

export function isWearing(equipped: Partial<Record<ShopSlot, string>>, item: ShopItem): boolean {
  return equipped[item.slot] === item.id;
}

/** Хватает ли кристаллов. */
export function canBuy(item: ShopItem, gems: number): boolean {
  return gems >= item.price;
}

export function missingGems(item: ShopItem, gems: number): number {
  return Math.max(0, item.price - gems);
}

/** Сколько кристаллов уже вложено в гардероб — приятная цифра в шапке магазина. */
export function wardrobeValue(owned: string[]): number {
  return owned.reduce((sum, id) => sum + (ITEM_BY_ID[id]?.price ?? 0), 0);
}

/**
 * Сдача купленной вещи обратно (sell-back, «трейд-ин», 0.24.0;
 * анализ — docs/proposals/trade-in.md, вариант B).
 *
 * Ставка зависит от типа товара: наряды держат цену лучше
 * техники — как одежда и электроника на вторичном рынке.
 * Цена сдачи всегда строго меньше цены покупки, поэтому
 * цикл «купил → сдал» теряет часть кристаллов: фарм невозможен
 * по построению, механика возвращает лишь часть заработанного.
 */
export const SELL_RATE: Record<ShopItemKind, number> = {
  outfit: 0.5,
  toy: 0.3,
};

/** Сколько кристаллов вернётся при сдаче вещи обратно. */
export function sellPrice(item: ShopItem): number {
  return Math.floor(item.price * SELL_RATE[item.kind ?? 'outfit']);
}

/** Пороги роста БУКа по числу освоенных слов (см. журнал плана, пункт 5). */
export const GROWTH_STEPS = [12, 30, 60];

export interface GrowthStage {
  /** 0 — птенец, 1 — ученик, 2 — знаток, 3 — магистр */
  index: number;
  title: string;
  desc: string;
  /** Сколько слов освоено нужно для следующей ступени (null — уже максимум) */
  nextAt: number | null;
}

const STAGE_TITLES = ['Птенец', 'Ученик', 'Знаток', 'Магистр'];
const STAGE_DESC = [
  'Маленький БУК только учится — как и ты',
  'БУК вырос: у него появились ушки и твёрдый характер',
  'У БУКа вырос хвост из перьев — он многое помнит',
  'Мудрый БУК: он знает все словарные слова наизусть',
];

/**
 * Рост БУКа считаем по числу ОСВОЕННЫХ слов — это честная награда за знания,
 * а не за клики. Рост только вперёд: БУК не «уменьшается», если сделать перерыв
 * (для 2 класса наказание за пропуск — плохая механика).
 */
export function growthStage(mastered: number): GrowthStage {
  let index = 0;
  for (const step of GROWTH_STEPS) if (mastered >= step) index++;
  return {
    index,
    title: STAGE_TITLES[index],
    desc: STAGE_DESC[index],
    nextAt: index < GROWTH_STEPS.length ? GROWTH_STEPS[index] : null,
  };
}

/**
 * Самая дешёвая вещь, которой ещё нет: «Ещё 8 💎 — и купишь Шарфик».
 * Помогает ребёнку понять, зачем копить (в этом и смысл траты валюты).
 *
 * `kind` по умолчанию — наряды: герой живёт на полке «Наряды» и не должен
 * уводить ребёнка на вещь с другой полки. Техника выбирается отдельно.
 */
export function closestItem(owned: string[], kind: ShopItemKind = 'outfit'): ShopItem | null {
  const left = SHOP_ITEMS.filter((i) => (i.kind ?? 'outfit') === kind && !isOwned(owned, i.id));
  if (!left.length) return null;
  return left.reduce((best, i) => (i.price < best.price ? i : best), left[0]);
}

export type HeroTarget =
  | { kind: 'item'; item: ShopItem }
  | { kind: 'costume'; costume: Costume; progress: number }
  | { kind: 'track'; track: MusicTrack };

/**
 * Герой витрины (фаза 2 магазина): одна главная цель копления вместо десятков ценников.
 *
 * Приоритет выбора:
 * 1. Некупленный наряд БУКа с наименьшей ценой (closestItem, полка «Наряды»).
 * 2. Если все наряды куплены — собираемый сейчас или ближайший костюм (puzzle).
 * 3. Если все костюмы собраны — самый дешёвый некупленный музыкальный трек.
 * 4. Если абсолютно весь каталог собран — null («Весь гардероб собран ✨»).
 *
 * Техника в героя не попадает намеренно: это отдельная полка со своей витриной,
 * иначе «Ближайшая цель» на полке нарядов предлагала бы кораблик.
 */
export function resolveHero(
  owned: string[],
  puzzle?: PuzzleState | null,
  musicOwned?: string[],
): HeroTarget | null {
  const item = closestItem(owned, 'outfit');
  if (item) {
    return { kind: 'item', item };
  }

  if (puzzle) {
    const pz = normalizePuzzle(puzzle);
    const unassembled = COSTUMES.filter((c) => !pz.assembled.includes(c.id));
    if (unassembled.length > 0) {
      const active = activeCostume(pz);
      const target = (active && unassembled.find((c) => c.id === active)) || unassembled[0];
      return {
        kind: 'costume',
        costume: target,
        progress: costumeProgress(pz, target.id),
      };
    }
  }

  const unownedTracks = MUSIC_TRACKS.filter((t) => !(musicOwned ?? []).includes(t.id));
  if (unownedTracks.length > 0) {
    const cheapest = unownedTracks.reduce(
      (best, t) => (t.price < best.price ? t : best),
      unownedTracks[0],
    );
    return { kind: 'track', track: cheapest };
  }

  return null;
}

/**
 * Нормализация списка мечт (Wishlist 🤍):
 *  • убирает дубликаты;
 *  • отбрасывает неизвестные id (чужие версии или некорректные данные);
 *  • исключает купленные вещи, собранные костюмы и купленные треки (ребёнок не мечтает о своём);
 *  • возвращает пустой массив при некорректном входе.
 */
export function normalizeWishlist(
  raw: unknown,
  ownedItems: string[] = [],
  assembledCostumes: string[] = [],
  ownedTracks: string[] = [],
): string[] {
  if (!Array.isArray(raw)) return [];
  const validIds = new Set([
    ...SHOP_ITEMS.map((i) => i.id),
    ...COSTUMES.map((c) => c.id),
    ...MUSIC_TRACKS.map((t) => t.id),
  ]);
  const ownedSet = new Set([
    ...ownedItems,
    ...assembledCostumes,
    ...ownedTracks,
  ]);
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || !validIds.has(id)) continue;
    if (ownedSet.has(id)) continue;
    if (!result.includes(id)) {
      result.push(id);
    }
  }
  return result;
}

export function isWished(wishlist: string[] | undefined, id: string): boolean {
  return Boolean(wishlist && wishlist.includes(id));
}

