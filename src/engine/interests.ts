// ── Интересы ребёнка ────────────────────────────────────────────────────────
//
// Зачем это здесь, а не «пол» в профиле.
//
// Разбор 2026-10-26 (docs/proposals/shop-girls-catalog.md) показал: витрина
// отвечала только на «люблю технику». Лечение — не полка «для девочек», а
// вопрос о том, что ребёнку нравится, и порядок полок под ответ. Два следствия:
//
//  • в профиле нет и не должно быть пола: интерес — это выбор ребёнка, он
//    меняется в любой момент и ничего не «закрепляет» за ним;
//  • интересы двигают порядок полок и подсказку героя-цели, но НЕ скрывают
//    товары: спрятать технику от девочки было бы той же ошибкой, что сегодняшний
//    перекос, только в другую сторону.
//
// Модуль чистый: ни React, ни стора, ни магазина — иначе порядок полок нельзя
// будет проверить тестом.

/** Сколько интересов можно выбрать. Два — «это про меня», три уже список. */
export const MAX_INTERESTS = 2;

export interface Interest {
  id: string;
  title: string;
  emoji: string;
  /** Одна строка для плитки выбора — чем этот интерес оборачивается в игре */
  hint: string;
  /**
   * Полки магазина (id из ShopScreen), которые этот интерес поднимает вверх.
   * Порядок внутри массива — приоритет: первая полка встаёт раньше.
   */
  shelves: string[];
}

/**
 * Шесть интересов. Они специально «широкие»: «Животные» и «Дом» выбирают и
 * девочки, и мальчики, а «Техника» никуда не исчезает — просто перестаёт быть
 * единственным содержанием витрины.
 */
export const INTERESTS: Interest[] = [
  {
    id: 'animals',
    title: 'Животные',
    emoji: '🐾',
    hint: 'Котики, лисёнок, совёнок — и костюм кошки',
    shelves: ['costumes', 'outfits'],
  },
  {
    id: 'outfits',
    title: 'Наряды',
    emoji: '🎩',
    hint: 'Корона, бантики, бусы и крылья',
    shelves: ['outfits', 'costumes'],
  },
  {
    id: 'magic',
    title: 'Волшебство',
    emoji: '✨',
    hint: 'Фея, волшебница, звёздные фоны',
    shelves: ['costumes', 'backgrounds', 'outfits'],
  },
  {
    id: 'home',
    title: 'Дом и уют',
    emoji: '🏠',
    hint: 'Гирлянда, тёплые фоны, свой уголок',
    shelves: ['backgrounds', 'outfits'],
  },
  {
    id: 'music',
    title: 'Музыка',
    emoji: '🎵',
    hint: 'Треки для уроков и звуки ответа',
    shelves: ['music', 'sounds'],
  },
  {
    id: 'tech',
    title: 'Техника',
    emoji: '🚗',
    hint: 'Машины, телефоны, корабли',
    shelves: ['toys'],
  },
];

const BY_ID: Record<string, Interest> = Object.fromEntries(INTERESTS.map((i) => [i.id, i]));

export function isInterestId(value: unknown): value is string {
  return typeof value === 'string' && value in BY_ID;
}

export function interestById(id: string | undefined | null): Interest | null {
  return (id && BY_ID[id]) || null;
}

/**
 * Санитизация того, что пришло из профиля или файла выгрузки: только известные
 * id, без дублей, не больше MAX_INTERESTS. Мусор не ломает чтение — просто
 * получается пустой список, то есть обычный порядок витрины.
 */
export function normalizeInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (!isInterestId(item) || out.includes(item)) continue;
    out.push(item);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

/**
 * Тап по плитке: выбрать, снять, а при переполнении — вытеснить самый старый.
 * Вытеснение, а не «нельзя нажать»: у ребёнка 7 лет запрет без объяснения
 * читается как поломка, а тихая замена — как «ну ладно, теперь так».
 */
export function toggleInterest(current: string[], id: string): string[] {
  if (!isInterestId(id)) return normalizeInterests(current);
  const list = normalizeInterests(current);
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [...list, id].slice(-MAX_INTERESTS);
}

/**
 * Порядок полок: сначала полки выбранных интересов (в порядке выбора), затем
 * все остальные в исходном порядке. Ничего не теряется — только порядок.
 */
export function orderByInterests<T extends { id: string }>(shelves: T[], interests: string[]): T[] {
  const chosen = normalizeInterests(interests);
  if (!chosen.length) return shelves;
  const priority: string[] = [];
  for (const id of chosen) {
    for (const shelf of interestById(id)!.shelves) {
      if (!priority.includes(shelf)) priority.push(shelf);
    }
  }
  const rank = (shelf: string) => {
    const index = priority.indexOf(shelf);
    return index === -1 ? priority.length : index;
  };
  // Сортировка стабильная (Array.prototype.sort в ES2019 обязана быть такой),
  // поэтому внутри одной «ступени» сохраняется исходный порядок витрины.
  return [...shelves].sort((a, b) => rank(a.id) - rank(b.id));
}

/** Что написать над витриной, когда интересы выбраны: одна короткая строка. */
export function interestsSummary(interests: string[]): string | null {
  const list = normalizeInterests(interests);
  if (!list.length) return null;
  return list
    .map((id) => interestById(id))
    .filter((i): i is Interest => !!i)
    .map((i) => `${i.emoji} ${i.title}`)
    .join(' · ');
}
