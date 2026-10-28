// Генератор правдоподобного файла прогресса для демонстрационной базы.
//
// Все id берём из реальных каталогов (магазин, базы, костюмы, музыка, звуки,
// слова), а прогресс «проживаем» день за днём движковыми правилами приложения
// (SRS, серии дней, пазлы, недельные награды, задания и сундуки) — поэтому файл
// без потерь проходит тот же санитайзер, что и импорт с телефона.
// RNG детерминированный: повторный запуск в тот же день даёт тот же файл.

import type {
  ClassId,
  DayStat,
  LessonState,
  Profile,
  Settings,
  ShopSlot,
  StudySession,
  WordState,
} from '../../src/types';
import { LESSONS_BY_GRADE, WORDS_BY_GRADE, type GradeLesson } from '../../src/content/words';
import { applyAnswer, initState, pickReviewWords } from '../../src/engine/srs';
import { ITEM_BY_ID, SHOP_ITEMS, normalizeWishlist, type ShopItem } from '../../src/engine/shop';
import { BUILDING_BY_ID } from '../../src/engine/buildings';
import {
  awardLessonPiece,
  CRYSTAL_COSTUMES,
  normalizePuzzle,
} from '../../src/engine/puzzles';
import { MUSIC_TRACKS, STARTER_TRACK_IDS } from '../../src/engine/music';
import { STARTER_SOUND_IDS } from '../../src/engine/sounds';
import { CHEST_SKINS } from '../../src/engine/chests';
import { ACHIEVEMENTS, XP, starsFor } from '../../src/engine/rewards';
import {
  buildDayPlan,
  claimableQuests,
  dayMetrics,
  plannedQuests,
  rollChest,
} from '../../src/engine/quests';
import { settleWeeklyRewards, weekStartKey } from '../../src/engine/weekly-rewards';
import { dayKey, prevDay } from '../../src/engine/day';
import { BASE_TINT, normalizeTuning, tintOptions, tintPalette } from '../../src/engine/tints';
import { normalizeWorld } from '../../src/engine/world';
import { normalizeStudySessions } from '../../src/engine/study';

// ── Детерминированный RNG ────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T>(entries: [T, number][]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
  }
}

// ── План демонстрационного профиля ───────────────────────────────────────────

interface ProfilePlan {
  idSeed: string;
  name: string;
  avatar: string;
  grade: ClassId;
  lessonSize: Profile['lessonSize'];
  /** Сколько календарных дней назад создан профиль. */
  createdDaysAgo: number;
  /** Сколько из них были учебными (с завершёнными уроками). */
  activeDays: number;
  /** Длина финальной серии: столько последних дней подряд активны. */
  endStreak: number;
  /** Сколько уроков программы пройдено впервые (остальные заходы — повторы). */
  lessonsTarget: number;
  /** Желаемые покупки: вещи магазина (наряды и техника). */
  items: string[];
  /** Научные базы. */
  buildings: string[];
  /** Кристальные костюмы. */
  crystalCostumes: string[];
  /** Купленные платные музыкальные треки (стартовые добавятся сами). */
  musicPaid: string[];
  /** Сколько оттенков открыть (по 1 💎 за оттенок). */
  tints: number;
  /** Мечты (wishlist) — намеренно некупленные id. */
  wishlist: string[];
  /** Любимая техника на главном подиуме ангара. */
  favoriteToy: string;
  /** Облик сундука, выбранный ребёнком. */
  chestSkin: string;
}

