// Правила помощи БУКа в уроке (docs/buk-in-lesson.md) — без DOM: их легко сломать
// правкой фразы, а из-за этого помощь либо выдаёт ответ, либо перестаёт помогать.
// Файл подключается из tests/adaptive.test.ts, поэтому идёт и в `test:adaptive`,
// и в смоук.
import assert from 'node:assert/strict';
import { WORDS } from '../src/content/words';
import { dangerSummary } from '../src/engine/word-facts';
import {
  NUDGE_MS,
  adjustQuality,
  canNudge,
  helperAfterAnswer,
  helperQuestion,
  helperReveal,
  nudgeMs,
  shouldNudge,
  type HelpStage,
} from '../src/state/bukHelp';
import type { TaskKind } from '../src/types';

const KINDS: TaskKind[] = ['intro', 'syllables', 'gap', 'build', 'write', 'visual', 'fix'];

// ── Фразы есть для всех заданий и влезают в пузырь ──────────────────────────
const lines = KINDS.map((kind) => helperQuestion(kind, WORDS[0]));
assert.equal(new Set(lines).size, KINDS.length, 'у каждого типа задания свой вопрос, без повторов');
for (const kind of KINDS) {
  const line = helperQuestion(kind, WORDS[0]);
  assert.ok(line.length > 0 && /[.?]$/.test(line), `${kind}: фраза должна быть предложением`);
  assert.ok(line.length <= 90, `${kind}: фраза длиннее 90 знаков — не влезет в панель`);
}

// ── Страж утечки ответа ────────────────────────────────────────────────────
// Самое важное свойство первой ступени: вопрос должен быть ОДИНАКОВЫМ для всех
// слов. Тогда он не может подсказать написание по построению: фраза выбирается
// только по типу задания и по наличию «опасных» букв (два варианта на вид).
// Плюс две страховки на случай будущей правки текста:
//  • ни один вопрос не содержит слова из списка (иначе он «называл» бы ответ);
//  • в вопросах нет одиночных заглавных букв — в приложении так выделяют опасные.
const wordTexts = WORDS.map((w) => w.text.toLowerCase());
/**
 * Одиночная заглавная буква ВНУТРИ предложения — так в приложении помечают
 * опасные буквы («Опасная буква: О»). Заглавная в начале предложения — норма.
 */
function hasMidSentenceCapital(line: string): boolean {
  return line
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => sentence.split(/\s+/).slice(1).some((t) => /^[А-ЯЁ]$/.test(t.replace(/[^А-ЯЁа-яё]/g, ''))));
}
for (const kind of KINDS) {
  const variants = new Set(WORDS.map((w) => helperQuestion(kind, w)));
  assert.ok(variants.size <= 2, `${kind}: вопрос зависит от конкретного слова — это уже подсказка ответом`);
  for (const line of variants) {
    const low = line.toLowerCase();
    for (const text of wordTexts) {
      assert.ok(!low.includes(text), `${kind}: вопрос содержит слово «${text}»`);
    }
    assert.ok(!hasMidSentenceCapital(line), `${kind}: в вопросе есть одиночная заглавная буква — это подсказка`);
  }
}

// ── Вторая ступень — мнемоника или сводка опасных букв ──────────────────────
for (const word of WORDS) {
  const reveal = helperReveal(word);
  assert.ok(reveal.length > 0, `${word.text}: вторая ступень пуста`);
  if (word.mnemonic) assert.equal(reveal, word.mnemonic, `${word.text}: мнемоника важнее сводки`);
  else assert.equal(reveal, dangerSummary(word), `${word.text}: без мнемоники показываем сводку`);
}

// ── Цена помощи: вопрос не притворяется самостоятельным ответом ─────────────
const cases: Array<[number | null, HelpStage, number | null]> = [
  [5, 0, 5],
  [5, 1, 4],
  [5, 2, 3],
  [3, 0, 3], // кнопка «💡» в задании
  [3, 2, 3],
  [4, 2, 4], // уже пониженное качество не понижается второй раз
  [0, 1, 0],
  [0, 2, 0],
  [null, 1, null],
];
for (const [quality, stage, expected] of cases) {
  assert.equal(adjustQuality(quality, stage), expected, `adjustQuality(${quality}, ${stage})`);
}

// ── Тихая пауза: где можно «застрять» и когда предлагать ────────────────────
assert.ok(!canNudge('intro') && !canNudge('syllables'), 'знакомство и слоги ведут ребёнка сами');
for (const kind of ['gap', 'build', 'write', 'visual', 'fix'] as TaskKind[]) {
  assert.ok(canNudge(kind), `${kind}: помощь по паузе уместна`);
}
const base = {
  kind: 'gap' as TaskKind,
  idleMs: NUDGE_MS,
  refused: false,
  panelOpen: false,
  hasVerdict: false,
  shownOnCard: false,
  threshold: NUDGE_MS,
};
assert.equal(shouldNudge(base), true, 'через порог паузы помощь предлагается');
assert.equal(shouldNudge({ ...base, idleMs: NUDGE_MS - 1 }), false, 'до порога — не предлагается');
assert.equal(shouldNudge({ ...base, refused: true }), false, 'после отказа — молчим до конца урока');
assert.equal(shouldNudge({ ...base, panelOpen: true }), false, 'панель уже открыта');
assert.equal(shouldNudge({ ...base, hasVerdict: true }), false, 'на экране вердикт');
assert.equal(shouldNudge({ ...base, shownOnCard: true }), false, 'на этой карточке уже предлагали');
assert.equal(shouldNudge({ ...base, kind: 'intro' }), false, 'в знакомстве предложений нет');
assert.ok(NUDGE_MS === 20_000, 'порог паузы в приложении — 20 секунд');
assert.ok(nudgeMs() > 0, 'порог должен быть положительным числом');

// ── Строка в вердикте: ошибка, вопрос, серия ────────────────────────────────
assert.ok(helperAfterAnswer({ ok: true, stage: 0, streak: 1, reason: 'practice' }) === null, 'без повода БУК молчит');
assert.ok(
  (helperAfterAnswer({ ok: true, stage: 1, streak: 1, reason: 'practice' }) ?? '').includes('после вопроса'),
  'после вопроса — отдельная похвала',
);
assert.equal(
  helperAfterAnswer({ ok: true, stage: 0, streak: 3, reason: 'practice' }),
  'Серия 3! Так держать!',
  'серия — повод сказать',
);
const miss = helperAfterAnswer({ ok: false, stage: 0, streak: 0, reason: 'practice' }) ?? '';
const missRepair = helperAfterAnswer({ ok: false, stage: 0, streak: 0, reason: 'repair' }) ?? '';
assert.ok(miss.includes('вернётся'), 'об ошибке говорим поддержкой и обещаем отработку');
assert.ok(!missRepair.includes('вернётся'), 'на отработке не обещаем повторный возврат слова');
assert.ok(miss.length <= 90 && missRepair.length <= 90, 'строка вердикта должна влезать в полосу');

console.log('✓ помощник БУКа: вопросы без утечки ответа, цена помощи, тихая пауза, строка в вердикте');
