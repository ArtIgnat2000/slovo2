import { effectiveCards, recordAttempt, type Attempts } from '../../engine/adaptive';
import { scheduleWordImages } from '../../platform/word-images';
import { useEffect, useRef, useState } from 'react';
import type { Profile, Task, WordState } from '../../types';
import { LESSON_BY_ID, LESSONS, REVIEW, WORD_BY_ID, WORDS } from '../../content/words';
import { buildLesson, DEFAULT_LESSON_SIZE, lessonCardLimit, makeTask, pickDanger, repairTask, shuffle } from '../../engine/scheduler';
import { pickReview, pickReviewWords } from '../../engine/srs';
import { dayKey, dayPlan, masteredCount, todayStat, useActiveProfile, useApp } from '../../state/store';
import { claimableQuests, dayMetrics, plural, questId } from '../../engine/quests';
import { CHEER, PRAISE, pick, useMascot } from '../../state/mascot';
import { FloatingMascot } from '../FloatingMascot';
import { TaskView } from '../TaskView';
import { Bar, Confetti, ConfirmDialog, Ring, Stars } from '../Bits';
import { WordLetters } from '../WordView';
import { sfx } from '../../platform/sound';
import { haptic } from '../../platform/haptics';
import { XP, checkAchievements, starsFor } from '../../engine/rewards';
import { COSTUME_BY_ID, PUZZLE_SIZE, type PuzzleAward } from '../../engine/puzzles';
import { Mascot } from '../Mascot';
import { BukHelpOwl, BukHelpPanel, BukVerdictLine } from '../BukHelper';
import {
  adjustQuality,
  helperAfterAnswer,
  helperQuestion,
  helperReveal,
  shouldNudge,
  type HelpStage,
} from '../../state/bukHelp';

