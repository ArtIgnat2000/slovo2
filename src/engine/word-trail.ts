/**
 * «Тропа слов» — игра про слово как дорогу (0.112.0).
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
 *
 * 0.112.0: все классы (1–5) идут по всей программе, 5 класс — текстовым
 * режимом; каждый четвёртый отрезок (4-я, 8-я, 12-я, 16-я остановка) на третьем
 * слове открывает буквенный лабиринт; после остановки — две строки истории.
 */
import type { ClassId, TrailProgress, Word } from '../types';
import { LESSON_BY_ID, LESSONS_BY_GRADE, WORD_BY_ID } from '../content/words';
import { syllableBoard, syllableFits, type SyllableBoard, type SyllableTile } from './syllable-board';
import { trickyOptions } from './tricky-letter';

/**
 * Длина короткого маршрута для тестов и превью.
 *
 * С 0.112.0 игра идёт по всей программе (`trailStopsFor`), а эта константа
 * осталась только у `trailStops()` по умолчанию: два урока «Школа → Птицы»
 * удобно проверять без прохода всех 16 остановок 2 класса.
 */
export const TRAIL_STOPS_MVP = 2;
/**
 * Курируемые две остановки для короткого маршрута.
 *
 * В игре с 0.112.0 идут все уроки класса, а этот список остаётся для
 * `trailStops(2)` без явного `limit` — так тесты и превью получают короткий
 * маршрут «Школа → Птицы». В контенте порядок уроков не трогаем: он
 * определяет программу, а не витрину тропы.
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
/**
 * Версия формата прогресса: 2 добавила класс-владельца прогресса.
 * Старые/битые значения чинятся без отдельной миграции: v1 считается
 * прогрессом 2 класса, потому что до 0.111.0 тропа была только у него.
 */
export const TRAIL_VERSION = 2;

export type TrailMode = 'letters' | 'syllables';

/**
 * Действие слова в цикле остановки.
 *
 * Исследование (§3.1) задаёт порядок «починить → пройти → найти» и повтор:
 *   • `letters` — починить опасную букву, потом пройти;
 *   • `walk` — пройти уже целое слово (знакомство с дорогой без ремонта);
 *   • `find` — найти картинку к слову, потом пройти;
 *   • `syllables` — починить порядок слогов, потом пройти.
 *
 * Шаг считается по индексу слова в остановке, а не по его данным: так цикл
 * всегда одинаковый и ребёнок учит одно действие за раз.
 */
export type TrailAction = 'letters' | 'walk' | 'find' | 'maze' | 'syllables';

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

/** Класс-владелец прогресса из неизвестного значения. */
function asGrade(value: unknown): ClassId | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? (value as ClassId)
    : undefined;
}

/** Чистый прогресс для класса: сброс при смене класса не оставляет хвостов. */
function emptyFor(grade?: ClassId): TrailProgress {
  return grade ? { ...EMPTY_TRAIL, grade } : { ...EMPTY_TRAIL };
}

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
 * Действие слова по его месту в остановке.
 *
 * Цикл из четырёх шагов повторяется. Если слово не поддерживает действие,
 * берём ближайшее осмысленное: нет картинки — идём пешком, нет слогов —
 * чиним букву. Ошибка выбора не ломает дорогу: `buildTrail` всё равно
 * построит путь из букв.
 */
export function trailActionFor(word: Word, index = 0, stopIndex = 0): TrailAction {
  const step = ((Math.floor(index) % 4) + 4) % 4;
  const hasLetters = (word.danger?.length ?? 0) > 0;
  const hasSyllables = syllableFits(word);
  const hasVisual = !!word.image || !!word.emoji;
  if (step === 0) return hasLetters ? 'letters' : hasSyllables ? 'syllables' : 'walk';
  if (step === 1) return 'walk';
  if (step === 2) {
    // Каждый четвёртый отрезок вместо «найти» даёт редкий лабиринт: новизна
    // без новой игры и без отдельного счётчика в профиле.
    if (stopIndex >= 0 && stopIndex % 4 === 3) return 'maze';
    if (hasVisual) return 'find';
    return hasSyllables ? 'syllables' : 'walk';
  }
  return hasSyllables ? 'syllables' : hasLetters ? 'letters' : 'walk';
}

/**
 * Собрать остановки класса.
 *
 * Из каждого урока берём подходящие слова и укладываем их в цикл
 * «починить → пройти → найти → слоги»: так на четырёх словах ребёнок видит
 * все три глагола, а не четыре одинаковых ремонта. Урок, где меньше двух
 * подходящих слов, не станет остановкой — лучше меньше остановок, чем
 * остановка из одного слова.
 *
 * `limit = 0` — без ограничения (16 остановок 2 класса).
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

/**
 * Открыта ли тропа для класса.
 *
 * С 0.112.0 открыты все пять классов. 5 класс идёт текстовым режимом: там
 * картинок почти нет, поэтому «найти» показывает четыре слова с эмодзи и
 * подсказкой, а не четыре фотографии.
 */
