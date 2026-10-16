/**
 * Прогон синтезатора без браузера: Web Audio заменён заглушкой, которая считает
 * запланированные голоса. Ни typecheck, ни смоук этого не ловят — в jsdom
 * AudioContext нет, поэтому `audio()` молча возвращает null и луп «играет»
 * в пустоту. Здесь проверяется то, что слышно: каждый трек каталога реально
 * расписывает ноты и ударные, а в контексте «урок» звучит реже, чем «награда».
 */
import assert from 'node:assert/strict';
import { LESSON_BPM_CAP, MUSIC_TRACKS, playbackFor } from '../src/engine/music';
import { getMusicContext, playMusic, setMusicContext, stopMusic } from '../src/platform/music';

let scheduled = 0;
let lastCtx: FakeCtx | null = null;

class FakeParam {
  value = 0;
  setValueAtTime(v: number, t: number) { check(v, t); return this; }
  linearRampToValueAtTime(v: number, t: number) { check(v, t); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { assert.ok(v > 0, 'экспонента в ноль не ramp-ится'); check(v, t); return this; }
  setTargetAtTime(v: number, t: number) { check(v, t); return this; }
  cancelScheduledValues() { return this; }
}
function check(v: number, t: number) {
  assert.ok(Number.isFinite(v), `параметр не число: ${v}`);
  assert.ok(Number.isFinite(t) && t >= 0, `время планирования вне аудио-часов: ${t}`);
}
class FakeNode {
  type = 'sine';
  detune = new FakeParam();
  frequency = new FakeParam();
  gain = new FakeParam();
  // микшерная шина 2.0: дилей, панорама, компрессор, фильтры
  delayTime = new FakeParam();
  pan = new FakeParam();
  playbackRate = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  curve: Float32Array | null = null;
  oversample = 'none';
  buffer: unknown = null;
  loop = false;
  connect(target: unknown) { assert.ok(target, 'connect() в никуда'); return this; }
  start(t: number) { scheduled++; check(0, t); }
  stop(t: number) { check(0, t); }
}
class FakeBuffer {
  constructor(readonly channels: number, readonly length: number, readonly sampleRate: number) {}
  getChannelData(channel: number) {
    assert.ok(channel < this.channels, 'канала нет в буфере');
    return new Float32Array(this.length);
  }
}
class FakeCtx {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  constructor() { lastCtx = this; }
  createOscillator() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createStereoPanner() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
  createConvolver() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createDelay() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createBuffer(channels: number, length: number, sampleRate: number) {
    assert.ok(length > 0 && sampleRate > 0, 'буфер ненулевой');
    return new FakeBuffer(channels, length, sampleRate);
  }
  resume() { return Promise.resolve(); }
}

const realWindow = (globalThis as { window?: unknown }).window;
const realInterval = globalThis.setInterval;
const realClear = globalThis.clearInterval;
let tick: (() => void) | null = null;

(globalThis as any).window = { AudioContext: FakeCtx };
(globalThis as any).setInterval = (fn: () => void) => { tick = fn; return 1 as unknown as ReturnType<typeof setInterval>; };
(globalThis as any).clearInterval = () => { tick = null; };

/** Прокручиваем планировщик на `seconds` аудио-времени от текущего момента. */
function runFor(seconds: number) {
  const ctx = lastCtx;
  assert.ok(ctx && tick, 'луп не запустился');
  const before = scheduled;
  const until = ctx!.currentTime + seconds;
  while (ctx!.currentTime < until) {
    ctx!.currentTime += 0.045;
    tick!();
  }
  return scheduled - before;
}

try {
  assert.equal(getMusicContext(), 'reward', 'по умолчанию музыка звучит целиком');

  const WINDOW = 8; // секунд аудио-времени: самый медленный трек (60 BPM) успевает сыграть 2 такта
  for (const track of MUSIC_TRACKS) {
    // Награда: трек обязан звучать — ни одного молчаливого трека в каталоге
    scheduled = 0;
    playMusic(track, 'reward');
    const rewardVoices = runFor(WINDOW);
    assert.ok(rewardVoices > 20, `${track.id}: на награде почти ничего не звучит (${rewardVoices} голосов)`);

    // Урок: не плотнее, чем на награде, а для быстрого трека — заметно реже
    scheduled = 0;
    setMusicContext('lesson');
    assert.equal(getMusicContext(), 'lesson');
    const lessonVoices = runFor(WINDOW);
    assert.ok(lessonVoices <= rewardVoices, `${track.id}: в уроке плотнее, чем на награде (${lessonVoices} > ${rewardVoices})`);
    if (playbackFor(track, 'lesson').bpm < track.bpm) {
      assert.ok(lessonVoices < rewardVoices, `${track.id}: темп в уроке ниже, а голосов не меньше (${lessonVoices} против ${rewardVoices})`);
    }
    stopMusic();
    setMusicContext('reward');
  }

  // Самый быстрый трек каталога в уроке упирается в потолок темпа: за то же
  // аудио-время шагов вдвое меньше, поэтому и голосов заметно меньше.
  const punk = MUSIC_TRACKS.find((t) => t.bpm === Math.max(...MUSIC_TRACKS.map((x) => x.bpm)))!;
  assert.equal(playbackFor(punk, 'lesson').bpm, LESSON_BPM_CAP, 'быстрый тренд замедляется в уроке');
  scheduled = 0;
  playMusic(punk, 'lesson');
  const punkLesson = runFor(WINDOW);
  stopMusic();
  scheduled = 0;
  playMusic(punk, 'reward');
  const punkReward = runFor(WINDOW);
  stopMusic();
  assert.ok(punkLesson < punkReward * 0.8, `в уроке ${punk.id} должен звучать существенно реже (${punkLesson} против ${punkReward})`);

  console.log(`✓ синтезатор: все ${MUSIC_TRACKS.length} треков расписывают звук, в уроке тише и реже, время планирования корректно`);
} finally {
  (globalThis as any).window = realWindow;
  globalThis.setInterval = realInterval;
  globalThis.clearInterval = realClear;
}
