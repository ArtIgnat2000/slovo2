// Интересы ребёнка (engine/interests.ts, 0.70.0).
//
// Зачем отдельный набор проверок: интересы — это единственное место, где продукт
// спрашивает ребёнка «что тебе нравится». Ошибка здесь не «сломает экран», а
// тихо вернёт стереотип: полка «для девочек», из которой ничего нельзя выбрать,
// или витрина, где техника снова первая для всех. Поэтому стережём ровно это:
//  1) в профиле нет пола — есть только интересы;
//  2) интерес ничего не скрывает, а только поднимает свои полки;
//  3) мусор из файла выгрузки не ломает витрину (и не даёт третьего интереса);
//  4) у каждого интереса есть хотя бы одна живая полка магазина.
import assert from 'node:assert/strict';
import {
  INTERESTS,
  MAX_INTERESTS,
  interestById,
  interestsSummary,
  isInterestId,
  normalizeInterests,
  orderByInterests,
  toggleInterest,
} from '../src/engine/interests';

// Полки витрины: те же id, что в ShopScreen (Cat). Держим список здесь явно,
// чтобы тест падал, если интерес начнёт ссылаться на несуществующую полку.
const SHELF_IDS = ['outfits', 'toys', 'costumes', 'music', 'sounds', 'backgrounds'];

assert.equal(MAX_INTERESTS, 2, 'два интереса: «это про меня», а не список');
assert.ok(INTERESTS.length >= 6, 'интересов должно быть несколько');
assert.equal(new Set(INTERESTS.map((i) => i.id)).size, INTERESTS.length, 'id интересов уникальны');
assert.equal(new Set(INTERESTS.map((i) => i.title)).size, INTERESTS.length, 'названия не повторяются');

for (const interest of INTERESTS) {
  assert.ok(interest.title.trim().length >= 3, `${interest.id}: нужно название`);
  assert.ok(interest.emoji.trim().length > 0, `${interest.id}: нужна эмодзи для плитки`);
  assert.ok(interest.hint.trim().length >= 10, `${interest.id}: нужна подсказка словами`);
  assert.ok(interest.shelves.length >= 1, `${interest.id}: интерес должен вести хотя бы на одну полку`);
  for (const shelf of interest.shelves) {
    assert.ok(SHELF_IDS.includes(shelf), `${interest.id}: неизвестная полка ${shelf}`);
  }
  assert.equal(new Set(interest.shelves).size, interest.shelves.length, `${interest.id}: полки без дублей`);
}

// Никакого «пола»: слова, которые превращают интерес в ярлык, запрещены.
const BANNED = /для девочек|для мальчиков|девчач|мальчиш|gender|пол ребёнка|girls only|boys only/i;
for (const interest of INTERESTS) {
  assert.ok(!BANNED.test(`${interest.title} ${interest.hint}`), `${interest.id}: интерес не должен быть ярлыком`);
}

// Есть и «девчачьи», и «мальчиковые» интересы в смысле данных — оба пола
// находят своё, и техника никуда не исчезла.
assert.ok(isInterestId('tech'), 'техника остаётся интересом — её никто не прячет');
assert.ok(isInterestId('animals') && isInterestId('home'), 'животные и дом — тоже интересы');

// ── Санитизация ────────────────────────────────────────────────────────────
assert.deepEqual(normalizeInterests(undefined), []);
assert.deepEqual(normalizeInterests(null), []);
assert.deepEqual(normalizeInterests('animals'), []);
assert.deepEqual(normalizeInterests([42, null, {}, 'нет-такого']), []);
assert.deepEqual(normalizeInterests(['home', 'home', 'tech']), ['home', 'tech'], 'дубли схлопываются');
assert.deepEqual(normalizeInterests(['home', 'tech', 'music']), ['home', 'tech'], 'больше двух не храним');
assert.deepEqual(normalizeInterests(['tech', 'nope', 'animals']), ['tech', 'animals'], 'мусор выкидывается');

// ── Тап по плитке ──────────────────────────────────────────────────────────
assert.deepEqual(toggleInterest([], 'home'), ['home']);
assert.deepEqual(toggleInterest(['home'], 'home'), [], 'повторный тап снимает выбор');
assert.deepEqual(toggleInterest(['home'], 'tech'), ['home', 'tech']);
// Переполнение вытесняет САМЫЙ СТАРЫЙ выбор, а не отказывает в нажатии:
// запрет без объяснения ребёнок 7 лет читает как поломку.
assert.deepEqual(toggleInterest(['home', 'tech'], 'music'), ['tech', 'music']);
assert.deepEqual(toggleInterest(['home', 'tech'], 'нет-такого'), ['home', 'tech'], 'чужой id ничего не ломает');

// ── Порядок полок ──────────────────────────────────────────────────────────
const shelves = SHELF_IDS.map((id) => ({ id }));
assert.deepEqual(
  orderByInterests(shelves, []).map((s) => s.id),
  SHELF_IDS,
  'без интересов порядок витрины не меняется',
);
assert.deepEqual(
  orderByInterests(shelves, ['home']).map((s) => s.id),
  ['backgrounds', 'outfits', 'toys', 'costumes', 'music', 'sounds'],
  '«дом» поднимает фоны и наряды, остальное остаётся как было',
);
assert.deepEqual(
  orderByInterests(shelves, ['tech']).map((s) => s.id),
  ['toys', 'outfits', 'costumes', 'music', 'sounds', 'backgrounds'],
  '«техника» поднимает свою полку — это по-прежнему работает',
);
assert.deepEqual(
  orderByInterests(shelves, ['magic', 'music']).map((s) => s.id),
  ['costumes', 'backgrounds', 'outfits', 'music', 'sounds', 'toys'],
  'два интереса: сначала полки первого выбора, потом второго',
);
// Главное правило: НИЧЕГО не исчезает — только порядок.
assert.equal(orderByInterests(shelves, ['home']).length, shelves.length, 'ни одна полка не пропала');
assert.deepEqual(
  [...orderByInterests(shelves, ['home', 'tech']).map((s) => s.id)].sort(),
  [...SHELF_IDS].sort(),
  'набор полок одинаков при любых интересах',
);
// Исходный массив не мутируется: иначе сортировка полки «залипнет» между рендерами.
const frozen = shelves.map((s) => s.id).join(',');
orderByInterests(shelves, ['home']);
assert.equal(shelves.map((s) => s.id).join(','), frozen, 'orderByInterests не меняет входной массив');

// ── Подпись и поиск ────────────────────────────────────────────────────────
assert.equal(interestById('nope'), null);
assert.equal(interestById(undefined), null);
assert.equal(interestById('home')?.title, 'Дом и уют');
assert.equal(interestsSummary([]), null);
assert.equal(interestsSummary(['nope']), null);
assert.match(interestsSummary(['animals', 'tech']) ?? '', /Животные/);
assert.match(interestsSummary(['animals', 'tech']) ?? '', /Техника/);
const summary = interestsSummary(['animals', 'tech'])!;
assert.ok(!summary.startsWith('·') && !summary.endsWith('·'), 'подпись без висячих разделителей');

console.log('✓ интересы: шесть плиток без пола, два выбора, полки только меняют порядок');
