import { TINT_PRICE, currentTint, tintChoices, tintSwatchColors, type TintOption } from '../engine/tints';
import type { ShopTuning } from '../types';

interface Props {
  /** Что красим: у аксессуара «Цвет», у костюма «Акцент» */
  caption: string;
  /** id вещи магазина или костюма — по нему движок находит палитру */
  targetId: string;
  /** Название вещи: его читает скринридер */
  title: string;
  tuning: ShopTuning | undefined;
  /** Тап по оттенку: `unlocked` — цена 0, значит можно менять сразу, без диалога */
  onPick: (tint: TintOption, unlocked: boolean) => void;
}

/**
 * Палитра оттенков одной вещи: базовый плюс три за кристаллы.
 *
 * Кружок 44×44 (зона касания по WCAG 2.5.5), у выбранного — кольцо и ✓, у
 * закрытого — пунктир и «💎1». Оттенок не передаётся одним цветом: градиент
 * показывает и «глубокий» тон (плащ костюма, тень аксессуара), а название
 * всегда есть в aria-label — цвет не единственный носитель смысла (WCAG 1.4.1).
 */
export function TintPicker({ caption, targetId, title, tuning, onPick }: Props) {
  const current = currentTint(tuning, targetId);
  const choices = tintChoices(tuning, targetId);
  if (!choices.length) return null;
  return (
    <div className="tint-panel">
      <div className="tiny muted">
        {caption}: {current?.title.toLowerCase()}
      </div>
      <div className="tint-row" role="group" aria-label={`${caption}: ${title}`}>
        {choices.map((choice) => {
          const [main, deep] = tintSwatchColors(targetId, choice.tint.id);
          return (
            <button
              key={choice.tint.id}
              className={`tint-swatch${choice.selected ? ' on' : ''}${choice.unlocked ? '' : ' paid'}`}
              style={{ background: `linear-gradient(135deg, ${main} 0 55%, ${deep} 55% 100%)` }}
              aria-pressed={choice.selected}
              aria-label={
                choice.unlocked
                  ? `${choice.tint.title}${choice.selected ? ', выбран' : ', открыт'}`
                  : `${choice.tint.title}, стоит ${TINT_PRICE} 💎`
              }
              onClick={() => onPick(choice.tint, choice.unlocked)}
            >
              {choice.unlocked ? '' : `💎${TINT_PRICE}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
