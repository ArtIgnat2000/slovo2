/**
 * «Колесо букв» — проведи по слову пальцем (0.103.0, §6-C плана «Игры»).
 *
 * Буквы слова стоят по кругу; ребёнок ведёт палец по порядку букв, и слово
 * собирается. Тап работает так же, как ведение: это не «режим для слабых»,
 * а доступность и клавиатура (тот же приём, что в филворде).
 *
 * Рамка «Игры» не меняется: ничего не сгорает, ошибка ничего не отнимает,
 * таймера и «попыток» нет. Собранное слово даёт `playGame(1)` — как в
 * «Собери слово».
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../types';
import { ringBoard, ringDone, ringPool, ringStep, RING_MAX_LETTERS } from '../engine/ring';
import { boardOrder, poolDeck } from '../engine/pool-cursor';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';
import { gameAwardHint } from '../engine/game-awards';
import { todayStat, useApp } from '../state/store';
import { readBoardMemo, writeBoardMemo } from './WordSearchGame';
import { WordArt } from './WordView';
import { Confetti } from './Bits';
import { prefersReducedMotion } from './motion';

/** Ключ памяти круга: отдельно от филворда — у игр разные пулы. */
const memoKeyFor = (profileId: string, grade: number) => `ring:${profileId}:${grade}`;

export function LetterRingGame({
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
  const words = useMemo(() => ringPool(pool), [pool]);

  /**
   * Выбор слова — тем же кругом, что у сеточных игр (0.96.5): слова не
   * повторяются, пока круг не пройден целиком.
   */
  const pickNext = (cursor: number, avoidIds: string[]) => {
    const deck = boardOrder(words, { cursor, avoidIds, priorityIds });
    return deck[0] ?? null;
  };

  const [memo, setMemo] = useState(() => readBoardMemo(memoKey));
  const [word, setWord] = useState<Word | null>(() => {
    const start = readBoardMemo(memoKey);
    return pickNext(start.cursor, start.avoidIds);
  });
  const board = useMemo(() => (word ? ringBoard(word) : null), [word]);
  const [collected, setCollected] = useState(0);
  const [message, setMessage] = useState('Веди пальцем по буквам по порядку.');
  const [award, setAward] = useState<{ xp: number; gems: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const scored = useRef(false);
  const profile = useApp((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const done = !!board && ringDone(board, collected);

  // Круг запоминаем сразу при показе слова: даже если ребёнок ушёл, следующее
  // слово не будет тем же самым.
  useEffect(() => {
    if (!word || !board) return;
    const deck = poolDeck(words, priorityIds);
    const at = deck.findIndex((w) => w.id === word.id);
    const cursor = at >= 0 ? (at + 1) % Math.max(1, deck.length) : memo.cursor;
    const next = { cursor, avoidIds: [word.id] };
    setMemo(next);
    writeBoardMemo(memoKey, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id, memoKey]);

  useEffect(() => {
    if (!done || scored.current) return;
    scored.current = true;
    setAward(useApp.getState().playGame(1));
    sfx.finish(3);
    haptic.finish();
    setMessage('Слово собрано!');
    if (!prefersReducedMotion()) setConfetti(true);
  }, [done]);

  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(false), 2600);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  const step = (index: number) => {
    if (!board || done) return;
    const next = ringStep(board, collected, index);
    if (next === collected) {
      // Промах — не наказание: мягкий звук и та же строка.
      sfx.tap();
      haptic.tap();
      setMessage('Эта буква не следующая — начни с той, где огонёк.');
      return;
    }
    setCollected(next);
    if (ringDone(board, next)) return; // победу обрабатывает эффект
    sfx.correct();
    haptic.tap();
    setMessage('Дальше — следующая буква.');
  };

  const another = () => {
    const fresh = pickNext(memo.cursor, memo.avoidIds);
    if (!fresh) return;
    scored.current = false;
    setAward(null);
    setConfetti(false);
    setCollected(0);
    setMessage('Веди пальцем по буквам по порядку.');
    setWord(fresh);
  };

  if (!board) {
    return (
      <div className="ring-empty">
        <div className="games-empty-emoji" aria-hidden="true">🎡</div>
        <p className="games-empty-title">Пока нечего вести по кругу</p>
        <p className="tiny muted">
          Колесо собирает короткие слова — до {RING_MAX_LETTERS} букв. Пройди пару уроков, и здесь
          появятся такие слова.
        </p>
        <button type="button" className="btn primary wide" onClick={onGoLessons}>
          К урокам →
        </button>
      </div>
    );
  }

  const longGradeNote = grade >= 3;

  return (
    <section className="ring-card" aria-label="Колесо букв">
      <Confetti show={confetti} />
      <div className="ring-bar">
        <strong className="grow">
          Собрано: {collected} из {board.letters}
        </strong>
        <button type="button" className="btn ghost sm" onClick={another}>
          🔄 Другое слово
        </button>
      </div>
      <p className="ring-word" aria-live="polite">
        {[...board.word.text].map((ch, i) => (
          <span key={i} className={i < collected ? 'ring-word-on' : 'ring-word-off'}>
            {i < collected ? ch : '•'}
          </span>
        ))}
      </p>

      <div className="ring-clue">
        <WordArt word={board.word} size={56} />
        <div className="ring-clue-body">
          <p className="clue-hint">💡 {board.word.hint}</p>
          {longGradeNote && (
            <p className="tiny muted">
              Длинные слова в круге читать тяжело — если попадётся такое, попробуй «Хитрую букву».
            </p>
          )}
        </div>
      </div>

      <div className="ring-stage">
        <div className="ring" role="group" aria-label="Буквы по кругу">
          {board.dots.map((dot) => {
            const passed = dot.index < collected;
            const nextToPress = dot.index === collected;
            return (
              <button
                key={dot.index}
                type="button"
                className={[
                  'ring-dot',
                  passed ? 'ring-dot-passed' : '',
                  nextToPress ? 'ring-dot-next' : '',
                  dot.danger ? 'ring-dot-danger' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-ring-index={dot.index}
                style={{
                  // Позиция на окружности: угол от «12 часов» по часовой стрелке.
                  // Считаем через CSS-переменные, чтобы анимация и тап были
                  // обычными, а не «магическими» процентами.
                  ['--ring-angle' as string]: `${dot.angle}deg`,
                }}
                aria-pressed={passed}
                aria-label={`Буква ${dot.index + 1}: ${dot.letter}`}
                onClick={() => step(dot.index)}
              >
                {dot.letter}
              </button>
            );
          })}
          <div className="ring-core" aria-hidden="true">
            {done ? '🎉' : '✦'}
          </div>
        </div>
      </div>

      <p className="tiny ring-status" role="status">
        {message}
      </p>

      {done && (
        <div className="ring-win" role="status">
          <p className="ring-win-title">Слово собрано!</p>
          <p className="ring-win-word">{board.word.text}</p>
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
