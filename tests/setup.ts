// Тестовая обвязка: jsdom + fake-indexeddb. НЕ часть приложения — лежит вне src,
// в сборку не попадает (см. .gitignore: /tmp-test/).
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

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
