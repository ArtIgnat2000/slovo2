/**
 * Точка сборки аудио-лаборатории: страница слушает ТОТ ЖЕ движок, что и
 * приложение (src/platform/music.ts), а не свою копию. Рисунки ещё не принятых
 * волн (2–5, «Для урока», сезонные) регистрируются снаружи через
 * registerGrooves() — каталог магазина при этом не меняется.
 *
 * Сборка: `npm run demo:build` → docs/music-demo/engine.js.
 */
import { MUSIC_TRACKS, type MusicTrack } from '../../src/engine/music';
import {
  getMusicContext,
  grooveIds,
  playMusic,
  playStinger,
  recordingStream,
  registerGrooves,
  setMusicContext,
  setMusicVolume,
  stopMusic,
  type GrooveSpec,
  type StingerId,
} from '../../src/platform/music';

const K = (...steps: number[]) => Array.from({ length: 16 }, (_, i) => (steps.includes(i) ? 1 : 0));
const EIGHTH_HAT = K(0, 2, 4, 6, 8, 10, 12, 14);

/** Грувы волн 2–5 и полок «Для урока» / «Сезон»: только данные, звук даёт движок. */
const EXTRA_GROOVES: Record<string, GrooveSpec> = {
  house: { kick: K(0, 4, 8, 12), snare: [], hat: K(2, 6, 10, 14), clap: K(4, 12), openHat: K(2, 6, 10, 14), bass: 'offbeat', chord: 'keys', chordIntervals: [0, 4, 7], lead: 'epiano', leadBase: 66, motif: [0, 2, 4, 2, 5, 4, 2, 0], swing: 0.06, sidechain: 0.55, rev: 0.3, dly: 0.25, crash: [0], fill: true },
  postpunk: { kick: K(0, 8), snare: K(4, 12), hat: EIGHTH_HAT, clap: [], bass: 'eighth', chord: 'power', chordIntervals: [0, 7], lead: 'pluck', leadBase: 66, blip: true, motif: [0, 2, 4, 7, 4, 2, 0, 2], rev: 0.35, dly: 0.3, crash: [0, 4], fill: true },
  tarantella: { kick: K(0, 6, 8, 14), snare: K(4, 12), hat: EIGHTH_HAT, clap: [], bass: 'quarter', chord: 'keys', chordIntervals: [0, 4, 7], lead: 'pluck', leadBase: 72, motif: [0, 2, 4, 5, 4, 2, 0, 2], swing: 0.24, rev: 0.3, dly: 0.2, fill: true },
  funkbr: { kick: K(0, 6, 8, 14), snare: K(4, 12), hat: K(2, 3, 6, 7, 10, 11, 14, 15), clap: [], bass: 'slide', chord: 'none', chordIntervals: [], lead: 'cowbell', leadBase: 78, motif: [0, 0, 3, 0, 5, 0, 7, 0], swing: 0.05, sidechain: 0.5, rev: 0.12, dly: 0.1, crash: [0, 4], fill: true },
  twostep: { kick: K(0, 10), snare: K(4, 12), hat: K(2, 5, 6, 10, 13, 14), clap: K(4, 12), bass: 'slide', chord: 'keys', chordIntervals: [0, 4, 7], lead: 'epiano', leadBase: 66, motif: [0, 2, 3, 4, 3, 2, 0, 2], swing: 0.12, sidechain: 0.3, rev: 0.25, dly: 0.2, fill: true },
  hardstyle: { kick: K(0, 4, 8, 12), snare: [], hat: K(2, 6, 10, 14), clap: [], bass: 'offbeat', chord: 'power', chordIntervals: [0, 7], lead: 'supersaw', leadBase: 66, motif: [0, 0, 7, 0, 5, 5, 3, 3], sidechain: 0.6, rev: 0.14, dly: 0.12, crash: [0, 2, 4, 6], fill: true, riser: true },
  classical: { kick: [], snare: [], hat: [], clap: [], bass: 'quarter', chord: 'strings', chordIntervals: [0, 4, 7, 12], lead: 'piano', leadBase: 72, motif: [0, 2, 4, 7, 9, 7, 4, 2], padAttack: 0.08, rev: 0.55, dly: 0.2 },
  pulse60: { kick: K(0, 8), snare: [], hat: [], clap: [], bass: 'quarter', chord: 'strings', chordIntervals: [0, 4, 7], lead: 'piano', leadBase: 65, motif: [0, 4, 2, 5, 4, 2, 0, 2], rev: 0.5, dly: 0.3 },
  lofirain: { kick: K(0), snare: [], hat: [], clap: [], bass: 'quarter', chord: 'keys', chordIntervals: [0, 4, 7], lead: 'piano', leadBase: 65, blip: true, motif: [0, 2, 4, 2, 3, 2, 0, 1], cutoff: 1500, swing: 0.08, rev: 0.5, dly: 0.35 },
  ambient: { kick: [], snare: [], hat: [], clap: [], bass: 'drone', chord: 'strings', chordIntervals: [0, 4, 7, 11], lead: 'flute', leadBase: 72, padAttack: 0.12, motif: [0, 4, 7, 4, 2, 7, 4, 0], rev: 0.7, dly: 0.4 },
  musicbox: { kick: [], snare: [], hat: [], clap: [], bass: 'quarter', chord: 'strings', chordIntervals: [0, 7], lead: 'bell', leadBase: 84, padAttack: 0.05, motif: [0, 2, 4, 2, 5, 4, 2, 0], rev: 0.5, dly: 0.3 },
  bellpop: { kick: K(0, 8), snare: K(4, 12), hat: EIGHTH_HAT, clap: K(4, 12), bass: 'quarter', chord: 'keys', chordIntervals: [0, 4, 7], lead: 'bell', leadBase: 72, motif: [0, 2, 4, 4, 2, 2, 0, 0], rev: 0.3, dly: 0.2, crash: [0], fill: true },
};