export function trailAvailable(grade: ClassId): boolean {
  return grade >= 1 && grade <= 5;
}

/**
 * Остановки класса в объёме полной программы.
 *
 * Каждый урок с двумя и более играбельными словами становится остановкой.
 * Ограничение `TRAIL_STOPS_MVP` с 0.112.0 не применяется: 1 класс — 5
 * остановок, 2 — 16, 3 — 13, 4 — 15, 5 — все уроки с подходящими словами.
 */
export function trailStopsFor(grade: ClassId): TrailStop[] {
  if (!trailAvailable(grade)) return [];
  return trailStops(grade, { limit: 0 });
}

/**
 * Уложить слова в цикл: починить букву, пройти, найти, починить слоги.
 *
 * Сначала выбираем роли (буква → слоги → картинка → любое слово), потом
 * расставляем их по местам 0–3. Так «найти» гарантированно получает слово с
 * картинкой, а «пройти» — что останется. Если роли не хватает, слово просто
 * выпадает: остановка из двух-трёх слов остаётся играбельной.
 */
function orderStopWords(fits: Word[], perStop: number): Word[] {
  if (!fits.length) return [];
  const taken = new Set<string>();
  const take = (pred: (word: Word) => boolean): Word | undefined => {
    const word = fits.find((item) => !taken.has(item.id) && pred(item));
    if (word) taken.add(word.id);
    return word;
  };
  const letters = take((word) => (word.danger?.length ?? 0) > 0) ?? take(() => true);
  const syllables = take((word) => syllableFits(word));
  // «Найти» сначала получает слово с настоящей картинкой; если её нет —
  // слово с эмодзи: для 5 класса и абстрактных слов это текстовый режим.
  const find = take((word) => !!word.image) ?? take((word) => !!word.emoji);
  const walk = take(() => true);
  const rest = fits.filter((word) => !taken.has(word.id));
  return [letters, walk, find, syllables, ...rest]
    .filter((word): word is Word => !!word)
    .slice(0, perStop);
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
 * Четыре картинки для задания «найти»: верное слово и три соседа.
 *
 * Сначала берём слова той же темы — так выбор не подсказывается «чужим»
 * экраном. Если темы не хватает, добираем словами класса. Картинка
 * предпочтительна, но эмодзи тоже годится: 5 класс и абстрактные слова идут
 * текстовым режимом, а не пустой рамкой. `pick` — источник случайности:
 * в тестах он детерминированный.
 */
export function trailFindOptions(
  word: Word,
  pool: readonly Word[],
  pick: () => number = Math.random,
): Word[] {
  const seen = new Set<string>([word.id, word.text]);
  const candidates = pool.filter((item) => {
    if (seen.has(item.id) || seen.has(item.text)) return false;
    if (/[\s-]/.test(item.text)) return false;
    if (!item.image && !item.emoji) return false;
    return true;
  });
  const sameTheme = shuffle(candidates.filter((item) => item.theme === word.theme), pick);
  const otherTheme = shuffle(candidates.filter((item) => item.theme !== word.theme), pick);
  const distractors = [...sameTheme, ...otherTheme].slice(0, 3);
  return shuffle([word, ...distractors], pick);
}

/**
 * Четыре ветки лабиринта для текущей плиты.
 *
 * Лабиринт — это путь по буквам: на каждой развилке верная буква открывает
 * следующую плиту, неверная показывает подсказку и не отнимает прогресс.
 * `position` — сколько букв уже пройдено; верная буква всегда среди вариантов.
 */
export function trailMazeOptions(
  task: TrailTask,
  position: number,
  pick: () => number = Math.random,
): string[] {
  const answer = task.segments[position];
  if (!answer) return [];
  return trickyOptions(answer, task.segments, pick);
}

/** Фишер–Йетс на переданном источнике случайности. */
function shuffle<T>(list: readonly T[], pick: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(pick() * (i + 1))));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
 *
 * `grade` — класс, в котором сейчас открыта тропа. Если сохранённый прогресс
 * принадлежит другому классу, книгу аккуратно сбрасываем: продолжать 2 класс
 * в 3-м нельзя — другие уроки и слова. Старый формат v1 без `grade` считаем
 * прогрессом 2 класса: он сохраняется у второклассников и сбрасывается при
 * первом входе в тропу другого класса. Без аргумента `grade`
 * функция остаётся обычным санитайзером для импорта профиля.
 */
