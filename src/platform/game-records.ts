/** Local device records, deliberately separate from learning progress/backups. */
export type GridGame = 'search' | 'crossword';
export interface GameRecord { completed: number; best: number; lastRound: string }
export type GameRecords = Record<GridGame, GameRecord>;
const PREFIX = 'slovo2-game-records:';
export const GAME_RECORDS_EVENT = 'slovo2-game-records-changed';
const empty = (): GameRecord => ({ completed: 0, best: 0, lastRound: '' });
const count = (n: unknown): number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;

export function recordsSnapshot(profileId: string): string {
  try { return window.localStorage.getItem(PREFIX + profileId) ?? ''; }
  catch { return ''; }
}
export function parseRecords(raw: string): GameRecords {
  let data: Partial<Record<GridGame, Partial<GameRecord>>> | null = null;
  try { data = JSON.parse(raw); } catch { /* Empty or damaged storage. */ }
  const read = (game: GridGame): GameRecord => {
    const value = data?.[game];
    if (!value || !count(value.completed) || !count(value.best)) return empty();
    return { completed: count(value.completed), best: count(value.best),
      lastRound: typeof value.lastRound === 'string' ? value.lastRound : '' };
  };
  return { search: read('search'), crossword: read('crossword') };
}

/** One call at the guarded win transition; repeated delivery of that round is harmless. */
export function recordGridWin(profileId: string, game: GridGame, round: string, words: number): boolean {
  if (!profileId || !round || !count(words)) return false;
  const records = parseRecords(recordsSnapshot(profileId));
  const old = records[game];
  if (old.lastRound === round || old.completed === Number.MAX_SAFE_INTEGER) return false;
  records[game] = { completed: old.completed + 1, best: Math.max(old.best, words), lastRound: round };
  try {
    window.localStorage.setItem(PREFIX + profileId, JSON.stringify(records));
    window.dispatchEvent(new Event(GAME_RECORDS_EVENT));
    return true;
  } catch { return false; } // Storage failure must never interrupt play or rewards.
}
