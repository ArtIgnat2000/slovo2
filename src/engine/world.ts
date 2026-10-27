import { ITEM_BY_ID, isOwned } from './shop';
import { ALL_COSTUMES } from './puzzles';

/**
 * «Мой мир» (0.26.0): ребёнок сам выбирает до трёх купленных вещей, и они
 * показываются на отдельной вкладке. Выбор хранится в `profile.shop.world`
 * в порядке, в котором вещи были выбраны.
 */
export const WORLD_SLOTS = 3;

/** Результат нажатия «в Мой мир»: добавлено, убрано, мест нет или вещь не куплена. */
export type WorldToggle = 'added' | 'removed' | 'full' | 'locked';

/** Очистка данных из файла: только купленные вещи магазина, без повторов, не больше трёх. */
export function normalizeWorld(
  raw: unknown,
  owned: string[] = [],
  ownedCostumes: string[] = [],
): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || out.includes(id)) continue;
    const ownedItem = Boolean(ITEM_BY_ID[id] && isOwned(owned, id));
    const ownedCostume = Boolean(ALL_COSTUMES.some((costume) => costume.id === id) && ownedCostumes.includes(id));
    if (!ownedItem && !ownedCostume) continue;
    out.push(id);
    if (out.length === WORLD_SLOTS) break;
  }
  return out;
}

/** Чистый переход: что станет с выбором после нажатия на вещь. */
export function toggleWorldPick(
  world: string[] | undefined,
  id: string,
  owned: string[],
  ownedCostumes: string[] = [],
): { world: string[]; result: WorldToggle } {
  const current = world ?? [];
  if (current.includes(id)) {
    return { world: current.filter((x) => x !== id), result: 'removed' };
  }
  const ownedItem = Boolean(ITEM_BY_ID[id] && isOwned(owned, id));
  const ownedCostume = Boolean(ALL_COSTUMES.some((costume) => costume.id === id) && ownedCostumes.includes(id));
  if (!ownedItem && !ownedCostume) return { world: current, result: 'locked' };
  if (current.length >= WORLD_SLOTS) return { world: current, result: 'full' };
  return { world: [...current, id], result: 'added' };
}
