import { nextAdaptiveState, type Outcome } from '../engine/adaptive';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DailyState, DayStat, LessonSize, LessonState, Profile, ShopState, ShopSlot, WordState } from '../types';
import { applyAnswer, initState } from '../engine/srs';
import { idbStorage } from '../platform/storage';
import { GEMS_PER_STREAK, levelOf } from '../engine/rewards';
import { dayKey, prevDay } from '../engine/day';
import {
  allQuestsDone,
  buildDayPlan,
  CHEST_GEMS,
  dayMetrics,
  plannedQuests,
  planOf,
  type Chest,
  type PlannedQuest,
} from '../engine/quests';
import { ITEM_BY_ID, isOwned } from '../engine/shop';
import { DEFAULT_LESSON_SIZE } from '../engine/scheduler';

export { dayKey };

export interface Settings {
  sound: boolean;
  haptics: boolean;
  dailyGoal: number; // XP в день
  theme: 'auto' | 'light' | 'dark';
}

const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, dailyGoal: 120, theme: 'auto' };

/** Показываем поверх любого экрана: «+30 XP», «Сундук: 15 💎» */
export interface Toast {
  id: number;
  emoji: string;
  title: string;
  text?: string;
}

function emptyDay(): DayStat {
  return { xp: 0, correct: 0, wrong: 0, lessons: 0, flawless: 0, reviewCorrect: 0, reviewWords: [] };
}

/** Старые записи дня (до заданий дня) не имеют полей серии — достраиваем на чтении. */
function readDay(p: Profile, day: string): DayStat {
  return { ...emptyDay(), ...(p.days[day] ?? {}) };
}

/** Состояние заданий дня; если профиль «переехал» на новый день — начинаем день заново. */
function readDaily(p: Profile): DailyState {
  const today = dayKey();
  const st = p.daily;
  if (!st || st.day !== today) {
    // План заданий нового дня фиксируем здесь — до первого ответа: «Повтори N слов»
    // заменяется другим заданием, если ребёнку ещё нечего повторять (см. buildDayPlan).
    return {
      day: today,
      claimed: [],
      chestsToday: 0,
      chestsTotal: st?.chestsTotal ?? 0,
      plan: buildDayPlan(p, today),
    };
  }
  if (!st.plan?.length) return { ...st, plan: buildDayPlan(p, today) };
  return st;
}

/** Гардероб БУКа; у профилей до магазина поля нет — достраиваем пустое. */
function readShop(p: Profile): ShopState {
  return { owned: p.shop?.owned ?? [], equipped: p.shop?.equipped ?? {} };
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
    lessonSize: DEFAULT_LESSON_SIZE,
    daily: { day: dayKey(), claimed: [], chestsToday: 0, chestsTotal: 0 },
    shop: { owned: [], equipped: {} },
  };
}

interface AppState {
  profiles: Profile[];
  activeId: string | null;
  settings: Settings;
  toast: Toast | null;

  createProfile: (name: string, avatar: string) => void;
  selectProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string, avatar: string) => void;

  touchDay: () => void;
  answer: (wordId: string, quality: number, review?: boolean) => void;
  finishLesson: (lessonId: string, pct: number) => void;
  addXp: (n: number) => void;
  addGems: (n: number) => void;
  addFreeze: (n: number) => void;
  grantAchievement: (id: string) => void;

  /** Забрать награду за выполненные задания дня (кристаллы) */
  claimQuest: (id: string, gems: number) => void;
  /** Открыть сундук БУКа; возвращает false, если он уже открыт или ещё не готов */
  openChest: (chest: Chest) => boolean;

  /** Купить аксессуар у БУКа. Возвращает false, если кристаллов не хватает. */
  buyItem: (id: string) => boolean;
  /** Надеть/снять аксессуар: повторный тап по надетой вещи снимает её */
  toggleEquip: (id: string) => void;

  showToast: (t: Omit<Toast, 'id'>) => void;
  hideToast: () => void;

  resetProfile: (id: string) => void;
  replaceAll: (data: { profiles: Profile[]; activeId: string | null; settings: Settings }) => void;
  setSettings: (patch: Partial<Settings>) => void;
  /** Изменить размер базовой очереди урока для текущего профиля. */
  setLessonSize: (size: LessonSize) => void;
  adaptLesson: (profileId: string, ceiling: number, outcome: Outcome) => void;
}

