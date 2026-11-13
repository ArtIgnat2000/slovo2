import { useEffect, useRef, useState } from 'react';
import type { Word } from '../types';
import { buildMemory, closeMemory, emptyMemory, flipMemory, memoryWon } from '../engine/memory';
import { gameAwardHint } from '../engine/game-awards';
import { todayStat, useApp } from '../state/store';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';
import { readBoardMemo, writeBoardMemo } from './WordSearchGame';
import { WordArt, WordLetters } from './WordView';
import { Confetti } from './Bits';
import { prefersReducedMotion } from './motion';

/** Parent keys this by profile, class and pool. A round freezes its words/priority. */
export function MemoryGame({ pool, grade, profileId, priorityIds, onGoLessons }: {
  pool: Word[]; grade: number; profileId: string; priorityIds: string[]; onGoLessons: () => void;
}) {
  const memoKey = `memory:${profileId}:${grade}`;
  const createBoard = () => {
    const memo = readBoardMemo(memoKey);
    return buildMemory(pool, grade, Math.floor(Math.random() * 0xffffffff), memo.cursor, memo.avoidIds, priorityIds);
  };
  const [board, setBoard] = useState(createBoard);
  const [state, setState] = useState(emptyMemory);
  const current = useRef(state);
  const [hint, setHint] = useState<string | null>(null);
  const [message, setMessage] = useState('Открой две карточки и найди пару.');
  const [award, setAward] = useState<{ xp: number; gems: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const scored = useRef(false);
  const profile = useApp(s => s.profiles.find(p => p.id === profileId) ?? null);
  const won = !!board && memoryWon(board, state);
  const update = (next: typeof state) => { current.current = next; setState(next); };

  // Advance the persisted circle once the round is displayed, including abandoned rounds.
  useEffect(() => {
    if (board) writeBoardMemo(memoKey, { cursor: board.nextCursor, avoidIds: board.words.map(w => w.id) });
  }, [board, memoKey]);
  useEffect(() => {
    if (state.open.length !== 2) return;
    const timer = window.setTimeout(() => update(closeMemory(current.current)), 1000);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), 1800);
    return () => window.clearTimeout(timer);
  }, [hint]);
  useEffect(() => {
    if (!board || !won || scored.current) return;
    scored.current = true;
    setAward(useApp.getState().playGame(board.words.length));
    sfx.finish(3); haptic.finish();
    setConfetti(!prefersReducedMotion());
  }, [board, won]);
  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  if (!board) return <div className="card"><p>Пока мало слов для однозначных пар.</p><button className="btn" onClick={onGoLessons}>К урокам</button></div>;
  const flip = (id: string) => {
    if (hint) return;
    const previous = current.current;
    const next = flipMemory(board, previous, id);
    if (next === previous) return;
    update(next);
    if (next.matched.length > previous.matched.length) {
      setMessage('Пара найдена!'); sfx.correct(); haptic.correct();
    } else {
      sfx.tap(); haptic.tap();
      setMessage(next.open.length === 2 ? 'Это разные пары. Попробуй ещё!' : 'Теперь открой вторую карточку.');
    }
  };
  const again = () => {
    scored.current = false; setAward(null); setConfetti(false); setHint(null);
    update(emptyMemory()); setBoard(createBoard()); setMessage('Новая партия. Найди пары!');
  };
  return <section className={`memory-game ${grade === 5 ? 'memory-text' : ''}`} aria-label="Мемори">
    <Confetti show={confetti} />
    <div className="row"><strong className="grow">Найдено пар: {state.matched.length} из {board.words.length}</strong>
      <button className="btn ghost sm" onClick={again}>Новая партия</button></div>
    <progress className="memory-progress" value={state.matched.length} max={board.words.length} aria-label="Найденные пары" />
    <p className="tiny muted">{grade === 5 ? 'Найди слово и его значение.' : 'Найди слово и его картинку.'}</p>
    <p className="tiny" role="status">{won ? 'Ура! Все пары найдены!' : message}</p>
    {won && <div className="card memory-win">
      <strong>Все пары найдены!</strong>
      {award && <p>{award.gems > 0 && `+${award.gems} 💎 `}{award.xp > 0 && `+${award.xp} ⚡`}</p>}
      <p className="tiny muted">{gameAwardHint(todayStat(profile).games ?? { xp: 0, correct: 0, words: 0 })}</p>
      <button className="btn primary" onClick={again}>Ещё партию</button>
    </div>}
    <div className="memory-grid">
      {board.cards.map((card, index) => {
        const matched = state.matched.includes(card.word.id);
        const open = matched || state.open.includes(card.id) || hint === card.word.id;
        const label = card.face === 'hint' ? card.word.hint : card.face === 'image' ? `Картинка: ${card.word.hint}` : card.word.text;
        return <button key={card.id} data-memory-id={card.id} type="button" className={`memory-card ${open ? 'is-open' : ''} ${matched ? 'is-matched' : ''}`}
          aria-label={open ? `${matched ? 'Пара найдена. ' : ''}${label}` : `Карточка ${index + 1} закрыта`}
          aria-pressed={open} aria-disabled={matched || !!hint || state.open.length === 2}
          onClick={() => flip(card.id)}>
          <span className="memory-inner" aria-hidden="true">
            <span className="memory-back">✦ ? ✦</span>
            <span className="memory-front">{open && <>
              {card.face === 'image' ? <WordArt word={card.word} size={64} /> : card.face === 'hint' ? card.word.hint : <WordLetters word={card.word} markDanger />}
              {matched && <span className="memory-check">✓</span>}
            </>}</span>
          </span>
        </button>;
      })}
    </div>
    {!won && <button className="btn ghost" disabled={!!hint || state.open.length > 0} onClick={() => {
      setHint(board.words.find(w => !state.matched.includes(w.id))?.id ?? null);
      setMessage('Посмотри на пару и запомни её.'); sfx.hint();
    }}>💡 Показать пару</button>}
  </section>;
}
