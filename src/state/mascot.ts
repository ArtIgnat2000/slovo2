import { create } from 'zustand';
import { pluralRu } from '../engine/vault';
import type { Mood } from '../ui/Mascot';

interface MascotState {
  mood: Mood;
  message: string;
  say: (mood: Mood, message: string, ms?: number) => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useMascot = create<MascotState>((set) => ({
  mood: 'idle',
  message: '',
  say: (mood, message, ms = 2600) => {
    set({ mood, message });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ mood: 'idle', message: '' }), ms);
  },
}));

export const PRAISE = ['Молодец!', 'Так держать!', 'Супер!', 'Ты звезда!', 'Отлично!', 'Верно!'];
export const CHEER = ['Не расстраивайся!', 'В следующий раз получится!', 'Ошибки — это нормально!', 'Давай ещё раз!'];

/**
 * Реплики на тап по плавающему БУКу (2026-10-04). Короткие, без вопросов и без
 * обещаний наград: ребёнок просто получает отклик, а не «кнопку с призом».
 */
export const POKE_PHRASES = [
  'Уи! 🪶',
  'Привет-привет!',
  'Хо-хо!',
  'Я тут!',
  'Щекотно!',
  'Пёрышки дыбом!',
  'Ты молодец!',
  'Полетели учиться?',
];
/** Пятый тап подряд — БУК не выдерживает и танцует (без наград: это не экономика). */
export const POKE_TICKLE = 'Ух, щекотно! 🪶';

/**
 * Что БУК говорит «по делу», когда его гладят: цель дня, серия, освоенные слова.
 * Врать и торопить нельзя — если сказать нечего, лучше промолчать и остаться
 * просто откликом: БУК не превращается в автомат с подсказками и наградами.
 */
export function statusLine(xpToday: number, goal: number, mastered: number, streak: number): string | null {
  if (goal > 0 && xpToday >= goal) return 'Цель дня закрыта! 🎉';
  // pluralRu уже включает число: «4 дня», «5 дней», «21 день»
  if (streak >= 3) return `Серия ${pluralRu(streak, 'день', 'дня', 'дней')} — не теряй! 🔥`;
  if (goal > 0 && xpToday > 0) return `До цели дня ещё ${Math.max(1, Math.round(goal - xpToday))} ⚡`;
  if (mastered > 0) return `Ты уже знаешь ${pluralRu(mastered, 'слово', 'слова', 'слов')}!`;
  return null;
}

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
