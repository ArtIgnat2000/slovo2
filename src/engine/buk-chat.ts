/**
 * Чат «Спроси БУКа» (0.87.0; итерация 2, идея 2 из docs/buk-companion-3d.md §5).
 *
 * Чистая машина разговора — без DOM и без состояния: сессия живёт снаружи,
 * модуль только считает и отвечает. Правила серии:
 *  • офлайн и без облака — вся логика здесь, ни одного сетевого вызова;
 *  • никаких наград за чат — модуль не знает про xp и gems вообще;
 *  • каждая реплика ≤ LINE_LIMIT знаков (страховка — tests/buk-chat.test.ts);
 *  • подход закрывается предложением сделать дело: после MAX_BUK_LINES реплик
 *    БУК больше не болтает, он зовёт в урок — чат не превращается в толкучку;
 *  • детерминизм вместо Math.random: выбор шаблонов и слов — hash от dayKey.
 *
 * Память (идея 3): только белый список коротких фактов профиля —
 * `bukFacts { animal, color, petName, toldAt }` (types.ts). Факты ребёнок
 * рассказывает сам в сцене «Расскажу о себе»; напоминание через неделю —
 * `memoryLine`. Значения чистит `normalizeBukFacts`, он же нужен стору
 * при чтении профиля и бэкапа. Факты не покидают устройство.
 */
import { LESSONS, WORDS, WORD_BY_ID } from '../content/words';
import type { BukFacts, Profile, Word } from '../types';
import { dayKey, greetingFor } from './day';
import { nextStartAction } from './next-start';
import { pluralRu } from './vault';
import { dangerSummary } from './word-facts';

/** Потолок реплик БУКа за подход: дальше — только предложение сделать дело. */
export const MAX_BUK_LINES = 6;
/** Жёсткий лимит реплики — в пузырь чата и в тесты. */
export const LINE_LIMIT = 70;

export interface ChatChip {
  /** Идентификатор для маршрутизации: 'today', 'word:<id>', 'fact:animal:кот'… */
  id: string;
  /** Подпись ребёнком читается как есть — короткая, до двух слов. */
  label: string;
}

export interface ChatAction {
  /** Подпись кнопки-действия под последней репликой: «Полетели?», «Потренироваться». */
  label: string;
  /** 'review' — повторение, иначе lessonId обычного урока. */
  mode?: 'review';
  lessonId?: string;
}

export interface ChatReply {
  /** Реплики БУКа по очереди; все ≤ LINE_LIMIT. */
  lines: string[];
  /** Чипы под последней репликой; undefined — висит только кнопка-действие. */
  chips?: ChatChip[];
  action?: ChatAction;
  /** Факт для профиля — из сцены «Расскажу о себе» (их один набор — whitelist). */
  facts?: Partial<BukFacts>;
}

/** Многоходовые сцены: пока активна, роутер ждёт ответ именно по ней. */
export type ChatScene = 'idle' | 'word' | 'animal' | 'color' | 'pet';

export interface ChatSession {
  /** Сколько реплик БУКа уже прозвучало за подход. */
  lines: number;
  scene: ChatScene;
}

export interface ChatContext {
  profile: Profile;
  hour: number;
  goal: number;
}

export function sessionStart(): ChatSession {
  return { lines: 0, scene: 'idle' };
}

// ── Белый список фактов ─────────────────────────────────────────────────────

/** Убирает мусор и держит поля короткими: значение факта — не эссе. */
function cleanValue(raw: string): string | undefined {
  const v = raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return v || undefined;
}

/**
 * Стрижка произвольного объекта до whitelist-фактов. Стор зовёт при чтении
 * профиля и бэкапа — файл из рук в руки не должен привозить лишнего.
 */
export function normalizeBukFacts(raw: unknown): BukFacts | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: BukFacts = {};
  const animal = typeof r.animal === 'string' ? cleanValue(r.animal) : undefined;
  const color = typeof r.color === 'string' ? cleanValue(r.color) : undefined;
  const petName = typeof r.petName === 'string' ? cleanValue(r.petName) : undefined;
  const toldAt =
    typeof r.toldAt === 'number' && Number.isFinite(r.toldAt) && r.toldAt > 0 ? r.toldAt : undefined;
  if (animal) out.animal = animal;
  if (color) out.color = color;
  if (petName) out.petName = petName;
  if (toldAt) out.toldAt = toldAt;
  return Object.keys(out).length > 0 ? out : undefined;
}

// ── Детерминированный выбор вместо Math.random ──────────────────────────────

