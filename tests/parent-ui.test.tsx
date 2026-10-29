// Раздел «Родителям» после редизайна: четыре раздела, понятные настройки и
// честный замок «только для взрослых».
//
// Проверяем не «нарисовано ли», а то, что ломалось как опыт родителя:
//  • раздел открывается обзором, а не простынёй настроек;
//  • в один момент на экране ровно один раздел (прогрессивное раскрытие);
//  • настройки объясняют последствие, бинарные — переключателем;
//  • разрушительное действие живёт отдельно, в разделе «Прогресс»;
//  • ошибка в примере-замке показывается на месте, а не модальным окном.
import { readFileSync } from 'node:fs';
import { body, btnText, buttons, check, click, has, openParentSection, sleep } from './ui-helpers';
import { dayKey, useApp } from '../src/state/store';
import { WORDS, WORDS_BY_GRADE } from '../src/content/words';
import { runGemResetUiChecks } from './gem-reset-ui.test';

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
  Array.from(document.querySelectorAll('.seg-tabs[role="tablist"] [role="tab"]')) as HTMLButtonElement[];

export async function runParentUiChecks(): Promise<void> {
  console.log('\n── «Родителям»: разделы, настройки и замок ──');
  const parentCss = readFileSync('src/styles/app.css', 'utf8');
  check('мобильная навигация складывается в две широкие колонки',
    /@media \(max-width: 560px\)[\s\S]*?\.seg-tabs\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(parentCss));
  check('главные переключатели имеют область касания не меньше 48 px',
    /\.seg-tab\s*\{[^}]*min-height: 48px/.test(parentCss) &&
      /\.choice-item\s*\{[^}]*min-height: 48px/.test(parentCss) &&
      /\.switch\s*\{[^}]*min-height: 48px/.test(parentCss));
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
  check('раздел открывается кратким прогрессом по словам', has('Прогресс по словам') && has('освоено'), body().slice(0, 160));
  check('статистика занятий закрыта по умолчанию', btnText('Статистика занятий')?.getAttribute('aria-expanded') === 'false');
  check('обзор не отвлекает необязательными блоками',
    !has('Достижения') && !has('Общее') && !has('Списки к контрольной') && !has('Сегодня'));
  check('объяснение метрики спрятано за раскрытием', document.querySelector('.parent-metric-help')?.hasAttribute('open') === false);
  const gradeSelect = document.querySelector('#parent-learning-grade') as HTMLSelectElement | null;
  const originalGrade = store().profiles.find((p) => p.id === store().activeId)?.activeClass ?? 2;
  if (gradeSelect) {
    gradeSelect.value = '1';
    gradeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(20);
  }
  check('классный фильтр переключает словарь для анализа', document.querySelector('.parent-learning-summary .stat-tile-value')?.textContent?.endsWith(`/ ${WORDS_BY_GRADE[1].length}`) === true, body().slice(0, 180));
  check('фильтр анализа не меняет класс программы ребёнка',
    (store().profiles.find((p) => p.id === store().activeId)?.activeClass ?? 2) === originalGrade);
  if (gradeSelect) {
    gradeSelect.value = String(originalGrade);
    gradeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(20);
  }
  // Карточка проблемного слова не выводит из родительского раздела.
  const selected = WORDS_BY_GRADE[1][0];
  const activeProfile = store().profiles.find((p) => p.id === store().activeId)!;
  const savedErrors = activeProfile.errors;
  useApp.setState((state) => ({ profiles: state.profiles.map((p) => p.id === state.activeId
    ? { ...p, errors: { ...p.errors, [selected.id]: 3 } } : p) }));
  if (gradeSelect) {
    gradeSelect.value = '1';
    gradeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  await sleep(30);
  const proto = window.HTMLDialogElement.prototype;
  const oldShowModal = proto.showModal;
  const oldClose = proto.close;
  proto.showModal = function () { this.setAttribute('open', ''); };
  proto.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
  const problem = document.querySelector('.parent-summary-errors button.word-chip') as HTMLButtonElement | null;
  check('проблемное слово открывается кнопкой, перехода в словарик нет', !!problem && !btnText('Открыть словарик'));
  click(problem);
  await sleep(30);
  check('карточка открыта поверх родительского обзора',
    !!document.querySelector(`dialog[open][aria-label="Карточка слова ${selected.text}"]`) && has('Прогресс по словам'));
  click(document.querySelector('.parent-word-dialog button.btn'));
  await sleep(30);
  check('после закрытия остаются выбранный класс и родительский раздел',
    !document.querySelector('.parent-word-dialog') && gradeSelect?.value === '1' && has('Прогресс по словам') && !has('Раздел для взрослых'));
  proto.showModal = oldShowModal;
  proto.close = oldClose;
  useApp.setState((state) => ({ profiles: state.profiles.map((p) => p.id === state.activeId ? { ...p, errors: savedErrors } : p) }));
  if (gradeSelect) {
    gradeSelect.value = String(originalGrade);
    gradeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  await sleep(20);
  click(btnText('Статистика занятий'));
  await sleep(30);

  // 3. Четыре раздела-вкладки с корректной семантикой (aria) — и ровно один на экране.
  const tabs = tabButtons();
  check(
    'в разделе четыре основных вкладки: обучение, списки, настройки, ещё',
    tabs.length === 4 &&
      ['Обучение', 'Списки', 'Настройки', 'Ещё'].every((title) =>
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
    arrow.defaultPrevented && has('Данные') && has('Приложение') && !has('Размер урока'),
    `${body().slice(0, 140)}`,
  );
  check('в «Ещё» виден только один выбранный вложенный раздел',
    document.querySelectorAll('#parent-panel-more [role="tab"][aria-selected="true"]').length === 1 &&
      document.querySelectorAll('#parent-panel-more [role="tabpanel"]').length === 1);
  click(document.querySelector('#parent-more-tab-app'));
  await sleep(30);
  check('вложенная вкладка открывает приложение, не показывая карточки данных',
    has('Передать приложение') && !has('Резервная копия'));
  await openParentSection('Ещё');
  check(
    'фокус в наборе вкладок один (roving tabindex)',
    tabButtons().filter((t) => t.tabIndex === 0).length === 1 &&
      tabButtons().find((t) => t.tabIndex === 0)?.getAttribute('aria-selected') === 'true',
    tabButtons().map((t) => `${t.textContent}:${t.tabIndex}`).join(' | '),
  );

  // 5. Настройки: группы по вопросам, объяснения и рабочие элементы управления.
  await openParentSection('Настройки');
  check('расширенные настройки свернуты по умолчанию', !document.querySelector('.parent-advanced-settings')?.hasAttribute('open'));
  check('родитель не управляет музыкой за ребёнка', !Array.from(document.querySelectorAll('[role="switch"]')).some((el) => el.getAttribute('aria-label') === 'Музыка'));
  click(document.querySelector('.parent-advanced-settings summary'));
  await sleep(20);
  check(
    'настройки собраны в три понятные группы',
    has('Занятия') && has('Звук и отклик') && has('Вид'),
    body().slice(0, 200),
  );
  check(
    'настройки объяснены коротко',
    has('Дневная норма XP на главной') && has('Как БУК помогает в задании') &&
      !has('Сколько опыта (XP) считается выполненной нормой дня'),
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
  await openParentSection('Данные');
  check(
    'сброс прогресса живёт в «Прогрессе» и отделён предупреждением',
    !!btnText('Сбросить прогресс') &&
      has('Профиль останется в корзине 30 дней') &&
      !!document.querySelector('.danger-zone'),
    body().slice(0, 200),
  );
  check(
    'в «Данных» сразу видны только копия и состояние сохранения',
    has('Резервная копия') && has('Сохранение') && has('Сохранить файл') &&
      document.querySelector('.parent-data-details')?.hasAttribute('open') === false,
    body().slice(0, 200),
  );
  await runGemResetUiChecks(async () => {
    const parent = buttons().find((b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'));
    click(parent);
    await sleep(60);
    await unlockWith((a, b) => a * b);
    await openParentSection('Данные');
  });

  // 7. «Приложение»: передача, установка и обновления; техническое — закрыто.
  await openParentSection('Приложение');
  check(
    'в «Приложении» сразу видны только основные действия',
    has('Передать приложение') && has('Установка') && has('Обновления') &&
      document.querySelector('.parent-app-about')?.hasAttribute('open') === false,
    body().slice(0, 240),
  );
  click(document.querySelector('.parent-app-about summary'));
  click(btnText('Диагностика'));
  await sleep(60);
  check('диагностика доступна из технического раздела', !!document.querySelector('.diag-screen'));
  click(document.querySelector('.diag-screen button'));
  await sleep(60);
  check('после проверки вкладка «Приложение» остаётся открытой',
    document.querySelector('#parent-tab-more[aria-selected="true"]') !== null &&
      document.querySelector('#parent-more-tab-app[aria-selected="true"]') !== null);
  await openParentSection('Обучение');
  click(btnText('Статистика занятий'));
  await sleep(30);
  check(
    'подробности ограничены активностью, без игровых и рекламных блоков',
    has('Сегодня') && has('Последние 7 дней') && !has('Достижения') &&
      !has('Классы 1–4') && !has('Слово2 сделали в V-labs'),
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
    check('сегодняшний отчёт показывает активное время и занятия', has('2 мин') && has('Занятия ·'), body().slice(0, 300));
    check('разбор показывает слово с ошибкой и успешный повтор', has(word.text) && has('Исправлено повтором'), body().slice(0, 400));
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
