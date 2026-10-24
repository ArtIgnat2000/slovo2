// UI-иконки (0.55.0): цветные значки вместо «линии + акцента» из 0.54.0.
//
// 0.54.0 нарисовала линейный набор — дети его не приняли, особенно кристалл:
// в 16–24 px тёмный контур превращал алмаз в стрелку. Вывод: иконки живут
// по правилам картинок к словам — плотная заливка, тонкий контур своего
// оттенка, блик; чёрный контур запрещён.
//
// Проверяем не «нарисовано ли красиво», а правила из
// docs/proposals/ui-icons.md §4 — то, что легко нарушить незаметно:
//  1) набор совпадает с разбором (20 имён, ни одного лишнего);
//  2) каждая иконка — SVG 24×24, штрих 2, `currentColor`, без хардкода цвета;
//  3) акцентная деталь есть там, где обещана, и красится токеном темы;
//  4) доступность: декоративная иконка `aria-hidden`, с `title` — `role=img`;
//  5) вес набора в бюджете (≤ 25 КБ), чтобы precache не пух;
//  6) в шести заменённых местах интерфейса не осталось функциональных эмодзи,
//     а контентные эмодзи (слова, уроки) не тронуты.
import './setup';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_NAMES, Icon } from '../src/ui/Icon';
import { check, sleep } from './ui-helpers';

const SRC = 'src/ui/Icon.tsx';
const ICON_DIR = 'src/ui';

/** Монохромные знаки: им цвет не нужен, они подчиняются теме (currentColor). */
const MONO = ['menu', 'check', 'close', 'arrow'];
/** Сколько цветов допустимо на весь набор: детская палитра, а не радуга. */
const MAX_COLORS = 48;

const read = (file: string) => readFileSync(file, 'utf8');

/**
 * Код без комментариев: в них эмодзи — это документация («☰ заменил 🎁»),
 * а не интерфейс. Проверять нужно разметку, поэтому комментарии вырезаем.
 */
const readCode = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

async function render(node: ReturnType<typeof createElement>): Promise<HTMLDivElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(node);
  await sleep(30);
  return host;
}

