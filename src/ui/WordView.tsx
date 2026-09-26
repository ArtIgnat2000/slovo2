import type { Word } from '../types';

const VOWELS = 'аеёиоуыэюя';

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

/**
 * Предложение с пропуском. Пропуск — пустая рамка: раньше в нём лежало слово
 * прозрачными буквами, из-за чего ширина рамки выдавала длину ответа.
 */
export function Sentence({ word, hidden = true }: { word: Word; hidden?: boolean }) {
  const parts = word.sentence.split('____');
  return (
    <div className="sentence">
      {parts[0]}
      {hidden ? <span className="gap" aria-hidden="true" /> : word.text}
      {parts[1]}
    </div>
  );
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «Слово из 5 букв» / «2 слова, 11 букв» — чтобы ребёнок знал объём ответа. */
export function lengthLabel(word: Word): string {
  const words = word.text.trim().split(/\s+/);
  const letters = word.text.replace(/\s+/g, '').length;
  const lettersWord = plural(letters, 'буква', 'буквы', 'букв');
  if (words.length === 1) return `Слово из ${letters} ${lettersWord}`;
  return `${words.length} ${plural(words.length, 'слово', 'слова', 'слов')}, ${letters} ${lettersWord}`;
}

/** Человеческое описание «опасных» букв — по самим буквам, а не по общему типу слова. */
export function dangerSummary(word: Word): string {
  const letters = [...new Set(word.danger.map((i) => word.text[i].toUpperCase()))];
  const vowels = word.danger.filter((i) => VOWELS.includes(word.text[i])).length;
  const kind =
    word.danger.length === 0
      ? 'буква'
      : vowels === word.danger.length
        ? plural(word.danger.length, 'безударная гласная', 'безударные гласные', 'безударные гласные')
        : vowels === 0
          ? plural(word.danger.length, 'согласная', 'согласные', 'согласные')
          : 'буквы, которые нужно запомнить';
  return `${word.danger.length > 1 ? 'Опасные буквы' : 'Опасная буква'}: ${letters.join(', ')} (${kind})`;
}

/**
 * Подсказка к заданию, где слово не видно (напиши по памяти, собери из букв,
 * исправь робота). Без неё было непонятно, какое именно слово требуется.
 */
export function WordClue({ word }: { word: Word }) {
  return (
    <div className="clue">
      <span className="clue-emoji" aria-hidden="true">
        {word.emoji}
      </span>
      <div className="clue-body">
        <Sentence word={word} />
        <p className="clue-hint">
          💡 {word.hint} · <b>{lengthLabel(word)}</b>
        </p>
      </div>
    </div>
  );
}
