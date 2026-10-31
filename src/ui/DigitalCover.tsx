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
 * 0.89.8 — третья сторона у трека: нарисованная сцена настроения (небо, солнце,
 * холмы, деревья, ноты и знак мелодии) и подпись «Иллюстрация». Пользователь
 * попросил картинку, которая объясняет музыку детям; лицо и оборот остались
 * печатными. Персонажей и мультяшных сцен по-прежнему нет: сцена — пейзаж,
 * одна рука на всю серию, никакой анимации-«переворота». Смена стороны
 * мгновенная и уважает `prefers-reduced-motion`.
 */

export type DigitalCoverVariant = 'mini' | 'card' | 'full';
export type DigitalCoverSide = 'front' | 'art' | 'back';

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

/**
 * Третья сторона обложки (0.89.8): иллюстрация музыки.
 *
 * Пользователь попросил «третью картинку, которая иллюстрировала бы музыку»:
 * дети выбирают глазами, а типографика и спектр им ничего не говорят. Лицо и
 * оборот остаются печатными — третья сторона это «внутренняя страница
 * буклета», нарисованная сцена настроения.
 *
 * Почему сцена рисуется вектором, а не генерируется в студии:
 *  • цифровой товар не имеет предмета, и фотореалистичный кадр здесь был бы
 *    обманом (то же правило, что у лица обложки);
 *  • сцена детерминирована от id: один трек — одна картинка в магазине,
 *    коллекции и «Моём мире», и новые треки получают её сразу, без съёмок;
 *  • стиль общий на всю серию: небо, солнце, холмы, деревья и ноты — у всех
 *    треков одна рука, меняются только оттенок, время суток и мотив.
 */
type MusicScene = {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  water: string;
  sunX: number;
  sunY: number;
  sunR: number;
  hills: [string, string, string];
  river: string;
  clouds: Array<{ x: number; y: number; s: number; o: number }>;
  confetti: Array<{ x: number; y: number; r: number; c: string }>;
  trees: Array<{ x: number; y: number; size: number }>;
  bushes: Array<{ x: number; y: number; r: number }>;
  grass: Array<{ x: number; y: number; h: number }>;
  stars: Array<{ x: number; y: number; r: number; o: number }>;
  notes: Array<{ x: number; y: number; size: number; rotate: number; o: number; pair: boolean }>;
  bunting: boolean;
};

/**
 * Сцена настроения. Всё детерминировано от id: у одного трека картинка всегда
 * одна и та же. «Спокойный фон» — тихое утро с водой и звёздами, «Коллекция» —
 * тёплый вечер с флажками и кустами.
 */
