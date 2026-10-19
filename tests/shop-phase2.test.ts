// Магазин БУКа: фаза 2 — Герой витрины и Мечты (Wishlist 🤍)
//
// Проверяет чистую логику движка:
//  1. Выбор героя витрины (closestItem / resolveHero) по правилу «ближайшая цель»;
//     при полном гардеробе — переключение на следующий костюм или трек,
//     а не пустота (критерий 2 §15 docs/shop-concept.md).
//  2. Санитизация и нормализация списка «Мечты 🤍»: удаление дубликатов, чужих id
//     и купленных/собранных вещей (критерий 3 §15 docs/shop-concept.md).
import assert from 'node:assert/strict';
import {
  OUTFIT_ITEMS,
  TOY_ITEMS,
  closestItem,
  resolveHero,
  normalizeWishlist,
  isWished,
} from '../src/engine/shop';
import { COSTUMES, PUZZLE_SIZE } from '../src/engine/puzzles';
import { MUSIC_TRACKS } from '../src/engine/music';

// ── 1. closestItem ─────────────────────────────────────────────────────────

// Пустой гардероб — ближайшая цель одна из дешёвых (cap или bow за 20 💎)
const emptyClosest = closestItem([]);
assert.ok(emptyClosest, 'у пустого гардероба обязан быть closestItem');
assert.equal(emptyClosest?.price, 20, 'стартовая ближайшая цель за 20 💎');
assert.ok(emptyClosest?.id === 'cap' || emptyClosest?.id === 'bow');

// Когда cap и bow куплены — следующий шарфик за 30 💎
const afterTwo = closestItem(['cap', 'bow']);
assert.equal(afterTwo?.id, 'scarf');
assert.equal(afterTwo?.price, 30);

// Когда все 6 нарядов куплены — null (техника с другой полки героя не подменяет)
const allOutfitIds = OUTFIT_ITEMS.map((i) => i.id);
assert.equal(closestItem(allOutfitIds), null);
assert.equal(OUTFIT_ITEMS.length, 6, 'на полке нарядов осталось шесть вещей');

// Техника выбирается только явно: на полке «Техника» своя ближайшая покупка.
const firstToy = closestItem([], 'toy');
assert.ok(firstToy && firstToy.kind === 'toy', 'у пустой коллекции игрушек есть ближайшая');
assert.equal(firstToy?.price, 25, 'самая дешёвая вещь техники — за 25 💎');
assert.ok(firstToy?.toy === 'phone' || firstToy?.toy === 'ship');
assert.equal(closestItem(TOY_ITEMS.map((item) => item.id), 'toy'), null, 'вся техника куплена — цели нет');
// Купленные наряды не мешают игрушечной цели и наоборот
assert.ok(closestItem(allOutfitIds, 'toy'), 'техника остаётся доступной после полного гардероба');

// ── 2. resolveHero ─────────────────────────────────────────────────────────

// Базовый случай: есть некупленные наряды → герой возвращает вещь
const heroItem = resolveHero([]);
assert.ok(heroItem && heroItem.kind === 'item');
assert.equal(heroItem?.item.price, 20);

// Все наряды куплены, но костюмы ещё собираются → герой переключается на костюм
const heroCostumeActive = resolveHero(allOutfitIds, {
  pieces: { 'snow-guard': 4 },
  collecting: 'snow-guard',
  assembled: [],
  worn: null,
});
assert.ok(heroCostumeActive && heroCostumeActive.kind === 'costume');
assert.equal(heroCostumeActive?.costume.id, 'snow-guard');
assert.equal(heroCostumeActive?.progress, 4);

// Все наряды куплены, активного костюма нет → берётся первый несобранный
const heroCostumeFirst = resolveHero(allOutfitIds, {
  pieces: {},
  collecting: null,
  assembled: [],
  worn: null,
});
assert.ok(heroCostumeFirst && heroCostumeFirst.kind === 'costume');
assert.equal(heroCostumeFirst?.costume.id, COSTUMES[0].id);

// Все наряды куплены, все костюмы собраны → герой переключается на трек
const allCostumeIds = COSTUMES.map((c) => c.id);
const heroTrack = resolveHero(
  allOutfitIds,
  { pieces: {}, collecting: null, assembled: allCostumeIds, worn: null },
  ['carefree', 'easy-lemon'], // стартовые треки (0 💎)
);
assert.ok(heroTrack && heroTrack.kind === 'track');
assert.ok(heroTrack?.track.price > 0);

// Весь каталог куплен и собран (наряды, костюмы, музыка) → null («весь гардероб собран»)
const allTrackIds = MUSIC_TRACKS.map((t) => t.id);
const heroDone = resolveHero(
  allOutfitIds,
  { pieces: {}, collecting: null, assembled: allCostumeIds, worn: null },
  allTrackIds,
);
assert.equal(heroDone, null);

// ── 3. normalizeWishlist ───────────────────────────────────────────────────

// Невалидные типы входа
assert.deepEqual(normalizeWishlist(null), []);
assert.deepEqual(normalizeWishlist(undefined), []);
assert.deepEqual(normalizeWishlist('cap'), []);
assert.deepEqual(normalizeWishlist(123), []);
assert.deepEqual(normalizeWishlist({}), []);
assert.deepEqual(normalizeWishlist([null, undefined, 42, {}]), []);

// Неизвестные id отбрасываются
assert.deepEqual(
  normalizeWishlist(['cap', 'unknown_thing', 'scarf', 'hacked_skin']),
  ['cap', 'scarf'],
);

// Дубликаты убираются, исходный порядок сохраняется
assert.deepEqual(
  normalizeWishlist(['scarf', 'cap', 'scarf', 'cap', 'glasses']),
  ['scarf', 'cap', 'glasses'],
);

// Купленные наряды, собранные костюмы и купленные треки исключаются
assert.deepEqual(
  normalizeWishlist(
    ['cap', 'scarf', 'dark-lord', 'happy-alley'],
    ['cap'], // cap куплен
    ['dark-lord'], // dark-lord собран
    ['happy-alley'], // трек куплен
  ),
  ['scarf'],
);

// Можно мечтать о нарядах, костюмах, треках и технике одновременно
assert.deepEqual(
  normalizeWishlist(
    ['glasses', 'snow-guard', 'happy-alley', 'car-racer'],
    [],
    [],
    [],
  ),
  ['glasses', 'snow-guard', 'happy-alley', 'car-racer'],
);
// Купленная вещь из мечт исчезает
assert.deepEqual(
  normalizeWishlist(['car-racer', 'ship-paper'], ['car-racer'], [], []),
  ['ship-paper'],
);

// ── 4. isWished helper ─────────────────────────────────────────────────────

assert.equal(isWished(['cap', 'scarf'], 'cap'), true);
assert.equal(isWished(['cap', 'scarf'], 'bow'), false);
assert.equal(isWished([], 'cap'), false);
assert.equal(isWished(undefined, 'cap'), false);
