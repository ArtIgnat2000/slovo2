import { playbackFor, type MusicContext, type MusicTrack } from '../engine/music';

/**
 * Синтезатор фоновой музыки, версия 2.0 («как настоящий трек»).
 *
 * Всё по-прежнему рождается из кода: ноль аудиофайлов, ноль чужих песен, офлайн
 * (правило каталога — engine/music.ts). Но «примитивность» версии 1 была не в
 * нотах, а в тракте: осциллятор → громкость → выход. Так звучит открытка
 * из 2004-го. Профессиональный звук даёт ТРАКТ и звукоизвлечение, поэтому здесь:
 *
 *  • FM-синтез (как в DX7): электропиано, колокола, плюк — тембр рождается
 *    из модуляции частоты, а не из одиночного осциллятора;
 *  • суперпила: пучок расстроенных пил через общий фильтр — та самая «стена»
 *    из танцевальных треков;
 *  • ударные из синтезированного шума с фильтрами: бочка с питч-огибающей
 *    и кликом, рабочий с тоном и шумом, металлические хэты, хлопок из трёх
 *    вспышек, ковбелл через bandpass — как в драм-машинах 808/909;
 *  • МИКШЕРНАЯ ШИНА: склейка-компрессор (DynamicsCompressor), мягкий клиппер,
 *    реверберация от сгенерированного импульса (ConvolverNode + свой IR),
 *    дилей с обратной связью и фильтром, сайдчейн — бочка «прокачивает»
 *    бас и аккорды, стерео-панорама по голосам;
 *  • аранжировка: луп 8 тактов с филлами (4-й и 8-й), крэшем и райзером,
 *    аккорды с красками (7/9), человеческие микро-сдвиги тайминга и громкости
 *    (сид-генератор — детерминированно, проверки стабильны).
 *
 * Решения 0.13.0 сохранены: аранжировка описана ТАБЛИЦЕЙ грувов (новый жанр —
 * одна строка данных, registerGrooves() даёт добавлять грувы снаружи), и у
 * трека есть контекст «урок/награда» (playbackFor): в уроке темп ≤ 90, ударные
 * тише, яркие тембры и крэши молчат, посылы реверба ужимаются.
 */

let context: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let activeId: string | null = null;
let nextStep = 0;
let nextAt = 0;
let loopLen = 128;
/** Номер прохода лупа: фразы дышат по-новому на каждом круге (детерминированно). */
let loopCycle = 0;
let enabled = true;
let scene: MusicContext = 'reward';
let volume = 0.62;

/** Меняет контекст звучания на лету: луп не перезапускается, правила подхватываются со следующего шага. */
export function setMusicContext(next: MusicContext) {
  scene = next;
}

export function getMusicContext(): MusicContext {
  return scene;
}

/**
 * Для лаборатории: мастер-шина как MediaStream. Пишется ровно тот сигнал,
 * что идёт в колонки (после трима, лимитера и master) — файл можно слушать
 * вне приложения и прикладывать к разбору качества.
 */
export function recordingStream(): MediaStream | null {
  const ctx = audio();
  if (!ctx || !mix) return null;
  const dest = ctx.createMediaStreamDestination();
  mix.master.connect(dest);
  return dest.stream;
}

/** Общая громкость музыки (0..1): ползунок в лаборатории и будущих настройках. */
export function setMusicVolume(value: number) {
  volume = Math.min(1, Math.max(0, value));
  if (mix) mix.master.gain.setTargetAtTime(volume, context?.currentTime ?? 0, 0.05);
}

// ── Микшерная шина ──────────────────────────────────────────────────────────

interface Mix {
  /** Сумма всех голосов до обработки. */
  sum: GainNode;
  /** Сайдчейн-ячейки: бочка приглушает бас и аккорды — «дыхание» танцевального трека. */
  duckBass: GainNode;
  duckChord: GainNode;
  hp: BiquadFilterNode;
  glue: DynamicsCompressorNode;
  post: GainNode;
  shaper: WaveShaperNode;
  master: GainNode;
  revSend: GainNode;
  revReturn: GainNode;
  dlySend: GainNode;
  dlyReturn: GainNode;
  dly: DelayNode;
  dlyFb: GainNode;
  dlyFilter: BiquadFilterNode;
  lead: GainNode;
  drum: GainNode;
  bass: GainNode;
  chord: GainNode;
  /** Авто-мастеринг: трим громкости, компрессор-лимитер, анализатор RMS. */
  trim: GainNode;
  fallback: DynamicsCompressorNode;
  analyser: AnalyserNode;
}

let mix: Mix | null = null;
let noiseBuf: AudioBuffer | null = null;
let impulseBuf: AudioBuffer | null = null;
let rmsBuf: Float32Array<ArrayBuffer> | null = null;
let rmsEma = 0;
let lastTrimAt = 0;
let trimStart = 0;

function rmsBuffer(size: number): Float32Array<ArrayBuffer> {
  if (!rmsBuf || rmsBuf.length !== size) rmsBuf = new Float32Array(size);
  return rmsBuf;
}

/** Мягкий клиппер: танh-подобная кривая собирает пики в «плотный», но не хриплый верх. */
function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  return curve;
}

/** Белый шум: единый буфер на все ударные и эффекты (генерируется один раз). */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x2f6e2b1;
  for (let i = 0; i < data.length; i++) {
    // det-терминированный шум: одинаковый звук на каждом запуске и в проверках
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  noiseBuf = buf;
  return buf;
}

/**
 * Импульс реверберации: стерео-шум с экспоненциальным спадом и глушением верха,
 * 1.6 с, с предзадержкой 14 мс. Своими руками — без внешних файлов.
 */
function impulseBuffer(ctx: AudioContext): AudioBuffer {
  if (impulseBuf && impulseBuf.sampleRate === ctx.sampleRate) return impulseBuf;
  const seconds = 1.6;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 0x9e3779b9;
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      const t = i / len;
      // предзадержка + экспоненциальный хвост + независимость каналов
      const pre = i < ctx.sampleRate * 0.014 ? 0 : 1;
      const decay = Math.pow(1 - t, 2.6) * Math.exp(-t * (ch === 0 ? 2.2 : 2.6));
      data[i] = white * decay * pre * (ch === 0 ? 1 : 0.92);
    }
  }
  impulseBuf = buf;
  return buf;
}

function buildMix(ctx: AudioContext): Mix {
  const sum = ctx.createGain();
  const duckBass = ctx.createGain();
  const duckChord = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 32;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16;
  glue.knee.value = 24;
  glue.ratio.value = 3.2;
  glue.attack.value = 0.006;
  glue.release.value = 0.22;
  const post = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve();
  shaper.oversample = '2x';
  const master = ctx.createGain();
  master.gain.value = volume;

  const bass = ctx.createGain();
  const chord = ctx.createGain();
  const lead = ctx.createGain();
  const drum = ctx.createGain();
  bass.connect(duckBass);
  chord.connect(duckChord);
  duckBass.connect(sum);
  duckChord.connect(sum);
  lead.connect(sum);
  drum.connect(sum);
  sum.connect(hp);
  hp.connect(glue);
  glue.connect(post);

  // Реверб: посыл → свёртка с собственным импульсом → возврат после компрессора,
  // чтобы хвост не «качался» сайдчейном и не качал склейку.
  const revSend = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = impulseBuffer(ctx);
  const revReturn = ctx.createGain();
  revReturn.gain.value = 0.3;
  revSend.connect(conv);
  conv.connect(revReturn);
  revReturn.connect(post);

  // Дилей: посыЛ → линия с обратной связью и фильтром → возврат; хвост уходит и в реверб.
  const dlySend = ctx.createGain();
  const dly = ctx.createDelay(1.5);
  dly.delayTime.value = 0.32;
  const dlyFb = ctx.createGain();
  dlyFb.gain.value = 0.34;
  const dlyFilter = ctx.createBiquadFilter();
  dlyFilter.type = 'lowpass';
  dlyFilter.frequency.value = 2600;
  const dlyReturn = ctx.createGain();
  dlyReturn.gain.value = 0.16;
  dlySend.connect(dly);
  dly.connect(dlyFilter);
  dlyFilter.connect(dlyFb);
  dlyFb.connect(dly);
  dlyFilter.connect(dlyReturn);
  dlyReturn.connect(post);
  dlyReturn.connect(revSend);

  // Авто-мастеринг: трим приводит громкость разных треков к одной цели
  // (измеряется анализатором), а быстрый компрессор-лимитер страхует пики
  // суперпилы и крэшей. Лукуп-ворклет из волны 2.1 удалён: общее кольцо на
  // оба канала и окно пика не там давали запаздывающую накачку — «палка по трубе».
  const trim = ctx.createGain();
  trim.gain.value = 1;
  const fallback = ctx.createDynamicsCompressor();
  fallback.threshold.value = -2.5;
  fallback.knee.value = 6;
  fallback.ratio.value = 14;
  fallback.attack.value = 0.002;
  fallback.release.value = 0.09;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 32768; // ~0.74 с окна: трим не ходит за каждой нотой
  post.connect(shaper);
  shaper.connect(trim);
  trim.connect(fallback);
  fallback.connect(master);
  master.connect(analyser);
  master.connect(ctx.destination);

  return {
    sum, duckBass, duckChord, hp, glue, post, shaper, master,
    revSend, revReturn, dlySend, dlyReturn, dly, dlyFb, dlyFilter,
    lead, drum, bass, chord, trim, fallback, analyser,
  };
}

function audio(): AudioContext | null {
  try {
    if (!context) {
      context = new (window.AudioContext || (window as any).webkitAudioContext)();
      mix = buildMix(context);
    }
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    return context;
  } catch {
    return null;
  }
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  activeId = null;
  if (context && mix) {
    const now = context.currentTime;
    mix.master.gain.cancelScheduledValues(now);
    mix.master.gain.setTargetAtTime(0.0001, now, 0.035);
    mix.duckBass.gain.cancelScheduledValues(now);
    mix.duckChord.gain.cancelScheduledValues(now);
    mix.duckBass.gain.setValueAtTime(1, now);
    mix.duckChord.gain.setValueAtTime(1, now);
  }
}

export function stopMusic() {
  stop();
}

export function setMusicEnabled(value: boolean) {
  enabled = value;
  if (!value) stop();
}

function hz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Wavetable-банк (PeriodicWave): тембры из гармонических рядов ────────────
//
// Одиночный осциллятор беден, а сэмплов у нас нет по правилу каталога.
// PeriodicWave даёт свой спектр: рояль с плотным рядом гармоник, струнные
// с мягким спадом 1/n, флейта с почти чистой синусоидой, родес с «тинкой»
// на 14-й гармонике. Нормализацию амплитуды оставляет браузеру.

const WAVE_TABLES: Record<string, number[]> = {
  piano: [1, 0.42, 0.28, 0.2, 0.14, 0.1, 0.07, 0.05, 0.035, 0.025, 0.018, 0.012, 0.008, 0.005],
  keys: [1, 0.35, 0.12, 0.08, 0.06, 0.02, 0.012, 0.008, 0.005, 0.004, 0.003, 0.002, 0.002, 0.03],
  strings: [1, 0.5, 0.34, 0.25, 0.19, 0.15, 0.12, 0.095, 0.078, 0.064, 0.053, 0.044, 0.037, 0.031, 0.026, 0.022],
  flute: [1, 0.12, 0.06, 0.022, 0.012, 0.006, 0.003, 0.002],
  panpipe: [1, 0, 0.14, 0, 0.06, 0, 0.03, 0, 0.016, 0, 0.009],
};

const waveCache = new Map<string, PeriodicWave>();

function wave(ctx: AudioContext, name: string): PeriodicWave {
  const key = `${ctx.sampleRate}:${name}`;
  const cached = waveCache.get(key);
  if (cached) return cached;
  const table = WAVE_TABLES[name] ?? WAVE_TABLES.strings;
  const real = new Float32Array(table.length + 1);
  const imag = new Float32Array(table.length + 1);
  table.forEach((amp, i) => {
    imag[i + 1] = amp;
  });
  const w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  waveCache.set(key, w);
  return w;
}

// ── Джазовая теория для импровиза над changes ────────────────────────────────
// Лады и расширенные состава — по алгоритмическому подходу из предложения
// (docs/proposals/jazz-classical-generation.md): на доле — тоны аккорда,
// между долями — взвешенные ходы по ладу, approach и enclosure.
const JAZZ_SCALES: Record<'dorian' | 'mixo' | 'major', number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixo: [0, 2, 4, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};
const CHORD_EXT: Record<'M' | 'm' | '7', number[]> = {
  M: [0, 4, 7, 11, 14],
  m: [0, 3, 7, 10, 14],
  '7': [0, 4, 7, 10, 14],
};
const scaleForQ = (q: 'M' | 'm' | '7') => (q === 'm' ? JAZZ_SCALES.dorian : q === '7' ? JAZZ_SCALES.mixo : JAZZ_SCALES.major);
/** Последняя нота импровиза на трек: взвешенный выбор шага требует памяти. */
const improvPrev: Record<string, number> = {};

// ── Детерминированная «человечность» ─────────────────────────────────────────

function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Микро-сдвиг момента и громкости: живой грув вместо метронома (детерминированно). */
function human(seedText: string, step: number): { dt: number; gv: number } {
  const rnd = mulberry(hashString(seedText) ^ Math.imul(step + 1, 0x9e3779b1));
  return { dt: (rnd() - 0.5) * 0.011, gv: 0.92 + rnd() * 0.16 };
}

// ── Голоса ──────────────────────────────────────────────────────────────────

type Bus = 'lead' | 'drum' | 'bass' | 'chord';

interface Send {
  pan?: number;
  rev?: number;
  dly?: number;
  bus?: Bus;
}

function route(ctx: AudioContext, s: Send): GainNode {
  const out = ctx.createGain();
  const bus = mix ? mix[s.bus ?? 'lead'] : null;
  if (s.pan) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, s.pan));
    out.connect(panner);
    if (bus) panner.connect(bus);
  } else if (bus) {
    out.connect(bus);
  }
  if (mix && s.rev) {
    const send = ctx.createGain();
    send.gain.value = s.rev;
    out.connect(send);
    send.connect(mix.revSend);
  }
  if (mix && s.dly) {
    const send = ctx.createGain();
    send.gain.value = s.dly;
    out.connect(send);
    send.connect(mix.dlySend);
  }
  return out;
}

function envelope(ctx: AudioContext, at: number, peak: number, attack: number, dur: number, sustain = 0.55, release?: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + Math.max(0.002, attack));
  const hold = at + Math.max(attack + 0.02, dur * sustain);
  gain.gain.setTargetAtTime(0.0001, hold, release ?? Math.max(0.03, dur * 0.2));
  return gain;
}

interface FmOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  /** Отношение частоты модулятора к несущей: 2 — электропиано, 3.5 — колокол. */
  ratio?: number;
  /** Глубина модуляции в герцах на старте. */
  index?: number;
  attack?: number;
  cutoff?: number;
  sustain?: number;
}

/** FM-голос: несущая + модулятор с огибающей индекса — тембры «как из синтезатора». */
function fmVoice(ctx: AudioContext, o: FmOptions) {
  const ratio = o.ratio ?? 2;
  const car = ctx.createOscillator();
  car.type = 'sine';
  car.frequency.setValueAtTime(o.freq, o.at);
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.setValueAtTime(o.freq * ratio, o.at);
  const modGain = ctx.createGain();
  const index = o.index ?? o.freq * 1.4;
  modGain.gain.setValueAtTime(index, o.at);
  modGain.gain.exponentialRampToValueAtTime(Math.max(1, index * 0.12), o.at + Math.max(0.06, o.dur * 0.5));
  mod.connect(modGain);
  modGain.connect(car.frequency);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(o.cutoff ?? 6500, o.at);
  const env = envelope(ctx, o.at, o.gain, o.attack ?? 0.004, o.dur, o.sustain);
  const out = route(ctx, o);
  car.connect(filter);
  filter.connect(env);
  env.connect(out);
  car.start(o.at);
  mod.start(o.at);
  const end = o.at + o.dur + 0.2;
  car.stop(end);
  mod.stop(end);
}

// ── DX-движок: многооператорный FM по архитектуре Yamaha DX7 ─────────────────
// Исследование: righto.com «DX7 chip reverse-engineering» (6 операторов-синусов,
// 32 алгоритма, обратная связь через буфер двух предыдущих значений);
// muzines «Understanding the DX7» (E.Piano 1 = алгоритм 5: три пары
// несущая/модулятор 1/2, 3/4, 5/6; op1 — «тинка» Rhodes с KVS 2);
// thinksynth env::dx (огибающая 4R/4L: уровни шагом 0.75 дБ, скорость
// удваивается каждые ~6.2 шага). Каждый оператор — синус + огибающая
// уровня; модуляторы входят в frequency несущей (классический FM-путь),
// глубина модуляции измеряется в герцах и спадает по своей огибающей —
// спектр ярчеет на атаке и темнеет на сустейне, как у живого тинка.
type DxPresetName = 'epiano' | 'bass' | 'brass' | 'bell' | 'pluck';

