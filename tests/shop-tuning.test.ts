// Тюнинг цвета купленных вещей (engine/tints.ts): правила денег, палитры и
// санитизация профиля. Чистая логика без React — идёт в adaptive-контур,
// интерфейс магазина проверяет смоук (блок «Магазин БУКа»).
import assert from 'node:assert/strict';
import {
  ITEM_BY_ID,
  OUTFIT_ITEMS,
  SELL_RATE,
  SHOP_ITEMS,
  TOY_ITEMS,
  TOY_SHELVES,
  sellPrice,
  showsOnBuk,
  toysByShelf,
} from '../src/engine/shop';
import { COSTUMES } from '../src/engine/puzzles';
import {
  BASE_TINT,
  COSTUME_PALETTES,
  TINT_PALETTES,
  TINT_PRICE,
  accessoryColors,
  carPencilTint,
  costumeAccent,
  currentTint,
  normalizeTuning,
  recolor,
  tintById,
  tintChoices,
  tintOptions,
  tintSwatchColors,
  unlockedTints,
} from '../src/engine/tints';
import type { ShopState } from '../src/types';

// ── Палитры ────────────────────────────────────────────────────────────────
// База обязана остаться ровно той, что нарисована в магазине до тюнинга:
// список ниже — это исторические цвета ui/MascotLook.tsx, менять их без причины
// нельзя (иначе у всех детей разом «перекрасится» наряд).
const EXPECTED_BASE: Record<string, [string, string, string]> = {
  cap: ['#3b82f6', '#2b6be0', '#ffd166'],
  grad: ['#241f36', '#3a3352', '#f4a51a'],
  glasses: ['#241f36', '#241f36', '#78b4ff'],
  bow: ['#ff6fb5', '#ff4fa0', '#ffd166'],
  scarf: ['#f43f5e', '#e03556', '#ffd166'],
  medal: ['#3b82f6', '#f4a51a', '#e8901a'],
};

// Техника: авто, телефоны и корабли. База та же, что на витрине; цвета обязаны
// совпадать с рисунком (ui/ToyArt.tsx, ui/CarArt.tsx), иначе у ребёнка
// «перекрасится» только что купленная вещь.
const EXPECTED_TOY_BASE: Record<string, [string, string, string]> = {
  'phone-smart': ['#3b82f6', '#0f2a66', '#a7f3d0'],
  'phone-flip': ['#ff6fb5', '#7a2048', '#ffe066'],
  'phone-retro': ['#e63946', '#7f1d1d', '#ffe8c2'],
  'car-racer': ['#ef4444', '#1f2937', '#ffd166'],
  'car-jeep': ['#4d7c0f', '#1c2a0a', '#d9b382'],
  'car-taxi': ['#f5c542', '#1f2937', '#111827'],
  // 0.20.0: легендарные марки — база ровно та, что нарисована в ui/CarArt.tsx
  'car-mercedes': ['#cbd5e1', '#111827', '#e2e8f0'],
  'car-bmw': ['#1d4ed8', '#0b1220', '#e2e8f0'],
  'car-brabus': ['#151a23', '#0a0d13', '#e11d48'],
  'car-maybach': ['#111827', '#0b1220', '#c9a227'],
  'car-rolls': ['#0f3d33', '#08120f', '#d4af37'],
  'car-lambo': ['#3fae2a', '#111827', '#e2e8f0'],
  'car-bugatti': ['#2563eb', '#0a1226', '#cbd5e1'],
  'ship-paper': ['#f8fafc', '#172033', '#c5a45b'],
  'ship-sail': ['#183b63', '#202b3b', '#ef673c'],
  'ship-steam': ['#164b4c', '#203b3b', '#c6813d'],
  'ship-carrier': ['#59616a', '#252b34', '#e5b849'],
};

