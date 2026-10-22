// ── Сейф прогресса ───────────────────────────────────────────────────────────
// Чистая логика (без DOM и IndexedDB): снимки записи, корзина профилей и
// журнал событий. Всё, что решает «сохранить ли копию перед перезаписью» и
// «сколько копий держать», лежит здесь, чтобы это можно было проверить тестом,
// а не только «на живом телефоне».
//
// Почему это появилось: прогресс ребёнка хранился одной записью, которая
// перезаписывалась целиком на каждое изменение. Любой сбой чтения превращался
// в полную потерю: приложение стартовало пустым, а первое же действие
// затирало старую запись (подробности — docs/progress-loss-audit.md).
import type { Profile } from '../types';

/** Сколько копий записи держим: три — «5 минут назад / час назад / вчера». */
export const SNAPSHOT_SLOTS = 3;
/** Не чаще раза в полчаса: иначе все три копии окажутся «прямо сейчас». */
export const SNAPSHOT_MIN_INTERVAL_MS = 30 * 60 * 1000;
/** Сколько удалённых профилей держим в корзине. */
export const TRASH_MAX = 5;
/** Срок жизни корзины — 30 дней; старше удаляем при старте приложения. */
export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Длина журнала событий (последние N). */
export const LOG_MAX = 40;
/** Через сколько дней без выгрузки напоминаем родителю сделать копию. */
export const EXPORT_REMINDER_MS = 14 * 24 * 60 * 60 * 1000;

export type TrashReason = 'delete' | 'reset' | 'import' | 'invalid';

/** За что именно снята копия «до списания кристаллов». */
export type SpendKind = 'buy' | 'sell' | 'music' | 'sound' | 'tint';

/**
 * Копия записи, снятая перед последней тратой кристаллов (0.36.0).
 *
 * Зачем: покупка — единственное действие, где кристаллы уходят безвозвратно.
 * Если запись о ней не ляжет в базу (квота, приватный режим, чистка iOS) или
 * её затрёт вторая открытая копия приложения, ребёнок останется и без
 * кристаллов, и без вещи. Копия «как было» лежит отдельным ключом IndexedDB —
 * её можно вернуть из раздела «Родителям → Прогресс» одной кнопкой.
 *
 * Копия НЕ содержит покупки: это ровно то состояние, в котором кристаллы ещё
 * целы. Поэтому худший случай после сбоя — «кристаллы на месте, вещи нет»,
 * а не «списались и ничего не появилось».
 */
export interface PurchaseArchiveMeta {
  at: number;
  kind: SpendKind;
  /** Название вещи/трека/набора — чтобы родителю было понятно, что отменяем. */
  label: string;
  price: number;
  gemsBefore: number;
  gemsAfter: number;
  profileId: string;
  profileName: string;
  bytes: number;
  profiles: number | null;
  xp: number | null;
}

export type LogKind =
  | 'boot'
  | 'hydrate-ok'
  | 'hydrate-error'
  | 'write-error'
  | 'write-blocked'
  | 'snapshot'
  | 'restore-snapshot'
  | 'profile-delete'
  | 'profile-reset'
  | 'profile-restore'
  | 'import'
  | 'export'
  | 'fresh-start'
  | 'persist-on'
  | 'persist-off'
  /** Снята копия перед покупкой (0.36.0). */
  | 'purchase'
  /** Покупка не легла в базу — состояние вернули к копии. */
  | 'purchase-failed'
  /** Родитель вернул состояние из копии «перед покупкой». */
  | 'purchase-restore';

export interface TrashedProfile {
  profile: Profile;
  at: number;
  reason: TrashReason;
}

export interface LogEntry {
  at: number;
  kind: LogKind;
  note?: string;
}

/** Описание копии: сама копия лежит в IndexedDB отдельным ключом, здесь — только метка. */
export interface SnapshotMeta {
  slot: number; // 1..SNAPSHOT_SLOTS
  at: number;
  bytes: number;
  /** null — запись не читается (повреждена), но сохранена как есть. */
  profiles: number | null;
  xp: number | null;
  names: string[];
}

