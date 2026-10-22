// Быстрый звук (0.29.0): кнопка на любом экране, кроме урока.
//
// Жалоба: музыку можно выключить только в «Родителям» за замком, а ребёнку
// нужно «тихо прямо сейчас». Проверяем поведение, а не вёрстку:
//  • кнопка есть на главной, «Словах», «БУКе» и в «Родителях», но не в уроке;
//  • тап выключает музыку и это сохраняется в настройках профиля;
//  • долгое нажатие — тишина на 15 минут, музыка возвращается сама;
//  • тап во время тишины возвращает музыку сразу;
//  • звуки ответов (settings.sound) не меняются.
import { QUIET_MS } from '../src/ui/QuickSound';
import { useApp } from '../src/state/store';
import { buttons, check, click, has, sleep } from './ui-helpers';

const soundButton = () => document.querySelector<HTMLButtonElement>('.quick-sound');
const tab = (text: string) =>
  buttons().find((b) => (b.textContent ?? '').includes(text) && b.className.includes('tab'));

/** Долгое нажатие: pointerdown → пауза → pointerup + click (как на телефоне). */
async function longPress(btn: HTMLButtonElement, ms = 700): Promise<void> {
  btn.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
  await sleep(ms);
  btn.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true }));
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

export async function runQuickSoundChecks(): Promise<void> {
  console.log('\n── Быстрый звук ──');

  const home = tab('Уроки');
  click(home);
  await sleep(60);

  const initialMusic = useApp.getState().settings.music;
  check('кнопка звука видна на главной', !!soundButton(), document.body.textContent?.slice(0, 120) ?? '');
  check(
    'кнопка звука подписана для скринридера',
    (soundButton()?.getAttribute('aria-label') ?? '').includes('музыку'),
    soundButton()?.getAttribute('aria-label') ?? 'кнопки нет',
  );

  // 1. Тап — музыка выключается и выбор сохраняется в настройках.
  click(soundButton()!);
  await sleep(60);
  check('тап по кнопке выключает музыку', useApp.getState().settings.music === false, String(useApp.getState().settings.music));
  check('звуки ответов при этом не тронуты', useApp.getState().settings.sound === true, String(useApp.getState().settings.sound));
  check('после выключения видно иконку «тихо»', (soundButton()?.textContent ?? '').includes('🔇'), soundButton()?.textContent ?? '');
  check('ребёнку сказано, что звуки остались', has('Звуки ответов остались'), document.body.textContent?.slice(0, 160) ?? '');

  // 2. Тап ещё раз — обратно.
  click(soundButton()!);
  await sleep(60);
  check('повторный тап включает музыку', useApp.getState().settings.music === true, String(useApp.getState().settings.music));

  // 3. Долгое нажатие — тишина на 15 минут, а не выключение настройки.
  await longPress(soundButton()!);
  await sleep(60);
  const btn = soundButton()!;
  check('долгое нажатие включает тишину', btn.classList.contains('quiet'), btn.className);
  check('тишина не меняет настройку «Музыка»', useApp.getState().settings.music === true, String(useApp.getState().settings.music));
  check('на кнопке видно остаток тишины', /мин|с/.test(btn.textContent ?? ''), btn.textContent ?? '');
  check('ребёнку обещано, что музыка вернётся сама', has('вернётся сама'), document.body.textContent?.slice(0, 200) ?? '');
  check('QUIET_MS — это 15 минут', QUIET_MS === 15 * 60 * 1000, String(QUIET_MS));

  // 4. Тап во время тишины возвращает музыку сразу и не переключает настройку.
  click(btn);
  await sleep(60);
  check('тап во время тишины снимает её', !soundButton()!.classList.contains('quiet'), soundButton()!.className);
  check('после снятия тишины настройка осталась включённой', useApp.getState().settings.music === true, String(useApp.getState().settings.music));

  // 5. Кнопка доступна с других экранов, но не в уроке.
  click(tab('Слова'));
  await sleep(60);
  check('кнопка звука есть в «Словах»', !!soundButton());
  click(tab('БУК'));
  await sleep(60);
  check('кнопка звука есть в «БУКе»', !!soundButton());
  click(tab('Родителям'));
  await sleep(60);
  check('кнопка звука есть и в «Родителям»', !!soundButton());

  // Урок открываем с главной — в нём кнопки быть не должно.
  click(tab('Уроки'));
  await sleep(60);
  const node = document.querySelector<HTMLButtonElement>('.node-btn');
  if (node) {
    click(node);
    await sleep(120);
    check('в уроке кнопки звука нет', !soundButton(), document.body.textContent?.slice(0, 120) ?? '');
    const exit = buttons().find((b) => (b.textContent ?? '').includes('Выйти'));
    if (exit) click(exit);
    await sleep(120);
    const stay = buttons().find((b) => (b.textContent ?? '').trim() === 'Остаться');
    if (stay) click(stay);
    await sleep(80);
  }

  // Возвращаем настройку как было, чтобы следующие блоки смоука не зависели от нас.
  useApp.getState().setSettings({ music: initialMusic });
  check('кнопка звука не ломает итоговое состояние музыки', useApp.getState().settings.music === initialMusic);
}
