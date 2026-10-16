import assert from 'node:assert/strict';
import { canBuyTrack, MUSIC_TRACKS, normalizeMusicOwned, STARTER_TRACK_IDS } from '../src/engine/music';

assert.equal(MUSIC_TRACKS.length, 14, 'каталог должен давать большой выбор');
assert.equal(new Set(MUSIC_TRACKS.map((track) => track.id)).size, MUSIC_TRACKS.length, 'id мелодий уникальны');
assert.deepEqual(MUSIC_TRACKS.filter((track) => track.price === 0).map((track) => track.id), STARTER_TRACK_IDS);
assert.ok(MUSIC_TRACKS.every((track) => track.title && track.style && track.emoji && track.bpm > 0));
assert.deepEqual(normalizeMusicOwned(undefined), STARTER_TRACK_IDS, 'старые профили получают бесплатный стартовый набор');
assert.deepEqual(normalizeMusicOwned(['pixel-party', 'pixel-party', 'made-up']), ['pixel-party']);
assert.equal(canBuyTrack(MUSIC_TRACKS[2], 8, []), true);
assert.equal(canBuyTrack(MUSIC_TRACKS[2], 7, []), false);
assert.equal(canBuyTrack(MUSIC_TRACKS[2], 100, ['neon-sneakers']), false);

console.log('✓ музыка: оригинальный каталог, бесплатный старт, цены и санитизация коллекции');
