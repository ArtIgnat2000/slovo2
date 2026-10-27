// ── Тюнинг цвета купленных вещей и акцентов костюмов ───────────────────────
//
// Решение пользователя 2026-10-05 (разбор вариантов — docs/shop-tuning.md):
//  • красить можно то, что уже есть: купленные аксессуары и собранные костюмы;
//  • у каждой вещи 4 оттенка: базовый (ровно тот, что нарисован сегодня)
//    и три за TINT_PRICE;
//  • 1 💎 списывается один раз за оттенок, дальше переключение между открытыми
//    бесплатно; повторный выбор текущего и возврат к базовому стоят 0 💎;
//  • базовый оттенок в профиле не хранится: нет записи — значит база. Поэтому
//    старые профили и выгрузки читаются без миграции, а «потерять» базу нельзя.
//
// Аксессуары красятся целиком (3 цвета деталей), у костюмов меняется ТОЛЬКО
// акцент: свечение (визор, глаза, клинок, диадема — всё это в SVG рисуется через
// `c.glow`) и плащ, если он есть. Корпус и металл костюма не трогаем: это
// «личность» образа, заработанного уроками, а не покупка.
// Цвета деталей трактуют ui/MascotLook.tsx и ui/TintPicker.tsx; здесь правила,
// палитры и деньги.

import type { ShopState, ShopTuning } from '../types';
import { COSTUMES } from './puzzles';

/** Цена открытия одного нового оттенка. */
export const TINT_PRICE = 1;

/** id базового оттенка: в профиле не хранится (нет записи — значит база). */
export const BASE_TINT = 'base';

/** Общая часть любого оттенка: id и название для ребёнка (его читает скринридер). */
export interface TintOption {
  id: string;
  title: string;
}

/**
 * Оттенок аксессуара — три цвета деталей: [основной, тень, акцент].
 * Что именно красит каждый индекс, решает ui/MascotLook.tsx для своей вещи
 * (у некоторых вещей акцент не используется: бантик рисуется двумя цветами).
 */
export interface ItemTint extends TintOption {
  colors: [string, string, string];
}

/**
 * Оттенок костюма — акцент: `glow` красит все светящиеся детали и клинок,
 * `cape` — плащ у тех костюмов, где он есть (у остальных поля нет).
 */
export interface CostumeTint extends TintOption {
  glow: string;
  cape?: string;
}

export interface TintPalette<T extends TintOption = TintOption> {
  /** Базовый оттенок — бесплатный и всегда доступный */
  base: T;
  /** Оттенки, которые открываются за кристаллы (по одному) */
  extra: T[];
}

/**
 * Палитры аксессуаров. Базовые цвета обязаны совпадать с сегодняшней картинкой
 * в магазине: `tests/shop-tuning.test.ts` сверяет их со списком ожидаемых
 * значений, а смоук — с реальной отрисовкой SVG (стражи от «поехавшего» вида).
 */
