import { useEffect, useState } from 'react';
import {
  AVAILABLE_CLASSES,
  CLASS_META,
  LESSONS_BY_GRADE,
  WORDS_BY_GRADE,
  WORD_BY_ID,
  availableClass,
} from '../../content/words';
import {
  BUCKET_META,
  COLLAPSE_PREVIEW_COUNT,
  buildDictionarySummary,
  buildDonutSegments,
  columnTotalLabel,
  matchesWordQuery,
  wordBucket,
  type DictionarySummary,
  type WordBucket,
} from '../../engine/dictionary';
import { dangerSummary, plural } from '../../engine/word-facts';
import { useActiveProfile } from '../../state/store';
import type { ClassId } from '../../types';
import { Sentence, WordArt, WordCard } from '../WordView';

const DONUT_STROKE: Record<WordBucket, string> = {
  good: 'var(--green)',
  mid: 'var(--orange)',
  weak: 'var(--red)',
  new: 'var(--dict-new-ring)',
};

/**
 * Кольцевая круговая диаграмма словарика.
 *
 * Почему кольцо, а не сплошной «пирог»:
 *  • в центре сразу стоит главный ответ ребёнка — сколько слов уже в «Знаю» из всех;
 *  • дуги показывают доли всех 4 цветов по часовой стрелке от 12 часов;
 *  • без дроби со слэшем («18/94» запрещено решением №3 в PLAN.md): крупно число,
 *    ниже спокойно «из 94».
 */
function MasteryDonut({ summary }: { summary: DictionarySummary }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const segments = buildDonutSegments(summary.counts, summary.total);
  const gap = segments.length > 1 ? 2.4 : 0;
  const allDone = summary.total > 0 && summary.mastered === summary.total;
  const mainText = String(summary.mastered);
  const mainFs = mainText.length >= 3 ? 20 : 24;

  const aria =
    `Круговая диаграмма слов: знаю ${summary.counts.good} из ${summary.total}, ` +
    `учу ${summary.counts.mid}, трудные ${summary.counts.weak}, новые ${summary.counts.new}`;

  return (
    <div className={`dict-donut ${allDone ? 'done' : ''}`} role="img" aria-label={aria}>
      <svg viewBox="0 0 104 104" width={100} height={100}>
        <circle
          cx="52"
          cy="52"
          r={R}
          fill="none"
          stroke="var(--dict-new-track)"
          strokeWidth="13"
        />
        {segments.map((seg) => {
          const len = segments.length === 1 ? C : Math.max(2, seg.fraction * C - gap);
          return (
            <circle
              key={seg.bucket}
              className="dict-donut-arc"
              data-donut-arc={seg.bucket}
              cx="52"
              cy="52"
              r={R}
              fill="none"
              stroke={DONUT_STROKE[seg.bucket]}
              strokeWidth="13"
              strokeLinecap="butt"
              strokeDasharray={`${len} ${Math.max(0, C - len)}`}
              strokeDashoffset={-seg.startFraction * C}
              transform="rotate(-90 52 52)"
            />
          );
        })}
        <text
          x="52"
          y="45"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={mainFs}
          fontWeight={800}
          fill={summary.mastered > 0 ? 'var(--good-ink)' : 'var(--ink)'}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {mainText}
        </text>
        <text
          x="52"
          y="66"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11.5}
          fontWeight={700}
          fill="var(--ink-2)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          из {summary.total}
        </text>
      </svg>
      {allDone && (
        <span className="dict-donut-done" aria-hidden="true">
          ✓
        </span>
      )}
    </div>
  );
}

/**
 * Словарик: всё, что учим, структурировано по цветам и степени владения словом.
 *
 * Два ряда фильтров сверху: класс → урок. По умолчанию открыт активный класс;
 * смена класса здесь — это только просмотр словаря, программу она не переключает.
 * Список урока берём из `wordIds`, а не из `theme`: у слова может быть два
 * урока в разных классах, и тема — не источник правды.
 *
 * Ниже:
 *  1) сводка с круговой диаграммой — сколько слов ребёнок уже знает и сколько осталось;
 *  2) легенда цветов — что означает каждый цвет (с возможностью сфокусироваться на группе);
 *  3) быстрый поиск слова (понимает «е» вместо «ё»);
 *  4) четыре цветовые колонки с подведением итога по количеству слов в каждой колонке.
 */
