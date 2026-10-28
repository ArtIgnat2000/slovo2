import { useState } from 'react';
import type { ShopTuning } from '../types';
import { ToyArt } from './ToyArt';

const views = [
  { title: 'Кузов', hint: 'Нажми, чтобы заглянуть в салон', image: '' },
  { title: 'Салон сверху и сбоку', hint: 'Нажми, чтобы рассмотреть руль и приборы', image: 'interior' },
  { title: 'Руль и приборная панель', hint: 'Нажми, чтобы вернуться к автомобилю', image: 'dashboard' },
] as const;

/** Only show complete, individually rendered sets; never substitute another model's interior. */
export const CAR_TOUR_IDS = new Set(['car-rolls', 'car-mercedes', 'car-bmw', 'car-brabus', 'car-maybach', 'car-lambo', 'car-bugatti', 'car-jeep', 'car-taxi', 'car-racer', 'car-tesla', 'car-atomic-base', 'car-electron-base', 'car-arctic-base', 'car-moon-base', 'car-pink-cabrio', 'car-pink-star', 'car-pink-tank']);

export function CarTour({ id, tuning, alt }: { id: string; tuning?: ShopTuning; alt: string }) {
  const [view, setView] = useState(0);
  const current = views[view];
  const title = id === 'car-pink-tank' && view === 1 ? 'Бронированная кабина' : id === 'car-pink-tank' && view === 2 ? 'Пульт управления' : id === 'car-racer' && view === 1 ? 'Открытый кокпит' : id === 'car-racer' && view === 2 ? 'Гоночный руль и приборы' : current.title;
  return (
    <div className="lord-tour">
      <button type="button" className="lord-tour-stage" onClick={() => setView((view + 1) % views.length)} aria-label={current.hint}>
        {view === 0 ? <ToyArt id={id} tuning={tuning} alt={alt} /> : (
          <img key={`${id}-${current.image}`} src={`${import.meta.env.BASE_URL}cars/${id}-${current.image}.webp`} alt={`${alt}: ${title.toLowerCase()}`} width="1264" height="843" decoding="async" />
        )}
      </button>
      <div className="lord-tour-nav" role="group" aria-label="Ракурсы автомобиля">
        {views.map((entry, index) => (
          <button key={entry.title} type="button" className={`chip${index === view ? ' on' : ''}`} aria-pressed={index === view} onClick={() => setView(index)}>{id === 'car-pink-tank' && index === 1 ? 'Бронированная кабина' : id === 'car-pink-tank' && index === 2 ? 'Пульт управления' : id === 'car-racer' && index === 1 ? 'Открытый кокпит' : id === 'car-racer' && index === 2 ? 'Руль и приборы' : entry.title}</button>
        ))}
      </div>
      <p className="tiny muted lord-tour-caption">{current.hint}. Интерьер — художественная визуализация, не документальная фотография модели.</p>
    </div>
  );
}
