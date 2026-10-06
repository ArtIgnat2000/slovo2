import { useState } from 'react';
import { LESSONS, WORDS } from '../../content/words';
import { useActiveProfile } from '../../state/store';
import { Sentence, WordArt, WordCard } from '../WordView';
import { dangerSummary } from '../../engine/word-facts';

/** Словарик: всё, что учим, с ударениями и «опасными» буквами. */
export function WordsScreen() {
  const profile = useActiveProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [lessonFilter, setLessonFilter] = useState<string>('all');

  const list = WORDS.filter((w) => lessonFilter === 'all' || w.theme === lessonFilter);
  const word = open ? WORDS.find((w) => w.id === open) : null;

  return (
    <div className="screen">
      <h1 className="mb">Словарик 📖</h1>
      <div className="row mb" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <button className={`chip ${lessonFilter === 'all' ? 'on' : ''}`} onClick={() => setLessonFilter('all')}>
          Все
        </button>
        {LESSONS.map((l) => (
          <button
            key={l.id}
            className={`chip ${lessonFilter === l.id ? 'on' : ''}`}
            onClick={() => setLessonFilter(l.id)}
          >
            {l.emoji} {l.title}
          </button>
        ))}
      </div>

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
                  Освоенность: {profile.words[word.id].s}% · ошибок: {profile.words[word.id].wrong}
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