export const TINT_PALETTES: Record<string, TintPalette<ItemTint>> = {
  cap: {
    base: { id: BASE_TINT, title: 'Синяя', colors: ['#3b82f6', '#2b6be0', '#ffd166'] },
    extra: [
      { id: 'red', title: 'Красная', colors: ['#ef4444', '#cf3131', '#ffd166'] },
      { id: 'green', title: 'Зелёная', colors: ['#34c77b', '#22a463', '#ffd166'] },
      { id: 'black', title: 'Чёрная', colors: ['#2f3245', '#22242f', '#ffd166'] },
    ],
  },
  grad: {
    base: { id: BASE_TINT, title: 'Чёрная', colors: ['#241f36', '#3a3352', '#f4a51a'] },
    extra: [
      { id: 'blue', title: 'Синяя', colors: ['#2b4b8f', '#1e3a73', '#ffd166'] },
      { id: 'red', title: 'Красная', colors: ['#8e2b3c', '#73202d', '#ffd166'] },
      { id: 'green', title: 'Зелёная', colors: ['#2f6b46', '#225235', '#ffd166'] },
    ],
  },
  glasses: {
    base: { id: BASE_TINT, title: 'Чёрные', colors: ['#241f36', '#241f36', '#78b4ff'] },
    extra: [
      { id: 'blue', title: 'Синие', colors: ['#2b6be0', '#1e50ad', '#9ec8ff'] },
      { id: 'red', title: 'Красные', colors: ['#e04a4a', '#b93535', '#ffc9c9'] },
      { id: 'gold', title: 'Золотые', colors: ['#e0a51f', '#b47f12', '#ffe6a8'] },
    ],
  },
  bow: {
    base: { id: BASE_TINT, title: 'Розовый', colors: ['#ff6fb5', '#ff4fa0', '#ffd166'] },
    extra: [
      { id: 'violet', title: 'Сиреневый', colors: ['#b48cff', '#9a6cf0', '#ffd166'] },
      { id: 'sky', title: 'Голубой', colors: ['#5fc9f8', '#3aa8dc', '#ffd166'] },
      { id: 'red', title: 'Красный', colors: ['#ef4444', '#cf3131', '#ffd166'] },
    ],
  },
  scarf: {
    base: { id: BASE_TINT, title: 'Красный', colors: ['#f43f5e', '#e03556', '#ffd166'] },
    extra: [
      { id: 'green', title: 'Зелёный', colors: ['#34c77b', '#22a463', '#ffd166'] },
      { id: 'blue', title: 'Синий', colors: ['#3b82f6', '#2b6be0', '#ffd166'] },
      { id: 'yellow', title: 'Жёлтый', colors: ['#f5c542', '#e0ac25', '#7c4a10'] },
    ],
  },
  medal: {
    base: { id: BASE_TINT, title: 'Золотая', colors: ['#3b82f6', '#f4a51a', '#e8901a'] },
    extra: [
      { id: 'silver', title: 'Серебряная', colors: ['#3b82f6', '#cfd8e6', '#9aa8bd'] },
      { id: 'bronze', title: 'Бронзовая', colors: ['#3b82f6', '#c98a5b', '#8d5c3a'] },
      { id: 'green', title: 'Зелёная лента', colors: ['#34c77b', '#f4a51a', '#e8901a'] },
    ],
  },

  // ── Техника (0.19.0): телефоны, машины, корабли ──────────────────────────
  // 0.21.1: машины нарисованы цветным карандашом, у каждой свой цвет кузова;
  // Те же три роли цвета, что у нарядов: [корпус, тень/стекло, акцент].
  // Красить можно только купленное; база — цвет, в котором машина нарисована.
  'phone-smart': {
    base: { id: BASE_TINT, title: 'Голубой', colors: ['#3b82f6', '#0f2a66', '#a7f3d0'] },
    extra: [
      { id: 'red', title: 'Красный', colors: ['#ef4444', '#7f1d1d', '#fde68a'] },
      { id: 'green', title: 'Зелёный', colors: ['#22c55e', '#14532d', '#bbf7d0'] },
      { id: 'black', title: 'Чёрный', colors: ['#334155', '#0f172a', '#cbd5e1'] },
    ],
  },
  'phone-flip': {
    base: { id: BASE_TINT, title: 'Розовый', colors: ['#ff6fb5', '#7a2048', '#ffe066'] },
    extra: [
      { id: 'violet', title: 'Сиреневый', colors: ['#b48cff', '#4c2a85', '#e9d5ff'] },
      { id: 'sky', title: 'Голубой', colors: ['#5fc9f8', '#0c4a6e', '#cffafe'] },
      { id: 'yellow', title: 'Жёлтый', colors: ['#f5c542', '#7c4a10', '#fff7cc'] },
    ],
  },
  'phone-retro': {
    base: { id: BASE_TINT, title: 'Красный', colors: ['#e63946', '#7f1d1d', '#ffe8c2'] },
    extra: [
      { id: 'green', title: 'Зелёный', colors: ['#2a9d8f', '#134e4a', '#e6fffb'] },
      { id: 'blue', title: 'Синий', colors: ['#3b82f6', '#1e3a8a', '#dbeafe'] },
      { id: 'black', title: 'Чёрный', colors: ['#2f3245', '#14151f', '#e2e8f0'] },
    ],
  },
  'car-racer': {
    base: { id: BASE_TINT, title: 'Красная', colors: ['#ef4444', '#1f2937', '#ffd166'] },
    extra: [
      { id: 'blue', title: 'Синяя', colors: ['#2563eb', '#0f172a', '#93c5fd'] },
      { id: 'green', title: 'Зелёная', colors: ['#16a34a', '#052e16', '#bef264'] },
      { id: 'yellow', title: 'Жёлтая', colors: ['#f5c542', '#3f2d05', '#ef4444'] },
    ],
  },
  'car-jeep': {
    base: { id: BASE_TINT, title: 'Зелёный', colors: ['#4d7c0f', '#1c2a0a', '#d9b382'] },
    extra: [
      { id: 'sand', title: 'Песочный', colors: ['#d4a373', '#4a3728', '#fef3c7'] },
      { id: 'blue', title: 'Синий', colors: ['#1d4ed8', '#0f172a', '#bfdbfe'] },
      { id: 'red', title: 'Красный', colors: ['#b91c1c', '#1f2937', '#fca5a5'] },
    ],
  },
  'car-taxi': {
    base: { id: BASE_TINT, title: 'Жёлтое', colors: ['#f5c542', '#1f2937', '#111827'] },
    extra: [
      { id: 'white', title: 'Белое', colors: ['#f8fafc', '#1f2937', '#111827'] },
      { id: 'black', title: 'Чёрное', colors: ['#334155', '#0b1120', '#f8fafc'] },
      { id: 'sky', title: 'Голубое', colors: ['#60a5fa', '#1e3a8a', '#f8fafc'] },
    ],
  },
  // ── Авто с характером (0.21.0; цвет и имена без брендов — 0.21.1) ────────
  // Цвета те же три роли, что у остальной техники: [кузов, стекло/тень, хром].
  // База — ровно тот цвет, в котором машина нарисована в public/cars/*.webp.
  'car-mercedes': {
    base: { id: BASE_TINT, title: 'Серебристый', colors: ['#cbd5e1', '#111827', '#e2e8f0'] },
    extra: [
      { id: 'black', title: 'Чёрный', colors: ['#1f2937', '#0b1220', '#e2e8f0'] },
      { id: 'blue', title: 'Синий', colors: ['#1e3a8a', '#0b1220', '#dbeafe'] },
      { id: 'white', title: 'Белый', colors: ['#f1f5f9', '#1f2937', '#cbd5e1'] },
    ],
  },
  'car-bmw': {
    base: { id: BASE_TINT, title: 'Синий', colors: ['#1d4ed8', '#0b1220', '#e2e8f0'] },
    extra: [
      { id: 'black', title: 'Чёрный', colors: ['#1f2937', '#080b12', '#cbd5e1'] },
      { id: 'red', title: 'Красный', colors: ['#dc2626', '#180608', '#f8fafc'] },
      { id: 'white', title: 'Белый', colors: ['#e8edf4', '#111827', '#94a3b8'] },
    ],
  },
  'car-brabus': {
    base: { id: BASE_TINT, title: 'Чёрный', colors: ['#151a23', '#0a0d13', '#e11d48'] },
    extra: [
      { id: 'grey', title: 'Серый', colors: ['#4b5563', '#0b0f16', '#f43f5e'] },
      { id: 'white', title: 'Белый', colors: ['#e5e7eb', '#111827', '#e11d48'] },
      { id: 'blue', title: 'Синий', colors: ['#1e3a8a', '#0a0d13', '#38bdf8'] },
    ],
  },
  'car-maybach': {
    base: { id: BASE_TINT, title: 'Чёрно-золотой', colors: ['#111827', '#0b1220', '#c9a227'] },
    extra: [
      { id: 'bordo', title: 'Бордовый', colors: ['#6b1f3a', '#16070c', '#e0b04a'] },
      { id: 'blue', title: 'Синий', colors: ['#1e2f5a', '#0a1226', '#d4af37'] },
      { id: 'green', title: 'Зелёный', colors: ['#143d2b', '#07120d', '#d4af37'] },
    ],
  },
  'car-rolls': {
    base: { id: BASE_TINT, title: 'Зелёный', colors: ['#0f3d33', '#08120f', '#d4af37'] },
    extra: [
      { id: 'black', title: 'Чёрный', colors: ['#111827', '#06090f', '#d4af37'] },
      { id: 'bordo', title: 'Бордовый', colors: ['#5b1a2b', '#16070c', '#e6c15a'] },
      { id: 'silver', title: 'Серебристый', colors: ['#cbd5e1', '#111827', '#e2e8f0'] },
    ],
  },
  'car-lambo': {
    base: { id: BASE_TINT, title: 'Зелёный', colors: ['#3fae2a', '#111827', '#e2e8f0'] },
    extra: [
      { id: 'yellow', title: 'Жёлтый', colors: ['#facc15', '#111827', '#e2e8f0'] },
      { id: 'orange', title: 'Оранжевый', colors: ['#ea580c', '#111827', '#fde68a'] },
      { id: 'black', title: 'Чёрный', colors: ['#1f2937', '#0b1220', '#f8fafc'] },
    ],
  },
  'car-bugatti': {
    base: { id: BASE_TINT, title: 'Синий', colors: ['#2563eb', '#0a1226', '#cbd5e1'] },
    extra: [
      { id: 'black', title: 'Чёрный', colors: ['#1f2937', '#06090f', '#cbd5e1'] },
      { id: 'red', title: 'Красный', colors: ['#b91c1c', '#1a0606', '#e5e7eb'] },
      { id: 'white', title: 'Белый', colors: ['#e2e8f0', '#111827', '#94a3b8'] },
    ],
  },
  'ship-paper': {
    base: { id: BASE_TINT, title: 'Белая с золотом', colors: ['#f8fafc', '#172033', '#c5a45b'] },
    extra: [
      { id: 'sky', title: 'Голубая', colors: ['#60a5fa', '#1e3a8a', '#f8fafc'] },
      { id: 'pink', title: 'Бордовая', colors: ['#9f1239', '#3f1022', '#f1d3a3'] },
      { id: 'yellow', title: 'Шампань', colors: ['#d6ad59', '#49391e', '#fff1c7'] },
    ],
  },
  'ship-sail': {
    base: { id: BASE_TINT, title: 'Синий', colors: ['#183b63', '#202b3b', '#ef673c'] },
    extra: [
      { id: 'red', title: 'Красный', colors: ['#b83232', '#32191d', '#f1b65b'] },
      { id: 'green', title: 'Зелёный', colors: ['#2f6854', '#172f2a', '#e9ae43'] },
      { id: 'white', title: 'Серебряный', colors: ['#d2d9e0', '#3b4654', '#f4a340'] },
    ],
  },
  'ship-steam': {
    base: { id: BASE_TINT, title: 'Тёмно-бирюзовый', colors: ['#164b4c', '#203b3b', '#c6813d'] },
    extra: [
      { id: 'red', title: 'Красный', colors: ['#a62d36', '#30171d', '#e2a24a'] },
      { id: 'green', title: 'Зелёный', colors: ['#2b573c', '#14271d', '#db9a39'] },
      { id: 'yellow', title: 'Золотой', colors: ['#aa7822', '#352913', '#fff0b8'] },
    ],
  },
  'ship-carrier': {
    base: { id: BASE_TINT, title: 'Стальной', colors: ['#59616a', '#252b34', '#e5b849'] },
    extra: [
      { id: 'blue', title: 'Синий', colors: ['#345b82', '#1c2b3b', '#f0bd50'] },
      { id: 'green', title: 'Оливковый', colors: ['#526044', '#242b21', '#e5b849'] },
      { id: 'red', title: 'Красный', colors: ['#7d3d3e', '#332124', '#f0c150'] },
    ],
  },
  'car-atomic-base': {
    base: { id: BASE_TINT, title: 'Кремовая с бирюзой', colors: ['#e8e2d5', '#263348', '#28b8d6'] },
    extra: [
      { id: 'blue', title: 'Космическая синяя', colors: ['#487bd3', '#122043', '#7cddff'] },
      { id: 'violet', title: 'Сиреневая', colors: ['#a887d6', '#29203d', '#f3bf67'] },
      { id: 'green', title: 'Изумрудная', colors: ['#5b9d78', '#1c443a', '#d4d968'] },
    ],
  },
  'car-electron-base': {
    base: { id: BASE_TINT, title: 'Белая с бирюзой', colors: ['#eef5f4', '#204956', '#2dced1'] },
    extra: [
      { id: 'blue', title: 'Синяя', colors: ['#387bc3', '#142e4a', '#8be3f3'] },
      { id: 'green', title: 'Мятная', colors: ['#73bdab', '#244e4a', '#ddc75b'] },
      { id: 'violet', title: 'Лавандовая', colors: ['#aaa1ce', '#34334e', '#5ed3d4'] },
    ],
  },
  'car-arctic-base': {
    base: { id: BASE_TINT, title: 'Ледяная с оранжевым', colors: ['#b6d2e0', '#2f5063', '#e98a3a'] },
    extra: [
      { id: 'blue', title: 'Полярная синяя', colors: ['#6eabd0', '#193a58', '#d6f5ff'] },
      { id: 'green', title: 'Хвойная', colors: ['#6b9587', '#223d3d', '#f0a33c'] },
      { id: 'red', title: 'Красная', colors: ['#c86a62', '#492c37', '#f0c36e'] },
    ],
  },
  'car-moon-base': {
    base: { id: BASE_TINT, title: 'Лунная серебряная', colors: ['#dce0e3', '#374151', '#c9a44f'] },
    extra: [
      { id: 'blue', title: 'Звёздная синяя', colors: ['#708cb5', '#1b2a43', '#e4cb86'] },
      { id: 'red', title: 'Марсианская', colors: ['#bd786a', '#442d33', '#d8b668'] },
      { id: 'green', title: 'Морская', colors: ['#75a9a0', '#253c43', '#d9bd72'] },
    ],
  },
  'plane-swift': {
    base: { id: BASE_TINT, title: 'Коралловый', colors: ['#e4573d', '#273750', '#ffc857'] },
    extra: [
      { id: 'blue', title: 'Синий', colors: ['#3979d1', '#1b3152', '#9be7ff'] },
      { id: 'green', title: 'Зелёный', colors: ['#319a72', '#17483d', '#e4d66e'] },
      { id: 'violet', title: 'Фиолетовый', colors: ['#8258bd', '#34264e', '#ffd166'] },
    ],
  },
  'plane-electron-base': {
    base: { id: BASE_TINT, title: 'Электрический синий', colors: ['#4d75df', '#26346f', '#4df0db'] },
    extra: [
      { id: 'red', title: 'Красный', colors: ['#cc5863', '#4a2939', '#8af7ff'] },
      { id: 'green', title: 'Зелёный', colors: ['#319b7d', '#174b4b', '#e4f274'] },
      { id: 'gold', title: 'Золотой', colors: ['#c19a40', '#4a3b2b', '#78f4dd'] },
    ],
  },
  'plane-arctic-base': {
    base: { id: BASE_TINT, title: 'Ледяной голубой', colors: ['#a8d9e9', '#426a88', '#53b9f0'] },
    extra: [
      { id: 'violet', title: 'Сиреневый лёд', colors: ['#a8b5e8', '#46517b', '#f1ffff'] },
      { id: 'green', title: 'Северное сияние', colors: ['#8ecdbd', '#365e68', '#b9ffde'] },
      { id: 'red', title: 'Экспедиционный', colors: ['#e59a83', '#68495a', '#fff0ca'] },
    ],
  },
  'plane-moon-base': {
    base: { id: BASE_TINT, title: 'Лунный металл', colors: ['#777b91', '#34394e', '#ffd166'] },
    extra: [
      { id: 'blue', title: 'Синяя орбита', colors: ['#6384bd', '#263650', '#b9efff'] },
      { id: 'red', title: 'Марсианский', colors: ['#b76c64', '#472d3a', '#f5ce80'] },
      { id: 'green', title: 'Изумрудная комета', colors: ['#6d9e8f', '#2a4649', '#ffe19b'] },
    ],
  },
  'plane-atomic-base': {
    base: { id: BASE_TINT, title: 'Атомный бирюзовый', colors: ['#2ca7ad', '#17475d', '#9aefb3'] },
    extra: [
      { id: 'blue', title: 'Ионный синий', colors: ['#4c82d3', '#20375e', '#9cfff1'] },
      { id: 'red', title: 'Плазменный', colors: ['#bf6670', '#492e45', '#ffe17c'] },
      { id: 'gold', title: 'Солнечный реактор', colors: ['#c19b48', '#51402a', '#aaf5c0'] },
    ],
  },

  // ── 0.70.0: украшения и крылья (docs/proposals/shop-girls-catalog.md, вариант A) ─
  // Индексы те же, что у старых вещей: [основной, тень/второй тон, акцент].
  // База — ровно то, что нарисовано в ui/MascotLook.tsx по умолчанию.
  'clips-stars': {
    base: { id: BASE_TINT, title: 'Золотые', colors: ['#f5c542', '#d99a15', '#fff6da'] },
    extra: [
      { id: 'pink', title: 'Розовые', colors: ['#ff6fa5', '#d94d80', '#ffe3ef'] },
      { id: 'blue', title: 'Голубые', colors: ['#5aa9f0', '#3577b8', '#e6f4ff'] },
      { id: 'silver', title: 'Серебряные', colors: ['#cdd6e2', '#98a4b6', '#ffffff'] },
    ],
  },
  wreath: {
    base: { id: BASE_TINT, title: 'Ромашковый', colors: ['#ffffff', '#f2c53d', '#4caf6a'] },
    extra: [
      { id: 'pink', title: 'Розовый', colors: ['#ffc2dd', '#f2a03d', '#4caf6a'] },
      { id: 'blue', title: 'Васильковый', colors: ['#a9c8ff', '#f2c53d', '#3f8a58'] },
      { id: 'lilac', title: 'Сиреневый', colors: ['#d9c2ff', '#f2c53d', '#5b9a70'] },
    ],
  },
  'hat-ribbon': {
    base: { id: BASE_TINT, title: 'Соломенная', colors: ['#e8cf95', '#c9a55e', '#ff6fa5'] },
    extra: [
      { id: 'white', title: 'С белой лентой', colors: ['#e8cf95', '#c9a55e', '#ffffff'] },
      { id: 'blue', title: 'С голубой лентой', colors: ['#e8cf95', '#c9a55e', '#6fb8ff'] },
      { id: 'red', title: 'С красной лентой', colors: ['#e8cf95', '#c9a55e', '#ef4444'] },
    ],
  },
  crown: {
    base: { id: BASE_TINT, title: 'Золотая', colors: ['#ffd76a', '#d9a520', '#ff6fa5'] },
    extra: [
      { id: 'silver', title: 'Серебряная', colors: ['#dfe7f2', '#a3b0c4', '#6fb8ff'] },
      { id: 'rose', title: 'Розовое золото', colors: ['#f6c1a8', '#cf8c6a', '#ff6fa5'] },
      { id: 'emerald', title: 'Изумрудная', colors: ['#ffd76a', '#d9a520', '#34c77b'] },
    ],
  },
  'glasses-heart': {
    base: { id: BASE_TINT, title: 'Розовые', colors: ['#ff5c8a', '#c93b66', '#ffd6e4'] },
    extra: [
      { id: 'violet', title: 'Сиреневые', colors: ['#a855f7', '#7c3aed', '#efe0ff'] },
      { id: 'red', title: 'Красные', colors: ['#ef4444', '#b91c1c', '#ffe0e0'] },
      { id: 'black', title: 'Чёрные', colors: ['#2f3245', '#1b1d28', '#dfe7f2'] },
    ],
  },
  'glasses-round': {
    base: { id: BASE_TINT, title: 'Золотые', colors: ['#c9a24a', '#9a7a2e', '#bfe3ff'] },
    extra: [
      { id: 'black', title: 'Чёрные', colors: ['#2f3245', '#1b1d28', '#cfe8ff'] },
      { id: 'silver', title: 'Серебряные', colors: ['#cdd6e2', '#98a4b6', '#dff0ff'] },
      { id: 'pink', title: 'Розовые', colors: ['#ff8fb1', '#d96a8c', '#ffe6f0'] },
    ],
  },
  choker: {
    base: { id: BASE_TINT, title: 'Бордовая', colors: ['#7b2d4a', '#5a1e35', '#ff7aab'] },
    extra: [
      { id: 'black', title: 'Чёрная', colors: ['#2b2b38', '#1a1a24', '#cdd6e2'] },
      { id: 'blue', title: 'Синяя', colors: ['#2b4b8f', '#1e3a73', '#8fc7ff'] },
      { id: 'green', title: 'Зелёная', colors: ['#2f6b46', '#225235', '#8ce9c4'] },
    ],
  },
  beads: {
    base: { id: BASE_TINT, title: 'Розовые', colors: ['#ff8fb1', '#d96a8c', '#ffd166'] },
    extra: [
      { id: 'pearl', title: 'Жемчужные', colors: ['#f4f1ea', '#d8d2c4', '#e8c74a'] },
      { id: 'blue', title: 'Голубые', colors: ['#7fb8f0', '#4d8ac9', '#ffd166'] },
      { id: 'green', title: 'Зелёные', colors: ['#6ecf9a', '#3f9c6b', '#ffd166'] },
    ],
  },
  bag: {
    base: { id: BASE_TINT, title: 'Сиреневый', colors: ['#b06ad9', '#8a4bb0', '#ffd166'] },
    extra: [
      { id: 'pink', title: 'Розовый', colors: ['#ff8fb1', '#d96a8c', '#ffd166'] },
      { id: 'red', title: 'Красный', colors: ['#e04a67', '#a82f47', '#ffd166'] },
      { id: 'black', title: 'Чёрный', colors: ['#33323f', '#1f1e28', '#cdd6e2'] },
    ],
  },
  'brooch-flower': {
    base: { id: BASE_TINT, title: 'Розовый', colors: ['#ff8fc0', '#d96a99', '#f5c542'] },
    extra: [
      { id: 'blue', title: 'Голубой', colors: ['#8fc4ff', '#5d93d1', '#f5c542'] },
      { id: 'lilac', title: 'Сиреневый', colors: ['#c9a2ff', '#9670d1', '#f5c542'] },
      { id: 'red', title: 'Красный', colors: ['#ff7a7a', '#d14f4f', '#f5c542'] },
    ],
  },
  'badge-cat': {
    base: { id: BASE_TINT, title: 'Персиковый', colors: ['#ffd9e6', '#f2a6c2', '#7a5cff'] },
    extra: [
      { id: 'grey', title: 'Дымчатый', colors: ['#d7dae3', '#a9aebd', '#7a5cff'] },
      { id: 'ginger', title: 'Рыжий', colors: ['#ffc178', '#e09a45', '#2f6b46'] },
      { id: 'black', title: 'Чёрный', colors: ['#4b4b5a', '#2a2a35', '#ffd166'] },
    ],
  },
  'wings-butterfly': {
    base: { id: BASE_TINT, title: 'Розовые', colors: ['#ff9ec7', '#c86a9b', '#ffe066'] },
    extra: [
      { id: 'blue', title: 'Голубые', colors: ['#8fc7ff', '#5a8fc9', '#ffe066'] },
      { id: 'violet', title: 'Сиреневые', colors: ['#c4a2ff', '#8f6ae0', '#ffe066'] },
      { id: 'gold', title: 'Золотые', colors: ['#ffd76a', '#d9a520', '#fff6da'] },
    ],
  },
  'wings-dragon': {
    base: { id: BASE_TINT, title: 'Изумрудные', colors: ['#6a8f4a', '#3f5c2c', '#e8c74a'] },
    extra: [
      { id: 'violet', title: 'Сиреневые', colors: ['#6a4a7a', '#432c50', '#e8c74a'] },
      { id: 'red', title: 'Багровые', colors: ['#8f3b3b', '#5c2020', '#e8c74a'] },
      { id: 'night', title: 'Ночные', colors: ['#3f4460', '#232741', '#8fd8ff'] },
    ],
  },
};

