import { useEffect, useState } from 'react';
import { baseTourImageUrl, baseTourStops } from '../engine/base-tours';
import { BUILDING_BY_ID } from '../engine/buildings';
import { BuildingArt, buildingArtUrl } from './BuildingArt';

/**
 * Тёплый старт экскурсии (жалоба 2026-10-29: по тапу картинки долго грузятся):
 * фасад и все комнаты базы качаем в момент тапа по карточке — к развороту листа
 * (или предпросмотра в «Моём мире») файлы уже в кэше. Начатая загрузка не зависит
 * от ссылки на неё в DOM.
 */
export function warmBaseTour(id: string): void {
  const sources = [buildingArtUrl(id)];
  for (let index = 0; index < baseTourStops(id).length; index++) {
    sources.push(baseTourImageUrl(id, index));
  }
  for (const src of sources) {
    const img = document.createElement('img');
    img.src = src;
  }
}

/**
 * Экскурсия по базе (0.76.0): фасад → пять комнат внутри, по тапу и по кругу.
 *
 * Зачем отдельный компонент, а не ещё один ракурс в CarTour: у базы нет
 * «салона» — у неё есть комнаты, и в каждой свой познавательный факт и задание
 * «найди на картинке» (`engine/base-tours.ts`). Ребёнок тапает по картинке,
 * попадает в следующую комнату, а после последней возвращается к фасаду —
 * кольцо не заканчивается, поэтому можно смотреть сколько хочешь.
 *
 * 2026-10-29: из листа убраны точки-прыжки и подсказки под кадром (жалоба:
 * «лишние кружочки и текст — увеличь фото»). Кадр идёт во всю ширину листа,
 * комнаты — тапом по нему (стандартная карусель без хрома), сколько комнат
 * и где мы — счётчик «· 2/5» в подписи комнаты под кадром; на фасаде подписи
 * нет вовсе. Подписи живут в `aria-live`: при тапе озвучка сообщает, куда мы
 * попали; вход внутрь — в aria-label сцены.
 */
export function BaseTour({
  id,
  className,
  loading = 'lazy',
}: {
  id: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}) {
  const building = BUILDING_BY_ID[id];
  const stops = baseTourStops(id);
  const frames = stops.length + 1;
  const [step, setStep] = useState(0);
  // Картинка комнаты могла не догрузиться (нет сети, кэш пуст): показываем
  // табличку комнаты, а не «сломанную» рамку. Кольцо продолжает работать.
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  // База сменилась (лист переиспользован под другую вещь) — начинаем с фасада.
  useEffect(() => setStep(0), [id]);

  if (!building) return null;
  const stop = step === 0 ? null : stops[step - 1];
  const next = (step + 1) % Math.max(frames, 1);
  const stageLabel = stop
    ? `Дальше: ${next === 0 ? 'снаружи базы' : stops[next - 1]?.title ?? ''}`
    : stops.length > 0
      ? 'Войти внутрь базы'
      : building.title;

  return (
    <div className={`base-tour${className ? ` ${className}` : ''}`} data-base-tour-id={id}>
      <button
        type="button"
        className="base-tour-stage"
        onClick={() => setStep(next)}
        aria-label={stageLabel}
      >
        {step === 0 ? (
          <BuildingArt id={id} loading={loading} decorative />
        ) : broken[step] ? (
          <span className="base-tour-missing">
            <span aria-hidden="true">{stop?.emoji}</span>
            Комната ещё строится — загляни позже
          </span>
        ) : (
          <img
            key={`${id}-${step}`}
            className="base-tour-photo"
            src={baseTourImageUrl(id, step - 1)}
            alt={`${building.title}: ${stop?.title.toLowerCase() ?? ''}`}
            width="1000"
            height="667"
            loading={loading}
            decoding="async"
            draggable={false}
            onError={() => setBroken((was) => ({ ...was, [step]: true }))}
          />
        )}
      </button>

      {/* Подпись только внутри комнаты: на фасаде под кадром пусто — никаких
          «Нажми на базу…» (жалоба 2026-10-29). Счётчик · 2/5 — стандартный
          индикатор «фото несколько» без лишних элементов на макете. */}
      {stop && (
        <div className="base-tour-copy" aria-live="polite">
          <p className="base-tour-title">
            {stop.title}
            <span className="base-tour-idx" aria-hidden="true"> · {step}/{stops.length}</span>
          </p>
          <p className="base-tour-fact">{stop.fact}</p>
          <p className="base-tour-find">🔍 <b>Найди:</b> {stop.find}</p>
        </div>
      )}
    </div>
  );
}
