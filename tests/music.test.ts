import assert from 'node:assert/strict';
import {
  canBuyTrack,
  LESSON_BPM_CAP,
  MAX_TRACK_PRICE,
  MUSIC_BY_ID,
  MUSIC_TRACKS,
  normalizeMusicOwned,
  playbackFor,
  STARTER_TRACK_IDS,
  TREND_TRACKS,
  tracksByShelf,
} from '../src/engine/music';
import { GROOVE_IDS } from '../src/platform/music';

assert.equal(MUSIC_TRACKS.length, 20, 'каталог: 14 базовых мелодий + 6 трендовых (0.13.0)');
assert.equal(new Set(MUSIC_TRACKS.map((track) => track.id)).size, MUSIC_TRACKS.length, 'id мелодий уникальны');
assert.deepEqual(MUSIC_TRACKS.filter((track) => track.price === 0).map((track) => track.id), STARTER_TRACK_IDS);
assert.ok(MUSIC_TRACKS.every((track) => track.title && track.style && track.emoji && track.bpm > 0));
assert.ok(MUSIC_TRACKS.every((track) => track.price <= MAX_TRACK_PRICE), 'цена трека не выше потолка экономики (≈1 день занятий)');

// Каждый грув каталога должен быть описан в синтезаторе: иначе трек молча
// сыграет запасным грувом и «тренд» превратится в обычный поп.
assert.ok(GROOVE_IDS.length >= 12, 'синтезатор знает базовые и трендовые грувы');
const unknown = MUSIC_TRACKS.filter((track) => !GROOVE_IDS.includes(track.groove)).map((track) => track.id);
assert.deepEqual(unknown, [], `нет аранжировки для грува: ${unknown.join(', ')}`);

// Полки: тренд отдельно, базовая коллекция на месте
assert.equal(tracksByShelf('trend').length, TREND_TRACKS.length, 'полка «Тренд 2026»');
assert.equal(tracksByShelf('core').length, 14, 'базовая коллекция не переехала в тренды');
assert.deepEqual(tracksByShelf('trend').map((track) => track.id), TREND_TRACKS.map((track) => track.id));
assert.ok(TREND_TRACKS.every((track) => track.shelf === 'trend' && Boolean(track.tag)), 'у трендовых треков есть плашка');
// Одна строка «для взрослых» обязательна: тренд без объяснения пугает родителя
assert.ok(TREND_TRACKS.every((track) => (track.about ?? '').length > 20), 'у каждого тренда есть пояснение для родителей');
// Порядок каталога не поехал: проверки и смоук покупают трек по индексу 2
assert.equal(MUSIC_TRACKS[2].id, 'neon-sneakers');

// Контекстная музыка: в уроке тише и медленнее, на награде — как задумано
for (const track of MUSIC_TRACKS) {
  const lesson = playbackFor(track, 'lesson');
  const reward = playbackFor(track, 'reward');
  assert.equal(reward.bpm, track.bpm, `${track.id}: на награде темп авторский`);
  assert.ok(lesson.bpm <= LESSON_BPM_CAP, `${track.id}: в уроке темп не выше ${LESSON_BPM_CAP}`);
  assert.ok(lesson.drums < reward.drums, `${track.id}: в уроке перкуссия тише`);
  assert.equal(lesson.bright, false, `${track.id}: в уроке нет хэта, хлопка и ковбелла`);
  assert.equal(reward.bright, true, `${track.id}: на награде яркие тембры на месте`);
  assert.ok(lesson.cutoff > 0 && lesson.cutoff < 5000, `${track.id}: в уроке фильтр прикрыт`);
  assert.ok(lesson.lead <= 1, `${track.id}: мелодия в уроке не громче полной`);
}
// Быстрый тренд обязан замедляться: 168 BPM во время подбора буквы — это вредно
assert.equal(playbackFor(MUSIC_BY_ID['campfire-punk'], 'lesson').bpm, LESSON_BPM_CAP);
assert.equal(playbackFor(MUSIC_BY_ID['campfire-punk'], 'reward').bpm, 168);
// Спокойный трек не ускоряется в уроке
assert.equal(playbackFor(MUSIC_BY_ID['cloud-lofi'], 'lesson').bpm, 78);

// «Шесть-семь»: крюк строится из шестой и седьмой ступени, поэтому в ладу их семь
const sixSeven = MUSIC_BY_ID['six-seven'];
assert.equal(sixSeven.scale.length, 7, 'нужны обе ступени — 6-я и 7-я');
assert.deepEqual(sixSeven.scale.slice(5), [8, 10], '6-я и 7-я ступени натурального минора');

assert.deepEqual(normalizeMusicOwned(undefined), STARTER_TRACK_IDS, 'старые профили получают бесплатный стартовый набор');
assert.deepEqual(normalizeMusicOwned(['pixel-party', 'pixel-party', 'made-up']), ['pixel-party']);
assert.deepEqual(normalizeMusicOwned(['six-seven', 'duck-dance']), ['six-seven', 'duck-dance'], 'трендовые треки переживают перезапуск');
assert.equal(canBuyTrack(MUSIC_TRACKS[2], 8, []), true);
assert.equal(canBuyTrack(MUSIC_TRACKS[2], 7, []), false);
assert.equal(canBuyTrack(MUSIC_TRACKS[2], 100, ['neon-sneakers']), false);
assert.equal(canBuyTrack(MUSIC_BY_ID['six-seven'], 14, []), true);
assert.equal(canBuyTrack(MUSIC_BY_ID['six-seven'], 13, []), false);

console.log('✓ музыка: каталог 20 треков, полки, грувы синтезатора, контекст «урок/награда», цены и санитизация коллекции');