interface DxOpSpec {
  ratio: number;
  detune?: number;
  /** Уровень: для несущей — доля амплитуды, для модулятора — индекс (× freq). */
  level: number;
  attack: number;
  decay: number;
  sustain: number;
  release?: number;
  isMod?: boolean;
  /** Индекс несущей, которую модулирует этот оператор. */
  target?: number;
}

const DX_PRESETS: Record<DxPresetName, DxOpSpec[]> = {
  // E.Piano 1 (алгоритм 5): пара 1/2 — тинка с быстрым спадом индекса,
  // пара 3/4 — тело с длинным спадом, пара 5/6 — молоточковый стук (ratio 3.5)
  epiano: [
    { ratio: 1, level: 0.9, attack: 0.004, decay: 0.9, sustain: 0.22, release: 0.3 },
    { ratio: 1, level: 1.7, attack: 0.002, decay: 0.35, sustain: 0.02, isMod: true, target: 0 },
    { ratio: 1, level: 0.5, attack: 0.004, decay: 2.2, sustain: 0.32, release: 0.35 },
    { ratio: 1, level: 0.75, attack: 0.003, decay: 0.8, sustain: 0.04, isMod: true, target: 2 },
    { ratio: 1, level: 0.3, attack: 0.002, decay: 0.14, sustain: 0 },
    { ratio: 3.5, level: 1.1, attack: 0.001, decay: 0.05, sustain: 0, isMod: true, target: 4 },
  ],
  bass: [
    { ratio: 1, level: 0.95, attack: 0.004, decay: 0.5, sustain: 0.5, release: 0.08 },
    { ratio: 1, level: 1.4, attack: 0.002, decay: 0.14, sustain: 0.03, isMod: true, target: 0 },
    { ratio: 2, level: 0.35, attack: 0.002, decay: 0.3, sustain: 0.05, isMod: true, target: 0 },
  ],
  brass: [
    { ratio: 1, level: 0.9, attack: 0.09, decay: 0.6, sustain: 0.75, release: 0.12 },
    { ratio: 1, level: 1.2, attack: 0.12, decay: 0.5, sustain: 0.5, isMod: true, target: 0 },
    { ratio: 2, level: 0.3, attack: 0.08, decay: 0.4, sustain: 0.3, isMod: true, target: 0 },
  ],
  bell: [
    { ratio: 1, level: 0.85, attack: 0.003, decay: 2.6, sustain: 0.05, release: 0.5 },
    { ratio: 3.42, level: 1.8, attack: 0.002, decay: 1.6, sustain: 0.02, isMod: true, target: 0 },
    { ratio: 6.71, level: 0.5, attack: 0.002, decay: 0.6, sustain: 0, isMod: true, target: 0 },
  ],
  pluck: [
    { ratio: 1, level: 0.9, attack: 0.002, decay: 0.35, sustain: 0.02, release: 0.08 },
    { ratio: 3, level: 2.2, attack: 0.001, decay: 0.06, sustain: 0, isMod: true, target: 0 },
    { ratio: 1, level: 0.6, attack: 0.001, decay: 0.2, sustain: 0, isMod: true, target: 0 },
  ],
};

interface DxOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  cutoff?: number;
  /** 0..1 — скорость ноты: у DX7 уровень и индекс растут с velocity. */
  vel?: number;
}

function dxVoice(ctx: AudioContext, preset: DxPresetName, o: DxOptions) {
  const ops = DX_PRESETS[preset];
  const out = route(ctx, o);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(o.cutoff ?? 6500, 9000);
  const master = ctx.createGain();
  master.gain.value = o.gain;
  master.connect(lp);
  lp.connect(out);
  const vel = 0.6 + 0.4 * (o.vel ?? 1);
  const oscs: OscillatorNode[] = [];
  const envs: GainNode[] = [];
  ops.forEach((op) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(o.freq * op.ratio, o.at);
    if (op.detune) osc.detune.value = op.detune;
    const g = ctx.createGain();
    const peak = Math.max((op.isMod ? op.level * o.freq * vel : op.level * vel), 0.0002);
    const atk = Math.max(0.001, op.attack);
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.linearRampToValueAtTime(peak, o.at + atk);
    g.gain.setTargetAtTime(Math.max(peak * op.sustain, 0.0001), o.at + atk, Math.max(0.02, op.decay / 3));
    if (!op.isMod) {
      g.gain.setTargetAtTime(0.0001, o.at + Math.max(atk + op.decay, o.dur * 0.92), op.release ?? 0.12);
    }
    osc.connect(g);
    oscs.push(osc);
    envs.push(g);
  });
  ops.forEach((op, i) => {
    if (op.isMod && op.target !== undefined) envs[i].connect(oscs[op.target].frequency);
    else if (!op.isMod) envs[i].connect(master);
  });
  const end = o.at + o.dur + 0.9;
  oscs.forEach((osc) => {
    osc.start(o.at);
    osc.stop(end);
  });
}

interface StackOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  voices?: number;
  detune?: number;
  attack?: number;
  cutoff?: number;
  cutoffEnd?: number;
  sustain?: number;
  type?: OscillatorType;
}

/** Пучок расстроенных осцилляторов через общий фильтр: суперпила и тёплые пэды. */
function stackVoice(ctx: AudioContext, o: StackOptions) {
  const count = o.voices ?? 5;
  const spread = o.detune ?? 8;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(o.cutoff ?? 4200, o.at);
  if (o.cutoffEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(120, o.cutoffEnd), o.at + Math.max(0.08, o.dur * 0.7));
  filter.Q.value = 0.9;
  const env = envelope(ctx, o.at, o.gain, o.attack ?? 0.006, o.dur, o.sustain);
  const out = route(ctx, o);
  filter.connect(env);
  env.connect(out);
  for (let i = 0; i < count; i++) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sawtooth';
    osc.frequency.setValueAtTime(o.freq, o.at);
    osc.detune.value = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * spread;
    const g = ctx.createGain();
    g.gain.value = 1 / count;
    osc.connect(g);
    g.connect(filter);
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.2);
  }
}

interface PianoOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  attack?: number;
  cutoff?: number;
}

/**
 * Рояль в три слоя: струна (PeriodicWave) в унизоне ±3 цента, молоточек
 * (короткий шумовой удар в области 3–4-й гармоник) и саб-подпорка для нижних
 * нот. Двухстадийная огибающая: быстрый сброс до 40% и длинный хвост.
 */
function pianoVoice(ctx: AudioContext, o: PianoOptions) {
  const out = route(ctx, o);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(o.cutoff ?? 5200, o.at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(900, (o.cutoff ?? 5200) * 0.45), o.at + Math.max(0.2, o.dur * 0.8));
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, o.at);
  env.gain.linearRampToValueAtTime(Math.max(0.0002, o.gain), o.at + (o.attack ?? 0.003));
  env.gain.setTargetAtTime(o.gain * 0.4, o.at + (o.attack ?? 0.003), 0.11);
  env.gain.setTargetAtTime(0.0001, o.at + Math.max(0.25, o.dur * 0.75), Math.max(0.09, o.dur * 0.22));
  filter.connect(env);
  env.connect(out);
  // Три «струны» унизона (у рояля в средней тесситуре три струны на ноту):
  // ±3 цента сразу и +7 с запаздыванием 1.5 мс — третий молоток чуть не в фазе
  [-3, 3, 7].forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave(ctx, 'piano'));
    osc.frequency.setValueAtTime(o.freq, o.at);
    osc.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = cents === 7 ? 0.35 : 0.5;
    osc.connect(g);
    g.connect(filter);
    osc.start(o.at + (cents === 7 ? 0.0015 : 0));
    osc.stop(o.at + o.dur + 0.45);
  });
  // Дека: свёртка с импульсом резонансной доски (моды 'piano' в BODY_MODES) —
  // корпус допевает после струны, как у AWM-роялей промышленного уровня
  const board = ctx.createConvolver();
  board.normalize = false;
  board.buffer = bodyIR(ctx, 'piano');
  const boardGain = ctx.createGain();
  boardGain.gain.value = 0.4;
  env.connect(board);
  board.connect(boardGain);
  boardGain.connect(out);
  // Молоточек: короткий шумовой транзиент — без него рояль «слепой»
  const hammer = noiseSource(ctx, o.at, 0.014);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(9000, o.freq * 3.6);
  bp.Q.value = 1.1;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(o.gain * 0.5, o.at);
  hg.gain.exponentialRampToValueAtTime(0.0001, o.at + 0.014);
  hammer.connect(bp);
  bp.connect(hg);
  hg.connect(out);
  if (o.freq < 140) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(o.freq, o.at);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, o.at);
    sg.gain.linearRampToValueAtTime(o.gain * 0.3, o.at + 0.01);
    sg.gain.setTargetAtTime(0.0001, o.at + 0.2, 0.14);
    sub.connect(sg);
    sg.connect(out);
    sub.start(o.at);
    sub.stop(o.at + o.dur + 0.3);
  }
}

interface StringsOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  attack?: number;
  cutoff?: number;
}

/** Струнный ансамбль: четыре расстроенные wavetable-голоса, медленная атака, стерео-распространение. */
function stringsVoice(ctx: AudioContext, o: StringsOptions) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(o.cutoff ?? 2800, o.at);
  const env = envelope(ctx, o.at, o.gain, o.attack ?? 0.11, o.dur, 0.9, Math.max(0.25, o.dur * 0.3));
  filter.connect(env);
  const left = route(ctx, { ...o, pan: (o.pan ?? 0) - 0.3 });
  const right = route(ctx, { ...o, pan: (o.pan ?? 0) + 0.3 });
  env.connect(left);
  env.connect(right);
  [-9, -3, 3, 9].forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave(ctx, 'strings'));
    osc.frequency.setValueAtTime(o.freq, o.at);
    osc.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    osc.connect(g);
    g.connect(filter);
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.5);
  });
}

/**
 * Флейта и пан-флейта, версия 3 — по модели STK (Cook/Scavone, Karjalainen):
 * струя (jet) «запускает» инструмент, поэтому огибающая дыхания стартует
 * раньше тона и ведёт его; шум джета — полоса вокруг 1.5–2-й гармоники
 * (у настоящих флейт спектр дыхания привязан к ноте, а не к октаве);
 * вибрато включается с 0.35 с и слегка трогает амплитуду тоже.
 * Пан-флейта — закрытая труба: нечётные гармоники (wavetable 'panpipe'),
 * дыхания больше, вибрато меньше.
 */
function fluteVoice(ctx: AudioContext, o: PianoOptions, variant: 'pan' | 'concert' = 'concert') {
  const out = route(ctx, o);
  const pan = variant === 'pan';
  // Дыхание: нарастание 50–70 мс (startBlowing с rate), спад в конце ноты
  const blow = ctx.createGain();
  blow.gain.setValueAtTime(0.0001, o.at);
  blow.gain.linearRampToValueAtTime(1, o.at + (pan ? 0.07 : 0.05));
  blow.gain.setTargetAtTime(0.88, o.at + 0.12, 0.22);
  blow.gain.setTargetAtTime(0.0001, o.at + Math.max(0.25, o.dur * 0.85), 0.09);
  blow.connect(out);
  // Тон: wavetable (пан — нечётные гармоники), строй въезжает за 40 мс
  const tone = ctx.createOscillator();
  tone.setPeriodicWave(wave(ctx, pan ? 'panpipe' : 'flute'));
  tone.frequency.setValueAtTime(o.freq * 0.995, o.at);
  tone.frequency.exponentialRampToValueAtTime(o.freq, o.at + 0.04);
  const toneFilter = ctx.createBiquadFilter();
  toneFilter.type = 'lowpass';
  toneFilter.frequency.value = Math.min(o.cutoff ?? 5200, 5200);
  const toneLevel = ctx.createGain();
  toneLevel.gain.value = o.gain;
  tone.connect(toneFilter);
  toneFilter.connect(toneLevel);
  toneLevel.connect(blow);
  // Вибрато: частота + лёгкая амплитуда, разгон с 0.35 с
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = pan ? 4.8 : 5.3;
  const lfoDetune = ctx.createGain();
  lfoDetune.gain.setValueAtTime(0.0001, o.at);
  lfoDetune.gain.setTargetAtTime(pan ? 4.5 : 5.5, o.at + 0.35, 0.3);
  lfo.connect(lfoDetune);
  lfoDetune.connect(tone.detune);
  const lfoAmp = ctx.createGain();
  lfoAmp.gain.setValueAtTime(0.0001, o.at);
  lfoAmp.gain.setTargetAtTime(o.gain * 0.05, o.at + 0.35, 0.3);
  lfo.connect(lfoAmp);
  lfoAmp.connect(blow.gain);
  // Джет-шум: полоса вокруг 1.8·f0 (спектр дыхания привязан к ноте)
  const jet = noiseSource(ctx, o.at, Math.min(0.6, o.dur));
  const jetBp = ctx.createBiquadFilter();
  jetBp.type = 'bandpass';
  jetBp.frequency.value = o.freq * 1.8;
  jetBp.Q.value = 0.9;
  const jetLevel = ctx.createGain();
  jetLevel.gain.value = o.gain * (pan ? 0.3 : 0.22);
  jet.connect(jetBp);
  jetBp.connect(jetLevel);
  jetLevel.connect(blow);
  // Верхний шелест дыхания
  const hiss = noiseSource(ctx, o.at, Math.min(0.4, o.dur));
  const hissHp = ctx.createBiquadFilter();
  hissHp.type = 'highpass';
  hissHp.frequency.value = 3200;
  const hissLevel = ctx.createGain();
  hissLevel.gain.value = o.gain * 0.06;
  hiss.connect(hissHp);
  hissHp.connect(hissLevel);
  hissLevel.connect(blow);
  tone.start(o.at);
  lfo.start(o.at);
  const end = o.at + o.dur + 0.35;
  tone.stop(end);
  lfo.stop(end);
}

interface BassOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  glideTo?: number;
  cutoff?: number;
}

/** Бас: саб-синус ниже 100 Гц + пила-середина с огибающей фильтра — читается на колонках и в телефоне. */
function bassVoice(ctx: AudioContext, o: BassOptions) {
  const out = route(ctx, { ...o, bus: 'bass', rev: 0 });
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(o.freq, o.at);
  if (o.glideTo) sub.frequency.exponentialRampToValueAtTime(o.glideTo, o.at + Math.max(0.08, o.dur * 0.45));
  const subEnv = envelope(ctx, o.at, o.gain * 0.9, 0.005, o.dur, 0.7, 0.06);
  sub.connect(subEnv);
  subEnv.connect(out);
  sub.start(o.at);
  sub.stop(o.at + o.dur + 0.15);

  if (!o.glideTo) {
    // середина — DX-бас: атака плотнее пилы с фильтром, spectrum спадает сам
    dxVoice(ctx, 'bass', { ...o, gain: o.gain * 0.45, cutoff: Math.min(o.cutoff ?? 2400, 2400), bus: 'bass' });
    return;
  }
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(o.cutoff ?? 900, o.at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(140, (o.cutoff ?? 900) * 0.35), o.at + Math.max(0.1, o.dur * 0.6));
  filter.Q.value = 4;
  const midEnv = envelope(ctx, o.at, o.gain * 0.5, 0.004, o.dur, 0.55, 0.05);
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(o.freq, o.at);
  if (o.glideTo) saw.frequency.exponentialRampToValueAtTime(o.glideTo, o.at + Math.max(0.08, o.dur * 0.45));
  saw.connect(filter);
  filter.connect(midEnv);
  midEnv.connect(out);
  saw.start(o.at);
  saw.stop(o.at + o.dur + 0.15);
}

// ── Живые инструменты ───────────────────────────────────────────────────────

interface KsOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  /** 0..1 — яркость щипка (положение «медиатора» на струне). */
  bright?: number;
  sustain?: number;
  cutoff?: number;
}

/**
 * Моды деки (измеренные семейства частот классической гитары и контрабаса:
 * воздушный резонанс Гельмгольца ~100 Гц, плато ~200–250 Гц и вебо выше).
 * Импульс деки синтезируется модалной суммой затухающих синусов и хранится
 * буфером для свёртки — метод CCRMA «body resonator»: IR деки сворачивается
 * с выходом струнной модели, без измеренных записей.
 */
type KsBody = 'guitar' | 'ukulele' | 'balalaika' | 'upright' | 'piano';

