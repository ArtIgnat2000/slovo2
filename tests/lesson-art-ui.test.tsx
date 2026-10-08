// Картинка в уроке: страж от регрессии «широкая рамка, маленький рисунок».
// Раньше flex-shrink сжимал только высоту фотокарточки, оставляя ширину полной;
// object-fit: contain ужимал квадратную иллюстрацию в узкую полоску.
// Теперь картинка получает общий адаптивный размер по ширине И высоте, остаётся
// квадратной, а на коротких экранах размер уменьшается заранее.
//
// Геометрию jsdom не считает, поэтому проверяем контракт: классы и структуру в
// живом DOM плюс правила в app.css / tokens.css (тот же приём, что в
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
    // У зрительного диктанта сначала несколько секунд видны только слово и
    // таймер; после фазы запоминания появится обычная подсказка с картинкой.
    if (document.querySelector('.task-visual')) {
      await sleep(4200);
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

  // Режим «Повторение» открывается той же фотокарточкой, но как напоминание:
  // слово уже знакомо, поэтому кнопка приглашает вспомнить (замечание с айфона
  // 2026-10-07: повторение встречало слово старой компактной подсказкой).
  root.render(
    createElement(TaskView, {
      task: makeTask('intro', word.id, 'review', word.danger[0] ?? 0),
      word,
      onSolve: () => {},
    }),
  );
  await sleep(60);
  const reminder = box.querySelector('.task-intro .wcard') as HTMLElement | null;
  check(
    'картинка: напоминание в повторении — та же «фотокарточка»',
    !!reminder && reminder.classList.contains('wcard-photo') && reminder.classList.contains('lesson-intro-card'),
    reminder?.className ?? '—',
  );
  check(
    'картинка: у напоминания кнопка «Вспомнил», а не «Запомнил»',
    !!Array.from(box.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Вспомнил')) &&
      !Array.from(box.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Запомнил')),
    Array.from(box.querySelectorAll('button')).map((b) => b.textContent).join(' | '),
  );
  check(
    'картинка: на напоминании остались слово, слоги и пример',
    !!reminder?.querySelector('.word-big') && !!reminder.querySelector('.intro-syllables') && !!reminder.querySelector('.sentence'),
    reminder?.textContent?.slice(0, 80) ?? '',
  );

  // Пользователь прислал именно «Собери слово», а не знакомство: проверяем эту
  // карточку напрямую, чтобы тест не проходил только за счёт большого intro.
  root.render(
    createElement(TaskView, {
      task: makeTask('build', word.id, 'practice', word.danger[0] ?? 0),
      word,
      onSolve: () => {},
    }),
  );
  await sleep(60);
  const buildClue = box.querySelector('.task-build .clue') as HTMLElement | null;
  const buildArt = buildClue?.querySelector('.word-art-frame') as HTMLElement | null;
  check(
    'картинка: «Собери слово» использует вертикальную hero-карточку',
    !!buildClue?.classList.contains('clue-hero'),
    buildClue?.className ?? '—',
  );
  check(
    'картинка: в упражнении задан отдельный крупный размер --art-clue-hero',
    buildArt?.style.getPropertyValue('--art-size').trim() === 'var(--art-clue-hero)',
    buildArt?.getAttribute('style') ?? '—',
  );

  // «Напиши слово» — второй шаг повторения (замечание с айфона 2026-10-07:
  // после крупной фотокарточки снимок в упражнении снова выглядел иконкой).
  // Компоновка здесь горизонтальная — снизу клавиатура, — но размер снимка
  // больше не прибит числом: его считает flex от остатка высоты задания.
  root.render(
    createElement(TaskView, {
      task: makeTask('write', word.id, 'review', word.danger[0] ?? 0),
      word,
      onSolve: () => {},
    }),
  );
  await sleep(60);
  const writeClue = box.querySelector('.task-write .clue') as HTMLElement | null;
  const writeArt = writeClue?.querySelector('.word-art-frame') as HTMLElement | null;
  check(
    'картинка: «Напиши слово» оставляет подсказку слева от примера (снизу клавиатура)',
    !!writeClue && !writeClue.classList.contains('clue-hero'),
    writeClue?.className ?? '—',
  );
  check(
    'картинка: «Напиши слово» берёт потолок --art-clue, а не число пикселей',
    writeArt?.style.getPropertyValue('--art-size').trim() === 'var(--art-clue)',
    writeArt?.getAttribute('style') ?? '—',
  );
  check(
    'картинка: в «Напиши слово» остались пример и подпись про длину слова',
    !!writeClue?.querySelector('.sentence') && !!writeClue?.querySelector('.clue-hint'),
    writeClue?.textContent?.slice(0, 80) ?? '—',
  );

  root.unmount();
  box.remove();

  // ── 2. Подсказка в живом уроке ───────────────────────────────────────────
  const opened = await startLesson();
  check('картинка: урок открылся', opened, document.body.textContent?.slice(0, 160) ?? '');
  const reachedClue = opened && (await toClueCard());
  check('картинка: дошли до задания с подсказкой', reachedClue, document.querySelector('.task')?.className ?? '—');
  if (reachedClue) {
    const clue = document.querySelector('.clue') as HTMLElement | null;
    const clueArt = clue?.querySelector('.word-art-frame') as HTMLElement | null;
    const expectedSize = clue?.classList.contains('clue-hero')
      ? 'var(--art-clue-hero)'
      : 'var(--art-clue)';
    check(
      'картинка: упражнение берёт адаптивный размер своей компоновки',
      clueArt?.style.getPropertyValue('--art-size').trim() === expectedSize,
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
    'картинка: фотокарточка сохраняет квадрат (один адаптивный размер по ширине и высоте)',
    /width:\s*min\(100%,\s*var\(--art-lesson-size\)\)/.test(artRule) &&
      /height:\s*var\(--art-lesson-size\)/.test(artRule) &&
      /aspect-ratio:\s*1/.test(artRule),
    artRule.replace(/\s+/g, ' ') || 'правило снимка не найдено',
  );
  check(
    'картинка: flex не сплющивает изображение по одной только высоте',
    /flex:\s*0\s+0\s+var\(--art-lesson-size\)/.test(artRule),
    artRule.replace(/\s+/g, ' ') || 'правило снимка не найдено',
  );
  const shortScreenRule = css.match(/@media\s*\(max-height:\s*680px\)\s*\{\s*:root\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'картинка: на коротком экране квадрат уменьшается заранее, а не сжимается в полоску',
    /--art-lesson-size:\s*min\(var\(--art-lesson-cap\),\s*34svh\)/.test(shortScreenRule),
    shortScreenRule.replace(/\s+/g, ' ') || 'правило короткого экрана не найдено',
  );
  check(
    'картинка: карточка знакомства сама занимает высоту задания',
    /\.lesson-intro-card\.wcard-photo\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*min-height:\s*0/.test(css),
    css.match(/\.lesson-intro-card\.wcard-photo\s*\{[^}]*\}/)?.[0]?.replace(/\s+/g, ' ') ?? 'правило карточки не найдено',
  );
  const heroRule = css.match(/\.clue-hero\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'картинка: hero-подсказка ставит изображение над текстом',
    /flex-direction:\s*column/.test(heroRule) && /width:\s*min\(100%,\s*400px\)/.test(heroRule),
    heroRule.replace(/\s+/g, ' ') || 'правило .clue-hero не найдено',
  );
  check(
    'картинка: токены ограничивают квадрат по ширине и высоте viewport',
    /--art-lesson-cap:\s*calc\(min\(100vw,\s*var\(--screen-max\)\)\s*-\s*60px\)/.test(tokens) &&
      /--art-lesson-size:\s*min\(var\(--art-lesson-cap\),\s*40svh\)/.test(tokens),
    tokens.match(/--art-lesson-(?:cap|size):[^;]*;/g)?.join(' · ') ?? 'токены не найдены',
  );
  check(
    'картинка: токены подсказок задают потолок, а не прибитый размер',
    /--art-clue:\s*clamp\(104px,[^;]*svh/.test(tokens) &&
      /--art-clue-hero:\s*clamp\(128px,[^;]*svh/.test(tokens),
    tokens.match(/--art-clue(?:-hero)?:[^;]*;/g)?.join(' · ') ?? 'токены не найдены',
  );
  check(
    'картинка: на коротком экране потолок подсказки под клавиатурой снижается',
    /--art-clue:\s*104px/.test(shortScreenRule),
    shortScreenRule.replace(/\s+/g, ' ') || 'правило короткого экрана не найдено',
  );

  // ── 4. Подсказка в упражнении: размер считает flex, а не число ────────────
  // Замечание с айфона 2026-10-07 (повтор 26): после крупной фотокарточки
  // снимок во втором шаге («Напиши слово») снова читался иконкой — плита была
  // прибита к 144px, а flex к тому же мог сплющить hero-снимок в полоску.
  const clueRowRule =
    css.match(/\.lesson-screen \.task-write > \.clue,[^{]*\{[^}]*\}/)?.[0] ?? '';
  check(
    'картинка: строка подсказки под клавиатурой забирает остаток высоты задания',
    /flex:\s*1\s+1\s+auto/.test(clueRowRule) && /min-height:\s*0/.test(clueRowRule),
    clueRowRule.replace(/\s+/g, ' ') || 'правило строки подсказки не найдено',
  );
  const clueArtRule =
    css.match(/\.lesson-screen \.task-write > \.clue > \.word-art-frame,[^{]*\{[^}]*\}/)?.[0] ?? '';
  check(
    'картинка: снимок под клавиатурой тянется на эту высоту и держит квадрат',
    /align-self:\s*stretch/.test(clueArtRule) &&
      /height:\s*auto/.test(clueArtRule) &&
      /aspect-ratio:\s*1/.test(clueArtRule),
    clueArtRule.replace(/\s+/g, ' ') || 'правило снимка подсказки не найдено',
  );
  check(
    'картинка: размер снимка под клавиатурой ограничен токеном, а не числом',
    /max-height:\s*var\(--art-clue\)/.test(clueArtRule) && !/\b\d+px\s*;/.test(clueArtRule.replace(/min-height:[^;]*;/, '')),
    clueArtRule.replace(/\s+/g, ' ') || 'правило снимка подсказки не найдено',
  );
  const lessonHeroArtRule =
    css.match(/\.lesson-screen \.clue-hero\s*>\s*\.word-art-frame\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'картинка: hero-снимок не сплющивается по высоте (база 0 + grow + квадрат)',
    /flex:\s*1\s+1\s+0%/.test(lessonHeroArtRule) &&
      /aspect-ratio:\s*1/.test(lessonHeroArtRule) &&
      /max-height:\s*var\(--art-clue-hero\)/.test(lessonHeroArtRule),
    lessonHeroArtRule.replace(/\s+/g, ' ') || 'правило hero-снимка не найдено',
  );
}
