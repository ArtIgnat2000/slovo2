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
  /** Стук по сундуку — короткий и «деревянный», как отклик на касание. */
  chestKnock: () => buzz(9),
  /** Сундук проснулся — два лёгких импульса. */
  chestWake: () => buzz([10, 28, 20]),
  correct: () => buzz([18, 40, 26]),
  wrong: () => buzz([40, 60, 40]),
  finish: () => buzz([20, 50, 20, 50, 60]),
  chestOpen: () => buzz([18, 45, 32]),
};