const BODY_MODES: Record<KsBody, { f: number; tau: number; a: number }[]> = {
  guitar: [
    { f: 105, tau: 0.09, a: 1 }, { f: 196, tau: 0.07, a: 0.8 }, { f: 255, tau: 0.06, a: 0.7 },
    { f: 398, tau: 0.05, a: 0.5 }, { f: 520, tau: 0.04, a: 0.35 }, { f: 830, tau: 0.03, a: 0.25 },
    { f: 1200, tau: 0.02, a: 0.18 }, { f: 1900, tau: 0.012, a: 0.12 }, { f: 2600, tau: 0.008, a: 0.08 },
  ],
  ukulele: [
    { f: 300, tau: 0.05, a: 1 }, { f: 620, tau: 0.04, a: 0.7 }, { f: 980, tau: 0.03, a: 0.45 },
    { f: 1500, tau: 0.02, a: 0.3 }, { f: 2400, tau: 0.012, a: 0.18 }, { f: 3400, tau: 0.008, a: 0.1 },
  ],
  balalaika: [
    { f: 250, tau: 0.045, a: 1 }, { f: 520, tau: 0.035, a: 0.7 }, { f: 900, tau: 0.025, a: 0.5 },
    { f: 1600, tau: 0.015, a: 0.3 }, { f: 2800, tau: 0.009, a: 0.18 },
  ],
  upright: [
    { f: 55, tau: 0.12, a: 1 }, { f: 110, tau: 0.1, a: 0.8 }, { f: 220, tau: 0.07, a: 0.5 },
    { f: 440, tau: 0.045, a: 0.3 }, { f: 900, tau: 0.03, a: 0.15 },
  ],
  // дека рояля: моды резонансной доски длиннее гитарных (tau 0.4–0.07 с) —
  // дерево «допевает» после струны, без этого рояль звучит картонно
  piano: [
    { f: 95, tau: 0.4, a: 1 }, { f: 140, tau: 0.35, a: 0.8 }, { f: 210, tau: 0.3, a: 0.6 },
    { f: 320, tau: 0.22, a: 0.5 }, { f: 480, tau: 0.16, a: 0.35 }, { f: 720, tau: 0.11, a: 0.25 },
    { f: 1100, tau: 0.07, a: 0.15 },
  ],
};

const bodyIrCache = new Map<string, AudioBuffer>();

function bodyIR(ctx: AudioContext, body: KsBody): AudioBuffer {
  const key = `${ctx.sampleRate}:${body}`;
  const cached = bodyIrCache.get(key);
  if (cached) return cached;
  const modes = BODY_MODES[body];
  const len = Math.floor(ctx.sampleRate * 0.4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry(hashString(`body:${body}`));
  const phases = modes.map(() => rnd() * Math.PI * 2);
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    let sum = 0;
    modes.forEach((mode, m) => {
      sum += mode.a * Math.exp(-t / mode.tau) * Math.sin(2 * Math.PI * mode.f * t + phases[m]);
    });
    data[i] = sum;
  }
  // L2-нормировка (единичная энергия): свёртка сохраняет уровень струны,
  // резонансы деки красят спектр, а не поднимают громкость на +40 дБ.
  // Пиковая нормировка давала усиление ~120× — «палка по трубе» из низа.
  let energy = 0;
  for (let i = 0; i < len; i++) energy += data[i] * data[i];
  // 0.25 — целевой вклад деки: wet ≈ 1.2× RMS струны. Дека красит спектр,
  // а не перекрывает струну (L2-норма давала +13 дБ низа — «гудение»).
  const norm = energy > 0 ? 0.25 / Math.sqrt(energy) : 1;
  for (let i = 0; i < len; i++) data[i] *= norm;
  bodyIrCache.set(key, buf);
  return buf;
}

interface KsOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  /** 0..1 — положение медиатора: яркость и гребёнка возбуждения. */
  bright?: number;
  sustain?: number;
  cutoff?: number;
  body?: KsBody;
  /** Глушение через N секунд после атаки: чоп ритм-гитары,articulation баса. */
  chop?: number;
}

/**
 * Щипковая струна, версия 3 — по рекомендациям Jaffe–Smith (Computer Music
 * Journal, 1983), Columbia «Physical Modeling of Guitar» и CCRMA:
 *  • возбуждение — шум с гребёнкой позиции медиатора (доля длины волнывода);
 *  • петля — IIR-фильтр низких частот (однополюсник в цепи задержки),
 *    частота среза растёт с f0 ноты: демпфирование струны частотно-зависимое;
 *  • стерео: вторая струна с периодом N+1 — биения двух поляризаций;
 *  • выход струны сворачивается с импульсом деки (ConvolverNode) и смешивается
 *    с сухим сигналом: без деки струна — проволока, с одной декой без струны —
 *    бумажная коробка. Нужны оба звена;
 *  • 2 мс атаки убирают щелчок старта буфера.
 */
function ksVoice(ctx: AudioContext, o: KsOptions) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2.4);
  const bright = o.bright ?? 0.6;
  const body = o.body ?? 'guitar';
  const buf = ctx.createBuffer(2, len, sr);
  [0, 1].forEach((channel) => {
    const data = buf.getChannelData(channel);
    const n = Math.max(6, Math.round(sr / o.freq)) + channel;
    const rnd = mulberry(hashString(`ks:${body}`) ^ Math.round(o.freq * 8) ^ (channel * 0x5bd1));
    const pick = Math.max(2, Math.round(n * (0.3 - 0.16 * bright)));
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const white = rnd() * 2 - 1;
      prev = prev * 0.55 + white * 0.45;
      data[i] = prev;
    }
    for (let i = n - 1; i >= pick; i--) data[i] -= data[i - pick] * 0.85;
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
    const norm = (peak > 0 ? 0.9 / peak : 1) * (channel === 0 ? 1 : 0.45);
    for (let i = 0; i < n; i++) data[i] *= norm;
    // Петля: смесь прямого отвода и однополюсного ФНЧ; срез растёт с f0 (JASA 2012)
    const b = 0.25 + 0.3 * (1 - bright);
    const c = Math.min(0.5, 0.14 + o.freq / 7000);
    const decay = (o.sustain ?? 0.9965) * (0.9992 - Math.min(0.0012, o.freq / 900000));
    let yf = 0;
    for (let i = n; i < len; i++) {
      const xd = data[i - n];
      yf = c * xd + (1 - c) * yf;
      data[i] = decay * ((1 - b) * xd + b * yf);
    }
    const attack = Math.floor(sr * 0.002);
    for (let i = 0; i < attack; i++) data[i] *= i / attack;
  });
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // chop: нота глохнет через o.chop секунд — перкуссивный штрих без педали
  const sink = o.chop
    ? (() => {
        const dyn = ctx.createGain();
        dyn.gain.setValueAtTime(1, o.at);
        dyn.gain.setTargetAtTime(0.0001, o.at + o.chop, 0.035);
        return dyn;
      })()
    : null;
  // RMS буфера KS ≈0.03 против пиков 0.1–0.16 у огибающих осцилляторов:
  // без компенсации струна проигрывает перкуссии ~7 дБ× и трек звучит
  // «шумом с приглушённой гитарой» (запись 14:04: 20% энергии выше 5 кГц).
  const g = o.gain * 4;
  const out = route(ctx, o);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = body === 'guitar' ? 60 : body === 'upright' ? 35 : 110;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(o.cutoff ?? 9000, 9000);
  src.connect(hp);
  hp.connect(lp);
  const tail = sink ?? out;
  if (sink) sink.connect(out);
  const dry = ctx.createGain();
  dry.gain.value = g * 0.6;
  lp.connect(dry);
  dry.connect(tail);
  const conv = ctx.createConvolver();
  conv.normalize = false; // IR уже L2-нормирован: без скрытого масштабирования браузера
  conv.buffer = bodyIR(ctx, body);
  const wet = ctx.createGain();
  wet.gain.value = g * 0.8;
  lp.connect(conv);
  conv.connect(wet);
  wet.connect(tail);
  src.start(o.at);
  src.stop(o.at + 2.4);
}

interface MalletOptions extends Send {
  at: number;
  freq: number;
  dur: number;
  gain: number;
  /** 4.2 — маримба (дерево), 5.4 — калимба (металл пружины). */
  ratio?: number;
}

/** Пластинчатый удар: FM с негармоническим рядом + деревянный тик молоточка. */
function malletVoice(ctx: AudioContext, o: MalletOptions) {
  const ratio = o.ratio ?? 4.2;
  fmVoice(ctx, { ...o, ratio, index: o.freq * (ratio === 5.4 ? 0.5 : 0.35), cutoff: 6500, attack: 0.002 });
  const fundamental = ctx.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.setValueAtTime(o.freq, o.at);
  const fg = envelope(ctx, o.at, o.gain * 0.55, 0.003, o.dur * 0.8, 0.4, 0.08);
  const out = route(ctx, o);
  fundamental.connect(fg);
  fg.connect(out);
  fundamental.start(o.at);
  fundamental.stop(o.at + o.dur + 0.15);
  const tick = noiseSource(ctx, o.at, 0.008);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(9500, o.freq * 6);
  bp.Q.value = 1.4;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(o.gain * 0.4, o.at);
  tg.gain.exponentialRampToValueAtTime(0.0001, o.at + 0.008);
  tick.connect(bp);
  bp.connect(tg);
  tg.connect(out);
}

/**
 * Губная гармоника v2: бенд-скуп блюзовой идиомы (нота въезжает в строй
 * снизу за 90 мс), «купол рук» — форманта-лоу-пасс раскрывается f·1.4→f·2.6,
 * вторая форманта f·4.5 даёт язычковую «гнусавость», вибрато разгоняется
 * с 0.4 с (в прежней версии LFO не был подключён к осцилляторам — молчал).
 */
function harpVoice(ctx: AudioContext, o: KsOptions) {
  const out = route(ctx, o);
  const cup = ctx.createBiquadFilter();
  cup.type = 'lowpass';
  cup.frequency.setValueAtTime(o.freq * 1.4, o.at);
  cup.frequency.linearRampToValueAtTime(Math.min(6000, o.freq * 2.6), o.at + Math.min(0.35, o.dur * 0.6));
  cup.Q.value = 1.1;
  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.value = o.freq * 2;
  formant.Q.value = 3.2;
  const env = envelope(ctx, o.at, o.gain, 0.035, o.dur, 0.8, 0.09);
  cup.connect(formant);
  formant.connect(env);
  env.connect(out);
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = o.freq * 4.5;
  f2.Q.value = 2;
  const f2g = ctx.createGain();
  f2g.gain.value = 0.3;
  cup.connect(f2);
  f2.connect(f2g);
  f2g.connect(env);
  const reeds: OscillatorNode[] = [];
  [-7, 7].forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(o.freq * 0.97, o.at);
    osc.frequency.exponentialRampToValueAtTime(o.freq, o.at + 0.09);
    osc.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    osc.connect(g);
    g.connect(cup);
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.2);
    reeds.push(osc);
  });
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 5.6;
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(2, o.at);
  lfoGain.gain.setTargetAtTime(9, o.at + 0.4, 0.25);
  lfo.connect(lfoGain);
  reeds.forEach((osc) => lfoGain.connect(osc.detune));
  const breath = noiseSource(ctx, o.at, Math.min(0.25, o.dur));
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1000;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(o.gain * 0.2, o.at);
  bg.gain.setTargetAtTime(0.0001, o.at + 0.06, 0.07);
  breath.connect(lp);
  lp.connect(bg);
  bg.connect(out);
  lfo.start(o.at);
  lfo.stop(o.at + o.dur + 0.2);
}

// ── Живая природа (синтезированный шум и свипы, без записей) ─────────────────

function birdChirp(ctx: AudioContext, at: number, seed: number, level: number) {
  const rnd = mulberry(seed);
  // Птица v2: короткие слоги (25–45 мс) с малым свипом и быстрыми трелями,
  // паузы неровные. Прежние медленные свипы на 80 мс звучали сиреной.
  const kind = rnd();
  const syllables = kind < 0.35 ? 1 : 2 + Math.floor(rnd() * 4);
  const base = 2600 + rnd() * 1800;
  const out = route(ctx, { bus: 'lead', pan: (rnd() - 0.5) * 1.2, rev: 0.35 });
  let t = at;
  for (let i = 0; i < syllables; i++) {
    const trill = kind > 0.6 && i > 0;
    const durS = trill ? 0.09 + rnd() * 0.06 : 0.025 + rnd() * 0.02;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f0 = base * (0.94 + rnd() * 0.12);
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * (1.06 + rnd() * 0.1), t + durS * 0.5);
    osc.frequency.exponentialRampToValueAtTime(f0 * (0.95 + rnd() * 0.06), t + durS);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.011 * level, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durS);
    if (trill) {
      // трель: амплитуда пульсирует 28–34 Гц — слитный «чирр», а не свист
      const pulse = ctx.createOscillator();
      pulse.type = 'square';
      pulse.frequency.value = 28 + rnd() * 6;
      const depth = ctx.createGain();
      depth.gain.value = 0.0045 * level;
      pulse.connect(depth);
      depth.connect(g.gain);
      pulse.start(t);
      pulse.stop(t + durS + 0.02);
    }
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + durS + 0.02);
    t += durS + (trill ? 0.02 : 0.03 + rnd() * 0.07);
  }
}

function owlHoot(ctx: AudioContext, at: number, level: number) {
  const out = route(ctx, { bus: 'lead', pan: -0.3, rev: 0.5 });
  [0, 0.3].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(i === 0 ? 430 : 392, at + offset);
    osc.frequency.exponentialRampToValueAtTime(i === 0 ? 400 : 368, at + offset + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at + offset);
    g.gain.linearRampToValueAtTime(0.024 * level, at + offset + 0.05);
    g.gain.setTargetAtTime(0.0001, at + offset + 0.12, 0.07);
    osc.connect(g);
    g.connect(out);
    osc.start(at + offset);
    osc.stop(at + offset + 0.35);
  });
}

function gullCry(ctx: AudioContext, at: number, level: number) {
  const out = route(ctx, { bus: 'lead', pan: 0.35, rev: 0.5 });
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(980, at);
  osc.frequency.exponentialRampToValueAtTime(470, at + 0.34);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 1.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.014 * level, at + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
  osc.connect(bp);
  bp.connect(g);
  g.connect(out);
  osc.start(at);
  osc.stop(at + 0.4);
}

function natureBed(ctx: AudioContext, kind: 'wind' | 'rain' | 'stream' | 'waves' | 'crickets', at: number, dur: number, level: number, seed: number) {
  const rnd = mulberry(seed);
  if (kind === 'crickets') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 4300;
    const pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.value = 26;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.5;
    const gate = ctx.createGain();
    gate.gain.value = 0.5;
    pulse.connect(pulseGain);
    pulseGain.connect(gate.gain);
    const window_ = ctx.createGain();
    window_.gain.setValueAtTime(0.0001, at);
    window_.gain.linearRampToValueAtTime(0.0055 * level, at + 0.12);
    window_.gain.setTargetAtTime(0.0001, at + Math.max(0.3, dur * 0.7), 0.2);
    const out = route(ctx, { bus: 'lead', pan: 0.25, rev: 0.3 });
    osc.connect(gate);
    gate.connect(window_);
    window_.connect(out);
    osc.start(at);
    pulse.start(at);
    osc.stop(at + dur + 0.4);
    pulse.stop(at + dur + 0.4);
    return;
  }
  const src = noiseSource(ctx, at, dur);
  const out = route(ctx, { bus: 'lead', pan: kind === 'stream' ? 0.2 : kind === 'wind' ? -0.2 : 0, rev: 0.35 });
  const g = ctx.createGain();
  if (kind === 'rain') {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 450;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.02 * level, at + 0.25);
    g.gain.setValueAtTime(0.02 * level, at + Math.max(0.3, dur - 0.3));
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
  } else if (kind === 'wind') {
    // Ветер v2: низкое гудение + воздушный шелест, каждый со своим медленным
    // LFO-гастом (0.07–0.13 Гц) — линейные рампы давали «метрономное» шипение.
    const gustA = ctx.createOscillator();
    gustA.type = 'sine';
    gustA.frequency.value = 0.11 + rnd() * 0.05;
    const gustB = ctx.createOscillator();
    gustB.type = 'sine';
    gustB.frequency.value = 0.063 + rnd() * 0.03;
    const rumble = noiseSource(ctx, at, dur);
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 190;
    const rg = ctx.createGain();
    const rumbleBase = 0.0075 * level;
    rg.gain.setValueAtTime(0.0001, at);
    rg.gain.linearRampToValueAtTime(rumbleBase, at + Math.min(0.5, dur * 0.3));
    rg.gain.setValueAtTime(rumbleBase, at + Math.max(0.5, dur - 0.4));
    rg.gain.linearRampToValueAtTime(0.0001, at + dur);
    const rumbleDepth = ctx.createGain();
    rumbleDepth.gain.value = rumbleBase * 0.55;
    gustB.connect(rumbleDepth);
    rumbleDepth.connect(rg.gain);
    rumble.connect(rlp);
    rlp.connect(rg);
    rg.connect(route(ctx, { bus: 'lead', pan: -0.25, rev: 0.3 }));
    const hiss = noiseSource(ctx, at, dur);
    const hbp = ctx.createBiquadFilter();
    hbp.type = 'bandpass';
    hbp.frequency.value = 780 + rnd() * 260;
    hbp.Q.value = 0.45;
    const hlp = ctx.createBiquadFilter();
    hlp.type = 'lowpass';
    hlp.frequency.value = 3600;
    const hg = ctx.createGain();
    const hissBase = 0.0085 * level;
    hg.gain.setValueAtTime(0.0001, at);
    hg.gain.linearRampToValueAtTime(hissBase, at + Math.min(0.6, dur * 0.35));
    hg.gain.setValueAtTime(hissBase, at + Math.max(0.6, dur - 0.5));
    hg.gain.linearRampToValueAtTime(0.0001, at + dur);
    const hissDepth = ctx.createGain();
    hissDepth.gain.value = hissBase * 0.6;
    gustA.connect(hissDepth);
    hissDepth.connect(hg.gain);
    hiss.connect(hbp);
    hbp.connect(hlp);
    hlp.connect(hg);
    hg.connect(route(ctx, { bus: 'lead', pan: 0.2, rev: 0.35 }));
    gustA.start(at);
    gustB.start(at);
    gustA.stop(at + dur + 0.2);
    gustB.stop(at + dur + 0.2);
  } else if (kind === 'stream') {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 3100;
    peak.gain.value = 5;
    src.connect(hp);
    hp.connect(peak);
    peak.connect(g);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.011 * level, at + 0.2);
    g.gain.setValueAtTime(0.011 * level, at + Math.max(0.25, dur - 0.25));
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
  } else {
    // waves: валл шума с медленным свипом фильтра и пеной на гребне
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(240, at);
    lp.frequency.linearRampToValueAtTime(820, at + dur * 0.45);
    lp.frequency.linearRampToValueAtTime(240, at + dur);
    src.connect(lp);
    lp.connect(g);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.03 * level, at + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    const foam = noiseSource(ctx, at + dur * 0.3, dur * 0.4);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0.0001, at + dur * 0.3);
    fg.gain.linearRampToValueAtTime(0.009 * level, at + dur * 0.5);
    fg.gain.linearRampToValueAtTime(0.0001, at + dur * 0.7);
    foam.connect(hp);
    hp.connect(fg);
    fg.connect(out);
  }
  g.connect(out);
}

