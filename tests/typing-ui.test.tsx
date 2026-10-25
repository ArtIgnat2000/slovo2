// Письмо слов с «ё» (0.64.0).
//
// Отклик с телефона: «на ряде слов с буквой Ё выяснилось, что этой буквы нет
// на виртуальной клавиатуре». Клавиша «ё» в раскладке есть, но дети её не
// находят (а в системных клавиатурах она бывает спрятана под долгим нажатием).
// Поэтому в заданиях «напиши слово» и «зрительный диктант» буква «е» вместо
// «ё» засчитывается как верный ответ. Обратная замена — нет: «учёник» остаётся
// ошибкой.
//
// Здесь два стража:
//  1) любое слово банка можно набрать на экранной клавиатуре (чтобы «ё» снова
//     не пропала из раскладки незаметно);
//  2) живое задание принимает «береза» за «берёза» и показывает «✓».
import './setup';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TaskView } from '../src/ui/TaskView';
import { KEYBOARD_ROWS } from '../src/ui/Keyboard';
import { makeTask } from '../src/engine/scheduler';
import { sameTypedWord } from '../src/engine/word-facts';
import { WORDS } from '../src/content/words';
import { check, sleep } from './ui-helpers';

/** Все клавиши-буквы раскладки (без «⌫»). */
const KEYBOARD_LETTERS = new Set(KEYBOARD_ROWS.flat().filter((k) => k !== '⌫'));

/** Набрать слово на экранной клавиатуре внутри конкретного контейнера. */
function type(box: HTMLElement, text: string) {
  for (const ch of text) {
    const key = Array.from(box.querySelectorAll('.key')).find(
      (b) => (b.textContent ?? '').trim() === ch,
    ) as HTMLButtonElement | undefined;
    if (!key) throw new Error(`на клавиатуре нет буквы «${ch}»`);
    key.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
}

function submit(box: HTMLElement) {
  const btn = Array.from(box.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes('Проверить'),
  ) as HTMLButtonElement | undefined;
  if (!btn) throw new Error('нет кнопки «Проверить»');
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

export async function runTypingChecks(): Promise<void> {
  console.log('\n── Письмо: «е» вместо «ё» ──');

  // ── 1. Инвариант: на клавиатуре есть все буквы, которые встречаются в банке ──
  const missing = new Map<string, string[]>();
  for (const w of WORDS) {
    for (const ch of w.text.toLowerCase()) {
      if (ch === ' ' || ch === '-') continue;
      if (KEYBOARD_LETTERS.has(ch)) continue;
      missing.set(ch, [...(missing.get(ch) ?? []), w.text]);
    }
  }
  check(
    'клавиатура: все буквы слов банка есть в раскладке',
    missing.size === 0,
    [...missing].map(([ch, words]) => `«${ch}»: ${words.slice(0, 3).join(', ')}`).join(' | '),
  );
  check(
    'клавиатура: клавиша «ё» есть и доступна (слова с ё решаемы)',
    KEYBOARD_LETTERS.has('ё'),
    [...KEYBOARD_LETTERS].join(''),
  );

  // ── 2. Правило сравнения: «е» за «ё» — да, «ё» за «е» — нет ────────────────
  check('ввод: «береза» засчитывается за «берёза»', sameTypedWord('береза', 'берёза'));
  check('ввод: «Берёза» с заглавной и пробелами тоже верна', sameTypedWord(' Берёза ', 'берёза'));
  check('ввод: «ученик» остаётся верным', sameTypedWord('ученик', 'ученик'));
  check(
    'ввод: «учёник» НЕ засчитывается за «ученик» (лишняя ё — ошибка)',
    !sameTypedWord('учёник', 'ученик'),
  );

  // ── 3. Живое задание «Напиши слово»: е вместо ё даёт «✓» ───────────────────
  const word = WORDS.find((w) => w.text === 'берёза');
  if (!word) {
    check('ввод: слово «берёза» есть в банке', false, 'не нашли слово для проверки');
    return;
  }
  const box = document.createElement('div');
  document.body.appendChild(box);
  const root = createRoot(box);
  let solved: number | null | undefined;
  root.render(
    createElement(TaskView, {
      task: makeTask('write', word.id, 'review', word.danger[0] ?? 0),
      word,
      onSolve: (quality) => {
        solved = quality;
      },
    }),
  );
  await sleep(60);
  type(box, 'береза');
  await sleep(20);
  submit(box);
  await sleep(40);
  const typed = box.querySelector('.typed') as HTMLElement | null;
  check(
    'ввод: в задании «Напиши слово» набранное «береза» помечается верным',
    !!typed && typed.className.includes('ok'),
    typed?.className ?? box.querySelector('.task')?.className ?? '—',
  );
  await sleep(800);
  check(
    'ввод: за «береза» начисляется полный балл (5), а не «ошибка»',
    solved === 5,
    String(solved),
  );
  root.unmount();
  box.remove();
}
