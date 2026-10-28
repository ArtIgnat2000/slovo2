// ── Рейтинг с воображаемыми соперниками (0.73.0) ────────────────────────────
// Соперники — выдуманные «ИИ-друзья», а не настоящие дети: их XP растёт каждый
// день по детерминированной формуле от номера дня, поэтому таблица живёт без
// сети и одинакова при каждом открытии в течение дня. Игрок соревнуется своим
// настоящим XP профиля. Формула соперника монотонна: очки никогда не убывают.

export interface Rival {
  id: string;
  name: string;
  emoji: string;
  /** Очки на старте эпохи рейтинга. */
  base: number;
  /** Базовый прирост XP в день; к нему добавляется детерминированный 0..2. */
  rate: number;
}

export const RIVALS: Rival[] = [
  { id: 'rex', name: 'Щенок Рекс', emoji: '🐶', base: 60, rate: 6 },
  { id: 'barsik', name: 'Кот Барсик', emoji: '🐱', base: 140, rate: 7 },
  { id: 'ryzhik', name: 'Белка Рыжик', emoji: '🐿️', base: 230, rate: 9 },
  { id: 'pi', name: 'Пингвин Пи', emoji: '🐧', base: 320, rate: 8 },
  { id: 'leva', name: 'Лёва', emoji: '🦁', base: 420, rate: 10 },
  { id: 'sonya', name: 'Соня', emoji: '🦉', base: 520, rate: 9 },
  { id: 'kodi', name: 'Робот Коди', emoji: '🤖', base: 610, rate: 11 },
  { id: 'zaya', name: 'Зая', emoji: '🐰', base: 700, rate: 12 },
  { id: 'timosha', name: 'Тимоша', emoji: '🐢', base: 790, rate: 10 },
  { id: 'miya', name: 'Мия', emoji: '🦊', base: 900, rate: 13 },
];

/** Номер дня эпохи рейтинга (UTC-дни с 2026-01-01), не меньше нуля. */
export function ratingDay(now: number = Date.now()): number {
  const epoch = Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
  return Math.max(0, Math.floor(now / 86_400_000) - epoch);
}

/** Маленький детерминированный хэш строки — для дневного «настроения» соперника. */
function hashText(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Прирост соперника за конкретный день: rate + 0..2 (одинаково у всех устройств). */
export function rivalGain(rival: Rival, day: number): number {
  return rival.rate + (hashText(`${rival.id}:${day}`) % 3);
}

/** XP соперника к концу дня `day` (монотонно растёт). */
export function rivalXp(rival: Rival, day: number): number {
  let xp = rival.base;
  for (let d = 0; d <= day; d++) xp += rivalGain(rival, d);
  return xp;
}

export interface RatingEntry {
  id: string;
  name: string;
  emoji: string;
  xp: number;
  gainToday: number;
  isPlayer: boolean;
  /** Изменение места против вчера: >0 — поднялся, <0 — опустился. */
  trend: number;
}

export interface RatingTable {
  entries: RatingEntry[];
  playerRank: number; // 1-based
  /** Сколько XP не хватает до соперника выше; null, если игрок первый. */
  toNext: number | null;
  leaderXp: number;
  day: number;
}

function sortedEntries(playerXp: number, rivalsXp: { rival: Rival; xp: number; gain: number }[], player: { name: string; emoji: string }): RatingEntry[] {
  const entries: RatingEntry[] = [
    { id: 'player', name: player.name, emoji: player.emoji, xp: Math.max(0, Math.floor(playerXp)), gainToday: 0, isPlayer: true, trend: 0 },
    ...rivalsXp.map(({ rival, xp, gain }) => ({
      id: rival.id, name: rival.name, emoji: rival.emoji, xp, gainToday: gain, isPlayer: false, trend: 0,
    })),
  ];
  // При равенстве XP игрок выше: он заработал очки настоящим уроком.
  entries.sort((a, b) => b.xp - a.xp || Number(b.isPlayer) - Number(a.isPlayer) || a.name.localeCompare(b.name, 'ru'));
  return entries;
}

/**
 * Таблица на сегодня. `playerGainToday` — XP игрока за сегодня (из дней профиля),
 * чтобы честно посчитать вчерашнее место игрока для стрелок тренда.
 */
export function buildRating(player: { name: string; emoji: string; xp: number }, now: number = Date.now(), playerGainToday: number = 0): RatingTable {
  const day = ratingDay(now);
  const today = RIVALS.map((rival) => ({ rival, xp: rivalXp(rival, day), gain: rivalGain(rival, day) }));
  const entries = sortedEntries(player.xp, today, player);

  const yesterday = RIVALS.map((rival) => ({ rival, xp: day > 0 ? rivalXp(rival, day - 1) : rival.base, gain: 0 }));
  const yesterdayEntries = sortedEntries(Math.max(0, player.xp - Math.max(0, playerGainToday)), yesterday, player);
  const yesterdayRank = new Map(yesterdayEntries.map((e, i) => [e.id, i + 1]));
  for (const [i, e] of entries.entries()) e.trend = (yesterdayRank.get(e.id) ?? i + 1) - (i + 1);

  const playerIndex = entries.findIndex((e) => e.isPlayer);
  return {
    entries,
    playerRank: playerIndex + 1,
    toNext: playerIndex > 0 ? Math.max(1, entries[playerIndex - 1].xp - entries[playerIndex].xp + 1) : null,
    leaderXp: entries[0]?.xp ?? 0,
    day,
  };
}