/** FNV-хэш строки: одинаковый день — одинаковый выбор, без Math.random. */
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function pickDay<T>(pool: T[], seed: string): T {
  return pool[hash(dayKey() + '·' + seed) % pool.length];
}

// ── Память: отсылки к рассказанным фактам ───────────────────────────────────

/** «Как твой кот Мурзик?» — пять шаблонов с именем питомца. */
const POOL_PET = [
  'Как твой {kind} {name}?',
  '{name} как сегодня?',
  'Чем занят {name}?',
  'Надеюсь, {name} скучал!',
  'Помню: {name} ждёт тебя!',
];
/** Три шаблона, когда ребёнок рассказал только про животное. */
const POOL_ANIMAL = ['Твой {animal} как?', 'Чем занят твой {animal}?', '{animal} не скучает?'];
/** Два шаблона на любимый цвет. */
const POOL_COLOR = ['Помню: твой цвет — {color}!', '{color} тебе к лицу!'];

/** Всего 10 шаблонов — спека просит 10–20; держим в одном месте для тестов. */
export const MEMORY_POOLS: string[][] = [POOL_PET, POOL_ANIMAL, POOL_COLOR];

/**
 * Отсылка к фактам при открытии чата. По спеке — «через неделю»: факт
 * напоминают только если ему исполнилось 7 дней (toldAt), свежие секреты
 * БУК не дёргает. Выбор шаблона детерминирован по дню — тесты и ребёнок
 * видят одну и ту же фразу в течение дня.
 */
export function memoryLine(facts: BukFacts | undefined, now: number = Date.now()): string | null {
  if (!facts?.toldAt || now - facts.toldAt < 7 * 24 * 3600 * 1000) return null;
  let pool: string[];
  let tpl: string;
  if (facts.petName) {
    pool = POOL_PET;
    tpl = pickDay(pool, facts.petName);
    return tpl
      .replace('{kind}', facts.animal ?? 'питомец')
      .replace('{name}', facts.petName);
  }
  if (facts.animal) {
    tpl = pickDay(POOL_ANIMAL, facts.animal);
    return tpl.replace('{animal}', facts.animal);
  }
  if (facts.color) {
    tpl = pickDay(POOL_COLOR, facts.color);
    return tpl.replace('{color}', facts.color);
  }
  return null;
}

// ── Корневые чипы и сцены ───────────────────────────────────────────────────

const ROOT_CHIPS: ChatChip[] = [
  { id: 'today', label: 'Что сегодня?' },
  { id: 'spelling', label: 'Как пишется…?' },
  { id: 'rule', label: 'Объясни правило' },
  { id: 'tell', label: 'Расскажу о себе' },
  { id: 'play', label: 'Поиграем?' },
];

const ANIMAL_CHIPS: ChatChip[] = ['Кот', 'Собака', 'Попугай', 'Рыбка'].map((a) => ({
  id: `fact:animal:${a.toLowerCase()}`,
  label: a,
}));
const COLOR_CHIPS: ChatChip[] = ['Синий', 'Красный', 'Зелёный', 'Жёлтый'].map((c) => ({
  id: `fact:color:${c.toLowerCase()}`,
  label: c,
}));

// ── Ответы по темам ─────────────────────────────────────────────────────────

/** Слово с ударением: острые знаки после гласной под индексом stress. */
export function stressedText(word: Word): string {
  return `${word.text.slice(0, word.stress + 1)}\u0301${word.text.slice(word.stress + 1)}`;
}

/** Что предложить для тренировки: слова ближайшего урока, до четырёх. */
function wordChips(ctx: ChatContext): ChatChip[] {
  const next = nextStartAction(ctx.profile);
  const lesson = next.lessonId ? LESSONS.find((l) => l.id === next.lessonId) : null;
  const ids = lesson?.wordIds ?? [];
  return ids.slice(0, 4).map((id) => ({ id: `word:${id}`, label: WORD_BY_ID[id]?.text ?? id }));
}

/** Ответ на вопрос «Как пишется …»: слоги, ударение, опасность, подсказка. */
function wordReply(word: Word): ChatReply {
  const lines: string[] = [
    `Слоги: ${word.syllables.join('-')}. Ударение: ${stressedText(word)}.`,
  ];
  const danger = dangerSummary(word);
  if (danger && danger.length <= LINE_LIMIT) lines.push(danger);
  if (word.mnemonic && word.mnemonic.length <= LINE_LIMIT) {
    lines.push(`Подсказка: ${word.mnemonic}`);
  } else {
    const sentence = word.sentence.replace('____', word.text);
    const line = `В предложении: ${sentence}`;
    if (line.length <= LINE_LIMIT) lines.push(line);
  }
  const lesson = LESSONS.find((l) => l.wordIds.includes(word.id));
  return {
    lines,
    chips: ROOT_CHIPS,
    action: lesson ? { label: 'Потренироваться', lessonId: lesson.id } : undefined,
  };
}

