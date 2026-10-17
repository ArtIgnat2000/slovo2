/**
 * Каталог фоновой музыки: профессиональные записи Kevin MacLeod (incompetech.com).
 *
 * Правила каталога (0.14.0 — замена синтезатора на настоящие записи):
 *  • единственный источник аудио — официальный сайт автора, страницы треков
 *    (см. sourceUrl); файлы лежат локально в public/audio/ и играют офлайн;
 *  • лицензия каждого трека записана по его официальной странице (сегодня у
 *    всех двенадцати это CC BY 4.0, но поле license у каждого своё — при
 *    замене трека не полагаться на «обычно у автора 4.0»);
 *  • покупка трека за кристаллы однократная и не даёт ребёнку исключительных
 *    прав: это открытие мелодии внутри игры, а аудио остаётся под CC BY;
 *  • изменения аудио (если делались) помечены в `modified` — требование CC BY
 *    обозначать изменения.
 *
 * Звуковые эффекты (platform/sound.ts) — отдельная история, их эта замена не
 * касается: они синтезируются на месте и остаются как были.
 */

/** Полка витрины: спокойный фон занятий или весёлая коллекция/награды. */
export type MusicShelf = 'calm' | 'fun';

/**
 * Где сейчас звучит музыка. В уроке (ребёнок читает и пишет) музыка обязана
 * быть фоном: файл нельзя «замедлить» без смены тона, поэтому контекст
 * задаёт громкость, а не аранжировку (см. playbackFor).
 */
export type MusicContext = 'lesson' | 'reward';

/** Один трек фоновой музыки — профессиональная запись с официальной лицензией. */
export interface MusicTrack {
  /** id совпадает с именем файла: `public/audio/<id>.mp3`. */
  id: string;
  /** Название для ребёнка (в магазине и коллекции). */
  title: string;
  /** Оригинальное название записи — как в источнике и в тексте атрибуции. */
  originalTitle: string;
  /** Автор записи. */
  artist: 'Kevin MacLeod';
  emoji: string;
  /** Цена в кристаллах; 0 — доступен сразу. Покупка однократная. */
  price: number;
  /** Официальная страница трека: источник аудио и точный текст лицензии. */
  sourceUrl: string;
  /** ISRC записи — как на официальной странице. */
  isrc: string;
  /** Точная лицензия по официальной странице трека. */
  license: string;
  /** Ссылка на текст лицензии. */
  licenseUrl: string;
  /**
   * Отметка об изменениях аудио (требование CC BY). `null` — файл без изменений;
   * иначе коротко: что именно сделано.
   */
  modified: string | null;
  /** Длительность записи в секундах (по официальной странице). */
  seconds: number;
  /** Авторский темп — только для карточки; файл играет как записан. */
  bpm: number;
  shelf: MusicShelf;
  /** Короткая плашка на карточке. */
  tag?: string;
  /** Одна строка для взрослых: что за запись и как она звучит в игре. */
  about: string;
}

/** Лицензия и её текст на сегодня одинаковы у всех двенадцати — но проверено постранично. */
const CC_BY_4 = 'Creative Commons «Attribution» 4.0 (CC BY 4.0)';
const CC_BY_4_URL = 'https://creativecommons.org/licenses/by/4.0/';

/** Страница трека на официальном сайте автора. */
const page = (isrc: string) => `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`;

/** Две мелодии доступны сразу: спокойный фон занятий и приветливое меню. */
export const STARTER_TRACK_IDS = ['carefree', 'easy-lemon'];

/**
 * Каталог 0.14.0. Порядок важен: первые шесть — «Спокойный фон» (занятия,
 * меню), последние шесть — «Коллекция и награды». Проверки витрины смотрят
 * на индекс 2 и на полки. Цены соотнесены с экономикой (доход ≈ 24 💎/день,
 * потолок цены — MAX_TRACK_PRICE): короткие «наградные» треки дешевле,
 * длинные спокойные дороже.
 */
