import { normalizeStudySessions, StudyClock, STUDY_IDLE_MS } from '../src/engine/study';
import { dayKey } from '../src/engine/day';
import { check } from './ui-helpers';

export function runStudyEngineChecks(): void {
  console.log('\n── Сессии занятий: активное время и восстановление ──');
  let now = 0;
  let starts = 0;
  let finishes: string[] = [];
  const intervals: number[] = [];
  const clock = new StudyClock(
    () => { starts++; },
    (seconds) => intervals.push(seconds),
    (status) => finishes.push(status),
    () => now,
  );
  clock.activity();
  now = 3_600;
  clock.flush();
  now = 8_000;
  clock.flush(true);
  now = 20_000; // время в фоне не учитываем
  clock.activity();
  now = 22_000;
  clock.finish('completed');
  clock.finish('stopped');
  check('учитывается только видимое время, округлённое до полных секунд', intervals.reduce((a, b) => a + b, 0) === 10, JSON.stringify(intervals));
  check('сессия стартует один раз и получает один итоговый статус', starts === 1 && finishes.join(',') === 'completed', `${starts} / ${finishes.join(',')}`);

  now = 0;
  let idleSeconds = 0;
  const idleClock = new StudyClock(() => {}, (seconds) => { idleSeconds += seconds; }, () => {}, () => now);
  idleClock.activity();
  now = STUDY_IDLE_MS + 10_000;
  idleClock.flush();
  check('длинный простой ограничивается заданным порогом', idleSeconds === STUDY_IDLE_MS / 1000, String(idleSeconds));
  now += 5_000;
  idleClock.activity();
  now += 1_000;
  idleClock.finish('stopped');
  check('после паузы новое действие возобновляет учёт без начисления простоя', idleSeconds === STUDY_IDLE_MS / 1000 + 1, String(idleSeconds));

  const today = dayKey();
  const active = normalizeStudySessions([{
    id: 'interrupted', day: today, startedAt: 100, lastActivityAt: 250,
    activeSeconds: 7, mode: 'lesson', tasks: 1, correct: 1, wrong: 0,
    errorWords: {}, taskKindErrors: {}, recoveredWords: [], status: 'active',
  }], today, 500)[0];
  check('оставшаяся активной запись после перезапуска становится прерванной', active?.status === 'interrupted' && active.endedAt === 250, JSON.stringify(active));
  const stale = normalizeStudySessions([{
    id: 'old', day: '2000-01-01', startedAt: 1, lastActivityAt: 1,
    activeSeconds: 0, mode: 'review', tasks: 0, correct: 0, wrong: 0,
    errorWords: {}, taskKindErrors: {}, recoveredWords: [], status: 'completed',
  }], today, 500);
  check('история сессий вне срока хранения отбрасывается', stale.length === 0, JSON.stringify(stale));
}
