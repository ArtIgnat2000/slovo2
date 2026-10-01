import assert from 'node:assert/strict';
// Правила заданий дня живут рядом: и test:adaptive, и смоук гоняют оба набора.
import './quests.test';
// Костюмные пазлы — тоже рядом: движок проверяется без DOM.
import './puzzles.test';
import { effectiveCards, nextAdaptiveState, recordAttempt } from '../src/engine/adaptive';
import { buildLesson } from '../src/engine/scheduler';
import { LESSONS, WORDS } from '../src/content/words';
const finish = (independent: number, total = 4) => ({ kind: 'finish' as const, attempts: { total, independent } });
assert.equal(effectiveCards(undefined, 16), 16);
assert.equal(effectiveCards(NaN, 16), 16);
assert.equal(effectiveCards(14, 12), 12);
assert.equal(effectiveCards(14, 16), 14);
assert.deepEqual(nextAdaptiveState({ cards: 14 }, 16, finish(4)), { cards: 14, good: 1 });
assert.deepEqual(nextAdaptiveState({ cards: 14, good: 1 }, 16, finish(4)), { cards: 15, good: 0 });
assert.deepEqual(nextAdaptiveState({ cards: 8 }, 16, finish(0)), { cards: 8, good: 0 });
assert.deepEqual(nextAdaptiveState({ cards: 14 }, 12, { kind: 'quit' }), { cards: 11, good: 0 });
assert.deepEqual(nextAdaptiveState({ cards: 12, good: 1 }, 12, finish(4)), { cards: 12, good: 0 });
assert.deepEqual(nextAdaptiveState({ cards: 14, good: 1 }, 16, finish(2, 2)), { cards: 14, good: 0 });
const seen = new Set<string>(), stats = { total: 0, independent: 0 };
recordAttempt(seen, stats, 'build', false, 0);
recordAttempt(seen, stats, 'build', false, 5);
recordAttempt(seen, stats, 'repair', true, 5);
recordAttempt(seen, stats, 'hint', false, 3);
assert.deepEqual(stats, { total: 2, independent: 0 });
for (let budget = 8; budget <= 20; budget++) for (const lesson of LESSONS) {
  for (let count = 0; count <= 3; count++) {
    const tasks = buildLesson({ lesson, level: 0, states: {}, reviewWords: WORDS.filter(w => !lesson.wordIds.includes(w.id)).slice(0, count), maxCards: budget });
    assert.ok(tasks.length <= budget);
    for (const id of new Set(tasks.filter(t => t.reason !== 'review').map(t => t.wordId))) {
      assert.ok(tasks.some(t => t.wordId === id && t.kind === 'intro'));
      assert.ok(tasks.some(t => t.wordId === id && t.reason === 'practice'));
    }
  }
}
console.log('✓ adaptive rules, primary metrics, phrase introductions, all budgets 8..20');

// ── Риски scheduler из §13 плана (регрессии) ─────────────────────────────────
import { DAY, applyAnswer, initState } from '../src/engine/srs';
import type { WordState } from '../src/types';

// 1. Фразы («до свидания») нельзя собирать из букв или печатать: им остаются
//    знакомство, слоги, окошко и «исправь робота» — на всех уровнях навыка.
{
  const phrase = WORDS.find((w) => w.text.includes(' '));
  assert.ok(phrase, 'в контенте есть фраза');
  const lesson = LESSONS.find((l) => l.wordIds.includes(phrase.id))!;
  for (const level of [0, 1, 2, 3, 4, 5]) {
    const tasks = buildLesson({ lesson, level, states: {}, reviewWords: [], maxCards: 20 });
    const mine = tasks.filter((t) => t.wordId === phrase.id);
    assert.ok(mine.some((t) => t.kind === 'intro'), `уровень ${level}: знакомство с фразой сохранено`);
    assert.ok(
      mine.every((t) => ['intro', 'syllables', 'gap', 'fix'].includes(t.kind)),
      `уровень ${level}: фразе не досталось сборки или письма (${mine.map((t) => t.kind).join(',')})`,
    );
  }
}

