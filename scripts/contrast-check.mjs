// Контраст текста во всех темах (0.66.0).
//
// Зачем отдельный скрипт, а не «посмотреть глазами»: в 0.65.0 «тихий» цвет
// --ink-3 в светлых темах давал 2,72 : 1 при норме WCAG AA 4,5 : 1, и заметить
// это вживую было почти невозможно — на макете бледный текст выглядит «мягко».
// Тот же цвет стоит у неактивных вкладок и у подписей «4 из 8 слов».
//
// Что проверяем (WCAG 2.1, §1.4.3):
//   • обычный текст        — 4,5 : 1
//   • крупный текст (≥ 18,66 px и жирный) — 3 : 1
// Пары берём те, что реально есть в app.css: смысл в том, чтобы стеречь
// конкретные сочетания, а не всю палитру.
//
// Полупрозрачные цвета (rgba) — обычная история в стилях тем: их
// композитим поверх фона, иначе сравнение было бы нечестным.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const TOKENS = 'src/styles/tokens.css';

// ── Цвета ────────────────────────────────────────────────────────────────────

/** sRGB-компоненты из #rgb / #rrggbb / rgba(). */
export function parseColor(value) {
  const text = String(value ?? '').trim();
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgba = text.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  return null;
}

/** Наложить полупрозрачный цвет на подложку. */
export function over(color, backdrop) {
  if (!color) return null;
  if (color.a >= 1) return color;
  return {
    r: color.r * color.a + backdrop.r * (1 - color.a),
    g: color.g * color.a + backdrop.g * (1 - color.a),
    b: color.b * color.a + backdrop.b * (1 - color.a),
    a: 1,
  };
}

