/**
 * Раздел магазина «Звуки»: наборы коротких мелодий, которые играют при
 * правильном ответе и при ошибке.
 *
 * Почему синтез, а не файлы: мелодии длятся меньше секунды, их проще и
 * честнее собрать из нот прямо в браузере (Web Audio) — ноль веса, мгновенный
 * отклик без декодирования, работает офлайн и не требует лицензий: все мотивы
 * оригинальные. Здесь — только данные и правила (чистые функции, проверяются
 * без браузера); играет их platform/sound.ts.
 *
 * Педагогическое правило для «ошибки»: мелодия мягкая и короткая — это
 * сигнал «попробуй иначе», а не наказание. Никаких резких гудков и сирен,
 * громкость ниже, чем у мелодии правильного ответа (проверяется тестом).
 */

/** Тембр ноты: осцилляторы Web Audio и «колокольчик» с гармониками. */
export type SoundWave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'chime';

/** Одна нота мелодии: частота, начало и длительность в секундах, громкость. */
export interface SoundNote {
  freq: number;
  /** Сдвиг начала от момента ответа, с. */
  at: number;
  /** Длительность затухания, с. */
  dur: number;
  /** Пиковая громкость (0..1); до 0.2 — чтобы эффект не перекрикивал речь и музыку. */
  vol: number;
  wave: SoundWave;
  /** Плавный «съезд» частоты к концу ноты (космос, тромбон «вау-вау»). */
  glideTo?: number;
}

/** На что откликается набор. */
export type SoundCue = 'correct' | 'wrong';

export interface SoundPack {
  id: string;
  /** Название для ребёнка. */
  title: string;
  emoji: string;
  /** Короткая подпись на карточке. */
  desc: string;
  /** Одна строка для взрослых: как звучит и почему так. */
  about: string;
  /** Цена в кристаллах; 0 — доступен сразу. Покупка однократная. */
  price: number;
  correct: SoundNote[];
  wrong: SoundNote[];
}

/** Потолок цены набора: звуки — мелкая радость, дешевле самых дорогих мелодий. */
export const MAX_SOUND_PRICE = 15;
/** Ни одна мелодия отклика не длиннее этого: следующий вопрос не ждёт. */
export const MAX_CUE_SECONDS = 1.6;

const n = (freq: number, at: number, dur: number, vol: number, wave: SoundWave = 'sine', glideTo?: number): SoundNote =>
  glideTo === undefined ? { freq, at, dur, vol, wave } : { freq, at, dur, vol, wave, glideTo };

// Ноты (Гц), равномерная темперация, A4 = 440.
const F3 = 174.61, G3 = 196, A3 = 220, B3 = 246.94;
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392, A4 = 440;
const C5 = 523.25, E5 = 659.25, G5 = 783.99, B5 = 987.77;
const C6 = 1046.5, D6 = 1174.66, E6 = 1318.51, G6 = 1567.98;

/** Классика — звуки, которые были в приложении до раздела «Звуки». */
export const DEFAULT_SOUND_PACK = 'classic';

/**
 * Каталог. Первые два — стартовые (бесплатно), остальные открываются за
 * кристаллы. Порядок — порядок витрины.
 */