// ── Акценты костюмов ───────────────────────────────────────────────────────
// Набор цветов акцента: у каждого есть «глубокий» вариант для плаща, чтобы
// плащ читался как та же краска, а не как второй случайный цвет.

interface AccentColor {
  id: string;
  title: string;
  main: string;
  deep: string;
}

const ACCENT_COLORS: AccentColor[] = [
  { id: 'red', title: 'Красный', main: '#ff3b4d', deep: '#8f1a26' },
  { id: 'blue', title: 'Синий', main: '#3b82f6', deep: '#1d3f9e' },
  { id: 'green', title: 'Зелёный', main: '#34c77b', deep: '#186b41' },
  { id: 'violet', title: 'Сиреневый', main: '#a855f7', deep: '#5b21b6' },
  { id: 'gold', title: 'Золотой', main: '#ffd166', deep: '#a5761b' },
];

const ACCENT_BY_ID: Record<string, AccentColor> = Object.fromEntries(ACCENT_COLORS.map((a) => [a.id, a]));

/** Как называется базовое свечение костюма: hex → слово. */
const GLOW_NAMES: Record<string, string> = {
  '#ff3b4d': 'Красный',
  '#ff5a4d': 'Красный',
  '#3b82f6': 'Синий',
  '#7dd3fc': 'Голубой',
  '#ff9f0a': 'Оранжевый',
  '#ffffff': 'Белый',
  '#ffd166': 'Золотой',
  '#7dffb0': 'Зелёный',
  // 0.70.0: свечения «волшебных» костюмов
  '#ffe066': 'Золотой',
  '#8fd8ff': 'Голубой',
  '#7cf0d0': 'Бирюзовый',
  '#ffb3d9': 'Розовый',
};

