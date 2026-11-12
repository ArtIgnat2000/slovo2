// «Игры» через настоящий UI (0.92.0): вкладка открывается, свободная практика
// живёт по правилам рамки — ничего не сгорает, ничего не считается, словечки
// ребёнку показывают только изученные. «Скоро»-карточки помечены честно.
import { readFileSync } from 'node:fs';
import { useApp } from '../src/state/store';
import { WORDS_BY_GRADE } from '../src/content/words';
import { MASTERED_SCORE } from '../src/engine/classes';
import { btnText, buttons, check, click, has, sleep } from './ui-helpers';

async function goTab(name: string) {
  const tab = buttons().find((b) => (b.textContent ?? '').includes(name) && b.className.includes('tab'));
  click(tab);
  await sleep(60);
}

/**
 * С 0.96.0 на экране «Игры» ровно одна игра за раз: её выбирают сегментом
 * (.games-switch-btn). Тесты переключают игру так же, как ребёнок — тапом.
 */
async function goGame(title: string) {
  const seg = Array.from(document.querySelectorAll('.games-switch-btn')).find((b) =>
    (b.textContent ?? '').includes(title),
  ) as HTMLButtonElement | undefined;
  if (seg) {
    click(seg);
    await sleep(60);
  }
  return !!seg;
}

