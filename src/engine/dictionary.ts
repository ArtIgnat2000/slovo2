import type { Word, WordState } from '../types';
import { MASTERED_SCORE } from './classes';
import { plural } from './word-facts';

/**
 * Ступень владения словом в детском словарике.
 *
 * Порядок `WORD_BUCKETS` — от гордости ребёнка («Знаю») к запасу («Новые»):
 *  • на широком экране слева направо сначала виден реальный результат, а в конце — запас;
 *  • на телефоне сверху оказываются слова, с которыми ребёнок уже работает, а не стена
 *    из десятков ещё не открытых карточек.
 */
export type WordBucket = 'good' | 'mid' | 'weak' | 'new';

export const WORD_BUCKETS: readonly WordBucket[] = ['good', 'mid', 'weak', 'new'];

/** Сколько слов показывать в колонке до кнопки «Показать все», когда открыты все колонки разом. */
export const COLLAPSE_PREVIEW_COUNT = 18;

export interface BucketMeta {
  id: WordBucket;
  /** Короткое детское название колонки и пункта легенды. */
  title: string;
  /** Значок статуса (дублирует цвет формой — для доступности и быстрого чтения). */
  badge: string;
  /** Пояснение в легенде: что означает этот цвет простыми словами. */
  legend: string;
  /** Короткая подпись в шапке колонки. */
  columnHint: string;
  /** Тёплый текст в колонке, когда в ней 0 слов. */
  emptyText: string;
  /** Подпись статуса внутри открытой карточки слова. */
  cardStatus: string;
  /** CSS-класс для `.word-chip` (совместимо с существующими стилями). */
  chipClass: '' | 'good' | 'mid' | 'weak';
}

export const BUCKET_META: Record<WordBucket, BucketMeta> = {
  good: {
    id: 'good',
    title: 'Знаю',
    badge: '✓',
    legend: 'Помню твёрдо и пишу без ошибок',
    columnHint: 'помню твёрдо',
    emptyText: 'Пройди уроки — выученные слова соберутся здесь!',
    cardStatus: 'Знаю твёрдо',
    chipClass: 'good',
  },
  mid: {
    id: 'mid',
    title: 'Учу',
    badge: '★',
    legend: 'Уже встречалось, закрепляю в уроках',
    columnHint: 'закрепляю',
    emptyText: 'Пока нет слов на закреплении',
    cardStatus: 'Учу и закрепляю',
    chipClass: 'mid',
  },
  weak: {
    id: 'weak',
    title: 'Трудные',
    badge: '!',
    legend: 'Были ошибки — загляни в подсказку и повтори',
    columnHint: 'стоит повторить',
    emptyText: 'Трудных слов нет — так держать! ✨',
    cardStatus: 'Трудное слово',
    chipClass: 'weak',
  },
  new: {
    id: 'new',
    title: 'Новые',
    badge: '○',
    legend: 'Ещё впереди — откроются в новых уроках',
    columnHint: 'ещё впереди',
    emptyText: 'Все слова уже открыты! 🎉',
    cardStatus: 'Новое слово — встретится в уроке',
    chipClass: '',
  },
};

/**
 * Честный процент без ложных «0%» и «100%»:
 *  • 0% только когда 0 слов;
 *  • 100% только когда выбраны все слова до единого (например, 93 из 94 → 99%, а не 100%).
 */
export function safePct(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0;
  if (part >= total) return 100;
  return Math.min(99, Math.max(1, Math.round((part / total) * 100)));
}

/**
 * Определяет ступень слова по его состоянию SRS.
 *
 * Каждое слово попадает ровно в одну группу, без «слепой зоны»:
 *  • `good` — s ≥ 90 (совпадает с `MASTERED_SCORE` во всём приложении);
 *  • `new`  — слово ещё ни разу не отвечали (`s = 0`, `ok = 0`, `wrong = 0`);
 *  • `weak` — были ошибки и счёт пока ниже 40 (`wrong > 0 && s < 40`);
 *  • `mid`  — со словом уже работали (`s ≥ 40` или `s > 0` без ошибок), растём до 90.
 */
export function wordBucket(st: WordState | undefined): WordBucket {
  const s = st?.s ?? 0;
  if (s >= MASTERED_SCORE) return 'good';
  if (!st || (s === 0 && st.ok === 0 && st.wrong === 0)) return 'new';
  if (st.wrong > 0 && s < 40) return 'weak';
  return 'mid';
}

/** Нормализация для поиска в словарике: регистр, лишние пробелы и «ё» → «е» (как в уроке, 0.64.0). */
export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function matchesWordQuery(word: Word, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(word.text).includes(q);
}

