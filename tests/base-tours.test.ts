// Экскурсии внутри баз (0.76.0): данные и файлы картинок.
//
// Проверяем две вещи, которые легко разъедутся при правках:
//   1. у КАЖДОЙ базы есть экскурсия, и в каждой ровно пять комнат с фактом
//      и заданием «найди» — иначе ребёнок получит пустую табличку;
//   2. под каждую комнату есть файл `public/base-tours/<baseId>-<n>.webp`:
//      битая ссылка в интерьерах не падает с ошибкой, а молча показывает
//      «комната ещё строится», и заметить пропажу можно было бы только руками.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BASE_TOURS, BASE_TOUR_BY_ID, baseTourFrames, baseTourStops } from '../src/engine/base-tours';
import { BUILDINGS } from '../src/engine/buildings';

// Скрипты проверок собирают тест в /tmp, поэтому корень берём у процесса
// (как tests/naash.test.ts), а не у import.meta.url бандла.
const root = process.cwd();

assert.equal(BASE_TOURS.length, BASE_TOUR_BY_ID && Object.keys(BASE_TOUR_BY_ID).length, 'индекс экскурсий собран из того же списка');
for (const building of BUILDINGS) {
  const tour = BASE_TOUR_BY_ID[building.id];
  assert.ok(tour, `${building.id}: у базы нет экскурсии`);
  assert.equal(tour!.stops.length, 5, `${building.id}: внутри базы должно быть 5 комнат (просили 5–7)`);
  assert.equal(baseTourFrames(building.id), 6, `${building.id}: кольцо — фасад и пять комнат`);
  const titles = tour!.stops.map((stop) => stop.title);
  assert.equal(new Set(titles).size, titles.length, `${building.id}: названия комнат повторяются`);
  const ids = tour!.stops.map((stop) => stop.id);
  assert.equal(new Set(ids).size, ids.length, `${building.id}: id комнат повторяются`);
  for (const stop of tour!.stops) {
    assert.ok(stop.title.length >= 4, `${building.id}/${stop.id}: слишком короткое название`);
    assert.ok(stop.emoji.length > 0, `${building.id}/${stop.id}: нет эмодзи`);
    // Факт — одна-две фразы, без канцелярита и без «умных» слов вроде «функция».
    assert.ok(stop.fact.length >= 40 && stop.fact.length <= 220, `${building.id}/${stop.id}: факт не для ребёнка (${stop.fact.length} симв.)`);
    assert.match(stop.fact, /[.!?]$/, `${building.id}/${stop.id}: факт должен заканчиваться точкой`);
    assert.match(stop.find, /^Найди /, `${building.id}/${stop.id}: задание-поиск начинается с «Найди»`);
    assert.ok(!/функци|параметр|утилит|осуществл/i.test(`${stop.fact} ${stop.find}`), `${building.id}/${stop.id}: канцелярит`);
  }
}

// Комнаты «паровозной» базы (0.76.0) — про пар, шестерёнки и дирижабли.
const steam = baseTourStops('steam-base');
assert.equal(steam.length, 5, 'у базы паровозов пять комнат');
assert.ok(steam.some((stop) => /котёл|котле/i.test(stop.fact)), 'в экскурсии есть паровой котёл');
assert.ok(steam.some((stop) => /шестерёнк/i.test(stop.fact)), 'в экскурсии есть шестерёнки');
assert.ok(steam.some((stop) => /дирижабл/i.test(stop.fact)), 'в экскурсии есть дирижабль');

// Незнакомая база не ломает компонент: пустой список и одно кольцо-фасад.
assert.deepEqual(baseTourStops('нет-такой-базы'), []);
assert.equal(baseTourFrames('нет-такой-базы'), 1);

// Файлы интерьеров: 5 на базу, номер с единицы, ровно как в данных.
let checked = 0;
for (const tour of BASE_TOURS) {
  for (let index = 0; index < tour.stops.length; index++) {
    const file = path.join(root, 'public/base-tours', `${tour.baseId}-${index + 1}.webp`);
    assert.ok(existsSync(file), `нет файла интерьера: public/base-tours/${tour.baseId}-${index + 1}.webp`);
    checked++;
  }
}
assert.equal(checked, BASE_TOURS.length * 5, 'проверены все интерьеры');

console.log(`✓ экскурсии по базам: ${BASE_TOURS.length} баз, ${checked} интерьеров с файлами`);
