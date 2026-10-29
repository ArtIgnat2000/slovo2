// Краткий обзор обучения для родителя.
//
// Первый экран отвечает только на два вопроса: как продвигаются слова выбранного
// класса и какие слова повторно вызывают ошибки. Активность по дням и отдельные
// занятия раскрываются по запросу — они не конкурируют с главным выводом.

import { useEffect, useRef, useState } from 'react';
import { CLASS_META, LESSON_BY_ID, WORDS_BY_GRADE, WORD_BY_ID, availableClass } from '../../content/words';
import { lastDays } from '../../engine/day';
import { plural } from '../../engine/quests';
import { dangerSummary } from '../../engine/word-facts';
import { Sentence, WordCard } from '../WordView';
import { dayKey, todayStat } from '../../state/store';
import { Bar } from '../Bits';
import { GroupTitle, StatTile } from './ParentBits';
import type { ClassId, Profile, StudySession, TaskKind, Word } from '../../types';

interface Props {
  profile: Profile;
}

const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const TASK_KIND_LABEL: Record<TaskKind, string> = {
  intro: 'знакомство',
  syllables: 'слоги',
  gap: 'окошко',
  build: 'собери слово',
  write: 'напиши слово',
  visual: 'зрительный диктант',
  fix: 'исправь ошибку',
};

function formatStudyTime(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60) return '<1 мин';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

const wordTextOf = (id: string, custom?: Record<string, Word>) =>
  WORD_BY_ID[id]?.text ?? custom?.[id]?.text ?? id;

function SessionDetails({ session, customWords }: { session: StudySession; customWords?: Record<string, Word> }) {
  const errors = Object.entries(session.errorWords).sort((a, b) => b[1] - a[1]);
  const kindErrors = Object.entries(session.taskKindErrors)
    .filter(([, count]) => (count ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const label = session.mode === 'review'
    ? 'Повторение'
    : LESSON_BY_ID[session.lessonId ?? '']?.title ?? 'Урок';
  const status = session.status === 'completed'
    ? 'завершено'
    : session.status === 'stopped'
      ? 'остановлено'
      : session.status === 'interrupted'
        ? 'прервано'
        : 'идёт';
  const start = new Date(session.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <details className="study-session">
      <summary>
        <span>
          <b>{start} · {label}</b>
          <small>{formatStudyTime(session.activeSeconds)} · {status}</small>
        </span>
        <span className="study-session-score">
          {session.correct} верно · {session.wrong} {plural(session.wrong, 'ошибка', 'ошибки', 'ошибок')}
        </span>
      </summary>
      <div className="study-session-detail">
        <div>{session.tasks} {plural(session.tasks, 'задание', 'задания', 'заданий')}</div>
        {errors.length > 0 && (
          <div className="study-session-errors">
            <b>Слова:</b> {errors.map(([id, count]) => `${wordTextOf(id, customWords)} · ${count}`).join(', ')}
          </div>
        )}
        {kindErrors.length > 0 && (
          <div className="study-session-errors">
            <b>Задания:</b> {kindErrors.map(([kind, count]) => `${TASK_KIND_LABEL[kind as TaskKind]} · ${count}`).join(', ')}
          </div>
        )}
        {session.recoveredWords.length > 0 && (
          <div className="study-session-recovered">
            Исправлено повтором: {session.recoveredWords.map((id) => wordTextOf(id, customWords)).join(', ')}
          </div>
        )}
      </div>
    </details>
  );
}

function ParentWordDialog({ word, onClose }: { word: Word; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  return (
    <dialog ref={dialog} className="parent-word-dialog" aria-label={`Карточка слова ${word.text}`}
      onClose={onClose} onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
        }
      }}>
      <WordCard word={word} className="wcard-modal">
        <div className="row wrap-center">
          {word.syllables.map((syllable, index) => <span className="chip" key={index}>{syllable}</span>)}
        </div>
        <Sentence word={word} hidden={false} />
        {word.mnemonic && <div className="banner">💡 {word.mnemonic}</div>}
        <p className="tiny center">{dangerSummary(word)}</p>
        <button type="button" className="btn ghost wide" onClick={() => dialog.current?.close()}>Закрыть</button>
      </WordCard>
    </dialog>
  );
}