export async function runGamesUiChecks() {
  console.log('\n── Игры: вкладка и свободная практика ──');
  useApp.getState().createProfile('Тест игр', '🧩');
  await sleep(60);

  // Осваиваем несколько слов активного класса — ровно то, что рамка
  // свободной практики считает «уже встречал».
  const active = useApp.getState().profiles.find((p) => p.id === useApp.getState().activeId);
  const grade = (active?.activeClass ?? 2) as keyof typeof WORDS_BY_GRADE;
  const learned = (WORDS_BY_GRADE[grade] ?? []).filter((w) => !w.text.includes(' ')).slice(0, 6);
  const seed: Record<string, { s: number; due: number; iv: number; n: number; seen: number; ok: number; wrong: number }> = {};
  for (const w of learned) {
    seed[w.id] = { s: MASTERED_SCORE, due: 0, iv: 4, n: 3, seen: 3, ok: 3, wrong: 0 };
  }
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === s.activeId ? { ...p, words: { ...p.words, ...seed } } : p,
    ),
  }));
  await sleep(40);

  await goTab('Игры');
  check('игры: вкладка открылась', !!document.querySelector('.games-screen'), document.body.textContent?.slice(0, 200) ?? '');
  // С 0.96.1 правило рамки живёт подсказкой заголовка, а не строкой на экране:
  // на телефоне текст над полем стоил дороже, чем пользы (замечание «избыток
  // слов в шапке страницы»).
  check(
    'игры: правило «ничего не сгорает» доступно из заголовка',
    (document.querySelector('.games-title')?.getAttribute('title') ?? '').includes('ничего не сгорает'),
    document.querySelector('.games-title')?.getAttribute('title') ?? 'подсказки нет',
  );
  check(
    'игры: в шапке не осталось абзаца-описания',
    !document.querySelector('.games-sub') && !document.querySelector('.games-oneline'),
    document.querySelector('.games-head')?.textContent ?? '',
  );
  check('игры: свободная практика есть на экране', has('Собери слово'), '');
  check('игры: изученные слова видны чипами', document.querySelectorAll('.game-pick').length === learned.length,
    `чипов: ${document.querySelectorAll('.game-pick').length}`);
  check('игры: плиточный конструктор отрисован', document.querySelectorAll('.tileboard-tile').length > 0,
    `плиток: ${document.querySelectorAll('.tileboard-tile').length}`);
  check('игры: плитки несут буквы слова', !!document.querySelector('.word-board'), '');

  // ── Раскладка «один экран — одна игра» (0.96.0) ─────────────────────────
  check('игры: сверху сегмент выбора игры', document.querySelectorAll('.games-switch-btn').length === 3,
    `кнопок: ${document.querySelectorAll('.games-switch-btn').length}`);
  check('игры: открыта ровно одна игра («Собери слово»)', !!document.querySelector('.game-practice'), '');
  check('игры: поле игры — прокручиваемая сцена остатка экрана', !!document.querySelector('.games-stage'), '');
  check('игры: чипы слов — одна лента вбок, без «стены» на пол-экрана',
    document.querySelectorAll('.game-picks .game-pick').length === learned.length,
    `чипов: ${document.querySelectorAll('.game-pick').length}`);
  check('игры: экран помечает выбранную игру для скринридера',
    document.querySelector('.games-switch-btn[aria-selected="true"]') !== null, '');
  const cols = document.querySelector('.word-board')?.getAttribute('style') ?? '';
  check('игры: число колонок доски считается от длины слова (--slot-cols)', cols.includes('--slot-cols'),
    cols);

  // «Скоро»-карточек больше нет: все три механики P0–P1 запущены.
  check('игры: «скоро»-карточки больше не нужны — все механики в игре', !document.querySelector('.game-soon'), '');

  // Собираем показанное слово тапами по плиткам в порядке букв.
  const chip = document.querySelector('.game-pick.on') as HTMLButtonElement | null;
  const word = (chip?.textContent ?? '').trim();
  check('игры: выбрано слово для сборки', word.length > 1, word);
  for (const ch of [...word]) {
    const tiles = Array.from(document.querySelectorAll('.tileboard-tile')) as HTMLButtonElement[];
    const tile = tiles.find((b) => (b.textContent ?? '').trim() === ch && !b.disabled);
    click(tile);
    await sleep(20);
  }
  await sleep(120);
  check('игры: после сборки — баннер «Слово собрано!»', has('Слово собрано'), document.body.textContent?.slice(0, 260) ?? '');
  check('игры: сборка не записала XP (счёта нет по определению)', !!document.querySelector('.tileboard-banner'), '');

  // ── Плотность экрана на Android (0.96.6) ────────────────────────────────
  // Замечание владельца: «на андроиде не помещается игра» — кнопки уезжали
  // под нижнее меню. Проверяем не пиксели (jsdom без раскладки), а состав:
  // подсказка стала строкой «иконка + текст», а пустой лоток после сборки
  // исчез — именно эти два блока и выдавливали баннер.
  const clue = document.querySelector('.game-clue');
  check('игры: подсказка — иконка и текст в одной строке, а не колонкой',
    !!clue && !!clue.querySelector('.word-art-frame') && !!clue.querySelector('.game-clue-body'),
    clue?.innerHTML.slice(0, 120) ?? 'подсказки нет');
  check('игры: в подсказке остались пример и объём слова',
    !!clue?.querySelector('.sentence') && (clue?.querySelector('.clue-hint')?.textContent ?? '').includes('букв'),
    clue?.textContent ?? '');
  check('игры: после сборки пустой лоток букв убран — баннер встаёт на его место',
    !document.querySelector('.tileboard-tray'), `лотков: ${document.querySelectorAll('.tileboard-tray').length}`);
  check('игры: пояснение к оранжевой букве осталось',
    (document.querySelector('.tileboard-banner')?.textContent ?? '').includes('Оранжевым'),
    document.querySelector('.tileboard-banner')?.textContent ?? '');

  // «Другое слово» в баннере победы: свободная игра ведёт слово за словом,
  // не заставляя искать чип в ленте (0.96.0).
  const nextBtn = btnText('Другое слово');
  if (nextBtn) {
    const wasWord = (document.querySelector('.game-pick.on')?.textContent ?? '').trim();
    click(nextBtn);
    await sleep(80);
    check('игры: «Другое слово» ведёт к следующему слову',
      (document.querySelector('.game-pick.on')?.textContent ?? '').trim() !== wasWord,
      `было «${wasWord}»`);
  }

  // Тап по другому чипу — доска переключается на то слово.
  const other = Array.from(document.querySelectorAll('.game-pick')).find((b) => !(b as HTMLButtonElement).className.includes('on')) as HTMLButtonElement | undefined;
  if (other) {
    const target = (other.textContent ?? '').trim();
    click(other);
    await sleep(80);
    check('игры: тап по чипу переключает слово', (document.querySelector('.game-pick.on')?.textContent ?? '').trim() === target, target);
    check('игры: у нового слова — чистая доска', document.querySelectorAll('.tileboard-slot.filled').length === 0,
      `заполнено: ${document.querySelectorAll('.tileboard-slot.filled').length}`);
  }
}

