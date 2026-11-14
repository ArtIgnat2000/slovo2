/**
 * Биом фона «Тропы слов» (0.113.0).
 *
 * Пять сцен — школьный двор, лес, тёплый дом, зима и город — нарисованы как
 * общие фоны для всех остановок класса. Биом выбирается по смыслу остановки,
 * а не по её номеру: ребёнок идёт по «Птицам» в лесу, а по «Вокзалу» — в
 * городе. Если у новой остановки нет записи, остаётся школьный двор: это
 * самый нейтральный фон, а не случайная картинка.
 */
import type { TrailStop } from '../engine/word-trail';

export type TrailBiome = 'school' | 'forest' | 'home' | 'winter' | 'city';

const BIOME_BY_STOP: Record<string, TrailBiome> = {
  // 1 класс
  g1_school: 'school',
  g1_schoolpeople: 'school',
  g1_birds: 'forest',
  g1_home: 'home',
  g1_adverbs: 'school',

  // 2 класс
  school: 'school',
  schoolpeople: 'school',
  birds: 'forest',
  animals: 'forest',
  food: 'home',
  garden: 'forest',
  city: 'city',
  country: 'forest',
  home: 'home',
  work: 'city',
  winter: 'winter',
  nature: 'forest',
  calendar: 'school',
  polite: 'home',
  people: 'home',
  adverbs: 'school',

  // 3 класс
  g3_week: 'school',
  g3_holiday: 'city',
  g3_numbers: 'school',
  g3_time: 'school',
  g3_weather: 'winter',
  g3_field: 'forest',
  g3_garden: 'forest',
  g3_plants: 'forest',
  g3_home: 'home',
  g3_transport: 'city',
  g3_food: 'home',
  g3_study: 'school',
  g3_feelings: 'home',

  // 4 класс
  g4_library: 'school',
  g4_talk: 'school',
  g4_when: 'school',
  g4_where: 'city',
  g4_directions: 'city',
  g4_numbers: 'school',
  g4_station: 'city',
  g4_trip: 'city',
  g4_jobs: 'city',
  g4_village: 'forest',
  g4_tech: 'city',
  g4_art: 'forest',
  g4_clothes: 'home',
  g4_country: 'forest',
  g4_character: 'school',

  // 5 класс
  g5_food: 'home',
  g5_home: 'home',
  g5_tech: 'city',
  g5_transport: 'city',
  g5_trip: 'city',
  g5_sport: 'city',
  g5_arena: 'city',
  g5_talk: 'school',
  g5_school: 'school',
  g5_country: 'forest',
  g5_directions: 'city',
  g5_where: 'city',
  g5_time: 'school',
  g5_verbs: 'school',
  g5_prefixes: 'school',
  g5_ras: 'school',
  g5_ne: 'school',
  g5_character: 'school',
  g5_people: 'home',
  g5_foreign: 'school',
  g5_music: 'city',
  g5_colors: 'forest',
};

/** Биом конкретной остановки; неизвестная остановка идёт по школьному двору. */
export function trailBiome(stop: TrailStop): TrailBiome {
  return BIOME_BY_STOP[stop.id] ?? 'school';
}

/** Сколько остановок закреплено за каждым биомом — для проверок карты. */
export function trailBiomeCounts(stops: readonly TrailStop[]): Record<TrailBiome, number> {
  const counts: Record<TrailBiome, number> = { school: 0, forest: 0, home: 0, winter: 0, city: 0 };
  for (const stop of stops) counts[trailBiome(stop)] += 1;
  return counts;
}
