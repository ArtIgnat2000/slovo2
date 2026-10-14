/**
 * Ссылка на приложение и способы ею поделиться.
 *
 * Прогресс каждого ученика хранится локально на его устройстве, поэтому
 * «передать ссылку новому ученику» — это передать адрес самого приложения
 * (на GitHub Pages) или показать QR-код, чтобы его отсканировали с другого
 * телефона. Никаких аккаунтов и серверов для этого не нужно.
 */

/**
 * Канонический адрес приложения: то, что можно отправить в мессенджере.
 *
 * Обычно это адрес, по которому приложение сейчас открыто (`location.origin` +
 * база сборки): на GitHub Pages он и есть публичный. Если сборку специально
 * сделали с `VITE_PUBLIC_URL=https://…`, показываем этот адрес — так локальная
 * или временная сборка не подсудит родителю ссылку на `localhost`.
 */
export function appUrl(): string {
  // Читаем через объект с «?»: не во всякой среде сборки есть весь `import.meta.env`
  // (прод-сборка Vite подставляет его целиком, а наши esbuild-проверки — по ключу).
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const pinned = env?.VITE_PUBLIC_URL;
  if (typeof pinned === 'string' && pinned.trim() !== '') return pinned.trim();
  const base = typeof env?.BASE_URL === 'string' && env.BASE_URL ? env.BASE_URL : '/';
  if (typeof window === 'undefined') return base;
  try {
    return new URL(base, window.location.origin).href;
  } catch {
    return base;
  }
}

/** Короткая подпись ссылки для показа: «artignat2000.github.io/slovo2». */
export function linkLabel(url: string = appUrl()): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.host}${path}`;
  } catch {
    return url;
  }
}

export const SHARE_TITLE = 'СЛОВО 2.0 — словарные слова, 2 класс';

export function shareText(): string {
  return 'СЛОВО 2.0 — тренажёр словарных слов для 2 класса. Открой ссылку и добавь приложение на экран телефона: работает без интернета.';
}

/** Системное «Поделиться» есть не везде: на десктопе и в тестах его нет. */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'manual';

/**
 * Поделиться ссылкой: системное меню, а если его нет или родитель закрыл окно —
 * копируем ссылку в буфер (и, если и это недоступно, отдаём ссылку текстом).
 */
export async function shareApp(): Promise<ShareOutcome> {
  if (canNativeShare()) {
    try {
      await navigator.share({ title: SHARE_TITLE, text: shareText(), url: appUrl() });
      return 'shared';
    } catch (error) {
      const name = (error as { name?: string } | undefined)?.name;
      // Родитель закрыл окно — это не ошибка, ничего дополнительно не показываем.
      if (name === 'AbortError' || name === 'NotAllowedError') return 'cancelled';
      // Любая другая осечка (нет подходящего приложения и т.п.) — уходим к копированию.
    }
  }
  return copyAppLink();
}

/** Копирование ссылки: сначала Clipboard API, затем старый способ, затем текст. */
export async function copyAppLink(): Promise<ShareOutcome> {
  const url = appUrl();
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return 'copied';
    }
  } catch {
    /* переходим к запасному способу */
  }
  try {
    if (typeof document !== 'undefined') {
      const area = document.createElement('textarea');
      area.value = url;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
      document.body.removeChild(area);
      if (ok) return 'copied';
    }
  } catch {
    /* остаётся ручной способ: показываем ссылку текстом */
  }
  return 'manual';
}
