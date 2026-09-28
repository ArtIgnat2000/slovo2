// ── Магазин БУКа ────────────────────────────────────────────────────────────
//
// Пункт 4 плана: кристаллам нужна трата. Решение — «аксессуары БУКа»:
// ребёнок покупает шляпы/очки/шарфы и наряжает сову. Цены устроены так, что
// один день занятий (3 задания + сундук ≈ 24 💎) даёт простой аксессуар,
// а академическая шапочка — цель на пару дней. Картинки — в ui/MascotLook.tsx,
// здесь только правила и цены (чистая логика без React).

import type { ShopSlot } from '../types';

export interface ShopItem {
  id: string;
  slot: ShopSlot;
  title: string;
  /** Как объяснить покупку ребёнку — без канцелярита */
  desc: string;
  price: number;
}

export const SLOT_TITLE: Record<ShopSlot, string> = {
  head: 'Головные уборы',
  face: 'Очки',
  neck: 'На шею',
  badge: 'Значки',
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'cap', slot: 'head', title: 'Кепка', desc: 'БУК становится спортивным', price: 20 },
  { id: 'bow', slot: 'neck', title: 'Бантик', desc: 'Нарядный бант на шею', price: 20 },
  { id: 'scarf', slot: 'neck', title: 'Шарфик', desc: 'Тёплый, как в январе', price: 30 },
  { id: 'glasses', slot: 'face', title: 'Умные очки', desc: 'В таких всё видно правильно', price: 35 },
  { id: 'medal', slot: 'badge', title: 'Медаль', desc: 'За то, что не сдаёшься', price: 45 },
  { id: 'grad', slot: 'head', title: 'Шапочка магистра', desc: 'Самая умная шапка в совиной школе', price: 60 },
];

export const ITEM_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

export function isOwned(owned: string[], id: string): boolean {
  return owned.includes(id);
}

export function isWearing(equipped: Partial<Record<ShopSlot, string>>, item: ShopItem): boolean {
  return equipped[item.slot] === item.id;
}

/** Хватает ли кристаллов. */
export function canBuy(item: ShopItem, gems: number): boolean {
  return gems >= item.price;
}

export function missingGems(item: ShopItem, gems: number): number {
  return Math.max(0, item.price - gems);
}

/** Сколько кристаллов уже вложено в гардероб — приятная цифра в шапке магазина. */
export function wardrobeValue(owned: string[]): number {
  return owned.reduce((sum, id) => sum + (ITEM_BY_ID[id]?.price ?? 0), 0);
}

/** Пороги роста БУКа по числу освоенных слов (см. журнал плана, пункт 5). */
export const GROWTH_STEPS = [12, 30, 60];

export interface GrowthStage {
  /** 0 — птенец, 1 — ученик, 2 — знаток, 3 — магистр */
  index: number;
  title: string;
  desc: string;
  /** Сколько слов освоено нужно для следующей ступени (null — уже максимум) */
  nextAt: number | null;
}

const STAGE_TITLES = ['Птенец', 'Ученик', 'Знаток', 'Магистр'];
const STAGE_DESC = [
  'Маленький БУК только учится — как и ты',
  'БУК вырос: у него появились ушки и твёрдый характер',
  'У БУКа вырос хвост из перьев — он многое помнит',
  'Мудрый БУК: он знает все словарные слова наизусть',
];

/**
 * Рост БУКа считаем по числу ОСВОЕННЫХ слов — это честная награда за знания,
 * а не за клики. Рост только вперёд: БУК не «уменьшается», если сделать перерыв
 * (для 2 класса наказание за пропуск — плохая механика).
 */
export function growthStage(mastered: number): GrowthStage {
  let index = 0;
  for (const step of GROWTH_STEPS) if (mastered >= step) index++;
  return {
    index,
    title: STAGE_TITLES[index],
    desc: STAGE_DESC[index],
    nextAt: index < GROWTH_STEPS.length ? GROWTH_STEPS[index] : null,
  };
}

/**
 * Самая дешёвая вещь, которой ещё нет: «Ещё 8 💎 — и купишь Шарфик».
 * Помогает ребёнку понять, зачем копить (в этом и смысл траты валюты).
 */
export function closestItem(owned: string[]): ShopItem | null {
  const left = SHOP_ITEMS.filter((i) => !isOwned(owned, i.id));
  if (!left.length) return null;
  return left.reduce((best, i) => (i.price < best.price ? i : best), left[0]);
}
