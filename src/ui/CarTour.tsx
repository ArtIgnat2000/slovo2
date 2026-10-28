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

export function CarTour({ id, tuning, alt }: { id: string; tuning?: ShopTuning; alt: string }) {
  const [view, setView] = useState(0);
  const current = views[view];
  const total = views.length;
  return (
    <div className="lord-tour">
      <button type="button" className="lord-tour-stage" onClick={() => setView((view + 1) % total)} aria-label={current.hint}>
        {view === 0 ? <ToyArt id={id} tuning={tuning} alt={alt} /> : (
          <img key={`${id}-${current.image}`} src={`${import.meta.env.BASE_URL}cars/${id}-${current.image}.webp`} alt={`${alt}: ${viewTitle(id, view).toLowerCase()}`} width="1264" height="843" decoding="async" />
        )}
      </button>
      <div className="lord-tour-nav" role="group" aria-label="Ракурсы автомобиля">
        {views.map((entry, index) => (
          <button key={entry.title} type="button" className={`chip${index === view ? ' on' : ''}`} aria-pressed={index === view} onClick={() => setView(index)}>{viewTitle(id, index)}</button>
        ))}
      </div>
      <p className="tiny muted lord-tour-caption">{current.hint}. Интерьер — художественная визуализация, не документальная фотография модели.</p>
    </div>
  );
}
