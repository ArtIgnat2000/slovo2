/**
 * Кнопки и карточки подсказок — вынесены из TaskView.tsx, чтобы их же
 * могли использовать доски с плитками («Карточки букв» в уроке и свободная
 * игра) без второго экземпляра логики.
 */
import { createContext, useContext } from 'react';
import type { Word } from '../types';
import { dangerSummary } from '../engine/word-facts';
import { sfx } from '../platform/sound';
import { Icon } from './Icon';

export const NoHintsContext = createContext(false);

export function HintBtn({
  onClick,
  label = 'Подсказка',
  disabled,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  // В полном контроле подсказок нет: проверяем, а не учим.
  if (useContext(NoHintsContext)) return null;
  return (
    <button
      className="btn ghost sm"
      data-hint=""
      onClick={() => {
        sfx.hint();
        onClick();
      }}
      disabled={disabled}
    >
      {/* 0.54.0: лампочка — иконка вместо 💡. Текст «Подсказка» остаётся:
          иконка не единственный носитель смысла (WCAG 1.4.1). */}
      <Icon name="bulb" size={18} /> {label}
    </button>
  );
}

/** Мнемоника или объяснение опасных букв — второй слой каждой подсказки. */
export function HintCard({ word }: { word: Word }) {
  if (useContext(NoHintsContext)) return null;
  return (
    <div className="banner">
      <Icon name="bulb" size={18} /> {word.mnemonic ?? dangerSummary(word)}
    </div>
  );
}

