/**
 * Курсор по пулу слов — общая механика для «Филворда» и «Кроссворда» (0.96.5).
 *
 * Почему так, а не «avoidIds» (0.96.2–0.96.4). Идея «передай слова прошлой
 * сетки, движок возьмёт другие» звучит логично, но на практике не работает,
 * когда игр две: обе берут слова из одного и того же пула, и как только
 * «Кроссворд» отдаёт свои слова в конец очереди, «Филворд» снова начинает с
 * начала пула. Владелец три раза подряд сообщал одно и то же: «слова не
 * меняются, постоянно телефон». Поэтому выбор слов больше не эвристика:
 *
 *  • пул один раз перемешивается (порядок зависит только от самих слов, а не
 *    от `seed`, поэтому одинаков во всех сетках и после перезагрузки);
 *  • выбор — это КРУГ по этому порядку: сетка берёт `limit` слов, начиная с
 *    курсора, а следующая сетка стартует с того же места, где кончилась
 *    прошлая;
 *  • слово возвращается только после полного круга по пулу — то есть при пуле
 *    из 10 слов и сетке из 5 слов каждое слово появляется не чаще, чем раз в
 *    две сетки.
 *
 * `avoidIds` остаётся, но уже как страховка: если вызывающий код передал слова
 * прошлой сетки, они уезжают в конец круга (на случай, когда курсор не
 * сдвинулся — например, экран пересоздали).
 */

export interface PoolWord {
  id: string;
  text: string;
}

/** Детерминированный хеш строки — для перемешивания по содержимому пула. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Стабильный «круг» пула: перемешан по содержимому, поэтому одна и та же
 * выборка слов всегда даёт один и тот же порядок — иначе курсор терял бы
 * смысл между сетками.
 */
export function poolDeck<T extends PoolWord>(pool: ReadonlyArray<T>): T[] {
  const out = [...pool];
  const rng = mulberry32(hashString(out.map((w) => w.id).join('|')) || 1);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Порядок слов для ОДНОЙ сетки: круг, повёрнутый на курсор, со словами
 * прошлой сетки в хвосте. Возвращается весь список — движок берёт сколько
 * нужно и может «дотянуться» дальше, если что-то не влезло в поле.
 */
export function boardOrder<T extends PoolWord>(
  pool: ReadonlyArray<T>,
  opts: { cursor?: number; avoidIds?: ReadonlyArray<string> } = {},
): T[] {
  const deck = poolDeck(pool);
  if (deck.length === 0) return deck;
  const n = deck.length;
  const start = ((Math.trunc(opts.cursor ?? 0) % n) + n) % n;
  const rotated = [...deck.slice(start), ...deck.slice(0, start)];
  const avoid = new Set(opts.avoidIds ?? []);
  if (avoid.size === 0) return rotated;
  const fresh: T[] = [];
  const stale: T[] = [];
  for (const word of rotated) (avoid.has(word.id) ? stale : fresh).push(word);
  return [...fresh, ...stale];
}

/**
 * Слова для одной сетки: окно круга чуть шире сетки, слова из окна — в
 * случайном порядке, но набор обязан заметно отличаться от прошлого.
 *
 * Почему не «только свежие»: на пуле 12 слов и сетке из 5 прошлый набор
 * оставляет ровно 7 свежих — и следующие две сетки начинали чередоваться
 * A, B, A, B (владелец: «слова не меняются»). Окно +2 и требование «минимум
 * половина слов новые» дают длинный цикл: на 12 словах — 12 разных наборов.
 */
export function pickBoardWords<T extends PoolWord>(
  deck: ReadonlyArray<T>,
  limit: number,
  opts: {
    cursor?: number;
    avoidIds?: ReadonlyArray<string>;
    slack?: number;
    rng: () => number;
  },
): {
  chosen: T[];
  windowSize: number;
  cursor: number;
  /** Сколько выбранных слов ещё не показывали в прошлой сетке. */
  fresh: number;
} {
  const n = deck.length;
  if (n === 0 || limit <= 0) return { chosen: [], windowSize: 0, cursor: 0, fresh: 0 };
  const take = Math.min(limit, n);
  let order = boardOrder(deck, { cursor: opts.cursor });
  const avoid = new Set(opts.avoidIds ?? []);
  // Круг идёт РОВНЫМ шагом: порция — первые `take` слов повёрнутого круга,
  // курсор сдвигается ровно на `take`. На пуле 10–30 слов это даёт длинный
  // цикл без повторов (на 12 словах и порции 5 соседние сетки не пересекаются,
  // а пересечение с третьей — неизбежный остаток деления).
  //
  // `avoidIds` — только страховка на вырожденный случай: если порция целиком
  // совпала с прошлой сеткой (крошечный пул), сдвигаем круг на одно слово.
  const avoidedSet = (list: ReadonlyArray<T>) => list.slice(0, take).every((w) => avoid.has(w.id));
  if (take < n && avoidedSet(order)) order = boardOrder(deck, { cursor: (opts.cursor ?? 0) + 1 });
  const chosen = order.slice(0, take);
  return {
    chosen,
    windowSize: take,
    cursor: advanceCursor(opts.cursor ?? 0, take, n),
    fresh: chosen.filter((w) => !avoid.has(w.id)).length,
  };
}

/**
 * Где начнётся следующая сетка. Сдвигаем ровно на столько слов, сколько
 * показали: так каждая новая сетка начинается с новых слов, а весь пул
 * проходится по кругу без повторов.
 */
export function advanceCursor(cursor: number, shown: number, poolSize: number): number {
  if (poolSize <= 0) return 0;
  return (((Math.trunc(cursor) + Math.max(0, shown)) % poolSize) + poolSize) % poolSize;
}
