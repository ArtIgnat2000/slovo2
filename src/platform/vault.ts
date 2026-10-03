// Сейф прогресса на уровне браузера: ключи IndexedDB и «сторож» записи.
//
// Сторож — тонкий слой между zustand и IndexedDB. Он делает две вещи:
//   1) не даёт писать, пока мы не убедились, что сохранённое прочитали
//      (иначе пустой старт затирает старую запись — см. docs/progress-loss-audit.md);
//   2) перед перезаписью снимает копию прежней записи, если новое состояние
//      «беднее» или если пора сделать точку отката по времени.
import type { StateStorage } from 'zustand/middleware';
import { idbStorage } from './storage';
import { snapshotDecision, snapshotMetaOf, type SnapshotMeta } from '../engine/vault';

/** Основная запись прогресса (её пишет zustand persist). */
export const MAIN_KEY = 'slovo2';
/** Копии живут отдельными ключами: основная запись остаётся совместимой. */
export const snapshotKey = (slot: number) => `slovo2.snap.${slot}`;

export async function readSnapshot(slot: number): Promise<string | null> {
  try {
    return (await idbStorage.getItem(snapshotKey(slot))) ?? null;
  } catch {
    return null;
  }
}

export async function writeSnapshot(slot: number, raw: string): Promise<void> {
  await idbStorage.setItem(snapshotKey(slot), raw);
}

export async function clearSnapshot(slot: number): Promise<void> {
  try {
    await idbStorage.removeItem(snapshotKey(slot));
  } catch {
    /* копия уже недоступна — не повод ронять приложение */
  }
}

/** Сводка о записи: нужна, чтобы интерфейс мог показать родителю результат. */
export interface GuardReport {
  status: 'ok' | 'blocked' | 'error';
  at: number;
  message?: string;
  snapshot?: SnapshotMeta;
}

export interface GuardOptions {
  /** Писать запрещено: приложение ещё не подтвердило, что прочитало сохранённое. */
  isFrozen: () => boolean;
  /** Метки уже снятых копий — чтобы выбрать слот и не плодить одинаковые. */
  snapshots: () => SnapshotMeta[];
  /** Куда сообщать о результате (в отдельный стор, не в сохраняемое состояние). */
  report: (r: GuardReport) => void;
}

function lastSnapshotAt(snapshots: SnapshotMeta[]): number | null {
  if (!snapshots.length) return null;
  return snapshots.reduce((a, b) => (a.at >= b.at ? a : b)).at;
}

/**
 * Обёртка над хранилищем: чтение как есть, запись — через сторож.
 *
 * Ошибки здесь НЕ пробрасываются наружу: zustand вызывает `setItem`
 * без обработки результата, и непойманное отклонение промиса означало бы,
 * что пользователь видит успех там, где данные не сохранились.
 */
/**
 * Очередь записей.
 *
 * Каждая запись — это «прочитать прежнее, снять копию, записать новое». Без
 * очереди две быстрые записи читали бы одно и то же прежнее состояние, и та,
 * что закончит позже, затёрла бы правки первой (два ответа подряд — и минус
 * XP). Поэтому записи выстраиваются в цепочку: каждая следующая видит уже
 * обновлённую запись.
 */
export function createGuardedStorage(opts: GuardOptions): StateStorage {
  let queue: Promise<void> = Promise.resolve();

  const writeOnce = async (name: string, value: string): Promise<void> => {
    const now = Date.now();
      if (opts.isFrozen()) {
        opts.report({ status: 'blocked', at: now });
        return;
      }
      let prev: string | null = null;
      try {
        prev = await idbStorage.getItem(name);
      } catch {
        prev = null; // прочитать не удалось — копию снять не сможем, но и не упадём
      }

      if (prev && prev !== value) {
        const decision = snapshotDecision({
          prev,
          next: value,
          snapshots: opts.snapshots(),
          lastAt: lastSnapshotAt(opts.snapshots()),
          now,
        });
        if (decision.needed) {
          // Копия важна, но не важнее текущей записи: если её не вышло снять,
          // всё равно сохраняем свежее состояние.
          try {
            await writeSnapshot(decision.slot, prev);
            opts.report({ status: 'ok', at: now, snapshot: snapshotMetaOf(prev, decision.slot, now) });
          } catch (e) {
            opts.report({ status: 'ok', at: now, message: `копию снять не удалось: ${text(e)}` });
          }
        }
      }

      try {
        await idbStorage.setItem(name, value);
        opts.report({ status: 'ok', at: now });
      } catch (e) {
        opts.report({ status: 'error', at: now, message: text(e) });
      }
  };

  return {
    getItem: (name) => idbStorage.getItem(name),

    setItem(name, value) {
      queue = queue.then(() => writeOnce(name, value));
      return queue;
    },

    removeItem: (name) => idbStorage.removeItem(name),
  };
}

// ── Несколько открытых копий приложения ───────────────────────────────────────
// Две вкладки (или ярлык на экране и браузер) держат в памяти своё состояние и
// пишут запись целиком: без синхронизации проснувшаяся вкладка затирает свежий
// прогресс. Договариваемся через BroadcastChannel: кто записал — тот сказал.

const CHANNEL_NAME = 'slovo2';
const CLIENT_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel) return channel;
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

/** Сообщаем другим открытым копиям: запись обновилась, пора перечитать. */
export function broadcastChange(): void {
  try {
    getChannel()?.postMessage({ type: 'changed', from: CLIENT_ID });
  } catch {
    /* без канала просто живём как раньше */
  }
}

/** Подписка на изменения из другой копии. Возвращает отписку. */
export function onExternalChange(cb: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMessage = (e: MessageEvent) => {
    if ((e.data as { type?: string; from?: string })?.from === CLIENT_ID) return;
    if ((e.data as { type?: string })?.type !== 'changed') return;
    cb();
  };
  ch.addEventListener('message', onMessage);
  return () => ch.removeEventListener('message', onMessage);
}

function text(e: unknown): string {
  const err = e as { name?: string; message?: string } | null;
  return err?.name ? `${err.name}: ${err?.message ?? ''}`.trim() : String(e);
}