function droplet(ctx: AudioContext, at: number, seed: number, level: number) {
  const rnd = mulberry(seed);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f = 900 + rnd() * 1600;
  osc.frequency.setValueAtTime(f * 1.4, at);
  osc.frequency.exponentialRampToValueAtTime(f, at + 0.04);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.007 * level, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  const out = route(ctx, { bus: 'lead', pan: (rnd() - 0.5) * 0.8, rev: 0.45 });
  osc.connect(g);
  g.connect(out);
  osc.start(at);
  osc.stop(at + 0.07);
}

function thunder(ctx: AudioContext, at: number, level: number) {
  const src = noiseSource(ctx, at, 2.2);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(260, at);
  lp.frequency.exponentialRampToValueAtTime(90, at + 1.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.04 * level, at + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 2.1);
  const out = route(ctx, { bus: 'lead', pan: -0.2, rev: 0.5 });
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
}

// ── Ударные (физика + шум, как в драм-машинах) ───────────────────────────────

function noiseSource(ctx: AudioContext, at: number, dur: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(at);
  src.stop(at + dur + 0.05);
  return src;
}

function drumHit(ctx: AudioContext, at: number, type: DrumHit, level: number, bright: boolean) {
  if (!mix) return;
  const out = (pan: number, rev = 0) => route(ctx, { bus: 'drum', pan, rev });
  if (type === 'kick') {
    // Мембрана: питч 160→46 Гц за 90 мс + клик шума спереди — «пушка» 808-го типа
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, at);
    osc.frequency.exponentialRampToValueAtTime(46, at + 0.09);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.16 * level, at + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
    osc.connect(env);
    env.connect(out(0));
    osc.start(at);
    osc.stop(at + 0.3);
    if (bright) {
      const click = noiseSource(ctx, at, 0.014);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1400;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.05 * level, at);
      cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.014);
      click.connect(hp);
      hp.connect(cg);
      cg.connect(out(0));
    }
  } else if (type === 'snare') {
    const noise = noiseSource(ctx, at, 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.075 * level, at);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(out(-0.08, 0.18));
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(196, at);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.05 * level, at);
    bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    body.connect(bg);
    bg.connect(out(-0.08));
    body.start(at);
    body.stop(at + 0.12);
  } else if (type === 'hat' || type === 'openhat') {
    const dur = type === 'hat' ? 0.04 : 0.26;
    const noise = noiseSource(ctx, at, dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = type === 'hat' ? 7600 : 6200;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 10500;
    peak.gain.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime((type === 'hat' ? 0.028 : 0.035) * level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    noise.connect(hp);
    hp.connect(peak);
    peak.connect(g);
    g.connect(out(0.32, 0.08));
  } else if (type === 'clap') {
    // Три вспышки через 11 мс + хвост: узнаваемая форма хлопка
    [0, 0.011, 0.022].forEach((offset, i) => {
      const noise = noiseSource(ctx, at + offset, i === 2 ? 0.12 : 0.02);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      bp.Q.value = 1.6;
      const g = ctx.createGain();
      const peak = i === 2 ? 0.05 : 0.038;
      g.gain.setValueAtTime(peak * level, at + offset);
      g.gain.exponentialRampToValueAtTime(0.0001, at + offset + (i === 2 ? 0.12 : 0.02));
      noise.connect(bp);
      bp.connect(g);
      g.connect(out(-0.24, 0.22));
    });
  } else if (type === 'cowbell') {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 860;
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05 * level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    [545, 812].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.value = i === 0 ? 0.6 : 0.4;
      osc.connect(og);
      og.connect(bp);
      osc.start(at);
      osc.stop(at + 0.2);
    });
    bp.connect(g);
    g.connect(out(0.16, 0.1));
  } else if (type === 'tom') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, at);
    osc.frequency.exponentialRampToValueAtTime(110, at + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09 * level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    osc.connect(g);
    g.connect(out(0.2, 0.12));
    osc.start(at);
    osc.stop(at + 0.25);
  } else if (type === 'crash') {
    const noise = noiseSource(ctx, at, 0.8);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.05 * level, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
    noise.connect(hp);
    hp.connect(g);
    g.connect(out(0.4, 0.5));
  } else if (type === 'cajon') {
    // Деревянный ящик: низкий удар корпуса + хлопок ладони
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, at);
    osc.frequency.exponentialRampToValueAtTime(55, at + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.12 * level, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(g);
    g.connect(out(0));
    osc.start(at);
    osc.stop(at + 0.2);
    const slap = noiseSource(ctx, at, 0.03);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.04 * level, at);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
    slap.connect(lp);
    lp.connect(sg);
    sg.connect(out(0));
  } else if (type === 'rim') {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1750;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.03 * level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    osc.connect(bp);
    bp.connect(g);
    g.connect(out(-0.12, 0.12));
    osc.start(at);
    osc.stop(at + 0.05);
    const click = noiseSource(ctx, at, 0.015);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.02 * level, at);
    cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.015);
    click.connect(hp);
    hp.connect(cg);
    cg.connect(out(-0.12));
  } else if (type === 'shaker') {
    const noise = noiseSource(ctx, at, 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.011 * level, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    noise.connect(hp);
    hp.connect(g);
    g.connect(out(0.28, 0.06));
  } else if (type === 'ride') {
    // тарелка райд: негармонический стек частичек + шелест 6–16 кГц,
    // длинный хвост 1.2 с — «цик-цик-а-цик» джазовой пульсации
    const freqs = [680, 1050, 1480, 2200, 3400];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 10;
      const g = ctx.createGain();
      const amp = (level * 0.03) / (i + 1);
      g.gain.setValueAtTime(amp, at);
      g.gain.exponentialRampToValueAtTime(Math.max(amp * 0.5, 0.0001), at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
      osc.connect(bp);
      bp.connect(g);
      g.connect(out(0.15, 0.25));
      osc.start(at);
      osc.stop(at + 1.3);
    });
    const shimmer = noiseSource(ctx, at, 0.5);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(level * 0.05, at);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    shimmer.connect(hp);
    hp.connect(ng);
    ng.connect(out(0.15, 0.25));
  } else if (type === 'crossstick') {
    // римSHOT покруче щелчка: короткий тон 1.75 кГц + клик
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 1750;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 0.09, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    osc.connect(bp);
    bp.connect(g);
    g.connect(out(-0.1, 0.12));
    osc.start(at);
    osc.stop(at + 0.06);
    const click = noiseSource(ctx, at, 0.012);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(level * 0.05, at);
    cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.012);
    click.connect(cg);
    cg.connect(out(-0.1));
  } else if (type === 'brush') {
    // щётка: размашистый шумовой свелл 0.5 с вокруг 1.8 кГц
    const noise = noiseSource(ctx, at, 0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level * 0.05, at + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    noise.connect(bp);
    bp.connect(g);
    g.connect(out(0.1, 0.3));
  } else if (type === 'conga') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, at);
    osc.frequency.exponentialRampToValueAtTime(190, at + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07 * level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    osc.connect(g);
    g.connect(out(0.18, 0.1));
    osc.start(at);
    osc.stop(at + 0.14);
    const slap = noiseSource(ctx, at, 0.02);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.025 * level, at);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
    slap.connect(bp);
    bp.connect(sg);
    sg.connect(out(0.18));
  } else if (type === 'tambourine') {
    const noise = noiseSource(ctx, at, 0.11);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02 * level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    noise.connect(hp);
    hp.connect(g);
    g.connect(out(0.3, 0.15));
    const jingle = noiseSource(ctx, at + 0.05, 0.06);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.01 * level, at + 0.05);
    hg.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    jingle.connect(hp);
    hp.connect(hg);
    hg.connect(out(0.3, 0.15));
  } else if (type === 'riser') {
    // Шумовой сув: полоса ползёт вверх за такт — подводка к крэшу
    const noise = noiseSource(ctx, at, 0.95);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(420, at);
    bp.frequency.exponentialRampToValueAtTime(6400, at + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.032 * level, at + 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.95);
    noise.connect(bp);
    bp.connect(g);
    g.connect(out(0, 0.3));
  }
}

type DrumHit =
  | 'kick' | 'snare' | 'hat' | 'openhat' | 'clap' | 'cowbell' | 'tom' | 'crash' | 'riser'
  | 'cajon' | 'rim' | 'shaker' | 'conga' | 'tambourine' | 'ride' | 'crossstick' | 'brush';

// ── Таблица грувов ──────────────────────────────────────────────────────────
//
// Шаги — 16-е доли, 16 шагов = такт, луп = 8 тактов (128 шагов): место для
// филлов и крэшей. Паттерны заданы числами 0/1; бас и аккорды — именем рисунка;
// мелодия — ступенями `scale` трека. Новые поля 2.0: lead — тембр звукоизвлечения,
// sidechain — глубина «дыхания» от бочки, rev/dly — посылы, crash/fill/riser — форма.

export type LeadTimbre =
  | 'epiano' | 'bell' | 'pluck' | 'supersaw' | 'square' | 'cowbell' | 'piano' | 'flute' | 'strings'
  | 'guitar' | 'ukulele' | 'balalaika' | 'kalimba' | 'marimba' | 'harp' | 'panflute' | 'none';

export interface GrooveSpec {
  kick: number[];
  snare: number[];
  hat: number[];
  clap: number[];
  openHat?: number[];
  bass: 'quarter' | 'eighth' | 'offbeat' | 'drone' | 'slide' | 'none';
  chord: 'pad' | 'stab' | 'power' | 'keys' | 'strings' | 'strum' | 'none';
  chordIntervals: number[];
  lead: LeadTimbre;
  /** Базовая MIDI-нота мелодии: 66 — каталог, 65 — лоу-фай, 78 — ковбелл. */
  leadBase: number;
  leadEveryBeat?: boolean;
  blip?: boolean;
  hook?: 'sixseven' | 'wave';
  grace?: boolean;
  build?: boolean;
  motif: number[];
  cutoff?: number;
  swing?: number;
  padAttack?: number;
  /** 0..1 — насколько бочка приглушает бас и аккорды (танцевальное «дыхание»). */
  sidechain?: number;
  /** Посылы мелодии/аккордов в реверб и дилей. */
  rev?: number;
  dly?: number;
  /** Такты (0..7), где на первой доле звучит крэш. */
  crash?: number[];
  /** Филлы малого на 4-м и 8-м тактах и том-проигрыш в конце лупа. */
  fill?: boolean;
  /** Райзер перед последней долей лупа. */
  riser?: boolean;
  /** Струнная подкладка со второй половины лупа (гимн: дроп становится шире). */
  stringsOverlay?: boolean;
  /** Колокольный контр-слой с 5-го такта (K-pop гимн: «золотой» блеск дропа). */
  bellOverlay?: boolean;
  /** Акустический комплект вместо драм-машины: кахон, рим, шейкер, конга, бубен. */
  acousticDrums?: boolean;
  /** Живая природа: подкладки-подушки и события с сид-рандомом. */
  nature?: NatureSpec;
  /** Бас — щипковый контрабас (Karplus-Strong с декой), а не синтезаторный. */
  uprightBass?: boolean;
  /** Свинг по восьмым (триольное чувство), а не по шестнадцатым. */
  swing8?: boolean;
  /** Джаз-дуэт: колл-респонс импровиза вместо общих ветвей лида. */
  duo?: boolean;
  /** Ла-помпе: чоп-аккорды на долях с акцентом на 2 и 4. */
  pompeFlag?: boolean;
  /** Шагающий бас с хроматическим подходом к следующему корню. */
  walkFlag?: boolean;
  /** Гармония: аккорд на каждую половину такта (r — полутона от тоники, q — лад). */
  changes?: { r: number; q: 'M' | 'm' | '7' }[];
  /** Мелодия стандарта (общественное достояние): e — восьмая формы, d — длительность
   *  в восьмых, n — полутона от тоники, k:'end' — каденция с рубато. */
  melody?: { e: number; d: number; n: number; k?: 'end' }[];
  /** Октавный сдвиг мелодии относительно C4. */
  melodyOct?: number;
  /** Тембр солиста мелодии (по умолчанию текущий lead грува). */
  duoLead?: LeadTimbre;
  /** Страйд-рояль: бас на 1 и 3, чоп-аккорд на 2 и 4 (рэгтайм). */
  stride?: boolean;
  /** Джаз-блок заменяет общие ветви, но перкуссию грува оставляет. */
  fallthrough?: boolean;
  /** Длина формы в тактах (по умолчанию 8; блюз — 12). */
  bars?: number;
  /** Джазовый комплект: ride с триольной пропуской и компингом / босса-паттерн. */
  jazzKit?: 'swing' | 'bossa';
  /** Синкопированные подклады боссы (антаментация на 3.5 и 4.5 долях). */
  bossaComp?: boolean;
  /** Импровиз над changes в классической манере (контур+квантизация в лад). */
  improvStyle?: 'classical';
  /** Альбертиев бас [0,2,1,2] по тонам аккорда — барочная опора вместо шага. */
  alberti?: boolean;
  /** Фингерстайл-арпеджио p-i-m-a-m-i из табов «Rising Sun» вместо обычного баса. */
  arpBass?: boolean;
}

/** Природный слой саундскейпа: подушки на такт и редкие события на круг. */
export interface NatureSpec {
  beds?: ('wind' | 'rain' | 'stream' | 'waves' | 'crickets')[];
  birdsPerBar?: number;
  dropletsPerBar?: number;
  owlBars?: number[];
  gullBars?: number[];
  thunderBars?: number[];
}

const K = (...steps: number[]) => Array.from({ length: 16 }, (_, i) => (steps.includes(i) ? 1 : 0));
const EIGHTH_HAT = K(0, 2, 4, 6, 8, 10, 12, 14);
const MOTIF_CORE = [0, 2, 4, 3, 1, 4, 2, 0];

