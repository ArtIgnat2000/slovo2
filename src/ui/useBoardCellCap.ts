/**
 * Потолок клетки игрового поля по месту на экране.
 *
 * Замечание владельца (2026-11-12, iPad): «на планшете кроссворд и филворд
 * не помещаются по вертикали» — список вопросов уезжал под нижнее меню.
 * На планшете игра встала в две колонки (решётка и вопросы рядом), и на
 * обычном iPad этого хватает. Но на низком или альбомном экране поле всё
 * равно может оказаться выше окна — поэтому клетка не должна быть крупнее,
 * чем позволяет свободная высота.
 *
 * Считаем от реального места: сколько остаётся под карточку игры (окно
 * минус то, что над сценой, минус нижнее меню), минус строка состояния,
 * поля карточки и то, что стоит под полем (пул букв).
 *
 * На телефоне потолок не нужен: там сцену прокручивают, и клетку держит CSS
 * (42 px, на узком экране — 38 px). Потолок применяется только в широкой
 * раскладке — см. `@media (min-width: 760px)` в `styles/app.css`.
 */
import { useEffect, useState, type RefObject } from 'react';

/** Меньше этой клетки палец ребёнка уже не попадёт — ниже не сжимаем. */
const MIN_CELL = 32;

/** Строка состояния над полем («Собрано: …» + «Новая сетка»). */
const FOOT_H = 40;

/** Поля карточки игры (верх + низ). */
const CARD_PAD = 28;

/** Зазоры карточки и её тела. */
const GAPS = 24;

/** Запас под нижнее меню: его высота + поле экрана под ним. */
const MENU_GAP = 18;

export interface BoardCellCapOptions {
  /** Сколько строк у поля. */
  rows: number;
  /** Зазор между клетками (совпадает с .cw-grid / .ws-grid). */
  gap?: number;
  /** Карточка игры: по ней находим сцену `.games-stage`. */
  cardRef: RefObject<HTMLElement | null>;
  /** Что стоит под полем (пул букв): его высота тоже занимает место. */
  belowRef?: RefObject<HTMLElement | null>;
}

/**
 * @returns потолок клетки в px или null, если место измерить не удалось
 *          (тогда CSS берёт свой потолок — 48 px на планшете).
 */
export function useBoardCellCap({
  rows,
  gap = 3,
  cardRef,
  belowRef,
}: BoardCellCapOptions): number | null {
  const [cap, setCap] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const card = cardRef.current;
      if (!card || !rows) {
        setCap(null);
        return;
      }
      const stage = card.closest('.games-stage') as HTMLElement | null;
      if (!stage) {
        setCap(null);
        return;
      }
      const nav = document.querySelector('.tabs') as HTMLElement | null;
      // Сколько остаётся под карточку: окно минус то, что над сценой,
      // минус нижнее меню. Позиция сцены считается от документа, а не от
      // окна: при прокрутке она не «плывёт».
      const above = stage.getBoundingClientRect().top + window.scrollY;
      const menu = (nav?.offsetHeight ?? 58) + MENU_GAP;
      const room = window.innerHeight - above - menu;
      const under = belowRef?.current?.offsetHeight ?? 0;
      const free = room - FOOT_H - CARD_PAD - GAPS - under - (rows - 1) * gap;
      setCap(Math.max(MIN_CELL, Math.floor(free / rows)));
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) {
      if (cardRef.current) ro.observe(cardRef.current);
      if (belowRef?.current) ro.observe(belowRef.current);
    }
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [rows, gap, cardRef, belowRef]);

  return cap;
}