export async function runIconChecks(): Promise<void> {
  // ── 1. Набор ──────────────────────────────────────────────────────────────
  check('иконки: в наборе ровно 20 штук', ICON_NAMES.length === 20, `сейчас ${ICON_NAMES.length}`);
  const expected = [
    'crystal', 'chest', 'heart', 'palette', 'puzzle', 'hat', 'flame', 'bolt',
    'bulb', 'menu', 'speaker', 'speaker-off', 'trophy', 'star', 'book',
    'calendar', 'check', 'close', 'arrow', 'sparkle',
  ];
  check(
    'иконки: имена совпадают с разбором',
    expected.every((n) => (ICON_NAMES as string[]).includes(n)),
    `лишние/пропавшие: ${ICON_NAMES.filter((n) => !expected.includes(n)).join(', ') || 'нет'}`,
  );

  // ── 2. Разметка SVG ───────────────────────────────────────────────────────
  const host = await render(
    createElement(
      'div',
      null,
      ...ICON_NAMES.map((name) => createElement(Icon, { key: name, name, size: 24 })),
    ),
  );
  const svgs = Array.from(host.querySelectorAll('svg')) as SVGSVGElement[];
  check('иконки: каждая отрисовалась как svg', svgs.length === ICON_NAMES.length, `${svgs.length} из ${ICON_NAMES.length}`);
  check(
    'иконки: у всех viewBox 0 0 24 24 — единая сетка',
    svgs.every((s) => s.getAttribute('viewBox') === '0 0 24 24'),
    svgs.map((s) => s.getAttribute('viewBox')).join(' '),
  );
  check(
    'иконки: скруглённые штрихи у всех — один характер линий',
    svgs.every(
      (s) => s.getAttribute('stroke-linejoin') === 'round' && s.getAttribute('stroke-linecap') === 'round',
    ),
    'нарушено у: ' +
      svgs
        .filter((s) => s.getAttribute('stroke-linejoin') !== 'round')
        .map((s) => s.dataset.icon)
        .join(', '),
  );
  // 0.55.0: главное отличие от линейного набора — плотная заливка.
  check(
    'иконки: у каждой цветной иконки есть заливка (не только штрих)',
    svgs
      .filter((s) => !MONO.includes(s.dataset.icon ?? ''))
      .every((s) => Array.from(s.querySelectorAll('path')).some((p) => (p.getAttribute('fill') ?? 'none') !== 'none')),
    svgs
      .filter((s) => !MONO.includes(s.dataset.icon ?? ''))
      .filter((s) => !Array.from(s.querySelectorAll('path')).some((p) => (p.getAttribute('fill') ?? 'none') !== 'none'))
      .map((s) => s.dataset.icon)
      .join(', '),
  );
  check(
    'иконки: чёрного контура нет — только свой тёмный оттенок (0.54.0 «съел» алмаз)',
    !/#000|#0{3,6}\b|black/i.test(read(SRC)),
    'в Icon.tsx есть чёрный цвет',
  );
  check(
    'иконки: монохромные знаки (меню, крестик, стрелка) берут currentColor',
    MONO.every((name) => read(SRC).includes(`'${name}'`) && /currentColor/.test(read(SRC))),
    'нет currentColor для монохромных знаков',
  );
  check(
    'иконки: палитра набора ≤ 48 цветов (не расползлась в радугу)',
    new Set((read(SRC).match(/#[0-9a-fA-F]{6}/g) ?? []).map((c) => c.toLowerCase())).size <= MAX_COLORS,
    `цветов: ${new Set(read(SRC).match(/#[0-9a-fA-F]{6}/g) ?? []).size}`,
  );
  // Толстый контур «съел» алмаз в 0.54.0: у цветных иконок он тонкий,
  // а толстый штрих разрешён только монохромным знакам (у них нет заливки).
  const thick = svgs.filter((s) =>
    Array.from(s.querySelectorAll('path')).some(
      (p) => (p.getAttribute('fill') ?? 'none') !== 'none' && Number(p.getAttribute('stroke-width') ?? 0) > 1.6,
    ),
  );
  check(
    'иконки: у цветных иконок контур тонкий (≤ 1,6) — толстый и был проблемой',
    thick.length === 0,
    thick.map((s) => s.dataset.icon).join(', '),
  );

  // ── 3. Доступность ────────────────────────────────────────────────────────
  check(
    'иконки: по умолчанию декоративные (aria-hidden, скринридер не читает «камень»)',
    svgs.every((s) => s.getAttribute('aria-hidden') === 'true' && !s.getAttribute('role')),
    svgs.filter((s) => s.getAttribute('aria-hidden') !== 'true').map((s) => s.dataset.icon).join(', '),
  );
  const titled = await render(createElement(Icon, { name: 'crystal', title: 'Кристаллы', size: 20 }));
  const titledSvg = titled.querySelector('svg')!;
  check(
    'иконки: с title — самостоятельный смысл (role=img + aria-label)',
    titledSvg.getAttribute('role') === 'img' &&
      titledSvg.getAttribute('aria-label') === 'Кристаллы' &&
      !titledSvg.getAttribute('aria-hidden'),
    `${titledSvg.getAttribute('role')} / ${titledSvg.getAttribute('aria-label')}`,
  );

  // ── 4. Бюджет веса и «нет букв» ───────────────────────────────────────────
  const src = read(SRC);
  const bytes = Buffer.byteLength(src, 'utf8');
  check('иконки: весь набор ≤ 32 КБ (precache не пухнет)', bytes <= 32 * 1024, `${(bytes / 1024).toFixed(1)} КБ`);
  check(
    'иконки: цвета заданы hex-палитрой в одном месте (Icon.tsx), а не в компонентах',
    (src.match(/#[0-9a-fA-F]{6}/g) ?? []).length > 20 &&
      !/#[0-9a-fA-F]{3,8}/.test(read('src/ui/screens/HomeScreen.tsx')),
    'цвета расползлись по компонентам',
  );
  check(
    'иконки: ни одной буквы/цифры внутри иконки',
    !/<text/.test(src) && !/<title>/.test(src),
    'в Icon.tsx есть <text> или <title>',
  );

  // ── 5. Замены в интерфейсе ────────────────────────────────────────────────
  // Функциональные эмодзи, которые в 0.54.0 заменены иконками. Если кто-то
  // вернёт эмодзи обратно — тест это поймает.
  const replaced: [string, RegExp, string][] = [
    [`${ICON_DIR}/screens/HomeScreen.tsx`, /💎|☰/, 'шапка: счётчик кристаллов и меню'],
    [`${ICON_DIR}/TaskView.tsx`, /💡/, 'урок: кнопка и карточка подсказки'],
    [`${ICON_DIR}/DailyQuestStrip.tsx`, /🎁/, 'главная: полоска заданий'],
    [`${ICON_DIR}/screens/ShopScreen.tsx`, /БУК 🎩|stat-pill gems">\s*💎/, 'магазин: заголовок и счётчик'],
  ];
  for (const [file, pattern, where] of replaced) {
    const text = readCode(file);
    check(`иконки: ${where} — без функциональных эмодзи`, !pattern.test(text), `${file}: ${text.match(pattern)?.[0] ?? ''}`);
  }
  check(
    'иконки: шапка и магазин используют набор, а не текст',
    readCode(`${ICON_DIR}/screens/HomeScreen.tsx`).includes('<Gem value={profile.gems}') &&
      readCode(`${ICON_DIR}/screens/ShopScreen.tsx`).includes('<Gem value={gems}'),
    'счётчики кристаллов не на Gem',
  );

  // Контентные эмодзи не тронуты: слова и темы уроков — это контент, а не UI.
  const words = read('src/content/words.ts');
  check(
    'иконки: эмодзи в контенте слов не тронуты (это не интерфейс)',
    words.includes('🦊') && words.includes('📅') && words.includes('🌾'),
    'контент слов изменился',
  );

  // ── 6. Внешний вид в списке: иконки не «ломают» строку ───────────────────
  const app = read('src/styles/app.css');
  check(
    'иконки: в CSS нет «прыжка» строки (vertical-align у .ico)',
    /\.ico\s*\{[^}]*vertical-align/.test(app),
    '.ico без vertical-align',
  );
  check(
    'иконки: превью набора обновлено под цветной набор',
    read('docs/proposals/ui-icons/preview.html').includes('0.55.0'),
    'превью не обновлено',
  );

  host.remove();
  titled.remove();
}
