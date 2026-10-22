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

// ── Автоматическое обновление без участия родителей (0.29.0) ────────────────
//
// Проблема: ярлык на телефоне может не закрываться неделями. Приложение
// проверяло обновление только при запуске, а найденную сборку ждало нажатия
// «Обновить» — ребёнок плашку не замечал и оставался на старой версии.
//
// Решение: спрашиваем браузер регулярно и применяем обновление сами, но только
// в безопасный момент. Применение = перезагрузка страницы, поэтому:
//  • не во время урока (там своё состояние и незаконченное задание);
//  • не когда открыт лист/диалог (ребёнок читает или выбирает);
//  • не когда родитель в «Родителях» (мог вводить данные).
// Если момент неподходящий — запоминаем и применяем на первом же безопасном.

/** Как часто переспрашивать браузер, пока приложение открыто, мс. */
const WATCH_INTERVAL_MS = 30 * 60_000;
/**
 * Сколько обновление может ждать в `waiting`, прежде чем применим его
 * принудительно. Неделями висеть на старой версии нельзя: в старом коде
 * могут быть ошибки, а новый контент ребёнок не увидит.
 */
export const FORCE_AFTER_MS = 24 * 60 * 60 * 1000;

const PENDING_KEY = 'slovo2-update-pending';
/** Плашка «Обновили» после перезагрузки: показываем один раз. */
const APPLIED_KEY = 'slovo2-update-applied';

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* приватный режим — обновление всё равно сработает, просто без плашки */
  }
}

/** Обновление уже ждёт включения. */
export function updatePending(): boolean {
  return readStore(PENDING_KEY) !== null;
}

/**
 * Версия, до которой только что обновились, — один раз после перезагрузки.
 * `null`, если обновления не было (или плашку уже показали).
 */
export function takeAppliedVersion(): string | null {
  const v = readStore(APPLIED_KEY);
  if (v !== null) writeStore(APPLIED_KEY, null);
  return v;
}

/**
 * Перезагрузка ради обновления. Перед ней фиксируем, до какой версии
 * обновились: после перезагрузки покажем «Обновили до vX» и снимем ожидание.
 */
export function applyUpdateNow() {
  writeStore(PENDING_KEY, null);
  const version = (import.meta as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION;
  if (version) writeStore(APPLIED_KEY, version);
  applyUpdate();
}

type SafeCheck = () => boolean;

/**
 * Сторож обновлений.
 *
 * `canApply` — «сейчас безопасно перезагрузить». Возвращает функцию остановки.
 * Проверяем: сразу при запуске (после первой отрисовки), при возврате в
 * приложение, при появлении сети и раз в 30 минут.
 */
export function startUpdateWatch(canApply: SafeCheck, onPending?: (p: boolean) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;

  let stopped = false;
  /** Ожидание в `waiting` началось — для принудительного применения через сутки. */
  let waitingSince = updatePending() ? Date.now() : 0;

  const markPending = (waiting: boolean) => {
    if (waiting && !waitingSince) waitingSince = Date.now();
    if (!waiting) waitingSince = 0;
    writeStore(PENDING_KEY, waiting ? String(waitingSince) : null);
    onPending?.(waiting);
  };

  const currentReg = async (): Promise<ServiceWorkerRegistration | null> => {
    if (registration) return registration;
    try {
      return (await navigator.serviceWorker.getRegistration()) ?? null;
    } catch {
      return null;
    }
  };

  const applyIfSafe = (reg: ServiceWorkerRegistration) => {
    if (stopped || !reg.waiting) return;
    const overdue = waitingSince > 0 && Date.now() - waitingSince > FORCE_AFTER_MS;
    if (!canApply() && !overdue) {
      markPending(true);
      return;
    }
    applyUpdateNow();
  };

  const probe = async (allowApply: boolean) => {
    if (stopped) return;
    const reg = await currentReg();
    if (!reg) return;
    // Уже ждёт — не сеть не нужна, решаем сразу.
    if (reg.waiting) {
      if (allowApply) applyIfSafe(reg);
      return;
    }
    if (navigator.onLine === false) return;
    try {
      await reg.update();
    } catch {
      return; // сеть пропала — попробуем в следующий раз, молча
    }
    if (stopped) return;
    if (reg.waiting && allowApply) applyIfSafe(reg);
  };

  // Момент «вернулись в приложение» — самое частое и самое безопасное окно.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void probe(true);
  };
  // Появилась сеть: сразу проверяем, ждать 30 минут незачем.
  const onOnline = () => void probe(true);

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);

  // Первая проверка — не в первом кадре: даём приложению дорисоваться и
  // прочитать сохранение. На старте перезагрузка безопасна: ребёнок ещё
  // ничего не начал, поэтому здесь можно и применять.
  const first = setTimeout(() => void probe(true), 6000);
  // Раз в 30 минут проверяем «изнутри»; применяем только при следующей
  // безопасной возможности, поэтому здесь allowApply = true.
  const timer = setInterval(() => void probe(true), WATCH_INTERVAL_MS);

  return () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}
