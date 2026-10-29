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
import { ALL_COSTUMES, COSTUMES, type Costume, costumeProgress, normalizePuzzle, activeCostume } from './puzzles';
import { MUSIC_TRACKS, type MusicTrack } from './music';

/** Полка витрины: наряды или техника. Костюмы/музыка/звуки живут отдельно. */
export type ShopItemKind = 'outfit' | 'toy';

/** Разделы техники в магазине и ангаре: авто, самолёты, корабли и электроника. */
export type ToyKind = 'car' | 'plane' | 'ship' | 'phone' | 'pet' | 'sport' | 'food';

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
  /** Редкость вещи. Без поля редкость считается по цене (см. rarityOf). */
  rarity?: ItemRarity;
  /** Для техники баз — id базы, в стиле которой сделана вещь (engine/buildings.ts). */
  baseStyle?: string;
  /**
   * Серия вещи, если она пришла из отдельной линейки (0.74.0: `naash` —
   * форма школы). Полка серии фильтрует каталог по метке, а не заводит
   * второй список товаров: правила покупки у всех вещей общие.
   */
  series?: ShopSeries;
}

/** Линейки товаров, которые живут отдельной полкой витрины. */
export type ShopSeries = 'naash';

/** Редкость вещи: обычная, крутая, легендарная или ТОПОВАЯ. */
export type ItemRarity = 'common' | 'cool' | 'legendary' | 'top';

export const RARITY_LABEL: Record<ItemRarity, string> = {
  common: 'Обычная',
  cool: 'Крутая',
  legendary: 'Легендарная',
  top: 'ТОПОВАЯ',
};

/** Порядок редкостей от низкой к высокой. */
export const RARITY_ORDER: ItemRarity[] = ['common', 'cool', 'legendary', 'top'];

/**
 * Редкость вещи: явная из каталога, иначе — по цене в кристаллах:
 * обычная — до 30 💎, крутая — 31–60, легендарная — 61–85, ТОПОВАЯ — от 86.
 */
export function rarityOf(item: ShopItem): ItemRarity {
  if (item.rarity) return item.rarity;
  if (item.price >= 86) return 'top';
  if (item.price >= 61) return 'legendary';
  if (item.price >= 31) return 'cool';
  return 'common';
}

/** Сортировка по редкости по возрастанию, при равной — по цене. */
export function compareByRarity(a: ShopItem, b: ShopItem): number {
  const byRarity = RARITY_ORDER.indexOf(rarityOf(a)) - RARITY_ORDER.indexOf(rarityOf(b));
  return byRarity || a.price - b.price;
}

export const SLOT_TITLE: Record<ShopSlot, string> = {
  head: 'Головные уборы',
  face: 'Очки',
  neck: 'На шею',
  badge: 'Значки',
  back: 'Крылья',
  body: 'Платья и наряды',
  feet: 'Обувь',
  toy: 'Техника',
};

/** Полки техники: порядок и подписи для витрины. */
export const TOY_SHELVES: { id: ToyKind; title: string; emoji: string }[] = [
  { id: 'car', title: 'Авто', emoji: '🚗' },
  { id: 'plane', title: 'Самолёты', emoji: '✈️' },
  { id: 'ship', title: 'Корабли', emoji: '🚢' },
  { id: 'phone', title: 'Телефоны', emoji: '📱' },
  { id: 'pet', title: 'Питомцы', emoji: '🐾' },
  { id: 'sport', title: 'Спорт', emoji: '⚽' },
  { id: 'food', title: 'Вкусняшки', emoji: '🧁' },
];

