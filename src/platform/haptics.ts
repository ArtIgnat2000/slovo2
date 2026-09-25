let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

function buzz(pattern: number | number[]) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* вибрация есть не везде — это нормально */
  }
}

export const haptic = {
  tap: () => buzz(12),
  correct: () => buzz([18, 40, 26]),
  wrong: () => buzz([40, 60, 40]),
  finish: () => buzz([20, 50, 20, 50, 60]),
};