const PLANS: ProfilePlan[] = [
  {
    // Основной демонстрационный профиль: учится дольше всех, коллекция
    // собрана с характером — тема электронной научной базы.
    idSeed: 'sonya',
    name: 'Соня',
    avatar: '🦊',
    grade: 2,
    lessonSize: 'standard',
    createdDaysAgo: 54,
    activeDays: 43,
    endStreak: 11,
    lessonsTarget: 12,
    items: [
      // наряды: 7 из 34 (21%)
      'clips-stars', 'cap', 'bow', 'scarf', 'wreath', 'glasses-heart', 'dress-rainbow',
      // авто: 4 из 18 (22%)
      'car-racer', 'car-jeep', 'car-taxi', 'car-electron-base',
      // самолёты: 1 из 5 (20%)
      'plane-swift',
      // корабли: 1 из 5 (20%)
      'ship-paper',
      // телефоны и электроника: 3 из 11 (27%)
      'phone-smart', 'phone-flip', 'headphones-max',
      // питомцы, спорт, вкусняшки: по 1 из 4 (25%)
      'pet-bunny', 'sport-ball', 'food-donut',
    ],
    buildings: ['electron-base'],
    crystalCostumes: ['electron-suit'],
    musicPaid: ['life-of-riley', 'pixelland'],
    tints: 3,
    wishlist: ['crown', 'car-tesla', 'ship-titanic', 'titan'],
    favoriteToy: 'car-electron-base',
    chestSkin: 'star',
  },
  {
    // Второй ученик: профиль помладше, покупки проще и дешевле, база тоже есть.
    idSeed: 'misha',
    name: 'Миша',
    avatar: '🦖',
    grade: 3,
    lessonSize: 'short',
    createdDaysAgo: 50,
    activeDays: 40,
    endStreak: 6,
    lessonsTarget: 8,
    items: [
      // наряды: 7 из 34 (21%)
      'clips-stars', 'cap', 'bow', 'choker', 'badge-cat', 'hair-ponytail', 'wreath',
      // авто: 4 из 18 (22%)
      'car-racer', 'car-jeep', 'car-taxi', 'car-mercedes',
      // самолёты: 1 из 5 (20%)
      'plane-swift',
      // корабли: 1 из 5 (20%)
      'ship-paper',
      // телефоны: 3 из 11 (27%)
      'phone-smart', 'phone-flip', 'phone-retro',
      // по одной покупке из малых полок (25%)
      'pet-bunny', 'sport-ball', 'food-icecream',
    ],
    buildings: ['electron-base'],
    crystalCostumes: ['lady-bug'],
    musicPaid: ['happy-alley', 'fluffing-a-duck'],
    tints: 2,
    wishlist: ['grad', 'car-lambo', 'plane-moon-base', 'dark-lord'],
    favoriteToy: 'car-mercedes',
    chestSkin: 'flower',
  },
];

// ── Вспомогательные структуры ────────────────────────────────────────────────

interface BuyEntry {
  kind: 'item' | 'building' | 'crystal' | 'music';
  id: string;
  price: number;
}

interface SimState {
  gems: number;
  xp: number;
  streak: number;
  freezes: number;
  lastDay: string;
  words: Record<string, WordState>;
  lessons: Record<string, LessonState>;
  errors: Record<string, number>;
  days: Record<string, DayStat>;
  sessions: StudySession[];
  chestsTotal: number;
  puzzle: ReturnType<typeof normalizePuzzle>;
  weekly: { week: string; claimed: number[] };
  owned: string[];
  equipped: Partial<Record<ShopSlot, string>>;
  buildingsOwned: string[];
  activeBuilding: string | null;
  crystalOwned: string[];
  musicOwned: string[];
  ledger: { earned: number; spent: number };
}

const TASK_KINDS = ['intro', 'syllables', 'gap', 'build', 'write', 'visual', 'fix'] as const;

function dayAtTime(day: string, hour: number, minute: number): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute).getTime();
}

/** Маска учебных дней: точное число активных дней, в конце — непрерывная серия. */
function buildTimeline(plan: ProfilePlan, rng: Rng, yesterday: string): string[] {
  const days: string[] = [];
  let cursor = yesterday;
  for (let i = 0; i < plan.createdDaysAgo; i++) {
    days.push(cursor);
    cursor = prevDay(cursor);
  }
  days.reverse();

  const active = new Array(days.length).fill(false);
  // Хвост гарантированно активен — это текущая серия дней.
  for (let i = days.length - plan.endStreak; i < days.length; i++) active[i] = true;
  for (let i = 0; i < days.length - plan.endStreak; i++) {
    // В выходные реже, в будни чаще, но без жёсткого расписания.
    const [y, m, d] = days[i].split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const p = dow === 0 || dow === 6 ? 0.55 : 0.82;
    if (rng.chance(p)) active[i] = true;
  }
  // Подгоняем под точное число активных дней: добавляем недостающие рядом
  // с уже активными днями или убираем самые «одинокие».
  const count = () => active.filter(Boolean).length;
  let guard = 0;
  while (count() < plan.activeDays && guard++ < 500) {
    const candidates = active
      .map((on, i) => ({ on, i }))
      .filter(({ on, i }) => !on && i < days.length - plan.endStreak &&
        ((i > 0 && active[i - 1]) || (i + 1 < active.length && active[i + 1])));
    if (!candidates.length) break;
    active[rng.pick(candidates).i] = true;
  }
  while (count() > plan.activeDays && guard++ < 1000) {
    const candidates = active
      .map((on, i) => ({ on, i }))
      .filter(({ on, i }) => on && i < days.length - plan.endStreak);
    if (!candidates.length) break;
    active[rng.pick(candidates).i] = false;
  }
  return days.filter((_, i) => active[i]);
}

