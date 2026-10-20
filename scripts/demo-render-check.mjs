// Быстрая проверка рендера витрины концепции (ShopDemo) в jsdom.
// Не часть тестового контура — запускается вручную:
//   node scripts/demo-render-check.mjs
// Сборка через esbuild, как в scripts/smoke.mjs: Node не умеет .tsx напрямую.
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.demo-check');
mkdirSync(out, { recursive: true });

// Точка входа: jsdom-обвязка + импорт витрины + проверки текста.
const entry = path.join(out, 'entry.mjs');
writeFileSync(
  entry,
  `
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
const w = dom.window;
for (const key of ['HTMLElement', 'Element', 'Node', 'getComputedStyle', 'localStorage', 'sessionStorage']) {
  if (w[key]) globalThis[key] = w[key];
}
globalThis.matchMedia = w.matchMedia ?? (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 8);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

await import('${'../src/ui/ShopDemo.tsx'}');
await new Promise((r) => setTimeout(r, 300));

const text = () => document.body.textContent ?? '';
const problems = [];
const expect = (needle, label) => {
  if (!text().includes(needle)) problems.push('нет: ' + label + ' («' + needle + '»)');
};
/** Тап по кнопке или карточке (role=button) с нужным текстом. */
const tap = (label) => {
  const els = [...document.querySelectorAll('button, [role="button"]')];
  const el = els.find((b) => (b.textContent ?? '').includes(label));
  if (!el) { problems.push('нет элемента: ' + label); return false; }
  el.click();
  return true;
};

expect('Витрина', 'сегмент «Витрина»');
expect('Гардероб', 'сегмент «Гардероб»');
expect('Наряды', 'чип «Наряды»');
expect('Техника', 'чип «Техника»');
expect('Костюмы', 'чип «Костюмы»');
expect('Музыка', 'чип «Музыка»');
expect('скоро', 'чипы будущих разделов');
expect('Ближайшая цель', 'герой-секция');
expect('Бантик', 'герой — ближайшая цель');
expect('Кепка', 'карточка кепки');
expect('Шапочка магистра', 'карточка шапочки магистра');

// Полки переключаются чипами
tap('Костюмы');
await new Promise((r) => setTimeout(r, 100));
expect('Тёмный лорд', 'карточка костюма');
expect('Собираем сейчас', 'активный сбор костюма');
tap('Музыка');
await new Promise((r) => setTimeout(r, 100));
expect('Беззаботный день', 'карточка трека');
tap('Пикселяндия');
await new Promise((r) => setTimeout(r, 100));
expect('Послушать', 'примерка трека в подробной карточке');

// Подробная карточка — снизу (sheet), закрывается по фону
document.querySelector('.mz-sheet-veil')?.click();
await new Promise((r) => setTimeout(r, 100));

// Полка «Техника»: отдельные вкладки авто, кораблей и телефонов
tap('Техника');
await new Promise((r) => setTimeout(r, 100));
expect('Авто', 'вкладка авто');
expect('Телефоны', 'вкладка телефонов');
expect('Корабли', 'вкладка кораблей');
expect('Стрела', 'карточка спортивного седана');
expect('Лорд', 'карточка парадного лимузина');
expect('Звезда', 'карточка флагманского седана');
expect('Молния', 'карточка гиперкара');
expect('Ближайшая покупка', 'подсказка о ближайшей покупке');
expect('Болид', 'карточка гоночной машины');
if (document.querySelectorAll('.shop-item.toy-item').length !== 10) problems.push('раздел авто должен показывать только десять машин');
if (document.querySelectorAll('.shop-item.toy-item img[src*="/cars/"]').length !== 10) problems.push('не у всех машин отдельный рисунок');
for (const brand of ['БМВ', 'Мерседес', 'Брабус', 'Майбах', 'Роллс-Ройс', 'Ламборджини', 'Бугати', 'BMW', 'Mercedes', 'Brabus', 'Maybach', 'Rolls', 'Lamborghini', 'Bugatti']) {
  if (text().includes(brand)) problems.push('бренд в витрине: ' + brand);
}
if (!document.querySelector('.shop-boutique .shop-case-lamp')) problems.push('нет лампы в нише витрины');
if (!document.querySelector('.shop-boutique .shop-case-podium')) problems.push('нет подиума под вещью');
if (document.querySelectorAll('.shop-boutique .shop-case').length !== 10) problems.push('не все автомобили стоят в своих нишах');

tap('Корабли');
await new Promise((r) => setTimeout(r, 100));
expect('Морская яхта', 'карточка яхты');
expect('Контейнеровоз', 'карточка контейнеровоза');
expect('Супертанкер', 'карточка супертанкера');
expect('Авианосец', 'карточка авианосца');
if (document.querySelectorAll('.shop-item.toy-item').length !== 4) problems.push('раздел кораблей должен показывать четыре судна');
if (document.querySelectorAll('.shop-item.toy-item img[src*="/ships/"]').length !== 4) problems.push('не у всех судов отдельный рисунок');

tap('Телефоны');
await new Promise((r) => setTimeout(r, 100));
expect('iPhone Air', 'карточка смартфона');
if (text().includes('Пароход')) problems.push('в новой витрине остался устаревший детский кораблик');
if (document.querySelectorAll('.shop-item.toy-item').length !== 7) problems.push('раздел телефонов должен показывать четыре телефона и три устройства');
if (document.querySelectorAll('.shop-item.toy-item .phone-rotate').length !== 4) problems.push('четыре телефона должны поддерживать поворот');

// Подробная карточка техники: крупный арт и честная подпись
tap('iPhone 17');
await new Promise((r) => setTimeout(r, 100));
expect('Встанет в ангаре БУКа', 'подпись техники в sheet');
expect('Купить за 💎30', 'покупка техники из sheet');
tap('Купить за 💎30');
await new Promise((r) => setTimeout(r, 100));
tap('Купить за 💎30'); // ConfirmDialog — то же подтверждение, что в приложении
await new Promise((r) => setTimeout(r, 100));
expect('iPhone 17 — твой!', 'тост после покупки техники');
expect('На подиуме ✓', 'купленная вещь встала на главный подиум ангара');
expect('💎 32', 'баланс уменьшился на цену техники');

// Покупка из sheet: бантик (герой) за 20 💎, было 32 → станет 12
tap('Наряды');
await new Promise((r) => setTimeout(r, 100));
tap('Бантик');
await new Promise((r) => setTimeout(r, 100));
expect('Купить за 💎20', 'покупка из sheet');
tap('Купить за 💎20');
await new Promise((r) => setTimeout(r, 100));
tap('Купить за 💎20'); // ConfirmDialog — то же подтверждение, что в приложении
await new Promise((r) => setTimeout(r, 100));
expect('Бантик — твой!', 'тост после покупки');
expect('💎 12', 'баланс уменьшился ровно на цену');

// Гардероб: коллекция, примерочная и мечты
tap('Гардероб');
await new Promise((r) => setTimeout(r, 100));
expect('мой наряд', 'примерочная гардероба');
expect('Бантик', 'купленное попало в гардероб');
expect('Моя техника', 'полка купленной техники');
expect('iPhone 17', 'купленная вещь в гардеробе');
expect('Пилот истребителя', 'собранный костюм в гардеробе');
expect('Мечты', 'блок мечт');
expect('ещё', 'прогресс копления в мечтах');

if (problems.length) {
  console.error('ПРОВЕРКА МАКЕТА: не всё отрисовалось');
  for (const p of problems) console.error(' −', p);
  process.exit(1);
}
console.log('ПРОВЕРКА МАКЕТА: витрина магазина отрисовалась, ошибок рендера нет');
process.exit(0);
`,
);

await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  target: 'node20',
  outfile: path.join(out, 'check.mjs'),
  logLevel: 'warning',
  external: ['jsdom', 'fake-indexeddb'],
  // Vite подставляет import.meta.env целиком; в тесте задаём тот же объект
  // руками — витрина читает BASE_URL для рисунков машин (public/cars/*.webp).
  define: {
    'import.meta.env': JSON.stringify({ BASE_URL: '/', MODE: 'test', DEV: true, PROD: false }),
  },
});

const res = spawnSync(process.execPath, [path.join(out, 'check.mjs')], { stdio: 'inherit', cwd: root });
rmSync(out, { recursive: true, force: true });
process.exit(res.status ?? 1);
