/**
 * Навигатор БУКа (0.85.0): дуга дверей вокруг плавающей совы.
 *
 * Компонент отвечает только за разметку: углы дуги прилетают пропом `base`
 * (их считает FloatingMascot по положению совы — створка всегда смотрит
 * «в экран», от ближайшего края к центру), полупрозрачная подложка закрывает
 * меню тапом мимо, первая дверь получает фокус при открытии — дальше можно
 * ходить Tab/Shift+Tab и закрыть Escape (слушатель — во FloatingMascot).
 *
 * Сама сова не участвует: тап по ней остаётся «погладить», двери — отдельные
 * кнопки, чтобы контракт mascot-ui.test.tsx не менялся.
 */
import { useEffect, useRef, type CSSProperties } from 'react';

export interface HubDoor {
  /** Стабильный id — ключ React и якорь в тестах. */
  id: string;
  emoji: string;
  label: string;
  /** Действие выполняется ПОСЛЕ закрытия: экран может смениться целиком. */
  run: () => void;
}

export function BukHub({ doors, base, onClose }: { doors: HubDoor[]; base: number; onClose: () => void }) {
  const hubRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    hubRef.current?.querySelector<HTMLButtonElement>('.buk-door')?.focus();
  }, []);

  return (
    <>
      {/* Подложка лежит ниже совы и дверей (z-index: -1 внутри `.mascot`), но
          выше страницы: тап закрывает меню, не мешая погладить перетащить. */}
      <div className="buk-hub-veil" onClick={onClose} aria-hidden="true" />
      <div className="buk-hub" role="menu" aria-label="Куда полетим" ref={hubRef}>
        {doors.map((door, i) => {
          // Равномерный веер: шаг 32° при r=112 px — соседние кружки не
          // слипаются (хорда ≈ 61 px при кружке 46 px), дуга целиком в экране.
          const a = base + (i - (doors.length - 1) / 2) * 32;
          const style = { '--a': a, '--i': i } as CSSProperties;
          return (
            <button
              key={door.id}
              type="button"
              role="menuitem"
              className="buk-door"
              style={style}
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
          );
        })}
      </div>
    </>
  );
}
