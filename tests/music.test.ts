import assert from 'node:assert/strict';
import {
  audioFileOf,
  canBuyTrack,
  contextVolume,
  LESSON_VOLUME,
  MAX_TRACK_PRICE,
  migrateMusicShop,
  MUSIC_BY_ID,
  MUSIC_TRACKS,
  playbackFor,
  STARTER_TRACK_IDS,
  tracksByShelf,
} from '../src/engine/music';

// ── Каталог: 12 подтверждённых записей Kevin MacLeod ─────────────────────────
assert.equal(MUSIC_TRACKS.length, 12, 'каталог: 6 спокойных + 6 коллекционных');
assert.equal(new Set(MUSIC_TRACKS.map((t) => t.id)).size, MUSIC_TRACKS.length, 'id треков уникальны');
assert.deepEqual(MUSIC_TRACKS.filter((t) => t.price === 0).map((t) => t.id), STARTER_TRACK_IDS, 'две мелодии доступны сразу');
assert.equal(STARTER_TRACK_IDS.length, 2, 'стартовых мелодий ровно две');
assert.ok(MUSIC_TRACKS.every((t) => t.title && t.originalTitle && t.emoji), 'у каждого трека есть названия и обложка');
assert.ok(MUSIC_TRACKS.every((t) => t.artist === 'Kevin MacLeod'), 'в каталоге только записи автора');
assert.ok(MUSIC_TRACKS.every((t) => t.price >= 0 && t.price <= MAX_TRACK_PRICE), 'цена трека не выше потолка экономики (≈1 день занятий)');
assert.ok(MUSIC_TRACKS.some((t) => t.price > 0), 'коллекция открывается за кристаллы');

