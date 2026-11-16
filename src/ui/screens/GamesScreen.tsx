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
 * Раскладка (0.118.0, замечание «после выбора игры надо оставить только игру»):
 *  • два экрана: витрина и игра. Пока игра не выбрана, видны только карточки
 *    двумя секциями; после выбора витрина уходит целиком, остаются шапка
 *    «← Игры · название» и поле;
 *  • нижнее меню на время игры скрыто (`body.game-focus`), поле занимает
 *    остаток высоты и прокручивается само — буквы не уезжают под вкладки;
 *  • на витрине нет сегмента групп: все восемь игр сразу, порядок = порядок
 *    открытия; условие замка не обрезается в карточке, а живёт в `aria-label`
 *    и всплывает плашкой при тапе;
 *  • рекорды стоят внизу витрины, а не над полем; слово для сборки
 *    выбирается горизонтальной лентой (одна строка, палец ведёт вбок).
 *
 * Шапка витрины — один заголовок «Игры» и тихий счёт открытых. Правило
 * «ничего не сгорает» и описания игр переехали в `title`/`aria-label`:
 * ребёнку они не нужны каждый раз, а месту над полем каждый пиксель на счету.
 * Исключение — пустое состояние: когда играть нечего, экран честно объясняет
 * почему.
 *
 * Планшет (0.97.0): экран «Игры» шире (до 1040 px), а сама игра внутри
 * разложена в две колонки — поле и вопросы рядом, а не друг под другом.
 * На iPad одна колонка не помещалась по вертикали: список вопросов уезжал
 * под нижнее меню (замечание 2026-11-12, скриншот).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { LetterRingGame } from '../LetterRingGame';
import { TrickyLetterGame } from '../TrickyLetterGame';
import { WordFlowerGame } from '../WordFlowerGame';
import { SyllableBoard } from '../SyllableBoard';
import { WordTrailGame } from '../WordTrailGame';
import { normalizeTrail, trailStopsFor, trailSummary } from '../../engine/word-trail';

