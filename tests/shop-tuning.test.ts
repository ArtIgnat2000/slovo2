// Тюнинг цвета купленных вещей (engine/tints.ts): правила денег, палитры и
// санитизация профиля. Чистая логика без React — идёт в adaptive-контур,
// интерфейс магазина проверяет смоук (блок «Магазин БУКа»).
import assert from 'node:assert/strict';
import { SHOP_ITEMS } from '../src/engine/shop';
import { COSTUMES } from '../src/engine/puzzles';
import {
  BASE_TINT,
  COSTUME_PALETTES,
  TINT_PALETTES,
  TINT_PRICE,
  accessoryColors,
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

const shopItemIds = SHOP_ITEMS.map((item) => item.id);
assert.equal(shopItemIds.length, Object.keys(EXPECTED_BASE).length, 'список вещей и ожидаемых палитр разошёлся');

for (const id of shopItemIds) {
  const palette = TINT_PALETTES[id];
  assert.ok(palette, `у вещи ${id} нет палитры`);
  const options = tintOptions(id);
  assert.equal(options.length, 4, `${id}: оттенков должно быть 4 (база + 3)`);
  assert.equal(options[0].id, BASE_TINT, `${id}: базовый оттенок идёт первым`);
  assert.equal(new Set(options.map((t) => t.id)).size, 4, `${id}: id оттенков уникальны`);
  assert.deepEqual(palette.base.colors, EXPECTED_BASE[id], `${id}: базовые цвета поехали`);
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

console.log('✓ тюнинг: палитры, 1 💎 за оттенок, бесплатное переключение, акценты костюмов и санитизация');
