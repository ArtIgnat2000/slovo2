/** Оригинальные короткие синтезированные лупы: без внешних файлов и без лицензированных песен. */

/**
 * Вайб аранжировки — влияет на ударные, бас и тембр. Первые шесть — базовый
 * каталог (0.12.3), последние шесть — полка «Тренд 2026» (0.13.0): жанры,
 * которые дети 7–10 лет узнают как «свои». Ритмические рисунки и тембры
 * описаны таблицей в platform/music.ts (GROOVES) — своих мелодий там нет,
 * только правила аранжировки, а ноты берутся из `scale` трека.
 */
export type Groove =
  | 'bounce' | 'duck' | 'kpop' | 'phonk' | 'punk' | 'ethno'
  // База 0.13.0 — «живая»: акустика и природа вместо электроники 0.12.3.
  | 'fingerstyle' | 'strum' | 'kalimba' | 'meadow' | 'bossa' | 'folk'
  | 'stringsstory' | 'blues' | 'marimba' | 'classical'
  | 'birdscape' | 'wavescape' | 'rainscape' | 'nightscape'
  // Лаборатория и будущие волны: рисунки живут снаружи (registerGrooves),
  // а тип разрешает каталогу расти без правок движка.
  | 'pop' | 'lofi' | 'arcade' | 'dance' | 'tropical' | 'cinematic'
  | 'house' | 'postpunk' | 'tarantella' | 'funkbr' | 'twostep' | 'hardstyle'
  | 'pulse60' | 'lofirain' | 'ambient' | 'musicbox' | 'bellpop';

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
  /** Темп в уроке, если авторский отличается (рэгтайм награды — тихое письмо в уроке). */
  lessonBpm?: number;
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

export const STARTER_TRACK_IDS = ['guitar-morning', 'forest-dawn'];

/**
 * Базовая коллекция 0.13.0 — «живая»: акустические инструменты и чистые
 * саундскейпы природы вместо электроники 0.12.3. Гитара и струнные — модель
 * Карплуса-Стронга и wavetable-ансамбли, калимба/маримба — FM с негармоническим
 * рядом, птицы, волны, дождь и сверчки — синтезированный шум с огибающими.
 * Порядок важен: на индекс 2 смотрят проверки витрины.
 */
const CORE_TRACKS: MusicTrack[] = [
  { id: 'guitar-morning', title: 'Утро с гитарой', style: 'Свинг-дуэт', emoji: '🎸', bpm: 112, price: 0, scale: [0, 2, 4, 7, 9], groove: 'fingerstyle', about: 'Две гитары в духе джипси-свинга играют традиционный спиричуэл «When the Saints» (общественное достояние): ла-помпе, шагающий бас, колл-респонс.' },
  { id: 'forest-dawn', title: 'Лес на рассвете', style: 'Саундскейп', emoji: '🌅', bpm: 60, price: 0, scale: [0, 2, 4, 7, 9], groove: 'birdscape', tag: 'Природа', about: 'Только природа: птицы, ветер и ручей. Без музыки и без ударных — можно писать слова.' },
  { id: 'ukulele-sun', title: 'Укулеле на солнце', style: 'Акустик-поп', emoji: '🌻', bpm: 108, price: 8, scale: [0, 2, 4, 7, 9], groove: 'strum', about: 'Бой укулеле, кахон и шейкер: солнечный акустик-поп без синтетики.' },
  { id: 'kalimba-river', title: 'Калимба у реки', style: 'Калимба', emoji: '🪘', bpm: 100, price: 10, scale: [0, 2, 4, 7, 9], groove: 'kalimba', about: 'Калимба (FM с негармоническим рядом) поверх тихого ручья.' },
  { id: 'panflute-meadow', title: 'Флейта на лугу', style: 'Пан-флейта', emoji: '🌾', bpm: 90, price: 12, scale: [0, 2, 4, 7, 9], groove: 'meadow', about: 'Пан-флейта с дыханием, гитарные арпеджио и птицы на лугу.' },
  { id: 'bossa-yard', title: 'Босса во дворе', style: 'Босса-минор', emoji: '🍃', bpm: 96, price: 14, scale: [0, 2, 4, 7, 9], groove: 'bossa', about: '«House of the Rising Sun» (традиционный фолк-блюз, общественное достояние) в минорной босса-нове: нейлон, синкопа, тёплый бас.' },
  { id: 'folk-dance', title: 'Плясовая', style: 'Диксиленд-рил', emoji: '🪗', bpm: 126, price: 14, scale: [0, 2, 3, 5, 7, 8, 10], groove: 'folk', about: '«Little Liza Jane» (традиционная, общественное достояние): балалайка встречает диксиленд — рил, припев-отклик, помпе и шагающий бас.' },
  { id: 'strings-story', title: 'Сказка со струнными', style: 'Струнная баллада', emoji: '🎻', bpm: 80, price: 16, scale: [0, 2, 4, 7, 11], groove: 'stringsstory', about: '«In the Pines» (традиционный аппалачский блюз, общественное достояние): струнный ансамбль ведёт плач, минор дышит пэдами.' },
  { id: 'blues-harp', title: 'Гармоника на станции', style: 'Блюз-дуэт', emoji: '🚂', bpm: 92, price: 14, scale: [0, 3, 5, 7, 10], groove: 'blues', about: '12 тактов с темой в идиоме «C.C. Rider» (традиционный фолк-блюз, общественное достояние): гармоника, шагающий контрабас, чоп-аккорды.' },
  { id: 'marimba-garden', title: 'Маримба в саду', style: 'Маримба', emoji: '🌺', bpm: 104, price: 12, scale: [0, 2, 5, 7, 9], groove: 'marimba', about: 'Деревянные пластинки маримбы и конги: сад, полдень, ничто не мешает.' },
  { id: 'letter-piano', title: 'Рояль для письма', style: 'Рэгтайм', emoji: '✉️', bpm: 104, lessonBpm: 72, price: 12, scale: [0, 2, 4, 7, 9], groove: 'classical', about: '«The Entertainer» Скотта Джоплина (1902, общественное достояние) на страйд-рояле: бас на 1 и 3, аккорд на 2 и 4. Письму не мешает — проверено.' },
  { id: 'sea-waves', title: 'Морской прибой', style: 'Саундскейп', emoji: '🌊', bpm: 60, price: 10, scale: [0, 2, 4, 7, 9], groove: 'wavescape', tag: 'Природа', about: 'Только море: волны, ветер и редкие чайки. Ровный фон для урока и сна.' },
  { id: 'rain-roof', title: 'Дождь на крыше', style: 'Саундскейп', emoji: '☔', bpm: 64, price: 10, scale: [0, 2, 3, 7, 9], groove: 'rainscape', tag: 'Природа', about: 'Только дождь: ровный шум, капли и далёкий гром раз в круг.' },
  { id: 'night-crickets', title: 'Ночь у костра', style: 'Саундскейп', emoji: '🌙', bpm: 56, price: 12, scale: [0, 2, 4, 7, 9], groove: 'nightscape', tag: 'Природа', about: 'Только ночь: сверчки, ветер и сова. Самый тихий трек каталога.' },
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
    bpm: Math.min(track.lessonBpm ?? track.bpm, LESSON_BPM_CAP),
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
