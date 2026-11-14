/**
 * Фоны «Тропы слов» (0.113.0): у каждой остановки есть биом.
 *
 * Пять сцен не должны остаться «для галочки»: проверяем, что все 71 остановка
 * 1–5 классов получают один из пяти биомов и что каждый биом действительно
 * используется. Иначе городской фон мог бы тихо вытеснить лес или зиму.
 */
import assert from 'node:assert/strict';
import { trailStopsFor } from '../src/engine/word-trail';
import { trailBiome, trailBiomeCounts, type TrailBiome } from '../src/ui/trail-biome';

const BIOMES: TrailBiome[] = ['school', 'forest', 'home', 'winter', 'city'];
const allStops = ([1, 2, 3, 4, 5] as const).flatMap((grade) => trailStopsFor(grade));

assert.equal(allStops.length, 71, 'все 71 остановка программы');
assert.ok(allStops.every((stop) => BIOMES.includes(trailBiome(stop))), 'у каждой остановки есть биом');
const counts = trailBiomeCounts(allStops);
assert.deepEqual(
  counts,
  { school: 25, forest: 14, home: 12, winter: 2, city: 18 },
  'биомы распределены по смыслу остановок',
);
assert.equal(
  Object.values(counts).reduce((sum, n) => sum + n, 0),
  allStops.length,
  'каждая остановка посчитана ровно один раз',
);
assert.equal(trailBiome(trailStopsFor(2)[0]), 'school', '«Школа» — школьный двор');
assert.equal(trailBiome(trailStopsFor(2)[2]), 'forest', '«Птицы» — лес');
assert.equal(trailBiome(trailStopsFor(2)[10]), 'winter', '«Зима» — зимний фон');
assert.equal(trailBiome(trailStopsFor(2)[6]), 'city', '«Город» — город');
assert.equal(trailBiome({ id: 'future_stop', title: 'Будущее', emoji: '🌟', grade: 2, wordIds: [] }), 'school', 'новая остановка получает нейтральный двор');

console.log(`✓ тропа: фоны — ${BIOMES.length} биомов на ${allStops.length} остановок (${counts.school}/${counts.forest}/${counts.home}/${counts.winter}/${counts.city})`);