registerGrooves(EXTRA_GROOVES);

// ── Витрина лаборатории ─────────────────────────────────────────────────────

export interface DemoItem {
  track: MusicTrack;
  trend?: string;
  note?: string;
}

const item = (track: MusicTrack, trend?: string, note?: string): DemoItem => ({ track, trend, note });

const extra = (track: MusicTrack, trend: string, note: string): DemoItem => item(track, trend, note);

const TREND2: DemoItem[] = [
  extra({ id: 'kitten-headphones', title: 'Котёнок в наушниках', style: 'Дип-хаус', emoji: '🎧', bpm: 122, price: 14, scale: [0, 2, 3, 7, 9], groove: 'house' }, 'Вика Шоу «Просто» + анимация котёнка в наушниках; deep house-подборки 2026', 'Мягче фонка, но современнее диско: хороший «средний» выбор.'),
  extra({ id: 'cassette-wave', title: 'Кассетный пост-панк', style: 'Пост-панк', emoji: '📼', bpm: 138, price: 16, scale: [0, 3, 5, 7, 10], groove: 'postpunk' }, '«Кино» и Виктор Цой — №2 у школьников', 'Восьмые баса и «хорус»-арпеджио: ретро-звук, который дети открыли заново.'),
  extra({ id: 'tralala', title: 'Тарантелла-трала', style: 'Брейнрот-тарантелла', emoji: '🦈', bpm: 150, price: 16, scale: [0, 2, 4, 5, 7, 9], groove: 'tarantella' }, 'Итальянский брейнрот: Тралалеро Тралала, Бомбардиро Крокодило', '6/8 с свингом и щипками. Абсурдный тренд 2025-го, который дети помнят до сих пор.'),
  extra({ id: 'rio-bounce', title: 'Рио-баунс', style: 'Бразильский фонк-поп', emoji: '🥁', bpm: 130, price: 16, scale: [0, 3, 5, 7, 10], groove: 'funkbr' }, 'Brazilian phonk — тег, которым помечают и «67» Gazan', 'Синкопированная бочка и ковбелл. Танцевальнее фонка, менее «тёмный».'),
  extra({ id: 'maybe-maybe', title: 'Может быть', style: 'Ту-степ баунс', emoji: '🤔', bpm: 126, price: 12, scale: [0, 2, 3, 7, 9], groove: 'twostep' }, '«Филяй-филяй» (Vielleicht) — танцевальный тренд осени 2026', 'Гаражный ломаный ритм: звучит «не как у всех» в каталоге.'),
  extra({ id: 'storm-drop', title: 'Шторм-дроп', style: 'Киношный рейв', emoji: '⛈️', bpm: 128, price: 18, scale: [0, 2, 4, 7, 11], groove: 'hardstyle' }, 'Танец под Storm II (GENER8ION × Yung Lean) — главный тренд осени 2026', 'Бочка восьмыми и «обратный» бас. Громко: в магазин — с пометкой «для наград».'),
];

