/** Звук синтезируется на месте: ноль веса, мгновенный отклик, работает офлайн. */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
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

function tone(freq: number, at: number, dur: number, vol = 0.16, type: OscillatorType = 'sine') {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain);
  gain.connect(a.destination);
  osc.type = type;
  const t0 = a.currentTime + at;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export const sfx = {
  tap: () => tone(660, 0, 0.06, 0.08, 'triangle'),
  correct: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.07, 0.28, 0.15));
    tone(1046.5, 0.28, 0.4, 0.07, 'triangle');
  },
  wrong: () => {
    tone(330, 0, 0.2, 0.13, 'sawtooth');
    tone(262, 0.14, 0.3, 0.1, 'sawtooth');
  },
  hint: () => tone(880, 0, 0.12, 0.1, 'triangle'),
  streak: () => [523.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.06, 0.24, 0.13)),
  finish: (stars: number) => {
    if (stars >= 3) [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.15));
    else if (stars > 0) [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.4, 0.13));
    else tone(300, 0, 0.35, 0.1, 'sawtooth');
  },
  reward: () => [659.25, 987.77, 1318.5].forEach((f, i) => tone(f, i * 0.1, 0.5, 0.13)),
};
