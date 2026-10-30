import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { MUSIC_TRACKS, type MusicTrack } from '../engine/music';
import {
  SOUND_PACKS,
  cueSeconds,
  type SoundNote,
  type SoundPack,
  type SoundWave,
} from '../engine/sounds';

/**
 * Обложки цифровых товаров (0.88.0): у музыкальных треков и наборов звуков
 * появилась своя двухсторонняя «печатная» обложка вместо эмодзи на градиенте.
 *
 * Почему так, а не сгенерированные картинки:
 *  • цифровой товар не имеет физического предмета, и фотореалистичная съёмка
 *    здесь была бы обманом — ребёнок увидел бы на витрине то, чего не купит;
 *  • зато у трека есть настоящие данные: оригинальное название, автор, темп,
 *    длительность, ISRC, лицензия; у набора звуков — реальные ноты сигналов
 *    (`engine/sounds.ts`). Из них и строится редакционная обложка.
 *
 * Лицевая сторона — типографика и абстрактная спектральная графика. Оборот —
 * метаданные трека или партитура-«пиано-ролл» реальных нот набора. Всё
 * детерминировано от id: у одного трека обложка всегда одна и та же, в
 * магазине, «Моём мире» и демо-витрине.
 *
 * Чего здесь намеренно нет: персонажей, мультяшных сцен, нарисованных
 * инструментов и анимации-«переворота». Смена стороны мгновенная и уважает
 * `prefers-reduced-motion`; обложка остаётся плоской печатной страницей.
 */

export type DigitalCoverVariant = 'mini' | 'card' | 'full';
export type DigitalCoverSide = 'front' | 'back';

type DigitalCoverProps = {
  /** Музыкальный трек — обложка с метаданными на обороте. */
  track?: MusicTrack;
  /** Набор звуков — обложка с партитурой сигналов на обороте. */
  pack?: SoundPack;
  /**
   * mini — 56–84 px (мечты, герой витрины), только знак и графика;
   * card — карточка магазина/коллекции, читается название;
   * full — крупный лист с переключением сторон.
   */
  variant?: DigitalCoverVariant;
  /** Переключать стороны по тапу. По умолчанию — только у `full`. */
  interactive?: boolean;
  /** Идёт прослушивание: на обложке появляется эквалайзер. */
  playing?: boolean;
  className?: string;
};

/** Детерминированный хеш строки: обложка не должна «прыгать» между рендерами. */
function seedOf(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Линейный конгруэнтный генератор: та же последовательность для того же id. */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Палитра обложки. Чернильный фон и бумажный текст — «печать», а не неон:
 * рядом с фото товаров такая обложка читается как редакционное издание.
 *
 * Гамма не случайная: она следует смыслу полки. «Спокойный фон» — холодный
 * бирюзовый конверт с янтарным акцентом, «Коллекция и награды» — тёплый
 * терракотовый с прохладным акцентом. Наборы звуков — индиго с золотом, чтобы
 * не спорить с музыкой. Внутри семьи оттенок слегка гуляет от id, поэтому
 * серия живая, но узнаваемая. Дуотон (тёмный тон + контрастный акцент) держит
 * читаемость названия на любом фоне.
 */
function palette(id: string, kind: 'track' | 'sound', shelf?: MusicTrack['shelf']): CSSProperties {
  const seed = seedOf(id);
  let hue: number;
  let accentHue: number;
  let inkSaturation: number;
  if (kind === 'track' && shelf === 'fun') {
    hue = 14 + (seed % 16); // терракота и медь
    accentHue = 192 + (seed % 18); // прохладный бирюзовый
    inkSaturation = 34;
  } else if (kind === 'track') {
    hue = 176 + (seed % 18); // глубокий бирюзово-зелёный
    accentHue = 36 + (seed % 14); // янтарь
    inkSaturation = 30;
  } else {
    hue = 224 + (seed % 14); // индиго
    accentHue = 48 + (seed % 10); // золото
    inkSaturation = 32;
  }
  return {
    '--dc-ink': `hsl(${hue} ${inkSaturation}% 13%)`,
    '--dc-ink-2': `hsl(${hue} ${inkSaturation - 6}% 21%)`,
    '--dc-accent': `hsl(${accentHue} 62% 62%)`,
    '--dc-paper': 'hsl(42 30% 93%)',
  } as CSSProperties;
}

/** Высоты столбиков спектра: плавная волна + детерминированный «шум». */
function spectrum(id: string, count = 24): number[] {
  const seed = seedOf(id);
  const random = generator(seed);
  const shift = (seed % 11) / 11;
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index / count) * Math.PI * 2.2 + shift * Math.PI * 2) * 0.26;
    const envelope = Math.sin((index / (count - 1)) * Math.PI) * 0.32;
    const noise = random() * 0.42;
    return Math.min(1, Math.max(0.1, 0.2 + wave + envelope + noise));
  });
}

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