assert.equal(OUTFIT_ITEMS.length, Object.keys(EXPECTED_BASE).length, 'список нарядов и ожидаемых палитр разошёлся');
assert.equal(TOY_ITEMS.length, Object.keys(EXPECTED_TOY_BASE).length, 'список игрушек и ожидаемых палитр разошёлся');
assert.equal(SHOP_ITEMS.length, OUTFIT_ITEMS.length + TOY_ITEMS.length, 'каталог потерял вещь при разделении на полки');
assert.equal(new Set(SHOP_ITEMS.map((item) => item.id)).size, SHOP_ITEMS.length, 'id товаров должны быть уникальны');
assert.ok(OUTFIT_ITEMS.every((item) => item.kind !== 'toy'), 'на полке нарядов не должно быть игрушек');
assert.ok(TOY_ITEMS.every((item) => item.kind === 'toy' && item.toy), 'у каждой вещи есть подполка (телефон/машина/корабль)');
// 0.22.0: техника не надевается на БУКа — она экспонируется в сцене «Ангар»
// (ui/HangarScene.tsx, docs/proposals/large-items-scene.md); наряды остаются
// на маскоте — они и рисовались по размеру совы.
assert.ok(TOY_ITEMS.every((item) => !showsOnBuk(item)), 'техника не должна рисоваться на БУКе');
assert.ok(OUTFIT_ITEMS.every((item) => showsOnBuk(item)), 'наряды должны рисоваться на БУКе');
assert.deepEqual(
  [...new Set(TOY_ITEMS.map((item) => item.toy))].sort(),
  ['car', 'phone', 'ship'],
  'техника должна быть трёх видов: авто, телефоны, корабли',
);
// Авто и корабли идут рядом и доступны как отдельные полки.
assert.deepEqual(TOY_SHELVES.map((shelf) => shelf.id), ['car', 'ship', 'phone'], 'полки техники поехали');
assert.equal(TOY_SHELVES[0].title, 'Авто', 'первая полка называется «Авто»');
assert.equal(TOY_SHELVES[1].title, 'Корабли', 'корабли идут отдельной полкой рядом с авто');
const carIds = toysByShelf('car').map((item) => item.id);
for (const id of ['car-bmw', 'car-brabus', 'car-mercedes', 'car-lambo', 'car-rolls', 'car-maybach', 'car-bugatti']) {
  assert.ok(carIds.includes(id), `в разделе авто нет ${id}`);
}
// 0.21.1: имена машин — по характеру, без точных обозначений брендов.
// id остаются техническими (по ним лежат картинки и профили), но всё, что
// видит ребёнок, не должно называть марку или модель.
assert.deepEqual(
  toysByShelf('car').map((item) => item.title),
  ['Болид', 'Скалолаз', 'Жёлтый кэб', 'Звезда', 'Стрела', 'Кубик', 'Адмирал', 'Лорд', 'Бык', 'Молния'],
  'названия машин должны отражать характер, а не бренд',
);
assert.deepEqual(
  toysByShelf('ship').map((item) => item.title),
  ['Морская яхта', 'Контейнеровоз', 'Супертанкер', 'Авианосец'],
  'корабельная полка должна содержать взрослые типы морских судов',
);
assert.ok(toysByShelf('ship').every((item) => item.id in TINT_PALETTES), 'у каждого судна есть тюнинг');
const BRAND_WORDS =
  /мерседес|майбах|брабус|роллс|ройс|ламборджини|бугати|бмв|mercedes|maybach|brabus|rolls|royce|lamborghini|bugatti|jeep|джип|ford|форд|crown victoria|phantom|chiron|aventador|wrangler|rubicon|s-класс|\bm5\b/i;
for (const item of toysByShelf('car')) {
  assert.ok(
    !BRAND_WORDS.test(`${item.title} ${item.desc}`),
    `${item.id}: в названии или описании осталось точное обозначение бренда`,
  );
}

