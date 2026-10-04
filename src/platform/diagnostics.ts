import { readRecord } from '../engine/vault';
import { checkPersistence, idbStorage } from './storage';
import { MAIN_KEY, snapshotKey } from './vault';

export interface SnapshotDiagnostic {
  slot: number;
  present: boolean;
  at: number | null;
  bytes: number | null;
  profiles: number | null;
  error: string | null;
}

export interface StorageDiagnosticReport {
  checkedAt: number;
  indexedDbAvailable: boolean;
  indexedDbError: string | null;
  record: {
    status: 'present' | 'missing' | 'corrupt' | 'unreadable';
    bytes: number | null;
    profiles: number | null;
    words: number | null;
    xp: number | null;
  };
  snapshots: SnapshotDiagnostic[];
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

interface SnapshotMeta {
  slot: number;
  at: number;
  profiles: number | null;
  bytes: number;
}

function errorText(error: unknown): string {
  const value = error as { name?: unknown; message?: unknown } | null;
  if (value && typeof value === 'object' && typeof value.message === 'string') {
    return `${typeof value.name === 'string' ? `${value.name}: ` : ''}${value.message}`;
  }
  return String(error);
}

function utf8Bytes(value: string): number {
  try {
    return new TextEncoder().encode(value).byteLength;
  } catch {
    try {
      return new Blob([value]).size;
    } catch {
      return value.length * 2;
    }
  }
}

function snapshotMetaFrom(raw: string | null): Map<number, SnapshotMeta> {
  const result = new Map<number, SnapshotMeta>();
  if (!raw) return result;
  try {
    const state = (JSON.parse(raw) as { state?: { vault?: { snapshots?: unknown } } })?.state;
    const snapshots = state?.vault?.snapshots;
    if (!Array.isArray(snapshots)) return result;
    for (const item of snapshots) {
      if (!item || typeof item !== 'object') continue;
      const meta = item as Partial<SnapshotMeta>;
      if (
        typeof meta.slot === 'number' && meta.slot >= 1 && meta.slot <= 3 &&
        typeof meta.at === 'number' && Number.isFinite(meta.at)
      ) {
        result.set(meta.slot, {
          slot: meta.slot,
          at: meta.at,
          profiles: typeof meta.profiles === 'number' ? meta.profiles : null,
          bytes: typeof meta.bytes === 'number' ? meta.bytes : 0,
        });
      }
    }
  } catch {
    // Битая основная запись не должна мешать проверить сами слоты копий.
  }
  return result;
}

/**
 * Считывает только метаданные прогресса для экрана `?diag=1`.
 * Содержимое профилей, имена и сами копии не выводятся и никуда не отправляются.
 */
export async function inspectStorage(): Promise<StorageDiagnosticReport> {
  const checkedAt = Date.now();
  let mainRaw: string | null = null;
  let mainError: string | null = null;
  let usage: number | null = null;
  let quota: number | null = null;

  try {
    mainRaw = await idbStorage.getItem(MAIN_KEY);
  } catch (error) {
    mainError = errorText(error);
  }

  const metas = snapshotMetaFrom(mainRaw);
  const snapshots: SnapshotDiagnostic[] = [];
  for (let slot = 1; slot <= 3; slot++) {
    const meta = metas.get(slot);
    try {
      const raw = await idbStorage.getItem(snapshotKey(slot));
      const summary = raw ? readRecord(raw) : null;
      snapshots.push({
        slot,
        present: raw !== null,
        at: meta?.at ?? null,
        bytes: raw === null ? (meta?.bytes || null) : utf8Bytes(raw),
        profiles: summary?.count ?? meta?.profiles ?? null,
        error: null,
      });
    } catch (error) {
      snapshots.push({
        slot,
        present: false,
        at: meta?.at ?? null,
        bytes: meta?.bytes || null,
        profiles: meta?.profiles ?? null,
        error: errorText(error),
      });
    }
  }

  let persisted: boolean | null = null;
  try {
    persisted = await checkPersistence();
  } catch {
    persisted = null;
  }

  try {
    const estimate = await navigator.storage?.estimate?.();
    if (typeof estimate?.usage === 'number') usage = estimate.usage;
    if (typeof estimate?.quota === 'number') quota = estimate.quota;
  } catch {
    // Оценка места поддерживается не всеми браузерами.
  }

  const summary = mainRaw ? readRecord(mainRaw) : null;
  const recordStatus = mainError
    ? 'unreadable'
    : mainRaw === null
      ? 'missing'
      : summary
        ? 'present'
        : 'corrupt';

  return {
    checkedAt,
    indexedDbAvailable: mainError === null,
    indexedDbError: mainError,
    record: {
      status: recordStatus,
      bytes: mainRaw === null ? null : utf8Bytes(mainRaw),
      profiles: summary?.count ?? null,
      words: summary?.words ?? null,
      xp: summary?.xp ?? null,
    },
    snapshots,
    persisted,
    usage,
    quota,
  };
}
