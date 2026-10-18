// Раздел «Родителям» после редизайна: четыре раздела, понятные настройки и
// честный замок «только для взрослых».
//
// Проверяем не «нарисовано ли», а то, что ломалось как опыт родителя:
//  • раздел открывается обзором, а не простынёй настроек;
//  • в один момент на экране ровно один раздел (прогрессивное раскрытие);
//  • настройки объясняют последствие, бинарные — переключателем;
//  • разрушительное действие живёт отдельно, в разделе «Прогресс»;
//  • ошибка в примере-замке показывается на месте, а не модальным окном.
import { body, btnText, buttons, check, click, has, openParentSection, sleep } from './ui-helpers';
import { dayKey, useApp } from '../src/state/store';
import { WORDS } from '../src/content/words';

const store = () => useApp.getState();

/** Решить пример-замок: возвращает true, если раздел открылся. */
async function unlockWith(compute: (a: number, b: number) => number): Promise<boolean> {
  const equation = document.body.textContent?.match(/(\d+) × (\d+) = \?/);
  const input = document.querySelector('input.input') as HTMLInputElement | null;
  if (!equation || !input) return false;
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, String(compute(Number(equation[1]), Number(equation[2]))));
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(20);
  click(btnText('Войти'));
  await sleep(60);
  return !has('Раздел для взрослых');
}

const tabButtons = () =>
  Array.from(document.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];

