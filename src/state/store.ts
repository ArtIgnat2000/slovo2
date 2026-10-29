import { nextAdaptiveState, type Outcome } from '../engine/adaptive';
import { isThemeStyle, type ThemeStyle } from '../engine/theme-styles';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BukFacts, ClassId, DailyState, DayStat, LessonSize, LessonState, ListRun, ListRunMode, PracticeList, Profile, ShopState, ShopSlot, ShopTuning, StudyAnswerMeta, StudySession, StudySessionStatus, WeeklyState, Word, WordState } from '../types';
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
  chestWakeBonus,
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
import { ITEM_BY_ID, isOwned, normalizeWishlist, sellPrice } from '../engine/shop';
import { migrateMusicShop, MUSIC_BY_ID } from '../engine/music';
import { canBuySoundPack, DEFAULT_SOUND_PACK, hasSoundPack, normalizeSoundShop, SOUND_PACK_BY_ID } from '../engine/sounds';
import { normalizeTuning, recolor, type RecolorOutcome } from '../engine/tints';
import {
  ALL_COSTUMES,
  CRYSTAL_COSTUMES,
  awardLessonPiece,
  chooseCollecting,
  normalizePuzzle,
  toggleWorn,
  type PuzzleAward,
} from '../engine/puzzles';
import { activeChestSkin, skinById, skinState, type ChestSkinId } from '../engine/chests';
import { BUILDING_BY_ID, isBuildingOwned, normalizeActiveBuilding, normalizeBuildingsOwned, normalizeWorldBase } from '../engine/buildings';
import { BASE_SETS, baseSetPrice } from '../engine/base-sets';
import { normalizeWorld, toggleWorldPick, type WorldToggle } from '../engine/world';
import { DEFAULT_LESSON_SIZE } from '../engine/scheduler';
import {
  DEFAULT_LIST_DRILL_SIZE,
  LIST_DRILL_SIZES,
  LIST_RUNS_LIMIT,
  makeList,
  normalizeCustomWords,
  normalizeLists,
  parseWordList,
  withStress,
} from '../engine/word-lists';
import { normalizeStudySessions, STUDY_SESSION_RETENTION_DAYS } from '../engine/study';
import { normalizeBukFacts } from '../engine/buk-chat';
import {
  addTrash,
  emptyVault,
  nextSlot,
  normalizeVault,
  purgeTrash,
  pushLog,
  pushLogDedup,
  purchaseArchiveMetaOf,
  readRecord,
  snapshotMetaOf,
  upsertSnapshot,
  type LogKind,
  type PurchaseArchiveMeta,
  type SnapshotMeta,
  type SpendKind,
  type VaultState,
} from '../engine/vault';
import {
  broadcastChange,
  createGuardedStorage,
  MAIN_KEY,
  readPurchaseArchive,
  readSnapshot,
  writePurchaseArchive,
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
  /** Звуковые эффекты (правильный ответ, сундук): синтезируются на месте. */
  sound: boolean;
  /** Фоновая музыка: отдельный переключатель, чтобы SFX жили без музыки и наоборот. */
  music: boolean;
  /** Громкость фоновой музыки (0..1): умеренная по умолчанию. */
  musicVolume: number;
  haptics: boolean;
  dailyGoal: number; // XP в день
  /** Светлая/тёмная палитра; `auto` следует настройке телефона. */
  theme: 'auto' | 'light' | 'dark';
  /** Визуальный стиль приложения, независимый от светлой/тёмной схемы. */
  themeStyle: ThemeStyle;
  mascot: MascotMode;
  lessonHelp: LessonHelpMode;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  musicVolume: 0.5,
  haptics: true,
  dailyGoal: 120,
  theme: 'auto',
  themeStyle: 'classic',
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
  return {
    xp: 0, correct: 0, wrong: 0, lessons: 0, flawless: 0, reviewCorrect: 0, reviewWords: [],
    activeSeconds: 0, tasks: 0, errorWords: {}, recoveredWords: [],
  };
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
  const wakePaid = Math.min(
    chestsToday,
    Number.isInteger(st.wakePaid) && (st.wakePaid ?? 0) >= 0 ? st.wakePaid ?? 0 : 0,
  );
  const normalized = { ...st, chestsToday, bonusChestsClaimed, lastChestKind, wakePaid };
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
/**
 * Профиль, испорченный сменой цвета до исправления: у него есть `tuning`
 * (краска пишется вместе с ним), но нет ни musicOwned, ни musicTrack — выбор
 * ребёнка потерян. Миграция иначе сделала бы автозапуск первой мелодии при
 * каждой синхронизации. Поэтому такой профиль читается как «мелодия не
 * выбрана» (тишина): ребёнок сам включит музыку. Любой нормальный профиль
 * после чтения всегда имеет musicOwned, поэтому его не затрагиваем.
 */
export function repairMusicShop<T extends { musicOwned?: unknown; musicTrack?: unknown; tuning?: unknown } | null | undefined>(
  shop: T,
): T {
  if (shop && shop.tuning !== undefined && shop.musicOwned === undefined && shop.musicTrack === undefined) {
    return { ...shop, musicTrack: null } as T;
  }
  return shop;
}

function readShop(p: Profile): ShopState {
  const owned = p.shop?.owned ?? [];
  const assembled = p.puzzle?.assembled ?? [];
  const crystalCostumesOwned = [...new Set((p.shop?.crystalCostumesOwned ?? []).filter((id) => CRYSTAL_COSTUMES.some((c) => c.id === id)))];
  const ownedCostumes = [...assembled, ...crystalCostumesOwned];
  const buildingsOwned = normalizeBuildingsOwned(p.shop?.buildingsOwned);
  // Музыкальная часть — через миграцию: покупки старого каталога не теряются.
  const music = migrateMusicShop(repairMusicShop(p.shop));
  return {
    owned,
    equipped: p.shop?.equipped ?? {},
    crystalCostumesOwned,
    musicOwned: music.musicOwned,
    musicTrack: music.musicTrack,
    // «Звуки»: старые профили получают стартовые наборы и классику
    ...normalizeSoundShop(p.shop),
    // краски некупленных вещей, чужие id и акценты несобранных костюмов отбрасываем
    tuning: normalizeTuning(p.shop?.tuning, [...owned, ...ownedCostumes]),
    wishlist: normalizeWishlist(p.shop?.wishlist, owned, ownedCostumes, music.musicOwned),
    world: normalizeWorld(p.shop?.world, owned, ownedCostumes),
    buildingsOwned,
    worldBase: normalizeWorldBase(p.shop?.worldBase, buildingsOwned),
    activeBuilding: normalizeActiveBuilding(p.shop?.activeBuilding, buildingsOwned),
  };
}

function newProfile(name: string, avatar: string, activeClass: ClassId = 2): Profile {
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
    studySessions: [],
    achievements: [],
    lessonSize: DEFAULT_LESSON_SIZE,
    activeClass,
    daily: { day: dayKey(), claimed: [], chestsToday: 0, bonusChestsClaimed: 0, chestsTotal: 0 },
    weekly: { week: weekStartKey(), claimed: [] },
    // Новый профиль начинает с пустой коллекции: мелодии и наборы звуков
    // открываются в магазине, до покупки играет тишина / классический отклик.
    shop: {
      owned: [],
      equipped: {},
      musicOwned: [],
      musicTrack: null,
      soundOwned: [],
      soundPack: DEFAULT_SOUND_PACK,
      wishlist: [],
      crystalCostumesOwned: [],
      world: [],
      buildingsOwned: [],
      worldBase: null,
      activeBuilding: null,
    },
    puzzle: { pieces: {}, collecting: null, assembled: [], worn: null },
  };
}