const SHELF_LABEL: Record<MusicTrack['shelf'], string> = {
  calm: 'Спокойный фон',
  fun: 'Коллекция и награды',
};

const WAVE_LABEL: Record<SoundWave, string> = {
  sine: 'синус',
  triangle: 'треугольник',
  square: 'квадрат',
  sawtooth: 'пила',
  chime: 'колокольчик',
};

function catalogNumber(kind: 'track' | 'sound', id: string): string {
  const list: Array<{ id: string }> = kind === 'track' ? MUSIC_TRACKS : SOUND_PACKS;
  const index = list.findIndex((entry) => entry.id === id);
  const number = String(Math.max(1, index + 1)).padStart(2, '0');
  return `${kind === 'track' ? 'SLOVO' : 'SIGNAL'}–${number}`;
}

/** Короткая лицензия для оборота: полный текст живёт в «Авторах и лицензиях». */
function shortLicense(license: string): string {
  return license.includes('CC BY 4.0') ? 'CC BY 4.0' : license;
}

/** Подпись из уникальных волн набора — честно описывает тембры. */
function waveSummary(pack: SoundPack): string {
  const waves = new Set([...pack.correct, ...pack.wrong].map((note) => note.wave));
  return [...waves].map((wave) => WAVE_LABEL[wave]).join(', ');
}

function Spectrum({ id }: { id: string }) {
  const bars = useMemo(() => spectrum(id), [id]);
  return (
    <svg className="dc-spectrum" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {bars.map((value, index) => {
        const width = 100 / bars.length;
        const height = Math.max(1.2, value * 32);
        return (
          <rect
            key={index}
            x={index * width + width * 0.22}
            y={34 - height}
            width={width * 0.56}
            height={height}
            rx={0.8}
          />
        );
      })}
    </svg>
  );
}

/**
 * Партитура сигнала: реальные ноты из `engine/sounds.ts`. По горизонтали —
 * время от начала отклика, по вертикали — высота тона (MIDI). Плавный съезд
 * частоты (`glideTo`) показан тонкой линией к конечной ноте.
 */