interface Props {
  lessonId: string;
  onExit: () => void;
  /**
   * Цель дня, зафиксированная на момент входа в урок. Взрослый может поменять
   * её в разделе «Родителям» прямо посреди урока — тогда экран результатов
   * сравнивал бы урок с новой целью. Чтобы этого не было, держим снимок.
   */
  goal: number;
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

export function LessonScreen({ lessonId, onExit, goal }: Props) {
  const lesson = LESSON_BY_ID[lessonId];
  const profile = useActiveProfile();
  // Действия стора берём без подписки на всё состояние (ссылки стабильны):
  // подписка на весь стор заставляла бы урок перерисовываться на каждый чих.
  const { touchDay, answer, addXp, finishLesson, finishPuzzleLesson, grantAchievement } = useApp.getState();
  const say = useMascot((s) => s.say);

  const attempts = useRef<Attempts>({ total: 0, independent: 0 });
  const observed = useRef(new Set<string>());
  const solvedTasks = useRef(new Set<string>());
  const finalized = useRef(false);
  const runProfile = useRef(profile?.id).current;
  const ceiling = useRef(lessonCardLimit(profile?.lessonSize)).current;
  const finalizeAdaptive = (kind: 'finish' | 'quit') => {
    if (finalized.current) return;
    finalized.current = true;
    if (lessonId !== REVIEW.id && runProfile) useApp.getState().adaptLesson(runProfile, ceiling,
      kind === 'quit' ? { kind } : { kind, attempts: attempts.current });
  };
  const stats = useRef<Stats>({ correct: 0, wrong: 0, xp: 0 });
  const started = useRef(false);
  const [queue, setQueue] = useState<Task[]>(() => buildQueue(profile, lessonId));
  // Число заданий в исходном плане урока. Задания-отработки после ошибок
  // вставляются в очередь и раньше «раздували» total — полоска прогресса ехала назад.
  const baseTotal = useRef(queue.length).current;
  // XP за сегодня до начала урока: чтобы на результатах показать, сколько дал
  // именно этот урок, и как он продвинул цель дня.
  const xpBefore = useRef(todayStat(profile).xp).current;
  // Снимок «что уже можно забрать» до урока — чтобы в конце похвалить только за новое
  const claimableBefore = useRef(claimableToday(profile)).current;
  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [done, setDone] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [xpShown, setXpShown] = useState(0);
  const [askExit, setAskExit] = useState(false);
  // Иток пазла за этот прогон урока — карточка на экране результатов.
  const [puzzleAward, setPuzzleAward] = useState<PuzzleAward | null>(null);

  // ── Помощник БУК (docs/buk-in-lesson.md) ──────────────────────────────────
  // Настройка: глобальное «Сова БУК: не показывать» сильнее урока — если совы
  // нет в приложении, помощника в уроке тоже нет.
  const lessonHelp = useApp((st) => st.settings.lessonHelp);
  const mascotOff = useApp((st) => st.settings.mascot === 'off');
  const helpMode = mascotOff ? 'off' : lessonHelp;
  const [helpStage, setHelpStage] = useState<HelpStage>(0);
  const [nudge, setNudge] = useState(false);
  /** Отказ («Я сам») действует до конца урока: больше не предлагаем. */
  const refused = useRef(false);
  /** На этой карточке предложение уже было — второго не будет. */
  const nudgedOnCard = useRef(false);
  /** Последнее действие ребёнка: от него считаем паузу. */
  const lastActivity = useRef(Date.now());
  /** С какой ступенью помощи отвечали — для строчки в вердикте. */
  const usedHelp = useRef<HelpStage>(0);
  const helpStageRef = useRef<HelpStage>(0);
  helpStageRef.current = helpStage;
  const screenRef = useRef<HTMLDivElement>(null);

  // Отмечаем «сегодня занимались» только при первом реальном действии в уроке,
  // чтобы случайный вход в урок и мгновенное нажатие ✕ не тратили заморозку
  // и не продлевали серию дней без единого ответа.
  const ensureTouchedToday = () => {
    if (started.current) return;
    started.current = true;
    touchDay();
  };

  const task = queue[index];
  const total = baseTotal;

  /**
   * Помощь не должна притворяться самостоятельным ответом: качество считаем
   * один раз здесь, в одном месте, а не в каждом задании (`TaskView` не тронут).
   */
  const withHelp = (quality: number | null): number | null => {
    usedHelp.current = helpStageRef.current;
    return adjustQuality(quality, helpStageRef.current);
  };

  // Новая карточка — чистое состояние помощи; отказ живёт до конца урока.
  useEffect(() => {
    setHelpStage(0);
    setNudge(false);
    nudgedOnCard.current = false;
    usedHelp.current = 0;
    lastActivity.current = Date.now();
  }, [task?.uid]);

  // Панель уступает место вердикту: там уже есть что читать и куда нажимать.
  useEffect(() => {
    if (verdict) {
      setHelpStage(0);
      setNudge(false);
    }
  }, [verdict]);

  // Любое действие в уроке — это «не застрял»: пауза отсчитывается заново.
  useEffect(() => {
    const el = screenRef.current;
    if (!el || helpMode === 'off') return;
    const touch = () => {
      lastActivity.current = Date.now();
      setNudge(false);
    };
    el.addEventListener('pointerdown', touch);
    el.addEventListener('keydown', touch);
    el.addEventListener('input', touch);
    return () => {
      el.removeEventListener('pointerdown', touch);
      el.removeEventListener('keydown', touch);
      el.removeEventListener('input', touch);
    };
  }, [helpMode, task?.uid]);

  /**
   * Тихая пауза: 20 с без действий и БУК в шапке предлагает помощь (без звука).
   * Один раз на карточку, не на экране вердикта, не после отказа.
   */
  useEffect(() => {
    if (helpMode === 'off' || !task || done || verdict) return;
    const t = setInterval(() => {
      if (!task) return;
      const show = shouldNudge({
        kind: task.kind,
        idleMs: Date.now() - lastActivity.current,
        refused: refused.current,
        panelOpen: helpStageRef.current > 0,
        hasVerdict: false,
        shownOnCard: nudgedOnCard.current,
      });
      if (show) {
        nudgedOnCard.current = true;
        lastActivity.current = Date.now();
        setNudge(true);
      }
    }, 700);
    return () => clearInterval(t);
  }, [helpMode, task, done, verdict]);

  // Пузырь «Подсказать?» не висит вечно: не заинтересовался — исчез.
  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(false), 9000);
    return () => clearTimeout(t);
  }, [nudge]);

  const openHelp = () => {
    setNudge(false);
    // «Сразу буква» — режим для тех, кого вопросы раздражают (настройка родителя).
    setHelpStage(helpMode === 'direct' ? 2 : 1);
  };
  const dismissHelp = () => {
    setHelpStage(0);
    refused.current = true;
  };
  useEffect(() => {
    if (done) return;
    // Look ahead only a few cards, including dynamically inserted repair tasks.
    return scheduleWordImages(queue.slice(index + 1, index + 4).map((t) => WORD_BY_ID[t.wordId]));
  }, [queue, index, done]);

  /** Выход из урока: если ещё ничего не отвечено — терять нечего, выходим сразу. */
  const tryExit = () => {
    if (attempts.current.total > 0 || stats.current.correct + stats.current.wrong > 0) setAskExit(true);
    else onExit();
  };

  const onSolve = (rawQuality: number | null) => {
    if (!task || finalized.current || solvedTasks.current.has(task.uid)) return;
    solvedTasks.current.add(task.uid);
    ensureTouchedToday();
    const quality = withHelp(rawQuality);
    if (quality !== null) recordAttempt(observed.current, attempts.current, task.uid, task.reason === 'repair', quality);
    if (quality === null) {
      setVerdict(null);
      goNext();
      return;
    }
    const ok = quality >= 3;
    // Повторёнными считаем и слова из режима «Повторение», и вставки-повторения
    // внутри обычного урока: задание дня — «повтори N слов», где бы это ни случилось
    answer(task.wordId, quality, lessonId === REVIEW.id || task.reason === 'review');

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
    if (finalized.current) return;
    ensureTouchedToday();
    finalizeAdaptive('finish');
    const { correct, wrong } = stats.current;
    const answered = correct + wrong;
    const pct = answered === 0 ? 100 : Math.round((correct / answered) * 100);
    const stars = starsFor(correct, answered);
    // «Повторение» — тренировка, а не урок: короны и счётчик уроков оно не наращивает
    if (lessonId !== REVIEW.id) {
      finishLesson(lessonId, pct);
      const pz = finishPuzzleLesson();
      setPuzzleAward(pz);
      if (pz?.event === 'assembled') {
        setConfetti(true);
        say('dance', `Пазл собран — костюм «${COSTUME_BY_ID[pz.costumeId ?? '']?.title ?? ''}»! 🎭`);
      } else if (pz?.event === 'gems') {
        say('happy', 'Коллекция костюмов собрана — держи кристаллы!');
      }
    }
    const bonus = XP.lessonDone + (stars === 3 ? XP.perfectBonus : 0);
    addXp(bonus);
    stats.current.xp += bonus;
    setXpShown(stats.current.xp);
    sfx.finish(stars);
    haptic.finish();
    // Цель дня, закрытая именно этим уроком, — отдельный повод для праздника
    const goalClosedNow = xpBefore < goal && xpBefore + stats.current.xp >= goal;
    if (goalClosedNow) {
      setConfetti(true);
      say('dance', 'Цель дня закрыта! 🎉');
    } else if (stars === 3) {
      setConfetti(true);
      say('dance', 'Идеально! Три звезды!');
    } else if (stars > 0) {
      say('happy', 'Урок пройден!');
    } else {
      say('think', 'Попробуем ещё раз?');
    }

    const fresh = useApp.getState().profiles.find((p) => p.id === profile?.id) ?? profile;
    if (fresh) {
      const ctx = {
        streak: fresh.streak,
        xp: fresh.xp,
        mastered: masteredCount(fresh),
        lessonsDone: Object.values(fresh.lessons).reduce((a, l) => a + l.plays, 0),
        perfectLessons: Object.values(fresh.lessons).filter((l) => l.best >= 100).length,
        wordsTrained: Object.keys(fresh.words).length,
      };
      checkAchievements(ctx, fresh.achievements).forEach(grantAchievement);
    }
    // Задания дня могли закрыться прямо этим уроком — зовём забрать награду
    const after = claimableToday(useApp.getState().profiles.find((p) => p.id === profile?.id) ?? null);
    if (after.length > claimableBefore.length) {
      useApp.getState().showToast({
        emoji: '💎',
        title: after.length > 1 ? 'Выполнено заданий дня: ' + after.length : 'Задание дня выполнено!',
        text: 'Забери награду на главной',
      });
    }
    setDone(true);
  };

  if (done) {
    return (
      <>
        <Confetti show={confetti} />
        <Results
          lessonId={lessonId}
          correct={stats.current.correct}
          wrong={stats.current.wrong}
          xp={xpShown}
          goal={goal}
          xpBefore={xpBefore}
          puzzle={puzzleAward}
          onHome={onExit}
        />
        <FloatingMascot />
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
  // Прогресс — от исходного плана и только вперёд (отработки ошибок не откатывают полоску)
  const stepsDone = Math.min(index + (verdict ? 1 : 0), total);
  const progress = (stepsDone / Math.max(1, total)) * 100;
  const bukVerdictLine = verdict
    ? helperAfterAnswer({
        ok: verdict.ok,
        // usedHelp сохраняет ступень, с которой отвечали: helpStage к моменту
        // вердикта уже сброшен (панель уступает место вердикту).
        stage: verdict.hint && usedHelp.current === 0 ? 2 : usedHelp.current,
        streak,
        reason: task.reason,
      })
    : null;

  return (
    <div ref={screenRef} className="screen" style={{ paddingBottom: verdict ? '230px' : '110px' }}>
      <div className="row mb">
        <button
          className="lesson-exit"
          type="button"
          onClick={tryExit}
          onTouchEnd={(e) => {
            // Android Chrome иногда не шлёт click при быстром тапе на маленькую цель —
            // дублируем выход и на touchEnd (preventDefault не даёт повторного click)
            e.preventDefault();
            tryExit();
          }}
          aria-label="Выйти из урока"
        >
          ✕
        </button>
        <div className="grow">
          <Bar value={progress} tone="green" />
        </div>
        {/* В шапке не больше двух «пилюль»: счётчик и серия. На отработке ошибки
            счётчик уступает место пометке «🔧 ещё раз» — она важнее в этот момент. */}
        {task.reason === 'repair' ? (
          <div className="stat-pill repair">🔧 ещё раз</div>
        ) : (
          <div className="stat-pill tasks">
            {Math.min(index + 1, total)}/{total}
          </div>
        )}
        {streak > 1 && <div className="stat-pill fire">🔥 {streak}</div>}
        {helpMode !== 'off' && (
          <BukHelpOwl open={helpStage > 0} nudge={nudge} onOpen={openHelp} />
        )}
      </div>

      <div className="tiny center mb">
        {lesson.emoji} {lesson.title}
      </div>

      {helpMode !== 'off' && helpStage > 0 && (
        <BukHelpPanel
          stage={helpStage === 2 ? 2 : 1}
          text={helpStage === 2 ? helperReveal(word) : helperQuestion(task.kind, word)}
          onReveal={() => setHelpStage(2)}
          onDismiss={dismissHelp}
        />
      )}

      <TaskView key={task.uid} task={task} word={word} onSolve={onSolve} onAttempt={(quality) => {
        if (!finalized.current) {
          ensureTouchedToday();
          recordAttempt(observed.current, attempts.current, task.uid, task.reason === 'repair', withHelp(quality) ?? 0);
        }
      }} />

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
              {helpMode !== 'off' && bukVerdictLine && <BukVerdictLine text={bukVerdictLine} />}
            </div>
            <button className="btn primary" onClick={goNext}>
              Далее ▸
            </button>
          </div>
        </div>
      )}

      {askExit && (
        <ConfirmDialog
          emoji="🚪"
          title="Выйти из урока?"
          text="Задания начнутся заново, а звёзды за урок не достанутся. Опыт и повторения уже сохранены."
          stayLabel="Продолжить урок ▶"
          leaveLabel="Выйти"
          onStay={() => setAskExit(false)}
          onLeave={() => { finalizeAdaptive('quit'); onExit(); }}
        />
      )}
    </div>
  );
}