const GROOVES: Record<string, GrooveSpec> = {
  // полка «Тренд 2026»
  bounce: { kick: K(0, 10), snare: K(4, 12), hat: K(3, 6, 11, 13, 14), clap: [], bass: 'slide', chord: 'none', chordIntervals: [], lead: 'square', leadBase: 66, hook: 'sixseven', motif: [5, 6, 5, 6, 4, 5, 6, 4], swing: 0.08, sidechain: 0.35, rev: 0.14, dly: 0.16, crash: [0, 4], fill: true },
  duck: { kick: K(0, 4, 8, 12), snare: [], hat: EIGHTH_HAT, clap: K(4, 12), openHat: K(14), bass: 'offbeat', chord: 'stab', chordIntervals: [0, 4, 7, 9], lead: 'epiano', leadBase: 66, hook: 'wave', motif: [0, 0, 2, 2, 4, 4, 2, 0], swing: 0.18, sidechain: 0.45, rev: 0.2, dly: 0.12, crash: [0], fill: true },
  kpop: { kick: K(0, 4, 8, 12), snare: [], hat: EIGHTH_HAT, clap: K(4, 12), bass: 'eighth', chord: 'pad', chordIntervals: [0, 4, 7, 11], lead: 'supersaw', leadBase: 66, build: true, padAttack: 0.06, stringsOverlay: true, motif: [0, 2, 4, 7, 4, 2, 0, 4], bellOverlay: true, sidechain: 0.4, rev: 0.34, dly: 0.22, crash: [0, 2, 4, 6], fill: true, riser: true },
  phonk: { kick: K(0, 6, 10), snare: K(4, 12), hat: K(0, 2, 3, 5, 6, 8, 10, 11, 13), clap: [], bass: 'slide', chord: 'pad', chordIntervals: [0, 3, 7], padAttack: 0.1, lead: 'cowbell', leadBase: 78, motif: [0, 3, 0, 5, 3, 0, 7, 5], swing: 0.16, sidechain: 0.5, rev: 0.12, dly: 0.1, crash: [0, 4], fill: true },
  punk: { kick: K(0, 6, 8, 14), snare: K(4, 12), hat: EIGHTH_HAT, clap: [], openHat: K(14), bass: 'eighth', chord: 'power', chordIntervals: [0, 7], lead: 'supersaw', leadBase: 66, motif: [0, 0, 3, 0, 5, 3, 0, 2], cutoff: 3200, rev: 0.1, dly: 0.12, crash: [0, 4], fill: true },
  ethno: { kick: K(0, 8, 11), snare: K(4, 12), hat: K(2, 5, 7, 10, 13), clap: [], bass: 'drone', chord: 'strings', chordIntervals: [0, 7], lead: 'flute', leadBase: 66, grace: true, motif: [0, 1, 2, 4, 2, 1, 4, 2], cutoff: 3600, rev: 0.4, dly: 0.26, fill: true },

  // база 0.13.0 — акустика
  fingerstyle: {
    kick: [], snare: [], hat: [], clap: [], acousticDrums: true, bass: 'none', chord: 'none', chordIntervals: [],
    lead: 'none', duoLead: 'guitar', pompeFlag: true, walkFlag: true,
    leadBase: 66, motif: MOTIF_CORE, swing: 0.62, swing8: true, duo: true, uprightBass: true,
    // «When the Saints Go Marching In» (традиционный спиричуэл, PD): тема в
    // пяти звуках C-E-F-G, хорус 8 тактов
    melody: [
      { e: 0, d: 2, n: 0 }, { e: 2, d: 2, n: 4 }, { e: 4, d: 2, n: 5 }, { e: 6, d: 2, n: 7 },
      { e: 8, d: 2, n: 0 }, { e: 10, d: 3, n: 4 }, { e: 13, d: 1, n: 5 }, { e: 14, d: 2, n: 7 },
      { e: 16, d: 2, n: 0 }, { e: 18, d: 2, n: 4 }, { e: 20, d: 2, n: 5 }, { e: 22, d: 2, n: 7 },
      { e: 24, d: 2, n: 4 }, { e: 26, d: 3, n: 0 }, { e: 29, d: 1, n: 4 }, { e: 30, d: 2, n: 2 },
      { e: 32, d: 2, n: 4 }, { e: 34, d: 2, n: 5 }, { e: 36, d: 2, n: 7 }, { e: 38, d: 2, n: 4 },
      { e: 40, d: 1, n: 0 }, { e: 41, d: 1, n: 2 }, { e: 42, d: 4, n: 0 },
      { e: 48, d: 2, n: 4 }, { e: 50, d: 2, n: 5 }, { e: 52, d: 2, n: 7 }, { e: 54, d: 2, n: 4 },
      { e: 56, d: 2, n: 0 }, { e: 58, d: 2, n: 2 }, { e: 60, d: 4, n: 0, k: 'end' },
    ],
    // оригинальная прогрессия в идиоме джипси-свинга: мажор, субдоминанта
    // с минорным обменом, оборот через VI7 и ii–V, в конце — turnaround
    changes: [
      { r: 0, q: 'M' }, { r: 0, q: 'M' }, { r: 5, q: 'M' }, { r: 5, q: 'm' },
      { r: 0, q: 'M' }, { r: 9, q: '7' }, { r: 2, q: 'm' }, { r: 7, q: '7' },
      { r: 0, q: 'M' }, { r: 0, q: '7' }, { r: 5, q: 'M' }, { r: 5, q: 'm' },
      { r: 2, q: 'm' }, { r: 7, q: '7' }, { r: 0, q: 'M' }, { r: 9, q: '7' },
    ],
    rev: 0.3, dly: 0.12,
  },
  strum: { kick: K(0, 8), snare: K(4, 12), hat: EIGHTH_HAT, clap: [], acousticDrums: true, bass: 'quarter', chord: 'strum', chordIntervals: [0, 4, 7], lead: 'ukulele', leadBase: 66, motif: [0, 0, 2, 4, 4, 2, 0, 2], swing: 0.1, rev: 0.25, dly: 0.12, fill: true, uprightBass: true },
  kalimba: { kick: [], snare: [], hat: K(2, 6, 10, 14), clap: K(4, 12), acousticDrums: true, bass: 'quarter', chord: 'none', chordIntervals: [], lead: 'kalimba', leadBase: 72, leadEveryBeat: true, motif: [0, 2, 4, 7, 4, 2, 0, 2], nature: { beds: ['stream'], dropletsPerBar: 2 }, rev: 0.4, dly: 0.22, uprightBass: true },
  meadow: { kick: [], snare: [], hat: K(2, 6, 10, 14), clap: [], acousticDrums: true, bass: 'quarter', chord: 'strum', chordIntervals: [0, 4, 7], lead: 'panflute', leadBase: 69, motif: [0, 2, 4, 5, 4, 2, 0, 1], swing: 0.05, nature: { beds: ['wind'], birdsPerBar: 3 }, rev: 0.45, dly: 0.25, uprightBass: true },
  bossa: {
    kick: [], snare: [], hat: [], clap: [], acousticDrums: true, jazzKit: 'bossa', bossaComp: true,
    bass: 'none', chord: 'none', chordIntervals: [0, 4, 7, 10], arpBass: true, lead: 'none', duoLead: 'guitar',
    leadBase: 66, motif: [0, 2, 3, 4, 3, 2, 0, 2], swing: 0.12, rev: 0.3, dly: 0.18, uprightBass: true,
    // «House of the Rising Sun» (традиционный фолк-блюз, PD) в минорной
    // босса-нове: Am-C-D-F-Am-E7, арпеджированная тема
    changes: [
      { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 3, q: 'M' }, { r: 3, q: 'M' },
      { r: 5, q: 'M' }, { r: 5, q: 'M' }, { r: 8, q: 'M' }, { r: 8, q: 'M' },
      { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 7, q: '7' }, { r: 7, q: '7' },
      { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 7, q: '7' }, { r: 7, q: '7' },
    ],
    melody: [
      { e: 0, d: 2, n: 0 }, { e: 2, d: 2, n: 3 }, { e: 4, d: 2, n: 7 }, { e: 6, d: 2, n: 12 }, { e: 8, d: 3, n: 7 }, { e: 11, d: 1, n: 3 }, { e: 12, d: 4, n: 0 },
      { e: 16, d: 2, n: 0 }, { e: 18, d: 2, n: 3 }, { e: 20, d: 2, n: 7 }, { e: 22, d: 2, n: 12 }, { e: 24, d: 3, n: 7 }, { e: 27, d: 1, n: 3 }, { e: 28, d: 4, n: 0 },
      { e: 32, d: 2, n: 12 }, { e: 34, d: 2, n: 10 }, { e: 36, d: 2, n: 7 }, { e: 38, d: 2, n: 3 }, { e: 40, d: 4, n: 0 },
      { e: 48, d: 2, n: 0 }, { e: 50, d: 2, n: 3 }, { e: 52, d: 2, n: 7 }, { e: 54, d: 2, n: 12 }, { e: 56, d: 3, n: 7 }, { e: 59, d: 1, n: 3 }, { e: 60, d: 4, n: 0, k: 'end' },
    ],
  },
  folk: {
    kick: K(0, 6, 8, 14), snare: K(4, 12), hat: EIGHTH_HAT, clap: [], openHat: [], acousticDrums: true,
    bass: 'none', chord: 'none', chordIntervals: [], lead: 'none', duoLead: 'balalaika',
    pompeFlag: true, walkFlag: true, fallthrough: true,
    leadBase: 69, leadEveryBeat: true, blip: true, motif: [0, 0, 2, 3, 4, 3, 2, 0], swing: 0.14, swing8: true,
    rev: 0.2, dly: 0.1, fill: true, uprightBass: true,
    // «Little Liza Jane» (традиционная, PD): рил-часть по контуру Traditional
    // Tune Archive (D-D-D | E-D-C-D | E-D-C-A | G-A | C), припев — вокальный
    // отклик диксиленда
    changes: [
      { r: 0, q: 'M' }, { r: 0, q: 'M' }, { r: 0, q: 'M' }, { r: 0, q: 'M' },
      { r: 0, q: 'M' }, { r: 0, q: 'M' }, { r: 7, q: '7' }, { r: 7, q: '7' },
      { r: 0, q: 'M' }, { r: 5, q: 'M' }, { r: 0, q: 'M' }, { r: 0, q: 'M' },
      { r: 0, q: 'M' }, { r: 7, q: '7' }, { r: 0, q: 'M' }, { r: 0, q: 'M' },
    ],
    melody: [
      { e: 0, d: 1, n: 2 }, { e: 1, d: 1, n: 2 }, { e: 2, d: 2, n: 2 },
      { e: 4, d: 4, n: 4 }, { e: 8, d: 2, n: 2 }, { e: 10, d: 1, n: 0 }, { e: 11, d: 1, n: 2 },
      { e: 12, d: 2, n: 4 }, { e: 14, d: 2, n: 2 }, { e: 16, d: 2, n: 0 }, { e: 18, d: 2, n: -3 },
      { e: 20, d: 4, n: -5 }, { e: 24, d: 4, n: -3 }, { e: 28, d: 4, n: 0 },
      { e: 32, d: 2, n: 0 }, { e: 34, d: 2, n: 4 }, { e: 36, d: 2, n: 7 }, { e: 38, d: 2, n: 4 },
      { e: 40, d: 2, n: 0 }, { e: 42, d: 2, n: 7 }, { e: 44, d: 4, n: 0 },
      { e: 48, d: 2, n: 0 }, { e: 50, d: 2, n: 4 }, { e: 52, d: 2, n: 7 }, { e: 54, d: 2, n: 4 },
      { e: 56, d: 2, n: 0 }, { e: 58, d: 2, n: 2 }, { e: 60, d: 4, n: 0, k: 'end' },
    ],
  },
  stringsstory: {
    kick: [], snare: [], hat: [], clap: [], bass: 'quarter', chord: 'strings', chordIntervals: [0, 4, 7],
    lead: 'none', duoLead: 'strings', leadBase: 69, motif: [0, 4, 2, 5, 4, 2, 1, 0],
    padAttack: 0.1, rev: 0.5, dly: 0.3, uprightBass: true,
    // «In the Pines» (традиционный аппалачский блюз, PD): минорный плач
    // струнных, тоника Am с уходом в Em и Dm
    changes: [
      { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 0, q: 'm' },
      { r: 7, q: 'm' }, { r: 7, q: 'm' }, { r: 0, q: 'm' }, { r: 0, q: 'm' },
      { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 5, q: 'm' }, { r: 5, q: 'm' },
      { r: 7, q: 'm' }, { r: 7, q: 'm' }, { r: 0, q: 'm' }, { r: 0, q: 'm' },
    ],
    melody: [
      { e: 0, d: 2, n: 0 }, { e: 2, d: 2, n: 3 }, { e: 4, d: 2, n: 7 }, { e: 6, d: 2, n: 3 }, { e: 8, d: 4, n: 0 },
      { e: 12, d: 2, n: 0 }, { e: 14, d: 2, n: 3 }, { e: 16, d: 2, n: 7 }, { e: 18, d: 2, n: 3 }, { e: 20, d: 4, n: 0 },
      { e: 24, d: 2, n: 10 }, { e: 26, d: 2, n: 7 }, { e: 28, d: 2, n: 3 }, { e: 30, d: 2, n: 0 }, { e: 32, d: 4, n: -2 },
      { e: 40, d: 2, n: 0 }, { e: 42, d: 2, n: 3 }, { e: 44, d: 2, n: 7 }, { e: 46, d: 2, n: 10 }, { e: 48, d: 3, n: 7 }, { e: 51, d: 1, n: 3 },
      { e: 52, d: 2, n: 0 }, { e: 54, d: 2, n: 3 }, { e: 56, d: 4, n: 0, k: 'end' },
    ],
  },
  blues: {
    kick: [], snare: [], hat: [], clap: [], acousticDrums: true, jazzKit: 'swing',
    bass: 'none', chord: 'none', chordIntervals: [], lead: 'none', duoLead: 'harp',
    pompeFlag: true, walkFlag: true, fallthrough: true, bars: 12,
    leadBase: 66, motif: [0, 3, 0, 3, 4, 3, 0, 2], swing: 0.2, rev: 0.25, dly: 0.15, uprightBass: true,
    // 12-тактовый блюз (C7-F7-G7) и тема в идиоме «C.C. Rider» (традиционный
    // фолк-блюз, PD): структура AAB, «Lord Lord Lord» на каденциях
    changes: [
      { r: 0, q: '7' }, { r: 0, q: '7' }, { r: 0, q: '7' }, { r: 0, q: '7' },
      { r: 5, q: '7' }, { r: 5, q: '7' }, { r: 0, q: '7' }, { r: 0, q: '7' },
      { r: 7, q: '7' }, { r: 5, q: '7' }, { r: 0, q: '7' }, { r: 7, q: '7' },
      { r: 0, q: '7' }, { r: 0, q: '7' }, { r: 0, q: '7' }, { r: 0, q: '7' },
      { r: 5, q: '7' }, { r: 5, q: '7' }, { r: 0, q: '7' }, { r: 0, q: '7' },
      { r: 7, q: '7' }, { r: 5, q: '7' }, { r: 0, q: '7' }, { r: 7, q: '7' },
    ],
    melody: [
      { e: 0, d: 2, n: 7 }, { e: 2, d: 2, n: 7 }, { e: 4, d: 1, n: 4 }, { e: 5, d: 1, n: 0 }, { e: 6, d: 2, n: 7 },
      { e: 8, d: 2, n: 9 }, { e: 10, d: 2, n: 7 }, { e: 12, d: 2, n: 4 }, { e: 14, d: 2, n: 0 },
      { e: 16, d: 2, n: 4 }, { e: 18, d: 2, n: 7 }, { e: 20, d: 2, n: 9 }, { e: 24, d: 4, n: 7 },
      { e: 32, d: 2, n: 7 }, { e: 34, d: 2, n: 7 }, { e: 36, d: 1, n: 4 }, { e: 37, d: 1, n: 0 }, { e: 38, d: 2, n: 7 },
      { e: 40, d: 2, n: 9 }, { e: 42, d: 2, n: 7 }, { e: 44, d: 2, n: 4 }, { e: 46, d: 2, n: 0 },
      { e: 48, d: 2, n: 4 }, { e: 50, d: 2, n: 7 }, { e: 52, d: 2, n: 9 }, { e: 56, d: 4, n: 0 },
      { e: 64, d: 2, n: 12 }, { e: 66, d: 2, n: 10 }, { e: 68, d: 2, n: 9 }, { e: 70, d: 2, n: 7 },
      { e: 72, d: 2, n: 4 }, { e: 74, d: 2, n: 0 }, { e: 76, d: 2, n: 4 }, { e: 78, d: 2, n: 7 },
      { e: 80, d: 2, n: 9 }, { e: 84, d: 4, n: 7 }, { e: 88, d: 2, n: 4 }, { e: 90, d: 2, n: 0 }, { e: 92, d: 4, n: 0, k: 'end' },
    ],
  },
  marimba: { kick: [], snare: [], hat: EIGHTH_HAT, clap: K(4, 12), acousticDrums: true, bass: 'quarter', chord: 'none', chordIntervals: [], lead: 'marimba', leadBase: 69, leadEveryBeat: true, motif: [0, 2, 4, 2, 5, 4, 2, 4], nature: { beds: ['wind'], dropletsPerBar: 1 }, rev: 0.35, dly: 0.2, uprightBass: true },
  classical: {
    kick: [], snare: [], hat: [], clap: [], bass: 'none', chord: 'none', chordIntervals: [],
    lead: 'none', duoLead: 'piano', stride: true,
    leadBase: 72, motif: [0, 2, 4, 7, 9, 7, 4, 2], padAttack: 0.08, rev: 0.4, dly: 0.15, swing: 0.05, uprightBass: true,
    // «The Entertainer» (Скотт Джоплин, 1902 — PD): A-секция рэгтайма,
    // страйд-рояль, хроматические соседи D-D#-E и F# — подпись темы
    changes: [
      { r: 0, q: 'M' }, { r: 0, q: 'M' }, { r: 0, q: '7' }, { r: 0, q: '7' },
      { r: 5, q: 'M' }, { r: 5, q: 'M' }, { r: 0, q: 'M' }, { r: 0, q: 'M' },
      { r: 2, q: '7' }, { r: 2, q: '7' }, { r: 7, q: '7' }, { r: 7, q: '7' },
      { r: 0, q: 'M' }, { r: 0, q: 'M' }, { r: 7, q: '7' }, { r: 7, q: '7' },
    ],
    melody: [
      { e: 0, d: 1, n: 2 }, { e: 1, d: 1, n: 3 }, { e: 2, d: 2, n: 4 }, { e: 4, d: 1, n: 0 }, { e: 5, d: 1, n: 4 }, { e: 6, d: 1, n: 0 }, { e: 7, d: 1, n: 4 },
      { e: 8, d: 1, n: 0 }, { e: 9, d: 1, n: 4 }, { e: 10, d: 1, n: 0 }, { e: 11, d: 1, n: 4 }, { e: 12, d: 4, n: 0 },
      { e: 16, d: 1, n: 0 }, { e: 17, d: 1, n: 2 }, { e: 18, d: 1, n: 3 }, { e: 19, d: 1, n: 4 }, { e: 20, d: 1, n: 0 }, { e: 21, d: 1, n: 4 }, { e: 22, d: 1, n: 0 }, { e: 23, d: 1, n: 4 },
      { e: 24, d: 1, n: 0 }, { e: 25, d: 1, n: 2 }, { e: 26, d: 1, n: 3 }, { e: 27, d: 1, n: 4 }, { e: 28, d: 1, n: 0 }, { e: 29, d: 1, n: 2 }, { e: 30, d: 1, n: 4 }, { e: 31, d: 1, n: 11 },
      { e: 32, d: 4, n: 0 }, { e: 36, d: 1, n: 2 }, { e: 37, d: 1, n: 3 }, { e: 38, d: 2, n: 4 },
      { e: 40, d: 1, n: 0 }, { e: 41, d: 1, n: 2 }, { e: 42, d: 1, n: 3 }, { e: 43, d: 1, n: 4 }, { e: 44, d: 1, n: 0 }, { e: 45, d: 1, n: 4 }, { e: 46, d: 1, n: 0 }, { e: 47, d: 1, n: 4 },
      { e: 48, d: 1, n: 0 }, { e: 49, d: 1, n: 2 }, { e: 50, d: 1, n: 3 }, { e: 51, d: 1, n: 4 }, { e: 52, d: 1, n: 0 }, { e: 53, d: 1, n: 2 }, { e: 54, d: 1, n: 4 }, { e: 55, d: 1, n: 11 },
      { e: 56, d: 2, n: 2 }, { e: 58, d: 2, n: 4 }, { e: 60, d: 4, n: 0, k: 'end' },
    ],
  },

  // база 0.13.0 — чистые саундскейпы природы (без музыки и ударных)
  birdscape: { kick: [], snare: [], hat: [], clap: [], bass: 'none', chord: 'none', chordIntervals: [], lead: 'none', leadBase: 66, motif: [0], nature: { beds: ['wind', 'stream'], birdsPerBar: 4 }, rev: 0.5 },
  wavescape: { kick: [], snare: [], hat: [], clap: [], bass: 'none', chord: 'none', chordIntervals: [], lead: 'none', leadBase: 66, motif: [0], nature: { beds: ['waves', 'wind'], gullBars: [2, 6] }, rev: 0.55 },
  rainscape: { kick: [], snare: [], hat: [], clap: [], bass: 'none', chord: 'none', chordIntervals: [], lead: 'none', leadBase: 66, motif: [0], nature: { beds: ['rain', 'wind'], dropletsPerBar: 5, thunderBars: [6] }, rev: 0.5 },
  nightscape: { kick: [], snare: [], hat: [], clap: [], bass: 'none', chord: 'none', chordIntervals: [], lead: 'none', leadBase: 66, motif: [0], nature: { beds: ['crickets', 'wind'], owlBars: [2, 6] }, rev: 0.45 },
};

