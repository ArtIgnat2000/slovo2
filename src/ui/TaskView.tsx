import { useEffect, useState, useRef } from 'react';
import type { Task, Word } from '../types';
import { Sentence, WordArt, WordClue, WordLetters, dangerSummary } from './WordView';
import { Keyboard } from './Keyboard';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

export type SolveFn = (quality: number | null, given?: string) => void;

interface Props {
  task: Task;
  word: Word;
  onSolve: SolveFn;
  onAttempt?: (quality: number) => void;
}

export function TaskView({ task, word, onSolve, onAttempt }: Props) {
  switch (task.kind) {
    case 'intro':
      return <Intro word={word} onSolve={onSolve} />;
    case 'syllables':
      return <Syllables word={word} onSolve={onSolve} />;
    case 'gap':
      return <Gap word={word} task={task} onSolve={onSolve} />;
    case 'build':
      return <Build word={word} task={task} onSolve={onSolve} onAttempt={onAttempt} />;
    case 'write':
      return <Write word={word} task={task} onSolve={onSolve} />;
    case 'visual':
      return <Visual word={word} task={task} onSolve={onSolve} />;
    case 'fix':
      return <Fix word={word} task={task} onSolve={onSolve} />;
    default:
      return null;
  }
}

// ── Подсказки: единые правила для всех заданий ──────────────────────────────
//
// 1. Кнопка «💡 Подсказка» есть в каждом задании и всегда выглядит одинаково.
// 2. У каждого задания своя «механическая» помощь: 50:50 в окошке, подстановка
//    буквы в сборке, контур слова при письме, подглядывание в диктанте…
// 3. Вместе с помощью раскрывается мнемоника (или объяснение опасной буквы) —
//    подсказка должна учить, а не просто давать ответ.
// 4. Ответ с подсказкой приносит меньше XP (quality 3 → XP.taskWithHint),
//    но остаётся «правильным» — подсказка не наказывается жёстко.

function HintBtn({
  onClick,
  label = 'Подсказка',
  disabled,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="btn ghost sm"
      onClick={() => {
        sfx.hint();
        onClick();
      }}
      disabled={disabled}
    >
      💡 {label}
    </button>
  );
}

/** Мнемоника или объяснение опасных букв — второй слой каждой подсказки. */
function HintCard({ word }: { word: Word }) {
  return <div className="banner">💡 {word.mnemonic ?? dangerSummary(word)}</div>;
}

// ── 1. Знакомство: LOOK → SAY → увидеть опасное место ────────────────────────

function Intro({ word, onSolve }: { word: Word; onSolve: SolveFn }) {
  const [showHint, setShowHint] = useState(false);
  return (
    <div className="task">
      <WordArt word={word} size={120} />
      <WordLetters word={word} stress markDanger blink />
      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {word.syllables.map((s, i) => (
          <span key={i} className="chip">
            {s}
          </span>
        ))}
      </div>
      <Sentence word={word} hidden={false} />
      <p className="muted center">{word.hint}</p>
      {word.mnemonic && <div className="banner">💡 {word.mnemonic}</div>}
      {word.danger.length ? (
        <p className="tiny center">
          Оранжевая — «опасная» буква. Посмотри на слово, проговори его так, как пишется, и закрой глаза —
          представь эту букву.
        </p>
      ) : (
        <p className="tiny center">
          Здесь нет «опасных» букв — слово пишется так, как слышится. Посмотри на слово, проговори его и
          закрой глаза — представь все буквы.
        </p>
      )}
      {showHint ? (
        <div className="banner">🔎 {dangerSummary(word)}</div>
      ) : (
        <HintBtn onClick={() => setShowHint(true)} label="Какие буквы опасные?" />
      )}
      <button
        className="btn green wide lg"
        onClick={() => {
          sfx.tap();
          haptic.tap();
          onSolve(null);
        }}
      >
        Запомнил! 👍
      </button>
    </div>
  );
}

// ── 2. Орфографическое проговаривание ───────────────────────────────────────