function channel(v) {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function luminance(color) {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** Коэффициент контраста по WCAG 2.1. */
export function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// ── Разбор tokens.css ────────────────────────────────────────────────────────

/**
 * Все объявления вида `--name: value;` внутри блока.
 *
 * Комментарии вырезаем обязательно: в tokens.css внутри :root висит пояснение
 * «…для текста на --orange-soft: у чистого #ff9f0a контраст ~1.9:1» — и без
 * вырезания значение `--orange-soft` превращалось в строку из комментария.
 */
function declarations(body) {
  const out = {};
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

/**
 * Блоки темы в порядке файла. Селектор разбираем грубо, но честно:
 * нам нужны только `:root`, `[data-theme='dark']` и `[data-theme-style='x']`
 * с необязательной парой «тёмная + стиль».
 */
export function readThemes(css) {
  const blocks = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const body = m[2];
    if (!selector.startsWith(':root') && !selector.startsWith('[data-theme')) continue;
    const decls = declarations(body);
    if (!Object.keys(decls).length) continue;
    const dark = /data-theme='dark'/.test(selector);
    const styleMatch = selector.match(/data-theme-style='([a-z]+)'/);
    blocks.push({ selector, dark, style: styleMatch ? styleMatch[1] : null, decls });
  }
  return blocks;
}

/** Итоговая карта переменных для одной темы: :root → dark → style → dark+style. */
export function themeVars(blocks, style, dark) {
  const merged = {};
  for (const b of blocks) {
    if (b.style === null && !b.dark) Object.assign(merged, b.decls); // :root
    if (b.style === null && b.dark === dark) Object.assign(merged, b.decls);
    if (b.style === style && b.dark === false) Object.assign(merged, b.decls);
    if (b.style === style && b.dark === true && dark) Object.assign(merged, b.decls);
  }
  return merged;
}

export function themeName(style, dark) {
  return dark ? `dark + ${style}` : `light ${style}`;
}

// ── Проверяемые пары ─────────────────────────────────────────────────────────
//
// `fg` и `bg` — имена переменных; `alpha` — порог. Для мягких подложек
// (`--green-soft` и т.п.) фон композитим поверх карточки/фона — так он и
// выглядит на экране.

const PAIRS = [
  { fg: '--ink', bg: '--bg', why: 'основной текст на фоне' },
  { fg: '--ink', bg: '--card', why: 'основной текст на карточке' },
  { fg: '--ink-2', bg: '--bg', why: 'второй уровень текста на фоне' },
  { fg: '--ink-2', bg: '--card', why: 'второй уровень текста на карточке' },
  // .tiny и .tab — мелкий текст, норма 4,5
  { fg: '--ink-3', bg: '--bg', why: '.tiny/.tab на фоне' },
  { fg: '--ink-3', bg: '--card', why: '.tiny/.tab на карточке' },
  // Плашки словарика: смысловые оттенки как текст
  { fg: '--good-ink', bg: '--green-soft', soft: true, why: '«освоено» в словарике' },
  { fg: '--warn-ink', bg: '--orange-soft', soft: true, why: '«в работе» в словарике' },
  { fg: '--orange-ink', bg: '--orange-soft', soft: true, why: 'оранжевые подписи статусов' },
  { fg: '--bad-ink', bg: '--red-soft', soft: true, why: '«трудное» в словарике' },
  // Подпись активной вкладки: 12 px, значит нужен полный 4,5
  { fg: '--primary-ink', bg: '--bg', why: 'активная вкладка на фоне' },
  { fg: '--primary-ink', bg: '--card', why: 'активная вкладка на карточке' },
  { fg: '--primary-ink', bg: '--primary-soft', soft: true, why: 'акцентный текст на мягкой подложке' },
  // Текст поверх заливки --primary: кнопки, выбранные чипы и вкладки магазина
  { fg: '--on-primary', bg: '--primary', why: 'белый/тёмный текст на заливке акцента' },
  // Витрина-люкс (0.79.0): две базовые темы — светлая (Rolls-Royce) и тёмная (Maybach)
  { fg: '--lux-cta-ink', bg: '--lux-cta', why: 'надпись кнопки «Купить» в витрине' },
  { fg: '--lux-plaque-ink', bg: '--lux-plaque', why: 'гравировка ценника витрины' },
  { fg: '--ink', bg: '--lux-card', why: 'название товара на карточке витрины' },
  { fg: '--ink-2', bg: '--lux-card', why: 'ценник и описание на карточке витрины' },
];

/** Считает пары для одной темы. Возвращает список результатов. */
export function checkTheme(vars, style, dark) {
  const rawBg = parseColor(vars['--bg']);
  if (!rawBg) return [{ theme: themeName(style, dark), error: 'нет --bg' }];
  const bg = over(rawBg, { r: 255, g: 255, b: 255, a: 1 });
  const card = over(parseColor(vars['--card']) ?? rawBg, bg);
  const out = [];
  for (const pair of PAIRS) {
    const fgRaw = parseColor(vars[pair.fg]);
    if (!fgRaw) {
      out.push({ theme: themeName(style, dark), label: `${pair.fg} / ${pair.bg}`, error: 'нет переменной', why: pair.why });
      continue;
    }
    // Подложка: любой цвет композитим на страницу, мягкие (полупрозрачные)
    // плашки — на карточку, потому что лежат они на карточках.
    const base = pair.soft ? card : bg;
    const back = over(parseColor(vars[pair.bg]), base);
    // Текст на мягкой подложке тоже может быть полупрозрачным — редкость,
    // но композиция бесплатна и делает проверку честной.
    const fg = over(fgRaw, back);
    out.push({
      theme: themeName(style, dark),
      label: `${pair.fg} на ${pair.bg}`,
      why: pair.why,
      ratio: contrast(fg, back),
      min: pair.min ?? 4.5,
    });
  }
  return out;
}

export function run(css = readFileSync(TOKENS, 'utf8')) {
  const blocks = readThemes(css);
  const styles = ['classic', ...new Set(blocks.map((b) => b.style).filter(Boolean))];
  const results = [];
  for (const style of styles) {
    for (const dark of [false, true]) {
      if (style === 'classic' && dark === false) {
        // :root сам по себе — светлая классика
      }
      results.push(...checkTheme(themeVars(blocks, style, dark), style, dark));
    }
  }
  return results;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const results = run();
  const themes = new Set(results.map((r) => r.theme));
  const bad = results.filter((r) => r.error || r.ratio < r.min);
  const byTheme = new Map();
  for (const r of results) {
    if (!byTheme.has(r.theme)) byTheme.set(r.theme, []);
    byTheme.get(r.theme).push(r);
  }
  for (const [theme, list] of byTheme) {
    const rows = list.filter((r) => r.ratio !== undefined).map((r) => `${r.ratio.toFixed(2)}`);
    console.log(`  ${theme.padEnd(22)} ${rows.join('  ')}`);
  }
  if (bad.length) {
    console.error(`\n✗ контраст: ${bad.length} нарушений в ${themes.size} темах`);
    for (const r of bad) {
      const ratio = r.error ? '—' : r.ratio.toFixed(2);
      console.error(`  · ${r.theme}: ${r.label} — ${ratio} (нужно ≥ ${r.min ?? 4.5}) · ${r.why}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`\n✓ контраст: ${themes.size} тем, ${results.length} пар — все не ниже нормы WCAG AA`);
  }
}
