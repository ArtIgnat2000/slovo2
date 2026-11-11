/**
 * «Кроссворд дня» — школьная решётка слов класса без вопросов.
 *
 * Свободная игра (рамка «Игры»): ничего не сгорает, ничего не считается.
 *
 * Как это работает для ребёнка:
 *  • под доской — список слов-«подсказок» (emoji + значение + число букв) —
 *    это и есть вопросы кроссворда; слово показывается только после сборки;
 *  • каждая буква общего пула лежит на плитке ровно столько раз, сколько нужно
 *    для ответа (лишних нет): собрать надо всё поле;
 *  • тап по плитке кладёт букву в первую свободную клетку выбранного слова;
 *  • слова проверяются сразу по завершении: верное слово зеленеет,
 *    неверное подсвечивается оранжевым — поправить можно в любой момент
 *    (тап по клетке возвращает букву в пул);
 *  • «опасный» выбор — слова класса: собрав кроссворд, ребёнок повторяет
 *    ровно те словарные слова, которые уже встречал.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../types';
import {
  buildCrossword,
  cellKey,
  evaluateFills,
  type CrosswordCell,
  type CrosswordSlot,
} from '../engine/crossword';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

export interface CrosswordGameProps {
  /** Изученные ребёнком слова (та же выборка, что у «Филворда»). */
  pool: Word[];
  onGoLessons?: () => void;
}

const randSeed = () => Math.floor(Math.random() * 2 ** 31);

interface Tile {
  id: number;
  ch: string;
  used: boolean;
}

