// Тестовая обвязка: jsdom + fake-indexeddb. НЕ часть приложения — лежит вне src,
// в сборку не попадает (см. .gitignore: /tmp-test/).
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

// ── Детерминированность ──────────────────────────────────────────────────────
// Приложение перемешивает задания, варианты ответа и буквы через Math.random,
// поэтому смоук-тест был «рулеткой»: один и тот же коммит то зелёный, то красный
// (проверка «задания-отработки после ошибок встречались» падала примерно в 1 из 7
// прогонов — просто потому, что намеренная ошибка не всегда попадала в задание,
// где она засчитывается). Подменяем генератор на воспроизводимый: прогон всегда
// одинаковый, а любое падение можно повторить и разобрать.
// Другой seed — для проверки на других перестановках: SMOKE_SEED=42 npm run test:smoke
function mulberry32(a: number) {
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smokeSeed = Number(process.env.SMOKE_SEED ?? 1);
Math.random = mulberry32(Number.isFinite(smokeSeed) ? smokeSeed : 1);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
});

const g = globalThis as Record<string, unknown>;
const w = dom.window as unknown as Record<string, unknown>;

g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
for (const key of [
  'HTMLElement',
  'HTMLButtonElement',
  'Node',
  'Element',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'CustomEvent',
  'getComputedStyle',
  'DOMParser',
  'Blob',
  'URL',
  'CSSStyleDeclaration',
]) {
  if (w[key]) g[key] = w[key];
}
// localStorage нужен приложению (флаг подсказки «добавь на экран»); в jsdom он есть,
// но в Node-глобали не попадает — иначе try/catch в platform/pwa.ts молча всё отключает.
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 8) as unknown as number;
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = false;

// jsdom 30 не реализует matchMedia, а приложение спрашивает про display-mode и тему
if (typeof dom.window.matchMedia !== 'function') {
  const mql = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
  (dom.window as unknown as Record<string, unknown>).matchMedia = mql;
  g.matchMedia = mql;
}