// ── Лицензии и происхождение: только официальный источник ────────────────────
for (const track of MUSIC_TRACKS) {
  assert.ok(
    track.sourceUrl.startsWith('https://incompetech.com/music/royalty-free/index.html?isrc='),
    `${track.id}: источник — официальная страница трека`,
  );
  assert.ok(track.isrc && track.sourceUrl.includes(track.isrc), `${track.id}: ISRC совпадает со ссылкой`);
  assert.ok(/creativecommons\.org\/licenses\//.test(track.licenseUrl), `${track.id}: ссылка на текст лицензии`);
  assert.ok(track.license.length > 0, `${track.id}: точная лицензия указана`);
  // Отметка об изменениях обязательна: null — «без изменений», иначе — что сделано
  assert.ok(track.modified === null || (typeof track.modified === 'string' && track.modified.length > 5), `${track.id}: отметка об изменениях аудио`);
  assert.ok(track.seconds > 30 && track.seconds < 900, `${track.id}: длительность указана`);
  assert.ok(track.bpm > 0, `${track.id}: темп указан`);
  assert.equal(audioFileOf(track), `audio/${track.id}.mp3`, `${track.id}: файл лежит по id`);
}

// Все 12 записей на официальном сайте показывают CC BY 4.0 — сверено постранично
// (isrc-страницы, «Attribution Code»), а не по памяти об авторе.
assert.ok(
  MUSIC_TRACKS.every((t) => t.license.includes('4.0') && t.licenseUrl.endsWith('/4.0/')),
  'все записи каталога — CC BY 4.0 по официальным страницам',
);

// ── Полки: спокойный фон и коллекция ────────────────────────────────────────
assert.equal(tracksByShelf('calm').length, 6, 'полка спокойного фона');
assert.equal(tracksByShelf('fun').length, 6, 'полка коллекции и наград');
assert.ok(tracksByShelf('calm').every((t) => t.shelf === 'calm'), 'спокойные не перемешались');
assert.ok(MUSIC_TRACKS.every((t) => (t.about ?? '').length > 20), 'у каждого трека есть пояснение для взрослых');

// Порядок каталога не поехал: миграция и витрина смотрят на индексы
assert.equal(MUSIC_TRACKS[2].id, 'easy-lemon', 'индекс 2 — второй стартовый трек');
assert.deepEqual(STARTER_TRACK_IDS.map((id) => MUSIC_BY_ID[id].price), [0, 0], 'стартовые бесплатны');

// ── Контекст «урок/награда»: в уроке музыка — фон ───────────────────────────
for (const track of MUSIC_TRACKS) {
  const lesson = playbackFor(track, 'lesson');
  const reward = playbackFor(track, 'reward');
  assert.equal(reward.volume, 1, `${track.id}: на награде громкость полная`);
  assert.ok(lesson.volume < reward.volume, `${track.id}: в уроке тише`);
  assert.ok(lesson.volume >= 0.3 && lesson.volume <= 0.7, `${track.id}: в уроке умеренная громкость`);
}
assert.equal(contextVolume('lesson'), LESSON_VOLUME, 'громкость урока — правило контекста');

// ── Покупка: однократно, хватает ли кристаллов ──────────────────────────────
assert.equal(canBuyTrack(MUSIC_TRACKS[2], 0, []), true, 'бесплатный трек доступен и без кристаллов');
const paid = MUSIC_TRACKS.find((t) => t.price > 0)!;
assert.equal(canBuyTrack(paid, paid.price, []), true);
assert.equal(canBuyTrack(paid, paid.price - 1, []), false, 'не хватает кристаллов — не купить');
assert.equal(canBuyTrack(paid, 100, [paid.id]), false, 'уже открытый трек повторно не списывается');

// ── Миграция профилей с синтезатора (до 0.14.0) ─────────────────────────────
// Новый профиль / профиль без поля: бесплатный старт и выбранная мелодия.
assert.deepEqual(migrateMusicShop(undefined), { musicOwned: [...STARTER_TRACK_IDS], musicTrack: STARTER_TRACK_IDS[0] });
assert.deepEqual(migrateMusicShop({}), { musicOwned: [...STARTER_TRACK_IDS], musicTrack: STARTER_TRACK_IDS[0] });
// Явный «Тишина» уважается.
assert.equal(migrateMusicShop({ musicOwned: [...STARTER_TRACK_IDS], musicTrack: null }).musicTrack, null, 'выбранная тишина сохраняется');
// Неизвестные id отбрасываются, покупки новых треков переживают чтение.
assert.deepEqual(
  migrateMusicShop({ musicOwned: ['easy-lemon', 'pixelland', 'pixelland', 'made-up'], musicTrack: 'pixelland' }),
  { musicOwned: ['carefree', 'easy-lemon', 'pixelland'], musicTrack: 'pixelland' },
);

// Старый каталог: каждая купленная мелодия даёт одну новую, выбор получает «преемника».
const legacy = migrateMusicShop({
  musicOwned: ['guitar-morning', 'forest-dawn', 'ukulele-sun', 'firebird'],
  musicTrack: 'firebird',
});
assert.equal(legacy.musicOwned.length, 2 + 2, 'две старые покупки → две новые + бесплатный старт');
assert.deepEqual(
  legacy.musicOwned.slice(0, 2),
  STARTER_TRACK_IDS,
  'стартовые мелодии выдаются всем',
);
const grantedTracks = MUSIC_TRACKS.filter((t) => t.price > 0).slice(0, 2).map((t) => t.id);
assert.deepEqual(legacy.musicOwned.slice(2), grantedTracks, 'старые покупки дают первые N платных треков');
assert.ok(legacy.musicTrack && legacy.musicOwned.includes(legacy.musicTrack), 'выбранный старый фон получает «преемника» из открытых');
// Прогресс ребёнка (id профиля, кристаллы и пр.) миграция не трогает — она живёт
// только в музыкальной части shop и проверяется здесь как чистая функция.
// Идемпотентность: повторный прогон ничего не добавляет и не меняет.
assert.deepEqual(migrateMusicShop(legacy), legacy, 'миграция идемпотентна');
// Старый выбор «Тишина» (null) не перетирается миграцией.
assert.equal(migrateMusicShop({ musicOwned: ['guitar-morning', 'forest-dawn'], musicTrack: null }).musicTrack, null);
// Выбранный бесплатный старый трек находит стартового «преемника».
assert.equal(
  migrateMusicShop({ musicOwned: ['guitar-morning', 'forest-dawn'], musicTrack: 'forest-dawn' }).musicTrack,
  STARTER_TRACK_IDS[1],
  'guitar-morning/forest-dawn → стартовые мелодии по позиции',
);

console.log('✓ музыка: каталог 12 записей CC BY 4.0, полки, контекст «урок/награда», покупки и миграция старых профилей');
