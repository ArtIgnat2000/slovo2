import type { Word } from '../types';

interface Props {
  word: Word;
  stress?: boolean;
  markDanger?: boolean;
  blink?: boolean;
  hide?: number[];
  small?: boolean;
  className?: string;
}

/** Слово с ударением, «опасной» буквой и, если нужно, «окошком» вместо буквы. */
export function WordLetters({
  word,
  stress = false,
  markDanger = false,
  blink = false,
  hide = [],
  small = false,
  className = '',
}: Props) {
  return (
    <span
      className={`word-big ${blink ? 'blink' : ''} ${className}`}
      style={small ? { fontSize: 30 } : undefined}
    >
      {word.text.split('').map((ch, i) => {
        const isStress = stress && i === word.stress;
        const isDanger = markDanger && word.danger.includes(i);
        const hidden = hide.includes(i);
        const cls = [isStress ? 'stress' : '', isDanger ? 'danger' : ''].join(' ').trim();
        return (
          <span key={i} className={cls}>
            {hidden ? '□' : ch}
          </span>
        );
      })}
    </span>
  );
}

export function Sentence({ word, hidden = true }: { word: Word; hidden?: boolean }) {
  const parts = word.sentence.split('____');
  return (
    <div className="sentence">
      {parts[0]}
      {hidden ? <span className="gap">{word.text}</span> : word.text}
      {parts[1]}
    </div>
  );
}
