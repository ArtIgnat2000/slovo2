// ── Костюмные пазлы ────────────────────────────────────────────────────────
//
// Идея из родительского чата (по мотивам собирательных событий Duolingo):
// за каждый реально пройденный урок — +1 фрагмент пазла; 9 фрагментов —
// костюм для БУКа. Решения (PLAN, 2026-10-01):
//  • тема — нейтральная «космическая сага», без имён и логотипов Disney;
//  • один «текущий» костюм: ребёнок выбирает, что собирает; фрагменты хранятся
//    по костюмам, смена цели не теряет прогресс (в отличие от случайных кусочков —
//    никаких «недостающий 7-й не идёт недели»);
//  • «Повторение» фрагментов не даёт (как и короны: это тренировка, а не урок);
//  • вся коллекция собрана → перелив: вместо фрагмента +2 💎 за урок.
// Чистая логика без React; палитра костюмов кормит Mascot.tsx, слоя шлемов — MascotLook.tsx.

import type { PuzzleState } from '../types';

/** Фрагментов на один костюм. */
export const PUZZLE_SIZE = 9;
/** Кристаллов за урок, когда все костюмы уже собраны. */
export const OVERFLOW_GEMS = 2;

export interface Costume {
  id: string;
  title: string;
  /** Как объяснить ребёнку — просто и с характером */
  desc: string;
  /** Палитра туловища БУКа (Mascot.tsx): тело/живот/крылья-уши-лапки */
  body: string;
  belly: string;
  wing: string;
  /** Цвет шлема/капюшона и «металла» */
  trim: string;
  /** Светящиеся детали: визор, клинок, диадема */
  glow: string;
  helmet: 'mask' | 'lord-mask' | 'visor' | 'hood' | 'bubble' | 'dome' | 'plate' | 'buns' | 'ears' | null;
  prop: 'saber-red' | 'saber-blue' | 'saber-green' | 'cane' | null;
  /** Цвет плаща, если есть */
  cape?: string;
  /** Кристальный костюм в стиле научной базы (engine/buildings.ts); у пазловых костюмов поля нет. */
  baseStyle?: string;
  /** Цена в кристаллах — только у кристальных костюмов баз. */
  price?: number;
  /** Редкость — только у кристальных костюмов баз. */
  rarity?: 'common' | 'cool' | 'legendary' | 'top';
}

