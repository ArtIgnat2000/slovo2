// Чистота интерфейса и удобство для детей (0.66.0).
//
// Разбор — docs/proposals/ui-cleanliness.md. Здесь стражи на то, что легко
// откатить незаметно: бледный мелкий текст, тап-зоны меньше пальца и взрослые
// слова на детских экранах.
//
// Геометрию jsdom не считает, поэтому размеры проверяем по контракту в CSS —
// тот же приём, что в tests/lesson-art-ui.test.tsx («страж от отката в стилях»).
import { readFileSync } from 'node:fs';
import { check } from './ui-helpers';

const css = () => readFileSync('src/styles/app.css', 'utf8');
const tokens = () => readFileSync('src/styles/tokens.css', 'utf8');
const src = (path: string) => readFileSync(path, 'utf8');

/** Тело правила CSS по селектору (первое совпадение). */
function rule(cssText: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = cssText.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return m ? m[2] : '';
}

/** Минимальная высота из правила: `min-height: 48px` или padding+шрифт. */
function minHeight(body: string): number {
  const direct = body.match(/min-height:\s*(\d+)px/);
  if (direct) return Number(direct[1]);
  return NaN;
}

export function runUiCleanupChecks(): void {
  console.log('\n── Чистота интерфейса: читаемость и пальцы ──');

  const app = css();
  const tok = tokens();

  // ── 1. Мелкий текст ───────────────────────────────────────────────────────
  const fsXs = tok.match(/--fs-xs:\s*(\d+)px/);
  check(
    'мелкий текст: --fs-xs не меньше 14 px',
    !!fsXs && Number(fsXs[1]) >= 14,
    fsXs ? `${fsXs[1]} px` : 'нет токена',
  );
  const tiny = rule(app, '.tiny');
  check(
    'мелкий текст (.tiny) — второй уровень цвета, а не третий',
    /color:\s*var\(--ink-2\)/.test(tiny),
    tiny.trim().replace(/\s+/g, ' ').slice(0, 90),
  );
  const tab = rule(app, '.tab');
  const tabSize = tab.match(/font-size:\s*(\d+)px/);
  check(
    'подпись вкладки: не меньше 12 px',
    !!tabSize && Number(tabSize[1]) >= 12,
    tabSize ? `${tabSize[1]} px` : 'нет размера',
  );
  check(
    'подпись вкладки: цвет --ink-2 (было бледным --ink-3)',
    /color:\s*var\(--ink-2\)/.test(tab),
    tab.trim().replace(/\s+/g, ' ').slice(0, 90),
  );

  // ── 2. Смысловые цвета как текст ──────────────────────────────────────────
  // «Трудное» слово в словарике было красным на красной подложке (3,06 : 1).
  for (const [cls, token] of [
    ['weak', '--bad-ink'],
    ['mid', '--warn-ink'],
    ['good', '--good-ink'],
  ] as const) {
    const body = rule(app, `.word-chip.${cls}`);
    check(
      `словарик: плашка «${cls}» использует тёмные чернила ${token}`,
      body.includes(`var(${token})`),
      body.trim().replace(/\s+/g, ' ').slice(0, 90),
    );
  }
  // 0.70.0: тем стало 16 (8 оформлений × 2 схемы), а не 10. Считаем сами темы,
  // а не число в подписи: иначе каждая новая тема ломает проверку.
  const themeCount = (tok.match(/--good-ink:/g) ?? []).length;
  check(
    `темы: во всех ${themeCount} темах заданы --good-ink / --warn-ink / --bad-ink`,
    themeCount === 16 &&
      (tok.match(/--warn-ink:/g) ?? []).length === themeCount &&
      (tok.match(/--bad-ink:/g) ?? []).length === themeCount,
    `good ${(tok.match(/--good-ink:/g) ?? []).length}, warn ${
      (tok.match(/--warn-ink:/g) ?? []).length
    }, bad ${(tok.match(/--bad-ink:/g) ?? []).length}`,
  );

  // ── 3. Тап-зоны ───────────────────────────────────────────────────────────
  // 48 px — нижняя граница «палец ребёнка попадает с первого раза».
  for (const selector of [
    '.chip',
    '.word-chip',
    '.btn.sm',
    '.shop-heart',
    '.dict-legend-item',
    '.dict-search-input',
    '.dict-search-clear',
    '.dict-more-btn',
  ]) {
    const h = minHeight(rule(app, selector));
    check(
      `тап-зона: ${selector} — не меньше 48 px`,
      Number.isFinite(h) && h >= 48,
      Number.isFinite(h) ? `${h} px` : 'нет min-height',
    );
  }

  // ── 4. Детские слова вместо взрослых ──────────────────────────────────────
  // Список «нельзя»: это наш внутренний язык, а не язык ребёнка.
  const CHILD_SCREENS = [
    'src/ui/screens/HomeScreen.tsx',
    'src/ui/screens/WordsScreen.tsx',
    'src/ui/screens/LessonScreen.tsx',
  ];
  const BANNED = ['ур. ', 'Освоенность', 'тренировано', 'Полный контроль'];
  const found: string[] = [];
  for (const path of CHILD_SCREENS) {
    // Комментарии вырезаем: там «Полный контроль» — это объяснение для нас,
    // а не текст, который видит ребёнок.
    const text = src(path)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const word of BANNED) if (text.includes(word)) found.push(`${path}: «${word}»`);
  }
  check('детские экраны: нет взрослых слов и жаргона', found.length === 0, found.join(' | '));

  // Стрелка «4 из 6 → 6 из 6» без вывода заменена фразой со смыслом.
  const lesson = src('src/ui/screens/LessonScreen.tsx');
  check(
    'результаты: сравнение с прошлым разом объяснено словами',
    /лучше!/.test(lesson) && /потренируемся/.test(lesson),
    'нет вывода «лучше / потренируемся»',
  );

  // ── 5. Приглашение друга — одно место ─────────────────────────────────────
  const home = src('src/ui/screens/HomeScreen.tsx');
  check(
    '«Позови друга»: остаётся на главной в один тап',
    /invite-cta/.test(home) && /Позови друга/.test(home),
    'нет строки приглашения на главной',
  );
  check(
    '«Позови друга»: в меню ☰ дубля нет',
    !/data-menu="invite"/.test(home),
    'строка data-menu="invite" всё ещё в меню',
  );
}
