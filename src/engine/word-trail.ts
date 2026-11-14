/**
 * «Тропа слов» — новая игра про слово как дорогу (0.110.0).
 *
 * Идея из исследования `docs/proposals/new-game-concepts.md`: между уроком и
 * наградой нет места, где слово становится миром. Здесь ребёнок **чинит**
 * слово (опасная буква или порядок слогов), а потом **идёт** по нему: буквы
 * становятся плитами дороги, слоги — мостами, а герой переходит по ним к
 * остановке. Ошибка ничего не отнимает — она открывает следующую подсказку.
 *
 * Модуль чистый: ни React, ни стора, ни DOM. UI только рисует задание и
 * двигает героя, поэтому правила тропы проверяются без браузера.
 *
 * Рамка «Игры» остаётся прежней: SRS не меняется, таймеров и жизней нет,
 * награда — `playGame` без кристаллов (см. `trailAward` в UI).
 */
import type { ClassId, TrailProgress, Word } from '../types';
import { LESSON_BY_ID, LESSONS_BY_GRADE, WORD_BY_ID } from '../content/words';
import { syllableBoard, syllableFits, type SyllableBoard, type SyllableTile } from './syllable-board';
import { trickyOptions } from './tricky-letter';

/** Сколько остановок в MVP: «Школа» и «Птицы» 2 класса. */
export const TRAIL_STOPS_MVP = 2;
/**
 * Остановки MVP по классам.
 *
 * В 2 классе уроки идут «Школа → Люди школы → Птицы», но исследование выбрало
 * две тематически разные остановки: школьные предметы и птиц. Порядок уроков в
 * контенте не трогаем — он определяет программу, — а тропа просто берёт две
 * названные. Для остальных классов работает порядок уроков.
 */
export const TRAIL_LESSON_IDS: Partial<Record<ClassId, readonly string[]>> = {
  2: ['school', 'birds'],
};
/** Сколько слов в остановке: короткий сеанс на 3–6 минут. */
export const TRAIL_WORDS_PER_STOP = 4;
/**
 * Предел длины слова в буквах. 17 — самый длинный слог в банке («телепередача»);
 * на сетке 6×N это три ряда плиток, дальше дорога перестаёт читаться.
 */
export const TRAIL_MAX_LETTERS = 17;
/** Версия формата прогресса: старые/битые значения чинятся без миграции. */
export const TRAIL_VERSION = 1;

export type TrailMode = 'letters' | 'syllables';

/** Остановка — урок класса, из которого собрана дорога. */
export interface TrailStop {
  id: string;
  title: string;
  emoji: string;
  grade: ClassId;
  wordIds: string[];
}

/**
 * Задание одного слова.
 *
 * • `letters` — закрыта одна опасная буква, ребёнок выбирает её из четырёх;
 * • `syllables` — слоги перемешаны, ребёнок выкладывает их по порядку.
 *
 * `segments` — то, из чего состоит дорога: буквы или слоги. UI рисует их
 * плитами, поэтому движку не нужно знать про пиксели.
 */
export interface TrailTask {
  word: Word;
  mode: TrailMode;
  segments: string[];
  /** Индекс закрытой буквы; для слогов — -1. */
  dangerIndex: number;
  /** Верная буква; для слогов — пустая строка. */
  answer: string;
  /** Четыре варианта буквы; для слогов — пустой список. */
  options: string[];
}

/** Что делать после тапа по плите дороги. */
export type TrailStep = 'next' | 'again' | 'done';

/** Продолжение тропы: где ребёнок стоит и что делать дальше. */
export interface TrailResume {
  stopIndex: number;
  stop: TrailStop | null;
  wordId: string | null;
  stopDone: boolean;
  allDone: boolean;
}

/** Сводка для баннера на витрине игр: прогресс без «проигрыша». */
export interface TrailSummary {
  doneStops: number;
  totalStops: number;
  doneWords: number;
  totalWords: number;
  allDone: boolean;
  currentTitle: string;
}

/** Пустой прогресс. Новый объект каждый раз: профиль не должен делить ссылку. */
export const EMPTY_TRAIL: TrailProgress = { v: TRAIL_VERSION, stop: 0, words: [], cards: [] };

