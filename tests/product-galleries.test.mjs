// Проверки фотогалерей товаров на уровне файлов.
//
// Зачем отдельный тест: `scripts/smoke.mjs` смотрит, что ракурсы листаются, но
// не смотрит на сами файлы. Из-за этого в галерею мог вернуться кадр-заглушка:
// копия главного фото, кадр, выданный за второй ракурс, или чужая машина под
// другим id. Правило каталога (docs/proposals/product-galleries.md) требует
// самостоятельный кадр, поэтому здесь проверяется:
//
//   • у каждого ракурса из `TechTour.tsx` и `CarTour.tsx` есть файл;
//   • второй кадр — не байтовая копия главного фото и не картинка другого товара;
//   • кадр достаточно крупный (1200×896 у принятой серии, ниже 1000 px по
//     ширине в галерею не берём: из мелкого кропа второй ракурс не сделать);
//   • подписи ракурсов непустые — иначе кнопка и счётчик «1 / 2» теряют смысл.
//
// Тест намеренно не трогает `images-src` и не вызывает ImageMagick: он должен
// работать в CI на голом Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fileUrl = (path) => new URL(`../${path}`, import.meta.url);
const hash = (path) => createHash('sha256').update(readFileSync(fileUrl(path))).digest('hex');

/**
 * Размер WebP без внешних зависимостей: у серии три варианта контейнера —
 * lossy `VP8 `, lossless `VP8L` и расширенный `VP8X` (у него ширина и высота
 * лежат в заголовке). Другие форматы в public не встречаются, но если
 * появится — вернём null и тест скажет об этом явно, а не упадёт молча.
 */
function webpSize(path) {
  const buf = readFileSync(fileUrl(path));
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

/** Разбор записи `ALTERNATES` из TechTour.tsx: пары «id → путь, подпись». */
function techAlternates() {
  const source = read('src/ui/TechTour.tsx');
  const block = source.slice(source.indexOf('const ALTERNATES'), source.indexOf('};', source.indexOf('const ALTERNATES')));
  const entries = new Map();
  const line = /'([a-z0-9-]+)':\s*\{\s*path:\s*'([^']+)',\s*label:\s*'([^']+)'(,\s*cutout:\s*(true|false))?\s*\}/g;
  for (const match of block.matchAll(line)) {
    entries.set(match[1], { path: match[2], label: match[3], cutout: match[5] === 'true' });
  }
  return entries;
}

/** Список моделей из `CAR_TOUR_IDS`. */
function carTourIds() {
  const source = read('src/ui/CarTour.tsx');
  const block = source.slice(source.indexOf('CAR_TOUR_IDS'), source.indexOf(']', source.indexOf('CAR_TOUR_IDS')));
  return [...block.matchAll(/'(car-[a-z0-9-]+)'/g)].map((match) => match[1]);
}

const ALTERNATES = techAlternates();
const CARS = carTourIds();
const MAIN = (id) => `public/products/${id}.webp`;

test('второй кадр техники: файл есть, он не копия главного фото и не мелкий', () => {
  assert.equal(ALTERNATES.size, 37, 'у 37 позиций должен быть второй кадр');
  const seen = new Map();
  for (const [id, alternate] of ALTERNATES) {
    const path = `public/${alternate.path}`;
    assert.ok(existsSync(fileUrl(path)), `${id}: нет файла ${path}`);
    assert.ok(alternate.label.trim().length > 2, `${id}: пустая подпись ракурса`);
    if (!alternate.cutout) {
      assert.notEqual(alternate.path, `products/${id}.webp`, `${id}: второй кадр — та же ссылка, что главное фото`);
      assert.notEqual(hash(path), hash(MAIN(id)), `${id}: второй кадр — байтовая копия главного фото`);
    }
    const size = webpSize(path);
    assert.ok(size, `${id}: ${path} не читается как WebP`);
    // Кадры серии — 1200×896. Три корабля показывают готовые фотореалистичные
    // рендеры 720×480 (см. заметку про мягкость в docs/proposals/product-galleries.md):
    // для них держим отдельный, более низкий порог, чтобы тест не врал о факте.
    const minWidth = alternate.cutout ? 700 : 1000;
    const minHeight = alternate.cutout ? 450 : 700;
    assert.ok(size.width >= minWidth && size.height >= minHeight, `${id}: кадр ${size.width}×${size.height} меньше ${minWidth}×${minHeight}`);
    // Один и тот же файл не должен изображать два разных товара.
    const digest = hash(path);
    assert.ok(!seen.has(digest), `${id}: кадр совпадает с ${seen.get(digest)} — это чужой ракурс`);
    seen.set(digest, id);
  }
});

test('второй кадр техники: у каждого ракурса своя подпись своего товара', () => {
  // Подпись «Вид спереди» законна только для телефонов: у яхты спереди вида нет.
  for (const [id, alternate] of ALTERNATES) {
    if (id.startsWith('phone-')) continue;
    assert.notEqual(alternate.label, 'Вид спереди', `${id}: телефонная подпись у техники`);
  }
});

test('автомобили: салон и панель — отдельные крупные кадры, а не один и тот же', () => {
  assert.equal(CARS.length, 19, 'в экскурсию должны входить 19 автомобилей');
  assert.equal(new Set(CARS).size, CARS.length, 'id автомобилей не должны повторяться');
  const seen = new Map();
  for (const id of CARS) {
    assert.ok(existsSync(fileUrl(MAIN(id))), `${id}: нет главного фото ${MAIN(id)}`);
    const digests = [];
    for (const shot of ['interior', 'dashboard']) {
      const path = `public/cars/${id}-${shot}.webp`;
      assert.ok(existsSync(fileUrl(path)), `${id}: нет файла ${path}`);
      const size = webpSize(path);
      assert.ok(size, `${id}: ${path} не читается как WebP`);
      // Кадры салона в серии — 1000×667, 1264×843 и 1000×545 (розовый танк):
      // проверяем крупность, но не навязываем один формат.
      assert.ok(size.width >= 1000 && size.height >= 500, `${id}: ${shot} ${size.width}×${size.height} меньше 1000×500`);
      const digest = hash(path);
      assert.ok(!seen.has(digest), `${id}: ${shot} совпадает с кадром ${seen.get(digest)} — чужой салон`);
      seen.set(digest, `${id}/${shot}`);
      digests.push(digest);
    }
    assert.notEqual(digests[0], digests[1], `${id}: салон и панель — один и тот же файл`);
    assert.ok(!digests.includes(hash(MAIN(id))), `${id}: салон или панель — копия главного фото`);
  }
});

test('главные фото: список витрины совпадает с файлами и не содержит дублей', () => {
  const source = read('src/ui/ProductPhoto.tsx');
  const block = source.slice(source.indexOf('PRODUCT_PHOTOS'), source.indexOf('];', source.indexOf('PRODUCT_PHOTOS')));
  const ids = [...block.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'id в PRODUCT_PHOTOS повторяются');
  const seen = new Map();
  for (const id of ids) {
    assert.ok(existsSync(fileUrl(MAIN(id))), `${id}: нет файла ${MAIN(id)}`);
    const digest = hash(MAIN(id));
    assert.ok(!seen.has(digest), `${id}: то же фото, что у ${seen.get(digest)}`);
    seen.set(digest, id);
  }
});

test('состав набора: у каждой части есть картинка, и она подключена к листу', () => {
  // 0.89.8: набор продавался «вслепую» — в листе были только названия. Теперь
  // у базы, машины и самолёта стоят их собственные снимки, у костюма — БУК в
  // костюме. Тест ловит случай, когда часть набора осталась без файла: плитка
  // тогда молча покажет пустое место.
  const setsSource = read('src/engine/base-sets.ts');
  const sets = [...setsSource.matchAll(/id: '([a-z-]+)', baseId: '([a-z-]+)', carId: '([a-z-]+)', planeId: '([a-z-]+)', costumeId: '([a-z-]+)'/g)];
  assert.equal(sets.length, 5, 'наборов должно быть пять');
  const photos = new Set([...read('src/ui/ProductPhoto.tsx').matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]));
  for (const [, id, base, car, plane] of sets) {
    for (const part of [base, car, plane]) {
      assert.ok(photos.has(part), `${id}: у части ${part} нет фото — плитка состава останется пустой`);
      assert.ok(existsSync(fileUrl(`public/products/${part}.webp`)), `${id}: нет файла public/products/${part}.webp`);
    }
  }
  const shopSource = read('src/ui/screens/ShopScreen.tsx');
  assert.ok(shopSource.includes('<SetComposition'), 'лист набора не показывает состав картинками');
  assert.ok(existsSync(fileUrl('src/ui/SetComposition.tsx')), 'нет компонента состава набора');
});

