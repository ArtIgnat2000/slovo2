/**
 * Открытки «Тропы слов» (0.113.0, волна A2).
 *
 * Все 16 остановок 2 класса получили открытки. Для другого класса (и новой
 * остановки) функция возвращает `null`, и UI показывает прежнюю карточку:
 * волна не должна ломать альбом 1/3/4/5 классов.
 */
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { trailStopsFor } from '../src/engine/word-trail';
import { trailPostcard, trailPostcardCount } from '../src/ui/trail-postcards';

const stops = trailStopsFor(2);
const withCard = stops.filter((stop) => !!trailPostcard(stop));
const withoutCard = stops.filter((stop) => !trailPostcard(stop));

assert.equal(stops.length, 16, 'в альбоме 16 остановок 2 класса');
assert.equal(withCard.length, 16, 'нарисованы все 16 открыток');
assert.equal(trailPostcardCount(stops), 16, 'счётчик открыток сходится');
assert.equal(withoutCard.length, 0, 'у 2 класса нет остановок без открытки');
for (const stop of withCard) {
  const path = `src/assets/postcards/${stop.id}.webp`;
  assert.ok(existsSync(path), `${stop.id}: файл открытки на месте`);
  const size = statSync(path).size;
  assert.ok(size > 5_000 && size < 50_000, `${stop.id}: открытка ${size} Б, в бюджете`);
}
assert.equal(trailPostcardCount(trailStopsFor(5)), 0, 'в 5 классе пока нет нарисованных открыток');
assert.equal(
  trailPostcard({ id: 'future_stop', title: 'Будущее', emoji: '🌟', grade: 2, wordIds: [] }),
  null,
  'неизвестная остановка не получает чужую открытку',
);

console.log(`✓ тропа: открытки — ${withCard.length}/16 остановок 2 класса, фолбэк для остальных классов`);
