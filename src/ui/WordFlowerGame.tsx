/**
 * «Цветок слова» — слово раскрывается по буквам (0.105.0).
 *
 * Стебель — слово, лепестки — его буквы. На каждом шаге снизу четыре
 * карточки-буквы: одна верная, три — соседки. Верная — лепесток раскрывается,
 * неверная — вянет `--orange-soft` и сразу появляется подсказка. Попытки не
 * кончаются, цветок не «умирает» (переделка «виселицы», стоп-лист проекта).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../types';
import {
  flowerDone,
  flowerHint,
  flowerPick,
  flowerPool,
  flowerStep,
} from '../engine/word-flower';
import { boardOrder, poolDeck } from '../engine/pool-cursor';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';
import { gameAwardHint } from '../engine/game-awards';
import { todayStat, useApp } from '../state/store';
import { readBoardMemo, writeBoardMemo } from './WordSearchGame';
import { WordArt } from './WordView';
import { Confetti } from './Bits';
import { prefersReducedMotion } from './motion';

const memoKeyFor = (profileId: string, grade: number) => `flower:${profileId}:${grade}`;

export function WordFlowerGame({
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
  const words = useMemo(() => flowerPool(pool), [pool]);
  const pickNext = (cursor: number, avoidIds: string[]): Word | null =>
    boardOrder(words, { cursor, avoidIds, priorityIds })[0] ?? null;

  const [memo, setMemo] = useState(() => readBoardMemo(memoKey));
  const [word, setWord] = useState<Word | null>(() => {
    const start = readBoardMemo(memoKey);
    return pickNext(start.cursor, start.avoidIds);
  });
  const [opened, setOpened] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [award, setAward] = useState<{ xp: number; gems: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const scored = useRef(false);
  const profile = useApp((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const done = !!word && flowerDone(word, opened);
  const hint = word ? flowerHint(word, wrong) : 'none';
  const step = useMemo(() => (word ? flowerStep(word, opened) : null), [word, opened]);

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
    if (!done || scored.current) return;
    scored.current = true;
    setAward(useApp.getState().playGame(1));
    sfx.finish(3);
    haptic.finish();
    if (!prefersReducedMotion()) setConfetti(true);
  }, [done]);

  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(false), 2600);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  const choose = (letter: string) => {
    if (!word || done) return;
    const next = flowerPick(word, opened, letter);
    if (next === opened) {
      setWrong((n) => n + 1);
      setTried((list) => (list.includes(letter) ? list : [...list, letter]));
      sfx.wrong();
      haptic.tap();
      return;
    }
    setOpened(next);
    // Новая буква — новые карточки: чужой промах к следующему шагу не относится.
    setTried([]);
    sfx.correct();
    haptic.correct();
  };

  const another = () => {
    const fresh = pickNext(memo.cursor, memo.avoidIds);
    if (!fresh) return;
    scored.current = false;
    setAward(null);
    setConfetti(false);
    setOpened(0);
    setWrong(0);
    setTried([]);
    setWord(fresh);
  };

  if (!word) {
    return (
      <div className="flower-empty">
        <div className="games-empty-emoji" aria-hidden="true">🌸</div>
        <p className="games-empty-title">Пока нечего растить</p>
        <p className="tiny muted">Пройди пару уроков — и здесь появятся слова, которые можно открыть по буквам.</p>
        <button type="button" className="btn primary wide" onClick={onGoLessons}>
          К урокам →
        </button>
      </div>
    );
  }

  const letters = [...word.text];

  return (
    <section className="flower-card" aria-label="Цветок слова">
      <Confetti show={confetti} />
      <div className="ring-bar">
        <strong className="grow">
          Открыто букв: {opened} из {letters.length}
        </strong>
        <button type="button" className="btn ghost sm" onClick={another}>
          🔄 Другое слово
        </button>
      </div>

      <div className="flower-stage" aria-label="Цветок">
        <div className="flower-petals" aria-hidden="true">
          {letters.map((ch, i) => (
            <span
              key={i}
              className={`flower-petal${i < opened ? ' flower-petal-open' : ''}${
                i === opened && tried.length ? ' flower-petal-touch' : ''
              }`}
            >
              {i < opened ? ch : '•'}
            </span>
          ))}
        </div>
        <p className="flower-stem" aria-live="polite">
          {letters.map((ch, i) => (
            <span key={i} className={i < opened ? 'flower-open' : 'flower-closed'}>
              {i < opened ? ch : '·'}
            </span>
          ))}
        </p>
      </div>

      <div className="ring-clue">
        <WordArt word={word} size={56} />
        <div className="ring-clue-body">
          <p className="clue-hint">💡 {word.hint}</p>
          {hint === 'mnemonic' && word.mnemonic && <p className="tiny">🌟 {word.mnemonic}</p>}
          {(hint === 'sentence' || hint === 'letter') && (
            <p className="tiny">{word.sentence.replace('____', '…')}</p>
          )}
          {hint === 'letter' && (
            <p className="tiny">
              Следующая буква — <b>{letters[opened]}</b>. Выбери её из карточек.
            </p>
          )}
        </div>
      </div>

      {done ? (
        <div className="flower-win" role="status">
          <p className="flower-win-title">Цветок распустился!</p>
          <p className="flower-win-word">{word.text}</p>
          {award && (award.xp > 0 || award.gems > 0) && (
            <p className="tiny">
              {award.gems > 0 && <b>+{award.gems} 💎 </b>}
              {award.xp > 0 && <b>+{award.xp} ⚡</b>}
              <span className="muted"> · засчитано в задания дня</span>
            </p>
          )}
          <p className="tiny muted">{gameAwardHint(todayStat(profile).games ?? { xp: 0, correct: 0, words: 0 })}</p>
          <button type="button" className="btn primary" onClick={another}>
            Новое слово →
          </button>
        </div>
      ) : (
        <div className="tl-options" role="group" aria-label="Выбери следующую букву">
          {(step?.choices ?? []).map((letter) => {
            const gone = tried.includes(letter) && letter !== step?.answer;
            return (
              <button
                key={letter}
                type="button"
                className={`tl-option${gone ? ' tl-option-gone' : ''}`}
                data-flower-letter={letter}
                aria-label={`Буква ${letter}`}
                onClick={() => choose(letter)}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      <p className="tiny muted tl-note">
        Ошибка ничего не отнимает: цветок не увянет, а подсказка станет подробнее.
      </p>
    </section>
  );
}