/** Та же логика, что touchDay в state/store.ts. */
function touchDay(sim: SimState, day: string): void {
  const oldStreak = sim.streak;
  if (sim.lastDay === prevDay(day)) {
    sim.streak += 1;
  } else if (sim.lastDay === '') {
    sim.streak = 1;
  } else if (sim.freezes > 0 && sim.streak >= 3) {
    // Один пропущенный день «заморожен»: серия продолжается.
    sim.freezes -= 1;
    sim.streak += 1;
  } else {
    sim.streak = 1;
  }
  if (sim.streak % 7 === 0) sim.freezes += 1;
  if (sim.streak > oldStreak && sim.streak % 3 === 0) {
    sim.gems += 1;
    sim.ledger.earned += 1;
  }
  sim.lastDay = day;
}

function emptyDay(): DayStat {
  return {
    xp: 0, correct: 0, wrong: 0, lessons: 0, flawless: 0, reviewCorrect: 0,
    reviewWords: [], activeSeconds: 0, tasks: 0, errorWords: {}, recoveredWords: [],
  };
}

interface RunResult {
  correct: number;
  wrong: number;
  xp: number;
  answers: number;
  durationSec: number;
  errorWords: Record<string, number>;
  recovered: string[];
  taskKindErrors: Partial<Record<(typeof TASK_KINDS)[number], number>>;
  startTs: number;
  endTs: number;
}

/** Ответы по одному слову: новые слова знакомим, старые — повторяем. */
function answerWord(
  sim: SimState,
  wordId: string,
  ts: { at: number },
  rng: Rng,
  isNew: boolean,
  light = false,
): RunResult {
  // «Лёгкое» первое знакомство: урок только начат, слова остались в работе.
  const qualities: number[] = light
    ? rng.weighted<number[]>([
        [[5], 60],
        [[4, 5], 40],
      ])
    : isNew
      ? rng.weighted<number[]>([
          [[5, 5], 55],
          [[4, 5], 25],
          [[5, 3, 5], 12],
          [[0, 5, 5], 8], // редкая ошибка со сразу отработкой
        ])
      : rng.weighted<number[]>([
          [[5], 78],
          [[4], 15],
          [[0, 5], 7],
        ]);

  const res: RunResult = {
    correct: 0, wrong: 0, xp: 0, answers: 0, durationSec: 0,
    errorWords: {}, recovered: [], taskKindErrors: {},
    startTs: ts.at, endTs: ts.at,
  };
  let hadWrong = false;
  for (const q of qualities) {
    ts.at += rng.int(18, 42) * 1000;
    const prev = sim.words[wordId] ?? initState(ts.at);
    sim.words[wordId] = applyAnswer(prev, q, ts.at);
    res.answers += 1;
    if (q >= 3) {
      res.correct += 1;
      const gain = q >= 5 ? XP.task : XP.taskWithHint;
      res.xp += gain;
      if (hadWrong && !res.recovered.includes(wordId)) res.recovered.push(wordId);
    } else {
      res.wrong += 1;
      hadWrong = true;
      sim.errors[wordId] = (sim.errors[wordId] ?? 0) + 1;
      res.errorWords[wordId] = (res.errorWords[wordId] ?? 0) + 1;
      const kind = rng.pick([...TASK_KINDS]);
      res.taskKindErrors[kind] = (res.taskKindErrors[kind] ?? 0) + 1;
    }
  }
  res.endTs = ts.at;
  return res;
}