test('иллюстрация мелодии: у каждого трека свой предмет по названию', () => {
  // 0.89.9: первая версия третьей стороны рисовала всем трекам один пейзаж —
  // «Лимончик» без лимона и «Утёнок» без утёнка. Теперь у каждой мелодии свой
  // мотив, и тест не даёт появиться треку без картинки.
  const covers = read('src/ui/DigitalCover.tsx');
  const block = covers.slice(covers.indexOf('export const MUSIC_MOTIFS'), covers.indexOf('};', covers.indexOf('export const MUSIC_MOTIFS')));
  const motifs = new Map([...block.matchAll(/'?([a-z0-9-]+)'?:\s*'([a-z]+)'/g)].map((match) => [match[1], match[2]]));
  const music = read('src/engine/music.ts');
  const tracks = [...music.matchAll(/id: '([a-z0-9-]+)', title:/g)].map((match) => match[1]);
  assert.equal(tracks.length, 12, `в каталоге ${tracks.length} треков`);
  for (const id of tracks) {
    assert.ok(motifs.has(id), `${id}: у трека нет своего предмета на иллюстрации`);
  }
  assert.equal(new Set(motifs.values()).size, motifs.size, 'два трека делят один мотив — названия разные');
  // Мотив рисуется в сцене, а не объявлен «в воздухе».
  assert.ok(covers.includes('data-motif={motif}'), 'мотив не выводится в сцене');
  assert.ok(covers.includes('<TrackMotif'), 'сцена не рисует предмет мелодии');
});

test('состав набора рисует костюм в плитке, а не плавающего БУКа', () => {
  // БУК по умолчанию плавающий (`position: fixed`) и улетал в угол экрана —
  // плитка костюма выглядела пустой. Проверяем сброс позиции в CSS.
  const css = read('src/styles/app.css');
  const rule = css.slice(css.indexOf('.set-part-art .mascot'), css.indexOf('.set-part-art .mascot') + 260);
  assert.ok(rule.includes('position: static'), 'в плитке набора БУК остаётся плавающим');
  assert.ok(!/position: fixed/.test(rule), 'в плитке набора БУК остаётся плавающим');
});
