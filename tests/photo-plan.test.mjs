// Контракт фотосерий: брифы из docs/proposals/photo-series-plan.md и правило
// «пара или ничего».
//
// Зачем: наряды (38 позиций) и вторые ракурсы 24 товаров появятся только
// после разблокировки генератора. Чтобы серия не собралась наполовину и чтобы
// фото не подмешались к векторному арту, документ-маршрут связан с каталогом и
// с файлами тестом:
//
//   • таблица нарядов в документе совпадает с полкой «Наряды» в shop.ts;
//   • таблица товаров совпадает с реально одно-кадровыми товарами;
//   • у каждой позиции есть свой бриф второго кадра, и это не «кроп»;
//   • если у наряда появился главный кадр, обязан появиться и второй;
//   • второй кадр не может быть копией главного;
//   • ни один файл в products/gallery не лежит без ссылки из галереи или плана.
//
// Документ — источник истины для людей, тест не даёт ему разойтись с кодом.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const doc = readFileSync(new URL('../docs/proposals/photo-series-plan.md', import.meta.url), 'utf8');
const shop = readFileSync(new URL('../src/engine/shop.ts', import.meta.url), 'utf8');
const photoSource = readFileSync(new URL('../src/ui/ProductPhoto.tsx', import.meta.url), 'utf8');
const techTour = readFileSync(new URL('../src/ui/TechTour.tsx', import.meta.url), 'utf8');
const carTour = readFileSync(new URL('../src/ui/CarTour.tsx', import.meta.url), 'utf8');

const root = fileURLToPath(new URL('..', import.meta.url));

function section(heading) {
  const start = doc.indexOf(heading);
  assert.notEqual(start, -1, `в photo-series-plan.md нет раздела «${heading}»`);
  const rest = doc.slice(start + heading.length);
  const end = rest.indexOf('\n## ');
  return end === -1 ? rest : rest.slice(0, end);
}

/** Строки таблицы с id в обратных кавычках: id | название | второй кадр | ... */
function tableRows(text) {
  return text
    .split('\n')
    .filter((line) => /^\|\s*`[a-z0-9-]+`/.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      return {
        id: cells[0].replaceAll('`', ''),
        title: cells[1],
        second: cells[2],
        extra: cells[3] ?? '',
      };
    });
}

const outfitRows = tableRows(section('## Наряды: 38 позиций'));
const toyRows = tableRows(section('## Товары с одним кадром: 24 позиции'));

const catalog = [...shop.matchAll(/id: '([a-z0-9-]+)', slot: '[a-z]+', kind: '(\w+)'/g)].map((match) => ({
  id: match[1],
  kind: match[2],
}));
const outfitIds = catalog.filter((item) => item.kind === 'outfit').map((item) => item.id);
const toyIds = catalog.filter((item) => item.kind === 'toy').map((item) => item.id);

