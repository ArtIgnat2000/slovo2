import { nextAdaptiveState, type Outcome } from '../engine/adaptive';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DailyState, DayStat, LessonSize, LessonState, Profile, ShopState, ShopSlot, ShopTuning, WeeklyState, WordState } from '../types';
import { applyAnswer, initState } from '../engine/srs';
import { idbStorage } from '../platform/storage';
import { GEMS_PER_STREAK, levelOf } from '../engine/rewards';
import { dayKey, prevDay } from '../engine/day';
import { settleWeeklyRewards, weekStartKey, type WeeklyMilestone } from '../engine/weekly-rewards';
import {
  allQuestsDone,
  buildDayPlan,
  bonusChestsReady,
  CHEST_GEMS,
  dailyChestClaimed,
  dayMetrics,
  nextRun,
  plannedQuests,
  planOf,
  rollChest,
  type Chest,
  type ChestKind,
  type PlannedQuest,
} from '../engine/quests';
import { ITEM_BY_ID, isOwned } from '../engine/shop';
import { normalizeTuning, recolor, type RecolorOutcome } from '../engine/tints';
import {
  awardLessonPiece,
  chooseCollecting,
  normalizePuzzle,
  toggleWorn,
  type PuzzleAward,
} from '../engine/puzzles';
import { DEFAULT_LESSON_SIZE } from '../engine/scheduler';
import {
  addTrash,
  emptyVault,
  nextSlot,
  normalizeVault,
  purgeTrash,
  pushLog,
  pushLogDedup,
  readRecord,
  snapshotMetaOf,
  upsertSnapshot,
  type LogKind,
  type SnapshotMeta,
  type VaultState,
} from '../engine/vault';
import {
  broadcastChange,
  createGuardedStorage,
  MAIN_KEY,
  readSnapshot,
  writeSnapshot,
} from '../platform/vault';
import { useStorageHealth } from './health';

export { dayKey };

/**
 * Показывать ли плавающего БУКа: `on` — на всех вкладках, `home` — только на
 * главной, `off` — не показывать. Настройка живёт в родительском разделе и
 * попадает в файл выгрузки: это осознанное решение взрослого, а не мелочь
 * устройства (в отличие от позиции и «свёрнут» — они в localStorage).
 */
export type MascotMode = 'on' | 'home' | 'off';

/**
 * Помощь БУКа в уроке (docs/buk-in-lesson.md): `socratic` — сначала вопрос,
 * потом показ опасного места; `direct` — показывать сразу; `off` — помощника нет.
 */
export type LessonHelpMode = 'socratic' | 'direct' | 'off';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  dailyGoal: number; // XP в день
  theme: 'auto' | 'light' | 'dark';
  mascot: MascotMode;
  lessonHelp: LessonHelpMode;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  dailyGoal: 120,
  theme: 'auto',
  mascot: 'on',
  lessonHelp: 'socratic',
};

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
      bonusChestsClaimed: 0,
      chestsTotal: st?.chestsTotal ?? 0,
      plan: buildDayPlan(p, today),
    };
  }
  const chestsToday = Number.isInteger(st.chestsToday) && st.chestsToday >= 0 ? st.chestsToday : 0;
  const bonusChestsClaimed = Math.min(
    chestsToday,
    Number.isInteger(st.bonusChestsClaimed) && (st.bonusChestsClaimed ?? 0) >= 0
      ? st.bonusChestsClaimed ?? 0
      : 0,
  );
  const lastChestKind: DailyState['lastChestKind'] = st.lastChestKind === 'bonus' ? 'bonus' : 'daily';
  const normalized = { ...st, chestsToday, bonusChestsClaimed, lastChestKind };
  return st.plan?.length ? normalized : { ...normalized, plan: buildDayPlan(p, today) };
}

function readWeekly(p: Profile, today: string = dayKey()): WeeklyState {
  const week = weekStartKey(today);
  const current = p.weekly;
  if (!current || current.week !== week) return { week, claimed: [] };
  const claimed = Array.isArray(current.claimed)
    ? [...new Set(current.claimed.filter((n) => n === 3 || n === 5 || n === 7))]
    : [];
  return { week, claimed };
}

function normalizeWeekly(raw: unknown, fallback: WeeklyState): WeeklyState {
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Partial<WeeklyState>;
  return {
    week: typeof value.week === 'string' ? value.week : fallback.week,
    claimed: Array.isArray(value.claimed)
      ? [...new Set(value.claimed.filter((n): n is number => n === 3 || n === 5 || n === 7))]
      : [],
  };
}

