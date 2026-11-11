/**
 * «Игры» — отдельная вкладка со свободными механиками (P0, H-рамка).
 *
 * Правила рамки:
 *  • нерешающие игры не пишут в SRS и не дают XP — чистое повторение;
 *  • ничего не сгорает: «Собери слово», «Филворд» и «Кроссворд дня» доступны
 *    сколь угодно часто.
 *
 * Раскладка (0.96.0, по замечанию «не помещается и неудобно»):
 *  • игры больше не лежат друг под другом «простынёй» — на экране всегда
 *    ровно одна игра, остальные переключаются сегментом сверху;
 *  • экран держит высоту окна: шапка и переключатель фиксированы, игровое
 *    поле занимает остаток и только оно прокручивается при нехватке места;
 *  • слово для сборки выбирается горизонтальной лентой (одна строка, палец
 *    ведёт вбок) — раньше 60 чипов раздували карточку на пол-экрана.
 *
 * Шапка (0.96.1, замечание «избыток слов в шапке страницы»): на телефоне
 * остался один заголовок «Игры» и сегмент выбора игры. Правило «ничего не
 * сгорает» и описание игры переехали в `title`/`aria-label` — ребёнку они не
 * нужны каждый раз, а месту над полем каждый пиксель на счету. Исключение —
 * пустое состояние: когда играть нечего, экран честно объясняет почему.
 *
 * Строка состояния игры (счётчик, «Новая сетка») стоит ПЕРЕД полем, а не под
 * ним: под полем её съедало нижнее меню (замечание 2026-11-11, скриншот:
 * строки подсказок уезжали под вкладки).
 */
import { useEffect, useMemo, useState } from 'react';
import { availableClass, WORDS_BY_GRADE } from '../../content/words';
import { MASTERED_SCORE } from '../../engine/classes';
import { useActiveProfile } from '../../state/store';
import { WordClue } from '../WordView';
import { WordTileBoard } from '../WordTileBoard';
import { WordSearchGame } from '../WordSearchGame';
import { CrosswordGame } from '../CrosswordGame';

type GameId = 'build' | 'search' | 'crossword';

/** Правило свободной практики — для взрослого, не для постоянной строки. */
const PLAY_RULE = 'Играй сколько хочешь: ничего не сгорает и ничего не считается.';

const GAMES: Array<{ id: GameId; emoji: string; title: string; oneline: string }> = [
  { id: 'build', emoji: '🧵', title: 'Собери слово', oneline: 'Выложи слово из карточек.' },
  { id: 'search', emoji: '🔎', title: 'Филворд', oneline: 'Найди слова в буквенном поле.' },
  { id: 'crossword', emoji: '✏️', title: 'Кроссворд', oneline: 'Собери слова в решётке.' },
];

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
  const [game, setGame] = useState<GameId>('build');

  useEffect(() => {
    setWordId((cur) => (cur && practice.some((w) => w.id === cur) ? cur : practice[0]?.id ?? null));
  }, [practice]);

  const word = practice.find((w) => w.id === wordId) ?? practice[0] ?? null;

  /** Следующее слово в ленте — чтобы после сборки не искать чип заново. */
  const nextWord = () => {
    if (practice.length < 2) return;
    const at = practice.findIndex((w) => w.id === word?.id);
    setWordId(practice[(at + 1) % practice.length].id);
  };

  const current = GAMES.find((g) => g.id === game) ?? GAMES[0];

  return (
    <div className="screen games-screen">
      {/* Заголовок в одну строку: «Игры». Правило рамки («ничего не сгорает»)
          живёт в title — взрослому доступно, у поля не отнимает высоту. */}
      <header className="games-head">
        <h2 className="games-title" title={PLAY_RULE}>
          🧩 Игры
        </h2>
      </header>

      <div className="games-switch" role="tablist" aria-label="Выбери игру">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            id={`games-tab-${g.id}`}
            aria-selected={game === g.id}
            aria-controls="games-stage"
            className={`games-switch-btn${game === g.id ? ' on' : ''}`}
            onClick={() => setGame(g.id)}
          >
            <span className="games-switch-emoji" aria-hidden="true">
              {g.emoji}
            </span>
            <span className="games-switch-label">{g.title}</span>
            <span className="sr-only">{g.oneline}</span>
          </button>
        ))}
      </div>

      <div
        className="games-stage"
        id="games-stage"
        role="tabpanel"
        aria-labelledby={`games-tab-${current.id}`}
      >
        {game === 'build' &&
          (practice.length === 0 ? (
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
              {/* Лента слов: одна строка с горизонтальной прокруткой — не
                  съедает высоту у игрового поля. */}
              <div className="game-picks" role="group" aria-label="Выбери слово">
                {practice.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`game-pick${w.id === word?.id ? ' on' : ''}`}
                    aria-pressed={w.id === word?.id}
                    onClick={() => setWordId(w.id)}
                  >
                    {w.text}
                  </button>
                ))}
              </div>

              {word && (
                <div className="game-board">
                  <div className="game-clue">
                    <WordClue word={word} compact />
                  </div>
                  <WordTileBoard
                    key={word.id}
                    word={word}
                    unscored
                    onNext={nextWord}
                    nextLabel="Другое слово →"
                  />
                </div>
              )}
            </div>
          ))}

        {game === 'search' && <WordSearchGame pool={practice} grade={grade} onGoLessons={onGoLessons} />}

        {game === 'crossword' && <CrosswordGame pool={practice} onGoLessons={onGoLessons} />}
      </div>
    </div>
  );
}
