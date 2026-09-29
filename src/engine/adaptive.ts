/** Adaptation uses first attempts, never repair successes or XP accuracy. */
export interface Attempts { total: number; independent: number }
export interface AdaptiveState { cards?: number; good?: number }
export type Outcome = { kind: 'quit' } | { kind: 'finish'; attempts: Attempts };
export function normalizedCards(value: unknown, ceiling: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(8, Math.min(20, Math.floor(value))) : ceiling;
}
export function effectiveCards(value: unknown, ceiling: number): number {
  return Math.min(ceiling, normalizedCards(value, ceiling));
}
export function nextAdaptiveState(prev: AdaptiveState, ceiling: number, outcome: Outcome): Required<AdaptiveState> {
  const cards = effectiveCards(prev.cards, ceiling);
  const good = prev.good === 1 ? 1 : 0;
  if (outcome.kind === 'quit') return { cards: Math.max(8, cards - 1), good: 0 };
  const { total, independent } = outcome.attempts;
  // Four attempts keeps growth reachable even with the minimum budget.
  if (total < 4) return { cards, good: 0 };
  const pct = independent / total * 100;
  if (pct < 60) return { cards: Math.max(8, cards - 1), good: 0 };
  if (pct < 85 || cards >= ceiling) return { cards, good: 0 };
  return good === 1 ? { cards: cards + 1, good: 0 } : { cards, good: 1 };
}
/** One observation per base task; repeated builds and repairs cannot inflate it. */
export function recordAttempt(seen: Set<string>, stats: Attempts, uid: string, repair: boolean, quality: number): void {
  if (repair || seen.has(uid)) return;
  seen.add(uid);
  stats.total++;
  if (quality >= 5) stats.independent++;
}
