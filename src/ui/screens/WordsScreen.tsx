import { useEffect, useState } from 'react';
import {
  AVAILABLE_CLASSES,
  CLASS_META,
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
 *  • в центре по умолчанию «Знаю», при наведении/фокусе — число слов в группе;
 *  • тап по дуге показывает слова группы, повторный тап возвращает все слова;
 *  • дуги показывают доли всех 4 цветов по часовой стрелке от 12 часов;
 *  • без дроби со слэшем («18/94» запрещено решением №3 в PLAN.md): крупно число,
 *    ниже спокойно «из 94».
 */
function MasteryDonut({
  summary, selected, onSelect,
}: { summary: DictionarySummary; selected: WordBucket | 'all'; onSelect: (bucket: WordBucket) => void }) {
  const [preview, setPreview] = useState<WordBucket | null>(null);
  const shown = preview ?? (selected === 'all' ? null : selected);
  const shownCount = shown ? summary.counts[shown] : summary.mastered;
  const R = 40;
  const C = 2 * Math.PI * R;
  const segments = buildDonutSegments(summary.counts, summary.total);
  const gap = segments.length > 1 ? 2.4 : 0;
  const allDone = summary.total > 0 && summary.mastered === summary.total;
  const mainText = String(shownCount);
  const mainFs = mainText.length >= 3 ? 20 : 24;

  const aria =
    `Круговая диаграмма слов: знаю ${summary.counts.good} из ${summary.total}, ` +
    `учу ${summary.counts.mid}, трудные ${summary.counts.weak}, новые ${summary.counts.new}`;

  return (
    <div className={`dict-donut ${allDone ? 'done' : ''}`}>
      <svg viewBox="0 0 104 104" width={100} height={100} role="group" aria-label={aria}>
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
              className={`dict-donut-arc ${shown && shown !== seg.bucket ? 'dimmed' : ''}`}
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
        {segments.map((seg) => {
          const len = segments.length === 1 ? C : Math.max(2, seg.fraction * C - gap);
          return (
            <circle
              key={`hit-${seg.bucket}`}
              className="dict-donut-hit"
              data-donut-hit={seg.bucket}
              role="button"
              tabIndex={0}
              aria-label={`${BUCKET_META[seg.bucket].title}: ${seg.count} ${plural(seg.count, 'слово', 'слова', 'слов')}. ${selected === seg.bucket ? 'Показать все слова' : 'Показать слова этой группы'}`}
              aria-pressed={selected === seg.bucket}
              cx="52" cy="52" r={R} fill="none" stroke="transparent" strokeWidth="24"
              strokeDasharray={`${len} ${Math.max(0, C - len)}`}
              strokeDashoffset={-seg.startFraction * C}
              transform="rotate(-90 52 52)"
              onPointerEnter={(e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') setPreview(seg.bucket); }}
              onPointerLeave={() => setPreview(null)}
              onFocus={() => setPreview(seg.bucket)}
              onBlur={() => setPreview(null)}
              onClick={() => { setPreview(null); onSelect(seg.bucket); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(seg.bucket); }
              }}
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
          fill={shown ? 'var(--ink)' : summary.mastered > 0 ? 'var(--good-ink)' : 'var(--ink)'}
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
          {shown ? BUCKET_META[shown].title : `из ${summary.total}`}
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
 * Компактный выбор класса меняет только просмотр словаря, не программу профиля.
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

  const scopeWords = WORDS_BY_GRADE[grade];
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
    setBucketFilter('all');
    setExpandedCols({});
    setOpen(null);
  };

  const toggleBucket = (b: WordBucket) => {
    setBucketFilter((prev) => (prev === b ? 'all' : b));
  };

  const scopeTitle = `${CLASS_META[grade].emoji} ${CLASS_META[grade].title}`;

  const allMastered = scopeSummary.total > 0 && scopeSummary.remaining === 0;
  const openBucket = word ? wordBucket(profile?.words[word.id]) : 'new';

  return (
    <div className="screen words-screen">
      <div className="dict-top">
        <div className="dict-header mb">
          <h1>Словарик 📖</h1>
          {AVAILABLE_CLASSES.length > 1 && (
            <label className="dict-grade-picker">
              <select
                value={grade}
                aria-label="Класс словарика (не меняет программу обучения)"
                onChange={(e) => pickGrade(Number(e.target.value) as ClassId)}
              >
                {AVAILABLE_CLASSES.map((g) => (
                  <option key={g} value={g}>{g} класс</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Главный блок для ребёнка: круговая диаграмма + ясно сколько уже знает и сколько ещё нет */}
        <section className="card dict-hero mb" data-dict-summary aria-label="Твой прогресс по словам">
          <MasteryDonut summary={scopeSummary} selected={bucketFilter} onSelect={toggleBucket} />
          <div className="dict-hero-body">
            <div className="dict-scope-label">
              {scopeTitle} · {scopeSummary.total}{' '}
              {plural(scopeSummary.total, 'слово', 'слова', 'слов')}
            </div>

            <div className="dict-hero-headline">
              {allMastered ? 'Все слова знаю! 🎉' : `Знаю ${scopeSummary.mastered} из ${scopeSummary.total}`}
            </div>
            <div className="dict-hero-split">
              <span className="dict-stat-pill good">✓ Знаю: <b>{scopeSummary.mastered}</b></span>
              <span className="dict-stat-pill mid">★ Учу: <b>{scopeSummary.inProgress}</b></span>
              <span className="dict-stat-pill rest">○ Новые: <b>{scopeSummary.counts.new}</b></span>
            </div>
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
            ) : null}
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