export function CrosswordGame({ pool, onGoLessons }: CrosswordGameProps) {
  const [seed, setSeed] = useState(randSeed);
  /**
   * Слова прошлой решётки. «Ещё кроссворд» / «Новая сетка» меняет и слова,
   * а не только их расположение (замечание 2026-11-11).
   */
  const [avoidIds, setAvoidIds] = useState<string[]>([]);
  const board = useMemo(
    () => buildCrossword(pool, { seed, avoidIds }),
    [pool, seed, avoidIds],
  );

  const [fills, setFills] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<number>(1);
  // Слот, реально выбранный сию секунду — для обработчиков событий:
  // состояние могло быть ещё не перерендерено при быстрой серии тапов.
  const activeSlotRef = useRef(1);

  const activateSlot = (slot: number) => {
    activeSlotRef.current = slot;
    setActiveSlot(slot);
    sfx.tap();
  };

  // Новая доска — новая игра.
  useEffect(() => {
    setFills({});
    activeSlotRef.current = 1;
    setActiveSlot(1);
  }, [board]);

  const wordById = useMemo(() => new Map(pool.map((w) => [w.id, w])), [pool]);

  const tiles: Tile[] = useMemo(() => {
    if (!board) return [];
    const usedCounts: Record<string, number> = {};
    for (const ch of Object.values(fills)) usedCounts[ch] = (usedCounts[ch] ?? 0) + 1;
    const seen: Record<string, number> = {};
    return board.pool.map((ch, id) => {
      seen[ch] = (seen[ch] ?? 0) + 1;
      const used = (usedCounts[ch] ?? 0) >= seen[ch];
      return { id, ch, used };
    });
  }, [board, fills]);

  // По каждой клетке: в каких слотах она лежит и выбран ли слот.
  const slotAtCell = useMemo(() => {
    const map = new Map<string, CrosswordSlot[]>();
    for (const slot of board?.slots ?? []) {
      for (const cell of slot.cells) {
        const list = map.get(cellKey(cell)) ?? [];
        list.push(slot);
        map.set(cellKey(cell), list);
      }
    }
    return map;
  }, [board]);

  const slotStatus = useMemo(() => {
    const out = new Map<number, 'partial' | 'good' | 'bad'>();
    if (!board) return out;
    for (const slot of board.slots) {
      const letters = slot.cells.map((c) => fills[cellKey(c)] ?? '');
      const filled = letters.filter((ch) => ch !== '').length;
      if (filled === 0) continue;
      if (filled < letters.length) {
        out.set(slot.slot, 'partial');
        continue;
      }
      out.set(slot.slot, letters.join('') === [...slot.text.toLowerCase()].join('') ? 'good' : 'bad');
    }
    return out;
  }, [board, fills]);

  const evaluation = useMemo(() => (board ? evaluateFills(board, fills) : null), [board, fills]);
  const goodCount = evaluation?.correct.length ?? 0;
  const totalSlots = board?.slots.length ?? 0;
  const isWin = evaluation?.win ?? false;

  const active = board?.slots.find((s) => s.slot === activeSlot) ?? board?.slots[0] ?? null;

  const placeLetter = (tile: Tile) => {
    if (!board || isWin || tile.used) return;
    const letter = tile.ch;
    // Считаем занятость ПО СОСТОЯНИЮ в момент клика, а не по пропсам плитки:
    // иначе быстрый двойной тап положил бы две буквы с одной плитки.
    // А активный слот берём из ref — state может не успеть перерендериться.
    const slotNo = activeSlotRef.current;
    setFills((current) => {
      const target_slot = board.slots.find((s) => s.slot === slotNo) ?? board.slots[0];
      const usedOfLetter = Object.values(current).filter((v) => v === letter).length;
      const available = board.pool.filter((p) => p === letter).length;
      if (usedOfLetter >= available) return current;
      const target = target_slot.cells.find((c) => current[cellKey(c)] === undefined);
      if (!target) return current;
      return { ...current, [cellKey(target)]: letter };
    });
    sfx.tap();
    haptic.tap();
  };

  const tapCell = (cell: CrosswordCell) => {
    if (!board || isWin) return;
    const key = cellKey(cell);
    if (fills[key] !== undefined) {
      // Вернуть букву в общий пул.
      setFills((f) => {
        const next = { ...f };
        delete next[key];
        return next;
      });
      sfx.tap();
      return;
    }
    const here = slotAtCell.get(key) ?? [];
    if (here.length === 0) return;
    const idx = here.findIndex((s) => s.slot === activeSlotRef.current);
    activateSlot(here[(idx + 1) % here.length].slot);
  };

  /**
   * Новая решётка — с другими словами.
   *
   * Если пул большой (в «Играх» до 60 слов), слова прошлой сетки уходят в
   * конец очереди и вернутся позже. Если слов мало, движок сам возьмёт их
   * снова: пустая решётка хуже повтора.
   */
  const newGrid = () => {
    setAvoidIds(board?.slots.map((s) => s.wordId) ?? []);
    setSeed(randSeed());
  };

  if (!board) {
    return (
      <div className="cw-empty">
        <div className="games-empty-emoji" aria-hidden="true">🧶</div>
        <p className="games-empty-title">Пока нечего собирать</p>
        <p className="tiny muted">Пройди пару уроков — и здесь появятся слова для кроссворда.</p>
        {onGoLessons && (
          <button type="button" className="btn primary wide" onClick={onGoLessons}>
            К урокам →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="cw-card">
      {/* Строка состояния стоит ПЕРЕД решёткой: под решёткой её съедало
          нижнее меню (замечание 2026-11-11). */}
      {isWin ? (
        <div className="cw-win" role="status" data-cw-win="1">
          <div className="cw-win-emoji" aria-hidden="true">🎉</div>
          <div className="cw-win-body">
            <p className="cw-win-title">Кроссворд собран!</p>
          </div>
          <button type="button" className="btn primary" onClick={newGrid}>
            🔄 Ещё кроссворд
          </button>
        </div>
      ) : (
        <div className="cw-foot">
          <p className="cw-count" aria-live="polite">
            Собрано: {goodCount} из {totalSlots}
          </p>
          <button type="button" className="btn ghost sm" onClick={newGrid}>
            🔄 Новая сетка
          </button>
        </div>
      )}

      {/* Инструкция не нужна: игра объясняет себя сама (выбранное слово
          подсвечено, буквы лежат в пуле). На телефоне каждая строка над
          решёткой отнимала у решётки высоту — замечание 2026-11-11. */}

      <div
        className="cw-grid"
        role="group"
        aria-label="Кроссворд слов класса"
        style={{ ['--cw-cols' as string]: board.cols }}
      >
        {board.letters.map((row, r) =>
          row.map((letter, c) => {
            if (letter === null) return <div key={`${r},${c}`} className="cw-block" aria-hidden="true" />;
            const key = cellKey({ row: r, col: c });
            const placed = fills[key];
            const cellSlots = slotAtCell.get(key) ?? [];
            const inActive = active ? cellSlots.some((s) => s.slot === active.slot) : false;
            const status = cellSlots
              .map((s) => slotStatus.get(s.slot))
              .filter(Boolean)
              .sort((a, b) => (a === 'bad' ? -1 : b === 'bad' ? 1 : a === 'good' ? -1 : 1))[0];
            const cls = [
              'cw-cell',
              placed ? 'cw-filled' : '',
              inActive ? 'cw-active' : '',
              status === 'good' ? 'cw-good' : '',
              status === 'bad' ? 'cw-bad' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={key}
                type="button"
                className={cls}
                data-cw-cell={key}
                data-cw-row={r}
                data-cw-col={c}
                data-filled={placed ? '1' : '0'}
                aria-label={`Клетка ${r + 1},${c + 1}${placed ? `, буква ${placed}` : ', пусто'}`}
                onClick={() => tapCell({ row: r, col: c })}
              >
                {placed ?? ''}
              </button>
            );
          }),
        )}
      </div>

      <div className="cw-tiles" role="group" aria-label="Буквы для ответа">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="cw-tile"
            data-cw-letter={tile.ch}
            disabled={tile.used}
            onClick={() => placeLetter(tile)}
            aria-label={`Буква ${tile.ch}`}
          >
            {tile.ch}
          </button>
        ))}
      </div>

      <div className="cw-words" role="group" aria-label="Что за слова">
        {board.slots.map((slot) => {
          const source = wordById.get(slot.wordId);
          const state = slotStatus.get(slot.slot);
          const isActive = active?.slot === slot.slot;
          const cls = [
            'cw-chip',
            isActive ? 'cw-chip-active' : '',
            state === 'good' ? 'cw-chip-good' : '',
            state === 'bad' ? 'cw-chip-bad' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={slot.slot}
              type="button"
              className={cls}
              data-cw-slot={slot.slot}
              data-cw-answer={slot.text}
              data-cw-cells={slot.cells.map((c) => `${c.row},${c.col}`).join(';')}
              aria-pressed={isActive}
              onClick={() => activateSlot(slot.slot)}
            >
              <span className="cw-slot-no" aria-hidden="true">{slot.slot}</span>
              <span className="cw-chip-emoji" aria-hidden="true">{source?.emoji ?? '📝'}</span>
              <span className="cw-chip-text">
                <span className="cw-chip-hint">{source?.hint ?? 'слово из банка'}</span>
                <span className="cw-chip-len">{[...slot.text].length} букв</span>
              </span>
              {state === 'good' && <span className="cw-chip-check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>

    </div>
  );
}