function weeklyEarnings(p: Profile, days: Profile['days'], today: string) {
  const settlement = settleWeeklyRewards(days, readWeekly(p, today), today);
  return {
    state: settlement.state,
    rewards: settlement.rewards,
    gems: settlement.rewards.reduce((sum, reward) => sum + reward.gems, 0),
  };
}

/**
 * Гардероб БУКа; у профилей до магазина поля нет — достраиваем пустое.
 * Красить можно купленные аксессуары и собранные костюмы, поэтому в список
 * доступного для тюнинга идут и те, и другие (engine/tints.ts).
 */
function readShop(p: Profile): ShopState {
  const owned = p.shop?.owned ?? [];
  const assembled = p.puzzle?.assembled ?? [];
  return {
    owned,
    equipped: p.shop?.equipped ?? {},
    // краски некупленных вещей, чужие id и акценты несобранных костюмов отбрасываем
    tuning: normalizeTuning(p.shop?.tuning, [...owned, ...assembled]),
  };
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
    daily: { day: dayKey(), claimed: [], chestsToday: 0, bonusChestsClaimed: 0, chestsTotal: 0 },
    weekly: { week: weekStartKey(), claimed: [] },
    shop: { owned: [], equipped: {} },
    puzzle: { pieces: {}, collecting: null, assembled: [], worn: null },
  };
}

function normalizeProfile(raw: Partial<Profile> | null | undefined): Profile | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  const base = newProfile(
    typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Ученик',
    typeof raw.avatar === 'string' && raw.avatar.trim() ? raw.avatar : '🦊',
  );
  const owned = Array.isArray(raw.shop?.owned)
    ? raw.shop.owned.filter((x): x is string => typeof x === 'string')
    : [];
  const puzzle = normalizePuzzle(raw.puzzle);
  return {
    ...base,
    ...raw,
    id: raw.id,
    name: base.name,
    avatar: base.avatar,
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : base.createdAt,
    xp: typeof raw.xp === 'number' && Number.isFinite(raw.xp) && raw.xp >= 0 ? raw.xp : 0,
    gems: typeof raw.gems === 'number' && Number.isFinite(raw.gems) && raw.gems >= 0 ? raw.gems : 0,
    streak: typeof raw.streak === 'number' && Number.isFinite(raw.streak) && raw.streak >= 0 ? raw.streak : 0,
    lastDay: typeof raw.lastDay === 'string' ? raw.lastDay : '',
    freezes: typeof raw.freezes === 'number' && Number.isFinite(raw.freezes) && raw.freezes >= 0 ? raw.freezes : 0,
    words: raw.words && typeof raw.words === 'object' ? raw.words : {},
    lessons: raw.lessons && typeof raw.lessons === 'object' ? raw.lessons : {},
    errors: raw.errors && typeof raw.errors === 'object' ? raw.errors : {},
    days: raw.days && typeof raw.days === 'object' ? raw.days : {},
    achievements: Array.isArray(raw.achievements) ? raw.achievements.filter((a): a is string => typeof a === 'string') : [],
    weekly: normalizeWeekly(raw.weekly, base.weekly!),
    lessonSize:
      raw.lessonSize === 'short' || raw.lessonSize === 'standard' || raw.lessonSize === 'full'
        ? raw.lessonSize
        : DEFAULT_LESSON_SIZE,
    shop: {
      owned,
      equipped: raw.shop?.equipped && typeof raw.shop.equipped === 'object' ? raw.shop.equipped : {},
      tuning: normalizeTuning(raw.shop?.tuning, [...owned, ...puzzle.assembled]),
    },
    puzzle,
  };
}

