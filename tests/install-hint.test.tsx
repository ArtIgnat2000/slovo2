// Подсказка «📲 Добавь приложение на экран» (обратная связь 2026-09-29).
//
// Было: кнопка «Понятно» писала флаг в localStorage, но React не перерисовывался —
// блок оставался на экране до случайного обновления, и кнопка выглядела сломанной.
// Проверяем: блок исчезает сразу, не возвращается при переходах и не показывается
// снова при следующем запуске (флаг сохранён).
import { shouldSuggestInstall } from '../src/platform/pwa';
import { btnText, buttons, check, click, has, sleep } from './ui-helpers';

const HINT = 'Добавь приложение на экран';
const hintVisible = () => has(HINT);

/** На главной ли мы: вкладки видны только в основном экране приложения. */
function tabButton(text: string): HTMLButtonElement | undefined {
  return buttons().find((b) => (b.textContent ?? '').includes(text) && b.className.includes('tab'));
}

export async function runInstallHintChecks(): Promise<void> {
  console.log('\n── Подсказка «Добавь приложение на экран» ──');

  check('подсказка установки: видна на главной', hintVisible(), bodySlice());
  check('подсказка установки: в ней есть кнопка «Понятно»', !!btnText('Понятно'), bodySlice());

  click(btnText('Понятно'));
  await sleep(60);
  check('подсказка установки: исчезает сразу после «Понятно»', !hintVisible(), bodySlice());
  check(
    'подсказка установки: флаг сохранён — в следующий запуск не появится',
    shouldSuggestInstall() === false,
    String(typeof localStorage === 'undefined' ? 'нет localStorage' : localStorage.getItem('slovo2-install-hint')),
  );

  // Переходы по вкладкам — это перерисовка App: подсказка не должна «мигнуть» заново
  click(tabButton('Слова'));
  await sleep(60);
  const onWords = hintVisible();
  click(tabButton('Уроки'));
  await sleep(60);
  check('подсказка установки: не возвращается при переходах по вкладкам', !onWords && !hintVisible(), '');
}

const bodySlice = () => (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 160);
