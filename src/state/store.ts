import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DayStat, LessonState, Profile, WordState } from '../types';
import { applyAnswer, initState } from '../engine/srs';
import { idbStorage } from '../platform/storage';
import { GEMS_PER_STREAK, levelOf } from '../engine/rewards';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  dailyGoal: number; // XP в день
  theme: 'auto' | 'light' | 'dark';
}

const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, dailyGoal: 120, theme: 'auto' };

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(key: string): string {
  const [y, m, dd] = key.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

function newProfile(name: string, avatar: string): Profile {
  return {
    id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    avatar,
    createdAt: Date.now(),
    xp: 0,
    gems: 0,
    streak: 0,
    lastDay: '',
    freezes: 0,
    words: {},
    lessons: {},
    errors: {},
    days: {},
    achievements: [],
  };
}

interface AppState {
  profiles: Profile[];
  activeId: string | null;
  settings: Settings;

  createProfile: (name: string, avatar: string) => void;
  selectProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string, avatar: string) => void;

  touchDay: () => void;
  answer: (wordId: string, quality: number) => void;
  finishLesson: (lessonId: string, pct: number) => void;
  addXp: (n: number) => void;
  grantAchievement: (id: string) => void;

  resetProfile: (id: string) => void;
  replaceAll: (data: { profiles: Profile[]; activeId: string | null; settings: Settings }) => void;
  setSettings: (patch: Partial<Settings>) => void;
}

function patchActive(s: AppState, fn: (p: Profile) => Profile): Partial<AppState> {
  if (!s.activeId) return {};
  return { profiles: s.profiles.map((p) => (p.id === s.activeId ? fn(p) : p)) };
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      profiles: [],
      activeId: null,
      settings: DEFAULT_SETTINGS,

      createProfile: (name, avatar) =>
        set((s) => {
          const p = newProfile(name, avatar);
          return { profiles: [...s.profiles, p], activeId: p.id };
        }),

      selectProfile: (id) => set({ activeId: id }),

      deleteProfile: (id) =>
        set((s) => {
          const profiles = s.profiles.filter((p) => p.id !== id);
          return { profiles, activeId: s.activeId === id ? (profiles[0]?.id ?? null) : s.activeId };
        }),

      renameProfile: (id, name, avatar) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, name, avatar } : p)),
        })),

      /** Отметить, что сегодня занимались — обновляет серию дней. */
      touchDay: () =>
        set((s) =>
          patchActive(s, (p) => {
            const today = dayKey();
            if (p.lastDay === today) return p;
            const y = prevDay(today);
            let streak = p.streak;
            let freezes = p.freezes;
            if (p.lastDay === y) {
              streak = p.streak + 1;
            } else if (p.lastDay === '') {
              streak = 1;
            } else if (freezes > 0 && p.streak >= 3) {
              freezes -= 1; // «заморозка» спасла серию
              streak = p.streak + 1;
            } else {
              streak = 1;
            }
            if (streak > 0 && streak % 7 === 0) freezes += 1;
            return { ...p, streak, freezes, lastDay: today };
          }),
        ),

      answer: (wordId, quality) =>
        set((s) =>
          patchActive(s, (p) => {
            const prev: WordState = p.words[wordId] ?? initState();
            const next = applyAnswer(prev, quality);
            const today = dayKey();
            const day: DayStat = p.days[today] ?? { xp: 0, correct: 0, wrong: 0, lessons: 0 };
            const ok = quality >= 3;
            return {
              ...p,
              words: { ...p.words, [wordId]: next },
              errors: ok ? p.errors : { ...p.errors, [wordId]: (p.errors[wordId] ?? 0) + 1 },
              days: {
                ...p.days,
                [today]: { ...day, correct: day.correct + (ok ? 1 : 0), wrong: day.wrong + (ok ? 0 : 1) },
              },
            };
          }),
        ),

      finishLesson: (lessonId, pct) =>
        set((s) =>
          patchActive(s, (p) => {
            const cur: LessonState = p.lessons[lessonId] ?? { level: 0, best: 0, doneAt: 0, plays: 0 };
            const today = dayKey();
            const day: DayStat = p.days[today] ?? { xp: 0, correct: 0, wrong: 0, lessons: 0 };
            const level = pct >= 60 ? Math.min(5, cur.level + 1) : cur.level;
            return {
              ...p,
              lessons: {
                ...p.lessons,
                [lessonId]: { level, best: Math.max(cur.best, pct), doneAt: Date.now(), plays: cur.plays + 1 },
              },
              days: { ...p.days, [today]: { ...day, lessons: day.lessons + 1 } },
            };
          }),
        ),

      addXp: (n) =>
        set((s) =>
          patchActive(s, (p) => {
            const today = dayKey();
            const day: DayStat = p.days[today] ?? { xp: 0, correct: 0, wrong: 0, lessons: 0 };
            const streakBefore = Math.floor(p.streak / GEMS_PER_STREAK);
            const xp = p.xp + n;
            const streakAfter = Math.floor(p.streak / GEMS_PER_STREAK);
            return {
              ...p,
              xp,
              days: { ...p.days, [today]: { ...day, xp: day.xp + n } },
              gems: p.gems + Math.max(0, streakAfter - streakBefore),
            };
          }),
        ),

      grantAchievement: (id) =>
        set((s) =>
          patchActive(s, (p) =>
            p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] },
          ),
        ),

      resetProfile: (id) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...newProfile(p.name, p.avatar), id: p.id, createdAt: p.createdAt } : p,
          ),
        })),

      replaceAll: (data) => set(data),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'slovo2',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);

// ── Селекторы ────────────────────────────────────────────────────────────────

export function useActiveProfile(): Profile | null {
  return useApp((s) => s.profiles.find((p) => p.id === s.activeId) ?? null);
}

export function todayStat(p: Profile | null): DayStat {
  if (!p) return { xp: 0, correct: 0, wrong: 0, lessons: 0 };
  return p.days[dayKey()] ?? { xp: 0, correct: 0, wrong: 0, lessons: 0 };
}

export function masteredCount(p: Profile | null): number {
  if (!p) return 0;
  return Object.values(p.words).filter((w) => w.s >= 90).length;
}

export function levelOfProfile(p: Profile | null): number {
  return levelOf(p?.xp ?? 0);
}

export const getState = () => useApp.getState();
export type { AppState };