function musicScene(id: string, shelf: MusicTrack['shelf']): MusicScene {
  const seed = seedOf(id);
  const random = generator(seed);
  const jitter = (seed % 9) - 4;
  const fun = shelf === 'fun';
  const skyTop = fun ? `hsl(${26 + jitter} 74% 64%)` : `hsl(${205 + jitter} 47% 60%)`;
  const skyBottom = fun ? `hsl(${44 + jitter} 84% 87%)` : `hsl(${33 + jitter} 58% 89%)`;
  const far = fun ? `hsl(${22 + jitter} 32% 62%)` : `hsl(${197 + jitter} 26% 60%)`;
  const mid = fun ? `hsl(${17 + jitter} 33% 45%)` : `hsl(${200 + jitter} 27% 42%)`;
  const near = fun ? `hsl(${11 + jitter} 32% 29%)` : `hsl(${205 + jitter} 26% 26%)`;
  const water = fun ? `hsl(${196 + jitter} 52% 72%)` : `hsl(${190 + jitter} 46% 76%)`;
  const sunX = 22 + random() * 56;
  const sunY = fun ? 20 + random() * 9 : 25 + random() * 8;
  const sunR = fun ? 8.5 + random() * 3 : 7 + random() * 3;
  const hill = (base: number, amp: number, phase: number, freq: number) => {
    const points: string[] = [];
    for (let x = 0; x <= 100; x += 4) {
      const y = base + Math.sin((x / 100) * Math.PI * freq + phase) * amp;
      points.push(`${x} ${y.toFixed(2)}`);
    }
    return `M${points.join(' L')} L100 100 L0 100 Z`;
  };
  const hills: [string, string, string] = [
    hill(58 + random() * 5, 4 + random() * 3, random() * Math.PI * 2, 1.3 + random()),
    hill(71 + random() * 5, 5 + random() * 3, random() * Math.PI * 2, 1.1 + random()),
    hill(87 + random() * 4, 3 + random() * 2, random() * Math.PI * 2, 1.6 + random()),
  ];
  // Река у «спокойных» и тропинка у «весёлых»: один и тот же изгиб, разный цвет.
  const bank = 6 + random() * 20;
  const river = `M50 ${74 + random() * 4} C ${52 + bank} 82, ${44 - bank} 90, ${46 + bank * 0.6} 100 L${34 + bank * 0.4} 100 C ${30 - bank * 0.4} 90, ${40 + bank} 82, 44 ${74 + random() * 2} Z`;
  const clouds = Array.from({ length: 2 + Math.floor(random() * 2) }, () => ({
    x: 10 + random() * 78,
    y: 12 + random() * 22,
    s: 7 + random() * 7,
    o: 0.4 + random() * 0.3,
  }));
  const confetti = fun ? Array.from({ length: 14 }, () => ({
    x: 4 + random() * 92,
    y: 6 + random() * 40,
    r: 0.5 + random() * 0.9,
    c: ['hsl(4 74% 64%)', 'hsl(196 64% 54%)', 'hsl(46 92% 86%)'][Math.floor(random() * 3)],
  })) : [];
  const trees = Array.from({ length: 4 + Math.floor(random() * 3) }, (_, index) => ({
    x: 6 + ((index + random()) / 7) * 90,
    y: 79 + random() * 10,
    size: 4.5 + random() * 5.5,
  }));
  const bushes = Array.from({ length: 3 + Math.floor(random() * 3) }, () => ({
    x: 8 + random() * 84,
    y: 92 + random() * 7,
    r: 2.4 + random() * 2.6,
  }));
  const grass = Array.from({ length: 12 }, () => ({
    x: 2 + random() * 96,
    y: 94 + random() * 6,
    h: 1.6 + random() * 2.4,
  }));
  const stars = fun
    ? []
    : Array.from({ length: 10 + Math.floor(random() * 6) }, () => ({
        x: 4 + random() * 92,
        y: 3 + random() * 30,
        r: 0.4 + random() * 0.8,
        o: 0.35 + random() * 0.5,
      }));
  const notes = Array.from({ length: 5 + Math.floor(random() * 3) }, () => ({
    x: 10 + random() * 80,
    y: 22 + random() * 50,
    size: 3.4 + random() * 3.2,
    rotate: -16 + random() * 32,
    o: 0.55 + random() * 0.35,
    pair: random() > 0.55,
  }));
  return { skyTop, skyBottom, far, mid, near, water, sunX, sunY, sunR, hills, river, clouds, confetti, trees, bushes, grass, stars, notes, bunting: fun };
}

/** Нота вектором: головка, штиль и флажок. Никакого шрифта — значит, всегда
 *  нарисуется, даже там, где нет нотных глифов и эмодзи. */