export function OverviewTab({ profile }: Props) {
  const wordText = (id: string) => wordTextOf(id, profile.customWords);
  const [grade, setGrade] = useState(availableClass(profile.activeClass ?? 2));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const gradeWords = WORDS_BY_GRADE[grade];
  const mastered = gradeWords.filter((word) => (profile.words[word.id]?.s ?? 0) >= 90).length;
  const started = gradeWords.filter((word) => {
    const state = profile.words[word.id];
    return !!state && (state.s > 0 || state.seen > 0 || state.ok > 0 || state.wrong > 0);
  }).length;
  const inProgress = Math.max(0, started - mastered);
  const notStarted = Math.max(0, gradeWords.length - started);
  const repeatedErrors = Object.entries(profile.errors)
    .filter(([id, count]) => count >= 2 && gradeWords.some((word) => word.id === id))
    .sort((a, b) => b[1] - a[1]);

  const today = todayStat(profile);
  const todaySessions = (profile.studySessions ?? [])
    .filter((session) => session.day === dayKey())
    .sort((a, b) => b.startedAt - a.startedAt);
  const todayErrors = Object.entries(today.errorWords ?? {}).sort((a, b) => b[1] - a[1]);
  const todayAnswered = today.correct + today.wrong;
  const todayAccuracy = todayAnswered > 0 ? Math.round((today.correct / todayAnswered) * 100) : null;
  const hasToday = todayAnswered > 0 || todaySessions.length > 0 || (today.tasks ?? 0) > 0 || today.xp > 0 || today.lessons > 0;

  const days = lastDays(7);
  const weekXp = days.reduce((sum, key) => sum + (profile.days[key]?.xp ?? 0), 0);
  const weekLessons = days.reduce((sum, key) => sum + (profile.days[key]?.lessons ?? 0), 0);
  const busiestXp = Math.max(60, ...days.map((key) => profile.days[key]?.xp ?? 0));

  return (
    <div className="parent-stack">
      {selectedWord && <ParentWordDialog word={selectedWord} onClose={() => setSelectedWord(null)} />}
      <div className="card parent-learning-summary">
        <GroupTitle title="Прогресс по словам" />
        <label className="setting-row" htmlFor="parent-learning-grade">
          <span className="setting-title">Класс</span>
          <select
            id="parent-learning-grade"
            className="input"
            value={grade}
            onChange={(event) => setGrade(availableClass(Number(event.target.value) as ClassId))}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>{CLASS_META[value as ClassId].title}</option>
            ))}
          </select>
        </label>

        <div className="stat-grid">
          <StatTile value={`${mastered} / ${gradeWords.length}`} label="освоено" tone={mastered > 0 ? 'good' : 'plain'} />
          <StatTile value={String(inProgress)} label="в работе" />
          <StatTile value={String(notStarted)} label="не начато" />
        </div>
        <div className="mt">
          <Bar value={(mastered / Math.max(1, gradeWords.length)) * 100} tone="green" />
        </div>

        <div className="parent-summary-errors">
          <div className="setting-title">Повторные ошибки</div>
          {repeatedErrors.length > 0 ? (
            <div className="wordlist">
              {repeatedErrors.slice(0, 6).map(([id, count]) => (
                <button type="button" className="word-chip weak" key={id}
                  aria-label={`${wordText(id)}: ${count} ${plural(count, 'ошибка', 'ошибки', 'ошибок')}, открыть карточку`}
                  onClick={() => setSelectedWord(gradeWords.find((word) => word.id === id) ?? null)}>
                  {wordText(id)} · {count}
                </button>
              ))}
            </div>
          ) : (
            <p className="setting-hint">Нет</p>
          )}
        </div>

        <details className="parent-metric-help">
          <summary>Как считается?</summary>
          <p className="setting-hint">
            «Освоено» — оценка приложения 90 из 100 и выше. Общие слова засчитываются в каждом классе.
          </p>
        </details>

        <button
          className="btn ghost sm mt"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? 'Скрыть статистику' : 'Статистика занятий'}
        </button>
      </div>

      {detailsOpen && (
        <>
          <div className="card">
            <GroupTitle title="Сегодня" hint={new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} />
            {!hasToday ? (
              <p className="setting-hint">Занятий ещё не было.</p>
            ) : (
              <>
                <div className="stat-grid">
                  <StatTile value={formatStudyTime(today.activeSeconds ?? 0)} label="активное время" />
                  <StatTile value={String(today.tasks ?? 0)} label="заданий" />
                  <StatTile
                    value={todayAccuracy === null ? '—' : `${todayAccuracy}%`}
                    label={`${today.correct} верно · ${today.wrong} ${plural(today.wrong, 'ошибка', 'ошибки', 'ошибок')}`}
                  />
                </div>
                <div className="study-today-lines">
                  <div className="kv"><span>Завершено уроков</span><b>{today.lessons}</b></div>
                  <div className="kv"><span>Опыт</span><b>⚡ {today.xp} XP</b></div>
                </div>
                {todayErrors.length > 0 && (
                  <div className="study-today-errors">
                    <div className="setting-title">Ошибки сегодня</div>
                    <div className="wordlist">
                      {todayErrors.slice(0, 6).map(([id, count]) => (
                        <span className="word-chip study-error" key={id}>{wordText(id)} · {count}</span>
                      ))}
                    </div>
                    {!!today.recoveredWords?.length && (
                      <p className="study-session-recovered">
                        Исправлено повтором: {today.recoveredWords.map((id) => wordText(id)).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {todaySessions.length > 0 && (
              <details className="study-session-list">
                <summary className="parent-summary">
                  Занятия · {todaySessions.length}
                </summary>
                {todaySessions.map((session) => (
                  <SessionDetails key={session.id} session={session} customWords={profile.customWords} />
                ))}
              </details>
            )}
          </div>

          <div className="card">
            <GroupTitle
              title="Последние 7 дней"
              hint={`${weekLessons} ${plural(weekLessons, 'урок', 'урока', 'уроков')} · ${weekXp} XP`}
            />
            <div className="week-chart" role="img" aria-label={`За 7 дней: ${weekLessons} уроков, ${weekXp} XP`}>
              {days.map((key) => {
                const xp = profile.days[key]?.xp ?? 0;
                const height = Math.round((xp / busiestXp) * 100);
                const date = new Date(`${key}T12:00:00`);
                return (
                  <div className={`week-col ${key === dayKey() ? 'today' : ''}`} key={key}>
                    <div className="week-bar-track">
                      <div className={`week-bar ${xp > 0 ? 'filled' : ''}`} style={{ height: `${Math.max(xp > 0 ? 12 : 3, height)}%` }} />
                    </div>
                    <div className="week-day">{WEEKDAY_SHORT[date.getDay()]}</div>
                    <div className="week-xp">{xp > 0 ? xp : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
