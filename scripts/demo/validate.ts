// Сквозная проверка демо-файла: грузим его в НАСТОЯЩИЙ стор приложения через
// replaceAll (тот же путь, что кнопка «Загрузить файл» в родительском разделе)
// и убеждаемся, что санитайзеры ничего не потеряли.
//
// Запускается раннером scripts/make-demo-progress.mjs в jsdom + fake-indexeddb.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const root = process.env.DEMO_ROOT ? path.resolve(process.env.DEMO_ROOT) : process.cwd();
const outPath = process.env.DEMO_OUT
  ? path.resolve(process.env.DEMO_OUT)
  : path.join(root, 'docs/promo/slovo2-demo-progress.json');

// ── Минимальное jsdom-окружение (по образцу tests/setup.ts) ──
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});
const g = globalThis as Record<string, unknown>;
const w = dom.window as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'MouseEvent', 'CustomEvent', 'getComputedStyle', 'Blob', 'URL', 'CSSStyleDeclaration', 'DOMParser']) {
  if (w[key]) g[key] = w[key];
}
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 8) as unknown as number;
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = false;
if (typeof dom.window.matchMedia !== 'function') {
  const mql = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  });
  (dom.window as unknown as Record<string, unknown>).matchMedia = mql;
  g.matchMedia = mql;
}

const source = JSON.parse(readFileSync(outPath, 'utf8'));

// Динамический импорт после подготовки окружения: статические импорты поднялись
// бы раньше и стор создался бы без DOM/IndexedDB.
const { useApp } = await import('../../src/state/store');

for (let i = 0; i < 100 && !useApp.persist.hasHydrated(); i++) {
  await new Promise((r) => setTimeout(r, 20));
}
assert.ok(useApp.persist.hasHydrated(), 'стор не прочитал пустую базу');

useApp.getState().replaceAll(source);
const state = useApp.getState();

assert.equal(state.profiles.length, source.profiles.length, 'число профилей');
assert.equal(state.activeId, source.activeId, 'activeId');
assert.deepEqual(state.settings, source.settings, 'настройки');

