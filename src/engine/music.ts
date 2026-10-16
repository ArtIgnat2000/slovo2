/** Оригинальные короткие синтезированные лупы: без внешних файлов и без лицензированных песен. */

/**
 * Вайб аранжировки — влияет на ударные, бас и тембр. Первые шесть — базовый
 * каталог (0.12.3), последние шесть — полка «Тренд 2026» (0.13.0): жанры,
 * которые дети 7–10 лет узнают как «свои». Ритмические рисунки и тембры
 * описаны таблицей в platform/music.ts (GROOVES) — своих мелодий там нет,
 * только правила аранжировки, а ноты берутся из `scale` трека.
 */
export type Groove =
  | 'pop' | 'lofi' | 'arcade' | 'dance' | 'tropical' | 'cinematic'
  | 'bounce' | 'duck' | 'kpop' | 'phonk' | 'punk' | 'ethno';

/** Полка в витрине магазина: базовая коллекция или «Тренд 2026». */
export type MusicShelf = 'core' | 'trend';

/**
 * Где сейчас звучит трек. Музыка принадлежит ребёнку везде, но в уроке она
 * обязана быть фоном: быстрый бит во время подбора буквы мешает (музыка со
 * словами и высокая энергия ухудшают вербальные задачи — см. разбор в
 * docs/music-trends-2026.md, §3.7). Поэтому один трек имеет два состояния.
 */
export type MusicContext = 'lesson' | 'reward';

export interface MusicTrack {
  id: string;
  title: string;
  style: string;
  emoji: string;
  bpm: number;
  price: number;
  /** Тональность/набор нот в MIDI-номерах. */
  scale: number[];
  groove: Groove;
  /** Полка витрины; нет поля — базовая коллекция. */
  shelf?: MusicShelf;
  /** Короткая плашка на карточке («Тренд»). */
  tag?: string;
  /** Одна строка для взрослых: на каком тренде основан трек и чего в нём нет. */
  about?: string;
}

export const STARTER_TRACK_IDS = ['sunny-start', 'pixel-party'];

/** Базовая коллекция (0.12.3): порядок не меняем — на него смотрят проверки. */
const CORE_TRACKS: MusicTrack[] = [
  { id: 'sunny-start', title: 'Солнечный старт', style: 'Лёгкий поп', emoji: '🌈', bpm: 104, price: 0, scale: [0, 2, 4, 7, 9], groove: 'pop' },
  { id: 'pixel-party', title: 'Пиксельная вечеринка', style: 'Аркадный чиптюн', emoji: '👾', bpm: 126, price: 0, scale: [0, 3, 5, 7, 10], groove: 'arcade' },
  { id: 'neon-sneakers', title: 'Неоновые кеды', style: 'Электропоп', emoji: '💜', bpm: 120, price: 8, scale: [0, 2, 4, 7, 9], groove: 'dance' },
  { id: 'cloud-lofi', title: 'Облачный лоу-фай', style: 'Мягкий бит', emoji: '☁️', bpm: 78, price: 8, scale: [0, 2, 3, 7, 9], groove: 'lofi' },
  { id: 'jungle-hop', title: 'Прыжок в джунгли', style: 'Тропический грув', emoji: '🦜', bpm: 112, price: 10, scale: [0, 2, 5, 7, 9], groove: 'tropical' },
  { id: 'starlight', title: 'Звёздный полёт', style: 'Космический синтвейв', emoji: '🚀', bpm: 96, price: 10, scale: [0, 2, 4, 7, 11], groove: 'cinematic' },
  { id: 'bubblegum', title: 'Жвачка-бум', style: 'Весёлый денс-поп', emoji: '🍬', bpm: 132, price: 12, scale: [0, 2, 4, 7, 9], groove: 'dance' },
  { id: 'rainbow-disco', title: 'Радужная дискотека', style: 'Диско-бит', emoji: '🪩', bpm: 118, price: 12, scale: [0, 2, 5, 7, 9], groove: 'pop' },
  { id: 'robot-boogie', title: 'Робо-буги', style: 'Фанковый робот-бит', emoji: '🤖', bpm: 110, price: 14, scale: [0, 3, 5, 7, 10], groove: 'arcade' },
  { id: 'moon-marsh', title: 'Лунное болото', style: 'Мечтательный лоу-фай', emoji: '🌙', bpm: 84, price: 14, scale: [0, 2, 3, 7, 10], groove: 'lofi' },
  { id: 'turbo-comet', title: 'Турбо-комета', style: 'Скоростной бит', emoji: '☄️', bpm: 144, price: 16, scale: [0, 2, 4, 7, 9], groove: 'dance' },
  { id: 'underwater', title: 'Подводный танец', style: 'Морское приключение', emoji: '🐠', bpm: 100, price: 16, scale: [0, 2, 5, 7, 10], groove: 'tropical' },
  { id: 'magic-forest', title: 'Волшебный лес', style: 'Сказочная мелодия', emoji: '🧚', bpm: 90, price: 18, scale: [0, 2, 4, 7, 11], groove: 'cinematic' },
  { id: 'supernova', title: 'Супернова', style: 'Большой поп-бит', emoji: '✨', bpm: 128, price: 20, scale: [0, 2, 4, 7, 9], groove: 'dance' },
];

/**
 * Полка «Тренд 2026» — шесть оригинальных лупов на жанрах, которые сейчас
 * узнаёт ребёнок 7–10 лет. Из тренда взяты только жанр, темп, ритмический
 * рисунок и настроение: ни чужих мелодий, ни текстов, ни названий песен,
 * ни имён артистов (правила — docs/music-trends-2026.md, §4).
 */