function normalizeDays(raw: unknown, today: string): Record<string, DayStat> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cutoffDate = new Date(`${today}T12:00:00`);
  cutoffDate.setDate(cutoffDate.getDate() - (STUDY_SESSION_RETENTION_DAYS - 1));
  const cutoff = dayKey(cutoffDate);
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [key, value as DayStat];
    const stat = value as DayStat;
    if (key >= cutoff) return [key, stat];
    // Сохраняем дневные итоги, но удаляем подробные слова ошибок старше 30 дней.
    const aggregate = { ...stat };
    delete aggregate.errorWords;
    delete aggregate.recoveredWords;
    return [key, aggregate];
  }));
}

/** Допустимый класс программы: всё остальное (в том числе из файла выгрузки) → 2. */
export function isClassId(value: unknown): value is ClassId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function normalizeProfile(raw: Partial<Profile> | null | undefined): Profile | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  // Старые профили и старые выгрузки без поля продолжают учиться во 2 классе:
  // опыт, товары и награды при этом не меняются (docs/proposals/classes-1-4.md).
  const activeClass = isClassId(raw.activeClass) ? raw.activeClass : 2;
  const base = newProfile(
    typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Ученик',
    typeof raw.avatar === 'string' && raw.avatar.trim() ? raw.avatar : '🦊',
    activeClass,
  );
  const owned = Array.isArray(raw.shop?.owned)
    ? raw.shop.owned.filter((x): x is string => typeof x === 'string')
    : [];
  const puzzle = normalizePuzzle(raw.puzzle);
    const music = migrateMusicShop(repairMusicShop(raw.shop));
    return {
      ...base,
      ...raw,
      id: raw.id,
      name: base.name,
      avatar: base.avatar,
      createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : base.createdAt,
      xp: typeof raw.xp === 'number' && Number.isFinite(raw.xp) && raw.xp >= 0 ? raw.xp : 0,
      gems: typeof raw.gems === 'number' && Number.isFinite(raw.gems) && raw.gems >= 0 ? raw.gems : 0,
      progressResetId: typeof raw.progressResetId === 'string' ? raw.progressResetId : undefined,
      gemsResetId: typeof raw.gemsResetId === 'string' ? raw.gemsResetId : undefined,
      streak: typeof raw.streak === 'number' && Number.isFinite(raw.streak) && raw.streak >= 0 ? raw.streak : 0,
      lastDay: typeof raw.lastDay === 'string' ? raw.lastDay : '',
      freezes: typeof raw.freezes === 'number' && Number.isFinite(raw.freezes) && raw.freezes >= 0 ? raw.freezes : 0,
      words: raw.words && typeof raw.words === 'object' ? raw.words : {},
      lessons: raw.lessons && typeof raw.lessons === 'object' ? raw.lessons : {},
      errors: raw.errors && typeof raw.errors === 'object' ? raw.errors : {},
      days: normalizeDays(raw.days, dayKey()),
      studySessions: normalizeStudySessions(raw.studySessions, dayKey()),
      achievements: Array.isArray(raw.achievements) ? raw.achievements.filter((a): a is string => typeof a === 'string') : [],
      // Строка идёт после ...raw, иначе невалидное значение из файла пережило бы санитайзер.
      activeClass,
      weekly: normalizeWeekly(raw.weekly, base.weekly!),
      // Списки к контрольной и свои слова (0.58.0): мусор из файла выбрасываем,
      // чужие id слов чиним при чтении — уроки списков не должны падать.
      lists: normalizeLists(raw.lists),
      customWords: normalizeCustomWords(raw.customWords),
      // Память БУКа (0.87.0): мусор из файла или бэкапа стрижется до
      // whitelist-фактов чата — строка идёт после ...raw, чтобы санитайзер
      // перебирал значение из файла, а не наоборот.
      bukFacts: normalizeBukFacts(raw.bukFacts),
      lessonSize:
        raw.lessonSize === 'short' || raw.lessonSize === 'standard' || raw.lessonSize === 'full'
          ? raw.lessonSize
          : DEFAULT_LESSON_SIZE,
      // Размер тренировки списка (0.63.0): только из списка вариантов,
      // иначе — умолчание (6 слов). Мусор из файла не превращается в 0.
      listDrillSize:
        typeof raw.listDrillSize === 'number' && LIST_DRILL_SIZES.some((o) => o.id === raw.listDrillSize)
          ? raw.listDrillSize
          : DEFAULT_LIST_DRILL_SIZE,
      shop: {
        owned,
        equipped: raw.shop?.equipped && typeof raw.shop.equipped === 'object' ? raw.shop.equipped : {},
        // Миграция каталога музыки: старые покупки дают новые треки, выбор
        // ребёнка (включая «Тишина») сохраняется — см. engine/music.ts.
        ...music,
        ...normalizeSoundShop(raw.shop),
        tuning: normalizeTuning(raw.shop?.tuning, [...owned, ...puzzle.assembled, ...((raw.shop?.crystalCostumesOwned ?? []).filter((id: unknown): id is string => typeof id === 'string'))]),
        wishlist: normalizeWishlist(raw.shop?.wishlist, owned, [...puzzle.assembled, ...((raw.shop?.crystalCostumesOwned ?? []).filter((id: unknown): id is string => typeof id === 'string'))], music.musicOwned),
        crystalCostumesOwned: [...new Set((raw.shop?.crystalCostumesOwned ?? []).filter((id): id is string => typeof id === 'string' && CRYSTAL_COSTUMES.some((c) => c.id === id)))],
        world: normalizeWorld(raw.shop?.world, owned, [...puzzle.assembled, ...((raw.shop?.crystalCostumesOwned ?? []).filter((id: unknown): id is string => typeof id === 'string'))]),
        buildingsOwned: normalizeBuildingsOwned(raw.shop?.buildingsOwned),
        worldBase: normalizeWorldBase(raw.shop?.worldBase, normalizeBuildingsOwned(raw.shop?.buildingsOwned)),
        activeBuilding: normalizeActiveBuilding(raw.shop?.activeBuilding, normalizeBuildingsOwned(raw.shop?.buildingsOwned)),
      },
      puzzle,
    };
}

