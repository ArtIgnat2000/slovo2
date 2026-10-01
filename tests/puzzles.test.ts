// Правила костюмных пазлов (идея из родительского чата, 2026-10-01):
// за каждый реально пройденный урок — +1 фрагмент; 9 фрагментов — костюм.
// Здесь — чистые функции движка; UI-проверки в tests/puzzles-ui.test.tsx.
import assert from 'node:assert/strict';
import {
  COSTUMES,
  OVERFLOW_GEMS,
  PUZZLE_SIZE,
  activeCostume,
  awardLessonPiece,
  chooseCollecting,
  collectableCostumes,
  costumeProgress,
  normalizePuzzle,
  toggleWorn,
} from '../src/engine/puzzles';

// 1) коллекция из 10 костюмов, id уникальны, у каждого есть название, описание и цвета
assert.equal(COSTUMES.length, 10);
assert.equal(new Set(COSTUMES.map((c) => c.id)).size, 10);
assert.ok(COSTUMES.every((c) => c.title && c.desc && /^#[0-9a-f]{6}$/i.test(c.body) && /^#[0-9a-f]{6}$/i.test(c.belly) && /^#[0-9a-f]{6}$/i.test(c.wing)));
// «космическая сага» без товарных знаков Disney: запрещённых имён в данных нет
for (const banned of ['Вейдер', 'штурмовик', 'Дарт', 'дждай', 'джедай', 'Йода', 'Клонов', 'MANDAL', 'Vader', 'Jedi']) {
  assert.ok(!JSON.stringify(COSTUMES).includes(banned), `имя ${banned} не должно встречаться`);
}
assert.equal(PUZZLE_SIZE, 9);

// 2) пустой профиль: 8 уроков — по фрагменту, 9-й собирает костюм, включается следующий
let p = normalizePuzzle(undefined);
assert.equal(activeCostume(p), COSTUMES[0].id);
const events: string[] = [];
for (let i = 0; i < PUZZLE_SIZE; i++) {
  const r = awardLessonPiece(p);
  p = r.puzzle;
  events.push(`${r.award.event}:${r.award.pieces}:${r.award.gems}`);
}
assert.deepEqual(events, [
  'piece:1:0', 'piece:2:0', 'piece:3:0', 'piece:4:0', 'piece:5:0',
  'piece:6:0', 'piece:7:0', 'piece:8:0',
  `assembled:${PUZZLE_SIZE}:0`,
]);
// собранный костюм сразу надет; сборка продолжается следующим несобранным
assert.equal(p.worn, COSTUMES[0].id);
assert.deepEqual(p.assembled, [COSTUMES[0].id]);
assert.equal(activeCostume(p), COSTUMES[1].id);
assert.equal(costumeProgress(p, COSTUMES[0].id), PUZZLE_SIZE);
assert.equal(costumeProgress(p, COSTUMES[1].id), 0);
// награда не начисляет кристаллы на «piece»/«assembled»
assert.ok(events.every((e) => e.endsWith(':0')), 'вне перелива кристаллов нет');

// 3) смена цели сборки сохраняет прогресс обоих костюмов (дубликатов и потерь нет)
p = chooseCollecting(p, COSTUMES[2].id);
for (let i = 0; i < 3; i++) p = awardLessonPiece(p).puzzle;
assert.equal(costumeProgress(p, COSTUMES[2].id), 3);
p = chooseCollecting(p, COSTUMES[1].id);
assert.equal(costumeProgress(p, COSTUMES[2].id), 3, 'прогресс «Лесного мудреца» не сбросился');
p = awardLessonPiece(p).puzzle;
assert.equal(costumeProgress(p, COSTUMES[1].id), 1);
// выбрать уже собранный костюм — нельзя (нет «вечной гонки» за 10-м фрагментом)
assert.deepEqual(chooseCollecting(p, COSTUMES[0].id), { ...p, collecting: p.collecting });

// 4) надеть можно только собранный; повторный тап снимает
assert.equal(toggleWorn(p, COSTUMES[1].id).worn, COSTUMES[0].id, 'несобранный не надевается: состояние не меняется');
assert.equal(toggleWorn(p, COSTUMES[0].id).worn, null, 'снят');
assert.equal(toggleWorn(toggleWorn(p, COSTUMES[0].id), COSTUMES[0].id).worn, COSTUMES[0].id, 'надет снова');

// 5) перелив: когда все 10 костюмов собраны, урок даёт кристаллы вместо фрагментов
let q = normalizePuzzle(undefined);
for (let c = 0; c < 10; c++) {
  for (let i = 0; i < PUZZLE_SIZE; i++) {
    const r = awardLessonPiece(q);
    q = r.puzzle;
    assert.equal(r.award.event, i === PUZZLE_SIZE - 1 ? 'assembled' : 'piece');
  }
}
assert.equal(q.assembled.length, 10);
assert.deepEqual(collectableCostumes(q), []);
assert.equal(activeCostume(q), null);
const over = awardLessonPiece(q);
assert.equal(over.award.event, 'gems');
assert.equal(over.award.gems, OVERFLOW_GEMS);
assert.deepEqual(over.puzzle, q, 'состояние пазлов при переливе не меняется');
assert.equal(over.award.costumeId, null);

// 6) санитизация импорта/старых профилей: мусор → безопасные значения
const bad = normalizePuzzle({
  pieces: { 'нет-такого': 5, [COSTUMES[0].id]: -3, x: 'y', [COSTUMES[1].id]: 99.7 },
  assembled: ['нет-такого', COSTUMES[2].id, COSTUMES[2].id, 42],
  worn: 'нет-такого',
  collecting: COSTUMES[2].id,
});
assert.equal(bad.pieces[COSTUMES[0].id], undefined, 'отрицательное число выкинуто');
assert.equal(bad.pieces[COSTUMES[1].id], PUZZLE_SIZE, 'кламп к максимуму');
assert.equal(bad.pieces['нет-такого'], undefined);
assert.deepEqual(bad.assembled, [COSTUMES[2].id], 'неизвестные id удалены, дубликаты схлопнуты');
assert.equal(bad.pieces[COSTUMES[2].id], PUZZLE_SIZE, 'собранный = полные 9');
assert.equal(bad.worn, null, 'надето только собранное');
assert.equal(bad.collecting, null, 'собранную цель выбрать нельзя');
assert.deepEqual(normalizePuzzle(null), normalizePuzzle(undefined));
assert.deepEqual(normalizePuzzle('строка').assembled, []);

console.log('✓ костюмные пазлы: фрагменты, смена цели без потерь, коллекция и перелив');
