import assert from 'node:assert/strict';
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