function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  return {
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
    // У профилей до 0.14.0 музыка и эффекты делили один выключатель «Звук»:
    // кто его выключал, тот не хотел звука вообще — музыку таким не включаем.
    music:
      typeof raw.music === 'boolean'
        ? raw.music
        : typeof raw.sound === 'boolean'
          ? raw.sound
          : DEFAULT_SETTINGS.music,
    musicVolume:
      typeof raw.musicVolume === 'number' && Number.isFinite(raw.musicVolume) && raw.musicVolume >= 0
        ? Math.min(1, raw.musicVolume)
        : DEFAULT_SETTINGS.musicVolume,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : DEFAULT_SETTINGS.haptics,
    dailyGoal:
      typeof raw.dailyGoal === 'number' && Number.isFinite(raw.dailyGoal) && raw.dailyGoal > 0
        ? raw.dailyGoal
        : DEFAULT_SETTINGS.dailyGoal,
    theme:
      raw.theme === 'auto' || raw.theme === 'light' || raw.theme === 'dark'
        ? raw.theme
        : DEFAULT_SETTINGS.theme,
    // Старые записи и неизвестные стили безопасно переходят на классический вид.
    themeStyle: isThemeStyle(raw.themeStyle) ? raw.themeStyle : DEFAULT_SETTINGS.themeStyle,
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

  createProfile: (name: string, avatar: string, classId?: ClassId) => void;
  selectProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string, avatar: string) => void;

  touchDay: () => void;
  startStudySession: (session: StudySession) => void;
  recordStudyTask: (sessionId: string) => void;
  addStudyTime: (sessionId: string, seconds: number) => void;
  finishStudySession: (sessionId: string, status: Exclude<StudySessionStatus, 'active' | 'interrupted'>) => void;
  answer: (wordId: string, quality: number, review?: boolean, tracking?: StudyAnswerMeta) => void;
  /** Завершённый обычный урок открывает бонусный сундук и может выдать пороги недели. */
  finishLesson: (lessonId: string, pct: number) => WeeklyMilestone[];
  addXp: (n: number) => void;
  addGems: (n: number) => void;
  addFreeze: (n: number) => void;
  grantAchievement: (id: string) => void;

  /** Забрать награду за выполненные задания дня (кристаллы) */
  claimQuest: (id: string, gems: number) => void;
  /**
   * Открыть готовый ежедневный или бонусный сундук; иначе вернуть null.
   * `awake` — ребёнок разбудил сундук тапами («Разбуди сундук»): надбавка к награде.
   */
  openChest: (kind: ChestKind, awake?: boolean) => Chest | null;
  /**
   * Доплатить за сундук, разбуженный уже в сцене открытия (тапы по закрытому
   * сундуку). Один раз на сундук: сколько сундуков открыто сегодня, столько
   * надбавок максимум. Возвращает, сколько кристаллов доплатили (0 — нечего).
   */
  wakeChest: (kind: ChestKind) => number;

  /** Купить аксессуар у БУКа. Возвращает false, если кристаллов не хватает. */
  buyItem: (id: string) => boolean;
  /** Купить научную базу (здание). Сразу ставится на участок. */
  buyBuilding: (id: string) => boolean;
  /** Купить кристальный костюм базы. Сразу надевается на БУКа. */
  buyCrystalCostume: (id: string) => boolean;
  /** Купить набор базы целиком: база + машина + самолёт + костюм (цена — за недостающие части со скидкой 25%). */
  buyBaseSet: (id: string) => boolean;
  /** Поставить купленную базу на участок в магазине. */
  chooseBuilding: (id: string) => boolean;
  /** Поставить купленную базу фоном «Моего мира» (null — убрать фон). */
  chooseWorldBase: (id: string | null) => boolean;
  /** «Мой мир»: поставить/убрать купленную вещь или костюм (до трёх мест). */
  toggleWorld: (id: string) => WorldToggle;
  /**
   * Сдать купленную вещь обратно («трейд-ин», docs/proposals/trade-in.md):
   * вещь уходит из гардероба навсегда, часть цены возвращается
   * кристаллами (sellPrice). Надетое и с подиума снимается, открытые
   * оттенки вещи обнуляются. Возвращает false, если вещи нет.
   */
  sellItem: (id: string) => boolean;
  /** Добавить/убрать предмет из списка «Мечты 🤍» (Wishlist). Возвращает true, если добавлен. */
  toggleWishlist: (id: string) => boolean;
  /** Купить мелодию из музыкального магазина (однократно; открытый трек остаётся в профиле). */
  buyMusicTrack: (id: string) => boolean;
  /** Выбрать купленную мелодию для БУКа; null — выключить музыку. */
  setMusicTrack: (id: string | null) => void;
  /** Купить набор «Звуков» (мелодии правильного ответа и ошибки); однократно. */
  buySoundPack: (id: string) => boolean;
  /** Выбрать открытый набор «Звуков» для уроков. */
  setSoundPack: (id: string) => void;
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

  /**
   * Выбрать облик сундука (src/engine/chests.ts). Запертый облик не выбирается:
   * проверку делает движок, стор только хранит решение ребёнка.
   */
  chooseChestSkin: (id: ChestSkinId) => void;
  /**
   * Записать облики как открытые: это и объявление («новый сундук»), и гарантия,
   * что открытое не отберётся, если условие перестанет выполняться.
   */
  recordChestSkins: (ids: ChestSkinId[]) => void;
  showToast: (t: Omit<Toast, 'id'>) => void;
  hideToast: () => void;

  /** Обнулить только баланс указанного профиля, сохранив прежнее состояние в корзине. */
  resetGems: (id: string) => void;
  resetProfile: (id: string) => void;
  replaceAll: (data: { profiles: Profile[]; activeId: string | null; settings: Settings }) => void;
  setSettings: (patch: Partial<Settings>) => void;
  /** Изменить размер базовой очереди урока для текущего профиля. */
  setLessonSize: (size: LessonSize) => void;
  /**
   * Класс программы (1–4). Меняет ТОЛЬКО activeClass и сбрасывает адаптивное
   * окно: опыт, кристаллы, серия, награды, покупки и прогресс по словам
   * остаются. Никаких пересозданий профиля, сбросов дня и фильтрации слов.
   */
  setActiveClass: (classId: ClassId) => void;
  /** То же для конкретного профиля — экран «Профили» редактирует и других детей. */
  setProfileClass: (profileId: string, classId: ClassId) => void;
  adaptLesson: (profileId: string, ceiling: number, outcome: Outcome) => void;
  /**
   * Рассказать БУКу whitelist-факт из чата (0.87.0): патч сливается с уже
   * известным, `toldAt` обновляется — напоминание «через неделю» отсчитывается
   * от последней рассказки. Наград за чат нет — это правка «в стол».
   */
  setBukFacts: (patch: Partial<BukFacts>) => void;

  // ── Списки слов к контрольной (0.58.0) ───────────────────────────────────
  /**
   * Создать список из вставленного текста. Разбор и сопоставление с банком —
   * `engine/word-lists.ts`; свои слова сохраняются в профиль и живут только
   * в своих списках. Возвращает созданный список и статистику разбора.
   */
  addList: (title: string, rawText: string, customWords?: Record<string, Word>) => {
    list: PracticeList | null;
    bank: number;
    custom: number;
    duplicates: number;
  };
  /** Удалить список. Свои слова остаются в профиле: они могут быть в другом списке. */
  removeList: (listId: string) => void;
  renameList: (listId: string, title: string) => void;
  /** Переставить ударение своего слова и пересчитать «опасные» буквы. */
  setCustomWordStress: (wordId: string, index: number) => void;
  /** Отметить, что список тренировали (подпись «последний раз — вчера»). */
  touchList: (listId: string) => void;
  /**
   * Сохранить итог полной контрольной (0.62.0): сколько слов проверено, сколько
   * верно и какие провалились. Из этого «Тренировать ошибки» берёт набор слов.
   */
  saveListCheck: (listId: string, result: { total: number; correct: number; wrong: string[] }) => void;
  /**
   * Записать заход по списку (0.63.0): тренировку, контрольную или тренировку
   * ошибок. Из истории считаются динамика и «трудные слова».
   */
  saveListRun: (
    listId: string,
    run: { mode: ListRunMode; total: number; correct: number; wrong: string[]; listSize?: number },
  ) => void;
  /** Сколько слов брать в одну тренировку списка: 4/6/8/12 или 0 — весь список. */
  setListDrillSize: (size: number) => void;

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
  /**
   * Вернуть состояние из копии «до последней покупки» (0.36.0): кристаллы
   * на месте, вещи из покупки нет. Текущее состояние перед этим сохраняется
   * в обычную копию — возврат тоже отменяемый.
   */
  restorePurchaseArchive: () => Promise<boolean>;
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

// Синхронизация могла начать чтение ДО сброса и закончить ПОСЛЕ него.
// Тогда прочитанный старый профиль нельзя накладывать поверх нового состояния.
let localResetRevision = 0;
let hydrationResetRevision = 0;

