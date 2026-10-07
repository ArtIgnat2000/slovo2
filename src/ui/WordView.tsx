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
 *
 * Плита умеет два состояния: обычная (квадрат --art-size) и «снимок»
 * (класс word-art-fill) — во всю ширину паспарту, как фотокарточка. Второе
 * включает вариант B и растягивает снимок; поля и радиусы там переопределены.
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

/**
 * Вариант по умолчанию для всего приложения.
 *
 * 2026-10-06: пользователь выбрал B «Фотокарточка» (картинка и слово в одной
 * рамке, как в паспарту) — самая сильная связка «образ ↔ слово» и лучшее
 * поведение на пёстрых исходниках. A «Плита» и C «Полка» остались как
 * переключаемые варианты: /?cards=plate, /?cards=split.
 */
export const WORD_CARD_VARIANT: WordCardVariant = 'photo';

/** Размер снимка в «Фотокарточке»: во всю карточку или как плита варианта A. */
export type PhotoSize = 'compact' | 'base';

/**
 * Чтение настройки из адреса. Хеш — наравне с параметром: в предпросмотре
 * песочницы параметры иногда теряются по дороге, а хеш доезжает.
 */
function addressFlag(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  return (
    new URLSearchParams(window.location.search).get(name) ?? new URLSearchParams(hash).get(name)
  );
}

export function resolveWordCardVariant(): WordCardVariant {
  const asked = addressFlag('cards');
  return asked === 'plate' || asked === 'photo' || asked === 'split' ? asked : WORD_CARD_VARIANT;
}

/**
 * Размер снимка: /?art=compact|base. Нужен, чтобы сравнить размеры прямо на
 * своём телефоне, не пересобирая приложение: compact — снимок как плита
 * варианта A (до 220px, квадрат по центру паспарту), base — во всю ширину
 * карточки (по умолчанию).
 */
export function resolvePhotoSize(): PhotoSize {
  const asked = addressFlag('art');
  return asked === 'compact' || asked === 'base' ? asked : 'base';
}

/** Размер плиты по умолчанию: у каждого варианта своя шкала (см. tokens.css). */
function defaultArtSize(mode: WordCardVariant): string {
  if (mode !== 'photo') return 'var(--art-hero)';
  return resolvePhotoSize() === 'compact' ? 'var(--art-photo-compact)' : 'var(--art-photo)';
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
  /** Размер плиты под картинку. По умолчанию — адаптивный размер варианта. */
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
 * Основной вариант — B «Фотокарточка» (WORD_CARD_VARIANT), где снимок и слово
 * стоят в одной рамке; A «Плита» и C «Полка» включаются через ?cards=…
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
  artSize,
  lettersClassName = '',
  lettersProps,
  children,
  className = '',
}: WordCardProps) {
  const mode = variant ?? resolveWordCardVariant();
  const letters = <WordLetters word={word} stress markDanger {...lettersProps} className={lettersClassName} />;
  // В «Фотокарточке» плита растягивается по ширине паспарту (word-art-fill):
  // снимок занимает всю карточку, а не висит квадратом по центру.
  const artClass = `wcard-art ${mode === 'photo' ? 'word-art-fill' : ''}`.trim();

  return (
    <div className={`wcard wcard-${mode} ${className}`}>
      <WordArt word={word} size={artSize ?? defaultArtSize(mode)} className={artClass} />
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
export function WordClue({ word, compact = false }: { word: Word; compact?: boolean }) {
  return (
    <div className="clue">
      <WordArt word={word} size={compact ? 56 : 64} />
      <div className="clue-body">
        <Sentence word={word} />
        <p className="clue-hint">
          💡 {word.hint} · <b>{lengthLabel(word)}</b>
        </p>
      </div>
    </div>
  );
}