export function WordsScreen() {
  const profile = useActiveProfile();
  const active = availableClass(profile?.activeClass ?? 2);
  const [grade, setGrade] = useState<ClassId>(active);
  const [lessonFilter, setLessonFilter] = useState<string>('all');
  const [bucketFilter, setBucketFilter] = useState<'all' | WordBucket>('all');
  const [query, setQuery] = useState<string>('');
  const [expandedCols, setExpandedCols] = useState<Partial<Record<WordBucket, boolean>>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const lessons = LESSONS_BY_GRADE[grade];
  const gradeWords = WORDS_BY_GRADE[grade];
  const lesson = lessons.find((l) => l.id === lessonFilter);
  const scopeWords = lesson
    ? lesson.wordIds.map((id) => WORD_BY_ID[id]).filter(Boolean)
    : gradeWords;
  const word = open ? WORD_BY_ID[open] : null;

  const scopeSummary = buildDictionarySummary(scopeWords, profile?.words);
  const trimmedQuery = query.trim();
  const filteredWords = trimmedQuery
    ? scopeWords.filter((w) => matchesWordQuery(w, trimmedQuery))
    : scopeWords;
  const boardSummary = trimmedQuery
    ? buildDictionarySummary(filteredWords, profile?.words)
    : scopeSummary;
  const visibleGroups =
    bucketFilter === 'all'
      ? boardSummary.groups
      : boardSummary.groups.filter((g) => g.bucket === bucketFilter);

  const pickGrade = (next: ClassId) => {
    setGrade(next);
    setLessonFilter('all');
    setBucketFilter('all');
    setExpandedCols({});
    setOpen(null);
  };

  const pickLesson = (next: string) => {
    setLessonFilter(next);
    setExpandedCols({});
  };

  const toggleBucket = (b: WordBucket) => {
    setBucketFilter((prev) => (prev === b ? 'all' : b));
  };

  const scopeTitle = lesson
    ? `${lesson.emoji} ${lesson.title}`
    : `${CLASS_META[grade].emoji} ${CLASS_META[grade].title}`;

  const allMastered = scopeSummary.total > 0 && scopeSummary.remaining === 0;
  const openState = word ? profile?.words[word.id] : undefined;
  const openBucket = word ? wordBucket(openState) : 'new';

  return (
    <div className="screen words-screen">
      <div className="dict-top">
        <h1 className="mb">Словарик 📖</h1>

        {AVAILABLE_CLASSES.length > 1 && (
          <div className="row mb dict-scroll-row" role="group" aria-label="Выбор класса">
            {AVAILABLE_CLASSES.map((g) => (
              <button
                key={g}
                type="button"
                className={`chip ${grade === g ? 'on' : ''}`}
                aria-pressed={grade === g}
                onClick={() => pickGrade(g)}
              >
                {CLASS_META[g].emoji} {CLASS_META[g].title}
              </button>
            ))}
          </div>
        )}

        <div className="row mb dict-scroll-row" role="group" aria-label="Фильтр по теме урока">
          <button
            type="button"
            className={`chip ${lessonFilter === 'all' ? 'on' : ''}`}
            aria-pressed={lessonFilter === 'all'}
            onClick={() => pickLesson('all')}
          >
            Все темы
          </button>
          {lessons.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${lessonFilter === l.id ? 'on' : ''}`}
              aria-pressed={lessonFilter === l.id}
              onClick={() => pickLesson(l.id)}
            >
              {l.emoji} {l.title}
            </button>
          ))}
        </div>

        {/* Главный блок для ребёнка: круговая диаграмма + ясно сколько уже знает и сколько ещё нет */}
        <section className="card dict-hero mb" data-dict-summary aria-label="Твой прогресс по словам">
          <MasteryDonut summary={scopeSummary} />
          <div className="dict-hero-body">
            <div className="dict-scope-label">
              {scopeTitle} · {scopeSummary.total}{' '}
              {plural(scopeSummary.total, 'слово', 'слова', 'слов')}
            </div>

            {allMastered ? (
              <>
                <div className="dict-hero-headline">
                  Все {scopeSummary.total}{' '}
                  {plural(scopeSummary.total, 'слово', 'слова', 'слов')} знаю! 🎉
                </div>
                <div className="dict-hero-split">
                  <span className="dict-stat-pill good">
                    ✓ Знаю: <b>{scopeSummary.mastered}</b> ({scopeSummary.masteredPct}%)
                  </span>
                  <span className="dict-stat-pill rest">
                    Осталось выучить: <b>0</b>
                  </span>
                </div>
                <p className="dict-hero-note">Отличная работа — все слова зелёные!</p>
              </>
            ) : (
              <>
                <div className="dict-hero-headline">
                  Знаю {scopeSummary.mastered}{' '}
                  {plural(scopeSummary.mastered, 'слово', 'слова', 'слов')}
                  {scopeSummary.mastered > 0 && (
                    <span className="dict-pct-badge">{scopeSummary.masteredPct}%</span>
                  )}
                </div>
                <div className="dict-hero-split">
                  <span className="dict-stat-pill good">
                    ✓ Уже знаю: <b>{scopeSummary.mastered}</b>
                  </span>
                  <span className="dict-stat-pill rest">
                    Осталось выучить: <b>{scopeSummary.remaining}</b>
                  </span>
                </div>
                <p className="dict-hero-note">
                  {scopeSummary.inProgress > 0
                    ? `Из оставшихся уже учу ${scopeSummary.inProgress}, совсем новых — ${scopeSummary.counts.new}`
                    : scopeSummary.mastered > 0
                      ? `Впереди ещё ${scopeSummary.counts.new} ${plural(scopeSummary.counts.new, 'новое слово', 'новых слова', 'новых слов')}`
                      : 'Начни урок — и круг начнёт закрашиваться!'}
                </p>
              </>
            )}
          </div>
        </section>

        {/* Легенда цветов: объясняет каждый цвет и позволяет отфильтровать нужную колонку */}
        <section className="dict-legend mb" data-dict-legend aria-label="Легенда цветов">
          <div className="dict-section-head">
            <h2 className="dict-section-title">Что означают цвета</h2>
            {bucketFilter !== 'all' ? (
              <button
                type="button"
                className="btn ghost sm dict-filter-reset"
                onClick={() => setBucketFilter('all')}
              >
                Все 4 колонки
              </button>
            ) : (
              <span className="tiny">нажми на цвет, чтобы выбрать группу</span>
            )}
          </div>

          <div className="dict-legend-grid">
            {scopeSummary.groups.map(({ bucket, meta, count }) => {
              const isSelected = bucketFilter === bucket;
              return (
                <button
                  key={bucket}
                  type="button"
                  className={`dict-legend-item ${bucket} ${isSelected ? 'active' : ''}`}
                  data-legend={bucket}
                  aria-pressed={isSelected}
                  onClick={() => toggleBucket(bucket)}
                >
                  <span className={`dict-swatch ${bucket}`} aria-hidden="true">
                    {meta.badge}
                  </span>
                  <span className="dict-legend-text">
                    <span className="dict-legend-top">
                      <span className="dict-legend-name">{meta.title}</span>
                      <span className={`dict-legend-count ${bucket}`}>
                        {count} {plural(count, 'слово', 'слова', 'слов')}
                      </span>
                    </span>
                    <span className="dict-legend-desc">{meta.legend}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Быстрый поиск по словарику */}
        <div className="dict-search-row mb">
          <div className="dict-search-box">
            <span className="dict-search-icon" aria-hidden="true">
              🔎
            </span>
            <input
              type="search"
              className="dict-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти слово в словарике…"
              aria-label="Найти слово в словарике"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                className="dict-search-clear"
                aria-label="Очистить поиск"
                onClick={() => setQuery('')}
              >
                ✕
              </button>
            )}
          </div>
          {trimmedQuery && (
            <p className="tiny dict-search-status">
              По запросу «{trimmedQuery}» найдено: {boardSummary.total}{' '}
              {plural(boardSummary.total, 'слово', 'слова', 'слов')}
            </p>
          )}
        </div>
      </div>

      {/* Четыре цветовые колонки с подведением итога по количеству слов в каждой */}
      {trimmedQuery && boardSummary.total === 0 ? (
        <div className="card dict-empty-search">
          <p className="dict-empty-title">Такого слова здесь не нашлось</p>
          <p className="tiny">Проверь буквы или посмотри в другом классе.</p>
          <button type="button" className="btn ghost sm" onClick={() => setQuery('')}>
            Сбросить поиск
          </button>
        </div>
      ) : (
        <div
          className={`dict-board ${bucketFilter !== 'all' ? 'single' : ''}`}
          data-dict-board
        >
          {visibleGroups.map((group) => {
            const canCollapse =
              bucketFilter === 'all' &&
              !trimmedQuery &&
              group.words.length > COLLAPSE_PREVIEW_COUNT;
            const isExpanded = !!expandedCols[group.bucket];
            const shownWords =
              canCollapse && !isExpanded
                ? group.words.slice(0, COLLAPSE_PREVIEW_COUNT)
                : group.words;
            const hiddenCount = group.words.length - shownWords.length;

            return (
              <section
                key={group.bucket}
                className={`dict-col dict-col-${group.bucket}`}
                data-word-column={group.bucket}
                aria-label={`${group.meta.title} — ${columnTotalLabel(group.count)}`}
              >
                <header className="dict-col-head">
                  <span className={`dict-swatch ${group.bucket}`} aria-hidden="true">
                    {group.meta.badge}
                  </span>
                  <div className="dict-col-titles">
                    <h3 className="dict-col-title">{group.meta.title}</h3>
                    <span className="dict-col-hint">{group.meta.columnHint}</span>
                  </div>
                  <span className={`dict-col-count ${group.bucket}`}>{group.count}</span>
                </header>

                <div className="dict-col-body">
                  {group.words.length === 0 ? (
                    <p className="dict-col-empty">
                      {trimmedQuery ? 'Подходящих слов в этой колонке нет' : group.meta.emptyText}
                    </p>
                  ) : (
                    <>
                      <div className="wordlist">
                        {shownWords.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className={`word-chip ${group.meta.chipClass}`.trim()}
                            onClick={() => setOpen(w.id)}
                          >
                            {w.image ? (
                              <WordArt word={w} size={22} lazy className="word-chip-art" />
                            ) : (
                              <span aria-hidden="true">{w.emoji}</span>
                            )}{' '}
                            {w.text}
                          </button>
                        ))}
                      </div>
                      {canCollapse && (
                        <button
                          type="button"
                          className="btn ghost sm dict-more-btn"
                          data-col-expand={group.bucket}
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedCols((prev) => ({
                              ...prev,
                              [group.bucket]: !prev[group.bucket],
                            }))
                          }
                        >
                          {isExpanded
                            ? 'Свернуть список ⌃'
                            : `Ещё ${hiddenCount} · показать все ${group.count} ⌄`}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <footer className="dict-col-foot" data-col-total={group.bucket}>
                  <span className="dict-col-total-label">{columnTotalLabel(group.count)}</span>
                  <span className="dict-col-total-pct">{group.pct}%</span>
                </footer>
              </section>
            );
          })}
        </div>
      )}

      {word && (
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <WordCard word={word} className="wcard-modal">
              <div className="row wrap-center">
                <span className={`dict-modal-status ${openBucket}`}>
                  {BUCKET_META[openBucket].badge} {BUCKET_META[openBucket].cardStatus}
                </span>
              </div>
              <div className="row wrap-center">
                {word.syllables.map((s, i) => (
                  <span className="chip" key={i}>
                    {s}
                  </span>
                ))}
              </div>
              <Sentence word={word} hidden={false} />
              {word.mnemonic && <div className="banner">💡 {word.mnemonic}</div>}
              <p className="tiny center">{dangerSummary(word)}</p>
              {openState && (
                <p className="tiny center">
                  {/* 0.66.0: «освоенность» — слово взрослого, ребёнку оно ничего не говорит. */}
                  знаешь на {openState.s}% · ошибок: {openState.wrong}
                </p>
              )}
              <button type="button" className="btn ghost wide" onClick={() => setOpen(null)}>
                Закрыть
              </button>
            </WordCard>
          </div>
        </div>
      )}
    </div>
  );
}