function NoteRoll({ notes, title }: { notes: SoundNote[]; title: string }) {
  const total = cueSeconds(notes) || 1;
  const midi = (freq: number) => 69 + 12 * Math.log2(freq / 440);
  const notesMidi = notes.flatMap((note) => (note.glideTo ? [midi(note.freq), midi(note.glideTo)] : [midi(note.freq)]));
  const low = Math.floor(Math.min(...notesMidi)) - 1;
  const high = Math.ceil(Math.max(...notesMidi)) + 1;
  const span = Math.max(4, high - low);
  const y = (pitch: number) => 8 + (1 - (pitch - low) / span) * 26;
  const first = Math.floor(low / 12) * 12;
  const octaves = Array.from({ length: Math.floor(span / 12) + 1 }, (_, index) => first + index * 12);

  return (
    <figure className="dc-roll">
      <figcaption>{title}</figcaption>
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label={`${title}: ${notes.length} нот`}>
        {octaves.map((octave) => (
          <line key={octave} className="dc-roll-line" x1="0" x2="100" y1={y(octave)} y2={y(octave)} />
        ))}
        {notes.map((note, index) => {
          const start = (note.at / total) * 96 + 2;
          const width = Math.max(1.6, (note.dur / total) * 96);
          return (
            <g key={index}>
              <rect
                className="dc-roll-note"
                x={start}
                y={y(midi(note.freq)) - 2}
                width={width}
                height={4}
                rx={1.4}
              />
              {note.glideTo !== undefined && (
                <line
                  className="dc-roll-glide"
                  x1={start + width}
                  y1={y(midi(note.freq))}
                  x2={Math.min(99, start + width + 4)}
                  y2={y(midi(note.glideTo))}
                />
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Лицевая сторона: номер в серии, название, спектр, выходные данные. */
function Front({ id, track, pack, variant }: { id: string; track?: MusicTrack; pack?: SoundPack; variant: DigitalCoverVariant }) {
  const title = track?.title ?? pack?.title ?? '';
  const kindLabel = track ? 'Музыка' : 'Звуки';
  const subLine = track
    ? `${track.originalTitle} · ${track.artist}`
    : `${pack?.desc ?? ''}`;
  const bottom = track
    ? `${duration(track.seconds)} · ${track.bpm} BPM`
    : `${pack ? cueSeconds(pack.correct).toFixed(2) : '0.00'} с · ${pack ? pack.correct.length + pack.wrong.length : 0} нот`;
  const number = catalogNumber(track ? 'track' : 'sound', id).split('–')[1];

  return (
    <div className="dc-face dc-front">
      <div className="dc-rule" aria-hidden="true" />
      <div className="dc-top">
        <span className="dc-imprint">СЛОВО · АУДИО</span>
        <span className="dc-cat">{kindLabel}</span>
      </div>
      <div className="dc-main">
        <span className="dc-number" aria-hidden="true">{number}</span>
        <p className="dc-title">{title}</p>
        {variant === 'full' && <p className="dc-sub">{subLine}</p>}
      </div>
      <Spectrum id={id} />
      <div className="dc-foot">
        {variant !== 'mini' && <span>{bottom}</span>}
        <span className="dc-cat">{catalogNumber(track ? 'track' : 'sound', id)}</span>
      </div>
    </div>
  );
}

/** Оборот трека: настоящие метаданные записи, без выдуманных фактов. */
function TrackBack({ track, id }: { track: MusicTrack; id: string }) {
  return (
    <div className="dc-face dc-back">
      <div className="dc-top">
        <span className="dc-imprint">ОБОРОТ · МЕТАДАННЫЕ</span>
        <span className="dc-cat">{catalogNumber('track', id)}</span>
      </div>
      <p className="dc-back-lead">{track.title}</p>
      <p className="dc-back-kicker">{SHELF_LABEL[track.shelf]}</p>
      <dl className="dc-facts">
        <div><dt>Оригинал</dt><dd>{track.originalTitle}</dd></div>
        <div><dt>Автор</dt><dd>{track.artist}</dd></div>
        <div><dt>Длительность</dt><dd>{duration(track.seconds)}</dd></div>
        <div><dt>Темп</dt><dd>{track.bpm} BPM</dd></div>
        <div><dt>Лицензия</dt><dd>{shortLicense(track.license)}</dd></div>
        <div><dt>ISRC</dt><dd>{track.isrc}</dd></div>
      </dl>
      <p className="dc-note">
        Запись Kevin MacLeod (incompetech.com), лицензия CC BY. Аудио не продаётся —
        покупка открывает мелодию внутри игры.
      </p>
    </div>
  );
}

/** Оборот набора звуков: партитура верного отклика и мягкой ошибки. */
function SoundBack({ pack, id }: { pack: SoundPack; id: string }) {
  return (
    <div className="dc-face dc-back">
      <div className="dc-top">
        <span className="dc-imprint">ОБОРОТ · СИГНАЛЫ</span>
        <span className="dc-cat">{catalogNumber('sound', id)}</span>
      </div>
      <p className="dc-back-lead">{pack.title}</p>
      <NoteRoll notes={pack.correct} title="Верный ответ" />
      <NoteRoll notes={pack.wrong} title="Ошибка" />
      <p className="dc-note">
        Тембры: {waveSummary(pack)}. Ноты синтезируются в браузере, поэтому набор
        ничего не весит и работает офлайн.
      </p>
    </div>
  );
}

export function DigitalCover({
  track,
  pack,
  variant = 'full',
  interactive,
  playing = false,
  className,
}: DigitalCoverProps) {
  const id = track?.id ?? pack?.id ?? '';
  const flip = interactive ?? variant === 'full';
  const [side, setSide] = useState<DigitalCoverSide>('front');
  useEffect(() => setSide('front'), [id]);

  if (!id || (!track && !pack)) return null;

  const style = palette(id, track ? 'track' : 'sound', track?.shelf);
  const title = track?.title ?? pack?.title ?? '';
  const classes = `digital-cover${flip ? ' is-flippable' : ' is-static'}${className ? ` ${className}` : ''}`;
  const front = <Front id={id} track={track} pack={pack} variant={variant} />;
  const back = track ? <TrackBack track={track} id={id} /> : <SoundBack pack={pack!} id={id} />;

  if (!flip) {
    return (
      <div
        className={classes}
        style={style}
        data-cover={id}
        data-kind={track ? 'track' : 'sound'}
        data-variant={variant}
        data-side="front"
        aria-hidden="true"
      >
        {front}
        {playing && <span className="dc-eq"><i /><i /><i /></span>}
      </div>
    );
  }

  const next = side === 'front' ? 'оборот с метаданными' : 'лицевую сторону';
  return (
    <div
      className="dc-frame"
      style={style}
      data-cover={id}
      data-kind={track ? 'track' : 'sound'}
      data-variant={variant}
      data-side={side}
    >
      <div className={classes}>
        <button
          type="button"
          className="dc-stage"
          onClick={() => setSide((value) => (value === 'front' ? 'back' : 'front'))}
          aria-label={`Обложка «${title}»: ${side === 'front' ? 'лицевая сторона' : 'оборот'}. Показать ${next}`}
          aria-pressed={side === 'back'}
        >
          {side === 'front' ? front : back}
          {playing && side === 'front' && <span className="dc-eq"><i /><i /><i /></span>}
        </button>
      </div>
      <p className="dc-caption" aria-live="polite">
        <span>{side === 'front' ? 'Лицевая сторона' : 'Оборот'}</span>
        <span>{side === 'front' ? '1' : '2'} / 2</span>
      </p>
    </div>
  );
}