function Syllables({ word, onSolve }: { word: Word; onSolve: SolveFn }) {
  const later = useTaskTimeout();
  const [step, setStep] = useState(0);
  const [showHint, setShowHint] = useState(false);
  return (
    <div className="task">
      <WordLetters word={word} stress markDanger={showHint} />
      <p className="prompt">Прочитай по слогам — как пишется 👇</p>
      <div className="syllables">
        {word.syllables.map((s, i) => (
          <button
            key={i}
            className={`syllable ${i < step ? 'done' : ''} ${i === step ? 'next' : ''}`}
            disabled={i !== step}
            onClick={() => {
              sfx.tap();
              haptic.tap();
              setStep(i + 1);
              if (i + 1 === word.syllables.length) later(() => onSolve(null), 400);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <Sentence word={word} hidden={false} />
      {showHint ? <HintCard word={word} /> : <HintBtn onClick={() => setShowHint(true)} label="Показать опасную букву" />}
    </div>
  );
}

// ── 3. Окошко ───────────────────────────────────────────────────────────────

function Gap({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const later = useTaskTimeout();
  const [chosen, setChosen] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const correct = word.text[task.dangerIdx];

  const pick = (l: string) => {
    if (chosen) return;
    setChosen(l);
    const ok = l === correct;
    sfx.tap();
    if (ok) {
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
    later(() => onSolve(ok ? (hintUsed ? 3 : 5) : 0, l), ok ? 700 : 1200);
  };

  /** Подсказка «50:50» — как в телевикторине: убираем две неверные буквы. */
  const hint = () => {
    if (chosen || hintUsed) return;
    const wrongs = (task.options ?? []).filter((o) => o !== correct);
    const drop = [...wrongs].sort(() => Math.random() - 0.5).slice(0, 2);
    setEliminated(drop);
    setHintUsed(true);
  };

  return (
    <div className="task">
      <p className="prompt">Какая буква спряталась?</p>
      <WordLetters word={word} stress markDanger hide={[task.dangerIdx]} />
      <Sentence word={word} />
      <div className="options">
        {(task.options ?? []).map((o) => {
          const out = eliminated.includes(o);
          const cls = !chosen ? (out ? 'dim' : '') : o === correct ? 'ok' : o === chosen ? 'bad' : 'dim';
          return (
            <button key={o} className={`option ${cls}`} disabled={!!chosen || out} onClick={() => pick(o)}>
              {o.toUpperCase()}
            </button>
          );
        })}
      </div>
      {hintUsed ? (
        word.mnemonic ? (
          <div className="banner">💡 {word.mnemonic}</div>
        ) : (
          <p className="tiny">Осталось два варианта — вспомни, как пишется! 👆</p>
        )
      ) : (
        !chosen && <HintBtn onClick={hint} label="Убрать две буквы" />
      )}
    </div>
  );
}

// ── 4. Собери слово ─────────────────────────────────────────────────────────

function Build({ word, task, onSolve, onAttempt }: Props) {
  const later = useTaskTimeout();
  const letters = task.letters ?? [];
  const [placed, setPlaced] = useState<(string | null)[]>(Array(word.text.length).fill(null));
  const [used, setUsed] = useState<boolean[]>(letters.map(() => false));
  const [hintUsed, setHintUsed] = useState(false);
  const [bad, setBad] = useState(false);
  const solved = useRef(false);

  // usedHint передаём явно: подсказка может поставить последнюю букву и завершить
  // задание в том же обработчике — state hintUsed к этому моменту ещё «старый».
  const finish = (arr: (string | null)[], usedHint = hintUsed) => {
    const s = arr.join('');
    onAttempt?.(s === word.text ? (usedHint ? 3 : 5) : 0);
    if (s === word.text) {
      solved.current = true;
      sfx.correct();
      haptic.correct();
      later(() => onSolve(usedHint ? 3 : 5), 700);
    } else {
      sfx.wrong();
      haptic.wrong();
      setBad(true);
      later(() => {
        setPlaced(Array(word.text.length).fill(null));
        setUsed(letters.map(() => false));
        setBad(false);
      }, 900);
    }
  };

  const tapLetter = (i: number) => {
    if (solved.current || used[i] || bad) return;
    const slot = placed.findIndex((p) => p === null);
    if (slot < 0) return;
    sfx.tap();
    const np = [...placed];
    np[slot] = letters[i];
    const nu = [...used];
    nu[i] = true;
    setPlaced(np);
    setUsed(nu);
    if (!np.includes(null)) finish(np);
  };

  const tapSlot = (i: number) => {
    if (solved.current || bad || placed[i] === null) return;
    const l = placed[i]!;
    let idx = -1;
    for (let j = used.length - 1; j >= 0; j--) if (used[j] && letters[j] === l) idx = j;
    const np = [...placed];
    np[i] = null;
    const nu = [...used];
    if (idx >= 0) nu[idx] = false;
    setPlaced(np);
    setUsed(nu);
    sfx.tap();
  };

  /** Подсказка ставит следующую букву на своё место; повторные нажатия — ещё букву. */
  const hint = () => {
    const slot = placed.findIndex((p) => p === null);
    if (solved.current || slot < 0 || bad) return;
    const need = word.text[slot];
    const li = letters.findIndex((l, j) => !used[j] && l === need);
    if (li < 0) return;
    setHintUsed(true);
    const np = [...placed];
    np[slot] = need;
    const nu = [...used];
    nu[li] = true;
    setPlaced(np);
    setUsed(nu);
    if (!np.includes(null)) finish(np, true);
  };

  return (
    <div className="task">
      <WordClue word={word} />
      <p className="prompt">Собери слово из букв</p>
      <div className={`slots ${bad ? 'shake' : ''}`}>
        {placed.map((l, i) => (
          <button
            key={i}
            className={`slot ${l ? 'filled' : ''} ${bad ? 'bad' : ''}`}
            onClick={() => tapSlot(i)}
          >
            {l ?? ''}
          </button>
        ))}
      </div>
      <div className="letters">
        {letters.map((l, i) => (
          <button key={i} className={`letter ${used[i] ? 'used' : ''}`} onClick={() => tapLetter(i)}>
            {l}
          </button>
        ))}
      </div>
      {!bad && placed.includes(null) && (
        <HintBtn onClick={hint} label={hintUsed ? 'Ещё букву' : 'Подставить букву'} />
      )}
      {hintUsed && <HintCard word={word} />}
    </div>
  );
}

// ── 5. Напиши слово по памяти ───────────────────────────────────────────────

function Write({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const later = useTaskTimeout();
  const [val, setVal] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [hintUsed, setHintUsed] = useState(false);

  const key = (k: string) => {
    if (state !== 'idle') return;
    sfx.tap();
    if (k === '⌫') setVal((v) => v.slice(0, -1));
    else if (val.length < word.text.length + 2) setVal((v) => v + k);
  };

  const check = () => {
    const ok = val.trim().toLowerCase() === word.text.toLowerCase();
    setState(ok ? 'ok' : 'bad');
    if (ok) {
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
    later(() => onSolve(ok ? (hintUsed ? 3 : 5) : 0, val.trim()), ok ? 700 : 1300);
  };

  const hideAll = word.text.split('').map((_, i) => i).filter((i) => i !== task.dangerIdx);

  return (
    <div className="task">
      <WordClue word={word} />
      <p className="prompt">Напиши слово ✍️</p>
      {hintUsed && (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <WordLetters word={word} markDanger hide={hideAll} small />
          <p className="tiny">Опасная буква — {word.text[task.dangerIdx].toUpperCase()}</p>
          <HintCard word={word} />
        </div>
      )}
      <div className={`typed ${state}`} style={{ minHeight: 56 }}>
        {val || <span style={{ opacity: 0.3 }}>·</span>}
      </div>
      <Keyboard onKey={key} disabled={state !== 'idle'} />
      {state === 'idle' && (
        <div className="row" style={{ width: '100%' }}>
          {!hintUsed && <HintBtn onClick={() => setHintUsed(true)} />}
          <button className="btn primary wide lg" disabled={!val} onClick={check}>
            Проверить ✓
          </button>
        </div>
      )}
    </div>
  );
}

// ── 6. Зрительный диктант ───────────────────────────────────────────────────

function Visual({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const later = useTaskTimeout();
  const ms = task.showMs ?? 2600;
  const [phase, setPhase] = useState<'show' | 'type'>('show');
  const [left, setLeft] = useState(ms);
  const [val, setVal] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [peek, setPeek] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  useEffect(() => {
    if (phase !== 'show') return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 200) {
          clearInterval(t);
          setPhase('type');
          return 0;
        }
        return l - 200;
      });
    }, 200);
    return () => clearInterval(t);
  }, [phase, ms]);

  // Подглядывание: слово мелькает на пару секунд и снова прячется
  useEffect(() => {
    if (!peek) return;
    const t = later(() => setPeek(false), 1900);
    return () => clearTimeout(t);
  }, [peek]);

  const key = (k: string) => {
    if (state !== 'idle') return;
    sfx.tap();
    if (k === '⌫') setVal((v) => v.slice(0, -1));
    else if (val.length < word.text.length + 2) setVal((v) => v + k);
  };

  const check = () => {
    const ok = val.trim().toLowerCase() === word.text.toLowerCase();
    setState(ok ? 'ok' : 'bad');
    if (ok) {
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
    later(() => onSolve(ok ? (hintUsed ? 3 : 5) : 0, val.trim()), ok ? 700 : 1300);
  };

  if (phase === 'show') {
    return (
      <div className="task">
        <p className="prompt">Запомни слово! 👀</p>
        <WordLetters word={word} stress />
        <div className="bar orange" style={{ width: '100%' }}>
          <i style={{ width: `${(left / ms) * 100}%`, transition: 'width .2s linear' }} />
        </div>
        <p className="muted">Скоро спрячем — напишешь по памяти</p>
      </div>
    );
  }

  return (
    <div className="task">
      <WordClue word={word} />
      <p className="prompt">Напиши слово ✍️</p>
      {peek && (
        <div className="banner center">
          <WordLetters word={word} stress markDanger small />
          <div className="tiny">👀 Запомни ещё раз!</div>
        </div>
      )}
      <div className={`typed ${state}`}>{val || <span style={{ opacity: 0.3 }}>·</span>}</div>
      <Keyboard onKey={key} disabled={state !== 'idle' || peek} />
      {state === 'idle' && (
        <div className="row" style={{ width: '100%' }}>
          {!hintUsed ? (
            <HintBtn
              onClick={() => {
                setHintUsed(true);
                setPeek(true);
              }}
              label="Взглянуть"
            />
          ) : (
            !peek && (
              <button className="btn ghost sm" onClick={() => setPeek(true)}>
                👀 Ещё раз
              </button>
            )
          )}
          <button className="btn primary wide lg" disabled={!val} onClick={check}>
            Проверить ✓
          </button>
        </div>
      )}
      {hintUsed && !peek && <HintCard word={word} />}
    </div>
  );
}

// ── 7. Исправь робота ───────────────────────────────────────────────────────

function Fix({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const later = useTaskTimeout();
  const [chosen, setChosen] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const wrong = task.wrong ?? word.text;
  // если робот потерял букву («клас» вместо «класс»), подсвечиваем последнюю оставшуюся
  const rawDiff = wrong.split('').findIndex((c, i) => c !== word.text[i]);
  const diffIdx = Math.min(rawDiff === -1 ? wrong.length - 1 : rawDiff, wrong.length - 1);

  const pick = (v: string) => {
    if (chosen) return;
    setChosen(v);
    const ok = v === word.text;
    sfx.tap();
    if (ok) {
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
    later(() => onSolve(ok ? (hintUsed ? 3 : 5) : 0, v), ok ? 700 : 1200);
  };

  return (
    <div className="task">
      <p className="prompt">🤖 Робот ошибся! Выбери верное слово</p>
      <div className="word-big">
        {wrong.split('').map((c, i) => (
          <span key={i} style={i === diffIdx ? { color: 'var(--red)', background: 'var(--red-soft)', borderRadius: 8, padding: '0 3px' } : undefined}>
            {c}
          </span>
        ))}
      </div>
      <WordClue word={word} />
      <div className="options" style={{ gridTemplateColumns: '1fr' }}>
        {(task.options ?? []).map((o) => {
          const cls = !chosen ? '' : o === word.text ? 'ok' : o === chosen ? 'bad' : 'dim';
          return (
            <button key={o} className={`option ${cls}`} disabled={!!chosen} onClick={() => pick(o)}>
              {o}
            </button>
          );
        })}
      </div>
      {hintUsed ? <HintCard word={word} /> : !chosen && <HintBtn onClick={() => setHintUsed(true)} label="Что тут опасно?" />}
    </div>
  );
}

/** A delayed answer must not outlive its task (exit, profile change, next card). */
function useTaskTimeout() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  return (fn: () => void, ms: number) => {
    const timer = setTimeout(fn, ms);
    timers.current.push(timer);
    return timer;
  };
}
