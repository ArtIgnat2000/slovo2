// ── Облики сундуков БУКа ────────────────────────────────────────────────────
//
// Замечание с тестирования (2026-10-14): «сундук стал лучше, но до идеала
// далеко; одного дизайна сундука явно недостаточно». Один и тот же сундук на
// каждый день — это одинаковая картинка на 15-й, 50-й и 200-й раз: награда
// перестаёт читаться как событие. Решение: у сундука появляется коллекция
// обликов — ребёнок их открывает и выбирает, какой откроется сегодня.
//
// Правила (те же, что у магазина и пазлов: ничего не покупается за кристаллы,
// ничего не теряется, ничего не выдаётся случайно):
//  • первый облик есть у всех с самого начала — сундук не «пустой» у новичка;
//  • остальные открываются за учебный путь: сколько сундуков открыто, серия
//    дней, освоенные слова. Ни один облик не требует тратить кристаллы:
//    кристаллы — на наряды БУКа, облики — за занятия;
//  • выбор свободный и в любой момент: «нравится ледяной» — пусть будет
//    ледяной, это не расходуемый предмет;
//  • ничего не сгорает: открыл — значит открыл навсегда, даже если серия
//    прервалась (облики не «отбирают» за пропуск дня). Поэтому у профиля есть
//    список уже открытых обликов: условие проверяется в момент открытия, а
//    результат остаётся в профиле и переезжает с файлом выгрузки;
//  • прогресс до следующего облика виден заранее («осталось 2 из 5»), чтобы
//    это была цель, а не лотерея.
//
// Модуль чистый: условия считаются от профиля, без React и без стора.

import type { Profile } from '../types';
import { mastered } from './srs';

export type ChestSkinId = 'travel' | 'sky' | 'ice' | 'star';

export interface ChestSkinPalette {
  /** Крышка мини-сундука (ChestGlyph) */
  lid: string;
  /** Корпус */
  body: string;
  /** Окантовка, полосы */
  band: string;
  /** Замок */
  lock: string;
  /** Акцент названия и обводки */
  glow: string;
  /** Свечение вокруг арта (rgba — чтобы не зависеть от поддержки color-mix) */
  aura: string;
}

export interface ChestSkin {
  id: ChestSkinId;
  /** Название для ребёнка: короткое, читается с одного взгляда */
  title: string;
  /** Откуда облик берётся — одна строка, без условий в коде интерфейса */
  how: string;
  /** Сколько нужно для открытия (нужно для шкалы прогресса) */
  need: number;
  /** Сколько уже набрано по этой метрике */
  progress: (p: Profile) => number;
  /** Цвета для векторного мини-сундука в карточке заданий и в списке обликов */
  palette: ChestSkinPalette;
}

/** Сколько всего открыто сундуков за всё время (счётчик живёт в `daily`). */
export function chestsOpened(p: Profile): number {
  return Math.max(0, Math.floor(p.daily?.chestsTotal ?? 0));
}

/** Освоенные слова: то же правило, что в магазине БУКа (SRS-уровень ≥ 90). */
export function wordsMastered(p: Profile): number {
  return Object.values(p.words).filter((st) => mastered(st)).length;
}

/**
 * Порядок обликов — это и есть путь: деревянный → небесный → ледяной →
 * звёздный. Условия специально трогают разные механики (сундуки, серия, слова),
 * чтобы облик нельзя было получить «одним рывком» и каждому нашлось своё.
 */
export const CHEST_SKINS: ChestSkin[] = [
  {
    id: 'travel',
    title: 'Сундук путника',
    how: 'Даётся сразу: с него всё начинается',
    need: 0,
    progress: () => 0,
    palette: {
      lid: '#b97028', body: '#d98a35', band: '#f8d68c', lock: '#6a3d62',
      glow: '#ffb347', aura: 'rgba(255, 196, 105, .62)',
    },
  },
  {
    id: 'sky',
    title: 'Небесный сундук',
    how: 'Открой 5 сундуков',
    need: 5,
    progress: chestsOpened,
    palette: {
      lid: '#d8c7f4', body: '#f3ecff', band: '#f7c85a', lock: '#7c5cff',
      glow: '#b9a6ff', aura: 'rgba(206, 186, 255, .60)',
    },
  },
  {
    id: 'ice',
    title: 'Ледяной сундук',
    how: '7 дней занятий подряд',
    need: 7,
    progress: (p) => Math.max(0, Math.floor(p.streak)),
    palette: {
      lid: '#9ad7f5', body: '#dff3ff', band: '#bfe6ff', lock: '#2f5f96',
      glow: '#8fd8ff', aura: 'rgba(150, 220, 255, .62)',
    },
  },
  {
    id: 'star',
    title: 'Звёздный сундук',
    how: 'Освой 30 слов',
    need: 30,
    progress: wordsMastered,
    palette: {
      lid: '#4b3f96', body: '#2f2a63', band: '#f0c34a', lock: '#ffd76a',
      glow: '#9f8bff', aura: 'rgba(159, 139, 255, .62)',
    },
  },
];

