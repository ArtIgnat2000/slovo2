/** Оригинальные короткие синтезированные лупы: без внешних файлов и без лицензированных песен. */
export interface MusicTrack {
  id: string;
  title: string;
  style: string;
  emoji: string;
  bpm: number;
  price: number;
  /** Тональность/набор нот в MIDI-номерах. */
  scale: number[];
  /** Вайб аранжировки — влияет на ударные и тембр. */
  groove: 'pop' | 'lofi' | 'arcade' | 'dance' | 'tropical' | 'cinematic';
}

export const STARTER_TRACK_IDS = ['sunny-start', 'pixel-party'];

export const MUSIC_TRACKS: MusicTrack[] = [
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

export const MUSIC_BY_ID: Record<string, MusicTrack> = Object.fromEntries(MUSIC_TRACKS.map((track) => [track.id, track]));

export function normalizeMusicOwned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...STARTER_TRACK_IDS];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && Boolean(MUSIC_BY_ID[id])))];
}

export function canBuyTrack(track: MusicTrack, gems: number, owned: string[]): boolean {
  return !owned.includes(track.id) && gems >= track.price;
}
