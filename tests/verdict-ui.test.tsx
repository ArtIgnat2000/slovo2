// Пауза после ответа (15.10.2026). Жалоба с тестирования: «экран после правильного
// ответа выглядит непонятным, в целом он пустой». Так и было: на вердикте
// `TaskView` размонтировался, и от экрана оставались шапка с полоской и полоса
// «✓ Правильно!» + «Далее» — ребёнку не с чем было сверить свой ответ.
//
// Теперь отвеченное задание остаётся на экране замороженным (тапы и фокус в него
// не проходят), а полоса вердикта отвечает за результат: что ответил (контекст
// выше), верно или нет, сколько XP, как слово пишется и «Далее».
//
// Геометрию jsdom не считает, поэтому кроме живого DOM проверяются правила в
// app.css — как в tests/lesson-art-ui.test.tsx: это страж от отката «верните
// fixed-полосу, а задание размонтируйте».
import { readFileSync } from 'node:fs';
import { btnText, check, click, currentWord, sleep } from './ui-helpers';

async function toHome() {
  const exit = Array.from(document.querySelectorAll('button')).find(
    (b) => b.getAttribute('aria-label') === 'Выйти из урока',
  ) as HTMLButtonElement | undefined;
  if (exit) {
    click(exit);
    await sleep(60);
    if ((document.body.textContent ?? '').includes('Выйти из урока?')) {
      click(btnText('Выйти'));
      await sleep(80);
    }
  }
  const home = Array.from(document.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'),
  ) as HTMLButtonElement | undefined;
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

const frozenCard = () => document.querySelector('.lesson-task.is-frozen .task');
const verdictBar = () => document.querySelector('.footer-bar.verdict-bar');
const isDisabled = (b: HTMLButtonElement) => !!b.disabled;

/** Верный вариант в «окошке» (□) и в «исправь робота». */
function correctOption(): HTMLButtonElement | undefined {
  const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
  const word = currentWord();
  const visible = document.querySelector('.word-big')?.textContent ?? '';
  if (visible.includes('□')) {
    const letter = word?.text[visible.indexOf('□')];
    return options.find((o) => (o.textContent ?? '').toLowerCase() === letter);
  }
  return options.find((o) => (o.textContent ?? '').trim() === word?.text);
}

/**
 * Один шаг по текущей карточке. Возвращает тип карточки, на которой остановились:
 * 'study' — знакомство/слоги (вердикта не будет), 'answer' — оцениваемая.
 */
function step(correct: boolean): 'study' | 'answer' | 'none' {
  const syllable = Array.from(document.querySelectorAll('.syllable')).find(
    (b) => !isDisabled(b as HTMLButtonElement),
  ) as HTMLButtonElement | undefined;
  if (syllable) {
    click(syllable);
    return 'study';
  }
  const intro = Array.from(document.querySelectorAll('.task button')).find((b) =>
    /Запомнил|Вспомнил/.test(b.textContent ?? ''),
  ) as HTMLButtonElement | undefined;
  if (intro) {
    click(intro);
    return 'study';
  }

  // «Окошко» и «робот» — варианты ответа
  const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
  if (options.length) {
    const right = correctOption();
    const target = correct ? right ?? options[0] : options.find((o) => o !== right) ?? options[0];
    click(target);
    return 'answer';
  }

  // Сборка: подсказка ставит верные буквы, обратный порядок даёт ошибку
  const letters = Array.from(document.querySelectorAll('.letter:not(.used)')) as HTMLButtonElement[];
  if (letters.length) {
    if (correct) {
      const hint = btnText('Подставить букву') ?? btnText('Ещё букву');
      if (hint) click(hint);
      return 'answer';
    }
    click(letters[letters.length - 1]);
    return 'answer';
  }

  // Письмо и зрительный диктант
  const keys = Array.from(document.querySelectorAll('.key')) as HTMLButtonElement[];
  const word = currentWord();
  if (keys.length && word) {
    const target = correct ? word.text : word.text.slice(0, -1);
    const typed = (document.querySelector('.typed')?.textContent ?? '').replace('·', '').trim();
    for (const ch of target.slice(typed.length)) {
      const k = keys.find((b) => (b.textContent ?? '').trim() === ch && !isDisabled(b));
      if (!k) break;
      click(k);
    }
    if (!correct) {
      const expected = word.text[word.text.length - 1];
      const bad = keys.find((b) => {
        const t = (b.textContent ?? '').trim();
        return t !== '⌫' && t !== expected;
      });
      if (bad) click(bad);
    }
    const go = btnText('Проверить');
    if (go && !isDisabled(go)) click(go);
    return 'answer';
  }
  return 'none';
}

/**
 * Ответить на карточку и дождаться вердикта. `correct` — отвечать верно или
 * намеренно ошибиться. Возвращает итоговое состояние полосы: 'ok' | 'hint' | 'bad'.
 */
async function answerUntilVerdict(correct: boolean): Promise<'ok' | 'hint' | 'bad' | ''> {
  for (let i = 0; i < 14; i++) {
    if (document.querySelector('.task-visual') && !document.querySelector('.key')) {
      // Фаза «запомни слово»: клавиатуры ещё нет, задание само переключится
      await sleep(600);
      continue;
    }
    const kind = step(correct);
    if (kind === 'none') {
      await sleep(120);
      continue;
    }
    await sleep(1500);
    const bar = verdictBar();
    if (!bar) continue; // например, сборка с ошибкой: вердикта нет, плитки возвращаются
    const text = bar.querySelector('.verdict')?.textContent ?? '';
    if (text.includes('Ошибка')) return 'bad';
    if (text.includes('подсказкой')) return 'hint';
    if (text.includes('Правильно')) return 'ok';
  }
  return '';
}

/** Пропустить карточки без вердикта (знакомство, слоги, повторная сборка). */
async function skipToAnswerable(maxSteps = 30): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    if (verdictBar()) {
      click(btnText('Далее'));
      await sleep(80);
      continue;
    }
    if (document.querySelector('.option') || document.querySelector('.key')) return true;
    const kind = step(true);
    if (kind === 'none') {
      await sleep(120);
      continue;
    }
    await sleep(1500);
  }
  return false;
}

