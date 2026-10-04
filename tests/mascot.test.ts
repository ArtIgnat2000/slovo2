// Реплики плавающего БУКа — без DOM: их легко сломать правкой текста, а из-за
// этого пузырь разрастается или подсказка начинает врать. Файл подключается из
// tests/adaptive.test.ts, поэтому выполняется и в `test:adaptive`, и в смоуке.
import assert from 'node:assert/strict';
import { POKE_PHRASES, POKE_TICKLE, SECRET_PHRASES, greetingFor, statusLine } from '../src/state/mascot';

assert.ok(POKE_PHRASES.length >= 6, 'нужен запас реплик: при трёх повторах подряд отклик надоедает');
assert.equal(new Set(POKE_PHRASES).size, POKE_PHRASES.length, 'реплики на тап не должны дублироваться');
for (const line of POKE_PHRASES) {
  assert.ok(line.trim().length > 0, 'пустая реплика');
  // Пузырь шириной 190px (см. .mascot .bubble) — длинная фраза ломает вёрстку.
  assert.ok(line.length <= 24, `реплика «${line}» длиннее 24 символов — не влезет в пузырь`);
}
assert.ok(POKE_TICKLE.length <= 24, 'реплика щекотки не влезает в пузырь');

// Приоритет подсказок: цель дня → серия → остаток до цели → освоенные слова → молчание.
assert.equal(statusLine(130, 120, 40, 7), 'Цель дня закрыта! 🎉');
assert.equal(statusLine(60, 120, 40, 4), 'Серия 4 дня — не теряй! 🔥');
assert.equal(statusLine(60, 120, 40, 5), 'Серия 5 дней — не теряй! 🔥');
assert.equal(statusLine(60, 120, 40, 21), 'Серия 21 день — не теряй! 🔥');
assert.equal(statusLine(90, 120, 40, 1), 'До цели дня ещё 30 ⚡');
assert.equal(statusLine(1, 15, 40, 0), 'До цели дня ещё 14 ⚡');
assert.equal(statusLine(0, 120, 12, 0), 'Ты уже знаешь 12 слов!');
assert.equal(statusLine(0, 120, 1, 0), 'Ты уже знаешь 1 слово!');
assert.equal(statusLine(0, 0, 5, 0), 'Ты уже знаешь 5 слов!', 'без цели дня остаётся похвала за слова');
assert.equal(statusLine(0, 120, 0, 0), null, 'новичку БУК не хвастается прогрессом — лучше промолчать');

// Секрет удержания: реплики короче пузыря и не дублируют обычные
assert.ok(SECRET_PHRASES.length >= 3, 'нужен запас секретных реплик');
assert.equal(new Set(SECRET_PHRASES).size, SECRET_PHRASES.length, 'секретные реплики не должны дублироваться');
for (const line of SECRET_PHRASES) {
  assert.ok(line.length <= 24, `секретная реплика «${line}» не влезет в пузырь`);
  assert.ok(!POKE_PHRASES.includes(line) && line !== POKE_TICKLE, `секретная реплика «${line}» повторяет обычную`);
}

// Приветствие по времени суток: без укора «поздно» — режим дня решает взрослый.
assert.equal(greetingFor(5), 'Доброе утро! ☀️');
assert.equal(greetingFor(10), 'Доброе утро! ☀️');
assert.equal(greetingFor(11), 'Привет! 👋');
assert.equal(greetingFor(17), 'Привет! 👋');
assert.equal(greetingFor(18), 'Добрый вечер! 🌆');
assert.equal(greetingFor(21), 'Добрый вечер! 🌆');
assert.equal(greetingFor(22), 'Тсс, все спят… 🤫');
assert.equal(greetingFor(3), 'Тсс, все спят… 🤫');
for (let h = 0; h < 24; h++) {
  const line = greetingFor(h);
  assert.ok(line.length > 0 && line.length <= 24, `приветствие для ${h} ч не влезает в пузырь: «${line}»`);
  assert.ok(!/спать|ложись|поздно/i.test(line.replace('все спят', '')), `укор о режиме дня: «${line}»`);
}

console.log('✓ реплики БУКа: длина, уникальность, приветствие по времени и приоритет подсказок');