function mergeRun(day: DayStat, res: RunResult, isReview: boolean): void {
  day.correct += res.correct;
  day.wrong += res.wrong;
  day.xp += res.xp;
  day.tasks = (day.tasks ?? 0) + res.answers;
  // Время занятия: интервалы между ответами (18–42 с) плюс минутка на старт.
  res.durationSec = Math.max(45, Math.round((res.endTs - res.startTs) / 1000) + 45);
  day.activeSeconds = (day.activeSeconds ?? 0) + res.durationSec;
  for (const [id, n] of Object.entries(res.errorWords)) {
    day.errorWords![id] = (day.errorWords![id] ?? 0) + n;
  }
  for (const id of res.recovered) {
    if (!day.recoveredWords!.includes(id)) day.recoveredWords!.push(id);
  }
  if (isReview) {
    day.reviewCorrect += res.correct;
    for (const id of Object.keys(res.errorWords)) {
      if (!day.reviewWords!.includes(id)) day.reviewWords!.push(id);
    }
    // В повторение попадают и успешно потренированные слова.
  }
}

function makeSession(
  day: string,
  res: RunResult,
  mode: 'lesson' | 'review',
  lessonId: string | undefined,
  rng: Rng,
): StudySession {
  const overhead = rng.int(40, 90);
  const activeSeconds = Math.max(60, Math.round((res.endTs - res.startTs) / 1000) + overhead);
  return {
    id: `study_${res.startTs.toString(36)}_${rng.int(100000, 999999).toString(36)}`,
    day,
    startedAt: res.startTs,
    endedAt: res.endTs + overhead * 1000,
    activeSeconds,
    mode,
    ...(lessonId ? { lessonId } : {}),
    tasks: res.answers,
    correct: res.correct,
    wrong: res.wrong,
    errorWords: res.errorWords,
    taskKindErrors: res.taskKindErrors,
    recoveredWords: res.recovered,
    lastActivityAt: res.endTs,
    status: 'completed',
  };
}

// ── Симуляция одного профиля ─────────────────────────────────────────────────

