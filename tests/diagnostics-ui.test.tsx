import { check, click, sleep } from './ui-helpers';

/** Диагностика доступна по прямой ссылке и не меняет URL целиком при закрытии. */
export async function runDiagnosticsRouteChecks(): Promise<void> {
  console.log('\n── Диагностика хранилища (?diag=1) ──');
  window.history.pushState({}, '', '/?keep=1&diag=1#check');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  await sleep(140);

  check(
    'diag=1 открывает экран диагностики напрямую',
    !!document.querySelector('.diag-screen') && (document.body.textContent ?? '').includes('Диагностика сохранения'),
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

  const close = document.querySelector('.diag-screen button') as HTMLButtonElement | null;
  click(close);
  await sleep(40);
  check(
    'закрытие диагностики убирает только diag=1 из адреса',
    window.location.search === '?keep=1' && window.location.hash === '#check' && !document.querySelector('.diag-screen'),
    `${window.location.search}${window.location.hash}`,
  );
}
