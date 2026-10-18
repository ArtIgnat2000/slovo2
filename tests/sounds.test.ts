// Раздел магазина «Звуки»: каталог мелодий ответа, правила покупки и
// нормализация сохранения. Чистые правила — без DOM и без Web Audio.
import assert from 'node:assert/strict';
import {
  DEFAULT_SOUND_PACK,
  MAX_CUE_SECONDS,
  MAX_SOUND_PRICE,
  SOUND_PACKS,
  SOUND_PACK_BY_ID,
  STARTER_SOUND_IDS,
  canBuySoundPack,
  cueOf,
  cueSeconds,
  normalizeSoundShop,
} from '../src/engine/sounds';

// ── Каталог ─────────────────────────────────────────────────────────────────
assert.ok(SOUND_PACKS.length >= 4, 'в разделе «Звуки» есть из чего выбрать');
assert.equal(new Set(SOUND_PACKS.map((p) => p.id)).size, SOUND_PACKS.length, 'id наборов уникальны');
assert.equal(SOUND_PACKS[0].id, DEFAULT_SOUND_PACK, 'классика — первая на витрине');
assert.equal(SOUND_PACK_BY_ID[DEFAULT_SOUND_PACK].price, 0, 'классика бесплатна');
assert.deepEqual(STARTER_SOUND_IDS, SOUND_PACKS.filter((p) => p.price === 0).map((p) => p.id), 'стартовые — бесплатные');
assert.ok(STARTER_SOUND_IDS.length >= 2, 'выбор есть с первого дня');
assert.ok(SOUND_PACKS.some((p) => p.price > 0), 'часть наборов открывается за кристаллы');
assert.ok(SOUND_PACKS.every((p) => p.price >= 0 && p.price <= MAX_SOUND_PRICE), 'цены в пределах потолка');
assert.ok(SOUND_PACKS.every((p) => p.title && p.emoji && p.desc && p.about.length > 20), 'у набора есть название, обложка и пояснение');

// ── Мелодии: короткие, тихие, ошибка мягче успеха ───────────────────────────
const peak = (notes: { vol: number }[]) => Math.max(...notes.map((n) => n.vol));
for (const pack of SOUND_PACKS) {
  for (const cue of ['correct', 'wrong'] as const) {
    const notes = pack[cue];
    assert.ok(notes.length > 0, `${pack.id}/${cue}: мелодия не пустая`);
    assert.ok(cueSeconds(notes) <= MAX_CUE_SECONDS, `${pack.id}/${cue}: не длиннее ${MAX_CUE_SECONDS} с`);
    for (const note of notes) {
      assert.ok(note.freq >= 80 && note.freq <= 5000, `${pack.id}/${cue}: частота в слышимом и не резком диапазоне`);
      assert.ok(note.at >= 0 && note.dur > 0, `${pack.id}/${cue}: время ноты корректно`);
      assert.ok(note.vol > 0 && note.vol <= 0.2, `${pack.id}/${cue}: громкость эффекта умеренная`);
      if (note.glideTo !== undefined) assert.ok(note.glideTo > 0, `${pack.id}/${cue}: глиссандо к положительной частоте`);
    }
  }
  assert.ok(peak(pack.wrong) <= peak(pack.correct), `${pack.id}: ошибка звучит не громче правильного ответа`);
  assert.notDeepEqual(pack.correct, pack.wrong, `${pack.id}: верный ответ и ошибку не спутать`);
}
// Наборы действительно звучат по-разному
assert.equal(new Set(SOUND_PACKS.map((p) => JSON.stringify(p.correct))).size, SOUND_PACKS.length, 'мелодии успеха различаются');

// cueOf: незнакомый набор — классика (старое сохранение не немеет)
assert.deepEqual(cueOf('nope', 'correct'), SOUND_PACK_BY_ID.classic.correct);
assert.deepEqual(cueOf(null, 'wrong'), SOUND_PACK_BY_ID.classic.wrong);
assert.deepEqual(cueOf('xylophone', 'wrong'), SOUND_PACK_BY_ID.xylophone.wrong);

// ── Покупка ─────────────────────────────────────────────────────────────────
const paidPack = SOUND_PACKS.find((p) => p.price > 0)!;
assert.equal(canBuySoundPack(paidPack, paidPack.price, []), true);
assert.equal(canBuySoundPack(paidPack, paidPack.price - 1, []), false, 'не хватает кристаллов');
assert.equal(canBuySoundPack(paidPack, 999, [paidPack.id]), false, 'повторно не списывается');

// ── Нормализация сохранения ─────────────────────────────────────────────────
const fresh = { soundOwned: [...STARTER_SOUND_IDS], soundPack: DEFAULT_SOUND_PACK };
assert.deepEqual(normalizeSoundShop(undefined), fresh, 'профиль до 0.17.0 — стартовые наборы и классика');
assert.deepEqual(normalizeSoundShop({}), fresh);
assert.deepEqual(
  normalizeSoundShop({ soundOwned: [paidPack.id, 'ghost', 42, paidPack.id], soundPack: paidPack.id }),
  { soundOwned: [...STARTER_SOUND_IDS, paidPack.id], soundPack: paidPack.id },
  'чужие id и дубли отброшены, купленный набор выбран',
);
assert.equal(normalizeSoundShop({ soundOwned: [], soundPack: paidPack.id }).soundPack, DEFAULT_SOUND_PACK, 'неоткрытый набор не выбирается');
assert.equal(normalizeSoundShop({ soundPack: 'xylophone' }).soundPack, 'xylophone', 'стартовый набор выбирается без покупки');

console.log('✓ звуки: каталог мелодий ответа, ошибка мягче успеха, покупка и нормализация сохранения');
