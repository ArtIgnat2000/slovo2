// «Обзор» — первый раздел родительского экрана: как дела у ребёнка.
//
// Задача раздела (docs/parent-section-redesign.md): за 10 секунд ответить на
// три вопроса родителя — «занимается ли», «что получается», «что подтянуть».
// Никаких настроек здесь нет: настройки — это решения, а не отчёт.

import { ACHIEVEMENTS } from '../../engine/rewards';
import { CLASS_META, LESSON_BY_ID, WORDS, WORDS_BY_GRADE, WORD_BY_ID, availableClass } from '../../content/words';
import { lastDays } from '../../engine/day';
import { classProgress, classTable, nextClass } from '../../engine/classes';
import { dayKey, masteredCount, todayStat } from '../../state/store';
import { activeStudyDays } from '../../engine/weekly-rewards';
import { plural } from '../../engine/quests';
import { Bar } from '../Bits';
import { GroupTitle, StatTile } from './ParentBits';
import type { Profile, StudySession, TaskKind, Word } from '../../types';

interface Props {
  profile: Profile;
  /** Показать экран со списком слов (та же вкладка, что у ребёнка) */
  onOpenWords: () => void;
  /** Перейти в другой раздел родительского экрана (частые дела — в один тап) */
  onOpenSection: (id: 'progress' | 'app') => void;
}