export function normalizeTrail(raw: unknown, grade?: ClassId): TrailProgress {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const clean = (value: unknown): string[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 100))].slice(0, 400)
      : [];
  const rawWords = clean(source.words);
  const rawCards = clean(source.cards);
  const stored = asGrade(source.grade);
  const legacy = stored === undefined && source.v !== TRAIL_VERSION && (rawWords.length > 0 || rawCards.length > 0) ? 2 : undefined;
  const owner = stored ?? legacy ?? grade;
  // Чужой класс — чистый лист. Это действие при чтении, а не при записи:
  // профиль не меняется до первого пройденного слова, поэтому переход
  // туда-обратно без игры возвращает прежнюю книгу.
  if (grade && owner && owner !== grade) return emptyFor(grade);

  const stop =
    typeof source.stop === 'number' && Number.isFinite(source.stop) && source.stop >= 0
      ? Math.min(9999, Math.floor(source.stop))
      : 0;
  const words = grade ? rawWords.filter((id) => WORD_BY_ID[id]?.grades.includes(grade)) : rawWords;
  const knownCards = owner ? new Set(trailStopsFor(owner).map((item) => item.id)) : null;
  const cards = knownCards ? rawCards.filter((id) => knownCards.has(id)) : rawCards;
  return { v: TRAIL_VERSION, ...(owner ? { grade: owner } : {}), stop, words, cards };
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
  // Первая остановка с непройденным словом — «истина» о том, где ребёнок.
  const firstOpen = stops.findIndex((stop) => stop.wordIds.some((id) => !progress.words.includes(id)));
  const saved =
    typeof progress.stop === 'number' && Number.isFinite(progress.stop) && progress.stop >= 0
      ? Math.floor(progress.stop)
      : -1;
  // Сохранённый `stop` не должен уводить вперёд открытой остановки (смена
  // класса, старый профиль) — тогда возвращаемся к первой открытой. Но если он
  // указывает на уже закрытую остановку, оставляем его: UI успевает показать
  // открытку и кнопку «Следующая остановка», прежде чем `withTrailStop`
  // сдвинет указатель. Иначе последнее слово остановки сразу перепрыгивало бы
  // открытку.
  const index =
    firstOpen < 0
      ? stops.length - 1
      : saved >= 0 && saved <= firstOpen
        ? Math.min(saved, stops.length - 1)
        : firstOpen;
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
  const firstOpen = stops.findIndex((stop) => stop.wordIds.some((id) => !words.has(id)));
  const current = stops[firstOpen >= 0 ? firstOpen : Math.max(0, totalStops - 1)];
  return {
    doneStops,
    totalStops,
    doneWords,
    totalWords,
    allDone: totalStops > 0 && doneStops === totalStops,
    currentTitle: current?.title ?? '',
  };
}

/**
 * Две строки истории после остановки (0.112.0).
 *
 * Это не отдельный экран и не диалог: короткая сцена, которая связывает
 * открытку с местом. Для 2 класса тексты написаны под его 16 остановок;
 * для остальных классов — спокойная формула, которую можно заменить
 * авторскими строками без изменения UI.
 */
const TRAIL_STORIES: Record<string, readonly [string, string]> = {
  school: ['В школьном дворе пахнет мелом и яблоками.', 'На стене — новая открытка «Школа».'],
  schoolpeople: ['Учительница помахала Буквёнку с крыльца.', 'Теперь он знает, как зовут всех в школе.'],
  birds: ['Над тропой пролетела стая птиц.', 'Открытка «Птицы» легла в альбом.'],
  animals: ['Из-за куста высунулся любопытный нос.', 'Буквёнок прошёл мимо зверей и не испугался.'],
  food: ['На привале пахло тёплым хлебом.', 'Открытка «Еда» — самая вкусная в коллекции.'],
  garden: ['Яблоки в саду созрели и пахнут мёдом.', 'Буквёнок выбрал самое большое и пошёл дальше.'],
  city: ['Город зажёг окна и загудел машинами.', 'На площади появилась открытка «Город».'],
  country: ['За холмом открылась широкая страна.', 'Флаг на открытке «Наша страна» ярко горит.'],
  home: ['Дома тепло пахнет чаем и деревом.', 'Буквёнок повесил открытку над камином.'],
  work: ['В мастерской стучат молотки.', 'Открытка «Труд» пахнет стружкой.'],
  winter: ['Снег скрипит под сапогами.', 'Открытка «Зима» холодная, но красивая.'],
  nature: ['Лес шумит и дышит.', 'Буквёнок оставил открытку «Природа» на пне.'],
  calendar: ['В календаре загорелся новый день.', 'До конца тропы осталось совсем немного.'],
  polite: ['Буквёнок сказал «спасибо» и улыбнулся.', 'Открытка «Вежливые слова» — самая добрая.'],
  people: ['На площади собрались люди.', 'Каждый помахал Буквёнку на прощание.'],
  adverbs: ['Дорога побежала быстро-быстро.', 'Последняя открытка «Как и когда» на месте.'],
};

/** Две строки для открытки: авторские для 2 класса, тёплая формула для остальных. */
export function trailStory(stop: TrailStop, next?: TrailStop | null): [string, string] {
  const custom = TRAIL_STORIES[stop.id];
  if (custom) return [...custom];
  const second = next
    ? `Впереди — «${next.title}»: дорога зовёт дальше.`
    : 'Тропа пройдена — все открытки собраны.';
  return [`Буквёнок прошёл остановку «${stop.title}» и сохранил открытку.`, second];
}
