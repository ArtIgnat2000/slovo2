import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { haptic } from '../platform/haptics';

/**
 * «Тишина на время» — сколько длится пауза музыки после долгого нажатия.
 * 15 минут: хватает на дорогу в школу или на урок, где музыка мешает,
 * и не требует возвращаться в настройки, чтобы включить обратно.
 */
export const QUIET_MS = 15 * 60_000;

/** Долгое нажатие: короче — случайные срабатывания, длиннее — ребёнок отпустит раньше. */
const LONG_PRESS_MS = 550;

interface Props {
  /** Настройка «Музыка» из профиля (не временная тишина). */
  music: boolean;
  /** Конец временной тишины в мс; null — тишины нет. */
  quietUntil: number | null;
  /** Текущее время: приходит из App, чтобы отсчёт шёл одним таймером. */
  now: number;
  onToggle: () => void;
  onQuiet: () => void;
  onCancelQuiet: () => void;
}

/** «14:35» → «14 мин»: ребёнку важен порядок, а не секунды. */
function leftLabel(ms: number): string {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  if (totalSec < 60) return `${totalSec} с`;
  return `${Math.ceil(totalSec / 60)} мин`;
}

/**
 * Быстрый звук на любом экране, кроме урока (0.29.0).
 *
 * Зачем отдельная кнопка: музыка включается/выключается в «Родителям» за
 * паролем, а ребёнку нужно «тихо прямо сейчас» — в автобусе, в классе, когда
 * рядом спит младший. Поэтому:
 *  • тап — включить/выключить музыку, выбор сохраняется в настройках профиля;
 *  • долгое нажатие — тишина на 15 минут, потом музыка возвращается сама;
 *  • повторный тап во время тишины — вернуть музыку сразу.
 *
 * Звуковые эффекты кнопка не трогает: отклик на ответ остаётся, даже когда
 * фон выключен (это разные настройки, см. SettingsTab).
 */
export function QuickSound({ music, quietUntil, now, onToggle, onQuiet, onCancelQuiet }: Props) {
  const quietLeft = quietUntil === null ? 0 : Math.max(0, quietUntil - now);
  const quiet = quietLeft > 0;
  const on = music && !quiet;
  const [pressing, setPressing] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Долгое нажатие уже сработало — следующий click не должен переключать музыку. */
  const longFired = useRef(false);

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setPressing(false);
  };

  useEffect(() => clearHold, []);

  const start = (e: ReactPointerEvent<HTMLButtonElement>) => {
    // Прокрутка и драг не должны «зажимать» кнопку.
    if (e.button !== undefined && e.button > 0) return;
    longFired.current = false;
    clearHold();
    setPressing(true);
    holdTimer.current = setTimeout(() => {
      longFired.current = true;
      holdTimer.current = null;
      setPressing(false);
      haptic.tap();
      onQuiet();
    }, LONG_PRESS_MS);
  };

  const cancel = () => {
    clearHold();
  };

  const activate = () => {
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    // Во время тишины тап возвращает музыку, а не выключает настройку.
    if (quiet) onCancelQuiet();
    else onToggle();
  };

  const label = quiet
    ? `Музыка на паузе, ${leftLabel(quietLeft)}. Вернуть сразу`
    : on
      ? 'Выключить музыку'
      : 'Включить музыку';

  return (
    <button
      type="button"
      className={`quick-sound${on ? ' on' : ''}${quiet ? ' quiet' : ''}${pressing ? ' pressing' : ''}`}
      aria-label={`${label}. Долгое нажатие — тишина на 15 минут`}
      aria-pressed={on}
      title={quiet ? 'Музыка вернётся сама · тап — вернуть сразу' : 'Тап — вкл/выкл, долгое нажатие — тишина на 15 минут'}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={activate}
    >
      <span className="quick-sound-ico" aria-hidden="true">
        {quiet ? '🌙' : on ? '🔊' : '🔇'}
      </span>
      {quiet && (
        <span className="quick-sound-left" aria-hidden="true">
          {leftLabel(quietLeft)}
        </span>
      )}
    </button>
  );
}
