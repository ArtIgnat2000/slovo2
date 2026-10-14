// Правила заданий дня: план на день, подстройка цели и выбор слов для повторения.
//
// Здесь ловятся три вещи, из-за которых задание «Повтори 5 слов» было невыполнимым:
//  1) новому профилю (повторять нечего) задание не выдаётся — вместо него другой вид дня;
//  2) цель опускается до числа пройденных слов, а не жёстко 5;
//  3) план дня фиксируется и не «уезжает» посреди дня, когда ребёнок выучил новые слова.
// Плюс проверяется выбор слов: сначала просроченные, потом самые слабые, и только пройденные.
import assert from 'node:assert/strict';
import {
  allQuestsDone,
  bonusChestsReady,
  buildDayPlan,
  dailyChestClaimed,
  dayMetrics,
  BONUS_CHEST_GEMS,
  CHEST_GEMS,
  CHEST_WAKE_GEMS,
  CHEST_WAKE_TAPS,
  chestAwake,
  chestPreview,
  chestWakeBonus,
  countWakeTap,
  MIN_REVIEW_WORDS,
  nextRun,
  planOf,
  plannedQuests,
  questProgress,
  questsForDay,
  questTitle,
  rollChest,
  specFor,
} from '../src/engine/quests';
import { pickReviewWords } from '../src/engine/srs';
import { WORDS } from '../src/content/words';
import { dayKey } from '../src/engine/day';
import type { Profile, WordState } from '../src/types';

const DAY = 86_400_000;
const day = dayKey();
const base = questsForDay(day);
const reviewIsInDaySet = base.some((s) => s.kind === 'review');
const spareKind = (['lessons', 'flawless', 'correct', 'review'] as const).find(
  (k) => !base.some((s) => s.kind === k),
)!;

function profileWith(practised: number, opts: { s?: number; dueOffsetMs?: number } = {}): Profile {
  const now = Date.now();
  const words: Record<string, WordState> = {};
  WORDS.slice(0, practised).forEach((w, i) => {
    words[w.id] = {
      s: opts.s ?? 20 + i,
      due: now + (opts.dueOffsetMs ?? 3 * DAY),
      iv: 2,
      n: 2,
      seen: now - DAY,
      ok: 2,
      wrong: 0,
    };
  });
  return {
    id: 'p_test',
    name: 'Тест',
    avatar: '🦊',
    createdAt: now,
    xp: 0,
    gems: 0,
    streak: 0,
    lastDay: '',
    freezes: 0,
    words,
    lessons: {},
    errors: {},
    days: {},
    achievements: [],
  };
}

// 1. План дня: три задания, среди них нет невыполнимого
{
  const plan = buildDayPlan(profileWith(0), day);
  assert.equal(plan.length, 3, 'в дне ровно три задания');
  assert.equal(new Set(plan.map((p) => p.kind)).size, 3, 'виды заданий не повторяются');
  if (reviewIsInDaySet) {
    assert.ok(!plan.some((p) => p.kind === 'review'), 'новичку (0 слов) повторение не выдаём');
    assert.ok(plan.some((p) => p.kind === spareKind), 'вместо повторения — свободный вид дня');
  }
}

// 2. Мало пройденных слов — цель опускается под них, и её можно достичь
{
  if (reviewIsInDaySet) {
    const plan = buildDayPlan(profileWith(MIN_REVIEW_WORDS), day);
    const review = plan.find((p) => p.kind === 'review');
    assert.ok(review, 'с двумя пройденными словами повторение уже выдаётся');
    assert.equal(review!.target, MIN_REVIEW_WORDS);
    const spec = specFor('review');
    assert.equal(questTitle(spec, review!.target), 'Повтори 2 слова', 'цель видна в заголовке');

    const many = buildDayPlan(profileWith(30), day).find((p) => p.kind === 'review');
    assert.equal(many!.target, spec.target, 'когда слов много — цель как в шаблоне (5)');
    assert.equal(questTitle(spec, 5), 'Повтори 5 слов');
  }
}

