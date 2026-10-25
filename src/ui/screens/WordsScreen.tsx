import { useState } from 'react';
import {
  AVAILABLE_CLASSES,
  CLASS_META,
  LESSONS_BY_GRADE,
  WORDS_BY_GRADE,
  WORD_BY_ID,
  availableClass,
} from '../../content/words';
import { useActiveProfile } from '../../state/store';
import { Sentence, WordArt, WordCard } from '../WordView';
import { dangerSummary } from '../../engine/word-facts';
import type { ClassId } from '../../types';

/**
 * Словарик: всё, что учим, с ударениями и «опасными» буквами.
 *
 * Два ряда фильтров: класс → урок. По умолчанию открыт активный класс, смена
 * класса здесь — это только просмотр словаря, программу она не переключает.
 * Список урока берём из `wordIds`, а не из `theme`: у слова может быть два
 * урока в разных классах, и тема — не источник правды.
 */
export function WordsScreen() {
  const profile = useActiveProfile();
  const active = availableClass(profile?.activeClass ?? 2);
  const [grade, setGrade] = useState<ClassId>(active);
  const [lessonFilter, setLessonFilter] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);

  const lessons = LESSONS_BY_GRADE[grade];
  const gradeWords = WORDS_BY_GRADE[grade];
  const lesson = lessons.find((l) => l.id === lessonFilter);
  const list = lesson
    ? lesson.wordIds.map((id) => WORD_BY_ID[id]).filter(Boolean)
    : gradeWords;
  const word = open ? WORD_BY_ID[open] : null;

  const pickGrade = (next: ClassId) => {
    setGrade(next);
    setLessonFilter('all');
    setOpen(null);
  };

  return (
    <div className="screen">
      <h1 className="mb">Словарик 📖</h1>

      {AVAILABLE_CLASSES.length > 1 && (
        <div className="row mb" style={{ overflowX: 'auto', paddingBottom: 4 }}>
          {AVAILABLE_CLASSES.map((g) => (
            <button
              key={g}
              className={`chip ${grade === g ? 'on' : ''}`}
              aria-pressed={grade === g}
              onClick={() => pickGrade(g)}
            >
              {CLASS_META[g].emoji} {CLASS_META[g].title}
            </button>
          ))}
        </div>
      )}

      <div className="row mb" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <button className={`chip ${lessonFilter === 'all' ? 'on' : ''}`} onClick={() => setLessonFilter('all')}>
          Все
        </button>
        {lessons.map((l) => (
          <button
            key={l.id}
            className={`chip ${lessonFilter === l.id ? 'on' : ''}`}
            onClick={() => setLessonFilter(l.id)}
          >
            {l.emoji} {l.title}
          </button>
        ))}
      </div>

      <p className="tiny mb">
        {CLASS_META[grade].title} · {list.length}{' '}
        {list.length === 1 ? 'слово' : list.length < 5 ? 'слова' : 'слов'}
      </p>

      <div className="wordlist">
        {list.map((w) => {
          const st = profile?.words[w.id];
          const s = st?.s ?? 0;
          const cls = s >= 90 ? 'good' : s >= 40 ? 'mid' : st && st.wrong > 0 ? 'weak' : '';
          return (
            <button key={w.id} className={`word-chip ${cls}`} onClick={() => setOpen(w.id)}>
              {w.image ? (
                <WordArt word={w} size={22} lazy className="word-chip-art" />
              ) : (
                <span aria-hidden="true">{w.emoji}</span>
              )}{' '}
              {w.text}
            </button>
          );
        })}
      </div>

      {word && (
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <WordCard word={word} className="wcard-modal">
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
              {profile?.words[word.id] && (
                <p className="tiny center">
                  {/* 0.66.0: «освоенность» — слово взрослого, ребёнку оно ничего не говорит. */}
                  знаешь на {profile.words[word.id].s}% · ошибок: {profile.words[word.id].wrong}
                </p>
              )}
              <button className="btn ghost wide" onClick={() => setOpen(null)}>
                Закрыть
              </button>
            </WordCard>
          </div>
        </div>
      )}
    </div>
  );
}