/**
 * Три платных акцента каждого костюма. Подбираем так, чтобы цвет заметно
 * отличался от его собственного свечения (у «Тёмного лорда» с красным визором
 * нет «красного» варианта: платить за то же самое нельзя).
 */
const COSTUME_ACCENT_EXTRAS: Record<string, [string, string, string]> = {
  'dark-lord': ['blue', 'green', 'violet'],
  'snow-guard': ['red', 'green', 'gold'],
  'steel-keeper': ['blue', 'green', 'violet'],
  'light-master': ['red', 'green', 'violet'],
  'star-ranger': ['blue', 'green', 'violet'],
  'fighter-pilot': ['red', 'blue', 'green'],
  'brave-droid': ['red', 'green', 'violet'],
  'star-commander': ['red', 'blue', 'green'],
  'shadow-initiate': ['blue', 'green', 'violet'],
  'forest-sage': ['red', 'blue', 'violet'],
  // 0.70.0: «волшебные» костюмы (вариант A разбора интересов).
  fairy: ['blue', 'violet', 'gold'],
  sorceress: ['red', 'green', 'gold'],
  mermaid: ['violet', 'gold', 'green'],
  cat: ['blue', 'violet', 'gold'],
};

/**
 * Палитры костюмов собираются из самих костюмов (engine/puzzles.ts): базовый
 * акцент — это ровно их сегодняшние `glow` и `cape`, поэтому «поехать» от
 * правки палитры он не может. Число костюмов и extras сверяет тест.
 */
