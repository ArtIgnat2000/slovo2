// «Цветок слова» (0.105.0) — движок и экран.
//
// Игра родилась из «виселицы» каталога, поэтому главное, что закрепляем
// тестом, — это её отличия от виселицы:
//  • попытки не кончаются, цветок не «умирает»;
//  • ошибка даёт подсказку (мнемоника → предложение → буква);
//  • верная буква всегда есть среди карточек и не стоит на фиксированном месте.
import './setup';
import {
  FLOWER_CHOICES,
  flowerChoices,
  flowerDone,
  flowerFits,
  flowerHint,
  flowerPick,
  flowerPool,
  flowerStep,
} from '../src/engine/word-flower';
import { WORDS_BY_GRADE } from '../src/content/words';
import type { Word } from '../src/types';
import { check, click, sleep } from './ui-helpers';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const word = (over: Partial<Word>): Word =>
  ({
    id: over.text ?? 'tmp',
    text: 'ромашка',
    stress: 2,
    syllables: ['ро', 'маш', 'ка'],
    danger: [1],
    dangerKind: 'vowel',
    hint: 'растение с белыми лепестками',
    emoji: '🌼',
    sentence: 'На лугу расцвела ____.',
    theme: 'plants',
    grades: [2],
    ...over,
  }) as Word;

export async function runWordFlowerChecks(): Promise<void> {
  console.log('\n── Игры: цветок слова ──');

  const target = word({});
  // ── 1. Шаги ─────────────────────────────────────────────────────────────
  const first = flowerStep(target, 0, seq([0.3]))!;
  check('цветок: первый шаг — первая буква слова', first.index === 0 && first.answer === 'р', `${first.index}:${first.answer}`);
  check('цветок: четыре карточки на шаге', first.choices.length === FLOWER_CHOICES, first.choices.join(','));
  check('цветок: верная буква всегда среди карточек', first.choices.includes('р'), first.choices.join(','));
  check('цветок: карточки не повторяются', new Set(first.choices).size === first.choices.length, '');
  const mid = flowerStep(target, 3, seq([0.7]))!;
  check('цветок: шаг сдвигается слева направо', mid.index === 3 && mid.answer === 'а', `${mid.index}:${mid.answer}`);
  check('цветок: за последней буквой шага нет', flowerStep(target, 7) === null, '');

  // ── 2. Выбор буквы ──────────────────────────────────────────────────────
  check('цветок: верная буква открывает лепесток', flowerPick(target, 0, 'р') === 1, '');
  check('цветок: неверная буква прогресс не меняет', flowerPick(target, 0, 'а') === 0, '');
  check('цветок: назад не откатывает', flowerPick(target, 4, 'р') === 4, '');
  check('цветок: промах не уменьшает и после нескольких ошибок', flowerPick(target, 2, 'ю') === 2, '');
  check('цветок: слово раскрыто только целиком', !flowerDone(target, 6) && flowerDone(target, 7), '');

  // ── 3. Лестница подсказок (не попытки!) ────────────────────────────────
  const withMnemonic = word({ mnemonic: 'рОмашка — рОзовая серединка' });
  check('цветок: без ошибок подсказки нет', flowerHint(withMnemonic, 0) === 'none', '');
  check('цветок: первая ошибка даёт мнемонику', flowerHint(withMnemonic, 1) === 'mnemonic', '');
  check('цветок: вторая ошибка даёт предложение', flowerHint(withMnemonic, 2) === 'sentence', '');
  check('цветок: третья ошибка показывает букву', flowerHint(withMnemonic, 3) === 'letter', '');
  check('цветок: после десятой ошибки подсказка та же, игра продолжается',
    flowerHint(withMnemonic, 10) === 'letter' && flowerPick(target, 0, 'р') === 1, '');
  check('цветок: без мнемоники первая ошибка сразу даёт предложение',
    flowerHint(word({}), 1) === 'sentence', flowerHint(word({}), 1));

  // ── 4. Какие слова попадают ─────────────────────────────────────────────
  check('цветок: фраза не попадает', !flowerFits(word({ text: 'Красная площадь' })), '');
  check('цветок: дефис не попадает', !flowerFits(word({ text: 'кто-нибудь' })), '');
  check('цветок: одна буква не попадает', !flowerFits(word({ text: 'я' })), '');
  let poolsOk = true;
  for (const grade of [1, 2, 3, 4, 5] as const) {
    const pool = flowerPool(WORDS_BY_GRADE[grade]);
    if (!pool.length || pool.some((w) => /\s|-/.test(w.text))) poolsOk = false;
  }
  check('цветок: пул есть в каждом классе и без фраз', poolsOk, '');

  // ── 5. Карточки — соседки, а не «вырезанные из слова» ──────────────────
  const choices = flowerChoices('о', [...'корова'], seq([0.5]));
  check('цветок: для «о» среди карточек есть типичная ошибка «а»',
    choices.includes('о') && choices.includes('а'), choices.join(','));
}
