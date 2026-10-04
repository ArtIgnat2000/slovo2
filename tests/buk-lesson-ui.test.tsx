// Помощник БУК в уроке (docs/buk-in-lesson.md): сова в шапке, тихое предложение
// помощи по паузе, панель с вопросом и показом опасного места, строка в вердикте,
// настройки родителя. Блок идёт после проверок плавающего БУКа и до диагностики:
// сам начинает урок и в конце возвращается на главную.
//
// Порог паузы в смоуке — 0,9 с вместо 20 с (`VITE_BUK_NUDGE_MS` в scripts/smoke.mjs):
// сценарий «ребёнок застрял → БУК предложил помощь» проходит за секунды.
import { btnText, check, click, currentWord, sleep } from './ui-helpers';
import { helperQuestion } from '../src/state/bukHelp';
import { useApp } from '../src/state/store';
import type { TaskKind } from '../src/types';

/** Ждать чуть дольше порога паузы и тика интервала. */
const WAIT_NUDGE = 1700;

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

const owl = () => document.querySelector('.buk-owl') as HTMLButtonElement | null;
const panel = () => document.querySelector('.buk-panel') as HTMLElement | null;

/** Знакомство и слоги проходятся сразу — в них помощь по паузе не предлагается. */
function isStudyCard(): boolean {
  return !!btnText('Запомнил') || !!Array.from(document.querySelectorAll('.syllable')).length;
}

/** Пропустить задания-знакомства до первого «настоящего» задания. */
async function toPracticeCard(maxSteps = 8): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    if (btnText('Далее')) {
      click(btnText('Далее')!);
      await sleep(60);
      continue;
    }
    if (isStudyCard()) {
      const syl = Array.from(document.querySelectorAll('.syllable')).find(
        (b) => !(b as HTMLButtonElement).disabled,
      ) as HTMLButtonElement | undefined;
      if (syl) click(syl);
      else click(btnText('Запомнил'));
      await sleep(60);
      continue;
    }
    return !!document.querySelector('.task');
  }
  return false;
}

/**
 * Ответить на карточку. `wrong = true` — намеренно неверно (для проверки строки
 * БУКа в вердикте): в окошке и «роботе» выбираем другой вариант, в сборке ставим
 * буквы в обратном порядке, в письме и диктанте набираем всё, кроме последней буквы.
 */
async function answerOnce(wrong = false): Promise<void> {
  const word = currentWord();
  const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
  if (options.length) {
    const visible = document.querySelector('.word-big')?.textContent ?? '';
    let correct: HTMLButtonElement | undefined;
    if (word && visible.includes('□')) {
      const letter = word.text[visible.indexOf('□')];
      correct = options.find((o) => (o.textContent ?? '').toLowerCase() === letter);
    } else if (word) {
      correct = options.find((o) => (o.textContent ?? '').trim() === word.text);
    }
    click(wrong ? options.find((o) => o !== correct) ?? options[0] : correct ?? options[0]);
    await sleep(80);
    return;
  }

  if (document.querySelector('.letter')) {
    // Сборка: подсказка ставит верные буквы, обратный порядок даёт ошибку
    const free = Array.from(document.querySelectorAll('.letter:not(.used)')) as HTMLButtonElement[];
    if (wrong) {
      for (const letter of [...free].reverse()) {
        click(letter);
        await sleep(60);
      }
      return;
    }
    const hint = btnText('Подставить букву') ?? btnText('Ещё букву');
    if (hint) {
      click(hint);
      await sleep(80);
    }
    return;
  }

  const keys = Array.from(document.querySelectorAll('.key')) as HTMLButtonElement[];
  if (keys.length && word) {
    const target = wrong ? word.text.slice(0, -1) : word.text;
    const typed = (document.querySelector('.typed')?.textContent ?? '').replace('·', '').trim();
    for (const ch of target.slice(typed.length)) {
      const k = keys.find((b) => (b.textContent ?? '').trim() === ch);
      if (!k) break;
      click(k);
      await sleep(6);
    }
    if (wrong) {
      // Последняя буква — заведомо не та, что нужна
      const expected = word.text[word.text.length - 1];
      const badKey = keys.find((b) => {
        const t = (b.textContent ?? '').trim();
        return t !== '⌫' && t !== expected;
      });
      if (badKey) click(badKey);
      await sleep(20);
    }
    const okBtn = btnText('Проверить');
    if (okBtn && !okBtn.disabled) click(okBtn);
    await sleep(80);
  }
}