export const COSTUME_PALETTES: Record<string, TintPalette<CostumeTint>> = Object.fromEntries(
  COSTUMES.map((costume) => {
    const base: CostumeTint = {
      id: BASE_TINT,
      title: GLOW_NAMES[costume.glow.toLowerCase()] ?? 'Как есть',
      glow: costume.glow,
      ...(costume.cape ? { cape: costume.cape } : {}),
    };
    const extra: CostumeTint[] = (COSTUME_ACCENT_EXTRAS[costume.id] ?? []).map((accentId) => {
      const accent = ACCENT_BY_ID[accentId];
      return {
        id: accent.id,
        title: accent.title,
        glow: accent.main,
        ...(costume.cape ? { cape: accent.deep } : {}),
      };
    });
    return [costume.id, { base, extra }];
  }),
);

/** Палитра вещи или костюма; null — красить нечего. */
export function tintPalette(targetId: string): TintPalette | null {
  return TINT_PALETTES[targetId] ?? COSTUME_PALETTES[targetId] ?? null;
}

/** Оттенки: базовый первым — интерфейс рисует их в этом порядке. */
export function tintOptions(targetId: string): TintOption[] {
  const palette = tintPalette(targetId);
  return palette ? [palette.base, ...palette.extra] : [];
}

export function tintById(targetId: string, tintId: string): TintOption | null {
  return tintOptions(targetId).find((tint) => tint.id === tintId) ?? null;
}

