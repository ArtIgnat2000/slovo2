/**
 * «Карточки букв» — собери слово перетаскиванием плиток.
 *
 * Одна механика для двух мест:
 *  • урок (режим по умолчанию) — плитки из `task.letters`, попытки и балл
 *    те же, что и раньше (3 с подсказкой, 5 без);
 *  • свободная игра (`unscored`) — любое изученное слово, никаких попыток,
 *    никакого XP: чистое удовольствие от сборания.
 *
 * Перенос настоящий (pointer events + захват указателя), но тап работает
 * как раньше: тап по плитке ставит её в первую свободную лунку, тап по
 * лунке возвращает букву в лоток — поэтому клавиатурой и скринридером всё
 * работает точно так же.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Word } from '../types';
import {
  dropSlotAt,
  firstEmpty,
  isFull,
  joined,
  placeFromTray,
  placeInFirstEmpty,
  returnToTray,
  shuffledTiles,
  swapSlots,
  trayTiles,
  type BoardState,
  type BoardTile,
} from '../engine/word-board';
import { HintBtn, HintCard } from './HintBits';
import { useApp } from '../state/store';
import { WordLetters } from './WordView';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

export interface WordTileBoardProps {
  word: Word;
  /** Перемешанные буквы для урока (`task.letters`); нет — перемешиваем сами. */
  trayLetters?: string[];
  /** Игра без счёта: баннер внутри, попыток нет. */
  unscored?: boolean;
  onAttempt?: (quality: number) => void;
  /** Урок: полный балл (5) или 3 с подсказкой — как в старой сборке. */
  onSolve?: (quality: number) => void;
  /**
   * unscored: в баннере победы появится кнопка «Дальше» — в свободной игре
   * ребёнок собирает слово за словом, не возвращаясь глазами к ленте чипов.
   * Сам баннер экран не закрывает: сначала похвала, потом уже переход.
   */
  onNext?: () => void;
  nextLabel?: string;
}

interface PendingDrag {
  tile: BoardTile;
  from: 'tray' | number; // откуда тащим: лоток или индекс лунки
  startX: number;
  startY: number;
}
interface DragState extends PendingDrag {
  x: number;
  y: number;
  overSlot: number | null;
  overTray: boolean;
}

const DRAG_START = 7;

/**
 * Сколько плиток ставить в ряд.
 *
 * Раньше лунки и лоток были flex-wrap с фиксированными 46–58 px: слово из 10
 * букв занимало две строки «как получится», а из 14–17 — три, и доска уезжала
 * за экран. Теперь число колонок считается от длины слова, а размер плитки
 * выводит CSS из ширины экрана: плитка никогда не становится меньше ~40 px
 * (палец ребёнка) и никогда не вылезает за карточку.
 */
export function boardColumns(letters: number): number {
  const n = Math.max(1, Math.floor(letters));
  if (n <= 7) return n;
  let best = 7;
  let bestScore = Number.POSITIVE_INFINITY;
  // Перебираем 4–7 колонок: меньше строк — лучше; при равных строках лучше
  // та раскладка, где последний ряд полнее (нет «сирот» из одной буквы).
  for (let cols = 4; cols <= 7; cols++) {
    const rows = Math.ceil(n / cols);
    const inLastRow = n - (rows - 1) * cols;
    const score = rows * 10 + (cols - inLastRow);
    if (score < bestScore) {
      bestScore = score;
      best = cols;
    }
  }
  return best;
}

