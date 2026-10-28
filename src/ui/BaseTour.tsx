import { useEffect, useState } from 'react';
import { baseTourImageUrl, baseTourStops } from '../engine/base-tours';
import { plural } from '../engine/quests';
import { BUILDING_BY_ID } from '../engine/buildings';
import { BuildingArt } from './BuildingArt';

/**
 * Экскурсия по базе (0.76.0): фасад → пять комнат внутри, по тапу и по кругу.
 *
 * Зачем отдельный компонент, а не ещё один ракурс в CarTour: у базы нет
 * «салона» — у неё есть комнаты, и в каждой свой познавательный факт и задание
 * «найди на картинке» (`engine/base-tours.ts`). Ребёнок тапает по картинке,
 * попадает в следующую комнату, а после последней возвращается к фасаду —
 * кольцо не заканчивается, поэтому можно смотреть сколько хочешь.
 *
 * Кнопки-точки под картинкой позволяют прыгнуть в любую комнату сразу: на
 * телефоне удобнее попасть в «реакторный зал», чем пролистать три кадра.
 * Подписи живут в `aria-live`: при тапе озвучка сообщает, куда мы попали.
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
        <span className={`base-tour-badge${step === 0 ? ' front' : ''}`}>
          {step === 0 ? '🏙️ Снаружи · нажми, чтобы войти' : `${stop?.emoji} ${stop?.title} · ${step}/${stops.length}`}
        </span>
      </button>

      {frames > 1 && (
        <div className="base-tour-dots" role="group" aria-label="Комнаты базы">
          <button
            type="button"
            className={`base-tour-dot${step === 0 ? ' on' : ''}`}
            aria-pressed={step === 0}
            aria-label="Снаружи"
            title="Снаружи"
            onClick={() => setStep(0)}
          >
            🏙️
          </button>
          {stops.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              className={`base-tour-dot${step === index + 1 ? ' on' : ''}`}
              aria-pressed={step === index + 1}
              aria-label={entry.title}
              title={entry.title}
              onClick={() => setStep(index + 1)}
            >
              {entry.emoji}
            </button>
          ))}
        </div>
      )}

      <div className="base-tour-copy" aria-live="polite">
        {stop ? (
          <>
            <p className="base-tour-title">{stop.title}</p>
            <p className="base-tour-fact">{stop.fact}</p>
            <p className="base-tour-find">🔍 <b>Найди:</b> {stop.find}</p>
          </>
        ) : (
          <p className="base-tour-fact">
            {stops.length > 0
              ? `Нажми на базу — внутри ${stops.length} ${plural(stops.length, 'комната', 'комнаты', 'комнат')} с настоящими научными секретами.`
              : 'Нажми на базу, чтобы рассмотреть её снаружи.'}
          </p>
        )}
      </div>
    </div>
  );
}