export interface DictionaryGroup {
  bucket: WordBucket;
  meta: BucketMeta;
  words: Word[];
  count: number;
  /** Доля от общего числа слов в текущей выборке (0..100). */
  pct: number;
}

export interface DictionarySummary {
  total: number;
  /** Твёрдо выучено («Знаю», s ≥ 90). */
  mastered: number;
  /** Сколько ещё осталось выучить до «Знаю» (`total - mastered`). */
  remaining: number;
  /** Слов уже в работе (`Учу + Трудные`). */
  inProgress: number;
  /** Доля выученных слов в процентах (0..100). */
  masteredPct: number;
  counts: Record<WordBucket, number>;
  groups: DictionaryGroup[];
}

/** Раскладывает список слов по 4 цветовым колонкам (внутри каждой — по алфавиту А–Я) и подводит итоги. */
export function buildDictionarySummary(
  words: Word[],
  states: Record<string, WordState> | undefined,
): DictionarySummary {
  const buckets: Record<WordBucket, Word[]> = {
    good: [],
    mid: [],
    weak: [],
    new: [],
  };

  const sorted = [...words].sort((a, b) => a.text.localeCompare(b.text, 'ru'));
  for (const w of sorted) {
    buckets[wordBucket(states?.[w.id])].push(w);
  }

  const total = sorted.length;
  const counts: Record<WordBucket, number> = {
    good: buckets.good.length,
    mid: buckets.mid.length,
    weak: buckets.weak.length,
    new: buckets.new.length,
  };
  const mastered = counts.good;
  const remaining = total - mastered;
  const inProgress = counts.mid + counts.weak;
  const masteredPct = safePct(mastered, total);

  const groups: DictionaryGroup[] = WORD_BUCKETS.map((bucket) => ({
    bucket,
    meta: BUCKET_META[bucket],
    words: buckets[bucket],
    count: counts[bucket],
    pct: safePct(counts[bucket], total),
  }));

  return {
    total,
    mastered,
    remaining,
    inProgress,
    masteredPct,
    counts,
    groups,
  };
}

export interface DonutSegment {
  bucket: WordBucket;
  count: number;
  /** Визуальная доля круга (0..1); сумма по непустым сегментам равна 1. */
  fraction: number;
  /** Смещение начала дуги по кругу (0..1). */
  startFraction: number;
}

/** Минимальная дуга непустой группы (~12,6°), чтобы даже 1 слово из 94 было видно глазом ребёнка. */
const MIN_DONUT_FRACTION = 0.035;

/**
 * Строит дуги кольцевой диаграммы по числам в группах.
 * Если непустая группа одна — она занимает весь круг без зазора.
 */
export function buildDonutSegments(counts: Record<WordBucket, number>, total: number): DonutSegment[] {
  if (total <= 0) return [];
  const active = WORD_BUCKETS.filter((b) => counts[b] > 0);
  if (active.length === 0) return [];
  if (active.length === 1) {
    const b = active[0];
    return [{ bucket: b, count: counts[b], fraction: 1, startFraction: 0 }];
  }

  const fractions = new Map<WordBucket, number>();
  for (const b of active) fractions.set(b, counts[b] / total);

  // Подтягиваем совсем тонкие доли до MIN_DONUT_FRACTION, пропорционально сжимая крупные.
  for (let pass = 0; pass < 3; pass++) {
    let fixedSum = 0;
    let flexRawSum = 0;
    const locked = new Set<WordBucket>();
    for (const b of active) {
      const f = fractions.get(b) ?? 0;
      if (f <= MIN_DONUT_FRACTION + 1e-9) {
        locked.add(b);
        fixedSum += MIN_DONUT_FRACTION;
      } else {
        flexRawSum += f;
      }
    }
    if (locked.size === 0 || flexRawSum <= 0) break;
    const avail = Math.max(0, 1 - fixedSum);
    for (const b of active) {
      if (locked.has(b)) fractions.set(b, MIN_DONUT_FRACTION);
      else fractions.set(b, ((fractions.get(b) ?? 0) / flexRawSum) * avail);
    }
  }

  let cursor = 0;
  return active.map((b, idx) => {
    const raw = fractions.get(b) ?? 0;
    // Последний сегмент закрывает остаток до 1 без погрешности плавающей точки.
    const fraction = idx === active.length - 1 ? Math.max(0, 1 - cursor) : raw;
    const seg: DonutSegment = {
      bucket: b,
      count: counts[b],
      fraction,
      startFraction: cursor,
    };
    cursor += fraction;
    return seg;
  });
}

/** Подпись итога внизу колонки: «Итого: 18 слов». */
export function columnTotalLabel(count: number): string {
  return `Итого: ${count} ${plural(count, 'слово', 'слова', 'слов')}`;
}