/** Открытые оттенки (базовый открыт всегда и в списке не хранится). */
export function unlockedTints(tuning: ShopTuning | undefined, targetId: string): string[] {
  const palette = tintPalette(targetId);
  const list = tuning?.unlocked?.[targetId];
  if (!palette || !Array.isArray(list)) return [];
  return list.filter((id) => palette.extra.some((tint) => tint.id === id));
}

/** Текущий оттенок: из профиля, иначе базовый. null — красить нечего. */
export function currentTint(tuning: ShopTuning | undefined, targetId: string): TintOption | null {
  const palette = tintPalette(targetId);
  if (!palette) return null;
  const id = tuning?.current?.[targetId];
  if (!id || id === BASE_TINT) return palette.base;
  return tintById(targetId, id) ?? palette.base;
}

/** Цвета деталей аксессуара с учётом выбранного оттенка (для отрисовки). */
export function accessoryColors(
  targetId: string,
  tuning: ShopTuning | undefined,
): [string, string, string] | null {
  const palette = TINT_PALETTES[targetId];
  if (!palette) return null;
  const id = tuning?.current?.[targetId];
  const chosen = id && id !== BASE_TINT ? palette.extra.find((tint) => tint.id === id) : null;
  return (chosen ?? palette.base).colors;
}