const CATALOG: MusicTrack[] = [
  {
    id: 'carefree', title: 'Беззаботный день', originalTitle: 'Carefree', artist: 'Kevin MacLeod', emoji: '☀️',
    price: 0, isrc: 'USUAN1400037', sourceUrl: page('USUAN1400037'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 205, bpm: 96,
    shelf: 'calm', tag: 'Меню',
    about: '«Carefree» — яркая укулеле-мелодия: приветливый фон главного экрана, с которым начинается игра.',
  },
  {
    id: 'life-of-riley', title: 'Счастливые деньки', originalTitle: 'Life of Riley', artist: 'Kevin MacLeod', emoji: '🌈',
    price: 14, isrc: 'USUAN1400054', sourceUrl: page('USUAN1400054'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 235, bpm: 102,
    shelf: 'calm',
    about: 'Колокольчики, укулеле и гитара: ровное светлое настроение без резких акцентов — подходит и для занятий.',
  },
  {
    id: 'easy-lemon', title: 'Лимончик', originalTitle: 'Easy Lemon', artist: 'Kevin MacLeod', emoji: '🍋',
    price: 0, isrc: 'USUAN1200076', sourceUrl: page('USUAN1200076'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 126, bpm: 82,
    shelf: 'calm', tag: 'Для урока',
    about: '«Easy Lemon» — самый спокойный трек каталога (82 BPM): автор писал его как фон, который не мешает голосу и письму.',
  },
  {
    id: 'wholesome', title: 'Тёплый дом', originalTitle: 'Wholesome', artist: 'Kevin MacLeod', emoji: '🏡',
    price: 20, isrc: 'USUAN1900022', sourceUrl: page('USUAN1900022'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 364, bpm: 128,
    shelf: 'calm',
    about: 'Виолончель, альт и маримба без ударных — длинная тёплая запись для тех, кому нужен «домашний» фон.',
  },
  {
    id: 'wallpaper', title: 'Тихий ритм', originalTitle: 'Wallpaper', artist: 'Kevin MacLeod', emoji: '🖼️',
    price: 14, isrc: 'USUAN1100843', sourceUrl: page('USUAN1100843'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 220, bpm: 92,
    shelf: 'calm',
    about: 'Чистый «обояный» микс без акцентов (так автор и описывает запись): фон, к которому быстро привыкаешь и не отвлекаешься.',
  },
  {
    id: 'daily-beetle', title: 'Весёлый жук', originalTitle: 'Daily Beetle', artist: 'Kevin MacLeod', emoji: '🪲',
    price: 18, isrc: 'USUAN1500025', sourceUrl: page('USUAN1500025'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 317, bpm: 100,
    shelf: 'calm',
    about: 'Укулеле, маримба и музыкальная шкатулка: спокойный, но задорный ритм — хороший фон на повторении.',
  },
  {
    id: 'monkeys-spinning-monkeys', title: 'Обезьянки', originalTitle: 'Monkeys Spinning Monkeys', artist: 'Kevin MacLeod', emoji: '🐒',
    price: 12, isrc: 'USUAN1400011', sourceUrl: page('USUAN1400011'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 125, bpm: 144,
    shelf: 'fun', tag: 'Награда',
    about: 'Флейты и пиццикато: самая «мультяшная» запись каталога — звучит после уроков, когда можно повеселиться.',
  },
  {
    id: 'sneaky-snitch', title: 'Шаг на цыпочках', originalTitle: 'Sneaky Snitch', artist: 'Kevin MacLeod', emoji: '🕵️',
    price: 12, isrc: 'USUAN1100772', sourceUrl: page('USUAN1100772'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 137, bpm: 87,
    shelf: 'fun',
    about: 'Гобой, струнные и малый барабан «на цыпочках»: озорная запись про тайный заговор — любимец юных детективов.',
  },
  {
    id: 'fluffing-a-duck', title: 'Утёнок', originalTitle: 'Fluffing a Duck', artist: 'Kevin MacLeod', emoji: '🦆',
    price: 10, isrc: 'USUAN1100768', sourceUrl: page('USUAN1100768'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 67, bpm: 122,
    shelf: 'fun',
    about: 'Короткая смешная пьеса с тромбоном и духыми (в файле две маленькие части) — щедрая музыкальная «шутка».',
  },
  {
    id: 'happy-alley', title: 'Весёлый переулок', originalTitle: 'Happy Alley', artist: 'Kevin MacLeod', emoji: '🌟',
    price: 8, isrc: 'USUAN1100482', sourceUrl: page('USUAN1100482'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 80, bpm: 112,
    shelf: 'fun',
    about: 'Акустическая гитара, бас и барабаны: задорный переулок с неожиданным бриджем — самый доступный трек коллекции.',
  },
  {
    id: 'cheery-monday', title: 'Добрый понедельник', originalTitle: 'Cheery Monday', artist: 'Kevin MacLeod', emoji: '😊',
    price: 8, isrc: 'USUAN1700065', sourceUrl: page('USUAN1700065'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 80, bpm: 102,
    shelf: 'fun',
    about: 'Простая «пятидесятническая» пьеса с хлопками, фортепиано и колокольчиком: короткая и добрая, как первый день недели.',
  },
  {
    id: 'pixelland', title: 'Пикселяндия', originalTitle: 'Pixelland', artist: 'Kevin MacLeod', emoji: '🕹️',
    price: 16, isrc: 'USUAN1500076', sourceUrl: page('USUAN1500076'),
    license: CC_BY_4, licenseUrl: CC_BY_4_URL, modified: null, seconds: 234, bpm: 230,
    shelf: 'fun', tag: 'Награда',
    about: '8-битный синтезатор встречает диксиленд: самый быстрый трек каталога (230 BPM) — только для наград, не для письма.',
  },
];

export const MUSIC_TRACKS: MusicTrack[] = CATALOG;

export const MUSIC_BY_ID: Record<string, MusicTrack> = Object.fromEntries(MUSIC_TRACKS.map((t) => [t.id, t]));

/** id трека = имя файла в public/audio/ (без расширения). */
export const audioFileOf = (track: MusicTrack): string => `audio/${track.id}.mp3`;

/**
 * Потолок цены одиночного трека: ≈1 день занятий (доход ≈24 💎 в день).
 * Держит экономику магазина: коллекция не должна становиться недостижимой.
 */
export const MAX_TRACK_PRICE = 24;

/** Треки полки — витрина показывает их отдельными полками. */
export function tracksByShelf(shelf: MusicShelf): MusicTrack[] {
  return MUSIC_TRACKS.filter((t) => t.shelf === shelf);
}

export function canBuyTrack(track: MusicTrack, gems: number, owned: string[]): boolean {
  return !owned.includes(track.id) && gems >= track.price;
}

// ── Миграция профилей с синтезатора (до 0.14.0) ──────────────────────────────
//
// До 0.14.0 музыка рождалась кодом: каталог «Оригинальные лупы» с id вроде
// guitar-morning. Замена каталога не должна отбирать покупки ребёнка, поэтому
// каждая купленная старая мелодия даёт одну новую из платной части каталога
// (по порядку), а выбранный фон получает «преемника» по тому же правилу.
// Списки детерминированные: повторная нормализация ничего не пересчитывает
// (idempotent), прогресс, кристаллы и весь остальной профиль не трогаются.

/** id синтезатора 0.13.0 в порядке старого каталога (бесплатные — первыми). */
export const LEGACY_TRACK_IDS = [
  'guitar-morning', 'forest-dawn',
  'ukulele-sun', 'kalimba-river', 'panflute-meadow', 'bossa-yard', 'folk-dance', 'strings-story',
  'blues-harp', 'marimba-garden', 'letter-piano', 'sea-waves', 'rain-roof', 'night-crickets',
  'six-seven', 'duck-dance', 'golden-stage', 'school-phonk', 'campfire-punk', 'firebird',
];

const LEGACY_STARTER_IDS = LEGACY_TRACK_IDS.slice(0, 2);
const LEGACY_PAID_IDS = LEGACY_TRACK_IDS.slice(2);
const LEGACY_SET = new Set(LEGACY_TRACK_IDS);

/** Платная часть нового каталога в порядке списка — «преемники» старых покупок. */
const PAID_TRACK_IDS = MUSIC_TRACKS.filter((t) => t.price > 0).map((t) => t.id);

export interface MusicShopSelection {
  musicOwned: string[];
  musicTrack: string | null;
}

/**
 * Нормализует (и мигрирует) музыкальную часть магазина:
 *  • неизвестные id отбрасываются, бесплатный старт выдаётся тем, у кого поля
 *    ещё нет (профили до магазина и новые);
 *  • каждая купленная старая мелодия даёт одну новую (первые N платных),
 *    выбранный старый фон — «преемника» по позиции в списке;
 *  • явный «Тишина» (null) сохраняется: выбор ребёнка не перетирается.
 *
 * Функция чистая и идемпотентна: её можно звать на каждом чтении профиля.
 */
export function migrateMusicShop(raw: { musicOwned?: unknown; musicTrack?: unknown } | null | undefined): MusicShopSelection {
  const listed = Array.isArray(raw?.musicOwned)
    ? raw.musicOwned.filter((id): id is string => typeof id === 'string')
    : null;

  const owned: string[] = [];
  const push = (id: string) => {
    if (MUSIC_BY_ID[id] && !owned.includes(id)) owned.push(id);
  };

  // Старые id в порядке СПИСКА профиля: ребёнок получает столько же новых,
  // сколько было куплено, а выбранный трек находит «преемника» по позиции.
  const legacyListed = (listed ?? []).filter((id) => LEGACY_SET.has(id));
  const legacyPaid = legacyListed.filter((id) => LEGACY_PAID_IDS.includes(id));
  const granted = PAID_TRACK_IDS.slice(0, Math.min(legacyPaid.length, PAID_TRACK_IDS.length));
  const successorOf = new Map<string, string>();
  legacyListed.forEach((id) => {
    const starterIdx = LEGACY_STARTER_IDS.indexOf(id);
    if (starterIdx >= 0) {
      successorOf.set(id, STARTER_TRACK_IDS[Math.min(starterIdx, STARTER_TRACK_IDS.length - 1)]);
      return;
    }
    const paidIdx = legacyPaid.indexOf(id);
    if (paidIdx >= 0 && granted[paidIdx]) successorOf.set(id, granted[paidIdx]);
  });

  if (listed) {
    STARTER_TRACK_IDS.forEach(push);
    granted.forEach(push);
    listed.forEach(push);
  } else {
    STARTER_TRACK_IDS.forEach(push);
  }

  let track: string | null;
  const picked = raw?.musicTrack;
  if (picked === null) track = null;
  else if (typeof picked === 'string' && MUSIC_BY_ID[picked] && owned.includes(picked)) track = picked;
  else if (typeof picked === 'string' && successorOf.has(picked)) track = successorOf.get(picked) ?? null;
  else if (picked === undefined) track = owned[0] ?? null;
  else track = null;

  return { musicOwned: owned, musicTrack: track && owned.includes(track) ? track : null };
}

// ── Контекстная музыка ──────────────────────────────────────────────────────
//
// Один трек — два состояния. В уроке музыка обязана быть фоном: файл нельзя
// замедлить без смены тона, поэтому «урок» = умеренная громкость. На награде
// (сундук, «урок пройден», меню) трек звучит в полную силу настроек.
// Правила — чистая функция: проверяются без браузера.

/** Множитель громкости в уроке: музыка не должна мешать разбору слова и письму. */
export const LESSON_VOLUME = 0.5;

export interface PlaybackState {
  /** Множитель громкости в этом контексте (0..1). */
  volume: number;
}

/** Громкость контекста: правило живёт здесь, плеер его только применяет. */
export function contextVolume(context: MusicContext): number {
  return context === 'lesson' ? LESSON_VOLUME : 1;
}

/** Как трек звучит в данном контексте. */
export function playbackFor(_track: MusicTrack, context: MusicContext): PlaybackState {
  return { volume: contextVolume(context) };
}