const FALLBACK_GROOVE = GROOVES.fingerstyle;

/** Какие грувы умеет синтезатор из коробки: проверка каталога сверяет с ним каждый трек. */
export const GROOVE_IDS: readonly string[] = Object.keys(GROOVES);

/** Живой список грувов: registerGrooves() расширяет таблицу (лаборатория, волны 2–5). */
export function grooveIds(): readonly string[] {
  return Object.keys(GROOVES);
}

/** Добавляет грувы снаружи (лаборатория слушает ещё не принятые волны). Каталог приложения не меняется. */
export function registerGrooves(extra: Record<string, GrooveSpec>) {
  Object.assign(GROOVES, extra);
}

function specOf(track: MusicTrack): GrooveSpec {
  return GROOVES[track.groove] ?? FALLBACK_GROOVE;
}

/** Ступень лада трека: индекс заворачивается, поэтому мотив не может «выпасть» из тональности. */
function degree(track: MusicTrack, index: number) {
  const scale = track.scale;
  return scale[((index % scale.length) + scale.length) % scale.length];
}

// ── Аранжировщик шага ───────────────────────────────────────────────────────

const ROOTS = [48, 53, 55, 50, 48, 53, 45, 50];

function leadVoice(ctx: AudioContext, spec: GrooveSpec, state: ReturnType<typeof playbackFor>, o: { midi: number; at: number; dur: number; gain: number; pan: number }) {
  const freq = hz(o.midi);
  const gain = o.gain * state.lead;
  const cutoff = Math.min(spec.cutoff ?? 6500, state.cutoff || Infinity);
  const send: Send = { bus: 'lead', pan: o.pan, rev: spec.rev ?? 0.25, dly: spec.dly ? spec.dly * 0.6 : 0 };
  if (spec.lead === 'guitar') ksVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain: gain * 1.15, bright: 0.62, body: 'guitar', cutoff });
  else if (spec.lead === 'ukulele') ksVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain: gain * 1.05, bright: 0.72, sustain: 0.995, body: 'ukulele', cutoff });
  else if (spec.lead === 'balalaika') ksVoice(ctx, { ...send, at: o.at, freq, dur: o.dur * 0.8, gain, bright: 0.8, sustain: 0.99, body: 'balalaika', cutoff });
  else if (spec.lead === 'kalimba') malletVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain, ratio: 5.4 });
  else if (spec.lead === 'marimba') malletVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain, ratio: 4.2 });
  else if (spec.lead === 'harp') harpVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain, cutoff });
  else if (spec.lead === 'panflute') fluteVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain: gain * 1.05, cutoff }, 'pan');
  else if (spec.lead === 'piano') pianoVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain, cutoff });
  else if (spec.lead === 'flute') fluteVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain: gain * 0.95, cutoff }, 'concert');
  else if (spec.lead === 'strings') stringsVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain: gain * 0.8, attack: 0.09, cutoff });
  else if (spec.lead === 'epiano') dxVoice(ctx, 'epiano', { ...send, at: o.at, freq, dur: o.dur, gain, cutoff });
  else if (spec.lead === 'bell') dxVoice(ctx, 'bell', { ...send, at: o.at, freq, dur: o.dur, gain: gain * 0.8, cutoff });
  else if (spec.lead === 'pluck') dxVoice(ctx, 'pluck', { ...send, at: o.at, freq, dur: o.dur, gain, cutoff: Math.min(5200, cutoff) });
  else if (spec.lead === 'supersaw') stackVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain: gain * 0.75, voices: 5, detune: 11, cutoff: Math.min(4600, cutoff), cutoffEnd: 1400 });
  else if (spec.lead === 'cowbell') drumHit(ctx, o.at, 'cowbell', gain * 14, state.bright);
  else stackVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain, voices: 1, type: 'square', cutoff: Math.min(5000, cutoff) });
}

