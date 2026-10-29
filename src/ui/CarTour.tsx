import { useState } from 'react';
import type { ShopTuning } from '../types';
import { ToyArt } from './ToyArt';

const views = [
  { title: 'Кузов', hint: 'Нажми, чтобы заглянуть в салон', image: '' },
  { title: 'Салон сверху и сбоку', hint: 'Нажми, чтобы рассмотреть руль и приборы', image: 'interior' },
  { title: 'Руль и приборная панель', hint: 'Нажми, чтобы вернуться к автомобилю', image: 'dashboard' },
] as const;

/**
 * Подписи ракурсов для техники, у которой «салон» называется иначе: у танка —
 * кабина, у болида — кокпит, у паровоза (0.76.0) — котёл и будка машиниста.
 * Без своей строки вещь показывает общие автомобильные подписи.
 */
const TOUR_LABELS: Record<string, [string, string, string]> = {
  'car-pink-tank': ['Корпус', 'Бронированная кабина', 'Пульт управления'],
  'car-racer': ['Кузов', 'Открытый кокпит', 'Гоночный руль и приборы'],
  'car-steam-base': ['Паровоз', 'Котёл и ведущие колёса', 'Будка машиниста'],
};

/** Only show complete, individually rendered sets; never substitute another model's interior. */
export const CAR_TOUR_IDS = new Set(['car-rolls', 'car-mercedes', 'car-bmw', 'car-brabus', 'car-maybach', 'car-lambo', 'car-bugatti', 'car-jeep', 'car-taxi', 'car-racer', 'car-tesla', 'car-atomic-base', 'car-electron-base', 'car-arctic-base', 'car-moon-base', 'car-steam-base', 'car-pink-cabrio', 'car-pink-star', 'car-pink-tank']);

/** Название ракурса: своя подпись вещи или общая автомобильная. */
function viewTitle(id: string, index: number): string {
  return TOUR_LABELS[id]?.[index] ?? views[index].title;
}

/**
 * Тёплый старт ракурсов: качаем оба снимка в момент тапа по карточке — к развороту
 * подробной карточки файлы уже в кэше и по тапу ничего не «долго грузится»
 * (жалоба 2026-10-29). Начатая загрузка не зависит от наличия ссылки на неё в DOM.
 */
export function warmCarTour(id: string): void {
  if (!CAR_TOUR_IDS.has(id)) return;
  for (const shot of ['interior', 'dashboard']) {
    const img = document.createElement('img');
    img.src = `${import.meta.env.BASE_URL}cars/${id}-${shot}.webp`;
  }
}

/**
 * Лист салона для подробной карточки машины (0.75.0). Кнопок-ракурсов, подписей
 * и точек-пагинации на кадре нет (просьбы 2026-10-29: «кнопки вообще не нужны»,
 * «текст на картинке убери», «кружочки … лишние — стандартные подходы, не портите
 * дизайн»): кадр во всю ширину листа, ракурсы листаются тапом по снимку — про них
 * говорит aria-label сцены и sr-only-подпись с дисклеймером визуализации.
 */
export function CarTour({ id, tuning, alt }: { id: string; tuning?: ShopTuning; alt: string }) {
  const [view, setView] = useState(0);
  const current = views[view];
  const total = views.length;
  return (
    <div className="lord-tour">
      <button type="button" className="lord-tour-stage" onClick={() => setView((view + 1) % total)} aria-label={current.hint}>
        {view === 0 ? <ToyArt id={id} tuning={tuning} alt={alt} /> : (
          <img key={`${id}-${current.image}`} src={`${import.meta.env.BASE_URL}cars/${id}-${current.image}.webp`} alt={`${alt}: ${viewTitle(id, view).toLowerCase()}`} width="1000" height="667" decoding="async" />
        )}
      </button>
      <p className="sr-only">{current.hint}. Интерьер — художественная визуализация, не документальная фотография модели.</p>
    </div>
  );
}