export const COSTUMES: Costume[] = [
  {
    id: 'dark-lord',
    title: 'Тёмный лорд',
    desc: 'Полный шлем с решёткой-респиратором и красным светопосохом',
    body: '#3a3352',
    belly: '#6f679a',
    wing: '#241f36',
    trim: '#141225',
    glow: '#ff3b4d',
    helmet: 'lord-mask',
    prop: 'saber-red',
    cape: '#7a1f3c',
  },
  {
    id: 'snow-guard',
    title: 'Белый воин',
    desc: 'Снежно-белая броня и синий визор',
    body: '#e9eef7',
    belly: '#ffffff',
    wing: '#c3cee2',
    trim: '#f4f7fc',
    glow: '#3b82f6',
    helmet: 'visor',
    prop: null,
  },
  {
    id: 'steel-keeper',
    title: 'Стальной страж',
    desc: 'Тёмный доспех, красные глаза',
    body: '#6d7484',
    belly: '#a8b0c0',
    wing: '#4c5261',
    trim: '#3c4250',
    glow: '#ff5a4d',
    helmet: 'mask',
    prop: null,
  },
  {
    id: 'light-master',
    title: 'Мастер Света',
    desc: 'Тёплое одеяние и синий светопосох',
    body: '#c9a06a',
    belly: '#efdcc0',
    wing: '#a97e46',
    trim: '#8a6a3e',
    glow: '#7dd3fc',
    helmet: 'hood',
    prop: 'saber-blue',
  },
  {
    id: 'star-ranger',
    title: 'Звёздный рейнджер',
    desc: 'Шлем с антенной и посох-компас',
    body: '#4e5d52',
    belly: '#93a291',
    wing: '#3c483f',
    trim: '#6fa389',
    glow: '#ff9f0a',
    helmet: 'dome',
    prop: 'cane',
  },
  {
    id: 'fighter-pilot',
    title: 'Пилот истребителя',
    desc: 'Оранжевый костюм и стеклянный шлем',
    body: '#ff8f3c',
    belly: '#ffd9ae',
    wing: '#e8721f',
    trim: '#dfe9f7',
    glow: '#ffffff',
    helmet: 'bubble',
    prop: null,
  },
  {
    id: 'brave-droid',
    title: 'Храбрый дроид',
    desc: 'Бееп! Сине-белый корпус с панелями',
    body: '#5b8fd6',
    belly: '#dfe9f7',
    wing: '#3f6cb0',
    trim: '#2b6be0',
    glow: '#7dd3fc',
    helmet: 'plate',
    prop: null,
  },
  {
    id: 'star-commander',
    title: 'Командир звёзд',
    desc: 'Белая форма, розовый плащ, диадема',
    body: '#e8ddfa',
    belly: '#ffffff',
    wing: '#cdb9ef',
    trim: '#8a6a3e',
    glow: '#ffd166',
    helmet: 'buns',
    prop: null,
    cape: '#ff6fb5',
  },
  {
    id: 'shadow-initiate',
    title: 'Ученик Тьмы',
    desc: 'Тёмно-красный капюшон и красный клинок',
    body: '#5a1f2e',
    belly: '#8a3a4e',
    wing: '#431522',
    trim: '#3a0f1c',
    glow: '#ff3b4d',
    helmet: 'hood',
    prop: 'saber-red',
  },
  {
    id: 'forest-sage',
    title: 'Лесной мудрец',
    desc: 'Зелёные перья, длинные уши, светлячок',
    body: '#82b06f',
    belly: '#c9e3b8',
    wing: '#5f8f50',
    trim: '#5f8f50',
    glow: '#7dffb0',
    helmet: 'ears',
    prop: 'saber-green',
  },
  // ── 0.70.0: «волшебные» костюмы (docs/proposals/shop-girls-catalog.md, вариант A) ──
  // Пул пазлов был целиком «боевой сагой»: шлемы, доспехи, светопосохи. Костюм —
  // это девять уроков, то есть самая длинная цель в приложении, и девочке в этом
  // пуле выбирать было нечего. Новые четыре образа собраны из УЖЕ существующих
  // примитивов (buns, hood, dome, ears) и реквизита cane, поэтому новых картинок
  // и новых пропов не требуют — только палитры.
  {
    id: 'fairy',
    title: 'Фея',
    desc: 'Два пучка, мятное платье и светящаяся палочка',
    body: '#bfe9d6',
    belly: '#eaf9f0',
    wing: '#8ed6b8',
    trim: '#7cc9a6',
    glow: '#ffe066',
    helmet: 'buns',
    prop: 'cane',
  },
  {
    id: 'sorceress',
    title: 'Волшебница',
    desc: 'Звёздный колпак, мантия с луной и посох',
    body: '#5a4a8f',
    belly: '#b9a9e8',
    wing: '#463a73',
    trim: '#cdbcf5',
    glow: '#8fd8ff',
    helmet: 'hood',
    prop: 'cane',
    cape: '#5b21b6',
  },
  {
    id: 'mermaid',
    title: 'Русалка',
    desc: 'Стеклянный купол, бирюзовый хвост и жемчужное свечение',
    body: '#3f9fb5',
    belly: '#cdf2f7',
    wing: '#2f7f95',
    trim: '#8fe3f0',
    glow: '#7cf0d0',
    helmet: 'dome',
    prop: null,
  },
  {
    id: 'cat',
    title: 'Кошка',
    desc: 'Ушки, мягкие лапки и розовое свечение — мурр',
    body: '#8a8199',
    belly: '#efe6f2',
    wing: '#6a6178',
    trim: '#f2a6c2',
    glow: '#ffb3d9',
    helmet: 'ears',
    prop: null,
  },
];

/** Пазловые костюмы: собираются по фрагментам за уроки (исходный COSTUMES). */
export const PUZZLE_COSTUMES = COSTUMES;

/**
 * Кристальные костюмы научных баз (0.70.0, перенос из Slovo_Developer):
 * каждый привязан к своей базе (`baseStyle`) и покупается за кристаллы
 * отдельно или в составе набора базы (engine/base-sets.ts). В пазловый
 * прогресс уроков они НЕ попадают — иначе платный костюм можно было бы
 * «собрать» бесплатно фрагментами.
 */