function patchActive(s: AppState, fn: (p: Profile) => Profile): Partial<AppState> {
  if (!s.activeId) return {};
  return { profiles: s.profiles.map((p) => (p.id === s.activeId ? fn(p) : p)) };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: null,
      settings: DEFAULT_SETTINGS,
      toast: null,

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

      answer: (wordId, quality, review = false) =>
        set((s) =>
          patchActive(s, (p) => {
            const prev: WordState = p.words[wordId] ?? initState();
            const next = applyAnswer(prev, quality);
            const today = dayKey();
            const day = readDay(p, today);
            const ok = quality >= 3;
            // Задание «Повтори N слов» считает потренированные слова: ошибка в повторении
            // не «замораживает» счётчик (точность измеряет задание «без ошибок»).
            const doneWords = day.reviewWords ?? [];
            const reviewWords = review && !doneWords.includes(wordId) ? [...doneWords, wordId] : doneWords;
            return {
              ...p,
              // План дня фиксируется здесь же (readDaily), до того как слово изменит состояние
              daily: readDaily(p),
              words: { ...p.words, [wordId]: next },
              errors: ok ? p.errors : { ...p.errors, [wordId]: (p.errors[wordId] ?? 0) + 1 },
              days: {
                ...p.days,
                [today]: {
                  ...day,
                  correct: day.correct + (ok ? 1 : 0),
                  wrong: day.wrong + (ok ? 0 : 1),
                  // задание «без ошибок»: считаем лучшую серию за день
                  flawless: ok ? day.flawless + 1 : 0,
                  reviewCorrect: day.reviewCorrect + (ok && review ? 1 : 0),
                  reviewWords,
                },
              },
            };
          }),
        ),

      finishLesson: (lessonId, pct) =>
        set((s) =>
          patchActive(s, (p) => {
            const cur: LessonState = p.lessons[lessonId] ?? { level: 0, best: 0, doneAt: 0, plays: 0 };
            const today = dayKey();
            const day = readDay(p, today);
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
            const day = readDay(p, today);
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

      addGems: (n) =>
        set((s) =>
          patchActive(s, (p) => (n === 0 ? p : { ...p, gems: Math.max(0, p.gems + n) })),
        ),

      addFreeze: (n) =>
        set((s) =>
          patchActive(s, (p) => (n === 0 ? p : { ...p, freezes: Math.max(0, p.freezes + n) })),
        ),

      claimQuest: (id, gems) =>
        set((s) =>
          patchActive(s, (p) => {
            const daily = readDaily(p);
            if (daily.claimed.includes(id)) return p;
            return {
              ...p,
              gems: p.gems + gems,
              daily: { ...daily, claimed: [...daily.claimed, id] },
            };
          }),
        ),

      openChest: (chest) => {
        const current = getActive(get());
        const today = dayKey();
        if (!current) return false;
        const daily = readDaily(current);
        const ready = allQuestsDone(planOf(current, today), dayMetrics(current.days[today]));
        // Защита от двойного тапа и от выдачи награды до трёх ключей.
        if (
          daily.chestsToday > 0 ||
          !ready ||
          !Number.isFinite(chest.gems) ||
          !Number.isFinite(chest.xp) ||
          !Number.isFinite(chest.freezes) ||
          chest.gems < CHEST_GEMS ||
          chest.xp < 0 ||
          chest.freezes < 0
        ) {
          return false;
        }

        let opened = false;
        set((s) =>
          patchActive(s, (p) => {
            const freshDaily = readDaily(p);
            // Повторно проверяем внутри обновления: состояние могло измениться
            // между чтением и записью при быстром двойном тапе.
            if (freshDaily.chestsToday > 0) return p;
            opened = true;
            const day = readDay(p, today);
            return {
              ...p,
              gems: p.gems + chest.gems,
              freezes: p.freezes + chest.freezes,
              days: { ...p.days, [today]: { ...day, xp: day.xp + chest.xp } },
              xp: p.xp + chest.xp,
              daily: {
                ...freshDaily,
                chestsToday: 1,
                chestsTotal: freshDaily.chestsTotal + 1,
                lastChest: { ...chest },
              },
            };
          }),
        );
        return opened;
      },

      buyItem: (id) => {
        const item = ITEM_BY_ID[id];
        const p = getActive(get());
        if (!item || !p || isOwned(readShop(p).owned, id) || p.gems < item.price) return false;
        set((s) =>
          patchActive(s, (prof) => {
            const shop = readShop(prof);
            return {
              ...prof,
              gems: prof.gems - item.price,
              shop: {
                owned: [...shop.owned, id],
                // купленное сразу надевается — ребёнку не нужно ещё раз тапать
                equipped: { ...shop.equipped, [item.slot]: id },
              },
            };
          }),
        );
        return true;
      },

      toggleEquip: (id) =>
        set((s) =>
          patchActive(s, (prof) => {
            const item = ITEM_BY_ID[id];
            const shop = readShop(prof);
            if (!item || !isOwned(shop.owned, id)) return prof;
            const equipped: ShopState['equipped'] = { ...shop.equipped };
            if (equipped[item.slot] === id) delete equipped[item.slot];
            else equipped[item.slot] = id;
            return { ...prof, shop: { ...shop, equipped } };
          }),
        ),

      showToast: (t) => set({ toast: { ...t, id: Date.now() } }),
      hideToast: () => set({ toast: null }),

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

      adaptLesson: (profileId, ceiling, outcome) => set((s) => ({
        profiles: s.profiles.map((p) => {
          if (p.id !== profileId) return p;
          const next = nextAdaptiveState({ cards: p.adaptiveCards, good: p.adaptiveGood }, ceiling, outcome);
          return { ...p, adaptiveCards: next.cards, adaptiveGood: next.good };
        }),
      })),
      setLessonSize: (size) =>
        set((s) => patchActive(s, (p) => ({ ...p, lessonSize: size, adaptiveGood: 0 }))),
    }),
    {
      name: 'slovo2',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);

// ── Селекторы ────────────────────────────────────────────────────────────────

/**
 * Задания сегодняшнего дня для профиля: шаблон + цель из зафиксированного плана.
 * План не пересчитывается на лету — иначе цель менялась бы посреди дня.
 */
export function dayPlan(profile: Profile | null): PlannedQuest[] {
  return profile ? plannedQuests(planOf(profile)) : [];
}

export function useActiveProfile(): Profile | null {
  return useApp((s) => s.profiles.find((p) => p.id === s.activeId) ?? null);
}

export function todayStat(p: Profile | null): DayStat {
  if (!p) return emptyDay();
  return { ...emptyDay(), ...(p.days[dayKey()] ?? {}) };
}

export function masteredCount(p: Profile | null): number {
  if (!p) return 0;
  return Object.values(p.words).filter((w) => w.s >= 90).length;
}

export function levelOfProfile(p: Profile | null): number {
  return levelOf(p?.xp ?? 0);
}

export const getState = () => useApp.getState();

function getActive(s: AppState): Profile | null {
  return s.profiles.find((p) => p.id === s.activeId) ?? null;
}

/**
 * Запасной пустой гардероб. Вынесен в константу нарочно: zustand 5 передаёт
 * селектор прямо в useSyncExternalStore и сравнивает результат по ссылке.
 * Литерал `{}` внутри селектора создавал новый объект на каждый вызов, и React,
 * не дождавшись стабильного снимка, уходил в бесконечный цикл перерисовок
 * (на проде — «Minified React error #185»): на первом запуске, пока профиля ещё
 * нет, приложение падало с пустым #root. Отсюда и «пустой экран» на Pages.
 */
const NO_LOOK: Partial<Record<ShopSlot, string>> = {};

/** Что надето на БУКа в активном профиле — для маскота и магазина. */
export function useLook(): Partial<Record<ShopSlot, string>> {
  return useApp((s) => {
    const p = s.profiles.find((x) => x.id === s.activeId);
    return p?.shop?.equipped ?? NO_LOOK;
  });
}
export type { AppState };

export { CHEST_GEMS };
