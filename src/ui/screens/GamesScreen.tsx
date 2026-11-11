/**
 * «Игры» — отдельная вкладка со свободными механиками (P0, H-рамка).
 *
 * Правила рамки:
 *  • нерешающие игры не пишут в SRS и не дают XP — чистое повторение;
 *  • ничего не сгорает: «Собери слово», «Филворд» и «Кроссворд дня» доступны
 *    сколь угодно часто.
 */
import { useEffect, useMemo, useState } from 'react';
import { availableClass, WORDS_BY_GRADE } from '../../content/words';
import { MASTERED_SCORE } from '../../engine/classes';
import { useActiveProfile } from '../../state/store';
import { WordClue } from '../WordView';
import { WordTileBoard } from '../WordTileBoard';
import { WordSearchGame } from '../WordSearchGame';
import { CrosswordGame } from '../CrosswordGame';

export function GamesScreen({ onGoLessons }: { onGoLessons: () => void }) {
  const profile = useActiveProfile();
  const grade = availableClass(profile?.activeClass ?? 2);
  const practice = useMemo(() => {
    const scope = WORDS_BY_GRADE[grade].filter((w) => !w.text.includes(' '));
    const states = profile?.words ?? {};
    const met = scope.filter((w) => (states[w.id]?.s ?? 0) > 0);
    const mastered = met.filter((w) => (states[w.id]?.s ?? 0) >= MASTERED_SCORE);
    // Осваиваем то, что знаем лучше всего; если освоено мало — всё встреченное.
    return (mastered.length >= 3 ? mastered : met).slice(0, 60);
  }, [grade, profile]);
  const [wordId, setWordId] = useState<string | null>(null);
  useEffect(() => {
    setWordId((cur) => (cur && practice.some((w) => w.id === cur) ? cur : practice[0]?.id ?? null));
  }, [practice]);
  const word = practice.find((w) => w.id === wordId) ?? practice[0] ?? null;

  return (
    <div className="screen games-screen">
      <h2 className="mb">🧩 Игры</h2>
      <p className="tiny muted mb">Играй сколько хочешь: ничего не сгорает и ничего не считается.</p>

      <div className="games-duo">
      <section className="games-section" aria-label="Свободная практика">
        <h3 className="games-section-title">Свободная практика</h3>

        {practice.length === 0 ? (
          <div className="games-empty">
            <div className="games-empty-emoji" aria-hidden="true">🧶</div>
            <p className="games-empty-title">Пока нечего собирать</p>
            <p className="tiny muted">Сначала пройди пару уроков — и здесь появятся слова, которые ты уже встречал.</p>
            <button type="button" className="btn primary wide" onClick={onGoLessons}>
              К урокам →
            </button>
          </div>
        ) : (
          <div className="game-card game-practice">
            <div className="game-practice-head">
              <div className="game-practice-emoji" aria-hidden="true">🧵</div>
              <div>
                <h3 className="game-practice-title">Собери слово</h3>
                <p className="tiny muted">Выложи слово из карточек.</p>
              </div>
            </div>
            {word && (
              <>
                <WordClue word={word} compact />
                <WordTileBoard key={word.id} word={word} unscored />
                <div className="game-picks" role="group" aria-label="Выбери слово">
                  {practice.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={`game-pick${w.id === word.id ? ' on' : ''}`}
                      aria-pressed={w.id === word.id}
                      onClick={() => setWordId(w.id)}
                    >
                      {w.text}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="games-section" aria-label="Филворд">
        <h3 className="games-section-title">Филворд</h3>
        <WordSearchGame pool={practice} grade={grade} onGoLessons={onGoLessons} />
      </section>
      </div>

      <section className="games-section" aria-label="Кроссворд дня">
        <h3 className="games-section-title">Кроссворд дня</h3>
        <CrosswordGame pool={practice} onGoLessons={onGoLessons} />
      </section>
    </div>
  );
}