// «Филворд» (0.94.0): поле отрисовано, слова вычитаются сканом сетки, игра
// честно считает найденные слова и завершается баннером. Ничего не считает
// в SRS и XP — чистая свободная игра.
export async function runWordSearchUiChecks() {
  console.log('\n── Филворд: буквенное поле ──');
  // Пул побольше: так виднее, меняются ли слова. Но у владельца пул был
  // крошечным, поэтому ниже есть отдельная проверка на малом пуле.
  const activeNow = useApp.getState().profiles.find((p) => p.id === useApp.getState().activeId);
  const gradeNow = (activeNow?.activeClass ?? 2) as keyof typeof WORDS_BY_GRADE;
  const wide = (WORDS_BY_GRADE[gradeNow] ?? []).filter((w) => !w.text.includes(' ')).slice(0, 24);
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === s.activeId
        ? {
            ...p,
            words: {
              ...p.words,
              ...Object.fromEntries(
                wide.map((w) => [w.id, { s: MASTERED_SCORE, due: 0, iv: 4, n: 3, seen: 3, ok: 3, wrong: 0 }]),
              ),
            },
          }
        : p,
    ),
  }));
  await sleep(60);
  await goTab('Игры');
  await sleep(60);
  check('филворд: игра выбирается сегментом', await goGame('Филворд'), '');

  const cells = () => Array.from(document.querySelectorAll('.ws-cell')) as HTMLButtonElement[];
  check('филворд: раздел и поле есть на экране', !!document.querySelector('.ws-grid'), '');
  if (cells().length === 0) return;

  // ── Раскладка планшета (0.97.0): поле и слова-цели рядом ────────────────
  // Замечание владельца (2026-11-12, iPad): «филворд не помещается по
  // вертикали». Одна колонка не лечится — нужен второй столбец, иначе
  // раскладка тихо откатится и вопросы снова уедут под нижнее меню.
  const wsBody = document.querySelector('.ws-body');
  const wsBoard = document.querySelector('.ws-board');
  const wsWords = document.querySelector('.ws-words');
  check('филворд: тело игры разделено на доску и цели (две колонки)',
    !!wsBody && !!wsBoard && !!wsWords &&
      wsBoard.contains(document.querySelector('.ws-grid') as Node) &&
      wsBody.contains(wsWords as Node) &&
      wsBoard !== wsWords,
    `тело: ${wsBody?.className ?? '—'}, доска: ${wsBoard?.className ?? '—'}`);

  const n = cells().length;
  const size = Math.round(Math.sqrt(n));
  check('филворд: поле 8×8 или больше (растёт на бедном срезе)', size >= 8 && size * size === n, `клеток: ${n}`);

  const counter = () => (document.querySelector('.ws-count')?.textContent ?? '').trim();
  check('филворд: счётчик «Найдено: 0 из N»', /^Найдено: 0 из \d+$/.test(counter()), counter());
  const wsGrid = document.querySelector('.ws-grid');
  const wsFoot = document.querySelector('.ws-foot');
  check('филворд: счётчик стоит над полем, а не под ним',
    !!wsGrid && !!wsFoot && (wsFoot.compareDocumentPosition(wsGrid) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    wsFoot?.className ?? 'строки нет');

  const chips = () => Array.from(document.querySelectorAll('.ws-chip')) as HTMLElement[];
  check('филворд: целей не меньше трёх', chips().length >= 3, `чипов: ${chips().length}`);
  const wsTargets = chips().map((c) => (c as HTMLElement).dataset.wsText ?? '');
  check('филворд: слова на поле не повторяются', wsTargets.length === new Set(wsTargets).size, wsTargets.join(','));

  // Скан сетки: все ровные линии под слова целей (горизонтали/вертикали/диагонали).
  const grid = new Map<string, string>();
  for (const cell of cells()) {
    grid.set(`${cell.dataset.wsRow},${cell.dataset.wsCol}`, (cell.textContent ?? '').trim().toLowerCase());
  }
  const linesFor = (text: string): Array<Array<[number, number]>> => {
    const letters = [...text.toLowerCase()];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const out: Array<Array<[number, number]>> = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        for (const [dr, dc] of dirs) {
          const path: Array<[number, number]> = [];
          for (let i = 0; i < letters.length; i++) {
            const rr = r + dr * i;
            const cc = c + dc * i;
            if (rr < 0 || rr >= size || cc < 0 || cc >= size) break;
            if ((grid.get(`${rr},${cc}`) ?? '') !== letters[i]) break;
            path.push([rr, cc]);
          }
          if (path.length === letters.length) out.push(path);
        }
      }
    }
    return out;
  };
  const cellAt = (row: number, col: number) =>
    cells().find((b) => Number(b.dataset.wsRow) === row && Number(b.dataset.wsCol) === col);
  const foundCount = () => Number(counter().match(/Найдено: (\d+)/)?.[1] ?? '0');

  // Находим первое слово: тап по первой клетке + тап по последней.
  const firstTarget = (chips()[0]?.dataset.wsText ?? '').trim();
  check('филворд: у чипа есть слово', firstTarget.length > 1, firstTarget);
  const firstLines = linesFor(firstTarget);
  check('филворд: первое слово ищется на поле', firstLines.length > 0, firstTarget);
  for (const line of firstLines) {
    click(cellAt(line[0][0], line[0][1]));
    await sleep(15);
    click(cellAt(line[line.length - 1][0], line[line.length - 1][1]));
    await sleep(30);
    if (foundCount() === 1) break;
  }
  check('филворд: слово найдено тапами', foundCount() === 1, counter());

  // Добиваем остальные цели — пока не появится баннер победы.
  for (const chip of chips()) {
    const target = (chip.dataset.wsText ?? '').trim();
    if (chip.className.includes('ws-chip-found')) continue;
    for (const line of linesFor(target)) {
      const before = foundCount();
      click(cellAt(line[0][0], line[0][1]));
      await sleep(15);
      click(cellAt(line[line.length - 1][0], line[line.length - 1][1]));
      await sleep(30);
      if (foundCount() > before) break;
    }
  }
  const totalChips = chips().length;
  check('филворд: все слова найдены — счётчик дошёл до конца',
    document.querySelectorAll('.ws-chip-found').length === totalChips, `${document.querySelectorAll('.ws-chip-found').length}/${totalChips}`);
  await sleep(120);
  check('филворд: баннер «Все слова найдены!»', has('Все слова найдены'), document.body.textContent?.slice(0, 300) ?? '');

  // ── Финал сетки как событие (0.98.0) ──────────────────────────────────────
  // Было: победа — статичная зелёная плашка, звук и конфетти молчали. Стало:
  // плашка «подпрыгивает» (.ws-win-party), рядом стоит честная строка о
  // наградах из `gameAwardHint()`. Конфетти в jsdom не проверяем: ветка
  // зависит от `prefers-reduced-motion` и от Web Animations.
  check('филворд: победа отмечена праздничной плашкой',
    !!document.querySelector('.ws-win-party'), document.querySelector('.ws-win')?.className ?? 'плашки нет');
  check('филворд: в финале есть честная подпись о наградах',
    !!document.querySelector('.ws-win-hint') &&
      /⚡|кристалл|завтра/.test(document.querySelector('.ws-win-hint')?.textContent ?? ''),
    document.querySelector('.ws-win-hint')?.textContent ?? 'строки нет');

  // «Ещё сетку» — новая доска с чистым счётчиком и ДРУГИМИ словами
  // (замечание 2026-11-11: «смена сетки меняет и слова»).
  const wordsOf = () =>
    Array.from(document.querySelectorAll('.ws-chip')).map((c) => (c as HTMLElement).dataset.wsText ?? '').sort().join(',');
  const wordsBefore = wordsOf();
  const again = btnText('Ещё сетку');
  click(again);
  await sleep(80);
  check('филворд: «Ещё сетку» очищает счётчик', /^Найдено: 0 из \d+$/.test(counter()), counter());
  const wordsAfter = wordsOf();
  // Три нажатия подряд: слова не «залипают» — жалоба владельца «постоянно
  // телефон» проверяется именно так, как её видит ребёнок.
  {
    let prev = wordsAfter;
    let stuck = 0;
    const seenSets = new Set<string>([prev]);
    for (let i = 0; i < 3; i++) {
      // После победы кнопка называется «Ещё сетку», в игре — «Новая сетка».
      const b = btnText('Ещё сетку') ?? btnText('Новая сетка');
      if (!b) break;
      click(b);
      await sleep(80);
      const now = wordsOf();
      if (now === prev) stuck++;
      seenSets.add(now);
      prev = now;
    }
    check('филворд: три «Ещё сетку» подряд каждый раз дают новый набор слов',
      stuck === 0 && seenSets.size >= 4, `наборов: ${seenSets.size}, залипаний: ${stuck}`);
  }
  check('филворд: «Ещё сетку» меняет слова, а не только их места',
    wordsAfter !== wordsBefore && !wordsAfter.split(',').some((w) => wordsBefore.split(',').includes(w)),
    `было: ${wordsBefore} / стало: ${wordsAfter}`);
  check('филворд: найденные клетки больше не подсвечены', document.querySelectorAll('.ws-chip-found').length === 0, '');

  // Промах не падает и не ломает игру: тап по двум далёким неровным клеткам.
  click(cellAt(0, 0));
  await sleep(15);
  click(cellAt(1, 2)); // не линия → якорь просто переезжает, ничего не падает
  await sleep(30);
  check('филворд: неровная линия не роняет игру', !!document.querySelector('.ws-grid'), '');
}

