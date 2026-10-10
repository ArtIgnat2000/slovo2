// ── «Бродилка БУКа» — экран главной игры ────────────────────────────────────
//
// Игра: кубик ведёт БУКа по маршруту из 16 станций-тем и четырёх привалов.
// Станция просит собрать слово темы (задание с буквами-шпионами); собрал —
// станция твоя, слово уходит в «Книгу слов» и в обычный SRS, как после урока.
//
// Решения, которые видно только здесь:
//   • кубик никогда не отбрасывает назад — проиграть нельзя (см. engine/board.ts);
//   • ошибка не отнимает ни награду, ни прогресс: буквы просто встают заново;
//   • поведение ребёнка — единственное, что двигает игру (никаких таймеров);
//   • игра кормит обучение: каждый ответ идёт через `answer` + `touchDay` + XP,
//     поэтому день, серия и задания дня считают игру так же, как урок.

import { useEffect, useMemo, useRef, useState } from 'react';
import { LESSONS, WORDS } from '../../content/words';
import {
  BOARD,
  BOARD_REWARDS,
  cellAt,
  makeStationTask,
  rollDice,
  stationWord,
  stationsOpened,
} from '../../engine/board';
import { XP } from '../../engine/rewards';
import { plural } from '../../engine/quests';
import { useActiveProfile, useApp } from '../../state/store';
import { Mascot } from '../Mascot';
import { TaskView } from '../TaskView';
import { haptic } from '../../platform/haptics';
import { sfx } from '../../platform/sound';

interface Props {
  onExit: () => void;
}

/** Пауза между шагами БУКа: успевает быть видно, но не тянется. */
const STEP_MS = 190;
const DICE_SPIN_MS = 90;