function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  return {
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : DEFAULT_SETTINGS.haptics,
    dailyGoal:
      typeof raw.dailyGoal === 'number' && Number.isFinite(raw.dailyGoal) && raw.dailyGoal > 0
        ? raw.dailyGoal
        : DEFAULT_SETTINGS.dailyGoal,
    theme:
      raw.theme === 'auto' || raw.theme === 'light' || raw.theme === 'dark'
        ? raw.theme
        : DEFAULT_SETTINGS.theme,
    // Старые выгрузки и записи без поля получают 'on': поведение не меняется.
    mascot:
      raw.mascot === 'on' || raw.mascot === 'home' || raw.mascot === 'off'
        ? raw.mascot
        : DEFAULT_SETTINGS.mascot,
    lessonHelp:
      raw.lessonHelp === 'socratic' || raw.lessonHelp === 'direct' || raw.lessonHelp === 'off'
        ? raw.lessonHelp
        : DEFAULT_SETTINGS.lessonHelp,
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
  /** Завершённый обычный урок открывает бонусный сундук и может выдать пороги недели. */
  finishLesson: (lessonId: string, pct: number) => WeeklyMilestone[];
  addXp: (n: number) => void;
  addGems: (n: number) => void;
  addFreeze: (n: number) => void;
  grantAchievement: (id: string) => void;

  /** Забрать награду за выполненные задания дня (кристаллы) */
  claimQuest: (id: string, gems: number) => void;
  /** Открыть готовый ежедневный или бонусный сундук; иначе вернуть null. */
  openChest: (kind: ChestKind) => Chest | null;

  /** Купить аксессуар у БУКа. Возвращает false, если кристаллов не хватает. */
  buyItem: (id: string) => boolean;
  /** Надеть/снять аксессуар: повторный тап по надетой вещи снимает её */
  toggleEquip: (id: string) => void;
  /**
   * Сменить цвет купленной вещи: новый оттенок открывается за TINT_PRICE 💎,
   * переключение между открытыми — бесплатно (правила — engine/tints.ts).
   * Возвращает иток, по которому интерфейс выбирает тост.
   */
  recolorItem: (itemId: string, tintId: string) => RecolorOutcome;

  /**
   * Реально завершённый урок (не «Повторение» — это решает вызывающий код):
   * +1 фрагмент пазла, а когда все костюмы собраны — перелив в кристаллы.
   * Возвращает иток для экрана результатов; null — нет активного профиля.
   */
  finishPuzzleLesson: () => PuzzleAward | null;
  /** Сменить костюм, который собираем: прогресс по каждому хранится отдельно. */
  choosePuzzleCostume: (id: string) => void;
  /** Надеть/снять собранный костюм (повторный тап снимает); несобранный — без изменений. */
  toggleCostume: (id: string) => void;

  showToast: (t: Omit<Toast, 'id'>) => void;
  hideToast: () => void;

  resetProfile: (id: string) => void;
  replaceAll: (data: { profiles: Profile[]; activeId: string | null; settings: Settings }) => void;
  setSettings: (patch: Partial<Settings>) => void;
  /** Изменить размер базовой очереди урока для текущего профиля. */
  setLessonSize: (size: LessonSize) => void;
  adaptLesson: (profileId: string, ceiling: number, outcome: Outcome) => void;

  /** Сейф прогресса: корзина профилей, журнал событий, метки копий, дата выгрузки. */
  vault: VaultState;

  /** Запись в журнал — его показывает родительский раздел. */
  logEvent: (kind: LogKind, note?: string) => void;
  /** Вернуть профиль из корзины (удалённый или сброшенный). */
  restoreTrashed: (at: number) => void;
  /** Убрать профиль из корзины окончательно. */
  dropTrashed: (at: number) => void;
  /** Вернуть состояние из резервной копии (слот 1..3). */
  restoreSnapshot: (slot: number) => Promise<boolean>;
  /** Отметить, что родитель сохранил файл выгрузки. */
  noteExport: () => void;
  /** Повторить чтение сохранённого после сбоя. */
  retryHydration: () => Promise<void>;
  /** Явное «начать заново»: снимает заморозку записи (старое уже в копии). */
  freshStart: () => void;
  /** Повторить запись, если предыдущая не удалась. */
  retrySave: () => void;
}

function patchActive(s: AppState, fn: (p: Profile) => Profile): Partial<AppState> {
  if (!s.activeId) return {};
  return { profiles: s.profiles.map((p) => (p.id === s.activeId ? fn(p) : p)) };
}

/** Что именно мы храним в IndexedDB (и что ждём из файла выгрузки). */
interface PersistedShape {
  profiles: Profile[];
  activeId: string | null;
  settings: Settings;
  vault: VaultState;
}

/**
 * Санитайзер сохранённого состояния. Отличается от старого поведения в одном
 * важном месте: невалидный профиль НЕ выбрасывается молча, а уходит в корзину —
 * «потерять» данные можно только явно, из родительского раздела.
 */