/**
 * Цвет «карандаша» для полноцветных рисунков машин и кораблей.
 * Базовый оттенок — сам рисунок; выбранный платный оттенок ложится лёгким
 * цветным слоем и сохраняет штриховку, блики и светотень.
 */
export function artPencilTint(targetId: string, tuning: ShopTuning | undefined): string | null {
  const palette = TINT_PALETTES[targetId];
  if (!palette) return null;
  const id = tuning?.current?.[targetId];
  if (!id || id === BASE_TINT) return null;
  const chosen = palette.extra.find((tint) => tint.id === id);
  return chosen ? chosen.colors[0] : null;
}

/** Историческое имя API для рисунков машин; оставляем для совместимости. */
export const carPencilTint = artPencilTint;

/** Акцент костюма с учётом выбранного оттенка (для отрисовки). */
export function costumeAccent(
  targetId: string,
  tuning: ShopTuning | undefined,
): { glow: string; cape?: string } | null {
  const palette = COSTUME_PALETTES[targetId];
  if (!palette) return null;
  const id = tuning?.current?.[targetId];
  const chosen = id && id !== BASE_TINT ? palette.extra.find((tint) => tint.id === id) : null;
  const tint = chosen ?? palette.base;
  return tint.cape ? { glow: tint.glow, cape: tint.cape } : { glow: tint.glow };
}

/**
 * Два цвета для кружка палитры (градиент): основной и «глубокий».
 * У аксессуара это его первые два цвета, у костюма — свечение и плащ.
 */
export function tintSwatchColors(targetId: string, tintId: string): [string, string] {
  const accessory = TINT_PALETTES[targetId];
  if (accessory) {
    const tint = tintById(targetId, tintId) as ItemTint | null;
    const found = tint ?? accessory.base;
    return [found.colors[0], found.colors[1]];
  }
  const costume = COSTUME_PALETTES[targetId];
  const tint = tintById(targetId, tintId) as CostumeTint | null;
  const found = tint ?? costume?.base;
  if (!found) return ['#ffffff', '#cccccc'];
  return [found.glow, found.cape ?? found.glow];
}