export const BASE_COSTUMES: Costume[] = [
  { id: 'atomic-suit', title: 'Хранитель атома', desc: 'Защитный скафандр с голубым энергосердцем — в цвет ядерной базы', body: '#4778a8', belly: '#b5e4ff', wing: '#28527e', trim: '#d9f3ff', glow: '#4ddcff', helmet: 'dome', prop: null, baseStyle: 'atomic-base', price: 90, rarity: 'top' },
  { id: 'electron-suit', title: 'Повелитель импульса', desc: 'Солнечный костюм с сияющими линиями электронных схем', body: '#4d9d82', belly: '#c4f4d8', wing: '#34745f', trim: '#d9fff0', glow: '#72ffbd', helmet: 'plate', prop: null, baseStyle: 'electron-base', price: 85, rarity: 'legendary' },
  { id: 'arctic-suit', title: 'Полярный исследователь', desc: 'Тёплый костюм для экспедиций среди льдов и северного сияния', body: '#86b7d4', belly: '#e6f8ff', wing: '#5c8eae', trim: '#f1fbff', glow: '#70eaff', helmet: 'bubble', prop: null, baseStyle: 'arctic-base', price: 95, rarity: 'legendary' },
  { id: 'moon-suit', title: 'Лунный первооткрыватель', desc: 'Серебристый скафандр с золотым светом далёких звёзд', body: '#aaa4c8', belly: '#f1edff', wing: '#817b9f', trim: '#fff5d6', glow: '#ffd166', helmet: 'dome', prop: null, baseStyle: 'moon-base', price: 100, rarity: 'top' },
  // 0.76.0: костюм базы паровозов — медные очки, кожаный шлем и тёплый свет топки.
  { id: 'steam-suit', title: 'Машинист пара', desc: 'Кожаный шлем с медными очками и фонарём: такой костюм согреет у самого горячего котла', body: '#a9663a', belly: '#f0d3a1', wing: '#6b3d20', trim: '#ffe2a8', glow: '#ff9e3d', helmet: 'plate', prop: null, baseStyle: 'steam-base', price: 95, rarity: 'legendary' },
  // ── Особые костюмы (0.72.0): по просьбам детей — героиня в горошек и титан ─
  { id: 'lady-bug', title: 'Леди Баг', desc: 'Красный костюм в чёрный горошек и маска героини', body: '#e11d48', belly: '#fb7185', wing: '#be123c', trim: '#111827', glow: '#111827', helmet: 'buns', prop: null, price: 75, rarity: 'cool' },
  { id: 'titan', title: 'Титан', desc: 'Стальной гигант, которого не сдвинуть с места', body: '#94a3b8', belly: '#cbd5e1', wing: '#64748b', trim: '#334155', glow: '#f97316', helmet: 'plate', prop: null, price: 110, rarity: 'top' },
];

/** Все костюмы БУКа: пазловые + кристальные баз. */
export const ALL_COSTUMES: Costume[] = [...COSTUMES, ...BASE_COSTUMES];
/** Синоним для витрины: костюмы, которые продаются за кристаллы. */
export const CRYSTAL_COSTUMES = BASE_COSTUMES;

export const COSTUME_BY_ID: Record<string, Costume> = Object.fromEntries(
  ALL_COSTUMES.map((c) => [c.id, c]),
);

/** Иток одного завершённого урока для пазлов (сначала «piece», потом «assembled», потом «gems»). */
export interface PuzzleAward {
  event: 'piece' | 'assembled' | 'gems';
  /** Костюм, к которому относится событие; для «gems» — null */
  costumeId: string | null;
  /** Сколько фрагментов стало у текущего костюма (после начисления) */
  pieces: number;
  /** Кристаллы к балансу (перелив) */
  gems: number;
}

const EMPTY: PuzzleState = { pieces: {}, collecting: null, assembled: [], worn: null };

/**
 * Санитизация состояния (старые профили, импорт резервных копий):
 * неизвестные id выкидываются, числа клампятся в 0..PUZZLE_SIZE,
 * «надеть» можно только собранный костюм.
 */
