/**
 * Сцена «Тропы слов» (0.111.0): слово как дорога.
 *
 * Никакого Canvas и внешних картинок: фон — градиент из токенов темы, плиты —
 * кнопки или span'ы, герой — инлайн-SVG. Поэтому сцена одинаково работает в
 * светлой и тёмной теме, не тянет сеть и не ломается на 360 px.
 *
 * `passed` — сколько плит уже позади. Герой стоит на следующей плите: она
 * подсвечена, а пройденные залиты акцентом. `-1` — герой ждёт на старте
 * (слово ещё не починено или идёт поиск картинки).
 */
import type { TrailStop } from '../engine/word-trail';
import { TrailHero, type TrailHeroState } from './TrailHero';

export function TrailScene({
  stop,
  total,
  segments,
  hiddenIndex = -1,
  passed = -1,
  interactive = false,
  wide = false,
  heroState = 'walk',
  onStep,
  note,
}: {
  stop: TrailStop;
  /** Сколько всего плит в слове. */
  total: number;
  /** Заполненные плиты слева направо (для слогов их меньше, чем `total`). */
  segments: string[];
  /** Индекс шатающейся плиты: на ней `?` вместо буквы. */
  hiddenIndex?: number;
  /** Сколько плит пройдено; -1 — герой ещё не вышел. */
  passed?: number;
  /** Можно ли шагать тапом (режим букв после починки). */
  interactive?: boolean;
  /** Слоговые плиты шире буквенных. */
  wide?: boolean;
  /** Поза героя: стоит, идёт или радуется. */
  heroState?: TrailHeroState;
  onStep?: (index: number) => void;
  /** Подпись под дорогой: что делать сейчас. */
  note?: string;
}) {
  const safePassed = Number.isFinite(passed) ? Math.max(-1, Math.min(total, Math.floor(passed))) : -1;
  return (
    <section
      className="trail-scene"
      aria-label={`Дорога к остановке «${stop.title}»`}
      data-trail-scene
    >
      <div className="trail-sky" aria-hidden="true">
        <span className="trail-sun" />
        <span className="trail-hill trail-hill-back" />
        <span className="trail-hill trail-hill-front" />
        <span className="trail-cloud">☁️</span>
      </div>

      <div className="trail-route">
        <span className="trail-landmark trail-landmark-start" aria-hidden="true" title="Начало тропы">
          🏡
        </span>

        <div className={`trail-path${wide ? ' trail-path-wide' : ''}`} role="group" aria-label="Слово-дорога">
          {Array.from({ length: total }, (_, i) => {
            const filled = i < segments.length;
            const hidden = i === hiddenIndex;
            const current = i === safePassed;
            const classes = [
              'trail-seg',
              filled ? '' : 'trail-seg-empty',
              hidden ? 'trail-seg-hidden' : '',
              i < safePassed ? 'trail-seg-passed' : '',
              current ? 'trail-seg-now' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const body = (
              <>
                <span className="trail-seg-text">{hidden ? '?' : filled ? segments[i] : ''}</span>
                {current && (
                  <span className="trail-hero" aria-hidden="true">
                    <TrailHero state={heroState} size={20} />
                  </span>
                )}
              </>
            );
            // Тап только там, где есть настоящая буква и герой ещё не дошёл:
            // пустые слоговые плиты не должны звучать как кнопки.
            if (interactive && filled && !hidden) {
              return (
                <button
                  key={i}
                  type="button"
                  className={classes}
                  data-trail-seg={i}
                  aria-label={`Плита ${i + 1}: ${segments[i]}`}
                  onClick={() => onStep?.(i)}
                >
                  {body}
                </button>
              );
            }
            return (
              <span key={i} className={classes} data-trail-seg={i} aria-hidden={!filled}>
                {body}
              </span>
            );
          })}
        </div>

        <span className="trail-landmark trail-landmark-end" aria-hidden="true" title={`Остановка «${stop.title}»`}>
          {stop.emoji}
        </span>
      </div>

      <p className="trail-scene-note">{note}</p>
    </section>
  );
}
