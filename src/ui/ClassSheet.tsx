import { useEffect } from 'react';
import { AVAILABLE_CLASSES, CLASS_META, availableClass } from '../content/words';
import { useApp } from '../state/store';
import { classProgress, nextClass } from '../engine/classes';
import { plural } from '../engine/quests';
import type { ClassId, Profile } from '../types';

function wordsLabel(n: number): string {
  return `${n} ${plural(n, 'слово', 'слова', 'слов')}`;
}

/**
 * Нижний лист «Какой класс учим?» (docs/proposals/classes-1-4.md).
 *
 * До 0.33.0 это была пилюля на главной: 44 px + отступ, то есть 54 px первого
 * экрана ради действия, которое случается 1–3 раза в год. Теперь лист
 * открывается строкой «Класс» из меню ☰, а подсказкой служит заголовок
 * «Мой путь · 2 класс» — он и так стоит на экране.
 *
 * Смена класса — это переключение программы, а не начало заново: опыт,
 * кристаллы, серия, награды и покупки остаются. Поэтому подтверждения нет,
 * но после выбора показывается тост с этим объяснением.
 */
export function ClassSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const setActiveClass = useApp((s) => s.setActiveClass);
  const showToast = useApp((s) => s.showToast);
  const active = availableClass(profile.activeClass ?? 2);
  const meta = CLASS_META[active];
  const activeInfo = classProgress(profile, active);
  const next = nextClass(active);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Один класс в сборке — выбирать нечего, и строки в меню тоже нет.
  if (AVAILABLE_CLASSES.length < 2) return null;

  const choose = (grade: ClassId) => {
    onClose();
    if (grade === active) return;
    setActiveClass(grade);
    showToast({
      emoji: CLASS_META[grade].emoji,
      title: `${CLASS_META[grade].title} · программа переключена`,
      text: 'Опыт, кристаллы и покупки на месте',
    });
  };

  return (
    <div className="sheet-backdrop class-backdrop" onClick={onClose}>
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
          <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="class-list">
          {AVAILABLE_CLASSES.map((grade) => {
            const info = classProgress(profile, grade);
            const on = grade === active;
            return (
              <button
                key={grade}
                type="button"
                className={`class-card ${on ? 'on' : ''} ${info.complete ? 'done' : ''}`}
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
                    {info.complete ? (
                      <>✓ пройден · {wordsLabel(info.words)} · все {info.lessons} {plural(info.lessons, 'урок', 'урока', 'уроков')}</>
                    ) : (
                      <>{wordsLabel(info.words)} · пройдено {info.lessonsDone} из {info.lessons} · слов освоено {info.mastered}</>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {activeInfo.complete && next && (
          <p className="class-sheet-next">🎉 {meta.title} пройден — можно перейти в {CLASS_META[next].title}.</p>
        )}
        <p className="tiny center" style={{ marginTop: 12 }}>Прогресс и покупки сохраняются.</p>
      </div>
    </div>
  );
}
