import { playbackFor, type MusicContext, type MusicTrack } from '../engine/music';

/**
 * Синтезатор фоновой музыки. Всё звучит из осцилляторов: ноль аудиофайлов,
 * ноль чужих песен, работает офлайн (правило каталога — engine/music.ts).
 *
 * Два решения 0.13.0:
 *  • аранжировка описана ТАБЛИЦЕЙ грувов, а не if-ветками по названию: новый
 *    жанр добавляется одной строкой данных, а не правкой четырёх мест;
 *  • у трека есть контекст — «урок» и «награда» (engine/music.ts:playbackFor).
 *    В уроке музыка становится медленнее и тише, яркие тембры замолкают:
 *    быстрый бит не должен соревноваться с подбором буквы. На награде трек
 *    звучит целиком — там ребёнок и получает свой трендовый звук.
 */

let context: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let activeId: string | null = null;
let nextStep = 0;
let nextAt = 0;
let enabled = true;
let scene: MusicContext = 'reward';

/** Меняет контекст звучания на лету: луп не перезапускается, правила подхватываются со следующего шага. */
export function setMusicContext(next: MusicContext) {
  scene = next;
}

export function getMusicContext(): MusicContext {
  return scene;
}

function audio(): AudioContext | null {
  try {
    if (!context) {
      context = new (window.AudioContext || (window as any).webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0.62;
      master.connect(context.destination);
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
  if (context && master) {
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0.0001, now, 0.035);
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

// ── Тембры ──────────────────────────────────────────────────────────────────

type LeadTimbre = 'triangle' | 'square' | 'saw' | 'cowbell';

interface VoiceOptions {
  midi: number;
  at: number;
  dur: number;
  kind: 'lead' | 'bass' | 'chord';
  timbre?: LeadTimbre;
  gain?: number;
  cutoff?: number;
  /** Медленная атака: гимн-пэд не должен «щёлкать». */
  attack?: number;
  /** Держать ноту дольше (пэд, дрон). */
  sustain?: number;
  /** Второй осциллятор с расстройкой — плотность без новых тембров. */
  doubled?: boolean;
  /** Съезд вниз/вверх к другой ноте: скользящий бас баунса и фонка. */
  glideTo?: number;
}

const BASE_VOLUME = { lead: 0.045, bass: 0.075, chord: 0.018 } as const;

function timbreOf(o: VoiceOptions): OscillatorType {
  if (o.timbre === 'saw') return 'sawtooth';
  if (o.timbre === 'square' || o.timbre === 'cowbell') return 'square';
  if (o.kind === 'chord') return 'sine';
  if (o.kind === 'bass') return 'triangle';
  return 'triangle';
}

function voice(spec: GrooveSpec, state: ReturnType<typeof playbackFor>, o: VoiceOptions) {
  const ctx = audio();
  if (!ctx) return;
  const leadGain = BASE_VOLUME[o.kind] * (o.gain ?? 1) * (o.kind === 'lead' ? state.lead : 1);
  const cutoff = Math.min(o.cutoff ?? spec.cutoff ?? 5000, state.cutoff || Infinity);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = timbreOf(o);
  osc.frequency.setValueAtTime(hz(o.midi), o.at);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(hz(o.glideTo), o.at + Math.max(0.08, o.dur * 0.45));
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, o.at);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master ?? ctx.destination);
  const attack = o.attack ?? 0.012;
  gain.gain.setValueAtTime(0.0001, o.at);
  gain.gain.linearRampToValueAtTime(Math.max(0.0002, leadGain), o.at + attack);
  gain.gain.setTargetAtTime(0.0001, o.at + Math.max(0.03, o.dur * (o.sustain ?? 0.55)), Math.max(0.035, o.dur * 0.18));
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.12);
  if (o.doubled) {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = osc.type;
    osc2.detune.value = 9;
    osc2.frequency.setValueAtTime(hz(o.midi), o.at);
    osc2.connect(gain2);
    gain2.connect(master ?? ctx.destination);
    gain2.gain.setValueAtTime(0.0001, o.at);
    gain2.gain.linearRampToValueAtTime(Math.max(0.0002, leadGain * 0.55), o.at + attack + 0.004);
    gain2.gain.setTargetAtTime(0.0001, o.at + Math.max(0.03, o.dur * (o.sustain ?? 0.55)), Math.max(0.04, o.dur * 0.2));
    osc2.start(o.at);
    osc2.stop(o.at + o.dur + 0.12);
  }
}

type DrumHit = 'kick' | 'snare' | 'hat' | 'clap' | 'cowbell';

function drum(at: number, type: DrumHit, level = 1) {
  const ctx = audio();
  if (!ctx) return;
  const out = master ?? ctx.destination;
  // Всё планируется по аудио-часам: планировщик смотрит на 180 мс вперёд,
  // поэтому setTimeout сдвинул бы хлопок мимо доли.
  const burst = (t: number, freq: number, vol: number, dur: number, kind: OscillatorType, sweepTo?: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + dur * 0.75);
    gain.gain.setValueAtTime(Math.max(0.0002, vol * level), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  // Noise-free, very soft percussion is kinder to young ears and works offline.
  if (type === 'kick') burst(at, 115, 0.11, 0.16, 'sine', 48);
  else if (type === 'snare') {
    burst(at, 185, 0.018, 0.09, 'triangle');
    burst(at, 1400, 0.008, 0.05, 'square');
  } else if (type === 'hat') burst(at, 7600, 0.008, 0.025, 'square');
  else if (type === 'clap') [0, 1, 2].forEach((i) => burst(at + i * 0.012, 2100 + i * 320, 0.012, 0.045, 'square'));
  else if (type === 'cowbell') {
    burst(at, 540, 0.016, 0.14, 'square');
    burst(at, 800, 0.011, 0.12, 'square');
  }
}

// ── Таблица грувов ──────────────────────────────────────────────────────────
//
// Шаги — 16-е доли, 16 шагов = такт, луп = 4 такта (64 шага). Паттерны заданы
// числами 0/1; бас и аккорд — именем рисунка; мелодия — набором ступеней `scale`
// трека, поэтому один и тот же грув звучит по-разному у разных треков.

interface GrooveSpec {
  kick: number[];
  snare: number[];
  hat: number[];
  clap: number[];
  bass: 'quarter' | 'eighth' | 'offbeat' | 'drone' | 'slide';
  chord: 'pad' | 'stab' | 'power' | 'none';
  chordIntervals: number[];
  leadTimbre: LeadTimbre;
  /** Базовая MIDI-нота мелодии: 66 — как в базовом каталоге, 65 — лоу-фай, 78 — ковбелл. */
  leadBase: number;
  /** Мелодия на каждой доле (аркада) вместо чередования. */
  leadEveryBeat?: boolean;
  /** Короткий «блип» на слабой восьмой — аркадная примета. */
  blip?: boolean;
  /** Узнаваемая фигурка тренда: две ноты «6-7» или «волна» утят. */
  hook?: 'sixseven' | 'wave';
  /** Форшлаг перед нотой — фольклорная интонация. */
  grace?: boolean;
  /** Первые два такта — только пэд и хлопки, дальше вступает всё (гимн). */
  build?: boolean;
  motif: number[];
  cutoff?: number;
  swing?: number;
  /** Медленная атака пэда. */
  padAttack?: number;
}

const K = (...steps: number[]) => Array.from({ length: 16 }, (_, i) => (steps.includes(i) ? 1 : 0));
const EIGHTH_HAT = K(0, 2, 4, 6, 8, 10, 12, 14);
const MOTIF_CORE = [0, 2, 4, 3, 1, 4, 2, 0];

const GROOVES: Record<string, GrooveSpec> = {
  // базовый каталог 0.12.3 — звучание сохранено один в один
  pop: { kick: K(0), snare: K(8, 12), hat: EIGHTH_HAT, clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], leadTimbre: 'triangle', leadBase: 66, motif: MOTIF_CORE },
  lofi: { kick: K(0), snare: [], hat: [], clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], leadTimbre: 'triangle', leadBase: 65, motif: MOTIF_CORE, cutoff: 1500 },
  arcade: { kick: K(0), snare: K(8), hat: EIGHTH_HAT, clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], leadTimbre: 'square', leadBase: 66, leadEveryBeat: true, blip: true, motif: MOTIF_CORE },
  dance: { kick: K(0, 8), snare: K(8), hat: EIGHTH_HAT, clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], leadTimbre: 'triangle', leadBase: 66, motif: MOTIF_CORE },
  tropical: { kick: K(0, 12), snare: K(8), hat: [], clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], leadTimbre: 'triangle', leadBase: 66, motif: MOTIF_CORE },
  cinematic: { kick: K(0), snare: K(8), hat: [], clap: [], bass: 'quarter', chord: 'pad', chordIntervals: [0, 4, 7], leadTimbre: 'triangle', leadBase: 66, motif: MOTIF_CORE },

  // полка «Тренд 2026»
  // Мем-баунс: скользящий бас, синкопированный хэт и крюк «6-7» (6-я → 7-я ступень).
  bounce: { kick: K(0, 10), snare: K(4, 12), hat: K(3, 6, 11, 13, 14), clap: [], bass: 'slide', chord: 'none', chordIntervals: [], leadTimbre: 'square', leadBase: 66, hook: 'sixseven', motif: [5, 6, 5, 6, 4, 5, 6, 4], swing: 0.08 },
  // Танец утят: ровная бочка, хлопок на 2 и 4, «волна» из двух нот и свинг.
  duck: { kick: K(0, 4, 8, 12), snare: [], hat: EIGHTH_HAT, clap: K(4, 12), bass: 'offbeat', chord: 'stab', chordIntervals: [0, 4, 7], leadTimbre: 'triangle', leadBase: 66, hook: 'wave', motif: [0, 0, 2, 2, 4, 4, 2, 0], swing: 0.18 },
  // K-pop гимн: два такта билда, потом полный грув; пэд с большой терцией и лидийской краской.
  kpop: { kick: K(0, 4, 8, 12), snare: [], hat: EIGHTH_HAT, clap: K(4, 12), bass: 'eighth', chord: 'pad', chordIntervals: [0, 4, 7, 11], leadTimbre: 'triangle', leadBase: 66, build: true, padAttack: 0.06, motif: [0, 2, 4, 7, 4, 2, 0, 4] },
  // Школьный фонк: ковбелл вместо мелодии, скользящий бас, плотный хэт.
  phonk: { kick: K(0, 6, 10), snare: K(4, 12), hat: K(0, 2, 3, 5, 6, 8, 10, 11, 13), clap: [], bass: 'slide', chord: 'none', chordIntervals: [], leadTimbre: 'cowbell', leadBase: 78, motif: [0, 3, 0, 5, 3, 0, 7, 5], swing: 0.16 },
  // Сказочный панк: квинтовые аккорды восьмыми, быстро и минорно.
  punk: { kick: K(0, 6, 8, 14), snare: K(4, 12), hat: EIGHTH_HAT, clap: [], bass: 'eighth', chord: 'power', chordIntervals: [0, 7], leadTimbre: 'saw', leadBase: 66, motif: [0, 0, 3, 0, 5, 3, 0, 2], cutoff: 3200 },
  // Этно-электроника: дрон с квинтой, форшлаги и народный лад поверх танцевального бита.
  ethno: { kick: K(0, 8, 11), snare: K(4, 12), hat: K(2, 5, 7, 10, 13), clap: [], bass: 'drone', chord: 'none', chordIntervals: [], leadTimbre: 'triangle', leadBase: 66, grace: true, motif: [0, 1, 2, 4, 2, 1, 4, 2], cutoff: 3600 },
};

