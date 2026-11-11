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
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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

export interface WordSearchGameProps {
  /** Изученные ребёнком слова (та же выборка, что у «Собери слово»). */
  pool: Word[];
  grade: number;
  onGoLessons?: () => void;
}

const randSeed = () => Math.floor(Math.random() * 2 ** 31);

export function WordSearchGame({ pool, grade, onGoLessons }: WordSearchGameProps) {
  const [seed, setSeed] = useState(randSeed);
  const board = useMemo(() => buildWordSearch(pool, { grade, seed }), [pool, grade, seed]);

  const [anchor, setAnchor] = useState<WsCell | null>(null);
  const [head, setHead] = useState<WsCell | null>(null);
  const [dragging, setDragging] = useState(false);
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [missCells, setMissCells] = useState<WsCell[] | null>(null);

  const swallowClickRef = useRef(false);
  const missTimer = useRef<number | null>(null);

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

  const newGrid = () => setSeed(randSeed());

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

  const isWin = foundIds.length === board.words.length;

  return (
    <div className="ws-card">
      {/* Строка состояния стоит ПЕРЕД полем: под полем её съедало нижнее
          меню, а слова-цели после победы заменяются плашкой «всё найдено». */}
      {isWin ? (
        <div className="ws-win" role="status">
          <div className="ws-win-emoji" aria-hidden="true">🎉</div>
          <div className="ws-win-body">
            <p className="ws-win-title">Все слова найдены!</p>
          </div>
          <button type="button" className="btn primary" onClick={newGrid}>
            🔄 Ещё сетку
          </button>
        </div>
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

      <div
        className="ws-grid"
        role="group"
        aria-label="Буквенное поле филворда"
        style={{ ['--ws-size' as string]: board.size }}
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
  );
}