/** Ответить правильно и уйти на следующую карточку. */
async function answerCorrectly(): Promise<void> {
  await answerOnce(false);
  if (btnText('Далее')) {
    click(btnText('Далее')!);
    await sleep(60);
  }
}

/** Карточка, на которой можно ошибиться: варианты, сборка, письмо или диктант. */
function isAnswerable(): boolean {
  return !!document.querySelector('.option, .letter, .key');
}

/** Ответить правильно и дождаться вердикта (он приходит через 0,7 с). */
async function answerUntilVerdict(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    await answerOnce(false);
    await sleep(1100);
    if (document.querySelector('.footer-bar')) return document.querySelector('.buk-verdict')?.textContent ?? '';
  }
  return '';
}

export async function runBukLessonChecks(): Promise<void> {
  console.log('\n── Помощник БУК в уроке ──');

  if (!(await startLesson())) {
    check('БУК-помощник: урок открылся', false, 'карточки урока не появились');
    return;
  }

  // Контракт не сломан: во время карточек плавающего БУКа по-прежнему нет
  check(
    'БУК-помощник: плавающий БУК в уроке скрыт',
    document.querySelectorAll('.app > .mascot').length === 0,
    `${document.querySelectorAll('.app > .mascot').length}`,
  );
  check('БУК-помощник: в шапке урока есть сова-помощник', !!owl(), 'кнопки .buk-owl нет');

  if (!(await toPracticeCard())) {
    check('БУК-помощник: дошли до задания, где помощь уместна', false, 'остались на знакомстве');
    return;
  }

  // ── Тихая пауза: предложение помощи без звука и без сдвига задания ──────────
  await sleep(WAIT_NUDGE);
  const hasNudge = !!document.querySelector('.buk-nudge');
  check('БУК-помощник: после паузы появляется тихое предложение помощи', hasNudge, 'пузыря «Подсказать?» нет');

  if (hasNudge) {
    click(document.querySelector('.buk-nudge') as HTMLButtonElement);
    await sleep(60);
  } else {
    click(owl());
    await sleep(60);
  }

  // ── Ступень 1: вопрос, который не раскрывает ответ ─────────────────────────
  const word = currentWord();
  const asked = panel()?.textContent ?? '';
  check('БУК-помощник: панель объясняет, что происходит', asked.includes('БУК:'), asked.slice(0, 90));
  // Первая ступень — одна из готовых фраз помощника (не «сырой» текст из вёрстки).
  // Часть фраз — просьбы («проговори…»), поэтому знак вопроса не обязателен.
  const KINDS: TaskKind[] = ['intro', 'syllables', 'gap', 'build', 'write', 'visual', 'fix'];
  const knownQuestion =
    !!word && KINDS.some((kind) => asked.includes(helperQuestion(kind, word)));
  check('БУК-помощник: первая ступень — вопрос-подсказка из правил', knownQuestion, asked.slice(0, 100));
  check(
    'БУК-помощник: вопрос не выдаёт написание',
    !!word && !asked.toLowerCase().includes(word.text.toLowerCase()),
    word ? `в панели встретилось «${word.text}»` : 'слово не определилось',
  );

  // ── Ступень 2: опасное место и мнемоника (то же, что даёт кнопка «💡») ─────
  const revealBtn = btnText('Показать букву');
  check('БУК-помощник: есть кнопка «Показать букву»', !!revealBtn, '');
  if (revealBtn) {
    click(revealBtn);
    await sleep(60);
  }
  const revealed = panel()?.textContent ?? '';
  check(
    'БУК-помощник: вторая ступень показывает опасное место или мнемонику',
    !!word &&
      (revealed.includes(word.mnemonic ?? '␀') || revealed.includes('Опасн') || revealed.includes('пишется так, как слышится')),
    revealed.slice(0, 120),
  );
  const doneBtn = btnText('Понятно') ?? btnText('Я сам');
  if (doneBtn) {
    click(doneBtn);
    await sleep(60);
  }
  check('БУК-помощник: панель закрывается', !panel(), 'панель осталась на экране');

  // ── Отказ уважается: в новом уроке «Я сам» выключает предложения ───────────
  if (!(await startLesson())) {
    check('БУК-помощник: второй урок открылся', false, '');
    return;
  }
  await toPracticeCard();
  click(owl());
  await sleep(60);
  const selfBtn = btnText('Я сам');
  check('БУК-помощник: в панели есть кнопка «Я сам»', !!selfBtn, '');

  // Помощь меняет цену ответа, а не оценку: после вопроса вердикт хвалит, что
  // ребёнок справился сам (качество 4 — XP как с подсказкой, звёзды не страдают).
  const afterQuestion = await answerUntilVerdict();
  check(
    'БУК-помощник: ответ после вопроса отмечается похвалой, а не «с подсказкой»',
    afterQuestion.includes('после вопроса'),
    afterQuestion || 'вердикт не появился',
  );
  if (btnText('Далее')) {
    click(btnText('Далее')!);
    await sleep(60);
  }

  // Отказ: открываем панель и закрываем её «Я сам»
  if (!document.querySelector('.buk-panel')) {
    click(owl());
    await sleep(60);
  }
  const refuse = btnText('Я сам');
  if (refuse) {
    click(refuse);
    await sleep(60);
  }
  await sleep(WAIT_NUDGE);
  check('БУК-помощник: после «Я сам» помощь больше не предлагается', !document.querySelector('.buk-nudge'), 'пузырь вернулся');
  click(owl());
  await sleep(60);
  check('БУК-помощник: но помощь по кнопке остаётся доступной', !!panel(), 'панель не открылась');
  const closeAgain = btnText('Я сам');
  if (closeAgain) {
    click(closeAgain);
    await sleep(60);
  }

  // ── Строка БУКа в вердикте об ошибке ──────────────────────────────────────
  // Ошибиться можно на любой карточке с ответом, поэтому сценарий не зависит от
  // того, попалось ли в уроке «окошко»: письмо и сборка тоже умеют ошибаться.
  let verdictLine = '';
  for (let i = 0; i < 10 && !verdictLine; i++) {
    if (btnText('К урокам')) {
      if (!(await startLesson())) break;
      await toPracticeCard();
      continue;
    }
    if (!isAnswerable()) {
      await answerCorrectly();
      continue;
    }
    await answerOnce(true);
    // При ошибке вердикт показывается через 1,2–1,3 с (TaskView)
    await sleep(1600);
    verdictLine = document.querySelector('.buk-verdict')?.textContent ?? '';
    if (!verdictLine) await answerCorrectly();
  }
  check(
    'БУК-помощник: после ошибки в вердикте есть строка БУКа',
    verdictLine.includes('БУК:') && verdictLine.length > 10,
    verdictLine || 'не дошли до карточки с ответом',
  );
  check('БУК-помощник: строка не повторяет мнемонику, а поддерживает', !!verdictLine && !verdictLine.includes('💡'), verdictLine);
  if (btnText('Далее')) {
    click(btnText('Далее')!);
    await sleep(60);
  }

  // ── Настройки родителя: «выключены» и глобальное «Сова БУК: не показывать» ─
  useApp.getState().setSettings({ lessonHelp: 'off' });
  await sleep(60);
  check('БУК-помощник: «Подсказки в уроке: выключены» убирают сову из шапки', !owl(), 'сова осталась');
  useApp.getState().setSettings({ lessonHelp: 'socratic', mascot: 'off' });
  await sleep(60);
  check('БУК-помощник: «Сова БУК: не показывать» тоже убирает помощника', !owl(), 'сова осталась');
  useApp.getState().setSettings({ lessonHelp: 'socratic', mascot: 'on' });
  await sleep(60);
  check('БУК-помощник: возврат настроек возвращает сову', !!owl(), 'совы нет');

  await toHome();
}