export const TREND_TRACKS: MusicTrack[] = [
  {
    id: 'six-seven', title: 'Шесть-семь', style: 'Мем-баунс', emoji: '6️⃣', bpm: 140, price: 14,
    scale: [0, 2, 3, 5, 7, 8, 10], groove: 'bounce', shelf: 'trend', tag: 'Тренд',
    about: 'Числа 6 и 7 как главный мем школьников: крюк — шестая и седьмая ступень лада. Своя мелодия, без цитат.',
  },
  {
    id: 'duck-dance', title: 'Утята', style: 'Танец утят 2026', emoji: '🦆', bpm: 124, price: 12,
    scale: [0, 2, 4, 7, 9], groove: 'duck', shelf: 'trend', tag: 'Тренд',
    about: 'Простой танец руками из подростковых мемов 2026 года. Свинг, хлопок и «волна» из двух нот.',
  },
  {
    id: 'golden-stage', title: 'Золотая сцена', style: 'K-pop гимн', emoji: '🏆', bpm: 100, price: 18,
    scale: [0, 2, 4, 7, 11], groove: 'kpop', shelf: 'trend', tag: 'Тренд',
    about: 'Гимн-подъём в духе анимационных K-pop хитов: два такта накапливают энергию, два — звучат целиком.',
  },
  {
    id: 'school-phonk', title: 'Фонк на переменке', style: 'Школьный фонк', emoji: '🐮', bpm: 132, price: 16,
    scale: [0, 3, 5, 7, 10], groove: 'phonk', shelf: 'trend', tag: 'Тренд',
    about: '«Фонк» — слово, которым дети называют всё дерзкое. Ковбелл и скользящий бас; в уроке звучит тихо и медленно.',
  },
  {
    id: 'campfire-punk', title: 'Сказка у костра', style: 'Сказочный панк', emoji: '🔥', bpm: 168, price: 18,
    scale: [0, 2, 3, 5, 7, 8, 10], groove: 'punk', shelf: 'trend', tag: 'Тренд',
    about: 'Быстрая минорная сказка — рок-истории остаются у школьников в числе любимых. Самый бодрый трек каталога.',
  },
  {
    id: 'firebird', title: 'Жар-птица', style: 'Этно-электроника', emoji: '🪶', bpm: 118, price: 20,
    scale: [0, 2, 3, 5, 7, 8, 11], groove: 'ethno', shelf: 'trend', tag: 'Тренд',
    about: 'Народный лад, дрон и форшлаги поверх танцевального бита: современная электроника с «нашим» мелодизмом.',
  },
];

export const MUSIC_TRACKS: MusicTrack[] = [...CORE_TRACKS, ...TREND_TRACKS];

export const MUSIC_BY_ID: Record<string, MusicTrack> = Object.fromEntries(MUSIC_TRACKS.map((track) => [track.id, track]));

export function normalizeMusicOwned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...STARTER_TRACK_IDS];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && Boolean(MUSIC_BY_ID[id])))];
}

export function canBuyTrack(track: MusicTrack, gems: number, owned: string[]): boolean {
  return !owned.includes(track.id) && gems >= track.price;
}

/** Треки полки «Тренд 2026» — витрина показывает их отдельной полкой. */
export function tracksByShelf(shelf: MusicShelf): MusicTrack[] {
  return MUSIC_TRACKS.filter((track) => (track.shelf ?? 'core') === shelf);
}

// ── Контекстная музыка ──────────────────────────────────────────────────────
//
// Один трек — два состояния. В уроке (ребёнок читает слово и подбирает буквы)
// музыка обязана быть фоном: темп не выше LESSON_BPM_CAP, перкуссия тихая,
// яркие тембры (хэт, хлопок, ковбелл) выключены, фильтр прикрыт. На награде
// (сундук, «урок пройден») трек возвращается к полному груву — именно там
// ребёнок получает «свой» трендовый звук. Правила вынесены сюда как чистая
// функция: их можно проверить без браузера и не потерять при правке синтеза.

/** Потолок темпа в уроке: выше него бит начинает тянуть внимание на себя. */
export const LESSON_BPM_CAP = 90;

export interface PlaybackState {
  /** Темп лупа. */
  bpm: number;
  /** Громкость ударных относительно полной (1). */
  drums: number;
  /** Играть ли яркие тембры: хай-хэт, хлопок, ковбелл. */
  bright: boolean;
  /** Срез фильтра в герцах; 0 — оставить как задумано грувом. */
  cutoff: number;
  /** Громкость мелодии относительно полной (1). */
  lead: number;
}

const REWARD: PlaybackState = { bpm: -1, drums: 1, bright: true, cutoff: 0, lead: 1 };

/** Как трек звучит в данном контексте. Чистая функция — проверяется в тестах. */
export function playbackFor(track: MusicTrack, context: MusicContext): PlaybackState {
  if (context === 'reward') return { ...REWARD, bpm: track.bpm };
  return {
    bpm: Math.min(track.bpm, LESSON_BPM_CAP),
    drums: 0.35,
    bright: false,
    cutoff: 2000,
    lead: 0.8,
  };
}

/**
 * Потолок цены одиночного трека: ≈1 день занятий (доход ≈24 💎 в день).
 * Держит экономику магазина: тренд не должен становиться недостижимым.
 */
export const MAX_TRACK_PRICE = 24;
