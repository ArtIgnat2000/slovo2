// «Карточки букв»: плиточный движок сборки слова (0.92.0).
// Чистые функции — без DOM; живое задание — на экране.
import './setup';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { WordTileBoard, boardColumns } from '../src/ui/WordTileBoard';
import {
  dropSlotAt,
  firstEmpty,
  isFull,
  joined,
  placeFromTray,
  placeInFirstEmpty,
  returnToTray,
  shuffledTiles,
  swapSlots,
  type BoardState,
} from '../src/engine/word-board';
import { WORDS } from '../src/content/words';
import { check, click, sleep } from './ui-helpers';

const frozen = () => WORDS.find((w) => w.text === 'мороз')!;

const printable = (s: BoardState) => joined(s.slots) + '|' + s.tray.map((t) => t.ch).join('');

export async function runWordBoardChecks(): Promise<void> {
  console.log('\n── Карточки букв: сборка из плиток ──');

  // ── 1. Чистые функции ───────────────────────────────────────────────────
  const word = frozen();
  const state: BoardState = {
    tray: [
      { id: 0, ch: 'м' }, { id: 1, ch: 'о' }, { id: 2, ch: 'р' },
      { id: 3, ch: 'о' }, { id: 4, ch: 'з' },
    ],
    slots: Array(5).fill(null),
  };
  check('движок: лунки пусты, свободных пять', firstEmpty(state.slots) === 0, '');
  const afterFirst = placeInFirstEmpty(state, 0);
  check('движок: тап ставит плитку в первую пустую лунку',
    afterFirst.slots[0]?.ch === 'м' && afterFirst.tray.length === 4, printable(afterFirst));
  const built: typeof state.slots = [
    { id: 0, ch: 'м' }, { id: 1, ch: 'о' }, { id: 2, ch: 'р' }, { id: 3, ch: 'о' }, { id: 4, ch: 'з' },
  ];
  check('движок: isFull собранного ряда', isFull(built), '');
  check('движок: joined собранного ряда — то, что было выложено', joined(built) === 'мороз', joined(built));

  // обмен лотка и лунки
  const two = placeInFirstEmpty(placeInFirstEmpty(state, 0), 1);
  const swapped = placeFromTray(two, 2, 0);
  check('движок: бросок на занятую лунку — обмен (из лунки обратно в лоток)',
    swapped.slots[0]?.ch === 'р' && swapped.tray.some((t) => t.ch === 'м'), printable(swapped));

  // лунка ↔ лунка
  const slotted: BoardState = {
    ...two,
    slots: [two.slots[0], two.slots[1], null, null, null],
  };
  const swappedSlots = swapSlots(slotted, 0, 1);
  check('движок: обмен двух лунок меняет буквы местами',
    swappedSlots.slots[0]?.ch === 'о' && swappedSlots.slots[1]?.ch === 'м', printable(swappedSlots));

  // возврат в лоток
  const returned = returnToTray(slotted, 0);
  check('движок: возврат лунки в лоток оставляет лунку пустой',
    returned.slots[0] === null && returned.tray.some((t) => t.ch === 'м'), printable(returned));

  // геометрия броска
  const boxes = [
    { left: 10, width: 60, top: 0, height: 60 },
    { left: 80, width: 60, top: 0, height: 60 },
    { left: 150, width: 60, top: 0, height: 60 },
  ];
  check('движок: бросок на середину лунки попадает в неё', dropSlotAt(115, 30, boxes) === 1, String(dropSlotAt(115, 30, boxes)));
  check('движок: бросок левее первой лунки — мимо', dropSlotAt(-100, 30, boxes) === null, String(dropSlotAt(-100, 30, boxes)));
  check('движок: бросок далеко по вертикали — мимо', dropSlotAt(115, 500, boxes) === null, String(dropSlotAt(115, 500, boxes)));

  const scrambled = shuffledTiles('мороз');
  check('движок: перемешка сохраняет мультимножество букв',
    [...scrambled.map((t) => t.ch)].sort().join('') === 'морзо'.split('').sort().join(''),
    scrambled.map((t) => t.ch).join(''),
  );

  // ── 2. Живая свободная игра: собрать слово тапами ───────────────────────
  const box = document.createElement('div');
  document.body.appendChild(box);
  const root = createRoot(box);
  root.render(createElement(WordTileBoard, { word, unscored: true }));
  await sleep(60);

  const needed = word.text.split('');
  for (const ch of needed) {
    const btn = Array.from(box.querySelectorAll('.tileboard-tile')).find(
      (b) => (b.textContent ?? '').trim() === ch && !(b as HTMLButtonElement).disabled,
    ) as HTMLButtonElement | undefined;
    if (!btn) throw new Error(`нет плитки «${ch}» в лотке`);
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(15);
  }
  await sleep(80);
  const banner = box.querySelector('.tileboard-banner') as HTMLElement | null;
  check('игра: после сборки слова появляется «Слово собрано!»', !!banner && (banner.textContent ?? '').includes('Слово собрано'), banner?.textContent ?? 'баннер не показан');
  check('игра: «Опасная буква» показана после сборки (учим орфограмму)',
    !!banner && (banner.textContent ?? '').includes('Оранжевым'), banner?.textContent ?? '');
  const filled = box.querySelectorAll('.tileboard-slot.filled').length;
  check('игра: все лунки заполнены нужными буквами', filled === word.text.length, `заполнено: ${filled}`);
  root.unmount();
  box.remove();

  // ── 3. Раскладка доски на телефоне (0.96.0) ─────────────────────────────
  // Слово из 10–17 букв раньше уезжало за экран: плитки были фиксированной
  // ширины, а перенос строк «как получится». Теперь колонок ровно столько,
  // сколько нужно, и каждая строка полная.
  check('доска: короткое слово — все буквы в одну строку', boardColumns(5) === 5, String(boardColumns(5)));
  check('доска: 7 букв — ещё одна строка', boardColumns(7) === 7, String(boardColumns(7)));
  const ten = boardColumns(10);
  check('доска: 10 букв — две полные строки по 5', ten === 5 && 10 % ten === 0, String(ten));
  for (let n = 8; n <= 17; n++) {
    const cols = boardColumns(n);
    const rows = Math.ceil(n / cols);
    const inLast = n - (rows - 1) * cols;
    // «Сирот» быть не должно: в последнем ряду минимум 4 плитки, а рядов —
    // не больше, чем нужно самой компактной раскладке.
    const minRows = Math.ceil(n / 7);
    const full = inLast >= 4;
    check(`доска: ${n} букв — ${cols} колонок, ряд без «сирот»`,
      cols >= 4 && cols <= 7 && full && rows === minRows, `${cols}×${rows}, в ряду ${inLast}`);
  }
  check('доска: колонки не больше 7 (плитка остаётся пальцевой)', boardColumns(40) <= 7, String(boardColumns(40)));

  // Живая доска длинного слова: убранная буква оставляет пустое место, а не
  // сдвигает лоток — иначе ребёнок «теряет» плитки из-под пальца.
  const longWord = WORDS.find((w) => w.text.length === 10 && !w.text.includes(' '))!;
  const box2 = document.createElement('div');
  document.body.appendChild(box2);
  const root2 = createRoot(box2);
  root2.render(createElement(WordTileBoard, { word: longWord, unscored: true }));
  await sleep(60);
  const before = box2.querySelectorAll('.tileboard-tile').length;
  const style = (box2.querySelector('.word-board') as HTMLElement | null)?.getAttribute('style') ?? '';
  check('доска: длинное слово задаёт число колонок доске', style.includes('--slot-cols'), style);
  const firstTile = box2.querySelector('.tileboard-tile') as HTMLButtonElement | null;
  click(firstTile);
  await sleep(30);
  check('доска: убранная из лотка плитка оставляет место (не сдвигает остальные)',
    box2.querySelectorAll('.tileboard-gap').length === 1,
    `дырок: ${box2.querySelectorAll('.tileboard-gap').length}, плиток было ${before}`);
  root2.unmount();
  box2.remove();
}
