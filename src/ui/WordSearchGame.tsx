import { recordGridWin } from '../platform/game-records';
import { GameBest } from './GameRecords';
/**
 * «Филворд» — найди знакомые слова на буквенном поле.
 *
 * Свободная игра (рамка «Игры»): ничего не сгорает, ничего не считается.
 * Поле ведём пальцем или «тапами» (первая клетка — потом последняя); промах
 * ничем не наказывается, клетки просто мягко краснеют и отпускают линию.
 * Найденное слово показываем чипом с «опасными» буквами оранжевым — филворд
 * повторяет слова именно там, где легко ошибиться.
 *
 * Взаимодействие построено на указателе (drag) и на «тапе» (два клика);
 * клавиатурой: Tab на клетку → Enter ставит якорь → Enter на последней клетке
 * завершает линию. `touch-action: none` на поле — палец не уводит страницу.
 *
 * Раскладка (0.97.0): телефон — одна колонка (поле, слова-цели), планшет —
 * две колонки: поле слева, слова-цели справа. Поле ещё и получило потолок
 * ширины: без него оно растягивалось на всю карточку (на iPad клетка была
 * по 100+ px) и вместе с целями не помещалось по вертикали (замечание
 * 2026-11-12).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Word } from '../types';
import {
  buildWordSearch,
  cellKey,
  matchSelection,
  sameCell,
  selectionCells,
  type WsCell,
} from '../engine/word-search';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';
import { gameAwardHint } from '../engine/game-awards';
import { todayStat, useApp } from '../state/store';
import { Confetti } from './Bits';
import { prefersReducedMotion } from './motion';
import { useBoardCellCap } from './useBoardCellCap';

export interface WordSearchGameProps {
  /** Изученные ребёнком слова (та же выборка, что у «Собери слово»). */
  pool: Word[];
  grade: number;
  /** Слова с ошибками (0.96.7): игра прячет их на поле первыми. */
  priorityIds?: ReadonlyArray<string>;
  onGoLessons?: () => void;
}

const randSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * Где остановился круг слов (0.96.7).
 *
 * Владелец: «повторение слов начинается со второго нажатия кнопки новая
 * сетка». Причин было две: приоритет трудных слов прилипал к началу каждой
 * сетки (лечится в `engine/pool-cursor.ts`) и — главное — курсор жил только в
 * состоянии компонента. Любая пересборка экрана (`key` по длине пула, возврат
 * на вкладку, смена профиля) обнуляла его, и круг начинался сначала: первая
 * сетка после пересборки повторяла слова уже показанной.
 *
 * Поэтому место в круге запоминается на устройстве, отдельно для каждой игры и
 * каждого пула: набор слов у профиля свой, и общий курсор прыгал бы между ними.
 */
const CURSOR_STORE = 'slovo2-game-cursor';

export interface BoardMemo {
  cursor: number;
  /** Слова ровно прошлой сетки — страховка от повтора. */
  avoidIds: string[];
}
const EMPTY_MEMO: BoardMemo = { cursor: 0, avoidIds: [] };

export function readBoardMemo(key: string): BoardMemo {
  try {
    const raw = window.localStorage.getItem(CURSOR_STORE);
    if (!raw) return EMPTY_MEMO;
    const all = JSON.parse(raw) as Record<string, Partial<BoardMemo> | undefined>;
    const mine = all[key];
    if (!mine || !Number.isFinite(mine.cursor)) return EMPTY_MEMO;
    return {
      cursor: Math.max(0, Math.trunc(mine.cursor as number)),
      avoidIds: Array.isArray(mine.avoidIds)
        ? mine.avoidIds.filter((id): id is string => typeof id === 'string').slice(0, 20)
        : [],
    };
  } catch {
    // Приватный режим/запрет хранилища — игра работает, просто без памяти круга.
    return EMPTY_MEMO;
  }
}

