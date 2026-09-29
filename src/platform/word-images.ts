import type { Word } from '../types';

export function wordImageUrl(word: Word): string | undefined {
  return word.image ? `${import.meta.env.BASE_URL}words/${word.image}.webp` : undefined;
}

/** Small, bounded decode cache. Cache Storage contains bytes, not decoded pixels. */
const warmed = new Map<string, HTMLImageElement>();
export function warmWordImages(words: Word[]): void {
  for (const word of words) {
    const url = wordImageUrl(word);
    if (!url || warmed.has(url) || typeof Image === 'undefined') continue;
    const image = new Image();
    warmed.set(url, image);
    image.decoding = 'async';
    image.onerror = () => { warmed.delete(url); };
    image.src = url;
    if (typeof image.decode === 'function') void image.decode().catch(() => warmed.delete(url));
    if (warmed.size > 16) warmed.delete(warmed.keys().next().value!);
  }
}

/** Speculation only: never blocks navigation; cancel when the screen changes. */
export function scheduleWordImages(words: Word[]): () => void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => warmWordImages(words));
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(() => warmWordImages(words), 300);
  return () => clearTimeout(id);
}