/**
 * Подходит ли слово для тропы.
 *
 * Фразы и дефисы не годятся: дорога — это одно слово, а не «кое-как».
 * Слово должно быть от 3 букв (иначе нет пути) до 17 (три ряда плиток) и
 * иметь либо опасную букву, либо два слога — иначе в нём нечего чинить.
 */
export function trailFits(word: Word): boolean {
  if (!word || /[\s-]/.test(word.text)) return false;
  const letters = [...word.text].length;
  if (letters < 3 || letters > TRAIL_MAX_LETTERS) return false;
  return (word.danger?.length ?? 0) > 0 || syllableFits(word);
}

/**
 * Режим задания. Чётные слова остановки — буквы, нечётные — слоги: так ребёнок
 * за одну остановку видит обе механики, а не пять одинаковых «хитрых букв».
 * Если слово не поддерживает выбранный режим, берём тот, что поддерживает.
 */
export function trailModeFor(word: Word, index = 0): TrailMode {
  const letters = (word.danger?.length ?? 0) > 0;
  const syllables = syllableFits(word);
  if (index % 2 === 1 && syllables) return 'syllables';
  if (letters) return 'letters';
  return syllables ? 'syllables' : 'letters';
}

/**
 * Собрать остановки класса.
 *
 * Из каждого урока берём подходящие слова и ставим первым слово с опасной
 * буквой, вторым — слово из слогов: первые две плиты дороги учат обеим
 * механикам без объяснений. Урок, где меньше двух подходящих слов, не станет
 * остановкой — лучше меньше остановок, чем остановка из одного слова.
 *
 * `limit = 0` — без ограничения (для проверок и будущей карты).
 */
export function trailStops(
  grade: ClassId,
  { perStop = TRAIL_WORDS_PER_STOP, limit = TRAIL_STOPS_MVP }: { perStop?: number; limit?: number } = {},
): TrailStop[] {
  const preferred = limit === TRAIL_STOPS_MVP ? TRAIL_LESSON_IDS[grade] : undefined;
  const lessons = preferred
    ? preferred.map((id) => LESSON_BY_ID[id]).filter((lesson) => !!lesson)
    : LESSONS_BY_GRADE[grade] ?? [];
  const stops: TrailStop[] = [];
  for (const lesson of lessons) {
    const fits = lesson.wordIds
      .map((id) => WORD_BY_ID[id])
      .filter((word): word is Word => !!word && trailFits(word));
    const ordered = orderStopWords(fits, Math.max(2, perStop));
    if (ordered.length < 2) continue;
    stops.push({
      id: lesson.id,
      title: lesson.title,
      emoji: lesson.emoji,
      grade,
      wordIds: ordered.map((word) => word.id),
    });
  }
  return limit > 0 ? stops.slice(0, limit) : stops;
}

/** Первым — буквы, вторым — слоги, остальные — как в уроке. */
function orderStopWords(fits: Word[], perStop: number): Word[] {
  if (!fits.length) return [];
  const first = fits.find((word) => (word.danger?.length ?? 0) > 0) ?? fits[0];
  const second = fits.find((word) => word !== first && syllableFits(word));
  const rest = fits.filter((word) => word !== first && word !== second);
  return [first, second, ...rest].filter((word): word is Word => !!word).slice(0, perStop);
}

/**
 * Собрать задание слова.
 *
 * `dangerIndex` по умолчанию — первая опасная буква: детерминированно, чтобы
 * проверки и повторный вход не меняли ответ. UI может передать случайную
 * опасную букву из `word.danger`, чтобы слово не закрывалось всегда одинаково.
 */
export function buildTrail(
  word: Word,
  mode: TrailMode = trailModeFor(word),
  dangerIndex = -1,
  pick: () => number = Math.random,
): TrailTask {
  if (mode === 'letters') {
    const letters = [...word.text];
    const fallback = word.danger?.[0] ?? 0;
    const index = dangerIndex >= 0 && dangerIndex < letters.length ? dangerIndex : fallback;
    const answer = letters[index] ?? '';
    return {
      word,
      mode,
      segments: letters,
      dangerIndex: index,
      answer,
      options: trickyOptions(answer, letters, pick),
    };
  }
  const segments = word.syllables.filter((part) => part.trim().length > 0);
  return { word, mode, segments, dangerIndex: -1, answer: '', options: [] };
}