export async function runParentUiChecks(): Promise<void> {
  console.log('\n── «Родителям»: разделы, настройки и замок ──');
  const home = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  click(home);
  await sleep(60);
  const parentTab = buttons().find((b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'));
  click(parentTab);
  await sleep(60);

  // 1. Замок: ошибка объясняется на месте и не выкидывает из раздела.
  const alerts: string[] = [];
  const originalAlert = window.alert;
  window.alert = (message?: unknown) => {
    alerts.push(String(message));
  };
  const wrong = await unlockWith((a, b) => a * b + 1);
  check(
    'ошибка в примере объясняется на месте, без модального окна',
    !wrong && !!document.querySelector('.unlock-error') && alerts.length === 0,
    `alert: ${JSON.stringify(alerts)}; текст: ${body().slice(0, 120)}`,
  );

  // 2. Верный ответ открывает раздел — и сразу на «Обзор», а не на настройки.
  const opened = await unlockWith((a, b) => a * b);
  check('верный ответ открывает раздел родителей', opened, body().slice(0, 120));
  check('раздел открывается обзором: главное — как дела у ребёнка', has('Сегодня') && has('Что подтянуть'), body().slice(0, 160));

  // 3. Четыре раздела-вкладки с корректной семантикой (aria) — и ровно один на экране.
  const tabs = tabButtons();
  check(
    'в разделе четыре раздела-вкладки: обзор, прогресс, настройки, приложение',
    tabs.length === 4 &&
      ['Обзор', 'Прогресс', 'Настройки', 'Приложение'].every((title) =>
        tabs.some((t) => (t.textContent ?? '').includes(title)),
      ),
    tabs.map((t) => t.textContent).join(' | '),
  );
  check(
    'открыт ровно один раздел, вкладка помечена aria-selected',
    document.querySelectorAll('[role="tabpanel"]').length === 1 &&
      document.querySelectorAll('[role="tab"][aria-selected="true"]').length === 1,
    `панелей: ${document.querySelectorAll('[role="tabpanel"]').length}, выбранных вкладок: ${document.querySelectorAll('[role="tab"][aria-selected="true"]').length}`,
  );
  check(
    'панель связана со своей вкладкой (aria-labelledby)',
    (() => {
      const panel = document.querySelector('[role="tabpanel"]');
      const id = panel?.getAttribute('aria-labelledby');
      return !!panel && !!id && !!document.getElementById(id);
    })(),
    document.querySelector('[role="tabpanel"]')?.outerHTML.slice(0, 120) ?? '',
  );
  check(
    'в обзоре нет настроек — их не подмешивают в отчёт',
    !has('Размер урока') && !has('Тема'),
    body().slice(0, 160),
  );

  // 4. Роving tabindex + стрелки: вкладки работают с клавиатуры.
  const settingsTab = await openParentSection('Настройки');
  const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  settingsTab?.dispatchEvent(arrow);
  await sleep(50);
  check(
    'стрелки клавиатуры переключают разделы (как вкладки браузера)',
    arrow.defaultPrevented && has('Передать приложение') && !has('Размер урока'),
    `${body().slice(0, 140)}`,
  );
  check(
    'фокус в наборе вкладок один (roving tabindex)',
    tabButtons().filter((t) => t.tabIndex === 0).length === 1 &&
      tabButtons().find((t) => t.tabIndex === 0)?.getAttribute('aria-selected') === 'true',
    tabButtons().map((t) => `${t.textContent}:${t.tabIndex}`).join(' | '),
  );

  // 5. Настройки: группы по вопросам, объяснения и рабочие элементы управления.
  await openParentSection('Настройки');
  check(
    'настройки собраны в три понятные группы',
    has('Занятия') && has('Звук и отклик') && has('Вид'),
    body().slice(0, 200),
  );
  check(
    'у каждой настройки есть объяснение последствий',
    has('Сколько опыта (XP) считается выполненной нормой дня') &&
      has('Что делает сова БУК, если ребёнок просит помощи'),
    document.querySelector('.parent-panel')?.textContent?.slice(0, 200) ?? '',
  );

  check(
    'в родительских настройках остаётся выбор светлой/тёмной цветовой схемы',
    has('Цветовая схема') && has('светлая') && has('тёмная'),
    document.querySelector('.parent-panel')?.textContent?.slice(0, 220) ?? '',
  );

  const help = document.querySelector('.theme-help') as HTMLDetailsElement | null;
  check('из настроек можно узнать, почему светлая тема серая',
    !!help && help.querySelector('summary')?.textContent?.includes('Светлая тема всё равно серая?') === true);
  if (help) help.open = true;
  check('помощь не предлагает удалять ярлык с прогрессом',
    !!help && help.textContent?.includes('Не удаляйте ярлык') === true &&
      help.textContent?.includes('Прогресс') === true);
  const urlBeforeDiagnostics = window.location.href;
  click(help?.querySelector('button'));
  await sleep(70);
  check('диагностика открывается кнопкой из PWA без адресной строки',
    !!document.querySelector('.diag-screen') && has('Проверка Auto Dark') && window.location.href === urlBeforeDiagnostics);
  click(document.querySelector('.diag-screen button'));
  await sleep(70);
  check('после диагностики возвращаемся в настройки родителей',
    !document.querySelector('.diag-screen') &&
      document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes('Настройки') === true &&
      has('Размер урока'));

  const soundSwitch = Array.from(document.querySelectorAll('[role="switch"]')).find((el) =>
    (el.getAttribute('aria-label') ?? '').includes('Звук'),
  ) as HTMLButtonElement | undefined;
  const soundBefore = store().settings.sound;
  check(
    'звук — переключатель со состоянием в aria-checked',
    !!soundSwitch && soundSwitch.getAttribute('aria-checked') === String(soundBefore),
    soundSwitch?.outerHTML.slice(0, 120) ?? 'переключатель не найден',
  );
  click(soundSwitch);
  await sleep(40);
  check(
    'переключатель звука меняет настройку',
    store().settings.sound === !soundBefore,
    `было ${soundBefore}, стало ${store().settings.sound}`,
  );
  click(soundSwitch);
  await sleep(40);

  const previousSize = store().profiles.find((p) => p.id === store().activeId)?.lessonSize;
  click(btnText('Полный · 20'));
  await sleep(40);
  check(
    'размер урока выбирается и сохраняется в профиле ребёнка',
    store().profiles.find((p) => p.id === store().activeId)?.lessonSize === 'full',
    String(store().profiles.find((p) => p.id === store().activeId)?.lessonSize),
  );
  const restoreSize = btnText('Обычный · 16');
  if (restoreSize && previousSize !== 'full') {
    click(restoreSize);
    await sleep(40);
  }

  // 6. Разрушительное действие — отдельно, в разделе «Прогресс», под предупреждением.
  check('в настройках нет кнопки сброса прогресса', !btnText('Сбросить прогресс'), body().slice(0, 160));
  await openParentSection('Прогресс');
  check(
    'сброс прогресса живёт в «Прогрессе» и отделён предупреждением',
    !!btnText('Сбросить прогресс') &&
      has('Профиль останется в корзине 30 дней') &&
      !!document.querySelector('.danger-zone'),
    body().slice(0, 200),
  );
  check(
    'в «Прогрессе» есть копия, сохранность и корзина',
    has('Копия прогресса') && has('Сохранность') && has('Сохранить файл'),
    body().slice(0, 200),
  );

  // 7. «Приложение» — про приложение, а не про ребёнка: ссылка, версия, V-labs.
  await openParentSection('Приложение');
  check(
    'в «Приложении» есть передача ссылки, версия сборки и карточка V-labs',
    has('Передать приложение') && has('Версия') && has('Слово2 сделали в V-labs'),
    body().slice(0, 240),
  );
  click(btnText('Диагностика приложения'));
  await sleep(60);
  check('диагностика доступна также из вкладки «Приложение»', !!document.querySelector('.diag-screen'));
  click(document.querySelector('.diag-screen button'));
  await sleep(60);
  check('после проверки вкладка «Приложение» остаётся открытой',
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes('Приложение') === true);
  await openParentSection('Обзор');
  check(
    'обзор не показывает рекламу школы — она не отвлекает от отчёта',
    has('XP за сегодня') && !has('Слово2 сделали в V-labs'),
    body().slice(0, 200),
  );

  // 8. Отчёт «сегодня»: отдельная запись сессии и ошибки в конкретном слове.
  const profileId = store().activeId;
  const originalProfile = store().profiles.find((p) => p.id === profileId);
  const sessionId = 'parent-report-test';
  const now = Date.now();
  const word = WORDS[0];
  if (profileId && originalProfile) {
    store().startStudySession({
      id: sessionId, day: dayKey(), startedAt: now, activeSeconds: 0,
      mode: 'lesson', lessonId: 'report-test', tasks: 0, correct: 0, wrong: 0,
      errorWords: {}, taskKindErrors: {}, recoveredWords: [], lastActivityAt: now, status: 'active',
    });
    store().answer(word.id, 1, false, { sessionId, taskKind: 'write', reason: 'learn' });
    store().answer(word.id, 5, false, { sessionId, taskKind: 'write', reason: 'repair' });
    store().addStudyTime(sessionId, 132);
    store().finishStudySession(sessionId, 'completed');
    await sleep(60);
    check('сегодняшний отчёт показывает оценку активного времени и сессии', has('2 мин') && has('Занятия сегодня'), body().slice(0, 300));
    check('разбор показывает слово с ошибкой и успешный повтор', has(word.text) && has('После ошибки верно повторил'), body().slice(0, 400));
    check('сессия показывает результат и вид задания, без записи ответа ребёнка', has('1 верно · 1 ошибка') && has('напиши слово'), body().slice(0, 500));
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => p.id === profileId ? originalProfile : p),
    }));
    await sleep(40);
  }

  // 9. Возврат на главную: раздел снова под замком (это же проверяет аудит выше).
  const lessonsTab = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  click(lessonsTab);
  await sleep(60);
  window.alert = originalAlert;
}
