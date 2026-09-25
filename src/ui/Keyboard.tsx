
const ROWS = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '⌫'],
];

/**
 * Своя раскладка: системная клавиатура на телефоне перекрывает задание,
 * а ребёнку важно видеть слово и предложение одновременно с набором.
 */
export function Keyboard({ onKey, disabled }: { onKey: (k: string) => void; disabled?: boolean }) {
  return (
    <div className="keyboard">
      {ROWS.map((row, i) => (
        <div className="kb-row" key={i}>
          {row.map((k) => (
            <button
              key={k}
              className={`key ${k === '⌫' ? 'back' : ''}`}
              disabled={disabled}
              onClick={() => onKey(k)}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
