import { ITEM_BY_ID, isOwned } from './shop';
import { ALL_COSTUMES } from './puzzles';

/**
 * «Мой мир» (0.26.0): ребёнок сам выбирает до трёх купленных вещей, и они
 * показываются на отдельной вкладке. Выбор хранится в `profile.shop.world`
 * в порядке, в котором вещи были выбраны.
 *
 * Главное правило (0.71.1): в «Мой мир» можно поставить ТОЛЬКО полученное —
 * купленную вещь, собранный пазловый костюм или купленный костюм базы.
 * Неполученное нельзя поставить ни одним путём: список выбора строится только
 * из полученного (WorldScreen), движок отвечает 'locked' на чужой id, а
 * сохранённый выбор при каждом чтении очищается от неполученного
 * (normalizeWorld) — например, если вещь сдали обратно в магазин или
 * выбор приехал из чужого файла выгрузки.
 */
export const WORLD_SLOTS = 3;

/** Результат нажатия «в Мой мир»: добавлено, убрано, мест нет или вещь не куплена. */
export type WorldToggle = 'added' | 'removed' | 'full' | 'locked';

/** Получена ли вещь/костюм и можно ли её поставить в «Мой мир». */
export function isWorldPlaceable(id: string, owned: string[] = [], ownedCostumes: string[] = []): boolean {
  const ownedItem = Boolean(ITEM_BY_ID[id] && isOwned(owned, id));
  const ownedCostume = Boolean(ALL_COSTUMES.some((costume) => costume.id === id) && ownedCostumes.includes(id));
  return ownedItem || ownedCostume;
}

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
    if (!isWorldPlaceable(id, owned, ownedCostumes)) continue;
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
  // Сначала чистим уже сохранённый выбор: неполученное (сданная вещь, чужой
  // файл) не должно ни показываться, ни занимать одно из трёх мест.
  const current = normalizeWorld(world ?? [], owned, ownedCostumes);
  if (current.includes(id)) {
    return { world: current.filter((x) => x !== id), result: 'removed' };
  }
  if (!isWorldPlaceable(id, owned, ownedCostumes)) return { world: current, result: 'locked' };
  if (current.length >= WORLD_SLOTS) return { world: current, result: 'full' };
  return { world: [...current, id], result: 'added' };
}
