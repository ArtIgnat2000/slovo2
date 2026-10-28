// ── Школа НААШ в магазине БУКа (0.74.0, docs/proposals/naash-shop.md) ───────
//
// Раздел — школьный уголок витрины: четыре вещи формы (линейка `series: 'naash'`
// в общем каталоге) и «полка идей» — двенадцать картинок серии мерча.
//
// Правила, которые нельзя нарушить молча:
//  • форма покупается за кристаллы и работает как все наряды (слот, палитра,
//    сдача, выгрузка) — никаких вторых правил ради «особенной» полки;
//  • в текстах нет ни одной цены в рублях, «заказать» и «предзаказ»:
//    настоящий мерч школа не продаёт;
//  • каждая картинка полки существует файлом в public/naash (иначе на телефоне
//    ребёнок увидит пустую рамку).

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  CATALOG_OUTFITS,
  ITEM_BY_ID,
  OUTFIT_ITEMS,
  SHOP_ITEMS,
  SERIES_ITEMS,
  closestItem,
  isToy,
  rarityOf,
} from '../src/engine/shop';
import { TINT_PALETTES, BASE_TINT, tintOptions } from '../src/engine/tints';
import { SCHOOL, SCHOOL_IDEAS } from '../src/engine/naash';

// Тест гоняется и из собранного бандла (scripts/adaptive-test.mjs кладёт его в
// /tmp), поэтому корень репозитория берём из рабочей папки, а не из import.meta.url.
const root = process.cwd();

// ── Тексты раздела ──────────────────────────────────────────────────────────
assert.equal(typeof SCHOOL.on, 'boolean', 'флаг школы — булев: им раздел включается и выключается');
assert.ok(SCHOOL.title.trim() && SCHOOL.lead.trim() && SCHOOL.honest.trim(), 'у раздела есть название и две честные подписи');
assert.ok(/идеи/.test(SCHOOL.honest) && /не товар/.test(SCHOOL.honest), 'подпись полки говорит, что это идеи, а не товар');

const MONEY = /₽|руб\.?|рублей|цена|стоимость|заказать|заказ|предзаказ|тираж|скидка|акция/i;
const allText = [SCHOOL.title, SCHOOL.lead, SCHOOL.formTitle, SCHOOL.formLead, SCHOOL.ideasTitle, SCHOOL.ideasLead, SCHOOL.honest].join(' ');
assert.ok(!MONEY.test(allText), `в текстах раздела не должно быть денег и продаж: ${allText}`);

// ── Форма БУКа: четыре вещи линейки ─────────────────────────────────────────
const form = SERIES_ITEMS('naash');
assert.equal(form.length, 4, 'в форме школы четыре вещи');
assert.deepEqual(
  form.map((item) => item.id),
  ['school-pin', 'school-cap', 'school-scarf', 'school-hoodie'],
  'состав формы: значок, кепка, шарф, худи',
);
assert.equal(new Set(form.map((item) => item.id)).size, 4, 'id вещей формы уникальны');
assert.ok(form.every((item) => !isToy(item) && item.kind === 'outfit'), 'форма — наряды, а не техника');
assert.deepEqual(
  form.map((item) => item.slot).sort(),
  ['badge', 'body', 'head', 'neck'],
  'форма закрывает четыре разных слота — её видно целиком',
);
for (const item of form) {
  assert.ok(item.price >= 15 && item.price <= 110, `${item.id}: цена в общей лестнице 15–110 💎`);
  assert.ok(item.title.trim() && item.desc.trim(), `${item.id}: у вещи есть название и подпись ребёнку`);
  assert.ok(!MONEY.test(`${item.title} ${item.desc}`), `${item.id}: в подписи нет цен и продаж`);
  const palette = TINT_PALETTES[item.id];
  assert.ok(palette, `${item.id}: у вещи есть палитра — без неё не рисуется знак и ломается магазин`);
  assert.equal(palette.base.id, BASE_TINT, `${item.id}: базовый оттенок — тот, что нарисован`);
  assert.equal(tintOptions(item.id).length, 4, `${item.id}: база и три школьных оттенка`);
  // Форма — начало лестницы: значок и кепка «обычные», шарф и худи «крутые»,
  // но легендарных и ТОПОВЫХ среди школьных вещей быть не должно.
  assert.ok(['common', 'cool'].includes(rarityOf(item)), `${item.id}: редкость ${rarityOf(item)} — без легендарных`);
}
// Полка «Наряды» не дублирует школьный уголок, но покупки и выгрузка видят всё.
assert.ok(CATALOG_OUTFITS.every((item) => item.series !== 'naash'), 'на полке «Наряды» нет вещей школы');
assert.equal(OUTFIT_ITEMS.length, CATALOG_OUTFITS.length + form.length, 'каталог нарядов = обычные + школьные');
assert.ok(OUTFIT_ITEMS.some((item) => item.id === 'school-cap'), 'форма остаётся в общем каталоге нарядов');
assert.equal(SHOP_ITEMS.length, ITEM_BY_ID ? Object.keys(ITEM_BY_ID).length : SHOP_ITEMS.length, 'каталог не потерял вещь');
// «Ближайшая цель» ведёт по общей лестнице и не уводит на чужую витрину.
const cheapest = closestItem([], 'outfit');
assert.ok(cheapest && !cheapest.series, 'герой витрины не выбирает вещь линейки');

// ── Полка идей: двенадцать картинок, все файлы на месте ─────────────────────
assert.equal(SCHOOL_IDEAS.length, 12, 'на полке идей двенадцать картинок');
assert.equal(new Set(SCHOOL_IDEAS.map((idea) => idea.file)).size, 12, 'файлы картинок не повторяются');
for (const idea of SCHOOL_IDEAS) {
  assert.ok(idea.name.trim() && idea.note.trim(), `${idea.file}: у картинки есть имя и строка пользы`);
  assert.ok(!MONEY.test(`${idea.name} ${idea.note}`), `${idea.file}: в подписи нет цен и продаж`);
  const file = path.join(root, 'public/naash', `${idea.file}.webp`);
  assert.ok(existsSync(file), `${idea.file}: нет файла public/naash/${idea.file}.webp — сделайте npm run naash:art`);
}
console.log('школа НААШ: четыре вещи формы и двенадцать идей — правила сходятся');