// 3. План дня фиксируется и не меняется, когда ребёнок выучил новые слова
{
  if (reviewIsInDaySet) {
    const fresh = profileWith(0);
    fresh.daily = {
      day,
      claimed: [],
      chestsToday: 0,
      chestsTotal: 0,
      plan: buildDayPlan(fresh, day),
    };
    const later = { ...fresh, words: profileWith(30).words }; // к вечеру выучил 30 слов
    const plan = planOf(later, day);
    assert.ok(!plan.some((p) => p.kind === 'review'), 'план дня не переписывается на лету');
    assert.deepEqual(plan, fresh.daily.plan, 'зафиксированный план возвращается как есть');
  }
}

// 4. Прогресс задания «повтори» считает потренированные слова, а не верные ответы
{
  const spec = specFor('review');
  const m = dayMetrics({ xp: 0, correct: 0, wrong: 0, lessons: 0, flawless: 0, reviewCorrect: 0, reviewWords: ['a', 'b', 'c'] });
  assert.equal(m.reviewWords, 3);
  assert.equal(questProgress(spec, 5, m).done, false, '3 из 5 — ещё не закрыто');
  assert.equal(questProgress(spec, 3, m).done, true, 'ошибки не мешают: цель 3 достигнута, хотя верных ответов 0');
  const none = dayMetrics(undefined);
  assert.equal(none.reviewWords, 0, 'день без данных — нулевой прогресс');
}

// 5. allQuestsDone и claimable-логика работают по плану, а не по шаблону
{
  const plan = buildDayPlan(profileWith(2), day);
  const metrics = { lessons: 2, correct: 12, flawless: 6, reviewWords: 2 };
  assert.equal(allQuestsDone(plan, metrics), true, 'план дня закрыт по своим целям');
  const items = plannedQuests(plan);
  assert.equal(items.length, 3);
  assert.ok(items.every((q) => metrics.lessons >= 0 && q.target > 0), 'у каждого задания есть цель');
}

// 6. Выбор слов для повторения: просроченные вперёд, потом слабые; только пройденные
{
  const now = Date.now();
  const states: Record<string, WordState> = {};
  const ids = WORDS.slice(0, 6).map((w) => w.id);
  ids.forEach((id, i) => {
    states[id] = { s: 30 + i * 10, due: now - DAY, iv: 2, n: 2, seen: now, ok: 2, wrong: 0 };
  });
  states[ids[5]] = { ...states[ids[5]], due: now + 5 * DAY, s: 5 }; // не просрочено, самое слабое
  const pickDue = pickReviewWords(WORDS, states, new Set(), 12, new Set(), now);
  assert.equal(pickDue.kind, 'due');
  assert.equal(pickDue.words.length, 5, 'просроченные берём первыми...');
  assert.ok(!pickDue.words.some((w) => w.id === ids[5]), '...и не подмешиваем свежие');

  // Ничего не просрочено → тренировка самых слабых
  const allFresh: Record<string, WordState> = {};
  ids.forEach((id, i) => {
    allFresh[id] = { s: 90 - i * 10, due: now + 3 * DAY, iv: 3, n: 3, seen: now, ok: 3, wrong: 0 };
  });
  const pickTraining = pickReviewWords(WORDS, allFresh, new Set(), 2, new Set(), now);
  assert.equal(pickTraining.kind, 'training');
  assert.deepEqual(pickTraining.words.map((w) => w.id), [ids[5], ids[4]], 'тренируем самые слабые');

  // Сегодня уже тренировали эти слова → вперёд идут те, которых сегодня не было
  const practised = new Set([ids[5], ids[4]]);
  const pickFresh = pickReviewWords(WORDS, allFresh, new Set(), 2, practised, now);
  assert.deepEqual(pickFresh.words.map((w) => w.id), [ids[3], ids[2]], 'повторный заход берёт новые слова');

  // Непройденные слова (s = 0) в повторение не попадают вообще
  const zero: Record<string, WordState> = { [ids[0]]: { s: 0, due: now - DAY, iv: 0, n: 0, seen: 0, ok: 0, wrong: 1 } };
  const pickZero = pickReviewWords(WORDS, zero, new Set(), 12, new Set(), now);
  assert.deepEqual(pickZero.words, [], 'незнакомые слова повторять нельзя');

  // Профиль без данных — пустой список (экран «Повторять нечего»)
  assert.deepEqual(pickReviewWords(WORDS, {}, new Set(), 12).words, []);
}

