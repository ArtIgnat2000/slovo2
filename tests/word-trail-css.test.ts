/**
 * «Тропа слов» (0.110.0): стражи раскладки и движения.
 *
 * jsdom не считает геометрию, поэтому проверяем CSS как контракт: плита не
 * меньше 44 px (цель для пальца), сцена не тянет внешние картинки, а
 * `prefers-reduced-motion` действительно выключает анимации героя и плиты.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/app.css', 'utf8');
const start = css.indexOf('/* ── 0.110.0: «Тропа слов»');
assert.ok(start > 0, 'в app.css есть блок «Тропы»');
const trail = css.slice(start);

assert.match(trail, /\.trail-seg\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s, 'плита 44×44 — цель для пальца');
assert.match(trail, /\.trail-path-wide \.trail-seg\s*\{[^}]*min-width:\s*54px/s, 'слоговые плиты шире буквенных');
assert.match(trail, /\.trail-banner\s*\{[^}]*min-height:\s*52px/s, 'баннер не меньше 52 px');
assert.match(
  trail,
  /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.trail-hero[^}]*animation:\s*none[^}]*\}/s,
  'reduced motion выключает анимацию героя',
);
assert.match(
  trail,
  /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.trail-seg-hidden[^}]*animation:\s*none[^}]*\}/s,
  'reduced motion выключает дрожание плиты',
);
assert.ok(!/url\(/.test(trail), 'сцена «Тропы» не тянет внешние картинки');
assert.ok(!/overflow-x:\s*auto/.test(trail), 'в «Тропе» нет скрытой горизонтальной полки');
// На узком экране плиту не уменьшаем: 44 px — не косметика, а доступность.
const narrow = trail.slice(trail.indexOf('@media (max-width: 380px)'));
assert.ok(
  !/\.trail-seg\s*\{[^}]*(?:^|[;{\s])width:\s*\d+px/s.test(narrow),
  'на 380 px ширина плиты не переопределяется',
);
assert.ok(
  !/\.trail-seg\s*\{[^}]*(?:^|[;{\s])height:\s*\d+px/s.test(narrow),
  'на 380 px высота плиты не переопределяется',
);

console.log('✓ тропа: CSS-стражи — 44 px, reduced motion, без внешних картинок и скрытой полки');