export const SHOP_ITEMS: ShopItem[] = [
  // ── Наряды (полка «Наряды») ──────────────────────────────────────────────
  { id: 'cap', slot: 'head', kind: 'outfit', title: 'Кепка', desc: 'БУК становится спортивным', price: 20 },
  { id: 'bow', slot: 'neck', kind: 'outfit', title: 'Бантик', desc: 'Нарядный бант на шею', price: 20 },
  { id: 'scarf', slot: 'neck', kind: 'outfit', title: 'Шарфик', desc: 'Тёплый, как в январе', price: 30 },
  { id: 'glasses', slot: 'face', kind: 'outfit', title: 'Умные очки', desc: 'В таких всё видно правильно', price: 35 },
  { id: 'medal', slot: 'badge', kind: 'outfit', title: 'Медаль', desc: 'За то, что не сдаёшься', price: 45 },
  { id: 'grad', slot: 'head', kind: 'outfit', title: 'Шапочка магистра', desc: 'Самая умная шапка в совиной школе', price: 60 },
  // ── 0.70.0: украшения и крылья (docs/proposals/shop-girls-catalog.md, вариант A) ──
  // Разбор интересов: девочки 1–4 класса выбирают раскраски и «красивое» заметно
  // чаще мальчиков (Учи.ру-2026: 27 % против 8 %), а в каталоге на всю витрину был
  // один бантик. Цены держим в общей лестнице 15–110 💎: в каждом слоте есть вещь
  // за 15–25, чтобы новая полка начиналась с покупки «сегодня же».
  { id: 'clips-stars', slot: 'head', kind: 'outfit', title: 'Заколки-звёздочки', desc: 'Две звёздочки в перьях — совсем как у подруги', price: 15 },
  { id: 'wreath', slot: 'head', kind: 'outfit', title: 'Венок из ромашек', desc: 'Пахнет летом, хотя он из бумаги', price: 25 },
  { id: 'hat-ribbon', slot: 'head', kind: 'outfit', title: 'Шляпка с лентой', desc: 'Соломенная шляпка с атласной лентой', price: 35 },
  { id: 'crown', slot: 'head', kind: 'outfit', title: 'Корона', desc: 'Настоящая, с блестящими камешками', price: 70 },
  { id: 'glasses-heart', slot: 'face', kind: 'outfit', title: 'Очки-сердечки', desc: 'В таких всё выглядит милым', price: 30 },
  { id: 'glasses-round', slot: 'face', kind: 'outfit', title: 'Круглые очки', desc: 'Как у библиотекаря из сказки', price: 35 },
  { id: 'choker', slot: 'neck', kind: 'outfit', title: 'Лента на шею', desc: 'Бархатная лента с маленьким бантом', price: 20 },
  { id: 'beads', slot: 'neck', kind: 'outfit', title: 'Бусы', desc: 'Крупные, как у бабушки в шкатулке', price: 45 },
  { id: 'bag', slot: 'neck', kind: 'outfit', title: 'Сумочка', desc: 'Маленькая, с застёжкой-сердечком', price: 40 },
  { id: 'brooch-flower', slot: 'badge', kind: 'outfit', title: 'Брошь-цветок', desc: 'Расцветает, когда БУК радуется', price: 30 },
  { id: 'badge-cat', slot: 'badge', kind: 'outfit', title: 'Значок с котиком', desc: 'Котик машет лапой', price: 20 },
  // Крылья — новый слот `back`: они рисуются ПОД телом, поэтому видны и сзади,
  // и по краям силуэта. Самый заметный «вау» новой полки, и он же — общий с
  // мальчиками (крылья дракона берут не только девочки).
  { id: 'wings-butterfly', slot: 'back', kind: 'outfit', title: 'Крылья бабочки', desc: 'Крылья за спиной, ими можно махать', price: 60 },
  { id: 'wings-dragon', slot: 'back', kind: 'outfit', title: 'Крылья дракона', desc: 'Кожаные крылья с шипами по краю', price: 75 },
  // ── 0.72.0: платья, причёски, кулоны, браслеты, сумочки, туфли и коньки ───
  { id: 'hair-buns', slot: 'head', kind: 'outfit', title: 'Пучки с бантами', desc: 'Два весёлых пучка, как у героини мультика', price: 30 },
  { id: 'hair-ponytail', slot: 'head', kind: 'outfit', title: 'Хвостик', desc: 'Высокий хвостик с розовой резинкой', price: 25 },
  { id: 'hair-curls', slot: 'head', kind: 'outfit', title: 'Весёлые кудри', desc: 'Пружинки-кудри на всю голову', price: 35 },
  { id: 'glasses-sigma', slot: 'face', kind: 'outfit', title: 'Очки «Сигма»', desc: 'Чёрные угловатые очки самого уверенного вида', price: 45 },
  { id: 'pendant-heart', slot: 'neck', kind: 'outfit', title: 'Кулон-сердечко', desc: 'Сердечко на тонкой цепочке', price: 30 },
  { id: 'pendant-star', slot: 'neck', kind: 'outfit', title: 'Кулон-звёздочка', desc: 'Звёздочка, которая светится в темноте', price: 35 },
  { id: 'bag-pink', slot: 'neck', kind: 'outfit', title: 'Розовая сумочка', desc: 'Больше прежней и с бантом', price: 45 },
  { id: 'bracelet-beads', slot: 'badge', kind: 'outfit', title: 'Браслет с бусинами', desc: 'Разноцветные бусины на крыло', price: 25 },
  { id: 'bracelet-heart', slot: 'badge', kind: 'outfit', title: 'Браслет с сердечком', desc: 'Сердечко качается при ходьбе', price: 30 },
  { id: 'dress-pink', slot: 'body', kind: 'outfit', title: 'Розовое платье', desc: 'Пышное, с белым воротничком', price: 55 },
  { id: 'dress-star', slot: 'body', kind: 'outfit', title: 'Платье со звёздами', desc: 'Синее, а звёзды на нём настоящие', price: 65 },
  { id: 'dress-rainbow', slot: 'body', kind: 'outfit', title: 'Радужное платье', desc: 'Все цвета сразу — и все к лицу', price: 50 },
  { id: 'shoes-pink', slot: 'feet', kind: 'outfit', title: 'Розовые туфельки', desc: 'С бантиками и маленьким каблучком', price: 35 },
  { id: 'shoes-sparkle', slot: 'feet', kind: 'outfit', title: 'Блестящие туфли', desc: 'Сверкают, как у принцессы на балу', price: 45 },
  { id: 'skates-ice', slot: 'feet', kind: 'outfit', title: 'Коньки', desc: 'Белые ботинки и острые лезвия для льда', price: 40 },
  // ── 0.74.0: школа НААШ (docs/proposals/naash-shop.md) ────────────────────
  // Школьный уголок витрины. Вещи не «ещё четыре наряда»: их собирает метка
  // `series`, поэтому своя полка не потребовала второго каталога — покупка,
  // «Мечты», перекраска, сдача и выгрузка работают как у всех. Палитры красят
  // ткань и эмаль, знак школы — всегда в своих цветах (engine/tints.ts).
  { id: 'school-pin', slot: 'badge', kind: 'outfit', series: 'naash', title: 'Значок школы', desc: 'Эмалевый знак на лацкане — видно издалека', price: 15 },
  { id: 'school-cap', slot: 'head', kind: 'outfit', series: 'naash', title: 'Кепка школы', desc: 'Знак вышит на шести панелях, как на настоящей', price: 20 },
  { id: 'school-scarf', slot: 'neck', kind: 'outfit', series: 'naash', title: 'Шарф в триколоре', desc: 'Полоса в цветах знака, с бахромой', price: 30 },
  { id: 'school-hoodie', slot: 'body', kind: 'outfit', series: 'naash', title: 'Худи школы', desc: 'Футер цвета знака, знак на груди', price: 45 },
  // ── Техника (полка «Техника»): телефоны ─────────────────────────────────
  { id: 'phone-smart', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone Air', desc: 'Тонкий серебристый корпус, полированные грани и одна камера', price: 25 },
  { id: 'phone-flip', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 17', desc: 'Лавандовое стекло, сатиновые грани и две камеры', price: 30 },
  { id: 'phone-retro', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 17 Pro Max', desc: 'Оранжевый корпус, титановые грани и три объектива', price: 55 },
  // Современная электроника остаётся на полке «Телефоны».
  { id: 'phone-pro', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 17 Pro', desc: 'Глубокий синий металл и три камеры в квадратном блоке', price: 75 },
  // ── 0.72.0: линейка iPhone 18 ────────────────────────────────────────────
  { id: 'phone-18', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 18', desc: 'Новая бордовая линейка: глянцевое стекло и две камеры', price: 85 },
  { id: 'phone-18-air', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 18 Air', desc: 'Самый тонкий в линейке: светло-бордовый корпус и одна камера', price: 95 },
  { id: 'phone-18-pro', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 18 Pro', desc: 'Бордовый титановый корпус и три камеры', price: 120 },
  { id: 'phone-18-max', slot: 'toy', kind: 'toy', toy: 'phone', emoji: '📱', title: 'iPhone 18 Pro Max', desc: 'Как настоящий Pro Max: широкое плато камер на всю спинку, алюминиевый корпус и стеклянное окошко. Тёмно-бордовый, самый большой в линейке', price: 140 },
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
  // ── Машины научных баз (0.70.0, перенос из Slovo_Developer) ─────────────
  { id: 'car-atomic-base', slot: 'toy', kind: 'toy', toy: 'car', emoji: '⚛️', title: 'Квант', desc: 'Научный внедорожник для ядерной базы: защитный корпус, датчики на крыше и голубое энергоядро', price: 120, rarity: 'top', baseStyle: 'atomic-base' },
  { id: 'car-electron-base', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🔋', title: 'Импульс', desc: 'Тихий электрокар электронной базы: солнечная крыша и светящиеся линии схем', price: 100, rarity: 'legendary', baseStyle: 'electron-base' },
  { id: 'car-arctic-base', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🧊', title: 'Полярник', desc: 'Вездеход арктической базы: гусеницы, тёплая кабина и мачта датчиков', price: 115, rarity: 'legendary', baseStyle: 'arctic-base' },
  { id: 'car-moon-base', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🌙', title: 'Луноход', desc: 'Шестиколёсный ровер лунной базы: сетчатые колёса, солнечное крыло и камера-мачта', price: 140, rarity: 'top', baseStyle: 'moon-base' },
  // 0.76.0: техника базы паровозов — стимпанк, медь и пар.
  { id: 'car-steam-base', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚂', title: 'Огнедышащий', desc: 'Паровоз базы паровозов: медный котёл, латунный фонарь и клубы пара из трубы', price: 130, rarity: 'legendary', baseStyle: 'steam-base' },
  // ── Техника: самолёты (0.70.0, перенос из Slovo_Developer) ──────────────
  { id: 'plane-swift', slot: 'toy', kind: 'toy', toy: 'plane', emoji: '✈️', title: 'Стриж', desc: 'Манёвренный пассажирский джет: стреловидные крылья, два турбодвигателя и панорамная кабина', price: 90, rarity: 'cool' },
  { id: 'plane-electron-base', slot: 'toy', kind: 'toy', toy: 'plane', emoji: '🔋', title: 'Схемолёт', desc: 'Самолёт электронной базы с солнечными панелями и сияющими дорожками микросхем', price: 160, rarity: 'legendary', baseStyle: 'electron-base' },
  { id: 'plane-arctic-base', slot: 'toy', kind: 'toy', toy: 'plane', emoji: '🧊', title: 'Северный ветер', desc: 'Полярный исследовательский самолёт: морозостойкие крылья, датчики и снежинки на фюзеляже', price: 175, rarity: 'legendary', baseStyle: 'arctic-base' },
  { id: 'plane-moon-base', slot: 'toy', kind: 'toy', toy: 'plane', emoji: '🌙', title: 'Лунный орёл', desc: 'Серебристый высотный самолёт лунной базы с золотыми звёздами и лунными знаками', price: 200, rarity: 'top', baseStyle: 'moon-base' },
  { id: 'plane-atomic-base', slot: 'toy', kind: 'toy', toy: 'plane', emoji: '⚛️', title: 'Атомный дозор', desc: 'Самый редкий самолёт научного флота: атомная эмблема, турбины и бирюзовый энергоконтур', price: 230, rarity: 'top', baseStyle: 'atomic-base' },
  { id: 'plane-steam-base', slot: 'toy', kind: 'toy', toy: 'plane', emoji: '🚂', title: 'Паролёт', desc: 'Стимпанк-биплан базы паровозов: медные крылья, деревянный винт и латунные заклёпки', price: 190, rarity: 'legendary', baseStyle: 'steam-base' },
  // ── Техника: морские суда ────────────────────────────────────────────────
  // Старые id ship-paper/ship-sail/ship-steam сохраняем: так покупки,
  // избранный корабль и купленные оттенки в профилях не теряются при обновлении.
  { id: 'ship-paper', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🛥️', title: 'Морская яхта', desc: 'Быстрая яхта с несколькими палубами и просторной каютой', price: 55 },
  { id: 'ship-sail', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🚢', title: 'Контейнеровоз', desc: 'Перевозит контейнеры между морскими портами', price: 70 },
  { id: 'ship-steam', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🛳️', title: 'Супертанкер', desc: 'Огромное судно для перевозки нефти', price: 85 },
  { id: 'ship-carrier', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🛳️', title: 'Авианосец', desc: 'Военный корабль с длинной взлётной палубой', price: 100 },
  // ── 0.72.0: розовые машины, электромобиль, розовый танк и «Титаник» ───────
  { id: 'car-pink-cabrio', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Розовая машина', desc: 'Самая розовая машина города: её видно издалека', price: 60 },
  { id: 'car-pink-star', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Розовая звезда', desc: 'Розовый спорткар со звездой на капоте', price: 65 },
  { id: 'car-tesla', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Тесла', desc: 'Тихий электромобиль: огромный экран и двери-крылья', price: 95 },
  { id: 'car-pink-tank', slot: 'toy', kind: 'toy', toy: 'car', emoji: '🚗', title: 'Розовый танк', desc: 'Розовый бронированный вездеход с гусеницами и металлическим корпусом', price: 110, rarity: 'legendary' },
  { id: 'ship-titanic', slot: 'toy', kind: 'toy', toy: 'ship', emoji: '🛳️', title: 'Титаник', desc: 'Огромный лайнер с четырьмя трубами из прошлого века', price: 105, rarity: 'legendary' },
  // ── 0.72.0: питомцы ───────────────────────────────────────────────────────
  { id: 'pet-cat', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐱', title: 'Котёнок', desc: 'Мурчит и гоняется за клубком', price: 45 },
  { id: 'pet-bunny', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐰', title: 'Кролик', desc: 'Длинные уши и любовь к морковке', price: 40 },
  { id: 'pet-panda', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐼', title: 'Панда', desc: 'Спокойная и очень обнимательная', price: 55 },
  { id: 'pet-corgi', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐶', title: 'Корги', desc: 'Короткие лапы, длинные уши и вечная улыбка', price: 60 },
  // ── 0.73.0: ещё питомцы — собачки, хомяк, слонёнок и породы котов ────────
  { id: 'pet-hamster', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐹', title: 'Хомяк', desc: 'Щёки полны семечек — про запас', price: 25 },
  { id: 'pet-chihuahua', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐶', title: 'Чихуахуа', desc: 'Самая маленькая собачка и самые большие уши', price: 35 },
  { id: 'pet-cat-siamese', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐱', title: 'Сиамский кот', desc: 'Тёмные ушки и мордочка, глаза — как небо', price: 50 },
  { id: 'pet-cat-scottish', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐱', title: 'Шотландский кот', desc: 'Ушки сложены, характер спокойный', price: 50 },
  { id: 'pet-poodle', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐩', title: 'Пудель', desc: 'Кудрявая причёска, как у артиста цирка', price: 55 },
  { id: 'pet-cat-british', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐱', title: 'Британский кот', desc: 'Плюшевый и важный, как лорд', price: 55 },
  { id: 'pet-cat-sphynx', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐱', title: 'Сфинкс', desc: 'Без шерсти, зато с огромными ушами', price: 60 },
  { id: 'pet-cat-mainecoon', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐱', title: 'Мейн-кун', desc: 'Самый большой кот: грива и кисточки на ушах', price: 65 },
  { id: 'pet-elephant', slot: 'toy', kind: 'toy', toy: 'pet', emoji: '🐘', title: 'Слонёнок', desc: 'Маленький слон с большим хоботом', price: 75 },
  // ── 0.72.0: спортивный инвентарь ─────────────────────────────────────────
  { id: 'sport-ball', slot: 'toy', kind: 'toy', toy: 'sport', emoji: '⚽', title: 'Футбольный мяч', desc: 'Классический, чёрно-белый, для голов', price: 25 },
  { id: 'sport-skate', slot: 'toy', kind: 'toy', toy: 'sport', emoji: '🛹', title: 'Скейт', desc: 'Доска с яркими колёсами для трюков', price: 35 },
  { id: 'sport-dumbbell', slot: 'toy', kind: 'toy', toy: 'sport', emoji: '🏋️', title: 'Гантели', desc: 'Пара гантелей — БУК становится сильнее', price: 30 },
  { id: 'sport-racket', slot: 'toy', kind: 'toy', toy: 'sport', emoji: '🎾', title: 'Теннисная ракетка', desc: 'И мячик в придачу — играем на счёт', price: 35 },
  // ── 0.72.0: вкусняшки ─────────────────────────────────────────────────────
  { id: 'food-icecream', slot: 'toy', kind: 'toy', toy: 'food', emoji: '🍦', title: 'Мороженое', desc: 'Три шарика в хрустящем рожке', price: 15 },
  { id: 'food-donut', slot: 'toy', kind: 'toy', toy: 'food', emoji: '🍩', title: 'Пончик', desc: 'Розовая глазурь и цветная посыпка', price: 18 },
  { id: 'food-kulich', slot: 'toy', kind: 'toy', toy: 'food', emoji: '🧁', title: 'Куличик', desc: 'Праздничный, с белой шапкой глазури', price: 20 },
  { id: 'food-cake', slot: 'toy', kind: 'toy', toy: 'food', emoji: '🎂', title: 'Тортик', desc: 'Три яруса и свечки — загадывай желание', price: 30 },
];

export const ITEM_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

/** Наряды и техника — одним фильтром, чтобы витрина не смешивала полки. */
export const OUTFIT_ITEMS = SHOP_ITEMS.filter((item) => item.kind !== 'toy');
/** Наряды вне линеек — полка «Наряды» без вещей школьного уголка. */
export const CATALOG_OUTFITS = OUTFIT_ITEMS.filter((item) => !item.series);
/** Вещи линейки: сейчас это форма школы НААШ (0.74.0). */
export const SERIES_ITEMS = (series: ShopSeries) => SHOP_ITEMS.filter((item) => item.series === series);
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
  // Вещи линеек (0.74.0: форма школы) в общую лестницу не попадают: их полка
  // живёт отдельно, и «ближайшая цель» не должна вести на чужую витрину.
  const left = SHOP_ITEMS.filter((i) => (i.kind ?? 'outfit') === kind && !i.series && !isOwned(owned, i.id));
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
    ...ALL_COSTUMES.map((c) => c.id),
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

