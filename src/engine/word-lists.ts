// ── Списки слов к контрольной (0.58.0) ──────────────────────────────────────
//
// Задача: «в школе дали список слов к контрольной — надо тренировать именно
// их, дальше такие списки будут ещё». Разбор и решения — docs/proposals/
// word-lists.md.
//
// Решения пользователя (2026-10-24):
//  1. списки создаются ТОЛЬКО в родительском разделе;
//  2. за тренировку списка — только XP, без кристаллов (иначе список
//     перезапускают бесконечно ради валюты);
//  3. свои слова (которых нет в банке) живут ТОЛЬКО внутри своего списка и
//     не попадают в программу класса, словарик и уроки;
//  4. ввод — текстом: родитель вставляет список из чата класса.
//
// Здесь только чистая логика без React:
//  • разбор вставленного текста (по строке, запятой, точке с запятой);
//  • сопоставление с банком 257 слов (регистр, «ё/е», лишние пробелы);
//  • карточка своего слова с автополями (слоги, ударение, опасные буквы);
//  • id для уроков: `list:<id>`.

import type { ClassId, ListRunMode, PracticeList, Word } from '../types';
import { WORDS } from '../content/words';
import { knownStress } from '../content/stress-dict';
import { customWordCard } from '../content/custom-words';

/** Префикс id урока-тренировки списка: `list:l_xxx`. */
export const LIST_LESSON_PREFIX = 'list:';

/**
 * Полный контроль списка (0.62.0): `check:l_xxx`.
 *
 * Отличие от тренировки: берутся ВСЕ слова списка по одному заданию, подсказки
 * отключены, отработка ошибок в процессе не добавляется. В конце — отчёт
 * «сколько верно и какие слова провалились», а не общие звёзды.
 */
export const CHECK_LESSON_PREFIX = 'check:';

/** Тренировка только по ошибкам последней контрольной: `err:l_xxx`. */
export const ERRORS_LESSON_PREFIX = 'err:';

/** Слова вне банка получают id с этим префиксом. */
export const CUSTOM_WORD_PREFIX = 'c_';

/** Сколько своих слов разрешаем в одном списке — защита от «вставил роман». */
export const MAX_LIST_WORDS = 120;

/** Сколько последних заходов по списку храним (0.63.0). */
export const LIST_RUNS_LIMIT = 30;

/** Варианты размера одной тренировки списка: «сколько слов за раз». */
export const LIST_DRILL_SIZES: { id: number; title: string; hint: string }[] = [
  { id: 4, title: '4 слова', hint: 'совсем коротко, на пять минут' },
  { id: 6, title: '6 слов', hint: 'по умолчанию: легко начать' },
  { id: 8, title: '8 слов', hint: 'чуть больше' },
  { id: 12, title: '12 слов', hint: 'как короткий урок' },
  { id: 0, title: 'весь список', hint: 'все слова за один заход' },
];

/** Размер тренировки по умолчанию: легче урока, чтобы не бросать. */
export const DEFAULT_LIST_DRILL_SIZE = 6;

/** Сколько «опасных» букв максимум ставим своему слову автоматически. */
const MAX_AUTO_DANGER = 3;

const VOWELS = 'аеёиоуыэюя';

/** id урока-тренировки для списка. */
export const listLessonId = (listId: string) => `${LIST_LESSON_PREFIX}${listId}`;

/** id урока полного контроля для списка. */
export const checkLessonId = (listId: string) => `${CHECK_LESSON_PREFIX}${listId}`;

/** id тренировки по ошибкам последней контрольной. */
export const errorsLessonId = (listId: string) => `${ERRORS_LESSON_PREFIX}${listId}`;

/** Обратное преобразование: `list:l_1` → `l_1`; для обычных уроков — null. */
export function listIdFromLesson(lessonId: string): string | null {
  return lessonId.startsWith(LIST_LESSON_PREFIX) ? lessonId.slice(LIST_LESSON_PREFIX.length) : null;
}

/** `check:l_1` → `l_1`; иначе null. */
export function listIdFromCheck(lessonId: string): string | null {
  return lessonId.startsWith(CHECK_LESSON_PREFIX) ? lessonId.slice(CHECK_LESSON_PREFIX.length) : null;
}