/**
 * Тап по плите дороги. `walked` — сколько плит уже пройдено, `tapped` — индекс
 * плиты под пальцем. Неверная плита возвращает `again`: ничего не сгорает,
 * герой просто остаётся на месте.
 */
export function trailStep(walked: number, total: number, tapped: number): TrailStep {
  if (walked >= total) return 'done';
  return tapped === walked ? 'next' : 'again';
}

/** Доска слогов для режима `syllables`; null — слово не подходит. */
export function trailSyllableBoard(
  task: TrailTask,
  shuffle: (list: SyllableTile[]) => SyllableTile[],
): SyllableBoard | null {
  return task.mode === 'syllables' ? syllableBoard(task.word, shuffle) : null;
}

/** Добавить пройденное слово. Повторный вызов не плодит дубли. */
export function withTrailWord(progress: TrailProgress, wordId: string): TrailProgress {
  if (!wordId || progress.words.includes(wordId)) return progress;
  return { ...progress, words: [...progress.words, wordId] };
}

/**
 * Закрыть остановку и перейти к следующей.
 *
 * `next` — индекс следующей остановки; когда она последняя, передаём
 * `stops.length`: так `trailResume` понимает, что тропа пройдена целиком,
 * и не сбрасывает открытки.
 */
export function withTrailStop(progress: TrailProgress, stopId: string, next: number): TrailProgress {
  const cards = stopId && !progress.cards.includes(stopId) ? [...progress.cards, stopId] : progress.cards;
  const stop = Number.isFinite(next) && next >= 0 ? Math.max(progress.stop, Math.floor(next)) : progress.stop;
  return { ...progress, cards, stop };
}

/**
 * Санитайзер прогресса. Профиль и файл выгрузки могут содержать что угодно;
 * после `...raw` в `normalizeProfile` эта функция не даёт мусору пережить
 * перезагрузку. Списки ограничены, строки обрезаны, отрицательный `stop`
 * становится нулём.
 */
export function normalizeTrail(raw: unknown): TrailProgress {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const stop =
    typeof source.stop === 'number' && Number.isFinite(source.stop) && source.stop >= 0
      ? Math.min(9999, Math.floor(source.stop))
      : 0;
  const clean = (value: unknown): string[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 100))].slice(0, 400)
      : [];
  return { v: TRAIL_VERSION, stop, words: clean(source.words), cards: clean(source.cards) };
}

/**
 * Где продолжать: первая непройденная остановка и первое непройденное слово.
 *
 * Если остановка закрыта, `wordId = null` и `stopDone = true` — UI показывает
 * открытку и кнопку «Следующая остановка». `allDone` означает, что закрыты
 * ВСЕ остановки, и тогда кнопка предлагает пройти тропу заново.
 */
export function trailResume(stops: readonly TrailStop[], progress: TrailProgress): TrailResume {
  if (!stops.length) {
    return { stopIndex: 0, stop: null, wordId: null, stopDone: true, allDone: true };
  }
  const allDone = stops.every(
    (stop) => stop.wordIds.length > 0 && stop.wordIds.every((id) => progress.words.includes(id)),
  );
  const index = Math.min(Math.max(0, Math.floor(progress.stop) || 0), stops.length - 1);
  const stop = stops[index];
  const wordId = stop.wordIds.find((id) => !progress.words.includes(id)) ?? null;
  return { stopIndex: index, stop, wordId, stopDone: wordId === null, allDone };
}

/** Сводка прогресса для баннера: сколько остановок и слов уже позади. */
export function trailSummary(stops: readonly TrailStop[], progress: TrailProgress): TrailSummary {
  const totalStops = stops.length;
  const doneStops = stops.filter(
    (stop) => stop.wordIds.length > 0 && stop.wordIds.every((id) => progress.words.includes(id)),
  ).length;
  const totalWords = stops.reduce((sum, stop) => sum + stop.wordIds.length, 0);
  const words = new Set(progress.words);
  const doneWords = stops.reduce((sum, stop) => sum + stop.wordIds.filter((id) => words.has(id)).length, 0);
  const current = stops[Math.min(Math.max(0, progress.stop), Math.max(0, totalStops - 1))];
  return {
    doneStops,
    totalStops,
    doneWords,
    totalWords,
    allDone: totalStops > 0 && doneStops === totalStops,
    currentTitle: current?.title ?? '',
  };
}
