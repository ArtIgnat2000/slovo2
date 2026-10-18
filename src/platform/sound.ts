/** Звук синтезируется на месте: ноль веса, мгновенный отклик, работает офлайн. */

import { cueOf, DEFAULT_SOUND_PACK, type SoundCue, type SoundNote } from '../engine/sounds';

let ctx: AudioContext | null = null;
let enabled = true;
/** Набор мелодий для правильного ответа и ошибки (магазин → «Звуки»). */
let pack: string = DEFAULT_SOUND_PACK;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/** Выбрать набор «Звуков»: профиль ребёнка → App.tsx; незнакомый id — классика. */
export function setSoundPack(id: string | null | undefined) {
  pack = id || DEFAULT_SOUND_PACK;
}

export function getSoundPack(): string {
  return pack;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, vol = 0.16, type: OscillatorType = 'sine', glideTo?: number) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain);
  gain.connect(a.destination);
  osc.type = type;
  const t0 = a.currentTime + at;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** Мягкий стеклянный тембр: основной тон и тихие гармоники с разным затуханием. */
function chime(freq: number, at: number, dur: number, vol = 0.055) {
  const a = ac();
  if (!a) return;
  const partials = [
    [1, 1, 1],
    [2, 0.2, 0.62],
    [2.76, 0.075, 0.38],
  ] as const;
  const t0 = a.currentTime + at;

  for (const [ratio, level, decay] of partials) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    const end = t0 + dur * decay;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * ratio, t0);
    osc.connect(gain);
    gain.connect(a.destination);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol * level, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(t0);
    osc.stop(end + 0.025);
  }
}

/** Сыграть мелодию из нот (engine/sounds.ts). */
function playNotes(notes: SoundNote[]) {
  for (const note of notes) {
    if (note.wave === 'chime') chime(note.freq, note.at, note.dur, note.vol);
    else tone(note.freq, note.at, note.dur, note.vol, note.wave, note.glideTo);
  }
}

/**
 * Примерка набора в магазине: играет мелодию выбранного, а не текущего набора.
 * Уважает выключатель «Звук» у родителя — возвращает false, если звук выключен.
 */
export function previewSoundCue(packId: string, cue: SoundCue): boolean {
  if (!enabled) return false;
  playNotes(cueOf(packId, cue));
  return true;
}

export const sfx = {
  tap: () => tone(660, 0, 0.06, 0.08, 'triangle'),
  /** Отклик БУКа на поглаживание: две короткие «птичьи» ноты вверх. */
  chirp: () => {
    tone(880, 0, 0.09, 0.09, 'triangle');
    tone(1318.5, 0.07, 0.13, 0.07, 'triangle');
  },
  /** Правильный ответ — мелодия выбранного набора «Звуков». */
  correct: () => playNotes(cueOf(pack, 'correct')),
  /** Ошибка — мягкая мелодия выбранного набора: «попробуй иначе», не наказание. */
  wrong: () => playNotes(cueOf(pack, 'wrong')),
  hint: () => tone(880, 0, 0.12, 0.1, 'triangle'),
  /**
   * Стук по сундуку: глухой деревянный отклик на тап («Разбуди сундук»).
   * Два низких тона без «звона» — это касание, а не награда.
   */
  chestKnock: () => {
    tone(196, 0, 0.09, 0.075, 'triangle');
    tone(147, 0.012, 0.13, 0.05, 'sine');
  },
  /** Сундук проснулся: короткая искристая гамма вверх, тише фанфар открытия. */
  chestWake: () => [392, 587.33, 783.99, 1046.5].forEach((f, i) => chime(f, i * 0.055, 0.42, 0.042)),
  streak: () => [523.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.06, 0.24, 0.13)),
  finish: (stars: number) => {
    if (stars >= 3) [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.15));
    else if (stars > 0) [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.4, 0.13));
    else tone(300, 0, 0.35, 0.1, 'sawtooth');
  },
  /** Оригинальный короткий фанфарный мотив: локальный, однократный, без фонового лупа. */
  chestOpen: () => {
    // Тёплая основа и четыре «искры» в соль-мажорном арпеджио.
    tone(196, 0, 0.9, 0.025, 'sine');
    tone(293.66, 0.3, 0.82, 0.018, 'sine');
    chime(392, 0, 0.48, 0.052);       // G4
    chime(493.88, 0.18, 0.48, 0.048); // B4
    chime(587.33, 0.38, 0.54, 0.052); // D5
    chime(783.99, 0.62, 0.72, 0.056); // G5

    // Мягкая мажорная «точка» и две верхние искры на момент появления награды.
    tone(196, 0.86, 0.9, 0.018, 'sine');
    tone(246.94, 0.86, 0.78, 0.014, 'sine');
    tone(293.66, 0.86, 0.78, 0.016, 'sine');
    tone(392, 0.86, 0.78, 0.016, 'sine');
    chime(1174.66, 1.02, 0.82, 0.031); // D6
    chime(1567.98, 1.28, 0.62, 0.023); // G6
  },
  reward: () => [659.25, 987.77, 1318.5].forEach((f, i) => tone(f, i * 0.1, 0.5, 0.13)),
};