function simulate(plan: ProfilePlan, seed: number, today: string): Profile {
  const rng = new Rng(seed);
  const lessons = LESSONS_BY_GRADE[plan.grade];
  const gradeWords = WORDS_BY_GRADE[plan.grade];
  const yesterday = prevDay(today);
  const activeDayKeys = buildTimeline(plan, rng, yesterday);

  const sim: SimState = {
    gems: 0, xp: 0, streak: 0, freezes: 0, lastDay: '',
    words: {}, lessons: {}, errors: {}, days: {}, sessions: [],
    chestsTotal: 0,
    puzzle: normalizePuzzle(undefined),
    weekly: { week: weekStartKey(activeDayKeys[0]), claimed: [] },
    owned: [], equipped: {}, buildingsOwned: [], activeBuilding: null,
    crystalOwned: [], musicOwned: [...STARTER_TRACK_IDS],
    ledger: { earned: 0, spent: 0 },
  };

  // Очередь покупок: от дешёвых к дорогим — как копит ребёнок.
  const queue: BuyEntry[] = [
    ...plan.items.map((id): BuyEntry => ({ kind: 'item', id, price: ITEM_BY_ID[id].price })),
    ...plan.musicPaid.map((id): BuyEntry => ({
      kind: 'music', id,
      price: MUSIC_TRACKS.find((t) => t.id === id)!.price,
    })),
    ...plan.crystalCostumes.map((id): BuyEntry => ({
      kind: 'crystal', id,
      price: CRYSTAL_COSTUMES.find((c) => c.id === id)!.price ?? 0,
    })),
    ...plan.buildings.map((id): BuyEntry => ({
      kind: 'building', id,
      price: BUILDING_BY_ID[id].price,
    })),
  ].sort((a, b) => a.price - b.price);

  let nextNewLesson = 0;

  for (let dayIndex = 0; dayIndex < activeDayKeys.length; dayIndex++) {
    const day = activeDayKeys[dayIndex];
    const isLastDay = dayIndex === activeDayKeys.length - 1;
    touchDay(sim, day);
    const stat = emptyDay();
    // План заданий фиксируется до первых ответов дня.
    const dayPlan = buildDayPlan(
      { words: sim.words } as Profile,
      day,
    );
    const clock = { at: dayAtTime(day, rng.int(15, 17), rng.int(5, 50)) };
    // Чаще два урока в день: так закрывается задание «2 урока» и основной
    // сундук дня, а каждый повторный заход даёт бонусный сундук (+5 💎).
    const runCount = rng.weighted<number>([
      [1, 18], [2, 50], [3, 32],
    ]);

    for (let run = 0; run < runCount; run++) {
      let lesson: GradeLesson;
      // Последний новый урок приберегаем на финальный день: его слова остаются
      // «в работе» (s < 90) — в базе есть и освоенное, и недоученное.
      const newLimit = isLastDay ? plan.lessonsTarget : plan.lessonsTarget - 1;
      const canOpenNew = nextNewLesson < Math.min(newLimit, lessons.length);
      const openedNew = canOpenNew && (isLastDay || nextNewLesson === 0 || rng.chance(0.72));
      if (openedNew) {
        lesson = lessons[nextNewLesson];
        nextNewLesson += 1;
      } else {
        // Повторяем уже пройденный урок: за каждый такой заход тоже положен
        // бонусный сундук — ради них повторы и существуют.
        const done = lessons.slice(0, nextNewLesson);
        lesson = rng.pick(done.length ? done : lessons.slice(0, 1));
        if (done.length === 0) nextNewLesson = 1;
      }

      const runRes: RunResult = {
        correct: 0, wrong: 0, xp: 0, answers: 0, durationSec: 0,
        errorWords: {}, recovered: [], taskKindErrors: {},
        startTs: clock.at, endTs: clock.at,
      };
      for (const wordId of lesson.wordIds) {
        const isNew = !sim.words[wordId];
        const part = answerWord(sim, wordId, clock, rng, isNew, isLastDay && openedNew);
        runRes.correct += part.correct;
        runRes.wrong += part.wrong;
        runRes.xp += part.xp;
        runRes.answers += part.answers;
        runRes.errorWords = { ...runRes.errorWords, ...part.errorWords };
        runRes.recovered.push(...part.recovered);
        runRes.endTs = clock.at;
      }
      mergeRun(stat, runRes, false);

      // Завершение урока: короны, опыт, пазл, недельная награда, сундук.
      const answered = runRes.correct + runRes.wrong;
      const pct = answered === 0 ? 100 : Math.round((runRes.correct / answered) * 100);
      const cur = sim.lessons[lesson.id] ?? { level: 0, best: 0, doneAt: 0, plays: 0 };
      const level = pct >= 60 ? Math.min(5, cur.level + 1) : cur.level;
      sim.lessons[lesson.id] = {
        level,
        best: Math.max(cur.best, pct),
        doneAt: clock.at,
        plays: cur.plays + 1,
      };
      stat.lessons += 1;
      const finishXp = XP.lessonDone + (starsFor(runRes.correct, answered) === 3 ? XP.perfectBonus : 0);
      // В приложении addXp пишет опыт и в профиль, и в день одной записью:
      // в профиль он попадёт в конце дня вместе со stat.xp, без двойного счёта.
      stat.xp += finishXp;

      const piece = awardLessonPiece(sim.puzzle);
      sim.puzzle = piece.puzzle;
      if (piece.award.gems > 0) {
        sim.gems += piece.award.gems;
        sim.ledger.earned += piece.award.gems;
      }

      const settlement = settleWeeklyRewards(sim.days, sim.weekly, day);
      // Дневная статистика нужна движку недельных наград.
      sim.days[day] = stat;
      sim.weekly = settlement.state;
      const weeklyGems = settlement.rewards.reduce((sum, r) => sum + r.gems, 0);
      if (weeklyGems > 0) {
        sim.gems += weeklyGems;
        sim.ledger.earned += weeklyGems;
      }

      sim.sessions.push(makeSession(day, runRes, 'lesson', lesson.id, rng));
    }

    // Тренировка повторения: берём просроченные слова вне сегодняшних уроков.
    const exclude = new Set<string>();
    for (const l of lessons) for (const id of l.wordIds) {
      if (sim.words[id] && rng.chance(0.25)) exclude.add(id);
    }
    const review = pickReviewWords(gradeWords, sim.words, exclude, rng.int(4, 7), new Set(), clock.at);
    if (review.words.length > 0 && rng.chance(0.8)) {
      const reviewRes: RunResult = {
        correct: 0, wrong: 0, xp: 0, answers: 0, durationSec: 0,
        errorWords: {}, recovered: [], taskKindErrors: {},
        startTs: clock.at, endTs: clock.at,
      };
      for (const w of review.words) {
        const part = answerWord(sim, w.id, clock, rng, false);
        reviewRes.correct += part.correct;
        reviewRes.wrong += part.wrong;
        reviewRes.xp += part.xp;
        reviewRes.answers += part.answers;
        reviewRes.errorWords = { ...reviewRes.errorWords, ...part.errorWords };
        reviewRes.recovered.push(...part.recovered);
        reviewRes.endTs = clock.at;
        if (!stat.reviewWords!.includes(w.id)) stat.reviewWords!.push(w.id);
      }
      mergeRun(stat, reviewRes, true);
      sim.sessions.push(makeSession(day, reviewRes, 'review', undefined, rng));
    }

    // Серия верных ответов дня: правдоподобная доля 70–100% верных,
    // но не больше общего числа верных ответов.
    {
      const upper = stat.correct;
      const lower = Math.min(upper, Math.max(2, Math.floor(upper * 0.7)));
      stat.streak = stat.flawless = rng.int(lower, upper);
    }

    // ── Награды дня: задания, основной сундук, бонусные сундуки за уроки ──
    const metrics = dayMetrics(stat);
    const claimable = claimableQuests(plannedQuests(dayPlan), metrics, [], day);
    for (const q of claimable) {
      sim.gems += q.spec.reward;
      sim.ledger.earned += q.spec.reward;
      // Исторические id заданий нигде не хранятся: DailyState один — на сегодня.
    }
    const allDone = dayPlan.length > 0 &&
      dayPlan.every((item) => claimable.some((q) => q.spec.kind === item.kind));
    if (allDone) {
      const chest = rollChest('daily', { awake: rng.chance(0.3) });
      sim.gems += chest.gems;
      sim.ledger.earned += chest.gems;
      sim.chestsTotal += 1;
    }
    for (let i = 0; i < stat.lessons; i++) {
      const chest = rollChest('bonus', { awake: rng.chance(0.25) });
      sim.gems += chest.gems;
      sim.ledger.earned += chest.gems;
      sim.chestsTotal += 1;
    }

    sim.xp += stat.xp;
    sim.days[day] = stat;

    // ── Покупки: не больше двух в день и только на накопленные кристаллы ──
    let buysToday = 0;
    while (queue.length > 0 && buysToday < 2) {
      const entry = queue[0];
      if (sim.gems < entry.price) break;
      queue.shift();
      sim.gems -= entry.price;
      sim.ledger.spent += entry.price;
      buysToday += 1;
      if (entry.kind === 'item') {
        const item: ShopItem = ITEM_BY_ID[entry.id];
        sim.owned.push(entry.id);
        sim.equipped[item.slot] = entry.id; // купленное сразу надевается
      } else if (entry.kind === 'building') {
        sim.buildingsOwned.push(entry.id);
        sim.activeBuilding = entry.id;
      } else if (entry.kind === 'crystal') {
        sim.crystalOwned.push(entry.id);
        sim.puzzle = { ...sim.puzzle, worn: entry.id };
      } else if (entry.kind === 'music') {
        sim.musicOwned.push(entry.id);
      }
    }
  }

  // Оттенки: по 1 💎 за открытие, только для купленных вещей с палитрой.
  const tuning = { current: {} as Record<string, string>, unlocked: {} as Record<string, string[]> };
  const tintable = sim.owned.filter((id) => tintPalette(id));
  for (let i = 0; i < Math.min(plan.tints, tintable.length); i++) {
    const targetId = tintable[i];
    const extra = tintOptions(targetId).find((t) => t.id !== BASE_TINT);
    if (!extra || sim.gems < 1) break;
    sim.gems -= 1;
    sim.ledger.spent += 1;
    tuning.unlocked[targetId] = [extra.id];
    if (i < 2) tuning.current[targetId] = extra.id;
  }

  // ── Сборка профиля в форме файла выгрузки ──
  // Утро первого учебного дня: гарантированно раньше любых занятий (15–17 ч).
  const firstTs = dayAtTime(activeDayKeys[0], 9, 0);
  const mastered = Object.values(sim.words).filter((w) => w.s >= 90).length;
  const trained = Object.values(sim.words).filter((w) => w.s > 0).length;
  const lessonsDone = Object.values(sim.lessons).filter((l) => l.plays > 0).length;
  const perfectLessons = Object.values(sim.lessons).filter((l) => l.best >= 99).length;

  // Достижения — тем же тестом, что в приложении.
  const achievements = ACHIEVEMENTS.filter((a) => a.test({
    streak: sim.streak,
    xp: sim.xp,
    mastered,
    lessonsDone,
    perfectLessons,
    wordsTrained: trained,
  })).map((a) => a.id);

  // Облики сундука: условия из engine/chests.ts.
  const chestSkins = CHEST_SKINS.filter((skin) => {
    if (skin.id === 'travel') return true;
    if (skin.id === 'sky') return sim.chestsTotal >= 5;
    if (skin.id === 'ice') return sim.streak >= 7;
    if (skin.id === 'star') return mastered >= 30;
    if (skin.id === 'flower') return mastered >= 15;
    if (skin.id === 'rainbow') return sim.streak >= 14;
    return false;
  }).map((s) => s.id);

  const ownedCostumes = [...sim.puzzle.assembled, ...sim.crystalOwned];
  const world = normalizeWorld(
    [plan.favoriteToy, sim.owned.find((id) => ITEM_BY_ID[id]?.toy === 'pet'), sim.puzzle.assembled[0]]
      .filter((id): id is string => Boolean(id)),
    sim.owned,
    ownedCostumes,
  );

  // Финальный недельный расчёт (награды уже выплачены во время симуляции).
  const weekly = settleWeeklyRewards(sim.days, sim.weekly, yesterday).state;

  const profile: Profile = {
    id: `p_demo_${plan.idSeed}`,
    name: plan.name,
    avatar: plan.avatar,
    createdAt: firstTs,
    xp: sim.xp,
    gems: sim.gems,
    streak: sim.streak,
    lastDay: yesterday,
    freezes: sim.freezes,
    words: sim.words,
    lessons: sim.lessons,
    errors: sim.errors,
    days: sim.days,
    studySessions: normalizeStudySessions(sim.sessions, today),
    achievements,
    lessonSize: plan.lessonSize,
    activeClass: plan.grade,
    daily: {
      day: today,
      claimed: [],
      chestsToday: 0,
      bonusChestsClaimed: 0,
      chestsTotal: sim.chestsTotal,
      plan: buildDayPlan({ words: sim.words } as Profile, today),
    },
    weekly: { week: weekStartKey(today), claimed: weekly.claimed },
    shop: {
      owned: sim.owned,
      equipped: { ...sim.equipped, toy: plan.favoriteToy },
      crystalCostumesOwned: sim.crystalOwned,
      musicOwned: sim.musicOwned,
      musicTrack: plan.musicPaid[plan.musicPaid.length - 1] ?? null,
      soundOwned: [...STARTER_SOUND_IDS], // бесплатные стартовые наборы
      soundPack: 'xylophone',
      tuning: normalizeTuning(tuning, [...sim.owned, ...ownedCostumes]),
      wishlist: normalizeWishlist(plan.wishlist, sim.owned, ownedCostumes, sim.musicOwned),
      world,
      buildingsOwned: sim.buildingsOwned,
      worldBase: sim.activeBuilding,
      activeBuilding: sim.activeBuilding,
    },
    puzzle: sim.puzzle,
    chestSkin: chestSkins.includes(plan.chestSkin) ? plan.chestSkin as Profile['chestSkin'] : 'travel',
    chestSkins,
  };

  // Диагностика для консоли генератора.
  const totalWords = gradeWords.length;
  const untouched = totalWords - trained;
  console.log(`\nПрофиль «${plan.name}» (${plan.grade} класс):`);
  console.log(`  дни: активных ${activeDayKeys.length} за ${plan.createdDaysAgo}, серия ${sim.streak}, заморозки ${sim.freezes}`);
  console.log(`  слова: освоено ${mastered}, в работе ${trained - mastered}, не тронуто ${untouched} (всего ${totalWords})`);
  console.log(`  уроки: пройдено ${lessonsDone}/${lessons.length}, идеальных ${perfectLessons}`);
  console.log(`  сундуки открыты: ${sim.chestsTotal}, XP ${sim.xp}, достижения ${achievements.join(', ')}`);
  console.log(`  кристаллы: заработано ${sim.ledger.earned}, потрачено ${sim.ledger.spent}, остаток ${sim.gems}`);
  console.log(`  покупки в очереди осталось: ${queue.length}${queue.length ? ` (${queue.map((q) => q.id).join(', ')})` : ''}`);
  console.log(`  пазл: собрано ${sim.puzzle.assembled.join(', ') || '—'}, в работе ${sim.puzzle.collecting ?? '—'}`);
  return profile;
}

