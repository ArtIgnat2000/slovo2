/**
 * Навигатор БУКа (0.85.0; пересборка позиций для телефона — 0.86.2):
 * дуга дверей вокруг плавающей совы.
 *
 * Почему позиции считает JS, а не CSS-трансформ: на узком экране фиксированная
 * дуга уводила двери за край и подписи наезжали друг на друга, а ряд кнопок
 * `.mascot-actions` (🧭 ⌂ −) лежал поверх подписей — «буквы скрыты»
 * (замечание 2026-10-29). Поэтому:
 *  • `useLayoutEffect` раскладывает двери ДО первого кадра: веер от центра
 *    совы (шаг 34°, r=132 px), каждый центр клампится в вьюпорт с полями —
 *    подпись не вылезает за экран ни при каком положении БУКа;
 *  • пока дуга открыта, `.mascot` получает класс `hub-open` — ряд кнопок и
 *    реплика прячутся (`visibility: hidden`), освобождая место подписям;
 *  • подложка закрывает меню тапом мимо, первая дверь получает фокус при
 *    открытии (Escape — слушатель FloatingMascot).
 *
 * Сама сова не участвует: тап по ней остаётся «погладить», двери — отдельные
 * кнопки, чтобы контракт mascot-ui.test.tsx не менялся.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface HubDoor {
  /** Стабильный id — ключ React и якорь в тестах. */
  id: string;
  emoji: string;
  label: string;
  /** Действие выполняется ПОСЛЕ закрытия: экран может смениться целиком. */
  run: () => void;
}

/** Радиус дуги: внутренняя грань кружка (r − 32) дальше от центра, чем сова. */
const ARC_R = 132;
/** Шаг между дверями: при r=132 хорда ≈ 78 px — кружку 64 px хватает с запасом. */
const STEP_DEG = 34;
/** Поле от краёв экрана: центр двери не ближе EDGE к краю (кружок не срезает). */
const EDGE = 34;

export function BukHub({ doors, onClose }: { doors: HubDoor[]; onClose: () => void }) {
  const hubRef = useRef<HTMLDivElement>(null);

  // Раскладка до отрисовки (layout effect — браузер ещё не показал кадр,
  // двери не «прыгают»). Контейнер 0×0 стоит в центре совы: left/top 50%.
  useLayoutEffect(() => {
    const hub = hubRef.current;
    if (!hub) return;
    const cx = hub.getBoundingClientRect().left;
    const cy = hub.getBoundingClientRect().top;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Створка дуги смотрит «в экран» — от ближайшего края к центру:
    // 0° — вверх, дальше по часовой.
    const bx = cx < w / 2 ? 1 : -1;
    const by = cy < h / 2 ? 1 : -1;
    const base = (Math.atan2(bx, -by) * 180) / Math.PI;
    // Низ экрана — как у самого БУКа: двери выше панели вкладок.
    const tabsH = document.querySelector('.tabs')?.getBoundingClientRect().height ?? 0;
    const yMax = h - (tabsH > 0 ? tabsH + EDGE : 76) - EDGE;
    hub.querySelectorAll<HTMLElement>('.buk-door').forEach((el, i) => {
      const a = ((base + (i - (doors.length - 1) / 2) * STEP_DEG) * Math.PI) / 180;
      const x = Math.min(Math.max(cx + Math.sin(a) * ARC_R, EDGE), w - EDGE);
      const y = Math.min(Math.max(cy - Math.cos(a) * ARC_R, EDGE), yMax);
      // Смещения от центра контейнера: кружок 64 px (−32), центр круга сверху (−23).
      el.style.left = `${(x - cx - 32).toFixed(1)}px`;
      el.style.top = `${(y - cy - 23).toFixed(1)}px`;
    });
  }, [doors.length]);

  useEffect(() => {
    hubRef.current?.querySelector<HTMLButtonElement>('.buk-door')?.focus();
  }, []);

  return (
    <>
      {/* Подложка лежит ниже совы и дверей (z-index: -1 внутри `.mascot`), но
          выше страницы: тап закрывает меню, не мешая погладить перетащить. */}
      <div className="buk-hub-veil" onClick={onClose} aria-hidden="true" />
      <div className="buk-hub" role="menu" aria-label="Куда полетим" ref={hubRef}>
        {doors.map((door, i) => (
          <button
            key={door.id}
            type="button"
            role="menuitem"
            className="buk-door"
            style={{ '--i': i } as React.CSSProperties}
            aria-label={door.label}
            onClick={() => {
              onClose();
              door.run();
            }}
          >
            <span className="buk-door-face" aria-hidden="true">
              <span className="buk-door-emoji">{door.emoji}</span>
              <span className="buk-door-label">{door.label}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