// 7. За каждый законченный урок доступен бонусный сундук, число не ограничено
{
  assert.equal(BONUS_CHEST_GEMS, 5);
  assert.equal(CHEST_GEMS, 15, 'основной сундук сохраняет прежнюю награду');
  assert.equal(rollChest().gems, CHEST_GEMS);
  assert.equal(rollChest('bonus').gems, BONUS_CHEST_GEMS);
  assert.equal(bonusChestsReady(3, 0), 3, 'три урока открывают три бонусных сундука');
  assert.equal(bonusChestsReady(3, 2), 1, 'каждый бонусный сундук можно забрать только один раз');
  assert.equal(bonusChestsReady(3, 3), 0);
  assert.equal(dailyChestClaimed({ chestsToday: 1, bonusChestsClaimed: 0 }), true);
  assert.equal(dailyChestClaimed({ chestsToday: 3, bonusChestsClaimed: 3 }), false, 'бонусы не закрывают основной сундук');
}

// 8. «Разбуди сундук»: тапы по закрытому сундуку будят его и дают надбавку.
//    Платим за сам факт пробуждения, а не за каждый тап, и один раз на сундук.
{
  assert.equal(CHEST_WAKE_TAPS, 5, 'сундук будится пятью тапами');
  assert.deepEqual(CHEST_WAKE_GEMS, { daily: 2, bonus: 1 });
  assert.equal(chestWakeBonus('daily'), 2);
  assert.equal(chestWakeBonus('bonus'), 1);

  // Обычный сундук ничего не теряет: без разогрева награда прежняя.
  assert.deepEqual(rollChest('daily'), { gems: 15, xp: 0, freezes: 0 });
  assert.deepEqual(rollChest('bonus'), { gems: 5, xp: 0, freezes: 0 });
  assert.deepEqual(rollChest('daily', { awake: true }), { gems: 17, xp: 0, freezes: 0, wakeBonus: 2 });
  assert.deepEqual(rollChest('bonus', { awake: true }), { gems: 6, xp: 0, freezes: 0, wakeBonus: 1 });

  // Превью до открытия совпадает с тем, что реально начислит rollChest.
  for (const kind of ['daily', 'bonus'] as const) {
    const preview = chestPreview(kind, true);
    assert.equal(preview.wake, chestWakeBonus(kind));
    assert.equal(preview.base, kind === 'daily' ? CHEST_GEMS : BONUS_CHEST_GEMS);
    assert.equal(rollChest(kind, { awake: true }).gems, preview.gems, 'подпись кнопки и начисление не разъезжаются');
  }

  // Счётчик тапов: растёт по одному и упирается в порог (лишние тапы ничего не дают).
  let taps = 0;
  for (let i = 0; i < 9; i++) taps = countWakeTap(taps);
  assert.equal(taps, CHEST_WAKE_TAPS, 'лишние тапы не копятся сверх порога');
  assert.equal(chestAwake(taps), true);
  assert.equal(chestAwake(CHEST_WAKE_TAPS - 1), false, 'недобуженный сундук надбавку не даёт');
  // Битое значение считаем за «тапов ещё не было»: сломанный счётчик не должен
  // сам по себе выдавать надбавку.
  assert.equal(countWakeTap(-3), 0);
  assert.equal(countWakeTap(Number.NaN), 0);
}

// Серия «без ошибок»: лучшая серия за день не сбрасывается ошибкой, текущая — сбрасывается.
{
  let d: { flawless: number; streak?: number } = { flawless: 0 };
  const run = (ok: boolean) => {
    d = { ...d, ...nextRun(d, ok) };
    return d.flawless;
  };
  for (let i = 0; i < 12; i++) run(true);
  assert.equal(d.flawless, 12);
  assert.equal(run(false), 12, 'ошибка не должна уменьшать лучшую серию');
  assert.equal(d.streak, 0, 'после ошибки текущая серия обнулена');
  for (let i = 0; i < 3; i++) run(true);
  assert.equal(d.flawless, 12, 'новая серия из 3 не побила рекорд 12');
  assert.equal(d.streak, 3);
  assert.equal(dayMetrics({ ...d, xp: 0, correct: 15, wrong: 1, lessons: 0, reviewCorrect: 0, reviewWords: [] }).flawless, 12);
}

console.log('✓ задания дня: план, повторение и бонусные сундуки за каждый урок');
