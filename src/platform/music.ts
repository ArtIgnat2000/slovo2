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
}

let mix: Mix | null = null;
let noiseBuf: AudioBuffer | null = null;
let impulseBuf: AudioBuffer | null = null;

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

  post.connect(shaper);
  shaper.connect(master);
  master.connect(ctx.destination);

  return {
    sum, duckBass, duckChord, hp, glue, post, shaper, master,
    revSend, revReturn, dlySend, dlyReturn, dly, dlyFb, dlyFilter,
    lead, drum, bass, chord,
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

type DrumHit = 'kick' | 'snare' | 'hat' | 'openhat' | 'clap' | 'cowbell' | 'tom' | 'crash' | 'riser';

// ── Таблица грувов ──────────────────────────────────────────────────────────
//
// Шаги — 16-е доли, 16 шагов = такт, луп = 8 тактов (128 шагов): место для
// филлов и крэшей. Паттерны заданы числами 0/1; бас и аккорды — именем рисунка;
// мелодия — ступенями `scale` трека. Новые поля 2.0: lead — тембр звукоизвлечения,
// sidechain — глубина «дыхания» от бочки, rev/dly — посылы, crash/fill/riser — форма.

export type LeadTimbre = 'epiano' | 'bell' | 'pluck' | 'supersaw' | 'square' | 'cowbell';

export interface GrooveSpec {
  kick: number[];
  snare: number[];
  hat: number[];
  clap: number[];
  openHat?: number[];
  bass: 'quarter' | 'eighth' | 'offbeat' | 'drone' | 'slide';
  chord: 'pad' | 'stab' | 'power' | 'none';
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
}

const K = (...steps: number[]) => Array.from({ length: 16 }, (_, i) => (steps.includes(i) ? 1 : 0));
const EIGHTH_HAT = K(0, 2, 4, 6, 8, 10, 12, 14);
const MOTIF_CORE = [0, 2, 4, 3, 1, 4, 2, 0];

const GROOVES: Record<string, GrooveSpec> = {
  // базовый каталог 0.12.3 — рисунки те же, звучание теперь «взрослое»
  pop: { kick: K(0), snare: K(8, 12), hat: EIGHTH_HAT, clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], lead: 'epiano', leadBase: 66, motif: MOTIF_CORE, rev: 0.3, dly: 0.14, fill: true },
  lofi: { kick: K(0), snare: [], hat: [], clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], lead: 'epiano', leadBase: 65, motif: MOTIF_CORE, cutoff: 1500, rev: 0.5, dly: 0.3, swing: 0.06 },
  arcade: { kick: K(0), snare: K(8), hat: EIGHTH_HAT, clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], lead: 'square', leadBase: 66, leadEveryBeat: true, blip: true, motif: MOTIF_CORE, rev: 0.16, dly: 0.2, fill: true },
  dance: { kick: K(0, 8), snare: K(8), hat: EIGHTH_HAT, clap: [], openHat: K(4, 12), bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], lead: 'epiano', leadBase: 66, motif: MOTIF_CORE, sidechain: 0.5, rev: 0.22, dly: 0.2, crash: [0, 4], fill: true, riser: true },
  tropical: { kick: K(0, 12), snare: K(8), hat: [], clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], lead: 'pluck', leadBase: 66, motif: MOTIF_CORE, rev: 0.4, dly: 0.24, fill: true },
  cinematic: { kick: K(0), snare: K(8), hat: [], clap: [], bass: 'drone', chord: 'pad', chordIntervals: [0, 4, 7], lead: 'bell', leadBase: 66, motif: MOTIF_CORE, rev: 0.6, dly: 0.3, padAttack: 0.08, crash: [0] },

  // полка «Тренд 2026»
  bounce: { kick: K(0, 10), snare: K(4, 12), hat: K(3, 6, 11, 13, 14), clap: [], bass: 'slide', chord: 'none', chordIntervals: [], lead: 'square', leadBase: 66, hook: 'sixseven', motif: [5, 6, 5, 6, 4, 5, 6, 4], swing: 0.08, sidechain: 0.35, rev: 0.14, dly: 0.16, crash: [0, 4], fill: true },
  duck: { kick: K(0, 4, 8, 12), snare: [], hat: EIGHTH_HAT, clap: K(4, 12), openHat: K(14), bass: 'offbeat', chord: 'stab', chordIntervals: [0, 4, 7], lead: 'epiano', leadBase: 66, hook: 'wave', motif: [0, 0, 2, 2, 4, 4, 2, 0], swing: 0.18, sidechain: 0.45, rev: 0.2, dly: 0.12, crash: [0], fill: true },
  kpop: { kick: K(0, 4, 8, 12), snare: [], hat: EIGHTH_HAT, clap: K(4, 12), bass: 'eighth', chord: 'pad', chordIntervals: [0, 4, 7, 11], lead: 'supersaw', leadBase: 66, build: true, padAttack: 0.06, motif: [0, 2, 4, 7, 4, 2, 0, 4], sidechain: 0.4, rev: 0.34, dly: 0.22, crash: [0, 2, 4, 6], fill: true, riser: true },
  phonk: { kick: K(0, 6, 10), snare: K(4, 12), hat: K(0, 2, 3, 5, 6, 8, 10, 11, 13), clap: [], bass: 'slide', chord: 'none', chordIntervals: [], lead: 'cowbell', leadBase: 78, motif: [0, 3, 0, 5, 3, 0, 7, 5], swing: 0.16, sidechain: 0.5, rev: 0.12, dly: 0.1, crash: [0, 4], fill: true },
  punk: { kick: K(0, 6, 8, 14), snare: K(4, 12), hat: EIGHTH_HAT, clap: [], openHat: K(14), bass: 'eighth', chord: 'power', chordIntervals: [0, 7], lead: 'supersaw', leadBase: 66, motif: [0, 0, 3, 0, 5, 3, 0, 2], cutoff: 3200, rev: 0.1, dly: 0.12, crash: [0, 4], fill: true },
  ethno: { kick: K(0, 8, 11), snare: K(4, 12), hat: K(2, 5, 7, 10, 13), clap: [], bass: 'drone', chord: 'none', chordIntervals: [], lead: 'pluck', leadBase: 66, grace: true, motif: [0, 1, 2, 4, 2, 1, 4, 2], cutoff: 3600, rev: 0.4, dly: 0.26, fill: true },
};

