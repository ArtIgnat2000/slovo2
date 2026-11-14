/**
 * Открытки остановок «Тропы слов» (0.113.0, волна A2).
 *
 * Пока нарисованы 10 из 16 остановок 2 класса; остальные получают прежнюю
 * карточку с первой картинкой/эмодзи. Так альбом не ломается на недоделанной
 * волне и новая открытка появляется ровно там, где файл уже есть.
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
};



/** Открытка остановки или `null`, если волна ещё не дошла до неё. */
export function trailPostcard(stop: TrailStop): string | null {
  return TRAIL_POSTCARDS[stop.id] ?? null;
}

/** Сколько остановок уже получили нарисованную открытку. */
export function trailPostcardCount(stops: readonly TrailStop[]): number {
  return stops.filter((stop) => !!trailPostcard(stop)).length;
}