export function GameScreen({ onExit }: Props) {
  const profile = useActiveProfile();
  const gameRoll = useApp((s) => s.gameRoll);
  const gameClaim = useApp((s) => s.gameClaim);
  const gameRestart = useApp((s) => s.gameRestart);
  const answer = useApp((s) => s.answer);
  const addXp = useApp((s) => s.addXp);
  const touchDay = useApp((s) => s.touchDay);
  const showToast = useApp((s) => s.showToast);

  const game = profile?.game ?? { pos: 0, claimed: [], rolls: 0 };
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  /** Позиция во время «шага» по клеткам: пока она растёт, кубик недоступен. */
  const [walking, setWalking] = useState<number | null>(null);
  /** Станция, на которой БУК остановился и ждёт слово. */
  const [station, setStation] = useState<string | null>(null);
  /** Экран закрыли посреди игры — не трогаем состояние после размонтирования. */
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  /** Позиция, на которой станция уже была предложена: чтобы после решения
   *  слова она не открывалась заново, а после перезахода игра предлагалась снова. */
  const handled = useRef(-1);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const finished = game.pos >= BOARD.length;
  const shown = walking ?? game.pos;
  const opened = stationsOpened(game);

  const word = useMemo(
    () => (station ? stationWord(station, WORDS, profile?.words ?? {}) : null),
    [station, profile?.words],
  );
  const task = useMemo(() => (word ? makeStationTask(word) : null), [word]);
  const lesson = station ? LESSONS.find((l) => l.id === station) : null;

  useEffect(() => {
    // БУК мог остановиться на станции и уйти с экрана, не собрав слово: при
    // возврате в игру станция предлагается снова — прогресс так не теряется.
    // Уже открытую станцию не переспрашиваем: она ждёт только «в гости» с кубика.
    if (game.pos >= BOARD.length || handled.current === game.pos) return;
    const landed = cellAt(game.pos);
    if (landed?.kind === 'station' && landed.lessonId && !game.claimed.includes(landed.lessonId)) {
      handled.current = game.pos;
      setStation(landed.lessonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.pos, game.claimed.length]);

  /** Разложить награду и станцию после шага: клетка решает, что делать дальше. */
  const resolve = (pos: number) => {
    const landed = cellAt(pos);
    if (!landed) return;
    if (pos >= BOARD.length) {
      sfx.finish(3);
      haptic.finish();
      showToast({ emoji: '🏁', title: 'Маршрут пройден!', text: `+${BOARD_REWARDS.finish} 💎 за дорогу` });
      return;
    }
    if (landed.kind === 'prival') {
      sfx.reward();
      haptic.chestOpen();
      showToast({ emoji: '🏕️', title: 'Привал', text: `+${BOARD_REWARDS.prival} 💎, можно отдохнуть` });
      return;
    }
    if (landed.lessonId) setStation(landed.lessonId);
  };

  /** Бросок кубика: крутим грани, шагаем по клеткам, разбираем, что выпало. */
  const roll = async () => {
    if (rolling || walking !== null || station || finished) return;
    setRolling(true);
    const value = rollDice();
    for (let i = 0; i < 5 && alive.current; i++) {
      setDice(rollDice());
      await wait(DICE_SPIN_MS);
    }
    if (!alive.current) return;
    setDice(value);
    sfx.tap();
    haptic.tap();
    const before = game.pos;
    // Шаги рисуем по одному: ребёнок должен видеть, как БУК идёт, а не прыгает.
    for (let step = before + 1; step <= Math.min(BOARD.length, before + value); step++) {
      setWalking(step);
      await wait(STEP_MS);
    }
    if (!alive.current) return;
    setRolling(false);
    setWalking(null);
    const out = gameRoll(value);
    resolve(out.pos);
  };

  /** Слово собрано: начисляем как за тренировку и открываем станцию. */
  const solved = (quality: number) => {
    if (!word || !station) return;
    touchDay();
    answer(word.id, quality);
    if (quality >= 3) addXp(XP.review);
    handled.current = game.pos;
    const award = gameClaim(station);
    sfx.reward();
    haptic.correct();
    showToast({
      emoji: award.first ? '🚩' : '🔁',
      title: award.first ? `Станция «${lesson?.title ?? ''}» открыта` : 'Слово потренировано',
      text: `+${award.gems} 💎`,
    });
    setStation(null);
  };

  if (!profile) return null;

  return (
    <div className="screen game-screen">
      <div className="row mb" style={{ gap: 8 }}>
        <button className="btn ghost sm" onClick={onExit}>
          ‹ Домой
        </button>
        <div className="grow center" style={{ fontWeight: 800 }}>
          🎲 Бродилка БУКа
        </div>
        <div className="stat-pill gems">💎 {profile.gems}</div>
      </div>

      {station && task && word ? (
        <div className="card">
          <div className="row spread mb" style={{ gap: 8 }}>
            <span className="chip">
              {lesson?.emoji} Станция «{lesson?.title}»
            </span>
            <span className="chip">
              {game.claimed.includes(station) ? `+${BOARD_REWARDS.replay} 💎` : `+${BOARD_REWARDS.station} 💎`}
            </span>
          </div>
          {/* Сборка слова: буквы-шпионы приходят из движка игры, оценивание —
              обычное, уроковое, поэтому ответ идёт в SRS без поблажек. */}
          <TaskView task={task} word={word} onSolve={(q) => solved(q ?? 0)} />
          <p className="tiny center mt">Ошибиться тут нельзя: буквы просто встанут заново.</p>
        </div>
      ) : (
        <>
          <div className="card mb">
            <div className="row spread" style={{ marginBottom: 8 }}>
              <span className="chip">🚩 {opened} из {LESSONS.length} станций</span>
              <span className="chip">{game.rolls > 0 ? `бросков: ${game.rolls}` : 'кубик ждёт'}</span>
            </div>
            <div className="game-row">
              <div className={`game-dice face-${dice}`} aria-label={`кубик: ${dice}`}>
                {Array.from({ length: 9 }, (_, i) => (
                  <i key={i} className={PIPS[dice].includes(i) ? 'on' : ''} />
                ))}
              </div>
              {finished ? (
                <button className="btn primary" onClick={() => { gameRestart(); showToast({ emoji: '🎲', title: 'Новая дорога', text: 'Кубик снова в начале' }); }}>
                  Пройти маршрут заново
                </button>
              ) : (
                <button className="btn primary" disabled={rolling || walking !== null} onClick={() => void roll()}>
                  {rolling || walking !== null ? 'БУК идёт…' : 'Бросить кубик'}
                </button>
              )}
            </div>
            <p className="muted center" style={{ margin: 0 }}>
              {finished
                ? 'Маршрут пройден! Станции остались твоими — можно пройти дорогу снова.'
                : 'Кубик ведёт только вперёд. Попадёшь на станцию — собери её слово.'}
            </p>
          </div>

          <div className="game-board">
            {BOARD.map((c) => {
              const here = shown === c.index;
              const passed = shown > c.index;
              const claimed = !!c.lessonId && game.claimed.includes(c.lessonId);
              return (
                <div
                  key={c.index}
                  className={`game-cell ${c.kind} ${here ? 'here' : ''} ${passed ? 'passed' : ''}`}
                >
                  <span className="game-cell-emoji">{c.emoji}</span>
                  <span className="grow">
                    <b>{c.title}</b>
                    <span className="tiny">
                      {c.kind === 'prival'
                        ? `отдых и +${BOARD_REWARDS.prival} 💎`
                        : claimed
                          ? 'станция открыта'
                          : 'ждёт слово'}
                    </span>
                  </span>
                  {here && <Mascot mood="happy" size={44} />}
                  {claimed && !here && <span className="game-mark">✔</span>}
                </div>
              );
            })}
          </div>

          <p className="tiny center mt">
            Всего станций: {LESSONS.length} · пройдено {opened} ·{' '}
            {plural(BOARD.length, 'клетка', 'клетки', 'клеток')} маршрута
          </p>
        </>
      )}
    </div>
  );
}

/** Точки кубика: индексы сетки 3×3, которые «включены» для значения 1..3. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8] };