/** Метка переживает перезапуск и синхронизацию между открытыми копиями. */
function nextResetId(): string {
  localResetRevision += 1;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${localResetRevision}`;
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

// ── Защита накоплений (0.36.0) ───────────────────────────────────────────────
//
// Покупка — единственное действие, где результат нельзя переиграть: кристаллы
// уходят насовсем. До 0.36.0 порядок был «списали в памяти → когда-нибудь
// запишем». Если запись не удавалась (квота, приватный режим, чистка iOS) или
// её затирала вторая открытая копия приложения, ребёнок оставался без вещи —
// и без кристаллов после перезапуска выглядел «обманутым».
//
// Теперь каждая трата идёт по трём шагам:
//   1) ВСЕГДА снимается копия всей записи ДО списания (отдельный ключ,
//      PURCHASE_KEY) — она встаёт в очередь хранилища раньше записи покупки;
//   2) списание и товар меняются одной операцией состояния (промежуточного
//      состояния «кристаллы ушли, товара нет» не существует);
//   3) после записи сторож читает базу и сверяет результат. Не сошлось —
//      состояние возвращается к копии, а ребёнок видит честное сообщение.
//
// Режим максимальной защиты включён ВСЕГДА и не выключается: отключаемая защита
// не защищает (docs/proposals/savings-protection.md).

interface PendingSpend {
  profileId: string;
  label: string;
  kind: SpendKind;
  price: number;
  gemsBefore: number;
  gemsAfter: number;
  /** Не откатываем состояние поверх осознанного сброса, сделанного позже. */
  progressResetId?: string;
  gemsResetId?: string;
  /** Запись «как было» целиком — точный откат, а не вычитание дельты. */
  before: string;
  at: number;
}

/** Состояние в том же виде, в каком его пишет zustand persist. */
function serializedState(): string {
  const s = useApp.getState();
  return JSON.stringify({
    state: { profiles: s.profiles, activeId: s.activeId, settings: s.settings, vault: s.vault },
    version: 1,
  });
}

/** Профиль из записанного состояния: им проверяем, что трата правда в базе. */
function profileInRecord(raw: string | null, id: string): Profile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { profiles?: Profile[] } };
    return parsed.state?.profiles?.find((p) => p?.id === id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Снять копию «до списания» и вернуть чек траты.
 *
 * Копия ставится в очередь хранилища ПЕРЕД записью покупки (persist пишет
 * синхронно при следующем set), поэтому в базе она не может оказаться позже
 * покупки. Сбой копии покупку не отменяет — но тогда её и не подтвердит
 * проверка: откат вернёт состояние в памяти.
 */
function beginSpend(args: {
  kind: SpendKind;
  label: string;
  price: number;
  profile: Profile;
  gemsAfter: number;
}): PendingSpend {
  const { kind, label, price, profile, gemsAfter } = args;
  const before = serializedState();
  const spend: PendingSpend = {
    profileId: profile.id,
    label,
    kind,
    price,
    gemsBefore: profile.gems,
    gemsAfter,
    progressResetId: profile.progressResetId,
    gemsResetId: profile.gemsResetId,
    before,
    at: Date.now(),
  };
  void guardedStorage.enqueue(() => writePurchaseArchive(before).catch(() => undefined));
  return spend;
}

/** Метка копии для сейфа — едет в том же set, что и сама покупка. */
function spendMeta(spend: PendingSpend, profileName: string): PurchaseArchiveMeta {
  return purchaseArchiveMetaOf(spend.before, {
    at: spend.at,
    kind: spend.kind,
    label: spend.label,
    price: spend.price,
    gemsBefore: spend.gemsBefore,
    gemsAfter: spend.gemsAfter,
    profileId: spend.profileId,
    profileName,
  });
}

/**
 * Легла ли трата в базу: читаем записанное состояние и смотрим на сам результат
 * (вещь в коллекции, оттенок выбран…). Кристаллы намеренно не сверяем: между
 * покупкой и проверкой ребёнок мог получить награду или купить что-то ещё, и
 * сравнение баланса давало бы ложные откаты. Если в другой вкладке уже
 * сбросили профиль или баланс, этот сброс важнее незавершённой покупки.
 */
async function spendLanded(spend: PendingSpend, landed: (p: Profile) => boolean): Promise<boolean> {
  const raw = await guardedStorage.enqueue(async () =>
    Promise.resolve(idbStorage.getItem(MAIN_KEY)).catch(() => null),
  );
  const saved = profileInRecord(raw, spend.profileId);
  if (!saved) return false;
  const resetOnDisk =
    saved.progressResetId !== spend.progressResetId || saved.gemsResetId !== spend.gemsResetId;
  if (resetOnDisk) {
    const current = useApp.getState().profiles.find((p) => p.id === spend.profileId);
    if (!current) return true;
    const resetInMemory =
      current.progressResetId !== spend.progressResetId || current.gemsResetId !== spend.gemsResetId;
    // Другая вкладка могла сбросить профиль, пока эта проверяла покупку.
    // Подхватываем сохранённое состояние, не затирая более свежий локальный сброс.
    if (!resetInMemory) {
      await Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
      return true;
    }
  }
  return landed(saved);
}

/**
 * Проверка после записи: результат траты должен быть в базе. Не сошлось —
 * откат к копии «до покупки». Вторая попытка через 400 мс — на медленных
 * телефонах: очередь хранилища может ещё дописывать запись.
 */
function confirmSpend(spend: PendingSpend, landed: (p: Profile) => boolean): void {
  void (async () => {
    if (await spendLanded(spend, landed)) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (await spendLanded(spend, landed)) return;
    undoSpend(spend);
  })().catch(() => undefined);
}

/**
 * Трата не легла в базу — возвращаем ровно то, что было до неё.
 *
 * Кристаллы и покупки восстанавливаются из копии, а не пересчётом: между
 * нажатием и проверкой ребёнок мог успеть получить награду, и «вернуть дельту»
 * значило бы подарить или отнять лишнее.
 */
function undoSpend(spend: PendingSpend): void {
  let old: Profile | undefined;
  try {
    const parsed = JSON.parse(spend.before) as { state?: { profiles?: Profile[] } };
    old = parsed.state?.profiles?.find((p) => p?.id === spend.profileId);
  } catch {
    old = undefined;
  }
  if (!old) return;
  const current = useApp.getState().profiles.find((p) => p.id === spend.profileId);
  // Полный сброс уже отменил покупку: её поздняя проверка не должна вернуть
  // ни прежнюю коллекцию, ни кристаллы (в том числе после синхронизации вкладок).
  if (!current || current.progressResetId !== spend.progressResetId) return;
  const gemsWereReset = current.gemsResetId !== spend.gemsResetId;
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === spend.profileId
        ? { ...p, gems: gemsWereReset ? p.gems : old!.gems, shop: old!.shop, puzzle: old!.puzzle }
        : p,
    ),
    vault: pushLog(s.vault, 'purchase-failed', `${spend.label} · ${spend.price} 💎`),
  }));
  useApp.getState().showToast({
    emoji: '🛟',
    title: 'Покупка не сохранилась',
    text: gemsWereReset
      ? `${spend.label}: покупку отменили. Баланс после обнуления не изменился.`
      : `${spend.label}: кристаллы вернули. Попробуй ещё раз — всё как было до покупки.`,
  });
}

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

      createProfile: (name, avatar, classId = 2) =>
        set((s) => {
          const p = newProfile(name, avatar, isClassId(classId) ? classId : 2);
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

      startStudySession: (session) =>
        set((s) =>
          patchActive(s, (p) => {
            const today = dayKey();
            const cutoffDate = new Date(`${today}T12:00:00`);
            cutoffDate.setDate(cutoffDate.getDate() - (STUDY_SESSION_RETENTION_DAYS - 1));
            const cutoff = dayKey(cutoffDate);
            const previous = (p.studySessions ?? [])
              .filter((item) => item.day >= cutoff && item.day <= today && item.id !== session.id)
              .map((item) => item.status === 'active'
                ? { ...item, status: 'interrupted' as const, endedAt: item.lastActivityAt }
                : item);
            return {
              ...p,
              studySessions: [...previous, { ...session, status: 'active' }],
            };
          }),
        ),

      recordStudyTask: (sessionId) =>
        set((s) =>
          patchActive(s, (p) => {
            const today = dayKey();
            const day = readDay(p, today);
            return {
              ...p,
              studySessions: (p.studySessions ?? []).map((item) => item.id === sessionId && item.status === 'active'
                ? { ...item, tasks: item.tasks + 1, lastActivityAt: Date.now() }
                : item),
              days: { ...p.days, [today]: { ...day, tasks: (day.tasks ?? 0) + 1 } },
            };
          }),
        ),

      addStudyTime: (sessionId, seconds) => {
        const count = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
        if (count === 0) return;
        set((s) =>
          patchActive(s, (p) => {
            const now = Date.now();
            const today = dayKey();
            const day = readDay(p, today);
            return {
              ...p,
              studySessions: (p.studySessions ?? []).map((item) => item.id === sessionId && item.status === 'active'
                ? { ...item, activeSeconds: item.activeSeconds + count, lastActivityAt: now }
                : item),
              days: {
                ...p.days,
                [today]: { ...day, activeSeconds: (day.activeSeconds ?? 0) + count },
              },
            };
          }),
        );
      },

      finishStudySession: (sessionId, status) =>
        set((s) =>
          patchActive(s, (p) => {
            const now = Date.now();
            return {
              ...p,
              studySessions: (p.studySessions ?? []).map((item) => item.id === sessionId && item.status === 'active'
                ? { ...item, status, endedAt: now, lastActivityAt: now }
                : item),
            };
          }),
        ),

      answer: (wordId, quality, review = false, tracking) =>
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
            const dayErrorWords = { ...(day.errorWords ?? {}) };
            if (!ok) dayErrorWords[wordId] = (dayErrorWords[wordId] ?? 0) + 1;
            const recoveredWords = ok && tracking?.reason === 'repair' && !day.recoveredWords?.includes(wordId)
              ? [...(day.recoveredWords ?? []), wordId]
              : day.recoveredWords ?? [];
            const studySessions = tracking
              ? (p.studySessions ?? []).map((item) => {
                  if (item.id !== tracking.sessionId || item.status !== 'active') return item;
                  const errorWords = { ...item.errorWords };
                  const taskKindErrors = { ...item.taskKindErrors };
                  if (!ok) {
                    errorWords[wordId] = (errorWords[wordId] ?? 0) + 1;
                    taskKindErrors[tracking.taskKind] = (taskKindErrors[tracking.taskKind] ?? 0) + 1;
                  }
                  return {
                    ...item,
                    tasks: item.tasks + 1,
                    correct: item.correct + (ok ? 1 : 0),
                    wrong: item.wrong + (ok ? 0 : 1),
                    errorWords,
                    taskKindErrors,
                    recoveredWords: ok && tracking.reason === 'repair' && !item.recoveredWords.includes(wordId)
                      ? [...item.recoveredWords, wordId]
                      : item.recoveredWords,
                    lastActivityAt: Date.now(),
                  };
                })
              : p.studySessions;
            return {
              ...p,
              // План дня фиксируется здесь же (readDaily), до того как слово изменит состояние
              daily: readDaily(p),
              words: { ...p.words, [wordId]: next },
              errors: ok ? p.errors : { ...p.errors, [wordId]: (p.errors[wordId] ?? 0) + 1 },
              studySessions,
              days: {
                ...p.days,
                [today]: {
                  ...day,
                  correct: day.correct + (ok ? 1 : 0),
                  wrong: day.wrong + (ok ? 0 : 1),
                  tasks: (day.tasks ?? 0) + (tracking ? 1 : 0),
                  errorWords: dayErrorWords,
                  recoveredWords,
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

      openChest: (kind, awake = false) => {
        const current = getActive(get());
        const today = dayKey();
        if (!current || (kind !== 'daily' && kind !== 'bonus')) return null;
        const daily = readDaily(current);
        const metrics = dayMetrics(current.days[today]);
        const dailyReady =
          allQuestsDone(planOf(current, today), metrics) && !dailyChestClaimed(daily);
        const bonusReady = bonusChestsReady(metrics.lessons, daily.bonusChestsClaimed ?? 0) > 0;
        if (kind === 'daily' ? !dailyReady : !bonusReady) return null;

        const chest = rollChest(kind, { awake });
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
                // Разбуженный сундук уже получил надбавку — второй раз не платим.
                wakePaid: (freshDaily.wakePaid ?? 0) + (chest.wakeBonus ? 1 : 0),
              },
            };
          }),
        );
        return opened;
      },

      wakeChest: (kind) => {
        const current = getActive(get());
        if (!current || (kind !== 'daily' && kind !== 'bonus')) return 0;
        const daily = readDaily(current);
        const opened = kind === 'daily'
          ? dailyChestClaimed(daily)
          : (daily.bonusChestsClaimed ?? 0) > 0;
        if (!opened || (daily.wakePaid ?? 0) >= daily.chestsToday) return 0;

        const bonus = chestWakeBonus(kind);
        let paid = 0;
        set((s) =>
          patchActive(s, (p) => {
            const fresh = readDaily(p);
            const freshOpened = kind === 'daily'
              ? dailyChestClaimed(fresh)
              : (fresh.bonusChestsClaimed ?? 0) > 0;
            // Повторная проверка внутри обновления: быстрые тапы не должны платить дважды.
            if (!freshOpened || (fresh.wakePaid ?? 0) >= fresh.chestsToday) return p;
            paid = bonus;
            const lastChest = fresh.lastChest
              ? {
                  ...fresh.lastChest,
                  gems: fresh.lastChest.gems + bonus,
                  wakeBonus: (fresh.lastChest.wakeBonus ?? 0) + bonus,
                }
              : { gems: bonus, xp: 0, freezes: 0, wakeBonus: bonus };
            return {
              ...p,
              gems: p.gems + bonus,
              daily: { ...fresh, wakePaid: (fresh.wakePaid ?? 0) + 1, lastChest },
            };
          }),
        );
        return paid;
      },

      buyItem: (id) => {
        const item = ITEM_BY_ID[id];
        const p = getActive(get());
        if (!item || !p || isOwned(readShop(p).owned, id) || p.gems < item.price) return false;
        // Копия «до списания» — до того, как кристаллы куда-то денутся.
        const spend = beginSpend({
          kind: 'buy',
          label: item.title,
          price: item.price,
          profile: p,
          gemsAfter: p.gems - item.price,
        });
        const meta = spendMeta(spend, p.name);
        set((s) => ({
          ...patchActive(s, (prof) => {
            const shop = readShop(prof);
            return {
              ...prof,
              gems: prof.gems - item.price,
              shop: {
                ...shop, // новая покупка не должна стирать уже открытые оттенки
                owned: [...shop.owned, id],
                // купленное сразу надевается — ребёнку не нужно ещё раз тапать
                equipped: { ...shop.equipped, [item.slot]: id },
                wishlist: shop.wishlist?.filter((x) => x !== id),
              },
            };
          }),
          vault: { ...pushLog(s.vault, 'purchase', `${item.title} · ${item.price} 💎`), purchase: meta },
        }));
        // Покупка считается состоявшейся, только если она правда легла в базу.
        confirmSpend(spend, (prof) => isOwned(readShop(prof).owned, id));
        return true;
      },

      buyBuilding: (id) => {
        const building = BUILDING_BY_ID[id];
        const p = getActive(get());
        if (!building || !p) return false;
        if (isBuildingOwned(readShop(p).buildingsOwned, id) || p.gems < building.price) return false;
        const spend = beginSpend({ kind: 'buy', label: building.title, price: building.price, profile: p, gemsAfter: p.gems - building.price });
        const meta = spendMeta(spend, p.name);
        set((s) => ({
          ...patchActive(s, (prof) => {
            const shop = readShop(prof);
            if (isBuildingOwned(shop.buildingsOwned, id) || prof.gems < building.price) return prof;
            return {
              ...prof,
              gems: prof.gems - building.price,
              shop: { ...shop, buildingsOwned: [...(shop.buildingsOwned ?? []), id], activeBuilding: id },
            };
          }),
          vault: { ...pushLog(s.vault, 'purchase', `${building.title} · ${building.price} 💎`), purchase: meta },
        }));
        confirmSpend(spend, (prof) => isBuildingOwned(readShop(prof).buildingsOwned, id));
        return true;
      },

      buyCrystalCostume: (id) => {
        const costume = CRYSTAL_COSTUMES.find((c) => c.id === id);
        const p = getActive(get());
        if (!costume || !p) return false;
        const price = costume.price ?? 0;
        if ((readShop(p).crystalCostumesOwned ?? []).includes(id) || p.gems < price) return false;
        const spend = beginSpend({ kind: 'buy', label: costume.title, price, profile: p, gemsAfter: p.gems - price });
        const meta = spendMeta(spend, p.name);
        set((s) => ({
          ...patchActive(s, (prof) => {
            const shop = readShop(prof);
            if ((shop.crystalCostumesOwned ?? []).includes(id) || prof.gems < price) return prof;
            return {
              ...prof,
              gems: prof.gems - price,
              puzzle: { ...normalizePuzzle(prof.puzzle), worn: id },
              shop: { ...shop, crystalCostumesOwned: [...(shop.crystalCostumesOwned ?? []), id], wishlist: shop.wishlist?.filter((x) => x !== id) },
            };
          }),
          vault: { ...pushLog(s.vault, 'purchase', `${costume.title} · ${price} 💎`), purchase: meta },
        }));
        confirmSpend(spend, (prof) => (readShop(prof).crystalCostumesOwned ?? []).includes(id));
        return true;
      },

      buyBaseSet: (id) => {
        const setInfo = BASE_SETS.find((s2) => s2.id === id);
        const p = getActive(get());
        if (!setInfo || !p) return false;
        const shop0 = readShop(p);
        const pz0 = normalizePuzzle(p.puzzle);
        const price = baseSetPrice(setInfo, shop0.owned, shop0.buildingsOwned ?? [], [...pz0.assembled, ...(shop0.crystalCostumesOwned ?? [])]);
        if (price <= 0 || p.gems < price) return false;
        const spend = beginSpend({ kind: 'buy', label: setInfo.title, price, profile: p, gemsAfter: p.gems - price });
        const meta = spendMeta(spend, p.name);
        set((s) => ({
          ...patchActive(s, (prof) => {
            const shop = readShop(prof);
            const pz = normalizePuzzle(prof.puzzle);
            const curPrice = baseSetPrice(setInfo, shop.owned, shop.buildingsOwned ?? [], [...pz.assembled, ...(shop.crystalCostumesOwned ?? [])]);
            if (curPrice <= 0 || prof.gems < curPrice) return prof;
            return {
              ...prof,
              gems: prof.gems - curPrice,
              puzzle: { ...pz, worn: setInfo.costumeId },
              shop: {
                ...shop,
                owned: [...new Set([...shop.owned, setInfo.carId, setInfo.planeId])],
                equipped: { ...shop.equipped, toy: setInfo.planeId },
                buildingsOwned: (shop.buildingsOwned ?? []).includes(setInfo.baseId) ? shop.buildingsOwned : [...(shop.buildingsOwned ?? []), setInfo.baseId],
                activeBuilding: setInfo.baseId,
                worldBase: setInfo.baseId,
                crystalCostumesOwned: (shop.crystalCostumesOwned ?? []).includes(setInfo.costumeId) ? shop.crystalCostumesOwned : [...(shop.crystalCostumesOwned ?? []), setInfo.costumeId],
                wishlist: shop.wishlist?.filter((x) => x !== setInfo.costumeId && x !== setInfo.carId && x !== setInfo.planeId),
              },
            };
          }),
          vault: { ...pushLog(s.vault, 'purchase', `${setInfo.title} · ${price} 💎`), purchase: meta },
        }));
        confirmSpend(spend, (prof) => {
          const sh = readShop(prof);
          return isBuildingOwned(sh.buildingsOwned, setInfo.baseId) && isOwned(sh.owned, setInfo.carId) && isOwned(sh.owned, setInfo.planeId) && (sh.crystalCostumesOwned ?? []).includes(setInfo.costumeId);
        });
        return true;
      },

      chooseBuilding: (id) => {
        if (!BUILDING_BY_ID[id]) return false;
        const p = getActive(get());
        if (!p || !isBuildingOwned(readShop(p).buildingsOwned, id)) return false;
        set((s) => patchActive(s, (prof) => ({ ...prof, shop: { ...readShop(prof), activeBuilding: id } })));
        return true;
      },

      chooseWorldBase: (id) => {
        const p = getActive(get());
        if (!p) return false;
        const shop = readShop(p);
        const next = id === null ? null : normalizeWorldBase(id, shop.buildingsOwned ?? []);
        if (id !== null && !next) return false;
        set((s) => patchActive(s, (prof) => ({ ...prof, shop: { ...readShop(prof), worldBase: next } })));
        return true;
      },

      toggleWorld: (id) => {
        const p = getActive(get());
        if (!p) return 'locked';
        const shop = readShop(p);
        const pz = normalizePuzzle(p.puzzle);
        const next = toggleWorldPick(shop.world, id, shop.owned, [...pz.assembled, ...(shop.crystalCostumesOwned ?? [])]);
        if (next.result === 'added' || next.result === 'removed') {
          set((s) => patchActive(s, (prof) => ({ ...prof, shop: { ...readShop(prof), world: next.world } })));
        }
        return next.result;
      },

      sellItem: (id) => {
        const item = ITEM_BY_ID[id];
        const p = getActive(get());
        if (!item || !p || !isOwned(readShop(p).owned, id)) return false;
        const refund = sellPrice(item);
        // Сдача вещи — тоже необратимая трата (вещь уходит из коллекции),
        // поэтому копия «как было» снимается и здесь.
        const spend = beginSpend({
          kind: 'sell',
          label: item.title,
          price: refund,
          profile: p,
          gemsAfter: p.gems + refund,
        });
        const meta = spendMeta(spend, p.name);
        set((s) => ({
          ...patchActive(s, (prof) => {
            const shop = readShop(prof);
            // Вещь уходит — снимаем с совы/подиума и её краски:
            // открытые оттенки не повышают цену сдачи (как допы в реальности).
            const equipped: ShopState['equipped'] = { ...shop.equipped };
            if (equipped[item.slot] === id) delete equipped[item.slot];
            const tuning = shop.tuning;
            const nextTuning: ShopTuning | undefined = tuning
              ? {
                  current: Object.fromEntries(
                    Object.entries(tuning.current).filter(([key]) => key !== id),
                  ),
                  unlocked: Object.fromEntries(
                    Object.entries(tuning.unlocked).filter(([key]) => key !== id),
                  ),
                }
              : tuning;
            return {
              ...prof,
              gems: prof.gems + refund,
              shop: {
                ...shop,
                owned: shop.owned.filter((x) => x !== id),
                equipped,
                world: (shop.world ?? []).filter((x) => x !== id),
                tuning: nextTuning,
                wishlist: shop.wishlist?.filter((x) => x !== id),
              },
            };
          }),
          vault: {
            ...pushLog(s.vault, 'purchase', `сдано: ${item.title} · +${refund} 💎`),
            purchase: meta,
          },
        }));
        confirmSpend(spend, (prof) => !isOwned(readShop(prof).owned, id));
        return true;
      },

      toggleWishlist: (id) => {
        const p = getActive(get());
        if (!p) return false;
        const shop = readShop(p);
        const pz = normalizePuzzle(p.puzzle);
        const music = migrateMusicShop(repairMusicShop(p.shop));
        const ownedSet = new Set([...shop.owned, ...pz.assembled, ...(shop.crystalCostumesOwned ?? []), ...music.musicOwned]);
        if (ownedSet.has(id)) return false;
        const isValid = Boolean(ITEM_BY_ID[id] || ALL_COSTUMES.find((c) => c.id === id) || MUSIC_BY_ID[id]);
        if (!isValid) return false;

        const currentWishlist = shop.wishlist ?? [];
        const exists = currentWishlist.includes(id);
        const nextWishlist = exists
          ? currentWishlist.filter((x) => x !== id)
          : [...currentWishlist, id];

        set((s) =>
          patchActive(s, (prof) => {
            const curShop = readShop(prof);
            return {
              ...prof,
              shop: {
                ...curShop,
                wishlist: nextWishlist,
              },
            };
          }),
        );
        return !exists;
      },

      buyMusicTrack: (id) => {
        const track = MUSIC_BY_ID[id];
        const p = getActive(get());
        if (!track || !p) return false;
        const shop = readShop(p);
        if (shop.musicOwned?.includes(id) || p.gems < track.price) return false;
        const spend = beginSpend({
          kind: 'music',
          label: track.title,
          price: track.price,
          profile: p,
          gemsAfter: p.gems - track.price,
        });
        const meta = spendMeta(spend, p.name);
        set((s) => ({
          ...patchActive(s, (prof) => {
            const current = readShop(prof);
            return {
              ...prof,
              gems: prof.gems - track.price,
              shop: {
                ...current,
                musicOwned: [...(current.musicOwned ?? []), id],
                wishlist: current.wishlist?.filter((x) => x !== id),
              },
            };
          }),
          vault: { ...pushLog(s.vault, 'purchase', `${track.title} · ${track.price} 💎`), purchase: meta },
        }));
        confirmSpend(spend, (prof) => !!readShop(prof).musicOwned?.includes(id));
        return true;
      },

      setMusicTrack: (id) =>
        set((s) => patchActive(s, (prof) => {
          const shop = readShop(prof);
          if (id !== null && (!MUSIC_BY_ID[id] || !shop.musicOwned?.includes(id))) return prof;
          return { ...prof, shop: { ...shop, musicTrack: id } };
        })),

      buySoundPack: (id) => {
        const pack = SOUND_PACK_BY_ID[id];
        const p = getActive(get());
        if (!pack || !p) return false;
        const shop = readShop(p);
        // Бесплатные наборы не покупаются, а уже открытые — не покупаются повторно.
        if (!canBuySoundPack(pack, p.gems, shop.soundOwned ?? [])) return false;
        const spend = beginSpend({
          kind: 'sound',
          label: pack.title,
          price: pack.price,
          profile: p,
          gemsAfter: p.gems - pack.price,
        });
        const meta = spendMeta(spend, p.name);
        set((s) => ({
          ...patchActive(s, (prof) => {
            const current = readShop(prof);
            return {
              ...prof,
              gems: prof.gems - pack.price,
              shop: { ...current, soundOwned: [...(current.soundOwned ?? []), id] },
            };
          }),
          vault: { ...pushLog(s.vault, 'purchase', `${pack.title} · ${pack.price} 💎`), purchase: meta },
        }));
        confirmSpend(spend, (prof) => !!readShop(prof).soundOwned?.includes(id));
        return true;
      },

      setSoundPack: (id) =>
        set((s) => patchActive(s, (prof) => {
          const shop = readShop(prof);
          // Бесплатный стартовый набор доступен без записи в soundOwned.
          if (!SOUND_PACK_BY_ID[id] || !hasSoundPack(shop.soundOwned, id)) return prof;
          return { ...prof, shop: { ...shop, soundPack: id } };
        })),

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
          // Открытие нового оттенка стоит кристаллов — значит, тоже под защитой.
          const spend =
            res.spend > 0
              ? beginSpend({
                  kind: 'tint',
                  label: `${ITEM_BY_ID[itemId]?.title ?? itemId} · ${tintId}`,
                  price: res.spend,
                  profile: prof,
                  gemsAfter: Math.max(0, prof.gems - res.spend),
                })
              : null;
          const meta = spend ? spendMeta(spend, prof.name) : null;
          // Пишем только краски: res.shop собран из owned/equipped/tuning, и
          // если отдать его целиком, пропадут musicTrack, musicOwned, звуки и
          // мечты. Миграция музыки тогда считает выбор «не сделан» и включает
          // первую мелодию — ребёнок её не включал (жалоба 0.24.x).
          set((s) => ({
            ...patchActive(s, (p) => ({
              ...p,
              gems: Math.max(0, p.gems - res.spend),
              shop: { ...readShop(p), tuning: res.shop.tuning },
            })),
            ...(meta ? { vault: { ...s.vault, purchase: meta } } : {}),
          }));
          if (spend) {
            confirmSpend(spend, (p) => readShop(p).tuning?.current[itemId] === tintId);
          }
        }
        return res.outcome;
      },

      finishPuzzleLesson: () => {
        const s = get();
        const prof = s.profiles.find((x) => x.id === s.activeId);
        if (!prof) return null;
        const { puzzle, award } = awardLessonPiece(prof.puzzle);
        set((st) =>
          patchActive(st, (p) => {
            const currentShop = readShop(p);
            const nextWishlist = award.costumeId
              ? currentShop.wishlist?.filter((x) => x !== award.costumeId)
              : currentShop.wishlist;
            return {
              ...p,
              puzzle,
              gems: p.gems + award.gems,
              shop: {
                ...currentShop,
                wishlist: nextWishlist,
              },
            };
          }),
        );
        return award;
      },

      choosePuzzleCostume: (id) =>
        set((s) =>
          patchActive(s, (p) => ({ ...p, puzzle: chooseCollecting(p.puzzle, id) })),
        ),

      toggleCostume: (id) =>
        set((s) =>
          patchActive(s, (p) => {
            const shop = readShop(p);
            return { ...p, puzzle: toggleWorn(p.puzzle, id, shop.crystalCostumesOwned ?? []) };
          }),
        ),

      chooseChestSkin: (id) =>
        set((s) =>
          patchActive(s, (p) => {
            // Запертый облик игнорируем молча: выбраться из «чужого» состояния
            // (например, из загруженного файла) можно всегда — активный облик
            // всё равно считается от прогресса (activeChestSkin).
            const { unlocked } = skinState(skinById(id), p);
            if (!unlocked) return p;
            return p.chestSkin === id ? p : { ...p, chestSkin: id };
          }),
        ),

      recordChestSkins: (ids) =>
        set((s) =>
          patchActive(s, (p) => {
            const have = new Set(p.chestSkins ?? []);
            const add = ids.filter((id) => !have.has(id));
            if (!add.length) return p;
            return { ...p, chestSkins: [...have, ...add] };
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

      /** Меняем только баланс; копия профиля позволяет отменить ошибочный сброс. */
      resetGems: (id) => {
        const prev = get().profiles.find((p) => p.id === id);
        if (!prev || prev.gems === 0) return;
        const gemsResetId = nextResetId();
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, gems: 0, gemsResetId } : p)),
          vault: pushLog(addTrash(s.vault, prev, 'gems-reset'), 'gems-reset', `${prev.name} · ${prev.gems} 💎`),
        }));
      },

      /** Сброс тоже обратим: прежний профиль остаётся в корзине 30 дней. */
      resetProfile: (id) =>
        set((s) => {
          const prev = s.profiles.find((p) => p.id === id);
          if (!prev) return {};
          const resetId = nextResetId();
          const fresh: Profile = {
            ...newProfile(prev.name, prev.avatar),
            id,
            createdAt: prev.createdAt,
            progressResetId: resetId,
            gemsResetId: resetId,
          };
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
      // ── Списки слов к контрольной (0.58.0) ─────────────────────────────────
      addList: (title, rawText, customWords) => {
        const state = get();
        const active = state.profiles.find((p) => p.id === state.activeId);
        const grade = active?.activeClass ?? 2;
        const parsed = parseWordList(rawText, { ...(active?.customWords ?? {}), ...(customWords ?? {}) }, grade);
        if (!parsed.wordIds.length) return { list: null, bank: 0, custom: 0, duplicates: parsed.items.filter((i) => i.source === 'duplicate').length };
        const list = makeList(title, parsed.wordIds);
        set((s) => patchActive(s, (p) => ({
          ...p,
          lists: [...(p.lists ?? []), list].slice(-20),
          customWords: { ...(p.customWords ?? {}), ...parsed.customWords },
        })));
        return {
          list,
          bank: parsed.items.filter((i) => i.source === 'bank').length,
          custom: parsed.items.filter((i) => i.source === 'custom').length,
          duplicates: parsed.items.filter((i) => i.source === 'duplicate').length,
        };
      },
      removeList: (listId) =>
        set((s) => patchActive(s, (p) => ({ ...p, lists: (p.lists ?? []).filter((l) => l.id !== listId) }))),
      renameList: (listId, title) =>
        set((s) => patchActive(s, (p) => ({
          ...p,
          lists: (p.lists ?? []).map((l) =>
            l.id === listId ? { ...l, title: title.trim() ? title.trim().slice(0, 80) : l.title } : l,
          ),
        }))),
      setCustomWordStress: (wordId, index) =>
        set((s) => patchActive(s, (p) => {
          const word = p.customWords?.[wordId];
          if (!word) return p;
          return { ...p, customWords: { ...p.customWords, [wordId]: withStress(word, index, true) } };
        })),
      touchList: (listId) =>
        set((s) => patchActive(s, (p) => ({
          ...p,
          lists: (p.lists ?? []).map((l) => (l.id === listId ? { ...l, lastRunAt: Date.now() } : l)),
        }))),
      saveListRun: (listId, run) =>
        set((s) => patchActive(s, (p) => ({
          ...p,
          lists: (p.lists ?? []).map((l) => {
            if (l.id !== listId) return l;
            const entry: ListRun = {
              at: Date.now(),
              mode: run.mode,
              total: Math.max(0, Math.floor(run.total)),
              correct: Math.max(0, Math.min(Math.floor(run.total), Math.floor(run.correct))),
              wrong: [...new Set(run.wrong)],
              ...(run.listSize ? { listSize: Math.floor(run.listSize) } : {}),
            };
            const runs = [...(l.runs ?? []), entry].slice(-LIST_RUNS_LIMIT);
            return {
              ...l,
              runs,
              lastRunAt: Date.now(),
              // Полная контрольная обновляет «итог последней контрольной»:
              // именно на него опирается режим «тренировать ошибки».
              ...(run.mode === 'check'
                ? { lastCheck: { at: entry.at, total: entry.total, correct: entry.correct, wrong: entry.wrong } }
                : {}),
            };
          }),
        }))),
      setListDrillSize: (size) =>
        set((s) => patchActive(s, (p) => ({ ...p, listDrillSize: Math.max(0, Math.floor(size)) }))),
      saveListCheck: (listId, result) =>
        set((s) => patchActive(s, (p) => ({
          ...p,
          lists: (p.lists ?? []).map((l) =>
            l.id === listId
              ? {
                  ...l,
                  lastRunAt: Date.now(),
                  lastCheck: {
                    at: Date.now(),
                    total: Math.max(0, result.total),
                    correct: Math.max(0, Math.min(result.total, result.correct)),
                    wrong: [...new Set(result.wrong)],
                  },
                }
              : l,
          ),
        }))),

      setLessonSize: (size) =>
        set((s) => patchActive(s, (p) => ({ ...p, lessonSize: size, adaptiveGood: 0 }))),

      setActiveClass: (classId) =>
        set((s) =>
          patchActive(s, (p) => {
            const next = isClassId(classId) ? classId : 2;
            if ((p.activeClass ?? 2) === next) return p;
            // Только эти два поля: смена программы не должна трогать ни опыт,
            // ни товары, ни награды, ни прогресс по словам и урокам.
            return { ...p, activeClass: next, adaptiveGood: 0 };
          }),
        ),

      setBukFacts: (patch) =>
        set((s) =>
          patchActive(s, (p) => {
            const facts = normalizeBukFacts({ ...p.bukFacts, ...patch, toldAt: Date.now() });
            return { ...p, bukFacts: facts };
          }),
        ),

      setProfileClass: (profileId, classId) =>
        set((s) => ({
          profiles: s.profiles.map((p) => {
            const next = isClassId(classId) ? classId : 2;
            if (p.id !== profileId || (p.activeClass ?? 2) === next) return p;
            return { ...p, activeClass: next, adaptiveGood: 0 };
          }),
        })),

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
       *
       * Действия с основной записью идут ЧЕРЕЗ ОЧЕРЕДЬ сторожа
       * (guardedStorage.enqueue): «висящая» в очереди обычная сохранёнка не
       * должна лечь поверх восстановления и тихо его отменить. Внутри очереди
       * НЕЛЬЗЯ трогать profiles через set(): persist записал бы память, где
       * профили ещё прежние, и затёр бы восстановленную запись. Поэтому метка
       * запасной копии ставится в сейф уже ПОСЛЕ rehydrate.
       */
      restoreSnapshot: async (slot) => {
        const raw = await readSnapshot(slot);
        if (!raw) return false;
        const spare = await guardedStorage.enqueue(async () => {
          const current = await Promise.resolve(idbStorage.getItem(MAIN_KEY)).catch(() => null);
          let spareMeta: { prev: string; slot: number } | null = null;
          if (current && current !== raw) {
            const busy = useApp.getState().vault.snapshots.filter((s) => s.slot !== slot);
            const spareSlot = nextSlot(busy);
            // Копия «того, что было до восстановления»: восстановление отменяемо.
            await writeSnapshot(spareSlot, current).catch(() => undefined);
            spareMeta = { prev: current, slot: spareSlot };
          }
          await idbStorage.setItem(MAIN_KEY, raw);
          return spareMeta;
        });
        unfreeze();
        await Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
        if (spare) {
          set((st) => ({
            vault: {
              ...st.vault,
              snapshots: upsertSnapshot(st.vault.snapshots, snapshotMetaOf(spare.prev, spare.slot, Date.now())),
            },
          }));
        }
        const summary = readRecord(raw);
        set((s) => ({
          vault: pushLog(s.vault, 'restore-snapshot', summary ? `${summary.count} профилей` : 'копия'),
        }));
        return true;
      },

      /**
       * Возврат к состоянию «до покупки». Тот же безопасный порядок, что у
       * restoreSnapshot: прямые операции с записью идут через очередь сторожа,
       * иначе «висящее» в очереди сохранение легло бы поверх восстановления.
       */
      restorePurchaseArchive: async () => {
        const raw = await readPurchaseArchive();
        if (!raw) return false;
        // Подпись берём до восстановления: в самой копии лежит метка более
        // ранней траты, и журнал сказал бы не про ту покупку.
        const label = useApp.getState().vault.purchase?.label;
        const spare = await guardedStorage.enqueue(async () => {
          const current = await Promise.resolve(idbStorage.getItem(MAIN_KEY)).catch(() => null);
          let spareMeta: { prev: string; slot: number } | null = null;
          if (current && current !== raw) {
            const spareSlot = nextSlot(useApp.getState().vault.snapshots);
            // Копия «того, что было до возврата»: возврат тоже отменяемый.
            await writeSnapshot(spareSlot, current).catch(() => undefined);
            spareMeta = { prev: current, slot: spareSlot };
          }
          await idbStorage.setItem(MAIN_KEY, raw);
          return spareMeta;
        });
        unfreeze();
        await Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
        if (spare) {
          set((st) => ({
            vault: {
              ...st.vault,
              snapshots: upsertSnapshot(st.vault.snapshots, snapshotMetaOf(spare.prev, spare.slot, Date.now())),
            },
          }));
        }
        set((s) => ({
          vault: pushLog(s.vault, 'purchase-restore', label ? `до покупки «${label}»` : undefined),
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
      // невалидный профиль просто выбрасывался молча. Но чтение, начатое до
      // сброса, уже устарело — иначе оно возвращает старый баланс в память.
      merge: (persisted, current) =>
        hydrationResetRevision === localResetRevision
          ? { ...current, ...normalizePersisted(persisted) }
          : current,
      // Без migrate любое расхождение версии означает потерю прогресса
      // (zustand не может мигрировать и падает внутри hydrate).
      migrate: (state) => normalizePersisted(state),
      onRehydrateStorage: () => {
        hydrationResetRevision = localResetRevision;
        return (state, error) => {
          void afterHydration(state as AppState | undefined, error);
        };
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

/**
 * Облик сундука, который ребёнок увидит сегодня (id) — примитивный селектор,
 * лишних перерисовок не создаёт. Считается от прогресса: если выбранный облик
 * почему-то заперт (старый файл, чужая версия), возвращается базовый.
 */
export function useChestSkin(): ChestSkinId {
  return useApp((s) => activeChestSkin(s.profiles.find((x) => x.id === s.activeId) ?? null));
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
