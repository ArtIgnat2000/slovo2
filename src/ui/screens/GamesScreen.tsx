import { MemoryGame } from '../MemoryGame';
import { GameRecords } from '../GameRecords';
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
 *
 * Планшет (0.97.0): экран «Игры» шире (до 1040 px), а сама игра внутри
 * разложена в две колонки — поле и вопросы рядом, а не друг под другом.
 * На iPad одна колонка не помещалась по вертикали: список вопросов уезжал
 * под нижнее меню (замечание 2026-11-12, скриншот).
 */
import { useEffect, useMemo, useState } from 'react';
import { availableClass, WORDS_BY_GRADE } from '../../content/words';
import { troubleWords } from '../../engine/game-awards';
import { dayGameAccess, isGameOpen, lockHint, pluralGames } from '../../engine/game-access';
import { dayKey } from '../../engine/day';
import { planOf } from '../../engine/quests';
import { MASTERED_SCORE } from '../../engine/classes';
import { todayStat, useActiveProfile, useApp } from '../../state/store';
import { Sentence, WordArt, lengthLabel } from '../WordView';
import { WordTileBoard } from '../WordTileBoard';
import { WordSearchGame } from '../WordSearchGame';
import { CrosswordGame } from '../CrosswordGame';

type GameId = 'build' | 'search' | 'crossword' | 'memory';
/** Группа по времени игры, а не по «жанру»: ребёнку так понятнее (§4-B). */
type GameGroup = 'fast' | 'think';

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
  'Ничего не сгорает: одна игра открыта всегда, остальные — за успехи дня (уроки, задания дня и баллы). Уже открытое не отнимается, ошибки и подсказки доступ не уменьшают. Одна игра не заменяет урок — прогресс в задания дня небольшой. Слова для игр берутся из тех, где были ошибки.';

/**
 * Витрина игр (0.99.0, решение владельца — вариант B из §4).
 *
 * Порядок в массиве — это и есть порядок открытия: индекс 0 открыт всегда,
 * 1 — после первого ключа дня и так далее (`engine/game-access.ts`). Поэтому
 * базовая игра («Собери слово») стоит первой: без игры ребёнок не остаётся
 * никогда, даже если сегодня не было ни урока, ни задания.
 *
 * Группы — по времени: «Быстро» на 1–2 минуты и «Подумать» на 3–5. Две
 * группы вместо трёх кнопок в один ряд — чтобы на 360 px подписи читались,
 * и чтобы четвёртая игра не ломала полосу (см. §4 плана).
 */
const GAMES: Array<{ id: GameId; emoji: string; title: string; oneline: string; group: GameGroup }> = [
  { id: 'build', emoji: '🧵', title: 'Собери слово', oneline: 'Выложи слово из карточек.', group: 'fast' },
  { id: 'search', emoji: '🔎', title: 'Филворд', oneline: 'Найди слова в буквенном поле.', group: 'think' },
  { id: 'crossword', emoji: '✏️', title: 'Кроссворд', oneline: 'Собери слова в решётке.', group: 'think' },
  { id: 'memory', emoji: '🧠', title: 'Мемори', oneline: 'Найди пары карточек.', group: 'think' },
];