for (const src of source.profiles) {
  const p = state.profiles.find((x) => x.id === src.id);
  assert.ok(p, `профиль ${src.name} загружен`);
  const tag = `[${src.name}]`;

  // Баланс и учебная статистика
  assert.equal(p.gems, src.gems, `${tag} кристаллы`);
  assert.equal(p.xp, src.xp, `${tag} XP`);
  const xpFromDays = Object.values(p.days).reduce((sum, d) => sum + d.xp, 0);
  assert.equal(xpFromDays, p.xp, `${tag} XP дням не сходится`);
  assert.ok(Object.values(p.days).every((d) => (d.activeSeconds ?? 0) > 0), `${tag} у всех дней есть время занятия`);
  assert.equal(p.streak, src.streak, `${tag} серия`);
  assert.equal(p.freezes, src.freezes, `${tag} заморозки`);
  assert.equal(p.lastDay, src.lastDay, `${tag} последний день`);
  assert.equal(p.activeClass, src.activeClass, `${tag} класс`);
  assert.deepEqual(Object.keys(p.words).sort(), Object.keys(src.words).sort(), `${tag} слова на месте`);
  assert.deepEqual(Object.keys(p.lessons).sort(), Object.keys(src.lessons).sort(), `${tag} уроки на месте`);
  assert.deepEqual(Object.keys(p.days).sort(), Object.keys(src.days).sort(), `${tag} дневная статистика`);
  const masteredSrc = Object.values(src.words).filter((x) => x.s >= 90).length;
  const masteredNow = Object.values(p.words).filter((x) => x.s >= 90).length;
  assert.equal(masteredNow, masteredSrc, `${tag} освоенные слова`);
  // SRS-состояние не должно «поплыть» при импорте
  for (const id of Object.keys(src.words).slice(0, 12)) {
    assert.deepEqual(p.words[id], src.words[id], `${tag} SRS слова ${id}`);
  }

  // Магазин: покупки, базы, костюмы, музыка, звуки, мир, желания
  const shop = p.shop!;
  assert.deepEqual([...shop.owned].sort(), [...src.shop.owned].sort(), `${tag} вещи магазина`);
  assert.deepEqual(shop.buildingsOwned, src.shop.buildingsOwned, `${tag} научные базы`);
  assert.equal(shop.activeBuilding, src.shop.activeBuilding, `${tag} активная база`);
  assert.equal(shop.worldBase, src.shop.worldBase, `${tag} база-фон мира`);
  assert.deepEqual(shop.crystalCostumesOwned, src.shop.crystalCostumesOwned, `${tag} кристальные костюмы`);
  assert.deepEqual(shop.musicOwned?.sort(), src.shop.musicOwned.sort(), `${tag} музыка`);
  assert.equal(shop.musicTrack, src.shop.musicTrack, `${tag} выбранная музыка`);
  // Пустой soundOwned при импорте получает стартовые наборы — это правило движка.
  assert.ok(shop.soundOwned.includes('classic') && shop.soundOwned.includes('xylophone'), `${tag} стартовые звуки`);
  assert.equal(shop.soundPack, src.shop.soundPack, `${tag} выбранный набор звуков`);
  assert.deepEqual(shop.wishlist, src.shop.wishlist, `${tag} мечты`);
  assert.ok(shop.world.length <= 3, `${tag} в мире не больше трёх предметов`);
  for (const id of shop.world) {
    assert.ok(shop.owned.includes(id) || shop.crystalCostumesOwned.includes(id) || p.puzzle?.assembled.includes(id), `${tag} в мире только своё: ${id}`);
  }
  assert.deepEqual(shop.tuning, src.shop.tuning, `${tag} оттенки`);
  for (const [slot, id] of Object.entries(shop.equipped)) {
    assert.ok(shop.owned.includes(id as string) || slot === 'toy', `${tag} надета только своя вещь: ${slot}`);
  }

  // Пазлы и сундуки
  assert.deepEqual(p.puzzle?.assembled, src.puzzle.assembled, `${tag} собранные костюмы`);
  assert.ok(p.puzzle?.worn === src.puzzle.worn, `${tag} надетый костюм`);
  assert.ok(p.chestSkins?.includes(p.chestSkin!), `${tag} облик сундука открыт`);
  assert.equal(p.daily?.chestsTotal, src.daily.chestsTotal, `${tag} счётчик сундуков`);
  assert.ok((p.daily?.plan?.length ?? 0) >= 3, `${tag} план заданий дня собран`);
  assert.equal(p.daily?.day, src.daily.day, `${tag} дневной план на сегодня`);

  // Сессии живут только 30 дней — санитайзер мог сократить список, но не поломать.
  assert.ok((p.studySessions?.length ?? 0) <= (src.studySessions?.length ?? 0), `${tag} сессии не разрослись`);
  for (const s of p.studySessions ?? []) {
    assert.equal(s.status, 'completed', `${tag} нет зависших сессий`);
  }
  assert.deepEqual(p.achievements.sort(), src.achievements.sort(), `${tag} достижения`);
}

console.log(`\n✓ Файл ${path.relative(root, outPath)} загружен в пустой стор без потерь:`);
for (const p of state.profiles) {
  const mastered = Object.values(p.words).filter((w) => w.s >= 90).length;
  const trained = Object.values(p.words).filter((w) => w.s > 0).length;
  console.log(
    `  • ${p.name}: ${p.gems} 💎, ${mastered} освоено / ${trained} в работе / ` +
    `${Object.keys(p.words).length} тронуто, покупок ${p.shop!.owned.length}, баз ${p.shop!.buildingsOwned.length}, ` +
    `серия ${p.streak}, сундуков ${p.daily?.chestsTotal}`,
  );
}

// Стор поднимает фоновые таймеры (PWA, синхронизация записи), которые держат
// event loop: скрипту нужен явный выход после успешной проверки.
process.exit(0);