/**
 * Экран результатов урока. Главное здесь — связать финиш с целью дня:
 * раньше ребёнок видел только «⚡ +50» и не понимал, что это значит.
 * Теперь рядом то же кольцо цели, что и на главной (единый «язык прогресса»),
 * крупно — XP за сегодня, мелко — «цель 120», перебор — бейджем (см. п. 3 плана).
 */
function Results({
  lessonId,
  correct,
  wrong,
  xp,
  goal,
  xpBefore,
  puzzle,
  onHome,
}: {
  lessonId: string;
  correct: number;
  wrong: number;
  xp: number;
  goal: number;
  xpBefore: number;
  /** Иток костюмного пазла этого урока (engine/puzzles.ts); null — не за что (повторение). */
  puzzle?: PuzzleAward | null;
  onHome: () => void;
}) {
  const [puzzleOpen, setPuzzleOpen] = useState(true);
  const answered = correct + wrong;
  const stars = starsFor(correct, answered);
  const profile = useActiveProfile();
  const lesson = LESSON_BY_ID[lessonId];
  const isReview = lessonId === REVIEW.id;

  // XP за сегодня берём из профиля: туда уже попали и задания, и бонус за урок.
  const xpToday = profile ? todayStat(profile).xp : xpBefore + xp;
  const goalDone = xpToday >= goal;
  const over = Math.max(0, xpToday - goal);
  const gained = xpToday - xpBefore;
  const beforePct = Math.min(100, (xpBefore / Math.max(1, goal)) * 100);
  const afterPct = Math.min(100, (xpToday / Math.max(1, goal)) * 100);
  // Цель закрылась именно этим уроком? Это отдельный повод для праздника.
  const closedNow = goalDone && xpBefore < goal;

  return (
    <div className="screen center">
      <div className="col">
        <div className="big-emoji">{closedNow || stars === 3 ? '🏆' : stars > 0 ? '🎉' : '💪'}</div>
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
          {puzzle && (
            <div className="kv">
              <span>{puzzle.event === 'gems' ? 'Коллекция собрана ✨' : puzzle.event === 'assembled' ? 'Пазл собран 🧩' : 'Фрагмент пазла 🧩'}</span>
              <b>
                {puzzle.event === 'piece'
                  ? `${puzzle.pieces} из ${PUZZLE_SIZE}`
                  : puzzle.event === 'assembled'
                    ? `«${COSTUME_BY_ID[puzzle.costumeId ?? '']?.title}»`
                    : `+${puzzle.gems} 💎`}
              </b>
            </div>
          )}
          {puzzle?.event === 'piece' && (
            <div className="tiny" style={{ textAlign: 'center', marginTop: 2 }}>
              ещё {PUZZLE_SIZE - puzzle.pieces} {plural(PUZZLE_SIZE - puzzle.pieces, 'урок', 'урока', 'уроков')} — и костюм наденет БУК
            </div>
          )}
          {profile && wrong > 0 && (
            <div className="kv">
              <span>Вернёмся к ним завтра</span>
              <b>
                {wrong} {plural(wrong, 'слово', 'слова', 'слов')}
              </b>
            </div>
          )}
        </div>

        {puzzle?.event === 'assembled' && puzzleOpen && (
          <div className="card puzzle-win">
            <div className="row" style={{ alignItems: 'center', gap: 10, textAlign: 'left' }}>
              <Mascot mood="dance" costumeId={puzzle.costumeId} size={92} />
              <div className="grow">
                <h3 style={{ margin: '0 0 4px' }}>🎭 «{COSTUME_BY_ID[puzzle.costumeId ?? '']?.title}» надет!</h3>
                <p className="tiny muted" style={{ margin: 0 }}>
                  {COSTUME_BY_ID[puzzle.costumeId ?? '']?.desc} БУК носит его на главной и в магазине.
                </p>
              </div>
            </div>
            <div className="pz-dots" aria-hidden="true">
              {Array.from({ length: PUZZLE_SIZE }, (_, i) => (
                <i key={i} className="pz-dot on" />
              ))}
            </div>
            <button
              className="btn primary wide"
              onClick={() => {
                sfx.tap();
                setPuzzleOpen(false);
              }}
            >
              Здорово!
            </button>
          </div>
        )}

        <div className="card">
          <div className="row" style={{ textAlign: 'left' }}>
            <Ring value={afterPct} main={String(xpToday)} sub={`цель ${goal}`} done={goalDone} />
            <div className="grow">
              <h3 style={{ marginBottom: 2 }}>Цель дня</h3>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                <p className="muted" style={{ margin: 0 }}>
                  {closedNow
                    ? '🎉 Цель дня закрыта!'
                    : goalDone
                      ? 'Цель уже была закрыта — а ты принёс ещё! 🎉'
                      : `Ещё ${goal - xpToday} XP до цели дня`}
                </p>
                {over > 0 && <span className="goal-over">+{over} сверх цели</span>}
              </div>
              {/* Полоска — как на главной; метка показывает, где было начало урока */}
              <div className="goal-track">
                <Bar value={afterPct} tone="green" />
                {xpBefore > 0 && !goalDone && (
                  <i className="goal-mark" style={{ left: `${beforePct}%` }} aria-hidden="true" />
                )}
              </div>
              <div className="tiny" style={{ marginTop: 4 }}>
                {gained > 0 ? (
                  <>
                    {isReview ? 'Тренировка дала ' : 'Урок принёс '}
                    <b>+{gained} XP</b>
                    {xpBefore > 0 && <> · сегодня было уже {xpBefore} XP</>}
                  </>
                ) : (
                  <>Прогресс есть — слова стали крепче в памяти 💪</>
                )}
              </div>
            </div>
          </div>

          <button className="btn green wide lg mt" onClick={onHome}>
            К урокам 🗺️
          </button>
          <div className="tiny" style={{ marginTop: 8 }}>
            {lesson.emoji} {lesson.title}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Сколько заданий дня сейчас можно забрать (для «выполнено именно сейчас»). */
function claimableToday(profile: Profile | null): string[] {
  if (!profile) return [];
  const day = dayKey();
  const claimed = profile.daily && profile.daily.day === day ? profile.daily.claimed : [];
  return claimableQuests(dayPlan(profile), dayMetrics(profile.days[day]), claimed, day).map((q) =>
    questId(day, q.spec.kind),
  );
}

// ── Формирование очереди заданий ────────────────────────────────────────────

function buildQueue(profile: Profile | null, lessonId: string): Task[] {
  const lesson = LESSON_BY_ID[lessonId];
  const states: Record<string, WordState> = profile?.words ?? {};
  const level = profile?.lessons?.[lessonId]?.level ?? 0;
  const maxCards = effectiveCards(profile?.adaptiveCards, lessonCardLimit(profile?.lessonSize ?? DEFAULT_LESSON_SIZE));

  if (lessonId === REVIEW.id) {
    // Слова берём тем же правилом, что и блок «Пора повторить» на главной: иначе блок
    // обещал одни слова, а урок показывал «Повторять нечего!». Если повторять по срокам
    // нечего — тренируем самые слабые пройденные слова, чтобы задание дня было выполнимо.
    const limit = Math.min(8, Math.max(1, Math.floor(maxCards / 2)));
    const pick = pickReviewWords(
      WORDS,
      states,
      new Set(),
      limit,
      new Set(profile?.days?.[dayKey()]?.reviewWords ?? []),
    );
    return pick.words.flatMap((w, i) => [
      makeReviewTask(i % 2 === 0 ? 'write' : 'fix', w.id),
      makeReviewTask('syllables', w.id),
    ]);
  }

  // Не подмешиваем в повторение слова текущего урока (и открытого «следующего»):
  // ребёнок ещё не прошёл их, а повторение должно быть про старое
  const current = LESSONS.find((l) => (profile?.lessons[l.id]?.level ?? 0) < 5);
  const exclude = new Set([...lesson.wordIds, ...(current?.wordIds ?? [])]);
  const review = pickReview(WORDS, states, exclude, 3);
  const tasks = buildLesson({ lesson, level, states, reviewWords: review, maxCards });
  // Знакомство держим в начале — это первое, что видит ребёнок; повторение — в конце
  const intro = tasks.filter((t) => t.kind === 'intro');
  const rest = shuffle(tasks.filter((t) => t.kind !== 'intro' && t.reason !== 'review'));
  const rev = tasks.filter((t) => t.reason === 'review');
  return [...intro, ...rest, ...rev];
}

function makeReviewTask(kind: 'write' | 'fix' | 'syllables', wordId: string): Task {
  const w = WORD_BY_ID[wordId];
  // берём самую коварную опасную букву, а не первую в списке
  return makeTask(kind, wordId, 'review', pickDanger(w));
}
