import { registerSW } from 'virtual:pwa-register';

/**
 * Возможные ответы ручной проверки обновления.
 *
 * Важно не смешивать «обновления нет» и «проверить не удалось»: во втором
 * случае нельзя говорить родителю, что версия последняя. Поэтому состояний
 * пять, а не два:
 *  • current     — сайт ответил, новой сборки нет;
 *  • available   — новая сборка уже установлена и ждёт включения;
 *  • offline     — сети нет, спрашивать некого;
 *  • unavailable — страница открыта без сервис-воркера (например, npm run dev);
 *  • error       — сеть есть, но проверка сорвалась (сервер, таймаут, установка).
 */
export type UpdateCheckResult =
  | { status: 'current' }
  | { status: 'available' }
  | { status: 'offline' }
  | { status: 'unavailable' }
  | { status: 'error' };

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
/** Регистрация воркера: через неё вручную спрашиваем браузер о новой сборке. */
let registration: ServiceWorkerRegistration | null = null;
/** Перезагрузку по смене контроллера ставим один раз, сколько бы раз ни нажали. */
let reloadOnControllerChange = false;

export function initPWA(onUpdate: () => void) {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: onUpdate,
    // Без этой ссылки ручная проверка работала бы только через
    // navigator.serviceWorker.getRegistration(), а в момент запуска
    // регистрация ещё может быть не видна.
    onRegisteredSW(_swUrl, reg) {
      registration = reg ?? null;
    },
  });
}

/**
 * Применить найденное обновление: попросить новый воркер включиться и
 * перезагрузить страницу.
 *
 * Перезагрузку ждём по событию `controllerchange`, а не только по событию
 * workbox: страница могла не получить `waiting` (например, новый воркер
 * появился во время ручной проверки), и тогда стандартный обработчик
 * перезагрузки не был бы подписан. Событие срабатывает ровно один раз —
 * после того как новый воркер забрал управление.
 */
export function applyUpdate() {
  if (!reloadOnControllerChange && 'serviceWorker' in navigator) {
    reloadOnControllerChange = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  }
  void updateSW?.(true);
}

/**
 * Дождаться установки нового воркера.
 *
 * `registration.update()` отдаёт управление сразу после скачивания sw.js,
 * а установка (precache изменённых файлов) идёт следом. Кнопку «Обновить»
 * показываем только когда воркер уже ждёт включения, иначе нажатие уходило бы
 * в пустоту.
 */
function waitForWorker(worker: ServiceWorker, timeoutMs: number): Promise<'installed' | 'redundant' | 'timeout'> {
  if (worker.state === 'installed' || worker.state === 'activated') return Promise.resolve('installed');
  if (worker.state === 'redundant') return Promise.resolve('redundant');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: 'installed' | 'redundant' | 'timeout') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeEventListener('statechange', onChange);
      resolve(value);
    };
    const onChange = () => {
      if (worker.state === 'installed' || worker.state === 'activated') finish('installed');
      else if (worker.state === 'redundant') finish('redundant');
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    worker.addEventListener('statechange', onChange);
    // Состояние могло измениться между проверкой выше и подпиской.
    onChange();
  });
}

/** Воркер, который уже готов заменить текущий (и страницей управляет старый). */
function hasWaitingUpdate(reg: ServiceWorkerRegistration): boolean {
  return !!navigator.serviceWorker.controller && !!reg.waiting;
}

/**
 * Проверить обновление вручную (кнопка в «Родителям» → «Приложение»).
 *
 * Приложение и так проверяет обновление при запуске, но установленный ярлык
 * может неделями не закрываться. `registration.update()` заново скачивает
 * sw.js в обход кэша; если файл изменился (в него попадают хеши всех файлов
 * сборки), браузер ставит новый воркер — он и будет обновлением.
 *
 * `timeoutMs` ограничивает ожидание установки: на медленной сети лучше честно
 * сказать «не удалось проверить», чем держать кнопку в «Проверяем…» минуту.
 */
export async function checkForUpdate(timeoutMs = 20_000): Promise<UpdateCheckResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return { status: 'unavailable' };
  if (navigator.onLine === false) return { status: 'offline' };

  let reg = registration;
  if (!reg) {
    try {
      reg = (await navigator.serviceWorker.getRegistration()) ?? null;
    } catch {
      reg = null;
    }
  }
  if (!reg) return { status: 'unavailable' };

  // Новый воркер уже ждёт (например, плашку «Доступно обновление» не приняли).
  // Если страницей не управляет воркер, она только что пришла из сети —
  // значит, показанный код и есть последняя версия.
  if (hasWaitingUpdate(reg)) return { status: 'available' };

  try {
    await reg.update();
  } catch {
    // Сеть могла пропасть между проверкой navigator.onLine и запросом.
    return { status: 'error' };
  }

  if (hasWaitingUpdate(reg)) return { status: 'available' };

  const installing = reg.installing;
  if (!installing) return { status: 'current' };

  const installed = await waitForWorker(installing, timeoutMs);
  if (installed === 'timeout') return { status: 'error' };
  // Сорвавшаяся установка — не «последняя версия»: файлы могли не докачаться.
  if (installed === 'redundant') return { status: 'error' };
  return hasWaitingUpdate(reg) ? { status: 'available' } : { status: 'current' };
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

/** Показываем подсказку «добавить на экран» только один раз. */
export function shouldSuggestInstall(): boolean {
  if (isStandalone()) return false;
  try {
    return !localStorage.getItem('slovo2-install-hint');
  } catch {
    return false;
  }
}

export function markInstallHintShown() {
  try {
    localStorage.setItem('slovo2-install-hint', '1');
  } catch {
    /* ignore */
  }
}
