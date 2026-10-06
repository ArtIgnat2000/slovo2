import { useState, type CSSProperties, type ReactNode } from 'react';
import { wordImageUrl } from '../platform/word-images';
import { plural } from '../engine/word-facts';
// dangerSummary теперь в engine/word-facts — его читают TaskView и WordsScreen напрямую.
import type { Word } from '../types';

/**
 * Картинка слова (картинки лежат в public/words/, WebP 256×256).
 * Есть картинка — показываем её, нет — остаётся эмодзи. Картинки важны
 * для визуальной памяти: слово запоминается вместе с образом, а не с буквами.
 *
 * Рисунок всегда живёт на «плите» — светлой подложке с рамкой и внутренним
 * отступом (--art-safe). Причина простая: у нас картинки нарисованы в край
 * квадрата, и без подложки они зрительно липли к буквам и к рамке карточки.
 * Duolingo в своём арт-гайде формулирует то же правило: иллюстрация должна быть
 * «обрамлена отрицательным пространством» и никогда не мешать чтению текста.
 */
export function WordArt({
  word,
  size = 96,
  lazy = false,
  className = '',
}: {
  word: Word;
  /** Число — пиксели, строка — любое CSS-значение (например var(--art-hero)). */
  size?: number | string;
  /** Для длинных списков: не тянем все картинки сразу, уступаем дорогу карточке. */
  lazy?: boolean;
  className?: string;
}) {
  // Key isolates readiness when the same component is reused for another word.
  return (
    <WordImage
      key={wordImageUrl(word) ?? word.id}
      word={word}
      size={size}
      lazy={lazy}
      className={className}
    />
  );
}

function WordImage({
  word,
  size,
  lazy,
  className,
}: {
  word: Word;
  size: number | string;
  lazy: boolean;
  className: string;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = wordImageUrl(word);
  return (
    <span
      className={`word-art-frame ${className}`}
      style={{ '--art-size': typeof size === 'number' ? `${size}px` : size } as CSSProperties}
      aria-hidden="true"
    >
      <span className="word-art-inner">
        <span className="word-art-placeholder">{word.emoji}</span>
        {src && !failed && (
          <img
            className={`word-art ${ready ? 'is-ready' : ''}`}
            src={src}
            alt=""
            decoding="async"
            loading={lazy ? 'lazy' : undefined}
            {...{ fetchpriority: lazy ? 'low' : 'high' }}
            draggable={false}
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
          />
        )}
      </span>
    </span>
  );
}

// ── Вариант карточки слова ──────────────────────────────────────────────────
//
// Три варианта композиции «картинка + слово». Выбор — одна строка ниже, а для
// сравнения на живом приложении: /?cards=plate|photo|split или /#cards=…
// Разбор вариантов и замеры — в docs/word-cards-design.md.

export type WordCardVariant = 'plate' | 'photo' | 'split';

/** Вариант по умолчанию для всего приложения. */
export const WORD_CARD_VARIANT: WordCardVariant = 'plate';

export function resolveWordCardVariant(): WordCardVariant {
  if (typeof window === 'undefined') return WORD_CARD_VARIANT;
  // Хеш читаем наравне с параметром адреса: в предпросмотре песочницы параметры
  // иногда теряются по дороге, а хеш доезжает (#cards=photo).
  const hash = window.location.hash.replace(/^#/, '');
  const asked =
    new URLSearchParams(window.location.search).get('cards') ?? new URLSearchParams(hash).get('cards');
  return asked === 'plate' || asked === 'photo' || asked === 'split' ? asked : WORD_CARD_VARIANT;
}

interface LettersProps {
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
}: LettersProps) {
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

interface WordCardProps {
  word: Word;
  /** Композиция карточки; без параметра берётся вариант приложения (или ?cards=…). */
  variant?: WordCardVariant;
  /** Размер плиты под картинку. По умолчанию — адаптивный --art-hero. */
  artSize?: number | string;
  /** Классы для строки слова. */
  lettersClassName?: string;
  /** Дополнительные пометки в строке слова (например, мигание опасной буквы). */
  lettersProps?: Omit<LettersProps, 'word'>;
  /** Текст-подпись внутри карточки (слоги, предложение, мнемоника…). */
  children?: ReactNode;
  className?: string;
}

/**
 * Карточка слова: картинка на плите + слово + подпись.
 *
 * Правила, общие для всех вариантов:
 *   1. Между плитой и словом всегда не меньше --wcard-gap-art (20px).
 *   2. Слово и подпись разделены --wcard-gap-word (16px): это разные смысловые
 *      блоки, «склеивать» их нельзя.
 *   3. Буква-подсветка (опасная) — это «чип» с горизонтальным паддингом, она
 *      физически не может коснуться картинки или соседней буквы.
 *   4. Плита картинки сама держит безопасную зону (--art-safe), поэтому даже
 *      иллюстрация «в край листа» выглядит как framed picture, а не как пятно.
 */
export function WordCard({
  word,
  variant,
  artSize = 'var(--art-hero)',
  lettersClassName = '',
  lettersProps,
  children,
  className = '',
}: WordCardProps) {
  const mode = variant ?? resolveWordCardVariant();
  const letters = <WordLetters word={word} stress markDanger {...lettersProps} className={lettersClassName} />;

  return (
    <div className={`wcard wcard-${mode} ${className}`}>
      <WordArt word={word} size={artSize} className="wcard-art" />
      <div className="wcard-main">
        <div className="wcard-word">{letters}</div>
        {children && <div className="wcard-body">{children}</div>}
      </div>
    </div>
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
      <WordArt word={word} size={64} />
      <div className="clue-body">
        <Sentence word={word} />
        <p className="clue-hint">
          💡 {word.hint} · <b>{lengthLabel(word)}</b>
        </p>
      </div>
    </div>
  );
}
