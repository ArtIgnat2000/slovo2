
/**
 * Экранная клавиатура.
 *
 * «Ё» стоит в конце второй строки, «⇧» — в начале третьей (как в ряде
 * мобильных раскладок). «е» вместо «ё» при наборе засчитывается
 * (sameTypedWord). «⇧» нужна для слов с заглавной буквой («Москва»,
 * «Родина», «Жостово»): без неё такие слова нельзя набрать правильно.
 *
 * Поведение «⇧» (как на iOS/Android, к которым привыкли и дети):
 *  • один тап — заглавная для следующей буквы, дальше регистр снова строчный;
 *  • два тапа — заглавные все буквы (⇪), пока не выключат;
 *  • тап из режима «⇪» — обратно строчные.
 * Клавиатура сама отдаёт «уже преобразованную» букву: подписи клавиш
 * в режиме заглавных тоже показывают заглавные, и буквы подсвечены
 * нажатием как обычно.
 */
import { useState } from 'react';
import { sfx } from '../platform/sound';

export const KEYBOARD_ROWS = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э', 'ё'],
  ['⇧', 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'ъ', '⌫'],
];

const LETTER = /^[а-яё]$/;

export function Keyboard({ onKey, disabled }: { onKey: (k: string) => void; disabled?: boolean }) {
  const [caps, setCaps] = useState<'off' | 'once' | 'lock'>('off');

  const press = (k: string) => {
    if (disabled) return;
    if (k === '⇧') {
      sfx.tap();
      setCaps((c) => (c === 'off' ? 'once' : c === 'once' ? 'lock' : 'off'));
      return;
    }
    // Букву отдаём с учётом режима; сам режим «once» тратится на букве.
    if (caps !== 'off' && LETTER.test(k)) {
      if (caps === 'once') setCaps('off');
      onKey(k.toUpperCase());
      return;
    }
    onKey(k);
  };

  const renderKey = (k: string) => {
    const isShift = k === '⇧';
    const shown = caps !== 'off' && LETTER.test(k) ? k.toUpperCase() : k;
    const shiftGlyph = caps === 'lock' ? '⇪' : '⇧';
    const cls = isShift
      ? `key shift ${caps !== 'off' ? 'on' : ''} ${caps === 'lock' ? 'lock' : ''}`
      : `key ${k === '⌫' ? 'back' : ''}`;
    return (
      <button
        key={k}
        className={cls}
        disabled={disabled}
        aria-label={isShift ? (caps === 'off' ? 'Заглавная буква' : caps === 'once' ? 'Заглавная буква — следующая' : 'Заглавные все буквы') : undefined}
        aria-pressed={isShift ? caps !== 'off' : undefined}
        onClick={() => press(k)}
      >
        {isShift ? shiftGlyph : shown}
      </button>
    );
  };

  return (
    <div className="keyboard">
      {KEYBOARD_ROWS.map((row, i) => (
        <div className="kb-row" key={i}>
          {row.map(renderKey)}
        </div>
      ))}
    </div>
  );
}