export const BASE_SKIN: ChestSkinId = 'travel';

export function skinById(id: string | undefined | null): ChestSkin {
  return CHEST_SKINS.find((s) => s.id === id) ?? CHEST_SKINS[0];
}

export interface ChestSkinState {
  skin: ChestSkin;
  unlocked: boolean;
  /** Открылся только что и ещё не объявлен — полка показывает бейдж «новый» */
  fresh: boolean;
  /** Сколько уже набрано (для шкалы прогресса) */
  done: number;
  /** Сколько не хватает до открытия: 0 — открыт */
  left: number;
}

/** Облики, об открытии которых ребёнку уже сказали — они же и «есть навсегда». */
function recorded(p: Profile): Set<string> {
  return new Set(Array.isArray(p.chestSkins) ? p.chestSkins : []);
}

/** Открыт ли облик: условие выполнено сейчас ИЛИ он открыт раньше (не отбираем). */
function isUnlocked(skin: ChestSkin, done: number, have: Set<string>): boolean {
  return skin.need === 0 || done >= skin.need || have.has(skin.id);
}

/**
 * Состояние одного облика: открыт ли, сколько набрано и сколько осталось.
 * `fresh` — облик открылся по условию, но о нём ещё не сказали (и он пока не
 * записан в профиль): именно такие показываем тостом и бейджем «новый».
 */
export function skinState(skin: ChestSkin, p: Profile): ChestSkinState {
  const have = recorded(p);
  const done = skin.need === 0 ? skin.need : Math.max(0, Math.floor(skin.progress(p)));
  const unlocked = isUnlocked(skin, done, have);
  const fresh = unlocked && !have.has(skin.id);
  return {
    skin,
    unlocked,
    fresh,
    done: Math.min(done, skin.need),
    left: unlocked ? 0 : skin.need - done,
  };
}

/** Все облики по порядку пути — так их показывает полка выбора. */
export function skinStates(p: Profile): ChestSkinState[] {
  return CHEST_SKINS.map((skin) => skinState(skin, p));
}

export function unlockedSkinIds(p: Profile): ChestSkinId[] {
  return skinStates(p)
    .filter((s) => s.unlocked)
    .map((s) => s.skin.id);
}

/** Облики, которые только что открылись: их надо записать и объявить один раз. */
export function newlyUnlockedSkins(p: Profile): ChestSkinId[] {
  return skinStates(p)
    .filter((s) => s.fresh)
    .map((s) => s.skin.id);
}

/**
 * Какой облик рисуем сейчас: выбранный ребёнком, если он открыт; иначе базовый.
 * Выбор хранится в профиле строкой и при выгрузке/загрузке переживает перенос,
 * а «запертый» облик (например, из файла другой версии) просто игнорируется.
 */
export function activeChestSkin(p: Profile | null): ChestSkinId {
  if (!p) return BASE_SKIN;
  const chosen = p.chestSkin as ChestSkinId | undefined;
  if (chosen && unlockedSkinIds(p).includes(chosen)) return chosen;
  return BASE_SKIN;
}

/** Ближайший незакрытый облик — для подписи «что дальше» в чеке и в списке. */
export function nextSkinState(p: Profile): ChestSkinState | null {
  const locked = skinStates(p).filter((s) => !s.unlocked);
  if (!locked.length) return null;
  return locked.reduce((best, s) => (s.left < best.left ? s : best), locked[0]);
}

/** Текст для тоста: один облик — по имени, несколько — общим счётом. */
export function skinUnlockMessage(ids: ChestSkinId[]): { title: string; text: string } | null {
  if (!ids.length) return null;
  if (ids.length === 1) {
    const skin = skinById(ids[0]);
    return { title: `Новый сундук: ${skin.title}`, text: 'Выбери его в «Обликах сундука»' };
  }
  return { title: `Открылись новые сундуки: ${ids.length}`, text: CHEST_SKINS.filter((s) => ids.includes(s.id)).map((s) => s.title).join(' · ') };
}
