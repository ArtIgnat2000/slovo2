/**
 * Сборка слова из плиток («Карточки букв», P0-2026).
 *
 * Чистая геометрия и чистые переходы — без React и без DOM. Урок и игра
 * свободной практики работают через одни и те же функции, поэтому поведение
 * переноса всегда совпадает, и правила тестируются без браузера.
 *
 * Модель: слово состоит из ровно `text.length` лунок. Плитки живут либо
 * в лотке, либо в лунке. Перенос между лотком и лункой с обменом, между
 * лунками — обмен содержимого, из лунки в лоток — возврат. Никакого
 * «вставить со сдвигом»: ребята не должны терять собранное из-за одного
 * движения (в римском «Собери число» — вставка, нам подходит обмен).
 */

export interface BoardTile {
  /** Позиция в перемешанной выдаче — стабильный ключ React. */
  id: number;
  ch: string;
}

export type BoardSlots = Array<BoardTile | null>;

export interface BoardState {
  tray: BoardTile[];
  slots: BoardSlots;
}

/** Плитки из перемешанных букв задачи (или перемешивание свежее слово). */
export function trayTiles(letters: string[]): BoardTile[] {
  return letters.map((ch, id) => ({ id, ch }));
}

/** Перемешанные плитки слова; порядок ≠ исходному для любого слова длиной ≥ 2. */
export function shuffledTiles(text: string): BoardTile[] {
  const chars = [...text];
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = [...chars];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    if (s.join('') !== text) return trayTiles(s);
  }
  return trayTiles([...chars].reverse());
}

export function firstEmpty(slots: BoardSlots): number {
  return slots.findIndex((s) => s === null);
}

export function isFull(slots: BoardSlots): boolean {
  return slots.every((s) => s !== null);
}

export function joined(slots: BoardSlots): string {
  return slots.map((s) => s?.ch ?? '').join('');
}

/** Лоток → лунка. Пустая лунка — поставить; занятая — обменяться. */
export function placeFromTray(state: BoardState, tileId: number, slotIndex: number): BoardState {
  const tile = state.tray.find((t) => t.id === tileId);
  if (!tile || slotIndex < 0 || slotIndex >= state.slots.length) return state;
  const tray = state.tray.filter((t) => t.id !== tileId);
  const evicted = state.slots[slotIndex];
  if (evicted) tray.push(evicted);
  const slots = [...state.slots];
  slots[slotIndex] = tile;
  return { tray, slots };
}

/** Лунка → лунка: обмен содержимого (в т.ч. с пустой лункой). */
export function swapSlots(state: BoardState, from: number, to: number): BoardState {
  if (from === to) return state;
  if (from < 0 || from >= state.slots.length || to < 0 || to >= state.slots.length) return state;
  const slots = [...state.slots];
  const a = slots[from];
  if (!a) return state;
  slots[from] = slots[to];
  slots[to] = a;
  return { ...state, slots };
}

/** Лунка → лоток (убрать лишнюю/не ту букву). */
export function returnToTray(state: BoardState, slotIndex: number): BoardState {
  const tile = state.slots[slotIndex];
  if (!tile) return state;
  const slots = [...state.slots];
  slots[slotIndex] = null;
  return { tray: [...state.tray, tile], slots };
}

/** Автовставка в первую пустую лунку (тап по плитке в лотке). */
export function placeInFirstEmpty(state: BoardState, tileId: number): BoardState {
  const slot = firstEmpty(state.slots);
  return slot < 0 ? state : placeFromTray(state, tileId, slot);
}

/**
 * Куда попадёт бросок по X: ближайшая лунка, если указатель на ней или
 * рядом (± slack). Если указатель в другой строке (далеко по Y), лунки не
 * выбираются — это бросок «мимо».
 */
export function dropSlotAt(
  x: number,
  y: number,
  boxes: ReadonlyArray<{ left: number; width: number; top: number; height: number }>,
  slack = 18,
  ySlack = 48,
): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const [index, box] of boxes.entries()) {
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const insideX = x >= box.left - slack && x <= box.left + box.width + slack;
    const insideY = Math.abs(y - centerY) <= box.height / 2 + ySlack;
    if (insideX && insideY) {
      const distance = Math.abs(x - centerX);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
  }
  return best;
}