export interface VaultState {
  trash: TrashedProfile[];
  log: LogEntry[];
  snapshots: SnapshotMeta[];
  lastExportAt: number | null;
  /** Копия «до последней покупки» — одна, перезаписывается каждой тратой. */
  purchase: PurchaseArchiveMeta | null;
}

export function emptyVault(): VaultState {
  return { trash: [], log: [], snapshots: [], lastExportAt: null, purchase: null };
}

// ── Журнал ───────────────────────────────────────────────────────────────────

export function pushLog(vault: VaultState, kind: LogKind, note?: string, now = Date.now()): VaultState {
  const entry: LogEntry = note ? { at: now, kind, note } : { at: now, kind };
  return { ...vault, log: [...vault.log, entry].slice(-LOG_MAX) };
}

/**
 * То же, что pushLog, но без повторов подряд: журнал не должен заполняться
 * одинаковыми строчками (например, «не удалось сохранить» на каждой попытке).
 */
export function pushLogDedup(
  vault: VaultState,
  kind: LogKind,
  note?: string,
  now = Date.now(),
  windowMs = 10 * 60 * 1000,
): VaultState {
  const last = vault.log[vault.log.length - 1];
  if (last && last.kind === kind && last.note === note && now - last.at < windowMs) return vault;
  return pushLog(vault, kind, note, now);
}

// ── Корзина ──────────────────────────────────────────────────────────────────

export function addTrash(
  vault: VaultState,
  profile: Profile,
  reason: TrashReason,
  now = Date.now(),
): VaultState {
  const trash = [...vault.trash, { profile, at: now, reason }]
    .sort((a, b) => a.at - b.at)
    .slice(-TRASH_MAX);
  return { ...vault, trash };
}

export function purgeTrash(vault: VaultState, now = Date.now()): VaultState {
  const alive = vault.trash.filter((t) => now - t.at < TRASH_TTL_MS);
  return alive.length === vault.trash.length ? vault : { ...vault, trash: alive };
}

// ── Разбор записи ────────────────────────────────────────────────────────────

/** Краткая сводка записи: число профилей, сумма XP, число слов, имена. */
export interface RecordSummary {
  count: number;
  xp: number;
  words: number;
  names: string[];
}

/** Разбор записи, который не может упасть: битая запись — не повод ронять приложение. */
export function readRecord(raw: string | null | undefined): RecordSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { profiles?: unknown } };
    const profiles = parsed?.state?.profiles;
    if (!Array.isArray(profiles)) return null;
    let xp = 0;
    let words = 0;
    const names: string[] = [];
    for (const p of profiles) {
      const prof = p as Partial<Profile>;
      if (typeof prof?.xp === 'number' && Number.isFinite(prof.xp)) xp += prof.xp;
      if (prof?.words && typeof prof.words === 'object') words += Object.keys(prof.words).length;
      names.push(typeof prof?.name === 'string' ? prof.name : '?');
    }
    return { count: profiles.length, xp, words, names };
  } catch {
    return null; // запись повреждена
  }
}

/** Метка копии «до покупки»: та же сводка, что у обычных копий, плюс сама покупка. */
export function purchaseArchiveMetaOf(
  raw: string,
  meta: Omit<PurchaseArchiveMeta, 'bytes' | 'profiles' | 'xp'>,
): PurchaseArchiveMeta {
  const s = readRecord(raw);
  return {
    ...meta,
    bytes: raw.length,
    profiles: s ? s.count : null,
    xp: s ? s.xp : null,
  };
}

export function snapshotMetaOf(raw: string, slot: number, at: number): SnapshotMeta {
  const s = readRecord(raw);
  return {
    slot,
    at,
    bytes: raw.length,
    profiles: s ? s.count : null,
    xp: s ? s.xp : null,
    names: s ? s.names : [],
  };
}

