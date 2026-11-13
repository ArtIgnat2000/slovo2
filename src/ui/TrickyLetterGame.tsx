/**
 * «Хитрая буква» — детская замена Wordle и «виселицы» (0.103.0, §6-E плана).
 *
 * В слове закрыта одна буква — та, в которой чаще всего ошибаются. Ребёнок
 * выбирает её из четырёх вариантов; ошибка не наказывает, а открывает
 * следующую ступень подсказки: мнемоника → предложение → буква открыта.
 * Попытки не кончаются, слово засчитывается всегда.
 *
 * Рамка «Игры»: SRS не меняется, награда — `playGame` за раунд из шести слов,
 * ничего не сгорает, уйти с середины раунда можно в любой момент.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../types';
import {
  advanceRound,
  emptyRound,
  roundDone,
  trickyHint,
  trickyPool,
  trickyTask,
  TRICKY_ROUND_SIZE,
} from '../engine/tricky-letter';
import { boardOrder, poolDeck } from '../engine/pool-cursor';
import { pickDanger } from '../engine/scheduler';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';
import { gameAwardHint } from '../engine/game-awards';
import { todayStat, useApp } from '../state/store';
import { readBoardMemo, writeBoardMemo } from './WordSearchGame';
import { WordArt } from './WordView';
import { Confetti } from './Bits';
import { prefersReducedMotion } from './motion';

const memoKeyFor = (profileId: string, grade: number) => `tricky:${profileId}:${grade}`;

export function TrickyLetterGame({
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
  const words = useMemo(() => trickyPool(pool), [pool]);
  /** Опасную букву выбираем так же, как в уроке: `pickDanger`. */
  const build = (word: Word | null) => (word ? trickyTask({ ...word, danger: [pickDanger(word)] }) : null);

  const pickNext = (cursor: number, avoidIds: string[]): Word | null =>
    boardOrder(words, { cursor, avoidIds, priorityIds })[0] ?? null;

  const [memo, setMemo] = useState(() => readBoardMemo(memoKey));
  const [word, setWord] = useState<Word | null>(() => {
    const start = readBoardMemo(memoKey);
    return pickNext(start.cursor, start.avoidIds);
  });
  const [task, setTask] = useState(() => build(word));
  const [wrong, setWrong] = useState(0);
  const [solved, setSolved] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [round, setRound] = useState(() => emptyRound(TRICKY_ROUND_SIZE));
  const [award, setAward] = useState<{ xp: number; gems: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const scored = useRef(false);
  const profile = useApp((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const hint = task ? trickyHint(task.word, wrong) : 'none';
  const won = roundDone(round);

  // Круг слов двигаем при показе слова: ушёл с середины — вернёшься к другому.
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
    if (!won || scored.current) return;
    scored.current = true;
    setAward(useApp.getState().playGame(round.size));
    sfx.finish(3);
    haptic.finish();
    if (!prefersReducedMotion()) setConfetti(true);
  }, [won, round.size]);

  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(false), 2800);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  const choose = (letter: string) => {
    if (!task || solved) return;
    if (letter === task.answer) {
      setSolved(true);
      setRound((r) => advanceRound(r, hint === 'revealed'));
      sfx.correct();
      haptic.correct();
      return;
    }
    // Ошибка не отнимает попытку: прибавляется подсказка.
    setWrong((n) => n + 1);
    setRejected((list) => (list.includes(letter) ? list : [...list, letter]));
    sfx.wrong();
    haptic.tap();
  };

  const nextWord = () => {
    const fresh = pickNext(memo.cursor, memo.avoidIds);
    if (!fresh) return;
    setWord(fresh);
    setTask(build(fresh));
    setWrong(0);
    setSolved(false);
    setRejected([]);
  };

  const newRound = () => {
    scored.current = false;
    setAward(null);
    setConfetti(false);
    setRound(emptyRound(TRICKY_ROUND_SIZE));
    nextWord();
  };

  if (!task) {
    return (
      <div className="tl-empty">
        <div className="games-empty-emoji" aria-hidden="true">🪄</div>
        <p className="games-empty-title">Пока нет слов с хитрой буквой</p>
        <p className="tiny muted">Пройди пару уроков — и здесь появятся слова, где легко ошибиться.</p>
        <button type="button" className="btn primary wide" onClick={onGoLessons}>
          К урокам →
        </button>
      </div>
    );
  }

  const letters = [...task.word.text];
  const showLetter = solved || hint === 'revealed';

  return (
    <section className="tl-card" aria-label="Хитрая буква">
      <Confetti show={confetti} />
      <div className="tl-bar">
        <strong className="grow">
          Верных: {round.solved} из {round.size}
        </strong>
        <button type="button" className="btn ghost sm" onClick={solved ? nextWord : newRound}>
          {solved ? 'Другое слово' : '🔄 Сначала'}
        </button>
      </div>

      {won ? (
        <div className="tl-win" role="status">
          <div className="tl-win-emoji" aria-hidden="true">🎉</div>
          <p className="tl-win-title">Шесть слов позади!</p>
          {award && (award.xp > 0 || award.gems > 0) && (
            <p className="tiny">
              {award.gems > 0 && <b>+{award.gems} 💎 </b>}
              {award.xp > 0 && <b>+{award.xp} ⚡</b>}
              <span className="muted"> · засчитано в задания дня</span>
            </p>
          )}
          <p className="tiny muted">{gameAwardHint(todayStat(profile).games ?? { xp: 0, correct: 0, words: 0 })}</p>
          <button type="button" className="btn primary" onClick={newRound}>
            Ещё шесть →
          </button>
        </div>
      ) : (
        <>
          <div className="tl-clue">
            <WordArt word={task.word} size={56} />
            <p className="clue-hint">💡 {task.word.hint}</p>
          </div>

          <p className="tl-word" aria-label={`Слово из ${letters.length} букв, одна буква скрыта`}>
            {letters.map((ch, i) => (
              <span
                key={i}
                className={
                  i === task.index
                    ? showLetter
                      ? 'tl-slot tl-slot-on'
                      : 'tl-slot tl-slot-hidden'
                    : 'tl-slot'
                }
              >
                {i === task.index && !showLetter ? '?' : ch}
              </span>
            ))}
          </p>

          <div className="tl-options" role="group" aria-label="Выбери хитрую букву">
            {task.options.map((letter) => {
              const gone = rejected.includes(letter);
              const right = solved && letter === task.answer;
              return (
                <button
                  key={letter}
                  type="button"
                  className={`tl-option${gone ? ' tl-option-gone' : ''}${right ? ' tl-option-right' : ''}`}
                  data-tl-letter={letter}
                  disabled={gone || solved}
                  aria-label={`Буква ${letter}`}
                  onClick={() => choose(letter)}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {solved ? (
            <div className="tl-ok" role="status">
              <p>
                Верно: <b>{task.word.text}</b>
                {hint === 'revealed' && <span className="muted"> · буква открылась, но слово засчитано</span>}
              </p>
              {hint !== 'none' && <p className="tiny muted">Подсказки помогли — это не ошибка, так и учатся.</p>}
              <button type="button" className="btn primary" onClick={nextWord}>
                Дальше →
              </button>
            </div>
          ) : (
            <div className="tl-hints" role="status">
              {hint === 'none' && <p className="tiny muted">Если ошибиться, появится подсказка — попыток не отнимается.</p>}
              {hint === 'mnemonic' && task.word.mnemonic && (
                <p className="tiny">🌟 {task.word.mnemonic}</p>
              )}
              {(hint === 'sentence' || hint === 'revealed') && (
                <p className="tiny">{task.word.sentence.replace('____', '…')}</p>
              )}
              {hint === 'revealed' && (
                <p className="tiny">
                  Буква открыта: <b>{task.answer}</b> — «{task.word.text}». Выбери её из оставшихся.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <p className="tiny muted tl-note">
        Опасная буква — та, в которой чаще всего ошибаются. Ошибка здесь ничего не отнимает.
      </p>
    </section>
  );
}