// 2. Отложенные слова не теряются: при бюджете 8 урок из 8 слов проходится
//    за несколько коротких уроков, а непоказанные слова идут первыми.
{
  const lesson = LESSONS.find((l) => l.id === 'school')!;
  const states: Record<string, WordState> = {};
  const rounds: string[][] = [];
  for (let round = 0; round < 4; round++) {
    const tasks = buildLesson({ lesson, level: 1, states, reviewWords: [], maxCards: 8 });
    const words = [...new Set(tasks.map((t) => t.wordId))];
    rounds.push(words);
    assert.ok(words.length <= 8, 'слов в коротком уроке не больше бюджета');
    for (const id of words) states[id] = applyAnswer(applyAnswer(states[id] ?? initState(), 5), 5);
  }
  assert.equal(new Set(rounds.flat()).size, lesson.wordIds.length, 'все слова урока показаны за несколько коротких уроков');
  assert.ok(rounds[1].some((id) => !rounds[0].includes(id)), 'второй урок берёт незнакомые слова, а не повторяет те же');
}

// 3. Второй круг второго урока идёт от слабых слов к уверенным, а не случайно.
{
  const base = LESSONS.find((l) => l.wordIds.length >= 5)!;
  const ids = base.wordIds.slice(0, 5);
  const now = Date.now();
  const states: Record<string, WordState> = {};
  // У всех слов разная слабость — ожидаемый порядок второго круга однозначен:
  // сначала с ошибками и низкой прочностью, затем уверенные.
  ids.forEach((id, i) => {
    states[id] = {
      ...initState(now - 3 * DAY),
      ok: 5,
      n: 5,
      s: 10 + i * 15,
      wrong: 4 - i,
      due: now + 5 * DAY,
    };
  });
  const tasks = buildLesson({ lesson: { ...base, wordIds: ids }, level: 1, states, reviewWords: [], maxCards: 12 });
  const practice = tasks.filter((t) => t.reason === 'practice');
  const secondRound = practice.slice(ids.length).map((t) => t.wordId);
  assert.equal(secondRound.length, ids.length, 'у каждого слова есть карточка второго круга');
  assert.deepEqual(secondRound, ids, 'второй круг идёт от слабых слов к уверенным');
}

console.log('✓ риски scheduler §13: фразы, отложенные слова, порядок второго круга');

// ── Предтестовый аудит: орфограммы 94 слов и подсветка ошибки робота ─────────
import { makeTask, pickDanger } from '../src/engine/scheduler';
import { findFixDiffIdx } from '../src/ui/TaskView';

{
  assert.equal(WORDS.length, 94, 'в словаре 94 слова 2 класса');
  for (const w of WORDS) {
    assert.ok(w.danger.length >= 1, `${w.text}: должна быть хотя бы одна опасная буква`);
    assert.ok(!w.danger.includes(w.stress), `${w.text}: ударная буква не может быть в danger`);
    const d = pickDanger(w);
    assert.notEqual(d, w.stress, `${w.text}: pickDanger не должен возвращать ударную гласную`);
    const gap = makeTask('gap', w.id, 'practice', d);
    assert.notEqual(gap.dangerIdx, w.stress, `${w.text}: окошко не закрывает ударную гласную`);
    assert.ok(gap.options?.includes(w.text[d]), `${w.text}: в вариантах окошка есть верная буква`);
    const fix = makeTask('fix', w.id, 'practice', d);
    assert.ok(fix.wrong && fix.wrong !== w.text, `${w.text}: робот должен сделать ошибку`);
    const diffIdx = findFixDiffIdx(w.text, fix.wrong!);
    assert.ok(diffIdx >= 0 && diffIdx < fix.wrong!.length, `${w.text}: индекс подсветки в пределах слова`);
  }

  // Удвоенные согласные в середине и на конце: подсвечивается оставшаяся парная согласная
  assert.equal(findFixDiffIdx('Россия', 'Росия'), 2);
  assert.equal('Росия'[findFixDiffIdx('Россия', 'Росия')], 'с');
  assert.equal(findFixDiffIdx('русский', 'руский'), 2);
  assert.equal('руский'[findFixDiffIdx('русский', 'руский')], 'с');
  assert.equal(findFixDiffIdx('суббота', 'субота'), 2);
  assert.equal('субота'[findFixDiffIdx('суббота', 'субота')], 'б');
  assert.equal(findFixDiffIdx('класс', 'клас'), 3);
  assert.equal('клас'[findFixDiffIdx('класс', 'клас')], 'с');
}

console.log('✓ предтестовый аудит: орфограммы 94 слов и подсветка в «Исправь робота»');