export function writeBoardMemo(key: string, memo: BoardMemo): void {
  try {
    const raw = window.localStorage.getItem(CURSOR_STORE);
    const all = raw ? (JSON.parse(raw) as Record<string, BoardMemo>) : {};
    all[key] = { cursor: Math.max(0, Math.trunc(memo.cursor)), avoidIds: memo.avoidIds.slice(0, 20) };
    window.localStorage.setItem(CURSOR_STORE, JSON.stringify(all));
  } catch {
    /* памяти нет — не повод ломать игру */
  }
}

export function WordSearchGame({ pool, grade, priorityIds, onGoLessons }: WordSearchGameProps) {
  const [seed, setSeed] = useState(randSeed);
  // Ключи по содержимому: стор пересоздаёт массив пула на каждом изменении
  // профиля (например, когда игра начислила награду), и зависимость по ссылке
  // пересобирала бы поле прямо во время игры — найденные слова обнулялись.
  const poolKey = useMemo(() => pool.map((w) => w.id).join('|'), [pool]);
  /**
   * Ключ памяти круга: только игра и класс, БЕЗ содержимого пула.
   *
   * Так задумано: пул растёт каждый раз, когда ребёнок проходит урок (новые
   * знакомые слова). Если бы ключ зависел от пула, память обнулялась бы после
   * каждого урока — и первая сетка снова начиналась бы со слов, которые только
   * что были на экране. С курсором «на игру» круг просто продолжается, а
   * слова прошлой сетки отсекает `avoidIds`.
   */
  const memoKey = `ws:${grade}`;
  /**
   * Место в круге: сколько слов уже показали и какие были в прошлой сетке.
   * Читается с устройства при входе (переживает пересборку экрана), пишется
   * при каждой новой сетке. Так «Новая сетка» всегда идёт вперёд по кругу.
   */
  const [memo, setMemo] = useState<BoardMemo>(() => readBoardMemo(memoKey));
  const [memoOwner, setMemoOwner] = useState(memoKey);
  if (memoOwner !== memoKey) {
    // Пул сменился — другой круг и другая память.
    setMemoOwner(memoKey);
    setMemo(readBoardMemo(memoKey));
  }
  const cursor = memo.cursor;
  const avoidIds = memo.avoidIds;
  const priorityKey = useMemo(() => (priorityIds ?? []).join('|'), [priorityIds]);
  /**
   * Слова с ошибками фиксируем на момент входа на экран. Иначе первый же
   * показ награды менял профиль и приоритет пересобирал поле.
   */
  const priorityAtStart = useRef<string | undefined>(undefined);
  if (priorityAtStart.current === undefined) priorityAtStart.current = priorityKey;
  const board = useMemo(
    () =>
      buildWordSearch(pool, {
        grade,
        seed,
        cursor,
        avoidIds,
        priorityIds: priorityAtStart.current ? priorityAtStart.current.split('|') : undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [poolKey, grade, seed, cursor, avoidIds],
  );
  const roundId = useMemo(() => crypto.randomUUID(), [board]);
  const playGame = useApp((s) => s.playGame);
  const profile = useApp((s) => s.profiles.find((p) => p.id === s.activeId) ?? null);
  /** Что игра дала сегодня — для честной подписи на поле (0.96.7). */
  const [awarded, setAwarded] = useState<{ xp: number; gems: number } | null>(null);
  /**
   * Праздник победы (0.98.0). Раньше финал сетки был статичной зелёной
   * плашкой: ребёнок видел «Все слова найдены!» и тишину. Теперь на последнем
   * слове звучат те же фанфары, что в уроке (`sfx.finish`), срабатывает
   * вибрация и один раз вылетает конфетти.
   *
   * Конфетти — один раз на сетку (`celebratedRef`), и только если система не
   * просила «меньше движения»: это не украшение, а забота о тех, кому
   * анимация мешает (`ui/motion.ts`).
   */
  const [confetti, setConfetti] = useState(false);
  const celebratedRef = useRef(false);

  const [anchor, setAnchor] = useState<WsCell | null>(null);
  const [head, setHead] = useState<WsCell | null>(null);
  const [dragging, setDragging] = useState(false);
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [missCells, setMissCells] = useState<WsCell[] | null>(null);

  const swallowClickRef = useRef(false);
  const missTimer = useRef<number | null>(null);

  /**
   * Награда за сетку (0.96.7): когда найдено последнее слово, одно действие в
   * сторе начисляет малый XP с суточным потолком, половинный вес в заданиях
   * дня и символический кристалл за первую сетку. SRS не трогаем.
   */
  const scoredRef = useRef(false);
  const won = !!board && foundIds.length > 0 && foundIds.length >= board.words.length;
  useEffect(() => {
    if (!board || scoredRef.current) return;
    if (!won) return;
    scoredRef.current = true;
    if (profile) recordGridWin(profile.id, 'search', roundId, foundIds.length);
    setAwarded(playGame(foundIds.length));
    // Праздник: те же фанфары и вибрация, что на результатах урока, — игра
    // заканчивается «событием», а не просто галочкой.
    sfx.finish(3);
    haptic.finish();
  }, [board, won, foundIds, playGame, profile?.id, roundId]);

  // Конфетти отдельным эффектом: оно не должно зависеть от того, успел ли
  // сработать `playGame` (например, когда потолок дня уже выбран и награда 0).
  useEffect(() => {
    if (!won || celebratedRef.current) return;
    celebratedRef.current = true;
    if (!prefersReducedMotion()) setConfetti(true);
    const t = window.setTimeout(() => setConfetti(false), 2600);
    return () => window.clearTimeout(t);
  }, [won]);

  useEffect(() => {
    scoredRef.current = false;
    celebratedRef.current = false;
    setAwarded(null);
    setConfetti(false);
  }, [board]);

  // Новая доска — новая игра: забываем выделение и найденные слова.
  useEffect(() => {
    setAnchor(null);
    setHead(null);
    setDragging(false);
    setFoundIds([]);
    setMissCells(null);
  }, [board]);
  useEffect(
    () => () => {
      if (missTimer.current !== null) window.clearTimeout(missTimer.current);
    },
    [],
  );

  const selection = useMemo(
    () => (anchor && head ? selectionCells(anchor, head) ?? [anchor] : anchor ? [anchor] : []),
    [anchor, head],
  );
  const selectionKeys = useMemo(() => new Set(selection.map(cellKey)), [selection]);
  const foundSet = useMemo(() => new Set(foundIds), [foundIds]);
  const foundCellKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const placed of board?.words ?? []) {
      if (foundSet.has(placed.wordId)) placed.cells.forEach((c) => keys.add(cellKey(c)));
    }
    return keys;
  }, [board, foundSet]);
  const missKeys = useMemo(() => new Set((missCells ?? []).map(cellKey)), [missCells]);

  const wordById = useMemo(() => new Map(pool.map((w) => [w.id, w])), [pool]);

  const complete = (sel: WsCell[]) => {
    if (!board) return;
    const hit = matchSelection(board.words, foundSet, sel);
    if (hit) {
      setFoundIds((ids) => [...ids, hit.wordId]);
      sfx.correct();
      haptic.correct();
    } else {
      // Промах — не наказание: линия мягко «вспыхивает» и отпускается.
      sfx.wrong();
      haptic.tap();
      setMissCells(sel);
      if (missTimer.current !== null) window.clearTimeout(missTimer.current);
      missTimer.current = window.setTimeout(() => setMissCells(null), 450);
    }
    setAnchor(null);
    setHead(null);
  };

  /** Тап/Enter по клетке: ставит якорь либо завершает линию. */
  const pressCell = (cell: WsCell) => {
    if (anchor && head && sameCell(anchor, head)) {
      const sel = selectionCells(anchor, cell);
      if (!sel) {
        setAnchor(cell);
        setHead(cell);
        return;
      }
      if (sel.length === 1) {
        // Повторный тап по самой клетке — просто отмена выделения.
        setAnchor(null);
        setHead(null);
        return;
      }
      complete(sel);
      return;
    }
    setAnchor(cell);
    setHead(cell);
  };

  const cellFromPoint = (x: number, y: number): WsCell | null => {
    try {
      const el = document.elementFromPoint?.(x, y);
      const cell = el?.closest?.('[data-ws-row]') as HTMLElement | null | undefined;
      if (!cell) return null;
      const row = Number(cell.getAttribute('data-ws-row'));
      const col = Number(cell.getAttribute('data-ws-col'));
      if (Number.isNaN(row) || Number.isNaN(col)) return null;
      return { row, col };
    } catch {
      return null;
    }
  };

  const onCellPointerDown = (cell: WsCell) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Клик после pointerup глушим — иначе «тап» сработал бы дважды.
    swallowClickRef.current = true;
    if (anchor && head && sameCell(anchor, head)) {
      // Висит якорь прошлого тапа: второй тап завершает линию.
      pressCell(cell);
      return;
    }
    setAnchor(cell);
    setHead(cell);
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom и старые движки — выделение просто не продолжается движением */
    }
  };

  const onGridPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !anchor) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    // Игнорируем неровные «случайные» клетки — оставляем последнюю ровную линию.
    if (cell && selectionCells(anchor, cell)) setHead(cell);
  };

  const onGridPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const sel = anchor && head ? selectionCells(anchor, head) : null;
    if (sel && sel.length >= 2) {
      complete(sel);
      return;
    }
    // Чистый тап без движения: оставляем якорь висеть для второго тапа.
    setHead(anchor);
  };

  const onCellClick = (cell: WsCell) => () => {
    if (swallowClickRef.current) {
      swallowClickRef.current = false;
      return;
    }
    pressCell(cell);
  };

  const onCellKeyDown = (cell: WsCell) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pressCell(cell);
    }
  };

  /**
   * «Ещё сетку» / «Новая сетка»: новое поле с новыми словами.
   *
   * Если пул большой (в «Играх» до 60 слов), прошлые слова просто уходят в
   * конец очереди — они вернутся позже, когда свежие закончатся. Если слов
   * мало и без прошлых сетку не собрать, движок сам возьмёт их (иначе —
   * пустой экран).
   *
   * «Новая сетка» = сдвиг курсора на число показанных слов. Так весь пул
   * проходится по кругу: слово возвращается только после полного обхода, и
   * одно и то же слово не может «залипнуть» на экране (в 0.96.4 на пуле из
   * трёх слов «телефон» показывался снова и снова).
   */
  const newGrid = () => {
    // Курсор приходит из движка: он считает шаг по той выборке, из которой
    // реально брал слова (длинные слова отсеиваются), иначе шаги расходились.
    const next: BoardMemo = {
      cursor: board?.nextCursor ?? 0,
      avoidIds: [...new Set(board?.words.map((w) => w.wordId) ?? [])],
    };
    setMemo(next);
    writeBoardMemo(memoKey, next);
    setSeed(randSeed());
  };

  if (!board) {
    return (
      <div className="ws-empty">
        <div className="games-empty-emoji" aria-hidden="true">🧶</div>
        <p className="games-empty-title">Пока нечего искать</p>
        <p className="tiny muted">Пройди пару уроков — и здесь появятся знакомые слова.</p>
        {onGoLessons && (
          <button type="button" className="btn primary wide" onClick={onGoLessons}>
            К урокам →
          </button>
        )}
      </div>
    );
  }

  const isWin = won;
  /**
   * Честная подпись о наградах (0.96.7 → 0.98.0). `gameAwardHint()` была
   * написана, но не выводилась нигде: ребёнок видел «+1 💎 +2 ⚡» без
   * объяснения, почему дальше не капает. Теперь рядом стоит строка из
   * движка — и она же говорит «на сегодня хватит», когда потолок выбран.
   */
  const awardHint = awarded ? gameAwardHint(todayStat(profile).games ?? { xp: 0, correct: 0, words: 0 }) : '';

  /**
   * Потолок клетки по месту на экране (планшет/альбомный экран): поле не
   * должно выпирать за экран. На телефоне сцену прокручивают
   * (см. `useBoardCellCap`).
   */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cellCap = useBoardCellCap({ rows: board.size, gap: 6, cardRef });

  return (
    <div className="ws-card" ref={cardRef}>
      {/* Строка состояния стоит ПЕРЕД полем: под полем её съедало нижнее
          меню, а слова-цели после победы заменяются плашкой «всё найдено». */}
      {isWin ? (
        <>
          <Confetti show={confetti} />
          <div className="ws-win ws-win-party" role="status">
            <div className="ws-win-emoji" aria-hidden="true">🎉</div>
            <div className="ws-win-body">
              <p className="ws-win-title">Все слова найдены!</p>
              {awarded && (awarded.xp > 0 || awarded.gems > 0) && (
                <p className="ws-win-award tiny">
                  {awarded.gems > 0 && <b>+{awarded.gems} 💎 </b>}
                  {awarded.xp > 0 && <b>+{awarded.xp} ⚡</b>}
                  <span className="muted"> · засчитано в задания дня</span>
                </p>
              )}
              {awardHint && <p className="ws-win-hint tiny muted">{awardHint}</p>}
              {profile && <GameBest profileId={profile.id} game="search" />}
            </div>
            <button type="button" className="btn primary" onClick={newGrid}>
              🔄 Ещё сетку
            </button>
          </div>
        </>
      ) : (
        <div className="ws-foot">
          <p className="ws-count" aria-live="polite">
            Найдено: {foundIds.length} из {board.words.length}
          </p>
          <button type="button" className="btn ghost sm" onClick={newGrid}>
            🔄 Новая сетка
          </button>
        </div>
      )}

      {/* Тело карточки: на телефоне — одна колонка (поле, слова-цели), на
          планшете — две (поле слева, слова-цели справа). Одна колонка была
          причиной «не помещается по вертикали»: поле филворда занимало всю
          ширину карточки (клетка по 100+ px на iPad) и уезжало за экран
          вместе со списком целей (замечание 2026-11-12, скриншот iPad). */}
      <div className="ws-body">
        <div className="ws-board">
          <div
            className="ws-grid"
            role="group"
            aria-label="Буквенное поле филворда"
            style={
              {
                ['--ws-size' as string]: board.size,
                ...(cellCap ? { ['--ws-cell-cap' as string]: `${cellCap}px` } : {}),
              } as CSSProperties
            }
            onPointerMove={onGridPointerMove}
            onPointerUp={onGridPointerUp}
            onPointerCancel={onGridPointerUp}
          >
            {board.cells.map((row, r) =>
              row.map((ch, c) => {
                const key = `${r},${c}`;
                const selected = selectionKeys.has(key);
                const cls = [
                  'ws-cell',
                  foundCellKeys.has(key) ? 'ws-found' : '',
                  selected ? 'ws-in-sel' : '',
                  anchor && sameCell(anchor, { row: r, col: c }) ? 'ws-anchor' : '',
                  missKeys.has(key) ? 'ws-miss' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={key}
                    type="button"
                    className={cls}
                    data-ws-row={r}
                    data-ws-col={c}
                    aria-pressed={selected}
                    aria-label={`Клетка ${r + 1},${c + 1}: ${ch}`}
                    onPointerDown={onCellPointerDown({ row: r, col: c })}
                    onClick={onCellClick({ row: r, col: c })}
                    onKeyDown={onCellKeyDown({ row: r, col: c })}
                  >
                    {ch}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <div className="ws-words" role="group" aria-label="Найди эти слова">
          {board.words.map((placed) => {
            const found = foundIds.includes(placed.wordId);
            const source = wordById.get(placed.wordId);
            const danger = new Set(source?.danger ?? []);
            return (
              <span
                key={placed.wordId}
                className={`ws-chip${found ? ' ws-chip-found' : ''}`}
                data-ws-text={placed.text}
                data-ws-id={placed.wordId}
              >
                <span aria-hidden="true">{source?.emoji ?? '🔎'}</span>
                <span className="ws-chip-word">
                  {[...placed.text].map((ch, i) => (
                    <span key={i} className={danger.has(i) ? 'ws-danger' : undefined}>
                      {ch}
                    </span>
                  ))}
                </span>
                {found && (
                  <span className="ws-chip-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

    </div>
  );
}
