// Картинка в уроке (замечание 2026-10-07: «картинка в уроке на айфоне очень
// маленькая»). Блок стережёт две вещи сразу:
//
//   1) «Знакомство» собрано как «фотокарточка» с резиновым снимком — он забирает
//      всю высоту, оставшуюся от слова, слогов, примера и кнопок;
//   2) экран урока при этом по-прежнему не прокручивается (100svh + overflow:
//      hidden), то есть картинка не может вытолкнуть кнопку за край.
//
// Геометрию jsdom не считает, поэтому проверяем контракт: классы и структуру в
// живом DOM плюс сами правила в app.css / tokens.css (тот же приём, что в
// tests/puzzles-ui.test.tsx — «страж от отката прямо в стилях»).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TaskView } from '../src/ui/TaskView';
import { makeTask } from '../src/engine/scheduler';
import { WORDS } from '../src/content/words';
import { btnText, buttons, check, click, sleep } from './ui-helpers';

async function toHome() {
  const exit = buttons().find((b) => b.getAttribute('aria-label') === 'Выйти из урока');
  if (exit) {
    click(exit);
    await sleep(60);
    if ((document.body.textContent ?? '').includes('Выйти из урока?')) {
      click(btnText('Выйти'));
      await sleep(80);
    }
  }
  const home = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  if (home) click(home);
  await sleep(80);
}

async function startLesson(): Promise<boolean> {
  await toHome();
  const start =
    (document.querySelector('.node-btn.current') as HTMLButtonElement | null) ??
    (document.querySelector('.node-btn') as HTMLButtonElement | null);
  if (!start) return false;
  click(start);
  await sleep(90);
  return !!document.querySelector('.task');
}

/** Листать урок, пока не покажется задание с картинкой-подсказкой (.clue). */
async function toClueCard(maxSteps = 12): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    if (document.querySelector('.clue')) return true;
    if (btnText('Далее')) {
      click(btnText('Далее')!);
      await sleep(60);
      continue;
    }
    if (btnText('Запомнил')) {
      click(btnText('Запомнил')!);
      await sleep(60);
      continue;
    }
    const syllable = buttons().find((b) => b.className.includes('syllable') && !b.disabled);
    if (syllable) {
      click(syllable);
      await sleep(80);
      continue;
    }
    const option = document.querySelector('.option:not([disabled])');
    if (option) {
      click(option);
      await sleep(1400);
      continue;
    }
    return false;
  }
  return !!document.querySelector('.clue');
}

export async function runLessonArtChecks() {
  console.log('\n── Картинка в уроке: крупный снимок без прокрутки ──');

  // ── 1. Знакомство ────────────────────────────────────────────────────────
  // Карточку знакомства рендерим напрямую: в живом уроке она появляется только
  // у новых слов, а у «обкатанного» в предыдущих блоках профиля их может
  // не остаться — проверка превращалась бы в рулетку.
  const box = document.createElement('div');
  document.body.appendChild(box);
  const root = createRoot(box);
  const word = WORDS.find((w) => w.image) ?? WORDS[0];
  root.render(
    createElement(TaskView, {
      task: makeTask('intro', word.id, 'new', word.danger[0] ?? 0),
      word,
      onSolve: () => {},
    }),
  );
  await sleep(60);

  const card = box.querySelector('.task-intro .wcard') as HTMLElement | null;
  check('картинка: знакомство — карточка слова', !!card, box.querySelector('.task')?.className ?? '—');
  if (card) {
    check(
      'картинка: знакомство собрано «фотокарточкой», а не компактной полкой',
      card.classList.contains('wcard-photo') && card.classList.contains('lesson-intro-card') && !card.classList.contains('wcard-split'),
      card.className,
    );
    const art = Array.from(card.children).find((el) => el.classList.contains('word-art-frame')) as HTMLElement | undefined;
    check(
      'картинка: снимок — прямой блок карточки (его высоту задаёт flex)',
      !!art && art.classList.contains('word-art-fill') && art.classList.contains('wcard-art'),
      art?.className ?? '—',
    );
    check(
      'картинка: размер больше не прибит числом (76px) в разметке',
      !!art && !/^\d+px$/.test(art.style.getPropertyValue('--art-size').trim()),
      art?.getAttribute('style') ?? '—',
    );
    check(
      'картинка: в знакомстве остались слово, слоги и пример',
      !!card.querySelector('.word-big') && !!card.querySelector('.intro-syllables') && !!card.querySelector('.sentence'),
      card.textContent?.slice(0, 80) ?? '',
    );
    check(
      'картинка: кнопка «Запомнил» на месте',
      !!Array.from(box.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Запомнил')),
      '',
    );
  }
  root.unmount();
  box.remove();

  // ── 2. Подсказка в заданиях с клавиатурой ────────────────────────────────
  const opened = await startLesson();
  check('картинка: урок открылся', opened, document.body.textContent?.slice(0, 160) ?? '');
  const reachedClue = opened && (await toClueCard());
  check('картинка: дошли до задания с подсказкой', reachedClue, document.querySelector('.task')?.className ?? '—');
  if (reachedClue) {
    const clueArt = document.querySelector('.clue .word-art-frame') as HTMLElement | null;
    check(
      'картинка: подсказка растёт от высоты экрана (--art-clue), а не 56px',
      clueArt?.style.getPropertyValue('--art-size').trim() === 'var(--art-clue)',
      clueArt?.getAttribute('style') ?? '—',
    );
  }
  await toHome();

  // ── 3. Стили: страж от отката ────────────────────────────────────────────
  const css = readFileSync('src/styles/app.css', 'utf8');
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');

  const lessonRule = css.match(/\.lesson-screen\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'картинка: экран урока по-прежнему без прокрутки (svh + overflow: hidden)',
    /overflow:\s*hidden/.test(lessonRule) && /100svh/.test(lessonRule),
    lessonRule.replace(/\s+/g, ' ').slice(0, 120) || 'правило .lesson-screen не найдено',
  );

  const artRule = css.match(/\.lesson-intro-card\.wcard-photo\s*>\s*\.wcard-art\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'картинка: снимок знакомства — во всю ширину карточки и квадратный',
    /width:\s*min\(100%,\s*var\(--art-lesson-cap\)\)/.test(artRule) && /aspect-ratio:\s*1/.test(artRule),
    artRule.replace(/\s+/g, ' ') || 'правило снимка не найдено',
  );
  check(
    'картинка: на коротком экране снимок сжимается сам (пол + flex-shrink)',
    /min-height:\s*var\(--art-lesson-min\)/.test(artRule) && /flex:\s*0\s+1\s+auto/.test(artRule),
    artRule.replace(/\s+/g, ' ') || 'правило снимка не найдено',
  );
  check(
    'картинка: карточка знакомства сама занимает высоту задания',
    /\.lesson-intro-card\.wcard-photo\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*min-height:\s*0/.test(css),
    css.match(/\.lesson-intro-card\.wcard-photo\s*\{[^}]*\}/)?.[0]?.replace(/\s+/g, ' ') ?? 'правило карточки не найдено',
  );
  check(
    'картинка: токены размеров заданы (--art-lesson-cap / --art-lesson-min / --art-clue)',
    /--art-lesson-cap:\s*calc\(min\(100vw/.test(tokens) &&
      /--art-lesson-min:/.test(tokens) &&
      /--art-clue:\s*clamp\(56px,[^;]*svh/.test(tokens),
    tokens.match(/--art-lesson-cap:[^;]*;/)?.[0] ?? 'токены не найдены',
  );
}