// ── Настройки и сборка файла ─────────────────────────────────────────────────

const SETTINGS: Settings = {
  sound: true,
  music: true,
  musicVolume: 0.5,
  haptics: true,
  dailyGoal: 120,
  theme: 'auto',
  themeStyle: 'classic',
  mascot: 'on',
  lessonHelp: 'socratic',
};

export interface DemoFile {
  profiles: Profile[];
  activeId: string;
  settings: Settings;
}

export function buildDemoFile(now: number = Date.now()): DemoFile {
  const today = dayKey(new Date(now));
  const profiles = PLANS.map((plan, i) => simulate(plan, 20261027 + i * 1009, today));
  return { profiles, activeId: profiles[0].id, settings: SETTINGS };
}

// Контроль долей разделов: 20–45% каждого раздела магазина.
export function sectionReport(file: DemoFile): { profile: string; section: string; owned: number; total: number; pct: number }[] {
  const report: { profile: string; section: string; owned: number; total: number; pct: number }[] = [];
  for (const p of file.profiles) {
    const owned = new Set(p.shop?.owned ?? []);
    const sections: [string, ShopItem[]][] = [
      ['Наряды', SHOP_ITEMS.filter((i) => i.kind !== 'toy')],
      ...(['car', 'plane', 'ship', 'phone', 'pet', 'sport', 'food'] as const).map((toy) => [
        toy,
        SHOP_ITEMS.filter((i) => i.toy === toy),
      ] as [string, ShopItem[]]),
    ];
    for (const [section, items] of sections) {
      const have = items.filter((i) => owned.has(i.id)).length;
      report.push({
        profile: p.name,
        section,
        owned: have,
        total: items.length,
        pct: Math.round((have / items.length) * 100),
      });
    }
  }
  return report;
}