/**
 * Частично испорченная метка копии «до покупки» не должна ломать чтение сейфа:
 * обязательные поля проверены, остальные аккуратно достраиваем.
 */
function normalizePurchaseMeta(raw: unknown): PurchaseArchiveMeta | null {
  if (!isPurchaseArchiveMeta(raw)) return null;
  return {
    ...raw,
    kind: raw.kind ?? 'buy',
    label: raw.label.trim() || 'покупка',
    profileName: typeof raw.profileName === 'string' ? raw.profileName : '',
    gemsAfter: typeof raw.gemsAfter === 'number' ? raw.gemsAfter : raw.gemsBefore,
    profiles: typeof raw.profiles === 'number' ? raw.profiles : null,
    xp: typeof raw.xp === 'number' ? raw.xp : null,
    bytes: typeof raw.bytes === 'number' ? raw.bytes : 0,
  };
}

/**
 * Запись «хуже» предыдущей — значит, перезаписывать без копии нельзя:
 * удалили профиль, сбросили прогресс или состояние вовсе опустело.
 */
export function isDestructive(prev: RecordSummary | null, next: RecordSummary | null): boolean {
  if (next === null) return false;
  if (prev === null) return false; // предыдущую не понять — ориентируемся по времени
  return next.count < prev.count || next.xp < prev.xp || next.words < prev.words;
}

/** Свободный слот, а если заняты — самый старый (кольцо). */
export function nextSlot(snapshots: SnapshotMeta[], slots = SNAPSHOT_SLOTS): number {
  for (let slot = 1; slot <= slots; slot++) {
    if (!snapshots.some((s) => s.slot === slot)) return slot;
  }
  const oldest = snapshots.reduce((a, b) => (a.at <= b.at ? a : b));
  return oldest.slot;
}

/** Копию в слот записываем поверх прежней: слотов три, лишнее отбрасываем. */
export function upsertSnapshot(snapshots: SnapshotMeta[], meta: SnapshotMeta): SnapshotMeta[] {
  const rest = snapshots.filter((s) => s.slot !== meta.slot);
  return [...rest, meta].sort((a, b) => a.at - b.at).slice(-SNAPSHOT_SLOTS);
}

export interface SnapshotDecision {
  needed: boolean;
  slot: number;
  reason: 'destructive' | 'time' | 'unreadable' | null;
}

/**
 * Решение: делать ли копию текущей записи перед перезаписью.
 *
 * Копия нужна всегда, когда прошлое «богаче» нового, и иногда — просто по
 * времени, чтобы была точка отката не только для катастроф.
 */
export function snapshotDecision(args: {
  prev: string | null;
  next: string;
  snapshots: SnapshotMeta[];
  lastAt: number | null;
  now: number;
}): SnapshotDecision {
  const { prev, next, snapshots, lastAt, now } = args;
  const slot = nextSlot(snapshots);
  if (!prev || prev === next) return { needed: false, slot, reason: null };

  const prevSummary = readRecord(prev);
  // Старую запись не удаётся разобрать — она может быть ещё восстановима,
  // поэтому перед затиранием её обязательно сохраняем как есть.
  if (prevSummary === null) return { needed: true, slot, reason: 'unreadable' };

  const nextSummary = readRecord(next);
  if (isDestructive(prevSummary, nextSummary)) return { needed: true, slot, reason: 'destructive' };
  if (lastAt !== null && now - lastAt < SNAPSHOT_MIN_INTERVAL_MS) {
    return { needed: false, slot, reason: null };
  }
  // Пустое состояние копировать незачем: слоты нужны для того, что можно вернуть.
  if (nextSummary && nextSummary.count === 0) return { needed: false, slot, reason: null };
  // Копия, ничем не отличающаяся от предыдущей, только занимает слот.
  const newest = snapshots.length ? snapshots.reduce((a, b) => (a.at >= b.at ? a : b)) : null;
  if (newest && nextSummary && newest.profiles === nextSummary.count && newest.xp === nextSummary.xp) {
    return { needed: false, slot, reason: null };
  }
  return { needed: true, slot, reason: 'time' };
}

