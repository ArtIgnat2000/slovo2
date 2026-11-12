/**
 * «Игры» — отдельная вкладка со свободными механиками (P0, H-рамка).
 *
 * Правила рамки:
 *  • игры не пишут в SRS (мягкая тренировка), но с 0.96.7 дают малый XP с
 *    суточным потолком и засчитываются в задания дня с половинным весом
 *    (`engine/game-awards.ts`, решение пользователя 2026-11-11);
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
import { troubleWords } from '../../engine/game-awards';
import { MASTERED_SCORE } from '../../engine/classes';
import { useActiveProfile } from '../../state/store';
import { Sentence, WordArt, lengthLabel } from '../WordView';
import { WordTileBoard } from '../WordTileBoard';
import { WordSearchGame } from '../WordSearchGame';
import { CrosswordGame } from '../CrosswordGame';

type GameId = 'build' | 'search' | 'crossword';

/**
 * Минимальный пул для сеточных игр. Меньше двенадцати слов — и «Новая сетка»
 * физически не может долго показывать другие слова: на трёх словах любая
 * сетка состоит из этих трёх (замечание 2026-11-11, «постоянно телефон»).
 */
const GAMES_MIN_POOL = 12;


/** Длина слова в буквах — для отсева «телепередача» и подобных. */
const lettersCount = (text: string) => [...text].filter((ch) => ch !== ' ' && ch !== '-').length;

/** Правило свободной практики — для взрослого, не для постоянной строки. */
/**
 * Правило рамки (0.96.7). Раньше здесь было «ничего не считается» — после
 * согласования наград это неправда, а честная подпись важнее красивой:
 * игры засчитываются в задания дня с половинным весом, XP — малый и с
 * суточным потолком, уроки и повторения игра не заменяет.
 */
const PLAY_RULE =
  'Играй сколько хочешь: ничего не сгорает. Одна игра не заменяет урок — прогресс в задания дня небольшой. Слова для игр берутся из тех, где были ошибки.';

const GAMES: Array<{ id: GameId; emoji: string; title: string; oneline: string }> = [
  { id: 'build', emoji: '🧵', title: 'Собери слово', oneline: 'Выложи слово из карточек.' },
  { id: 'search', emoji: '🔎', title: 'Филворд', oneline: 'Найди слова в буквенном поле.' },
  { id: 'crossword', emoji: '✏️', title: 'Кроссворд', oneline: 'Собери слова в решётке.' },
];

export function GamesScreen({ onGoLessons }: { onGoLessons: () => void }) {
  const profile = useActiveProfile();
  const grade = availableClass(profile?.activeClass ?? 2);
  const met = useMemo(() => {
    const scope = WORDS_BY_GRADE[grade].filter((w) => !w.text.includes(' '));
    const states = profile?.words ?? {};
    return scope.filter((w) => (states[w.id]?.s ?? 0) > 0);
  }, [grade, profile]);

  /**
   * Пул «Собери слово» — слова, которые ребёнок уже встречал (освоенные, если
   * их хотя бы три, иначе все встреченные).
   */
  const practice = useMemo(() => {
    const states = profile?.words ?? {};
    const mastered = met.filter((w) => (states[w.id]?.s ?? 0) >= MASTERED_SCORE);
    return (mastered.length >= 3 ? mastered : met).slice(0, 60);
  }, [met, profile]);

  /**
   * Пул «Филворда» и «Кроссворда» (0.96.5) — с добором слов класса.
   *
   * Ошибка, из-за которой слова «не менялись» три релиза подряд: пул игр
   * состоял только из встреченных слов, а у ребёнка в начале пути их три
   * (`беседа`, `телефон`, `человек` — ровно как на скриншотах). Из трёх слов
   * невозможна сетка «другими словами»: какие три взял, такие и показал.
   * Поэтому, если знакомых слов меньше GAMES_MIN_POOL, добираем по порядку
   * классовой программы — это те же слова, которые скоро встретятся в уроках,
   * и они не вытесняют знакомые (те идут первыми).
   */
  const gamesPool = useMemo(() => {
    if (met.length >= GAMES_MIN_POOL) return met.slice(0, 60);
    const ids = new Set(met.map((w) => w.id));
    const filler = WORDS_BY_GRADE[grade].filter(
      (w) => !w.text.includes(' ') && !ids.has(w.id) && lettersCount(w.text) <= 9,
    );
    return [...met, ...filler].slice(0, Math.max(GAMES_MIN_POOL, met.length));
  }, [grade, met]);
  /**
   * Слова, в которых ребёнок ошибается (0.96.7): игры показывают их первыми.
   * Берём из профиля (не из дня): «ошибся вчера» — тоже повод потренировать.
   * SRS при этом не меняется — игра остаётся мягкой тренировкой.
   */
  const priorityIds = useMemo(() => troubleWords(profile?.words ?? {}), [profile]);
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
                  {/* Подсказка «картинка + текст» в свободной игре (0.96.6).
                      Раньше здесь стоял WordClue: картинка 152 px сверху,
                      пример под ней, строка «💡 …» третьей строкой — ~214 px
                      высоты. На Android это выдавливало кнопки под нижнее
                      меню (замечание 2026-11-11, скриншот: «не помещается»).
                      Теперь образ — компактная иконка 64 px слева, текст —
                      справа: та же информация, ~76 px высоты. Композиция
                      «картинка сверху» (docs/word-cards-design.md) остаётся
                      нерушимой для карточек слов и заданий урока — здесь это
                      не карточка, а подсказка-строка. */}
                  <div className="game-clue">
                    <WordArt word={word} size={64} />
                    <div className="game-clue-body">
                      <Sentence word={word} />
                      <p className="clue-hint">
                        💡 {word.hint} · <b>{lengthLabel(word)}</b>
                      </p>
                    </div>
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

        {/* `key` по пулу: когда набор знакомых слов вырос (ребёнок прошёл
            урок), игра начинается с первой сетки нового пула, а не с курсора
            старого размера. Без этого курсор мог указывать в середину нового
            пула и первые слова выглядели «пропущенными». */}
        {game === 'search' && (
          <WordSearchGame
            key={`ws-${gamesPool.length}`}
            pool={gamesPool}
            grade={grade}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}

        {game === 'crossword' && (
          <CrosswordGame
            key={`cw-${gamesPool.length}`}
            pool={gamesPool}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}
      </div>
    </div>
  );
}
