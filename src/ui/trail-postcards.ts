/**
 * Открытки остановок «Тропы слов» (0.113.0, волна A2).
 *
 * Нарисованы все 16 остановок 2 класса. Для другого класса или новой
 * остановки функция честно возвращает `null`, и UI показывает прежнюю
 * карточку с первой картинкой/эмодзи: альбом не ломается на недоделанной
 * волне.
 */
import type { TrailStop } from '../engine/word-trail';
import animals from '../assets/postcards/animals.webp';
import birds from '../assets/postcards/birds.webp';
import city from '../assets/postcards/city.webp';
import country from '../assets/postcards/country.webp';
import food from '../assets/postcards/food.webp';
import garden from '../assets/postcards/garden.webp';
import home from '../assets/postcards/home.webp';
import school from '../assets/postcards/school.webp';
import schoolpeople from '../assets/postcards/schoolpeople.webp';
import work from '../assets/postcards/work.webp';
import winter from '../assets/postcards/winter.webp';
import nature from '../assets/postcards/nature.webp';
import calendar from '../assets/postcards/calendar.webp';
import polite from '../assets/postcards/polite.webp';
import people from '../assets/postcards/people.webp';
import adverbs from '../assets/postcards/adverbs.webp';

const TRAIL_POSTCARDS: Record<string, string> = {
  school,
  schoolpeople,
  birds,
  animals,
  food,
  garden,
  city,
  country,
  home,
  work,
  winter,
  nature,
  calendar,
  polite,
  people,
  adverbs,
};



/** Открытка остановки или `null`, если волна ещё не дошла до неё. */
export function trailPostcard(stop: TrailStop): string | null {
  return TRAIL_POSTCARDS[stop.id] ?? null;
}

/** Сколько остановок уже получили нарисованную открытку. */
export function trailPostcardCount(stops: readonly TrailStop[]): number {
  return stops.filter((stop) => !!trailPostcard(stop)).length;
}