export interface TintChoice {
  tint: TintOption;
  /** Открыт (базовый или уже купленный) — переключение бесплатно */
  unlocked: boolean;
  /** Сколько спишется прямо сейчас: 0 — открыт, иначе TINT_PRICE */
  price: number;
  /** Выбран сейчас */
  selected: boolean;
}

/** Что показать в палитре: оттенки с ценой и отметкой «выбран». */
export function tintChoices(tuning: ShopTuning | undefined, targetId: string): TintChoice[] {
  if (!tintPalette(targetId)) return [];
  const open = unlockedTints(tuning, targetId);
  const current = currentTint(tuning, targetId);
  return tintOptions(targetId).map((tint) => {
    const unlocked = tint.id === BASE_TINT || open.includes(tint.id);
    return { tint, unlocked, price: unlocked ? 0 : TINT_PRICE, selected: current?.id === tint.id };
  });
}

export type RecolorOutcome = 'switched' | 'opened' | 'nothing' | 'no-gems' | 'not-owned';

export interface RecolorResult {
  outcome: RecolorOutcome;
  /** Гардероб после операции (при отказе — нормализованный исходный) */
  shop: ShopState;
  /** Сколько кристаллов списать: 0 при отказе и при бесплатном переключении */
  spend: number;
}

/**
 * Санитизация тюнинга (старые профили, импорт резервных копий):
 * чужие id и краски недоступных вещей выкидываются; базовый оттенок не хранится;
 * если запись о текущем оттенке потерялась, а сам оттенок валиден — считаем его
 * купленным (оплаченную краску не отбираем).
 */
export function normalizeTuning(raw: unknown, available: string[] = []): ShopTuning {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ShopTuning>;
  const allowed = new Set(available);
  const unlocked: Record<string, string[]> = {};
  const rawUnlocked = r.unlocked && typeof r.unlocked === 'object' ? r.unlocked : {};
  for (const [targetId, ids] of Object.entries(rawUnlocked)) {
    const palette = tintPalette(targetId);
    if (!palette || !allowed.has(targetId) || !Array.isArray(ids)) continue;
    const list = [
      ...new Set(
        ids.filter((id): id is string => typeof id === 'string' && palette.extra.some((tint) => tint.id === id)),
      ),
    ];
    if (list.length) unlocked[targetId] = list;
  }
  const current: Record<string, string> = {};
  const rawCurrent = r.current && typeof r.current === 'object' ? r.current : {};
  for (const [targetId, id] of Object.entries(rawCurrent)) {
    const palette = tintPalette(targetId);
    if (!palette || !allowed.has(targetId) || typeof id !== 'string' || id === BASE_TINT) continue;
    if (!palette.extra.some((tint) => tint.id === id)) continue;
    unlocked[targetId] = [...new Set([...(unlocked[targetId] ?? []), id])];
    current[targetId] = id;
  }
  return { current, unlocked };
}

/**
 * Сменить цвет вещи или акцент костюма. Возвращает новый гардероб и сколько
 * списать:
 *  • 'switched' — оттенок уже открыт (или это база): 0 💎;
 *  • 'opened' — новый оттенок: ровно TINT_PRICE 💎;
 *  • 'nothing' — тот же цвет / нет палитры: без изменений;
 *  • 'no-gems' — на новый оттенок не хватает кристаллов: без изменений;
 *  • 'not-owned' — вещь не куплена или костюм ещё не собран: красить нечего.
 */
export function recolor(
  shop: ShopState | undefined,
  gems: number,
  targetId: string,
  tintId: string,
  assembled: string[] = [],
): RecolorResult {
  const owned = Array.isArray(shop?.owned) ? shop.owned : [];
  const equipped = shop?.equipped && typeof shop.equipped === 'object' ? shop.equipped : {};
  const tuning = normalizeTuning(shop?.tuning, [...owned, ...assembled]);
  const base: ShopState = { owned, equipped, tuning };
  const refuse = (outcome: RecolorOutcome): RecolorResult => ({ outcome, shop: base, spend: 0 });

  const accessory = TINT_PALETTES[targetId];
  const costume = COSTUME_PALETTES[targetId];
  if (!accessory && !costume) return refuse('nothing');
  if (accessory && !owned.includes(targetId)) return refuse('not-owned');
  if (costume && !assembled.includes(targetId)) return refuse('not-owned');
  if (!tintById(targetId, tintId)) return refuse('nothing');
  if (currentTint(tuning, targetId)?.id === tintId) return refuse('nothing');

  const current = { ...tuning.current };
  if (tintId === BASE_TINT) delete current[targetId];
  else current[targetId] = tintId;

  const isBase = tintId === BASE_TINT;
  if (isBase || unlockedTints(tuning, targetId).includes(tintId)) {
    return {
      outcome: 'switched',
      shop: { ...base, tuning: { current, unlocked: tuning.unlocked } },
      spend: 0,
    };
  }
  if (!Number.isFinite(gems) || gems < TINT_PRICE) return refuse('no-gems');
  const unlocked = { ...tuning.unlocked, [targetId]: [...(tuning.unlocked[targetId] ?? []), tintId] };
  return {
    outcome: 'opened',
    shop: { ...base, tuning: { current, unlocked } },
    spend: TINT_PRICE,
  };
}