export function normalizePuzzle(raw: unknown): PuzzleState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY, pieces: {} };
  const r = raw as Partial<PuzzleState>;
  const pieces: Record<string, number> = {};
  if (r.pieces && typeof r.pieces === 'object') {
    for (const [id, n] of Object.entries(r.pieces)) {
      if (PUZZLE_COSTUMES.some((c) => c.id === id) && typeof n === 'number' && Number.isFinite(n) && n > 0) {
        pieces[id] = Math.min(PUZZLE_SIZE, Math.floor(n));
      }
    }
  }
  const assembled = Array.isArray(r.assembled)
    ? [...new Set(r.assembled.filter((id): id is string => typeof id === 'string' && PUZZLE_COSTUMES.some((c) => c.id === id)))]
    : [];
  for (const id of assembled) pieces[id] = PUZZLE_SIZE;
  // Надетым может быть и кристальный костюм базы: принадлежность проверяет
  // стор при надевании (shop.crystalCostumesOwned), здесь — только известный id.
  const worn =
    typeof r.worn === 'string' && !!COSTUME_BY_ID[r.worn] && (assembled.includes(r.worn) || BASE_COSTUMES.some((c) => c.id === r.worn))
      ? r.worn
      : null;
  const collecting =
    typeof r.collecting === 'string' && PUZZLE_COSTUMES.some((c) => c.id === r.collecting) && !assembled.includes(r.collecting)
      ? r.collecting
      : null;
  return { pieces, collecting, assembled, worn };
}

/** Фрагменты костюма (0..PUZZLE_SIZE); собранный всегда считается полным. */
export function costumeProgress(p: PuzzleState | undefined, id: string): number {
  if (!p) return 0;
  if (p.assembled.includes(id)) return PUZZLE_SIZE;
  return Math.max(0, Math.min(PUZZLE_SIZE, p.pieces[id] ?? 0));
}

/** Костюмы, которые ещё не собраны. */
export function collectableCostumes(p: PuzzleState): Costume[] {
  return PUZZLE_COSTUMES.filter((c) => !p.assembled.includes(c.id));
}

/** Текущая цель сборки: выбранный и ещё не собранный костюм, иначе первый свободный. */
export function activeCostume(p: PuzzleState): string | null {
  const free = collectableCostumes(p);
  return p.collecting && free.some((c) => c.id === p.collecting) ? p.collecting : (free[0]?.id ?? null);
}

/**
 * Завершённый урок (не «Повторение») — вызывается из стора.
 * Возвращает новое состояние и иток для экрана результатов:
 *  • 'piece' — фрагмент принесён, сборки ещё не хватает;
 *  • 'assembled' — 9-й фрагмент: костюм разблокирован и сразу надет,
 *    сборка автоматически продолжается со следующим несобранным;
 *  • 'gems' — вся коллекция собрана: перелив 💎, пазлы не «сгорают».
 */
export function awardLessonPiece(prev: PuzzleState | undefined): { puzzle: PuzzleState; award: PuzzleAward } {
  const p = normalizePuzzle(prev);
  const free = collectableCostumes(p);
  if (!free.length) {
    return { puzzle: p, award: { event: 'gems', costumeId: null, pieces: PUZZLE_SIZE, gems: OVERFLOW_GEMS } };
  }
  const current = activeCostume(p)!;
  const pieces = costumeProgress(p, current) + 1;
  if (pieces < PUZZLE_SIZE) {
    return {
      puzzle: { ...p, collecting: current, pieces: { ...p.pieces, [current]: pieces } },
      award: { event: 'piece', costumeId: current, pieces, gems: 0 },
    };
  }
  const assembled = [...p.assembled, current];
  const rest = PUZZLE_COSTUMES.filter((c) => !assembled.includes(c.id));
  return {
    puzzle: {
      ...p,
      pieces: { ...p.pieces, [current]: PUZZLE_SIZE },
      collecting: rest[0]?.id ?? null,
      assembled,
      worn: current, // награда сразу видна: БУК надевает костюм
    },
    award: { event: 'assembled', costumeId: current, pieces: PUZZLE_SIZE, gems: 0 },
  };
}

/** Сменить цель сборки (только на ещё не собранный костюм). */
export function chooseCollecting(prev: PuzzleState | undefined, id: string): PuzzleState {
  const p = normalizePuzzle(prev);
  if (!PUZZLE_COSTUMES.some((c) => c.id === id) || p.assembled.includes(id)) return p;
  return { ...p, collecting: id };
}

/** Надеть/снять собранный костюм; чужой или несобранный — без изменений. */
/** Надеть/снять костюм; кристальный — только если он куплен (`crystalOwned`). */
export function toggleWorn(prev: PuzzleState | undefined, id: string, crystalOwned: string[] = []): PuzzleState {
  const p = normalizePuzzle(prev);
  if (!p.assembled.includes(id) && !crystalOwned.includes(id)) return p;
  return { ...p, worn: p.worn === id ? null : id };
}
