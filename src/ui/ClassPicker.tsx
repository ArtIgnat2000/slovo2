import { useEffect, useState } from 'react';
import {
  AVAILABLE_CLASSES,
  CLASS_META,
  LESSONS_BY_GRADE,
  WORDS_BY_GRADE,
  availableClass,
} from '../content/words';
import { useApp } from '../state/store';
import { plural } from '../engine/quests';
import type { ClassId, Profile } from '../types';

function wordsLabel(n: number): string {
  return `${n} ${plural(n, 'слово', 'слова', 'слов')}`;
}

/**
 * Пилюля класса + нижний лист «Какой класс учим?» (docs/proposals/classes-1-4.md).
 *
 * Смена класса — это переключение программы, а не начало заново: опыт,
 * кристаллы, серия, награды и покупки остаются. Поэтому подтверждения нет,
 * но после выбора показывается тост с этим объяснением.
 */
export function ClassPicker({ profile }: { profile: Profile }) {
  const setActiveClass = useApp((s) => s.setActiveClass);
  const showToast = useApp((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const active = availableClass(profile.activeClass ?? 2);
  const meta = CLASS_META[active];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Один класс в сборке — выбирать нечего, пилюля только занимала бы место.
  if (AVAILABLE_CLASSES.length < 2) return null;

  const choose = (grade: ClassId) => {
    setOpen(false);
    if (grade === active) return;
    setActiveClass(grade);
    showToast({
      emoji: CLASS_META[grade].emoji,
      title: `${CLASS_META[grade].title} · программа переключена`,
      text: 'Опыт, кристаллы и покупки на месте',
    });
  };

  return (
    <>
      <button
        type="button"
        className="class-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">{meta.emoji}</span>
        <span className="class-pill-title">{meta.title}</span>
        <span className="class-pill-count">{wordsLabel(WORDS_BY_GRADE[active].length)}</span>
        <span className="class-pill-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="sheet-backdrop class-backdrop" onClick={() => setOpen(false)}>
          <div
            className="class-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Какой класс учим?"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row mb">
              <h2 className="grow" style={{ margin: 0 }}>
                Какой класс учим?
              </h2>
              <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div className="class-list">
              {AVAILABLE_CLASSES.map((grade) => {
                const lessons = LESSONS_BY_GRADE[grade];
                const done = lessons.filter((l) => (profile.lessons[l.id]?.level ?? 0) >= 5).length;
                const words = WORDS_BY_GRADE[grade].length;
                const on = grade === active;
                return (
                  <button
                    key={grade}
                    type="button"
                    className={`class-card ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() => choose(grade)}
                  >
                    <span className="class-card-emoji" aria-hidden="true">
                      {CLASS_META[grade].emoji}
                    </span>
                    <span className="grow">
                      <span className="class-card-title">
                        {CLASS_META[grade].title}
                        {on && <span className="class-card-check" aria-hidden="true"> ✓</span>}
                      </span>
                      <span className="class-card-meta">
                        {wordsLabel(words)} · пройдено {done} из {lessons.length}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="tiny center" style={{ marginTop: 12 }}>
              Меняется только набор слов. Опыт, кристаллы, серия, награды и покупки остаются.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
