/**
 * «Слоговая мозаика» — выложи слово из слогов (0.106.0).
 *
 * Слоги слова перемешаны и лежат плитками; ребёнок складывает их в слоты.
 * Тап по плитке ставит слог в первый пустой слот, тап по слоту — возвращает.
 * Неверный порядок: слоты мягко краснеют и возвращают плитки, ничего не
 * сгорает — ровно как в «Собери слово», чтобы два похожих экрана не учили
 * ребёнка двум разным правилам.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../types';
import { syllableBoard, syllablePool, syllableSolved, type SyllableTile } from '../engine/syllable-board';
import { boardOrder, poolDeck } from '../engine/pool-cursor';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';
import { gameAwardHint } from '../engine/game-awards';
import { todayStat, useApp } from '../state/store';
import { readBoardMemo, writeBoardMemo } from './WordSearchGame';
import { WordArt } from './WordView';
import { Confetti } from './Bits';
import { prefersReducedMotion } from './motion';

const memoKeyFor = (profileId: string, grade: number) => `syl:${profileId}:${grade}`;

/** Фишер–Йетс на Math.random: порядок плиток не должен подсказывать ответ. */
function shuffleTiles(list: SyllableTile[]): SyllableTile[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function SyllableBoard({
  pool,
  grade,
  profileId,
  priorityIds,
  onGoLessons,
}: {
  pool: Word[];
  grade: number;
  profileId: string;
  priorityIds: string[];
  onGoLessons: () => void;
}) {
  const memoKey = memoKeyFor(profileId, grade);
  const words = useMemo(() => syllablePool(pool), [pool]);
  const pickNext = (cursor: number, avoidIds: string[]): Word | null =>
    boardOrder(words, { cursor, avoidIds, priorityIds })[0] ?? null;

  const [memo, setMemo] = useState(() => readBoardMemo(memoKey));
  const [word, setWord] = useState<Word | null>(() => {
    const start = readBoardMemo(memoKey);
    return pickNext(start.cursor, start.avoidIds);
  });
  const board = useMemo(() => (word ? syllableBoard(word, shuffleTiles) : null), [word]);
  const [picked, setPicked] = useState<SyllableTile[]>([]);
  const [bad, setBad] = useState(false);
  const [message, setMessage] = useState('Выложи слово из слогов.');
  const [award, setAward] = useState<{ xp: number; gems: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const solvedRef = useRef(false);
  const profile = useApp((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const solved = !!board && syllableSolved(board, picked);

  useEffect(() => {
    if (!word) return;
    const deck = poolDeck(words, priorityIds);
    const at = deck.findIndex((w) => w.id === word.id);
    const cursor = at >= 0 ? (at + 1) % Math.max(1, deck.length) : memo.cursor;
    const next = { cursor, avoidIds: [word.id] };
    setMemo(next);
    writeBoardMemo(memoKey, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id, memoKey]);

  useEffect(() => {
    if (!solved || solvedRef.current) return;
    solvedRef.current = true;
    setAward(useApp.getState().playGame(1));
    setMessage('Слово собрано!');
    sfx.finish(3);
    haptic.finish();
    if (!prefersReducedMotion()) setConfetti(true);
  }, [solved]);

  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(false), 2600);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  const usedIds = new Set(picked.map((t) => t.id));

  const place = (tile: SyllableTile) => {
    if (!board || solved || bad) return;
    if (usedIds.has(tile.id) || picked.length >= board.slots.length) return;
    const next = [...picked, tile];
    setPicked(next);
    sfx.tap();
    haptic.tap();
    if (next.length < board.slots.length) {
      setMessage('Дальше — следующий слог.');
      return;
    }
    if (syllableSolved(board, next)) return; // победу обрабатывает эффект
    // Полный, но неверный порядок: плитки возвращаются, счёт не меняется.
    setBad(true);
    sfx.wrong();
    haptic.wrong();
    setMessage('Порядок другой. Попробуй ещё — ничего не потеряно.');
    window.setTimeout(() => {
      setPicked([]);
      setBad(false);
    }, 900);
  };

  const takeBack = (index: number) => {
    if (!board || solved || bad) return;
    if (!picked[index]) return;
    setPicked((list) => list.filter((_, i) => i !== index));
    sfx.tap();
  };

  const another = () => {
    const fresh = pickNext(memo.cursor, memo.avoidIds);
    if (!fresh) return;
    solvedRef.current = false;
    setAward(null);
    setConfetti(false);
    setPicked([]);
    setBad(false);
    setMessage('Выложи слово из слогов.');
    setWord(fresh);
  };

  if (!board) {
    return (
      <div className="syl-empty">
        <div className="games-empty-emoji" aria-hidden="true">🧩</div>
        <p className="games-empty-title">Пока нечего складывать</p>
        <p className="tiny muted">Пройди пару уроков — и здесь появятся слова из нескольких слогов.</p>
        <button type="button" className="btn primary wide" onClick={onGoLessons}>
          К урокам →
        </button>
      </div>
    );
  }

  return (
    /* `data-syl-word` — только для проверок: слоги слова уже видны в слотах
       после сборки, а тесту нужен способ нажать плитки в правильном порядке
       без перебора факториала перестановок. Детям атрибут не показывается. */
    <section className="syl-card" aria-label="Слоговая мозаика" data-syl-word={board.word.text}>
      <Confetti show={confetti} />
      <div className="ring-bar">
        <strong className="grow">
          Слогов собрано: {picked.length} из {board.slots.length}
        </strong>
        <button type="button" className="btn ghost sm" onClick={another}>
          🔄 Другое слово
        </button>
      </div>

      <div className="ring-clue">
        <WordArt word={board.word} size={56} />
        <p className="clue-hint">💡 {board.word.hint}</p>
      </div>

      <div className="syl-slots" role="group" aria-label="Собранное слово">
        {board.slots.map((_, i) => {
          const tile = picked[i];
          return (
            <button
              key={i}
              type="button"
              className={`syl-slot${tile ? ' syl-slot-on' : ''}${bad ? ' syl-slot-bad' : ''}`}
              data-syl-slot={i}
              aria-label={tile ? `Слог ${tile.text}, вернуть` : `Пустой слот ${i + 1}`}
              onClick={() => takeBack(i)}
            >
              {tile?.text ?? ''}
            </button>
          );
        })}
      </div>

      <div className="syl-tray" role="group" aria-label="Слоги">
        {board.tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className={`syl-tile${usedIds.has(tile.id) ? ' syl-tile-used' : ''}`}
            data-syl-tile={tile.text}
            disabled={usedIds.has(tile.id) || solved || bad}
            onClick={() => place(tile)}
          >
            {tile.text}
          </button>
        ))}
      </div>

      <p className="tiny" role="status">{message}</p>

      {solved && (
        <div className="syl-win" role="status">
          <p className="syl-win-title">Слово собрано!</p>
          <p className="syl-win-word">{board.word.text}</p>
          {award && (award.xp > 0 || award.gems > 0) && (
            <p className="tiny">
              {award.gems > 0 && <b>+{award.gems} 💎 </b>}
              {award.xp > 0 && <b>+{award.xp} ⚡</b>}
              <span className="muted"> · засчитано в задания дня</span>
            </p>
          )}
          <p className="tiny muted">{gameAwardHint(todayStat(profile).games ?? { xp: 0, correct: 0, words: 0 })}</p>
          <button type="button" className="btn primary" onClick={another}>
            Другое слово →
          </button>
        </div>
      )}
    </section>
  );
}
