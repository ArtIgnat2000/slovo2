// Состояние хранилища — отдельный стор БЕЗ сохранения.
//
// Почему не внутри основного стора: zustand пишет состояние на каждое
// изменение, поэтому «записать, что запись удалась» породило бы бесконечный
// цикл. Диагностика живёт в памяти сессии — ей там и место.
import { create } from 'zustand';

export type StorageKind =
  | 'boot' // ещё не читали
  | 'ok' // читается и пишется
  | 'read-error' // сохранённое не удалось прочитать — запись приостановлена
  | 'write-error'; // прочитать удалось, но запись не проходит

export interface StorageHealth {
  kind: StorageKind;
  /** Человеческое объяснение — показываем родителю, а не в консоль. */
  message: string | null;
  /** Запись приостановлена, пока не выясним, что сохранённое прочитано. */
  frozen: boolean;
  lastWriteAt: number | null;
  lastError: string | null;
  /** Сколько записей не состоялось из-за заморозки — для диагностики. */
  blockedWrites: number;
  /** Результат navigator.storage.persisted(): null — браузер не отвечает. */
  persisted: boolean | null;
  hydratedAt: number | null;
}

interface HealthActions {
  patch: (p: Partial<StorageHealth>) => void;
}

export const useStorageHealth = create<StorageHealth & HealthActions>((set) => ({
  kind: 'boot',
  message: null,
  // Пока не прочитали сохранённое — не пишем ничего: пустой старт не должен
  // затирать старую запись (docs/progress-loss-audit.md, сценарии 2–4).
  frozen: true,
  lastWriteAt: null,
  lastError: null,
  blockedWrites: 0,
  persisted: null,
  hydratedAt: null,
  patch: (p) => set(p),
}));