function NoteShape({ x, y, size, rotate, opacity, pair, fill = 'hsl(42 46% 97%)' }: { x: number; y: number; size: number; rotate: number; opacity: number; pair: boolean; fill?: string }) {
  const head = size * 0.34;
  const stem = size * 0.95;
  const second = pair ? size * 0.78 : 0;
  return (
    <g transform={`rotate(${rotate.toFixed(1)} ${x} ${y})`} opacity={opacity} fill={fill}>
      <ellipse cx={x} cy={y} rx={head} ry={head * 0.72} transform={`rotate(-22 ${x} ${y})`} />
      <rect x={x + head * 0.62} y={y - stem} width={size * 0.13} height={stem} rx={size * 0.06} />
      <path d={`M${x + head * 0.75} ${y - stem} q ${size * 0.5} ${size * 0.22} ${size * 0.34} ${size * 0.72}`} stroke={fill} strokeWidth={size * 0.14} fill="none" strokeLinecap="round" />
      {pair && (
        <>
          <ellipse cx={x + second} cy={y + size * 0.16} rx={head} ry={head * 0.72} transform={`rotate(-22 ${x + second} ${y + size * 0.16})`} />
          <rect x={x + second + head * 0.62} y={y - stem + size * 0.16} width={size * 0.13} height={stem} rx={size * 0.06} />
          <rect x={x + head * 0.62} y={y - stem - size * 0.02} width={second + size * 0.13} height={size * 0.26} rx={size * 0.06} opacity="0.95" />
        </>
      )}
    </g>
  );
}

