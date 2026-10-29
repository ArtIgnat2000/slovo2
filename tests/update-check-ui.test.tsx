// Ручная проверка обновлений (0.26.0).
//
// Раньше версию можно было только «сверить глазами» с сайтом: приложение
// проверяло обновление само при запуске и показывало плашку. Если ярлык неделю
// не закрывали, родитель так и оставался на старой сборке. Теперь в
// «Родителям» → «Приложение» есть кнопка, которая спрашивает браузер вручную.
//
// Проверяем главное, что легко сломать:
//  • кнопка есть и после ответа снова доступна;
//  • «нет обновления» и «проверить нельзя» — разные сообщения (нельзя обещать
//    «последняя версия», когда проверить не удалось);
//  • ожидающий воркер — это обновление, а установка нового воркера — тоже,
//    даже если update() уже вернул управление;
//  • по кнопке «Обновить сейчас» показывается только при найденном обновлении.
import { checkForUpdate, FORCE_AFTER_MS, startUpdateWatch, takeAppliedVersion, updatePending } from '../src/platform/pwa';
import { body, btnText, buttons, check, click, has, openParentSection, sleep } from './ui-helpers';

/** Открыть «Родителям» и решить пример-замок (раздел блокируется при уходе). */
async function openParentsAppTab(): Promise<void> {
  const home = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  click(home);
  await sleep(50);
  const parent = buttons().find((b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'));
  click(parent);
  await sleep(50);
  if (has('Раздел для взрослых')) {
    const equation = document.body.textContent?.match(/(\d+) × (\d+) = \?/);
    const input = document.querySelector('input.input') as HTMLInputElement | null;
    if (equation && input) {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, String(Number(equation[1]) * Number(equation[2])));
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      await sleep(20);
      click(btnText('Войти'));
      await sleep(60);
    }
  }
  await openParentSection('Приложение');
}

interface FakeRegistration {
  waiting: unknown;
  installing: unknown;
  update: () => Promise<void>;
}

interface FakeServiceWorker {
  controller: unknown;
  getRegistration: () => Promise<FakeRegistration | null>;
  addEventListener: () => void;
}

/** Подменить navigator.serviceWorker: в jsdom сервис-воркеров нет вовсе. */
function installFakeServiceWorker(reg: FakeRegistration | null, { online = true }: { online?: boolean } = {}): void {
  const sw: FakeServiceWorker = {
    controller: reg ? { state: 'activated' } : null,
    getRegistration: async () => reg,
    addEventListener: () => {},
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
}

function restoreNavigator(swDescriptor: PropertyDescriptor | undefined, onlineDescriptor: PropertyDescriptor | undefined): void {
  if (swDescriptor) Object.defineProperty(navigator, 'serviceWorker', swDescriptor);
  else delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  if (onlineDescriptor) Object.defineProperty(navigator, 'onLine', onlineDescriptor);
  else delete (navigator as unknown as { onLine?: unknown }).onLine;
}

export async function runUpdateCheckUiChecks(): Promise<void> {
  console.log('\n── Ручная проверка обновлений ──');

  const swDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  try {
    await openParentsAppTab();
    check(
      'в «Приложении» есть кнопка «Проверить обновления»',
      !!btnText('Проверить обновления') && has('Версия'),
      body().slice(0, 220),
    );

    // 1. Без сервис-воркера (jsdom, npm run dev) — честное «здесь нельзя»,
    //    а не ложное «версия последняя».
    click(btnText('Проверить обновления'));
    await sleep(60);
    check(
      'без сервис-воркера проверка сообщает, что проверить нельзя',
      has('В этой копии проверка недоступна'),
      document.querySelector('.update-status')?.textContent?.slice(0, 200) ?? 'ответа нет',
    );
    const afterUnavailable = btnText('Проверить обновления') as HTMLButtonElement | undefined;
    check(
      'после ответа кнопка проверки снова доступна',
      !!afterUnavailable && !afterUnavailable.disabled,
      afterUnavailable?.outerHTML.slice(0, 140) ?? 'кнопки нет',
    );

    // 2. Сервис-воркер ждёт включения — это обновление.
    const reg: FakeRegistration = {
      waiting: { state: 'installed' },
      installing: null,
      update: async () => {},
    };
    installFakeServiceWorker(reg);
    const available = await checkForUpdate(100);
    check(
      'checkForUpdate: ожидающий воркер — есть обновление',
      available.status === 'available',
      JSON.stringify(available),
    );

    // 3. Обновления нет: воркер скачан заново, но не изменился.
    let updateCalls = 0;
    reg.waiting = null;
    reg.installing = null;
    reg.update = async () => {
      updateCalls += 1;
    };
    const current = await checkForUpdate(100);
    check(
      'checkForUpdate: файл воркера не изменился — версия последняя',
      current.status === 'current' && updateCalls === 1,
      `${JSON.stringify(current)}; update() вызван ${updateCalls} раз`,
    );

    // 4. Установка идёт после ответа update() — ждём и только потом говорим «есть».
    const listeners: Array<() => void> = [];
    const worker = {
      state: 'installing',
      addEventListener: (_event: string, cb: () => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_event: string, cb: () => void) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      },
    };
    reg.installing = worker;
    const pending = checkForUpdate(400);
    await sleep(20);
    reg.waiting = { state: 'installed' };
    worker.state = 'installed';
    for (const cb of listeners.slice()) cb();
    const installed = await pending;
    check(
      'checkForUpdate: новый воркер докачался — обновление найдено',
      installed.status === 'available',
      JSON.stringify(installed),
    );

    // 5. Установка не успела — «не удалось проверить», а не «версия последняя».
    const slow: FakeRegistration = {
      waiting: null,
      installing: {
        state: 'installing',
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      update: async () => {},
    };
    installFakeServiceWorker(slow);
    const timeout = await checkForUpdate(30);
    check(
      'checkForUpdate: установка не уложилась в таймаут — честная ошибка',
      timeout.status === 'error',
      JSON.stringify(timeout),
    );

    // 6. Сеть пропала во время проверки — тоже ошибка, не «последняя версия».
    const broken: FakeRegistration = {
      waiting: null,
      installing: null,
      update: async () => {
        throw new TypeError('Failed to fetch');
      },
    };
    installFakeServiceWorker(broken);
    const failed = await checkForUpdate(100);
    check('checkForUpdate: update() упал — ошибка проверки', failed.status === 'error', JSON.stringify(failed));

    // 7. Нет сети: даже не спрашиваем воркер.
    let offlineCalls = 0;
    const offlineReg: FakeRegistration = {
      waiting: null,
      installing: null,
      update: async () => {
        offlineCalls += 1;
      },
    };
    installFakeServiceWorker(offlineReg, { online: false });
    const offline = await checkForUpdate(100);
    check(
      'checkForUpdate: без интернета — отдельный ответ и ни одного запроса',
      offline.status === 'offline' && offlineCalls === 0,
      `${JSON.stringify(offline)}; update() вызван ${offlineCalls} раз`,
    );

    // 8. Тот же ответ доходит до экрана: «последняя версия» без кнопки обновления.
    reg.waiting = null;
    reg.installing = null;
    installFakeServiceWorker(reg);
    click(btnText('Проверить обновления'));
    await sleep(80);
    check(
      'экран показывает «последняя версия» при отсутствии обновления',
      has('Установлена последняя версия') && !btnText('Обновить сейчас'),
      document.querySelector('.update-status')?.textContent?.slice(0, 200) ?? 'ответа нет',
    );

    // 9. Найденное обновление даёт кнопку «Обновить сейчас». Нажимать её в
    //    jsdom нельзя: настоящая перезагрузка страницы оборвёт прогон.
    installFakeServiceWorker({ ...reg, waiting: { state: 'installed' }, update: async () => {} });
    click(btnText('Проверить обновления'));
    await sleep(80);
    check(
      'экран показывает новую версию и кнопку «Обновить сейчас»',
      has('Доступно обновление') && !!btnText('Обновить сейчас'),
      document.querySelector('.update-status')?.textContent?.slice(0, 220) ?? 'ответа нет',
    );
    // 10. Сторож автообновлений (0.29.0): пока перезагружать нельзя — только
    //     запоминаем ожидание, ничего не применяя.
    const pendingReg: FakeRegistration = {
      waiting: { state: 'installed' },
      installing: null,
      update: async () => {},
    };
    installFakeServiceWorker(pendingReg);
    localStorage.removeItem('slovo2-update-pending');
    let stop = startUpdateWatch(() => false);
    document.dispatchEvent(new window.Event('visibilitychange'));
    await sleep(120);
    check('сторож обновлений: в неподходящий момент ничего не применяет', !localStorage.getItem('slovo2-update-applied'));
    check('сторож обновлений: ожидание запомнено', updatePending(), String(localStorage.getItem('slovo2-update-pending')));
    stop();

    // 11. Как только перезагружать безопасно — применяет и пишет версию для плашки.
    localStorage.removeItem('slovo2-update-pending');
    localStorage.removeItem('slovo2-update-applied');
    stop = startUpdateWatch(() => true);
    document.dispatchEvent(new window.Event('visibilitychange'));
    await sleep(120);
    check('сторож обновлений: в безопасный момент применяет обновление', !!localStorage.getItem('slovo2-update-applied'));
    check('сторож обновлений: применяет один раз и снимает ожидание', !updatePending());
    stop();

    // 12. Плашка «Обновили до версии» показывается один раз.
    const applied = takeAppliedVersion();
    check('после автообновления известна версия для плашки', applied === 'test', String(applied));
    check('плашка «Обновили» показывается один раз', takeAppliedVersion() === null);
    check(
      'ожидание обновления не висит вечно',
      FORCE_AFTER_MS === 24 * 60 * 60 * 1000,
      String(FORCE_AFTER_MS),
    );
  } finally {
    restoreNavigator(swDescriptor, onlineDescriptor);
    localStorage.removeItem('slovo2-update-pending');
    localStorage.removeItem('slovo2-update-applied');
  }
}
