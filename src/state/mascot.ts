import { create } from 'zustand';
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

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
