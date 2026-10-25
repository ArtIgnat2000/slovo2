import { effectiveCards, recordAttempt, type Attempts } from '../../engine/adaptive';
import { scheduleWordImages } from '../../platform/word-images';
import { createStudySessionId, StudyClock } from '../../engine/study';
import { useEffect, useRef, useState } from 'react';
import type { ClassId, GradeLesson, Profile, Task, Word, WordState } from '../../types';
import {
  CLASS_META,
  LESSON_BY_ID,
  REVIEW,
  WORD_BY_ID,
  WORDS,
  LESSONS_BY_GRADE,
  availableClass,
} from '../../content/words';
import { classComplete, classProgress, nextClass } from '../../engine/classes';
import { buildLesson, DEFAULT_LESSON_SIZE, lessonCardLimit, lookupWith, makeTask, pickDanger, repairTask, shuffle, type WordLookup } from '../../engine/scheduler';
import { drillLimit, hardWords, listModeOf, listWords, MAX_LIST_WORDS } from '../../engine/word-lists';
import { pickReview, pickReviewWords } from '../../engine/srs';
import { dayKey, dayPlan, masteredCount, todayStat, useActiveProfile, useApp } from '../../state/store';
import { BONUS_CHEST_GEMS, claimableQuests, dayMetrics, plural, questId } from '../../engine/quests';
import { CHEER, PRAISE, pick, useMascot } from '../../state/mascot';
import { FloatingMascot } from '../FloatingMascot';
import { TaskView } from '../TaskView';
import { Bar, Confetti, ConfirmDialog, Ring, Stars } from '../Bits';
import { WordLetters } from '../WordView';
import { dangerSummary } from '../../engine/word-facts';
import { sfx } from '../../platform/sound';
import { setMusicContext } from '../../platform/music';
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
  /**
   * Переход в другой режим того же списка к контрольной (0.62.0):
   * «тренировать ошибки» и «пройти контрольную заново» прямо с результатов.
   */
  onStartList?: (listId: string, mode: 'train' | 'check' | 'errors') => void;
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

