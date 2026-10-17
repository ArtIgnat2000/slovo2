/**
 * Прогон плеера файловой музыки без браузера: HTMLAudioElement подменяется
 * заглушкой, которая считает вызовы play/pause и хранит громкость. Здесь
 * проверяется то, что слышно и ощущается: контекст «урок тише», приглушение
 * для SFX/озвучки, автополитика браузера (нет звука до жеста — и старт после),
 * выключение музыки и прогрев файлов в офлайн-кэше.
 */
import assert from 'node:assert/strict';
import { LESSON_VOLUME, MUSIC_TRACKS, STARTER_TRACK_IDS } from '../src/engine/music';
import {
  currentTrackId,
  duckMusic,
  getMusicContext,
  getMusicVolume,
  playMusic,
  setMusicContext,
  setMusicEnabled,
  setMusicVolume,
  stopMusic,
  warmTracks,
} from '../src/platform/music';

class FakeAudio {
  src = '';
  loop = false;
  preload = 'auto';
  volume = 1;
  paused = true;
  playCalls = 0;
  pauseCalls = 0;
  /** Режим автополитики: play() отклоняется до первого жеста (как в iOS Safari). */
  rejectPlay: { name: string } | null = null;
  play(): Promise<void> {
    this.playCalls++;
    if (this.rejectPlay) {
      const err = this.rejectPlay;
      this.rejectPlay = null;
      return Promise.reject(err);
    }
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.pauseCalls++;
    this.paused = true;
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
}

const realWindow = (globalThis as { window?: unknown }).window;
const realDocument = (globalThis as { document?: unknown }).document;
const realFetch = (globalThis as { fetch?: unknown }).fetch;

const listeners = new Map<string, Set<() => void>>();
const audios: FakeAudio[] = [];
const fetchUrls: string[] = [];

(globalThis as any).window = {
  addEventListener: (type: string, fn: () => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
};
(globalThis as any).document = {
  baseURI: 'https://app.test/slovo2/',
  createElement: (tag: string) => {
    assert.equal(tag, 'audio', 'плеер создаёт ровно один аудиоэлемент');
    const el = new FakeAudio();
    audios.push(el);
    return el as unknown as HTMLAudioElement;
  },
};
(globalThis as any).fetch = (url: string) => {
  fetchUrls.push(String(url));
  return Promise.resolve({ ok: true });
};

function fire(type: string) {
  for (const fn of listeners.get(type) ?? []) fn();
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const lastAudio = () => audios[audios.length - 1];

try {
  const calm = MUSIC_TRACKS.find((t) => t.id === STARTER_TRACK_IDS[0])!;

  // ── Запуск: один элемент, src по id файла, бесконечный луп ────────────────
  playMusic(calm, 'reward');
  const el = lastAudio();
  assert.ok(el, 'плеер создал аудиоэлемент');
  assert.equal(currentTrackId(), calm.id);
  assert.equal(el.src, `https://app.test/slovo2/audio/${calm.id}.mp3`, 'файл берётся из public/audio по baseURI');
  assert.equal(el.loop, true, 'музыка зациклена');
  assert.equal(el.paused, false, 'воспроизведение запущено');
  assert.equal(getMusicContext(), 'reward');

  // ── Громкость: мастер × контекст; урок заметно тише ───────────────────────
  setMusicVolume(0.8);
  assert.equal(getMusicVolume(), 0.8);
  assert.equal(el.volume, 0.8, 'на награде громкость = мастер');
  setMusicContext('lesson');
  assert.equal(el.volume, 0.8 * LESSON_VOLUME, 'в уроке музыка тише (контекст)');
  assert.ok(el.volume < 0.5, 'в уроке умеренная громкость');

  // ── Приглушение для SFX и будущей озвучки слов ────────────────────────────
  const beforeDuck = el.volume;
  duckMusic(40);
  assert.ok(el.volume < beforeDuck * 0.5, 'музыка отступает на время речи/эффекта');
  await sleep(80);
  assert.equal(el.volume, beforeDuck, 'после паузы громкость возвращается');
  setMusicContext('reward');

  // ── Тот же трек не перезапускается, другой — переключается ────────────────
  const playsBefore = el.playCalls;
  playMusic(calm);
  assert.equal(lastAudio(), el, 'элемент переиспользуется');
  assert.equal(el.playCalls, playsBefore, 'играющий трек не стартует заново');
  const other = MUSIC_TRACKS.find((t) => t.id === 'pixelland')!;
  playMusic(other);
  assert.equal(currentTrackId(), other.id);
  assert.equal(el.src, `https://app.test/slovo2/audio/${other.id}.mp3`, 'смена трека обновляет src того же элемента');

  // ── Стоп и выключение музыки ──────────────────────────────────────────────
  stopMusic();
  assert.equal(currentTrackId(), null);
  assert.ok(lastAudio().pauseCalls > 0, 'stopMusic ставит паузу');
  setMusicEnabled(false);
  playMusic(calm);
  assert.equal(currentTrackId(), null, 'выключенная музыка не играет');
  setMusicEnabled(true);

  // ── Автополитика: play() отклонён → старт после первого жеста ─────────────
  const autoplay = MUSIC_TRACKS.find((t) => t.id === 'easy-lemon')!;
  const before = lastAudio();
  before.rejectPlay = { name: 'NotAllowedError' };
  before.paused = true;
  playMusic(autoplay);
  assert.equal(currentTrackId(), autoplay.id, 'трек выбран и ждёт жеста');
  await sleep(10); // отклонение play() приходит асинхронно — как в браузере
  assert.ok(before.paused, 'без жеста звук не запускается');
  fire('pointerdown'); // первый тап ребёнка
  await sleep(10);
  assert.equal(before.paused, false, 'после жеста музыка стартует');
  assert.equal(listeners.get('pointerdown')?.size ?? 0, 0, 'слушатель жеста снят');
  stopMusic();

  // ── Прогрев офлайн-кэша: стартовые и купленные треки подгружаются в фоне ──
  fetchUrls.length = 0;
  const realSetTimeout = globalThis.setTimeout;
  (globalThis as any).setTimeout = (fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  };
  try {
    warmTracks(MUSIC_TRACKS.filter((t) => STARTER_TRACK_IDS.includes(t.id)));
  } finally {
    (globalThis as any).setTimeout = realSetTimeout;
  }
  assert.equal(fetchUrls.length, 2, 'прогреваются оба стартовых трека');
  assert.ok(fetchUrls.every((u) => u.endsWith('.mp3')), 'греются именно аудиофайлы');

  console.log('✓ плеер музыки: файлы из public/audio, «урок тише», приглушение, автозапуск после жеста, стоп и офлайн-прогрев');
} finally {
  (globalThis as any).window = realWindow;
  (globalThis as any).document = realDocument;
  if (realFetch === undefined) delete (globalThis as { fetch?: unknown }).fetch;
  else (globalThis as any).fetch = realFetch;
}
