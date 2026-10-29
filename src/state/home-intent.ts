import { create } from 'zustand';

/**
 * Разовая команда «главной» от навигатора БУКа (0.85.0): дверь «🎁 Задания»
 * переключает вкладку на главную и просит открыть лист заданий. HomeScreen
 * монтируется (или уже стоит) и выполняет команду один раз — дальше nonce
 * замалчивает её, чтобы лист не открывался заново при каждой перерисовке.
 *
 * Отдельный немасштабируемый стор, а не поле useApp: сохраняемое состояние
 * профиля не должно пополняться служебными ключами (docs/progress-loss-audit.md).
 */
interface HomeIntentState {
  /** Растёт на каждую команду — сигнал «есть новое поручение». */
  nonce: number;
  intent: 'rewards' | null;
  fire: (intent: 'rewards') => void;
  clear: () => void;
}

export const useHomeIntent = create<HomeIntentState>((set) => ({
  nonce: 0,
  intent: null,
  fire: (intent) => set((s) => ({ nonce: s.nonce + 1, intent })),
  clear: () => set({ intent: null }),
}));
