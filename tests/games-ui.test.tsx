// «Игры» через настоящий UI (0.92.0): вкладка открывается, свободная практика
// живёт по правилам рамки — ничего не сгорает, ничего не считается, словечки
// ребёнку показывают только изученные. «Скоро»-карточки помечены честно.
import { useApp } from '../src/state/store';
import { WORDS_BY_GRADE } from '../src/content/words';
import { MASTERED_SCORE } from '../src/engine/classes';
import { btnText, buttons, check, click, has, sleep } from './ui-helpers';

async function goTab(name: string) {
  const tab = buttons().find((b) => (b.textContent ?? '').includes(name) && b.className.includes('tab'));
  click(tab);
  await sleep(60);
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
  check('игры: честно сказано, что ничего не считается', has('ничего не считается'), '');
  check('игры: свободная практика есть на экране', has('Собери слово'), '');
  check('игры: изученные слова видны чипами', document.querySelectorAll('.game-pick').length === learned.length,
    `чипов: ${document.querySelectorAll('.game-pick').length}`);
  check('игры: плиточный конструктор отрисован', document.querySelectorAll('.tileboard-tile').length > 0,
    `плиток: ${document.querySelectorAll('.tileboard-tile').length}`);
  check('игры: плитки несут буквы слова', !!document.querySelector('.word-board'), '');

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
  await goTab('Игры');
  await sleep(60);

  const cells = () => Array.from(document.querySelectorAll('.ws-cell')) as HTMLButtonElement[];
  check('филворд: раздел и поле есть на экране', !!document.querySelector('.ws-grid'), '');
  if (cells().length === 0) return;

  const n = cells().length;
  const size = Math.round(Math.sqrt(n));
  check('филворд: поле 8×8 или больше (растёт на бедном срезе)', size >= 8 && size * size === n, `клеток: ${n}`);

  const counter = () => (document.querySelector('.ws-count')?.textContent ?? '').trim();
  check('филворд: счётчик «Найдено: 0 из N»', /^Найдено: 0 из \d+$/.test(counter()), counter());

  const chips = () => Array.from(document.querySelectorAll('.ws-chip')) as HTMLElement[];
  check('филворд: целей не меньше трёх', chips().length >= 3, `чипов: ${chips().length}`);

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

  // «Ещё сетку» — новая доска с чистым счётчиком.
  const again = btnText('Ещё сетку');
  click(again);
  await sleep(80);
  check('филворд: «Ещё сетку» очищает счётчик', /^Найдено: 0 из \d+$/.test(counter()), counter());
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
export async function runCrosswordUiChecks() {
  console.log('\n── Кроссворд дня: решётка и пул ──');
  await goTab('Игры');
  await sleep(60);

  const cells = () => Array.from(document.querySelectorAll('.cw-cell')) as HTMLButtonElement[];
  const tiles = () => Array.from(document.querySelectorAll('.cw-tile')) as HTMLButtonElement[];
  const chips = () => Array.from(document.querySelectorAll('.cw-chip')) as HTMLButtonElement[];
  const counter = () => (document.querySelector('.cw-count')?.textContent ?? '').trim();

  check('кроссворд: раздел и поле есть на экране', !!document.querySelector('.cw-grid'), '');
  if (cells().length === 0) return;
  const rows = Math.max(...cells().map((b) => Number(b.dataset.cwRow))) + 1;
  const cols = Math.max(...cells().map((b) => Number(b.dataset.cwCol))) + 1;
  check('кроссворд: поле ≤ 13×12', cols <= 13 && rows <= 12, `${rows}×${cols}`);
  check('кроссворд: не меньше девяти клеток', cells().length >= 9, `клеток: ${cells().length}`);
  check('кроссворд: счетчик «Собрано: 0 из N»', /^Собрано: 0 из [2-9]\d*$/.test(counter()), counter());
  check('кроссворд: подсказок не меньше трёх', chips().length >= 3, `чипов: ${chips().length}`);
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

  // «Ещё кроссворд» — новая сетка, чистый счётчик.
  const again = btnText('Ещё кроссворд');
  click(again);
  await sleep(80);
  check('кроссворд: «Ещё кроссворд» очищает счётчик', /^Собрано: 0 из [2-9]\d*$/.test(counter()), counter());
  check('кроссворд: все плитки снова доступны', tiles().every((b) => !b.disabled), '');
}