export function MusicArt({ track, id }: { track: MusicTrack; id: string }) {
  const scene = useMemo(() => musicScene(id, track.shelf), [id, track.shelf]);
  const ink = 'hsl(210 30% 16%)';
  const paper = 'hsl(42 46% 97%)';
  return (
    <div className="dc-face dc-art" data-scene={track.shelf}>
      <svg
        className="dc-art-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Иллюстрация к мелодии «${track.title}»: ${scene.bunting ? 'тёплый вечер' : 'тихое утро'}, холмы, вода и ноты`}
      >
        <defs>
          <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={scene.skyTop} />
            <stop offset="1" stopColor={scene.skyBottom} />
          </linearGradient>
          <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="hsl(46 96% 90%)" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="hsl(44 92% 82%)" stopOpacity="0.3" />
            <stop offset="1" stopColor={`hsl(44 92% 82%)`} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill={`url(#sky-${id})`} />
        {scene.stars.map((star, index) => (
          <circle key={`s${index}`} cx={star.x} cy={star.y} r={star.r} fill="hsl(48 90% 92%)" opacity={star.o} />
        ))}
        {scene.bunting &&
          Array.from({ length: 10 }, (_, index) => {
            const x = 3 + index * 10.4;
            const y = 8 + Math.sin((index / 9) * Math.PI) * 6;
            return <path key={`b${index}`} d={`M${x} ${y} L${x + 3.6} ${y + 5} L${x + 7.2} ${y} Z`} fill={index % 2 ? 'hsl(4 72% 62%)' : 'hsl(196 62% 52%)'} opacity="0.9" />;
          })}
        {scene.clouds.map((cloud, index) => (
          <g key={`c${index}`} fill={paper} opacity={cloud.o}>
            <ellipse cx={cloud.x} cy={cloud.y} rx={cloud.s} ry={cloud.s * 0.42} />
            <ellipse cx={cloud.x + cloud.s * 0.42} cy={cloud.y - cloud.s * 0.16} rx={cloud.s * 0.6} ry={cloud.s * 0.34} />
            <ellipse cx={cloud.x - cloud.s * 0.46} cy={cloud.y + cloud.s * 0.04} rx={cloud.s * 0.52} ry={cloud.s * 0.3} />
          </g>
        ))}
        <circle cx={scene.sunX} cy={scene.sunY} r={scene.sunR * 2.6} fill={`url(#glow-${id})`} />
        <circle cx={scene.sunX} cy={scene.sunY} r={scene.sunR} fill="hsl(46 96% 87%)" />
        {scene.confetti.map((dot, index) => (
          <circle key={`cf${index}`} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.c} opacity="0.78" />
        ))}
        {scene.notes.map((note, index) => (
          <NoteShape key={`n${index}`} x={note.x} y={note.y} size={note.size} rotate={note.rotate} opacity={note.o} pair={note.pair} />
        ))}
        <path d={scene.hills[0]} fill={scene.far} />
        <path d={scene.hills[1]} fill={scene.mid} />
        <path d={scene.hills[2]} fill={scene.near} />
        {/* Вода идёт к зрителю поверх переднего плана: ручей в «спокойных»,
            тёплая тропинка в «весёлых» — один изгиб, разный цвет. */}
        <path d={scene.river} fill={scene.water} opacity={scene.bunting ? 0.55 : 0.72} />
        {scene.trees.map((tree, index) => (
          <g key={`t${index}`}>
            <rect x={tree.x - 0.45} y={tree.y - 1.6} width="0.9" height="3.2" fill={ink} opacity="0.6" />
            <path
              d={`M${tree.x} ${tree.y - tree.size} L${tree.x + tree.size * 0.52} ${tree.y - 1.1} L${tree.x - tree.size * 0.52} ${tree.y - 1.1} Z`}
              fill={ink}
              opacity="0.78"
            />
          </g>
        ))}
        {scene.bushes.map((bush, index) => (
          <g key={`bs${index}`} fill={ink} opacity="0.68">
            <circle cx={bush.x} cy={bush.y} r={bush.r} />
            <circle cx={bush.x + bush.r * 0.9} cy={bush.y + bush.r * 0.2} r={bush.r * 0.72} />
            <circle cx={bush.x - bush.r * 0.85} cy={bush.y + bush.r * 0.24} r={bush.r * 0.6} />
          </g>
        ))}
        {scene.grass.map((blade, index) => (
          <path
            key={`g${index}`}
            d={`M${blade.x} ${blade.y} q ${blade.h * 0.6} ${-blade.h} ${blade.h * 1.5} ${-blade.h * 1.3}`}
            stroke={ink}
            strokeWidth="0.42"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
        ))}
        {/* Знак мелодии: нота вектором, а не эмодзи — шрифт с эмодзи есть не
            везде, а пустой кружок вместо символа выглядел бы браком. */}
        <circle cx={17} cy={83} r={9.6} fill={paper} opacity="0.97" />
        <circle cx={17} cy={83} r={9.6} fill="none" stroke="hsl(38 44% 74%)" strokeWidth="0.8" opacity="0.9" />
        <NoteShape x={14.4} y={86} size={7.4} rotate={-6} opacity={1} pair={true} fill="hsl(210 34% 22%)" />
      </svg>
      <span className="dc-art-imprint">Иллюстрация · {SHELF_LABEL[track.shelf]}</span>
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
  // У трека сторон три: лицо, иллюстрация и оборот. У набора звуков — две:
  // его «картинка» это партитура сигналов, отдельная иллюстрация ничего не
  // добавит к нотам.
  const sides: DigitalCoverSide[] = track ? ['front', 'art', 'back'] : ['front', 'back'];
  const sideIndex = Math.max(0, sides.indexOf(side));
  const face = side === 'front' ? front : side === 'art' && track ? <MusicArt track={track} id={id} /> : back;
  const faceLabel: Record<DigitalCoverSide, string> = {
    front: 'Лицевая сторона',
    art: 'Иллюстрация',
    back: 'Оборот',
  };

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

  const nextSide = sides[(sideIndex + 1) % sides.length];
  const next = `«${faceLabel[nextSide].toLowerCase()}»`;
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
          onClick={() => setSide(nextSide)}
          aria-label={`Обложка «${title}»: ${faceLabel[side].toLowerCase()}. Показать ${next}`}
          aria-pressed={side !== 'front'}
        >
          {face}
          {playing && side === 'front' && <span className="dc-eq"><i /><i /><i /></span>}
        </button>
      </div>
      <p className="dc-caption" aria-live="polite">
        <span>{faceLabel[side]}</span>
        <span>{sideIndex + 1} / {sides.length}</span>
      </p>
    </div>
  );
}