function normalizePersisted(raw: unknown): PersistedShape {
  const p = (raw ?? {}) as Partial<PersistedShape>;
  const profiles: Profile[] = [];
  let vault = normalizeVault(p.vault);
  for (const item of Array.isArray(p.profiles) ? p.profiles : []) {
    const prof = normalizeProfile(item);
    if (prof) profiles.push(prof);
    else vault = addTrash(vault, item as Profile, 'invalid');
  }
  const activeId =
    typeof p.activeId === 'string' && profiles.some((x) => x.id === p.activeId)
      ? p.activeId
      : (profiles[0]?.id ?? null);
  return { profiles, activeId, settings: normalizeSettings(p.settings), vault };
}

/** Снимаем заморозку записи — после того как убедились, что сохранённое прочитано. */
function unfreeze() {
  useStorageHealth.getState().patch({ frozen: false, kind: 'ok', message: null, lastError: null });
}

function errorText(e: unknown): string {
  const err = e as { name?: string; message?: string } | null;
  return err?.name ? `${err.name}: ${err?.message ?? ''}`.trim() : String(e);
}

/**
 * Сторож писателя: не даёт писать, пока сохранённое не прочитано, снимает
 * копии перед «опасной» перезаписью и сообщает о сбоях в интерфейс, а не в
 * никуда. Подробности — src/platform/vault.ts.
 */
const guardedStorage = createGuardedStorage({
  isFrozen: () => useStorageHealth.getState().frozen,
  snapshots: () => useApp.getState().vault.snapshots,
  report: (r) => {
    const h = useStorageHealth.getState();
    if (r.status === 'error') {
      h.patch({ kind: 'write-error', message: r.message ?? 'неизвестная ошибка' });
      // Запись в журнал — не чаще раза в минуту, и только если журнал правда
      // изменился. Иначе получается самоподдерживающийся цикл: запись упала →
      // пишем в журнал → журнал пишется → снова упала → и так до бесконечности.
      // (persist оборачивает setState и пишет на каждый вызов, даже если
      // состояние не изменилось — поэтому «ничего не менять» нельзя через setState.)
      const current = useApp.getState();
      const vault = pushLogDedup(current.vault, 'write-error', r.message, r.at, 60_000);
      if (vault !== current.vault) useApp.setState({ vault });
      return;
    }
    if (r.status === 'blocked') {
      // Писать нельзя: старая запись ещё не подтверждена — считаем и молчим.
      h.patch({ blockedWrites: h.blockedWrites + 1 });
      return;
    }
    h.patch({
      lastWriteAt: r.at,
      lastError: null,
      ...(h.kind === 'write-error' ? { kind: 'ok' as const, message: null } : {}),
    });
    broadcastChange();
    if (r.snapshot) {
      const meta: SnapshotMeta = r.snapshot;
      const note = meta.profiles === null ? 'копия нечитаемой записи' : `профилей: ${meta.profiles}`;
      useApp.setState((s) => ({
        vault: {
          ...pushLog(s.vault, 'snapshot', note, r.at),
          snapshots: upsertSnapshot(s.vault.snapshots, meta),
        },
      }));
    }
  },
});

/**
 * Разбор после чтения сохранения. Главная проверка: если в записи кто-то был,
 * а прочиталось ноль профилей — это не «первый запуск», а сбой, и писать
 * нельзя. Раньше приложение в этом случае молча показывало пустой экран и
 * первое же действие стирало прогресс.
 */