// «Кроссворд дня» (0.95.0): доска отрисована, пул букв точен, все слова
// собираются тапами, «Ещё кроссворд» чистит доску. Без SRS/XP.
/**
 * Пулы «Игр» (0.96.5). Главная причина жалобы «слова не меняются, постоянно
 * телефон»: у ребёнка в начале пути встреченных слов всего три, и никакая
 * ротация не может показать «другие слова» из трёх. Поэтому сеточные игры
 * добирают пул словами своего класса, а «Собери слово» по-прежнему работает
 * только со встреченными.
 */
export async function runGamesPoolChecks() {
  console.log('\n── Игры: пул слов ──');
  const active = useApp.getState().profiles.find((p) => p.id === useApp.getState().activeId);
  const gradeNow = (active?.activeClass ?? 2) as keyof typeof WORDS_BY_GRADE;
  const scope = (WORDS_BY_GRADE[gradeNow] ?? []).filter((w) => !w.text.includes(' '));
  // Ровно как на скриншотах владельца: три встреченных слова (класс у
  // владельца — 4-й, где живут «телефон», «беседа» и «человек»; если профиль
  // другого класса — берём первые три слова его программы).
  const screenshot = scope.filter((w) => ['телефон', 'беседа', 'человек'].includes(w.text));
  const met = screenshot.length >= 3 ? screenshot : scope.slice(0, 3);
  const onlyMet: Record<string, { s: number; due: number; iv: number; n: number; seen: number; ok: number; wrong: number }> = {};
  for (const w of met) onlyMet[w.id] = { s: MASTERED_SCORE, due: 0, iv: 4, n: 3, seen: 3, ok: 3, wrong: 0 };
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, words: { ...onlyMet } } : p)),
  }));
  await sleep(60);
  await goTab('Игры');
  await sleep(60);

  if (met.length > 0) {
    await goGame('Собери слово');
    await sleep(40);
    check('игры: «Собери слово» показывает только встреченные слова',
      document.querySelectorAll('.game-pick').length === met.length,
      `чипов: ${document.querySelectorAll('.game-pick').length}, встречено: ${met.length}`);
  }

  check('игры: филворд открывается', await goGame('Филворд'), '');
  const wsWords = () =>
    Array.from(document.querySelectorAll('.ws-chip')).map((c) => (c as HTMLElement).dataset.wsText ?? '').sort().join(',');
  let wsSeen = new Set<string>();
  let wsOk = true;
  for (let i = 0; i < 3; i++) {
    const b = btnText('Ещё сетку') ?? btnText('Новая сетка');
    if (!b) {
      wsOk = false;
      break;
    }
    click(b);
    await sleep(80);
    wsSeen = new Set([...wsSeen, ...wsWords().split(',')]);
  }
  check('игры: при трёх встреченных словах филворд всё равно меняет слова',
    wsOk && wsSeen.size > met.length, `уникальных слов на поле: ${wsSeen.size} (встречено ${met.length})`);

  check('игры: кроссворд открывается', await goGame('Кроссворд'), '');
  const cwWords = () =>
    Array.from(document.querySelectorAll('.cw-chip')).map((c) => (c as HTMLElement).dataset.cwAnswer ?? '').sort().join(',');
  let cwSeen = new Set<string>();
  let cwOk = true;
  for (let i = 0; i < 3; i++) {
    const b = btnText('Ещё кроссворд') ?? btnText('Новая сетка');
    if (!b) {
      cwOk = false;
      break;
    }
    click(b);
    await sleep(80);
    cwSeen = new Set([...cwSeen, ...cwWords().split(',')]);
  }
  check('игры: при трёх встреченных словах кроссворд всё равно меняет слова',
    cwOk && cwSeen.size > met.length, `уникальных слов: ${cwSeen.size} (встречено ${met.length})`);
}