const shopItemIds = SHOP_ITEMS.map((item) => item.id);
for (const id of shopItemIds) {
  const palette = TINT_PALETTES[id];
  assert.ok(palette, `у вещи ${id} нет палитры`);
  const options = tintOptions(id);
  assert.equal(options.length, 4, `${id}: оттенков должно быть 4 (база + 3)`);
  assert.equal(options[0].id, BASE_TINT, `${id}: базовый оттенок идёт первым`);
  assert.equal(new Set(options.map((t) => t.id)).size, 4, `${id}: id оттенков уникальны`);
  const expected = EXPECTED_BASE[id] ?? EXPECTED_TOY_BASE[id];
  assert.ok(expected, `${id}: нет ожидаемых базовых цветов`);
  assert.deepEqual(palette.base.colors, expected, `${id}: базовые цвета поехали`);
  const titles = new Set(options.map((t) => t.title));
  assert.equal(titles.size, 4, `${id}: названия оттенков уникальны`);
  for (const tint of options) {
    assert.ok(tint.title.trim().length >= 3, `${id}/${tint.id}: нужно название для ребёнка`);
    assert.equal(tint.colors.length, 3, `${id}/${tint.id}: ожидаем тройку цветов`);
    for (const color of tint.colors) assert.match(color, /^#[0-9a-f]{6}$/i, `${id}/${tint.id}: цвет ${color}`);
  }
  // Ни один платный оттенок не дублирует базовый цвет: платить за то же самое нельзя
  for (const extra of palette.extra) {
    assert.notDeepEqual(extra.colors, palette.base.colors, `${id}/${extra.id}: оттенок совпал с базой`);
  }
}

assert.equal(TINT_PRICE, 1, 'цена оттенка — решение пользователя: 1 💎');

// Оттенки можно искать по id; чужой id не находится
assert.equal(tintById('scarf', 'green')?.title, 'Зелёный');
assert.equal(tintById('scarf', 'nope'), null);

// ── Деньги: 1 💎 за новый оттенок, переключение бесплатно ───────────────────
const shop: ShopState = { owned: ['scarf'], equipped: { neck: 'scarf' } };

const opened = recolor(shop, 5, 'scarf', 'green');
assert.equal(opened.outcome, 'opened');
assert.equal(opened.spend, TINT_PRICE, 'за новый оттенок списываем ровно 1 💎');
assert.equal(opened.shop.tuning?.current?.scarf, 'green', 'выбранный оттенок сохраняется');
assert.deepEqual(unlockedTints(opened.shop.tuning, 'scarf'), ['green']);

// Повторный выбор того же оттенка (двойной тап) ничего не списывает
const same = recolor(opened.shop, 4, 'scarf', 'green');
assert.equal(same.outcome, 'nothing');
assert.equal(same.spend, 0);
assert.deepEqual(same.shop.tuning, opened.shop.tuning);

// Возврат к базовому цвету — бесплатно, и база не хранится в профиле
const backToBase = recolor(opened.shop, 4, 'scarf', BASE_TINT);
assert.equal(backToBase.outcome, 'switched');
assert.equal(backToBase.spend, 0);
assert.equal(backToBase.shop.tuning?.current?.scarf, undefined, 'база — это отсутствие записи');
assert.deepEqual(unlockedTints(backToBase.shop.tuning, 'scarf'), ['green'], 'оплаченный оттенок остаётся открытым');

// Переключение на уже открытый оттенок — бесплатно (главное решение варианта B)
const again = recolor(backToBase.shop, 4, 'scarf', 'green');
assert.equal(again.outcome, 'switched');
assert.equal(again.spend, 0);
assert.equal(again.shop.tuning?.current?.scarf, 'green');

// Второй новый оттенок стоит ещё 1 💎 и не теряет первый
const second = recolor(again.shop, 4, 'scarf', 'blue');
assert.equal(second.outcome, 'opened');
assert.equal(second.spend, 1);
assert.deepEqual(unlockedTints(second.shop.tuning, 'scarf'), ['green', 'blue']);

// Нет кристаллов — отказа без изменений
const poor = recolor(second.shop, 0, 'scarf', 'yellow');
assert.equal(poor.outcome, 'no-gems');
assert.equal(poor.spend, 0);
assert.deepEqual(poor.shop.tuning, second.shop.tuning, 'при отказе профиль не меняется');

// Не хватает ровно одного кристалла — тоже отказ (в минус не уходим)
assert.equal(recolor({ owned: ['cap'] }, 0, 'cap', 'red').outcome, 'no-gems');
assert.equal(recolor({ owned: ['cap'] }, 1, 'cap', 'red').outcome, 'opened');

// Не купленную вещь красить нельзя, чужой оттенок и чужая вещь — без изменений
assert.equal(recolor(shop, 10, 'cap', 'red').outcome, 'not-owned');
assert.equal(recolor(shop, 10, 'scarf', 'nope').outcome, 'nothing');
assert.equal(recolor(shop, 10, 'unknown-item', 'red').outcome, 'nothing');
assert.equal(recolor(undefined, 10, 'scarf', 'green').outcome, 'not-owned');

// ── Что видит интерфейс ────────────────────────────────────────────────────
const choices = tintChoices(opened.shop.tuning, 'scarf');
assert.equal(choices.length, 4);
assert.deepEqual(
  choices.map((c) => [c.tint.id, c.unlocked, c.price, c.selected]),
  [
    [BASE_TINT, true, 0, false], // база открыта всегда и бесплатна
    ['green', true, 0, true], // открыта ребёнком — переключение бесплатно
    ['blue', false, TINT_PRICE, false],
    ['yellow', false, TINT_PRICE, false],
  ],
);
assert.equal(tintChoices(shop.tuning, 'scarf')[0].price, 0, 'база бесплатна даже с нулём кристаллов');
assert.deepEqual(tintChoices(shop.tuning, 'unknown-item'), []);

// Текущий оттенок без записи в профиле — базовый
assert.equal(currentTint(undefined, 'scarf')?.id, BASE_TINT);
assert.equal(currentTint({ current: {}, unlocked: {} }, 'scarf')?.title, 'Красный');
assert.equal(currentTint(opened.shop.tuning, 'scarf')?.title, 'Зелёный');
assert.equal(currentTint(opened.shop.tuning, 'unknown-item'), null);

// ── Санитизация профиля и выгрузок ─────────────────────────────────────────
// Краски некупленных вещей и чужие id выкидываются, дубли схлопываются
const cleaned = normalizeTuning(
  {
    current: { cap: 'red', scarf: 'blue' },
    unlocked: { cap: ['red'], scarf: ['blue', 'blue', 'nope', 42] },
  },
  ['scarf'],
);
assert.deepEqual(cleaned, { current: { scarf: 'blue' }, unlocked: { scarf: ['blue'] } });

// Оплаченный оттенок не теряется, даже если запись об открытых пропала
const recovered = normalizeTuning({ current: { scarf: 'green' } }, ['scarf']);
assert.deepEqual(recovered, { current: { scarf: 'green' }, unlocked: { scarf: ['green'] } });

// База в профиле не хранится; мусор вместо полей не ломает чтение
assert.deepEqual(normalizeTuning({ current: { scarf: BASE_TINT } }, ['scarf']), { current: {}, unlocked: {} });
assert.deepEqual(normalizeTuning(null, ['scarf']), { current: {}, unlocked: {} });
assert.deepEqual(normalizeTuning({ current: 'нет', unlocked: 5 } as never, ['scarf']), { current: {}, unlocked: {} });

// Старый профиль без поля tuning читается как раньше: всё базовое
assert.deepEqual(normalizeTuning(undefined, shop.owned), { current: {}, unlocked: {} });
assert.equal(currentTint(normalizeTuning(undefined, shop.owned), 'scarf')?.id, BASE_TINT);

// ── Акценты костюмов (свечение, клинок, плащ) ───────────────────────────────
// Корпус костюма тюнинг не трогает: палитра даёт только glow (и cape, если он есть),
// а базовые значения обязаны совпадать с сегодняшней картинкой engine/puzzles.ts.
assert.equal(Object.keys(COSTUME_PALETTES).length, COSTUMES.length, 'палитра нужна каждому костюму');

for (const costume of COSTUMES) {
  const palette = COSTUME_PALETTES[costume.id];
  assert.ok(palette, `у костюма ${costume.id} нет палитры акцента`);
  const options = tintOptions(costume.id);
  assert.equal(options.length, 4, `${costume.id}: акцентов должно быть 4 (база + 3)`);
  assert.equal(options[0].id, BASE_TINT, `${costume.id}: базовый акцент первый`);
  assert.equal(new Set(options.map((t) => t.id)).size, 4, `${costume.id}: id акцентов уникальны`);
  assert.equal(palette.base.glow, costume.glow, `${costume.id}: базовое свечение поехало`);
  assert.equal(palette.base.cape, costume.cape, `${costume.id}: базовый плащ поехал`);
  assert.ok(palette.base.title.length >= 3, `${costume.id}: у базы нужно название`);
  assert.notEqual(palette.base.title, 'Как есть', `${costume.id}: свечение ${costume.glow} без названия`);
  for (const extra of palette.extra) {
    assert.match(extra.glow, /^#[0-9a-f]{6}$/i, `${costume.id}/${extra.id}: цвет свечения`);
    assert.notEqual(extra.glow.toLowerCase(), costume.glow.toLowerCase(), `${costume.id}/${extra.id}: акцент совпал с базой`);
    if (costume.cape) assert.match(extra.cape ?? '', /^#[0-9a-f]{6}$/i, `${costume.id}/${extra.id}: нужен цвет плаща`);
    else assert.equal(extra.cape, undefined, `${costume.id}/${extra.id}: плаща у костюма нет`);
  }
}

// Отрисовка: свечение и плащ берутся из выбранного акцента, корпус (trim) — нет
assert.deepEqual(costumeAccent('dark-lord', undefined), { glow: '#ff3b4d', cape: '#7a1f3c' });
const lordBlue = recolor({ owned: [], equipped: {} }, 3, 'dark-lord', 'blue', ['dark-lord']);
assert.equal(lordBlue.outcome, 'opened');
assert.equal(lordBlue.spend, 1);
const lordAccent = costumeAccent('dark-lord', lordBlue.shop.tuning);
assert.equal(lordAccent?.glow, '#3b82f6');
assert.equal(lordAccent?.cape, '#1d3f9e');
assert.deepEqual(costumeAccent('snow-guard', undefined), { glow: '#3b82f6' }, 'без плаща второго поля нет');
assert.equal(costumeAccent('нет-такого', undefined), null);
// Аксессуарный резолвер не путается с костюмами, а кружок палитры получает два тона
assert.deepEqual(accessoryColors('scarf', undefined), ['#f43f5e', '#e03556', '#ffd166']);
assert.deepEqual(accessoryColors('dark-lord', undefined), null);
assert.deepEqual(tintSwatchColors('scarf', 'green'), ['#34c77b', '#22a463']);
assert.deepEqual(tintSwatchColors('dark-lord', 'blue'), ['#3b82f6', '#1d3f9e']);
assert.deepEqual(tintSwatchColors('snow-guard', 'red'), ['#ff3b4d', '#ff3b4d'], 'без плаща кружок однотонный');

// Не собранный костюм красить нельзя: сначала пазл, потом акцент
assert.equal(recolor({ owned: [], equipped: {} }, 5, 'snow-guard', 'red').outcome, 'not-owned');
assert.equal(recolor({ owned: [], equipped: {} }, 5, 'snow-guard', 'red', []).spend, 0);
// Акцент костюма — та же экономика: 1 💎 за новый, переключение бесплатно
const lordBack = recolor(lordBlue.shop, 2, 'dark-lord', BASE_TINT, ['dark-lord']);
assert.equal(lordBack.outcome, 'switched');
assert.equal(lordBack.spend, 0);
assert.equal(costumeAccent('dark-lord', lordBack.shop.tuning)?.glow, '#ff3b4d', 'база вернулась');
const lordAgain = recolor(lordBack.shop, 2, 'dark-lord', 'blue', ['dark-lord']);
assert.equal(lordAgain.outcome, 'switched');
assert.equal(lordAgain.spend, 0);
assert.equal(costumeAccent('dark-lord', lordAgain.shop.tuning)?.glow, '#3b82f6');
assert.equal(recolor(lordAgain.shop, 0, 'dark-lord', 'violet', ['dark-lord']).outcome, 'no-gems');

// Санитизация: акценты несобранных костюмов в профиле не живут, собранные — остаются
const cleanedCostumes = normalizeTuning(
  { current: { 'dark-lord': 'blue', 'snow-guard': 'red' }, unlocked: { 'dark-lord': ['blue'], 'snow-guard': ['red'] } },
  ['dark-lord'],
);
assert.deepEqual(cleanedCostumes, { current: { 'dark-lord': 'blue' }, unlocked: { 'dark-lord': ['blue'] } });

// Один профиль может хранить и краски аксессуаров, и акценты костюмов
const mixed = normalizeTuning(
  { current: { scarf: 'green', 'dark-lord': 'violet' }, unlocked: { scarf: ['green'], 'dark-lord': ['violet'] } },
  ['scarf', 'dark-lord'],
);
assert.deepEqual(mixed.current, { scarf: 'green', 'dark-lord': 'violet' });
assert.deepEqual(
  tintChoices(mixed, 'dark-lord').map((c) => [c.tint.id, c.price]),
  [
    [BASE_TINT, 0],
    ['blue', TINT_PRICE],
    ['green', TINT_PRICE],
    ['violet', 0],
  ],
);
assert.equal(currentTint(mixed, 'dark-lord')?.title, 'Сиреневый');

// ── Машины: цветной карандашный рисунок и тюнинг (0.21.1) ──────────────────
// Рисунки машин — цветная графика конкретных моделей (public/cars/*.webp).
// Базовый оттенок — это сам рисунок, поэтому carPencilTint возвращает null:
// иначе «Звезда» по умолчанию перекрашивалась бы в один цвет и теряла
// цветные детали (хром, салон, тени).
assert.equal(carPencilTint('car-mercedes', undefined), null, 'без тюнинга — рисунок в своих цветах');
assert.equal(carPencilTint('car-mercedes', { current: {}, unlocked: {} }), null, 'нет записи — база');
assert.equal(
  carPencilTint('car-mercedes', { current: { 'car-mercedes': BASE_TINT }, unlocked: {} }),
  null,
  'явная база — тоже рисунок в своих цветах',
);
for (const id of ['car-mercedes', 'car-bmw', 'car-brabus', 'car-maybach', 'car-rolls', 'car-lambo', 'car-bugatti']) {
  const extra = TINT_PALETTES[id].extra[0];
  assert.equal(
    carPencilTint(id, { current: { [id]: extra.id }, unlocked: { [id]: [extra.id] } }),
    extra.colors[0],
    `${id}: выбранный оттенок должен стать цветом карандаша`,
  );
}
// Неизвестная вещь — красить нечего
assert.equal(carPencilTint('nope', undefined), null);

// ── Сдача купленной вещи обратно (sell-back, 0.24.0) ────────────
// Анализ и ставки — docs/proposals/trade-in.md, вариант B:
// наряды возвращают 50%, техника — 30% (гаджеты дешевеют быстрее).
assert.equal(SELL_RATE.outfit, 0.5, 'наряды возвращают половину');
assert.equal(SELL_RATE.toy, 0.3, 'техника возвращает 30%');
assert.equal(sellPrice(ITEM_BY_ID['scarf']), 15, 'Шарфик 30 → 15 💎');
assert.equal(sellPrice(ITEM_BY_ID['car-racer']), 10, 'Болид 35 → 10 💎 (floor)');
assert.equal(sellPrice(ITEM_BY_ID['ship-carrier']), 30, 'Авианосец 100 → 30 💎');
for (const item of SHOP_ITEMS) {
  const back = sellPrice(item);
  assert.ok(back > 0, `${item.id}: сдача должна возвращать хотя бы 1 💎`);
  assert.ok(back < item.price, `${item.id}: цена сдачи строго меньше цены покупки`);
  assert.equal(
    back,
    Math.floor(item.price * SELL_RATE[item.kind ?? 'outfit']),
    `${item.id}: ставка по категории`,
  );
}
// Цикл «купил → сдал» всегда теряет часть стоимости — фарм невозможен.
assert.ok(
  SHOP_ITEMS.every((item) => sellPrice(item) < item.price),
  'ни одна вещь не возвращает больше, чем стоит',
);

console.log('✓ тюнинг: палитры, 1 💎 за оттенок, бесплатное переключение, акценты костюмов и санитизация');