function scheduleStep(track: MusicTrack, spec: GrooveSpec, state: ReturnType<typeof playbackFor>, step: number, at: number) {
  const ctx = audio();
  if (!ctx || !mix) return;
  const s16 = step % 16;
  const bar = Math.floor(step / 16);
  const beat = Math.floor(s16 / 4);
  // тоника и состав аккорда — из прогрессии грува, если она есть (стандарты),
  // иначе прежний круг ROOTS
  const chSlot = spec.changes ? (bar % (spec.changes.length >> 1)) * 2 + (s16 >= 8 ? 1 : 0) : 0;
  const chNow = spec.changes ? spec.changes[chSlot] : null;
  const root = chNow ? 48 + chNow.r : ROOTS[bar % ROOTS.length];
  const iv = chNow
    ? (chNow.q === 'm' ? [0, 3, 7, 10] : chNow.q === '7' ? [0, 4, 7, 10] : [0, 4, 7, 12])
    : spec.chordIntervals;
  const beatSeconds = 60 / state.bpm;
  const full = bar >= 2 || !spec.build;
  const hum = human(track.id, step);
  const t = at + hum.dt;
  const panLead = bar % 2 === 0 ? -0.12 : 0.12;

  // Сайдчейн: бочка на долю приглушает бас и аккорды — «дыхание» танцевального трека
  const depth = (spec.sidechain ?? 0) * (scene === 'lesson' ? state.drums : 1);
  if (depth > 0 && spec.kick[s16]) {
    [mix.duckBass, mix.duckChord].forEach((duck) => {
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(Math.max(0.25, 1 - depth), t);
      duck.gain.linearRampToValueAtTime(1, t + Math.min(0.34, beatSeconds * 0.9));
    });
  }

  // Аккорды: пэд стерео-парой, стэбы,_power_ суперпилой; краски 7/9 — из таблицы
  if (spec.chord === 'pad' && s16 === 0) {
    iv.forEach((interval, i) => {
      const midi = root + 12 + interval + (i % 2 === 1 ? 12 : 0);
      stackVoice(ctx, {
        at: t, freq: hz(midi), dur: beatSeconds * 3.6, gain: 0.016 * hum.gv,
        voices: 2, detune: 7, attack: spec.padAttack ?? 0.02, cutoff: Math.min(2400, state.cutoff || 2400),
        sustain: 0.85, bus: 'chord', pan: i % 2 === 0 ? -0.4 : 0.4, rev: (spec.rev ?? 0.25) * 0.8,
      });
    });
  }
  if (spec.chord === 'keys' && s16 === 0) {
    iv.forEach((interval, i) =>
      pianoVoice(ctx, {
        at: t, freq: hz(root + 12 + interval + (i % 2 === 1 ? 12 : 0)), dur: beatSeconds * 3.2,
        gain: 0.02 * hum.gv, cutoff: Math.min(4200, state.cutoff || 4200),
        bus: 'chord', pan: i % 2 === 0 ? -0.25 : 0.25, rev: (spec.rev ?? 0.25) * 0.9,
      }),
    );
  }
  if (spec.chord === 'strings' && s16 === 0) {
    iv.forEach((interval) =>
      stringsVoice(ctx, {
        at: t, freq: hz(root + 12 + interval), dur: beatSeconds * 3.8,
        gain: 0.013 * hum.gv, attack: 0.14, cutoff: Math.min(2600, state.cutoff || 2600),
        bus: 'chord', pan: 0, rev: (spec.rev ?? 0.3) * 0.9,
      }),
    );
  }
  if (spec.stringsOverlay && bar >= 4 && s16 === 0) {
    [12, 19].forEach((interval) =>
      stringsVoice(ctx, {
        at: t, freq: hz(root + interval), dur: beatSeconds * 3.8,
        gain: 0.011 * hum.gv, attack: 0.18, cutoff: 2400,
        bus: 'chord', pan: 0, rev: (spec.rev ?? 0.3) * 0.8,
      }),
    );
  }
  if (spec.bellOverlay && bar >= 4 && s16 === 0) {
    // DX-колокол (нечастные отношения 3.42/6.71) — «золотой» блеск в дропе:
    // гимн растёт в ширину двумя слоями, струнные держат, колокола сверкают
    [12, 19].forEach((interval, i) =>
      dxVoice(ctx, 'bell', {
        at: t + i * 0.035, freq: hz(root + interval), dur: beatSeconds * 2.4,
        gain: 0.012 * hum.gv, cutoff: 5200,
        bus: 'chord', pan: i === 0 ? -0.35 : 0.35, rev: (spec.rev ?? 0.3) * 0.9,
      }),
    );
  }
  if (spec.bossaComp && (s16 === 6 || s16 === 13) && mulberry(hashString(`${track.id}:bc:${step}`))() < 0.8) {
    iv.forEach((interval, i) =>
      ksVoice(ctx, {
        at: t + i * 0.012, freq: hz(root + 12 + interval), dur: beatSeconds * 0.6,
        gain: 0.014 * hum.gv, bright: 0.5, body: 'guitar', chop: 0.3, sustain: 0.993,
        cutoff: Math.min(5000, state.cutoff || 5000), bus: 'chord', pan: i % 2 === 0 ? -0.2 : 0.2,
        rev: (spec.rev ?? 0.25) * 0.6,
      }),
    );
  }
  if (spec.chord === 'strum' && s16 === 0) {
    iv.forEach((interval, i) =>
      ksVoice(ctx, {
        at: t + i * 0.018, freq: hz(root + 12 + interval + (i % 2 === 1 ? 12 : 0)),
        dur: beatSeconds * 2.6, gain: 0.021 * hum.gv, bright: 0.5, body: 'guitar',
        cutoff: Math.min(5000, state.cutoff || 5000),
        bus: 'chord', pan: i % 2 === 0 ? -0.25 : 0.25, rev: (spec.rev ?? 0.25) * 0.8,
      }),
    );
  }
  if (spec.chord === 'stab' && (s16 === 2 || s16 === 10)) {
    iv.forEach((interval, i) =>
      dxVoice(ctx, 'brass', {
        at: t, freq: hz(root + 12 + interval), dur: beatSeconds * 0.32, gain: 0.02 * hum.gv,
        cutoff: Math.min(4200, state.cutoff || 4200),
        bus: 'chord', pan: i % 2 === 0 ? -0.3 : 0.3, rev: (spec.rev ?? 0.2) * 0.7,
      }),
    );
  }
  if (spec.chord === 'power' && step % 2 === 0) {
    iv.forEach((interval) =>
      stackVoice(ctx, {
        at: t, freq: hz(root + interval), dur: beatSeconds * 0.4, gain: 0.028 * hum.gv,
        voices: 4, detune: 9, cutoff: Math.min(1900, state.cutoff || 1900), cutoffEnd: 700,
        bus: 'chord', pan: interval === 0 ? -0.2 : 0.2, rev: 0.08,
      }),
    );
  }

  // Бас: в акустических грувах — щипковый контрабас (KS с декой upright),
  // в электронных — синтезаторный саб+пила
  const playBass = (midi: number, at: number, dur: number, gain: number, glideTo?: number) => {
    if (spec.uprightBass && !glideTo) {
      ksVoice(ctx, { at, freq: hz(midi), dur, gain: gain * 0.95, bright: 0.28, sustain: 0.9975, body: 'upright', bus: 'bass', rev: 0.05 });
    } else {
      bassVoice(ctx, { at, freq: hz(midi), dur, gain, cutoff: 700, glideTo: glideTo ? hz(glideTo) : undefined });
    }
  };
  // Арпеджио из табов «House of the Rising Sun» (guitaretab/tabs4acoustic/
  // richterguitar): большой палец — бас, затем вверх по трём верхним струнам
  // и обратно, p-i-m-a-m-i. Для Am таб даёт A2-E3-A3-C4-E4-C4-A3-E3 —
  // обобщаем на любой аккорд из changes. В уроке редеет до четвертей.
  if (spec.arpBass && chNow && s16 % (scene === 'lesson' ? 4 : 2) === 0) {
    const inL = scene === 'lesson';
    const arpTones = [0, iv[2] ?? 7, 12, (iv[1] ?? 3) + 12, (iv[2] ?? 7) + 12, (iv[1] ?? 3) + 12, 12, iv[2] ?? 7];
    const j = inL ? (s16 >> 2) * 2 : s16 >> 1;
    ksVoice(ctx, {
      at: t, freq: hz(root - 12 + arpTones[j]), dur: beatSeconds * (inL ? 0.9 : 0.48),
      gain: 0.05 * hum.gv * (inL ? 0.8 : 1), bright: 0.55, body: 'guitar', sustain: 0.996,
      cutoff: Math.min(5200, state.cutoff || 5200), bus: 'bass', pan: j % 4 < 2 ? -0.15 : 0.15,
      rev: (spec.rev ?? 0.25) * 0.5,
    });
  }
  if (spec.bass === 'quarter' && s16 % 4 === 0) playBass(root, t, beatSeconds * 0.8, 0.085 * hum.gv);
  if (spec.bass === 'eighth' && s16 % 2 === 0) playBass(root + (s16 % 4 === 2 ? 12 : 0), t, beatSeconds * 0.4, 0.075 * hum.gv);
  if (spec.bass === 'offbeat' && s16 % 4 === 2) playBass(root, t, beatSeconds * 0.38, 0.08 * hum.gv);
  if (spec.bass === 'drone' && s16 === 0) {
    playBass(root, t, beatSeconds * 3.8, 0.08 * hum.gv);
    playBass(root + 7, t, beatSeconds * 3.8, 0.045 * hum.gv);
  }
  if (spec.bass === 'slide' && (s16 === 0 || s16 === 6 || s16 === 10)) {
    playBass(root - (s16 === 0 ? 5 : 0), t, beatSeconds * 0.66, 0.1 * hum.gv, root);
  }

  // Мелодия: свежая фраза на каждый такт, тембр из таблицы, стерео-чередование
  const phrase = (beat + bar * 3 + (track.id.length % 4)) % spec.motif.length;
  const alternates = (beat + bar) % 2 === 0;
  if (spec.lead !== 'none' && full && s16 % 4 === 0 && (alternates || spec.leadEveryBeat)) {
    const midi = spec.leadBase + degree(track, spec.motif[phrase]);
    if (spec.grace) {
      leadVoice(ctx, spec, state, { midi: midi + 1, at: t, dur: beatSeconds * 0.09, gain: 0.032, pan: panLead });
      leadVoice(ctx, spec, state, { midi, at: t + beatSeconds * 0.1, dur: beatSeconds * 0.7, gain: 0.045, pan: panLead });
    } else if (spec.lead === 'cowbell') {
      if (state.bright) drumHit(ctx, t, 'cowbell', state.drums * 0.9, true);
      leadVoice(ctx, { ...spec, lead: 'square' }, state, { midi: midi - 12, at: t, dur: beatSeconds * 0.4, gain: 0.02, pan: panLead });
    } else {
      leadVoice(ctx, spec, state, { midi, at: t, dur: beatSeconds * 0.72, gain: 0.045, pan: panLead });
    }
  }
  if (spec.blip && spec.lead !== 'none' && s16 === 6 && step % 8 === 6) {
    leadVoice(ctx, spec, state, { midi: 72 + degree(track, phrase + 2), at: t, dur: beatSeconds * 0.26, gain: 0.03, pan: -panLead });
  }

  // Узнаваемая фигурка тренда — то, что ребёнок слышит как «своё»
  if (spec.hook === 'sixseven' && full && (s16 === 0 || s16 === 3)) {
    // Хук — лицо мема: DX-pluck (индекс 3:1 со спадом 60 мс) даёт щелчок
    // профессионального синтезатора; сам мотив остаётся чиптюн-квадратом
    const first = s16 === 0;
    leadVoice(ctx, { ...spec, lead: 'pluck' }, state, { midi: spec.leadBase + degree(track, first ? 5 : 6), at: t, dur: beatSeconds * 0.42, gain: 0.04, pan: panLead });
    if (bar % 2 === 1 && s16 === 3) {
      leadVoice(ctx, { ...spec, lead: 'pluck' }, state, { midi: spec.leadBase + degree(track, 4), at: t + beatSeconds * 0.3, dur: beatSeconds * 0.4, gain: 0.032, pan: panLead });
    }
  }
  if (spec.hook === 'wave' && full && (s16 === 4 || s16 === 12)) {
    [0, 2].forEach((offset) =>
      leadVoice(ctx, spec, state, {
        midi: spec.leadBase + degree(track, spec.motif[(phrase + offset) % spec.motif.length]),
        at: t + offset * beatSeconds * 0.22, dur: beatSeconds * 0.2, gain: 0.038, pan: offset === 0 ? -0.14 : 0.14,
      }),
    );
  }

  // ── Джаз-дуэт двух гитар (идиома Виньолы/Раниоло, мелодии и прогрессия наши):
  // ла-помпе на долях с акцентом на 2 и 4, шагающий бас с хроматическим
  // подходом, колл-респонс фразами по 2 такта с отдыхами и синкопами,
  // конец фразы — аккордовый стаб (chord melody). Всё seeded: детерминированно.
  if ((spec.pompeFlag || spec.duo || spec.stride || spec.melody || spec.walkFlag || spec.improvStyle || spec.alberti) && spec.changes) {
    const lesson = scene === 'lesson';
    // динамическая волна формы: 8 тактов от тихого входа к пику на 7-м и
    // выдоху в обороте — луп перестаёт быть ровной «пилой» громкости
    const wave = [0.85, 0.92, 1, 1.06, 0.94, 1.04, 1.12, 0.8][bar % 8];
    const ch = chNow ?? spec.changes[chSlot];
    const next = spec.changes[(chSlot + 1) % spec.changes.length];
    const cRoot = 48 + ch.r;
    const tones = ch.q === 'm' ? [0, 3, 7, 12] : ch.q === '7' ? [0, 4, 10, 14] : [0, 4, 7, 12];
    const rnd = mulberry(hashString(`${track.id}:duo:${bar}:${s16}`));
    if (spec.stride && s16 % 4 === 0) {
      // страйд-рояль: бас на 1 и 3 (корень/квинта), чоп-аккорд на 2 и 4
      if (beat === 0 || beat === 2) {
        ksVoice(ctx, {
          at: t, freq: hz(cRoot - 12 + (beat === 2 ? 7 : 0)), dur: beatSeconds * 0.9,
          gain: 0.075 * (lesson ? 0.8 : 1) * wave, bright: 0.3, sustain: 0.9978,
          body: 'upright', bus: 'bass', rev: 0.05,
        });
        // октавное удвоение: левая рука рэгтайма берёт бас октавой (Wikipedia:
        // stride — «single bass note or an octave» на 1 и 3), низ становится плотнее
        ksVoice(ctx, {
          at: t + 0.002, freq: hz(cRoot - 24 + (beat === 2 ? 7 : 0)), dur: beatSeconds * 0.9,
          gain: 0.04 * (lesson ? 0.8 : 1) * wave, bright: 0.24, sustain: 0.9978,
          body: 'upright', bus: 'bass', rev: 0.05,
        });
      } else {
        [0, 1, 2].forEach((i) =>
          ksVoice(ctx, {
            at: t + i * 0.01, freq: hz(cRoot + 12 + [0, tones[1], tones[2] + 12][i]),
            dur: 0.4, gain: 0.024 * (lesson ? 0.55 : 1) * wave * (0.9 + rnd() * 0.2),
            bright: 0.5, body: 'guitar', chop: 0.14, sustain: 0.994,
            cutoff: Math.min(state.cutoff || 6000, 6000), bus: 'chord', pan: -0.2 + i * 0.2, rev: 0.14,
          }),
        );
      }
    } else if (spec.pompeFlag && s16 % 4 === 0) {
      // ла-помпе: чоп-аккорд, акцент 2 и 4, микро-разброс атак
      const acc = beat === 1 || beat === 3 ? 1.25 : 0.9;
      const pompeGain = 0.026 * acc * (lesson ? 0.55 : 1) * wave;
      [0, 1, 2].forEach((i) =>
        ksVoice(ctx, {
          at: t + i * 0.011 + (rnd() - 0.5) * 0.006,
          freq: hz(cRoot + 12 + [0, tones[1], tones[2] + 12][i]),
          dur: 0.5, gain: pompeGain * (0.9 + rnd() * 0.2), bright: 0.55,
          body: 'guitar', chop: 0.15, sustain: 0.994, cutoff: Math.min(state.cutoff || 6000, 6000),
          bus: 'chord', pan: -0.22 + i * 0.2, rev: 0.16,
        }),
      );
      // шагающий бас: корень/терция-квинта/passing/подход; passing — хроматика
      // к следующей тонике или ближайший тон аккорда (walking bass по предложению)
      const target = (next.r - ch.r + 12) % 12;
      const walk = beat === 0 ? 0
        : beat === 3 ? target - 1
        : beat === 1 ? (rnd() < 0.5 ? tones[1] : tones[2])
        : rnd() < 0.5 ? target - 2 : tones[Math.floor(rnd() * 3)];
      ksVoice(ctx, {
        at: t + (rnd() - 0.5) * 0.008, freq: hz(cRoot + walk - 12),
        dur: beatSeconds * 0.95, gain: 0.07 * (0.85 + rnd() * 0.3) * (lesson ? 0.8 : 1) * wave,
        bright: 0.3, sustain: 0.9978, body: 'upright', bus: 'bass', rev: 0.05,
      });
    }
    if (spec.alberti && s16 % (lesson ? 4 : 2) === 0) {
      // альбертиев бас: [0,2,1,2] по тонам аккорда, восьмыми, мягко
      const idx = [0, 2, 1, 2][(s16 >> 1) % 4];
      ksVoice(ctx, {
        at: t + (rnd() - 0.5) * 0.006, freq: hz(cRoot - 12 + tones[idx % tones.length]),
        dur: beatSeconds * 0.45, gain: 0.055 * (0.9 + rnd() * 0.2) * (lesson ? 0.8 : 1) * wave,
        bright: 0.32, sustain: 0.9972, body: 'upright', bus: 'bass', rev: 0.08,
      });
    }
    // Мелодия стандарта: чётные круги — тема (head), нечётные — вариация
    if (spec.melody && step % 2 === 0) {
      const head = loopCycle % 2 === 0;
      const e = step >> 1;
      const mev = spec.melody.find((x) => x.e === e);
      if (mev) {
        const lr = mulberry(hashString(`${track.id}:mel:${loopCycle}:${e}`));
        const skip = !head && mev.k !== 'end' && lr() < 0.22;
        if (!skip) {
          const oct = !head && lr() < 0.3 ? 12 : 0;
          const midi = 60 + (spec.melodyOct ?? 0) + mev.n + oct;
          const durS = mev.d * beatSeconds * 0.5 * 0.95;
          const mGain = 0.048 * wave * (lesson ? 0.8 : 1) * (0.9 + lr() * 0.2);
          const atM = t + (head ? (lr() - 0.5) * 0.008 : (lr() - 0.5) * 0.02);
          if (mev.k === 'end') {
            const late = atM + 0.045 + lr() * 0.035;
            leadVoice(ctx, { ...spec, lead: spec.duoLead ?? spec.lead }, state, {
              midi: midi - 1, at: late - 0.04, dur: 0.12, gain: mGain * 0.45, pan: panLead,
            });
            leadVoice(ctx, { ...spec, lead: spec.duoLead ?? spec.lead }, state, {
              midi, at: late, dur: durS + 0.3, gain: mGain, pan: panLead,
            });
          } else {
            leadVoice(ctx, { ...spec, lead: spec.duoLead ?? spec.lead }, state, {
              midi, at: atM, dur: durS, gain: mGain, pan: panLead,
            });
          }
        }
      }
    }
    // Импровиз над changes: head → improv → head. Нечётные круги (или грувы
    // без темы) играют генеративную линию: на доле тоны аккорда (с 9/11-й как
    // краской), между — взвешенные ходы по ладу; фразы по 2 такта чередуют
    // панораму и октаву, как колл-респонс; конец формы — стаб с рубато.
    if (spec.changes && step % 2 === 0 && (loopCycle % 2 === 1 || !spec.melody)) {
      const e = step >> 1;
      const formE = (spec.bars ?? 8) * 8;
      const r = mulberry(hashString(`${track.id}:imp:${loopCycle}:${step}`));
      const onBeat = step % 4 === 0;
      const phrase = Math.floor((bar % (spec.bars ?? 8)) / 2);
      const pan = phrase % 2 === 0 ? -0.25 : 0.25;
      const oct = phrase % 2 === 0 ? 12 : 24;
      const pool = CHORD_EXT[ch.q];
      const scl = scaleForQ(ch.q);
      const leadSpec = { ...spec, lead: spec.duoLead ?? spec.lead };
      const cutoff = Math.min(state.cutoff || 6500, 6500);
      if (e === formE - 2) {
        const late = t + 0.04 + r() * 0.035;
        [0, 4, 7].forEach((semi, i) =>
          leadVoice(ctx, leadSpec, state, {
            midi: cRoot + oct + semi - 12, at: late + i * 0.013, dur: 0.8,
            gain: 0.04 * wave * (lesson ? 0.8 : 1), pan: pan + (i - 1) * 0.12,
          }),
        );
        improvPrev[track.id] = 0;
      } else if (lesson
        ? onBeat && r() < 0.7
        : spec.improvStyle === 'classical'
          ? onBeat
          : r() < (onBeat ? 0.85 : step % 4 === 2 ? 0.55 : 0.4)) {
        let semi: number;
        if (spec.improvStyle === 'classical') {
          // контур-арка + квантизация в лад (классический генератор)
          const tt = e / formE;
          const contour = Math.sin(tt * Math.PI) * 10 + 4;
          const pc = Math.round(contour) % 12;
          semi = scl.reduce((best, n) => (Math.abs(n - pc) < Math.abs(best - pc) ? n : best), scl[0]);
        } else if (onBeat && r() < 0.7) {
          semi = pool[Math.floor(r() * (r() < 0.15 ? 5 : 4))];
        } else {
          const cand = r() < 0.5 ? scl : pool;
          const prev = improvPrev[track.id] ?? 4;
          const weights = cand.map((n) => {
            const d = Math.abs(n - prev);
            return d === 0 ? 0.1 : d <= 2 ? 3 : d <= 4 ? 2 : d <= 7 ? 1 : 0.3;
          });
          const sum = weights.reduce((a, b) => a + b, 0);
          let pick = r() * sum;
          semi = cand[cand.length - 1];
          for (let i = 0; i < cand.length; i++) {
            pick -= weights[i];
            if (pick <= 0) { semi = cand[i]; break; }
          }
          // enclosure: подход к цели через полутон сверху
          if (!onBeat && r() < 0.2) semi += 1;
        }
        improvPrev[track.id] = semi;
        const durE = spec.improvStyle === 'classical' ? 2 : [1, 1, 2, 2, 3][Math.floor(r() * 5)];
        const gI = 0.045 * wave * (lesson ? 0.8 : 1) * (0.85 + r() * 0.3);
        if (!lesson && r() < 0.12) {
          leadVoice(ctx, leadSpec, state, {
            midi: cRoot + oct + semi - 1, at: t - 0.035, dur: 0.1, gain: gI * 0.5, pan,
          });
        }
        leadVoice(ctx, leadSpec, state, {
          midi: cRoot + oct + semi, at: t + (r() - 0.5) * 0.012,
          dur: durE * beatSeconds * 0.5 * 0.95, gain: gI, pan,
        });
      }
      void cutoff;
    }
    // колл-респонс-шаблоны остались запасной грамматикой для грувов без changes
    if (spec.duo && !spec.changes && loopCycle % 2 === 1 && step % 2 === 0) {
      const phStep = step % 32;
      const phrase = Math.floor((bar % 8) / 2);
      const call = phrase % 2 === 0;
      const e = phStep / 2;
      const cyc = loopCycle;
      const TEMPLATES: { e: number; d: number; kind: 'c' | 'p' | 'end' }[][] = [
        [{ e: 0, d: 2, kind: 'c' }, { e: 3, d: 1, kind: 'p' }, { e: 4, d: 2, kind: 'c' }, { e: 6, d: 1, kind: 'p' }, { e: 8, d: 3, kind: 'c' }, { e: 12, d: 1, kind: 'p' }, { e: 14, d: 2, kind: 'c' }],
        [{ e: 0, d: 1, kind: 'p' }, { e: 2, d: 2, kind: 'c' }, { e: 5, d: 1, kind: 'p' }, { e: 6, d: 2, kind: 'c' }, { e: 8, d: 2, kind: 'p' }, { e: 10, d: 2, kind: 'c' }, { e: 12, d: 4, kind: 'end' }],
        [{ e: 0, d: 3, kind: 'c' }, { e: 4, d: 1, kind: 'p' }, { e: 6, d: 2, kind: 'c' }, { e: 9, d: 1, kind: 'p' }, { e: 10, d: 2, kind: 'c' }, { e: 12, d: 1, kind: 'p' }, { e: 14, d: 2, kind: 'c' }],
        [{ e: 2, d: 2, kind: 'c' }, { e: 4, d: 1, kind: 'p' }, { e: 6, d: 3, kind: 'c' }, { e: 10, d: 1, kind: 'p' }, { e: 12, d: 2, kind: 'c' }, { e: 14, d: 2, kind: 'end' }],
      ];
      // каждый второй круг фразы меняют очерёдность шаблонов: та же
      // грамматика, другой рассказ
      const tIdx = (phrase + (cyc % 2) * 2) % 4;
      const firstE = TEMPLATES[tIdx][0].e;
      // вдох: «ответ» иногда молчит в первой реплике — вопрос повисает
      const breathSkip = !call && e === firstE &&
        mulberry(hashString(`${track.id}:breath:${cyc}:${phrase}`))() < 0.25;
      const ev = breathSkip ? undefined : TEMPLATES[tIdx].find((x) => x.e === e);
      if (ev) {
        const lr = mulberry(hashString(`${track.id}:duoL:${cyc}:${bar}:${e}`));
        const octave = call ? 12 : 24;
        const pan = call ? -0.25 : 0.25;
        const leadK = lesson ? 0.8 : 1;
        const noteGain = 0.05 * (0.85 + lr() * 0.3) * leadK;
        const durS = ev.d * beatSeconds * 0.5 * 0.95;
        const cutoff = Math.min(state.cutoff || 6500, 6500);
        if (ev.kind === 'end') {
          // рубато каденции: стаб приходит на 45–80 мс позже доли (laid back),
          // с grace-нотой полутоном ниже за 40 мс — жест живой руки
          const late = t + 0.045 + lr() * 0.035;
          ksVoice(ctx, {
            at: late - 0.04, freq: hz(cRoot + octave + tones[2] - 1), dur: 0.12,
            gain: noteGain * 0.45, bright: 0.6, body: 'guitar', chop: 0.05,
            sustain: 0.995, cutoff, bus: 'lead', pan, rev: 0.25,
          });
          // chord melody: фраза заканчивается аккордом, а не одиночной нотой
          [0, tones[1], tones[2]].forEach((semi, i) =>
            ksVoice(ctx, {
              at: late + i * 0.014, freq: hz(cRoot + octave + semi), dur: 0.9,
              gain: noteGain * 0.8, bright: 0.6, body: 'guitar', chop: 0.55,
              sustain: 0.996, cutoff, bus: 'lead', pan: pan + (i - 1) * 0.12, rev: 0.3,
            }),
          );
        } else {
          const pool = ev.kind === 'c' ? tones : [tones[0] - 1, tones[1] + 1, tones[2] - 1, tones[2] + 1];
          const semi = pool[Math.floor(lr() * pool.length)] + (ev.kind === 'c' && lr() < 0.3 ? 12 : 0);
          // enclosure: иногда цель обходится сверху через полутон — две
          // быстрые ноты вместо одной, как у живого солиста
          if (ev.kind === 'c' && lr() < 0.18) {
            ksVoice(ctx, {
              at: t, freq: hz(cRoot + octave + semi + 1), dur: durS * 0.45,
              gain: noteGain * 0.7, bright: 0.62, body: 'guitar', sustain: 0.996, cutoff,
              bus: 'lead', pan, rev: 0.3, dly: 0.12,
            });
            ksVoice(ctx, {
              at: t + durS * 0.5, freq: hz(cRoot + octave + semi), dur: durS * 0.5,
              gain: noteGain, bright: 0.62, body: 'guitar', sustain: 0.9965, cutoff,
              bus: 'lead', pan, rev: 0.3, dly: 0.12,
            });
          } else {
            ksVoice(ctx, {
              at: t + (lr() - 0.5) * 0.01, freq: hz(cRoot + octave + semi), dur: durS,
              gain: noteGain, bright: 0.62, body: 'guitar', sustain: 0.9965, cutoff,
              bus: 'lead', pan, rev: 0.3, dly: 0.12,
            });
          }
          // шорох пальца о струну на длинных нотах: 10 мс шума на 4 кГц
          if (durS >= beatSeconds * 0.9) {
            const sq = noiseSource(ctx, t, 0.012);
            const sqHp = ctx.createBiquadFilter();
            sqHp.type = 'highpass';
            sqHp.frequency.value = 4000;
            const sqG = ctx.createGain();
            sqG.gain.setValueAtTime(noteGain * 0.09, t);
            sqG.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
            sq.connect(sqHp);
            sqHp.connect(sqG);
            sqG.connect(route(ctx, { bus: 'lead', pan, rev: 0.1 }));
          }
        }
      }
    }
    // джаз-блок заменил аккорды/бас/лид — но перкуссию грува можно оставить;
    // грувы только с мелодией (босса, сказка) продолжают общие ветви
    if ((spec.pompeFlag || spec.walkFlag || spec.duo || spec.stride || spec.alberti || spec.improvStyle) && !spec.fallthrough) return;
  }

  // Джазовый комплект: ride с триольной «пропуской» (0.67 доли), фут-хэт на 2 и 4,
  // компинг-бомбы римшотом и перо-бочка; босса — восьмовой райд, кроссстик, кик 1 и 3
  if (spec.jazzKit) {
    // в уроке комплект редеет по-настоящему (меньше голосов, а не только тише):
    // райд на долях остаётся, а «пропуска», бомбы, кроссстик и щётки пропадают
    const inLesson = scene === 'lesson';
    const jk = inLesson ? 0.5 : 1;
    if (spec.jazzKit === 'swing') {
      if (s16 % 4 === 0) {
        drumHit(ctx, t, 'ride', state.drums * 0.55 * jk * (beat === 1 || beat === 3 ? 1.15 : 0.9), true);
        if (!inLesson) {
          drumHit(ctx, t + beatSeconds * 0.667, 'ride', state.drums * 0.3 * jk, true);
          if (mulberry(hashString(`${track.id}:kb:${step}`))() < 0.25) {
            drumHit(ctx, t, 'cajon', state.drums * 0.22 * jk, false);
          }
        }
      }
      if ((s16 === 4 || s16 === 12) && !inLesson) drumHit(ctx, t, 'hat', state.drums * 0.45 * jk, true);
      if (!inLesson && (s16 === 6 || s16 === 10 || s16 === 14) && mulberry(hashString(`${track.id}:cp:${step}`))() < 0.3) {
        drumHit(ctx, t, 'rim', state.drums * 0.3 * jk, false);
      }
    } else {
      const bossaRide: Record<number, number> = { 0: 0.6, 2: 0.4, 6: 0.5, 8: 0.6, 10: 0.4, 12: 0.5, 14: 0.4 };
      if (bossaRide[s16] !== undefined && (bossaRide[s16] >= 0.5 || !inLesson)) {
        drumHit(ctx, t, 'ride', state.drums * bossaRide[s16] * 0.5 * jk, true);
      }
      if ((s16 === 4 || s16 === 12) && !inLesson) drumHit(ctx, t, 'crossstick', state.drums * 0.5 * jk, false);
      if (s16 === 0 || s16 === 8) drumHit(ctx, t, 'cajon', state.drums * 0.4 * jk, false);
    }
  }

  // Перкуссия: в уроке тише, а яркие тембры (хэт, хлопок, ковбелл, крэш) молчат.
  // Акустический комплект: те же рисунки, но кахон/рим/шейкер/конга/бубен.
  const kit = spec.acousticDrums;
  if (spec.kick[s16]) drumHit(ctx, t, kit ? 'cajon' : 'kick', state.drums * hum.gv, state.bright);
  if (spec.snare[s16]) drumHit(ctx, t, kit ? 'rim' : 'snare', state.drums * hum.gv, state.bright);
  if (state.bright) {
    if (spec.hat[s16]) drumHit(ctx, t, kit ? 'shaker' : 'hat', state.drums, true);
    if (spec.openHat?.[s16]) drumHit(ctx, t, kit ? 'tambourine' : 'openhat', state.drums * 0.8, true);
    if (spec.clap[s16]) drumHit(ctx, t, kit ? 'conga' : 'clap', state.drums, true);
  }

  // Живая природа: подушки на такт, птицы/капли по сид-рандому, редкие события на круг
  if (spec.nature) {
    const level = state.bright ? 1 : 0.75;
    const barSeconds = beatSeconds * 4;
    if (s16 === 0) {
      spec.nature.beds?.forEach((bed) => {
        if (bed === 'waves') {
          // валл идёт внахлёст: следующий гребень начинается до конца предыдущего
          natureBed(ctx, bed, t, barSeconds * 1.15, level, hashString(track.id) ^ bar);
        } else if (bed === 'crickets') {
          natureBed(ctx, bed, t, barSeconds * 0.45, level, hashString(track.id) ^ bar);
          natureBed(ctx, bed, t + barSeconds * 0.5, barSeconds * 0.45, level, hashString(track.id) ^ (bar + 101));
        } else {
          natureBed(ctx, bed, t, barSeconds, level, hashString(track.id) ^ bar);
        }
      });
      const birds = spec.nature.birdsPerBar ?? 0;
      for (let i = 0; i < birds; i++) {
        const rnd = mulberry(hashString(`${track.id}:bird:${bar}:${i}`));
        birdChirp(ctx, t + rnd() * barSeconds * 0.8, hashString(track.id) ^ (bar * 16 + i), level);
      }
      const drops = spec.nature.dropletsPerBar ?? 0;
      for (let i = 0; i < drops; i++) {
        const rnd = mulberry(hashString(`${track.id}:drop:${bar}:${i}`));
        droplet(ctx, t + rnd() * barSeconds * 0.9, hashString(track.id) ^ (bar * 32 + i), level);
      }
      if (spec.nature.owlBars?.includes(bar % 8)) owlHoot(ctx, t + barSeconds * 0.5, level);
      if (state.bright && spec.nature.gullBars?.includes(bar % 8)) gullCry(ctx, t + barSeconds * 0.3, level);
      if (state.bright && spec.nature.thunderBars?.includes(bar % 8)) thunder(ctx, t, level * 0.8);
    }
  }

  // Форма лупа: крэш на старте половин, филлы на 4-м и 8-м тактах, райзер перед концом
  if (state.bright && spec.crash?.includes(bar) && s16 === 0) drumHit(ctx, t, 'crash', 0.9, true);
  if (state.bright && spec.fill) {
    if (bar % 8 === 3 && (s16 === 14 || s16 === 15)) drumHit(ctx, t, 'snare', state.drums * 0.8, true);
    if (bar % 8 === 7) {
      if (s16 === 12 || s16 === 13 || s16 === 14) drumHit(ctx, t, 'snare', state.drums * 0.85, true);
      if (s16 === 15) drumHit(ctx, t, 'tom', state.drums, true);
    }
  }
  if (state.bright && spec.riser && bar % 8 === 7 && s16 === 8) drumHit(ctx, t, 'riser', 1, true);
}