/** `err:l_1` → `l_1`; иначе null. */
export function listIdFromErrors(lessonId: string): string | null {
  return lessonId.startsWith(ERRORS_LESSON_PREFIX) ? lessonId.slice(ERRORS_LESSON_PREFIX.length) : null;
}

/** Какой список и в каком режиме открывает урок. null — обычный урок программы. */
export type ListMode = 'train' | 'check' | 'errors';

export function listModeOf(lessonId: string): { listId: string; mode: ListMode } | null {
  const check = listIdFromCheck(lessonId);
  if (check) return { listId: check, mode: 'check' };
  const errors = listIdFromErrors(lessonId);
  if (errors) return { listId: errors, mode: 'errors' };
  const train = listIdFromLesson(lessonId);
  if (train) return { listId: train, mode: 'train' };
  return null;
}

/**
 * Ключ сравнения слов: регистр, «ё→е», лишние пробелы и дефисы не важны.
 *
 * Именно поэтому строка «Береза» из чата класса находит в банке «берёза»
 * (а карточка остаётся с правильным написанием из банка), а «До свидания»
 * и «до  свидания» — одно и то же слово.
 */
export function matchKey(text: string): string {
  return text.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/** Индекс банка по ключу сравнения: 257 слов, ищется один раз. */
const BANK_BY_KEY = new Map<string, Word>(WORDS.map((w) => [matchKey(w.text), w]));

/** Найти слово банка по тексту из списка. */
export function findBankWord(text: string): Word | undefined {
  return BANK_BY_KEY.get(matchKey(text));
}

/** Транслитерация для устойчивого id своего слова (латиница + цифры). */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugOf(text: string): string {
  const out = [...matchKey(text)]
    .map((ch) => TRANSLIT[ch] ?? (ch === ' ' || ch === '-' ? '_' : /[a-z0-9]/.test(ch) ? ch : ''))
    .join('');
  return out.replace(/_+/g, '_').replace(/^_|_$/g, '') || 'word';
}

/** Индексы гласных букв в слове. */
export function vowelIndexes(text: string): number[] {
  const out: number[] = [];
  [...text].forEach((ch, i) => {
    if (VOWELS.includes(ch.toLowerCase())) out.push(i);
  });
  return out;
}

/**
 * Слоги по правилам школьного переноса: «под-ле-жа-ще-е», «яб-ло-ня»,
 * «у-че-ник», «про-щай-те».
 *
 * Правило простое и проверяемое: между двумя гласными
 *  • одна согласная — уходит в следующий слог (`у-че-ник`);
 *  • две и больше — первый согласный остаётся в предыдущем (`под-ле-жа-ще-е`);
 *  • согласных нет — граница прямо после гласной (`ще-е`).
 */
export function splitSyllables(text: string): string[] {
  const chars = [...text];
  const isVowel = (ch: string | undefined) => !!ch && VOWELS.includes(ch.toLowerCase());
  const parts: string[] = [];
  let from = 0;
  for (let i = 0; i < chars.length; i++) {
    if (!isVowel(chars[i])) continue;
    // Сколько согласных до следующей гласной (или до конца слова).
    let consonants = 0;
    let j = i + 1;
    while (j < chars.length && !isVowel(chars[j])) {
      consonants += 1;
      j += 1;
    }
    if (j >= chars.length) break; // последняя гласная — остаток уходит в последний слог
    const cut = consonants >= 2 ? i + 2 : i + 1;
    if (cut > from) {
      parts.push(chars.slice(from, cut).join(''));
      from = cut;
    }
  }
  parts.push(chars.slice(from).join(''));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Написание своего слова: «Прощайте» из чата класса становится «прощайте» —
 * так же, как слова в банке. Слова с внутренней заглавной (аббревиатуры,
 * «Иван Иванович») оставляем как ввели: там регистр — часть написания.
 */
export function normalizeCustomText(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  const upperInside = [...clean.slice(1)].some((ch) => ch !== ch.toLowerCase());
  return upperInside ? clean : clean.toLowerCase();
}

/**
 * Автополя своего слова.
 *
 * Ударение берётся из словаря известных слов (`content/stress-dict.ts`) —
 * там школьные термины и вежливые формы, где «последняя гласная» ошибается:
 * подлежАщее, сказУемое, прощАйте. Если слова в словаре нет, ставим на
 * последнюю гласную: это самый частый случай, и одна ошибка правится одним
 * тапом в предпросмотре.
 * «Опасные» буквы — безударные гласные, не больше трёх.
 */
export function makeCustomWord(text: string, grade: ClassId = 2): Word {
  const clean = normalizeCustomText(text);
  const key = matchKey(clean);
  const vowels = vowelIndexes(clean);
  const known = knownStress(key);
  const guessed = known === undefined;
  const stress = known !== undefined && clean[known] ? known : vowels.length ? vowels[vowels.length - 1] : 0;
  const danger = vowels.filter((i) => i !== stress).slice(0, MAX_AUTO_DANGER);
  // 0.61.0: готовые карточки для слов вне банка (content/custom-words.ts) —
  // картинка, объяснение значения и предложение-контекст. Без них ребёнок
  // видел «Контрольная: ____» и общую книгу вместо образа слова.
  const card = customWordCard(key);
  return {
    id: `${CUSTOM_WORD_PREFIX}${slugOf(clean)}`,
    text: clean,
    stress,
    syllables: card?.syllables?.length ? card.syllables : splitSyllables(clean),
    danger,
    dangerKind: danger.length ? 'vowel' : 'other',
    hint: card?.hint ?? 'слово из школьного списка: значение подскажет взрослый',
    emoji: '📖',
    // Предложение с пропуском: задания с выбором и «исправь робота» работают
    // так же, как у слов банка.
    sentence: card?.sentence ?? `${clean[0]?.toUpperCase() ?? ''}____.`,
    ...(card ? { image: card.image, mnemonic: card.mnemonic } : {}),
    theme: 'custom',
    grades: [grade],
    // 0.60.0: автогадание помечаем — в предпросмотре списка родитель увидит
    // «проверьте ударение» и поправит одним тапом, а не будет верить молча.
    ...(guessed ? { stressGuessed: true } : {}),
  };
}

/**
 * Поставить ударение на гласную с индексом `index` (остальное пересчитать).
 *
 * `manual` = true ставит флаг «выбрано человеком»: такой выбор словарь
 * ударений больше не перебивает (`normalizeCustomWords`).
 */
export function withStress(word: Word, index: number, manual = false): Word {
  const vowels = vowelIndexes(word.text);
  if (!vowels.includes(index)) return word;
  const danger = vowels.filter((i) => i !== index).slice(0, MAX_AUTO_DANGER);
  return {
    ...word,
    stress: index,
    danger,
    dangerKind: danger.length ? 'vowel' : 'other',
    // Ручной выбор снимает пометку «подставлено»: теперь это проверенный факт.
    ...(manual ? { stressManual: true, stressGuessed: false } : {}),
  };
}

export interface ParsedItem {
  /** Как слово было введено (для показа в предпросмотре). */
  text: string;
  /** id слова: `g2_город` из банка или `c_...` для своего. */
  wordId: string;
  /** Откуда слово: из банка, своё или повтор (в список не попадает). */
  source: 'bank' | 'custom' | 'duplicate';
  /** Готовая карточка — только для своих слов. */
  word?: Word;
}

export interface ParsedList {
  items: ParsedItem[];
  /** id слов в порядке ввода, без повторов. */
  wordIds: string[];
  /** Новые свои слова, которые нужно сохранить в профиль. */
  customWords: Record<string, Word>;
}

/** Разбить вставленный текст на слова: строки, запятые, точки с запятой. */
export function splitListText(raw: string): string[] {
  return raw
    .split(/[\n\r,;]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Разобрать вставленный список.
 *
 * `existingCustom` — уже сохранённые свои слова профиля: повторный ввод того же
 * слова переиспользует карточку (и правки ударения не теряются), а не создаёт
 * дубль с другим id.
 */
export function parseWordList(
  raw: string,
  existingCustom: Record<string, Word> = {},
  grade: ClassId = 2,
): ParsedList {
  const customByKey = new Map<string, Word>(
    Object.values(existingCustom).map((w) => [matchKey(w.text), w]),
  );
  const seen = new Set<string>();
  const items: ParsedItem[] = [];
  const wordIds: string[] = [];
  const customWords: Record<string, Word> = {};

  for (const text of splitListText(raw)) {
    if (wordIds.length >= MAX_LIST_WORDS) break;
    const key = matchKey(text);
    if (seen.has(key)) {
      items.push({ text, wordId: '', source: 'duplicate' });
      continue;
    }
    seen.add(key);

    const bank = BANK_BY_KEY.get(key);
    if (bank) {
      items.push({ text, wordId: bank.id, source: 'bank' });
      wordIds.push(bank.id);
      continue;
    }

    let word = customByKey.get(key);
    if (!word) word = makeCustomWord(text, grade);
    // Уникальный id: «прощайте» и «прощайте!» дадут одинаковый слаг.
    let id = word.id;
    let n = 2;
    while (existingCustom[id] && matchKey(existingCustom[id].text) !== key) {
      id = `${word.id}_${n++}`;
    }
    word = { ...word, id };
    customByKey.set(key, word);
    customWords[id] = word;
    items.push({ text, wordId: id, source: 'custom', word });
    wordIds.push(id);
  }

  return { items, wordIds, customWords };
}

/** Слова списка как карточки (для уроков и предпросмотра). */

export function listWords(
  list: PracticeList,
  customWords: Record<string, Word> = {},
): Word[] {
  const byId = new Map<string, Word>([...WORDS.map((w) => [w.id, w] as const), ...Object.entries(customWords)]);
  return list.words.map((id) => byId.get(id)).filter((w): w is Word => !!w);
}

/** Сколько в списке слов из банка и сколько своих — для подписи в интерфейсе. */
export function listStats(list: PracticeList, customWords: Record<string, Word> = {}) {
  const words = listWords(list, customWords);
  const custom = words.filter((w) => w.id.startsWith(CUSTOM_WORD_PREFIX)).length;
  return { total: words.length, custom, bank: words.length - custom };
}

/** Один заход в читаемом виде — для списка истории в интерфейсе. */
export interface RunSummary {
  at: number;
  mode: ListRunMode;
  total: number;
  correct: number;
  /** Доля верных слов: 0..1. */
  ratio: number;
  wrong: string[];
  listSize?: number;
}

/**
 * Динамика заходов по списку (0.63.0).
 *
 * `runs` в профиле лежат в порядке добавления (последний — последним).
 * Возвращаем в том же порядке, но с посчитанной долей верных слов — по ней
 * интерфейс рисует полоски и считает «стало лучше / хуже».
 */
export function runHistory(list: PracticeList, limit = 12): RunSummary[] {
  const runs = (list.runs ?? []).slice(-limit);
  return runs.map((r) => ({
    at: r.at,
    mode: r.mode,
    total: r.total,
    correct: r.correct,
    ratio: r.total > 0 ? r.correct / r.total : 0,
    wrong: r.wrong,
    ...(r.listSize ? { listSize: r.listSize } : {}),
  }));
}

/**
 * «Стало лучше» по последним заходам одного режима.
 *
 * Сравниваем средний результат первой половины и второй половины истории:
 * так одна неудачная контрольная не превращается в «всё стало хуже».
 * null — данных мало (меньше двух заходов).
 */
export function trendOf(list: PracticeList, mode?: ListRunMode): { delta: number; better: boolean } | null {
  const runs = (list.runs ?? []).filter((r) => !mode || r.mode === mode);
  if (runs.length < 2) return null;
  const half = Math.floor(runs.length / 2);
  const avg = (arr: typeof runs) => arr.reduce((n, r) => n + (r.total ? r.correct / r.total : 0), 0) / Math.max(1, arr.length);
  const before = avg(runs.slice(0, half || 1));
  const after = avg(runs.slice(runs.length - half || runs.length - 1));
  return { delta: after - before, better: after >= before };
}

/** Сколько раз слово ошибочно — по всей истории заходов. */
export function wordErrorCounts(list: PracticeList): Record<string, number> {
  const out: Record<string, number> = {};
  for (const run of list.runs ?? []) {
    for (const id of run.wrong) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

/**
 * «Трудные слова» списка (0.63.0): слова, которые ошибались чаще других.
 *
 * Сортируем по числу ошибок, затем по «свежести» — слово, проваленное в
 * последнем заходе, важнее старого провала с тем же счётом. Именно этот
 * набор уходит в режим «Тренировать ошибки», если история накопилась.
 */
export function hardWords(list: PracticeList, limit = 8): { id: string; errors: number; lastAt: number }[] {
  const runs = list.runs ?? [];
  const errors: Record<string, number> = {};
  const lastAt: Record<string, number> = {};
  for (const run of runs) {
    for (const id of run.wrong) {
      errors[id] = (errors[id] ?? 0) + 1;
      lastAt[id] = Math.max(lastAt[id] ?? 0, run.at);
    }
  }
  return Object.entries(errors)
    .map(([id, n]) => ({ id, errors: n, lastAt: lastAt[id] ?? 0 }))
    .sort((a, b) => b.errors - a.errors || b.lastAt - a.lastAt)
    .slice(0, limit);
}

/** Сколько слов брать в тренировку: параметр профиля, 0/undefined — весь список. */
export function drillSizeOf(profile: { listDrillSize?: number } | null | undefined): number {
  const size = profile?.listDrillSize;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return DEFAULT_LIST_DRILL_SIZE;
  return Math.floor(size);
}

/** Разбить тренировку на части: сколько слов реально возьмём в этот заход. */
export function drillLimit(profile: { listDrillSize?: number } | null | undefined, listLength: number): number {
  const size = drillSizeOf(profile);
  if (!size) return listLength;
  return Math.max(1, Math.min(size, listLength));
}

/** Новый список с id; название по умолчанию — дата контрольной или «Список». */
export function makeList(title: string, wordIds: string[], now = Date.now()): PracticeList {
  return {
    id: `l_${now.toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`,
    title: title.trim() || 'Список к контрольной',
    words: [...wordIds],
    createdAt: now,
  };
}

/**
 * Списки к контрольной (0.58.0): чистим мусор из файла выгрузки.
 *
 * Правила: id — строка, название — строка (пустое → «Список к контрольной»),
 * слова — массив непустых строк без повторов, максимум MAX_LIST_WORDS.
 * Битые записи выбрасываются целиком, а не превращаются в пустой список.
 */
export function normalizeLists(raw: unknown): PracticeList[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const out: PracticeList[] = [];
  for (const item of raw) {
    const l = item as Partial<PracticeList> | null;
    if (!l || typeof l.id !== 'string' || !l.id.trim() || used.has(l.id)) continue;
    const words = Array.isArray(l.words)
      ? [...new Set(l.words.filter((w): w is string => typeof w === 'string' && !!w.trim()))].slice(0, MAX_LIST_WORDS)
      : [];
    if (!words.length) continue;
    used.add(l.id);
    out.push({
      id: l.id,
      title: typeof l.title === 'string' && l.title.trim() ? l.title.trim().slice(0, 80) : 'Список к контрольной',
      words,
      createdAt: typeof l.createdAt === 'number' && Number.isFinite(l.createdAt) ? l.createdAt : Date.now(),
      ...(typeof l.lastRunAt === 'number' && Number.isFinite(l.lastRunAt) ? { lastRunAt: l.lastRunAt } : {}),
      ...(normalizeLastCheck(l.lastCheck) ? { lastCheck: normalizeLastCheck(l.lastCheck) } : {}),
      ...(() => {
        const runs = normalizeRuns(l.runs);
        return runs.length ? { runs } : {};
      })(),
    });
  }
  return out;
}

/** История заходов из файла: битые записи отбрасываем, длина ограничена. */
function normalizeRuns(raw: unknown): NonNullable<PracticeList['runs']> {
  if (!Array.isArray(raw)) return [];
  const out: NonNullable<PracticeList['runs']> = [];
  for (const item of raw) {
    const r = item as Partial<NonNullable<PracticeList['runs']>[number]> | null;
    if (!r || typeof r !== 'object') continue;
    const mode = r.mode === 'check' || r.mode === 'errors' || r.mode === 'train' ? r.mode : null;
    if (!mode) continue;
    const total = typeof r.total === 'number' && Number.isFinite(r.total) ? Math.floor(r.total) : 0;
    if (total <= 0) continue;
    const correct = typeof r.correct === 'number' && Number.isFinite(r.correct)
      ? Math.max(0, Math.min(total, Math.floor(r.correct)))
      : 0;
    const wrong = Array.isArray(r.wrong) ? [...new Set(r.wrong.filter((x): x is string => typeof x === 'string'))] : [];
    out.push({
      at: typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : Date.now(),
      mode,
      total,
      correct,
      wrong,
      ...(typeof r.listSize === 'number' && Number.isFinite(r.listSize) && r.listSize > 0
        ? { listSize: Math.floor(r.listSize) }
        : {}),
    });
  }
  return out.slice(-LIST_RUNS_LIMIT);
}

/** Итог контрольной из файла: числа и id слов, мусор отбрасываем. */
function normalizeLastCheck(raw: unknown): PracticeList['lastCheck'] | undefined {
  const c = raw as Partial<NonNullable<PracticeList['lastCheck']>> | null;
  if (!c || typeof c !== 'object') return undefined;
  if (typeof c.total !== 'number' || !Number.isFinite(c.total) || c.total <= 0) return undefined;
  const total = Math.floor(c.total);
  const correct = typeof c.correct === 'number' && Number.isFinite(c.correct) ? Math.max(0, Math.min(total, Math.floor(c.correct))) : 0;
  const wrong = Array.isArray(c.wrong) ? [...new Set(c.wrong.filter((x): x is string => typeof x === 'string'))] : [];
  return { at: typeof c.at === 'number' && Number.isFinite(c.at) ? c.at : Date.now(), total, correct, wrong };
}

/**
 * Свои слова списков (0.58.0): карточка должна быть рабочей, иначе урок
 * списка упадёт на `pickDanger`. Битое слово выбрасываем, а не «чиним» на глаз.
 */
export function normalizeCustomWords(raw: unknown): Record<string, Word> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Word> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const w = value as Partial<Word> | null;
    if (!w || typeof w.text !== 'string' || !w.text.trim()) continue;
    if (!id.startsWith(CUSTOM_WORD_PREFIX)) continue;
    const text = w.text.trim().replace(/\s+/g, ' ').slice(0, 48);
    const syllables = Array.isArray(w.syllables) && w.syllables.length ? w.syllables.filter((x) => typeof x === 'string') : splitSyllables(text);
    // Ударение из файла или словаря. Словарь исправляет и те профили, где
    // автополе уже сохранило неверное ударение (0.59.1), но выбор родителя
    // (`stressManual`) неприкосновенен.
    const stored =
      typeof w.stress === 'number' && Number.isFinite(w.stress) && w.stress >= 0 && w.stress < text.length
        ? Math.floor(w.stress)
        : null;
    const known = w.stressManual ? undefined : knownStress(matchKey(text));
    const stress = known !== undefined && text[known] ? known : stored ?? 0;
    // Пометка «подставлено» пересчитывается при чтении: словарь мог пополниться.
    const guessed = !w.stressManual && known === undefined;
    const danger = Array.isArray(w.danger)
      ? [...new Set(w.danger.filter((i): i is number => typeof i === 'number' && i >= 0 && i < text.length))]
      : [];
    out[id] = {
      id,
      text,
      stress,
      ...(w.stressManual ? { stressManual: true } : {}),
      ...(guessed ? { stressGuessed: true } : {}),
      syllables,
      danger,
      dangerKind: danger.length ? 'vowel' : 'other',
      // Карточка из реестра важнее сохранённого: картинка и объяснение могли
      // появиться позже (0.61.0), а в старом профиле их просто нет.
      hint:
        (typeof w.hint === 'string' && w.hint.trim() && w.hint !== 'Слово из списка к контрольной'
          ? w.hint
          : customWordCard(matchKey(text))?.hint) ??
        'слово из школьного списка: значение подскажет взрослый',
      emoji: '📖',
      sentence:
        (typeof w.sentence === 'string' && w.sentence.includes('____') && !w.sentence.startsWith('Контрольная')
          ? w.sentence
          : customWordCard(matchKey(text))?.sentence) ?? `${text[0]?.toUpperCase() ?? ''}____.`,
      ...(customWordCard(matchKey(text))?.image ? { image: customWordCard(matchKey(text))!.image } : {}),
      ...(customWordCard(matchKey(text))?.mnemonic ? { mnemonic: customWordCard(matchKey(text))!.mnemonic } : {}),
      theme: 'custom',
      grades: [2],
    };
  }
  return out;
}