/** Две группы вкладки: подписи короткие, цели ≥ 44 px. */
const GROUPS: Array<{ id: GameGroup; emoji: string; title: string }> = [
  { id: 'fast', emoji: '⚡', title: 'Быстро' },
  { id: 'think', emoji: '🧠', title: 'Подумать' },
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
  // Unlike letter grids, Memory has no word-length ceiling: fifth-grade
  // long words and phrases must not disappear from its pool.
  const memoryPool = useMemo(() => {
    const ids = new Set(met.map(w => w.id));
    return [...met, ...WORDS_BY_GRADE[grade].filter(w => !ids.has(w.id))];
  }, [met, grade]);
  const priorityIds = useMemo(() => troubleWords(profile?.words ?? {}), [profile]);
  const [wordId, setWordId] = useState<string | null>(null);
  const settings = useApp((s) => s.settings);

  /**
   * Доступ за успехи дня (0.99.0, §8 плана). Считается на лету из уже
   * сохранённого дня: в профиле ничего нового не лежит, поэтому нет миграции,
   * а полночь сбрасывает шкалу сама.
   *
   * Ключи: уроки (≤ 2) + закрытые задания дня + 1 за баллы дня без наград игр.
   * По умолчанию `points`; взрослый может вернуть старое поведение (`open`).
   */
  const access = useMemo(() => {
    const day = dayKey();
    return dayGameAccess({
      day: profile ? todayStat(profile) : undefined,
      dailyGoal: settings.dailyGoal,
      plan: profile ? planOf(profile, day) : [],
      totalGames: GAMES.length,
      gates: settings.gamesGates,
    });
  }, [profile, settings.dailyGoal, settings.gamesGates]);

  /**
   * Открытая игра. Замок — не «нельзя», а «ещё не сейчас»: если выбранная
   * игра закрыта (например, день переключился с утра), показываем первую
   * открытую, а не пустой экран.
   */
  const openGame = (id: GameId): GameId => {
    const idx = GAMES.findIndex((g) => g.id === id);
    if (idx >= 0 && isGameOpen(access, idx)) return id;
    const firstOpen = GAMES.findIndex((_, i) => isGameOpen(access, i));
    return GAMES[Math.max(0, firstOpen)]?.id ?? 'build';
  };
  const [game, setGame] = useState<GameId>('build');
  /** Группа, которую видно сейчас. Запоминается в сессии, как и игра. */
  const [group, setGroup] = useState<GameGroup>(() => GAMES.find((g) => g.id === 'build')?.group ?? 'fast');
  /** Условие для закрытой карточки: показываем строкой, а не «молчанием». */
  const [lockNote, setLockNote] = useState('');
  // Открылась игра или сменился день — старая подсказка про замок больше не нужна.
  useEffect(() => {
    setLockNote('');
  }, [access.openCount]);
  // Выбрали другую группу — подсказка про замок из прошлой группы не относится.
  useEffect(() => {
    setLockNote('');
  }, [group]);

  // Выбранная игра может оказаться закрытой (новый день, настройка родителя):
  // тогда мягко переводим на первую открытую и показываем её группу.
  useEffect(() => {
    const safe = openGame(game);
    if (safe !== game) setGame(safe);
    const g = GAMES.find((it) => it.id === safe);
    if (g && g.group !== group) setGroup(g.group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.openCount, settings.gamesGates]);

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
  /** Игры видимой группы: карточки 2×2 внутри неё. */
  const groupGames = GAMES.filter((g) => g.group === group);
  const groupAllLocked = groupGames.every((g) => !isGameOpen(access, GAMES.indexOf(g)));

  return (
    <div className="screen games-screen">
      {/* Заголовок в одну строку: «Игры». Правило рамки («ничего не сгорает»)
          живёт в title — взрослому доступно, у поля не отнимает высоту. */}
      <header className="games-head">
        <h2 className="games-title" title={PLAY_RULE}>
          🧩 Игры
        </h2>
      </header>

      {/* Две группы вместо трёх кнопок в один ряд (0.99.0, §4-B): подписи
          читаются на 360 px и место остаётся для новых игр. */}
      <div className="games-switch" role="tablist" aria-label="Выбери, как играть">
        {GROUPS.map((gr) => (
          <button
            key={gr.id}
            type="button"
            role="tab"
            id={`games-group-${gr.id}`}
            aria-selected={group === gr.id}
            aria-controls="games-stage"
            className={`games-switch-btn${group === gr.id ? ' on' : ''}`}
            onClick={() => setGroup(gr.id)}
          >
            <span className="games-switch-emoji" aria-hidden="true">{gr.emoji}</span>
            <span className="games-switch-label">{gr.title}</span>
          </button>
        ))}
      </div>

      {/* Шкала дня (0.99.0): одна строка, что открыто и что откроется.
          Спокойная, без «нельзя» и без счёта проигрышей. */}
      <p className="games-meter" data-games-meter data-games-keys={access.keys}>
        {access.nextHint}
      </p>

      {/* Карточки игр выбранной группы: 2×2 на любой ширине. Тап по карточке
          сразу запускает игру — отдельного экрана игры нет, поэтому «лишнего
          тапа» против сегмента не появляется. Замок — не красный и не
          «нельзя»: нейтральная карточка с одним условием. */}
      <div className="games-cards" role="group" aria-label="Игры в группе">
        {groupGames.map((g) => {
          const index = GAMES.indexOf(g);
          const open = isGameOpen(access, index);
          // Внутри группы карточка — это и выбор, и запуск: отдельного шага
          // «выбрать, потом играть» нет, иначе к сегменту добавился бы лишний
          // тап (о чём предупреждал §4). Сцену показываем сразу.
          const isCurrent = open && game === g.id;
          return (
            <button
              key={g.id}
              type="button"
              id={`games-tab-${g.id}`}
              aria-controls="games-stage"
              aria-pressed={isCurrent}
              aria-disabled={!open}
              data-game-card={g.id}
              data-game-open={open ? '1' : '0'}
              className={`games-card${isCurrent ? ' on' : ''}${open ? '' : ' locked'}`}
              title={open ? g.oneline : lockHint(access, index)}
              onClick={() => {
                if (!open) {
                  // Тап по замку ничего не ломает и не ругается: показываем
                  // то же условие крупной строкой ниже.
                  setLockNote(lockHint(access, index));
                  return;
                }
                setGame(g.id);
                setLockNote('');
              }}
            >
              <span className="games-card-emoji" aria-hidden="true">
                {open ? g.emoji : '🔒'}
              </span>
              <span className="games-card-title">{g.title}</span>
              <span className="games-card-note">
                {open ? g.oneline : lockHint(access, index)}
              </span>
            </button>
          );
        })}
      </div>

      {lockNote && (
        <p className="games-lock-note" role="status">
          {lockNote} · <span className="muted">тапни игру, когда откроется</span>
        </p>
      )}

      {groupAllLocked && (
        <p className="games-lock-note" role="status">
          {group === 'fast'
            ? 'Эта игра откроется, когда наберёшь ключи дня.'
            : `Откроется за урок — сейчас доступно ${access.openCount} ${pluralGames(access.openCount)}.`}
        </p>
      )}

      {profile && <GameRecords profileId={profile.id} />}
      <div
        className="games-stage"
        id="games-stage"
        role="region"
        aria-label={`Игра: ${current.title}`}
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
        {game === 'memory' && profile && <MemoryGame key={`memory-${profile.id}-${grade}-${memoryPool.map(w => w.id).join('|')}`} pool={memoryPool} grade={grade} profileId={profile.id} priorityIds={priorityIds} onGoLessons={onGoLessons} />}
        {game === 'search' && (
          <WordSearchGame
            key={`ws-${profile?.id}-${gamesPool.length}`}
            pool={gamesPool}
            grade={grade}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}

        {game === 'crossword' && (
          <CrosswordGame
            key={`cw-${profile?.id}-${gamesPool.length}`}
            pool={gamesPool}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}
      </div>
    </div>
  );
}
