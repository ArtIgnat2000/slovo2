import type { Word } from '../types';
import { boardOrder } from './pool-cursor';

export interface MemoryCard { id: string; word: Word; face: 'word' | 'image' | 'hint' }
export interface MemoryBoard { cards: MemoryCard[]; words: Word[]; nextCursor: number }
export interface MemoryState { open: string[]; matched: string[] }
export const emptyMemory = (): MemoryState => ({ open: [], matched: [] });
const normal = (s: string) => s.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ');

/** Duplicate clues/words are excluded, not arbitrarily assigned to one answer. */
export function buildMemory(pool: Word[], grade: number, seed: number, cursor = 0, avoidIds: string[] = [], priorityIds: string[] = []): MemoryBoard | null {
  const unique = [...new Map(pool.map(w => [w.id, w])).values()];
  const clue = (w: Word) => normal(grade === 5 ? w.hint : w.image ?? '');
  const eligible = unique.filter(w => clue(w) && unique.filter(other => clue(other) === clue(w)).length === 1
    && unique.filter(other => normal(other.text) === normal(w.text)).length === 1);
  const words = boardOrder(eligible, { cursor, avoidIds, priorityIds }).slice(0, 6);
  if (words.length < 2) return null;
  const cards: MemoryCard[] = words.flatMap(word => [
    { id: `${word.id}:word`, word, face: 'word' },
    { id: `${word.id}:clue`, word, face: grade === 5 ? 'hint' : 'image' },
  ]);
  let state = seed >>> 0;
  for (let i = cards.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(state / 4294967296 * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, words, nextCursor: (cursor + words.length) % eligible.length };
}
export function flipMemory(board: MemoryBoard, state: MemoryState, id: string): MemoryState {
  const card = board.cards.find(c => c.id === id);
  if (!card || state.open.length === 2 || state.open.includes(id) || state.matched.includes(card.word.id)) return state;
  const open = [...state.open, id];
  if (open.length === 2 && board.cards.find(c => c.id === open[0])?.word.id === card.word.id)
    return { open: [], matched: [...state.matched, card.word.id] };
  return { ...state, open };
}
export function closeMemory(state: MemoryState): MemoryState {
  return state.open.length === 2 ? { ...state, open: [] } : state;
}
export function memoryWon(board: MemoryBoard, state: MemoryState): boolean {
  return board.words.every(w => state.matched.includes(w.id));
}