async function afterHydration(state: AppState | undefined, error: unknown): Promise<void> {
  const now = Date.now();
  if (error) {
    useStorageHealth.getState().patch({
      kind: 'read-error',
      message: `не удалось прочитать сохранение: ${errorText(error)}`,
      frozen: true,
      hydratedAt: now,
    });
    return;
  }

  let stored: string | null = null;
  try {
    stored = await idbStorage.getItem(MAIN_KEY);
  } catch {
    stored = null;
  }
  const summary = readRecord(stored);
  const profiles = state?.profiles ?? [];
  if (summary && summary.count > 0 && profiles.length === 0) {
    useStorageHealth.getState().patch({
      kind: 'read-error',
      message: `в сохранении ${summary.count} профилей, прочитать удалось 0`,
      frozen: true,
      hydratedAt: now,
    });
    return;
  }

  useStorageHealth.getState().patch({ kind: 'ok', message: null, frozen: false, hydratedAt: now });
  // Журнал и чистку корзины применяем только если что-то правда изменилось:
  // лишняя запись в базу при каждом запуске ни к чему.
  const s = useApp.getState();
  const vault = purgeTrash(pushLogDedup(s.vault, 'boot', `профилей: ${profiles.length}`, now, 6 * 60 * 60 * 1000), now);
  if (vault !== s.vault) useApp.setState({ vault });
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: null,
      settings: DEFAULT_SETTINGS,
      vault: emptyVault(),
      toast: null,

      createProfile: (name, avatar) =>
        set((s) => {
          const p = newProfile(name, avatar);
          return { profiles: [...s.profiles, p], activeId: p.id };
        }),

      selectProfile: (id) => set({ activeId: id }),

      /**
       * Удаление профиля — больше не «стерлось навсегда»: профиль уходит в
       * корзину («Родителям → Прогресс») и 30 дней его можно вернуть.
       */
      deleteProfile: (id) =>
        set((s) => {
          const gone = s.profiles.find((p) => p.id === id);
          const profiles = s.profiles.filter((p) => p.id !== id);
          return {
            profiles,
            activeId: s.activeId === id ? (profiles[0]?.id ?? null) : s.activeId,
            vault: gone
              ? pushLog(addTrash(s.vault, gone, 'delete'), 'profile-delete', gone.name)
              : s.vault,
          };
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
            const streakBonusGems =
              streak > p.streak && streak % GEMS_PER_STREAK === 0 ? 1 : 0;
            return { ...p, streak, freezes, gems: p.gems + streakBonusGems, lastDay: today };
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
                  // задание «без ошибок»: лучшая серия за день; текущая хранится отдельно
                  ...nextRun(day, ok),
                  reviewCorrect: day.reviewCorrect + (ok && review ? 1 : 0),
                  reviewWords,
                },
              },
            };
          }),
        ),

      finishLesson: (lessonId, pct) => {
        let weeklyAwards: WeeklyMilestone[] = [];
        set((s) =>
          patchActive(s, (p) => {
            const cur: LessonState = p.lessons[lessonId] ?? { level: 0, best: 0, doneAt: 0, plays: 0 };
            const today = dayKey();
            const day = readDay(p, today);
            const level = pct >= 60 ? Math.min(5, cur.level + 1) : cur.level;
            const days = { ...p.days, [today]: { ...day, lessons: day.lessons + 1 } };
            const weekly = weeklyEarnings(p, days, today);
            weeklyAwards = weekly.rewards;
            return {
              ...p,
              lessons: {
                ...p.lessons,
                [lessonId]: { level, best: Math.max(cur.best, pct), doneAt: Date.now(), plays: cur.plays + 1 },
              },
              days,
              daily: readDaily(p),
              weekly: weekly.state,
              gems: p.gems + weekly.gems,
            };
          }),
        );
        return weeklyAwards;
      },

      addXp: (n) =>
        set((s) =>
          patchActive(s, (p) => {
            const today = dayKey();
            const day = readDay(p, today);
            return {
              ...p,
              xp: p.xp + n,
              days: { ...p.days, [today]: { ...day, xp: day.xp + n } },
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

      openChest: (kind) => {
        const current = getActive(get());
        const today = dayKey();
        if (!current || (kind !== 'daily' && kind !== 'bonus')) return null;
        const daily = readDaily(current);
        const metrics = dayMetrics(current.days[today]);
        const dailyReady =
          allQuestsDone(planOf(current, today), metrics) && !dailyChestClaimed(daily);
        const bonusReady = bonusChestsReady(metrics.lessons, daily.bonusChestsClaimed ?? 0) > 0;
        if (kind === 'daily' ? !dailyReady : !bonusReady) return null;

        const chest = rollChest(kind);
        let opened: Chest | null = null;
        set((s) =>
          patchActive(s, (p) => {
            const freshDaily = readDaily(p);
            const freshMetrics = dayMetrics(p.days[today]);
            const freshDailyReady =
              allQuestsDone(planOf(p, today), freshMetrics) && !dailyChestClaimed(freshDaily);
            const freshBonusReady =
              bonusChestsReady(freshMetrics.lessons, freshDaily.bonusChestsClaimed ?? 0) > 0;
            // Повторно проверяем внутри обновления: состояние могло измениться
            // между чтением и записью при быстром двойном тапе.
            if (kind === 'daily' ? !freshDailyReady : !freshBonusReady) return p;
            opened = chest;
            const day = readDay(p, today);
            return {
              ...p,
              gems: p.gems + chest.gems,
              freezes: p.freezes + chest.freezes,
              days: { ...p.days, [today]: { ...day, xp: day.xp + chest.xp } },
              xp: p.xp + chest.xp,
              daily: {
                ...freshDaily,
                chestsToday: freshDaily.chestsToday + 1,
                bonusChestsClaimed:
                  (freshDaily.bonusChestsClaimed ?? 0) + (kind === 'bonus' ? 1 : 0),
                chestsTotal: freshDaily.chestsTotal + 1,
                lastChest: { ...chest },
                lastChestKind: kind,
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
                ...shop, // новая покупка не должна стирать уже открытые оттенки
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

      recolorItem: (itemId, tintId) => {
        const prof = getActive(get());
        if (!prof) return 'nothing';
        const res = recolor(readShop(prof), prof.gems, itemId, tintId, prof.puzzle?.assembled ?? []);
        // Меняем профиль только когда цвет действительно поменялся: «no-gems»,
        // «not-owned» и повторный выбор того же оттенка не пишут ничего.
        if (res.outcome === 'switched' || res.outcome === 'opened') {
          set((s) =>
            patchActive(s, (p) => ({
              ...p,
              gems: Math.max(0, p.gems - res.spend),
              shop: res.shop,
            })),
          );
        }
        return res.outcome;
      },

      finishPuzzleLesson: () => {
        const s = get();
        const prof = s.profiles.find((x) => x.id === s.activeId);
        if (!prof) return null;
        const { puzzle, award } = awardLessonPiece(prof.puzzle);
        set((st) =>
          patchActive(st, (p) => ({ ...p, puzzle, gems: p.gems + award.gems })),
        );
        return award;
      },

      choosePuzzleCostume: (id) =>
        set((s) =>
          patchActive(s, (p) => ({ ...p, puzzle: chooseCollecting(p.puzzle, id) })),
        ),

      toggleCostume: (id) =>
        set((s) => patchActive(s, (p) => ({ ...p, puzzle: toggleWorn(p.puzzle, id) }))),

      showToast: (t) => set({ toast: { ...t, id: Date.now() } }),
      hideToast: () => set({ toast: null }),

      grantAchievement: (id) =>
        set((s) =>
          patchActive(s, (p) =>
            p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] },
          ),
        ),

      /** Сброс тоже обратим: прежний профиль остаётся в корзине 30 дней. */
      resetProfile: (id) =>
        set((s) => {
          const prev = s.profiles.find((p) => p.id === id);
          if (!prev) return {};
          const fresh: Profile = { ...newProfile(prev.name, prev.avatar), id, createdAt: prev.createdAt };
          const vault = pushLog(addTrash(s.vault, prev, 'reset'), 'profile-reset', prev.name);
          return {
            profiles: s.profiles.map((p) => (p.id === id ? fresh : p)),
            vault,
          };
        }),

      /**
       * Загрузка файла. Прежние профили не исчезают: они уходят в корзину, и
       * после неудачного импорта можно вернуть как было. Свои резервные копии
       * на диске не трогаем — в файле лежат чужие метки.
       */
      replaceAll: (data) =>
        set((s) => {
          // Один и тот же санитайзер, что и для сохранения: «плохой» профиль
          // из файла не пропадает бесследно, а уходит в корзину.
          const incoming = normalizePersisted(data);

          let vault = s.vault;
          for (const p of s.profiles) vault = addTrash(vault, p, 'import');
          for (const t of incoming.vault.trash) vault = addTrash(vault, t.profile, t.reason, t.at);
          vault = pushLog(vault, 'import', `профилей: ${incoming.profiles.length}`);
          // Заморозку снимаем: импорт — осознанное действие взрослого.
          unfreeze();

          return {
            profiles: incoming.profiles,
            activeId: incoming.activeId,
            settings: incoming.settings,
            // Копии лежат на этом устройстве — из файла метки не берём.
            vault: { ...vault, snapshots: s.vault.snapshots },
            toast: null,
          };
        }),

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

      // ── Сейф прогресса ────────────────────────────────────────────────────

      logEvent: (kind, note) => set((s) => ({ vault: pushLogDedup(s.vault, kind, note) })),

      noteExport: () =>
        set((s) => ({
          vault: pushLog({ ...s.vault, lastExportAt: Date.now() }, 'export'),
        })),

      restoreTrashed: (at) =>
        set((s) => {
          const item = s.vault.trash.find((t) => t.at === at);
          if (!item) return {};
          const exists = s.profiles.some((p) => p.id === item.profile.id);
          const vault = pushLog(
            { ...s.vault, trash: s.vault.trash.filter((t) => t.at !== at) },
            'profile-restore',
            item.profile.name,
          );
          return {
            profiles: exists
              ? s.profiles.map((p) => (p.id === item.profile.id ? item.profile : p))
              : [...s.profiles, item.profile],
            activeId: item.profile.id,
            vault,
          };
        }),

      dropTrashed: (at) =>
        set((s) => ({ vault: { ...s.vault, trash: s.vault.trash.filter((t) => t.at !== at) } })),

      /**
       * Вернуть состояние из копии. Текущее состояние перед этим тоже
       * сохраняем в другой слот — чтобы само восстановление было отменяемым.
       */
      restoreSnapshot: async (slot) => {
        const raw = await readSnapshot(slot);
        if (!raw) return false;
        const current = await Promise.resolve(idbStorage.getItem(MAIN_KEY)).catch(() => null);
        if (current && current !== raw) {
          const busy = useApp.getState().vault.snapshots.filter((s) => s.slot !== slot);
          const spare = nextSlot(busy);
          await writeSnapshot(spare, current).catch(() => undefined);
          // Копия «того, что было до восстановления»: восстановление отменяемо.
          set((st) => ({
            vault: {
              ...st.vault,
              snapshots: upsertSnapshot(st.vault.snapshots, snapshotMetaOf(current, spare, Date.now())),
            },
          }));
        }
        await idbStorage.setItem(MAIN_KEY, raw);
        unfreeze();
        await Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
        const summary = readRecord(raw);
        set((s) => ({
          vault: pushLog(s.vault, 'restore-snapshot', summary ? `${summary.count} профилей` : 'копия'),
        }));
        return true;
      },

      /** Повторить чтение: снимаем заморозку и читаем заново. */
      retryHydration: async () => {
        unfreeze();
        await Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
      },

      /** Осознанное «начать заново» после сбоя чтения: старая запись уже в копии. */
      freshStart: () => {
        unfreeze();
        set((s) => ({ profiles: [], activeId: null, vault: pushLog(s.vault, 'fresh-start') }));
      },

      /** Пустая запись состояния — просто способ заставить persist писать снова. */
      retrySave: () => set((s) => ({ vault: { ...s.vault } })),
    }),
    {
      name: MAIN_KEY,
      version: 1,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (s) => ({
        profiles: s.profiles,
        activeId: s.activeId,
        settings: s.settings,
        vault: s.vault,
      }),
      // Данные из хранилища (или из файла) проходят санитайзер: раньше
      // невалидный профиль просто выбрасывался молча.
      merge: (persisted, current) => ({ ...current, ...normalizePersisted(persisted) }),
      // Без migrate любое расхождение версии означает потерю прогресса
      // (zustand не может мигрировать и падает внутри hydrate).
      migrate: (state) => normalizePersisted(state),
      onRehydrateStorage: () => (state, error) => {
        void afterHydration(state as AppState | undefined, error);
      },
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

/** Надетый костюм активного профиля (id) — примитивный селектор, рендеров не плодит. */
export function useWornCostume(): string | null {
  return useApp((s) => {
    const p = s.profiles.find((x) => x.id === s.activeId);
    return p?.puzzle?.worn ?? null;
  });
}

/**
 * Краски купленных вещей активного профиля: id вещи → оттенок (engine/tints.ts).
 * Пустое значение — та же константа, что и у NO_LOOK: объект в селекторе zustand 5
 * обязан быть стабильным по ссылке, иначе React уходит в бесконечные перерисовки.
 */
const NO_TUNING: ShopTuning = { current: {}, unlocked: {} };

export function useShopTuning(): ShopTuning {
  return useApp((s) => {
    const p = s.profiles.find((x) => x.id === s.activeId);
    return p?.shop?.tuning ?? NO_TUNING;
  });
}
export type { AppState };

export { CHEST_GEMS };