/** Случайное освоенное правило дня — детерминированно, без Math.random. */
function ruleReply(ctx: ChatContext): ChatReply {
  const pool = WORDS.filter((w) => (ctx.profile.words[w.id]?.s ?? 0) > 0 && (w.mnemonic || w.danger.length > 0));
  if (pool.length === 0) {
    return { lines: ['Пройди урок — и я объясню правила!'], chips: ROOT_CHIPS };
  }
  const word = pickDay(pool, ctx.profile.id);
  const line = word.mnemonic
    ? `Подсказка: ${word.mnemonic}`
    : (dangerSummary(word) || 'Смотри — буква здесь коварная!').slice(0, LINE_LIMIT);
  return { lines: [line], chips: ROOT_CHIPS };
}

/** «Что сегодня?» — правда по делу: повторение, цель дня, ближайший урок. */
function todayReply(ctx: ChatContext): ChatReply {
  const next = nextStartAction(ctx.profile);
  const xp = ctx.profile.days[dayKey()]?.xp ?? 0;
  const lines: string[] = [];
  if (next.reviewDue) {
    lines.push(`Пора повторить: ${pluralRu(next.reviewCount, 'слово', 'слова', 'слов')} ждут!`);
  } else if (ctx.goal > 0 && xp >= ctx.goal) {
    lines.push('Цель дня закрыта! 🎉');
  } else if (ctx.goal > 0 && xp > 0) {
    lines.push(`Ещё ${ctx.goal - xp} ⚡ до цели дня.`);
  } else {
    lines.push('Урок ждёт — начнём?');
  }
  return { lines, chips: ROOT_CHIPS, action: playAction(ctx).action };
}

/** Общее «полетели»: повторение важнее нового урока — как в навигаторе. */
function playAction(ctx: ChatContext): { line: string; action?: ChatAction } {
  const next = nextStartAction(ctx.profile);
  if (next.reviewDue) return { line: 'Полетели на повторение!', action: { label: 'Полетели?', mode: 'review' } };
  if (next.lessonId) return { line: 'Полетели в урок!', action: { label: 'Полетели?', lessonId: next.lessonId } };
  return { line: 'Полетели!', action: undefined };
}

// ── Роутер ──────────────────────────────────────────────────────────────────

function knownWord(text: string): Word | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  return (
    WORDS.find((w) => w.text.toLowerCase() === t) ?? WORD_BY_ID[t] ?? undefined
  );
}

function chipFact(chipId: string): Partial<BukFacts> | undefined {
  // 'fact:animal:кот' / 'fact:color:синий' — значение уже чистое и короткое.
  const [, kind, value] = chipId.split(':');
  if (kind === 'animal' && value) return { animal: cleanValue(value) };
  if (kind === 'color' && value) return { color: cleanValue(value) };
  return undefined;
}

function finish(reply: ChatReply, ctx: ChatContext, session: ChatSession, next: ChatSession): ChatReply {
  // Сцена («Расскажу о себе», выбор слова) должна дойти до конца: потолок
  // не вмешивается в её шаги — иначе чипы пропадают посреди разговора.
  if (next.scene !== 'idle' || session.lines + reply.lines.length < MAX_BUK_LINES) return reply;
  // Потолок достигнут: чипов не остаёмся, а последней строкой ОБЯЗАНА идти
  // сама реплика-дело (спека: дальше — только предложение сделать дело).
  // Действие-кнопка у реплики своё — не подменяем «Полетели» наоборот.
  const play = playAction(ctx);
  return {
    ...reply,
    chips: undefined,
    action: reply.action ?? play.action,
    lines: [...reply.lines, play.line],
  };
}

/**
 * Ответ БУКа на ход ребёнка. `chipId` — клик по чипу (надёжнее текста),
 * `text` — свободная печать: по ней ищем известное слово, приветствие
 * и белые списки фактов в активных сценах. Неизвестное — мягкий фолбэк.
 */