const FOCUS: DemoItem[] = [
  extra({ id: 'quiet-piano', title: 'Тихий рояль', style: 'Минимал-классика', emoji: '🎹', bpm: 68, price: 10, scale: [0, 2, 4, 7, 9], groove: 'classical' }, 'Классику слушают 27% отличников (VK Музыка × Учи.ру, 2026)', 'Арпеджио без ударных: то, что реально помогает писать слова.'),
  extra({ id: 'sixty-pulse', title: 'Шестьдесят ударов', style: 'Пульс 60', emoji: '⏱️', bpm: 60, price: 10, scale: [0, 2, 4, 7, 9], groove: 'pulse60' }, 'Исследования фоновой музыки: медленный темп ≈ пульсу покоя', 'Мягкий «тумп» раз в два счёта. Лучший кандидат на «по умолчанию в уроке».'),
  extra({ id: 'rain-lofi', title: 'Дождь за окном', style: 'Лоу-фай с каплями', emoji: '🌧️', bpm: 76, price: 12, scale: [0, 2, 3, 7, 9], groove: 'lofirain' }, 'Lo-fi — самый частый выбор для домашки', 'Случайные тихие «капли» вместо шума: разнообразие без раздражения.'),
  extra({ id: 'space-silence', title: 'Космическая тишина', style: 'Эмбиент-пад', emoji: '🌌', bpm: 72, price: 12, scale: [0, 2, 4, 7, 11], groove: 'ambient' }, 'Для детей, которым любой бит мешает', 'Почти тишина: пэд раз в такт и редкая нота. Честная альтернатива «выключить звук».'),
];

const SEASON: DemoItem[] = [
  extra({ id: 'musicbox-ghosts', title: 'Шкатулка с привидениями', style: 'Жутковатая шкатулка', emoji: '🎃', bpm: 92, price: 12, scale: [0, 1, 5, 6, 8], groove: 'musicbox' }, 'Хэллоуин: music-box звуки в трендах октября 2026', 'Сезон: 20 октября — 5 ноября. Страшно ровно настолько, чтобы быть смешным.'),
  extra({ id: 'first-bell', title: 'Первый звонок', style: 'Звонкий поп', emoji: '🔔', bpm: 112, price: 12, scale: [0, 2, 4, 7, 9], groove: 'bellpop' }, '1 сентября; Gazan пел «67» на линейке и звонил в колокольчик', 'Сезон: 25 августа — 15 сентября. Колокольчик на третий счёт.'),
  extra({ id: 'tree-rave', title: 'Ёлка-рейв', style: 'Новогодний дэнс', emoji: '🎄', bpm: 128, price: 14, scale: [0, 2, 4, 7, 11], groove: 'kpop' }, 'Новый год и каникулы', 'Сезон: 15 декабря — 15 января. Самый покупаемый трек зимы.'),
];

const TREND1: DemoItem[] = MUSIC_TRACKS.filter((track) => track.shelf === 'trend').map((track) => item(track, track.about, track.tag));
const NOW: DemoItem[] = MUSIC_TRACKS.filter((track) => track.shelf !== 'trend').map((track) => item(track, track.about, track.tag));

export const sections: { grid: string; items: DemoItem[] }[] = [
  { grid: 'grid-trend1', items: TREND1 },
  { grid: 'grid-trend2', items: TREND2 },
  { grid: 'grid-focus', items: FOCUS },
  { grid: 'grid-season', items: SEASON },
  { grid: 'grid-now', items: NOW },
];

const STINGERS: Record<string, StingerId> = {
  sixseven: 'sixseven',
  cowbell: 'cowbell',
  mogu: 'duckwave',
  golden: 'golden',
  bell: 'bell',
};

export const demo = {
  sections,
  grooveCount: () => grooveIds().length,
  trackCount: () => MUSIC_TRACKS.length + TREND2.length + FOCUS.length + SEASON.length,
  play(track: MusicTrack) {
    playMusic(track, getMusicContext());
  },
  stop: stopMusic,
  /** Режим «Урок» переключается на лету: луп не перезапускается, движок сам ужимает темп и перкуссию. */
  setFocus(on: boolean) {
    setMusicContext(on ? 'lesson' : 'reward');
  },
  setVolume(value: number) {
    setMusicVolume(value);
  },
  stinger(id: string) {
    playStinger(STINGERS[id] ?? 'sixseven');
  },
  /** Отвод мастер-шины для записи webm (кнопка «⏺ Записать 10 с»). */
  stream: () => recordingStream(),
};

(window as unknown as { DEMO?: typeof demo }).DEMO = demo;
