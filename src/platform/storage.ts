import { openDB } from 'idb';
import type { StateStorage } from 'zustand/middleware';

/**
 * Прогресс живёт в IndexedDB: она не ограничена 5 МБ, как localStorage,
 * и не вытесняется браузером при нехватке места.
 */
const DB_NAME = 'slovo2';
const STORE = 'kv';

const dbPromise = () =>
  openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    },
  });

export const idbStorage: StateStorage = {
  async getItem(name) {
    const db = await dbPromise();
    return (await db.get(STORE, name)) ?? null;
  },
  async setItem(name, value) {
    const db = await dbPromise();
    await db.put(STORE, value, name);
  },
  async removeItem(name) {
    const db = await dbPromise();
    await db.delete(STORE, name);
  },
};

/** Просим браузер не вытеснять наши данные (важно для iOS: кеш чистится ~через 7 дней). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const has = await navigator.storage.persisted?.();
      if (has) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Резервная копия прогресса — файл (для родительского раздела). */
export function download(filename: string, data: string, type = 'application/json') {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