const FALLBACK_GROOVE = GROOVES.pop;

/** Какие грувы умеет синтезатор: проверка каталога сверяет с ним каждый трек. */
export const GROOVE_IDS: readonly string[] = Object.keys(GROOVES);

function specOf(track: MusicTrack): GrooveSpec {
  return GROOVES[track.groove] ?? FALLBACK_GROOVE;
}

/** Ступень лада трека: индекс заворачивается, поэтому мотив не может «выпасть» из тональности. */
function degree(track: MusicTrack, index: number) {
  const scale = track.scale;
  return scale[((index % scale.length) + scale.length) % scale.length];
}

function scheduleStep(track: MusicTrack, spec: GrooveSpec, state: ReturnType<typeof playbackFor>, step: number, at: number) {
  const beat = Math.floor(step / 4);
  const s16 = step % 16;
  const bar = Math.floor(beat / 4);
  const root = [48, 53, 55, 50][bar % 4];
  const beatSeconds = 60 / state.bpm;
  const full = bar >= 2 || !spec.build;

  // Soft three-note chord; no recorded samples or external assets.
  if (spec.chord === 'pad' && step % 16 === 0) {
    spec.chordIntervals.forEach((interval) =>
      voice(spec, state, { midi: root + 12 + interval, at, dur: beatSeconds * 3.5, kind: 'chord', attack: spec.padAttack, sustain: spec.padAttack ? 0.85 : undefined }),
    );
  }
  if (spec.chord === 'stab' && (s16 === 2 || s16 === 10)) {
    spec.chordIntervals.forEach((interval) => voice(spec, state, { midi: root + 12 + interval, at, dur: beatSeconds * 0.35, kind: 'chord' }));
  }
  if (spec.chord === 'power' && step % 2 === 0) {
    spec.chordIntervals.forEach((interval) =>
      voice(spec, state, { midi: root + interval, at, dur: beatSeconds * 0.42, kind: 'chord', timbre: 'saw', gain: 1.4, cutoff: 1800, doubled: true }),
    );
  }

  // Бас
  if (spec.bass === 'quarter' && s16 % 4 === 0) voice(spec, state, { midi: root, at, dur: beatSeconds * 0.82, kind: 'bass' });
  if (spec.bass === 'eighth' && s16 % 2 === 0) voice(spec, state, { midi: root + (s16 % 4 === 2 ? 12 : 0), at, dur: beatSeconds * 0.42, kind: 'bass' });
  if (spec.bass === 'offbeat' && s16 % 4 === 2) voice(spec, state, { midi: root, at, dur: beatSeconds * 0.4, kind: 'bass' });
  if (spec.bass === 'drone' && step % 16 === 0) {
    voice(spec, state, { midi: root, at, dur: beatSeconds * 3.8, kind: 'bass', sustain: 0.85 });
    voice(spec, state, { midi: root + 7, at, dur: beatSeconds * 3.8, kind: 'bass', gain: 0.6, sustain: 0.85 });
  }
  if (spec.bass === 'slide' && (s16 === 0 || s16 === 6 || s16 === 10)) {
    voice(spec, state, {
      midi: root - (s16 === 0 ? 5 : 0),
      glideTo: root,
      at,
      dur: beatSeconds * 0.7,
      kind: 'bass',
      gain: 1.15,
      cutoff: 700,
      sustain: 0.5,
    });
  }

  // A small original melody from the track's scale, with a fresh phrase each bar.
  const phrase = (beat + bar * 3 + (track.id.length % 4)) % spec.motif.length;
  const alternates = (beat + bar) % 2 === 0;
  if (full && step % 4 === 0 && (alternates || spec.leadEveryBeat)) {
    const midi = spec.leadBase + degree(track, spec.motif[phrase]);
    if (spec.grace) {
      voice(spec, state, { midi: midi + 1, at, dur: beatSeconds * 0.09, kind: 'lead', timbre: spec.leadTimbre, gain: 0.6 });
      voice(spec, state, { midi, at: at + beatSeconds * 0.1, dur: beatSeconds * 0.72, kind: 'lead', timbre: spec.leadTimbre });
    } else if (spec.leadTimbre === 'cowbell') {
      if (state.bright) drum(at, 'cowbell', 0.9);
      voice(spec, state, { midi: midi - 12, at, dur: beatSeconds * 0.4, kind: 'lead', timbre: 'square', gain: 0.4, cutoff: 2600 });
    } else {
      voice(spec, state, { midi, at, dur: beatSeconds * 0.72, kind: 'lead', timbre: spec.leadTimbre, doubled: spec.leadTimbre === 'saw' });
    }
  }
  if (spec.blip && step % 8 === 6) {
    voice(spec, state, { midi: 72 + degree(track, phrase + 2), at, dur: beatSeconds * 0.28, kind: 'lead', timbre: spec.leadTimbre });
  }

  // Узнаваемая фигурка тренда — то, что ребёнок слышит как «своё»
  if (spec.hook === 'sixseven' && full && (s16 === 0 || s16 === 3)) {
    const first = s16 === 0;
    voice(spec, state, { midi: spec.leadBase + degree(track, first ? 5 : 6), at, dur: beatSeconds * 0.42, kind: 'lead', timbre: 'square', gain: 0.9 });
    if (bar % 2 === 1 && s16 === 3) {
      voice(spec, state, { midi: spec.leadBase + degree(track, 4), at: at + beatSeconds * 0.3, dur: beatSeconds * 0.4, kind: 'lead', timbre: 'square', gain: 0.7 });
    }
  }
  if (spec.hook === 'wave' && full && (s16 === 4 || s16 === 12)) {
    [0, 2].forEach((offset) =>
      voice(spec, state, {
        midi: spec.leadBase + degree(track, spec.motif[(phrase + offset) % spec.motif.length]),
        at: at + offset * beatSeconds * 0.22,
        dur: beatSeconds * 0.2,
        kind: 'lead',
        timbre: 'triangle',
        gain: 0.8,
      }),
    );
  }

  // Перкуссия: в уроке тише, а яркие тембры (хэт, хлопок, ковбелл) молчат
  if (spec.kick[s16]) drum(at, 'kick', state.drums);
  if (spec.snare[s16]) drum(at, 'snare', state.drums);
  if (state.bright) {
    if (spec.hat[s16]) drum(at, 'hat', state.drums);
    if (spec.clap[s16]) drum(at, 'clap', state.drums);
  }
}

/** Запускает бесконечный оригинальный 4-тактовый луп после пользовательского нажатия. */
export function playMusic(track: MusicTrack | null, sceneName: MusicContext = scene) {
  if (!track || !enabled) {
    stop();
    return;
  }
  scene = sceneName;
  if (activeId === track.id && timer) return;
  stop();
  const ctx = audio();
  if (!ctx) return;
  if (master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.62, ctx.currentTime);
  }
  activeId = track.id;
  nextAt = ctx.currentTime + 0.08;
  nextStep = 0;
  const spec = specOf(track);
  timer = setInterval(() => {
    if (!context || activeId !== track.id) return;
    const now = context.currentTime;
    // Контекст читаем на каждом тике: переключение «урок ↔ награда» происходит
    // без перезапуска лупа и без щелчка.
    const state = playbackFor(track, scene);
    const stepSeconds = (60 / state.bpm) / 4;
    const swing = spec.swing ?? 0;
    while (nextAt < now + 0.18) {
      const offset = nextStep % 2 === 1 ? stepSeconds * swing : 0;
      scheduleStep(track, spec, state, nextStep, nextAt + offset);
      nextStep = (nextStep + 1) % 64;
      nextAt += stepSeconds;
    }
  }, 45);
}
