// UI-иконки (0.54.0, вариант B «линия + акцент»).
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

/** Иконки, у которых в разборе обещана акцентная заливка (§5). */
const WITH_ACCENT = ICON_NAMES.filter((n) => n !== 'menu' && n !== 'check' && n !== 'close' && n !== 'arrow');

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
    'иконки: у всех штрих 2 и round — один вес на весь интерфейс',
    svgs.every(
      (s) =>
        s.getAttribute('stroke-width') === '2' &&
        s.getAttribute('stroke-linejoin') === 'round' &&
        s.getAttribute('stroke-linecap') === 'round',
    ),
    'нарушено у: ' + svgs.filter((s) => s.getAttribute('stroke-width') !== '2').map((s) => s.dataset.icon).join(', '),
  );
  check(
    'иконки: штрих наследует цвет текста (currentColor), а не фиксированный',
    svgs.every((s) => s.getAttribute('stroke') === 'currentColor'),
    svgs.filter((s) => s.getAttribute('stroke') !== 'currentColor').map((s) => s.dataset.icon).join(', '),
  );
  check(
    'иконки: акцентная заливка есть у 16 из 20',
    svgs.filter((s) => s.querySelector('.ico-acc')).length === WITH_ACCENT.length + 0,
    `с акцентом: ${svgs.filter((s) => s.querySelector('.ico-acc')).length}`,
  );
  check(
    'иконки: акцент не задан хардкодом в SVG (красит CSS-токен)',
    svgs.every((s) => !(s.querySelector('.ico-acc')?.getAttribute('fill') ?? '').match(/#|rgb/)),
    'у какой-то иконки fill прописан в разметке',
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
  check('иконки: весь набор ≤ 25 КБ (precache не пухнет)', bytes <= 25 * 1024, `${(bytes / 1024).toFixed(1)} КБ`);
  check(
    'иконки: в разметке нет хардкода цвета (#hex / rgb)',
    !/#[0-9a-fA-F]{3,8}\b/.test(src) && !/rgb\(/.test(src),
    'найден цвет в Icon.tsx',
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

  // ── 6. Токен темы ─────────────────────────────────────────────────────────
  const tokens = read('src/styles/tokens.css');
  const app = read('src/styles/app.css');
  check(
    'иконки: акцент — токен темы, а не цвет в компоненте',
    tokens.includes('--icon-accent: var(--primary)'),
    'нет --icon-accent в токенах',
  );
  check(
    'иконки: в тёмной теме акцент светлее (иначе заливка «проваливается»)',
    /\[data-theme='dark'\]\s*\{[^}]*--icon-accent:\s*var\(--primary-2\)/.test(tokens),
    'в [data-theme=dark] нет --icon-accent: var(--primary-2)',
  );
  check(
    'иконки: заливка акцента берётся из токена в CSS',
    /\.ico-acc\s*\{[^}]*fill:\s*var\(--icon-accent\)/.test(app),
    '.ico-acc без var(--icon-accent)',
  );

  host.remove();
  titled.remove();
}
