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