/**
 * Инварианты правдоподобной демо-базы. Падаем с ошибкой, если что-то не сошлось:
 * файл, который стыдно загрузить, не должен молча уехать в docs/promo.
 */
export function verifyDemoFile(file: DemoFile): void {
  const errors: string[] = [];
  for (const profile of file.profiles) {
    const plan = PLANS.find((p) => p.idSeed === profile.id.replace('p_demo_', ''));
    if (!plan) {
      errors.push(`${profile.name}: нет плана`);
      continue;
    }
    const name = profile.name;
    if (profile.gems < 60) errors.push(`${name}: мало кристаллов (${profile.gems})`);
    const owned = profile.shop?.owned ?? [];
    if (owned.length !== plan.items.length) {
      errors.push(`${name}: куплено вещей ${owned.length}, в плане ${plan.items.length} (очередь покупок не сошлась)`);
    }
    if ((profile.shop?.buildingsOwned ?? []).length !== plan.buildings.length) {
      errors.push(`${name}: не куплены все базы из плана`);
    }
    if ((profile.shop?.crystalCostumesOwned ?? []).length !== plan.crystalCostumes.length) {
      errors.push(`${name}: не куплены все кристальные костюмы из плана`);
    }
    const states = Object.values(profile.words);
    const mastered = states.filter((w) => w.s >= 90).length;
    const trained = states.filter((w) => w.s > 0).length;
    const inProgress = trained - mastered;
    if (mastered === 0) errors.push(`${name}: нет освоенных слов`);
    if (inProgress === 0) errors.push(`${name}: нет слов в работе (все тронутые сразу освоены)`);
    const totalWords = WORDS_BY_GRADE[profile.activeClass ?? 2].length;
    if (trained >= totalWords) errors.push(`${name}: затронуты все слова — нечего показать как «не изучено»`);
    const xpFromDays = Object.values(profile.days).reduce((sum, d) => sum + d.xp, 0);
    if (xpFromDays !== profile.xp) errors.push(`${name}: XP профиля (${profile.xp}) не равен сумме дней (${xpFromDays})`);
    if (Object.keys(profile.days).length !== plan.activeDays) {
      errors.push(`${name}: учебных дней ${Object.keys(profile.days).length}, в плане ${plan.activeDays}`);
    }
  }
  for (const row of sectionReport(file)) {
    // Разделы из одной позиции (самолёты/корабли = 5) округляются до 20%.
    if (row.owned > 0 && (row.pct < 19 || row.pct > 46)) {
      errors.push(`${row.profile}: раздел «${row.section}» ${row.owned}/${row.total} = ${row.pct}% вне 20–45%`);
    }
  }
  if (errors.length) {
    throw new Error('Демо-база не прошла проверку:\n - ' + errors.join('\n - '));
  }
}
