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
 * Секрет: если подержать палец на сове, она кружится и отвечает особой репликой.
 * Это «пасхалка», а не команда: приложение остаётся понятным и без неё.
 */
export const SECRET_PHRASES = ['Секрет! 🤫', 'Закружился! 🌀', 'Крылышки вверх! 🪶', 'Ай! 🪶'];

/**
 * Один раз за сессию БУК здоровается по времени суток. Намеренно без «поздно,
 * пора спать»: режим дня — решение взрослого, а не совы (см. docs/mascot-interactivity.md).
 * Приветствие не должно затирать реплику, которая уже висит на экране.
 */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Доброе утро! ☀️';
  if (hour >= 11 && hour < 18) return 'Привет! 👋';
  if (hour >= 18 && hour < 22) return 'Добрый вечер! 🌆';
  return 'Тсс, все спят… 🤫';
}

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
