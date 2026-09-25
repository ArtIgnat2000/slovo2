import { useRef, useState } from 'react';
import type { Profile, Task, WordState } from '../../types';
import { LESSON_BY_ID, WORD_BY_ID, WORDS } from '../../content/words';
import { buildLesson, makeTask, repairTask, shuffle } from '../../engine/scheduler';
import { pickReview } from '../../engine/srs';
import { masteredCount, useActiveProfile, useApp } from '../../state/store';
import { CHEER, PRAISE, pick, useMascot } from '../../state/mascot';
import { TaskView } from '../TaskView';
import { Bar, Confetti, Stars } from '../Bits';
import { WordLetters } from '../WordView';
import { sfx } from '../../platform/sound';
import { haptic } from '../../platform/haptics';
import { XP, checkAchievements, starsFor } from '../../engine/rewards';

interface Props {
  lessonId: string;
  onExit: () => void;
}

interface Verdict {
  ok: boolean;
  wordId: string;
  hint: boolean;
}

interface Stats {
  correct: number;
  wrong: number;
  xp: number;
}

export function LessonScreen({ lessonId, onExit }: Props) {
  const lesson = LESSON_BY_ID[lessonId];
  const profile = useActiveProfile();
  const { touchDay, answer, addXp, finishLesson, grantAchievement } = useApp();
  const say = useMascot((s) => s.say);

  const stats = useRef<Stats>({ correct: 0, wrong: 0, xp: 0 });
  const started = useRef(false);
  const [queue, setQueue] = useState<Task[]>(() => buildQueue(profile, lessonId));
  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [done, setDone] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [xpShown, setXpShown] = useState(0);

  if (!started.current) {
    started.current = true;
    touchDay();
  }

  const task = queue[index];
  const total = queue.length;

  const onSolve = (quality: number | null) => {
    if (!task) return;
    if (quality === null) {
      setVerdict(null);
      goNext();
      return;
    }
    const ok = quality >= 3;
    answer(task.wordId, quality);

    if (ok) {
      const gain = quality >= 5 ? XP.task : XP.taskWithHint;
      addXp(gain);
      stats.current.correct += 1;
      stats.current.xp += gain;
      setXpShown((v) => v + gain);
      const st = streak + 1;
      setStreak(st);
      if (st > 0 && st % 3 === 0) {
        sfx.streak();
        say('excited', `Серия ${st}! Так держать!`);
      } else {
        say('happy', pick(PRAISE));
      }
    } else {
      stats.current.wrong += 1;
      setStreak(0);
      say('sad', pick(CHEER));
      // Ошибку обязательно отрабатываем: слово вернётся чуть позже в этом же уроке
      setQueue((q) => {
        // Повторную отработку добавляем один раз и не для заданий-исправлений
        if (task.reason === 'repair') return q;
        if (q.some((t, i) => i > index && t.wordId === task.wordId && t.reason === 'repair')) return q;
        const at = Math.min(index + 3, q.length);
        return [...q.slice(0, at), repairTask(task.wordId), ...q.slice(at)];
      });
    }

    setVerdict({ ok, wordId: task.wordId, hint: quality === 3 });
  };

  const goNext = () => {
    setVerdict(null);
    if (index + 1 >= queue.length) {
      finish();
      return;
    }
    setIndex(index + 1);
  };

  const finish = () => {
    const { correct, wrong } = stats.current;
    const answered = correct + wrong;
    const pct = answered === 0 ? 100 : Math.round((correct / answered) * 100);
    const stars = starsFor(correct, answered);
    finishLesson(lessonId, pct);
    const bonus = XP.lessonDone + (stars === 3 ? XP.perfectBonus : 0);
    addXp(bonus);
    stats.current.xp += bonus;
    setXpShown(stats.current.xp);
    sfx.finish(stars);
    haptic.finish();
    if (stars === 3) {
      setConfetti(true);
      say('dance', 'Идеально! Три звезды!');
    } else if (stars > 0) {
      say('happy', 'Урок пройден!');
    } else {
      say('think', 'Попробуем ещё раз?');
    }

    if (profile) {
      const ctx = {
        streak: profile.streak,
        xp: profile.xp + stats.current.xp,
        mastered: masteredCount(profile),
        lessonsDone: Object.values(profile.lessons).reduce((a, l) => a + l.plays, 0) + 1,
        perfectLessons:
          Object.values(profile.lessons).filter((l) => l.best >= 100).length + (stars === 3 ? 1 : 0),
        wordsTrained: Object.keys(profile.words).length,
      };
      checkAchievements(ctx, profile.achievements).forEach(grantAchievement);
    }
    setDone(true);
  };

  if (done) {
    return (
      <>
        <Confetti show={confetti} />
        <Results correct={stats.current.correct} wrong={stats.current.wrong} xp={xpShown} onHome={onExit} />
      </>
    );
  }

  if (!task) {
    return (
      <div className="screen center">
        <div className="big-emoji">🎉</div>
        <h1>Повторять нечего!</h1>
        <p className="muted">Все слова ещё свежи в памяти — загляни завтра.</p>
        <button className="btn primary wide lg" onClick={onExit}>
          К урокам 🗺️
        </button>
      </div>
    );
  }
  const word = WORD_BY_ID[task.wordId];
  const progress = Math.min(100, ((index + (verdict ? 1 : 0)) / total) * 100);

  return (
    <div className="screen" style={{ paddingBottom: verdict ? '230px' : '110px' }}>
      <div className="row mb">
        <button className="chip" onClick={onExit} aria-label="Выйти">
          ✕
        </button>
        <div className="grow">
          <Bar value={progress} tone="green" />
        </div>
        <div className="stat-pill">
          {index + 1}/{total}
        </div>
        {streak > 1 && <div className="stat-pill fire">🔥 {streak}</div>}
      </div>

      <div className="tiny center mb">
        {lesson.emoji} {lesson.title}
      </div>

      <TaskView key={task.uid} task={task} word={word} onSolve={onSolve} />

      {verdict && (
        <div className={`footer-bar ${verdict.ok ? 'ok' : 'bad'}`}>
          <div className="footer-inner">
            <div className="grow">
              <div className="verdict">
                {verdict.ok ? (verdict.hint ? '✓ Верно, но с подсказкой' : '✓ Правильно!') : '✗ Ошибка'}
                {!verdict.ok && (
                  <small>
                    Правильно: <b>{word.text}</b>
                  </small>
                )}
              </div>
              {!verdict.ok && (
                <div style={{ marginTop: 10 }}>
                  <WordLetters word={word} stress markDanger small />
                </div>
              )}
              {!verdict.ok && word.mnemonic && <div className="tiny">💡 {word.mnemonic}</div>}
            </div>
            <button className="btn primary" onClick={goNext}>
              Далее ▸
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Results({
  correct,
  wrong,
  xp,
  onHome,
}: {
  correct: number;
  wrong: number;
  xp: number;
  onHome: () => void;
}) {
  const answered = correct + wrong;
  const stars = starsFor(correct, answered);
  const profile = useActiveProfile();
  return (
    <div className="screen center">
      <div className="col">
        <div className="big-emoji">{stars === 3 ? '🏆' : stars > 0 ? '🎉' : '💪'}</div>
        <h1>{stars === 3 ? 'Блестяще!' : stars === 2 ? 'Хорошо!' : stars === 1 ? 'Неплохо!' : 'Продолжай!'}</h1>
        <Stars n={stars} />
        <div className="card">
          <div className="kv">
            <span>Правильно</span>
            <b>
              {correct} из {answered}
            </b>
          </div>
          <div className="kv">
            <span>Опыт за урок</span>
            <b>⚡ +{xp}</b>
          </div>
          {profile && wrong > 0 && (
            <div className="kv">
              <span>Вернёмся к ним завтра</span>
              <b>{wrong} слов</b>
            </div>
          )}
        </div>
        <button className="btn primary wide lg" onClick={onHome}>
          К урокам 🗺️
        </button>
      </div>
    </div>
  );
}

// ── Формирование очереди заданий ────────────────────────────────────────────

function buildQueue(profile: Profile | null, lessonId: string): Task[] {
  const lesson = LESSON_BY_ID[lessonId];
  const states: Record<string, WordState> = profile?.words ?? {};
  const level = profile?.lessons?.[lessonId]?.level ?? 0;

  if (lessonId === 'review') {
    const due = pickReview(WORDS, states, new Set(), 8);
    return due.flatMap((w, i) => [
      makeReviewTask(i % 2 === 0 ? 'write' : 'fix', w.id),
      makeReviewTask('syllables', w.id),
    ]);
  }

  const exclude = new Set(lesson.wordIds);
  const review = pickReview(WORDS, states, exclude, 3);
  const tasks = buildLesson({ lesson, level, states, reviewWords: review });
  // Знакомство держим в начале — это первое, что видит ребёнок; повторение — в конце
  const intro = tasks.filter((t) => t.kind === 'intro');
  const rest = shuffle(tasks.filter((t) => t.kind !== 'intro' && t.reason !== 'review'));
  const rev = tasks.filter((t) => t.reason === 'review');
  return [...intro, ...rest, ...rev];
}

function makeReviewTask(kind: 'write' | 'fix' | 'syllables', wordId: string): Task {
  const w = WORD_BY_ID[wordId];
  return makeTask(kind, wordId, 'review', w.danger[0] ?? 0);
}
