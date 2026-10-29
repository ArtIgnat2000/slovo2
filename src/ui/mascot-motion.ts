/**
 * «Живой» взгляд БУКа (0.85.0): чистая математика без DOM — чтобы поведение
 * проверялось в тестах отдельно от React, а в компоненте оставалась только
 * запись transform.
 *
 * Две величины: сдвиг зрачков внутри больших глаз и лёгкий наклон всей головы
 * в сторону пальца. Обе ограничены малым диапазоном — сова «оживает», но не
 * выворачивает глаза и не качается сильнее, чем позволяют правила продукта
 * (без резких движений, статика при prefers-reduced-motion).
 */

/** Сколько user-единиц SVG зрачок уходит от центра глаза в самой дальней точке. */
export const PUPIL_MAX_X = 2.6;
export const PUPIL_MAX_Y = 2.0;
/** Наклон всей SVG-картинки в градусах: ±3.5° — заметно, но не морская качка. */
export const LEAN_MAX = 3.5;
/** На каком расстоянии от центра совы палец считается «уже за кадром» (px). */
export const GAZE_REACH = 170;

export interface Gaze {
  /** Сдвиг группы зрачков, px (в user-единицах viewBox). */
  dx: number;
  dy: number;
  /** Наклон картинки, градусы: > 0 — вправо. */
  lean: number;
}

/**
 * Куда смотреть: `px/py` — указатель, `cx/cy` — центр совы.
 * Направление нормализуется, ослабление линейное: до GAZE_REACH взгляд
 * догоняет палец на полную амплитуду, дальше плавно замирает.
 */
export function gazeToward(px: number, py: number, cx: number, cy: number): Gaze {
  const vx = px - cx;
  const vy = py - cy;
  const len = Math.hypot(vx, vy);
  if (len < 1) return { dx: 0, dy: 0, lean: 0 };
  const k = Math.min(1, len / GAZE_REACH);
  const nx = (vx / len) * k;
  const ny = (vy / len) * k;
  const dx = nx * PUPIL_MAX_X;
  const dy = ny * PUPIL_MAX_Y;
  // Наклон повторяет горизонтальный взгляд: глаза и голова двигаются согласно.
  return { dx, dy, lean: (dx / PUPIL_MAX_X) * LEAN_MAX };
}