export async function runVerdictChecks(): Promise<void> {
  console.log('\n── Пауза после ответа: задание остаётся на экране ──');

  if (!(await startLesson())) {
    check('вердикт: урок открылся', false, 'карточки урока не появились');
    return;
  }
  if (!(await skipToAnswerable())) {
    check('вердикт: дошли до оцениваемого задания', false, 'оцениваемых карточек в уроке не нашлось');
    await toHome();
    return;
  }

  // ── 1. Верный ответ ────────────────────────────────────────────────────────
  const cardBefore = document.querySelector('.task');
  const ok = await answerUntilVerdict(true);
  check('вердикт: после верного ответа показана полоса вердикта', ok === 'ok' || ok === 'hint', ok);
  check(
    'вердикт: отвеченное задание осталось на экране (а не пустое поле)',
    !!frozenCard(),
    document.querySelector('.lesson-screen')?.textContent?.slice(0, 80) ?? '—',
  );
  check(
    'вердикт: это та же карточка, что была до ответа — свой ответ видно',
    !!cardBefore && document.querySelector('.task') === cardBefore,
    'карточка пересоздана',
  );
  check(
    'вердикт: замороженная карточка не принимает тапы и скрыта от скринридера',
    !!frozenCard()?.hasAttribute('inert') && frozenCard()?.getAttribute('aria-hidden') === 'true',
    frozenCard()?.outerHTML.slice(0, 100) ?? 'карточки нет',
  );
  check(
    'вердикт: в полосе рядом с «✓» есть награда за задание',
    !!document.querySelector('.verdict-bar .stat-pill.xp')?.textContent?.includes('⚡'),
    document.querySelector('.verdict-bar .verdict-head')?.textContent ?? '—',
  );
  check(
    'вердикт: показано написание слова с подсвеченным опасным местом',
    !!document.querySelector('.verdict-bar .verdict-word .word-big') &&
      !!document.querySelector('.verdict-bar .verdict-word .word-big .danger'),
    document.querySelector('.verdict-word')?.textContent ?? '—',
  );
  check(
    'вердикт: кнопка «Далее» живёт в полосе вердикта',
    !!verdictBar()?.querySelector('button.verdict-next') &&
      (verdictBar()?.textContent ?? '').includes('Далее'),
    verdictBar()?.textContent?.slice(0, 60) ?? '—',
  );
  const status = verdictBar()?.querySelector('[role="status"]') as HTMLElement | null;
  check(
    'вердикт: результат объявлен скринридеру живой областью (role=status)',
    status?.getAttribute('aria-live') === 'polite' && !status.querySelector('button'),
    status ? `живая область содержит кнопку: ${!!status.querySelector('button')}` : 'живой области нет',
  );

  // Enter продолжает урок с вердикта (ребёнок за планшетом с клавиатурой)
  const next = btnText('Далее');
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await sleep(120);
  check(
    'вердикт: Enter на экране вердикта уводит на следующую карточку',
    !verdictBar() || btnText('Далее') !== next,
    verdictBar() ? 'вердикт остался' : 'вердикт закрыт',
  );

  // ── 2. Ошибка ──────────────────────────────────────────────────────────────
  if (!(await skipToAnswerable())) {
    check('вердикт: дошли до второй оцениваемой карточки', false, 'карточки закончились');
    await toHome();
    return;
  }
  const bad = await answerUntilVerdict(false);
  check('вердикт: ошибка показана полосой «✗ Ошибка»', bad === 'bad', bad);
  check(
    'вердикт: при ошибке карточка тоже остаётся на экране',
    !!frozenCard(),
    document.querySelector('.lesson-screen')?.textContent?.slice(0, 80) ?? '—',
  );
  check(
    'вердикт: при ошибке видно «Правильно:» и само слово',
    !!document.querySelector('.verdict-bar .verdict-label') &&
      !!document.querySelector('.verdict-bar .verdict-word .word-big'),
    document.querySelector('.verdict-bar .footer-inner')?.textContent?.slice(0, 90) ?? '—',
  );
  check(
    'вердикт: ребёнку сказано, что слово вернётся (без наказания)',
    !!document.querySelector('.verdict-bar .stat-pill.again')?.textContent?.includes('повторим'),
    document.querySelector('.verdict-bar .stat-pill.again')?.textContent ?? 'чипа нет',
  );

  if (btnText('Далее')) {
    click(btnText('Далее')!);
    await sleep(80);
  }
  await toHome();

  // ── 3. Страж стилей: полоса в потоке, карточка заморожена ──────────────────
  const css = readFileSync('src/styles/app.css', 'utf8');
  const wrapRule = css.match(/(?:^|\n)\.lesson-task\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'вердикт: обёртка задания в обычном режиме не создаёт коробку (display: contents)',
    /display:\s*contents/.test(wrapRule),
    wrapRule.replace(/\s+/g, ' ') || 'правило .lesson-task не найдено',
  );
  const frozenRule = css.match(/\.lesson-task\.is-frozen\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'вердикт: замороженная карточка прокручивается, но не растягивает экран',
    /flex:\s*1\s+1\s+auto/.test(frozenRule) &&
      /min-height:\s*0/.test(frozenRule) &&
      /overflow-y:\s*auto/.test(frozenRule),
    frozenRule.replace(/\s+/g, ' ') || 'правило .is-frozen не найдено',
  );
  check(
    'вердикт: тап не проходит в карточку, но обёртку можно докрутить',
    /\.lesson-task\.is-frozen\s*>\s*\.task\s*\{[^}]*pointer-events:\s*none/.test(css) &&
      !/\.lesson-task\.is-frozen\s*\{[^}]*pointer-events/.test(frozenRule),
    'pointer-events висит не на том элементе',
  );
  check(
    'вердикт: мёртвая клавиатура под полосой не показывается',
    /\.lesson-task\.is-frozen\s+\.keyboard\s*\{[^}]*display:\s*none/.test(css),
    'правило для .keyboard не найдено',
  );
  const barRule = css.match(/\.lesson-screen\s*>\s*\.footer-bar\.verdict-bar\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'вердикт: полоса стоит в потоке, а не поверх задания (position: static)',
    /position:\s*static/.test(barRule) && /flex:\s*none/.test(barRule),
    barRule.replace(/\s+/g, ' ') || 'правило .verdict-bar не найдено',
  );
  check(
    'вердикт: полоса растягивается до краёв экрана теми же отступами, что и урок',
    /margin:[^;]*var\(--lesson-pad-x\)/.test(barRule) && /var\(--lesson-pad-b\)/.test(barRule),
    barRule.replace(/\s+/g, ' ') || 'правило .verdict-bar не найдено',
  );
  check(
    'вердикт: отступы-заглушки под fixed-полосу больше не нужны',
    !/\.lesson-screen\.has-verdict\s*\{[^}]*padding-bottom/.test(css),
    'старое правило .has-verdict с padding-bottom вернулось',
  );
  check(
    'вердикт: горизонтальный отступ урока вынесен в переменную',
    /--lesson-pad-x:\s*16px/.test(css) &&
      /\.lesson-screen\s*\{[^}]*padding:[^;]*var\(--lesson-pad-x\)/.test(css),
    css.match(/--lesson-pad-x:[^;]*;/g)?.join(' · ') ?? 'переменная не найдена',
  );
}