const FALLBACK_GROOVE = GROOVES.pop;

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
  if (spec.lead === 'epiano') fmVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain, ratio: 2, index: freq * 1.1, cutoff });
  else if (spec.lead === 'bell') fmVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain: gain * 0.8, ratio: 3.5, index: freq * 2.2, cutoff });
  else if (spec.lead === 'pluck') stackVoice(ctx, { ...send, at: o.at, freq, dur: o.dur, gain, voices: 2, detune: 6, cutoff: Math.min(5200, cutoff), cutoffEnd: 500, attack: 0.003 });
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
  const root = ROOTS[bar % ROOTS.length];
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
    spec.chordIntervals.forEach((interval, i) => {
      const midi = root + 12 + interval + (i % 2 === 1 ? 12 : 0);
      stackVoice(ctx, {
        at: t, freq: hz(midi), dur: beatSeconds * 3.6, gain: 0.016 * hum.gv,
        voices: 2, detune: 7, attack: spec.padAttack ?? 0.02, cutoff: Math.min(2400, state.cutoff || 2400),
        sustain: 0.85, bus: 'chord', pan: i % 2 === 0 ? -0.4 : 0.4, rev: (spec.rev ?? 0.25) * 0.8,
      });
    });
  }
  if (spec.chord === 'stab' && (s16 === 2 || s16 === 10)) {
    spec.chordIntervals.forEach((interval, i) =>
      fmVoice(ctx, {
        at: t, freq: hz(root + 12 + interval), dur: beatSeconds * 0.32, gain: 0.02 * hum.gv,
        ratio: 2, index: hz(root + 12 + interval) * 0.8, cutoff: Math.min(4200, state.cutoff || 4200),
        bus: 'chord', pan: i % 2 === 0 ? -0.3 : 0.3, rev: (spec.rev ?? 0.2) * 0.7,
      }),
    );
  }
  if (spec.chord === 'power' && step % 2 === 0) {
    spec.chordIntervals.forEach((interval) =>
      stackVoice(ctx, {
        at: t, freq: hz(root + interval), dur: beatSeconds * 0.4, gain: 0.028 * hum.gv,
        voices: 4, detune: 9, cutoff: Math.min(1900, state.cutoff || 1900), cutoffEnd: 700,
        bus: 'chord', pan: interval === 0 ? -0.2 : 0.2, rev: 0.08,
      }),
    );
  }

  // Бас
  if (spec.bass === 'quarter' && s16 % 4 === 0) bassVoice(ctx, { at: t, freq: hz(root), dur: beatSeconds * 0.8, gain: 0.085 * hum.gv });
  if (spec.bass === 'eighth' && s16 % 2 === 0) bassVoice(ctx, { at: t, freq: hz(root + (s16 % 4 === 2 ? 12 : 0)), dur: beatSeconds * 0.4, gain: 0.075 * hum.gv });
  if (spec.bass === 'offbeat' && s16 % 4 === 2) bassVoice(ctx, { at: t, freq: hz(root), dur: beatSeconds * 0.38, gain: 0.08 * hum.gv });
  if (spec.bass === 'drone' && s16 === 0) {
    bassVoice(ctx, { at: t, freq: hz(root), dur: beatSeconds * 3.8, gain: 0.08 * hum.gv });
    bassVoice(ctx, { at: t, freq: hz(root + 7), dur: beatSeconds * 3.8, gain: 0.045 * hum.gv });
  }
  if (spec.bass === 'slide' && (s16 === 0 || s16 === 6 || s16 === 10)) {
    bassVoice(ctx, {
      at: t, freq: hz(root - (s16 === 0 ? 5 : 0)), glideTo: hz(root),
      dur: beatSeconds * 0.66, gain: 0.1 * hum.gv, cutoff: 700,
    });
  }

  // Мелодия: свежая фраза на каждый такт, тембр из таблицы, стерео-чередование
  const phrase = (beat + bar * 3 + (track.id.length % 4)) % spec.motif.length;
  const alternates = (beat + bar) % 2 === 0;
  if (full && s16 % 4 === 0 && (alternates || spec.leadEveryBeat)) {
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
  if (spec.blip && s16 === 6 && step % 8 === 6) {
    leadVoice(ctx, spec, state, { midi: 72 + degree(track, phrase + 2), at: t, dur: beatSeconds * 0.26, gain: 0.03, pan: -panLead });
  }

  // Узнаваемая фигурка тренда — то, что ребёнок слышит как «своё»
  if (spec.hook === 'sixseven' && full && (s16 === 0 || s16 === 3)) {
    const first = s16 === 0;
    leadVoice(ctx, { ...spec, lead: 'square' }, state, { midi: spec.leadBase + degree(track, first ? 5 : 6), at: t, dur: beatSeconds * 0.42, gain: 0.04, pan: panLead });
    if (bar % 2 === 1 && s16 === 3) {
      leadVoice(ctx, { ...spec, lead: 'square' }, state, { midi: spec.leadBase + degree(track, 4), at: t + beatSeconds * 0.3, dur: beatSeconds * 0.4, gain: 0.032, pan: panLead });
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

  // Перкуссия: в уроке тише, а яркие тембры (хэт, хлопок, ковбелл, крэш) молчат
  if (spec.kick[s16]) drumHit(ctx, t, 'kick', state.drums * hum.gv, state.bright);
  if (spec.snare[s16]) drumHit(ctx, t, 'snare', state.drums * hum.gv, state.bright);
  if (state.bright) {
    if (spec.hat[s16]) drumHit(ctx, t, 'hat', state.drums, true);
    if (spec.openHat?.[s16]) drumHit(ctx, t, 'openhat', state.drums * 0.8, true);
    if (spec.clap[s16]) drumHit(ctx, t, 'clap', state.drums, true);
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
  nextStep = 0;
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
    const stepSeconds = (60 / state.bpm) / 4;
    const swing = spec.swing ?? 0;
    if (nextAt < now - 0.5) nextAt = now + 0.05; // вкладка спала: не вываливать шквал прошедших долей
    while (nextAt < now + 0.18) {
      const offset = nextStep % 2 === 1 ? stepSeconds * swing : 0;
      scheduleStep(track, spec, state, nextStep, nextAt + offset);
      nextStep = (nextStep + 1) % 128;
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