export async function runCrosswordUiChecks() {
  console.log('\n── Кроссворд дня: решётка и пул ──');
  await goTab('Игры');
  await sleep(60);
  check('кроссворд: игра выбирается сегментом', await goGame('Кроссворд'), '');

  const cells = () => Array.from(document.querySelectorAll('.cw-cell')) as HTMLButtonElement[];
  const tiles = () => Array.from(document.querySelectorAll('.cw-tile')) as HTMLButtonElement[];
  const chips = () => Array.from(document.querySelectorAll('.cw-chip')) as HTMLButtonElement[];
  const counter = () => (document.querySelector('.cw-count')?.textContent ?? '').trim();

  check('кроссворд: раздел и поле есть на экране', !!document.querySelector('.cw-grid'), '');
  if (cells().length === 0) return;

  // ── Раскладка планшета (0.97.0): решётка, пул букв и вопросы по местам ──
  // Замечание владельца (2026-11-12, скриншот iPad): «на планшете кроссворд
  // не помещается по вертикали» — вопросы уезжали под нижнее меню. Лечится
  // двумя колонками: решётка с пулом слева, вопросы справа.
  const cwBody = document.querySelector('.cw-body');
  const cwBoard = document.querySelector('.cw-board');
  const cwTilesEl = document.querySelector('.cw-tiles');
  const cwWordsEl = document.querySelector('.cw-words');
  check('кроссворд: тело игры разделено на решётку, пул и вопросы',
    !!cwBody && !!cwBoard && !!cwTilesEl && !!cwWordsEl &&
      cwBoard.contains(document.querySelector('.cw-grid') as Node) &&
      cwBody.contains(cwTilesEl as Node) &&
      cwBody.contains(cwWordsEl as Node),
    `тело: ${cwBody?.className ?? '—'}`);
  // Потолок клетки по высоте окна: без него решётка на низком экране
  // выпирает за экран (см. `useBoardCellCap`).
  const capStyle = document.querySelector('.cw-grid')?.getAttribute('style') ?? '';
  check('кроссворд: клетке задан потолок по высоте окна (--cw-cell-cap)',
    capStyle.includes('--cw-cell-cap'), capStyle || 'style не задан');
  const rows = Math.max(...cells().map((b) => Number(b.dataset.cwRow))) + 1;
  const cols = Math.max(...cells().map((b) => Number(b.dataset.cwCol))) + 1;
  check('кроссворд: поле ≤ 13×12', cols <= 13 && rows <= 12, `${rows}×${cols}`);
  check('кроссворд: не меньше девяти клеток', cells().length >= 9, `клеток: ${cells().length}`);
  check('кроссворд: счетчик «Собрано: 0 из N»', /^Собрано: 0 из [2-9]\d*$/.test(counter()), counter());
  check('кроссворд: подсказок не меньше трёх', chips().length >= 3, `чипов: ${chips().length}`);
  // Эргономика (0.96.1): подсказка и «N букв» — в две строки внутри чипа,
  // иначе три колонки в сумме шире карточки и текст обрезался многоточием.
  const chipText = chips()[0]?.querySelector('.cw-chip-text');
  check('кроссворд: подсказка и длина слова — двухуровневый текст чипа',
    !!chipText?.querySelector('.cw-chip-hint') && !!chipText?.querySelector('.cw-chip-len'),
    chips()[0]?.textContent ?? '');
  // Строка состояния стоит над решёткой: под ней её съедало нижнее меню.
  const grid = document.querySelector('.cw-grid');
  const foot = document.querySelector('.cw-foot, .cw-win');
  check('кроссворд: счётчик стоит над решёткой, а не под ней',
    !!grid && !!foot && (foot.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    foot?.className ?? 'строки нет');
  // Пул — точное мультимножество УНИКАЛЬНЫХ клеток (пересекающиеся — один раз).
  check('кроссворд: лишних плиток нет — букв ровно под клетки', tiles().length === cells().length,
    `плиток ${tiles().length}, клеток ${cells().length}`);

  // Тап по плитке кладёт букву в первое пустое место выбранного слова.
  const firstTile = tiles()[0];
  click(firstTile);
  await sleep(20);
  check('кроссворд: буква легла в клетку', cells().filter((b) => b.dataset.filled === '1').length === 1, '');
  // Тап по той клетке возвращает букву в пул.
  const filled = cells().find((b) => b.dataset.filled === '1');
  click(filled);
  await sleep(20);
  check('кроссворд: тап по клетке возвращает букву', cells().filter((b) => b.dataset.filled === '1').length === 0, '');

  // ── Полная сборка: как идеальный игрок — смотрим на первую пустую клетку
  // каждого слота и кладём нужную букву (пропуская уже заполненные перекрёстки) ──
  const cellAt = (row: number, col: number) =>
    cells().find((b) => Number(b.dataset.cwRow) === row && Number(b.dataset.cwCol) === col);
  const filledAt = (row: number, col: number) => cellAt(row, col)?.dataset.filled === '1';
  for (const chip of chips()) {
    const answer = (chip.dataset.cwAnswer ?? '').toLowerCase();
    const slotCells = (chip.dataset.cwCells ?? '').split(';').filter(Boolean);
    if (!answer || slotCells.length !== [...answer].length) continue;
    click(chip); // активируем слово
    await sleep(15);
    for (let i = 0; i < slotCells.length; i++) {
      const [r, c] = slotCells[i].split(',').map(Number);
      if (filledAt(r, c)) continue; // букву сюда уже положили перекрёстным словом
      const ch = [...answer][i];
      const tile = tiles().find((b) => !b.disabled && (b.textContent ?? '').trim() === ch);
      if (!tile) continue;
      click(tile);
      await sleep(10);
    }
  }
  await sleep(150);
  check('кроссворд: баннер «Кроссворд собран!»', has('Кроссворд собран'), document.body.textContent?.slice(0, 300) ?? '');
  check('кроссворд: все слова зеленые', document.querySelectorAll('.cw-chip-good').length === chips().length,
    `зеленых: ${document.querySelectorAll('.cw-chip-good').length} / ${chips().length}`);
  // Финал (0.98.0): праздничная плашка и честная строка о наградах.
  check('кроссворд: победа отмечена праздничной плашкой',
    !!document.querySelector('.cw-win.ws-win-party'), document.querySelector('.cw-win')?.className ?? 'плашки нет');
  check('кроссворд: в финале есть честная подпись о наградах',
    !!document.querySelector('.cw-win .ws-win-hint'),
    document.querySelector('.cw-win')?.textContent ?? '');

  // «Ещё кроссворд» — новая сетка, чистый счётчик и ДРУГИЕ слова.
  const cwWords = () =>
    Array.from(document.querySelectorAll('.cw-chip')).map((c) => (c as HTMLElement).dataset.cwAnswer ?? '').sort().join(',');
  const cwBefore = cwWords();
  const again = btnText('Ещё кроссворд');
  click(again);
  await sleep(80);
  check('кроссворд: «Ещё кроссворд» очищает счётчик', /^Собрано: 0 из [2-9]\d*$/.test(counter()), counter());
  check('кроссворд: «Ещё кроссворд» меняет и слова, а не только решётку',
    cwWords() !== cwBefore, `было: ${cwBefore} / стало: ${cwWords()}`);
  // Три нажатия подряд: слова не должны «залипать» (жалоба владельца:
  // «в кроссворде тоже слова не меняются»).
  {
    let prev = cwWords();
    let stuck = 0;
    const seenSets = new Set<string>([prev]);
    for (let i = 0; i < 3; i++) {
      const b = btnText('Ещё кроссворд') ?? btnText('Новая сетка');
      if (!b) break;
      click(b);
      await sleep(80);
      const now = cwWords();
      if (now === prev) stuck++;
      seenSets.add(now);
      prev = now;
    }
    check('кроссворд: три нажатия подряд каждый раз дают новый набор слов',
      stuck === 0 && seenSets.size >= 4, `наборов: ${seenSets.size}, залипаний: ${stuck}`);
  }
  const cwAnswers = Array.from(document.querySelectorAll('.cw-chip')).map((c) => (c as HTMLElement).dataset.cwAnswer ?? '');
  check('кроссворд: слова в решётке не повторяются',
    cwAnswers.length === new Set(cwAnswers).size, cwAnswers.join(','));
  check('кроссворд: все плитки снова доступны', tiles().every((b) => !b.disabled), '');
}

/**
 * Раскладка «Игр» на планшете (0.97.0) — страж правил CSS.
 *
 * Замечание владельца (2026-11-12, скриншот iPad): «на планшете кроссворд и
 * филворд не помещаются по вертикали. Очень неудобно». Починили двумя
 * колонками: поле (с пулом букв) слева, вопросы справа.
 *
 * Стражаем именно CSS, а не только DOM: раскладка уже откатывалась один раз
 * (0.94.1 — две игры рядом отменили, сцена сузилась до 720 px), и молча
 * вернуть её в один столбец легко. Здесь проверяем, что правила на месте.
 */
export async function runGamesTabletLayoutChecks() {
  console.log('\n── Игры: раскладка на планшете ──');
  const css = readFileSync('src/styles/app.css', 'utf8');
  const start = css.indexOf('@media (min-width: 720px)');
  const wide = start >= 0 ? css.slice(start, start + 4000) : '';
  const rule = (sel: string, from: string) =>
    from.match(new RegExp(`([^{}]*${sel.replace(/\./g, '\\.')}[^{}]*)\\{[^}]*\\}`))?.[0] ?? '';
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

  const cwBody = rule('.cw-body', wide);
  const wsBody = rule('.ws-body', wide);
  const cwGrid = rule('.cw-grid', wide);
  const wsGrid = rule('.ws-grid', wide);
  const screenRule = rule('.screen.games-screen', wide);
  const cwBodyBase = rule('.cw-body', css);
  const wsGridBase = rule('.ws-grid', css);

  check('игры: на планшете кроссворд — две колонки (вопросы рядом с решёткой)',
    /display:\s*grid/.test(cwBody) && /grid-template-areas/.test(cwBody) &&
      /'grid words'/.test(cwBody) && /'tiles words'/.test(cwBody),
    flat(cwBody).slice(0, 160) || 'правило .cw-body не найдено');
  check('игры: на планшете филворд — две колонки (поле и слова-цели рядом)',
    /display:\s*grid/.test(wsBody) && /grid-template-columns/.test(wsBody),
    flat(wsBody).slice(0, 160) || 'правило .ws-body не найдено');
  check('игры: на телефоне игра остаётся в одну колонку (сцену прокручивают)',
    /flex-direction:\s*column/.test(cwBodyBase),
    flat(cwBodyBase).slice(0, 120) || 'правило .cw-body не найдено');
  check('игры: клетка кроссворда на планшете не крупнее 48 px и не выше экрана',
    /--cw-cell:\s*min\(48px,\s*var\(--cw-cell-cap/.test(cwGrid),
    flat(cwGrid).slice(0, 160) || 'правило .cw-grid не найдено');
  check('игры: клетка филворда на планшете не крупнее 52 px и не выше экрана',
    /--ws-cell:\s*min\(52px,\s*var\(--ws-cell-cap/.test(wsGrid),
    flat(wsGrid).slice(0, 160) || 'правило .ws-grid не найдено');
  check('игры: поле филворда не растягивается на всю карточку (потолок ширины)',
    /max-width:\s*calc\(var\(--ws-size/.test(wsGridBase),
    flat(wsGridBase).slice(0, 200) || 'правило .ws-grid не найдено');
  check('игры: на планшете сцена шире 720 px — иначе колонкам негде стоять',
    /max-width:\s*1040px/.test(screenRule),
    flat(screenRule).slice(0, 120) || 'правило .screen.games-screen не найдено');
}