type GameId = 'build' | 'ring' | 'syl' | 'search' | 'crossword' | 'memory' | 'tricky' | 'flower';
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
  'Ничего не сгорает: одна игра открыта всегда, остальные открываются по шагам дня — 10 верных ответов, урок до конца, все задания дня. Уже открытое не отнимается, ошибки и подсказки доступ не уменьшают. Одна игра не заменяет урок — прогресс в задания дня небольшой. Слова для игр берутся из тех, где были ошибки.';

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
  // 0.103.0: «Колесо букв» — второй шаг лестницы, вместе с «Филвордом»
  // (`GAME_GATE_KEYS[1] = 1`). Группа «Быстро»: провести пальцем по кругу —
  // это 1–2 минуты, как и «Собери слово».
  { id: 'ring', emoji: '🎡', title: 'Колесо букв', oneline: 'Проведи по буквам по кругу.', group: 'fast' },
  // 0.106.0: «Слоговая мозаика» — слово из слогов. Группа «Быстро» и порог
  // первого шага: сложить 2–4 слога — это 1–2 минуты, как «Собери слово».
  { id: 'syl', emoji: '🧩', title: 'Слоговая мозаика', oneline: 'Выложи слово из слогов.', group: 'fast' },
  { id: 'search', emoji: '🔎', title: 'Филворд', oneline: 'Найди слова в буквенном поле.', group: 'think' },
  { id: 'crossword', emoji: '✏️', title: 'Кроссворд', oneline: 'Собери слова в решётке.', group: 'think' },
  { id: 'memory', emoji: '🧠', title: 'Мемори', oneline: 'Найди пары карточек.', group: 'think' },
  // «Хитрая буква» — тоже полное открытие (третий ключ): это игра про
  // орфограмму, а не разминка, и она не должна открываться раньше «Мемори».
  { id: 'tricky', emoji: '🪄', title: 'Хитрая буква', oneline: 'Найди опасную букву в слове.', group: 'think' },
  // 0.105.0: «Цветок слова» — слово раскрывается по буквам, ошибка даёт
  // подсказку, а не отнимает попытку. Порог — третий ключ (полное открытие).
  { id: 'flower', emoji: '🌸', title: 'Цветок слова', oneline: 'Раскрой слово по буквам.', group: 'think' },
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
    // 0.104.0: потолок длины добираемых слов — по правилам класса. В 5 классе
    // в кроссворд теперь идут слова до 11 букв (`maxWordLengthFor`), и пул не
    // должен отсекать их раньше движка. Филворд всё равно возьмёт только те,
    // что влезают в его поле.
    const longest = grade >= 5 ? 11 : 9;
    const filler = WORDS_BY_GRADE[grade].filter(
      (w) => !w.text.includes(' ') && !ids.has(w.id) && lettersCount(w.text) <= longest,
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
  /**
   * Пул «Колеса букв» (0.103.0) — короткие слова: круг читается до 8 букв
   * (`RING_MAX_LETTERS`). Берём тот же набор, что у «Собери слово», плюс
   * добор словами класса, если своих коротких мало: иначе на трёх знакомых
   * словах колесо повторялось бы.
   */
  const ringPoolWords = useMemo(() => {
    const ids = new Set(practice.map((w) => w.id));
    const filler = WORDS_BY_GRADE[grade].filter((w) => !ids.has(w.id));
    return [...practice, ...filler];
  }, [practice, grade]);
  /**
   * Пул «Хитрой буквы» (0.103.0) — слова с отмеченной опасной буквой. Фразы и
   * слова без `danger` отсеивает сам движок (`trickyPool`), здесь только
   * порядок: знакомые и трудные слова первыми.
   */
  const trickyPoolWords = useMemo(() => {
    const ids = new Set(met.map((w) => w.id));
    return [...met, ...WORDS_BY_GRADE[grade].filter((w) => !ids.has(w.id))];
  }, [met, grade]);
  const priorityIds = useMemo(() => troubleWords(profile?.words ?? {}), [profile]);
  const [wordId, setWordId] = useState<string | null>(null);
  /** «Тропа слов» (0.110.0) — отдельный экран поверх витрины, не девятая карточка. */
  const [trailOpen, setTrailOpen] = useState(false);
  const settings = useApp((s) => s.settings);

  /**
   * Доступ за успехи дня (0.102.0, §8 плана). Считается на лету из уже
   * сохранённого дня: в профиле ничего нового не лежит, поэтому нет миграции,
   * а полночь сбрасывает шкалу сама.
   *
   * Лестница из трёх разных дел: 10 верных ответов → урок до конца → весь
   * план дня (готовый сундук). В 0.99.0 ключи складывались из одного урока
   * трижды, и даже слабый урок открывал всё.
   */
  const access = useMemo(() => {
    const day = dayKey();
    return dayGameAccess({
      day: profile ? todayStat(profile) : undefined,
      plan: profile ? planOf(profile, day) : [],
      totalGames: GAMES.length,
      gates: settings.gamesGates,
    });
  }, [profile, settings.gamesGates]);

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
  /**
   * Витрина и игра — два разных экрана (0.118.0). Пока игра не выбрана, видна
   * только аккуратная сетка игр; после выбора остаётся только игра и кнопка
   * «← Игры». Раньше витрина, шкала, рекорды и поле стояли одновременно и
   * отнимали друг у друга высоту.
   */
  const [gameOpen, setGameOpen] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  /** Условие для закрытой карточки: показываем строкой, а не «молчанием». */
  const [lockNote, setLockNote] = useState('');
  // Открылась игра или сменился день — старая подсказка про замок больше не нужна.
  useEffect(() => {
    setLockNote('');
  }, [access.openCount]);
  // Выбранная игра может оказаться закрытой (новый день, настройка родителя):
  // тогда мягко переводим на первую открытую.
  useEffect(() => {
    const safe = openGame(game);
    if (safe !== game) setGame(safe);
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
  const allLocked = GAMES.every((g) => !isGameOpen(access, GAMES.indexOf(g)));

  // В игре нижнее меню только мешает: остаётся один выход — «← Игры».
  // Класс на body, потому что меню живёт в App.tsx, а не внутри экрана.
  useEffect(() => {
    const focus = gameOpen || trailOpen;
    document.body.classList.toggle('game-focus', focus);
    return () => document.body.classList.remove('game-focus');
  }, [gameOpen, trailOpen]);

  useEffect(() => {
    if (gameOpen) backRef.current?.focus();
  }, [gameOpen]);

  // Плашка замка — подсказка, а не постоянная панель: сама уходит через 6 с.
  useEffect(() => {
    if (!lockNote) return;
    const timer = window.setTimeout(() => setLockNote(''), 6000);
    return () => window.clearTimeout(timer);
  }, [lockNote]);

  /**
   * Баннер «Тропы» (0.111.0). Игра не входит в `GAMES`: девятая карточка
   * сдвинула бы индексы `GAME_GATE_KEYS` и сломала доступ к остальным играм.
   * Прогресс читаем из профиля, а не из локального состояния, поэтому баннер
   * честно показывает, где ребёнок остановился.
   *
   * `trailStopsFor` отдаёт 16 остановок для 2 класса, по две для 1/3/4 и
   * пусто для 5: у пятого класса картинки только у двух слов из пятнадцати,
   * и витрина не должна обещать игру, которой там ещё нет.
   */
  const trailStopsList = useMemo(() => trailStopsFor(grade), [grade]);
  const trailInfo = useMemo(
    () => trailSummary(trailStopsList, normalizeTrail(profile?.trail, grade)),
    [trailStopsList, profile?.trail],
  );
  useEffect(() => {
    if (!profile) setTrailOpen(false);
  }, [profile]);

  if (trailOpen && profile) {
    return (
      <WordTrailGame
        key={`trail-${profile.id}-${grade}`}
        profileId={profile.id}
        grade={grade}
        onExit={() => setTrailOpen(false)}
        onGoLessons={onGoLessons}
      />
    );
  }

  return (
    <div className={`screen games-screen ${gameOpen ? 'game-mode' : 'catalog-mode'}`}>
      {!gameOpen ? (
        <>
          <header className="games-head">
            <h2 className="games-title" title={PLAY_RULE}>
              🧩 Игры
            </h2>
            <span className="games-open-count" aria-hidden="true">
              {access.openCount} из {GAMES.length}
            </span>
          </header>

          <div className="games-catalog" data-games-catalog>
            {/* «Тропа слов» (0.110.0): отдельный вход, а не девятая карточка. */}
            {profile && trailStopsList.length > 0 && (
              <button
                type="button"
                className="trail-banner"
                data-trail-banner
                onClick={() => setTrailOpen(true)}
                aria-label={
                  trailInfo.allDone
                    ? 'Тропа слов. Все остановки пройдены — можно пройти заново'
                    : `Тропа слов. Остановка «${trailInfo.currentTitle}», пройдено ${trailInfo.doneStops} из ${trailInfo.totalStops}`
                }
              >
                <span className="trail-banner-emoji" aria-hidden="true">🗺️</span>
                <span className="trail-banner-body">
                  <span className="trail-banner-title">Тропа слов</span>
                  <span className="trail-banner-sub">
                    {trailInfo.allDone
                      ? 'Все остановки пройдены'
                      : `${trailInfo.currentTitle} · ${trailInfo.doneStops} из ${trailInfo.totalStops}`}
                  </span>
                </span>
                <span className="trail-banner-go" aria-hidden="true">→</span>
              </button>
            )}

            {/* Одна спокойная строка доступа вместо абзаца и шкалы. */}
            <p className="games-meter" data-games-meter data-games-keys={access.keys}>
              {access.nextHint}
            </p>

            {/* Все игры на одном экране: две смысловые группы подряд, без
                переключателя. Так не нужно угадывать, в какой вкладке игра,
                и ни одна карточка не прячется за краем. */}
            {GROUPS.map((gr) => (
              <section className="games-group" key={gr.id} aria-labelledby={`games-group-${gr.id}`}>
                <h3 className="games-group-title" id={`games-group-${gr.id}`}>
                  <span aria-hidden="true">{gr.emoji}</span> {gr.title}
                </h3>
                <div className="games-cards" role="group" aria-label={`Игры: ${gr.title}`}>
                  {GAMES.filter((g) => g.group === gr.id).map((g) => {
                    const index = GAMES.indexOf(g);
                    const open = isGameOpen(access, index);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        id={`games-tab-${g.id}`}
                        aria-disabled={!open}
                        data-game-card={g.id}
                        data-game-open={open ? '1' : '0'}
                        className={`games-card${open ? '' : ' locked'}`}
                        aria-label={`${g.title}. ${open ? g.oneline : lockHint(access, index)}`}
                        title={open ? g.oneline : lockHint(access, index)}
                        onClick={() => {
                          if (!open) {
                            setLockNote(lockHint(access, index));
                            return;
                          }
                          setGame(g.id);
                          setGameOpen(true);
                          setLockNote('');
                        }}
                      >
                        <span className="games-card-emoji" aria-hidden="true">
                          {open ? g.emoji : '🔒'}
                        </span>
                        <span className="games-card-title">{g.title}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {lockNote && (
              <p className="games-lock-note" role="status">
                {lockNote} · <span className="muted">тапни игру, когда откроется</span>
              </p>
            )}

            {allLocked && (
              <p className="games-lock-note" role="status">
                {access.nextCondition
                  ? `Следующая игра — ${access.nextCondition}. Сейчас доступно ${access.openCount} ${pluralGames(access.openCount)}.`
                  : `Сейчас доступно ${access.openCount} ${pluralGames(access.openCount)}.`}
              </p>
            )}

            {profile && <GameRecords profileId={profile.id} />}
          </div>
        </>
      ) : (
        <>
          <header className="game-topbar">
            <button
              ref={backRef}
              type="button"
              className="game-back"
              onClick={() => {
                setGameOpen(false);
                setLockNote('');
              }}
              aria-label="Вернуться к играм"
            >
              <span aria-hidden="true">←</span> Игры
            </button>
            <h2 className="game-topbar-title">
              <span aria-hidden="true">{current.emoji}</span> {current.title}
            </h2>
          </header>
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

        {game === 'ring' && profile && (
          <LetterRingGame
            key={`ring-${profile.id}-${grade}`}
            pool={ringPoolWords}
            grade={grade}
            profileId={profile.id}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}

        {game === 'tricky' && profile && (
          <TrickyLetterGame
            key={`tricky-${profile.id}-${grade}`}
            pool={trickyPoolWords}
            grade={grade}
            profileId={profile.id}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}

        {game === 'flower' && profile && (
          <WordFlowerGame
            key={`flower-${profile.id}-${grade}`}
            pool={trickyPoolWords}
            grade={grade}
            profileId={profile.id}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}

        {game === 'syl' && profile && (
          <SyllableBoard
            key={`syl-${profile.id}-${grade}`}
            pool={ringPoolWords}
            grade={grade}
            profileId={profile.id}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}

        {game === 'crossword' && (
          <CrosswordGame
            key={`cw-${profile?.id}-${gamesPool.length}-${grade}`}
            pool={gamesPool}
            grade={grade}
            priorityIds={priorityIds}
            onGoLessons={onGoLessons}
          />
        )}
          </div>
        </>
      )}
    </div>
  );
}