const photosBlock = photoSource.slice(photoSource.indexOf('PRODUCT_PHOTOS'), photoSource.indexOf('];', photoSource.indexOf('PRODUCT_PHOTOS')));
const photoIds = new Set([...photosBlock.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]));
const techIds = new Set([...techTour.matchAll(/^\s*'([a-z0-9-]+)': \{ path:/gm)].map((match) => match[1]));
const carIds = new Set([...carTour.slice(carTour.indexOf('CAR_TOUR_IDS')).matchAll(/'(car-[a-z0-9-]+)'/g)].map((match) => match[1]));
const singleShotIds = toyIds.filter((id) => photoIds.has(id) && !techIds.has(id) && !carIds.has(id));

const BANNED = /кроп|crop|увелич|zoom|зум|фрагмент/i;
const unique = (list) => new Set(list).size === list.length;

test('таблица нарядов совпадает с каталогом: 38 позиций, без повторов', () => {
  assert.equal(outfitIds.length, 38, 'на полке «Наряды» должно быть 38 позиций');
  assert.equal(outfitRows.length, 38, `в документе ${outfitRows.length} строк нарядов`);
  assert.deepEqual(new Set(outfitRows.map((row) => row.id)), new Set(outfitIds));
  assert.ok(unique(outfitRows.map((row) => row.id)), 'id нарядов в таблице повторяются');
  assert.ok(outfitRows.every((row) => row.title.trim().length > 1), 'у наряда нет названия');
});

test('очередь запуска нарядов: сначала корона, очки-сердечки и лента', () => {
  const byPriority = (value) => outfitRows.filter((row) => row.extra === value).map((row) => row.id).sort();
  assert.deepEqual(byPriority('1'), ['choker', 'crown', 'glasses-heart']);
  assert.deepEqual(
    byPriority('2'),
    ['bow', 'cap', 'clips-stars', 'glasses', 'grad', 'hat-ribbon', 'medal', 'scarf', 'wreath'],
  );
  assert.equal(byPriority('3').length, 26, 'остальные 26 нарядов идут третьей очередью');
});

test('таблица товаров совпадает с товарами, у которых только главный кадр', () => {
  assert.equal(singleShotIds.length, 24, `одно-кадровых товаров ${singleShotIds.length}`);
  assert.equal(toyRows.length, 24, `в документе ${toyRows.length} строк товаров`);
  assert.deepEqual(new Set(toyRows.map((row) => row.id)), new Set(singleShotIds));
  assert.ok(unique(toyRows.map((row) => row.id)), 'id товаров в таблице повторяются');
});

test('у каждой позиции свой бриф второго кадра, и это не кроп', () => {
  for (const row of [...outfitRows, ...toyRows]) {
    assert.ok(row.second.length >= 15, `${row.id}: бриф второго кадра слишком короткий — «${row.second}»`);
    assert.ok(!BANNED.test(row.second), `${row.id}: второй кадр описан как кроп — «${row.second}»`);
    assert.ok(!/^[-—–]$/.test(row.second), `${row.id}: бриф пустой`);
  }
  assert.ok(unique([...outfitRows, ...toyRows].map((row) => row.second)), 'брифы второго кадра повторяются у разных вещей');
});

test('пара или ничего: у наряда не бывает только главного кадра', () => {
  for (const row of outfitRows) {
    const main = `${root}public/products/${row.id}.webp`;
    const alternate = `${root}public/products/gallery/${row.id}-alt.webp`;
    const hasMain = existsSync(main);
    const hasAlternate = existsSync(alternate);
    assert.equal(
      hasMain,
      hasAlternate,
      `${row.id}: ${hasMain ? 'есть главный кадр без второго' : 'есть второй кадр без главного'} — серия неполная`,
    );
    if (hasMain && hasAlternate) {
      const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
      assert.notEqual(digest(main), digest(alternate), `${row.id}: второй кадр — копия главного`);
    }
  }
});

test('второй кадр товара не появляется без главного и не дублирует его', () => {
  for (const row of toyRows) {
    const main = `${root}public/products/${row.id}.webp`;
    const alternate = `${root}public/products/gallery/${row.id}-alt.webp`;
    assert.ok(existsSync(main), `${row.id}: нет главного кадра ${main}`);
    if (!existsSync(alternate)) continue;
    const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.notEqual(digest(main), digest(alternate), `${row.id}: второй кадр — копия главного`);
  }
});

test('каждая полная пара нарядов подключена к витрине', () => {
  // Правило 0.89.0: файлов два — и они видны. Пока пары не были подключены,
  // фотосерия лежала в репозитории мёртвым грузом («не нашёл очки и шляпу»).
  // Тест сверяет список показа (src/ui/PhotoPair.tsx) с тем, что реально есть
  // на диске: сгенерировали новую пару — обязаны добавить её в витрину.
  const source = readFileSync(new URL('../src/ui/PhotoPair.tsx', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('OUTFIT_PAIRS'), source.indexOf('};', source.indexOf('OUTFIT_PAIRS')));
  const wired = [...block.matchAll(/'?([a-z0-9-]+)'?:\s*\{\s*path:\s*'(products\/gallery\/[a-z0-9-]+\.webp)',\s*label:\s*'([^']+)'\s*\}/g)].map(
    (match) => ({ id: match[1], path: match[2], label: match[3] }),
  );

  const complete = outfitRows
    .filter((row) => existsSync(`${root}public/products/${row.id}.webp`) && existsSync(`${root}public/products/gallery/${row.id}-alt.webp`))
    .map((row) => row.id);

  assert.ok(complete.length >= 16, `полных пар в репозитории ${complete.length}, ожидалось не меньше 16`);
  assert.deepEqual(
    new Set(wired.map((pair) => pair.id)),
    new Set(complete),
    'список показа пар разошёлся с файлами: у каждой полной пары должен быть кадр на витрине',
  );
  assert.ok(unique(wired.map((pair) => pair.id)), 'пара подключена дважды');
  for (const pair of wired) {
    assert.equal(pair.path, `products/gallery/${pair.id}-alt.webp`, `${pair.id}: второй кадр ведёт на чужой файл`);
    assert.ok(pair.label.trim().length >= 3, `${pair.id}: у второго кадра нет подписи`);
    assert.ok(outfitIds.includes(pair.id), `${pair.id}: в списке пар не наряд из каталога`);
  }

  // Витрина и лист обязаны пользоваться этим списком, иначе он снова станет мёртвым.
  const shopSource = readFileSync(new URL('../src/ui/screens/ShopScreen.tsx', import.meta.url), 'utf8');
  assert.ok(shopSource.includes("from '../PhotoPair'"), 'ShopScreen не импортирует пары нарядов');
  assert.ok(shopSource.includes('hasOutfitPair('), 'витрина не спрашивает про пару кадров');
  assert.ok(shopSource.includes('<OutfitPhotoTour'), 'в листе товара нет просмотра пары');
});

test('в products/gallery нет файлов без ссылки из галереи или плана', () => {
  const galleryDir = `${root}public/products/gallery`;
  const referenced = new Set([
    ...[...techTour.matchAll(/path: 'products\/gallery\/([a-z0-9-]+)\.webp'/g)].map((match) => match[1]),
    ...[...outfitRows, ...toyRows].map((row) => `${row.id}-alt`),
  ]);
  const files = readdirSync(galleryDir).filter((name) => name.endsWith('.webp')).map((name) => name.replace(/\.webp$/, ''));
  const orphans = files.filter((name) => !referenced.has(name));
  assert.deepEqual(orphans, [], `файлы лежат без показа: ${orphans.join(', ')}`);
});