export function LessonScreen({ lessonId, onExit, goal, onStartList }: Props) {
  const profile = useActiveProfile();
  // Тренировка списка к контрольной (0.58.0): урока в программе нет, набор
  // слов берём из списка, а «урок» собираем на месте. Всё остальное —
  // обычный экран урока: те же задания, тот же прогресс по словам.
  const listMode = listModeOf(lessonId);
  const listId = listMode?.listId ?? null;
  const list = listId ? (profile?.lists ?? []).find((l) => l.id === listId) : undefined;
  /** Полный контроль (0.62.0): все слова по одному заданию, подсказки отключены. */
  const isCheck = listMode?.mode === 'check';
  /** Тренировка только по ошибкам последней контрольной. */
  const isErrors = listMode?.mode === 'errors';
  const lesson = list
    ? {
        id: lessonId,
        title: isCheck ? `Контрольная: ${list.title}` : isErrors ? `Ошибки: ${list.title}` : list.title,
        emoji: isCheck ? '📋' : isErrors ? '🔁' : '🏫',
        order: 0,
        wordIds: list.words,
      }
    : LESSON_BY_ID[lessonId];
  // Действия стора берём без подписки на всё состояние (ссылки стабильны):
  // подписка на весь стор заставляла бы урок перерисовываться на каждый чих.
  const { touchDay, answer, addXp, finishLesson, finishPuzzleLesson, grantAchievement } = useApp.getState();
  const say = useMascot((s) => s.say);

  const attempts = useRef<Attempts>({ total: 0, independent: 0 });
  const observed = useRef(new Set<string>());
  const solvedTasks = useRef(new Set<string>());
  /**
   * Результат по каждому слову (0.62.0): первая ошибка делает слово
   * «провальным» — именно так контрольная и оценивает. Используется в отчёте
   * в конце и для кнопки «тренировать ошибки».
   */
  const wordOk = useRef<Record<string, boolean>>({});
  /** Сколько разных слов уже спросили (для отчёта «12 из 26»). */
  const askedWords = useRef(new Set<string>());
  const finalized = useRef(false);
  const runProfile = useRef(profile?.id).current;
  const ceiling = useRef(lessonCardLimit(profile?.lessonSize)).current;
  const finalizeAdaptive = (kind: 'finish' | 'quit') => {
    if (finalized.current) return;
    finalized.current = true;
    if (lessonId !== REVIEW.id && !listId && runProfile) useApp.getState().adaptLesson(runProfile, ceiling,
      kind === 'quit' ? { kind } : { kind, attempts: attempts.current });
  };
  const stats = useRef<Stats>({ correct: 0, wrong: 0, xp: 0 });
  const started = useRef(false);
  const sessionId = useRef<string | null>(null);
  const studyClock = useRef<StudyClock | null>(null);
  if (!studyClock.current) {
    studyClock.current = new StudyClock(
      () => {
        if (!runProfile) return;
        const now = Date.now();
        const id = createStudySessionId(now);
        sessionId.current = id;
        useApp.getState().startStudySession({
          id,
          day: dayKey(),
          startedAt: now,
          activeSeconds: 0,
          mode: lessonId === REVIEW.id ? 'review' : 'lesson',
          ...(lessonId !== REVIEW.id ? { lessonId } : {}),
          tasks: 0,
          correct: 0,
          wrong: 0,
          errorWords: {},
          taskKindErrors: {},
          recoveredWords: [],
          lastActivityAt: now,
          status: 'active',
        });
      },
      (seconds) => {
        if (sessionId.current) useApp.getState().addStudyTime(sessionId.current, seconds);
      },
      (status) => {
        if (sessionId.current) useApp.getState().finishStudySession(sessionId.current, status);
      },
    );
  }
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
  // Сколько XP принесла именно эта карточка — показываем в полосе вердикта
  // рядом с «✓ Правильно!»: награда должна быть видна там, куда смотрит ребёнок.
  const [lastGain, setLastGain] = useState(0);
  // Иток пазла за этот прогон урока — карточка на экране результатов.
  const [puzzleAward, setPuzzleAward] = useState<PuzzleAward | null>(null);
  // Класс, который ребёнок закрыл именно этим уроком: на результатах появляется
  // карточка «2 класс пройден!» с переходом дальше (0.31.0). Считаем переход
  // «было → стало», а не «класс пройден сейчас»: иначе карточка висела бы на
  // каждом уроке уже пройденного класса.
  const [classWin, setClassWin] = useState<ClassId | null>(null);

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
  /** Обёртка отвеченного задания: её содержимое «замораживается» на вердикте. */
  const taskRef = useRef<HTMLDivElement>(null);

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

  /**
   * Музыка в уроке — фон, а не концерт. Пока ребёнок читает слово и подбирает
   * буквы, трек звучит медленнее (≤ 90 BPM) и без ярких ударных; на итоговом
   * экране возвращается полный грув — там и звучит «свой» тренд. Правила —
   * engine/music.ts:playbackFor, разбор — docs/music-trends-2026.md.
   */
  useEffect(() => {
    setMusicContext(done ? 'reward' : 'lesson');
  }, [done]);
  // На выходе из урока контекст возвращается: на главной и в магазине музыка играет целиком.
  useEffect(() => () => setMusicContext('reward'), []);

  /**
   * Отвеченное задание остаётся на экране до «Далее», но становится неживым:
   * тапы и фокус в него не попадают (`inert` + `pointer-events: none`),
   * скринридер читает только полосу вердикта. Раньше карточка в этот момент
   * просто исчезала, и ребёнок видел пустой экран — проверить себя было нечем.
   */
  useEffect(() => {
    const card = taskRef.current?.querySelector<HTMLElement>('.task');
    if (!card) return;
    if (!verdict) {
      card.removeAttribute('inert');
      card.removeAttribute('aria-hidden');
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    if (active && card.contains(active)) active.blur();
    card.setAttribute('inert', '');
    card.setAttribute('aria-hidden', 'true');
  }, [verdict, task?.uid]);

  /**
   * Enter/Пробел продолжают урок с вердикта — на планшете с клавиатурой и в
   * предпросмотре на компьютере это быстрее, чем целиться пальцем. Кнопка в
   * фокусе обрабатывает свои клавиши сама (иначе «Далее» срабатывала бы дважды).
   */
  useEffect(() => {
    if (!verdict || askExit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('button, input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [verdict, askExit, index, queue.length]);

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

  // Учёт активного времени: таймер запускается первым взаимодействием, а не
  // открытием урока. Фон и периоды бездействия не засчитываются. Статус
  // незавершённой сессии после перезапуска нормализуется как «прервана».
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const activity = () => studyClock.current?.activity();
    const pause = () => studyClock.current?.flush(true);
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') pause();
    };
    el.addEventListener('pointerdown', activity);
    el.addEventListener('keydown', activity);
    el.addEventListener('input', activity);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', pause);
    const checkpoint = window.setInterval(() => studyClock.current?.flush(), 15_000);
    return () => {
      el.removeEventListener('pointerdown', activity);
      el.removeEventListener('keydown', activity);
      el.removeEventListener('input', activity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', pause);
      window.clearInterval(checkpoint);
    };
  }, []);

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
    // Карточки берём через резолвер: у слов из списка к контрольной (0.61.0)
    // теперь свои картинки, и они тоже должны быть прогреты заранее.
    const lookup = lookupOf(profile);
    return scheduleWordImages(
      queue
        .slice(index + 1, index + 4)
        .map((t) => lookup(t.wordId))
        .filter((w): w is NonNullable<typeof w> => !!w),
    );
  }, [queue, index, done]);

  /** Выход из урока: если ещё ничего не отвечено — терять нечего, выходим сразу. */
  const tryExit = () => {
    if (attempts.current.total > 0 || stats.current.correct + stats.current.wrong > 0) setAskExit(true);
    else onExit();
  };

  const onSolve = (rawQuality: number | null) => {
    if (!task || finalized.current || solvedTasks.current.has(task.uid)) return;
    solvedTasks.current.add(task.uid);
    studyClock.current?.activity();
    ensureTouchedToday();
    const quality = withHelp(rawQuality);
    if (quality !== null) recordAttempt(observed.current, attempts.current, task.uid, task.reason === 'repair', quality);
    if (quality === null) {
      if (sessionId.current) useApp.getState().recordStudyTask(sessionId.current);
      setVerdict(null);
      goNext();
      return;
    }
    const ok = quality >= 3;
    // Полный контроль: слово считается верным, только если НИ РАЗУ не ошибся.
    if (listMode) {
      askedWords.current.add(task.wordId);
      wordOk.current[task.wordId] = (wordOk.current[task.wordId] ?? true) && ok;
    }
    // Повторёнными считаем и слова из режима «Повторение», и вставки-повторения
    // внутри обычного урока: задание дня — «повтори N слов», где бы это ни случилось
    answer(task.wordId, quality, lessonId === REVIEW.id || task.reason === 'review', sessionId.current ? {
      sessionId: sessionId.current,
      taskKind: task.kind,
      reason: task.reason,
    } : undefined);

    if (ok) {
      const gain = quality >= 5 ? XP.task : XP.taskWithHint;
      addXp(gain);
      stats.current.correct += 1;
      stats.current.xp += gain;
      setXpShown((v) => v + gain);
      setLastGain(gain);
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
      // Ошибку обязательно отрабатываем: слово вернётся чуть позже в этом же уроке.
      // В полном контроле отработки нет — он проверяет, а не учит (0.62.0),
      // поэтому там просто идём дальше по списку.
      if (!isCheck) {
        setQueue((q) => {
          // Повторную отработку добавляем один раз и не для заданий-исправлений
          if (task.reason === 'repair') return q;
          if (q.some((t, i) => i > index && t.wordId === task.wordId && t.reason === 'repair')) return q;
          const at = Math.min(index + 3, q.length);
          return [...q.slice(0, at), repairTask(task.wordId, lookupOf(profile)), ...q.slice(at)];
        });
      }
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
    let weeklyAwardGems = 0;
    // Класс урока и его состояние ДО начисления: последний урок программы
    // закрывает класс, и это нужно показать на результатах.
    const lessonGrade = (lesson as GradeLesson | undefined)?.grade ?? null;
    let classWasDone = true;
    if (lessonGrade) {
      const before = useApp.getState().profiles.find((p) => p.id === runProfile) ?? null;
      classWasDone = classComplete(before, lessonGrade);
    }
    studyClock.current?.finish('completed');
    ensureTouchedToday();
    finalizeAdaptive('finish');
    const { correct, wrong } = stats.current;
    const answered = correct + wrong;
    const pct = answered === 0 ? 100 : Math.round((correct / answered) * 100);
    const stars = starsFor(correct, answered);
    // «Повторение» и список к контрольной — тренировки, а не уроки программы:
    // короны, пазлы и счётчик уроков дня они не наращивают.
    // Список к контрольной: тренировка отмечает «когда занимались», полный
    // контроль сохраняет ещё и итог по словам — из него берутся «ошибки».
    if (listId) {
      const result = {
        total: askedWords.current.size,
        correct: Object.values(wordOk.current).filter(Boolean).length,
        wrong: Object.entries(wordOk.current)
          .filter(([, ok]) => !ok)
          .map(([id]) => id),
      };
      // 0.63.0: пишем заход в историю для ЛЮБОГО режима — иначе динамику
      // частичных тренировок видеть нельзя (раньше сохранялась только
      // полная контрольная).
      const runResult = {
        mode: (listMode?.mode ?? 'train') as 'train' | 'check' | 'errors',
        total: result.total,
        correct: result.correct,
        wrong: result.wrong,
        listSize: list?.words.length,
      };
      if (result.total > 0) useApp.getState().saveListRun(listId, runResult);
      else useApp.getState().touchList(listId);
    }
    if (lessonId !== REVIEW.id && !listId) {
      weeklyAwardGems = finishLesson(lessonId, pct).reduce((sum, reward) => sum + reward.gems, 0);
      const pz = finishPuzzleLesson();
      setPuzzleAward(pz);
      if (pz?.event === 'assembled') {
        setConfetti(true);
        say('dance', `Пазл собран — костюм «${COSTUME_BY_ID[pz.costumeId ?? '']?.title ?? ''}»! 🎭`);
      } else if (pz?.event === 'gems') {
        say('happy', 'Коллекция костюмов собрана — держи кристаллы!');
      }
    }
    let completedGrade: ClassId | null = null;
    if (lessonGrade && !classWasDone) {
      const after = useApp.getState().profiles.find((p) => p.id === runProfile) ?? null;
      if (classComplete(after, lessonGrade)) completedGrade = lessonGrade;
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
    if (completedGrade) {
      setConfetti(true);
      setClassWin(completedGrade);
      say('dance', `${CLASS_META[completedGrade].title} пройден! 🎉`);
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
    // После урока могут одновременно появиться сундук, награды недели и задания дня.
    const after = claimableToday(useApp.getState().profiles.find((p) => p.id === profile?.id) ?? null);
    const newQuestRewards = after.length > claimableBefore.length;
    const messages: string[] = [];
    if (lessonId !== REVIEW.id && !listId) messages.push(`На главной ждёт бонусный сундук: +${BONUS_CHEST_GEMS} 💎.`);
    if (newQuestRewards) messages.push('Награду за задания дня можно забрать на главной.');
    if (weeklyAwardGems > 0) messages.push(`Недельная награда уже начислена: +${weeklyAwardGems} 💎.`);
    if (messages.length) {
      useApp.getState().showToast({
        emoji: '💎',
        title:
          weeklyAwardGems > 0
            ? `Недельная награда +${weeklyAwardGems} 💎`
            : newQuestRewards
              ? after.length > 1 ? `Выполнено заданий дня: ${after.length}` : 'Задание дня выполнено!'
              : 'Бонусный сундук готов',
        text: messages.join(' '),
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
          listTitle={list ? lesson.title : undefined}
          isCheck={isCheck}
          check={list?.lastCheck ?? (listId ? {
            at: Date.now(),
            total: askedWords.current.size,
            correct: Object.values(wordOk.current).filter(Boolean).length,
            wrong: Object.entries(wordOk.current).filter(([, ok]) => !ok).map(([id]) => id),
          } : undefined)}
          checkedWords={list ? listWords(list, profile?.customWords ?? {}) : []}
          errorsCount={list?.lastCheck?.wrong.length ?? 0}
          onTrainErrors={() => {
            if (!listId || !onStartList) return;
            onStartList(listId, 'errors');
          }}
          onRestartCheck={() => {
            if (!listId || !onStartList) return;
            onStartList(listId, 'check');
          }}
          onTrainList={() => {
            if (!listId || !onStartList) return;
            onStartList(listId, 'train');
          }}
          previous={(() => {
            // 0.63.0: сравниваем с предыдущим заходом ТОГО ЖЕ режима —
            // «было 4 из 6 → стало 6 из 6» понятнее звёзд.
            if (!list) return undefined;
            const sameMode = (list.runs ?? []).slice(0, -1).filter((r) => r.mode === (listMode?.mode ?? 'train'));
            const prev = sameMode[sameMode.length - 1];
            return prev ? { at: prev.at, total: prev.total, correct: prev.correct } : undefined;
          })()}
          correct={stats.current.correct}
          wrong={stats.current.wrong}
          xp={xpShown}
          goal={goal}
          xpBefore={xpBefore}
          puzzle={puzzleAward}
          classWin={classWin}
          onNextClass={() => {
            if (!classWin) return;
            const next = nextClass(classWin);
            if (next) useApp.getState().setActiveClass(next);
            onExit();
          }}
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
  // Карточка слова: банк или своё слово списка к контрольной (0.58.0).
  const word = lookupOf(profile)(task.wordId) ?? WORD_BY_ID[task.wordId];
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
    <div
      ref={screenRef}
      // Полный контроль: подсказки отключены (класс прячет кнопки «Подсказка»
      // и баннеры «опасных букв»). См. .lesson-check в app.css.
      className={`screen lesson-screen ${verdict ? 'has-verdict' : ''}${isCheck ? ' lesson-check' : ''}`}
      // id урока в разметке: по нему смоук проверяет, что открылся урок своего
      // класса, не разбирая карточку (тип задания зависит от случайной перестановки).
      data-lesson-id={lesson.id}
    >
      <div className="row mb lesson-header">
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

      <span className="sr-only">{lesson.emoji} {lesson.title}</span>

      {helpMode !== 'off' && helpStage > 0 && (
        <BukHelpPanel
          stage={helpStage === 2 ? 2 : 1}
          text={helpStage === 2 ? helperReveal(word) : helperQuestion(task.kind, word)}
          onReveal={() => setHelpStage(2)}
          onDismiss={dismissHelp}
        />
      )}

      {/* Отвеченное задание остаётся на экране под полосой вердикта: пауза после
          ответа нужна для самопроверки («сравни с образцом»), а не для того,
          чтобы показать пустое поле. На вердикте карточка заморожена — см.
          `.lesson-task.is-frozen`, состояние внутри неё не сбрасывается, так что
          ребёнок видит свой ответ и подсветку «верно/неверно». */}
      <div ref={taskRef} className={`lesson-task ${verdict ? 'is-frozen' : ''}`}>
        <TaskView key={task.uid} task={task} word={word} noHints={isCheck} onSolve={onSolve} onAttempt={(quality) => {
        if (!finalized.current) {
          studyClock.current?.activity();
          ensureTouchedToday();
          recordAttempt(observed.current, attempts.current, task.uid, task.reason === 'repair', withHelp(quality) ?? 0);
        }
      }} />
      </div>

      {verdict && (
        <div className={`footer-bar verdict-bar ${verdict.ok ? 'ok' : 'bad'}`}>
          <div className="footer-inner">
            {/* Результат объявляется скринридеру (role=status + aria-live),
                но кнопка «Далее» в живую область не входит: внутри неё должны
                быть только текст и подписи. */}
            <div className="verdict-status" role="status" aria-live="polite">
              <div className="verdict-head">
                <div className="verdict">
                  {verdict.ok ? (verdict.hint ? '✓ Верно, но с подсказкой' : '✓ Правильно!') : '✗ Ошибка'}
                </div>
                {verdict.ok
                  ? lastGain > 0 && <span className="stat-pill xp">⚡ +{lastGain}</span>
                  : (
                    // Отдельный класс от бейджа «🔧 ещё раз» в шапке: там он про
                    // тип текущего задания, здесь — про то, что слово вернётся.
                    <span className="stat-pill again">🔧 повторим в уроке</span>
                  )}
              </div>

              {/* Образец написания показываем и после верного ответа: так работает
                  самопроверка (сверить написанное с образцом), а подсвеченная
                  опасная буква закрепляет то самое «трудное место» слова. */}
              {!verdict.ok && <div className="verdict-label">Правильно:</div>}
              <div className="verdict-word">
                <WordLetters word={word} stress markDanger small />
              </div>
              <div className="tiny verdict-note">
                {verdict.ok ? (
                  dangerSummary(word)
                ) : word.mnemonic ? (
                  <>💡 {word.mnemonic}</>
                ) : (
                  dangerSummary(word)
                )}
              </div>
              {helpMode !== 'off' && bukVerdictLine && <BukVerdictLine text={bukVerdictLine} />}
            </div>

            <button className="btn primary wide lg verdict-next" onClick={goNext}>
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
          onLeave={() => { studyClock.current?.finish('stopped'); finalizeAdaptive('quit'); onExit(); }}
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
  classWin,
  onNextClass,
  onHome,
  listTitle,
  isCheck,
  check,
  checkedWords,
  errorsCount,
  onTrainErrors,
  onRestartCheck,
  onTrainList,
  previous,
}: {
  lessonId: string;
  correct: number;
  wrong: number;
  xp: number;
  goal: number;
  xpBefore: number;
  /** Заголовок списка к контрольной: у урока-списка нет карточки в программе. */
  listTitle?: string;
  /** Полный контроль списка (0.62.0): показываем отчёт по словам. */
  isCheck?: boolean;
  /** Итог контрольной: сколько слов проверено, сколько верно, какие провалились. */
  check?: { at: number; total: number; correct: number; wrong: string[] };
  /** Карточки всех слов списка — чтобы показать «слово за словом». */
  checkedWords?: Word[];
  /** Сколько слов провалилось в последней контрольной (для кнопки «ошибки»). */
  errorsCount?: number;
  /** Предыдущий заход того же режима — для «было → стало» (0.63.0). */
  previous?: { at: number; total: number; correct: number };
  onTrainErrors?: () => void;
  onRestartCheck?: () => void;
  onTrainList?: () => void;
  /** Иток костюмного пазла этого урока (engine/puzzles.ts); null — не за что (повторение). */
  puzzle?: PuzzleAward | null;
  /** Класс, закрытый именно этим уроком: карточка «класс пройден» с переходом дальше. */
  classWin?: ClassId | null;
  onNextClass: () => void;
  onHome: () => void;
}) {
  const [puzzleOpen, setPuzzleOpen] = useState(true);
  const answered = correct + wrong;
  const stars = starsFor(correct, answered);
  const profile = useActiveProfile();
  // Урок-список (list:/check:/err:) в программе не зарегистрирован: раньше
  // здесь был `undefined`, и обращение к `lesson.emoji` ниже роняло экран
  // результатов в белый (исправлено 0.62.0).
  const lesson = LESSON_BY_ID[lessonId];
  const headingEmoji = isCheck ? '📋' : listTitle ? '🏫' : lesson?.emoji ?? '📚';
  const headingTitle = listTitle ?? lesson?.title ?? 'Урок';
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

        {classWin && (
          <div className="card class-win">
            <div className="class-win-emoji" aria-hidden="true">🎉</div>
            <h3 className="class-win-title">{CLASS_META[classWin].title} пройден!</h3>
            <ClassWinMeta grade={classWin} />
            {nextClass(classWin) ? (
              <button className="btn primary wide lg" onClick={onNextClass}>
                Дальше — {CLASS_META[nextClass(classWin)!].title}
              </button>
            ) : (
              <button className="btn green wide lg" onClick={onHome}>
                Вся программа позади — к урокам 🗺️
              </button>
            )}
            <p className="tiny" style={{ marginTop: 8 }}>
              Опыт, кристаллы и покупки остаются с тобой.
            </p>
          </div>
        )}

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

        {/* Отчёт по словам списка к контрольной (0.62.0): видно ИМЕННО ЧТО
            проверяли и где ошибся — раньше были только звёзды и «12 из 26». */}
        {listTitle && (
          <div className="card check-report" data-check-report>
            <h3 style={{ margin: '0 0 6px' }}>
              {isCheck ? '📋 Результат контрольной' : '🏫 Тренировка списка'}
            </h3>
            <div className="kv">
              <span>Проверено слов</span>
              <b>{check?.total ?? answered}</b>
            </div>
            <div className="kv">
              <span>Верно</span>
              <b>
                {check?.correct ?? correct} из {check?.total ?? answered}
              </b>
            </div>
            {isCheck && (check?.wrong.length ?? 0) > 0 && (
              <div className="kv">
                <span>Ошибки</span>
                <b>{check?.wrong.length}</b>
              </div>
            )}
            {previous && (
              <div className="kv" data-run-compare>
                <span>Прошлый раз</span>
                <b>
                  {previous.correct} из {previous.total}
                  {' → '}
                  {check?.correct ?? correct} из {check?.total ?? answered}
                </b>
              </div>
            )}

            {!!checkedWords?.length && (
              <div className="check-words" data-check-words>
                {checkedWords.map((w) => {
                  const failed = check?.wrong.includes(w.id);
                  const asked = !check || check.total >= checkedWords.length || check.wrong.includes(w.id) || true;
                  return (
                    <span
                      key={w.id}
                      className={`check-word${failed ? ' bad' : ' ok'}${asked ? '' : ' skipped'}`}
                      data-check-word={w.id}
                    >
                      <span aria-hidden="true">{failed ? '✗' : '✓'}</span> {w.text}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {isCheck && (errorsCount ?? check?.wrong.length ?? 0) > 0 && onTrainErrors && (
                <button className="btn primary sm" data-train-errors onClick={onTrainErrors}>
                  Тренировать ошибки · {errorsCount ?? check?.wrong.length}
                </button>
              )}
              {isCheck && onRestartCheck && (
                <button className="btn ghost sm" data-restart-check onClick={onRestartCheck}>
                  Пройти заново
                </button>
              )}
              {!isCheck && onTrainList && (
                <button className="btn ghost sm" onClick={onTrainList}>
                  Ещё тренировка
                </button>
              )}
            </div>
            {isCheck && (
              <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                Контрольная проверяет, а не учит: подсказок и отработки здесь нет — ошибки
                лучше отдельно потренировать кнопкой выше.
              </p>
            )}
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
            {headingEmoji} {headingTitle}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Итог класса на карточке победы: уроки и освоенные слова. */
function ClassWinMeta({ grade }: { grade: ClassId }) {
  const profile = useActiveProfile();
  const info = classProgress(profile, grade);
  return (
    <p className="tiny" style={{ margin: '0 0 10px' }}>
      {info.lessons} {plural(info.lessons, 'урок', 'урока', 'уроков')} позади · {info.mastered} из {info.words}{' '}
      {plural(info.words, 'слова', 'слов', 'слов')} освоено
      {nextClass(grade) ? ` · дальше ${CLASS_META[nextClass(grade)!].title.toLowerCase()}` : ' · вся программа 1–4'}.
    </p>
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
  const mode = listModeOf(lessonId);
  if (mode) {
    const list = (profile?.lists ?? []).find((l) => l.id === mode.listId);
    if (!list) return [];
    // Источник карточек: банк + свои слова профиля. Без этого «подлежащее»
    // из списка не нашлось бы (его нет в банке 257 слов).
    const lookup = lookupWith(profile?.customWords);
    const all = listWords(list, profile?.customWords ?? {});
    if (!all.length) return [];

    // Полный контроль (0.62.0): ВСЕ слова списка, по одному заданию, без
    // знакомства и без отработок. Порядок — как в списке, чтобы отчёт
    // «слово за словом» совпадал с тем, что задали в школе.
    if (mode.mode === 'check') {
      return all.slice(0, MAX_LIST_WORDS).map((w) => makeTask(checkKind(w), w.id, 'review', pickDanger(w), lookup));
    }

    const states: Record<string, WordState> = profile?.words ?? {};
    // Тренировка «по ошибкам» (0.63.0): берём слова, которые ошибались чаще
    // всего за ВСЮ историю заходов (а не только в последней контрольной) —
    // так тренировка сама находит то, что не получается. Если истории нет,
    // откатываемся к провалам последней контрольной.
    const wrong = list.lastCheck?.wrong ?? [];
    const hard = hardWords(list, MAX_LIST_WORDS).map((h) => h.id);
    const problemIds = hard.length ? hard : wrong;
    const pool =
      mode.mode === 'errors' && problemIds.length
        ? all.filter((w) => problemIds.includes(w.id))
        : all;
    // Размер тренировки списка — ОТДЕЛЬНЫЙ параметр (0.63.0), не «размер урока»:
    // готовиться к контрольной по 6 слов легче, чем проходить 12–20.
    // Полный контроль сюда не доходит (выше return) и проверяет всё подряд.
    const maxCards = drillLimit(profile, pool.length);
    // Каких слов не хватает в наборе, если список длиннее одного захода:
    // сначала те, что ребёнок ещё не видел, потом самые слабые. Так за
    // несколько заходов список проходится целиком, а не первые 12 слов.
    const order = [...pool]
      .sort((a, b) => needOf(states[b.id]) - needOf(states[a.id]))
      .slice(0, Math.min(maxCards, MAX_LIST_WORDS))
      .map((w) => w.id);
    const lesson = { id: lessonId, title: list.title, emoji: '🏫', order: 0, wordIds: order };
    const tasks = buildLesson({ lesson, level: 1, states, reviewWords: [], maxCards: 0, lookup });
    const intro = tasks.filter((t) => t.kind === 'intro');
    const rest = shuffle(tasks.filter((t) => t.kind !== 'intro'));
    return [...intro, ...rest];
  }

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
    // На каждое слово — фотокарточка-напоминание и одно оцениваемое задание.
    // Раньше вторым шла карточка «Слоги», и повторение открывалось старой
    // горизонтальной подсказкой с маленькой плитой (замечание 2026-10-07 с
    // айфона, слово «ученик»): теперь каждое слово встречает ребёнка той же
    // крупной композицией, что и знакомство в уроке, — образ → письмо.
    // Карточек на слово по-прежнему две, поэтому бюджет повторения (стражи
    // смоука и адаптации) и закрываемость «Повтори N слов» за один заход
    // не меняются. Напоминание неоцениваемое: оно не считается «потренированным
    // словом», оценивает только «напиши»/«исправь».
    return pick.words.flatMap((w, i) => [
      makeTask('intro', w.id, 'review', pickDanger(w)),
      makeReviewTask(i % 2 === 0 ? 'write' : 'fix', w.id),
    ]);
  }

  // Не подмешиваем в повторение слова текущего урока (и открытого «следующего»):
  // ребёнок ещё не прошёл их, а повторение должно быть про старое.
  // «Следующий» — из программы активного класса: иначе в уроке 1 класса
  // исключались бы слова из пути 2 класса и интерливинг пустел.
  const classLessons = LESSONS_BY_GRADE[availableClass(profile?.activeClass ?? 2)];
  const current = classLessons.find((l) => (profile?.lessons[l.id]?.level ?? 0) < 5);
  const exclude = new Set([...lesson.wordIds, ...(current?.wordIds ?? [])]);
  const review = pickReview(WORDS, states, exclude, 3);
  const tasks = buildLesson({ lesson, level, states, reviewWords: review, maxCards });
  // Знакомство держим в начале — это первое, что видит ребёнок; повторение — в конце
  const intro = tasks.filter((t) => t.kind === 'intro');
  const rest = shuffle(tasks.filter((t) => t.kind !== 'intro' && t.reason !== 'review'));
  const rev = tasks.filter((t) => t.reason === 'review');
  return [...intro, ...rest, ...rev];
}

/**
 * Задание для полного контроля (0.62.0).
 *
 * Пишем слово по памяти — только так проверка честно показывает, знает ли
 * ребёнок написание. Фразы («до свидания») собрать из букв нельзя, для них
 * остаётся выбор буквы.
 */
function checkKind(word: { text: string }): Task['kind'] {
  return word.text.includes(' ') ? 'gap' : 'write';
}

/**
 * Насколько слову нужна тренировка (0.58.0): большое число — берём раньше.
 * Слова, которых ребёнок ещё не видел, идут первыми, затем самые слабые и
 * просроченные. Так список длиннее одного захода проходится целиком за
 * несколько заходов, а не крутит первые 12 слов.
 */
/** Источник карточек для профиля: банк плюс свои слова списков. */
const lookupOf = (profile: Profile | null): WordLookup => lookupWith(profile?.customWords);

function needOf(st: WordState | undefined): number {
  if (!st) return 1000;
  const overdue = st.due && st.due < Date.now() ? 200 : 0;
  return overdue + (100 - st.s);
}

function makeReviewTask(kind: 'write' | 'fix', wordId: string): Task {
  const w = WORD_BY_ID[wordId];
  // берём самую коварную опасную букву, а не первую в списке
  return makeTask(kind, wordId, 'review', pickDanger(w));
}
