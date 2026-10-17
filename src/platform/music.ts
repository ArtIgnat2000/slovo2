/**
 * Плеер фоновой музыки: локальные MP3 из public/audio/ (см. engine/music.ts).
 *
 * Почему файлы, а не синтез: каталог — профессиональные записи Kevin MacLeod
 * (CC BY 4.0, официальный источник — incompetech.com, «Авторы и лицензии» в
 * приложении). Файлы лежат рядом с приложением и кэшируются сервис-воркером:
 * после установки PWA музыка играет без интернета.
 *
 * Мобильные правила (здесь всё учтено):
 *  • никакого автозапуска до действия пользователя: если браузер отклонил
 *    play() (autoplay policy), плеер ждёт первого жеста и повторяет запуск;
 *  • умеренная громкость по умолчанию (setMusicVolume, настройка «Громкость
 *    музыки»); в уроке — ещё тише (контекст, playbackFor);
 *  • «приглушение» (duckMusic) на время звуковых эффектов и будущей озвучки
 *    слов: музыка не должна мешать речи и коротким сигналам;
 *  • один HTMLAudioElement: предсказуемо для iOS/Android, без декодирования
 *    трека в память.
 */

import { audioFileOf, contextVolume, type MusicContext, type MusicTrack } from '../engine/music';

let el: HTMLAudioElement | null = null;
let activeId: string | null = null;
let scene: MusicContext = 'reward';
let enabled = true;
/** Мастер-громкость музыки (0..1). Умеренная по умолчанию: фон, не концерт. */
let master = 0.55;
/** Множитель приглушения: 1 — обычная громкость, <1 — музыка отступает на время речи/SFX. */
let duckFactor = 1;
let duckTimer: ReturnType<typeof setTimeout> | null = null;
/** Ждём первого жеста: play() отклонили политикой автозапуска. */
let waitingGesture: (() => void) | null = null;

function createEl(): HTMLAudioElement | null {
  try {
    if (typeof document !== 'undefined') return document.createElement('audio');
    if (typeof Audio !== 'undefined') return new Audio();
  } catch {
    /* окружение без аудио (тесты без заглушек) — плеер молчит */
  }
  return null;
}

function srcOf(track: MusicTrack): string {
  const file = audioFileOf(track);
  if (typeof document !== 'undefined' && document.baseURI) {
    try {
      return new URL(file, document.baseURI).href;
    } catch {
      /* падаем на абсолютный путь ниже */
    }
  }
  return `/${file}`;
}

/** Итоговая громкость: мастер × контекст × приглушение. */
function effectiveVolume(): number {
  return Math.min(1, Math.max(0, master * contextVolume(scene) * duckFactor));
}

function applyVolume() {
  if (el) el.volume = effectiveVolume();
}

function dropGestureWait() {
  if (!waitingGesture) return;
  const handler = waitingGesture;
  waitingGesture = null;
  for (const evt of ['pointerdown', 'touchend', 'click', 'keydown']) {
    window.removeEventListener(evt, handler, true);
  }
}

function armGestureRetry() {
  if (waitingGesture || typeof window === 'undefined') return;
  const handler = () => {
    dropGestureWait();
    if (el && activeId && enabled) {
      try {
        void el.play()?.catch(() => undefined);
      } catch {
        /* браузер без play() — плеер молчит */
      }
    }
  };
  waitingGesture = handler;
  for (const evt of ['pointerdown', 'touchend', 'click', 'keydown']) {
    window.addEventListener(evt, handler, true);
  }
}

function playEl() {
  if (!el) return;
  try {
    const p = el.play();
    // Автополитика браузера: до первого жеста звук запрещён. Ждём жеста и повторяем.
    void p?.catch((err: unknown) => {
      const name = (err as { name?: string } | null)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') armGestureRetry();
    });
  } catch {
    /* jsdom и другие окружения без play() — не мешаем тестам */
  }
}

/** Меняет контекст звучания на лету: урок тише, награда в полную силу. */
export function setMusicContext(next: MusicContext) {
  scene = next;
  applyVolume();
}

export function getMusicContext(): MusicContext {
  return scene;
}

/** Мастер-громкость музыки (0..1). Ползунок в настройках родителя. */
export function setMusicVolume(value: number) {
  master = Math.min(1, Math.max(0, value));
  applyVolume();
}

export function getMusicVolume(): number {
  return master;
}

/**
 * Приглушить музыку на время звукового эффекта или будущей озвучки слов.
 * Возвращается к обычной громкости через `ms` (или сразу — при новом вызове).
 */
export function duckMusic(ms = 1200) {
  duckFactor = 0.3;
  applyVolume();
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckTimer = null;
    duckFactor = 1;
    applyVolume();
  }, ms);
}

/** Выключить музыку целиком (настройка «Музыка»); звуковые эффекты не трогает. */
export function setMusicEnabled(value: boolean) {
  enabled = value;
  if (!value) stopMusic();
}

/** Текущий трек (id) или null — для проверок и интерфейса. */
export function currentTrackId(): string | null {
  return activeId;
}

/**
 * Запускает бесконечное воспроизведение трека после действия пользователя
 * (или готовит автозапуск после первого жеста). `null` — выключить музыку.
 */
export function playMusic(track: MusicTrack | null, sceneName: MusicContext = scene) {
  if (!track || !enabled) {
    stopMusic();
    return;
  }
  scene = sceneName;
  if (activeId === track.id && el) {
    applyVolume();
    if (el.paused) playEl();
    return;
  }
  dropGestureWait();
  if (!el) el = createEl();
  if (!el) return;
  activeId = track.id;
  el.src = srcOf(track);
  el.loop = true;
  el.preload = 'auto';
  applyVolume();
  playEl();
}

/** Останавливает музыку (пауза + сброс выбора). */
export function stopMusic() {
  dropGestureWait();
  activeId = null;
  if (duckTimer) {
    clearTimeout(duckTimer);
    duckTimer = null;
    duckFactor = 1;
  }
  if (el) {
    try {
      el.pause();
    } catch {
      /* окружение без pause() */
    }
    el.removeAttribute?.('src');
  }
}

/**
 * Прогревает файлы в кэше сервис-воркера (они должны играть офлайн):
 * стартовые и купленные треки подгружаются в фоне после загрузки приложения,
 * остальные — после покупки/прослушивания. Ничего не ждём и не мешаем UI.
 */
export function warmTracks(tracks: readonly MusicTrack[]) {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') return;
  const pending = tracks.filter((t): t is MusicTrack => Boolean(t?.id));
  let i = 0;
  const step = () => {
    const track = pending[i++];
    if (!track) return;
    void fetch(srcOf(track), { cache: 'force-cache' }).catch(() => undefined);
    if (i < pending.length) setTimeout(step, 1500);
  };
  setTimeout(step, 800);
}