/** Запускает бесконечный оригинальный 8-тактовый луп после пользовательского нажатия. */
export function playMusic(track: MusicTrack | null, sceneName: MusicContext = scene) {
  if (!track || !enabled) {
    stop();
    return;
  }
  scene = sceneName;
  if (activeId === track.id && timer) return;
  stop();
  const ctx = audio();
  if (!ctx || !mix) return;
  mix.master.gain.cancelScheduledValues(ctx.currentTime);
  mix.master.gain.setValueAtTime(volume, ctx.currentTime);
  activeId = track.id;
  nextAt = ctx.currentTime + 0.08;
  loopLen = (GROOVES[track.groove]?.bars ?? 8) * 16;
  nextStep = 0;
  trimStart = ctx.currentTime;
  lastTrimAt = 0;
  rmsEma = 0;
  const spec = specOf(track);
  mix.dly.delayTime.setValueAtTime(Math.min(1.4, (60 / track.bpm) * 0.75), ctx.currentTime);
  let lastScene: MusicContext | null = null;
  timer = setInterval(() => {
    if (!context || !mix || activeId !== track.id) return;
    const now = context.currentTime;
    // Контекст читаем на каждом тике: переключение «урок ↔ награда» происходит
    // без перезапуска лупа и без щелчка; посылы эффектов ужимаются следом.
    const state = playbackFor(track, scene);
    if (lastScene !== scene) {
      lastScene = scene;
      const lesson = scene === 'lesson';
      mix.revReturn.gain.setTargetAtTime(lesson ? 0.12 : 0.3, now, 0.2);
      mix.dlyReturn.gain.setTargetAtTime(lesson ? 0.05 : 0.16, now, 0.2);
    }
    // Авто-громкость: раз в полсекунды меряем RMS после мастер-шины и подводим
    // трим к цели (награда 0.10, урок 0.05). Все треки звучат одинаково дорого,
    // а разница «урок тише» задаётся правилом, а не случайной аранжировкой.
    // Авто-громкость v2: окно 0.74 с + EMA между замерами + шаг не чаще 1.5 с
    // и не больше ±4% за шаг. Прежний замер окном 23 мс ходил насосом за
    // каждой нотой — это и слышалось как «ритмическая сирена».
    if (now - lastTrimAt > 1.5) {
      lastTrimAt = now;
      const buf = rmsBuffer(mix.analyser.fftSize);
      mix.analyser.getFloatTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
      const rms = Math.sqrt(sumSq / buf.length);
      if (rms > 0.002 && now - trimStart > 3) {
        rmsEma = rmsEma === 0 ? rms : rmsEma * 0.65 + rms * 0.35;
        const target = scene === 'lesson' ? 0.045 : 0.085;
        // узкий коридор: сильный буст тихих треков тянул за собой шумовой пол
        // и хвосты реверба — «шум вместо музыки»
        const wanted = Math.min(1.35, Math.max(0.7, mix.trim.gain.value * Math.pow(target / rmsEma, 0.2)));
        const current = mix.trim.gain.value;
        const next = Math.min(current * 1.04, Math.max(current * 0.96, wanted));
        mix.trim.gain.setTargetAtTime(next, now, 0.6);
      }
    }
    const stepSeconds = (60 / state.bpm) / 4;
    const swing = spec.swing ?? 0;
    if (nextAt < now - 0.5) nextAt = now + 0.05; // вкладка спала: не вываливать шквал прошедших долей
    while (nextAt < now + 0.18) {
      const offStep = spec.swing8 ? nextStep % 4 === 2 : nextStep % 2 === 1;
      const offset = offStep ? stepSeconds * swing : 0;
      scheduleStep(track, spec, state, nextStep, nextAt + offset);
      nextStep = (nextStep + 1) % loopLen;
      if (nextStep === 0) {
        loopCycle += 1;
        for (const key of Object.keys(improvPrev)) delete improvPrev[key];
      }
      nextAt += stepSeconds;
    }
  }, 45);
}

// ── Стингеры (волна 4: короткие фирменные сигналы поверх музыки) ─────────────

export type StingerId = 'sixseven' | 'cowbell' | 'duckwave' | 'golden' | 'bell';

/** Короткий оригинальный сигнал: серия правильных, сундук, финал урока, уровень, старт. */
export function playStinger(id: StingerId) {
  const ctx = audio();
  if (!ctx || !mix) return;
  const now = ctx.currentTime + 0.02;
  const beat = 0.16;
  if (id === 'sixseven') {
    [5, 6].forEach((deg, i) =>
      fmVoice(ctx, { at: now + i * beat, freq: hz(72 + deg), dur: beat * 1.6, gain: 0.05, ratio: 2, index: hz(72 + deg), bus: 'lead', pan: i === 0 ? -0.2 : 0.2, rev: 0.3, dly: 0.3 }),
    );
  } else if (id === 'cowbell') {
    [0, 0.5, 1].forEach((k) => drumHit(ctx, now + k * beat, 'cowbell', 0.9, true));
    drumHit(ctx, now + 1.5 * beat, 'kick', 0.8, true);
  } else if (id === 'duckwave') {
    [0, 2, 4, 2, 0].forEach((deg, i) =>
      fmVoice(ctx, { at: now + i * beat * 0.8, freq: hz(69 + deg), dur: beat, gain: 0.045, ratio: 2, index: hz(69 + deg) * 0.9, bus: 'lead', pan: (i - 2) * 0.15, rev: 0.3 }),
    );
  } else if (id === 'golden') {
    [0, 4, 7, 12].forEach((interval, i) =>
      stackVoice(ctx, { at: now + i * beat * 0.9, freq: hz(60 + interval), dur: beat * 2.2, gain: 0.04, voices: 4, detune: 9, cutoff: 4200, bus: 'lead', pan: (i - 1.5) * 0.2, rev: 0.45, dly: 0.25 }),
    );
  } else {
    fmVoice(ctx, { at: now, freq: hz(84), dur: 0.5, gain: 0.05, ratio: 3.5, index: hz(84) * 2.4, bus: 'lead', rev: 0.5 });
    fmVoice(ctx, { at: now + 0.34, freq: hz(87), dur: 0.6, gain: 0.045, ratio: 3.5, index: hz(87) * 2.2, bus: 'lead', pan: 0.2, rev: 0.5 });
  }
}
