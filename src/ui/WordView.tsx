import { useState } from 'react';
import { wordImageUrl } from '../platform/word-images';
import { plural } from '../engine/word-facts';
// dangerSummary теперь в engine/word-facts — его читают TaskView и WordsScreen напрямую.
import type { Word } from '../types';

/**
 * Картинка слова (картинки лежат в public/words/, WebP 256×256).
 * Есть картинка — показываем её, нет — остаётся эмодзи. Картинки важны
 * для визуальной памяти: слово запоминается вместе с образом, а не с буквами.
 */
export function WordArt({ word, size = 96, className = '' }: { word: Word; size?: number; className?: string }) {
  // Key isolates readiness when the same component is reused for another word.
  return <WordImage key={wordImageUrl(word) ?? word.id} word={word} size={size} className={className} />;
}

function WordImage({ word, size, className }: { word: Word; size: number; className: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = wordImageUrl(word);
  return (
    <span className={`word-art-frame ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="word-art-placeholder" style={{ fontSize: size * 0.7 }}>{word.emoji}</span>
      {src && !failed && <img
        className={`word-art ${ready ? 'is-ready' : ''}`}
        src={src} alt="" width={size} height={size}
        style={{ width: size, height: size }} decoding="async"
        {...{ fetchpriority: 'high' }} draggable={false}
        onLoad={() => setReady(true)} onError={() => setFailed(true)}
      />}
    </span>
  );
}

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

/** «Слово из 5 букв» / «2 слова, 11 букв» — чтобы ребёнок знал объём ответа. */
export function lengthLabel(word: Word): string {
  const words = word.text.trim().split(/\s+/);
  const letters = word.text.replace(/\s+/g, '').length;
  const lettersWord = plural(letters, 'буква', 'буквы', 'букв');
  if (words.length === 1) return `Слово из ${letters} ${lettersWord}`;
  return `${words.length} ${plural(words.length, 'слово', 'слова', 'слов')}, ${letters} ${lettersWord}`;
}

/**
 * Подсказка к заданию, где слово не видно (напиши по памяти, собери из букв,
 * исправь робота). Без неё было непонятно, какое именно слово требуется.
 */
export function WordClue({ word }: { word: Word }) {
  return (
    <div className="clue">
      <WordArt word={word} size={56} className="clue-art" />
      <div className="clue-body">
        <Sentence word={word} />
        <p className="clue-hint">
          💡 {word.hint} · <b>{lengthLabel(word)}</b>
        </p>
      </div>
    </div>
  );
}
