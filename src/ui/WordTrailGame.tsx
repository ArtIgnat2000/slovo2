/**
 * «Тропа слов» — экран игры (0.110.0).
 *
 * Один экран, одна остановка: слово чинится (опасная буква или порядок слогов),
 * а потом по нему идёт маленький герой Буквёнок. Буквы — плиты, слоги — мосты;
 * ошибка не отнимает ни попытки, ни прогресса, а открывает подсказку.
 *
 * Рамка «Игры»: SRS не трогаем, таймеров/жизней/проигрыша нет, уйти можно в
 * любой момент — прогресс каждого слова уже лежит в профиле (`profile.trail`).
 * Награда — открытка за остановку и малый XP через `playGame(..., { gems: false })`:
 * кристаллов тропа не печатает.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClassId, TrailProgress } from '../types';
import { WORD_BY_ID } from '../content/words';
import {
  buildTrail,
  EMPTY_TRAIL,
  normalizeTrail,
  TRAIL_STOPS_MVP,
  trailModeFor,
  trailResume,
  trailStops,
  trailSyllableBoard,
  trailStep,
  trailSummary,
  withTrailStop,
  withTrailWord,
  type TrailTask,
} from '../engine/word-trail';
import { syllableSolved, type SyllableTile } from '../engine/syllable-board';
import { trickyHint } from '../engine/tricky-letter';
import { gameAwardHint } from '../engine/game-awards';
import { todayStat, useApp } from '../state/store';
import { WordArt } from './WordView';
import { TrailScene } from './TrailScene';
import { Confetti } from './Bits';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';
import { prefersReducedMotion } from './motion';

type TrailPhase = 'repair' | 'walk' | 'syllables' | 'word-done' | 'stop-done' | 'all-done';

/** Фишер–Йетс: порядок слогов не должен подсказывать ответ. */
function shuffleTiles(list: SyllableTile[]): SyllableTile[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function WordTrailGame({
  profileId,
  grade,
  onExit,
  onGoLessons,
}: {
  profileId: string;
  grade: number;
  onExit: () => void;
  onGoLessons?: () => void;
}) {
  const profile = useApp((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const setTrail = useApp((s) => s.setTrail);
  const stops = useMemo(
    () => trailStops(grade as ClassId, { limit: TRAIL_STOPS_MVP }),
    [grade],
  );
  const [progress, setProgress] = useState<TrailProgress>(() => normalizeTrail(profile?.trail));
  const resume = useMemo(() => trailResume(stops, progress), [stops, progress]);
  const summary = useMemo(() => trailSummary(stops, progress), [stops, progress]);
  const [wordId, setWordId] = useState<string | null>(resume.wordId);
  const [phase, setPhase] = useState<TrailPhase>(() =>
    resume.allDone ? 'all-done' : resume.stopDone ? 'stop-done' : 'repair',
  );
  const [task, setTask] = useState<TrailTask | null>(null);
  const [wrong, setWrong] = useState(0);
  const [rejected, setRejected] = useState<string[]>([]);
  const [picked, setPicked] = useState<SyllableTile[]>([]);
  const [walked, setWalked] = useState(0);
  const [message, setMessage] = useState('');
  const [award, setAward] = useState<{ xp: number; gems: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const awarded = useRef(false);
  const prevStop = useRef(resume.stopIndex);

  const board = useMemo(
    () => (task && task.mode === 'syllables' ? trailSyllableBoard(task, shuffleTiles) : null),
    [task],
  );
  const hint = task ? trickyHint(task.word, wrong) : 'none';
  const usedIds = new Set(picked.map((tile) => tile.id));

  /**
   * Новое слово — новое задание. Эффект зависит от индекса остановки, а не от
   * объекта `resume`: иначе каждое пройденное слово сбрасывало бы задание.
   */
  useEffect(() => {
    if (!wordId) {
      setTask(null);
      return;
    }
    const word = WORD_BY_ID[wordId];
    if (!word) {
      setTask(null);
      return;
    }
    const stop = stops[resume.stopIndex];
    const at = stop?.wordIds.indexOf(wordId) ?? 0;
    const mode = trailModeFor(word, at);
    // Опасную букву выбираем из отмеченных: одно и то же слово не должно
    // закрывать одну и ту же букву каждый заход.
    const dangerIndex =
      mode === 'letters' && word.danger.length
        ? word.danger[Math.floor(Math.random() * word.danger.length)]
        : -1;
    setTask(buildTrail(word, mode, dangerIndex));
    setPhase(mode === 'letters' ? 'repair' : 'syllables');
    setWrong(0);
    setRejected([]);
    setPicked([]);
    setWalked(0);
    setAward(null);
    setConfetti(false);
    setMessage('');
    awarded.current = false;
  }, [wordId, resume.stopIndex, stops]);

  /** Перешли на следующую остановку — начинаем с её первого непройденного слова. */
  useEffect(() => {
    if (prevStop.current === resume.stopIndex) return;
    prevStop.current = resume.stopIndex;
    setWordId(resume.wordId);
  }, [resume.stopIndex, resume.wordId]);

  /**
   * Закрытая остановка важнее экрана слова: после последнего слова сразу
   * показываем открытку, а не «Дальше» с пустым следующим словом.
   */
  useEffect(() => {
    if (resume.allDone) setPhase('all-done');
    else if (resume.stopDone) setPhase('stop-done');
  }, [resume.allDone, resume.stopDone]);

  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(false), 2600);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  /** Слово пройдено: сохраняем сразу (переживает перезапуск) и даём малый XP. */
  const finishWord = () => {
    if (!task || awarded.current) return;
    awarded.current = true;
    let next = withTrailWord(progress, task.word.id);
    // Открытка выдаётся в момент закрытия остановки, а не по кнопке: если
    // ребёнок уйдёт с экрана открытки, она уже в профиле.
    if (resume.stop && resume.stop.wordIds.every((id) => next.words.includes(id))) {
      next = withTrailStop(next, resume.stop.id, progress.stop);
    }
    setProgress(next);
    setTrail(next);
    setAward(useApp.getState().playGame(1, { gems: false }));
    setPhase('word-done');
    sfx.finish(3);
    haptic.finish();
    if (!prefersReducedMotion()) setConfetti(true);
    setMessage('Слово прошло по дороге!');
  };

  /**
   * Слоги складываются по одному. Как только последний встал, даём герою
   * полсекунды дойти до остановки и закрываем слово.
   */
  useEffect(() => {
    if (phase !== 'syllables' || !board || !syllableSolved(board, picked)) return;
    const timer = window.setTimeout(finishWord, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, board, picked]);

  if (!profile) return null;
  if (!stops.length) {
    return (
      <div className="screen games-screen trail-screen">
        <header className="trail-head">
          <button type="button" className="btn ghost sm trail-back" onClick={onExit}>
            ← Игры
          </button>
          <h2 className="trail-title">🗺️ Тропа слов</h2>
        </header>
        <div className="trail-empty">
          <div className="games-empty-emoji" aria-hidden="true">🗺️</div>
          <p className="games-empty-title">Пока некуда идти</p>
          <p className="tiny muted">В этом классе ещё нет слов, из которых можно выложить дорогу.</p>
          {onGoLessons && (
            <button type="button" className="btn primary wide" onClick={onGoLessons}>
              К урокам →
            </button>
          )}
        </div>
      </div>
    );
  }

  const stop = resume.stop ?? stops[0];
  const hiddenIndex =
    task && task.mode === 'letters' && phase === 'repair' && hint !== 'revealed' ? task.dangerIndex : -1;
  /** На сцене всегда всё слово: в слоговом режиме открыты только выложенные слоги. */
  const sceneTotal = task?.segments.length ?? 0;
  const sceneSegments = phase === 'syllables' ? picked.map((tile) => tile.text) : (task?.segments ?? []);
  // В слоговом режиме герой стоит на последней выложенной плите (или ждёт на
  // первой пустой), а не исчезает за полсекунды до открытки.
  const passed =
    phase === 'walk'
      ? walked
      : phase === 'syllables'
        ? Math.min(picked.length, Math.max(0, sceneTotal - 1))
        : -1;
  const sceneNote =
    phase === 'repair'
      ? hint === 'revealed'
        ? `Буква открыта: «${task?.answer ?? ''}». Выбери её — плита починится.`
        : 'Одна плита шатается. Почини её — и дорога откроется.'
      : phase === 'walk'
        ? 'Тапни следующую плиту — Буквёнок шагнёт по слову.'
        : phase === 'syllables'
          ? 'Выложи мост из слогов: каждый слог — плита дороги.'
          : phase === 'word-done'
            ? 'Слово пройдено. Дальше — следующее.'
            : 'Остановка позади — открытка сохранена.';
  const stopNumber = Math.min(resume.stopIndex + 1, summary.totalStops);

  return (
    <div className="screen games-screen trail-screen" data-trail-word={task?.word.text}>
      <Confetti show={confetti} />

      <header className="trail-head">
        <button type="button" className="btn ghost sm trail-back" onClick={onExit} aria-label="Вернуться к играм">
          ← <span className="trail-back-text">Игры</span>
        </button>
        <div className="trail-head-body">
          <h2 className="trail-title">🗺️ Тропа слов</h2>
          <p className="trail-sub">
            {summary.allDone
              ? 'Все остановки позади'
              : `Остановка ${stopNumber} из ${summary.totalStops} · «${stop.title}»`}
          </p>
        </div>
        <span className="trail-count" aria-label={`Пройдено остановок: ${summary.doneStops} из ${summary.totalStops}`}>
          {summary.doneStops}/{summary.totalStops}
        </span>
      </header>

      <div className="trail-body">
        <TrailScene
          stop={stop}
          total={sceneTotal}
          segments={sceneSegments}
          hiddenIndex={hiddenIndex}
          passed={passed}
          interactive={phase === 'walk'}
          wide={phase === 'syllables'}
          onStep={(index) => {
            if (!task || phase !== 'walk') return;
            const result = trailStep(walked, task.segments.length, index);
            if (result === 'again') {
              setMessage(`Сейчас — плита «${task.segments[walked]}».`);
              sfx.tap();
              haptic.tap();
              return;
            }
            if (result === 'done') return;
            const next = walked + 1;
            setWalked(next);
            setMessage(next >= task.segments.length ? 'Дошли до остановки!' : 'Шаг за шагом — дальше.');
            sfx.tap();
            haptic.tap();
            if (next >= task.segments.length) finishWord();
          }}
          note={sceneNote}
        />

        {phase === 'repair' && task && (
          <section className="trail-card" aria-label="Почини слово">
            <div className="trail-clue">
              <WordArt word={task.word} size={56} />
              <div className="trail-clue-body">
                <p className="clue-hint">💡 {task.word.hint}</p>
                <p className="tiny muted">Одна буква выпала — выбери её.</p>
              </div>
            </div>

            <div
              className="tl-options trail-options"
              role="group"
              aria-label="Выбери букву для шатающейся плиты"
              data-trail-answer={task.answer}
            >
              {task.options.map((letter) => {
                const gone = rejected.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    className={`tl-option${gone ? ' tl-option-gone' : ''}`}
                    data-tl-letter={letter}
                    disabled={gone}
                    aria-label={`Буква ${letter}`}
                    onClick={() => {
                      if (!task || phase !== 'repair') return;
                      if (letter === task.answer) {
                        setPhase('walk');
                        setWalked(0);
                        setMessage('Плита починена. Веди Буквёнка!');
                        sfx.correct();
                        haptic.correct();
                        return;
                      }
                      setWrong((n) => n + 1);
                      setRejected((list) => (list.includes(letter) ? list : [...list, letter]));
                      sfx.wrong();
                      haptic.tap();
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <div className="trail-hint" role="status">
              {hint === 'none' && (
                <p className="tiny muted">Ошибка ничего не отнимает — она откроет подсказку.</p>
              )}
              {hint === 'mnemonic' && task.word.mnemonic && <p className="tiny">🌟 {task.word.mnemonic}</p>}
              {(hint === 'sentence' || hint === 'revealed') && (
                <p className="tiny">{task.word.sentence.replace('____', '…')}</p>
              )}
              {hint === 'revealed' && (
                <p className="tiny">
                  Буква открыта: <b>{task.answer}</b>. Выбери её из оставшихся.
                </p>
              )}
            </div>
          </section>
        )}

        {phase === 'walk' && task && (
          <section className="trail-card trail-walk" aria-label="Веди Буквёнка по слову">
            <p className="trail-walk-line">
              Слово: <b>{task.word.text}</b>
            </p>
            <div className="trail-meter" aria-hidden="true">
              <i style={{ width: `${task.segments.length ? (walked / task.segments.length) * 100 : 0}%` }} />
            </div>
            <p className="tiny" role="status">
              {message || 'Тапни следующую плиту — и герой шагнёт.'}
            </p>
          </section>
        )}

        {phase === 'syllables' && board && (
          <section className="trail-card" aria-label="Выложи мост из слогов">
            <div className="trail-clue">
              <WordArt word={board.word} size={56} />
              <div className="trail-clue-body">
                <p className="clue-hint">💡 {board.word.hint}</p>
                <p className="tiny muted">Каждый слог — плита моста. Порядок важен.</p>
              </div>
            </div>

            <div
              className="trail-tray"
              role="group"
              aria-label="Слоги слова"
              data-trail-slots={board.slots.join('|')}
            >
              {board.tiles.map((tile) => {
                const used = usedIds.has(tile.id);
                const next = wrong >= 2 && !used && tile.text === board.slots[picked.length];
                return (
                  <button
                    key={tile.id}
                    type="button"
                    className={`trail-syllable${used ? ' trail-syllable-used' : ''}${next ? ' trail-syllable-next' : ''}`}
                    data-trail-tile={tile.text}
                    disabled={used}
                    onClick={() => {
                      if (!board || phase !== 'syllables' || used) return;
                      const expected = board.slots[picked.length];
                      if (tile.text !== expected) {
                        const nextWrong = wrong + 1;
                        setWrong(nextWrong);
                        setMessage(
                          nextWrong >= 2
                            ? `Следующий слог — «${expected}».`
                            : 'Порядок другой. Попробуй ещё — ничего не потеряно.',
                        );
                        sfx.wrong();
                        haptic.tap();
                        return;
                      }
                      const nextPicked = [...picked, tile];
                      setPicked(nextPicked);
                      setMessage(
                        nextPicked.length >= board.slots.length
                          ? 'Мост готов — Буквёнок переходит!'
                          : 'Мост растёт — дальше.',
                      );
                      sfx.tap();
                      haptic.tap();
                    }}
                  >
                    {tile.text}
                  </button>
                );
              })}
            </div>

            <p className="tiny" role="status">
              {message || 'Начни с первого слога — он стоит слева.'}
            </p>
          </section>
        )}

        {phase === 'word-done' && task && (
          <section className="trail-card trail-done" aria-label="Слово пройдено">
            <p className="trail-done-title">Слово на дороге!</p>
            <p className="trail-done-word">{task.word.text}</p>
            {award && award.xp > 0 && (
              <p className="tiny">
                <b>+{award.xp} ⚡</b> <span className="muted">· засчитано в задания дня</span>
              </p>
            )}
            <p className="tiny muted">{gameAwardHint(todayStat(profile).games ?? { xp: 0, correct: 0, words: 0 })}</p>
            <button type="button" className="btn primary wide" onClick={() => {
              const remaining = resume.stop?.wordIds.filter((id) => !progress.words.includes(id)) ?? [];
              if (remaining[0]) setWordId(remaining[0]);
              else setPhase(resume.allDone ? 'all-done' : 'stop-done');
            }}>
              Дальше →
            </button>
          </section>
        )}

        {(phase === 'stop-done' || phase === 'all-done') && (
          <section className="trail-card trail-done trail-postcard" data-trail-postcard aria-label="Остановка пройдена">
            <div className="trail-postcard-art" aria-hidden="true">{stop.emoji}</div>
            <p className="trail-done-title">
              {phase === 'all-done' ? 'Все остановки пройдены!' : `Остановка «${stop.title}» пройдена!`}
            </p>
            <p className="tiny">
              Открытка «{stop.title}» сохранена.
              {phase === 'all-done' && ' Буквёнок дошёл до конца тропы.'}
            </p>
            {award && award.xp > 0 && (
              <p className="tiny">
                <b>+{award.xp} ⚡</b> <span className="muted">· засчитано в задания дня</span>
              </p>
            )}
            <p className="tiny muted">{gameAwardHint(todayStat(profile).games ?? { xp: 0, correct: 0, words: 0 })}</p>
            {phase === 'all-done' ? (
              <button
                type="button"
                className="btn primary wide"
                onClick={() => {
                  const next = { ...EMPTY_TRAIL };
                  setProgress(next);
                  setTrail(next);
                  prevStop.current = 0;
                  const first = stops[0]?.wordIds[0] ?? null;
                  setWordId(first);
                  setPhase(first ? 'repair' : 'all-done');
                }}
              >
                Пройти тропу заново →
              </button>
            ) : (
              <button
                type="button"
                className="btn primary wide"
                onClick={() => {
                  if (!resume.stop) return;
                  const nextIndex = Math.min(resume.stopIndex + 1, stops.length);
                  const next = withTrailStop(progress, resume.stop.id, nextIndex);
                  setProgress(next);
                  setTrail(next);
                  if (nextIndex >= stops.length) {
                    setPhase('all-done');
                    return;
                  }
                  const first = stops[nextIndex].wordIds.find((id) => !next.words.includes(id)) ?? null;
                  setWordId(first);
                  if (!first) setPhase('stop-done');
                }}
              >
                Следующая остановка →
              </button>
            )}
            <button type="button" className="btn ghost wide" onClick={onExit}>
              К играм
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
