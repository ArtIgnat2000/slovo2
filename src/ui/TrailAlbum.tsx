/**
 * Альбом открыток «Тропы слов» (0.111.0).
 *
 * Прогресс уже лежит в `profile.trail.cards` (id закрытых остановок) и
 * `profile.trail.words` (все пройденные слова), поэтому альбом — чистая
 * витрина без новых действий в store: ни валюты, ни покупок, ни обмена.
 *
 * Карточка закрытой остановки показывает первую картинку, слово, подсказку и
 * опасную букву; незакрытая — эмодзи остановки и «Впереди»/«Сейчас на тропе».
 * Это одновременно карта 16 остановок 2 класса, а не отдельный экран.
 */
import type { TrailProgress } from '../types';
import type { TrailStop } from '../engine/word-trail';
import { WORD_BY_ID } from '../content/words';
import { WordArt } from './WordView';

export function TrailAlbum({
  stops,
  progress,
  currentIndex,
  onClose,
}: {
  stops: readonly TrailStop[];
  progress: TrailProgress;
  /** Индекс остановки, на которой ребёнок остановился (0-based). */
  currentIndex: number;
  onClose: () => void;
}) {
  const earnedCount = stops.filter(
    (stop) => stop.wordIds.length > 0 && stop.wordIds.every((id) => progress.words.includes(id)),
  ).length;
  const safeCurrent = Math.max(0, Math.min(currentIndex, Math.max(0, stops.length - 1)));

  return (
    <section className="trail-album" aria-label="Открытки и карта тропы" data-trail-album>
      <header className="trail-head">
        <button type="button" className="btn ghost sm trail-back" onClick={onClose} aria-label="Вернуться к тропе">
          ← <span className="trail-back-text">К тропе</span>
        </button>
        <div className="trail-head-body">
          <h2 className="trail-title">🎴 Открытки</h2>
          <p className="trail-sub">
            {earnedCount === 0
              ? 'Первая открытка — за первую остановку'
              : `Открыто ${earnedCount} из ${stops.length}`}
          </p>
        </div>
      </header>

      <div className="trail-album-scroll">
        <div className="trail-album-grid">
          {stops.map((stop, index) => {
            const word = WORD_BY_ID[stop.wordIds[0]];
            const earned =
              stop.wordIds.length > 0 && stop.wordIds.every((id) => progress.words.includes(id));
            const current = index === safeCurrent;
            const danger =
              earned && word && word.danger.length > 0 ? [...word.text][word.danger[0]] : '';
            return (
              <article
                key={stop.id}
                className={`trail-album-card${earned ? ' earned' : ''}${current ? ' now' : ''}`}
                data-trail-card={stop.id}
                data-trail-earned={earned ? '1' : '0'}
                aria-label={
                  earned && word
                    ? `${index + 1}. ${stop.title}. ${word.text}. ${word.hint}`
                    : `${index + 1}. ${stop.title}. ${current ? 'Сейчас на тропе' : 'Впереди'}`
                }
              >
                <div className="trail-album-art" aria-hidden="true">
                  {earned && word ? <WordArt word={word} size={64} lazy /> : <span>{stop.emoji}</span>}
                </div>
                <div className="trail-album-body">
                  <p className="trail-album-stop">
                    <span aria-hidden="true">{stop.emoji}</span> {index + 1}. {stop.title}
                  </p>
                  {earned && word ? (
                    <>
                      <p className="trail-album-word">{word.text}</p>
                      <p className="trail-album-hint">💡 {word.hint}</p>
                      {danger && <p className="trail-album-danger">Опасная буква: {danger}</p>}
                    </>
                  ) : (
                    <p className="trail-album-state">{current ? 'Сейчас на тропе' : 'Впереди'}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className="trail-album-note tiny muted">
          Открытка открывается, когда пройдены все слова остановки. Остановки открываются по порядку.
        </p>
      </div>
    </section>
  );
}
