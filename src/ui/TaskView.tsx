import { useEffect, useState } from 'react';
import type { Task, Word } from '../types';
import { Sentence, WordLetters } from './WordView';
import { Keyboard } from './Keyboard';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

export type SolveFn = (quality: number | null, given?: string) => void;

interface Props {
  task: Task;
  word: Word;
  onSolve: SolveFn;
}

export function TaskView({ task, word, onSolve }: Props) {
  switch (task.kind) {
    case 'intro':
      return <Intro word={word} onSolve={onSolve} />;
    case 'syllables':
      return <Syllables word={word} onSolve={onSolve} />;
    case 'gap':
      return <Gap word={word} task={task} onSolve={onSolve} />;
    case 'build':
      return <Build word={word} task={task} onSolve={onSolve} />;
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

// ── 1. Знакомство: LOOK → SAY → увидеть опасное место ────────────────────────

function Intro({ word, onSolve }: { word: Word; onSolve: SolveFn }) {
  return (
    <div className="task">
      <div className="big-emoji">{word.emoji}</div>
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
      <p className="tiny center">
        Оранжевая — «опасная» буква. Посмотри на слово, проговори его так, как пишется, и закрой глаза —
        представь эту букву.
      </p>
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
  const [step, setStep] = useState(0);
  return (
    <div className="task">
      <WordLetters word={word} stress />
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
              if (i + 1 === word.syllables.length) setTimeout(() => onSolve(null), 400);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <Sentence word={word} hidden={false} />
    </div>
  );
}

// ── 3. Окошко ───────────────────────────────────────────────────────────────

function Gap({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const [chosen, setChosen] = useState<string | null>(null);
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
    setTimeout(() => onSolve(ok ? 5 : 0, l), ok ? 700 : 1200);
  };

  return (
    <div className="task">
      <p className="prompt">Какая буква спряталась?</p>
      <WordLetters word={word} stress markDanger hide={[task.dangerIdx]} />
      <Sentence word={word} />
      <div className="options">
        {(task.options ?? []).map((o) => {
          const cls = !chosen ? '' : o === correct ? 'ok' : o === chosen ? 'bad' : 'dim';
          return (
            <button key={o} className={`option ${cls}`} disabled={!!chosen} onClick={() => pick(o)}>
              {o.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 4. Собери слово ─────────────────────────────────────────────────────────

function Build({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const letters = task.letters ?? [];
  const [placed, setPlaced] = useState<(string | null)[]>(Array(word.text.length).fill(null));
  const [used, setUsed] = useState<boolean[]>(letters.map(() => false));
  const [hintUsed, setHintUsed] = useState(false);
  const [bad, setBad] = useState(false);

  const finish = (arr: (string | null)[]) => {
    const s = arr.join('');
    if (s === word.text) {
      sfx.correct();
      haptic.correct();
      setTimeout(() => onSolve(hintUsed ? 3 : 5), 700);
    } else {
      sfx.wrong();
      haptic.wrong();
      setBad(true);
      setTimeout(() => {
        setPlaced(Array(word.text.length).fill(null));
        setUsed(letters.map(() => false));
        setBad(false);
      }, 900);
    }
  };

  const tapLetter = (i: number) => {
    if (used[i] || bad) return;
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
    if (bad || placed[i] === null) return;
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

  const hint = () => {
    const slot = placed.findIndex((p) => p === null);
    if (slot < 0 || bad) return;
    const need = word.text[slot];
    const li = letters.findIndex((l, j) => !used[j] && l === need);
    if (li < 0) return;
    sfx.hint();
    setHintUsed(true);
    const np = [...placed];
    np[slot] = need;
    const nu = [...used];
    nu[li] = true;
    setPlaced(np);
    setUsed(nu);
    if (!np.includes(null)) finish(np);
  };

  return (
    <div className="task">
      <div className="row">
        <span style={{ fontSize: 40 }}>{word.emoji}</span>
        <Sentence word={word} />
      </div>
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
        <button className="btn ghost sm" onClick={hint}>
          🔤 Подставить букву{hintUsed ? ' (уже была)' : ' − меньше очков'}
        </button>
      )}
    </div>
  );
}

// ── 5. Напиши слово по памяти ───────────────────────────────────────────────

function Write({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const [val, setVal] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);

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
    setTimeout(() => onSolve(ok ? (hintUsed ? 3 : 5) : 0, val.trim()), ok ? 700 : 1300);
  };

  const hideAll = word.text.split('').map((_, i) => i).filter((i) => i !== task.dangerIdx);

  return (
    <div className="task">
      <div className="row">
        <span style={{ fontSize: 40 }}>{word.emoji}</span>
        <Sentence word={word} />
      </div>
      <p className="prompt">Напиши слово ✍️</p>
      {showHint && (
        <div style={{ textAlign: 'center' }}>
          <WordLetters word={word} markDanger hide={hideAll} small />
          <p className="tiny">Опасная буква — {word.text[task.dangerIdx].toUpperCase()}</p>
        </div>
      )}
      <div className={`typed ${state}`} style={{ minHeight: 56 }}>
        {val || <span style={{ opacity: 0.3 }}>·</span>}
      </div>
      <Keyboard onKey={key} disabled={state !== 'idle'} />
      {state === 'idle' && (
        <div className="row" style={{ width: '100%' }}>
          {!showHint && (
            <button
              className="btn ghost"
              onClick={() => {
                setShowHint(true);
                setHintUsed(true);
                sfx.hint();
              }}
            >
              💡
            </button>
          )}
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
  const ms = task.showMs ?? 2600;
  const [phase, setPhase] = useState<'show' | 'type'>('show');
  const [left, setLeft] = useState(ms);
  const [val, setVal] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');

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
    setTimeout(() => onSolve(ok ? 5 : 0, val.trim()), ok ? 700 : 1300);
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
      <div className="row">
        <span style={{ fontSize: 40 }}>{word.emoji}</span>
        <Sentence word={word} />
      </div>
      <p className="prompt">Напиши слово ✍️</p>
      <div className={`typed ${state}`}>{val || <span style={{ opacity: 0.3 }}>·</span>}</div>
      <Keyboard onKey={key} disabled={state !== 'idle'} />
      {state === 'idle' && (
        <button className="btn primary wide lg" disabled={!val} onClick={check}>
          Проверить ✓
        </button>
      )}
    </div>
  );
}

// ── 7. Исправь робота ───────────────────────────────────────────────────────

function Fix({ word, task, onSolve }: { word: Word; task: Task; onSolve: SolveFn }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const wrong = task.wrong ?? word.text;
  const diffIdx = wrong.split('').findIndex((c, i) => c !== word.text[i]);

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
    setTimeout(() => onSolve(ok ? 5 : 0, v), ok ? 700 : 1200);
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
      <Sentence word={word} />
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
    </div>
  );
}
