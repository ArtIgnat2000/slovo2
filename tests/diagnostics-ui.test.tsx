import { check, click, sleep } from './ui-helpers';

/** Прямая ссылка остаётся рабочей наряду с кнопкой внутри установленного PWA. */
export async function runDiagnosticsRouteChecks(): Promise<void> {
  console.log('\n── Диагностика приложения (?diag=1) ──');
  const originalAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Linux; Android 14) SamsungBrowser/30.0 Chrome/130 Mobile Safari/537.36',
  });
  window.history.pushState({}, '', '/?keep=1&diag=1#check');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  await sleep(140);

  check(
    'diag=1 открывает экран диагностики напрямую',
    !!document.querySelector('.diag-screen') && (document.body.textContent ?? '').includes('Диагностика приложения'),
    document.querySelector('.screen')?.textContent?.slice(0, 180) ?? 'экран не появился',
  );
  check(
    'диагностика показывает IndexedDB и размер записи',
    (document.body.textContent ?? '').includes('IndexedDB') && (document.body.textContent ?? '').includes('Размер записи'),
    document.querySelector('.diag-screen')?.textContent?.slice(0, 260) ?? '',
  );
  check(
    'сводка не содержит имён профилей',
    !Array.from(document.querySelectorAll('.diag-screen b')).some((node) => ['Тест', 'Тест пазлов', 'Задания'].includes(node.textContent ?? '')),
    'в сводке не должно быть пользовательских имён',
  );
  // CSS показывает выбор приложения, но не обязательно итоговые пиксели
  // Samsung Internet — отсутствие признака Auto Dark нельзя назвать «нет».
  check(
    'диагностика показывает браузер ярлыка, выбранную палитру и предел проверки',
    (document.body.textContent ?? '').includes('Проверка Auto Dark') &&
      (document.body.textContent ?? '').includes('Открыто') &&
      (document.body.textContent ?? '').includes('Выбранная палитра CSS') &&
      (document.body.textContent ?? '').includes('Отрицательная проверка не означает, что перекраски нет'),
    document.querySelector('.diag-screen')?.textContent?.slice(0, 260) ?? '',
  );
  check(
    'Samsung Internet не получает ложное «перекраски нет»',
    (document.querySelector('[aria-label="Тема оформления"]')?.textContent ?? '').includes('Samsung Internet') &&
      (document.querySelector('[aria-label="Тема оформления"]')?.textContent ?? '').includes('не определяется этой проверкой') &&
      (document.querySelector('[aria-label="Тема оформления"]')?.textContent ?? '').includes('нужно включить'),
    document.querySelector('[aria-label="Тема оформления"]')?.textContent?.slice(0, 250) ?? '',
  );
  const summaryButton = Array.from(document.querySelectorAll('.diag-screen button')).find((b) =>
    b.textContent?.includes('Скопировать сводку'),
  );
  click(summaryButton);
  await sleep(30);
  check(
    'сводка содержит браузер и user-agent, но не имена учеников',
    (document.querySelector('.diag-copy pre')?.textContent ?? '').includes('SamsungBrowser/30.0') &&
      (document.querySelector('.diag-copy pre')?.textContent ?? '').includes('режим:') &&
      !(document.querySelector('.diag-copy pre')?.textContent ?? '').includes('Тест пазлов'),
    document.querySelector('.diag-copy pre')?.textContent?.slice(0, 200) ?? '',
  );

  const close = document.querySelector('.diag-screen button') as HTMLButtonElement | null;
  click(close);
  await sleep(40);
  check(
    'закрытие диагностики убирает только diag=1 из адреса',
    window.location.search === '?keep=1' && window.location.hash === '#check' && !document.querySelector('.diag-screen'),
    `${window.location.search}${window.location.hash}`,
  );
  if (originalAgent) Object.defineProperty(navigator, 'userAgent', originalAgent);
  else delete (navigator as unknown as { userAgent?: string }).userAgent;
}