export const SOUND_PACKS: SoundPack[] = [
  {
    id: 'classic',
    title: 'Классика',
    emoji: '🔔',
    desc: 'Знакомые звуки СЛОВА',
    about: 'Звуки, с которыми приложение было с первого дня: мажорное арпеджио за верный ответ и короткое «ой» за ошибку.',
    price: 0,
    correct: [
      n(C5, 0, 0.28, 0.15), n(E5, 0.07, 0.28, 0.15), n(G5, 0.14, 0.28, 0.15), n(C6, 0.21, 0.28, 0.15),
      n(C6, 0.28, 0.4, 0.07, 'triangle'),
    ],
    wrong: [n(E4, 0, 0.2, 0.13, 'sawtooth'), n(C4, 0.14, 0.3, 0.1, 'sawtooth')],
  },
  {
    id: 'xylophone',
    title: 'Ксилофон',
    emoji: '🎼',
    desc: 'Деревянные молоточки',
    about: 'Короткие сухие удары, как по деревянным пластинкам: весёлая лесенка вверх и две тихие ноты вниз.',
    price: 0,
    correct: [
      n(G4, 0, 0.16, 0.16, 'triangle'), n(C5, 0.075, 0.16, 0.16, 'triangle'),
      n(E5, 0.15, 0.16, 0.16, 'triangle'), n(G5, 0.225, 0.32, 0.17, 'triangle'),
    ],
    wrong: [n(A4, 0, 0.16, 0.12, 'triangle'), n(F4, 0.13, 0.26, 0.1, 'triangle')],
  },
  {
    id: 'bells',
    title: 'Колокольчики',
    emoji: '✨',
    desc: 'Стеклянный перезвон',
    about: 'Звенящие колокольчики с мягкими обертонами: искристая гамма за верный ответ и тихий «динь-дон» за ошибку.',
    price: 8,
    correct: [
      n(G5, 0, 0.55, 0.09, 'chime'), n(B5, 0.08, 0.55, 0.09, 'chime'),
      n(D6, 0.16, 0.6, 0.09, 'chime'), n(G6, 0.26, 0.85, 0.08, 'chime'),
    ],
    wrong: [n(E5, 0, 0.5, 0.07, 'chime'), n(C5, 0.2, 0.7, 0.065, 'chime')],
  },
  {
    id: 'space',
    title: 'Космос',
    emoji: '🚀',
    desc: 'Ракета взлетает',
    about: 'Плавные «улетающие» звуки: ракета взмывает вверх за верный ответ и мягко опускается за ошибку.',
    price: 8,
    correct: [
      n(C5, 0, 0.32, 0.12, 'sine', C6), n(E5, 0.18, 0.4, 0.1, 'sine', E6),
      n(G6, 0.42, 0.45, 0.05, 'triangle'),
    ],
    wrong: [n(A4, 0, 0.5, 0.1, 'sine', D4)],
  },
  {
    id: 'arcade',
    title: 'Аркада',
    emoji: '👾',
    desc: 'Как в старой игре',
    about: 'Восьмибитные «пиксельные» звуки, как в ретро-играх: монетка за верный ответ и короткий «бульк» за ошибку. Громкость снижена — у квадратной волны резкий тембр.',
    price: 10,
    correct: [n(B5, 0, 0.09, 0.06, 'square'), n(E6, 0.08, 0.36, 0.06, 'square')],
    wrong: [n(D4, 0, 0.12, 0.045, 'square'), n(B3, 0.11, 0.12, 0.045, 'square'), n(G3, 0.22, 0.22, 0.04, 'square')],
  },
  {
    id: 'fanfare',
    title: 'Фанфары',
    emoji: '🎺',
    desc: 'Та-да! Как на параде',
    about: 'Торжественное «та-да» трубы за верный ответ и добродушное тромбонное «уа-уа» за ошибку — смешно, а не обидно.',
    price: 12,
    correct: [
      n(G4, 0, 0.12, 0.055, 'sawtooth'), n(G4, 0.13, 0.12, 0.055, 'sawtooth'),
      n(C5, 0.26, 0.55, 0.06, 'sawtooth'), n(E5, 0.26, 0.55, 0.04, 'triangle'), n(G5, 0.26, 0.6, 0.04, 'triangle'),
    ],
    wrong: [
      n(D4, 0, 0.3, 0.045, 'sawtooth', C4), n(B3, 0.3, 0.3, 0.045, 'sawtooth', A3),
      n(A3, 0.6, 0.5, 0.04, 'sawtooth', F3),
    ],
  },
];

export const SOUND_PACK_BY_ID: Record<string, SoundPack> = Object.fromEntries(SOUND_PACKS.map((p) => [p.id, p]));

/** Стартовые наборы: бесплатны и есть у каждого профиля. */
export const STARTER_SOUND_IDS: string[] = SOUND_PACKS.filter((p) => p.price === 0).map((p) => p.id);

/** Длительность мелодии в секундах: конец самой поздней ноты. */
export function cueSeconds(notes: SoundNote[]): number {
  return notes.reduce((max, note) => Math.max(max, note.at + note.dur), 0);
}

/** Мелодия набора для отклика; незнакомый id — классика. */
export function cueOf(packId: string | null | undefined, cue: SoundCue): SoundNote[] {
  const pack = (packId && SOUND_PACK_BY_ID[packId]) || SOUND_PACK_BY_ID[DEFAULT_SOUND_PACK];
  return pack[cue];
}

export function canBuySoundPack(pack: SoundPack, gems: number, owned: string[]): boolean {
  return !owned.includes(pack.id) && gems >= pack.price;
}

export interface SoundShopSelection {
  soundOwned: string[];
  soundPack: string;
}

/**
 * Нормализация раздела «Звуки» в профиле: профили до 0.17.0 поля не имеют —
 * получают стартовые наборы и классику (звучание для них не меняется).
 * Чужие id отбрасываются, выбранный набор обязан быть открыт.
 */
export function normalizeSoundShop(raw: { soundOwned?: unknown; soundPack?: unknown } | null | undefined): SoundShopSelection {
  const owned: string[] = [...STARTER_SOUND_IDS];
  if (Array.isArray(raw?.soundOwned)) {
    for (const id of raw.soundOwned) {
      if (typeof id === 'string' && SOUND_PACK_BY_ID[id] && !owned.includes(id)) owned.push(id);
    }
  }
  const picked = raw?.soundPack;
  const soundPack = typeof picked === 'string' && owned.includes(picked) ? picked : DEFAULT_SOUND_PACK;
  return { soundOwned: owned, soundPack };
}
