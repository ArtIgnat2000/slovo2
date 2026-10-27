// «Мой мир» (engine/world.ts): поставить можно только полученное (0.71.1).
// Жалоба: неполученные вещи оказывались на сцене мира, а БУК в костюме
// «летал» над местом (базовый .mascot — плавающий, с анимацией float).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWorldPlaceable, normalizeWorld, toggleWorldPick, WORLD_SLOTS } from '../src/engine/world';

const owned = ['car-racer', 'cap'];
const costumes = ['dark-lord']; // собран пазлом; 'moon-suit' куплен за кристаллы ниже
const withCrystal = [...costumes, 'moon-suit'];

// Полученное — можно, неполученное — нельзя.
assert.equal(isWorldPlaceable('car-racer', owned, costumes), true, 'купленная машина ставится');
assert.equal(isWorldPlaceable('cap', owned, costumes), true, 'купленный наряд ставится');
assert.equal(isWorldPlaceable('dark-lord', owned, costumes), true, 'собранный костюм ставится');
assert.equal(isWorldPlaceable('moon-suit', owned, withCrystal), true, 'купленный костюм базы ставится');
assert.equal(isWorldPlaceable('car-bugatti', owned, costumes), false, 'некупленная машина не ставится');
assert.equal(isWorldPlaceable('snow-guard', owned, costumes), false, 'несобранный костюм не ставится');
assert.equal(isWorldPlaceable('moon-suit', owned, costumes), false, 'некупленный костюм базы не ставится');
assert.equal(isWorldPlaceable('atomic-base', owned, costumes), false, 'база — не вещь для трёх мест');
assert.equal(isWorldPlaceable('нет-такой', owned, costumes), false, 'неизвестный id не ставится');

// Нажатие на неполученное — 'locked', выбор не меняется.
assert.deepEqual(toggleWorldPick([], 'car-bugatti', owned, costumes), { world: [], result: 'locked' });
assert.deepEqual(toggleWorldPick(['cap'], 'snow-guard', owned, costumes), { world: ['cap'], result: 'locked' });

// Полученное ставится и убирается; четвёртое не влезает.
assert.deepEqual(toggleWorldPick([], 'cap', owned, costumes), { world: ['cap'], result: 'added' });
assert.deepEqual(toggleWorldPick(['cap'], 'cap', owned, costumes), { world: [], result: 'removed' });
const full = toggleWorldPick(['cap', 'car-racer', 'dark-lord'], 'moon-suit', owned, withCrystal);
assert.equal(full.result, 'full');
assert.equal(full.world.length, WORLD_SLOTS);

// Сохранённый выбор чистится: неполученное не показывается и не занимает место.
// (вещь сдали обратно, костюм не собран, id из чужого файла)
assert.deepEqual(normalizeWorld(['car-bugatti', 'cap', 'snow-guard', 'x'], owned, costumes), ['cap']);
assert.deepEqual(toggleWorldPick(['car-bugatti'], 'cap', owned, costumes), { world: ['cap'], result: 'added' },
  'устаревшее неполученное не занимает слот при добавлении');

// БУК в «Моём мире» стоит на подиуме, а не летает: у .mascot внутри слотов
// мира сняты fixed-позиция, z-index и анимация float (как в .shop-icon).
const css = readFileSync('src/styles/app.css', 'utf8'); // путь от корня репозитория, как в tests/icons.test.tsx
const worldMascot = css.match(/\.world-slot-art \.mascot, \.world-pick-art \.mascot \{([^}]*)\}/);
assert.ok(worldMascot, 'правило БУКа для «Моего мира» на месте');
assert.match(worldMascot[1], /position:\s*static/, 'БУК в мире не fixed');
assert.match(worldMascot[1], /animation:\s*none/, 'БУК в мире не летает (float выключен)');
assert.match(worldMascot[1], /z-index:\s*auto/, 'БУК в мире не поверх интерфейса');

console.log('✓ «Мой мир»: ставится только полученное, БУК стоит, а не летает');