const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const TASK_KIND_LABEL: Record<TaskKind, string> = {
  intro: 'знакомство', syllables: 'слоги', gap: 'окошко', build: 'собери слово',
  write: 'напиши слово', visual: 'зрительный диктант', fix: 'исправь ошибку',
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

/**
 * Текст слова для отчёта: банк → свои слова списков (0.58.0) → сам id.
 * Без этого в отчёте появлялось «c_podlezhashchee» вместо «подлежащее».
 */
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
  const status = session.status === 'completed' ? 'пройдено'
    : session.status === 'stopped' ? 'остановлено'
      : session.status === 'interrupted' ? 'прервано' : 'идёт';
  const start = new Date(session.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return (
    <details className="study-session">
      <summary>
        <span><b>{start} · {label}</b><small>{formatStudyTime(session.activeSeconds)} · {status}</small></span>
        <span className="study-session-score">{session.correct} верно · {session.wrong} {plural(session.wrong, 'ошибка', 'ошибки', 'ошибок')}</span>
      </summary>
      <div className="study-session-detail">
        <div>{session.tasks} {plural(session.tasks, 'задание', 'задания', 'заданий')} · {session.correct} верно · {session.wrong} {plural(session.wrong, 'ошибка', 'ошибки', 'ошибок')}</div>
        {errors.length > 0 && (
          <div className="study-session-errors">
            <b>Ошибки в словах:</b> {errors.map(([id, count]) => `${wordTextOf(id, customWords)} · ${count}`).join(', ')}
          </div>
        )}
        {kindErrors.length > 0 && (
          <div className="study-session-errors">
            <b>В каких заданиях:</b> {kindErrors.map(([kind, count]) => `${TASK_KIND_LABEL[kind as TaskKind]} · ${count}`).join(', ')}
          </div>
        )}
        {session.recoveredWords.length > 0 && (
          <div className="study-session-recovered">
            После ошибки верно повторил: {session.recoveredWords.map((id) => wordTextOf(id, customWords)).join(', ')}
          </div>
        )}
      </div>
    </details>
  );
}

export function OverviewTab({ profile, onOpenWords, onOpenSection }: Props) {
  // Слова из списков к контрольной (0.58.0) в отчёте должны читаться словами,
  // а не id «c_podlezhashchee»: родитель пришёл сюда за понятным ответом.
  const wordText = (id: string) => wordTextOf(id, profile.customWords);
  const today = todayStat(profile);
  const todaySessions = (profile.studySessions ?? [])
    .filter((session) => session.day === dayKey())
    .sort((a, b) => b.startedAt - a.startedAt);
  const todayErrorWords = Object.entries(today.errorWords ?? {}).sort((a, b) => b[1] - a[1]);
  const todayAnswered = today.correct + today.wrong;
  const todayAccuracy = todayAnswered >= 5 ? Math.round((today.correct / todayAnswered) * 100) : null;
  const grade = availableClass(profile.activeClass ?? 2);
  const gradeWords = WORDS_BY_GRADE[grade];
  // Прогресс по всем классам: таблица ниже и подпись «что дальше».
  const table = classTable(profile);
  const currentInfo = classProgress(profile, grade);
  const next = nextClass(grade);
  // «Освоено» считаем по программе активного класса, а «всего» показываем рядом:
  // иначе после смены класса родитель видел бы проценты по чужой программе.
  const mastered = masteredCount(profile);
  const masteredInGrade = gradeWords.filter((w) => (profile.words[w.id]?.s ?? 0) >= 90).length;
  const totalOk = Object.values(profile.words).reduce((sum, w) => sum + w.ok, 0);
  const totalWrong = Object.values(profile.words).reduce((sum, w) => sum + w.wrong, 0);
  const attempts = totalOk + totalWrong;
  const accuracy = attempts > 0 ? Math.round((totalOk / attempts) * 100) : 0;

  const days = lastDays(7);
  const weekXp = days.reduce((sum, key) => sum + (profile.days[key]?.xp ?? 0), 0);
  const weekLessons = days.reduce((sum, key) => sum + (profile.days[key]?.lessons ?? 0), 0);
  const busiestXp = Math.max(60, ...days.map((key) => profile.days[key]?.xp ?? 0));
  const active = activeStudyDays(profile.days);

  const weak = Object.entries(profile.errors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const weakTotal = Object.keys(profile.errors).length;

  const trained = Object.values(profile.words).filter((w) => w.s > 0).length;
  const trainedInGrade = gradeWords.filter((w) => (profile.words[w.id]?.s ?? 0) > 0).length;
  const earned = profile.achievements.length;

  return (
    <div className="parent-stack">
      {/* Сегодня — время, фактически записанные действия и результат именно за этот день. */}
      <div className="card">
        <GroupTitle title="Сегодня" hint={new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} />
        {todayAnswered === 0 && todaySessions.length === 0 && (today.tasks ?? 0) === 0 && today.xp === 0 && today.lessons === 0 ? (
          <p className="setting-hint">Занятий сегодня ещё не было · XP за сегодня: 0.</p>
        ) : (
          <>
            <div className="stat-grid">
              <StatTile
                value={formatStudyTime(today.activeSeconds ?? 0)}
                label="активное время"
                hint="примерно · паузы не считаются"
                tone={(today.activeSeconds ?? 0) > 0 ? 'good' : 'plain'}
              />
              <StatTile
                value={String(todaySessions.length)}
                label={plural(todaySessions.length, 'сессия', 'сессии', 'сессий')}
                hint={todaySessions.length ? 'урок или повторение' : 'нет сохранённых сессий'}
              />
              <StatTile
                value={String(today.tasks ?? 0)}
                label="заданий сделано"
                hint="включая повторения"
              />
            </div>
            <div className="study-today-lines">
              <div className="kv"><span>Ответы сегодня</span><b>{today.correct} верно · {today.wrong} {plural(today.wrong, 'ошибка', 'ошибки', 'ошибок')}</b></div>
              <div className="kv"><span>Точность сегодня</span><b>{todayAccuracy === null ? todayAnswered === 0 ? 'пока нет ответов' : `мало ответов (${todayAnswered})` : `${todayAccuracy}% (${todayAnswered} ответов)`}</b></div>
              <div className="kv"><span>Завершено уроков</span><b>{today.lessons}</b></div>
              <div className="kv"><span>XP за сегодня</span><b>⚡ {today.xp}</b></div>
            </div>
            {todayErrorWords.length > 0 && (
              <div className="study-today-errors">
                <div className="setting-title">Ошибки сегодня · {todayErrorWords.length} {plural(todayErrorWords.length, 'слово', 'слова', 'слов')}</div>
                <div className="wordlist">
                  {todayErrorWords.slice(0, 6).map(([id, count]) => (
                    <span className="word-chip study-error" key={id}>{wordText(id)} · {count}</span>
                  ))}
                </div>
                {today.recoveredWords?.length ? (
                  <p className="study-session-recovered">После ошибки верно повторил: {today.recoveredWords.map((id) => wordText(id)).join(', ')}</p>
                ) : (
                  <p className="setting-hint">Ошибка — часть обучения. Эти слова приложение вернёт на повторение.</p>
                )}
              </div>
            )}
          </>
        )}
        {todaySessions.length > 0 && (
          <div className="study-session-list">
            <div className="study-session-list-title">Занятия сегодня</div>
            {todaySessions.map((session) => (
              <SessionDetails key={session.id} session={session} customWords={profile.customWords} />
            ))}
          </div>
        )}
        <div className="study-today-streak">
          Серия: {profile.streak} {plural(profile.streak, 'день', 'дня', 'дней')} подряд · активных на неделе: {active} из 7
        </div>
      </div>

      {/* Неделя: столбики по дням + итог словами, без «сырых» чисел без единиц. */}
      <div className="card">
        <GroupTitle
          title="Последние 7 дней"
          hint={`${weekLessons} ${plural(weekLessons, 'урок', 'урока', 'уроков')} · ${weekXp} XP за неделю`}
        />
        <div className="week-chart" role="img" aria-label={`Занятия за 7 дней: ${weekLessons} уроков, ${weekXp} XP`}>
          {days.map((key) => {
            const stat = profile.days[key];
            const xp = stat?.xp ?? 0;
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

      {/* Общая картина по словам: прогресс важнее абсолютных чисел. */}
      <div className="card">
        <GroupTitle
          title={`Слова · ${CLASS_META[grade].title}`}
          hint={`в программе класса — ${gradeWords.length} · всего за 1–4 — ${WORDS.length}`}
        />
        <div className="stat-grid">
          <StatTile
            value={`${masteredInGrade}`}
            label="освоено"
            hint={`отвечает уверенно · всего за 1–4 — ${mastered}`}
            tone={masteredInGrade > 0 ? 'good' : 'plain'}
          />
          <StatTile value={`${trainedInGrade}`} label="начато в классе" hint={`хотя бы раз отвечал · всего — ${trained}`} />
          <StatTile
            value={attempts > 0 ? `${accuracy}%` : '—'}
            label="точность за всё время"
            hint={attempts > 0 ? `${totalOk} верно · ${totalWrong} с ошибкой` : 'ещё нет ответов'}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <Bar value={(masteredInGrade / Math.max(1, gradeWords.length)) * 100} tone="green" />
          <div className="setting-hint" style={{ marginTop: 6 }}>
            Программа класса пройдена на {Math.round((masteredInGrade / Math.max(1, gradeWords.length)) * 100)}%
          </div>
        </div>
      </div>

      {/* Таблица классов: видно весь путь 1–4, а не только текущий класс.
          Родитель спрашивает «а что дальше?» — здесь ответ без переключения
          программы: сколько слов освоено и сколько уроков закрыто в каждом. */}
      <div className="card">
        <GroupTitle
          title="Классы 1–4"
          hint={
            currentInfo.complete && next
              ? `${CLASS_META[grade].title} пройден — дальше ${CLASS_META[next].title}`
              : `Сейчас открыт ${CLASS_META[grade].title.toLowerCase()}`
          }
        />
        <div className="class-table">
          {table.map((row) => (
            <div className={`class-table-row ${row.current ? 'on' : ''}`} key={row.grade}>
              <div className="class-table-head">
                <span className="class-table-name">
                  <span aria-hidden="true">{row.emoji}</span> {row.title}
                  {row.complete && <span className="class-table-done"> ✓ пройден</span>}
                  {row.current && <span className="class-table-now"> · сейчас</span>}
                </span>
                <span className="class-table-nums">
                  {row.mastered} / {row.words} слов
                </span>
              </div>
              <Bar value={row.pct} tone={row.complete ? 'green' : undefined} />
              <div className="class-table-foot">
                <span>освоено {row.pct}%</span>
                <span>
                  {row.lessonsDone} из {row.lessons} {plural(row.lessons, 'урок', 'урока', 'уроков')}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="setting-hint" style={{ marginTop: 8 }}>
          «Пройден» — все уроки класса закрыты до пятого уровня. Слова закрепляются отдельно: их видно по
          проценту освоения.
        </p>
      </div>

      {/* Разбор слабых мест: конкретные слова, а не «мало занимался». */}
      <div className="card">
        <GroupTitle
          title="Что подтянуть за всё время"
          hint={weak.length ? 'Накопленные ошибки по словам; ошибки за сегодня — выше' : undefined}
        />
        {weak.length > 0 ? (
          <>
            <div className="wordlist">
              {weak.map(([id, count]) => (
                <span className="word-chip weak" key={id}>
                  {wordText(id)} · {count}
                </span>
              ))}
            </div>
            <p className="setting-hint" style={{ marginTop: 10 }}>
              Их стоит написать вместе в тетради или проговорить вслух — приложение вернёт эти слова в уроки
              само, по расписанию повторений.
            </p>
            <button className="btn ghost wide sm" onClick={onOpenWords}>
              Посмотреть все слова 📖
            </button>
          </>
        ) : (
          <p className="setting-hint">
            Ошибок пока нет — как только что-то повторится дважды, слово появится здесь.
          </p>
        )}
        {weakTotal > weak.length && (
          <div className="setting-hint">…и ещё {weakTotal - weak.length} слов(а) с единичными ошибками</div>
        )}
      </div>

      <div className="card">
        <GroupTitle
          title="Достижения"
          hint={`получено ${earned} из ${ACHIEVEMENTS.length}`}
        />
        <div className="ach-row">
          {ACHIEVEMENTS.map((a) => {
            const has = profile.achievements.includes(a.id);
            return (
              <div key={a.id} className={`ach ${has ? 'on' : ''}`}>
                <div className="ach-emoji" aria-hidden="true">
                  {a.emoji}
                </div>
                <div className="ach-title">{a.title}</div>
                <div className="setting-hint">{a.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <GroupTitle title="Общее" />
        <div className="kv">
          <span>Кристаллы</span>
          <b>💎 {profile.gems}</b>
        </div>
        <div className="kv">
          <span>Уровень и опыт</span>
          <b>⚡ {profile.xp} XP</b>
        </div>
        <div className="kv">
          <span>«Заморозки» серии</span>
          <b>❄️ {profile.freezes}</b>
        </div>
        <div className="kv">
          <span>Занимается с</span>
          <b>{new Date(profile.createdAt).toLocaleDateString('ru-RU')}</b>
        </div>
      </div>

      {/* Частые дела — прямо из обзора: не нужно искать, в каком разделе они живут. */}
      <div className="quick-actions">
        <button className="btn ghost grow sm" onClick={() => onOpenSection('progress')}>
          💾 Сделать копию
        </button>
        <button className="btn ghost grow sm" onClick={() => onOpenSection('app')}>
          📲 Передать ссылку
        </button>
      </div>
    </div>
  );
}
