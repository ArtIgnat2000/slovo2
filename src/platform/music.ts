import type { MusicTrack } from '../engine/music';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let activeId: string | null = null;
let nextStep = 0;
let nextAt = 0;
let enabled = true;

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

function note(track: MusicTrack, midi: number, at: number, duration: number, kind: 'lead' | 'bass' | 'chord') {
  const ctx = audio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const volume = kind === 'lead' ? 0.045 : kind === 'bass' ? 0.075 : 0.018;
  osc.type = kind === 'lead' ? (track.groove === 'arcade' ? 'square' : 'triangle') : kind === 'bass' ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(hz(midi), at);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(track.groove === 'lofi' ? 1500 : 5000, at);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master ?? ctx.destination);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.012);
  gain.gain.setTargetAtTime(0.0001, at + Math.max(0.03, duration * 0.55), Math.max(0.035, duration * 0.18));
  osc.start(at);
  osc.stop(at + duration + 0.12);
}

function drum(at: number, type: 'kick' | 'snare' | 'hat') {
  const ctx = audio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master ?? ctx.destination);
  if (type === 'kick') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, at);
    osc.frequency.exponentialRampToValueAtTime(48, at + 0.12);
    gain.gain.setValueAtTime(0.11, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.start(at);
    osc.stop(at + 0.17);
  } else {
    // Noise-free, very soft percussion is kinder to young ears and works offline.
    osc.type = type === 'hat' ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(type === 'hat' ? 7600 : 185, at);
    gain.gain.setValueAtTime(type === 'hat' ? 0.008 : 0.018, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (type === 'hat' ? 0.025 : 0.09));
    osc.start(at);
    osc.stop(at + (type === 'hat' ? 0.03 : 0.1));
  }
}

function scheduleStep(track: MusicTrack, step: number, at: number) {
  const beat = Math.floor(step / 4);
  const eighth = step % 2 === 0;
  const bar = Math.floor(beat / 4);
  const root = [48, 53, 55, 50][bar % 4];
  const beatSeconds = 60 / track.bpm;

  if (step % 16 === 0) {
    // Soft three-note chord; no recorded samples or external assets.
    [0, 4, 7].forEach((interval) => note(track, root + 12 + interval, at, beatSeconds * 3.5, 'chord'));
  }
  if (step % 4 === 0) note(track, root, at, beatSeconds * 0.82, 'bass');

  // A small original melody from a pentatonic scale, with a fresh phrase each bar.
  const motif = [0, 2, 4, 3, 1, 4, 2, 0];
  const phrase = (beat + bar * 3 + (track.id.length % 4)) % motif.length;
  if (step % 4 === 0 && ((beat + bar) % 2 === 0 || track.groove === 'arcade')) {
    const octave = track.groove === 'lofi' ? 5 : 6;
    note(track, 60 + octave + track.scale[motif[phrase] % track.scale.length], at, beatSeconds * 0.72, 'lead');
  }
  if (track.groove === 'arcade' && step % 8 === 6) {
    note(track, 72 + track.scale[(phrase + 2) % track.scale.length], at, beatSeconds * 0.28, 'lead');
  }

  if (step % 4 === 0) {
    const kickOn = beat % 4 === 0 || (track.groove === 'dance' && beat % 4 === 2) || (track.groove === 'tropical' && beat % 4 === 3);
    if (kickOn) drum(at, 'kick');
    if ((beat % 4 === 2 || (track.groove === 'pop' && beat % 4 === 3)) && track.groove !== 'lofi') drum(at, 'snare');
  }
  if (eighth && (track.groove === 'dance' || track.groove === 'pop' || track.groove === 'arcade')) drum(at, 'hat');
}

/** Запускает бесконечный оригинальный 4-тактовый луп после пользовательского нажатия. */
export function playMusic(track: MusicTrack | null) {
  if (!track || !enabled) {
    stop();
    return;
  }
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
  timer = setInterval(() => {
    if (!context || activeId !== track.id) return;
    const now = context.currentTime;
    const stepSeconds = (60 / track.bpm) / 4;
    while (nextAt < now + 0.18) {
      scheduleStep(track, nextStep, nextAt);
      nextStep = (nextStep + 1) % 64;
      nextAt += stepSeconds;
    }
  }, 45);
}