// ── Санитайзер импорта ───────────────────────────────────────────────────────

function isTrashed(x: unknown): x is TrashedProfile {
  const t = x as TrashedProfile;
  return !!t && typeof t.at === 'number' && !!t.profile && typeof t.profile.id === 'string';
}

function isLogEntry(x: unknown): x is LogEntry {
  const e = x as LogEntry;
  return !!e && typeof e.at === 'number' && typeof e.kind === 'string';
}

function isSnapshotMeta(x: unknown): x is SnapshotMeta {
  const s = x as SnapshotMeta;
  return !!s && typeof s.slot === 'number' && typeof s.at === 'number';
}

function isPurchaseArchiveMeta(x: unknown): x is PurchaseArchiveMeta {
  const p = x as PurchaseArchiveMeta;
  return (
    !!p &&
    typeof p.at === 'number' &&
    Number.isFinite(p.at) &&
    typeof p.label === 'string' &&
    typeof p.profileId === 'string' &&
    typeof p.price === 'number' &&
    typeof p.gemsBefore === 'number'
  );
}

export function normalizeVault(raw: unknown): VaultState {
  const v = (raw ?? {}) as Partial<VaultState>;
  return {
    trash: Array.isArray(v.trash) ? v.trash.filter(isTrashed).slice(-TRASH_MAX) : [],
    log: Array.isArray(v.log)
      ? v.log.filter(isLogEntry).sort((a, b) => a.at - b.at).slice(-LOG_MAX)
      : [],
    snapshots: Array.isArray(v.snapshots) ? v.snapshots.filter(isSnapshotMeta).slice(0, SNAPSHOT_SLOTS) : [],
    lastExportAt: typeof v.lastExportAt === 'number' && Number.isFinite(v.lastExportAt) ? v.lastExportAt : null,
    // Битые метки не повод терять сейф: просто считаем, что копии нет.
    purchase: normalizePurchaseMeta(v.purchase),
  };
}

/** «5 минут назад», «2 часа назад», «3 дня назад» — для списка копий и журнала. */
export function agoLabel(at: number, now = Date.now()): string {
  const sec = Math.max(0, Math.round((now - at) / 1000));
  if (sec < 45) return 'только что';
  const min = Math.round(sec / 60);
  if (min < 60) return `${pluralRu(min, 'минуту', 'минуты', 'минут')} назад`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${pluralRu(hours, 'час', 'часа', 'часов')} назад`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${pluralRu(days, 'день', 'дня', 'дней')} назад`;
  return new Date(at).toLocaleDateString('ru-RU');
}

/** Русские склонения — своя мини-версия, чтобы engine/ не тянул за собой ui/. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? few : many;
  return `${n} ${form}`;
}

/** Подпись события журнала человеческими словами. */
export const LOG_LABEL: Record<LogKind, string> = {
  boot: 'приложение открыто',
  'hydrate-ok': 'прогресс прочитан',
  'hydrate-error': 'прогресс не удалось прочитать',
  'write-error': 'не удалось сохранить',
  'write-blocked': 'запись приостановлена',
  snapshot: 'сделана резервная копия',
  'restore-snapshot': 'восстановлено из копии',
  'profile-delete': 'профиль удалён',
  'profile-reset': 'прогресс сброшен',
  'profile-restore': 'профиль восстановлен',
  import: 'загружен файл',
  export: 'сохранён файл',
  'fresh-start': 'начато заново',
  'persist-on': 'защита от очистки включена',
  'persist-off': 'защита от очистки недоступна',
  purchase: 'копия перед покупкой',
  'purchase-failed': 'покупка не сохранилась — отменена',
  'purchase-restore': 'возврат к состоянию до покупки',
};