export function WordTileBoard({
  word,
  trayLetters,
  unscored = false,
  onAttempt,
  onSolve,
  onNext,
  nextLabel,
}: WordTileBoardProps) {
  const later = useRef<number[]>([]);
  const schedule = (fn: () => void, ms: number) => {
    later.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => later.current.forEach((t) => clearTimeout(t)), []);

  const initState = (): BoardState => ({
    tray: trayLetters ? trayTiles(trayLetters) : shuffledTiles(word.text),
    slots: Array(word.text.length).fill(null),
  });
  const [state, setState] = useState<BoardState>(initState);
  const [hintUsed, setHintUsed] = useState(false);
  const [bad, setBad] = useState(false);
  const [solved, setResolved] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const slotRefs = useRef<Array<HTMLElement | null>>([]);
  const trayRef = useRef<HTMLDivElement | null>(null);

  // При смене слова — чистая доска.
  useEffect(() => {
    setState(initState());
    setHintUsed(false);
    setBad(false);
    setResolved(false);
    setDrag(null);
    pendingRef.current = null;
    scoredRef.current = false;
    setAward(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  const playGame = useApp((st) => st.playGame);
  /** Награда именно за это слово — состояние, а не ref: баннер должен обновиться. */
  const [award, setAward] = useState<{ xp: number; gems: number } | null>(null);
  /** Решённое слово уже засчитано в награды дня — ровно один раз на слово. */
  const scoredRef = useRef(false);

  const finishIfComplete = (next: BoardState, usedHint: boolean) => {
    if (!isFull(next.slots)) {
      setState(next);
      return;
    }
    const ok = joined(next.slots) === word.text;
    setState(next);
    if (ok) {
      setResolved(true);
      sfx.correct();
      haptic.correct();
      if (unscored) {
        // Баннер победы остаётся на экране: дальше ребёнок идёт сам —
        // кнопкой «Другое слово» или тапом по чипу в ленте.
        // Награда (0.96.7): одно слово игры = половинка «верного ответа» в
        // заданиях дня и малый XP с суточным потолком (см. game-awards).
        // `scoredRef` защищает от повторного начисления, если родитель
        // пере-рендерит доску (профиль изменился → componentDidUpdate).
        if (!scoredRef.current) {
          scoredRef.current = true;
          setAward(playGame(1));
        }
      } else {
        const q = usedHint ? 3 : 5;
        onAttempt?.(q);
        schedule(() => onSolve?.(q), 700);
      }
      return;
    }
    onAttempt?.(0);
    sfx.wrong();
    haptic.wrong();
    setBad(true);
    schedule(() => {
      setState({ tray: shuffledTiles(word.text), slots: Array(word.text.length).fill(null) });
      setBad(false);
    }, 900);
  };

  const tapTray = (tile: BoardTile) => {
    if (solved || bad || suppressClickRef.current) return;
    if (firstEmpty(state.slots) < 0) return;
    sfx.tap();
    finishIfComplete(placeInFirstEmpty(state, tile.id), hintUsed);
  };

  const tapSlot = (index: number) => {
    if (solved || bad || suppressClickRef.current) return;
    if (!state.slots[index]) return;
    sfx.tap();
    setState((s) => returnToTray(s, index));
  };

  /** Подсказка ставит следующую букву на своё место (и съедает качество в уроке). */
  const hint = () => {
    const slot = firstEmpty(state.slots);
    if (solved || bad || slot < 0) return;
    const need = word.text[slot];
    const tile = state.tray.find((t) => t.ch === need);
    if (!tile) return;
    setHintUsed(true);
    finishIfComplete(placeFromTray(state, tile.id, slot), true);
  };

  const beginDrag = (e: React.PointerEvent, tile: BoardTile, from: 'tray' | number) => {
    if (solved || bad) return;
    e.preventDefault();
    try {
      // jsdom и часть вебвью не реализуют захват указателя — перенос там
      // живёт только на событиях самого элемента, это безопасно.
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* без захвата — события всё равно приходят на элемент */
    }
    movedRef.current = false;
    pendingRef.current = { tile, from, startX: e.clientX, startY: e.clientY };
  };

  const hitTest = (x: number, y: number) => {
    const boxes = slotRefs.current.map((el) => {
      const r = el?.getBoundingClientRect();
      return r ? { left: r.left, width: r.width, top: r.top, height: r.height } : { left: 0, width: 0, top: 0, height: 0 };
    });
    const overSlot = dropSlotAt(x, y, boxes);
    const rt = trayRef.current?.getBoundingClientRect();
    const overTray =
      !!rt && x >= rt.left - 20 && x <= rt.right + 20 && y >= rt.top - 20 && y <= rt.bottom + 20;
    return { overSlot, overTray };
  };

  const movePointer = (e: React.PointerEvent) => {
    const pending = pendingRef.current;
    if (!pending) return;
    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_START) return;
    movedRef.current = true;
    const { overSlot, overTray } = hitTest(e.clientX, e.clientY);
    setDrag({ ...pending, x: e.clientX, y: e.clientY, overSlot, overTray });
  };

  const endPointer = () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    if (movedRef.current) {
      const cur = drag;
      if (cur?.overSlot != null) {
        sfx.tap();
        if (typeof cur.from === 'number') setState((s) => swapSlots(s, cur.from as number, cur.overSlot as number));
        else finishIfComplete(placeFromTray(state, cur.tile.id, cur.overSlot), hintUsed);
      } else if (cur?.overTray && typeof cur.from === 'number') {
        sfx.tap();
        setState((s) => returnToTray(s, cur.from as number));
      }
      suppressClickRef.current = true;
      window.setTimeout(() => (suppressClickRef.current = false), 120);
    }
    setDrag(null);
  };

  const reshuffle = () => {
    setAward(null);
    setState({ tray: shuffledTiles(word.text), slots: Array(word.text.length).fill(null) });
    setHintUsed(false);
    setBad(false);
    setResolved(false);
  };

  const slotAria = (t: BoardTile | null, i: number) =>
    t ? `Буква ${t.ch} на позиции ${i + 1} из ${word.text.length}. Тап — убрать` : `Пустая лунка ${i + 1} из ${word.text.length}`;

  // Лоток рисуем по «местам» исходной выдачи: убранная буква оставляет за
  // собой пустое место, поэтому оставшиеся плитки не перескакивают с места на
  // место после каждого тапа.
  const traySlots: Array<BoardTile | null> = Array.from({ length: word.text.length }, (_, id) =>
    state.tray.find((t) => t.id === id) ?? null,
  );
  const boardStyle = {
    '--slot-cols': boardColumns(word.text.length),
  } as CSSProperties;

  return (
    <div className="word-board" style={boardStyle}>
      <div
        className={`slots tileboard-slots ${bad ? 'shake' : ''}`}
        aria-label="Слово из плиток"
      >
        {state.slots.map((t, i) =>
          t ? (
            <button
              key={i}
              ref={(el) => {
                slotRefs.current[i] = el;
              }}
              type="button"
              className={`slot tileboard-slot filled ${bad ? 'bad' : ''} ${drag?.overSlot === i ? 'drop' : ''}`}
              aria-label={slotAria(t, i)}
              disabled={solved || bad}
              onPointerDown={(e) => beginDrag(e, t, i)}
              onPointerMove={movePointer}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onClick={() => tapSlot(i)}
            >
              {t.ch}
            </button>
          ) : (
            <div
              key={i}
              ref={(el) => {
                slotRefs.current[i] = el;
              }}
              className={`slot tileboard-slot ${drag?.overSlot === i ? 'drop' : ''}`}
              aria-label={slotAria(null, i)}
            >
              {''}
            </div>
          ),
        )}
      </div>

      {/* Решённое слово — лоток больше не нужен (0.96.6): все буквы стоят в
          лунках, и «лоток» оставался пустым серым прямоугольником с пунктирами
          на 78 px. На Android из-за него баннер уезжал под низ экрана
          (замечание 2026-11-11, «не помещается игра»). В уроке лоток остаётся:
          там он часть задания и стоит на своём месте. */}
      {!(unscored && solved) && (
      <div
        ref={trayRef}
        className={`letters tileboard-tray ${drag?.overTray ? 'tray-hot' : ''}`}
        aria-label="Буквы"
      >
        {traySlots.map((t, i) =>
          t ? (
            <button
              key={t.id}
              type="button"
              className={`letter tileboard-tile`}
              disabled={solved || bad}
              aria-label={`Буква ${t.ch}. Тап — поставить в слово`}
              onPointerDown={(e) => beginDrag(e, t, 'tray')}
              onPointerMove={movePointer}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onClick={() => tapTray(t)}
            >
              {t.ch}
            </button>
          ) : (
            <span key={`empty-${i}`} className="tileboard-gap" aria-hidden="true" />
          ),
        )}
        {state.tray.length === 0 && !solved && (
          <p className="tiny muted tileboard-tray-note">Буквы разобраны</p>
        )}
      </div>
      )}

      {/* Призрак буквы под пальцем/указателем во время переноса */}
      {drag && (
        <div
          className="tileboard-ghost"
          aria-hidden="true"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.tile.ch}
        </div>
      )}

      {!bad && firstEmpty(state.slots) >= 0 && !solved && (
        <HintBtn onClick={hint} label={hintUsed ? 'Ещё букву' : 'Подставить букву'} />
      )}
      {hintUsed && <HintCard word={word} />}

      {unscored && solved && (
        <div className="tileboard-banner tileboard-banner-compact" role="status">
          <div className="tileboard-banner-title">✨ Слово собрано!</div>
          <WordLetters word={word} markDanger small stress />
          {/* Пояснение к оранжевой букве оставляем: без него подсветка —
              просто цвет. В компактном баннере строка мелкая и в одну строку. */}
          <div className="tiny muted tileboard-banner-note">Оранжевым — та буква, которая тут хитрит</div>
          {award && (award.xp > 0 || award.gems > 0) && (
            <p className="tileboard-banner-award tiny">
              {award.gems > 0 && <b>+{award.gems} 💎 </b>}
              {award.xp > 0 && <b>+{award.xp} ⚡</b>}
              <span className="muted"> · засчитано в задания дня</span>
            </p>
          )}
          <div className="tileboard-banner-actions">
            {onNext && (
              <button className="btn primary" type="button" onClick={onNext}>
                {nextLabel ?? 'Дальше →'}
              </button>
            )}
            <button className="btn ghost" type="button" onClick={reshuffle}>
              🔄 Ещё раз
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
