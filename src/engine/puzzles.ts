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
}

export const COSTUMES: Costume[] = [
  {
    id: 'dark-lord',
    title: 'Тёмный лорд',
    desc: 'Шлем с дыхательной маской, красный светопосох',
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
];

export const COSTUME_BY_ID: Record<string, Costume> = Object.fromEntries(
  COSTUMES.map((c) => [c.id, c]),
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
      if (COSTUME_BY_ID[id] && typeof n === 'number' && Number.isFinite(n) && n > 0) {
        pieces[id] = Math.min(PUZZLE_SIZE, Math.floor(n));
      }
    }
  }
  const assembled = Array.isArray(r.assembled)
    ? [...new Set(r.assembled.filter((id): id is string => typeof id === 'string' && !!COSTUME_BY_ID[id]))]
    : [];
  for (const id of assembled) pieces[id] = PUZZLE_SIZE;
  const worn = typeof r.worn === 'string' && assembled.includes(r.worn) ? r.worn : null;
  const collecting =
    typeof r.collecting === 'string' && COSTUME_BY_ID[r.collecting] && !assembled.includes(r.collecting)
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
  return COSTUMES.filter((c) => !p.assembled.includes(c.id));
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
  const rest = COSTUMES.filter((c) => !assembled.includes(c.id));
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
  if (!COSTUME_BY_ID[id] || p.assembled.includes(id)) return p;
  return { ...p, collecting: id };
}

/** Надеть/снять собранный костюм; чужой или несобранный — без изменений. */
export function toggleWorn(prev: PuzzleState | undefined, id: string): PuzzleState {
  const p = normalizePuzzle(prev);
  if (!p.assembled.includes(id)) return p;
  return { ...p, worn: p.worn === id ? null : id };
}
