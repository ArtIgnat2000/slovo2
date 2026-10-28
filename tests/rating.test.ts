// Рейтинг с воображаемыми соперниками (0.73.0): детерминированность по дню,
// монотонный рост соперников, место игрока и расстояние до следующего.
import assert from 'node:assert/strict';
import { RIVALS, buildRating, ratingDay, rivalGain, rivalXp } from '../src/engine/rating';

const now = Date.UTC(2026, 9, 27, 12, 0, 0);
const day = ratingDay(now);
assert.ok(day > 200, 'эпоха рейтинга уже идёт');
assert.equal(ratingDay(now + 60_000), day, 'внутри дня номер не меняется');

// Соперники: прирост rate..rate+2, XP никогда не убывает.
for (const rival of RIVALS) {
  for (let d = 0; d < 30; d++) {
    const gain = rivalGain(rival, d);
    assert.ok(gain >= rival.rate && gain <= rival.rate + 2, `${rival.id}: прирост ${gain} вне rate..rate+2`);
  }
  assert.ok(rivalXp(rival, day + 1) > rivalXp(rival, day), `${rival.id}: XP обязан расти`);
  assert.equal(rivalXp(rival, day), rivalXp(rival, day), `${rival.id}: расчёт детерминирован`);
}

// Таблица: сортировка по убыванию, игрок встречается ровно один раз.
const table = buildRating({ name: 'Тест', emoji: '🧒', xp: 500 }, now, 20);
assert.equal(table.entries.length, RIVALS.length + 1, 'в таблице все соперники и игрок');
assert.equal(table.entries.filter((e) => e.isPlayer).length, 1, 'игрок один');
for (let i = 1; i < table.entries.length; i++) {
  assert.ok(table.entries[i - 1].xp >= table.entries[i].xp, 'таблица отсортирована по XP');
}
assert.equal(table.entries[table.playerRank - 1].isPlayer, true, 'playerRank указывает на игрока');
if (table.playerRank > 1) {
  assert.ok((table.toNext ?? 0) > 0, 'до следующего соперника положительное расстояние');
} else {
  assert.equal(table.toNext, null, 'у лидера toNext пуст');
}

// Сильный игрок — первый; новичок — не выше всех «старичков» сразу.
const champ = buildRating({ name: 'Чемпион', emoji: '🏆', xp: 1_000_000 }, now);
assert.equal(champ.playerRank, 1, 'огромный XP даёт первое место');
assert.equal(champ.toNext, null);
const rookie = buildRating({ name: 'Новичок', emoji: '🌱', xp: 0 }, now);
assert.ok(rookie.playerRank > 1, 'новичок стартует не первым');
assert.equal(rookie.entries[rookie.playerRank - 1].xp, 0, 'новичок честно показывает свой XP');

// Одинаковый расчёт в один день — одинаковая таблица (без сети и случайности).
const again = buildRating({ name: 'Тест', emoji: '🧒', xp: 500 }, now, 20);
assert.deepEqual(
  again.entries.map((e) => [e.id, e.xp]),
  table.entries.map((e) => [e.id, e.xp]),
  'таблица одинакова при повторном расчёте в тот же день',
);
console.log('✓ рейтинг: соперники растут детерминированно, место и отрывы считаются честно');