export function chatRespond(
  input: { chipId?: string; text?: string },
  ctx: ChatContext,
  session: ChatSession,
): { reply: ChatReply; session: ChatSession } {
  const next: ChatSession = { ...session };
  const chipId = input.chipId;
  const text = (input.text ?? '').trim();

  // Потолок: дальше БУК только предлагает сделать дело — но не посреди
  // многоходовой сцены: её шаги должны дойти до конца (см. finish).
  if (session.lines >= MAX_BUK_LINES && session.scene === 'idle') {
    const play = playAction(ctx);
    return { reply: { lines: [play.line], action: play.action }, session: next };
  }

  let reply: ChatReply;

  // ── Сцены многоходового разговора ───────────────────────────────────────
  if (session.scene === 'animal') {
    const raw = chipId ? (chipFact(chipId)?.animal ?? text) : text;
    const animal = cleanValue(raw ?? '');
    if (!animal) {
      reply = { lines: ['Ну… какое у тебя животное?'], chips: ANIMAL_CHIPS };
    } else {
      next.scene = 'color';
      reply = {
        lines: [`Записал: ${animal}. А цвет какой любимый?`],
        chips: COLOR_CHIPS,
        facts: { animal },
      };
    }
  } else if (session.scene === 'color') {
    const raw = chipId ? (chipFact(chipId)?.color ?? text) : text;
    const color = cleanValue(raw ?? '');
    if (!color) {
      reply = { lines: ['Какой цвет твой любимый?'], chips: COLOR_CHIPS };
    } else {
      next.scene = 'pet';
      reply = {
        lines: ['Записал! А питомец есть? Назови его!'],
        chips: [{ id: 'fact:pet:skip', label: 'Не скажу' }],
        facts: { color },
      };
    }
  } else if (session.scene === 'pet') {
    if (chipId === 'fact:pet:skip') {
      next.scene = 'idle';
      reply = { lines: ['Хорошо, это твой секрет!'], chips: ROOT_CHIPS };
    } else {
      const petName = cleanValue(text);
      if (!petName) {
        reply = {
          lines: ['Напиши имя питомца — я запомню!'],
          chips: [{ id: 'fact:pet:skip', label: 'Не скажу' }],
        };
      } else {
        next.scene = 'idle';
        reply = { lines: [`Запомнил: ${petName}!`], chips: ROOT_CHIPS, facts: { petName } };
      }
    }
  } else if (session.scene === 'word') {
    const word = chipId?.startsWith('word:')
      ? WORD_BY_ID[chipId.slice(5)]
      : knownWord(text);
    if (!word) {
      reply = { lines: ['Какое слово интересно? Выбирай!'], chips: wordChips(ctx) };
    } else {
      next.scene = 'idle';
      reply = wordReply(word);
    }
  } else if (chipId === 'today') {
    reply = todayReply(ctx);
  } else if (chipId === 'spelling') {
    next.scene = 'word';
    reply = { lines: ['Какое слово интересно? Выбирай!'], chips: wordChips(ctx) };
  } else if (chipId === 'rule') {
    reply = ruleReply(ctx);
  } else if (chipId === 'tell') {
    next.scene = 'animal';
    reply = { lines: ['Расскажи про себя: какое любимое животное?'], chips: ANIMAL_CHIPS };
  } else if (chipId === 'play') {
    const play = playAction(ctx);
    reply = { lines: [play.line], action: play.action, chips: undefined };
  } else if (chipId?.startsWith('word:')) {
    const word = WORD_BY_ID[chipId.slice(5)];
    reply = word ? wordReply(word) : { lines: ['Не знаю такого слова…'], chips: ROOT_CHIPS };
  } else if (chipId === 'fact:pet:skip') {
    reply = { lines: ['Хорошо, это твой секрет!'], chips: ROOT_CHIPS };
  } else {
    // Свободная печать: известное слово, приветствие — иначе мягкий фолбэк.
    const word = knownWord(text);
    if (word) {
      reply = wordReply(word);
    } else if (/^(привет|здравствуй|здравствуйте|здорово|хай)[!.\s]*$/i.test(text)) {
      reply = { lines: ['Привет! Чем помочь?'], chips: ROOT_CHIPS };
    } else {
      reply = { lines: ['Назови слово или жми чип внизу!'], chips: ROOT_CHIPS };
    }
  }

  const finalReply = finish(reply, ctx, session, next);
  next.lines = session.lines + finalReply.lines.length;
  return { reply: finalReply, session: next };
}

/**
 * Первая реплика при открытии: приветствие по времени (тот же источник, что
 * у плавающего БУКа) плюс отсылка к памяти, если факт уже пережил неделю.
 */
export function openChat(ctx: ChatContext): { reply: ChatReply; session: ChatSession } {
  const lines = [greetingFor(ctx.hour)];
  const memory = memoryLine(ctx.profile.bukFacts);
  if (memory) lines.push(memory);
  const session = sessionStart();
  session.lines = lines.length;
  return { reply: { lines, chips: ROOT_CHIPS }, session };
}
