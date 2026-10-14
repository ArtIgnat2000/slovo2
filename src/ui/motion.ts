/**
 * Мелкие помощники движения, общие для сцены сундука и карточки заданий.
 *
 * Смысл вынести их сюда: отклик на тап по сундуку нужен в двух местах (карточка
 * на главной и сцена открытия), а правило одно — уважать системную настройку
 * «меньше движения» и не перемонтировать разметку ради анимации.
 */

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface NudgeOptions {
  /** Размах дрожи в пикселях; больше тапов — заметнее отклик */
  amplitude?: number;
  durationMs?: number;
  /** Пробуждение: чуть крупнее и с лёгким увеличением */
  awake?: boolean;
}

/**
 * Короткая дрожь элемента. Гоняем через Web Animations API, а не сменой класса:
 * разметка не перемонтируется (иначе терялся бы фокус, а картинка сундука
 * мигала бы). Там, где `animate` нет (старые движки, jsdom), просто ничего не
 * делаем — звук, вибрация и счётчик тапов остаются.
 */
export function nudge(el: Element | null, options: NudgeOptions = {}): void {
  const { amplitude = 4, durationMs = 280, awake = false } = options;
  if (!el || prefersReducedMotion()) return;
  const animate = (el as Element & { animate?: Element['animate'] }).animate;
  if (typeof animate !== 'function') return;
  const amp = Math.max(2, amplitude);
  const scale = awake ? 1.04 : 1.01;
  el.animate(
    [
      { transform: 'translateX(0) rotate(0deg) scale(1)' },
      { transform: `translateX(${-amp}px) rotate(${-amp / 8}deg) scale(${scale})` },
      { transform: `translateX(${amp}px) rotate(${amp / 8}deg) scale(${scale})` },
      { transform: 'translateX(0) rotate(0deg) scale(1)' },
    ],
    { duration: awake ? Math.max(durationMs, 420) : durationMs, easing: 'ease-out' },
  );
}
